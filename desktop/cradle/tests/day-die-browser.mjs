/** Browser proof of the Day form's die (documents/ql-daily-die.html) and its host bridge (src/central/dayForm.ts projectDieDocument):
 * the census of 19 Oct, each fault as it was seen and the behaviour that replaces it. Channels: SCRIPTED in headless Chromium —
 * the real form, the real projection; NOT a native screen pass (the native host is WebKit; headless WebKit composites no 3D, so it
 * proves nothing about the die's faces). Run: node tests/day-die-browser.mjs */
import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import {projectDieDocument} from "../src/central/dayForm.ts";
const require=createRequire(import.meta.url);
const {chromium}=process.env.OI_PLAYWRIGHT_MODULE?require(process.env.OI_PLAYWRIGHT_MODULE):await import("playwright");
// OI_DAY_FORM: another copy of the form to run the same census against (e.g. an earlier revision, to see it fail).
const form=await readFile(process.env.OI_DAY_FORM??new URL("../documents/ql-daily-die.html",import.meta.url),"utf8");
const ISLAND=/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;
const blank=JSON.parse(form.match(ISLAND)[1]);
const withPayload=payload=>form.replace(ISLAND,()=>`<script type="application/json" id="ql-doc">${JSON.stringify(payload).replace(/</g,"\\u003c")}</script>`);
const browser=await chromium.launch({headless:true,...(process.env.OI_CHROMIUM?{executablePath:process.env.OI_CHROMIUM}:{}),args:["--no-sandbox"]});
const SETTLE=2600;
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};

/** What the die shows: the dot that is current, the masks' classes, the faces that are live or away, open or in space. */
const reading=frame=>frame.evaluate(()=>({
 current:[...document.querySelectorAll(".dots button")].findIndex(b=>b.getAttribute("aria-current")==="true"),
 masks:[...document.querySelectorAll(".mask")].map(m=>m.classList.contains("off")?"off":m.classList.contains("peek")?"peek":"on"),
 live:[...document.querySelectorAll(".face")].findIndex(f=>f.classList.contains("live")),
 away:[...document.querySelectorAll(".face")].map(f=>f.classList.contains("away")),
 open:document.getElementById("chrome").classList.contains("in"),
}));
const key=(frame,name)=>frame.evaluate(k=>document.dispatchEvent(new KeyboardEvent("keydown",{key:k,bubbles:true})),name);
/** Sample the die every 40 ms for `ms`, after pressing `keys` at their offsets. */
async function film(frame,keys,ms){
 const frames=[];const t0=Date.now();const pending=[...keys];
 while(Date.now()-t0<ms){
  while(pending.length&&Date.now()-t0>=pending[0][0]){await key(frame,pending.shift()[1]);}
  frames.push({t:Date.now()-t0,...await reading(frame)});await new Promise(r=>setTimeout(r,40));
 }
 return frames;
}

try{
 // ── the form alone ──────────────────────────────────────────────────────
 const page=await browser.newPage({viewport:{width:1100,height:760}});const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.setContent(form);await page.waitForTimeout(900);
 let r=await reading(page);
 eq(r.masks,["peek","on","on","on","on","on"],"in space each face wears its pips and the front one peeks at its page");

 // Seen 19 Oct: an opened face covered the header (the date sat on the card), and the faces around it showed their pips at the edges.
 await key(page,"Enter");await page.waitForTimeout(SETTLE);r=await reading(page);
 ok(r.open&&r.live===0,"Enter opens the front face");
 eq(r.masks,["off","off","off","off","off","off"],"an open die shows pages, never pips: every mask is off");
 eq(r.away,[false,true,true,true,true,true],"the faces around the open one are away once the net lies flat");
 const box=await page.evaluate(()=>{const f=document.querySelector('.face[data-face="0"]').getBoundingClientRect(),d=document.querySelector(".date").getBoundingClientRect(),i=document.querySelector(".icons").getBoundingClientRect(),dots=document.querySelector(".dots").getBoundingClientRect();return {faceTop:f.top,faceBottom:f.bottom,faceLeft:f.left,faceRight:f.right,dateBottom:d.bottom,iconsBottom:i.bottom,iconsLeft:i.left,dotsTop:dots.top};});
 ok(box.faceTop>=box.dateBottom&&box.faceTop>=box.iconsBottom,`the open face stands below the header (face top ${box.faceTop}, date bottom ${box.dateBottom}, icons bottom ${box.iconsBottom})`);
 ok(box.faceBottom<=box.dotsTop||box.faceRight<=box.iconsLeft,"the open face leaves the dots their place");

 // Seen 19 Oct: a key pressed while it turned left it oversized under the old face's label until it settled.
 let shots=await film(page,[[0,"ArrowRight"],[150,"ArrowRight"]],SETTLE+700);
 eq(shots.find(s=>s.t>=150+40)?.current,2,"the label names the face the die is going to as soon as the key is pressed");
 ok(shots.every(s=>s.masks.every(m=>m==="off")),"no pip stands on the page at any moment of an open turn");
 ok(!shots.slice(0,-12).some((s,i)=>i>0&&s.away.some(Boolean)&&shots[i-1].away.every(a=>!a)&&s.t<1200),"the die runs on to the second face without opening between");
 r=await reading(page);eq([r.open,r.live,r.current],[true,2,2],"it rests open on the face last asked for");

 // Esc pressed while an open die turns: it goes out from the shut die, without opening first.
 shots=await film(page,[[0,"ArrowLeft"],[120,"Escape"]],SETTLE+600);
 r=await reading(page);eq([r.open,r.current],[false,1],"Esc pressed during the turn is kept: the die rests in space on the face it turned to");
 ok(!shots.some(s=>s.t>120&&s.away.some(Boolean)),"it never lay open between the Esc and going out");
 eq(r.masks[1],"peek","the front face peeks at its page");

 // Enter pressed while the die turns in space: kept, and done once it rests.
 await film(page,[[0,"ArrowRight"],[100,"Enter"]],SETTLE+900);
 r=await reading(page);eq([r.open,r.live],[true,2],"Enter pressed during a turn in space opens the face the die rests on");
 eq(errors,[],"the form raised no error");
 await page.close();

 // ── the example asset ───────────────────────────────────────────────────
 // Seen 19 Oct: the form shipped an image marked "Example asset, not a record", and the owner's Days carry it in their payload.
 eq(blank.media,[],"the form carries no media of its own");
 const p2=await browser.newPage({viewport:{width:1100,height:760}});
 const pixel="data:image/gif;base64,R0lGODlhAQABAAAAACw=";
 const shown=structuredClone(blank);shown.media=[{id:"ex",pos:0,name:"oi-point-cloud.jpg",mime:"image/gif",data:pixel,caption:"",standing:"example"},{id:"mine",pos:0,name:"stone.gif",mime:"image/gif",data:pixel,caption:"",standing:"attached"}];
 await p2.setContent(withPayload(shown));await p2.waitForTimeout(600);
 eq(await p2.evaluate(()=>[...document.querySelectorAll('.face[data-face="0"] .media figure .fm span')].map(s=>s.textContent)),["stone.gif"],"a Day that carries the example asset draws only what was attached");
 ok(!(await p2.content()).includes("Example asset, not a record"),"no example tag is drawn");
 await p2.close();

 // ── hosted, through the projection ──────────────────────────────────────
 const hosted=structuredClone(blank);hosted.meta.uuid="document:test";hosted.meta.date="2026-10-19";hosted.meta.timezone="Europe/London";
 hosted.fields.p0_quick_thoughts='<p>Read <a href="https://example.org/stone">the stone</a> and <a href="Work/O-I/ProjectCentral/user/beings/ada.html">Ada</a>, then <a href="#e-1">entry 1</a>.</p>';
 const projected=projectDieDocument(form,hosted);ok(projected,"the projection stands on the form's seams");
 const host=await browser.newPage({viewport:{width:1100,height:760}});
 await host.setContent(`<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-scripts allow-forms" style="border:0;width:1100px;height:760px"></iframe><script>
  window.heard=[];addEventListener("message",e=>{if(e.source===document.getElementById("f").contentWindow)window.heard.push(e.data);});
 </script></body>`);
 await host.evaluate(html=>{document.getElementById("f").srcdoc=html;},projected);await host.waitForTimeout(1000);
 const frame=host.frames().find(f=>f!==host.mainFrame());
 const heard=()=>host.evaluate(()=>window.heard);
 const faces=async()=>(await heard()).filter(m=>m?.source==="oi-cradle-die-face"&&m.type==="face");
 eq((await faces()).at(-1),{source:"oi-cradle-die-face",type:"face",face:0,open:false},"the form announces the face it shows");
 await host.evaluate(()=>document.getElementById("f").contentWindow.postMessage({source:"oi-day-host",type:"turn",face:3},"*"));
 await host.waitForTimeout(SETTLE);r=await reading(frame);
 eq([r.current,r.live],[3,3],"the host's turn turns the die in its form");
 eq((await faces()).at(-1)?.face,3,"and the form says so");
 await host.evaluate(()=>document.getElementById("f").contentWindow.postMessage({source:"oi-day-host",type:"turn",face:9},"*"));
 await host.waitForTimeout(300);eq((await reading(frame)).current,3,"a face that is none of the six is refused");
 await host.evaluate(()=>document.getElementById("f").contentWindow.postMessage({source:"oi-day-host",type:"turn",face:0},"*"));
 await host.waitForTimeout(SETTLE);
 await host.evaluate(()=>document.getElementById("f").contentWindow.postMessage({source:"oi-day-host",type:"open"},"*"));
 await host.waitForTimeout(SETTLE);r=await reading(frame);ok(r.open&&r.live===0,"the host opens the face");
 eq((await faces()).at(-1),{source:"oi-cradle-die-face",type:"face",face:0,open:true},"and the form says it stands open");

 // Links: the frame grants no popups and no navigation; a followed link goes to the host, which opens it in the shell.
 const links=async()=>(await heard()).filter(m=>m?.type==="oi:page-link").map(m=>m.href);
 const field=frame.locator('.face[data-face="0"] [data-field="p0_quick_thoughts"]');
 await field.locator('a[href^="https"]').click();await host.waitForTimeout(200);
 eq(await links(),[],"a plain click in a writing field edits the link, it does not follow it");
 await field.locator('a[href^="https"]').click({modifiers:["Meta"]});
 // ⌘ on a Mac (a Ctrl-click there is the context menu, not a click), Ctrl elsewhere.
 await field.locator('a[href^="Work/"]').click({modifiers:["ControlOrMeta"]});
 await field.locator('a[href^="#"]').click({modifiers:["Meta"]});await host.waitForTimeout(200);
 eq(await links(),["https://example.org/stone","Work/O-I/ProjectCentral/user/beings/ada.html"],"⌘-click (Ctrl-click) sends the link to the host; a link within the page stays in it");
 ok(frame.url().startsWith("about:srcdoc"),"the form was never navigated away");
 await host.close();
 console.log(`day-die browser: ${checks} checks passed`);
}finally{await browser.close();}
