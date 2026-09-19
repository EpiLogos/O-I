/**
 * Read one Expression document from its owner, and re-read when the kernel
 * reports `expression_changed`. Local to the requesting region — never a
 * second index, never a cache shared across regions.
 */
import {useCallback, useEffect, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import type {ExpressionDocument, ExpressionRequest, ExpressionResult} from "../expression/types";

export function useExpressionRequest() {
  const kernel = useKernel();
  return useCallback(async (request: ExpressionRequest): Promise<ExpressionResult> => {
    const reply = await kernelOp(kernel.transport, {op: "expression", request});
    if (reply.error || !reply.outcome || reply.outcome.result !== "expression") throw new Error(reply.error ?? "Expression application unavailable");
    return reply.outcome.data;
  }, [kernel.transport]);
}

/** The latest `expression_changed` receipt's seq — "look again", nothing more. */
export function useExpressionChangeSeq(): number | undefined {
  const kernel = useKernel();
  return kernel.receipts.filter(receipt => receipt.event === "expression_changed").slice(-1)[0]?.seq;
}

export type ExpressionDocumentReading =
  | {state: "none"}
  | {state: "reading"; expressionRef: string; document?: ExpressionDocument}
  | {state: "read"; expressionRef: string; document: ExpressionDocument}
  | {state: "refused"; expressionRef: string; error: string};

export function useExpressionDocument(expressionRef: string | undefined, revisionHint?: number): ExpressionDocumentReading {
  const request = useExpressionRequest();
  const seq = useExpressionChangeSeq();
  const [reading, setReading] = useState<ExpressionDocumentReading>({state: "none"});
  useEffect(() => {
    if (!expressionRef) { setReading({state: "none"}); return; }
    let live = true;
    setReading(current => current.state !== "none" && current.expressionRef === expressionRef && "document" in current && current.document ? {state: "reading", expressionRef, document: current.document} : {state: "reading", expressionRef});
    void request({operation: "inspect", expression_ref: expressionRef}).then(
      data => { if (live) setReading(data.document ? {state: "read", expressionRef, document: data.document} : {state: "refused", expressionRef, error: `The owner returned no document for ${expressionRef}`}); },
      cause => { if (live) setReading({state: "refused", expressionRef, error: cause instanceof Error ? cause.message : String(cause)}); },
    );
    return () => { live = false; };
  }, [expressionRef, revisionHint, seq, request]);
  return reading;
}
