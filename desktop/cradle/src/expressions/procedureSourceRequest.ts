import type {NativeProcedureCompileRequest} from '../kernel/types';

const commands=new Set(['discover','manifest','prepare','regenerate','atlas','rule','library','interventions']);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function need(value:unknown,message:string):asserts value {if(!value)throw Error(message);}

/** The existing Source6 ingress sends the complete original native CompileRequest.
 * This is wire discrimination only; the native offlock worker owns CAS, Source
 * qualification, compiler execution and any producer admission. */
export function readNativeProcedureCompileRequest(value:unknown):NativeProcedureCompileRequest {
 assertNativeProcedureCompileRequest(value);return value;
}
function assertNativeProcedureCompileRequest(value:unknown):asserts value is NativeProcedureCompileRequest {
 need(object(value)&&Object.keys(value).sort().join(',')==='operation,request'&&value.operation==='procedural_compile','kernel-procedure-source requires the original typed procedural_compile request');
 const input=value.request;
 need(object(input)&&input.schema==='oi.expression-procedure-source-request/v1'&&typeof input.command==='string'&&commands.has(input.command),'Native Source6 command/schema differs');
 need(Object.keys(input).every(key=>['schema','command','request','basis'].includes(key))&&Object.prototype.hasOwnProperty.call(input,'request'),'Native CompileRequest contains another field or omits its original payload');
 if(input.command==='discover')need(input.request===null,'Native Source discovery has no caller-defined payload');
 else {
  const request=input.request;need(object(request),'Missing complete original native Source payload');
  need(input.command==='library'?request.schema==='ql.procedural-library/v1':input.command==='interventions'?typeof request.expression_ref==='string'&&typeof request.scene_ref==='string'&&object(request.before)&&object(request.after)&&Array.isArray(request.owned_addresses):request.schema==='ql.scene-procedural-request/v1','Native Source command differs from its complete original payload');
 }
 if(Object.prototype.hasOwnProperty.call(input,'basis')){const basis=input.basis;need(object(basis)&&Object.keys(basis).sort().join(',')==='document_revision,expression_ref'&&typeof basis.expression_ref==='string'&&Number.isSafeInteger(basis.document_revision)&&Number(basis.document_revision)>=0,'Native Source basis requires its exact original Expression/CAS');}
}
