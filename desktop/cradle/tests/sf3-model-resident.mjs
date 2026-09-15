/**
 * Controlled test-only Pi-RPC protocol adapter for SF3 acceptance. AIKit remains the native
 * SessionSpace/delivery owner; this adapter runs the installed Codex harness
 * with a real Sol/low model and forwards its actual answer. This proves native delivery around a real model call, not an installed Pi resident or enduring model session.
 */
import readline from 'node:readline';
import {spawn} from 'node:child_process';
const emit=value=>process.stdout.write(`${JSON.stringify(value)}\n`);
const reply=(message,data={})=>emit({type:'response',id:message.id,command:message.type,success:true,data});
const runCodex=prompt=>new Promise((resolve,reject)=>{
 const child=spawn('codex',['exec','--model','gpt-5.6-sol','-c','model_reasoning_effort="low"','--ephemeral','--sandbox','read-only','--skip-git-repo-check','-'],{stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('close',code=>code===0?resolve(stdout.trim()):reject(new Error(`Codex exited ${code}: ${stderr}`)));child.stdin.end(prompt);
});
for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
 const message=JSON.parse(line),kind=message.type;
 if(kind==='get_state')reply(message,{sessionId:'codex-sol-low-sf3',isStreaming:false,isCompacting:false,pendingMessageCount:0});
 else if(kind==='prompt'){
  reply(message);try{const answer=await runCodex(message.message);emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:answer}});emit({type:'message_end',message:{role:'assistant',stopReason:'stop'}});emit({type:'agent_settled'});}catch(error){emit({type:'error',message:String(error)});emit({type:'agent_settled'});}
 } else if(kind==='abort'||kind==='clear_queue')reply(message);
 else emit({type:'response',id:message.id,command:kind,success:false,error:`Unsupported Pi RPC command ${kind}`});
}
