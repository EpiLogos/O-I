/** Read-only typed QL production through the existing native host relay.
 * The installed native producer owns source, profiles, recipes and topology. */
import {clone} from './model.js';
export type ProcedureSourceCommand='discover'|'manifest'|'prepare'|'regenerate'|'atlas'|'rule'|'library'|'interventions';
export interface ProcedureSourceRequest {schema:'oi.expression-procedure-source-request/v1';command:ProcedureSourceCommand;request:Record<string,unknown>|null;basis?:{expression_ref:string;document_revision:number}}
export interface ProducerAdmission {producer_ref:string;expression_ref:string;document_revision:number;prepared:Record<string,unknown>;source:ProcedureSourceReply['source']}
export interface ProcedureSourceReply {
 schema:'oi.expression-procedure-source-response/v1';
 native_result:{schema:'ql.scene-procedural-response/v1';operation:ProcedureSourceCommand;result:unknown;registry_revision?:string;source_revision?:string};
 source:{schema:'oi.native-expression-composed-source/v1';ql_executable:string;ql_selection:string;ql_revision:string|null;request_sha256:string;result_sha256:string;compiled_at_unix_ms:number};
 admission?:ProducerAdmission;
}
export interface ProcedureSourceOwner {compile(request:ProcedureSourceRequest):Promise<unknown>}
const COMMANDS=new Set<ProcedureSourceCommand>(['discover','manifest','prepare','regenerate','atlas','rule','library','interventions']);
export function validateSourceReply(raw:unknown,command:ProcedureSourceCommand):ProcedureSourceReply {
 const reply=raw as ProcedureSourceReply,source=reply?.source;
 if(reply?.schema!=='oi.expression-procedure-source-response/v1'||reply.native_result?.schema!=='ql.scene-procedural-response/v1'||reply.native_result.operation!==command)throw Error('The native procedural source returned another operation or owner');
 if(source?.schema!=='oi.native-expression-composed-source/v1'||!source.ql_executable?.startsWith('/')||!['installed','operator-override'].includes(source.ql_selection)||!Number.isSafeInteger(source.compiled_at_unix_ms)||source.compiled_at_unix_ms<1||![source.request_sha256,source.result_sha256].every(hash=>/^[0-9a-f]{64}$/.test(hash)))throw Error('Native procedure production has no qualified executable/input/output basis');
 if(source.ql_selection==='installed'&&(!source.ql_revision||typeof source.ql_revision!=='string'))throw Error('Installed procedural source has no running revision');
 if(reply.admission){const a=reply.admission;if(!a.producer_ref?.startsWith('procedure-source:')||!/^[a-f0-9]{64}$/.test(a.producer_ref.slice(17))||!a.expression_ref?.startsWith('expression:')||!Number.isSafeInteger(a.document_revision)||a.document_revision<1||!a.prepared||typeof a.prepared!=='object'||JSON.stringify(a.source)!==JSON.stringify(source))throw Error('Native source admission differs from its actual qualified compiler result');}
 return clone(reply);
}
export class ProcedureSources {
 constructor(private readonly owner:ProcedureSourceOwner){}
 async run(command:ProcedureSourceCommand,request:Record<string,unknown>|null=null):Promise<ProcedureSourceReply>{
  const valid=command==='discover'?request===null:command==='library'?request?.schema==='ql.procedural-library/v1':command==='interventions'?typeof request?.expression_ref==='string'&&typeof request?.scene_ref==='string'&&typeof request?.before==='object'&&typeof request?.after==='object'&&Array.isArray(request?.owned_addresses):request?.schema==='ql.scene-procedural-request/v1';
  if(!COMMANDS.has(command)||!valid)throw Error('Choose a complete typed native procedure request');
  const input:ProcedureSourceRequest={schema:'oi.expression-procedure-source-request/v1',command,request:clone(request)};
  if(new TextEncoder().encode(JSON.stringify(input)).length>1_048_576)throw Error('Native procedure request exceeds one MiB');
  return validateSourceReply(await this.owner.compile(input),command);
 }
}
