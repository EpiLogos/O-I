// lane-2 T24 — focus mode and fullscreen for the M2′ stage. The stage reuses the lane-3 E23 focus model and
// fullscreen request (focusMode.ts): no second implementation. Proven here: the generic session restores exactly
// what focus began from; a refused or thrown fullscreen request never ends focus; the release is idempotent;
// the M2′ block wires F, Escape, the fullscreen exit and the hidden chrome, and its title documents the keys.
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

// The M2′ block: the wiring lives in researchInstruments.tsx's chronology region and reads the shared model.
const instruments=await readFile(resolve(engine,'src/researchInstruments.tsx'),'utf8');
const styles=await readFile(resolve(engine,'src/styles.css'),'utf8');

test('the M2′ stage imports the shared focus model and the one fullscreen request, and holds its session on the view state',()=>{
 assert.match(instruments,/import \{beginStageFocus,endStageFocus,isStageFocused,NOT_STAGE_FOCUS,releaseStageFullscreen,requestStageFullscreenOn,type StageFocusSession\} from '\.\/focusMode';/);
 assert.match(instruments,/timelineFocus\?:StageFocusSession<\{toolsDisplay:string\}>;timelineFullscreen\?:boolean;timelineFocusOff\?:\(\)=>void;/);
 assert.match(instruments,/void requestStageFullscreenOn\(body,\{navigationUI:'hide'\}\)\.then\(granted=>\{/,'the stage asks for real fullscreen on its own body');
});

test('F toggles focus; Escape restores while focused; a late grant after the focus ended is released, never held',()=>{
 assert.match(instruments,/if\(event\.key==='f'\|\|event\.key==='F'\)\{event\.preventDefault\(\);if\(focusOn\(\)\)endTimelineFocus\(\);else beginTimelineFocus\(\);\}/);
 assert.match(instruments,/if\(event\.key==='Escape'&&focusOn\(\)\)\{event\.preventDefault\(\);event\.stopImmediatePropagation\(\);endTimelineFocus\(\);return;\}/);
 assert.match(instruments,/if\(state\.timelineFocus!==started\)\{if\(granted\)releaseStageFullscreen\(\);return;\}/);
 assert.match(instruments,/window\.addEventListener\('keydown',onStageKey,true\);/,'Escape is taken in the capture phase, before the lens clears its selection');
});

test('focus hides the shared tools, marks the stage, and the exit restores the tools display it began from',()=>{
 assert.match(instruments,/const started=beginStageFocus\(state\.timelineFocus\?\?NOT_STAGE_FOCUS,\{toolsDisplay:host\.tools\.style\.display\},chrome=>\(\{\.\.\.chrome\}\)\);/);
 assert.match(instruments,/host\.tools\.style\.display='none';\s*body\.dataset\.timelineFocus='true';/);
 assert.match(instruments,/if\(ended\.restore\)host\.tools\.style\.display=ended\.restore\.toolsDisplay;/);
 assert.match(instruments,/body\.removeAttribute\('data-timeline-focus'\);/);
 assert.match(instruments,/releaseStageFullscreen\(\);\s*\};/,'the exit releases the fullscreen it asked for');
});

test('the browser exit from fullscreen ends a granted focus; a refused focus is ended only by its own keys',()=>{
 assert.match(instruments,/const onStageFullscreen=\(\)=>\{if\(state\.timelineFullscreen&&!document\.fullscreenElement\)endTimelineFocus\(\);\};/);
 assert.match(instruments,/document\.addEventListener\('fullscreenchange',onStageFullscreen\);/);
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

test('the stage adds no fullscreen request of its own: the only direct request left in the instrument is the A8 Canvas present',()=>{
 const requests=instruments.match(/\.requestFullscreen\(/g)??[];
 assert.equal(requests.length,1,'the Timeline stage requests fullscreen through requestStageFullscreenOn; the Canvas present (A8) is the one other direct request');
});
