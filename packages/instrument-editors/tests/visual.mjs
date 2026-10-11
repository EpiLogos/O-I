import {createRequire} from 'node:module';import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require('../../../desktop/cradle/node_modules/playwright');
const evidence=new URL('../evidence/',import.meta.url).pathname;
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(String(error)));
const result={component:null,candidate:{url:'http://127.0.0.1:8787/app/',verified:false},errors};
try{
 await page.goto('http://127.0.0.1:4298/?bridge=http://127.0.0.1:4186',{waitUntil:'domcontentloaded'});
 await page.getByText(/6 subjects/).waitFor({timeout:25000});
 await page.locator('.editor-workbench').evaluate(element=>{element.style.width='440px';element.style.height='290px';});
 await page.screenshot({path:evidence+'graph-compact.png'});
 await page.getByRole('button',{name:'Expand Project / Graph',exact:true}).click();
 await page.locator('.editor-workbench').evaluate(element=>{element.style.width='1160px';element.style.height='740px';});
 await page.getByText(/6 subjects/).waitFor({timeout:10000});await page.getByRole('button',{name:'Fit',exact:true}).click();await page.screenshot({path:evidence+'graph-full.png'});
 await page.getByRole('button',{name:'Fold Project / Graph',exact:true}).click();await page.getByRole('button',{name:'Reopen Project / Graph',exact:true}).click();
 await page.getByRole('button',{name:'Compact Project / Graph',exact:true}).waitFor();
 await page.getByRole('button',{name:'Project / Graph presentation and commands',exact:true}).click();await page.getByRole('menuitem',{name:'Native popout',exact:true}).click();await page.getByRole('alert').filter({hasText:'Surface relocation adapter'}).waitFor();
 const componentText=await page.locator('main').innerText();result.component={componentText,confirmed:['actual native Wiki graph read','compact/full same component','fold/reopen full depth','missing native popout adapter exact refusal'],unverified:['native Surface relocation','popout/redock','processing lifecycle']};
 // Inspect the owner's current candidate read-only, without adding definitions
 // or mutating its bindings, rack, tracks, window state or authored documents.
 await page.goto('http://127.0.0.1:8787/app/',{waitUntil:'domcontentloaded'});await page.screenshot({path:evidence+'current-shell-readonly.png'});const candidateText=(await page.locator('body').innerText()).slice(0,12000);
 result.candidate={...result.candidate,verified:true,candidateText};await writeFile(evidence+'browser-result.json',JSON.stringify(result,null,2));
 if(errors.length)throw Error(errors.join('\n'));
 console.log(JSON.stringify({errors,componentText:componentText.slice(0,3000)}));
}catch(error){result.failure=String(error);if(!result.candidate.verified)result.candidate.error=String(error);await writeFile(evidence+'browser-result.json',JSON.stringify(result,null,2));throw error;}finally{await browser.close();}
