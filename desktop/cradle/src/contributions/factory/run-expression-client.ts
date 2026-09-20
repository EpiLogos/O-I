import {kernelOp, type KernelOpCall} from "../../kernel/bridge";
import type {KernelTransportStatus} from "../../kernel/types";
import type {ExpressionDocument, ExpressionResult} from "../../expression/types";
import {readRunExpressionSnapshot, type RunExpressionSnapshot} from "./run-expression";

export class FactoryExpressionOperationError extends Error {
  readonly receipt:unknown;
  constructor(message:string,receipt?:unknown){super(message);this.name="FactoryExpressionOperationError";this.receipt=receipt;}
}
const unwrap=(call:KernelOpCall):ExpressionResult=>{
  if(call.error||call.outcome?.result!=="expression")throw new FactoryExpressionOperationError(call.error??"Expression handler returned no Expression result",call);
  if(!call.outcome.data||typeof call.outcome.data!=="object")throw new FactoryExpressionOperationError("Expression handler returned no data",call);
  return call.outcome.data;
};
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==="object"&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
export function assertNativeRunDocument(expected:ExpressionDocument,received:ExpressionDocument|undefined):asserts received is ExpressionDocument {
  if(!received||received.expression_ref!==expected.expression_ref||received.revision!==expected.revision||canonical(received.entities)!==canonical(expected.entities)||canonical(received.relations)!==canonical(expected.relations))
    throw new FactoryExpressionOperationError("Native Expression readback does not match this Run presentation",received);
}

/** Existing kernel Expression application only. Opening changes a presentation
 * draft, not Factory state, file contents, authority or execution status. */
export async function openNativeRunExpression(transport:KernelTransportStatus,snapshot:RunExpressionSnapshot,actor:string):Promise<ExpressionDocument> {
  const opened=unwrap(await kernelOp(transport,{op:"expression",request:{operation:"open",document:snapshot.document,actor}}));
  if(opened.state!=="ready")throw new FactoryExpressionOperationError(`Expression open ${opened.state??"returned no state"}`,opened);
  assertNativeRunDocument(snapshot.document,opened.document);
  const readback=unwrap(await kernelOp(transport,{op:"expression",request:{operation:"inspect",expression_ref:opened.document.expression_ref}}));
  if(readback.state!=="ready")throw new FactoryExpressionOperationError(`Expression inspect ${readback.state??"returned no state"}`,readback);
  assertNativeRunDocument(opened.document,readback.document);
  return readback.document;
}

export interface FactoryRunActionResult {state:string;actionRef:string;runRef:string;receipt:ExpressionResult}
/** One explicit action occasion, over an already opened native Expression.
 * input comes from the trusted native Action owner/host, never a portable
 * presentation binding. Native authority validates it; this client mints none.
 * After any sent operation the caller must refresh. Network loss cannot cause
 * a write replay, and a queued/returned dispatch is not a completed repair. */
export class FactoryRunActionSession {
  private busy=false;
  private refreshRequired=false;
  private disposed=false;
  readonly transport:KernelTransportStatus; readonly snapshot:RunExpressionSnapshot; readonly document:ExpressionDocument; readonly project:string|null;
  constructor(transport:KernelTransportStatus,snapshot:RunExpressionSnapshot,document:ExpressionDocument,project:string|null) {
    this.transport=transport;this.snapshot=snapshot;this.document=document;this.project=project;
    assertNativeRunDocument(snapshot.document,document);
  }
  dispose(){this.disposed=true;}
  async invoke(actionRef:string,input:unknown):Promise<FactoryRunActionResult> {
    if(this.disposed||this.busy||this.refreshRequired)throw new FactoryExpressionOperationError("Run action occasion is closed, busy or requires refresh");
    if(this.snapshot.attempt?.sourceCurrent===false)throw new FactoryExpressionOperationError("Retained workflow source is stale; use the native continuation/re-admission path");
    const entityRef=`${this.document.expression_ref}:entity:run`;
    const action=this.document.entities[entityRef]?.subject?.actions.find(a=>a.action_ref===actionRef);
    if(!action||action.target_ref!==this.snapshot.run.runRef)throw new FactoryExpressionOperationError("Action is not disclosed on this native Run");
    this.busy=true;
    try {
      const fresh=await readRunExpressionSnapshot(this.transport,this.snapshot.statePath,this.snapshot.run.runRef,this.document.expression_ref);
      if(this.disposed)throw new FactoryExpressionOperationError("Run action occasion was interrupted before dispatch");
      if(canonical([fresh.run,fresh.attempt,fresh.units])!==canonical([this.snapshot.run,this.snapshot.attempt,this.snapshot.units]))
        throw new FactoryExpressionOperationError("Factory source or Run changed; refresh before requesting an action",fresh);
      this.refreshRequired=true; // set BEFORE sending; never auto-retry an effect
      const data=unwrap(await kernelOp(this.transport,{op:"expression",request:{operation:"invoke",expression_ref:this.document.expression_ref,expected_revision:this.document.revision,entity_ref:entityRef,action_ref:actionRef,input,project:this.project}}));
      if(data.state!=="action_result"||data.action_ref!==actionRef||data.target_ref!==this.snapshot.run.runRef||!data.dispatch)
        throw new FactoryExpressionOperationError(`Native action ${data.state??"returned no correlated result"}`,data);
      // Preserve the dispatch verbatim, including denial, unknown effect and
      // late result. The UI must not turn state=action_result into success.
      return {state:this.disposed?"late-result":"owner-result",actionRef,runRef:this.snapshot.run.runRef,receipt:data};
    } finally {this.busy=false;}
  }
}
