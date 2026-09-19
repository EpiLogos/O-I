/**
 * The Expressions mode's selection — one tiny external store shared by the
 * left graph navigator, the centre surface and the right-panel planes.
 *
 * Two halves, deliberately separate:
 *
 *   selection  what the centre surface is ACTUALLY showing (published by the
 *              centre from the owner's document: expression / scene / entity
 *              refs and the revision they were read at). Readers treat it as
 *              a reading, not a command.
 *   request    what another region ASKS the centre to show (a graph click,
 *              a plane's "Review in the field"). The centre consumes it; a
 *              request made while no centre is mounted stays pending so the
 *              surface that opens next starts from it.
 *
 * Refs only. The owner's document stays with the kernel; nothing here caches
 * a body, and nothing here is persisted.
 */
import {useSyncExternalStore} from "react";
import {EXPRESSION_COMPOSE_EVENT} from "../expression/summon";

/** A plane or navigator that cannot open the centre surface itself (it has no
 * callback for it) asks the composition root to: a window CustomEvent with
 * `detail.expressionRef`. The pending request in this store then lands in the
 * surface that mounts. */
export const EXPRESSIONS_OPEN_EVENT = "oi:expressions-open";

export interface ExpressionSelection {
  expressionRef?: string;
  sceneRef?: string;
  entityRef?: string | null;
  /** The owner revision the selection was read at. */
  revision?: number;
  title?: string;
}

export type ExpressionFocusTarget = "review" | "entity" | "field";

export interface ExpressionSelectionRequest {
  seq: number;
  expressionRef: string;
  sceneRef?: string;
  entityRef?: string | null;
  /** Ask the centre to bring a Studio section forward. */
  focus?: ExpressionFocusTarget;
}

interface State {
  selection: ExpressionSelection;
  request: ExpressionSelectionRequest | null;
  /** Centre surfaces currently mounted (0 = a request needs the surface opened). */
  centres: number;
}

let state: State = {selection: {}, request: null, centres: 0};
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of [...listeners]) listener(); };
const same = (a: ExpressionSelection, b: ExpressionSelection) =>
  a.expressionRef === b.expressionRef && a.sceneRef === b.sceneRef && (a.entityRef ?? null) === (b.entityRef ?? null) && a.revision === b.revision && a.title === b.title;

export function subscribeExpressionSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getExpressionSelectionState = (): Readonly<State> => state;
export const getExpressionSelection = (): ExpressionSelection => state.selection;

/** The centre publishes what it is showing. */
export function publishExpressionSelection(selection: ExpressionSelection) {
  if (same(state.selection, selection)) return;
  state = {...state, selection};
  emit();
}

/** Another region asks the centre to show something. Returns whether a centre
 * surface is mounted to receive it — when false the caller opens one. */
export function requestExpressionSelection(request: Omit<ExpressionSelectionRequest, "seq">): boolean {
  state = {...state, request: {...request, seq: ++seq}};
  emit();
  return state.centres > 0;
}

/** The centre takes the pending request (at most once). */
export function consumeExpressionRequest(): ExpressionSelectionRequest | null {
  const request = state.request;
  if (!request) return null;
  state = {...state, request: null};
  emit();
  return request;
}

/** A centre surface announces itself for its mounted lifetime. */
export function registerExpressionCentre(): () => void {
  state = {...state, centres: state.centres + 1};
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state = {...state, centres: Math.max(0, state.centres - 1)};
    emit();
  };
}

export function useExpressionSelectionState(): Readonly<State> {
  return useSyncExternalStore(subscribeExpressionSelection, getExpressionSelectionState, getExpressionSelectionState);
}
export function useExpressionSelection(): ExpressionSelection {
  return useExpressionSelectionState().selection;
}

/** Ask for an Expression from a region with no open-callback of its own: the
 * request is recorded, and when no centre is mounted the composition root is
 * asked (by event) to open one. */
export function requestExpressionOpen(request: Omit<ExpressionSelectionRequest, "seq">) {
  if (!requestExpressionSelection(request) && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EXPRESSIONS_OPEN_EVENT, {detail: {expressionRef: request.expressionRef}}));
  }
}

// The app's existing "compose an Expression" summon. In Expressions mode the
// CENTRE surface answers it (the composition root opens/focuses the surface);
// this module records the summoned ref as a pending request so a surface that
// mounts a moment later still opens it, and a mounted one selects it at once.
// A summon without a ref asks for nothing specific and records nothing.
declare global { interface Window { __oiExpressionsSummonBound__?: boolean } }
if (typeof window !== "undefined" && !window.__oiExpressionsSummonBound__) {
  window.__oiExpressionsSummonBound__ = true;
  window.addEventListener(EXPRESSION_COMPOSE_EVENT, event => {
    const ref = (event as CustomEvent<{expressionRef?: unknown}>).detail?.expressionRef;
    if (typeof ref === "string" && ref.startsWith("expression:")) requestExpressionSelection({expressionRef: ref});
  });
}

/** Test/dev seam: return the store to its initial state. */
export function resetExpressionSelection() {
  state = {selection: {}, request: null, centres: 0};
  emit();
}
