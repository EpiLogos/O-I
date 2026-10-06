/**
 * The field encounter — the one typed presentation state the Base field holds, and the one set of
 * operations by which a person (pointer, keyboard) or an agent changes it.
 *
 * Meaning (docs/cradle/CENTRAL-FIELD-CONTRACT.md §1): the encounter names *what the person is
 * standing on* — a main page, at most one tangent in view, what is selected, a gathered
 * constellation, an Expression scene, the field's emphasis — by native refs and the revisions they
 * were read at. It is not a source database, an agent session or a cache: reading a page is the
 * source's act; this only records which refs are in front of the reader and in which role.
 *
 * Everything here is pure. `fieldApply(state, op)` is the whole behaviour of the site's
 * page-over-page conventions, so a click, a key and an agent's typed operation cannot disagree:
 *
 *   select          marks one ref; never navigates, never opens a tab.
 *   open-main       turns the main page (a real navigation of the primary inquiry).
 *   open-preview    follows a ref as a tangent: an italic preview tab, replaced by the next tangent
 *                   of its kind (one slot for pages, one for Expressions); a ref already open is
 *                   focused instead of duplicated.
 *   keep            a preview becomes a kept tab (double-click).
 *   promote         a tangent becomes the main page; an Expression is handed to its own page
 *                   (an effect, not a state change of the primary).
 *   back            return to the main passage; on the main passage, to the previous main page.
 *   close / focus   tab housekeeping. Dirty editable work is never discarded by a replacement.
 *
 * Presentation-only structure (filters, rail widths, which folders are open) is held beside the
 * encounter in `FieldView` and never advances `generation`: `generation` counts changes to what the
 * encounter is *about*, which is what a prepared turn records.
 */

export type FieldRef = string;
export type FieldEmphasis = "essay" | "split" | "field" | "library";
export const FIELD_EMPHASES: readonly FieldEmphasis[] = ["essay", "split", "field", "library"] as const;
export type TangentKind = "page" | "expression";

/** A ref read at a revision; `span` is the position within it (an anchor id, a movement). */
export interface FieldTarget { ref: FieldRef; revision?: string; span?: string }

export interface FieldTab extends FieldTarget {
  id: string;
  kind: TangentKind;
  /** An Expression tab's scene. */
  scene?: string;
  preview: boolean;
  /** Unsaved, editable work lives in this tab: a replacement must not discard it. */
  dirty?: boolean;
}

export interface FieldEncounter {
  schema: "oi.field-encounter/v1";
  world_ref: string;
  primary: FieldTarget;
  /** The tangent in view — derived from `focus`; held so every consumer reads it without re-deriving. */
  tangent?: FieldTab;
  /** The tangent tabs, in order (the main page is not a tab here: it is `primary`). */
  tabs: FieldTab[];
  /** Which tab is in view: the main page, or a tab id. */
  focus: "primary" | string;
  selected?: FieldRef;
  constellation?: { refs: FieldRef[] };
  scene?: { expression_ref: FieldRef; scene_id: string };
  emphasis: FieldEmphasis;
  /** Earlier main pages (newest last, bounded) — what `back` returns to from the main passage. */
  trail: FieldTarget[];
  /** Advances on every change to what the encounter is about; a prepared turn records the value it read. */
  generation: number;
}

export type FieldOp =
  | { op: "select"; ref?: FieldRef | null }
  | { op: "open-main"; target: FieldTarget }
  | { op: "open-preview"; target: FieldTarget; kind?: TangentKind; scene?: string }
  | { op: "keep"; tab?: string }
  | { op: "promote"; tab?: string }
  | { op: "back" }
  | { op: "close"; tab: string }
  | { op: "focus"; tab: "primary" | string }
  | { op: "locate"; span?: string }
  | { op: "set-scene"; scene_id: string }
  | { op: "set-emphasis"; emphasis: FieldEmphasis }
  | { op: "enter-constellation"; refs: FieldRef[] }
  | { op: "leave-constellation" };

/** What an operation asks the host to do beyond changing the encounter. Never a source write. */
export type FieldEffect =
  | { effect: "open-expression-page"; ref: FieldRef; scene?: string }
  | { effect: "refused"; reason: string };

export interface FieldResult { state: FieldEncounter; effects: FieldEffect[]; changed: boolean }

export const TRAIL_LIMIT = 24;

export function freshEncounter(world_ref: string, primary: FieldTarget, emphasis: FieldEmphasis = "essay"): FieldEncounter {
  return { schema: "oi.field-encounter/v1", world_ref, primary, tabs: [], focus: "primary", emphasis, trail: [], generation: 0 };
}

const same = (a: FieldTarget, b: FieldTarget) => a.ref === b.ref;
const tabNamed = (s: FieldEncounter, id: string) => s.tabs.find(t => t.id === id);
const newId = (s: FieldEncounter) => `t${Math.max(0, ...s.tabs.map(t => Number(t.id.slice(1)) || 0)) + 1}`;

/** Keep `tangent` equal to the focused tab; the only place it is written. */
function settle(s: FieldEncounter): FieldEncounter {
  const tangent = s.focus === "primary" ? undefined : tabNamed(s, s.focus);
  const focus = s.focus !== "primary" && !tangent ? "primary" : s.focus;
  return { ...s, focus, tangent };
}
const bump = (s: FieldEncounter): FieldEncounter => ({ ...s, generation: s.generation + 1 });
const done = (before: FieldEncounter, after: FieldEncounter, effects: FieldEffect[] = []): FieldResult => {
  const next = settle(after);
  const changed = JSON.stringify({ ...next, generation: 0 }) !== JSON.stringify({ ...before, generation: 0 });
  return { state: changed ? bump(next) : before, effects, changed };
};
const refuse = (s: FieldEncounter, reason: string): FieldResult => ({ state: s, effects: [{ effect: "refused", reason }], changed: false });

/** Place a new preview of its own kind: it replaces the standing preview of that kind; a dirty standing
 * preview is kept instead (never replaced), and the new tab opens beside it. */
function place(s: FieldEncounter, tab: FieldTab): FieldEncounter {
  const standing = s.tabs.findIndex(t => t.preview && t.kind === tab.kind);
  if (standing < 0) return { ...s, tabs: [...s.tabs, tab], focus: tab.id };
  const old = s.tabs[standing];
  if (old.dirty) {
    const kept = s.tabs.map((t, i) => i === standing ? { ...t, preview: false } : t);
    return { ...s, tabs: [...kept, tab], focus: tab.id };
  }
  return { ...s, tabs: s.tabs.map((t, i) => i === standing ? { ...tab, id: old.id } : t), focus: old.id };
}

export function fieldApply(state: FieldEncounter, op: FieldOp): FieldResult {
  switch (op.op) {
    case "select": {
      const ref = op.ref ?? undefined;
      return done(state, { ...state, selected: ref });
    }
    case "open-main": {
      const target = op.target;
      // The same page again only refocuses it (and may carry a new position); another page is a navigation.
      if (same(state.primary, target)) {
        return done(state, { ...state, primary: { ...state.primary, ...target }, focus: "primary", emphasis: state.emphasis === "library" ? "essay" : state.emphasis });
      }
      const tabs = state.tabs.filter(t => t.kind !== "page" || !same(t, target));   // a tangent that becomes the page leaves the strip
      const trail = [...state.trail, state.primary].slice(-TRAIL_LIMIT);
      return done(state, { ...state, primary: target, tabs, focus: "primary", trail, selected: undefined, emphasis: state.emphasis === "library" ? "essay" : state.emphasis });
    }
    case "open-preview": {
      const kind: TangentKind = op.kind ?? "page";
      const target = op.target;
      // opening something leaves the gallery: the centre is the thing opened
      const lib = state.emphasis === "library" ? { emphasis: "essay" as FieldEmphasis } : {};
      if (kind === "page" && same(state.primary, target)) {
        // the main page is already open: go there (and to the span, if one was named)
        return done(state, { ...state, ...lib, focus: "primary", primary: target.span ? { ...state.primary, span: target.span } : state.primary });
      }
      const at = state.tabs.find(t => t.kind === kind && t.ref === target.ref);
      if (at) {
        const tabs = state.tabs.map(t => t.id === at.id ? { ...t, span: target.span ?? t.span, scene: kind === "expression" ? (op.scene ?? t.scene) : t.scene } : t);
        return done(state, { ...state, ...lib, tabs, focus: at.id, scene: kind === "expression" ? { expression_ref: at.ref, scene_id: op.scene ?? at.scene ?? state.scene?.scene_id ?? "" } : state.scene });
      }
      const tab: FieldTab = { id: newId(state), ...target, kind, scene: kind === "expression" ? op.scene : undefined, preview: true };
      const placed = place({ ...state, ...lib }, tab);
      return done(state, kind === "expression" ? { ...placed, scene: { expression_ref: target.ref, scene_id: op.scene ?? "" } } : placed);
    }
    case "keep": {
      const id = op.tab ?? (state.focus === "primary" ? undefined : state.focus);
      const tab = id ? tabNamed(state, id) : undefined;
      if (!tab) return refuse(state, "there is no tangent to keep");
      return done(state, { ...state, tabs: state.tabs.map(t => t.id === tab.id ? { ...t, preview: false } : t) });
    }
    case "promote": {
      const id = op.tab ?? (state.focus === "primary" ? undefined : state.focus);
      const tab = id ? tabNamed(state, id) : undefined;
      if (!tab) return refuse(state, "there is no tangent to make the main page");
      if (tab.kind === "expression") {
        // an Expression opens whole, in its own page: the primary does not move
        return done(state, state, [{ effect: "open-expression-page", ref: tab.ref, scene: tab.scene }]);
      }
      const trail = [...state.trail, state.primary].slice(-TRAIL_LIMIT);
      const tabs = state.tabs.filter(t => t.id !== tab.id);
      return done(state, { ...state, primary: { ref: tab.ref, revision: tab.revision, span: tab.span }, tabs, focus: "primary", trail, selected: undefined });
    }
    case "back": {
      if (state.focus !== "primary") return done(state, { ...state, focus: "primary" });
      const prev = state.trail[state.trail.length - 1];
      if (!prev) return refuse(state, "there is no earlier main page");
      return done(state, { ...state, primary: prev, trail: state.trail.slice(0, -1), focus: "primary", selected: undefined });
    }
    case "close": {
      const tab = tabNamed(state, op.tab);
      if (!tab) return refuse(state, "that tab is not open");
      const index = state.tabs.indexOf(tab);
      const tabs = state.tabs.filter(t => t.id !== tab.id);
      // closing the tab in view returns to its neighbour, or the main page
      const focus = state.focus === tab.id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? "primary") : state.focus;
      const scene = state.scene && tab.kind === "expression" && state.scene.expression_ref === tab.ref ? undefined : state.scene;
      return done(state, { ...state, tabs, focus, scene });
    }
    case "focus": {
      if (op.tab !== "primary" && !tabNamed(state, op.tab)) return refuse(state, "that tab is not open");
      const lib = state.emphasis === "library" ? { emphasis: "essay" as FieldEmphasis } : {};
      return done(state, { ...state, ...lib, focus: op.tab });
    }
    case "locate": {
      // the reading position of the target in view
      if (state.focus === "primary") return done(state, { ...state, primary: { ...state.primary, span: op.span } });
      return done(state, { ...state, tabs: state.tabs.map(t => t.id === state.focus ? { ...t, span: op.span } : t) });
    }
    case "set-scene": {
      const tab = state.focus === "primary" ? undefined : tabNamed(state, state.focus);
      if (!tab || tab.kind !== "expression") return refuse(state, "no Expression is in view");
      return done(state, { ...state, tabs: state.tabs.map(t => t.id === tab.id ? { ...t, scene: op.scene_id } : t), scene: { expression_ref: tab.ref, scene_id: op.scene_id } });
    }
    case "set-emphasis": {
      if (!FIELD_EMPHASES.includes(op.emphasis)) return refuse(state, `unknown emphasis ${String(op.emphasis)}`);
      return done(state, { ...state, emphasis: op.emphasis });
    }
    case "enter-constellation": {
      const refs = [...new Set(op.refs)];
      if (!refs.length) return refuse(state, "a constellation needs at least one ref");
      return done(state, { ...state, constellation: { refs } });
    }
    case "leave-constellation":
      return done(state, { ...state, constellation: undefined });
  }
}

/** Fold a sequence of operations (a replay, an agent's batch). Refusals are collected, never thrown. */
export function fieldReplay(state: FieldEncounter, ops: readonly FieldOp[]): FieldResult {
  let current = state; const effects: FieldEffect[] = []; let changed = false;
  for (const op of ops) { const r = fieldApply(current, op); current = r.state; effects.push(...r.effects); changed ||= r.changed; }
  return { state: current, effects, changed };
}

/** The refs the encounter is about, in role order — what a prepared turn names. */
export function fieldContextRefs(state: FieldEncounter): { role: "primary" | "tangent" | "selected" | "constellation"; ref: FieldRef }[] {
  const out: { role: "primary" | "tangent" | "selected" | "constellation"; ref: FieldRef }[] = [{ role: "primary", ref: state.primary.ref }];
  if (state.tangent) out.push({ role: "tangent", ref: state.tangent.ref });
  if (state.selected) out.push({ role: "selected", ref: state.selected });
  for (const ref of state.constellation?.refs ?? []) out.push({ role: "constellation", ref });
  return out;
}

/* ───────── presentation state kept beside the encounter ───────── */

export interface FieldFilter { depth: 1 | 2 | 3; hubs: boolean; hidden: string[] }
export interface FieldView {
  filter: FieldFilter;
  left: "open" | "closed";
  right: "open" | "closed";
  /** The field panel's width in px (the drag handle's value). */
  railWidth?: number;
  /** Explorer folders the reader opened. */
  open?: string[];
}
export const freshView = (): FieldView => ({ filter: { depth: 1, hubs: false, hidden: [] }, left: "open", right: "open" });

/** What persists as `SurfaceBinding.view.field`. */
export interface FieldPersisted { encounter: FieldEncounter; view: FieldView }

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const asTarget = (v: unknown): FieldTarget | undefined => {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || !isStr(o.ref)) return undefined;
  return { ref: o.ref, ...(isStr(o.revision) ? { revision: o.revision } : {}), ...(isStr(o.span) ? { span: o.span } : {}) };
};

/** Read a persisted encounter back. Anything that does not parse is dropped, never guessed: the caller starts fresh. */
export function parsePersistedField(raw: unknown): FieldPersisted | undefined {
  const o = raw as Record<string, unknown> | null;
  const e = o && typeof o === "object" ? o.encounter as Record<string, unknown> | undefined : undefined;
  if (!e || e.schema !== "oi.field-encounter/v1" || !isStr(e.world_ref)) return undefined;
  const primary = asTarget(e.primary);
  if (!primary || !Number.isSafeInteger(e.generation) || (e.generation as number) < 0) return undefined;
  const emphasis = FIELD_EMPHASES.includes(e.emphasis as FieldEmphasis) ? e.emphasis as FieldEmphasis : "essay";
  const tabs: FieldTab[] = [];
  for (const t of Array.isArray(e.tabs) ? e.tabs : []) {
    const target = asTarget(t); const r = t as Record<string, unknown>;
    if (!target || !isStr(r.id) || (r.kind !== "page" && r.kind !== "expression")) continue;
    tabs.push({ id: r.id, ...target, kind: r.kind, preview: r.preview === true, ...(isStr(r.scene) ? { scene: r.scene } : {}) });
  }
  const trail = (Array.isArray(e.trail) ? e.trail : []).map(asTarget).filter((t): t is FieldTarget => !!t).slice(-TRAIL_LIMIT);
  const selected = isStr(e.selected) ? e.selected : undefined;
  const refs = (e.constellation as { refs?: unknown } | undefined)?.refs;
  const constellation = Array.isArray(refs) && refs.every(isStr) && refs.length ? { refs: refs as string[] } : undefined;
  const sc = e.scene as { expression_ref?: unknown; scene_id?: unknown } | undefined;
  const scene = sc && isStr(sc.expression_ref) && typeof sc.scene_id === "string" ? { expression_ref: sc.expression_ref, scene_id: sc.scene_id } : undefined;
  const focus = isStr(e.focus) && (e.focus === "primary" || tabs.some(t => t.id === e.focus)) ? e.focus : "primary";
  const encounter = settle({ schema: "oi.field-encounter/v1", world_ref: e.world_ref, primary, tabs, focus, selected, constellation, scene, emphasis, trail, generation: e.generation as number });
  const v = (o as { view?: Record<string, unknown> }).view ?? {};
  const f = (v.filter ?? {}) as Record<string, unknown>;
  const depth = f.depth === 2 || f.depth === 3 ? f.depth : 1;
  const view: FieldView = {
    filter: { depth, hubs: f.hubs === true, hidden: Array.isArray(f.hidden) ? f.hidden.filter(isStr) : [] },
    left: v.left === "closed" ? "closed" : "open", right: v.right === "closed" ? "closed" : "open",
    ...(typeof v.railWidth === "number" && Number.isFinite(v.railWidth) ? { railWidth: Math.round(v.railWidth) } : {}),
    ...(Array.isArray(v.open) ? { open: v.open.filter(isStr) } : {}),
  };
  return { encounter, view };
}
