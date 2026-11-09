// O-I #747 round 896, 0R-authority.1 and .4 (DLW build ruling 2026-11-09, on the review of C99's kernel and host): the shell sends the
// person's own acts that are the kernel's ops, not Actions, by the shell window's channel (the desktop host's kernel_press) exactly as the
// kernel takes them there (lib.rs person_press): Receiving's writes, a Day ensured, made or closed, a page's Launch, Stop and Delete;
// its reads go by kernel_op, the frame's relays by kernel_op, and the walk bridge has no such channel. The channel is the shell window's,
// not proof that the person pressed: the shell's one known sender of a person act no press drives (useFieldRecords' central.day.field.record)
// is pinned here, so a second cannot appear unseen.
// REAL: the shell's own senders (pageActs.ts trashPage, pageOwner.ts launchPage, stopPage and the reads, central/client.ts central,
// receiving/client.ts receiving, centralDeviceWrites.ts recordFieldItems) over the kernel bridge; the Tauri core's invoke is a SCRIPTED
// STUB of the host. CODE-READING: the kernel's admission (owner_read.rs receiving_reads, owner_write.rs central_write, page.rs
// person_act) that the shell mirrors, the kernel's PERSON_ACTS and the shell's files that name them, and useFieldRecords' send.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.split('?')[0].endsWith('.html')||url.split('?')[0].endsWith('.svg'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(url.split('?')[0]),'utf8'))};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})


const Bridge = await import('../../../../desktop/cradle/src/kernel/bridge.ts')
const Page = await import('../../../../desktop/cradle/src/personal/pageOwner.ts')
const Acts = await import('../src/central/pageActs.ts')
const Central = await import('../../../../desktop/cradle/src/central/client.ts')
const Receiving = await import('../../../../desktop/cradle/src/receiving/client.ts')
const Writes = await import('../src/central/devices/centralDeviceWrites.ts')
const repo = fileURLToPath(new URL('../../../../', import.meta.url))
const read = path => readFileSync(join(repo, path), 'utf8')
const TAURI = {kind: 'tauri'}
const LOCATION = {schema: 'central.path-ref/v1', ref: 'central:file:Control/user/flows/p.html', path: 'Control/user/flows/p.html'}
const READING = {page: 'page_reading', central: 'central_reading', receiving: 'receiving_reading'}

/** The host's invoke, scripted: each command and op it is asked, answered as its owner reading. */
async function overTheHost(run) {
  const invoked = []
  const priorWindow = globalThis.window
  globalThis.window = {__TAURI_INTERNALS__: {invoke: async (command, args) => {
    const op = args.op
    const named = op.op === 'page' ? op.request.operation : op.op === 'central' ? op.request.kind : op.op === 'receiving' ? Object.keys(op.request)[0]
      : op.op === 'invoke_action' ? op.invocation.action : op.op
    invoked.push([command, `${op.op} ${named}`])
    if (op.op === 'invoke_action') return {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: op.invocation.action, data: {results: []}}}
    return {result: READING[op.op] ?? 'world_reading', data: {}}
  }}}
  try { await run(); return invoked } finally {
    if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow
  }
}

test('0R-authority.1: the shell sends the person\'s kernel ops by the shell window\'s channel, and everything else by kernel_op', async () => {
  const invoked = await overTheHost(async () => {
    // The person's acts.
    await Page.launchPage(TAURI, LOCATION)
    await Page.stopPage(TAURI, 'now:p')
    await Acts.trashPage(TAURI, LOCATION, 'sha256:1')
    await Central.central(TAURI, null, {kind: 'ensure-day', expected_time_policy_revision: 'r'})
    await Central.central(TAURI, null, {kind: 'initialise-day', day_ref: 'd', document_id: 'x', expected_revision: 'r', expected_policy_revision: 'r', form: LOCATION, expected_form_revision: 'r'})
    await Central.central(TAURI, null, {kind: 'close-day', day_ref: 'd', expected_revision: 'r', expected_relations_revision: 'r'})
    await Receiving.receiving(TAURI, null, {kind: 'mutate-field', source_ref: 's', document_id: 'd', expected_revision: 'r', request_id: 'q', field_id: 'f', value: 1})
    await Receiving.receiving(TAURI, null, {kind: 'mutate-meta', source_ref: 's', document_id: 'd', expected_revision: 'r', request_id: 'q', key: 'title', value: 't'})
    await Receiving.receiving(TAURI, null, {kind: 'review', return_ref: 'r', expected_return_revision: 'r', disposition: 'accepted'})
    await Receiving.receiving(TAURI, null, {kind: 'include', return_ref: 'r', expected_return_revision: 'r'})
    await Receiving.receiving(TAURI, null, {kind: 'recover', return_ref: 'r', expected_return_revision: 'r'})
    await Receiving.receiving(TAURI, null, {kind: 'submit', producer_key: 'p', occurred_at_unix_seconds: 1})
    // Its reads, and its other page writes.
    await Page.readPageOwned(TAURI, LOCATION, true)
    await Page.listWorldPages(TAURI, 'Control/user/flows', undefined, true)
    await Page.writePageField(TAURI, LOCATION, 'sha256:1', 'title', 'p')
    await Acts.duplicatePage(TAURI, LOCATION)
    await Central.central(TAURI, null, {kind: 'inspect'}, true)
    await Central.central(TAURI, null, {kind: 'open-day'})
    await Receiving.receiving(TAURI, null, {kind: 'list'})
    await Receiving.receiving(TAURI, null, {kind: 'read', return_ref: 'r'})
    await Receiving.receiving(TAURI, null, {kind: 'document', source_ref: 's', document_id: 'd'})
  })
  assert.deepEqual(invoked, [
    ['kernel_press', 'page launch'], ['kernel_press', 'page stop'], ['kernel_press', 'page trash'],
    ['kernel_press', 'central ensure-day'], ['kernel_press', 'central initialise-day'], ['kernel_press', 'central close-day'],
    ['kernel_press', 'receiving MutateField'], ['kernel_press', 'receiving MutateMeta'], ['kernel_press', 'receiving Review'],
    ['kernel_press', 'receiving Include'], ['kernel_press', 'receiving Recover'], ['kernel_press', 'receiving Submit'],
    ['kernel_op', 'page read'], ['kernel_op', 'page list'], ['kernel_op', 'page mutate_field'], ['kernel_op', 'page duplicate'],
    ['kernel_op', 'central inspect'], ['kernel_op', 'central open-day'],
    ['kernel_op', 'receiving List'], ['kernel_op', 'receiving Read'], ['kernel_op', 'receiving Document'],
  ])
  // What the shell relays for a frame never takes the shell window's channel, whatever it asks.
  const relayed = await overTheHost(async () => {
    await Bridge.kernelWireOp(TAURI, {op: 'page', request: {operation: 'trash', location: LOCATION, expected_revision: 'sha256:1'}})
    await Bridge.kernelWireOp(TAURI, {op: 'central', project: null, request: {kind: 'close-day', day_ref: 'd', expected_revision: 'r', expected_relations_revision: 'r'}})
  })
  assert.deepEqual(relayed, [['kernel_op', 'page trash'], ['kernel_op', 'central close-day']])
  // The walk bridge has no such channel: a person act goes to /op as any op, and the kernel refuses it there in words.
  const fetched = [], priorFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => { fetched.push([url, JSON.parse(init.body).request.operation]); return {json: async () => ({ok: false, error: 'refused by the kernel'})} }
  try {
    await assert.rejects(Page.launchPage({kind: 'bridge', url: 'http://127.0.0.1:9'}, LOCATION), {message: 'refused by the kernel'})
  } finally { globalThis.fetch = priorFetch }
  assert.deepEqual(fetched, [['http://127.0.0.1:9/op', 'launch']])
})

test('0R-authority.1: the shell\'s acts by the channel are the kernel\'s, read from its own admission (CODE-READING)', () => {
  const body = (file, start) => { const text = read(`desktop/cradle/kernel/src/${file}`); const at = text.indexOf(start); assert.ok(at >= 0, `${file}: ${start}`); return text.slice(at, text.indexOf('\n}\n', at)) }
  const named = (text, prefix) => [...text.matchAll(new RegExp(`${prefix}::(\\w+)`, 'g'))].map(match => match[1]).sort()
  assert.deepEqual(named(body('owner_read.rs', 'pub(crate) fn receiving_reads'), 'ReceivingRequest'), ['Document', 'List', 'Read'], 'Receiving\'s reads, which take no press')
  assert.deepEqual(named(body('owner_write.rs', 'pub(crate) fn central_write'), 'central::Request'), ['CloseDay', 'EnsureDay', 'InitialiseDay'])
  assert.deepEqual(named(body('page.rs', 'pub fn person_act'), 'Request'), ['Launch', 'Stop', 'Trash'])
  const person = read('desktop/cradle/kernel/src/lib.rs')
  const press = person.slice(person.indexOf('pub fn person_press'), person.indexOf('\n}\n', person.indexOf('pub fn person_press')))
  for (const admitted of ['owner_read::receiving_reads(&request)', 'owner_write::central_write(&request)', 'page::person_act(&request).is_some()']) assert.ok(press.includes(admitted), admitted)
  // …and the shell's predicate answers them so, over every request of each.
  const by = op => Bridge.byShellWindow(op)
  for (const key of ['List', 'Read', 'Document']) assert.equal(by({op: 'receiving', project: null, request: {[key]: {}}}), false, key)
  for (const key of ['Submit', 'Review', 'Include', 'Recover', 'MutateField', 'MutateMeta']) assert.equal(by({op: 'receiving', project: null, request: {[key]: {}}}), true, key)
  for (const kind of ['inspect', 'source-location', 'open-day', 'agent-set']) assert.equal(by({op: 'central', project: null, request: {kind}}), false, kind)
  for (const kind of ['ensure-day', 'initialise-day', 'close-day']) assert.equal(by({op: 'central', project: null, request: {kind}}), true, kind)
  for (const operation of ['read', 'list', 'mutate_field', 'duplicate', 'append_quote']) assert.equal(by({op: 'page', request: {operation}}), false, operation)
  for (const operation of ['launch', 'stop', 'trash']) assert.equal(by({op: 'page', request: {operation}}), true, operation)
  assert.equal(by({op: 'invoke_action', invocation: {action: 'central.day.move.record'}}), true)
  for (const op of ['world_read', 'native_expression', 'hosted_native', 'file_bytes']) assert.equal(by({op}), false, op)
})

/** The kernel's person acts (action.rs PERSON_ACTS) and the shell's files that name one in its code, as read at this revision: each is
 * sent from a press of the person's (a device's press, a button, a drag), but for the one sender no press drives (SENT_WITHOUT_A_PRESS).
 * A file that comes to name a person act, or stops, fails here until it is read and placed. */
const NO_PRESS = 'no press: useFieldRecords (CentralDevices.tsx) records what reached you into the Day at each reading of it'
const SHELL_SENDERS = {
  'desktop/cradle/src/agency/NativeAgentLauncher.tsx': ['agent-profile.accept'],
  'desktop/cradle/src/agency/teamFormation.ts': ['central.agent-set.propose'],
  'packages/live-shell/ui/src/agent/agentChainDrag.ts': ['agent-profile.chain-order'],
  'packages/live-shell/ui/src/agent/devices/FactoryDeviceChain.tsx': ['central.agent-set.propose', 'central.agent-set.remove', 'central.agent-set.save'],
  'packages/live-shell/ui/src/agent/devices/messagesBinding.ts': ['agent-profile.accept', 'agent-profile.express', 'agent-profile.remove', 'agent-profile.save', 'central.agent-set.propose', 'central.agent-set.remove', 'central.agent-set.save'],
  'packages/live-shell/ui/src/agent/devices/ownerRoutes.ts': ['control.skills.revision.accept', 'control.skills.revision.discard'],
  'packages/live-shell/ui/src/agent/devices/sessionChainBindings.ts': ['agent-profile.chain-order', 'agent-profile.chain-replace', 'agent-profile.pin-source', 'agent-profile.rename', 'agent-profile.unpin-source'],
  'packages/live-shell/ui/src/central/devices/centralDeviceWrites.ts': ['central.day.close-carry', 'central.day.move.record', 'central.day.rollover', 'central.day.settings.write'],
  'packages/live-shell/ui/src/central/devices/contextWorldBinding.ts': ['central.world-relations.save'],
  'packages/live-shell/ui/src/central/devices/dayBinding.ts': ['central.day.field.record'],
  'packages/live-shell/ui/src/central/devices/groundBindings.ts': ['central.init', 'central.world.reproject.apply', 'projectcentral.ground.apply'],
  'packages/live-shell/ui/src/central/devices/nowsClose.ts': ['central.now.lifecycle'],
  'packages/live-shell/ui/src/central/devices/pageBindings.ts': ['central.init', 'central.world.reproject.apply', 'projectcentral.docs.ensure', 'projectcentral.docs.tier.relate', 'projectcentral.ground.apply'],
  'packages/live-shell/ui/src/central/devices/pageGround.ts': ['projectcentral.adopt', 'projectcentral.docs.ensure', 'projectcentral.docs.tier.relate', 'projectcentral.init', 'projectcentral.migrate'],
  'packages/live-shell/ui/src/central/devices/sourceReturnAccept.ts': ['projectcentral.source.return_accept', 'projectcentral.source.return_reject'],
  'packages/live-shell/ui/src/central/pageActs.ts': ['central.world.name'],
  'packages/live-shell/ui/src/inhabitants/ql/devices/skyPlace.ts': ['central.world.place'],
  'packages/live-shell/ui/src/inhabitants/sdk/chains.ts': ['agent-profile.chain-order'],
  'packages/live-shell/ui/src/settings/windowPages.ts': ['machine.adopt-current', 'work.bring'],
}
const SENT_WITHOUT_A_PRESS = {'central.day.field.record': NO_PRESS}

function sources(root, out = []) {
  for (const name of readdirSync(root)) {
    if (['node_modules', 'dist', 'ui-dist', 'target', 'tests', '.git'].includes(name)) continue
    const at = join(root, name)
    if (statSync(at).isDirectory()) sources(at, out)
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name) && !name.endsWith('.d.ts')) out.push(at)
  }
  return out
}

test('0R-authority.4: the shell\'s senders of a person act are pinned, and its one sender no press drives is named (CODE-READING + behaviour)', async () => {
  const acts = [...read('desktop/cradle/kernel/src/action.rs').match(/pub const PERSON_ACTS: \[&str; \d+\] = \[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map(match => match[1])
  assert.ok(acts.includes('central.day.field.record') && acts.length >= 40, 'the kernel\'s person acts are read')
  const found = {}
  for (const root of ['packages', 'desktop/cradle/src', 'desktop/cradle/expressions-app']) {
    for (const file of sources(join(repo, root))) {
      const text = readFileSync(file, 'utf8')
      // A string of the code's own, in either quote (the shell's words name acts in backticks, and are not senders).
      const named = acts.filter(act => text.includes(`'${act}'`) || text.includes(`"${act}"`)).sort()
      if (named.length) found[relative(repo, file)] = named
    }
  }
  assert.deepEqual(found, SHELL_SENDERS, 'a file that names a person act is read and placed here, with who sends it')
  // The one sender no press drives: useFieldRecords offers the Day's reading to the window's recorder from an effect, and the recorder sends
  // central.day.field.record by recordFieldItems, which goes by the shell window's channel as the person's act.
  const devices = read('packages/live-shell/ui/src/central/devices/CentralDevices.tsx')
  const hook = devices.slice(devices.indexOf('function useFieldRecords('), devices.indexOf('\n}\n', devices.indexOf('function useFieldRecords(')))
  assert.match(hook, /useEffect\(\(\) => \{\s*fieldRecording\.transport = transport\s*fieldRecorder\.offer\(recording\.dayRef, recording\.records\)/, 'it is offered from an effect, at each reading')
  assert.match(devices, /new FieldRecorder\(\(dayRef, records\) => \(fieldRecording\.transport \? recordFieldItems\(/)
  for (const [act, why] of Object.entries(SENT_WITHOUT_A_PRESS)) assert.ok(acts.includes(act) && why.startsWith('no press'), act)
  const invoked = await overTheHost(() => Writes.recordFieldItems(TAURI, 'central:day:2026-11-09', [{kind: 'message'}]))
  assert.deepEqual(invoked, [['kernel_press', 'invoke_action central.day.field.record']], 'sent with no press, by the shell window\'s channel')
  // The kernel's own words say so (flow.rs Channel, action.rs PERSON_ACTS).
  const flow = read('desktop/cradle/kernel/src/flow.rs')
  assert.match(flow, /useFieldRecords/)
  assert.match(read('desktop/cradle/kernel/src/action.rs'), /no press of the person's sends it/)
})

// ---- 0R-authority.8: no words point at a press that does not exist ----
// REAL: pressSubjectAction (useExpressionApplication.ts), the press of a subject's Action by the Verso, the entity inspector and Nara,
// over the kernel bridge; the host's invoke is a SCRIPTED STUB that answers as the kernel's owner does (expression.rs Request::Invoke:
// a person act withheld with the offer it records). CODE-READING: which buttons press through it.
async function overTheOwner(answer, run) {
  const asked = []
  const priorWindow = globalThis.window
  globalThis.window = {__TAURI_INTERNALS__: {invoke: async (command, args) => {
    const op = args.op
    asked.push([command, op.op === 'expression' ? `expression ${op.request.operation}` : `${op.op} ${op.invocation?.action}`, op])
    return answer(op)
  }}}
  try { return [await run(), asked] } finally {
    if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow
  }
}

test('0R-authority.8: a subject\'s Action pressed in the shell runs a person act by the shell window\'s channel, exactly as its owner offered it', async () => {
  const {pressSubjectAction} = await import('../../../../desktop/cradle/src/expression/useExpressionApplication.ts')
  const press = {operation: 'invoke', expression_ref: 'expression:v', expected_revision: 3, entity_ref: 'expression:v:entity:page', action_ref: 'central.world.name', input: {at: 1}, project: 'p'}
  const offer = {offer_ref: 'invoke-offer:1', expression_ref: 'expression:v', scene_ref: 'expression:v:scene:main', trigger_ref: '', entity_ref: 'expression:v:entity:page',
    action_ref: 'central.world.name', target_ref: 'central:file:p.md', trigger_revision: 'sha256:0', action_title: 'Name the world', target_name: 'Page', reads_only: false, authority_requirement: []}
  const withheld = {state: 'withheld', action_ref: 'central.world.name', target_ref: 'central:file:p.md', detail: 'central.world.name is the person\'s own act… Its offer stands: the person\'s press of it in the shell runs it once.', offer}
  const owner = held => op => op.op === 'expression' ? {result: 'expression', data: held} : {result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: op.invocation.action, data: {named: true}}}
  // A person act: the invoke is asked first (its guards stand), and the offered Action goes by the shell window's channel.
  const [ran, asked] = await overTheOwner(owner(withheld), () => pressSubjectAction(TAURI, press))
  assert.deepEqual(asked.map(([command, named]) => [command, named]), [['kernel_op', 'expression invoke'], ['kernel_press', 'invoke_action central.world.name']])
  assert.deepEqual(asked[1][2], {op: 'invoke_action', project: 'p', invocation: {action: 'central.world.name', target_ref: 'central:file:p.md', input: {at: 1}}}, 'exactly the offered Action, on its target')
  assert.deepEqual(ran, {state: 'action_result', action_ref: 'central.world.name', target_ref: 'central:file:p.md', pressed: true,
    dispatch: {state: 'invoked', owner_operation: 'central.world.name', data: {named: true}}}, 'the press runs, and says so in the invoke\'s shape')
  // What the owner runs on the invoke is its answer: one call, by kernel_op.
  const result = {state: 'action_result', action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md', writes: true, dispatch: {state: 'invoked'}}
  const [plain, once] = await overTheOwner(owner(result), () => pressSubjectAction(TAURI, {...press, action_ref: 'central.pages.stamp'}))
  assert.deepEqual([plain, once.map(([command]) => command)], [result, ['kernel_op']])
  // An answer that is not this press's offer (another entity's, another Action's, none) is said as it came, and nothing is pressed.
  for (const other of [{...withheld, offer: {...offer, entity_ref: 'expression:v:entity:other'}}, {...withheld, offer: {...offer, action_ref: 'central.world.place'}},
    {state: 'withheld', detail: 'Refresh stale/unavailable/withheld owner readings before invoking'}, {state: 'binding_unavailable', detail: 'stale'}]) {
    const [answered, calls] = await overTheOwner(owner(other), () => pressSubjectAction(TAURI, press))
    assert.deepEqual([answered, calls.length], [other, 1])
  }
  // A press the owner refuses is said in its words.
  const [, refused] = await overTheOwner(op => op.op === 'expression' ? {result: 'expression', data: withheld} : null, async () => {
    await assert.rejects(pressSubjectAction(TAURI, press), {message: 'central.world.name did not run.'})
  })
  assert.equal(refused.length, 2)
  // The shell's buttons press through it: the Verso (ExpressionView) and the entity inspector (parts.tsx) by the composer's run, Nara directly.
  const hook = read('desktop/cradle/src/expression/useExpressionApplication.ts')
  assert.match(hook, /const data=op\.operation==="invoke"\?await pressSubjectAction\(kernel\.transport,op\):await request\(op\);/)
  assert.match(read('desktop/cradle/src/expression/ExpressionView.tsx'), /onInvokeAction=\{\(entityRef,actionRef\)=>void run\(\{operation:"invoke",/)
  assert.match(read('desktop/cradle/src/expression/parts.tsx'), /onClick=\{\(\)=>void run\(\{operation:"invoke",/)
  assert.match(read('desktop/cradle/src/nara/NaraSurface.tsx'), /const returned = await pressSubjectAction\(kernel\.transport, \{operation: 'invoke',/)
  // No other sender of the owner's invoke stands in the shell. The Being encounter's "invoke" is AIKit's encounter (op being_encounter):
  // it runs no Action and carries no token, so it is not one.
  const invokers = {}
  for (const root of ['packages', 'desktop/cradle/src', 'desktop/cradle/expressions-app']) {
    for (const file of sources(join(repo, root))) {
      if (/operation:\s*["']invoke["']/.test(readFileSync(file, 'utf8'))) invokers[relative(repo, file)] = true
    }
  }
  assert.deepEqual(Object.keys(invokers).sort(), ['desktop/cradle/src/explore/BeingEncounter.tsx', 'desktop/cradle/src/expression/ExpressionView.tsx',
    'desktop/cradle/src/expression/parts.tsx', 'desktop/cradle/src/expression/types.ts', 'desktop/cradle/src/expression/useExpressionApplication.ts',
    'desktop/cradle/src/nara/NaraSurface.tsx'])
  assert.match(read('desktop/cradle/src/explore/BeingEncounter.tsx'), /kernelOp\(kernel\.transport,\{op:"being_encounter",request:\{operation:"invoke",agent_ref:/)
})
