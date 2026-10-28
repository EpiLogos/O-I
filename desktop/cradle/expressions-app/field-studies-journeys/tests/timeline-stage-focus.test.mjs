// lane-2 T24 — focus mode and fullscreen for the Timeline's stage. The stage reuses the lane-3 E23 focus model and
// fullscreen request (focusMode.ts): no second implementation. Proven here: the generic session restores exactly
// what focus began from; a refused or thrown fullscreen request never ends focus; the release is idempotent;
// the Timeline's block wires F, Escape, the fullscreen exit and the hidden chrome, and its title documents the keys.
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-stage-focus-'));
 try{
  const out=join(temporary,'stage-focus-adapters.mjs');
  await build({
   stdin:{contents:"export * from './src/focusMode.ts';",resolveDir:engine},
   tsconfig:engine+'/tsconfig.json',
   bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
  });
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const copy=layout=>({...layout});

test('a stage focus restores exactly the chrome it began from, and beginning while focused keeps the first snapshot',()=>{
 const start={toolsDisplay:''};
 let session=api.beginStageFocus({prior:null},start,copy);
 assert.equal(api.isStageFocused(session),true);
 // The chrome is hidden by the stage; a second begin while focused does not replace the snapshot.
 const again=api.beginStageFocus(session,{toolsDisplay:'none'},copy);
 assert.equal(again,session);
 const ended=api.endStageFocus(session,copy);
 assert.deepEqual(ended.restore,{toolsDisplay:''});
 assert.equal(api.isStageFocused(ended.session),false);
 assert.notEqual(ended.restore,start,'the restore is a copy, not the live record');
});

test('ending a stage focus that never began restores nothing and leaves the stage unfocused',()=>{
 const ended=api.endStageFocus({prior:null},copy);
 assert.equal(ended.restore,null);
 assert.equal(api.isStageFocused(ended.session),false);
});

test('the lane-3 focus model is unchanged by the stage session: beginFocus and endFocus keep their behaviour',()=>{
 const layout={sequenceOpen:true,beltOpen:false,timelineOpen:true,inspectorOpen:false,editing:true,contextKind:'',beltPickerOpen:false,shapePickerOpen:false,modesOpen:false,captureOpen:false,tool:'select',cursorTool:'select',selected:['a']};
 const session=api.beginFocus(api.NOT_FOCUSED,layout);
 assert.equal(api.isFocused(session),true);
 assert.deepEqual(api.endFocus(session).restore,layout);
});

test('a fullscreen grant resolves true; a refusal or a thrown request resolves false, and focus is never ended by the request',async()=>{
 const granted={requestFullscreen(){return Promise.resolve();}};
 const refused={requestFullscreen(){return Promise.reject(new TypeError('no user gesture'));}};
 const thrown={requestFullscreen(){throw new TypeError('unsupported');}};
 const absent={};
 assert.equal(await api.requestStageFullscreenOn(granted,{navigationUI:'hide'}),true);
 assert.equal(await api.requestStageFullscreenOn(refused,{navigationUI:'hide'}),false);
 assert.equal(await api.requestStageFullscreenOn(thrown,{navigationUI:'hide'}),false);
 assert.equal(await api.requestStageFullscreenOn(absent,{navigationUI:'hide'}),false);
});

test('the request passes the hide-navigation option through to the browser',async()=>{
 let received=null;
 const element={requestFullscreen(options){received=options;return Promise.resolve();}};
 await api.requestStageFullscreenOn(element,{navigationUI:'hide'});
 assert.deepEqual(received,{navigationUI:'hide'});
});

test('releasing the stage fullscreen exits only a fullscreen the document holds, and is idempotent',()=>{
 const previous=globalThis.document;
 let exits=0;
 globalThis.document={fullscreenElement:null,exitFullscreen(){exits+=1;return Promise.resolve();}};
 try{
  api.releaseStageFullscreen();
  assert.equal(exits,0,'nothing is exited when nothing is fullscreen');
  globalThis.document.fullscreenElement={};
  api.releaseStageFullscreen();
  api.releaseStageFullscreen();
  assert.equal(exits,2,'each release asks the browser once; the browser settles the state');
 } finally {
  globalThis.document=previous;
 }
});

// The Timeline's block: the wiring lives in researchInstruments.tsx's chronology region and reads the shared model.
const instruments=await readFile(resolve(engine,'src/researchInstruments.tsx'),'utf8');
const styles=await readFile(resolve(engine,'src/styles.css'),'utf8');
const focusModeSrc=await readFile(resolve(engine,'src/focusMode.ts'),'utf8');

test('the Timeline\'s stage holds its focus at install scope on the shared controller, and keeps one key listener there',()=>{
 assert.match(instruments,/import \{createStageFocus,releaseStageFullscreen,requestStageFullscreenOn\} from '\.\/focusMode';/);
 assert.match(instruments,/const stageFocus=createStageFocus\(\{stage:body,chrome:host\.tools,markKey:'timelineFocus'\}\);/,'one stage focus per install, on the shared controller (focusMode.ts)');
 assert.match(instruments,/let timelineFocusOff:\(\(\)=>void\)\|null=null;/,'one stage key listener per install');
 assert.doesNotMatch(instruments,/timelineFocus\?:StageFocusSession/,'the session is no longer a field of the view state');
 assert.doesNotMatch(instruments,/timelineFullscreen|onStageFullscreen/,'the stage keeps no fullscreen flag or listener of its own: its hold ends it');
});
test('the stage focus ends at install scope: unmount ends it, every load (a lens change) unmounts first, and destroy releases its listener',()=>{
 const install=instruments.indexOf('export function installResearchInstruments(');
 const declared=instruments.indexOf('const endTimelineFocus=');
 const load=instruments.indexOf('async function load(selected:ResearchInstrument)');
 assert.ok(install>=0&&declared>install&&declared<load,'endTimelineFocus is declared in the install scope, before load');
 const unmountLine=instruments.split('\n').find(line=>/function unmount\(\)/.test(line))??'';
 assert.match(unmountLine,/endTimelineFocus\(\);/,'unmount() ends the stage focus, so the shared tools come back');
 assert.match(unmountLine,/timelineFocusOff\?\.\(\);timelineFocusOff=null;/,'unmount() releases the stage key listener; the Timeline\'s load re-attaches it');
 // T-PLACES-ONTO-ATLAS: the Places layers flush that came first retired with the frame's Places map; a lens change still unmounts first
 assert.match(instruments,/async function load\(selected:ResearchInstrument\)\{\s*const generation=\+\+epoch;unmount\(\);/,'a lens change unmounts before it reads');
 assert.match(instruments,/destroy\(\)\{[^\n]*unmount\(\);/,'destroy unmounts, so the stage focus and its listener are released');
 assert.doesNotMatch(instruments,/state\.timelineFocusOff/,'the listener is held once, at install scope');
});

test('F toggles focus; Escape restores while focused',()=>{
 assert.match(instruments,/if\(event\.key==='f'\|\|event\.key==='F'\)\{event\.preventDefault\(\);if\(focusOn\(\)\)endTimelineFocus\(\);else beginTimelineFocus\(\);\}/);
 assert.match(instruments,/if\(event\.key==='Escape'&&focusOn\(\)\)\{event\.preventDefault\(\);event\.stopImmediatePropagation\(\);endTimelineFocus\(\);return;\}/);
 assert.match(instruments,/window\.addEventListener\('keydown',onStageKey,true\);/,'Escape is taken in the capture phase, before the lens clears its selection');
});
test('the install routes begin and end through the stage controller; the tools, the mark and the fullscreen are its own (see focus-mode.test)',()=>{
 assert.match(instruments,/const focusOn=\(\)=>stageFocus\.isFocused\(\);/);
 assert.match(instruments,/const endTimelineFocus=\(\)=>stageFocus\.end\(\);/);
 assert.match(instruments,/const beginTimelineFocus=\(\)=>stageFocus\.begin\(\);/);
 assert.match(focusModeSrc,/export function createStageFocus\(dom: StageFocusDom\): StageFocus \{/);
 assert.match(focusModeSrc,/const hold: FullscreenHold = \{lost: \(\) => end\(\)\};/,'the stage focus ends through its hold: a browser exit or a takeover');
 assert.match(focusModeSrc,/releaseStageFullscreen\(hold\);/,'the stage focus releases its own hold');
});
test('the browser exit from fullscreen reaches the stage focus through its hold; no fullscreen listener is left in the instrument',()=>{
 assert.doesNotMatch(instruments,/fullscreenchange/,'the instrument listens to no fullscreen change of its own');
 assert.match(focusModeSrc,/document\.addEventListener\('fullscreenchange', onFullscreenChange\);/);
});
test('the Focus control and its title document the keyboard map',()=>{
 assert.match(instruments,/aria-label="Focus the timeline stage" title="Focus the stage: F toggles, Escape restores\./);
 assert.match(instruments,/onClick=\{beginTimelineFocus\}>Focus<\/button>/);
});

test('the focus rules hide every chrome panel but leave the axis and the cards, and use tokens only',()=>{
 const block=styles.slice(styles.indexOf('/* lane-2 T24'));
 const rules=block.split('\n').filter(line=>/^\.(research-instrument-body|research-timeline-focus)/.test(line));
 assert.ok(rules.length>=3,'the focus rules are in the tail');
 const hides=rules.find(line=>/display:none!important/.test(line));
 assert.ok(hides,'a rule hides the chrome');
 for(const panel of ['.timeline-toolbar','.timeline-minimap','.timeline-diagnostics','.timeline-walk','.timeline-working-set','.timeline-standing-legend'])assert.ok(hides.includes(panel),`${panel} is chrome`);
 for(const keep of ['.timeline-axis','.timeline-scene','.timeline-clusters','.timeline-nodes'])assert.ok(!hides.includes(keep),`${keep} stays: the axis and the cards`);
 assert.doesNotMatch(rules.join('\n'),/#[0-9a-fA-F]{3,8}\b|rgba?\(/,'tokens only, no raw colours');
});

test('no instrument makes a direct fullscreen request: the Timeline stage and the Canvas present both go through the shared path',()=>{
 assert.equal((instruments.match(/\.requestFullscreen\(/g)??[]).length,0,'every fullscreen request is the shared path');
 assert.equal((instruments.match(/requestStageFullscreenOn\(/g)??[]).length,1,'the Canvas present requests through requestStageFullscreenOn');
 assert.equal((instruments.match(/createStageFocus\(/g)??[]).length,1,'the Timeline stage requests through its controller');
});
test('the Canvas present (A8) holds its fullscreen through the shared hold, and ends through the same release; no second fullscreenchange listener',()=>{
 assert.match(instruments,/const hold:FullscreenHold=\{lost:\(\)=>\{if\(presentation\?\.hold===hold\)endPresentation\(\);\}\};/,'a presentation ends through its hold when the browser leaves or the reader takes over');
 assert.match(instruments,/void Promise\.resolve\(\)\.then\(\(\)=>presentation===started\?requestStageFullscreenOn\(element,\{\},hold\):false\)/,'the present requests through the shared path, and not at all once it has ended');
 assert.match(instruments,/window\.removeEventListener\('keydown',onPresentKeydown,true\);\s*releaseStageFullscreen\(current\.hold\);/,'the presentation releases its own hold');
 assert.doesNotMatch(instruments,/onFullscreenChange/,'the Canvas present keeps no listener of its own');
 assert.doesNotMatch(instruments,/started\.fullscreen|fullscreen:false/,'the presentation keeps no fullscreen flag of its own');
});
