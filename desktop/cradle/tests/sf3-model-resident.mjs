/**
 * One-shot acceptance resident for SF3. It uses the existing Actuation
 * gateway wire/session contract and a real installed Codex provider. It is
 * deliberately test-only: production continues to use the Agent's native
 * resident and the gateway remains the authority/receipt owner.
 */
import net from 'node:net';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const required=name=>{const value=process.env[name];if(!value)throw new Error(`${name} is required`);return value;};
const socket=net.createConnection(required('SF3_GATEWAY_SOCKET'));let pending=[];let buffer='';
socket.on('data',chunk=>{buffer+=chunk;for(;;){const end=buffer.indexOf('\n');if(end<0)break;const line=buffer.slice(0,end);buffer=buffer.slice(end+1);pending.shift()?.resolve(JSON.parse(line));}});
socket.on('error',error=>pending.shift()?.reject(error));
const call=frame=>new Promise((resolve,reject)=>{pending.push({resolve,reject});socket.write(`${JSON.stringify(frame)}\n`);});
const ok=async frame=>{const reply=await call(frame);if(reply.ok!==true)throw new Error(JSON.stringify(reply));return reply;};

await ok({op:'hello',protocol:'actuation.gateway/v1',subject:required('SF3_AGENT_SUBJECT')});
const attach=await ok({op:'attach',stream_ref:required('SF3_AGENT_STREAM'),actuation_ref:required('SF3_AGENT_ACTUATION'),agency_ref:required('SF3_AGENT_AGENCY'),agent_session_ref:required('SF3_AGENT_SESSION')});
let cursor=attach.cursor?.last_sequence??0,event;
while(!event){const reply=await ok({op:'wait',after:cursor,timeout_ms:15000});cursor=reply.last_sequence??cursor;event=reply.events?.find(row=>{if(row.kind!=='delegation')return false;try{return JSON.parse(row.content).expression?.ref===required('SF3_EXPRESSION_REF');}catch{return false;}});}
const payload=JSON.parse(event.content);const expression=payload.expression?.composition;
if(expression?.expression_ref!==payload.expression?.ref||expression?.revision!==payload.expression?.revision)throw new Error('Gateway invocation did not disclose one exact Expression revision');
const scene=expression.scenes?.find(row=>row.scene_ref===expression.selection?.scene_ref)??expression.scenes?.[0];if(!scene)throw new Error('Projected Expression has no disclosed scene');
const dir=mkdtempSync(join(tmpdir(),'oi-sf3-provider-'));const schema=join(dir,'schema.json'),answer=join(dir,'answer.json');
writeFileSync(schema,JSON.stringify({type:'object',additionalProperties:false,required:['summary','title'],properties:{summary:{type:'string'},title:{type:'string'}}}));
const prompt=`You are the projected Agent ${payload.target.agent_ref}. Read only the exact shared Expression JSON below. Propose one small entity title that makes its lesson clearer. Do not claim to edit it. Return JSON matching the supplied schema.\nExpression: ${JSON.stringify(expression)}\nHuman request: ${payload.instruction}`;
await ok({op:'post',kind:'tool-request',content:payload.instruction,resource_refs:['provider:codex']});
const run=spawnSync('codex',['exec','--ephemeral','--sandbox','read-only','--output-schema',schema,'-o',answer,'-'],{input:prompt,encoding:'utf8',timeout:120000});
if(run.status!==0)throw new Error(`Codex provider failed: ${run.stderr}`);const model=JSON.parse(readFileSync(answer,'utf8'));
const proposal={schema:'oi.expression-refinement/v1',expression_ref:expression.expression_ref,expected_revision:expression.revision,summary:model.summary,changes:[{change:'entity_add',scene_ref:scene.scene_ref,entity_ref:`${expression.expression_ref}:entity:agent-refinement`,title:model.title}],method_refs:[{ref:'provider:codex',revision:'installed',availability:'available'}],evidence_refs:(payload.source_refs??[]).map(ref=>({ref,revision:'projected',availability:'available'}))};
await ok({op:'post',kind:'tool-result',content:JSON.stringify(proposal),evidence_refs:['provider:codex']});
await ok({op:'post',kind:'return',content:JSON.stringify(proposal),return_ref:event.metadata.return_ref});
console.log(JSON.stringify({provider:'codex',proposal}));socket.end();
