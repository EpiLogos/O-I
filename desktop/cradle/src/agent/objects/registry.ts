/**
 * THE OBJECT PAGE REGISTRY — "Inspect opens the object" (10-SIDEBARS §4.7,
 * ruling D1). Every inspectable thing has its own page: labelled fields
 * first (what it is, its state, who changed it and when, its relations),
 * then its content; verbatim material only behind "Show raw". A page opens
 * as a tab in the focused pane (Base) or in place with ← back (full-page
 * modes); ⌥-click or "Pop out" opens it in its own window with the SAME
 * identity. It is never a right-panel tab and never a drawer.
 *
 * Lane 3 registers the Factory kinds (run, unit, attempt, tool call,
 * candidate, check, agent, NOW record — 11-FACTORY §6) on this same API.
 *
 * ── API ──────────────────────────────────────────────────────────────────
 *   ObjectRef {kind, ref, title, project?}   — identity only; never a payload
 *   registerObjectKind({kind, label, glyph?, read(ref, ctx) → ObjectReading})
 *   objectKindOf(kind) → def | undefined     objectKinds() → defs
 *   openObject(ref, {popOut?})               — ask the frame to open the page
 *   openIntent(event) → {popOut}             — ⌥-click means Pop out
 *   encodeObjectRef(ref) / decodeObjectRef(s) — the page's surface identity
 *                                              (SurfaceBinding kind "object",
 *                                              ref "oi-object:…")
 *   OPEN_OBJECT_EVENT                        — the frame's one listener
 *
 *   ObjectReading {kindLabel, title, state?, fields[], relations?[],
 *                  content?, raw?} — `read` answers from the owner each time
 *   the page mounts (a real read, not a copy), throwing an Error whose
 *   message is shown with Retry when the owner cannot answer.
 *
 * Handed material (the older `oi:panel-inspect` seam, agent/planes/
 * panelInspect.ts) opens as kind "handed": its payload is held in this
 * window's memory only (holdHanded), so after a restart its page says so
 * plainly instead of inventing the material again.
 */
import type {ReactNode} from "react";
import type {KernelTransportStatus} from "../../kernel/types";
import type {GlyphName} from "../../workspace/Glyph";

export interface ObjectRef {kind:string;ref:string;title:string;project?:string}
export interface ObjectField {label:string;value:ReactNode}
export interface ObjectRelation {label:string;object?:ObjectRef;text?:string}
export interface ObjectReading {
 kindLabel:string;
 title:string;
 /** One plain line: its current state ("running", "saved 2m ago"…). */
 state?:string;
 fields:ObjectField[];
 relations?:ObjectRelation[];
 content?:ReactNode;
 /** Verbatim owner material, shown only behind "Show raw". */
 raw?:unknown;
}
export interface ObjectContext {transport:KernelTransportStatus}
export interface ObjectKindDef {
 kind:string;
 /** Plain words for the kind ("Tool call", "Agent", "Run"). */
 label:string;
 glyph?:GlyphName;
 read:(ref:ObjectRef,context:ObjectContext)=>Promise<ObjectReading>|ObjectReading;
}

const kinds=new Map<string,ObjectKindDef>();
export function registerObjectKind(def:ObjectKindDef):void {kinds.set(def.kind,def);}
export const objectKindOf=(kind:string)=>kinds.get(kind);
export const objectKinds=()=>[...kinds.values()];

export const OPEN_OBJECT_EVENT="oi:open-object";
export interface OpenObjectDetail {object:ObjectRef;popOut?:boolean}
export function openObject(object:ObjectRef,options:{popOut?:boolean}={}):void {
 const detail={object,popOut:options.popOut===true};
 // A narrow panel shows the page in place as a detail layer (P18); it
 // answers first and the frame is not asked.
 for(const intercept of [...interceptors].reverse())if(intercept(detail))return;
 window.dispatchEvent(new CustomEvent<OpenObjectDetail>(OPEN_OBJECT_EVENT,{detail}));
}
const interceptors=new Set<(detail:OpenObjectDetail)=>boolean>();
/** Answer object opens before the frame does (return true to take one). */
export function interceptObjectOpens(intercept:(detail:OpenObjectDetail)=>boolean):()=>void {interceptors.add(intercept);return()=>{interceptors.delete(intercept);};}
/** ⌥-click (Alt) is Pop out; a plain click opens in place. */
export const openIntent=(event:{altKey:boolean})=>({popOut:event.altKey});
export function isOpenObjectDetail(value:unknown):value is OpenObjectDetail {
 const detail=value as Partial<OpenObjectDetail>|null;
 const object=detail?.object as Partial<ObjectRef>|undefined;
 return !!object&&typeof object.kind==="string"&&!!object.kind&&typeof object.ref==="string"&&!!object.ref&&typeof object.title==="string";
}

const PREFIX="oi-object:";
/** A page's identity as a surface ref: kind, project and ref, each encoded. */
export function encodeObjectRef(object:ObjectRef):string {
 return `${PREFIX}${encodeURIComponent(object.kind)}|${encodeURIComponent(object.project??"")}|${encodeURIComponent(object.ref)}`;
}
export function decodeObjectRef(value:string|undefined,title=""):ObjectRef|undefined {
 if(!value?.startsWith(PREFIX))return undefined;
 const [kind,project,ref]=value.slice(PREFIX.length).split("|").map(part=>{try{return decodeURIComponent(part);}catch{return "";}});
 if(!kind||!ref)return undefined;
 return {kind,ref,title,...(project?{project}:{})};
}
export const isObjectRef=(value:string|undefined)=>!!value?.startsWith(PREFIX);

// ── handed material: the panel-inspect seam's payloads, this window only ──
const handed=new Map<string,{payload:unknown;source?:string;kindLabel:string}>();
export function holdHanded(ref:string,material:{payload:unknown;source?:string;kindLabel:string}):void {
 handed.set(ref,material);
 if(handed.size>64)handed.delete(handed.keys().next().value!);
}
export const handedMaterial=(ref:string)=>handed.get(ref);
