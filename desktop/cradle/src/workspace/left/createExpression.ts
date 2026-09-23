/**
 * The create menu's "New Expression" (10-SIDEBARS §3.1): the same owner
 * operation the Expressions navigator's own New button makes — create one
 * Expression through the kernel's expression application — then summon it
 * into the Expressions stage through the existing compose route.
 */
import {kernelOp} from "../../kernel/bridge";
import type {KernelTransportStatus} from "../../kernel/types";
import {EXPRESSION_EDITOR_ACTOR} from "../../expression/useExpressionApplication";
import {summonExpression} from "../../expression/summon";

export async function createExpression(transport: KernelTransportStatus): Promise<string> {
  const ref = `expression:${crypto.randomUUID()}`;
  const reply = await kernelOp(transport, {op: "expression", request: {operation: "create", expression_ref: ref, title: "Untitled Expression", actor: EXPRESSION_EDITOR_ACTOR}});
  if (reply.error || !reply.outcome || reply.outcome.result !== "expression") throw new Error(`A new Expression could not be created: ${reply.error ?? "the Expression application is unavailable"}`);
  const data = reply.outcome.data as {document?: {expression_ref?: string}};
  const created = data.document?.expression_ref ?? ref;
  summonExpression(created);
  return created;
}
