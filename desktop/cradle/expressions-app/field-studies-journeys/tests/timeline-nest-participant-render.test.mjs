// lane-2 T9 + T14 — the rendered craft of the collapsed-parent spans and the participant hairlines.
// Server renders of the real components (not copies), so the markup the chronology mounts is what is checked.
// The on-screen look (the fade, the dash, the drag feel) is the lead's native pass; this pins the markup, the
// token-only colour rule and the mount's wiring. Checks the markup and token rules by source reading, not by eye.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';

const compiled=await build({stdin:{contents:[
 "export {TimelineNestSpans} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineNesting.tsx';",
 "export {TimelineParticipantSpans} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineParticipants.tsx';",
 "export * as participantSpans from '../../vendor/research-canvas/packages/canvas/src/timeline/participantSpans.ts';",
 "export * as relations from '../../../src/techne/m0m5/timeline/relations.ts';",
 "export * as scale from '../../../src/techne/m0m5/timeline/scale.ts';",
 "export * as viewport from '../../vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';",
 "export {createElement} from 'react';",
 "export {renderToStaticMarkup} from 'react-dom/server';",
].join('\n'),resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},
 tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),
 nodePaths:[fileURLToPath(new URL('../../../node_modules',import.meta.url))],
 banner:{js:`import {createRequire as __createRequire} from 'node:module';globalThis.require=__createRequire(${JSON.stringify(fileURLToPath(import.meta.url))});`},
 bundle:true,platform:'node',format:'esm',jsx:'automatic',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {TimelineNestSpans,TimelineParticipantSpans,participantSpans,relations,scale,viewport,createElement,renderToStaticMarkup}=api;

const cssText=await readFile(fileURLToPath(new URL('../src/researchInstrumentStyles.css',import.meta.url)),'utf8');
const mountText=await readFile(fileURLToPath(new URL('../src/researchInstruments.tsx',import.meta.url)),'utf8');

// The rule's own declaration block, by its selector text. Fails loudly if the selector is absent.
function ruleBlock(selectorFragment){
 const start=cssText.indexOf(selectorFragment);
 assert.ok(start>=0,`stylesheet carries the rule ${selectorFragment}`);
 const open=cssText.indexOf('{',start);
 const close=cssText.indexOf('}',open);
 return cssText.slice(open+1,close);
}

test('a collapsed parent renders one quiet span labelled with its count, open at the end only when its end is open', ()=>{
 const html=renderToStaticMarkup(createElement(TimelineNestSpans,{marks:[
  {parent:'war',label:'War · 3 items',leftPx:120,widthPx:300,openEnd:false},
  {parent:'life',label:'Life · 2 items',leftPx:500,widthPx:200,openEnd:true},
 ]}));
 assert.match(html,/data-testid="timeline-nest-span-war"/);
 assert.match(html,/data-open-end="false"[^>]*data-testid="timeline-nest-span-war"|data-testid="timeline-nest-span-war"[^>]*data-open-end="false"/);
 assert.match(html,/War · 3 items/,'the label carries the child count');
 assert.match(html,/data-testid="timeline-nest-span-life"[^>]*data-open-end="true"|data-open-end="true"[^>]*data-testid="timeline-nest-span-life"/,'an open end is marked open');
 assert.equal(renderToStaticMarkup(createElement(TimelineNestSpans,{marks:[]})),'','no collapsed parent renders nothing');
});

test('a participant span renders its validity once: the label at its first span only, the uncertainty as data, no hard-edge class', ()=>{
 const reading={
  reading_ref:'reading:person',subject:{subject_ref:'person:ada',native_owner:'owner:test'},
  temporal:[{kind:'valid',facet_ref:'life:ada',interval:{from:'1874',to:'1951',from_precision:'year',to_precision:'year'},uncertainty:'death disputed by a later editor'}],
 };
 const camera=viewport.timeCamera({centerYear:1900,pixelsPerYear:5,widthPx:1000});
 const marks=participantSpans.participantMarks(relations.participantSpansFromReading(reading).spans,camera);
 const html=renderToStaticMarkup(createElement(TimelineParticipantSpans,{marks}));
 assert.match(html,/data-testid="timeline-participant-person:ada#0"/);
 assert.match(html,/data-uncertain="true"/,'the disputed span is marked uncertain');
 assert.match(html,/data-standing="disputed"/,'and carries the authority disputed class');
 assert.equal((html.match(/timeline-participant-label/g)??[]).length,1,'the label is written once');
 assert.match(html,/death disputed by a later editor/,'the verbatim uncertainty rides in the title');
});

test('an undated participant end renders open, and a certain span renders without uncertainty marks', ()=>{
 const camera=viewport.timeCamera({centerYear:1900,pixelsPerYear:5,widthPx:1000});
 const marks=participantSpans.participantMarks([
  {participant_ref:'person:ada',participant_kind:'subject',fromMs:scale.expandInstant('1874','year').fromMs,toMs:null,uncertainty:null,source_ref:null},
 ],camera);
 const html=renderToStaticMarkup(createElement(TimelineParticipantSpans,{marks}));
 assert.match(html,/data-open-end="true"/,'no end is invented: the span runs open');
 assert.match(html,/data-uncertain="false"/);
 assert.doesNotMatch(html,/data-standing=/);
});

test('the uncertain ends soften through the stylesheet with token colours only, and disputed spans also dash', ()=>{
 const soft=ruleBlock('.timeline-participant[data-uncertain="true"] .timeline-participant-line');
 assert.match(soft,/mask-image:\s*linear-gradient\(to right, transparent, var\(--ob-ink\) 16px/,'both ends fade to transparent');
 assert.doesNotMatch(soft,/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/,'no raw colour literal in the soft-end rule');
 const dashed=ruleBlock('.timeline-participant[data-standing="disputed"] .timeline-participant-line');
 assert.match(dashed,/mask-composite:\s*intersect/,'the dash intersects the soft ends');
 assert.match(dashed,/repeating-linear-gradient\(to right, var\(--ob-ink\)/,'the dash is a token colour');
 assert.doesNotMatch(dashed,/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/,'no raw colour literal in the dash rule');
});

test('the mount forwards containment with its dated flag, so an unloaded dated child holds its parent expanded (source reading)', ()=>{
 assert.match(mountText,/containmentPairs\(relationEdges\(nativeReading\)\)\.map\(pair=>\(\{\.\.\.pair,dated:datedNodes\.has\(pair\.child\)\}\)\)/,
  'the containment passed to the lens carries dated for each child the reading dates');
 assert.match(mountText,/data\.bundle\.nodes\.filter\(node=>node\.isTemporal\)/,'dated is read from the reading\'s own temporal nodes');
});
