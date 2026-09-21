/** Source Return is an explicit CAS over the ORIGINAL 0/1 HTML. It is never
 * an automatic transcript export, a new journal, or text attributed to F. */
import {parseInstance,textToHtml,type QlDocEntry} from '../../flow/instance';
import type {FlowInstance} from '../../flow/instances';
import type {CentralLocation} from '../../kernel/types';
import type {FileMutation} from '../../files/client';
import {text,object} from './client';
export interface DialogueReturn {delivery_ref:string;agent_session_ref:string;actor_ref:string;role:'nara'|'epii';subject_ref:string;text:string;complete:boolean}
export interface ReturnPorts {read(location:CentralLocation):Promise<FlowInstance>;write(location:CentralLocation,revision:string,html:string):Promise<FileMutation>}
export interface ReturnPreview {location:CentralLocation;expected_revision:string;document_id:string;entry:QlDocEntry;html:string;unchanged:boolean}
/** Scan actual HTML raw-text elements. The original export script contains
 * the ql-doc marker in a JavaScript string; a global marker count is not an
 * element count. Comments and script/style/textarea bodies are skipped. */
function documentIsland(html:string):{start:number;end:number} {
  const tags=/<!--[\s\S]*?-->|<(script|style|textarea|title|xmp)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  const found:{start:number;end:number}[]=[];
  for(let match=tags.exec(html);match;match=tags.exec(html)){
    if(!match[1])continue;
    const name=match[1].toLowerCase();
    const close=new RegExp(`</${name}\\s*>`,'gi');close.lastIndex=tags.lastIndex;
    const end=close.exec(html);if(!end)throw new Error('The Flow has an unclosed raw-text element');
    if(name==='script'&&/^<script type="application\/json" id="ql-doc">$/.test(match[0]))found.push({start:match.index,end:close.lastIndex});
    tags.lastIndex=close.lastIndex;
  }
  if(found.length!==1)throw new Error('The original Flow must have exactly one embedded ql-doc');
  return found[0];
}
async function key(parts:string[]):Promise<string>{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(parts)));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function validateFlow(html:string){
  const island=documentIsland(html);
  const doc=parseInstance(html.slice(island.start,island.end));object(doc);const meta=object(doc.meta);text(meta.documentId,'Saved Flow identity');
  if(!Number.isSafeInteger(meta.revision)||Number(meta.revision)<0||!['entries','notes','packet','media','journal'].every(k=>Array.isArray((doc as unknown as Record<string,unknown>)[k])))throw new Error('Flow data cannot be safely preserved');
  if(doc.entries.some(e=>!e||!['F','H'].includes(e.author)||typeof e.id!=='string'||typeof e.html!=='string')||new Set(doc.entries.map(e=>e.id)).size!==doc.entries.length)throw new Error('Existing Flow entries are malformed or ambiguous');
  return doc;
}
function replaceIsland(html:string,doc:ReturnType<typeof parseInstance>):string{
  const island=documentIsland(html);
  // JSON's standard Unicode escape preserves all human text while keeping
  // literal HTML closing tags/comments out of the script raw-text body.
  const json=JSON.stringify(doc).replace(/</g,'\\u003c');
  return html.slice(0,island.start)+'<script type="application/json" id="ql-doc">'+json+'</script>'+html.slice(island.end);
}
export async function previewDialogueReturn(instance:FlowInstance,returned:DialogueReturn,now=new Date()):Promise<ReturnPreview>{
  text(instance.revision,'Current Central revision');text(returned.delivery_ref);text(returned.agent_session_ref);text(returned.actor_ref);text(returned.subject_ref);
  if(!returned.complete||!['nara','epii'].includes(returned.role)||!returned.text.trim()||returned.text.length>262144)throw new Error('Only a complete attributed native response may be offered to the Flow');
  const doc=validateFlow(instance.html),documentId=doc.meta.documentId!;
  const id=`nara-return-${await key([documentId,returned.actor_ref,returned.agent_session_ref,returned.delivery_ref])}`;
  // Visible attribution is preserved even in the original self-contained HTML
  // outside Cradle. Content is escaped; model HTML never acquires execution.
  const body=textToHtml(`${returned.role==='nara'?'Nara':'Epii'} response\nActor: ${returned.actor_ref}\nNative delivery: ${returned.delivery_ref}\nAgentSession: ${returned.agent_session_ref}\nSubject: ${returned.subject_ref}`)+textToHtml(returned.text);
  const previous=doc.entries.find(e=>e.id===id);
  if(previous&&(previous.author!=='H'||previous.html!==body))throw new Error('This delivery was already returned with different content; no overwrite or duplicate was made');
  const entry:QlDocEntry=previous??{id,author:'H',at:now.toISOString(),html:body,replyTo:null,touched:false};
  if(!previous){if(doc.entries.length>=10000||doc.meta.revision===Number.MAX_SAFE_INTEGER)throw new Error('Flow has reached its safe entry/revision bound');doc.entries.push(entry);++doc.meta.revision;}
  return {location:structuredClone(instance.location),expected_revision:instance.revision,document_id:documentId,entry,html:previous?instance.html:replaceIsland(instance.html,doc),unchanged:!!previous};
}
export async function acceptDialogueReturn(preview:ReturnPreview,ports:ReturnPorts):Promise<FlowInstance>{
  // Re-read before write and send the exact reviewed CAS basis. A changed Flow
  // must be reviewed again; never silently rebase the proposal over user prose.
  const current=await ports.read(preview.location);
  if(current.revision!==preview.expected_revision||current.doc.meta.documentId!==preview.document_id)throw new Error('The Flow changed after review; your proposal remains unapplied');
  if(preview.unchanged)return current;
  const result=await ports.write(preview.location,preview.expected_revision,preview.html);
  if(result.outcome==='conflict')throw new Error('Central refused a stale Flow write; neither side was overwritten');
  if(!['written','unchanged'].includes(result.outcome)||!result.revision)throw new Error('Flow write is unconfirmed; re-read before retrying');
  const after=await ports.read(preview.location);
  if(after.html!==preview.html||after.revision!==result.revision)throw new Error('Flow write/readback did not confirm the reviewed content; no success is inferred');
  return after;
}
