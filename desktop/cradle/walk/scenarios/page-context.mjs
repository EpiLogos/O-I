import {setup as materialSetup} from './material.mjs';
import {openContextPlane} from "./prepared-helper.mjs";
import {appendFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export async function setup(args){const p=await materialSetup(args);appendFileSync(join(p.root,'Work/Material/assets/style.css'),'body{min-height:2400px;color:white}');return p;}
export default async function run({page,baseUrl,channel,check,shot}){
 const digest=createHash('sha256').update(readFileSync(new URL('../../src/context/page-context.js',import.meta.url))).digest('base64');
 const policy=JSON.parse(readFileSync(new URL('../../src-tauri/tauri.conf.json',import.meta.url),'utf8')).app.security.csp['script-src'];
 check(policy.includes(`'sha256-${digest}'`),'Native CSP permits exactly the reviewed material observation script');
 page.setDefaultTimeout(10000);await page.goto(baseUrl);await channel('info');
 const nav=page.getByRole('complementary',{name:'World navigator'});
 await nav.locator('[data-project-path="Work/Material"]').click();
 await nav.getByRole('button',{name:'Material: files',exact:true}).click();
 await nav.locator('[data-file-path="Work/Material/study.html"]').click();
 const frame=page.frameLocator('iframe.material-frame');await frame.locator('h1').waitFor();
 await frame.getByRole('button',{name:'Increment',exact:true}).click();
 check(await frame.locator('#count').innerText()==='1','Rendered HTML keeps its real script interaction');
 await frame.locator('h1').dblclick({position:{x:35,y:15}});
 const selected=await frame.locator('h1').evaluate(()=>getSelection().toString());
 check(selected.trim().length>0&&selected.trim()!=='Material study','Rendered HTML supports granular text selection');
 // Natural selection: no mode, no chrome — the add action appears at the
 // selection; the host stages the validated observation in the Context plane.
 await openContextPlane(page);
 await frame.getByText('+ Context',{exact:true}).click();
 const staged=page.locator('[data-prepared-id]').first();await staged.waitFor();
 check((await staged.locator('.prepared-excerpt').innerText())===selected,'Opaque HTML frame returns exactly the user-selected text');
 // Ordinary interaction stays live: there is no mode to leave, and acting
 // on a real control works — its click also clears any text selection,
 // which is exactly what a natural reading gesture should do.
 await frame.getByRole('button',{name:'Increment',exact:true}).click();
 check(await frame.locator('#count').innerText()==='2','Ordinary page interaction stays live without any context mode');
 // The staged selection carries its measured bounds in the item details.
 await staged.locator('.prepared-details-toggle').click();await staged.locator('.prepared-details').waitFor();
 check((await staged.locator('.prepared-details').innerText()).includes('×'),'Rendered selection carries measured bounds');
 await frame.locator('body').hover();await page.mouse.wheel(0,600);await page.waitForTimeout(350);
 check(await frame.locator('body').evaluate(()=>scrollY)>100,'Rendered page still scrolls with hidden scrollbars');
 check(await frame.locator('body').evaluate(el=>getComputedStyle(el).scrollbarWidth)==='none','Rendered page scrollbar chrome is suppressed');
 const sandbox=await page.locator('iframe').getAttribute('sandbox');check(!!sandbox&&sandbox.includes('allow-scripts')&&sandbox.includes('allow-forms')&&!sandbox.includes('allow-same-origin'),'Context observation preserves the opaque sandbox without shell authority');
 await shot('rendered-natural-context-and-scroll');
}
