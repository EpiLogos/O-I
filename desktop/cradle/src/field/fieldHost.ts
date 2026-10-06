/**
 * The seam where everything outside the field's own components meets its one encounter.
 *
 * A mounted field registers itself here with exactly two verbs — `state()` and `apply(op)` — and
 * nothing else reaches in:
 *
 *   human      pointer and keyboard handlers in the field call `apply` with the same typed `FieldOp`s …
 *   agent      … that `fieldOperate` runs for a host relay (window event `oi:field-operate`, the shape a
 *              native host-operation admission would forward), with no DOM and no screenshot involved;
 *   companion  the prepared turn reads `activeFieldEncounter()` (primary, tangent, selected, constellation,
 *              generation) — see `fieldContextLines` — and records the generation it read.
 *
 * It is a registry of presentation state, not a store of it: the encounter lives in the field's controller
 * (and is persisted as the binding's `view.field`); this only lets the other relations find it.
 */
import {fieldApply, fieldContextRefs, type FieldEncounter, type FieldOp, type FieldResult} from "./model";

export interface FieldHostEntry {
  binding_id: string;
  world_ref: string;
  state(): FieldEncounter;
  apply(op: FieldOp): FieldResult;
  /** Titles for refs, so a prepared turn can say what the refs are (display only; refs stay authoritative). */
  describe?(ref: string): { title: string; revision?: string } | undefined;
}

const entries: FieldHostEntry[] = [];
const listeners = new Set<() => void>();
const announce = () => { for (const l of [...listeners]) l(); };

export function registerFieldHost(entry: FieldHostEntry): () => void {
  entries.push(entry); announce();
  return () => { const i = entries.indexOf(entry); if (i >= 0) { entries.splice(i, 1); announce(); } };
}
export function subscribeField(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
/** The field the person is looking at: the most recently mounted. */
export function activeField(): FieldHostEntry | undefined { return entries[entries.length - 1]; }
export function activeFieldEncounter(): FieldEncounter | undefined { return activeField()?.state(); }
/** Called by the field whenever its encounter changes, so subscribers re-read. */
export function announceField() { announce(); }

export type FieldOperateOutcome =
  | { ok: true; result: FieldResult; binding_id: string }
  | { ok: false; reason: string };

/** Run one typed operation on a mounted field — the agent's path and the human's are this same function. */
export function fieldOperate(op: FieldOp, binding_id?: string): FieldOperateOutcome {
  const entry = binding_id ? entries.find(e => e.binding_id === binding_id) : activeField();
  if (!entry) return { ok: false, reason: "no field is open" };
  if (!op || typeof op !== "object" || typeof (op as { op?: unknown }).op !== "string") return { ok: false, reason: "not a field operation" };
  return { ok: true, result: entry.apply(op), binding_id: entry.binding_id };
}

/** The host-relay route: `window.dispatchEvent(new CustomEvent("oi:field-operate", {detail: {op, binding_id?, reply?}}))`. */
export const FIELD_OPERATE_EVENT = "oi:field-operate";
export function installFieldOperateRoute(): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ op: FieldOp; binding_id?: string; reply?: (o: FieldOperateOutcome) => void }>).detail;
    if (!detail) return;
    detail.reply?.(fieldOperate(detail.op, detail.binding_id));
  };
  window.addEventListener(FIELD_OPERATE_EVENT, handler);
  return () => window.removeEventListener(FIELD_OPERATE_EVENT, handler);
}

/** What the companion's prepared turn is told about the field: roles, refs, revisions and the generation read.
 * The turn records `generation`; a later selection changes the next turn, never one already delivered. */
export function fieldContextReading(entry: FieldHostEntry | undefined = activeField()) {
  if (!entry) return undefined;
  const s = entry.state();
  return {
    schema: "oi.field-context/v1" as const,
    world_ref: s.world_ref, binding_id: entry.binding_id, generation: s.generation, emphasis: s.emphasis,
    primary: { ...s.primary, title: entry.describe?.(s.primary.ref)?.title },
    tangent: s.tangent ? { ref: s.tangent.ref, kind: s.tangent.kind, revision: s.tangent.revision, span: s.tangent.span, scene: s.tangent.scene, preview: s.tangent.preview, title: entry.describe?.(s.tangent.ref)?.title } : undefined,
    selected: s.selected ? { ref: s.selected, title: entry.describe?.(s.selected)?.title } : undefined,
    constellation: s.constellation ? s.constellation.refs.map(ref => ({ ref, title: entry.describe?.(ref)?.title })) : undefined,
    scene: s.scene,
    roles: fieldContextRefs(s),
  };
}
export type FieldContextReading = NonNullable<ReturnType<typeof fieldContextReading>>;

/** The same reading as the short lines a person sees under "Present" and an agent is handed — no prose of its own. */
export function fieldContextLines(r: FieldContextReading): string[] {
  const t = (x: { ref: string; title?: string }) => (x.title ? `${x.title} (${x.ref})` : x.ref);
  const lines = [`field generation ${r.generation} · ${r.emphasis}`, `main: ${t(r.primary)}${r.primary.revision ? ` @ ${r.primary.revision}` : ""}${r.primary.span ? ` · at ${r.primary.span}` : ""}`];
  if (r.tangent) lines.push(`tangent (${r.tangent.kind}${r.tangent.preview ? ", preview" : ", kept"}): ${t(r.tangent)}${r.tangent.scene ? ` · scene ${r.tangent.scene}` : ""}`);
  if (r.selected) lines.push(`selected: ${t(r.selected)}`);
  if (r.constellation?.length) lines.push(`constellation: ${r.constellation.map(t).join(", ")}`);
  return lines;
}

/** A pure re-export used by tests and the walk: apply without a mounted field. */
export const applyOffline = fieldApply;
