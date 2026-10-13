// T11 — standing-aware relation edges on the chronology. Each edge's class is the authority's
// standingOf over its own properties (never a second mapping); each drawn edge carries a
// direction arrow; the standing legend is the authority's STANDING_LEGEND and renders
// whenever edges are shown; a tooltip carries the verbatim standing. The cause-chain
// highlight (T10) is checked here on the same layer. Rendering is a server render of the
// real component; the on-screen look is the lead's native pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

// The authority and the chronology components under test: imported, never copied.
const compiled=await build({stdin:{contents:[
 "export * as projection from '../../vendor/research-canvas/packages/canvas/src/timeline/projection.ts';",
 "export * as standingStyle from '../../vendor/research-canvas/packages/canvas/src/timeline/standingStyle.ts';",
 "export * as causeChain from '../../vendor/research-canvas/packages/canvas/src/timeline/causeChain.ts';",
 "export {TimelineRelationshipLayer,StandingLegend,CauseChainPanel,relationshipStanding} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineRelationshipLayer.tsx';",
 "export {createElement} from 'react';",
 "export {renderToStaticMarkup} from 'react-dom/server';",
 "export * as authority from '../../../src/techne/m0m5/timeline/standing.ts';",
].join('\n'),resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},
 tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),
 nodePaths:[fileURLToPath(new URL('../../../node_modules',import.meta.url))],
 // react-dom/server is CommonJS and requires Node built-ins; give the ESM bundle a require.
 banner:{js:`import {createRequire as __createRequire} from 'node:module';globalThis.require=__createRequire(${JSON.stringify(fileURLToPath(import.meta.url))});`},
 bundle:true,platform:'node',format:'esm',jsx:'automatic',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {projection,standingStyle,causeChain,TimelineRelationshipLayer,StandingLegend,CauseChainPanel,relationshipStanding,createElement,renderToStaticMarkup,authority}=api;

const VIEW={centerYear:1850,pixelsPerYear:400,widthPx:1200};
const fact=(id,validFrom='1850')=>({
 node:{graphNodeId:id,title:id,summary:'',isTemporal:true,entityType:'Event',validFrom,validTo:null,evidenceTags:[]},
 anchor:{validFrom,validTo:null,precision:'year'},
 layoutOverride:null,
});
const placed=projection.placeItems(projection.projectNodes([fact('a'),fact('b','1851'),fact('c','1852')]),VIEW);

// One edge per standing class, plus one undisclosed edge. Each is the owner's own disclosed fields.
const EDGES=[
 {id:'e-sourced',relType:'CAUSES',sourceGraphNodeId:'a',targetGraphNodeId:'b',properties:{standing:'confirmed in the chronicle',source_ref:'src:chronicle-1'}},
 {id:'e-authored',relType:'SUPPORTS',sourceGraphNodeId:'b',targetGraphNodeId:'c',properties:{standing:'the editor asserts this'}},
 {id:'e-disputed',relType:'CONTESTS',sourceGraphNodeId:'a',targetGraphNodeId:'c',properties:{standing:'disputed by a later editor',source_ref:'src:letter-4'}},
 {id:'e-mythic',relType:'CAUSES',sourceGraphNodeId:'a',targetGraphNodeId:'b',properties:{standing:'mythic, from the founding legend'}},
 {id:'e-derived',relType:'CAUSES',sourceGraphNodeId:'b',targetGraphNodeId:'c',properties:{standing:'an inferred link',derivation_ref:'deriv:1'}},
 {id:'e-plain',relType:'SUPPORTS',sourceGraphNodeId:'a',targetGraphNodeId:'b',properties:{}},
];

// The group of one edge in the markup: from its testid to the group's close (no nested groups).
function groupOf(markup,id){
 const start=markup.indexOf(`data-testid="timeline-relationship-${id}"`);
 assert.ok(start>=0,`${id} is drawn`);
 return markup.slice(start,markup.indexOf('</g>',start));
}

test('each edge\'s standing class is the authority\'s standingOf over its own properties',()=>{
 const markup=renderToStaticMarkup(createElement(TimelineRelationshipLayer,{relationships:EDGES,placed,viewportWidth:1200,lod:'detail'}));
 const classes=new Set();
 for(const edge of EDGES){
  const group=groupOf(markup,edge.id);
  const reading=authority.standingOf({standing:edge.properties.standing??null,source_ref:edge.properties.source_ref??null,derivation_ref:edge.properties.derivation_ref??null});
  // The layer's own selection agrees with the authority, as an exported pure function.
  assert.equal(relationshipStanding(edge.properties).visual,reading.visual,`${edge.id}: the layer's selection is standingOf`);
  if(edge.properties.standing===undefined){
   assert.doesNotMatch(group,/data-standing|timeline-relationship--/,`${edge.id}: undisclosed, no standing class`);
   continue;
  }
  assert.match(group,new RegExp(`data-standing="${reading.visual}"`),`${edge.id}: data-standing is standingOf output`);
  assert.match(group,new RegExp(`timeline-relationship--${reading.visual}`),`${edge.id}: class name`);
  classes.add(reading.visual);
 }
 assert.deepEqual([...classes].sort(),['authored','derived','disputed','mythic','sourced'],'five disclosed classes are drawn, each by its own selection');
});

test('every drawn edge carries a direction arrow in its relation colour or its standing colour',()=>{
 const markup=renderToStaticMarkup(createElement(TimelineRelationshipLayer,{relationships:EDGES,placed,viewportWidth:1200,lod:'detail'}));
 for(const edge of EDGES){
  const group=groupOf(markup,edge.id);
  assert.match(group,/class="timeline-relationship-arrow"/,`${edge.id}: arrowhead`);
 }
 const disputed=groupOf(markup,'e-disputed');
 assert.match(disputed,new RegExp(`fill="${standingStyle.STANDING_DRAWING.disputed.stroke}"`),'a disclosed edge\'s arrow takes its standing colour');
 const plain=groupOf(markup,'e-plain');
 assert.match(plain,/fill="#79c0d4"/,'an undisclosed SUPPORTS arrow keeps its relation colour');
});

test('the standing legend lists the authority\'s six classes with their verbatim labels, whenever edges are shown',()=>{
 const markup=renderToStaticMarkup(createElement(TimelineRelationshipLayer,{relationships:EDGES,placed,viewportWidth:1200,lod:'detail'}));
 assert.match(markup,/data-testid="timeline-standing-legend"/,'legend renders with edges');
 const items=[...markup.matchAll(/<li class="timeline-standing-legend-item[^"]*" title="([^"]*)"[^>]*>.*?<span>([^<]*)<\/span>/g)].map(m=>[m[2],m[1]]);
 assert.deepEqual(items.map(([label])=>label),authority.STANDING_LEGEND.map(entry=>entry.label),'the authority\'s labels, in its order');
 assert.equal(items.length,6,'six classes');
 // The legend component on its own is the same list the layer renders.
 const alone=renderToStaticMarkup(createElement(StandingLegend,{}));
 assert.equal(alone,markup.slice(markup.indexOf('<ul class="timeline-standing-legend"'),markup.indexOf('</ul>',markup.indexOf('<ul class="timeline-standing-legend"'))+'</ul>'.length),'one legend component, shared');
});

test('the legend is absent when no edge is shown, and the relation-type stroke is kept',()=>{
 assert.equal(renderToStaticMarkup(createElement(TimelineRelationshipLayer,{relationships:[],placed,viewportWidth:1200,lod:'detail'})),'','no edges: nothing, no legend');
 assert.equal(renderToStaticMarkup(createElement(TimelineRelationshipLayer,{relationships:EDGES,placed,viewportWidth:1200,lod:'marker'})),'','marker tier draws no edges and no legend');
 const markup=renderToStaticMarkup(createElement(TimelineRelationshipLayer,{relationships:EDGES,placed,viewportWidth:1200,lod:'detail'}));
 assert.match(groupOf(markup,'e-disputed'),/stroke="#e07a6f"/,'a CONTESTS edge keeps its relation palette stroke under a disputed standing');
 assert.match(groupOf(markup,'e-sourced'),/stroke="#79c0d4"/,'a CAUSES edge keeps the CAUSES palette under a sourced standing');
});

test('a disclosed edge\'s tooltip carries the verbatim standing and the standing label',()=>{
 const markup=renderToStaticMarkup(createElement(TimelineRelationshipLayer,{relationships:EDGES,placed,viewportWidth:1200,lod:'detail'}));
 assert.match(groupOf(markup,'e-disputed'),/<title>Disputed · &quot;disputed by a later editor&quot;<\/title>|<title>disputed · "disputed by a later editor"<\/title>/i,'the disputed title names the verbatim string');
 assert.match(groupOf(markup,'e-sourced'),/confirmed in the chronicle/,'the sourced title carries its own verbatim string');
});

test('a followed chain draws its hops in sequence at full strength and dims every other edge',()=>{
 const sources=[
  {id:'e-sourced',relation:'CAUSES',from_ref:'a',to_ref:'b',standing:{visual:'sourced',verbatim:'confirmed in the chronicle'},time:null,timeNote:null},
  {id:'e-derived',relation:'CAUSES',from_ref:'b',to_ref:'c',standing:{visual:'derived',verbatim:'an inferred link'},time:null,timeNote:null},
  {id:'e-contests',relation:'CONTESTS',from_ref:'a',to_ref:'c',standing:{visual:'disputed',verbatim:'disputed by a later editor'},time:null,timeNote:null},
 ];
 const chains=causeChain.causeChains(sources);
 // The authority's walk emits a one-hop chain for e-derived and the two-hop chain e-sourced → e-derived;
 // the followed chain is the longest one carrying the relation, so clicking either edge follows the two-hop chain.
 const followed=causeChain.chainContaining(chains,'e-sourced');
 assert.deepEqual(followed.hops.map(h=>h.id),['e-sourced','e-derived'],'the two CAUSES edges form the followed chain; CONTESTS joins none');
 assert.equal(causeChain.chainContaining(chains,'e-derived').hops.length,2,'a shared hop follows the longer chain');
 const markup=renderToStaticMarkup(createElement(TimelineRelationshipLayer,{relationships:EDGES,placed,viewportWidth:1200,lod:'detail',chain:followed,onSelectChain(){}}));
 assert.match(groupOf(markup,'e-sourced'),/data-chain-hop="1"/,'first hop');
 assert.match(groupOf(markup,'e-derived'),/data-chain-hop="2"/,'second hop, in sequence');
 assert.match(groupOf(markup,'e-sourced'),/opacity="0.95"/,'a hop draws at full strength');
 assert.match(groupOf(markup,'e-disputed'),/opacity="0.12"/,'a non-member is dimmed');
 assert.doesNotMatch(groupOf(markup,'e-disputed'),/data-chain-hop/,'a non-member is not numbered');
 // Only cause-family edges are selectable to follow a chain: CAUSES yes, CONTESTS (opposition) no.
 const hits=(markup.match(/class="timeline-relationship-hit"/g)??[]).length;
 assert.equal(hits,3,'the three CAUSES-family edges are selectable; the SUPPORTS and CONTESTS edges are not');
 assert.doesNotMatch(groupOf(markup,'e-disputed'),/timeline-relationship-hit/,'CONTESTS is not a cause edge');
});

test('the chain panel states each hop\'s time, "no date disclosed" for an undated hop, and disables Follow there',()=>{
 const items=new Map([projection.projectNodes([fact('facet:h1','1850')])[0]].map(item=>[item.graphNodeId,item]));
 const chains=causeChain.causeChains([
  causeChain.chronologyCauseSource({id:'r1',relType:'CAUSES',sourceGraphNodeId:'a',targetGraphNodeId:'b',properties:{temporal_facet_ref:'facet:h1'}},items),
  causeChain.chronologyCauseSource({id:'r2',relType:'CAUSES',sourceGraphNodeId:'b',targetGraphNodeId:'c',properties:{}},items),
 ]);
 const markup=renderToStaticMarkup(createElement(CauseChainPanel,{chain:chains[0],titleOf:ref=>ref,onFollow(){},onClear(){}}));
 assert.match(markup,/data-testid="timeline-cause-chain"/);
 assert.match(markup,/timeline-chain-hop-time[^>]*>1850</,'dated hop states its label');
 assert.match(markup,/no date disclosed/,'the undated hop carries its absence');
 const undatedHop=markup.slice(markup.indexOf('data-testid="timeline-chain-hop-2"'));
 assert.match(undatedHop,/<button type="button" disabled=""/,'Follow is disabled for an undated hop');
 const datedHop=markup.slice(markup.indexOf('data-testid="timeline-chain-hop-1"'),markup.indexOf('data-testid="timeline-chain-hop-2"'));
 assert.doesNotMatch(datedHop,/disabled=""/,'Follow is enabled for a dated hop');
});

test('the chain highlight adds no animation: the new scoped rules hold no transition or keyframes',()=>{
 const css=readFileSync(fileURLToPath(new URL('../src/researchInstrumentStyles.css',import.meta.url)),'utf8');
 // Comments may name what the block forbids; only the rules are checked.
 const tail=css.slice(css.indexOf('/* lane-2 T10-T11')).replace(/\/\*[\s\S]*?\*\//g,'');
 assert.ok(tail.length>200,'the lane-2 T10-T11 block exists');
 assert.doesNotMatch(tail,/animation|transition|@keyframes/,'lawful stillness: no pulsing, no transition');
});
