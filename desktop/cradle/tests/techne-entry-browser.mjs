/** No-provider negative case. Renders the production M0 body and app
 * providers; no replacement component or success fixture stands for them. */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
server.middlewares.use('/techne-entry',async(_req,res)=>{
 res.setHeader('content-type','text/html');
 res.end(await server.transformIndexHtml('/techne-entry','<body class="oi-desktop"><div id="root"></div><script type="module" src="/tests/techne-entry-page.tsx"></script>'));
});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1100,height:760}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({enabled:false,welcomeEnabled:false})));
try {
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/techne-entry`);
 await page.locator('.wx-face').waitFor();
 assert.equal(await page.getByText('The Epii face',{exact:true}).count(),1,'no selected Wiki must still expose the correct entrance');
 assert.equal(await page.getByRole('button',{name:'Enter the wiki · graph whole'}).isEnabled(),true);
 // Optional reading failures do not swallow the independent ground entrance.
 for(const disclosure of [{standing:'reading'},{standing:'unavailable',reason:'optional QL refused'},{standing:'no-subject'}]) {
  await page.evaluate(value=>window.entryTest.setDisclosure(value),disclosure);
  assert.equal(await page.locator('.wx-face').count(),1,`${disclosure.standing} must retain the entrance`);
 }
 await page.getByRole('button',{name:'Enter the wiki · graph whole'}).click();
 await page.locator('.wiki-expression[data-entry="whole"]').waitFor();
 await page.evaluate(()=>window.entryTest.setMounted(false));
 await page.locator('.wiki-expression').waitFor({state:'detached'});
 await page.evaluate(()=>window.entryTest.setMounted(true));
 await page.locator('.wiki-expression[data-entry="whole"]').waitFor();
 assert.equal(await page.locator('.wx-face').count(),0,'remount restores work, not Home');
 await page.getByRole('button',{name:'Return to the Epii face',exact:true}).click();
 await page.locator('.wx-face').waitFor();
 await page.reload();
 await page.locator('.wx-face').waitFor();
 assert.deepEqual(errors,[]);
 if(process.env.TECHNE_EVIDENCE_DIR){mkdirSync(process.env.TECHNE_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:`${process.env.TECHNE_EVIDENCE_DIR}/no-subject-entrance.png`,fullPage:true});}
 console.log('Technē entry: actual M0 no-subject/optional-reading failures, explicit Home and retained remount/reload passed (no native transport case).');
} finally {await browser.close();await server.close();}
