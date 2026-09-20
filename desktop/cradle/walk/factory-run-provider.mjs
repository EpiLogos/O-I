// Explicit local provider readiness probe, NOT a Factory attempt or authority
// proof. Uses an operator-selected OpenAI-compatible chat endpoint once.
import {parseArgs} from 'node:util';
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const {values}=parseArgs({options:{endpoint:{type:'string'},model:{type:'string'},'token-env':{type:'string'},out:{type:'string'}}});
for(const key of ['endpoint','model','out'])if(!values[key])throw new Error(`Missing --${key}`);
const endpoint=new URL(values.endpoint);
if(endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw new Error('Use a credential-free endpoint and the named token environment variable');
if(endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)))throw new Error('Provider credentials require HTTPS except for a local loopback provider');
const token=values['token-env']?process.env[values['token-env']]:undefined;
if(values['token-env']&&!token)throw new Error('The named provider token environment variable is absent');
const nonce=`OI_FACTORY_${randomBytes(8).toString('hex')}`;
const evidence={schema:'oi.factory-provider-readiness/v1',standing:'provider-http-smoke-only-not-factory-execution',startedAt:new Date().toISOString(),endpoint:values.endpoint,requestedModel:values.model,nonce,automaticRetries:0};
let sent=false;
try{
  sent=true;
  const response=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({model:values.model,messages:[{role:'user',content:`Reply with exactly this nonce and nothing else: ${nonce}`}],max_tokens:32,stream:false})});
  const reader=response.body?.getReader();if(!reader)throw new Error('Provider returned no response body');
  const parts=[];let length=0;
  try{while(true){const next=await reader.read();if(next.done)break;length+=next.value.byteLength;if(length>1024*1024){await reader.cancel();throw new Error('Provider reply exceeded the bounded evidence size');}parts.push(Buffer.from(next.value));}}finally{reader.releaseLock();}
  const text=Buffer.concat(parts).toString('utf8');let body;try{body=JSON.parse(text);}catch{throw new Error(`Provider returned non-JSON content (HTTP ${response.status})`);}
  evidence.httpStatus=response.status;evidence.requestId=response.headers.get('x-request-id');
  evidence.actualModel=body.model??null;evidence.usage=body.usage??null;
  evidence.result=body.choices?.[0]?.message?.content??null;
  evidence.finishReason=body.choices?.[0]?.finish_reason??null;
  if(!response.ok)throw new Error(`Provider refused the bounded request (HTTP ${response.status}); inspect native owner diagnostics`);
  if(typeof evidence.result!=='string'||evidence.result.trim()!==nonce)throw new Error('Provider did not return the fresh requested nonce');
  evidence.outcome='readiness-pass';
}catch(error){evidence.outcome='failed';evidence.error=error instanceof Error?error.message:String(error);evidence.effect=sent?'request-sent-outcome-may-be-unknown':'not-sent';process.exitCode=1;}
finally{evidence.finishedAt=new Date().toISOString();evidence.selfInhabitation=false;await writeFile(values.out,JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({outcome:evidence.outcome,standing:evidence.standing,receipt:values.out}));}
