/** Controlled protocol only. Actual repository bytes, not a native Central implementation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const transport = {kind:'bridge',url:'http://collection-controlled.invalid'};
export const revisionOf = text => 'sha256:'+createHash('sha256').update(text).digest('hex');
export const location = (name, root='controlled') => ({schema:'central.path-ref/v1', ref:`central:${root}:${name}`,root,path:name});
export function memoryTransport(files, {root='controlled', deny=[], failDirs={}, onRead, rewriteRead}={}) {
 const ops=[]; const denied=new Set(deny);
 const handle=async op=>{
  ops.push(structuredClone(op));
  if(op.op==='files_list') {
   if(failDirs[op.path])throw new Error(failDirs[op.path]);
   const prefix=op.path==='.'?'':op.path.replace(/\/$/,'')+'/';
   const names=new Map();
   for(const [file,content] of files){
    if(!file.startsWith(prefix))continue;
    const tail=file.slice(prefix.length),name=tail.split('/')[0];
    if(!name)continue;
    const kind=tail.includes('/')?'directory':'file',p=prefix+name;
    names.set(name,{name,kind,location:location(p,root),retrieval_allowed:!denied.has(p),byte_len:Buffer.byteLength(content)});
   }
   return {result:'directory_read',directory:{schema:'central.directory-reading/v1',location:location(op.path,root),entries:[...names.values()],automatic_agent_or_model_invocation:false}};
  }
  const p=op.location?.path;
  if(op.location?.ref!==location(p,root).ref)throw new Error('wrong source identity');
  if(denied.has(p))throw new Error('retrieval denied');
  if(op.op==='file_read') {
   if(!files.has(p))throw new Error('source retired: '+p);
   await onRead?.(p,ops);
   const content=files.get(p);
   let reading={schema:'central.file-reading/v1',location:location(p,root),revision:revisionOf(content),byte_len:Buffer.byteLength(content),content_encoding:'utf-8',content,project:null,source:null,automatic_agent_or_model_invocation:false};
   reading=rewriteRead?.(reading)??reading;
   return {result:'file_read',reading};
  }
  if(op.op==='file_operation' && op.request.action==='write') {
   if(!files.has(p))throw new Error('source retired: '+p);
   const current=revisionOf(files.get(p));
   if(current!==op.request.expected_revision)return {result:'file_operation',data:{outcome:'conflict',revision:current}};
   files.set(p,op.request.content);
   return {result:'file_operation',data:{outcome:'written',revision:revisionOf(op.request.content)}};
  }
  throw new Error('unexpected operation '+op.op);
 };
 const fetch=async(_url,opts)=>{
  try{return {json:async()=>({ok:true,outcome:await handle(JSON.parse(opts.body))})};}
  catch(e){return {json:async()=>({ok:false,error:e.message})};}
 };
 return {fetch,ops,handle};
}
export const APP=new URL('../expressions-app/',import.meta.url);
export const realManifests=['legacy-collections/manifest.json','collections/return-of-zero/essay.manifest.json','collections/return-of-zero/rooms.manifest.json','collections/return-of-zero/corpus.manifest.json','collections/bimba/bimba-c.manifest.json','collections/bimba/bimba-p.manifest.json','collections/bimba/bimba-l.manifest.json','collections/bimba/bimba-m.manifest.json','collections/bimba/bimba-s.manifest.json','collections/bimba/bimba-t.manifest.json','collections/bimba/bimba-grounds-weaves.manifest.json'];
export async function repositoryFiles(){
 const files=new Map();
 for(const manifest of realManifests){
  const text=await fs.readFile(new URL(manifest,APP),'utf8');
  files.set('Work/O-I/desktop/cradle/expressions-app/'+manifest,text);
  const m=JSON.parse(text);
  for(const e of [...m.featured??[],...m.starters??[]]){
   const p=path.posix.join(path.posix.dirname(manifest),e.file);
   files.set('Work/O-I/desktop/cradle/expressions-app/'+p,await fs.readFile(new URL(p,APP),'utf8'));
  }
 }
 return files;
}
