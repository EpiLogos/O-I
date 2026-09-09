/** Real Chromium against the shipped module. No owner/session substitutes. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {formNames,formPoints,gestureFor} from '../expression.mjs';
const require=createRequire(new URL('../../../desktop/cradle/package.json',import.meta.url));
const {chromium}=require('playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url));
const output=process.env.OI_EXPRESSION_ARTIFACTS??'/tmp/oi-expression-checks';await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw Error('outside root');const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const receipt={checks:[],errors:[],themes:[],standing:'module/browser evidence only; native encounters and owner visual acceptance pending'};
const check=(name,result)=>{assert.ok(result,name);receipt.checks.push(name);console.log('PASS '+name);};
let browser;
try {
 for(const name of formNames){let n=0;formPoints(name,.5,(x,y,a)=>{assert.ok([x,y,a].every(Number.isFinite));n++;});check(`${name}: bounded finite point generation`,n===880);}
 check('owner-kept resize and explicit inactive reserved intents',gestureFor('resize')==='edge'&&['open','close','split','move','save'].every(n=>gestureFor(n)===null));
 assert.throws(()=>gestureFor('invented'));assert.throws(()=>formPoints('invented',0,()=>{}));
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:2});
 page.on('pageerror',error=>receipt.errors.push(String(error)));
 const base=`http://127.0.0.1:${server.address().port}`;
 await page.goto(base+'/desktop/cradle/walk/artifacts/review/point-cloud-elements/index.html');
 await page.waitForFunction(()=>!!window.elementalStudy);
 check('revision 6 study runs before integration review',await page.evaluate(()=>window.elementalStudy.forms.includes('earth')&&document.querySelector('header').textContent.includes('rev 6')));
 await page.goto(base+'/packages/oi-design-system/examples/expression.html');
 await page.waitForFunction(()=>window.expressionReference?.overlay.inspect().frames>2);
 check('exactly one pointer-transparent window canvas',await page.locator('.oi-expression-overlay').evaluateAll(es=>es.length===1&&getComputedStyle(es[0]).pointerEvents==='none'));
 check('second host rejected',await page.evaluate(async()=>{const {createExpressionOverlay}=await import('/packages/oi-design-system/expression.mjs');try{createExpressionOverlay(document.body);return false;}catch{return true;}}));
 check('production body supplies the theme, not a reference-only html class',await page.evaluate(()=>document.body.classList.contains('oi-desktop')&&!document.documentElement.classList.contains('oi-desktop')&&expressionReference.overlay.canvas.parentElement===document.body));
 await page.evaluate(()=>document.body.style.setProperty('--oi-grain-density','0'));
 await page.waitForTimeout(100);
 check('body token mutation reaches the actual renderer',await page.evaluate(()=>expressionReference.overlay.inspect().pointCount===0));
 await page.evaluate(()=>document.body.style.removeProperty('--oi-grain-density'));

 for(const theme of ['oi-desktop','oi-surface-light','oi-surface-dark','oi-surface-warm-dark','oi-surface-contrast']) {
  await page.selectOption('select',theme);await page.waitForTimeout(100);
  await page.click('#edge');await page.waitForTimeout(160);
  const data=await page.evaluate(()=>{const api=expressionReference.overlay,c=api.canvas;return {...api.inspect(),nonzero:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)};});
  check(`${theme}: real forms and mid-flight gesture from tokens`,data.forms.length===9&&data.emitters===1&&data.nonzero);
  receipt.themes.push({theme,ink:data.ink});await page.screenshot({path:resolve(output,theme+'.png'),fullPage:true});await page.waitForTimeout(650);
 }
 const start=await page.evaluate(()=>expressionReference.overlay.inspect().frames);await page.waitForTimeout(2100);
 const frames=await page.evaluate(()=>expressionReference.overlay.inspect().frames)-start;
 check('nine live fields draw no more than 30 frames/second',frames<=64);receipt.frameWindow={milliseconds:2100,frames};
 check('one field morphs without adding canvas or handle',await page.evaluate(()=>{const {overlay,handles}=expressionReference;const count=overlay.inspect().entries;overlay.update(handles[0],{name:'listening'});overlay.update(handles[0],{name:'searching'});overlay.update(handles[0],{name:'arrival'});return overlay.inspect().entries===count&&overlay.inspect().forms.includes('arrival');}));
 await page.evaluate(()=>{const {overlay,handles}=expressionReference;handles.forEach(h=>overlay.release(h));handles.length=0;});
 await page.waitForTimeout(100);
 check('no forms or gestures: canvas pixel-clear and scheduler stopped',await page.evaluate(()=>{const a=expressionReference.overlay,c=a.canvas;return !a.inspect().scheduled&&!c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(Boolean);}));

 await page.evaluate(()=>{const target=document.createElement('div');target.style.cssText='position:fixed;left:20px;top:20px;width:40px;height:40px';document.body.append(target);window.removedTarget=target;expressionReference.overlay.express('edge',{rect:()=>target.isConnected?target.getBoundingClientRect():null,hold:true});});
 await page.waitForTimeout(70);await page.evaluate(()=>window.removedTarget.remove());await page.waitForTimeout(150);
 check('removed held target drains without stale geometry',await page.evaluate(()=>expressionReference.overlay.inspect().emitters===0&&!expressionReference.overlay.inspect().scheduled));
 await page.evaluate(()=>expressionReference.overlay.express('edge',{rect:{x:-400,y:-400,width:20,height:20}}));
 await page.waitForTimeout(100);
 const offscreenFrames=await page.evaluate(()=>expressionReference.overlay.inspect().frames);
 check('offscreen-only emitter stops drawing',await page.evaluate(()=>!expressionReference.overlay.inspect().scheduled));
 await page.waitForTimeout(750);
 check('offscreen-only emitter expires without drawing cleanup frames',await page.evaluate(frames=>{const s=expressionReference.overlay.inspect();return s.emitters===0&&!s.scheduled&&s.frames===frames;},offscreenFrames));
 await page.evaluate(()=>document.body.style.setProperty('--oi-expression-lease','1000ms'));await page.waitForTimeout(70);
 await page.evaluate(()=>expressionReference.overlay.express('idle',{rect:{x:-400,y:-400,width:20,height:20},hold:true}));
 await page.waitForTimeout(1200);
 check('offscreen held form lease expires without a drawing loop',await page.evaluate(()=>expressionReference.overlay.inspect().entries===0&&!expressionReference.overlay.inspect().scheduled));
 await page.evaluate(()=>document.body.style.removeProperty('--oi-expression-lease'));await page.waitForTimeout(70);
 await page.evaluate(()=>{window.held=expressionReference.overlay.express('edge',{rect:()=>document.querySelector('#resize').getBoundingClientRect(),dir:[1,0],hold:true});});
 await page.waitForTimeout(900);check('held resize remains exactly one emitter',await page.evaluate(()=>expressionReference.overlay.inspect().emitters===1));
 await page.evaluate(()=>expressionReference.overlay.release(window.held));await page.waitForTimeout(750);
 check('resize release drains under two seconds',await page.evaluate(()=>expressionReference.overlay.inspect().emitters===0&&!expressionReference.overlay.inspect().scheduled));
 for(let round=0;round<10;round++) {
  await page.evaluate(()=>{const a=expressionReference.overlay;for(let i=0;i<20;i++)a.express('edge',{rect:document.querySelector('#resize').getBoundingClientRect(),dir:[i%2?1:-1,0]});});
  await page.waitForTimeout(700);
 }
 check('200 intents drain with bounded retained storage',await page.evaluate(()=>{const m=expressionReference.overlay.inspect();return m.entries===0&&m.emitters===0&&m.peakEmitters<=20;}));
 await page.evaluate(()=>expressionReference.overlay.express('raw',{rect:document.querySelector('#resize').getBoundingClientRect(),delay:.1,then:{name:'edge'}}));await page.waitForTimeout(800);
 check('delayed chain starts one successor',await page.evaluate(()=>expressionReference.overlay.inspect().emitters===1));await page.waitForTimeout(700);
 await page.emulateMedia({reducedMotion:'reduce'});
 check('reduced motion refuses gestures, renders a still form without scheduling',await page.evaluate(()=>{const a=expressionReference.overlay,r=document.querySelector('#resize').getBoundingClientRect();const refused=a.express('edge',{rect:r})===null;a.express('idle',{rect:r,hold:true});return refused&&!a.inspect().scheduled&&a.inspect().forms.length===1;}));
 await page.emulateMedia({reducedMotion:'no-preference'});await page.click('#pause');
 check('pause clears and cancels scheduled work',await page.evaluate(()=>{const a=expressionReference.overlay,c=a.canvas;return !a.inspect().scheduled&&!c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(Boolean);}));
 await page.click('#pause');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await cdp.send('Page.setWebLifecycleState',{state:'active'});
 // Native visibility transitions remain a native walk obligation; no fake visibility override.
 await page.evaluate(()=>expressionReference.overlay.dispose());
 check('dispose removes the overlay and ink probe',await page.locator('.oi-expression-overlay,.oi-expression-ink').count()===0);
 check('no browser errors',receipt.errors.length===0);
} finally {
 await writeFile(resolve(output,'checks.json'),JSON.stringify(receipt,null,2)+'\n');await browser?.close();await new Promise(r=>server.close(r));
}
console.log(`${receipt.checks.length}/${receipt.checks.length} checks passed; ${output}`);
