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
 const noscript=await browser.newContext({javaScriptEnabled:false});const staticPage=await noscript.newPage();const d2=blankPage("beings");d2.meta.title="Readable without scripts";await load(staticPage,renderPage(d2));assert.equal(await staticPage.locator("h1").innerText(),d2.meta.title);checks++;await noscript.close();
 console.log(`${checks} reference-carrier browser assertions passed; no native Save, publication, machine or human acceptance claimed.`);
}finally{await browser.close();}
