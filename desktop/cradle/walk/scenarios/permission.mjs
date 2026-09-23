import {openConversationInCentre} from "../editor-doc.mjs";
import {setup as encounterSetup} from './encounter.mjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export async function setup(args){if(!process.env.AIKIT_ACP_PERMISSION_ARGV)throw new Error('Explicit actual consent-capable ACP provider required');return encounterSetup(args,process.env.AIKIT_ACP_PERMISSION_ARGV);}
export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
 await page.goto(baseUrl);await channel('info');
 await page.locator('[data-project-path="Work/Editor"]').click();
 await openConversationInCentre(page,'Native encounter acceptance');
 const message=page.getByRole('textbox',{name:'Message',exact:true});await message.waitFor();
 await page.getByRole('button',{name:'Acceptance ACP',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.encounter-connect'),null,{timeout:60000});
 await message.fill('Use a shell tool to write exactly OI_APPROVED_TOOL_WRITE into consent-output.txt in the current directory. This is an explicitly authorized isolated acceptance file. Request native permission before writing, then read the file and respond with its exact contents.');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.encounter button')).some(button=>button.textContent==='Send'&&!button.disabled));
 await page.getByRole('button',{name:'Send',exact:true}).click();
 // The inline permission card (10-SIDEBARS §4.3, P5): words first, the
 // harness's own allow options as scopes, the verbatim request behind Show raw.
 const consent=page.locator('.chat-permission');await consent.waitFor({timeout:150000});
 const result=p.native('encounter','--request-json',JSON.stringify({action:'view',agent_session:p.ref}));if(!result.ok)throw new Error(JSON.stringify(result));
 const request=result.data.permissions[0];
 await consent.locator('details.chat-permission-raw summary').click();
 check(JSON.parse(await consent.locator('details.chat-permission-raw pre').innerText()).tool_call!==undefined&&JSON.stringify(JSON.parse(await consent.locator('details.chat-permission-raw pre').innerText()).tool_call)===JSON.stringify(request.tool_call),'Consent keeps the exact native tool request behind Show raw');
 const allows=request.choices.filter(choice=>(choice.kind??'').startsWith('allow'));
 check(allows.length<2||await consent.locator('.chat-permission-scope').count()===allows.length,'Native allow options are the card\'s scope choices, none invented');
 const once=request.choices.find(choice=>choice.kind==='allow_once');if(!once)throw new Error('Actual native request did not offer allow_once');
 if(allows.length>1)await consent.locator('.chat-permission-scope',{hasText:'This time'}).click();
 await consent.getByRole('button',{name:'Allow',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.encounter-composer .chat-permission'),null,{timeout:30000});
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.encounter-assistant')).some(node=>node.textContent.includes('OI_APPROVED_TOOL_WRITE')),null,{timeout:150000});
 check(readFileSync(join(p.projectRoot,'consent-output.txt'),'utf8')==='OI_APPROVED_TOOL_WRITE','UI native consent completes the real isolated tool write/read');
 await page.getByRole('button',{name:'Activity',exact:true}).click();
 check(await page.locator('.encounter-thinking[data-kind=tool]').count()>0,'Activity retains native tool execution results after consent');
 await shot('native-consent-and-tool-result');
}
