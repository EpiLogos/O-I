/**
 * The field on the shared ExpressionWorld seam (contract §6).
 *
 * Agents already operate selection and tangent-like portals through the kernel's `expression_world` operations
 * (`oi desktop expression`, schema `oi.expression-world/v1`; renderer face `expression/world.ts`). The field does not mint a
 * parallel route for what those already say; its operations *are* them:
 *
 *   select(ref)                 → selection_set {origin graph|page, subject_ref, kind, native_owner, revision}
 *   open-preview(ref)           → portal_open {placement: preview, target_ref, surface_kind: "field", …}
 *   keep                        → portal_open (same portal) placement: beside
 *   promote (page)              → portal_open (same portal) placement: full — the canonical ref is preserved
 *   close tangent               → portal_close
 *
 * Both directions:
 *   outbound  `planOutbound(prev, next, op)` — the requests a field operation means. A human click and an agent call then
 *             yield the same `selection_read` / `portal_inspect`.
 *   inbound   `planInbound(state, read)` — the field operations a change made elsewhere (another caller's selection_set, an
 *             agent's portal_open of kind "field") means HERE: `select` (no navigation), `open-preview`, `keep`, `close`.
 *
 * `FieldEncounter.selected` and the tangent tabs are therefore projections of the kernel's selection and portal records, not a
 * second store; `back`, emphasis, constellation and tab focus stay host-local (`fieldApply`).
 * Pure planners (testable without a kernel) + a small stateful `createWorldSync` that carries the calls.
 */
import type {WorldCall, WorldRequest} from "../expression/world";
import type {FieldEncounter, FieldOp, FieldRef, FieldTab} from "./model";

export const FIELD_SURFACE_KIND = "field";
export type SelectionOrigin = "graph" | "page";

/** Kernel record shapes this reads (mirrors expression/world.ts `WorldSelection` / `WorldPortal`). */
export interface KSelection { subject_ref: string; kind: string; native_owner: string; revision?: string; origin: string }
export interface KPortal { portal_ref: string; target_ref: string; surface_id: string; surface_kind: string; placement: "preview" | "overlay" | "beside" | "full" | "detached"; title: string; opened_by: string }
export interface WorldRead { selection?: KSelection; portals: KPortal[] }

export interface DescribedRef { title: string; revision?: string; owner: string; kind: string; page: boolean }
export interface SyncContext {
  binding: string;
  actor: string;
  /** What the field knows of a ref: title, revision, the source owner (never "field"). Undefined: not a ref of this corpus. */
  describe(ref: FieldRef): DescribedRef | undefined;
  /** The portal an agent opened that this tab stands for, if it arrived that way (closing the tab closes that portal). */
  adoptedPortal?(tabId: string): string | undefined;
}

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(16); };
export const portalRefOf = (binding: string, tab: Pick<FieldTab, "id" | "ref">) => `field-portal:${binding}:${tab.id}:${hash(tab.ref)}`;
export const surfaceIdOf = (binding: string, tab: Pick<FieldTab, "id" | "ref">) => `field-tangent:${binding}:${tab.id}:${hash(tab.ref)}`;
const placementOf = (tab: FieldTab): KPortal["placement"] => (tab.preview ? "preview" : "beside");

export function selectionRequest(ref: FieldRef, origin: SelectionOrigin, d: DescribedRef): WorldRequest {
  return {operation: "selection_set", origin, subject_ref: ref, kind: d.kind, native_owner: d.owner, ...(d.revision ? {revision: d.revision} : {})};
}
const portalOpen = (c: SyncContext, tab: FieldTab, placement: KPortal["placement"], title: string): WorldRequest =>
  ({operation: "portal_open", portal_ref: portalRefOf(c.binding, tab), target_ref: tab.ref, surface_kind: FIELD_SURFACE_KIND, surface_id: surfaceIdOf(c.binding, tab), placement, title, actor: c.actor});
const portalClose = (c: SyncContext, tab: Pick<FieldTab, "id" | "ref">): WorldRequest => ({operation: "portal_close", portal_ref: portalRefOf(c.binding, tab), actor: c.actor});

/** The kernel requests a field operation means, given the encounter before and after it. */
export function planOutbound(prev: FieldEncounter, next: FieldEncounter, op: FieldOp, c: SyncContext, origin: SelectionOrigin = "page"): WorldRequest[] {
  const out: WorldRequest[] = [];
  if (op.op === "select") {
    const d = next.selected ? c.describe(next.selected) : undefined;
    if (next.selected && next.selected !== prev.selected && d?.page) out.push(selectionRequest(next.selected, origin, d));
    return out;                                   // selecting never touches portals
  }
  const before = new Map(prev.tabs.map(t => [t.id, t])), after = new Map(next.tabs.map(t => [t.id, t]));
  const title = (t: FieldTab) => c.describe(t.ref)?.title ?? t.ref;
  // a tangent that left: closed — or, when promoted to the main page, re-placed `full` (identity preserved, never re-derived)
  for (const [id, t] of before) {
    if (after.has(id) && after.get(id)!.ref === t.ref) continue;
    const promoted = op.op === "promote" && t.kind === "page" && next.primary.ref === t.ref;
    if (promoted) out.push(portalOpen(c, t, "full", title(t)));
    else { const theirs = c.adoptedPortal?.(t.id); out.push(theirs ? {operation: "portal_close", portal_ref: theirs, actor: c.actor} : portalClose(c, t)); }
  }
  for (const [id, t] of after) {
    const was = before.get(id);
    if (c.adoptedPortal?.(id) && was?.ref === t.ref) continue;                                   // an agent's portal: its placement is theirs
    if (!was || was.ref !== t.ref) out.push(portalOpen(c, t, placementOf(t), title(t)));      // a new tangent (or the preview slot taking another page)
    else if (was.preview !== t.preview) out.push(portalOpen(c, t, placementOf(t), title(t)));  // keep: re-place beside
  }
  return out;
}

/** The field operations a kernel-side change means here. `owned` are portal refs this field opened itself. */
export function planInbound(state: FieldEncounter, read: WorldRead, c: SyncContext, adopted: ReadonlyMap<string, string>, seen?: string): { ops: FieldOp[]; adopt: [string, FieldRef][]; release: string[] } {
  const ops: FieldOp[] = [], adopt: [string, FieldRef][] = [], release: string[] = [];
  const sel = read.selection;
  // `seen`: the kernel has no "clear", so a selection the person cleared here is not re-applied until the kernel's CHANGES
  // another caller's selection_set, of a page of this corpus: the selected node moves — no navigation, no tab
  if (sel && sel.subject_ref !== state.selected && sel.subject_ref !== seen && c.describe(sel.subject_ref)?.page) ops.push({op: "select", ref: sel.subject_ref});
  const mine = (p: KPortal) => p.portal_ref.startsWith(`field-portal:${c.binding}:`);
  const theirs = read.portals.filter(p => p.surface_kind === FIELD_SURFACE_KIND && !mine(p));
  const live = new Set(theirs.map(p => p.portal_ref));
  for (const p of theirs) {
    const tabId = adopted.get(p.portal_ref);
    const tab = tabId ? state.tabs.find(t => t.id === tabId) : undefined;
    if (!tab) {
      if (!c.describe(p.target_ref) && !p.target_ref.startsWith("expression:")) continue;             // not something this field shows
      const open = state.tabs.find(t => t.ref === p.target_ref);
      if (open) { adopt.push([p.portal_ref, p.target_ref]); if (open.preview && p.placement !== "preview") ops.push({op: "keep", tab: open.id}); continue; }
      ops.push({op: "open-preview", target: {ref: p.target_ref, revision: c.describe(p.target_ref)?.revision}, kind: p.target_ref.startsWith("expression:") ? "expression" : "page"});
      adopt.push([p.portal_ref, p.target_ref]);
      if (p.placement !== "preview") ops.push({op: "keep"});                                           // re-placed beside/full: kept
    } else if (tab.preview && p.placement !== "preview") ops.push({op: "keep", tab: tab.id});
  }
  // a portal an agent opened and has since closed: its tangent closes
  for (const [portalRef, tabId] of adopted) {
    if (live.has(portalRef)) continue;
    release.push(portalRef);
    if (state.tabs.some(t => t.id === tabId)) ops.push({op: "close", tab: tabId});
  }
  return {ops, adopt, release};
}

export interface WorldSync {
  /** Carry the requests a local operation means. Refusals come back as data; they are returned, not thrown. */
  mirror(prev: FieldEncounter, next: FieldEncounter, op: FieldOp, origin?: SelectionOrigin): Promise<{ request: WorldRequest; result: unknown; refused?: string }[]>;
  pull(): Promise<WorldRead>;
  /** What another caller's change means here, as field operations (to be applied WITHOUT mirroring back). */
  inbound(state: FieldEncounter): Promise<{ ops: FieldOp[]; adopt: [string, FieldRef][] }>;
  /** After the inbound ops were applied: tie each adopted portal to the tab now showing its target. */
  bind(state: FieldEncounter, adopt: [string, FieldRef][]): void;
  /** Portal refs of tangents that arrived from elsewhere, so a later close there closes the tab here. */
  adopted: Map<string, string>;
}

export function createWorldSync(call: WorldCall, base: SyncContext): WorldSync {
  const adopted = new Map<string, string>();
  const c: SyncContext = {...base, adoptedPortal: tabId => [...adopted].find(([, id]) => id === tabId)?.[0]};
  let mainPortal: string | undefined;
  let seen: string | undefined;          // the kernel selection last read or written by this field   // the portal a promoted page was re-placed `full` under
  const refusal = (r: unknown) => (r && typeof r === "object" && "state" in r && /unavailable|conflict|refus|unbound/.test(String((r as {state: unknown}).state)) ? String((r as {state: unknown}).state) : undefined);
  const run = async (request: WorldRequest) => {
    try { const result = await call(request); return {request, result, refused: refusal(result)}; }
    catch (e) { return {request, result: undefined as unknown, refused: e instanceof Error ? e.message : String(e)}; }
  };
  const sync: WorldSync = {
    adopted,
    async mirror(prev, next, op, origin) {
      const out: {request: WorldRequest; result: unknown; refused?: string}[] = [];
      const requests = planOutbound(prev, next, op, c, origin);
      for (const r of requests) if (r.operation === "portal_close") adopted.delete(r.portal_ref);
      // the main page changed: the portal that stood for the previous promoted page is released
      if (mainPortal && (op.op === "open-main" || op.op === "promote" || op.op === "back") && next.primary.ref !== prev.primary.ref) {
        out.push(await run({operation: "portal_close", portal_ref: mainPortal, actor: c.actor})); mainPortal = undefined;
      }
      for (const request of requests) {
        if (request.operation === "selection_set") seen = request.subject_ref;
        const r = await run(request); out.push(r);
        if (request.operation === "portal_open" && request.placement === "full" && !r.refused) mainPortal = request.portal_ref;
      }
      return out;
    },
    async pull() {
      const sel = await call({operation: "selection_read"}) as {state?: string; selection?: KSelection};
      const por = await call({operation: "portal_inspect"}) as {portals?: KPortal[]};
      return {selection: sel.state === "selected" ? sel.selection : undefined, portals: por.portals ?? []};
    },
    async inbound(state) {
      const read = await sync.pull();
      const plan = planInbound(state, read, c, adopted, seen);
      seen = read.selection?.subject_ref;
      for (const r of plan.release) adopted.delete(r);
      return {ops: plan.ops, adopt: plan.adopt};
    },
    bind(state, adopt) {
      for (const [portalRef, target] of adopt) { const tab = state.tabs.find(t => t.ref === target); if (tab) adopted.set(portalRef, tab.id); }
    },
  };
  return sync;
}
