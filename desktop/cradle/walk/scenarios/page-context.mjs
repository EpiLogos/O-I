import {setup as materialSetup} from './material.mjs';
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
 await page.getByRole('button',{name:'Context mode',exact:true}).click();await page.waitForTimeout(400);
 await page.getByRole('button',{name:'Attach selection',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Include selected context'});await dialog.waitFor();
 check(await dialog.locator('pre').innerText()===selected,'Opaque HTML frame returns exactly the user-selected text');
 await dialog.getByRole('button',{name:'Close context selection'}).click();

 await frame.getByRole('button',{name:'Increment',exact:true}).hover();
 await frame.getByRole('button',{name:'Increment',exact:true}).click();await dialog.waitFor();
 check(await dialog.locator('pre').innerText()==='Increment','Component picker observes a real page button');
 check(await frame.locator('#count').innerText()==='1','Picking a component does not activate the page control');
 check((await dialog.locator('.context-origin').first().innerText()).includes('×'),'Rendered component carries measured bounds');
 await dialog.getByRole('button',{name:'Close context selection'}).click();
 await page.getByRole('button',{name:'Writing mode',exact:true}).click();await page.waitForTimeout(400);
 await frame.getByRole('button',{name:'Increment',exact:true}).click();
 check(await frame.locator('#count').innerText()==='2','Leaving context mode restores ordinary page interaction');
 await frame.locator('body').hover();await page.mouse.wheel(0,600);await page.waitForTimeout(350);
 check(await frame.locator('body').evaluate(()=>scrollY)>100,'Rendered page still scrolls with hidden scrollbars');
 check(await frame.locator('body').evaluate(el=>getComputedStyle(el).scrollbarWidth)==='none','Rendered page scrollbar chrome is suppressed');
 check(await page.locator('iframe').getAttribute('sandbox')==='allow-scripts allow-forms','Context observation preserves the opaque sandbox without shell authority');
 await shot('rendered-context-and-scroll');
}
