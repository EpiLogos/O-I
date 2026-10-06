/**
 * The field's controller: the one `FieldEncounter` a mounted field holds, restored from the surface binding's
 * `view.field`, changed only by `fieldApply`, persisted back (debounced) and registered with the field host so
 * the agent and the companion reach the same state the pointer does.
 */
import {useCallback, useEffect, useMemo, useReducer, useRef} from "react";
import {fieldApply, freshEncounter, freshView, parsePersistedField, type FieldEffect, type FieldEncounter, type FieldOp, type FieldPersisted, type FieldRef, type FieldResult, type FieldView} from "./model";
import type {CorpusIndex} from "./corpusIndex";
import {announceField, registerFieldHost} from "./fieldHost";

/** What persists as `SurfaceBinding.view.field`: the world in view, plus the encounters of other worlds so
 * leaving the Epi world and returning to it restores the place. */
export interface FieldBindingView extends FieldPersisted { others?: Record<string, FieldPersisted> }

export function parseFieldBindingView(raw: unknown): { current?: FieldPersisted; others: Record<string, FieldPersisted> } {
  const current = parsePersistedField(raw);
  const others: Record<string, FieldPersisted> = {};
  const o = (raw as { others?: Record<string, unknown> } | null)?.others;
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { const p = parsePersistedField(v); if (p) others[k] = p; }
  return {current, others};
}

/** A restored encounter may name pages the corpus no longer has: drop what cannot be shown, never invent. */
export function reconcileEncounter(state: FieldEncounter, index: CorpusIndex): FieldEncounter {
  const has = (r: FieldRef) => index.has(r) || r.startsWith("expression:");
  const tabs = state.tabs.filter(t => has(t.ref));
  const primary = has(state.primary.ref) ? state.primary : { ref: index.home };
  const focus = state.focus === "primary" || tabs.some(t => t.id === state.focus) ? state.focus : "primary";
  const tangent = focus === "primary" ? undefined : tabs.find(t => t.id === focus);
  return {
    ...state, primary, tabs, focus, tangent, trail: state.trail.filter(t => index.has(t.ref)),
    selected: state.selected && index.has(state.selected) ? state.selected : undefined,
    constellation: state.constellation && state.constellation.refs.every(index.has.bind(index)) ? state.constellation : undefined,
  };
}

export interface FieldControllerArgs {
  bindingId: string;
  world_ref: string;
  index: CorpusIndex;
  stored: unknown;
  /** Write the binding's `view.field`. */
  persist: (value: FieldBindingView) => void;
  /** Declared effects of an operation (an Expression handed to its own page). */
  onEffect?: (effect: FieldEffect, state: FieldEncounter) => void;
  describe?: (ref: string) => { title: string; revision?: string } | undefined;
  /** Called after every real change with the encounter before and after — the world seam mirrors it (worldSync.ts).
   * `remote` marks a change that CAME from the kernel, which must not be echoed back. */
  onChange?: (prev: FieldEncounter, next: FieldEncounter, op: FieldOp, meta: {remote: boolean; origin?: "graph" | "page"}) => void;
}
export interface ApplyMeta { remote?: boolean; origin?: "graph" | "page" }

export function useFieldController(args: FieldControllerArgs) {
  const {index, world_ref, bindingId} = args;
  const stored = useMemo(() => parseFieldBindingView(args.stored), []);   // eslint-disable-line react-hooks/exhaustive-deps
  const init = useMemo(() => {
    const here = stored.current?.encounter.world_ref === world_ref ? stored.current : stored.others[world_ref];
    const encounter = here ? reconcileEncounter(here.encounter, index) : freshEncounter(world_ref, { ref: index.home, revision: index.node(index.home)?.revision });
    return {encounter, view: here?.view ?? freshView()};
  }, []);                                                                   // eslint-disable-line react-hooks/exhaustive-deps
  const state = useRef<FieldEncounter>(init.encounter);
  const view = useRef<FieldView>(init.view);
  const others = useRef<Record<string, FieldPersisted>>({
    ...stored.others, ...(stored.current && stored.current.encounter.world_ref !== world_ref ? { [stored.current.encounter.world_ref]: stored.current } : {}),
  });
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const latest = useRef(args); latest.current = args;
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    if (timer.current !== undefined) { window.clearTimeout(timer.current); timer.current = undefined; }
    latest.current.persist({ encounter: state.current, view: view.current, others: others.current });
  }, []);
  const persistSoon = useCallback(() => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 250);
  }, [flush]);

  const apply = useCallback((op: FieldOp, meta: ApplyMeta = {}): FieldResult => {
    const before = state.current;
    const result = fieldApply(before, op);
    if (result.changed) {
      state.current = result.state; rerender(); persistSoon(); announceField();
      latest.current.onChange?.(before, result.state, op, {remote: !!meta.remote, origin: meta.origin});
    }
    for (const effect of result.effects) latest.current.onEffect?.(effect, state.current);
    return result;
  }, [persistSoon]);

  const patchView = useCallback((patch: Partial<FieldView> | ((v: FieldView) => FieldView)) => {
    view.current = typeof patch === "function" ? patch(view.current) : { ...view.current, ...patch };
    rerender(); persistSoon();
  }, [persistSoon]);

  useEffect(() => {
    const stop = registerFieldHost({ binding_id: bindingId, world_ref, state: () => state.current, apply, describe: ref => latest.current.describe?.(ref) });
    return () => { stop(); flush(); };
  }, [bindingId, world_ref, apply, flush]);

  return {state: state.current, view: view.current, apply, patchView, stateRef: state, flush};
}
