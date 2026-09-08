import {cpSync} from 'node:fs';
import {join} from 'node:path';
import {setup as materialSetup} from './material.mjs';

export async function setup(context) {
  const provision=await materialSetup(context);
  try {cpSync(join(context.cradleRoot,'walk/fixtures/rendering-quality'),provision.projectRoot,{recursive:true});return provision;}
  catch(error){provision.cleanup();throw error;}
}

export default async function run({page,baseUrl,check,shot,channel}) {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(baseUrl);await channel('info');
  const nav=page.getByRole('complementary',{name:'World navigator'});
  await nav.locator('[data-project-path="Work/Material"]').click();
  const files=page.getByRole('button',{name:'Material: files',exact:true});
  if(await files.getAttribute('aria-pressed')!=='true')await files.click();
  const open=async name=>{await nav.locator(`[data-file-path="Work/Material/${name}"]`).click();await page.locator(`.tab[data-title="${name}"][data-active="true"]`).waitFor();};
  const frame=()=>page.frameLocator('.pane.focused iframe.material-frame');
  const ready=async()=>{await frame().locator('#classic').filter({hasText:'Ready'}).waitFor();await frame().locator('#module').filter({hasText:'Ready'}).waitFor();await frame().locator('#data').filter({hasText:'Ready'}).waitFor();};
  await open('index.html');await ready();
  check(await frame().locator('h1').innerText()==='Room to think.\nTools to make.','Authored rich heading renders');
  const design=await frame().locator('h1').evaluate(el=>({family:getComputedStyle(el).fontFamily,size:parseFloat(getComputedStyle(el).fontSize),grid:getComputedStyle(document.querySelector('.composition')).display,columns:getComputedStyle(document.querySelector('.composition')).gridTemplateColumns,svg:document.querySelector('svg').getBoundingClientRect().width}));
  check(design.family.includes('Georgia')&&design.size>=38,'Authored serif typography and responsive type scale apply');
  check(design.grid==='grid'&&design.columns.split(' ').length===2&&design.svg>200,'Authored wide grid and live SVG lay out');
  check(await frame().locator('#module').innerText()==='Ready','Relative ES module import executes through the owner-backed material route');
  check(await frame().locator('#data').innerText()==='Ready','Relative JSON fetch returns real owner-served bytes');
  check(await frame().locator('#bridge').innerText()==='Not exposed','Rendered page has no Tauri bridge');
  check(await frame().locator('body').evaluate(()=>{try{void parent.document;return false;}catch{return self.origin==='null';}}),'Rendered page has opaque origin and cannot read host document');
  check(await page.locator('.pane.focused iframe.material-frame').getAttribute('sandbox')==='allow-scripts allow-forms','Sandbox retains only scripts and forms permissions');
  await frame().getByRole('button',{name:'Add one'}).click();check(await frame().locator('#count').innerText()==='13','Real JavaScript counter responds');
  await page.getByRole('button',{name:'Window menu',exact:true}).click();
  await page.getByRole('menu').waitFor();
  await frame().getByRole('button',{name:'Add one'}).click();
  // A click inside an opaque child document never bubbles to host window.
  check(await page.getByRole('menu').count()===0,'Pane menu dismisses when interaction enters the rendered iframe');
  if(await page.getByRole('menu').count()) { await page.locator('.tab[data-title="index.html"]').click(); }
  await page.getByRole('combobox',{name:'Preview zoom'}).selectOption('1.25');check(await page.locator('.pane.focused .material-viewport').getAttribute('data-preview-zoom')==='1.25','125% preview zoom changes actual rendered viewport');
  await page.locator('.tab[data-title="index.html"]').click();await page.keyboard.press('Meta+w');await page.locator('.tab[data-title="index.html"]').waitFor({state:'detached'});await page.keyboard.press('Meta+Shift+t');await ready();
  check(await page.getByRole('combobox',{name:'Preview zoom'}).inputValue()==='1.25','Preview zoom survives tab close and reopen');
  await frame().getByRole('button',{name:'Add one'}).click();await page.getByRole('button',{name:'Reload preview'}).click();await ready();
  check(await frame().locator('#count').innerText()==='12','Reload preview restarts authored JavaScript from owner file');
  await page.getByRole('tab',{name:'Source',exact:true}).click();await page.locator('.pane.focused .source-textarea').waitFor();
  check((await page.locator('.pane.focused .source-textarea').inputValue()).includes('<title>Field Notes — rendering reference</title>'),'Source presents actual HTML bytes');
  await page.getByRole('tab',{name:'Rendered',exact:true}).click();await ready();check(true,'Returning to Rendered runs the same authored page');
  await page.getByRole('combobox',{name:'Preview zoom'}).selectOption('1');await shot('rich-wide');
  await open('notes.md');await page.locator('.tab[data-title="notes.md"]').click();await page.keyboard.press('Meta+d');await page.waitForFunction(()=>document.querySelectorAll('.pane.group').length===2);
  await page.locator('iframe[title="index.html"]').waitFor();
  await page.waitForFunction(()=>!!document.querySelector('iframe[title="index.html"]')?.getAttribute('srcdoc'));
  await page.keyboard.press('Meta+Alt+Enter');await page.waitForFunction(()=>{const el=document.querySelector('iframe[title="index.html"]');return !!el&&!el.getAttribute('srcdoc');});
  check(await page.locator('iframe[title="index.html"]').count()===1,'Hidden pane retains its frame slot while rendered document is suspended');
  await page.keyboard.press('Escape');await page.locator('.tab[data-title="index.html"]').click();await ready();check(true,'Restoring hidden pane resumes authored rendering');
  await page.setViewportSize({width:390,height:760});await ready();
  const narrow=await frame().locator('.composition').evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns,overflow:document.documentElement.scrollWidth>innerWidth}));
  check(narrow.columns.split(' ').length===1&&!narrow.overflow,'Rich authored layout reflows to one column without horizontal overflow');
  await shot('rich-narrow');check(errors.length===0,`No uncaught rendering errors (${errors.length})`);
}
