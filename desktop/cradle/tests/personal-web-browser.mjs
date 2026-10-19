/** Browser proof of the reference carriers; NOT installed native-owner proof. */
import {createRequire} from "node:module";
import {mkdir,readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import {blankPage,readPage,renderPage} from "../src/personal/page.mjs";
const require=createRequire(import.meta.url);
const {chromium}=process.env.OI_PLAYWRIGHT_MODULE?require(process.env.OI_PLAYWRIGHT_MODULE):await import("playwright");
const browser=await chromium.launch({headless:true,...(process.env.OI_CHROMIUM?{executablePath:process.env.OI_CHROMIUM}:{}),args:["--no-sandbox"]});
const out=new URL("./artifacts/personal-web/",import.meta.url);await mkdir(out,{recursive:true});
let checks=0;
const load=async(page,html)=>{await page.setContent(html);};
try{
 for(const family of ["beings","things"]){
  const doc=blankPage(family);doc.meta.title=family==="beings"?"A world, in the making.":"The garden of attention.";
  doc.page.subtitle="A source-bearing page, open to further thought.";
  doc.page.introduction="A place for writing, making and following what matters. This is a controlled reference specimen, not a populated personal profile.";
  doc.page.sections[0]={id:"section-1",heading:"An unfolding enquiry",text:"A page can hold an idea without closing it. Its links carry us toward the people, works and occasions through which that idea develops."};
  doc.page.links=[{id:"l1",label:"A related work",href:"related-work.html",relation:"responds to"}];doc.notes=[{id:"n1",text:"PRIVATE_SENTINEL"}];doc.extensions={unknown:{keep:"verbatim"}};
  const context=await browser.newContext({acceptDownloads:true});let requests=0;context.on("request",()=>requests++);
  const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));await load(page,renderPage(doc));
  assert.equal(await page.locator("#edit-page").getAttribute("aria-pressed"),"false");checks++;
  assert.equal(await page.locator("h1").innerText(),doc.meta.title);checks++;
  for(const [width,height] of [[1280,900],[720,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:new URL(`${family}-${width}.png`,out).pathname,fullPage:true});checks++;}
  await page.locator("#edit-page").click();await page.locator("h1").fill("An explicitly revised page");
  assert.equal(JSON.parse(await page.locator("#ql-doc").textContent()).meta.title,"An explicitly revised page");checks++;
  await page.locator("#page-layout").selectOption(family==="beings"?"editorial":"portrait");await page.locator("#page-tone").selectOption("ink");
  assert.equal(await page.locator("body").getAttribute("data-tone"),"ink");checks++;
  assert.deepEqual(await page.locator("body").evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color})),{background:"rgb(32, 35, 31)",color:"rgb(238, 238, 232)"});checks++;
  await page.screenshot({path:new URL(`${family}-ink.png`,out).pathname,fullPage:true});
  await page.locator("#add-section").click();assert.equal(await page.locator(".section").count(),2);checks++;
  await page.locator('[data-section="section-2"][data-field="heading"]').fill("A further relation");
  // Actual reference runtime: identity is minted only at explicit export.
  if(!await page.evaluate(()=>Boolean(globalThis.crypto?.getRandomValues))){await context.close();throw new Error("Web Crypto unavailable for document identity");}
  const downloading=page.waitForEvent("download");await page.locator("#save-copy").click();const download=await downloading;
  const path=new URL(`${family}-export.html`,out).pathname;await download.saveAs(path);const exported=await readFile(path,"utf8");const result=readPage(exported);
  assert.ok(result.meta.documentId);assert.equal(result.meta.title,"An explicitly revised page");assert.equal(result.page.sections.length,2);assert.deepEqual(result.notes,doc.notes);assert.deepEqual(result.extensions,doc.extensions);assert.deepEqual(result.bindings,doc.bindings);checks+=6;
  await load(page,exported);assert.equal(await page.locator("h1").innerText(),result.meta.title);assert.equal(await page.locator("#edit-page").getAttribute("aria-pressed"),"false");checks+=2;
  assert.equal(requests,0);assert.deepEqual(errors,[]);checks+=2;await context.close();
 }
 const context=await browser.newContext();const page=await context.newPage();const d=blankPage("things");d.meta.title='</script><script>globalThis.compromised=1</script>';await load(page,renderPage(d));assert.equal(await page.evaluate(()=>globalThis.compromised),undefined);assert.equal(await page.locator("h1").innerText(),d.meta.title);checks+=2;await context.close();
 // The native page owner writes the island alone (kernel/src/page.rs): on load the page draws its fields from it, its highlights in
 // their colours and its notes (stored escaped, shown as text); hosted, a followed link goes to the host and the frame stays put.
 {const owned=blankPage("beings");owned.page.links=[{id:"l1",label:"A neighbour",href:"https://example.org/a",relation:"knows"}];const html=renderPage(owned);
  const island=JSON.parse(/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/.exec(html)[1].replace(/\\u003c/g,"<"));
  island.meta.title="Written by its owner";island.page.introduction="She wrote what she saw.";island.page.sections=[{id:"section-1",heading:"Music",text:"Wide leaps."}];
  island.highlights=[{id:"h1",part:"introduction",passage:"what she saw",colour:"green"},{id:"h2",part:"section-1",passage:null,colour:"pink"}];
  island.notes=[{id:"n1",part:"section-1",anchor:null,text:"a &lt;b&gt; note",timing:"after"}];
  const written=html.replace(/(<script type="application\/json" id="ql-doc">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(island).replace(/</g,"\\u003c")+b);
  const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));const messages=[];await page.exposeFunction("hostHeard",value=>messages.push(value));
  await page.setContent('<iframe id="f" sandbox="allow-scripts"></iframe><script>addEventListener("message",e=>hostHeard(e.data))</script>');await page.$eval("#f",(f,h)=>{f.srcdoc=h;},written);
  const frame=await(await page.$("#f")).contentFrame();await frame.waitForSelector("h1");await frame.waitForFunction(()=>document.querySelector("mark"));
  assert.equal(await frame.locator("h1").innerText(),"Written by its owner");checks++;
  assert.equal(await frame.locator("[data-field=introduction]").evaluate(el=>el.innerHTML),'She wrote <mark data-colour="green">what she saw</mark>.');checks++;
  assert.deepEqual(await frame.locator('[data-section="section-1"][data-field=text] mark').evaluate(el=>[el.dataset.colour,el.textContent,getComputedStyle(el).backgroundColor]),["pink","Wide leaps.","rgb(255, 184, 214)"]);checks++;
  assert.deepEqual(await frame.locator(".note p").allTextContents(),["a <b> note"]);assert.equal(await frame.locator(".note b").count(),0);checks+=2;
  await frame.locator(".relation a").click();await page.waitForTimeout(200);assert.deepEqual(messages,[{type:"oi:page-link",href:"https://example.org/a"}]);assert.equal(frame.url(),"about:srcdoc");checks+=2;
  assert.deepEqual(errors,[]);checks++;await context.close();}
 const noscript=await browser.newContext({javaScriptEnabled:false});const staticPage=await noscript.newPage();const d2=blankPage("beings");d2.meta.title="Readable without scripts";await load(staticPage,renderPage(d2));assert.equal(await staticPage.locator("h1").innerText(),d2.meta.title);checks++;await noscript.close();
 console.log(`${checks} reference-carrier browser assertions passed; no native Save, publication, machine or human acceptance claimed.`);
}finally{await browser.close();}
