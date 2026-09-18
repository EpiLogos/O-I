/**
 * Nara stage focus — the ES1 focus-wiring walk (#336 follow-up).
 *
 * Proves the joined claim end to end: a Nara-returned focus action moves
 * the REAL Expression stage presentation. The page hosts the real
 * ExpressionView presenting the Expression on the Global Expression Stage
 * (the same "expression-application" presentation the app owns) beside the
 * real NaraSurface; the deixis path runs through the real kernel bridge.
 *
 * The stage is read only through its bounded inspect() (the same read model
 * the walk channel exposes) — the scenario adds no second authority path
 * and no presentation double.
 *
 * Usage: node walk/run.mjs nara-stage-focus   (alias: nara-stage)
 */

import {spawn} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {join} from "node:path";
import {createServer} from "vite";

const ACTOR="human:nara-stage-walk";
const DEV_PORT=Number(process.env.NARA_STAGE_PORT??4395);
const fixtureRoot=fileURLToPath(new URL("../fixtures/nara/",import.meta.url));
const textResolution=JSON.parse(readFileSync(`${fixtureRoot}text-body-resolution.json`,"utf8")).resolution;

export default async function run({page,check,shot,bridgeUrl,log}){
  const cradleRoot=fileURLToPath(new URL("../..",import.meta.url));
  const packageRoot=fileURLToPath(new URL("../../../../packages/oi-design-system/",import.meta.url));

  // The Expression world, bound for real through the kernel bridge.
  const bridgeOp=async(op,request)=>{
    const envelope=await (await fetch(`${bridgeUrl}/op`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({op,request})})).json();
    if(envelope.error||!envelope.outcome)throw new Error(`${op} failed: ${JSON.stringify(envelope.error??envelope)}`);
    return envelope.outcome;
  };
  const expressionRef=`expression:nara-stage-${Date.now()}`;
  const created=await bridgeOp("expression",{operation:"create",expression_ref:expressionRef,title:"Nara stage focus walk",actor:ACTOR});
  let revision=created.data.document.revision;
  const edit=async changes=>{
    const result=await bridgeOp("expression",{operation:"edit",expression_ref:expressionRef,expected_revision:revision,actor:ACTOR,changes});
    if(result.data.state!=="ready")throw new Error(`edit did not apply: ${JSON.stringify(result.data)}`);
    revision=result.data.document.revision;
    return result.data.document;
  };
  const bind=(entityRef,subjectRef,title)=>[
    {change:"entity_add",scene_ref:`${expressionRef}:scene:main`,entity_ref:entityRef,title},
    {change:"subject_bind",entity_ref:entityRef,binding:{
      subject_ref:subjectRef,native_owner:"ql",presentation_role:"thing",
      sources:[{ref:`source:ql/${subjectRef.replace(/[^a-z0-9.-]/gi,"-")}`,revision:"1",availability:"available"}],
      readings:[],actions:[],
    }},
  ];
  await edit([
    ...bind(`${expressionRef}:entity:person`,"bimba:#4","Person locus"),
    ...bind(`${expressionRef}:entity:relation`,"bimba:relation:1","Pointed relation"),
    ...bind(`${expressionRef}:entity:earth`,"ql:nara:focus:m4:earth-body","EarthBody"),
  ]);

  // Serve the real-component page (the presence-lifecycle harness pattern).
  const server=await createServer({root:cradleRoot,appType:"custom",logLevel:"error",
    resolve:{alias:{"@epilogos/oi-design-system":packageRoot}},
    server:{host:"127.0.0.1",port:DEV_PORT,strictPort:true}});
  server.middlewares.use("/nara-stage",async(_req,res)=>{
    res.setHeader("content-type","text/html");
    res.end(await server.transformIndexHtml("/nara-stage",
      '<!doctype html><html><head><meta charset="utf-8"></head><body class="oi-desktop"><div id="root" style="width:1280px;height:820px"></div><script type="module" src="/walk/fixtures/nara-stage-page.tsx"></script></body></html>'));
  });
  await server.listen();
  const stopServer=async()=>{try{await server.close();}catch{}};
  page.once("close",()=>void stopServer());

  const probe=async()=>await page.evaluate(()=>window.__stageProbe?.inspect()??null);
  try{
    await page.addInitScript(([url,ref])=>{
      window.__OI_KERNEL_BRIDGE__=url;
      window.NARA_STAGE_TEST_BINDING={id:"nara-stage",kind:"nara",title:"Nara",ref};
    },[bridgeUrl,expressionRef]);
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/nara-stage`);
    await page.waitForFunction(()=>document.querySelector("[data-nara]")&&document.querySelector(".expression-editor"),null,{timeout:30000});

    // Present the Expression on the live stage through the REAL editor
    // control — the same "expression-application" presentation the app owns.
    const stageInspect=await probe();
    check(stageInspect!==null,"The real Expression stage is bound and inspectable");
    await page.locator('button:has-text("Present on stage")').click();
    await page.waitForFunction(()=>{
      const presentations=window.__stageProbe?.inspect()?.presentations??[];
      return presentations.some(presentation=>presentation.id==="expression-application");
    },null,{timeout:30000});
    check(true,"Present on stage mounts the app's live Expression presentation");
    const before=await probe();
    check(Array.isArray(before.selection)&&before.selection.length===0,
      "The live stage selection starts empty (the document names no focus)");

    // Attach canonical Nara on the text body through the real form.
    await page.locator(".nara-attach summary").click();
    await page.locator("textarea[aria-label=\"AIKit resolution read model\"]").fill(JSON.stringify(textResolution));
    await page.locator("button:has-text(\"Attach\")").click();
    await page.waitForFunction(()=>document.querySelector("[data-nara]:not([data-nara=\"unattached\"])"),null,{timeout:15000});
    check(true,"Nara attaches to the resolved text body beside the live stage");

    // A Nara-returned SELECT: the person's pointer names the selection;
    // Nara's deixis resolution commits the kernel focus edit AND moves the
    // live presentation's selection.
    const personFocus=await edit([{change:"focus",scene_ref:`${expressionRef}:scene:main`,entity_ref:`${expressionRef}:entity:person`}]);
    await page.locator('button:has-text("Point selection")').click();
    await page.waitForFunction(()=>document.querySelector("[data-nara-notice]")?.textContent?.includes("focused"),null,{timeout:15000});
    const afterSelect=await probe();
    check(afterSelect.selection.length===1&&afterSelect.selection[0]===`${expressionRef}:entity:person`,
      "A Nara-returned select focus action moved the REAL Expression stage selection",
      {selection:afterSelect.selection,presentation:afterSelect.presentations});
    const kernelDocument=await bridgeOp("expression",{operation:"inspect",expression_ref:expressionRef});
    check(kernelDocument.data.document.selection.entity_ref===`${expressionRef}:entity:person`,
      "The same focus is committed semantically through the kernel seam",
      {revision:kernelDocument.data.document.revision});

    // A Nara-returned HIGHLIGHT: the pure presentation movement. The
    // document selection moves by the person's own pointer first; Nara's
    // hovered deixis then moves the stage WITHOUT a kernel edit.
    await edit([{change:"focus",scene_ref:`${expressionRef}:scene:main`,entity_ref:`${expressionRef}:entity:earth`}]);
    const revisionBeforeHighlight=revision;
    await page.locator('button:has-text("Highlight selection")').click();
    await page.waitForFunction(()=>document.querySelector("[data-nara-notice]")?.textContent?.includes("live Expression stage"),null,{timeout:15000});
    const afterHighlight=await probe();
    check(afterHighlight.selection.length===1&&afterHighlight.selection[0]===`${expressionRef}:entity:earth`,
      "A Nara-returned highlight focus action moved the live stage selection to the highlighted locus",
      {selection:afterHighlight.selection});
    check(revision===revisionBeforeHighlight,
      "The highlight moved the presentation only: no Expression revision was committed",{revision});
    await shot("nara-stage-focus");
  }finally{
    await stopServer();
  }
}
