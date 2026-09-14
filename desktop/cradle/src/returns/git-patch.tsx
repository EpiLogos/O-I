import {useEffect,useMemo,useState} from "react";
import type {DevelopmentFieldCurrentDiff,DevelopmentFieldGitWorking} from "../kernel/types";

interface PatchSection {id:string; label:string; content:string}

function headerPaths(header:string) {
  const paths:string[]=[];
  for(let index=0;index<header.length;) {
    while(header[index]===" ") index+=1;
    if(index>=header.length) break;
    const start=index;
    if(header[index]==='"') {
      index+=1;
      while(index<header.length) {
        if(header[index]==="\\") { index+=2;continue; }
        if(header[index++]==='"') break;
      }
    } else while(index<header.length&&header[index]!==" ") index+=1;
    paths.push(header.slice(start,index));
  }
  return paths;
}

function displayPath(path:string) {
  const stamped=path.split("\t",1)[0];
  if(stamped==="/dev/null") return undefined;
  const quoted=stamped.startsWith('"')&&stamped.endsWith('"');
  const value=quoted?stamped.slice(1,-1):stamped;
  // Git's source and destination prefixes are owner rendering metadata. Keep
  // quoted path bytes untouched so spaces and escapes retain their disclosure.
  const label=value.replace(/^(?:a|b|c|w)\//,"");
  return quoted?`"${label}"`:label;
}

function sectionLabel(content:string,header:string) {
  const added=content.match(/^\+\+\+ ([^\n]*)$/m)?.[1];
  const removed=content.match(/^--- ([^\n]*)$/m)?.[1];
  return (added&&displayPath(added))
    ??(removed&&displayPath(removed))
    ??displayPath(headerPaths(header)[1]??"")
    ??header;
}

/** Splits only the unified-diff sections AIKit returned. This is in-document
 * navigation, never a claim that a path is an openable desktop file. */
export function nativeGitPatchSections(patch:string):PatchSection[] {
  const starts=[...patch.matchAll(/^diff --git (.+)$/gm)];
  if(starts.length===0) return [{id:"native-patch",label:"Native patch",content:patch}];
  const occurrences=new Map<string,number>();
  return starts.map((match,index)=>{
    const header=match[0];
    const content=patch.slice(match.index,starts[index+1]?.index??patch.length);
    const occurrence=occurrences.get(header)??0;
    occurrences.set(header,occurrence+1);
    return {
      id:`native-patch-${header}-${occurrence}`,
      label:sectionLabel(content,match[1]),
      content,
    };
  });
}

function workingPaths(working:DevelopmentFieldGitWorking) {
  return [
    ...working.conflicted.map(path=>({path,standing:"conflicted"})),
    ...working.staged.map(path=>({path,standing:"staged"})),
    ...working.unstaged.map(path=>({path,standing:"unstaged"})),
    ...working.untracked.map(path=>({path,standing:"untracked"})),
  ];
}

export function NativeGitChangeBody({diff,working}:{diff:DevelopmentFieldCurrentDiff;working:DevelopmentFieldGitWorking}) {
  const sections=useMemo(()=>nativeGitPatchSections(diff.patch),[diff.patch]);
  const paths=useMemo(()=>workingPaths(working),[working]);
  const [selected,setSelected]=useState(sections[0]?.id);
  useEffect(()=>setSelected(current=>sections.some(section=>section.id===current)?current:sections[0]?.id),[sections]);
  const active=sections.find(section=>section.id===selected)??sections[0];
  return <section className="git-working-state-patch" aria-label="Native Git patch">
    {sections.length>1&&<nav className="git-working-state-patch-files" aria-label="Changed patch sections">{sections.map(section=><button key={section.id} type="button" aria-pressed={active?.id===section.id} onClick={()=>setSelected(section.id)}>{section.label}</button>)}</nav>}
    {paths.length>0&&<ul className="git-working-state-paths" aria-label="Owner-observed working paths">{paths.map(({path,standing},index)=><li key={standing+"-"+path+"-"+index} data-standing={standing}><code>{path}</code><small>{standing}</small></li>)}</ul>}
    <pre>{active?.content||"AIKit returned no tracked patch for this basis."}</pre>
    {diff.untracked_paths.length>0&&<p>Untracked paths included in this native difference: {diff.untracked_paths.map(path=><code key={path}>{path}</code>)}</p>}
    {diff.truncated&&<p className="git-working-state-warning">AIKit truncated this patch. The displayed body is only the returned prefix.</p>}
  </section>;
}
