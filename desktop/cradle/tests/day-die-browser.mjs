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
 masks:[...document.querySelectorAll(".mask")].map(m=>m.classList.contains("off")?"off":"on"),
 live:[...document.querySelectorAll(".face")].findIndex(f=>f.classList.contains("live")),
 away:[...document.querySelectorAll(".face")].map(f=>f.classList.contains("away")),
 open:document.getElementById("chrome").classList.contains("in"),
 // The faces the die draws: those turned toward you (their normal, through the cube's turn and the face's own, points out of the
 // screen) and not put away. A shut die drawn with one face is no die (the owner, 19 Oct: "a single square face").
 drawn:(()=>{const cube=new DOMMatrix(document.getElementById("cube").style.transform||"none");
   return [...document.querySelectorAll(".face")].filter(f=>!f.classList.contains("away")&&cube.multiply(new DOMMatrix(f.style.transform||"none")).m33>0.08).length;})(),
 folding:[...document.querySelectorAll(".face")].some(f=>f.classList.contains("dim")),
}));
/** A die reads as a die: resting shut it shows three faces; while it turns a side passes edge-on for an instant (a cube turning from
 * one three-quarter view to the next must cross that plane), so in motion it never shows fewer than two — and one face alone only
 * when a face lies open, flat, as a page. */
const asDie=(frames,what)=>{
 const shut=frames.filter(s=>!s.open&&!s.folding), openShut=frames.filter(s=>s.open&&!s.folding&&s.away.every(a=>!a));
 const single=frames.filter(s=>s.drawn<2&&!(s.open&&s.away.some(Boolean)));
 ok(!single.length,`${what}: never a single face but a page laid open (${single.map(s=>`${s.t} ms: ${s.drawn}`).join(', ')})`);
 ok(shut.every(s=>s.drawn>=2)&&openShut.every(s=>s.drawn>=2),`${what}: the shut die draws at least two faces at every moment (${[...shut,...openShut].map(s=>s.drawn).join('')})`);
};
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
 eq(r.masks,["on","on","on","on","on","on"],"in space every face wears its pips, the one it rests on too");
 // Seen 19 Oct in the Day pane: the open face's page printed on the face and cut at its foot, an instruction under the die; and,
 // after a first fix, a die resting as one flat square. It rests in three-quarter view, three faces showing their pips, no page
 // on a face, no explanatory line in the form.
 let shots=await film(page,[],900);
 ok(shots.every(s=>s.drawn===3),`resting shut, the die draws three faces (${shots.map(s=>s.drawn).join('')})`);
 const rest=await page.evaluate(()=>({sheets:[...document.querySelectorAll('.face .sheet')].map(s=>getComputedStyle(s).opacity),hint:document.querySelectorAll(".foot .hint").length,foot:document.querySelector(".foot").innerText}));
 eq(rest.sheets,["0","0","0","0","0","0"],"no page shows on a face while the die stands in space");
 eq([rest.hint,/Click a face/.test(rest.foot)],[0,false],"no instruction line stands under the die");
 asDie(await film(page,[[0,"ArrowRight"],[150,"ArrowRight"]],2200),"a turn in space, and a key pressed during it");
 asDie(await film(page,[[0,"ArrowDown"]],1300),"a flip to the mirror face");
 asDie(await film(page,[[0,"ArrowUp"],[0,"ArrowLeft"],[0,"ArrowLeft"]],3000),"back to the first face, three turns chained");
 eq((await reading(page)).current,0,"the die is back on face 0");
 shots=await film(page,[],900);ok(shots.every(s=>s.drawn===3),`resting again, three faces (${shots.map(s=>s.drawn).join('')})`);

 // Seen 19 Oct: an opened face covered the header (the date sat on the card), and the faces around it showed their pips at the edges.
 asDie(await film(page,[[0,"Enter"]],SETTLE),"opening");r=await reading(page);
 ok(r.open&&r.live===0,"Enter opens the front face");
 eq(r.masks,["off","off","off","off","off","off"],"an open die shows pages, never pips: every mask is off");
 eq(r.away,[false,true,true,true,true,true],"the faces around the open one are away once the net lies flat");
 const box=await page.evaluate(()=>{const f=document.querySelector('.face[data-face="0"]').getBoundingClientRect(),d=document.querySelector(".date").getBoundingClientRect(),i=document.querySelector(".icons").getBoundingClientRect(),dots=document.querySelector(".dots").getBoundingClientRect();return {faceTop:f.top,faceBottom:f.bottom,faceLeft:f.left,faceRight:f.right,dateBottom:d.bottom,iconsBottom:i.bottom,iconsLeft:i.left,dotsTop:dots.top};});
 ok(box.faceTop>=box.dateBottom&&box.faceTop>=box.iconsBottom,`the open face stands below the header (face top ${box.faceTop}, date bottom ${box.dateBottom}, icons bottom ${box.iconsBottom})`);
 ok(box.faceBottom<=box.dotsTop||box.faceRight<=box.iconsLeft,"the open face leaves the dots their place");

 // Seen 19 Oct: a key pressed while it turned left it oversized under the old face's label until it settled.
 shots=await film(page,[[0,"ArrowRight"],[150,"ArrowRight"]],SETTLE+700);
 asDie(shots,"an open die turned, and a key pressed during it");
 ok(shots.some(s=>s.open&&!s.folding&&s.away.every(a=>!a)&&s.drawn===3),"shut to turn, the open die stands in three-quarter view, not one square face");
 eq(shots.find(s=>s.t>=150+40)?.current,2,"the label names the face the die is going to as soon as the key is pressed");
 ok(shots.every(s=>s.masks.every(m=>m==="off")),"no pip stands on the page at any moment of an open turn");
 ok(!shots.slice(0,-12).some((s,i)=>i>0&&s.away.some(Boolean)&&shots[i-1].away.every(a=>!a)&&s.t<1200),"the die runs on to the second face without opening between");
 r=await reading(page);eq([r.open,r.live,r.current],[true,2,2],"it rests open on the face last asked for");

 // Esc pressed while an open die turns: it goes out from the shut die, without opening first.
 shots=await film(page,[[0,"ArrowLeft"],[120,"Escape"]],SETTLE+600);
 asDie(shots,"Esc during an open turn");
 r=await reading(page);eq([r.open,r.current],[false,1],"Esc pressed during the turn is kept: the die rests in space on the face it turned to");
 ok(!shots.some(s=>s.t>120&&s.away.some(Boolean)),"it never lay open between the Esc and going out");
 eq(r.masks[1],"on","back in space, the face it rests on wears its pips");

 // Enter pressed while the die turns in space: kept, and done once it rests.
 await film(page,[[0,"ArrowRight"],[100,"Enter"]],SETTLE+900);
 r=await reading(page);eq([r.open,r.live],[true,2],"Enter pressed during a turn in space opens the face the die rests on");
 asDie(await film(page,[[0,"Escape"]],SETTLE),"closing");
 // A drag looks around and the die settles back into three-quarter view.
 const stageBox=await page.locator("#stage").boundingBox();
 await page.mouse.move(stageBox.width/2,stageBox.height/2);await page.mouse.down();
 for(let i=1;i<=12;i++){await page.mouse.move(stageBox.width/2+i*14,stageBox.height/2+i*5);await page.waitForTimeout(16);}
 const dragged=await film(page,[],200);await page.mouse.up();
 shots=await film(page,[],1400);
 asDie([...dragged,...shots],"a drag and its release");
 ok(shots.slice(-8).every(s=>s.drawn===3),`released, it rests in three-quarter view again (${shots.map(s=>s.drawn).join('')})`);
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
