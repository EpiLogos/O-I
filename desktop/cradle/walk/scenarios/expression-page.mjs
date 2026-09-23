import {execFileSync} from "node:child_process";
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {blankPage,renderPage} from "../../src/personal/page.mjs";
import {bindDefaultCentral,openChrome} from "../editor-doc.mjs";

export async function setup(){
 const root=mkdtempSync(join(tmpdir(),"oi-expression-page-")),home=mkdtempSync(join(tmpdir(),"oi-expression-page-home-")),ctrl=process.env.OI_CENTRAL_CTRL_BIN??"ctrl";
 const result=JSON.parse(execFileSync(ctrl,["--root",root,"--json","action","run","central.init","{}"],{encoding:"utf8"}));if(!result.ok)throw new Error(JSON.stringify(result));
 const projectRoot=join(root,"Work","ExpressionPage");mkdirSync(projectRoot,{recursive:true});const project=JSON.parse(execFileSync(ctrl,["--root",root,"--json","action","run","projectcentral.init",JSON.stringify({project:"ExpressionPage",project_id:"expression-page-walk"})],{encoding:"utf8"}));if(!project.ok)throw new Error(JSON.stringify(project));writeFileSync(join(projectRoot,"ada.html"),renderPage(blankPage("beings")));
 return {root,home,projectRoot,env:{OI_CENTRAL_ROOT:root,OI_CENTRAL_PROJECT_QUERY:"ExpressionPage",OI_HOME:home},cleanup:()=>{rmSync(root,{recursive:true,force:true});rmSync(home,{recursive:true,force:true});}};
}

const expressionRequest=(channel,request)=>channel("invoke.kernel_op",[{op:"expression",request}]);
function pageDocument(revision,live="available",representations=[]){const page=blankPage("beings");page.meta.documentId="ada";page.meta.title="Ada's living page";page.meta.revision=1;page.bindings.worldRef="world:personal";page.bindings.subjectRef="central:being:ada";page.page.subtitle="The same Being, presented through one native Expression.";page.page.expression={schema:"oi.expression-presentation/v1",expression_ref:"expression:page-ada",expression_revision:revision,scene_ref:"expression:page-ada:scene:main",live_renderer_ref:"renderer:oi:expression-stage",live_availability:live,subjects:[{ref:"central:being:ada",revision:"subject@1",availability:"available",sources:[{ref:"source:being:ada",revision:"source@1",availability:"available"}]}],representations};return page;}

export default async function run({page,baseUrl,check,metric,shot,channel,provision}){
 page.setDefaultTimeout(20000);await page.goto(baseUrl);await channel("info");await bindDefaultCentral(page,provision.root);
 await expressionRequest(channel,{operation:"create",expression_ref:"expression:page-ada",title:"Ada page Expression",actor:"human:ex5-walk"});
 await expressionRequest(channel,{operation:"edit",expression_ref:"expression:page-ada",expected_revision:1,actor:"human:ex5-walk",changes:[{change:"entity_add",scene_ref:"expression:page-ada:scene:main",entity_ref:"expression:page-ada:entity:ada",title:"Ada"}]});
 const bound=await expressionRequest(channel,{operation:"edit",expression_ref:"expression:page-ada",expected_revision:2,actor:"human:ex5-walk",changes:[{change:"subject_bind",entity_ref:"expression:page-ada:entity:ada",binding:{subject_ref:"central:being:ada",native_owner:"central",presentation_role:"being",sources:[{ref:"source:being:ada",revision:"source@1",availability:"available"}],readings:[],actions:[]}}]});
 const revision=bound.data.outcome.data.document.revision;writeFileSync(join(provision.projectRoot,"ada.html"),renderPage(pageDocument(revision)));
 const nav=page.getByRole("complementary",{name:"World navigator"});await nav.locator('[data-project-path="Work/ExpressionPage"]').click();await page.getByRole("button",{name:"ExpressionPage: files",exact:true}).click();await nav.locator('[data-file-path="Work/ExpressionPage/ada.html"]').click();
 const host=page.locator('.page-expression-host');await host.waitFor();await host.locator('.page-expression-canvas canvas').waitFor();
 const framedFallback=page.frameLocator("iframe.material-frame").locator(".page-expression");await framedFallback.waitFor({state:"attached"});await framedFallback.waitFor({state:"hidden"});check(await framedFallback.isHidden(),"The exact hosted live lease suppresses the iframe's standalone fallback so the page presents one coherent Expression body");
 await page.locator("iframe.material-frame").evaluate((frame)=>frame.contentWindow.postMessage({type:"oi:page-expression-host",token:"forged-mismatch",generation:0,live:false,page:{document_id:"ada",revision:1},expression:{ref:"expression:other",revision:3}},"*"));await page.waitForTimeout(50);check(await framedFallback.isHidden(),"A mismatched Expression ref cannot alter the hosted frame view");
 const standalone=await page.context().newPage();await standalone.goto(pathToFileURL(join(provision.projectRoot,"ada.html")).href);const standaloneFallback=standalone.locator(".page-expression");await standaloneFallback.waitFor({state:"visible"});check(await standaloneFallback.getByText("Expression unavailable",{exact:true}).isVisible(),"The same authored HTML keeps its explicit Expression fallback when opened standalone without a host lease");await standalone.close();
 const ownerPage=readFileSync(join(provision.projectRoot,"ada.html"),"utf8"),authoredFrame=page.frameLocator("iframe.material-frame");await authoredFrame.getByRole("button",{name:"Edit",exact:true}).click();await authoredFrame.locator('h1[data-field="title"]').fill("Ada local draft");await framedFallback.waitFor({state:"visible"});await host.waitFor({state:"detached"});check(await framedFallback.isVisible()&&await page.locator('.page-expression-host canvas').count()===0,"Editing the iframe invalidates the exact hosted lease, restores fallback, and releases the old live presentation");check(readFileSync(join(provision.projectRoot,"ada.html"),"utf8")===ownerPage,"Iframe editing does not mutate the owner-backed page source");page.once("dialog",dialog=>void dialog.accept());await openChrome(page,".material-surface");await page.getByRole("button",{name:"Reload preview"}).click();await host.locator('.page-expression-canvas canvas').waitFor();await framedFallback.waitFor({state:"hidden"});check(true,"Rereading the exact unchanged owner revision re-admits its live Expression body");
 check(await host.getAttribute("data-expression-ref")==="expression:page-ada","Beings page embeds the exact native Expression ref");check(await host.getAttribute("data-subject-ref")==="central:being:ada","Page and native Being keep the same subject ref");
 const canvas=host.locator('.page-expression-canvas canvas'),canvasId=await canvas.evaluate(element=>{element.dataset.ex5Identity="same-stage-canvas";return element.dataset.ex5Identity;});
 await host.getByRole("button",{name:"Focus Expression"}).click();const dialog=page.getByRole("dialog",{name:"Focused Expression"});await dialog.waitFor();check(await dialog.locator('canvas[data-ex5-identity="same-stage-canvas"]').count()===1,"Focus moves the same renderer canvas without an identity fork");
 await expressionRequest(channel,{operation:"create",expression_ref:"expression:unrelated",title:"Unrelated Expression",actor:"agent:unrelated"});await page.waitForTimeout(100);check(await dialog.locator('canvas[data-ex5-identity="same-stage-canvas"]').count()===1&&await dialog.isVisible(),"An unrelated Expression event keeps the focused canvas, context and presentation mounted");
 await page.keyboard.press("Escape");await dialog.waitFor({state:"detached"});check(await host.locator('canvas[data-ex5-identity="same-stage-canvas"]').count()===1,"Escape returns the same renderer canvas to the same page");check(canvasId==="same-stage-canvas","Renderer identity marker remained stable");
 await host.getByRole("button",{name:"Focus Expression"}).click();await page.getByRole("dialog",{name:"Focused Expression"}).getByRole("button",{name:"Capture current frame"}).click();await page.keyboard.press("Escape");await page.getByRole("dialog",{name:"Focused Expression"}).waitFor({state:"detached"});const capture=host.getByRole("img",{name:"Captured Expression frame"});await capture.waitFor();const pixels=await capture.evaluate(async image=>{const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext("2d");context.drawImage(image,0,0);const data=context.getImageData(0,0,canvas.width,canvas.height).data,colours=new Set();for(let i=0;i<data.length;i+=Math.max(4,Math.floor(data.length/4096/4)*4))colours.add(`${data[i]},${data[i+1]},${data[i+2]},${data[i+3]}`);const blob=await(await fetch(image.src)).blob(),base64=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.readAsDataURL(blob);});return {width:canvas.width,height:canvas.height,colours:colours.size,base64};});metric("capture_width",pixels.width);metric("capture_height",pixels.height);metric("capture_distinct_sampled_colours",pixels.colours);check(pixels.width>0&&pixels.height>0&&pixels.colours>1,"Existing engine capture returns a rendered nonuniform PNG");await shot("live-return-capture");
 writeFileSync(join(provision.projectRoot,"capture.png"),Buffer.from(pixels.base64,"base64"));
 await expressionRequest(channel,{operation:"edit",expression_ref:"expression:page-ada",expected_revision:revision,actor:"agent:ex5-stale-check",changes:[{change:"parameter_set",entity_ref:"expression:page-ada:entity:ada",parameter:"scale",value:1.2}]});
 await host.getByRole("alert").filter({hasText:"Expression revision changed"}).waitFor();await framedFallback.waitFor({state:"visible"});check(await host.getByRole("button",{name:"Focus Expression"}).isDisabled(),"A native Expression advance freezes the page instead of relabelling stale pixels as current");check(await framedFallback.isVisible(),"Losing the exact live lease restores the authored page's explicit fallback");
 const nextRevision=revision+1,representation={kind:"image",representation:{ref:`capture:expression-page-ada-${revision}`,revision:"capture@1",availability:"available"},provenance:[{ref:"expression:page-ada",revision:String(revision),availability:"available"}],href:"./capture.png",media_type:"image/png"};writeFileSync(join(provision.projectRoot,"ada.html"),renderPage(pageDocument(nextRevision,"unavailable",[representation])));await openChrome(page,".material-surface");await page.getByRole("button",{name:"Reload preview"}).click();
 await page.frameLocator("iframe.material-frame").locator('.page-expression img[src="./capture.png"]').waitFor();await page.locator('.page-expression-host').getByText("Live renderer not admitted",{exact:false}).waitFor();check(await page.locator('.page-expression-host canvas').count()===0,"Unavailable live renderer releases the stage and the page uses its explicit capture fallback");check(await page.locator('.page-expression-host>figure').count()===0,"A page-basis change revokes the prior page-local capture instead of relabelling it");await shot("captured-fallback-page");
 writeFileSync(join(provision.projectRoot,"ada.html"),renderPage(pageDocument(nextRevision)));await openChrome(page,".material-surface");await page.getByRole("button",{name:"Reload preview"}).click();const reentered=page.locator('.page-expression-host');await reentered.locator('.page-expression-canvas canvas').waitFor();check(await reentered.getAttribute("data-expression-ref")==="expression:page-ada"&&await reentered.getAttribute("data-expression-revision")===String(nextRevision),"A newly read exact page revision re-enters the same native Expression identity");await shot("live-reentry");

 // Restore this actual owner-backed page under a fresh opening splash.
 // The splash does not claim the production field, so the page may admit
 // its live canvas while the mark still covers the workspace.
 await page.evaluate(()=>sessionStorage.removeItem('oi-cradle.welcome.v1'));
 await page.goto(`${baseUrl}?frontstate`);
 const opening=page.locator('.oi-welcome');
 await opening.locator('.oi-welcome-enter[aria-label="O:I is ready. Open the app."]').waitFor({timeout:30000});
 await reentered.waitFor({state:'attached'});
 await reentered.locator('.page-expression-canvas canvas').waitFor({timeout:30000});
 const restoredFallback=page.frameLocator('iframe.material-frame').locator('.page-expression');
 await restoredFallback.waitFor({state:'hidden'});
 const pending=await page.evaluate(()=>{
  const host=document.querySelector('.page-expression-host'),canvas=host.querySelector('canvas[data-oi-stage="engine"]');
  const context=canvas?.getContext('webgl2');
  window.__pageOpeningField={canvas,context};
  return {canvasCount:document.querySelectorAll('canvas[data-oi-stage="engine"]').length,inlineCanvas:host.querySelectorAll('canvas').length,alerts:host.querySelectorAll('[role="alert"]').length,covered:!!host.closest('.oi-workspace-mount[inert][aria-hidden="true"]'),splash:!!document.querySelector('.oi-welcome-logo'),liveContext:!!context&&!context.isContextLost()};
 });
 check(pending.canvasCount===1&&pending.inlineCanvas===1&&pending.liveContext&&pending.splash,"The static splash covers the restored page while its one live field is already admitted");
 check(pending.covered&&pending.alerts===0,"The covered page stays mounted under the splash without a sticky admission error",pending);
 await opening.locator('.oi-welcome-enter').click();
 await opening.waitFor({state:'detached',timeout:30000});
 await reentered.locator('.page-expression-canvas canvas').waitFor({timeout:20000});
 await reentered.getByRole('button',{name:'Focus Expression'}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('.page-expression-host button')?.disabled);
 await restoredFallback.waitFor({state:'hidden'});
 const restored=await page.evaluate(()=>{
  const host=document.querySelector('.page-expression-host'),container=host.querySelector('.page-expression-canvas'),canvas=container.querySelector('canvas'),original=window.__pageOpeningField;
  const bounds=container.getBoundingClientRect(),drawn=canvas.getBoundingClientRect();
  return {sameCanvas:canvas===original.canvas,sameContext:canvas.getContext('webgl2')===original.context,healthy:!original.context.isContextLost(),canvasCount:document.querySelectorAll('canvas[data-oi-stage="engine"]').length,inline:canvas.parentElement===container,fits:Math.abs(bounds.width-drawn.width)<2&&Math.abs(bounds.height-drawn.height)<2,alerts:host.querySelectorAll('[role="alert"]').length,expressionRef:host.dataset.expressionRef,expressionRevision:host.dataset.expressionRevision,subjectRef:host.dataset.subjectRef};
 });
 check(restored.sameCanvas&&restored.sameContext&&restored.healthy&&restored.canvasCount===1&&restored.inline&&restored.fits,"Completing the opening returns the same production canvas and context to the restored page's actual inline body",restored);
 check(restored.alerts===0&&restored.expressionRef==='expression:page-ada'&&restored.expressionRevision===String(nextRevision)&&restored.subjectRef==='central:being:ada',"The restored live page keeps its exact Expression revision and subject without an admission error");
 await reentered.getByRole('button',{name:'Focus Expression'}).click();
 await page.getByRole('dialog',{name:'Focused Expression'}).waitFor();
 check(await page.evaluate(()=>document.querySelector('.page-expression-focus canvas')===window.__pageOpeningField.canvas),"The restored page can focus the same field after the splash releases");
 await page.keyboard.press('Escape');
 await page.getByRole('dialog',{name:'Focused Expression'}).waitFor({state:'detached'});
 check(await page.evaluate(()=>document.querySelector('.page-expression-canvas canvas')===window.__pageOpeningField.canvas),"Leaving restored-page focus returns the same field inline");
 await shot('restored-opening-inline');
}
