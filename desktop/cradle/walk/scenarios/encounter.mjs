import {setup as sourceSetup} from './editor.mjs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
export async function setup(args,argv=process.env.AIKIT_ACP_NATIVE_ARGV) {
 const p=await sourceSetup(args);const env={...process.env,...p.env,AIKIT_HOME:join(p.root,'.aikit-home')};
 const binary=process.env.OI_AIKIT_SESSION_SPACE_BIN;if(!binary)throw new Error('Explicit resident AIKit candidate required');
 const native=(...args)=>JSON.parse(execFileSync(binary,['-C',p.projectRoot,...args],{encoding:'utf8',env}));
 const bound=JSON.parse(execFileSync(process.env.OI_AIKIT_BIN,['--json','-C',p.projectRoot,'project','bind','editor-walk','--directory',p.projectRoot,'--no-default-skill-sets'],{encoding:'utf8',env}));if(!bound.ok)throw new Error(JSON.stringify(bound));
 const apply=preview=>native('apply','--preview-json',JSON.stringify(preview));const space='session-space/encounter-walk';const ref='agent-session/encounter-walk';
 apply(native('create',space,'--label','Resident encounter acceptance'));
 for(const intent of [{operation:'bind-project-context',binding:native('project-context')},{operation:'attach-agent-session',attachment:{agent_session:ref,purpose:'Native encounter acceptance',provenance:['Explicit real browser acceptance']}}])apply(native('stage','--space',space,'--intent-json',JSON.stringify(intent)));
 native('encounter-configure','--provider-json',JSON.stringify({id:'acceptance-acp',label:'Acceptance ACP',argv:JSON.parse(argv)}));
 const owner=native('encounter-start');if(!owner.ok)throw new Error(JSON.stringify(owner));
 return {...p,env,native,ref,space,cleanup:()=>{try{process.kill(-owner.data.pid,'SIGTERM');}catch{}p.cleanup();}};
}
export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
 await page.goto(baseUrl);await channel('info');
 await page.locator('[data-project-path="Work/Editor"]').click();
 await page.getByRole('button',{name:'Native encounter acceptance',exact:true}).click();
 const message=page.getByRole('textbox',{name:'Message',exact:true});await message.waitFor();
 await page.getByRole('button',{name:'Acceptance ACP',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.encounter-connect'),null,{timeout:60000});
 const nativeRequest=(action,fields={})=>{const r=p.native('encounter','--request-json',JSON.stringify({action,agent_session:p.ref,...fields}));if(!r.ok)throw new Error(JSON.stringify(r));return r.data;};
 const native=nativeRequest('status').native_session_id;
 check((await channel('read.focus')).data.subject.native_owner==='ai-kit','Encounter focus preserves AIKit ownership');
 await message.fill('Reply with exactly OI_DESKTOP_RESIDENT_OK. Do not use tools.');
 await page.getByRole('button',{name:'Send',exact:true}).waitFor();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.encounter button')).some(button=>button.textContent==='Send'&&!button.disabled));
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.encounter-assistant')).some(node=>node.textContent.includes('OI_DESKTOP_RESIDENT_OK')),null,{timeout:150000});
 check(await page.locator('.encounter-user').count()===1,'One native user message appears in the canonical transcript');
 // A short exact reply need not expose thinking. Exercise an actual long turn.
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('.encounter button')).some(button=>button.textContent==='Stop'));
 await message.fill('Write the integers from 1 to 20000, separated by spaces. Begin immediately. Do not use tools.');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.encounter button')).some(button=>button.textContent==='Send'&&!button.disabled));
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.locator('.encounter-thinking[data-kind=thinking] summary').first().waitFor({timeout:150000});
 await page.getByRole('button',{name:'Stop',exact:true}).click();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('.encounter button')).some(button=>button.textContent==='Stop'),null,{timeout:60000});
 check(await page.locator('.encounter-thinking[data-kind=thinking]').count()>0,'Provider-exposed thinking reaches the encounter presentation');
 await page.locator('.encounter-thinking[data-kind=thinking] summary').first().click();
 check((await page.locator('.encounter-thinking[data-kind=thinking] div').first().innerText()).length>0,'Thinking disclosure contains preserved provider content');
 check(nativeRequest('status').native_session_id===native,'Native cancellation keeps the same canonical session');
 await message.fill('Shared draft survives a view reload');
 await page.waitForFunction(()=>document.querySelector('.encounter-composer-actions [role=status]')?.textContent==='');
 check(nativeRequest('view').draft.text==='Shared draft survives a view reload','Composer is persisted by AIKit before view departure');
 await page.reload();await message.waitFor();
 await page.waitForFunction(()=>document.querySelector('.encounter textarea')?.value==='Shared draft survives a view reload',null,{timeout:15000});
 check(nativeRequest('status').native_session_id===native,'Reload retains the exact resident provider session');
 check(await page.locator('.encounter-assistant').filter({hasText:'OI_DESKTOP_RESIDENT_OK'}).count()===1,'Reload reads the same canonical transcript');
 await shot('native-resident-transcript-and-thinking');
}
