/** tarot-score — the QL-MEF #312 §10 walkthrough, app side.
 *
 * The Tarot score experience driven through the actual cradle shell against
 * the INSTALLED native host pair (the same `ql` + `ql-field-host` +
 * `ql-field-worker` + `ql-sky` the Tauri host fronts): the shell's Expressions
 * centre presents the vendored application; the application's live-field
 * instrument composes a sky-bearing scene through the kernel exchange; the
 * Nara instrument's Tarot score view resolves the selected subject's
 * deterministic `ql.tarot-score/v1` reading through the field's own exchange
 * transport; token selection drives the determinant-mode M3 gestures the body
 * already answers; and a second scene without a dated-sky request still
 * admits, anchored by the default event's own world sky (the anchorless
 * refusal is a score-basis property — proven by tarot-score-relay).
 *
 * Real owners end to end: ql-sky composes the dated sky, the field host owns
 * the score, the M3 reception owner moves the form. No fixture score, no
 * stub transport. Screenshots stand at every state the passage names.
 */
import {execFileSync} from "node:child_process";
import {mkdtempSync,mkdirSync,cpSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const cradleRoot=join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// The hosted application is served through the owner's files seam from the
// Central root (the mode-engine-state placement): this checkout's built
// vendored app is placed at the path the host reads, so the walk is
// self-contained and runs the exact bytes this checkout built.
const APP_DIST_SOURCE=join(cradleRoot,"expressions-app","dist");
const APP_DIST_CENTRAL_PATH=join("Work","O-I","desktop","cradle","expressions-app","dist");

export async function setup(){
  const root=mkdtempSync(join(tmpdir(),"oi-tarot-score-")),home=mkdtempSync(join(tmpdir(),"oi-tarot-score-home-"));
  const ctrl=process.env.OI_CENTRAL_CTRL_BIN??"ctrl";
  try{
    const result=JSON.parse(execFileSync(ctrl,["--root",root,"--json","action","run","central.init","{}"],{encoding:"utf8"}));
    if(!result.ok)throw new Error(JSON.stringify(result));
    const projectRoot=join(root,"Work","ExpressionPage");
    mkdirSync(projectRoot,{recursive:true});
    const project=JSON.parse(execFileSync(ctrl,["--root",root,"--json","action","run","projectcentral.init",JSON.stringify({project:"ExpressionPage",project_id:"tarot-score-walk"})],{encoding:"utf8"}));
    if(!project.ok)throw new Error(JSON.stringify(project));
    mkdirSync(dirname(join(root,APP_DIST_CENTRAL_PATH)),{recursive:true});
    cpSync(APP_DIST_SOURCE,join(root,APP_DIST_CENTRAL_PATH),{recursive:true});
    return {root,home,env:{OI_CENTRAL_ROOT:root,OI_CENTRAL_PROJECT_QUERY:"ExpressionPage",OI_HOME:home},
      cleanup:()=>{rmSync(root,{recursive:true,force:true});rmSync(home,{recursive:true,force:true});}};
  }catch(error){
    rmSync(root,{recursive:true,force:true});rmSync(home,{recursive:true,force:true});
    throw error;
  }
}

const MODE_STRIP=(mode)=>`.world-mode-strip [data-mode="${mode}"]`;

export default async function run({page,baseUrl,check,shot,channel,metric,log,provision}){
  page.setDefaultTimeout(30000);
  const request=async request=>{
    const envelope=await channel("invoke.kernel_op",[{op:"expression",request}]);
    if(!envelope.ok||envelope.data?.outcome?.result!=="expression")throw new Error(JSON.stringify(envelope));
    return envelope.data.outcome.data;
  };
  // -- the working Expression: one native document with one scene, composed
  // through the same kernel seam the application's Library reads.
  await page.goto(baseUrl);
  await channel("info");
  // The scope menu chooses the walk's project: the Nara owners resolve their
  // project-scoped ground from the shell's own workspace scope (10-SIDEBARS
  // §3.6: the scope menu is the one place scope is chosen).
  await page.locator(".left-scope-trigger").click();
  const scopeMenu=page.getByRole("group",{name:"Scope and workspace"});
  await scopeMenu.waitFor();
  await scopeMenu.locator("[data-scope-project='ExpressionPage']").click();
  await page.waitForFunction(()=>document.querySelector(".left-scope-name")?.textContent==="ExpressionPage",null,{timeout:20000});
  // The right agent region covers the presented application's inspector at
  // this width; the walk collapses it through the shell's own toggle
  // (⌘⇧B binding) and re-checks once the workspace layout is live.
  const collapseRightRegion=async()=>{
    for(let attempt=0;attempt<3;attempt++){
      const expanded=await page.evaluate(()=>{
        const region=document.querySelector("aside[data-region='right']");
        return region?region.getAttribute("data-depth")!=="collapsed":null;
      });
      if(expanded===false||expanded===null)return;
      const toggle=page.locator("button[aria-label='Toggle right region']");
      if(await toggle.isVisible().catch(()=>false)&&await toggle.getAttribute("aria-expanded")==="true")await toggle.click().catch(()=>{});
      else await page.keyboard.press("Meta+Shift+B");
      await page.waitForTimeout(400);
    }
  };
  await collapseRightRegion();
  const expressionRef="expression:tarot-score-walk";
  await request({operation:"create",expression_ref:expressionRef,title:"Tarot score walk",actor:"human:tarot-score-walk"});
  const sceneRef=`${expressionRef}:scene:occasion`;
  const composed=await request({operation:"edit",expression_ref:expressionRef,expected_revision:1,actor:"human:tarot-score-walk",
    changes:[{change:"scene_create",scene_ref:sceneRef,title:"Occasion"},
      {change:"entity_add",scene_ref:sceneRef,entity_ref:`${expressionRef}:entity:anchor`,title:"Anchor"}]});
  check(composed.document?.scenes?.some(scene=>scene.scene_ref===sceneRef),
    "The kernel holds the walk's Expression with its occasion scene",{revision:composed.document?.revision,scenes:composed.document?.scenes?.map(s=>s.scene_ref)});
  // The Atlas adoption selects a centre through the kernel's own focus change
  // (the same owner operation the application's selection sync drives).
  await request({operation:"edit",expression_ref:expressionRef,expected_revision:2,actor:"human:tarot-score-walk",
    changes:[{change:"focus",scene_ref:sceneRef,entity_ref:`${expressionRef}:entity:anchor`}]});

  // -- enter the Expressions centre: the shell presents the vendored app.
  await page.locator(MODE_STRIP("expressions")).click();
  await page.locator('.mode-stage:not([hidden]) .pcd-host[data-state="ready"]').waitFor({timeout:45000});
  const handle=await page.locator('.mode-stage:not([hidden]) iframe.pcd-host-frame').first().elementHandle();
  let frame=handle?await handle.contentFrame():null;
  if(!frame)throw new Error("the Expressions centre's application frame did not present");
  await frame.waitForSelector("#tool-rail button",{state:"attached",timeout:45000});
  await frame.waitForFunction(()=>!!window.__FIELD_STUDIES__,null,{timeout:45000});
  const dismiss=frame.locator("#entry-gate:not([hidden]) [data-action='entry-dismiss']");
  if(await dismiss.count()){await dismiss.click();await frame.waitForFunction(()=>document.querySelector("#entry-gate")?.hasAttribute("hidden"),null,{timeout:15000});}
  await frame.waitForFunction(()=>(window.__FIELD_STUDIES__?.native?.()?.renderer_requirements?.slot_count??0)>0,null,{timeout:90000});
  log("the application's retained GPU field is live");

  // -- the studio's native section, reached the way a person reaches it at
  // this width: the header cluster compacts at 1100px, so the Studio control
  // may live behind the workspace menu toggle.
  const ensureNativePanel=async()=>{
    if(await frame.locator(".native-field-panel").isVisible().catch(()=>false))return;
    const compact=await frame.evaluate(()=>{
      const cluster=[...document.querySelectorAll(".header-cluster[data-compact-at]")].find(el=>el.getClientRects().length>0);
      const toggle=cluster?.querySelector(".header-menu-toggle");
      return !!(toggle&&matchMedia(`(max-width: ${cluster.dataset.compactAt}px)`).matches&&getComputedStyle(toggle).display!=="none");
    });
    if(compact)await frame.locator(".header-cluster[data-compact-at] .header-menu-toggle").filter({visible:true}).first().click({force:true});
    await frame.locator("[data-action='studio']").click({force:true});
    const section=frame.locator("[data-action='studio-section'][data-value='native']");
    if(await section.getAttribute("aria-current")!=="page")await section.click({force:true});
    await frame.locator(".native-field-panel").waitFor({state:"visible",timeout:30000});
  };

  // -- open the walk's Expression through the application's own native open
  // path (the same open the Library rows and the host command ride).
  await frame.evaluate(ref=>window.__FIELD_STUDIES__.openNative(ref),expressionRef);
  await frame.waitForFunction(ref=>window.__FIELD_STUDIES__?.nativeWorking?.()?.native_ref===ref,expressionRef,{timeout:60000});
  const opened=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());
  check(opened.native_ref===expressionRef&&Object.values(opened.bindings??{}).some(binding=>binding.scene_ref===sceneRef),
    "The application opens the walk's native Expression with its scene binding",{native_ref:opened.native_ref,revision:opened.revision});

  // -- the live field instrument: compose the sky-bearing scene through the
  // shell's own panel (the primary opening: dated sky now — ql-sky runs).
  await ensureNativePanel();
  // The compose spawns the installed ql + ql-sky; under load one admission may
  // pass the channel's acknowledgement ceiling. A person retries the opening —
  // so does the walk, and the receipt names any standing refusal.
  const openInstrument=async buttonSelector=>{
    for(let attempt=1;;attempt++){
      const openButton=frame.locator(buttonSelector);
      await openButton.waitFor();
      await openButton.click();
      await frame.waitForFunction(()=>{
        const reading=window.__FIELD_STUDIES__?.native?.();
        return ["held","following","unavailable"].includes(reading?.status)&&(reading?.instrument?.influence||reading?.status==="unavailable");
      },null,{timeout:120000});
      const reading=await frame.evaluate(()=>window.__FIELD_STUDIES__.native());
      if(reading.status!=="unavailable"||attempt>=3)break;
      log(`field admission unavailable (${reading.reason}); retrying the opening (attempt ${attempt+1})`);
      // Let the shell relay's in-flight compose settle before the next opening.
      await page.waitForTimeout(30000);
    }
    return frame.evaluate(()=>window.__FIELD_STUDIES__.native());
  };
  /** A compose the app's channel outlives leaves the shell relay holding a
   * lease no panel control can release; a person reloads the centre. The walk
   * does the same, once, and re-enters everything the reload resets. */
  const reopenCentre=async()=>{
    await page.reload();
    await page.waitForSelector(".desktop-shell",{timeout:30000});
    await page.locator(MODE_STRIP("expressions")).click();
    await page.locator('.mode-stage:not([hidden]) .pcd-host[data-state="ready"]').waitFor({timeout:45000});
    const handle=await page.locator('.mode-stage:not([hidden]) iframe.pcd-host-frame').first().elementHandle();
    frame=handle?await handle.contentFrame():null;
    if(!frame)throw new Error("the Expressions centre's application frame did not re-present after reload");
    await frame.waitForSelector("#tool-rail button",{state:"attached",timeout:45000});
    await frame.waitForFunction(()=>!!window.__FIELD_STUDIES__,null,{timeout:45000});
    const gate=frame.locator("#entry-gate:not([hidden]) [data-action='entry-dismiss']");
    if(await gate.count()){await gate.click();await frame.waitForFunction(()=>document.querySelector("#entry-gate")?.hasAttribute("hidden"),null,{timeout:15000});}
    await frame.waitForFunction(()=>(window.__FIELD_STUDIES__?.native?.()?.renderer_requirements?.slot_count??0)>0,null,{timeout:90000});
    await frame.evaluate(ref=>window.__FIELD_STUDIES__.openNative(ref),expressionRef);
    await frame.waitForFunction(ref=>window.__FIELD_STUDIES__?.nativeWorking?.()?.native_ref===ref,expressionRef,{timeout:60000});
    await ensureNativePanel();
  };
  let field=await openInstrument(".native-field-panel [data-ni='open']");
  if(field.status==="unavailable"){
    log(`the first admission failed (${field.reason}); reloading the Expressions centre and re-entering`);
    await reopenCentre();
    // An admission the app's channel outlives may still be composing inside
    // the kernel; give it time to settle and release before retrying.
    await page.waitForTimeout(75000);
    field=await openInstrument(".native-field-panel [data-ni='open']");
  }
  check(field.status==="held"||field.status==="following",`The live field instrument opens on the installed pair (${field.status})`,{status:field.status,reason:field.reason});
  check(!!field.instrument?.acting?.event_ref,"The composed scene names its own event and subject",{event_ref:field.instrument?.acting?.event_ref,subject_ref:field.instrument?.acting?.subject_ref});
  check(field.instrument?.acting?.sky?.kind==="dated","The scene event carries the dated sky ql-sky composed",field.instrument?.acting?.sky);
  await shot("tarot-field-live");

  // -- the Nara instrument: a saved identity selected through the real
  // identity owner (birth details → native calculation → save + select).
  await frame.getByRole("button",{name:"Nara",exact:true}).click();
  const instrument=frame.locator("section[aria-label='Nara Expression instrument']");
  await instrument.waitFor();
  await instrument.getByLabel("Your name").fill("Walk Occasion");
  await instrument.getByLabel("Birth date").fill("1990-05-15");
  await instrument.getByLabel("Time precision").selectOption("exact");
  await instrument.getByLabel("Local birth time").fill("12:00");
  await instrument.getByLabel("Birthplace",{exact:true}).fill("London, England");
  await instrument.getByLabel("Latitude").fill("51.5074");
  await instrument.getByLabel("Longitude").fill("-0.1278");
  await instrument.getByLabel("Birthplace timezone").fill("Europe/London");
  // The coordinate source sits in the collapsed clock-ambiguity details; the
  // installed identity owner refuses an unnamed birthplace source, so the
  // person names it before calculating — a real UI act, not a fixture.
  await instrument.getByText("Birth source and clock ambiguity",{exact:true}).click();
  await instrument.getByLabel("Coordinate source").fill("walk:provisioned");
  await instrument.getByRole("button",{name:"Calculate and review",exact:true}).click();
  try{
    await instrument.getByRole("button",{name:"Save and use identity",exact:true}).waitFor({timeout:120000});
    await frame.waitForFunction(()=>{const button=[...document.querySelectorAll("button")].find(b=>b.textContent?.trim()==="Save and use identity");return button&&!button.disabled;},null,{timeout:120000});
  }catch(error){
    const state=await instrument.evaluate(section=>({
      alerts:[...section.querySelectorAll("[role='alert']")].map(node=>node.textContent),
      statuses:[...section.querySelectorAll("[role='status']")].map(node=>node.textContent)}));
    throw new Error(`the identity reading did not return: ${JSON.stringify(state)}`);
  }
  await instrument.getByRole("button",{name:"Save and use identity",exact:true}).click();
  await instrument.getByText("Saved. This identity is selected for the Expression.",{exact:true}).waitFor({timeout:180000});
  check(true,"The identity owner calculates, saves and selects the walk's person through the birth form");
  await shot("tarot-identity-selected");

  // -- the Expression's coordinate profile: the Atlas reads the rooted M
  // coordinate from QL's own registry and adopts it through the existing
  // Expression owner (profile_adopt) — the basis the personal current and the
  // M3 reception owners require.
  await instrument.getByRole("button",{name:"Coordinate Atlas",exact:true}).click();
  const atlas=instrument.locator("section[aria-label='Coordinate Atlas']");
  await atlas.getByLabel("Coordinate reference",{exact:true}).fill("M0");
  await atlas.getByRole("button",{name:"Read coordinate",exact:true}).click();
  await atlas.getByRole("button",{name:"Use profile for this Expression",exact:true}).waitFor({timeout:120000});
  await atlas.getByRole("button",{name:"Use profile for this Expression",exact:true}).click();
  try{
    await atlas.getByText(/Adopted .+ as the Expression profile/).waitFor({timeout:120000});
  }catch(error){
    const state=await atlas.evaluate(section=>({
      alerts:[...section.querySelectorAll("[role='alert']")].map(node=>node.textContent),
      statuses:[...section.querySelectorAll("[role='status']")].map(node=>node.textContent)}));
    throw new Error(`the coordinate adoption did not return: ${JSON.stringify(state)}`);
  }
  check(true,"The Atlas adopts the rooted M coordinate as the Expression's profile through the native owner");

  // -- the occasion: pin the dated sky reading (sets the encounter the M3
  // gestures and the score resolve stand on).
  await instrument.getByRole("button",{name:"Composition",exact:true}).click();
  await instrument.getByLabel("Sky date and time UTC",{exact:true}).fill("2026-09-27T12:00");
  await instrument.getByRole("button",{name:"Read this dated sky",exact:true}).click();
  try{
    await instrument.getByText(/Sky at 2026-09-27T12:00:00Z/).waitFor({timeout:240000});
  }catch(error){
    const state=await instrument.evaluate(section=>({
      alerts:[...section.querySelectorAll("[role='alert']")].map(node=>node.textContent),
      statuses:[...section.querySelectorAll("[role='status']")].map(node=>node.textContent)}));
    throw new Error(`the dated sky reading did not return: ${JSON.stringify(state)}`);
  }

  // -- open the native form so the determinant path has its encounter form.
  await instrument.getByRole("button",{name:"Form and clock",exact:true}).click();
  try{
    await instrument.locator("label:has-text('Opening form address') select").selectOption("0",{timeout:60000});
  }catch(error){
    const state=await instrument.evaluate(section=>({
      alerts:[...section.querySelectorAll("[role='alert']")].map(node=>node.textContent),
      headings:[...section.querySelectorAll("h2")].map(node=>node.textContent),
      selects:[...section.querySelectorAll("select")].map(node=>node.getAttribute("aria-label")??node.closest("label")?.querySelector("span")?.textContent)}));
    throw new Error(`the Form and clock opening did not present: ${JSON.stringify(state)}`);
  }
  await instrument.locator("label:has-text('Opening pose') select").selectOption("0");
  await instrument.locator("label:has-text('Opening static aperture') select").selectOption("0");
  await instrument.locator("label:has-text('Opening matrix axis') select").selectOption("0");
  await instrument.getByLabel("Opening clock step",{exact:true}).fill("359");
  await instrument.locator("label:has-text('Opening transcription') select").selectOption("dna");
  await instrument.getByRole("button",{name:"Open this native form",exact:true}).click();
  await instrument.getByRole("button",{name:"Apply native operation",exact:true}).waitFor({timeout:240000});
  check(true,"The native form opens for the encounter through the Form and clock view");

  // -- the Tarot score view: the resolve admits on the scene's own basis.
  await instrument.getByRole("button",{name:"Tarot score",exact:true}).click();
  const score=instrument.locator("section[aria-label='Tarot score']");
  await score.locator(".nara-tarot-cards .nara-tarot-card").first().waitFor({timeout:180000});
  const cards=await score.locator(".nara-tarot-cards .nara-tarot-card").count();
  metric("tarot_tokens",cards);
  check(cards>0,"The score resolve admits through the exchange transport and the tokens render", {tokens:cards});
  const caption=await score.locator(".nara-personal-caption").first().innerText();
  const basisPrefix=caption.match(/basis (\S+)…/)?.[1]??null;
  check(/Score ql\.tarot-score\/v1/.test(caption)&&!!basisPrefix,"The held reading names its schema and basis revision", {caption});
  const firstCard=score.locator(".nara-tarot-cards .nara-tarot-card").first();
  const cardName=await firstCard.locator(".nara-tarot-card-name").innerText();
  const cardRole=(await firstCard.locator(".nara-tarot-card-role").innerText()).trim();
  const cardOrigin=await firstCard.locator(".nara-tarot-origin").innerText();
  const badges=await firstCard.locator(".nara-tarot-badge").allInnerTexts();
  const poseBadge=badges.find(text=>/state \d+\/\d+/.test(text))??"";
  const poseMatch=poseBadge.match(/state (\d+)\/(\d+)/);
  check(/^(Ace|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Princess|Prince|Queen|King) of (Cups|Wands|Pentacles|Swords)$/.test(cardName),
    "A token renders as its named card from the minor-id decode",{cardName});
  check(cardRole.length>0,"The token shows its score role",{cardRole});
  check(cardOrigin==="Computed","The token shows its computed origin label",{cardOrigin});
  check(/(lawfully admitted|outside the lawful set) · state \d+\/\d+/.test(poseBadge)
    &&Number(poseMatch?.[1])<=Number(poseMatch?.[2])&&Number(poseMatch?.[2])>0,
    "The token shows its pose admission badge within the lawful state count",{poseBadge});
  await shot("tarot-score-view");
  try{
    await score.getByText("The held score answers as current for this field event.").waitFor({timeout:30000});
    check(true,"The held score answers as current for this field event");
  }catch{
    const stale=await score.locator(".nara-tarot-stale").allInnerTexts();
    check(false,"The held score answers as current for this field event",{stale});
  }

  // -- determinant mode: selecting a token moves the resident form through
  // the native M3 operations (select-form to the card's address + set-pose).
  await collapseRightRegion();
  const receipt=score.getByRole("status").filter({hasText:/generation \d+/});
  const generation=async()=>{
    const text=await receipt.innerText();
    return Number(text.match(/generation (\d+)/)?.[1]);
  };
  await score.getByRole("button",{name:"Change determinant",exact:true}).click();
  await firstCard.click();
  await receipt.waitFor({timeout:180000});
  const appliedGeneration=await generation();
  check(appliedGeneration>=1,"Selecting a token applies the card's form and pose through the native M3 owner",{generation:appliedGeneration});
  await shot("tarot-token-selected");
  const formState=async()=>{
    return score.evaluate(section=>{
      const pre=section.querySelector(".nara-personal-depth pre");
      return pre?JSON.parse(pre.textContent??"null"):null;
    });
  };
  const selected=await formState();
  check(typeof selected?.state?.form?.address==="number",
    "The applied native form answers with its real state",{address:selected?.state?.form?.address,pose:selected?.state?.form?.pose,state_count:selected?.state?.form?.state_count});

  // -- step the pose within the lawful count, on a token whose pose the owner
  // admits (the badge names it; a token outside the lawful set offers no pose
  // traversal and that refusal is its own honest state).
  const lawfulIndex=await score.locator(".nara-tarot-cards .nara-tarot-card").evaluateAll(cards=>
    cards.findIndex(card=>[...card.querySelectorAll(".nara-tarot-badge")].some(badge=>badge.textContent?.includes("lawfully admitted"))));
  if(lawfulIndex<0)throw new Error("no token carries a lawfully admitted pose; the traversal cannot be exercised");
  const lawfulCard=score.locator(".nara-tarot-cards .nara-tarot-card").nth(lawfulIndex);
  await lawfulCard.click();
  await receipt.waitFor({timeout:180000});
  await frame.waitForFunction(previous=>{const pre=document.querySelector("section[aria-label='Tarot score'] .nara-personal-depth pre");const state=pre?JSON.parse(pre.textContent??"null"):null;return state?.state?.identity?.profile_generation>previous;},appliedGeneration,{timeout:180000});
  const lawful=await formState();
  const lawfulPose=lawful?.state?.form?.pose;
  const lawfulCount=lawful?.state?.form?.state_count;
  const nextPose=await lawfulCard.locator(".nara-tarot-badge").allInnerTexts().then(badges=>{
    const match=badges.find(text=>/state \d+\/\d+/.test(text))?.match(/state (\d+)\/(\d+)/);
    return match?{state:Number(match[1]),count:Number(match[2])}:null;
  });
  const canStep=(nextPose?.state??lawfulPose)+1<lawfulCount;
  // The traversal steps toward the lawful interior: +1 from a low state, −1
  // from the last lawful state (the buttons refuse to leave the lawful set).
  const stepButton=canStep?"Pose +1":"Pose −1";
  await score.getByRole("button",{name:stepButton,exact:true}).click();
  await frame.waitForFunction(previous=>{const pre=document.querySelector("section[aria-label='Tarot score'] .nara-personal-depth pre");const state=pre?JSON.parse(pre.textContent??"null"):null;return state?.state?.identity?.profile_generation>previous;},await generation(),{timeout:180000});
  const posed=await formState();
  const expectedPose=canStep?lawfulPose+1:lawfulPose-1;
  check(posed?.state?.form?.pose===expectedPose&&posed?.state?.form?.pose>=0&&posed?.state?.form?.pose<posed?.state?.form?.state_count,
    "Stepping the pose moves the native form within its lawful state count",
    {pose:posed?.state?.form?.pose,previous:lawfulPose,step:stepButton,state_count:posed?.state?.form?.state_count});

  // -- advance the clock; the native clock projection moves.
  const before720=await formState();
  await score.getByLabel("Advance the clock by steps").fill("1");
  await score.getByRole("button",{name:"Advance clock",exact:true}).click();
  await frame.waitForFunction(previous=>{const pre=document.querySelector("section[aria-label='Tarot score'] .nara-personal-depth pre");const state=pre?JSON.parse(pre.textContent??"null"):null;return state?.state?.identity?.profile_generation>previous;},await generation(),{timeout:180000});
  const stepped=await formState();
  check(Number(stepped?.state?.clock?.steps)===Number(before720?.state?.clock?.steps)+1,
    "Advancing the clock moves the native clock projection by the named steps",
    {steps:stepped?.state?.clock?.steps,previous:before720?.state?.clock?.steps});

  // -- the 720° Return: two completed double covers, the sheet reading returns.
  await score.getByRole("button",{name:"720° Return",exact:true}).click();
  await frame.waitForFunction(previous=>{const pre=document.querySelector("section[aria-label='Tarot score'] .nara-personal-depth pre");const state=pre?JSON.parse(pre.textContent??"null"):null;return state?.state?.identity?.profile_generation>previous;},await generation(),{timeout:180000});
  const returned=await formState();
  const covers=Number(returned?.state?.clock?.completed_double_covers);
  const previousCovers=Number(before720?.state?.clock?.completed_double_covers);
  const sheet=Math.floor(Number(returned?.state?.clock?.degree720)/360)+1;
  const previousSheet=Math.floor(Number(before720?.state?.clock?.degree720)/360)+1;
  check(Number.isFinite(covers)&&(covers===previousCovers+2||sheet!==previousSheet),
    "The 720° Return advances the completed double covers",
    {completed_double_covers:covers,previous:previousCovers,degree720:returned?.state?.clock?.degree720,sheet,previous_sheet:previousSheet});
  await shot("tarot-720-return");

  // -- score-state currentness after the traversal: leaving and re-entering
  // the view resolves again through the field's own basis.
  await instrument.getByRole("button",{name:"Form and clock",exact:true}).click();
  await instrument.getByRole("button",{name:"Tarot score",exact:true}).click();
  await score.locator(".nara-tarot-cards .nara-tarot-card").first().waitFor({timeout:180000});
  try{
    await score.getByText("The held score answers as current for this field event.").waitFor({timeout:30000});
    check(true,"After the traversal the re-resolve answers current through score-state");
  }catch{
    const stale=await score.locator(".nara-tarot-stale").allInnerTexts();
    check(false,"After the traversal the re-resolve answers current through score-state",{stale});
  }

  // -- refusals are first-class: a second scene WITHOUT a sky. The single
  // material owner is released first; the explicit default-event opening
  // composes without a dated sky, and the resolve refuses BY NAME. The shell
  // overlay returns to the field first: the studio lives under it.
  await instrument.getByRole("button",{name:"Return to the Expression",exact:true}).click();
  await instrument.waitFor({state:"hidden"});
  await ensureNativePanel();
  await frame.locator(".native-field-panel [data-ni='close']").click();
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.native?.()?.status==="manual",null,{timeout:60000});
  await frame.locator(".native-field-panel summary",{hasText:"Other openings"}).click();
  const defaultField=await openInstrument(".native-field-panel [data-ni='open-default']");
  check(defaultField.instrument?.acting?.sky?.kind==="none","The second scene composes without a dated sky request",defaultField.instrument?.acting?.sky);
  await frame.getByRole("button",{name:"Nara",exact:true}).click();
  await instrument.waitFor({state:"visible"});
  // The instrument keeps its view across hide/re-entry; re-entering the Tarot
  // score view remounts it and resolves afresh against the new scene basis.
  await instrument.getByRole("button",{name:"Form and clock",exact:true}).click();
  await instrument.getByRole("button",{name:"Tarot score",exact:true}).click();
  // The default event still carries its own world sky, so this resolve
  // ADMITS anchored by it; the named anchorless refusal is a property of the
  // score BASIS (no identity, no occasion sky) and is proven at the relay
  // level by tarot-score-relay.
  await score.locator(".nara-tarot-cards .nara-tarot-card").first().waitFor({timeout:180000});
  check(await score.getByText("The held score answers as current for this field event.").isVisible(),
    "The default scene's resolve admits anchored by the event's own world sky and answers current");
  await shot("tarot-default-scene-resolve");

  // -- save the document through the shell's save path, reopen it, and read
  // the same basis: the score's basis survives the document round-trip.
  await instrument.getByRole("button",{name:"Return to the Expression",exact:true}).click();
  await instrument.waitFor({state:"hidden"});
  await frame.locator("#native-save").click();
  await frame.getByText("Saved.",{exact:true}).waitFor({timeout:120000});
  const saved=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());
  check(saved.native_ref===expressionRef,"The application commits the working composition to its native Expression",saved);
  await frame.evaluate(ref=>window.__FIELD_STUDIES__.openNative(ref),expressionRef);
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.nativeWorking?.()?.native_ref!=null,null,{timeout:60000});
  await frame.getByRole("button",{name:"Nara",exact:true}).click();
  await instrument.waitFor({state:"visible"});
  await instrument.getByRole("button",{name:"Form and clock",exact:true}).click();
  await instrument.getByRole("button",{name:"Tarot score",exact:true}).click();
  await score.locator(".nara-tarot-cards .nara-tarot-card").first().waitFor({timeout:180000});
  const reopenedCaption=await score.locator(".nara-personal-caption").first().innerText();
  const reopenedBasis=reopenedCaption.match(/basis (\S+)…/)?.[1]??null;
  check(reopenedBasis!==null&&reopenedBasis===basisPrefix,
    "After save and reopen the score re-resolves to the same basis revision",
    {before:basisPrefix,after:reopenedBasis});
}
