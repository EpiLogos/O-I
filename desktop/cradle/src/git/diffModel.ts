export interface DiffFile {status:string;old_path:string|null;new_path:string;adds:number|null;dels:number|null;binary:boolean;patch:string;truncated:boolean}
export interface DiffReading {schema:"central.git-diff/v1";repo_root:string;head_sha:string|null;from:string;to:string;ignore_whitespace:boolean;files:DiffFile[];omitted_files:number;truncated:boolean;observation:string}
export interface DiffLine {kind:"context"|"add"|"delete"|"hunk"|"note";text:string;old?:number;next?:number;hunk:number}
export interface SplitLine {left?:DiffLine;right?:DiffLine;header?:DiffLine;hunk:number}
export function readDiff(value:unknown):DiffReading {
 const d=value as DiffReading;
 if(d?.schema!=="central.git-diff/v1"||!Array.isArray(d.files)||d.files.length>200||typeof d.repo_root!=="string"||typeof d.from!=="string"||!d.from||typeof d.to!=="string"||!d.to||!Number.isSafeInteger(d.omitted_files)||d.omitted_files<0||d.files.some(f=>typeof f.patch!=="string"||typeof f.new_path!=="string"||typeof f.status!=="string"))throw Error("Central returned an incompatible repository diff");
 return d;
}
export function patchLines(patch:string):DiffLine[]{
 const result:DiffLine[]=[];let old=0,next=0,hunk=-1;
 for(const line of patch.split('\n')){
  const match=/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
  if(match){old=Number(match[1]);next=Number(match[2]);hunk++;result.push({kind:"hunk",text:line,hunk});continue;}
  if(hunk<0)continue;
  const kind=line[0];
  if(kind===' ')result.push({kind:"context",text:line.slice(1),old:old++,next:next++,hunk});
  else if(kind==='-')result.push({kind:"delete",text:line.slice(1),old:old++,hunk});
  else if(kind==='+')result.push({kind:"add",text:line.slice(1),next:next++,hunk});
  else if(line.startsWith('\\'))result.push({kind:"note",text:line,hunk});
 }
 return result;
}
export function splitLines(lines:DiffLine[]):SplitLine[]{
 const result:SplitLine[]=[];let index=0;
 while(index<lines.length){
  const line=lines[index];
  if(line.kind==='hunk'||line.kind==='note'){result.push({header:line,hunk:line.hunk});index++;continue;}
  if(line.kind==='context'){result.push({left:line,right:line,hunk:line.hunk});index++;continue;}
  const deleted:DiffLine[]=[],added:DiffLine[]=[];
  while(index<lines.length&&['delete','add'].includes(lines[index].kind)){const entry=lines[index++];(entry.kind==='delete'?deleted:added).push(entry);}
  for(let n=0;n<Math.max(deleted.length,added.length);n++)result.push({left:deleted[n],right:added[n],hunk:line.hunk});
 }
 return result;
}

export interface DiffComparison {kind:"working"|"committed";reading:DiffReading}
export interface DiffTarget {repo_root:string;from:string;to:string;file?:string}
/** Pin the committed comparison to the exact HEAD observed by the dirty read.
 * A supplied basis is explicit; the viewer never guesses a run or turn basis. */
export async function readComparisons(target:DiffTarget,read:(from:string,to:string)=>Promise<unknown>):Promise<DiffComparison[]>{
 if(target.to!=="working-tree")return [{kind:"committed",reading:readDiff(await read(target.from,target.to))}];
 const working=readDiff(await read("HEAD","working-tree"));
 const result:DiffComparison[]=[];
 if(target.from!=="HEAD"&&target.from!==working.from){
  result.push({kind:"committed",reading:readDiff(await read(target.from,working.from))});
 }
 result.push({kind:"working",reading:working});
 return result;
}
export function diffFileKey(kind:DiffComparison['kind'],path:string):string{return JSON.stringify([kind,path]);}
/** Exact native patch bytes for one hunk, with its original file headers. */
export function hunkPatch(patch:string,hunk:number):string{
 const starts=[...patch.matchAll(/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/gm)].map(match=>match.index!);
 if(!Number.isInteger(hunk)||hunk<0||hunk>=starts.length)return "";
 return patch.slice(0,starts[0])+patch.slice(starts[hunk],starts[hunk+1]??patch.length);
}
export type DiffLayout="auto"|"unified"|"split";
// Presentation choice survives closing/reopening a diff in this renderer only.
// Native presentation currently has no admitted durable diff preference field.
let sessionLayout:DiffLayout="auto";
export function readDiffLayout():DiffLayout{return sessionLayout;}
export function chooseDiffLayout(value:DiffLayout):void{sessionLayout=value;}
