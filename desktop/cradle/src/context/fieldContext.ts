/**
 * The field's encounter as a contribution to the companion's PREPARED turn.
 *
 * The seam is the one every prepared selection already uses (AIKit's `aikit.prepared-context/v1`, reached through
 * `nativeContext`): the field's present encounter becomes ONE prepared item — an observation of the field — whose
 * text names the roles and refs (primary with revision and span, tangent, selected, constellation, scene) and whose
 * anchor carries the exact `generation` it was read at. Because it is an ordinary prepared item:
 *
 *   - it reaches the participant only when the person sends (nothing here sends, nothing here is automatic unless the
 *     person turned "keep current" on — "present here is not automatically prepared for the Agent");
 *   - the owner records it in the context digest the turn is dispatched against, so a turn keeps the basis it was
 *     prepared with while later selections only affect the NEXT turn;
 *   - a held generation that no longer matches the live field is detectable (`fieldItemStatus`) and refused by the
 *     same validation every observation passes before a send (`observationIsCurrent` → the registered validator).
 *
 * This module owns no state about the encounter and no session: the field host holds the encounter, AIKit holds the
 * prepared context; this only reads one and writes the other through their own operations.
 */
import type {KernelTransportStatus} from "../kernel/types";
import {fieldContextLines, currentFieldContext, type FieldContextReading} from "../field/fieldHost";
import {observationDocumentId, registerPageObservation, releaseObservation} from "./ComponentSelection";
import {nativeContext, type ContextProvider, type PreparedContext, type PreparedItem, type SelectionSnapshot} from "./nativeContext";

export const FIELD_CONTEXT_OWNER = "Field";
export const FIELD_ROLE = "field-encounter";

/** The anchor selector names the field binding and the generation: `field-encounter:<binding>#<generation>`. */
export const fieldSelector = (binding: string, generation: number) => `${FIELD_ROLE}:${binding}#${generation}`;
export function parseFieldSelector(selector: string): { binding: string; generation: number } | undefined {
  const m = /^field-encounter:(.+)#(\d+)$/.exec(selector);
  return m ? { binding: m[1], generation: Number(m[2]) } : undefined;
}
export const isFieldItem = (item: PreparedItem) => item.selection.anchor.kind === "observation" && item.selection.anchor.role === FIELD_ROLE && parseFieldSelector(item.selection.anchor.selector) !== undefined;
export const fieldItemGeneration = (item: PreparedItem) => (isFieldItem(item) && item.selection.anchor.kind === "observation" ? parseFieldSelector(item.selection.anchor.selector)?.generation : undefined);

export type FieldItemStatus = { state: "current"; generation: number } | { state: "stale"; held: number; live: number | undefined; reason: string };
/** Is the field context a prepared turn holds still what the field stands on? */
export function fieldItemStatus(item: PreparedItem, live: FieldContextReading | undefined): FieldItemStatus {
  const held = fieldItemGeneration(item);
  if (held === undefined) throw new Error("not a field context item");
  const sel = item.selection.anchor.kind === "observation" ? parseFieldSelector(item.selection.anchor.selector)! : undefined;
  if (!live) return { state: "stale", held, live: undefined, reason: "The field is closed; this was the encounter when it was prepared." };
  if (sel && sel.binding !== live.binding_id) return { state: "stale", held, live: live.generation, reason: "Another field is now in view." };
  if (held !== live.generation) return { state: "stale", held, live: live.generation, reason: `The field moved on (generation ${held} → ${live.generation}).` };
  return { state: "current", generation: held };
}

/** The prepared selection for one reading of the field. `key` is the observation the validator checks. */
export function fieldSelection(r: FieldContextReading, key: string, project: string | null, now = new Date()): SelectionSnapshot {
  const text = [...fieldContextLines(r), "", "refs by role:", ...r.roles.map(x => `- ${x.role}: ${x.ref}`)].join("\n");
  return {
    source_ref: r.primary.ref, source_revision: r.primary.revision ?? null, source_project: project, title: `Field · ${r.primary.title ?? r.primary.ref}`,
    owner: FIELD_CONTEXT_OWNER, binding_id: r.binding_id, text, working_copy: false, captured_at: now.toISOString(),
    anchor: { kind: "observation", document_id: observationDocumentId, key, selector: fieldSelector(r.binding_id, r.generation), role: FIELD_ROLE, node_ref: r.primary.ref, url: null },
  };
}

/** Bring the prepared context to the field's present encounter: any earlier field item is removed, one fresh item is
 * added. Returns the context as the owner now holds it. Throws the owner's own refusal. */
export async function prepareFieldContext(transport: KernelTransportStatus, project: string, session: string | undefined, live: FieldContextReading | undefined = currentFieldContext(), sourceWorldRef?: string): Promise<PreparedContext> {
  if (!live) throw new Error("No field is open, so there is no encounter to prepare.");
  let context = await nativeContext(transport, project, session, { operation: "read" }, sourceWorldRef);
  // an unchanged generation is already what the turn would carry: nothing to write
  const same = context.items.find(i => isFieldItem(i) && fieldItemStatus(i, live).state === "current");
  if (same && context.items.filter(isFieldItem).length === 1) return context;
  for (const old of context.items.filter(isFieldItem)) {
    context = await nativeContext(transport, project, session, { operation: "edit", basis: context.revision, mutation: { operation: "remove", id: old.id } }, sourceWorldRef);
  }
  const text = fieldContextLines(live).join("\n");
  const key = registerPageObservation(text, async () => currentFieldContext()?.generation === live.generation && currentFieldContext()?.binding_id === live.binding_id);
  try {
    return await nativeContext(transport, project, session, { operation: "edit", basis: context.revision, mutation: { operation: "add", selection: fieldSelection(live, key, project) } }, sourceWorldRef);
  } catch (error) { releaseObservation(key); throw error; }
}

/** Remove the field's items from the prepared context (turning the contribution off). */
export async function withdrawFieldContext(transport: KernelTransportStatus, project: string, session: string | undefined, sourceWorldRef?: string): Promise<PreparedContext> {
  let context = await nativeContext(transport, project, session, { operation: "read" }, sourceWorldRef);
  for (const old of context.items.filter(isFieldItem)) {
    context = await nativeContext(transport, project, session, { operation: "edit", basis: context.revision, mutation: { operation: "remove", id: old.id } }, sourceWorldRef);
  }
  return context;
}

/* ── the person's one switch: keep the field's encounter current in the companion's turns (default off) ── */
const KEY = "oi-cradle.field.context.keep";
let keep = (() => { try { return typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1"; } catch { return false; } })();
const keepListeners = new Set<() => void>();
export const fieldContextKept = () => keep;
export function setFieldContextKept(on: boolean) {
  keep = on; try { window.localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* per-viewer convenience */ }
  for (const l of [...keepListeners]) l();
}
export const subscribeFieldContextKept = (l: () => void) => { keepListeners.add(l); return () => { keepListeners.delete(l); }; };

/** The provider the context seam runs just before a turn reads the prepared context: when the person asked for the field's
 * encounter to be kept current, bring it to the live generation first. */
export const fieldContextProvider: ContextProvider = async ({transport, project, session, sourceWorldRef}) => {
  if (sourceWorldRef || !fieldContextKept() || !currentFieldContext()) return;
  await prepareFieldContext(transport, project, session);
};
