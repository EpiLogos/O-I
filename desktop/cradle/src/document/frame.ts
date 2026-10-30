/**
 * Shared experiential-frame plumbing (DOCUMENT-SURFACE.md): the injected
 * page scripts every document frame carries, and the bounded host-read
 * bridge. Used by the file material host (MaterialSurface) and the source
 * document host (SourceSurface's rendered view) — one set of page-side
 * laws, no per-form variants.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import {readDocumentIdentity} from './identity';
import type { KernelTransportStatus } from "../kernel/types";
import pageContextScript from "../context/page-context.js?raw";
import documentHostScript from "../context/document-host.js?raw";
import documentFindRaw from "../context/document-find.js?raw";
import documentSaveKeyRaw from "../context/document-save-key.js?raw";

/** The find every hosted document frame carries (DLW §18.4: ⌘F in a pane finds in the instrument in front, as VS Code's ⌘F finds in the
 * file in front; context/document-find.js). It answers its host and marks; it reads and writes no owner. */
const documentFindScript = `<script>${documentFindRaw}</script>`;
/** ⌘S in every hosted document frame (DLW §10.9, §17.8; context/document-save-key.js): the pane's Save, asked of the host, before the
 * form's own ⌘S (its portable copy) can hear it. Placed after the find, so it stands first in the page's <head>. */
const documentSaveScript = `<script>${documentSaveKeyRaw}</script>`;

/** Place a page script in a projection: after the page's <head>, else after its <html>, else after its doctype, else first — never
 * before a doctype, which would drop the page out of standards mode. Pure. */
export function withFrameScript(html: string, script: string): string {
  for (const pattern of [/<head(?:\s[^>]*)?>/i, /<html(?:\s[^>]*)?>/i, /<!doctype[^>]*>/i]) {
    const found = pattern.exec(html);
    if (found) return html.slice(0, found.index + found[0].length) + script + html.slice(found.index + found[0].length);
  }
  return script + html;
}

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

/** The native document frame (kernel `document_frame`, served by the host's `oi-material://` protocol). Under Tauri a
 * srcdoc document inherits the shell window's Content-Security-Policy, whose script-src names a hash and no
 * 'unsafe-inline', so a hosted form's own scripts never run (seen on screen, native candidate ae9301a1b: the Flow pane's
 * head over blank paper). The frame page is a document of its own with no policy: it asks its parent once, and the
 * host writes into it the very projection a srcdoc frame carries — the payload seam and `documentScripts` included —
 * so the island read, the snapshot bridge and every save run over it exactly as over srcdoc. */
export const DOCUMENT_FRAME_URL = "oi-material://localhost/__application/document/frame.html";
export const DOCUMENT_FRAME_READY = "oi:document-frame-ready";
export const DOCUMENT_FRAME_WRITE = "oi:document-frame-write";

export interface DocumentFrameProps { key: string; src?: string; srcDoc?: string }

/** A cheap, stable digest of a projection (FNV-1a over its UTF-16 units): the native frame's key. */
function projectionDigest(html: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < html.length; index++) { hash ^= html.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(36);
}

/** Where a hosted document frame takes its document from — one switch by transport, as MaterialSurface's material URL:
 * under Tauri the native document frame, written with the projection; over the walk-bridge and in the browser preview
 * (no such policy there) the projection as srcdoc, as before. The native frame's key follows the projection, so a new
 * projection is a fresh frame (as a new srcdoc is a fresh document) and an unchanged one never remounts — the person's
 * edits inside the form stand. */
export function documentFrameProps(kind: KernelTransportStatus["kind"], html: string): DocumentFrameProps {
  if (kind !== "tauri") return { key: "srcdoc", srcDoc: html };
  return { key: `native:${html.length}:${projectionDigest(html)}`, src: DOCUMENT_FRAME_URL };
}

/** The frame page's one question, answered: the projection — and only to the frame's own window asking. */
export function documentFrameWrite(event: { data: unknown; source: unknown }, frameWindow: unknown, html: string): { type: typeof DOCUMENT_FRAME_WRITE; html: string } | null {
  const data = event.data as { type?: unknown } | null | undefined;
  if (!frameWindow || event.source !== frameWindow || data?.type !== DOCUMENT_FRAME_READY) return null;
  return { type: DOCUMENT_FRAME_WRITE, html };
}

/** A layout effect in a window; on a server render (no window, no frame) the plain effect, which does nothing there. */
const useCommitEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The props of a hosted document's iframe, and under Tauri its write: the listener stands in the commit that mounts the
 * frame (a layout effect), so the frame's question — a later task — is never posted unheard. */
export function useDocumentFrame(frame: RefObject<HTMLIFrameElement | null>, projection: string | undefined, transport: KernelTransportStatus): DocumentFrameProps | undefined {
  const kind = transport.kind;
  // The page carries its pane's find and its ⌘S (withFrameScript): the srcdoc and the native frame's write both frame the same projection.
  const html = useMemo(() => (projection === undefined ? undefined : withFrameScript(withFrameScript(projection, documentFindScript), documentSaveScript)), [projection]);
  const props = useMemo(() => (html === undefined ? undefined : documentFrameProps(kind, html)), [html, kind]);
  const native = props?.src !== undefined;
  useCommitEffect(() => {
    if (!native || html === undefined) return;
    const receive = (event: MessageEvent) => {
      const target = frame.current?.contentWindow;
      const answer = documentFrameWrite(event, target, html);
      if (answer) target?.postMessage(answer, "*");
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [frame, html, native]);
  return props;
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
