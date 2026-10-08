/**
 * Shared experiential-frame plumbing (DOCUMENT-SURFACE.md): the injected
 * page scripts every document frame carries, and the bounded host-read
 * bridge. Used by the file material host (MaterialSurface) and the source
 * document host (SourceSurface's rendered view) — one set of page-side
 * laws, no per-form variants.
 */
import { useCallback, useEffect, useRef, type RefObject } from "react";
import {readDocumentIdentity} from './identity';
import pageContextScript from "../context/page-context.js?raw";
import documentHostScript from "../context/document-host.js?raw";

/** The observation + document-host scripts every rendered document frame
 * carries. Presentation-only: they observe and answer the host, and grant
 * the page nothing. */
export const documentScripts = `<script>${pageContextScript}</script><script>${documentHostScript}</script>`;

/** The actual retained 0/1 and 4+2 forms keep their payload in closure D.
 * Adapt only their exact original declaration in the rendered copy; archived
 * intake bytes and canonical source are unchanged. New Flow copies carry
 * this read-only seam directly from the operative ql-flow template. */
export function documentPayloadSource(html:string):string {
 if(html.includes('__OI_DOCUMENT_PAYLOAD_READ__'))return html;
 const identity=readDocumentIdentity(html);
 if(identity?.payload!=='ql-doc'||!['flow','day'].includes(identity.family))return html;
 const seam="let D = JSON.parse($('#ql-doc').textContent);";
 if(html.split(seam).length!==2)return html;
 return html.replace(seam,seam+"\nwindow.__OI_DOCUMENT_PAYLOAD_READ__ = () => D;");
}

export interface FrameIsland { text: string | null; revision: number | null; documentId: string | null }

/** The document host bridge read: one bounded question to the rendered
 * frame — what does the page's own payload island hold right now. The
 * page gains nothing; the host learns only what the page already keeps. */
export function useDocumentHostRead(frame: RefObject<HTMLIFrameElement | null>, active: boolean) {
  const requests = useRef(new Map<string, {resolve: (value: FrameIsland | null) => void; timer: ReturnType<typeof setTimeout>}>());
  useEffect(() => {
    if (!active) return;
    const receive = (event: MessageEvent) => {
      const value = event.data;
      if (value?.type !== "oi:document-host-response") return;
      const pending = requests.current.get(value.request);
      if (!pending || !frame.current || event.source !== frame.current.contentWindow) return;
      requests.current.delete(value.request);
      clearTimeout(pending.timer);
      pending.resolve(value.result);
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      for (const pending of requests.current.values()) { clearTimeout(pending.timer); pending.resolve(null); }
      requests.current.clear();
    };
  }, [active, frame]);
  return useCallback(() => {
    const target = frame.current;
    if (!target?.contentWindow) return Promise.resolve(null);
    return new Promise<FrameIsland | null>(resolve => {
      const request = crypto.randomUUID();
      const timer = setTimeout(() => { requests.current.delete(request); resolve(null); }, 1500);
      requests.current.set(request, {resolve, timer});
      target.contentWindow?.postMessage({type: "oi:document-host-request", request, op: "read"}, "*");
    });
  }, [frame]);
}

// Local document recovery, separate from native mutation authority. A frame
// registers its actual bounded read + existing-store acknowledgement.
const checkpoints=new Map<string,Set<()=>Promise<void>>>();
const checkpointMembershipListeners=new Set<()=>void>();
export function observeDocumentCheckpointMembership(listener:()=>void):()=>void {checkpointMembershipListeners.add(listener);return()=>{checkpointMembershipListeners.delete(listener);};}
function checkpointMembershipChanged():void{for(const listener of checkpointMembershipListeners)listener();}
export function registerDocumentCheckpoint(bindingId:string,checkpoint:()=>Promise<void>):()=>void {
 const found=checkpoints.get(bindingId)??new Set<()=>Promise<void>>();found.add(checkpoint);checkpoints.set(bindingId,found);checkpointMembershipChanged();
 return()=>{if(!found.delete(checkpoint))return;if(!found.size&&checkpoints.get(bindingId)===found)checkpoints.delete(bindingId);checkpointMembershipChanged();};
}
const checkpointFlights=new Map<()=>Promise<void>,Promise<void>>();
const checkpointQueue:Array<()=>void>=[];
let activeCheckpoints=0;
function drainCheckpoints():void{while(activeCheckpoints<4&&checkpointQueue.length){activeCheckpoints++;checkpointQueue.shift()!();}}
function checkpointOnce(task:()=>Promise<void>):Promise<void>{
 const joined=checkpointFlights.get(task);if(joined)return joined;
 let resolve!:()=>void,reject!:(reason:unknown)=>void;
 const flight=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});
 checkpointFlights.set(task,flight);
 checkpointQueue.push(()=>{void Promise.resolve().then(task).then(resolve,reject).finally(()=>{checkpointFlights.delete(task);activeCheckpoints--;drainCheckpoints();});});
 drainCheckpoints();return flight;
}
export async function checkpointDocuments(bindingIds:readonly string[]):Promise<void> {
 const pending=[...new Set(bindingIds)].flatMap(id=>[...(checkpoints.get(id)??[])]);
 // Four actual local frame reads globally, including overlapping releases;
 // equivalent requests join one flight and retain its storage result.
 const results=await Promise.allSettled(pending.map(checkpointOnce));
 const failure=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');
 if(failure)throw failure.reason;
}

/** Snapshot every currently registered source/page recovery task in this
 * webview. Membership changes during the read require another close attempt;
 * a newly mounted frame cannot hide behind an earlier empty acknowledgement. */
export async function checkpointAllDocuments():Promise<void> {
 const pending=[...new Set([...checkpoints.values()].flatMap(tasks=>[...tasks]))];
 const results=await Promise.allSettled(pending.map(checkpointOnce));
 const failure=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');
 if(failure)throw failure.reason;
 const current=[...new Set([...checkpoints.values()].flatMap(tasks=>[...tasks]))];
 if(current.length!==pending.length||current.some(task=>!pending.includes(task)))throw Error('Document recovery membership changed while closing. Retry after the current view settles.');
}
