// T3 — uncertainty presentation. A fact's standing class is the authority's standingOf
// over its own disclosed fields (no second mapping). Its uncertainty string rides the
// item verbatim and shows in the hover title. Rendering is checked by a server render of
// the real components; the on-screen craft is the lead's native pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

// The authority for standing and the canvas modules under test: imported, never copied.
const compiled=await build({stdin:{contents:[
 "export * as projection from '../../vendor/research-canvas/packages/canvas/src/timeline/projection.ts';",
 "export * as viewport from '../../vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';",
 "export * as standingStyle from '../../vendor/research-canvas/packages/canvas/src/timeline/standingStyle.ts';",
 "export {TimelineNode} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineNode.tsx';",
 "export {TimelineRelationshipLayer} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineRelationshipLayer.tsx';",
 "export {createElement} from 'react';",
 "export {renderToStaticMarkup} from 'react-dom/server';",
 "export * as authority from '../../../src/techne/m0m5/timeline/standing.ts';",
 "export {bundleFromTechneReadings} from '../../vendor/research-canvas/packages/desktop-api/src/techneBundle.ts';",
 "export {createTechneTransport} from '../../vendor/research-canvas/packages/desktop-api/src/techneTransport.ts';",
].join('\n'),resolveDir:fileURLToPath(new URL('../src/',import.meta.url)),loader:'ts'},
 tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),
 nodePaths:[fileURLToPath(new URL('../../../node_modules',import.meta.url))],
 // react-dom/server is CommonJS and requires Node built-ins; give the ESM bundle a require.
 banner:{js:`import {createRequire as __createRequire} from 'node:module';globalThis.require=__createRequire(${JSON.stringify(fileURLToPath(import.meta.url))});`},
 bundle:true,platform:'node',format:'esm',jsx:'automatic',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {projection,standingStyle,TimelineNode,TimelineRelationshipLayer,createElement,renderToStaticMarkup,authority,bundleFromTechneReadings,createTechneTransport}=api;

const VIEW={centerYear:1850,pixelsPerYear:400,widthPx:1200};
// A year-precision point fact: its band is one year wide at this camera, so it draws a band.
const fact=(id,qualification={},validFrom='1850')=>({
 node:{graphNodeId:id,title:id,summary:'',isTemporal:true,entityType:'Event',validFrom,validTo:null,evidenceTags:[]},
 anchor:{validFrom,validTo:null,precision:'year',...qualification},
 layoutOverride:null,
});

// One fixture of each class. `uncertainty` is the source's verbatim text; `source_ref` the disclosed source.
const FACTS=[
 {id:'sourced',qualification:{source_ref:'src:chronicle-1'},uncertainty:null,source_ref:'src:chronicle-1',visual:'sourced'},
 {id:'circa',qualification:{uncertainty:'circa 1850'},uncertainty:'circa 1850',source_ref:null,visual:'authored'},
 {id:'disputed',qualification:{uncertainty:'disputed by a later editor',source_ref:'src:letter-4'},uncertainty:'disputed by a later editor',source_ref:'src:letter-4',visual:'disputed'},
 {id:'mythic',qualification:{uncertainty:'mythic, from the founding legend'},uncertainty:'mythic, from the founding legend',source_ref:null,visual:'mythic'},
];

function renderFact(f){
 const placed=projection.placeItems(projection.projectNodes([fact(f.id,f.qualification)]),VIEW)[0];
 return renderToStaticMarkup(createElement(TimelineNode,{placed,lit:null,selected:false,dimmed:false,filtered:false,viewportWidth:1200,onSelect(){},onOpen(){},onResize(){},onColorTag(){}}));
}

test('a fact carries the class standingOf gives its disclosed fields, and its uncertainty verbatim',()=>{
 for(const f of FACTS){
  const [item]=projection.projectNodes([fact(f.id,f.qualification)]);
  assert.deepEqual(item.standing,authority.standingOf({standing:f.uncertainty,source_ref:f.source_ref}),`${f.id}: class is standingOf output`);
  assert.equal(item.standing.visual,f.visual,`${f.id}: class`);
  assert.equal(item.uncertainty,f.uncertainty,`${f.id}: uncertainty verbatim`);
 }
});

test('an approximate fact draws a hatched band; disputed and mythic standing draw a badge; the verbatim string is the hover title',()=>{
 const circa=renderFact(FACTS[1]);
 assert.match(circa,/timeline-node-band--uncertain/,'circa is a hatched band');
 assert.doesNotMatch(circa,/timeline-node-standing--/,'circa has no badge');
 assert.match(circa,/title="circa 1850"/,'the card date carries the verbatim string');
 assert.match(circa,/title="1850 — circa 1850"/,'the band title carries the precision and the verbatim string');

 const disputed=renderFact(FACTS[2]);
 assert.match(disputed,/timeline-node-standing--disputed/,'disputed is a badge');
 assert.match(disputed,/title="disputed by a later editor"/,'the badge carries the verbatim string');
 assert.doesNotMatch(disputed,/timeline-node-band--uncertain/,'a disputed band is not hatched');

 const mythic=renderFact(FACTS[3]);
 assert.match(mythic,/timeline-node-standing--mythic/,'mythic is a badge');
 assert.match(mythic,/title="mythic, from the founding legend"/,'the mythic badge carries the verbatim string');

 const sourced=renderFact(FACTS[0]);
 assert.doesNotMatch(sourced,/timeline-node-band--uncertain|timeline-node-standing--|title="circa|title="disputed/,'a sourced fact is plain');
});

test('the relation-type palette is kept; a disclosed standing adds its dash and title, an undisclosed edge draws as before',()=>{
 const placed=projection.placeItems(projection.projectNodes([fact('a'),fact('b','1851'),fact('c','1852')]),VIEW);
 // expect = the HEAD relation-type palette (TimelineRelationshipLayer relationshipStyle) for the relation kind.
 const edges=[
  {id:'e-contests',relType:'CONTESTS',sourceGraphNodeId:'a',targetGraphNodeId:'b',properties:{},expect:{stroke:'#e07a6f',dash:'5 5'}},
  {id:'e-causes',relType:'CAUSES',sourceGraphNodeId:'a',targetGraphNodeId:'c',properties:{source_ref:'src:chronicle-1'},expect:{stroke:'#79c0d4'}},
  {id:'e-supports',relType:'SUPPORTS',sourceGraphNodeId:'b',targetGraphNodeId:'c',properties:{},expect:{stroke:'#79c0d4'}},
  {id:'e-disputed',relType:'CAUSES',sourceGraphNodeId:'a',targetGraphNodeId:'b',properties:{standing:'disputed by a later editor',source_ref:'src:letter-4'},expect:{stroke:'#79c0d4'}},
  {id:'e-confirmed',relType:'CONTESTS',sourceGraphNodeId:'b',targetGraphNodeId:'c',properties:{standing:'confirmed by two letters',source_ref:'src:letter-9'},expect:{stroke:'#e07a6f'}},
 ];
 const markup=renderToStaticMarkup(createElement(TimelineRelationshipLayer,{relationships:edges,placed,viewportWidth:1200,lod:'detail'}));
 for(const edge of edges){
  const start=markup.indexOf(`data-testid="timeline-relationship-${edge.id}"`);
  assert.ok(start>=0,`${edge.id} is drawn`);
  const group=markup.slice(start,markup.indexOf('</g>',start));
  assert.match(group,new RegExp(`stroke="${edge.expect.stroke}"`),`${edge.id}: relation-type stroke kept`);
  const disclosed=typeof edge.properties.standing==='string';
  if(!disclosed){
   // Undisclosed: exactly the HEAD drawing — palette dash, no standing class, data attribute or title.
   if(edge.expect.dash) assert.match(group,new RegExp(`stroke-dasharray="${edge.expect.dash}"`),`${edge.id}: palette dash kept`);
   else assert.doesNotMatch(group,/stroke-dasharray/,`${edge.id}: palette solid kept`);
   assert.doesNotMatch(group,/data-standing|timeline-relationship--|<title>/,`${edge.id}: no standing reading drawn`);
   continue;
  }
  // Disclosed: the standing class comes from standingOf and its dash from the shared table (solid when the class has none).
  const reading=authority.standingOf({standing:edge.properties.standing,source_ref:edge.properties.source_ref??null});
  const drawing=standingStyle.STANDING_DRAWING[reading.visual];
  assert.match(group,new RegExp(`data-standing="${reading.visual}"`),`${edge.id}: class is standingOf output`);
  assert.match(group,new RegExp(`timeline-relationship--${reading.visual}`),`${edge.id}: class name`);
  assert.match(group,new RegExp(`<title>${standingStyle.standingLabel(reading.visual)} · `),`${edge.id}: title names the standing label`);
  assert.ok(group.includes(edge.properties.standing),`${edge.id}: title carries the verbatim standing`);
  if(drawing.dash) assert.match(group,new RegExp(`stroke-dasharray="${drawing.dash}"`),`${edge.id}: standing dash`);
  else assert.doesNotMatch(group,/stroke-dasharray/,`${edge.id}: standing solid`);
 }
});

test('one table draws every standing class the authority names, and only disputed and mythic badge',()=>{
 assert.deepEqual(Object.keys(standingStyle.STANDING_DRAWING).sort(),authority.STANDING_LEGEND.map(entry=>entry.visual).sort());
 assert.deepEqual([...standingStyle.STANDING_BADGED].sort(),['disputed','mythic']);
 assert.equal(standingStyle.standingLabel('disputed'),'disputed');
});

test('a native reading\'s facet with uncertainty "circa" reaches the TimelineItem verbatim, with its source ref',async()=>{
 const reading={
  reading_ref:'reading:t3',
  subject:{subject_ref:'subject:t3',native_owner:'oi'},
  disclosure:{instruments:[]},
  temporal:[
   {kind:'occurred',facet_ref:'facet:circa',precision:'year',instant:'1850',uncertainty:'circa 1850',source_ref:'src:chronicle-1'},
   {kind:'occurred',facet_ref:'facet:plain',precision:'year',instant:'1851'},
  ],
 };
 const before=JSON.stringify(reading);
 const bundle=bundleFromTechneReadings([reading]);
 const view=await createTechneTransport(bundle).loadTimelineView({workspaceId:bundle.workspaceId});
 const items=projection.projectNodes(view.nodes);
 const circa=items.find(item=>item.graphNodeId==='facet:circa');
 assert.ok(circa,'the circa facet reaches the Timeline');
 assert.equal(circa.uncertainty,'circa 1850','the uncertainty string is verbatim through the bridge');
 assert.deepEqual(circa.standing,authority.standingOf({standing:'circa 1850',source_ref:'src:chronicle-1'}),'its standing is standingOf over the disclosed fields');
 assert.equal(items.find(item=>item.graphNodeId==='facet:plain').uncertainty,null,'a facet that states no uncertainty carries none');
 assert.equal(JSON.stringify(reading),before,'the bridge never mutates the native reading');
});
