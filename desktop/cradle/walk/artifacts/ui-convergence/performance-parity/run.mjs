import {chromium} from '/Users/admin/Central/Work/O-I/.aikit/tasks/ui-expression-convergence/desktop/cradle/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const software=process.argv.includes('--software');
const dpr=process.argv.includes('--dpr2')?2:1;
const warm=process.argv.includes('--warm');
const executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args=software?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[];
const browser=await chromium.launch({headless:true,executablePath,args,timeout:30000});
const results=[];const started=new Date().toISOString();
const variants=warm?['surface-window','native']:software||dpr===2?['native','surface-window']:['native','retained','surface-window','surface-element','surface-window','native'];
try{
 for(const mode of variants){
  const context=await browser.newContext({viewport:{width:1280,height:820},deviceScaleFactor:dpr,reducedMotion:'no-preference'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<!doctype html><html><body style="margin:0;position:relative;width:100vw;height:100vh;overflow:hidden"></body></html>');
  await page.addScriptTag({content:await readFile('/tmp/oi-ui-parity-20260915/bundle.js','utf8')});
  const result=await page.evaluate(({mode,warm})=>window.runParity(mode,6000,warm?60:0).catch(error=>({error:String(error)})).then(result=>({...result,browserVisibility:document.visibilityState})),{mode,warm}).catch(error=>({mode,error:String(error)}));
  result.pageErrors=errors;results.push(result);console.log(JSON.stringify({...result,parity:result.parity?{...result.parity,config:'recorded in JSON'}:undefined}));
  await context.close();
 }
}finally{await browser.close();await writeFile('/tmp/oi-ui-parity-20260915/'+(warm?'software-warm':software?'software':dpr===2?'hardware-dpr2':'hardware')+'.json',JSON.stringify({started,ended:new Date().toISOString(),software,browserVersion:browser.version(),executablePath,args,results},null,2));}
