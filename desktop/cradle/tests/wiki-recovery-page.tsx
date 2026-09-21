/** Controlled component proof only. No native operation or persistent source
 * is implemented here. The production drawer and its clients are unchanged;
 * the host, responses and checkpoint sink are explicit test doubles. */
import {createRoot} from 'react-dom/client';
import {WikiConstructionPanel} from '../src/knowledge/WikiConstructionPanel';
import {CONSTRUCTION, ACTOR, type ConstructionRequest} from '../src/knowledge/construction';
import {fromNative} from '../src/knowledge/constructionDraft';
import {compositionReturnRequest} from '../src/knowledge/constructionProjection';
import type {ConstructionCheckpoint} from '../src/knowledge/constructionCheckpoint';
import '@epilogos/oi-design-system/tokens.css';

const test = (window as any).__WIKI_RECOVERY__;
const parent = {schema:'central.path-ref/v1', root:'/controlled', path:'Work/Notes', ref:'central:path:notes'};
const location = {...parent, path:'Work/Notes/inquiry.expression.json', ref:'central:path:artifact'};
const registerLocation = {...parent, path:'Work/Notes/ProjectCentral/agents/wiki/wiki.json', ref:'central:path:wiki'};
const base: any = {object:'frame', profile:'okf-wiki/v1', ref:'wiki:frame:inquiry', revision:3,
  constellations:[{anchor_ref:'wiki:anchor', members:[]}],
  [CONSTRUCTION]:{title:'Reading and interpretation', inquiry:{question:'How do these passages relate?'}, frame:null, compositions:[]}};
const document: any = {schema:'oi.expression/v1', expression_ref:'expression:inquiry', revision:4, title:'Reading and interpretation', entities:{}, relations:{}, scenes:[], selection:{scene_ref:'scene:a',entity_ref:null},provenance:[],representations:[],refinements:[]};
let file: any = {location, revision:'file:r4',content:JSON.stringify(document)};
const artifact = {file,document};
const pending = compositionReturnRequest(base,artifact);
let frame = structuredClone(base);
function record(request:ConstructionRequest) {
  frame = {...frame,revision:4,[CONSTRUCTION]:{...frame[CONSTRUCTION],compositions:[request.changes[0].composition],
    applied:{[request.operation_ref]:{actor_ref:ACTOR,basis_revision:3,result_revision:4,request_digest:'a'.repeat(64)}}}};
}
if (test.scenario==='recorded'||test.scenario==='replaced'||test.scenario==='retry-replaced') record(pending);
if (test.scenario==='replaced'||test.scenario==='retry-replaced') {frame.revision=5;frame[CONSTRUCTION].compositions=[];}
if (test.scenario==='file-conflict') file={...file,revision:'file:changed'};
let checkpoint: ConstructionCheckpoint = {draft:fromNative(base,[]),saved:true,pending,
  artifact:{location,revision:'file:r4',expression_ref:document.expression_ref}};
if (test.scenario==='first-save') {
  checkpoint={draft:fromNative(base,[]),saved:true,artifactSave:{schema:'oi.wiki-artifact-save/v1',document,
    destination:{parent,name:'inquiry.expression.json',operation_ref:'operation:first-save'}}};
  file=undefined;test.refuseSave=true;
}
const registerFile = () => ({location:registerLocation,revision:`register:r${frame.revision}`,content:JSON.stringify({objects:[
  {object:'space',ref:'wiki:space',title:'Notes'},frame]})});
const world = {root:{work:{projects:[{name:'Notes',path:'Work/Notes'}]}},project:{project:{name:'Notes',path:'Work/Notes'}}};
const read = (op:any):any => {
  test.reads.push(op);
  if (op.op==='world_browse'||op.op==='project_browse') return {result:'world_read',snapshot:{navigator:world}};
  if (op.op==='invoke_action'&&op.invocation.action==='projectcentral.wiki.read') return {result:'action_dispatched',dispatch:{state:'invoked',data:{schema:'central.wiki-reading/v1',source:{path:'ProjectCentral/agents/wiki/wiki.json',ref:'source:wiki',revision:registerFile().revision}}}};
  if (op.op==='files_list') return {result:'directory_read',directory:op.path.endsWith('/wiki')?{location:{...parent,path:'Work/Notes/ProjectCentral/agents/wiki',ref:'central:path:wiki-dir'},entries:[{name:'wiki.json',kind:'file',location:registerLocation}]}:{location:parent,entries:file?[{name:'inquiry.expression.json',kind:'file',location}]:[]}};
  if (op.op==='file_read') return {result:'file_read',reading:op.location.ref===registerLocation.ref?registerFile():file};
  if (op.op==='graph') return {result:'graph_reading',reading:{schema:'oi.cradle.graph-reading/v1',nodes:[],edges:[],formations:[],inputs:{},counts:{},shape_catalog:{schema:'aikit.ql-authoring-forms/v1',forms:[]}}};
  if (op.op==='expression'&&op.request.operation==='inspect') return {result:'expression',data:{state:'read',document}};
  throw new Error(`Unexpected controlled reading ${JSON.stringify(op)}`);
};
const apply = async(op:any) => {
  // The same call must already exist in the retained checkpoint before any
  // mutation is delivered to the host, including the first Return attempt.
  if (op.op==='invoke_action'&&op.invocation.action==='aikit.constellation.apply') {
    const request=op.invocation.input.request;
    const held=test.checkpoints.at(-1)?.pending;
    if (!held || held.operation_ref!==request.operation_ref) throw new Error('Return was not checkpointed before dispatch');
    test.effects.push(op);
    if (test.failReturn) return null;
    if (test.scenario!=='retry-replaced') record(request);
    return {result:'action_dispatched',dispatch:{state:'invoked',data:{schema:'aikit.constellation/v1',frame_ref:frame.ref,revision:frame.revision,persisted:true,state:test.scenario==='retry-replaced'?'unchanged':'saved',indexed_availability_proven:false,reading:{frame,construction:frame[CONSTRUCTION],relations:[]}}}};
  }
  if (op.op==='expression'&&op.request.operation==='save_as') {
    test.effects.push(op);
    if (test.refuseSave) return {result:'expression',data:{state:'save_refused',owner_operation:'central.files.create',failure:{kind:'refused',message:'Unknown ordinary-file creation field'}}};
    file={location,revision:'file:r4',content:JSON.stringify(document)};
    return {result:'expression',data:{state:'saved',persisted:true,readback_verified:true,file:{location,revision:'file:r4'}}};
  }
  throw new Error(`Unexpected controlled effect ${JSON.stringify(op)}`);
};
test.kernel={transport:{kind:'bridge',url:'http://controlled.invalid'},apply};
test.pending=pending;test.currentCheckpoint=checkpoint;
window.fetch=async (_url,options) => {
  if (!options?.body) throw new Error('No network request is permitted by this component proof');
  return new Response(JSON.stringify({ok:true,outcome:read(JSON.parse(String(options.body)))}),{headers:{'content-type':'application/json'}});
};
createRoot(window.document.getElementById('root')!).render(<WikiConstructionPanel
  binding={{id:'recovery-proof',kind:'knowledge',title:'Notes',project:'Notes'}} open checkpoint={checkpoint}
  onCheckpoint={value=>{if(test.rejectCheckpoint&&value.pending)throw new Error('Controlled checkpoint storage refused');test.checkpoints.push(structuredClone(value));test.currentCheckpoint=value;}}
  onClose={()=>{}} onNavigate={()=>{}} onSaved={()=>{test.savedCallbacks++;}}
/>);
