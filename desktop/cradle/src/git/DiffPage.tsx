import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {patchLines,readComparisons,splitLines,hunkPatch,diffFileKey,readDiffLayout,chooseDiffLayout,type DiffComparison,type DiffLayout,type DiffLine} from "./diffModel";
import {HighlightStyle} from "@codemirror/language";
import {highlightTree,tags} from "@lezer/highlight";
import {javascriptLanguage,typescriptLanguage} from "@codemirror/lang-javascript";
import {cssLanguage} from "@codemirror/lang-css";
import {jsonLanguage} from "@codemirror/lang-json";
import "./diff.css";
const syntax=HighlightStyle.define([{tag:[tags.keyword,tags.bool,tags.null],class:"diff-keyword"},{tag:[tags.string,tags.number],class:"diff-literal"},{tag:tags.comment,class:"diff-comment"}]);
function Code({text,path}:{text:string;path:string}){
 const language=/\.[cm]?tsx?$/.test(path)?typescriptLanguage:/\.[cm]?jsx?$/.test(path)?javascriptLanguage:/\.css$/.test(path)?cssLanguage:/\.json$/.test(path)?jsonLanguage:undefined;
 if(!language||text.length>500)return <>{text}</>;
 const nodes:React.ReactNode[]=[];let cursor=0;
 highlightTree(language.parser.parse(text),syntax,(from,to,classes)=>{if(from>cursor)nodes.push(text.slice(cursor,from));nodes.push(<span key={from} className={classes}>{text.slice(from,to)}</span>);cursor=to;});
 nodes.push(text.slice(cursor));return <>{nodes}</>;
}
export interface DiffIdentity{repo_root:string;from:string;to:string;file?:string}
export function DiffPage({identity}:{identity:DiffIdentity}){
 const kernel=useKernel(),[comparisons,setComparisons]=useState<DiffComparison[]>([]),[error,setError]=useState<string>(),[busy,setBusy]=useState(false),[ignore,setIgnore]=useState(false),[large,setLarge]=useState(false),[selected,setSelected]=useState(identity.file??""),[layout,setLayout]=useState<DiffLayout>(readDiffLayout),[width,setWidth]=useState(0),[height,setHeight]=useState(0),[scroll,setScroll]=useState(0),[notice,setNotice]=useState("");
 const root=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null),requestId=useRef(0);
 const read=useCallback(async()=>{
  const id=++requestId.current;setBusy(true);setError(undefined);setComparisons([]);
  try{
   const data=await readComparisons(identity,async(from,to)=>{
    const result=await kernelOp(kernel.transport,{op:"git_diff_read",request:{repo_root:identity.repo_root,from,to,ignore_whitespace:ignore,max_bytes:large?1048576:65536,max_files:200}});
    if(result.outcome?.result!=="git_diff_reading")throw Error(result.error??"Central did not return repository changes");return result.outcome.document;
   });
   if(id!==requestId.current)return;
   setComparisons(data);const files=data.flatMap(group=>group.reading.files.map(file=>({key:diffFileKey(group.kind,file.new_path),file})));
   setSelected(held=>files.some(row=>row.key===held)?held:(files.find(row=>row.file.new_path===identity.file)??files[0])?.key??"");
  }catch(e){if(id===requestId.current)setError(String(e instanceof Error?e.message:e));}finally{if(id===requestId.current)setBusy(false);}
 },[identity.repo_root,identity.from,identity.to,identity.file,ignore,large,kernel.transport]);
 useEffect(()=>{void read();return()=>{requestId.current++;};},[read]);
 useEffect(()=>{if(!viewport.current)return;const observer=new ResizeObserver(entries=>{setWidth(entries[0].contentRect.width);setHeight(entries[0].contentRect.height);});observer.observe(viewport.current);return()=>observer.disconnect();},[comparisons,selected]);
 const entries=useMemo(()=>comparisons.flatMap(group=>group.reading.files.map(file=>({kind:group.kind,reading:group.reading,file,key:diffFileKey(group.kind,file.new_path)}))),[comparisons]);
 const entry=entries.find(row=>row.key===selected),file=entry?.file,path=file?.new_path??"";
 const lines=useMemo(()=>patchLines(file?.patch??""),[file?.patch]),split=layout==="split"||(layout==="auto"&&width>=900),rows=useMemo(()=>split?splitLines(lines):lines.map(line=>({header:line,hunk:line.hunk})),[lines,split]);
 useEffect(()=>{if(viewport.current)viewport.current.scrollTop=0;setScroll(0);},[selected,split]);
 const start=Math.max(0,Math.floor(scroll/22)-6),end=Math.min(rows.length,Math.ceil((scroll+height)/22)+6),shown=rows.slice(start,end),hunks=rows.flatMap((row,index)=>row.header?.kind==="hunk"?[index]:[]);
 const jump=(direction:number)=>{const current=Math.floor((viewport.current?.scrollTop??0)/22);const index=direction>0?hunks.find(i=>i>current+1):[...hunks].reverse().find(i=>i<current-1);if(index!==undefined&&viewport.current)viewport.current.scrollTop=index*22;};
 const copy=async(text:string,label:string)=>{try{await navigator.clipboard.writeText(text);setNotice(`${label} copied`);}catch(e){setNotice(`Could not copy: ${String(e)}`);}};
 const selectedSource=():string|undefined=>{
  const selection=window.getSelection(),view=viewport.current;
  if(!selection?.rangeCount||selection.isCollapsed||!view?.contains(selection.anchorNode)||!view.contains(selection.focusNode)){setNotice("Select code in this diff first");return;}
  const sourceAt=(node:Node|null)=>(node instanceof Element?node:node?.parentElement)?.closest<HTMLElement>("code[data-diff-side]");
  const anchor=sourceAt(selection.anchorNode),focus=sourceAt(selection.focusNode);
  if(!anchor||!focus||anchor.dataset.diffSide!==focus.dataset.diffSide){setNotice("Select source code within one diff column");return;}
  const selected=selection.getRangeAt(0),parts:string[]=[];
  for(const code of view.querySelectorAll<HTMLElement>("code[data-diff-side]")){
   if(code.dataset.diffSide!==anchor.dataset.diffSide||!selected.intersectsNode(code))continue;
   const clipped=document.createRange();clipped.selectNodeContents(code);
   if(selected.compareBoundaryPoints(Range.START_TO_START,clipped)>0)clipped.setStart(selected.startContainer,selected.startOffset);
   if(selected.compareBoundaryPoints(Range.END_TO_END,clipped)<0)clipped.setEnd(selected.endContainer,selected.endOffset);
   if(!clipped.collapsed||code.textContent==="")parts.push(clipped.toString());
  }
  if(!parts.length){setNotice("Select code in this diff first");return;}
  return parts.join("\n");
 };
 const copySelection=()=>{const source=selectedSource();if(source!==undefined)void copy(source,"Selection");};
 const lineCopy=(line:DiffLine|undefined)=>line&&<button className="diff-copy-line" type="button" aria-label={`Copy ${line.kind==="delete"?"old":"new"} line ${(line.kind==="delete"?line.old:line.next)??""}`} title="Copy line" onClick={()=>void copy(line.text,"Line")}>Copy</button>;
 const cell=(line:DiffLine|undefined,side:"left"|"right")=><div className={`diff-cell ${line?.kind??"empty"}`}><span className="diff-number">{side==="left"?line?.old:line?.next}</span><span className="diff-sign">{line?.kind==="delete"?"−":line?.kind==="add"?"+":" "}</span><code data-diff-side={line?side:undefined}>{line&&<Code text={line.text} path={path}/>}</code>{lineCopy(line)}</div>;
 return <div ref={root} className="git-diff-page">
  <div className="diff-toolbar"><span>{entries.length?`${entries.length} file changes`:"Repository changes"} · {identity.to==="working-tree"?(identity.from==="HEAD"?"Uncommitted":`${identity.from} → HEAD and uncommitted`):`${identity.from} → ${identity.to}`}</span><button className="oi-action" disabled={busy} onClick={()=>void read()}>Refresh</button><label>View <select aria-label="Diff layout" value={layout} onChange={e=>{const value=e.target.value as DiffLayout;chooseDiffLayout(value);setLayout(value);}}><option value="auto">Automatic</option><option value="unified">Unified</option><option value="split">Split</option></select></label><label><input type="checkbox" checked={ignore} onChange={e=>setIgnore(e.target.checked)}/>Ignore whitespace</label></div>
  {error&&<p role="alert">Couldn’t read git changes: {error} <button className="oi-action" onClick={()=>void read()}>Retry</button></p>}
  {busy&&<p role="status">Reading repository changes…</p>}
  {comparisons.map(group=>group.reading.omitted_files?<p role="status" key={group.kind}>{group.kind==="working"?"Uncommitted":"Committed"}: {group.reading.omitted_files} more files are not shown (200-file bound).</p>:null)}
  {comparisons.length>0&&!entries.length&&!error&&<p>No changes in this comparison.</p>}
  {!!entries.length&&<div className="diff-workspace"><nav className="diff-files" aria-label="Changed files">{comparisons.map(group=><section key={group.kind}><h3>{group.kind==="working"?"● Uncommitted":"⑂ Committed"}</h3>{entries.filter(row=>row.kind===group.kind).map(({file:f,key})=><button type="button" key={key} aria-current={key===selected?"true":undefined} onClick={()=>setSelected(key)}><span className="diff-status">{f.status}</span><span className="diff-path" title={f.new_path}>{f.old_path&&<span className="diff-old-path">{f.old_path} → </span>}{f.new_path}</span><span className="diff-counts"><span className="diff-adds">{f.adds?`+${f.adds}`:""}</span> <span className="diff-dels">{f.dels?`−${f.dels}`:""}</span>{f.binary?"Binary":""}</span></button>)}</section>)}</nav><section className="diff-file" aria-label={path}>
  <header><strong title={entry?`${entry.reading.from} → ${entry.reading.to}`:undefined}>{entry?.kind==="working"?"● Uncommitted":"⑂ Committed"} · {path}</strong><button className="oi-action" aria-label="Previous change" onClick={()=>jump(-1)}>↑</button><button className="oi-action" aria-label="Next change" onClick={()=>jump(1)}>↓</button><button className="oi-action" disabled={!file?.patch} onClick={()=>void copy(file?.patch??"","Patch")}>Copy patch</button><button className="oi-action" onMouseDown={e=>e.preventDefault()} onClick={copySelection}>Copy selection</button></header>
  {file?.binary?<p>Binary file · Git does not expose a text patch.</p>:<><div ref={viewport} className="diff-viewport" tabIndex={0} role="region" aria-label="File changes" onCopy={e=>{e.preventDefault();const source=selectedSource();if(source!==undefined){e.clipboardData.setData("text/plain",source);setNotice("Selection copied");}}} onScroll={e=>setScroll(e.currentTarget.scrollTop)} onKeyDown={e=>{if(e.key===']'||e.key==='['){e.preventDefault();jump(e.key===']'?1:-1);}}}><div className="diff-rows" style={{height:rows.length*22}}><div style={{position:"absolute",top:start*22,left:0,right:0}}>{shown.map((row,index)=>row.header?.kind==="hunk"||row.header?.kind==="note"?<div key={start+index} className={`diff-row diff-${row.header.kind}`}>{row.header.text}{row.header.kind==="hunk"&&<button className="diff-copy-hunk" type="button" onClick={()=>void copy(hunkPatch(file?.patch??"",row.hunk),"Hunk")}>Copy hunk</button>}</div>:split?<div key={start+index} className="diff-row diff-split">{cell('left' in row?row.left:undefined,"left")}{cell('right' in row?row.right:undefined,"right")}</div>:<div key={start+index} className={`diff-row diff-unified ${row.header?.kind}`}><span className="diff-number">{row.header?.old}</span><span className="diff-number">{row.header?.next}</span><span className="diff-sign">{row.header?.kind==="delete"?"−":row.header?.kind==="add"?"+":" "}</span><code data-diff-side="unified"><Code text={row.header?.text??""} path={path}/></code>{lineCopy(row.header)}</div>)}</div></div></div>{file?.truncated&&<p role="status">Patch truncated at the read limit. {large?"The repository-wide limit is 2 MiB.":<button className="oi-action" onClick={()=>setLarge(true)}>Read up to 1 MiB per file</button>}</p>}</>}
  </section></div>}
  {notice&&<p role="status">{notice}</p>}
 </div>;
}
