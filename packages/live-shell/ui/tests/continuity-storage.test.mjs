import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Production sources in memory: .ts/.tsx transpiled, extensionless relative
// specifiers retried as .ts/.tsx (the timeline-time-spine loader pattern).
const root = new URL('../../../../', import.meta.url);
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url);

const {loadWorkspaceBook, workspaceStorageNamespace, switchWorkspaceMode, updateWorkspaceBinding} = await import('../../../../desktop/cradle/src/workspace/store.ts')
const {stageCheckpoint, commitCheckpoint, lastKnownGood, decodeLayoutProgressive} = await import('../../../../desktop/cradle/src/workspace/checkpoints.ts')
const {preservePresentation, latestRecovery, listRecovery} = await import('../../../../desktop/cradle/src/workspace/recovery.ts')
const {ContinuityResidency} = await import('../src/continuity/residency.ts')
const {runtimeRecord} = await import('../../../../desktop/cradle/src/surface/runtime.ts')
const {decodeApplicationView} = await import('../../../../desktop/cradle/src/surface/persist.ts')
const {candidateApplicationEnvelope, readCandidateApplicationView} = await import('../src/continuity/applicationView.ts')

const options = {storageKey: 'oi.live-shell.candidate.workspace.v2', legacyLayoutKey: 'oi.live-shell.candidate.layout.v1'}
const namespace = workspaceStorageNamespace(options)
const layout = () => ({root: {type:'group',id:'g',tabs:['surface'],pinned:[],active:'surface'}, surfaces: {surface:{id:'surface',kind:'system',title:'System'}}, closedStack:[], focusedGroupId:'g'})
const book = () => ({version:2,active:'a',workspaces:[{id:'a',name:'Candidate',writing:'',layout:layout(),modeLayouts:{techne:{...layout(),mode:'techne',root:{type:'group',id:'deep-group',tabs:['deep-surface'],pinned:[],active:'deep-surface'},surfaces:{'deep-surface':{id:'deep-surface',kind:'system',title:'Deep view'}}}}}]})
test('candidate v2 reads, mode transitions and publication never touch everyday namespaces', () => {
  localStorage.clear()
  const everyday = '{everyday-original}'
  localStorage.setItem('oi-cradle.workspaces.v1',everyday)
  localStorage.setItem('oi-cradle.layout.v1',everyday)
  localStorage.setItem('oi-cradle.book.stage.v1',everyday)
  const raw = JSON.stringify(book())
  stageCheckpoint(namespace.key,raw,namespace.journalKey)
  localStorage.setItem(namespace.key,raw)
  commitCheckpoint(namespace.key,namespace.journalKey)
  const restored = loadWorkspaceBook(options).book
  assert.equal(restored.version,2)
  assert.equal(restored.workspaces[0].modeLayouts.techne.mode,'techne')
  const deep = switchWorkspaceMode(restored.workspaces[0],'techne')
  assert.equal(deep.layout.mode,'techne')
  assert.equal(deep.modeLayouts.base.surfaces.surface.id,'surface')
  assert.equal(lastKnownGood(namespace.key,namespace.journalKey),raw)
  for (const key of ['oi-cradle.workspaces.v1','oi-cradle.layout.v1','oi-cradle.book.stage.v1']) assert.equal(localStorage.getItem(key),everyday)
})
test('corrupt candidate falls back to committed bytes, quarantines only its own originals', () => {
  const broken = '{interrupted'
  localStorage.setItem(namespace.key,broken)
  const loaded = loadWorkspaceBook(options)
  assert.equal(loaded.book.workspaces[0].name,'Candidate')
  assert.ok(loaded.quarantine.length)
  assert.equal(localStorage.getItem(namespace.key),broken)
  const original = preservePresentation(namespace.key,'interrupted publication',namespace.recovery)
  assert.equal(original.raw,broken)
  assert.equal(latestRecovery(namespace.recovery).key,original.key)
  assert.equal(latestRecovery(),undefined)
  for (let n = 0; n < 7; n++) {
    localStorage.setItem(namespace.key,`{damaged-${n}`)
    preservePresentation(namespace.key,'damaged candidate',namespace.recovery)
  }
  assert.equal(listRecovery(namespace.recovery).length,5)
  assert.equal(listRecovery().length,0)
  assert.equal(localStorage.getItem('oi-cradle.workspaces.v1'),'{everyday-original}')
})
test('invalid binding loses only itself through the imported progressive codec', () => {
  const raw = layout()
  raw.surfaces.bad = {id:'bad',kind:'invented-owner',title:'Invalid'}
  raw.root.tabs.push('bad')
  const result = decodeLayoutProgressive(raw,'a')
  assert.deepEqual(Object.keys(result.layout.surfaces),['surface'])
  assert.deepEqual(result.droppedBindingIds,['bad'])
  assert.equal(raw.root.tabs.length,2)
})
test('native application frame envelope survives codec, mode retention and filesystem recovery without an ALS binding', () => {
  const applicationView = {schema:'oi.application-view/v1',version:1,app_id:'org.epilogos.oi.live-shell',payload:{alsPath:'/Users/admin/Music/Set.als',tab:'arrangement',selection:{track:4,scene:null,clip:2},browser:false,detail:true,dock:true,browserWidth:380,detailHeight:420,centerPanel:'native.workbench',detailMode:'clip',settingsPresented:false}}
  const original = book().workspaces[0]
  original.layout.applicationView = applicationView
  assert.deepEqual(decodeLayoutProgressive(original.layout,'a').layout.applicationView,applicationView)
  const waiting = switchWorkspaceMode(original,'techne')
  const key = `${namespace.key}.application-view`
  const raw = JSON.stringify({version:2,active:waiting.id,workspaces:[waiting]})
  stageCheckpoint(key,raw,`${key}.stage`); localStorage.setItem(key,raw); commitCheckpoint(key,`${key}.stage`)
  localStorage.setItem(key,'{interrupted frame publication')
  const recovered = loadWorkspaceBook({storageKey:key}).book.workspaces[0]
  assert.deepEqual(recovered.modeLayouts.base.applicationView,applicationView)
  assert.deepEqual(readCandidateApplicationView(recovered.modeLayouts.base.applicationView),applicationView.payload)
  assert.equal(Object.values(recovered.modeLayouts.base.surfaces).some(binding=>binding.location?.path?.endsWith('.als')),false)
  assert.equal(localStorage.getItem('oi-cradle.workspaces.v1'),'{everyday-original}')
})
test('core application envelope is bounded and candidate refuses owner/content and foreign app payloads', () => {
  const envelope = candidateApplicationEnvelope({alsPath:'/Music/Current.als',tab:'session',selection:{track:1,scene:2},settingsReturn:'expressions'})
  assert.deepEqual(readCandidateApplicationView(envelope),envelope.payload)
  assert.equal(candidateApplicationEnvelope({tab:'session',dirty:false}),undefined)
  assert.equal(candidateApplicationEnvelope({selection:{track:NaN,scene:null}}),undefined)
  assert.equal(candidateApplicationEnvelope({browserWidth:Infinity}),undefined)
  assert.equal(candidateApplicationEnvelope(new Date()),undefined)
  assert.equal(candidateApplicationEnvelope({centerPanel:'native.unregistered'}),undefined)
  const reordered = candidateApplicationEnvelope({settingsReturn:'expressions',selection:{scene:2,track:1},tab:'session',alsPath:'/Music/Current.als'})
  assert.equal(JSON.stringify(reordered),JSON.stringify(envelope),'identical frame state has stable checkpoint bytes')
  assert.equal(readCandidateApplicationView({...envelope,app_id:'org.other.native'}),null)
  assert.equal(decodeApplicationView({...envelope,payload:{content:'x'.repeat(4097)}}),undefined)
  assert.equal(decodeApplicationView({...envelope,payload:{content:undefined}}),undefined)
  assert.equal(decodeApplicationView({...envelope,version:2}),undefined)
  const cyclic = {}; cyclic.self = cyclic
  assert.equal(decodeApplicationView({...envelope,payload:cyclic}),undefined)
  const damaged = {...layout(),applicationView:{...envelope,version:2}}
  const restored = decodeLayoutProgressive(damaged,'a').layout
  assert.equal(restored.applicationView,undefined)
  assert.equal(restored.surfaces.surface.id,'surface')
})
test('late hidden-mode checkpoint updates its original binding and survives real storage recovery', () => {
  const original = book().workspaces[0]
  original.layout.surfaces.surface = {id:'surface',kind:'knowledge',title:'Knowledge',ref:'wiki:space:candidate',address:{kind:'wiki',value:'wiki:space:candidate'}}
  const active = switchWorkspaceMode(original,'techne')
  const view = {knowledgePlane:'page',graphOrigin:'candidate:origin-graph'}
  const hidden = updateWorkspaceBinding(active,'surface',binding => ({...binding,title:'Retained source view',view}))
  assert.equal(hidden.layout,active.layout,'selected deep tree and focus remain identical')
  assert.equal(hidden.modeLayouts.base.surfaces.surface.title,'Retained source view')
  assert.equal(hidden.modeLayouts.base.surfaces.surface.id,'surface')
  const key = `${namespace.key}.hidden`
  const raw = JSON.stringify({version:2,active:hidden.id,workspaces:[hidden]})
  stageCheckpoint(key,raw,`${key}.stage`); localStorage.setItem(key,raw); commitCheckpoint(key,`${key}.stage`)
  const reread = loadWorkspaceBook({storageKey:key}).book.workspaces[0]
  assert.equal(reread.layout.mode,'techne')
  assert.equal(reread.modeLayouts.base.surfaces.surface.title,'Retained source view')
  assert.deepEqual(reread.modeLayouts.base.surfaces.surface.view,view)
  assert.equal(updateWorkspaceBinding(hidden,'closed-after-request',binding=>binding),hidden)
  assert.throws(() => updateWorkspaceBinding(hidden,'surface',binding=>({...binding,id:'replacement'})),/identity/)
  assert.throws(() => updateWorkspaceBinding(hidden,'surface',binding=>({...binding,ref:'wiki:space:another-subject'})),/subject/)
})
test('unsupported candidate schema preserves original and never reads everyday legacy', () => {
  const other = {storageKey:`${namespace.key}.future`}
  localStorage.setItem(other.storageKey,'{"version":99,"workspaces":[]}')
  assert.throws(() => loadWorkspaceBook(other),/Unrecognized workspace format/)
  assert.equal(localStorage.getItem(other.storageKey),'{"version":99,"workspaces":[]}')
  assert.equal(loadWorkspaceBook({storageKey:`${namespace.key}.fresh`}).book.workspaces[0].layout.root,null)
})
test('view release requires an acknowledged checkpoint and a reveal supersedes pending eviction', async () => {
  const registry = new ContinuityResidency()
  let disposed = 0
  let releaseCheckpoint
  registry.register({id:'candidate-protected',kind:'file',checkpoint:async () => false,disposeView:() => disposed++})
  registry.conceal('candidate-protected')
  assert.equal(await registry.release('candidate-protected'),false)
  assert.equal(runtimeRecord('candidate-protected').residency,'retained')
  registry.register({id:'candidate-race',kind:'file',checkpoint:() => new Promise(resolve => {releaseCheckpoint = resolve}),disposeView:() => disposed++})
  registry.conceal('candidate-race')
  const pending = registry.release('candidate-race')
  await Promise.resolve()
  registry.present('candidate-race')
  releaseCheckpoint(true)
  assert.equal(await pending,false)
  assert.equal(disposed,0)
  registry.forgetClosed('candidate-protected')
  registry.forgetClosed('candidate-race')
})
test('synchronous checkpoint refusal clears release interest and permits a repaired retry', async () => {
  const registry = new ContinuityResidency()
  let refusal = true, disposed = 0
  registry.register({id:'candidate-retry',kind:'file',checkpoint:() => {
    if (refusal) throw Error('Owner checkpoint currently unavailable')
    return Promise.resolve(true)
  },disposeView:() => disposed++})
  registry.conceal('candidate-retry')
  assert.equal(await registry.release('candidate-retry'),false)
  assert.equal(disposed,0)
  refusal = false
  assert.equal(await registry.release('candidate-retry'),true)
  assert.equal(disposed,1)
  assert.equal(runtimeRecord('candidate-retry'),undefined)
})
