// Pass a freshly captured native SharedField reading, and optionally its native
// cradle graph. This replays admitted owner data through the production reader;
// it supplies no transport responses, replacement graph or installed UI claim.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultReadingText} from './default-reading-text.mjs';

register('./ts-transpile-hook.mjs',import.meta.url);
register('./knowledge-render-hook.mjs',import.meta.url);
const [readingPath,graphPath]=process.argv.slice(2);
assert.ok(readingPath,'Pass an actual native SharedField reading capture');
const capture=JSON.parse(await readFile(readingPath,'utf8'));
const reading=capture.data??capture;
assert.equal(reading.schema,'oi.shared-field.reading/v1');
assert.equal(reading.state,'hosted');
assert.ok(reading.entry?.ref&&reading.entry?.label);
const source=process.env.KNOWLEDGE_NODE_DETAILS_SOURCE?pathToFileURL(process.env.KNOWLEDGE_NODE_DETAILS_SOURCE).href:new URL('../src/knowledge/NodeDetails.tsx',import.meta.url).href;
const {NodeDetails,HostedReadingBody}=await import(source);
let html=renderToStaticMarkup(createElement(HostedReadingBody,{reading}));
if(graphPath){
  const capture=JSON.parse(await readFile(graphPath,'utf8'));
  const graph=capture.outcome?.reading??capture.data??capture;
  assert.equal(graph.schema,'oi.cradle.graph-reading/v1');
  const node=graph.nodes.find(node=>node.ref===reading.entry.ref);
  assert.ok(node,'The native graph must disclose this exact admitted subject');
  assert.equal(node.native_owner,'shared-field');
  html=renderToStaticMarkup(createElement(NodeDetails,{node,hosted:reading,disclosures:[],related:graph.edges.filter(edge=>edge.from_ref===node.ref||edge.to_ref===node.ref).map(edge=>({edge,node:graph.nodes.find(other=>other.ref===(edge.from_ref===node.ref?edge.to_ref:edge.from_ref))})),rect:{x:0,y:0,width:500,height:600},extent:{width:1400,height:1000},native:true,onClose:()=>{},onPromote:()=>{},onOpen:()=>{},onGeometry:()=>{},onRelated:()=>{},onActionDispatched:()=>{}}));
}
const text=defaultReadingText(html);
assert.match(text,/shared presentation is available/i);
if(graphPath)assert.ok(text.includes(reading.entry.label),'The actual owner name is visible and announced');
for(const exact of [reading.entry.ref,reading.entry.world_ref,reading.entry.revision,reading.target.uri,...reading.projections.map(row=>row.projection_ref)]){
  assert.ok(exact&&html.includes(exact),'The exact owner binding remains present');
  assert.ok(!text.includes(exact),'The exact owner binding requires deliberate inspection');
}
assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
console.log(`PASS actual admitted ${reading.entry.kind} -> production ${graphPath?'NodeDetails':'HostedReadingBody'}; available presentation, closed exact source, original owner identities retained. Installed visual acceptance remains separate.`);
