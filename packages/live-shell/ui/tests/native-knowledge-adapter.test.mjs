import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createKnowledgeBinding, createCanvasKnowledgeOpen, validateKnowledgeOpen, sameKnowledgeDestination} from '../src/native/knowledgeOpen.ts'
import {validateNativeKnowledgeContext, resolveNativeGraphFocus} from '../../../../desktop/cradle/src/knowledge/nativeFocus.ts'
import {projectUnresolvedGraph} from '../../../../desktop/cradle/src/knowledge/graphNavigation.ts'
import {openBinding} from '../../../../desktop/cradle/src/surface/engine.ts'
import {freshLayout} from '../../../../desktop/cradle/src/surface/types.ts'
import {decodeLayout} from '../../../../desktop/cradle/src/surface/persist.ts'

// The native authoring sources use the shipped TypeScript compiler's removal
// of type-only symbols from mixed imports. Compile those actual sources only
// in memory, as the native Glyph source suite does; no emitted/shared build.
const compiler=new URL('../../../../desktop/cradle/node_modules/typescript/lib/typescript.js',import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function load(url,context,next){if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);const source=await readFile(new URL(url),'utf8');return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText}}`)}`,import.meta.url)
const {kernelDocumentToJourney}=await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts')

// Actual native owner document captured by the save/reopen acceptance, and
// shipped Obsidian cache capture. No kernel, owner or transport is simulated.
const nativeDocument=JSON.parse(await readFile(new URL('./fixtures/native-rich-glyph-rack.json',import.meta.url),'utf8'))
const oracle=JSON.parse(await readFile(new URL('../../../../desktop/cradle/kernel/tests/fixtures/obsidian-links-parity/oracle.json',import.meta.url),'utf8'))
const context=()=>({subject_ref:'Alpha.md',native_owner:'central',register:'control:root',origin:'canvas',source_basis:{expression_ref:nativeDocument.expression_ref,revision:nativeDocument.revision,scene_ref:nativeDocument.scenes[0].scene_ref,entity_ref:nativeDocument.scenes[0].entity_refs[0]},returnTo:{bindingId:'world.expressions',expression_ref:nativeDocument.expression_ref,scene_ref:nativeDocument.scenes[0].scene_ref,mode:'techne',selection:[nativeDocument.scenes[0].entity_refs[0]],step_id:null}})
function reading(){
  const provenance={source:'obsidian-1.7.7/captured-link-cache'}
  const nodes=Object.keys(oracle.resolvedLinks).map(ref=>({ref,kind:'file',label:ref,native_owner:'central',provenance,actions:[]}))
  const refs=new Set(nodes.map(node=>node.ref))
  const edges=Object.entries(oracle.resolvedLinks).flatMap(([from_ref,targets])=>Object.keys(targets).filter(ref=>refs.has(ref)).map(to_ref=>({from_ref,to_ref,relation:'wiki-link',provenance})))
  const unresolved_links=Object.entries(oracle.unresolvedLinks).flatMap(([source,targets])=>Object.entries(targets).map(([key,count])=>({key,sources:{[source]:count},provenance})))
  return projectUnresolvedGraph({schema:'oi.cradle.graph-reading/v1',nodes,edges,unresolved_links,inputs:{},counts:{spaces:0,wiki_nodes:0,knowledge_rows:0,nodes:nodes.length,edges:edges.length}})
}
test('Canvas origin survives the real surface engine and codec without fabricating a Wiki address',()=>{
  const input={title:'Alpha',plane:'graph',...context()},before=structuredClone(input)
  const binding=createKnowledgeBinding(input,'candidate-graph')
  assert.equal(binding.ref,'Alpha.md');assert.equal(binding.address,undefined)
  assert.deepEqual(binding.view.nativeKnowledge,context());assert.deepEqual(input,before)
  const layout=openBinding(freshLayout(),binding),restored=decodeLayout(JSON.parse(JSON.stringify(layout)))
  assert.deepEqual(JSON.parse(JSON.stringify(restored.surfaces[binding.id])),binding)
  assert.deepEqual(restored.surfaces[binding.id].view.nativeKnowledge.returnTo,context().returnTo)
  assert.equal(restored.root.active,binding.id)
})
test('source page retains the exact native address and original Canvas Return without ref parsing',()=>{
  const original=context(),address={kind:'source',value:'central:path:/Users/admin/Central:Work/Source.md'}
  const binding=createKnowledgeBinding({title:'Actual source',plane:'page',address,...original},'source-reading')
  assert.deepEqual(binding.address,address);assert.equal(binding.ref,address.value)
  assert.deepEqual(binding.view.nativeKnowledge,original)
  assert.throws(()=>validateKnowledgeOpen({title:'No source address',plane:'page',...original}),/explicit native address/)
  assert.throws(()=>validateKnowledgeOpen({title:'A bare file location',location:{path:'Alpha.md'}}),/No disclosed/)
  const nativeOnly=createKnowledgeBinding({title:'Opaque subject',ref:address.value,subject_ref:address.value,native_owner:'central',plane:'graph'},'opaque-graph')
  assert.equal(nativeOnly.address,undefined,'a disclosed source subject never becomes a Wiki address through the legacy event field')
})
test('captured native Graph focus is exact, preserves edge records and refuses ghosts or another owner',()=>{
  const graph=reading(),before=JSON.stringify(graph),edges=graph.edges
  const found=resolveNativeGraphFocus(graph,context())
  assert.equal(found.state,'found');assert.equal(found.node.ref,'Alpha.md');assert.equal(found.node.native_owner,'central')
  assert.equal(resolveNativeGraphFocus(graph,{subject_ref:'Alpha.md',native_owner:'ai-kit'}).state,'missing')
  const ghost=graph.nodes.find(node=>node.kind==='unresolved-link')??graph.nodes.find(node=>node.ref.startsWith('view:unresolved-link:'))
  assert.ok(ghost);assert.equal(resolveNativeGraphFocus(graph,{subject_ref:ghost.ref,native_owner:ghost.native_owner}).state,'missing')
  assert.equal(resolveNativeGraphFocus(graph,{subject_ref:'Absent.md',native_owner:'central'}).state,'missing')
  assert.equal(JSON.stringify(graph),before);assert.equal(graph.edges,edges)
})
test('ambiguous disclosed occurrences are refused; neither label nor partial identity can target a native subject',()=>{
  const graph=reading(),node=graph.nodes.find(value=>value.ref==='Alpha.md')
  graph.nodes.push({...node,ref:'another-native-occurrence',subject_ref:'Alpha.md'})
  assert.equal(resolveNativeGraphFocus(graph,context()).state,'ambiguous')
  assert.equal(resolveNativeGraphFocus(graph,{subject_ref:'Alpha',native_owner:'central'}).state,'missing')
  assert.equal(validateNativeKnowledgeContext({subject_ref:'Alpha.md'}),null)
  for(const field of ['subject_ref','native_owner','source_basis','returnTo']){const value=context();delete value[field];assert.equal(validateNativeKnowledgeContext(value),null)}
})
test('shared admission clones bounded Return and refuses cyclic, executable or unqualified source bases',()=>{
  const value=context(),accepted=validateNativeKnowledgeContext(value)
  value.returnTo.selection[0]='different-native-ref';assert.notEqual(accepted.returnTo.selection[0],value.returnTo.selection[0])
  assert.equal(validateNativeKnowledgeContext({...context(),source_basis:{...context().source_basis,revision:0}}),null)
  assert.equal(validateNativeKnowledgeContext({...context(),returnTo:{...context().returnTo,camera:{execute:()=>true}}}),null)
  const cycle={};cycle.self=cycle;assert.equal(validateNativeKnowledgeContext({...context(),returnTo:{...context().returnTo,camera:cycle}}),null)
  assert.equal(validateNativeKnowledgeContext({...context(),returnTo:{...context().returnTo,camera:{content:'x'.repeat(65537)}}}),null)
  const a=createKnowledgeBinding({title:'Graph',...context()},'a'),b=createKnowledgeBinding({title:'Renamed presentation',...context()},'b')
  assert.equal(sameKnowledgeDestination(a,b),true)
  b.view.nativeKnowledge.native_owner='other-owner';assert.equal(sameKnowledgeDestination(a,b),false)
})
test('actual native subject inspect and production occurrence conversion produce an exact Canvas Graph open',async()=>{
  const capture=JSON.parse(await readFile(new URL('./fixtures/native-subject-graph-inspect.json',import.meta.url),'utf8'))
  assert.equal(capture.response.ok,true);assert.equal(capture.response.outcome.result,'expression')
  const document=capture.response.outcome.data.document,view=kernelDocumentToJourney(document)
  const scene=view.journey.scenes.find(row=>view.bindings[row.id].scene_ref===document.selection.scene_ref)
  const occurrence=view.bindings[scene.id].occurrences.find(row=>row.entity_ref===document.selection.entity_ref&&row.subject)
  assert.ok(occurrence,'the actual native selection discloses a subject-backed occurrence')
  const editor={basis:{expression_ref:document.expression_ref,revision:document.revision,scene_ref:document.selection.scene_ref,authored_revision:0},scene,entityOccurrences:Object.fromEntries(view.bindings[scene.id].occurrences.map(row=>[row.view_entity_id,row.entity_ref])),selection:{entity_ids:[occurrence.view_entity_id],step_id:null}}
  const request=createCanvasKnowledgeOpen(document,editor,'techne'),subject=document.entities[occurrence.entity_ref].subject
  assert.equal(request.subject_ref,subject.subject_ref);assert.equal(request.native_owner,subject.native_owner);assert.equal(request.address,undefined)
  assert.deepEqual(request.source_basis,{expression_ref:document.expression_ref,revision:document.revision,scene_ref:document.selection.scene_ref,entity_ref:occurrence.entity_ref})
  assert.deepEqual(request.returnTo,{bindingId:'world.expressions',expression_ref:document.expression_ref,scene_ref:document.selection.scene_ref,mode:'techne',selection:[occurrence.entity_ref],step_id:null})
  assert.equal('camera' in request.returnTo,false,'no camera is manufactured; the real Canvas host retains it')
  assert.deepEqual(createKnowledgeBinding(request,'live-native-graph').view.nativeKnowledge.returnTo,request.returnTo)
})
test('actual saved rich native Glyph refuses a fabricated Graph subject and enforces exact native revision/membership',()=>{
  const scene=nativeDocument.scenes[0],entity_ref=scene.entity_refs[0]
  const editor={basis:{expression_ref:nativeDocument.expression_ref,revision:nativeDocument.revision,scene_ref:scene.scene_ref,authored_revision:912},entityOccurrences:{selected:entity_ref},selection:{entity_ids:['selected'],step_id:null}}
  assert.throws(()=>createCanvasKnowledgeOpen(nativeDocument,editor,'techne'),/no disclosed native subject/)
  assert.throws(()=>createCanvasKnowledgeOpen(nativeDocument,{...editor,basis:{...editor.basis,revision:editor.basis.revision-1}},'techne'),/another Expression or revision/)
  assert.throws(()=>createCanvasKnowledgeOpen(nativeDocument,{...editor,entityOccurrences:{selected:'another-native-entity'}},'techne'),/absent from this exact native Scene/)
  const inconsistent=context();inconsistent.returnTo.scene_ref='other-native-scene';assert.equal(validateNativeKnowledgeContext(inconsistent),null)
  const otherSelection=context();otherSelection.returnTo.selection=['another-native-entity'];assert.equal(validateNativeKnowledgeContext(otherSelection),null)
  assert.equal(validateNativeKnowledgeContext({...context(),returnTo:{...context().returnTo,document:nativeDocument}}),null)
})
