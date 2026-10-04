/**
 * One expressive act continuing across Factory, Expressions and Technè
 * (EXPRESSION-DEVELOPMENT-SPEC §6; contract EXPRESSION-ACT-MATERIAL-V1 §4).
 *
 * The act itself lives in the kernel (`act_continue` records the passage and
 * keeps cast, subject and selection); this module only holds which act the
 * person is currently carrying and routes the desktop to the mode's working
 * view: Factory → the Run's Live page, Expressions → the act's Expression in
 * the Expressions centre, Technè → the same Expression in the Technè field
 * (the constellation is who/what is present — the act's own participants).
 * Refs only; nothing here is a second act store.
 */
import {useSyncExternalStore} from "react";
import type {KernelTransportStatus} from "../kernel/types";
import {actContinue, actInspect, actOperate, actText, type ActMode, type WorldAct} from "./world";
import {summonExpression} from "./summon";

export interface CarriedAct {
  act_ref: string;
  /** The act's live Expression — the working composition every mode shows. */
  expression_ref: string;
  mode: ActMode;
  summary?: string;
  /** The Factory Run the act returns to (desk run key). */
  runKey?: string;
}

let carried: CarriedAct | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of [...listeners]) listener(); };

export function carryAct(act: CarriedAct | null): void {
  if (carried && act && carried.act_ref === act.act_ref && carried.mode === act.mode && carried.expression_ref === act.expression_ref && carried.runKey === act.runKey) return;
  carried = act ? {...act} : null;
  emit();
}
export const carriedAct = (): CarriedAct | null => carried;
export function useCarriedAct(): CarriedAct | null {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => carried, () => carried);
}

const ACTOR = "human:desktop";

/** Enter a workspace mode through the composition root (CradleFrame). */
export function enterWorkspaceMode(mode: "factory" | "expressions" | "techne"): void {
  window.dispatchEvent(new CustomEvent("oi:enter-mode", {detail: {mode}}));
}

/** Open the mode's working view on the act's Expression. */
async function route(to: ActMode, expressionRef: string, runKey: string | undefined): Promise<void> {
  if (to === "expressions") {
    window.dispatchEvent(new CustomEvent("oi:epi-open-expression", {detail: {expressionRef}}));
    return;
  }
  if (to === "techne") {
    enterWorkspaceMode("techne");
    // The Technè field consumes a summon only while its cut is presented; the
    // mode change commits on the next frame.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    summonExpression(expressionRef);
    return;
  }
  enterWorkspaceMode("factory");
  if (runKey) {
    const {openRunLive} = await import("../contributions/factory/desk/deskStore");
    openRunLive(runKey);
  }
}

/** Carry the act into another mode: the kernel records the continuation
 * (cast, subject and selection kept), then the desktop opens that mode's
 * working view on the same Expression. */
export interface ActContinuationRequest {act_ref: string; to: ActMode; expression_ref?: string; instrument_ref?: string; summary?: string; runKey?: string}
export async function continueActInMode(transport: KernelTransportStatus, input: ActContinuationRequest): Promise<WorldAct | undefined> {
  const outcome = await actContinue(transport, {act_ref: input.act_ref, actor: ACTOR, to: input.to, ...(input.instrument_ref ? {instrument_ref: input.instrument_ref} : {}), ...(input.expression_ref ? {expression_ref: input.expression_ref} : {}), ...(input.summary ? {summary: input.summary} : {})});
  if (outcome.state !== "act_continued" && !outcome.act) throw new Error(`The act could not continue: ${String(outcome.detail ?? outcome.state)}`);
  const act = outcome.act;
  const expressionRef = input.expression_ref ?? act?.expression_ref;
  if (!expressionRef) throw new Error("The act names no Expression to continue in");
  const runKey = input.runKey ?? carried?.runKey;
  carryAct({act_ref: input.act_ref, expression_ref: expressionRef, mode: input.to, summary: act?.summary ?? input.summary, runKey});
  await route(input.to, expressionRef, runKey);
  return act;
}

/** Return the working result to the Run: record the result as an operation of
 * the act (the Expression ref and revision it reached), fill the result text,
 * and continue in Factory on the Run's Live view. */
export async function returnActToFactory(transport: KernelTransportStatus, input: {act_ref: string; result_ref: string; result_revision?: number; text: string; runKey?: string}): Promise<WorldAct | undefined> {
  const from = carried?.mode ?? "techne";
  await actOperate(transport, {act_ref: input.act_ref, actor: ACTOR, operation_kind: `${from}.return`, native_ref: input.result_revision === undefined ? input.result_ref : `${input.result_ref}@${input.result_revision}`, mode: from, summary: input.text});
  const act = (await actInspect(transport, input.act_ref)).act;
  if (act?.role_entities?.resultText) await actText(transport, {act_ref: input.act_ref, actor: ACTOR, role: "resultText", text: input.text}).catch(() => undefined);
  return continueActInMode(transport, {act_ref: input.act_ref, to: "factory", runKey: input.runKey});
}
