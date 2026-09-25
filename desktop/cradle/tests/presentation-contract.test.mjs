import test from "node:test";
import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {convertImportedTheme,validateCustomTheme,customThemeCss} from "../src/visuals/customThemes.ts";
import {validatePresentation} from "../src/visuals/presentation.ts";
import {arrangementObservation,visualObservation} from "../src/visuals/observations.ts";
import {freshLayout} from "../src/surface/types.ts";
import {requireRecordedDecision} from "../src/nara/decisionRecord.ts";

const upstream=new URL("../../../packages/oi-design-system/themes/upstream/",import.meta.url);
const nord=await readFile(new URL("nord-dark.color-theme.json",upstream),"utf8");
const theme=convertImportedTheme(nord,"nord.json",[]);

test("real bundled upstream themes convert into safe imported CSS including terminal roles",async()=>{
  assert.ok(customThemeCss([theme]).includes("--oi-terminal-ansi-red:"));
  for(const name of (await readdir(upstream)).filter(name=>name.endsWith(".color-theme.json") && name!=="light-plus.color-theme.json")) {
    const converted=convertImportedTheme(await readFile(new URL(name,upstream),"utf8"),name,[]);
    assert.equal(validateCustomTheme(converted).id,converted.id);
    assert.ok(converted.variables["--oi-terminal-background"]);
    assert.ok(customThemeCss([converted]).includes("--oi-terminal-background:"));
  }
});
test("CSS projection rejects unsafe identities, non-role properties, injected values and unbounded RGBA",()=>{
  for(const bad of [
    {...theme,id:'bad"] {} body {'},
    {...theme,variables:{...theme.variables,"--oi-unknown":"#ffffff"}},
    {...theme,variables:{...theme.variables,"--oi-foreground":"red; } body { display: none"}},
    {...theme,variables:{...theme.variables,"--oi-foreground":"rgba(256, 0, 0, 1)"}},
    {...theme,variables:{...theme.variables,"--oi-shadow-plane":"url(https://example.invalid)"}},
    {...theme,preview:{...theme.preview,ground:"url(secret)"}},
  ]) assert.throws(()=>customThemeCss([bad]));
  assert.throws(()=>customThemeCss([theme,theme]),/duplicate/);
});
test("explicit imports preserve existing identities and refuse overflow instead of evicting saved themes",()=>{
  assert.notEqual(convertImportedTheme(nord,"nord.json",[theme]).id,theme.id);
  assert.throws(()=>convertImportedTheme(nord,"nord.json",Array.from({length:50},()=>theme)),/Remove/);
});
test("kernel presentation validation refuses mismatched selection and unsafe custom libraries",()=>{
  const reading={schema:"oi.presentation/v1",revision:3,theme:{appearance:theme.appearance,id:theme.id},custom_themes:[theme],observations:{}};
  assert.equal(validatePresentation(reading).theme.id,theme.id);
  assert.throws(()=>validatePresentation({...reading,theme:{appearance:"light",id:theme.id}}),/different appearance/);
  assert.throws(()=>validatePresentation({...reading,custom_themes:[]}),/absent/);
});
test("arrangement and visual observations omit writing, commands, URLs, labels, recipes and glyph content",()=>{
  const layout=freshLayout();
  layout.surfaces={s:{id:"s",kind:"document",ref:"source:accepted",title:"PRIVATE title",browser:{url:"PRIVATE URL"},terminal:{command:["PRIVATE command"]},flow:{path:"PRIVATE path"}}};
  const book={active:"w",workspaces:[{id:"w",name:"PRIVATE name",writing:"PRIVATE draft",layout,context:{subject:{title:"PRIVATE subject"}}}]};
  const observation=arrangementObservation(book);
  assert.deepEqual(observation.surfaces,[{id:"s",kind:"document",ref:"source:accepted"}]);
  assert.ok(!JSON.stringify(observation).includes("PRIVATE"));
  assert.equal(book.workspaces[0].writing,"PRIVATE draft");
  assert.deepEqual(visualObservation({enabled:true,welcomeEnabled:false,config:{glyph:["PRIVATE"]},savedStates:[{name:"PRIVATE"}]}),{enabled:true,welcome_enabled:false});
});
test("large arrangement observation stays bounded while the original layout remains intact",()=>{
  const layout=freshLayout();
  layout.surfaces=Object.fromEntries(Array.from({length:64},(_,i)=>[String(i),{id:"🪷".repeat(120),kind:"🪷".repeat(120),ref:"🪷".repeat(120),title:"original"}]));
  const observation=arrangementObservation({active:"w",workspaces:[{id:"w",name:"name",writing:"original",layout}]});
  assert.equal(observation.truncated,true);
  assert.ok(new TextEncoder().encode(JSON.stringify(observation)).length<32000);
  assert.equal(Object.keys(layout.surfaces).length,64);
});
test("Nara record acknowledgment must preserve the exact adjudicator and resolution",()=>{
  const decision={schema:"actuation.speech-tool-decision/v1",decision_ref:"decision:one",decided_by:"person:desktop",resolution:{resolution:"refused",stage:"denied",reason:"Denied"}};
  requireRecordedDecision({result:"nara_decision_recorded",decision:{resolution:decision.resolution,decided_by:decision.decided_by,decision_ref:decision.decision_ref,schema:decision.schema}},decision);
  assert.throws(()=>requireRecordedDecision(null,decision),/not recorded/);
  assert.throws(()=>requireRecordedDecision({result:"nara_decision_recorded",decision:{...decision,decided_by:"different actor"}},decision),/differs/);
  assert.throws(()=>requireRecordedDecision({result:"nara_decision_recorded",decision:{...decision,resolution:{resolution:"authorised"}}},decision),/differs/);
});
