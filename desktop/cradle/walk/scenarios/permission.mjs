import {setup as encounterSetup} from './encounter.mjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export async function setup(args){if(!process.env.AIKIT_ACP_PERMISSION_ARGV)throw new Error('Explicit actual consent-capable ACP provider required');return encounterSetup(args,process.env.AIKIT_ACP_PERMISSION_ARGV);}
export default async function run({page,baseUrl,check,shot,channel,provision:p}) {
 await page.goto(baseUrl);await channel('info');
 await page.locator('[data-project-path="Work/Editor"]').click();
 await page.getByRole('button',{name:'Native encounter acceptance',exact:true}).click();
 const message=page.getByRole('textbox',{name:'Message',exact:true});await message.waitFor();
 await page.getByRole('button',{name:'Acceptance ACP',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.encounter-connect'),null,{timeout:60000});
 await message.fill('Use a shell tool to write exactly OI_APPROVED_TOOL_WRITE into consent-output.txt in the current directory. This is an explicitly authorized isolated acceptance file. Request native permission before writing, then read the file and respond with its exact contents.');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.encounter button')).some(button=>button.textContent==='Send'&&!button.disabled));
 await page.getByRole('button',{name:'Send',exact:true}).click();
 const consent=page.getByRole('region',{name:'Provider consent',exact:true});await consent.waitFor({timeout:150000});
 const result=p.native('encounter','--request-json',JSON.stringify({action:'view',agent_session:p.ref}));if(!result.ok)throw new Error(JSON.stringify(result));
 const request=result.data.permissions[0];
 check(await consent.locator('pre').innerText()===JSON.stringify(request.tool_call,null,2),'Consent displays exact native tool request content');
 for(const choice of request.choices)check(await consent.getByRole('button',{name:choice.label,exact:true}).count()===1,`Native consent choice preserved: ${choice.label}`);
 const once=request.choices.find(choice=>choice.kind==='allow_once');if(!once)throw new Error('Actual native request did not offer allow_once');
 await consent.getByRole('button',{name:once.label,exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.encounter-composer .encounter-permission'),null,{timeout:30000});
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.encounter-assistant')).some(node=>node.textContent.includes('OI_APPROVED_TOOL_WRITE')),null,{timeout:150000});
 check(readFileSync(join(p.projectRoot,'consent-output.txt'),'utf8')==='OI_APPROVED_TOOL_WRITE','UI native consent completes the real isolated tool write/read');
 await page.getByRole('button',{name:'Activity',exact:true}).click();
 check(await page.locator('.encounter-thinking[data-kind=tool]').count()>0,'Activity retains native tool execution results after consent');
 await shot('native-consent-and-tool-result');
}
