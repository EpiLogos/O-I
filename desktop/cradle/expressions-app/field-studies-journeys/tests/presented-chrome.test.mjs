// T-FRAME-CHROME-ONTO-PLATES: presented by the shell in a pane, the frame draws only its field. The stand-down is the frame's own (its
// body class, its own stylesheet), set only by the shell's declaration over the one channel; standalone, and at full size, the chrome
// stands as it always has. Every control stays mounted with its own handler: concealed by visibility, never removed — and the canvas's
// minimap stays, as the manual's Full Canvas has it. The chrome is read as data for the shell's devices and pressed from there.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readStageRequest,stageRequestMessage,readFrameChrome,FRAME_PRESENTATIONS,FRAME_CHROME_HOMES,STAGE_COMMANDS} from '../build/stageCommands.js';

const source=path=>readFile(new URL(path,import.meta.url),'utf8');

test('the presentation and the chrome press are closed stage commands', () => {
 assert.ok(STAGE_COMMANDS.includes('presentation')&&STAGE_COMMANDS.includes('chrome'));
 assert.deepEqual([...FRAME_PRESENTATIONS],['devices','frame']);
 assert.deepEqual(readStageRequest(stageRequestMessage(1,{command:'presentation',chrome:'devices'})),{req:1,command:{command:'presentation',chrome:'devices'}});
 assert.deepEqual(readStageRequest(stageRequestMessage(2,{command:'chrome',id:'tools/l:Snap'})),{req:2,command:{command:'chrome',id:'tools/l:Snap'}});
 assert.equal(readStageRequest({v:1,kind:'host-command',req:3,command:'presentation',chrome:'pane'}),null);
 assert.equal(readFrameChrome({lens:'canvas',controls:[{id:'a',home:'nowhere',kind:'button',label:'A'}]}),null);
 assert.ok(FRAME_CHROME_HOMES.includes('canvas:relation')&&FRAME_CHROME_HOMES.includes('journey:takes'));
});

test('the stand-down is the frame\'s own stylesheet under its own body class: concealed, never removed; the minimap stays', async () => {
 const css=await source('../src/workspace.css');
 const rule=css.slice(css.indexOf('body.oi-chrome-devices #app>.masthead,'));
 const block=rule.slice(0,rule.indexOf('}')+1);
 for(const region of ['#app>.masthead','#instrument-tools-dock','.canvas-zoom-controls','.research-minimap-toggle','#research-inspector','nav.instrument','#toolbelt-button','.journey-reading-home','.crossing-return','.react-flow__attribution'])
  assert.ok(block.includes(region),`${region} stands down`);
 assert.match(block,/\{visibility:hidden!important;pointer-events:none!important\}/,'concealed by visibility: every control stays laid out, readable and pressable');
 assert.doesNotMatch(block,/display:none/,'never removed');
 assert.doesNotMatch(block,/navigation-minimap/,'the canvas keeps its minimap (manual §17.3 Full: "the Canvas in the pane, with the minimap")');
 assert.match(css,/body\.oi-chrome-devices #app>\.masthead \.header-menu\{display:flex!important/,'the masthead\'s overflow menus stand laid out so they are read at any pane width');
});

test('the frame sets the class only from the shell\'s declaration, answers both commands, and announces the chrome with its state', async () => {
 const app=await source('../src/app.ts');
 const door=await source('../src/presentedChrome.ts');
 assert.match(door,/document\.body\.classList\.toggle\('oi-chrome-devices', presentation === 'devices'\)/);
 assert.match(door,/let presentation: FramePresentation = 'frame'/,'standalone and undeclared, the chrome stands');
 assert.equal((app.match(/oi-chrome-devices/g)??[]).length,0,'app.ts never sets the class itself');
 assert.match(app,/case 'presentation':[^]*presentedChrome\.setPresentation\(command\.chrome\)/);
 assert.match(app,/case 'chrome':[^]*presentedChrome\.press\(command\.id,command\.value\)/);
 assert.match(app,/\.\.\.chromeState\(\)\};/,'the announcement carries the presentation and the chrome reading');
 assert.match(app,/presentedChrome=installPresentedChrome\(\{lens:\(\)=>hostMode==='techne'\?lensStudio\.active\(\):hostMode,changed:\(\)=>announceHostState\(\),regions:\(\)=>frameChromeRegions\(\{canvasHome\}\)\}\);/);
 // A press is the frame's own control pressed: a click, a choice set as typing sets it, a value committed as leaving the field commits it.
 assert.match(door,/element\.click\(\)/);
 assert.match(door,/new Event\('change', \{bubbles: true\}\)/);
 assert.match(door,/new FocusEvent\('focusout', \{bubbles: true\}\)/);
});

// Lane BE: the editors the frame summons over its field (Acts, the Nara instrument, Find on Canvas, the Library) are given device homes in
// the shell while it presents the frame on its devices; standalone and at full size the frame opens them as it always has.
test('the summoned editors stand as homes of their own, and the Library\'s summon is a count the shell answers once', () => {
 for(const home of ['acts','nara:instrument','canvas:find'])assert.ok(FRAME_CHROME_HOMES.includes(home),`${home} is a home of the chrome`);
 const control={id:'acts/l:Roles',home:'acts',kind:'button',label:'Roles'};
 assert.deepEqual(readFrameChrome({lens:'expressions',controls:[control],summons:{library:2}}),{lens:'expressions',controls:[control],summons:{library:2}});
 assert.deepEqual(readFrameChrome({lens:'expressions',controls:[]}),{lens:'expressions',controls:[]},'no summon yet: none is read');
 assert.equal(readFrameChrome({lens:'expressions',controls:[],summons:{library:-1}}),null,'a count is never negative');
 assert.equal(readFrameChrome({lens:'expressions',controls:[],summons:{library:1.5}}),null,'nor a fraction');
 assert.equal(readFrameChrome({lens:'expressions',controls:[],summons:{acts:1}}),null,'only the Library is handed over by count');
 assert.equal(readFrameChrome({lens:'expressions',controls:[],summons:[]}),null);
});

test('presented on the devices the editors stand down over the field, are read as chrome, and the Library is handed to the shell', async () => {
 const css=await source('../src/workspace.css');
 const rule=css.slice(css.indexOf('body.oi-chrome-devices #app>.masthead,'));
 const block=rule.slice(0,rule.indexOf('}')+1);
 for(const editor of ['#act-panel','#nara-instrument','.canvas-find-overlay'])assert.ok(block.includes(editor),`${editor} stands down: concealed, never removed`);
 assert.match(css,/body\.oi-chrome-devices \.canvas-find-overlay::backdrop\{display:none\}/,'a Find never dims the field');
 const door=await source('../src/presentedChrome.ts');
 for(const [region,home] of [['#act-panel','acts'],['#nara-instrument','nara:instrument'],['.canvas-find-overlay','canvas:find']]){
  assert.ok(door.includes(`root: one('${region}'), home: () => '${home}'`),`${region} is read under ${home}`);
  assert.ok(door.match(/const CHROME_ROOTS = '([^']*)'/)[1].split(',').includes(region),`a change inside ${region} is announced`);
 }
 assert.match(door,/summon\(kind\) \{\n\s*if \(presentation !== 'devices'\) return false/,'only on the devices: in its own presentation the frame opens the editor itself');
 const app=await source('../src/app.ts');
 assert.match(app,/function openLibrary\([^)]*\)\{[^\n]*if\(section==='collection'&&presentedChrome\?\.summon\('library'\)\)return;/,'the Library is handed over before anything of the field changes');
 const nara=await source('../src/naraInstrument.tsx');
 assert.match(nara,/if\(app&&!document\.body\.classList\.contains\('oi-chrome-devices'\)\)app\.inert=true;/,'on the devices the field stays live under the Nara instrument');
 const find=await source('../src/canvasFindOverlay.tsx');
 assert.match(find,/if\(document\.body\.classList\.contains\('oi-chrome-devices'\)\)dialog\.current\?\.show\(\);else dialog\.current\?\.showModal\(\);/,'on the devices Find is not modal over the canvas');
});

// O-I #747 (manual §20.1 Pane view: "No panel, list or tool opens inside it. A control you reach from the field opens where it lives").
test('#747: presented on the devices, the Studio\'s key, E and the toast go to the shell; in its own presentation the frame keeps them', async () => {
 const {studioHomeRequest,sayRequest}=await import('../build/presentedChrome.js');
 assert.deepEqual(studioHomeRequest('devices','physics'),{request:'open-home',section:'physics'});
 assert.equal(studioHomeRequest('frame','physics'),null,'at full size the frame opens its own Studio as it always has');
 assert.deepEqual(sayRequest('devices','Saved.'),{request:'say',text:'Saved.'});
 assert.equal(sayRequest('frame','Saved.'),null);
 assert.equal(sayRequest('devices','  '),null,'nothing to say, nothing sent');
 const app=await source('../src/app.ts');
 assert.match(app,/case 'studio':\{[^}]*studioHomeRequest\(presentedChrome\.presentation\(\),studioSection\)[^}]*hostRequest\(home\);break;\}/,'the Studio key asks the shell');
 assert.match(app,/case 'edit':\{[^}]*studioHomeRequest\(presentedChrome\.presentation\(\),selectedEntity\(\)\?'formations':'physics'\)/,'E: the symbol in Clip view, the field in the Studio');
 assert.match(app,/function toast\([^)]*\)\{[^]*?sayRequest\(presentedChrome\.presentation\(\),message\)[^]*?hostRequest\(said\)/,'the toast is said on the status bar');
 const css=await source('../src/workspace.css');
 assert.match(css,/body\.oi-chrome-devices #toast\{visibility:hidden!important;pointer-events:none!important\}/,'nothing is laid over the field');
});

// O-I #747, walk 739 X1: "A retained native field is attached; release it before replacing the authored expression scene."
test('#747 X1: opening another Expression binds the live field again on its scene before the scene is configured, and names the act', async () => {
 const app=await source('../src/app.ts');
 // Every open of another Expression goes through applyJourney (a work from the owner, a starter, a featured work, New).
 const body=app.slice(app.indexOf('function applyJourney('),app.indexOf('function applyJourney(')+1500);
 const rebind=body.indexOf('nativeField?.rebind('),apply=body.indexOf('store.document=clone(');
 assert.ok(rebind>0&&rebind<apply,'the field is bound again before the new scene replaces the old');
 assert.match(body,/if\(j\.id!==store\.document\.id\)\{const said=nativeField\?\.rebind\(/,'only when another Expression opens');
 assert.match(body,/rebind\(`Opening “\$\{j\.name\}”`\);if\(said\)toast\(said/,'the act is named, and said');
 const field=await source('../src/nativeField.ts');
 const own=field.slice(field.indexOf('const rebind='),field.indexOf('const authoredMoved='));
 assert.match(own,/const held=status==='following'\|\|status==='held'\|\|status==='opening';\s*if\(!held&&!reopening\)return null;/,'no live field held and none waiting: nothing happens');
 assert.match(own,/if\(held\)released=controller\.release\(true\)\.catch\(fail\);/,'released; it opens again on the new scene once still (round two)');
 assert.match(field,/return \{controller,panel,command,stage,playJanko,touch,openLive,leaveLive,rebind,authoredMoved,/);
});

// O-I #747 round two (lead's ruling of 29 Oct): a live field held on the scene is let go and opened again around each of the person's
// authored acts — a scene switched, a view kept, a control changed — never released on leaving Live (Live may still be playing).
test('#747: the lease says, before the engine is configured, whether a frame would replace the authored scene it holds', async () => {
 const {withRetainedField}=await import('../../../../../packages/oi-design-system/expressions-engine/oi/retained-capability.mjs');
 class Base{constructor(){this.capabilities={notes:[]};this.configured=0;}configuration(){this.configured++;return 'configured';}}
 const Adapter=withRetainedField(Base,400);
 const adapter=new Adapter({addEventListener(){}});
 const frame=(scene,revision)=>({scene:{id:scene,name:scene},authoringRevision:revision});
 assert.equal(adapter.authoredIdentity(frame('s1',10)),'s1:10');
 assert.equal(adapter.retainedRefuses(frame('s1',10)),false,'no lease: nothing is refused');
 assert.equal(adapter.retainedAuthored(),null);
 adapter.retained={lockedAuthored:'s1:10'};
 assert.equal(adapter.retainedRefuses(frame('s1',10)),false,'the scene the lease holds');
 assert.equal(adapter.retainedRefuses(frame('s1',20)),true,'an authored change: a view kept, a control changed');
 assert.equal(adapter.retainedRefuses(frame('s2',10)),true,'a scene switched');
 assert.throws(()=>adapter.configuration(frame('s2',10)),/A retained native field is attached/,'the guard itself still refuses, as before');
 assert.equal(adapter.configuration(frame('s1',10)),'configured');
});

test('#747: each authored change meets the live field before the engine does, is named, and the field opens again once the scene is still', async () => {
 const app=await source('../src/app.ts');
 assert.match(app,/try\{const frame=frameData\(delta\);rebindAroundAct\(frame\);engine\.render\(frame\);/,'every frame the engine renders is asked first');
 const helper=app.slice(app.indexOf('function rebindAroundAct('),app.indexOf('function tick('));
 assert.match(helper,/if\(!adapter\.retainedRefuses\(frame\)\)\{nativeField\.authoredMoved\(adapter\.authoredIdentity\?\.\(frame\)\?\?null\);return;\}/,'a still scene lets a waiting reopen run');
 assert.match(helper,/heldScene!==frame\.scene\.id\?`Going to scene “\$\{frame\.scene\.name\}”`:store\.undoLabel\(\)\?\?'Your change'/,'the act is named: the scene gone to, or the edit\'s own label');
 assert.match(helper,/const said=nativeField\.rebind\(act\);if\(said\)toast\(said,6500\);/);
 const field=await source('../src/nativeField.ts');
 const own=field.slice(field.indexOf('const rebind='),field.indexOf('const authoredMoved='));
 assert.match(own,/if\(held\)released=controller\.release\(true\)\.catch\(fail\);/,'let go now, before the change is configured');
 assert.match(own,/const first=!reopening;\s*reopenWhenStill\(\);\s*return first\?words:null;/,'said once per settling');
 assert.match(field,/reopening=window\.setTimeout\(\(\)=>\{if\(busy\|\|composing\)\{reopenWhenStill\(\);return;\}reopening=0;void released\.catch\(\(\)=>\{\}\)\.then\(\(\)=>open\('now'\)\);\},REBIND_SETTLE_MS\);/,'opened again once still; a busy open is waited out, never dropped');
 assert.match(field,/const leaveLive=\(\)=>liveEntry\.leave\(\);/,'leaving Live never releases the field');
 assert.match(app,/function applyJourney\([^)]*\)\{journeyNavigation\+\+;[^]*?if\(j\.id!==store\.document\.id\)\{const said=nativeField\?\.rebind\(`Opening “\$\{j\.name\}”`\)/,'opening another Expression, named as before');
});

// O-I #747 round two, walk 739 X4: after a relaunch, a line says what live motion could not be brought back.
test('#747 X4: a work reopened where it stood says what of its live motion could not come back', async () => {
 const app=await source('../src/app.ts');
 const settle=app.slice(app.indexOf('function settleDeepLink('),app.indexOf('function applyDeepLinkAddress('));
 assert.match(settle,/if\(applied&&carried\)notes\.push\(reopenedMotionLine\(\)\);\s*if\(notes\.length\)toast\(notes\.join\(' '\),8000\);/);
 assert.match(app,/function reopenedMotionLine\(\)\{return 'Reopened where it stood\. Its live motion could not be brought back: the particles start again from the scene\\'s configuration/);
});

// O-I #747 round two: View's Kept is the scene's own kept state (manual §20.1 The Clip panel), which Keep writes with the framing.
test('#747: Keep writes the scene\'s kept state with its framing, and the model refuses a kept state that is neither', async () => {
 const app=await source('../src/app.ts');
 assert.match(app,/case 'keep-view':changed\(\(\)=>\{scene\(\)\.view=\{\.\.\.scene\(\)\.view,kept:true,mode:camera\.mode,/);
 const {validateJourney,blankJourney}=await import('../build/model.js');
 const journey=blankJourney();journey.scenes[0].view={...journey.scenes[0].view,kept:true};
 assert.equal(validateJourney(journey).scenes[0].view.kept,true);
 const wrong=blankJourney();wrong.scenes[0].view={...wrong.scenes[0].view,kept:'yes'};
 assert.throws(()=>validateJourney(wrong),/Invalid kept view/);
});

// O-I #747 round three (walk, 29 Oct): after the frame's own Scene › (‹ ›, the strip, an arrow key, a kept address), every Clip view scene
// edit was refused: "The captured native Scene, selection, authored revision, lifetime or intent changed before its edit". The native
// owner holds the selection (sceneEdits.ts checks native_selection.scene_ref against the basis); the frame switched only its own view.
// The person's switch now asks the owner to select the scene, as saved playback does (advanceSavedScene) — only when the owner's
// selection differs, so a switch the owner asked for (the retained editor's focus) is not selected twice.
test('#747: the person\'s own scene switch takes the native selection with it, at the owner', async () => {
 const app=await source('../src/app.ts');
 const body=app.slice(app.indexOf('function setSceneRef('),app.indexOf('/** Saved playback uses the existing frame playhead'));
 assert.match(body,/sceneIndex=index;[^]*if\(!automatic\)followNativeScene\(sceneId\);/,'a switch that is not automatic follows at the owner');
 const follow=app.slice(app.indexOf('function followNativeScene('),app.indexOf('function followNativeScene(')+700);
 assert.match(follow,/const view=nativeWorkspace\?\.nativeView\(\),ref=view\?\.bindings\[sceneId\]\?\.scene_ref;/);
 assert.match(follow,/if\(!view\|\|!ref\|\|view\.document\.selection\?\.scene_ref===ref\)return;/,'only when the owner\'s selection differs');
 assert.match(follow,/nativeWorkspace!\.select\(sceneId,null\)/,'the owner\'s own select, as saved playback asks it');
});
