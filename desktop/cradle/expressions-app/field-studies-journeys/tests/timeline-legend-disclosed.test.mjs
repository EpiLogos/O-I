// lane-2 T23 seam — the standing legend draws only the standing classes the loaded reading discloses. The classes come from
// the same standing grammar that colours the edges (standingOfRelationshipProperties), in the authority's order; a legend
// never names a class the reading does not carry, and a caller that discloses nothing gets nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const engine=fileURLToPath(new URL('..',import.meta.url));
const compiled=await build({stdin:{contents:[
 "export {StandingLegend,disclosedStandings} from '../vendor/research-canvas/packages/canvas/src/timeline/TimelineRelationshipLayer.tsx';",
 "export {createElement} from 'react';",
 "export {renderToStaticMarkup} from 'react-dom/server';",
 "export * as authority from '../../src/techne/m0m5/timeline/standing.ts';",
].join('\n'),resolveDir:engine,loader:'ts'},
 tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),
 nodePaths:[fileURLToPath(new URL('../../../node_modules',import.meta.url))],
 banner:{js:`import {createRequire as __createRequire} from 'node:module';globalThis.require=__createRequire(${JSON.stringify(fileURLToPath(import.meta.url))});`},
 bundle:true,platform:'node',format:'esm',jsx:'automatic',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {StandingLegend,disclosedStandings,createElement,renderToStaticMarkup,authority}=api;

const rel=(id,properties)=>({id,relType:'CAUSES',sourceGraphNodeId:'a',targetGraphNodeId:'b',properties});
const labelsOf=markup=>[...markup.matchAll(/<span>([^<]*)<\/span>/g)].map(m=>m[1]);

test('a reading that discloses one sourced relation shows one standing class, and no other',()=>{
 const classes=disclosedStandings([rel('r1',{standing:'confirmed in the chronicle',source_ref:'src:chronicle-1'})]);
 assert.deepEqual(classes,['sourced']);
 const markup=renderToStaticMarkup(createElement(StandingLegend,{visuals:classes}));
 assert.deepEqual(labelsOf(markup),['sourced'],'the legend names only the disclosed class');
});

test('disclosed classes keep the authority\'s order and drop the classes the reading does not carry',()=>{
 const classes=disclosedStandings([
  rel('r1',{standing:'disputed by a later editor',source_ref:'src:letter-4'}),
  rel('r2',{standing:'mythic, from the founding legend'}),
  rel('r3',{standing:'confirmed in the chronicle',source_ref:'src:chronicle-1'}),
 ]);
 const order=authority.STANDING_LEGEND.map(entry=>entry.visual).filter(visual=>['sourced','disputed','mythic'].includes(visual));
 assert.deepEqual(classes,order);
 assert.equal(classes.includes('authored'),false,'no class is invented');
 assert.equal(classes.includes('unavailable'),false,'no class is invented');
});

test('a caller that discloses no classes gets an empty legend; the whole list is never drawn by default for a reading',()=>{
 assert.deepEqual(disclosedStandings([]),[]);
 assert.equal(renderToStaticMarkup(createElement(StandingLegend,{visuals:[]})),'<ul class="timeline-standing-legend" aria-label="Relation standing" data-testid="timeline-standing-legend"></ul>');
});

test('the chronology layer and the Relations cause walk both pass what the reading discloses, never the full list',async()=>{
 const layer=await readFile(resolve(engine,'../vendor/research-canvas/packages/canvas/src/timeline/TimelineRelationshipLayer.tsx'),'utf8');
 assert.match(layer,/<StandingLegend visuals=\{disclosedStandings\(relationships\)\} \/>/);
 const view=await readFile(resolve(engine,'src/relationFieldView.tsx'),'utf8');
 assert.match(view,/<StandingLegend visuals=\{edges\.map\(edge=>edge\.standing_visual\)\}\/>/);
});
