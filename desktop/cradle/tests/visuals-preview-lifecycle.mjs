import {receiptIdentity} from './verify-shell-evidence.mjs';
import {THEMES} from '@epilogos/oi-design-system/themes/index';
const hexRgb=(hex)=>{const b=hex.replace('#','');return [0,2,4].map(at=>parseInt(b.slice(at,at+2),16)).join(', ');};
// Owner #375 W1: Visuals is now preferences, NOT a second Expression workbench.
// Real providers + real renderer. Stage placement/simulation/controls remain
// covered by expression-stage-{placement,lifecycle} and provider lifecycle.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=fileURLToPath(new URL('./artifacts/visuals-preferences/',import.meta.url));mkdirSync(out,{recursive:true});
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:4390,strictPort:true},logLevel:'error'});
server.middlewares.use('/visuals-preview',async(_,res)=>{res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/visuals-preview','<body class="oi-desktop"><div id="root"></div><script type="module" src="/tests/visuals-preview-page.tsx"></script>'));});
await server.listen();const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const context=await browser.newContext({colorScheme:'light',viewport:{width:900,height:800}});const page=await context.newPage();
const receipt={...receiptIdentity(import.meta.url),classification:'controlled real-component/browser, not installed native or Mac',checks:[],errors:[],passed:false};
page.on('pageerror',e=>receipt.errors.push(e.message));
await context.addInitScript(()=>{
 if(!sessionStorage.getItem('visuals-seed')){localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({enabled:false,welcomeEnabled:false,theme:'system'}));sessionStorage.setItem('visuals-seed','yes');}
 window.hostModeRequests=[];window.addEventListener('oi:host-workspace-mode',e=>window.hostModeRequests.push(e.detail.mode));
});
const check=(ok,label)=>{assert.ok(ok,label);receipt.checks.push(label);};
const noPresentation=async()=>{check((await page.evaluate(()=>previewTest.stage.inspect().presentations.length))===0,'settings acquires no stage presentation');check(await page.locator('.visuals-preview-stage,.visuals-composition-host').count()===0,'no embedded demo/workbench');};
try{
 await page.goto('http://127.0.0.1:4390/visuals-preview');await page.getByLabel('Appearance preferences').waitFor();
 await noPresentation();check(await page.locator('canvas').count()===0,'disabled preference view allocates no canvas');
 for(const choice of ['Dark','Light','System']){
  await page.getByRole('button',{name:choice,exact:true}).click();
  await page.waitForFunction(choice=>previewTest.visuals.get().theme===choice,choice.toLowerCase());
  check(await page.getByRole('button',{name:choice,exact:true}).getAttribute('aria-pressed')==='true','selected '+choice+' is disclosed');
 }
 await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.body.dataset.theme==='dark');
 await page.reload();await page.getByLabel('Appearance preferences').waitFor();check(await page.getByRole('button',{name:'System',exact:true}).getAttribute('aria-pressed')==='true','system choice survives restart');
 await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>!document.body.dataset.theme);receipt.checks.push('system appearance follows OS changes after restart');
 // Theme library: the generated index renders as real preview cards, and a
 // selection moves the shell ground, the store and data-oi-theme together.
 const library=page.getByRole('group',{name:'Theme library'});
 check(await library.locator('button').count()===THEMES.length,`theme library renders every indexed theme (${THEMES.length})`);
 const first=THEMES[0];const firstCard=library.locator('button').first();
 const swatchRgb=await firstCard.locator('.visuals-theme-swatch').evaluate(el=>el.style.background);
 check(swatchRgb===`rgb(${hexRgb(first.preview.ground)})`,'card preview uses the theme’s own ground, not the house palette');
 await firstCard.click();
 await page.waitForFunction(()=>!!document.body.dataset.oiTheme);
 check(await page.evaluate(()=>document.body.dataset.oiTheme)===first.id,'selection lands data-oi-theme');
 check(await page.evaluate(()=>previewTest.visuals.get().themeId)===first.id,'the preference owner holds the named theme');
 check(await page.evaluate(()=>previewTest.visuals.get().theme)===first.appearance,'the resolved theme follows the entry’s appearance');
 check(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--oi-canvas-ground').trim())===first.preview.ground,'the shell ground takes the theme’s canvas colour');
 check(await page.getByRole('button',{name:'System',exact:true}).getAttribute('aria-pressed')==='false','house segment yields while a library theme is active');
 await page.reload();await page.getByLabel('Appearance preferences').waitFor();
 check(await page.evaluate(()=>document.body.dataset.oiTheme)===first.id,'the named theme survives restart');
 await page.getByRole('button',{name:'System',exact:true}).click();
 await page.waitForFunction(()=>!document.body.dataset.oiTheme);
 check(await page.evaluate(()=>previewTest.visuals.get().themeId)===null,'returning to a house appearance clears the named theme');
 // Import from disk: a VS Code theme file (JSONC, as themes really ship)
 // converts at runtime, joins the grid, applies, persists and can be removed.
 const themeFile={name:'verdant-dusk.color-theme.json',mimeType:'application/json',buffer:Buffer.from(`{
   // a real-world theme shape: comments, a declared type, scoped colours
   "name": "Verdant Dusk",
   "type": "dark",
   "colors": { "editor.background": "#1b2a23", "editor.foreground": "#e8f3ea", "sideBar.background": "#16221d" },
   "tokenColors": [
     { "scope": "keyword", "settings": { "foreground": "#9ece6a" } },
     { "scope": "string", "settings": { "foreground": "#e0af68" } }
   ]
 }`)};
 const badFile={name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"name": "Broken", ')};
 const importInput=page.locator('input[type=file]');
 const cardCount=()=>library.locator('button').count();
 const before=await cardCount();
 await importInput.setInputFiles(badFile);
 check(await page.locator('.oi-refusal').textContent()!=='','a malformed file refuses in plain words');
 check(await cardCount()===before,'a refused file adds no card');
 check(await page.evaluate(()=>!document.body.dataset.oiTheme),'a refused file selects nothing');
 await importInput.setInputFiles(themeFile);
 await page.waitForFunction(()=>document.body.dataset.oiTheme==='verdant-dusk');
 check(await cardCount()===before+1,'the imported theme joins the grid');
 check(await page.evaluate(()=>previewTest.visuals.get().themeId)==='verdant-dusk','import selects itself through the preference owner');
 check(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--oi-canvas-ground').trim())==='#1b2a23','the imported ground colours the shell');
 check(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--oi-sidebar-ground').trim())==='#16221d','imported workbench keys map to their roles');
 check((await page.locator('.visuals-theme-origin',{hasText:'Imported'}).count())>=1,'the imported card discloses its imported standing');
 await page.reload();await page.getByLabel('Appearance preferences').waitFor();
 check(await page.evaluate(()=>document.body.dataset.oiTheme)==='verdant-dusk','the imported theme survives restart');
 await page.getByRole('button',{name:'Remove “Verdant Dusk”'}).click();
 await page.waitForFunction(()=>!document.body.dataset.oiTheme);
 check(await page.evaluate(()=>previewTest.visuals.get().themeId)===null,'removing the active import returns to a house appearance');
 check(await cardCount()===before,'removal takes the card with it');
 await page.getByLabel('Enable the shared visual layer',{exact:true}).check();
 await page.waitForFunction(()=>previewTest.stage.inspect().engine!==null);
 await noPresentation();
 for(let i=0;i<3;i++){await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.getByRole('button',{name:'Open settings',exact:true}).click();await noPresentation();}
 await page.getByLabel('Show the welcome mark when the app opens',{exact:true}).check();check(await page.evaluate(()=>previewTest.visuals.get().welcomeEnabled),'welcome choice uses existing preference owner');
 await page.getByLabel('Enable the shared visual layer',{exact:true}).uncheck();
 await page.waitForFunction(()=>document.querySelectorAll('canvas[data-oi-stage="engine"]').length===0);await noPresentation();
 check(await page.getByLabel('Show the welcome mark when the app opens',{exact:true}).isDisabled(),'dependent welcome control honestly disabled');
 await page.getByRole('button',{name:'Open Expressions',exact:true}).click();check(JSON.stringify(await page.evaluate(()=>hostModeRequests))==='["expressions"]','real supported host mode contract dispatched once');
 await page.screenshot({path:out+'/preferences.png'});await page.evaluate(()=>previewTest.unmount());check(await page.locator('canvas').count()===0,'provider unmount disposes canvas');
 assert.deepEqual(receipt.errors,[]);receipt.passed=true;
}finally{writeFileSync(out+'/receipt.json',JSON.stringify(receipt,null,2));await browser.close();await server.close();}
