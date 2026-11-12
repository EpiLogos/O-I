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
  // Setup's Keep of the world's Music folder (round 54's Central follow-up): Central registers it on the person's grant, so the Keep goes
  // by the channel as the kernel takes it there; its Preview is a read.
  assert.ok(press.includes('request: request @ ground_music::Request::Keep { .. }'), 'the kernel takes the Keep by the channel')
  assert.equal(by({op: 'ground_music', request: {operation: 'keep', acceptance_ref: 'a', expected_digest: 'd'}}), true, 'keep')
  assert.equal(by({op: 'ground_music', request: {operation: 'preview'}}), false, 'preview')
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
  'packages/live-shell/ui/src/agent/devices/sessionChainBindings.ts': ['agent-profile.chain-admit', 'agent-profile.chain-order', 'agent-profile.chain-replace', 'agent-profile.pin-source', 'agent-profile.rename', 'agent-profile.unpin-source'],
  'packages/live-shell/ui/src/central/devices/centralDeviceWrites.ts': ['central.day.close-carry', 'central.day.move.record', 'central.day.rollover', 'central.day.settings.write'],
  'packages/live-shell/ui/src/central/devices/contextWorldBinding.ts': ['central.world-relations.save'],
  // dayBinding.ts names the act (DAY_ENTRY_PART_ACTION, from O-I main, #858 SF06); its one sender is centralDeviceWrites.ts dayEntryPart,
  // by bringDayEntry, on the person's press of Show (SHOW_SENDS below). It names the field record's act too (useFieldRecords, no press).
  'packages/live-shell/ui/src/central/devices/dayBinding.ts': ['central.day.entry.part', 'central.day.field.record'],
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

/** The Show of an entry of today's Day (O-I #858 SF06, on O-I main since #941; DLW build ruling 2026-11-09, round 896 1R): the act
 * central.day.entry.part has one sender, dayEntryPart, called only by bringDayEntry; the Day device holds that for the World
 * (holdDayEntries), and the World's Show calls it (atlasDevices.ts actYours) when the person holds Show on the face: partShow, a key of
 * the face's own that no declared row, relay or default sets (atlas-earth__globe-engine.tsx, the Action held). The act goes by the
 * shell window's channel (kernel_press), as the person's. CODE-READING for who calls whom; REAL dayEntryPart over the scripted host. */
async function SHOW_SENDS() {
  const callers = name => Object.keys(Object.fromEntries(['packages', 'desktop/cradle/src', 'desktop/cradle/expressions-app']
    .flatMap(root => sources(join(repo, root))).filter(file => readFileSync(file, 'utf8').includes(name)).map(file => [relative(repo, file), true]))).sort()
  const writes = read('packages/live-shell/ui/src/central/devices/centralDeviceWrites.ts')
  assert.ok(writes.includes('const answer = await centralWrite(transport, DAY_ENTRY_PART_ACTION, {day_ref: dayRef, expected_revision: expectedRevision, ...select})'))
  assert.deepEqual(callers('DAY_ENTRY_PART_ACTION'), ['packages/live-shell/ui/src/central/devices/centralDeviceWrites.ts', 'packages/live-shell/ui/src/central/devices/dayBinding.ts'])
  assert.deepEqual(callers('dayEntryPart('), ['packages/live-shell/ui/src/central/devices/centralDeviceWrites.ts'])
  const bring = writes.slice(writes.indexOf('export async function bringDayEntry('), writes.indexOf('\n}\n', writes.indexOf('export async function bringDayEntry(')))
  assert.match(bring, /const part = await dayEntryPart\(transport, offered\.dayRef, offered\.revision, offer\.select\)/, 'bringDayEntry asks it')
  assert.deepEqual(callers('bringDayEntry('), ['packages/live-shell/ui/src/central/devices/CentralDevices.tsx', 'packages/live-shell/ui/src/central/devices/centralDeviceWrites.ts'])
  assert.ok(read('packages/live-shell/ui/src/central/devices/CentralDevices.tsx').includes('bring: offer => bringDayEntry(transport, {dayRef, revision}, offer)'), 'the Day device holds it for the World')
  assert.deepEqual(callers('.bring('), ['packages/live-shell/ui/src/inhabitants/ql/devices/atlasDevices.ts'])
  const atlas = read('packages/live-shell/ui/src/inhabitants/ql/devices/atlasDevices.ts')
  const yours = atlas.slice(atlas.indexOf('async function actYours('), atlas.indexOf('\n}\n', atlas.indexOf('async function actYours(')))
  assert.match(yours, /if \(act\.act === 'show' && act\.part && offered\(act\.part\.id\)\) \{[\s\S]*const part = await day\.bring\(offer\)/, 'the Show calls it')
  assert.match(atlas, /else if \(isYourAct\(change\.key\) && reading\.field\) await actYours\(change\.key, reading, reading\.field\)/)
  // partShow is the face's own: named by the World's binding and its face alone, pressed by the held Show, and no declared row.
  assert.deepEqual(callers('partShow'), ['packages/live-shell/ui/src/inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx', 'packages/live-shell/ui/src/inhabitants/ql/devices/atlasDevices.ts'])
  assert.match(read('packages/live-shell/ui/src/inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx'), /<Action \{\.\.\.st\(p, 'partShow'\)\} label="Show" hold [^>]*\n\s*onPress=\{\(\) => p\.set\('partShow', Date\.now\(\)\)\} \/>/)
  // …and it goes by the shell window's channel.
  const invoked = await overTheHost(() => assert.rejects(Writes.dayEntryPart(TAURI, 'central:day:2026-11-09', 'rev', {field_id: 'p1_must'}), /answered no part to show/))
  assert.deepEqual(invoked, [['kernel_press', 'invoke_action central.day.entry.part']], 'the Show\'s act, by the shell window\'s channel')
}

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
  // central.day.entry.part is sent on the person's press of Show, by the shell window's channel (SHOW_SENDS).
  await SHOW_SENDS()
  // The kernel's own words say so (flow.rs Channel, action.rs PERSON_ACTS).
  const flow = read('desktop/cradle/kernel/src/flow.rs')
  assert.match(flow, /useFieldRecords/)
  assert.match(read('desktop/cradle/kernel/src/action.rs'), /no press of the person's sends it/)
})

// ---- 1R-authority.3 (F3): no frame word is the person's press ----
// REAL: the bridge's wired transport, the cradle's kernel relay (hostedApp.ts relayKernelChannel) over a scripted frame and window, the
// shell's offer of the Nara Return (nativeExpressionCommands.ts dayReturnOffers). CODE-READING: which modules relay for a frame, and
// that the Nara relay's Return runs on the shell's own transport only inside the offer the person presses.

/** The modules that relay a frame's words: every source that listens for a window's messages, and the boundary's owners the host's
 * relay calls (cradle.ts, techne.ts). */
function frameRelays() {
  const found = []
  for (const root of ['packages/expressions-boundary/src', 'packages/live-shell/ui/src', 'desktop/cradle/src']) {
    for (const file of sources(join(repo, root))) if (/addEventListener\(\s*['"]message['"]/.test(readFileSync(file, 'utf8'))) found.push(relative(repo, file))
  }
  return [...found, 'packages/expressions-boundary/src/cradle.ts', 'packages/expressions-boundary/src/techne.ts'].sort()
}

test('1R-authority.3: no frame relay imports kernelOp, and every op a frame\'s word asks goes by kernel_op on a wired transport', async () => {
  const relays = frameRelays()
  for (const file of ['desktop/cradle/src/expressions/naraChannel.ts', 'desktop/cradle/src/expressions/nativeChannel.ts', 'desktop/cradle/src/expressions/hostedApp.ts', 'desktop/cradle/src/expressions/PointCloudHost.tsx']) assert.ok(relays.includes(file), file)
  for (const file of relays) {
    const text = read(file)
    const imported = [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*kernel\/bridge['"]/g)].flatMap(match => match[1].split(',').map(name => name.trim().replace(/^type\s+/, '')))
    for (const name of ['kernelOp', 'kernelReadSend', 'kernelPress']) assert.ok(!imported.includes(name), `${file} imports ${name}`)
  }
  // A wired transport sends a person act by kernel_op, whichever helper sends it; a press on it is refused in words and asks nothing.
  const wire = Bridge.wireTransport(TAURI)
  assert.equal(Bridge.wireTransport(wire), wire)
  assert.equal(Bridge.isWireTransport(TAURI), false)
  let pressed
  const invoked = await overTheHost(async () => {
    await Page.launchPage(wire, LOCATION)
    await Central.central(wire, null, {kind: 'close-day', day_ref: 'd', expected_revision: 'r', expected_relations_revision: 'r'})
    await Bridge.kernelOp(wire, {op: 'invoke_action', project: null, invocation: {action: 'central.world.name', target_ref: 't', input: {}}}).catch(() => {})
    pressed = await Bridge.kernelPress(wire, {op: 'invoke_action', project: null, invocation: {action: 'central.world.name', target_ref: 't', input: {}}})
    await Page.launchPage(TAURI, LOCATION)
  })
  assert.deepEqual(invoked, [['kernel_op', 'page launch'], ['kernel_op', 'central close-day'], ['kernel_op', 'invoke_action central.world.name'], ['kernel_press', 'page launch']])
  assert.deepEqual(pressed, {outcome: null, error: Bridge.FRAME_PRESSES_NOTHING})
  // The cradle's kernel relay: a frame's expression op goes by kernel_op, read only from the frame's window at its address's origin,
  // and answered to that origin alone.
  const {relayKernelChannel} = await import('../../../../desktop/cradle/src/expressions/hostedApp.ts')
  const FRAME = 'oi-material://localhost', posted = [], win = new EventTarget()
  const frame = Object.assign(new EventTarget(), {src: `${FRAME}/__application/expressions/index.html`})
  frame.contentWindow = {postMessage(data, targetOrigin) {posted.push([data.kind, targetOrigin])}}
  const prior = {window: globalThis.window, IntersectionObserver: globalThis.IntersectionObserver}
  globalThis.IntersectionObserver = class {observe() {} disconnect() {}}
  const asked = []
  globalThis.window = Object.assign(win, {__TAURI_INTERNALS__: {invoke: async (command, args) => {asked.push([command, args.op.op, args.op.request?.operation]); return {result: 'expression', data: {ok: true}}}}})
  try {
    const stop = relayKernelChannel(frame, TAURI)
    const message = (origin, req) => win.dispatchEvent(Object.assign(new Event('message'), {source: frame.contentWindow, origin, data: {v: 1, kind: 'kernel-expression', req, request: {operation: 'inspect', expression_ref: 'expression:v'}}}))
    message('https://elsewhere.example', 1)
    message(FRAME, 2)
    await new Promise(resolve => setTimeout(resolve, 5))
    stop()
    assert.deepEqual(asked, [['kernel_op', 'expression', 'inspect']], 'the foreign origin asked nothing; the frame\'s op went by kernel_op')
    assert.ok(posted.length >= 2 && posted.every(([, origin]) => origin === FRAME), JSON.stringify(posted))
    assert.ok(posted.some(([kind]) => kind === 'kernel-expression-result'))
  } finally {
    globalThis.window = prior.window; globalThis.IntersectionObserver = prior.IntersectionObserver
    if (prior.window === undefined) delete globalThis.window
    if (prior.IntersectionObserver === undefined) delete globalThis.IntersectionObserver
  }
  // The Nara relay: every op on its wired transport; the shell's own transport only inside the Return the shell offers for the press.
  const nara = read('desktop/cradle/src/expressions/naraChannel.ts')
  const relay = nara.slice(nara.indexOf('export function relayNaraChannel('), nara.indexOf('\n}\n', nara.indexOf('export function relayNaraChannel(')))
  // Its code, comments and strings blanked: the shell's transport is named by the signature, the wire, and the offered Return alone.
  const code = relay.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''")
  assert.deepEqual(code.match(/\w*\(?\s*\bshell\b\s*[:,)]/g).map(use => use.trim()), ['shell:', 'wireTransport(shell)', 'proposeAnswerForDay(shell,'],
    'the shell\'s transport: the wire, and the offered Return')
  assert.match(relay, /const offer: DayReturnOffer = \{[\s\S]*run: async \(\) => \{[\s\S]*await proposeAnswerForDay\(shell, day, field\.id, held\.answer\)/)
  assert.match(relay, /const refused = owner\.offerDayReturn\(offer\);\s*if \(refused !== null\) throw new Error\(refused\);/)
  assert.match(read('packages/live-shell/ui/src/panels/expressions.tsx'), /createCradleOwners\(access\.transport, \{[^}]*offerDayReturn: acts\.dayReturns\}\)/)
})

test('1R-authority.3: the shell offers Nara\'s Return to the Day beside the Info line, for the person\'s press, never over another act', async () => {
  const {dayReturnOffers, OFFER_STANDS, dayReturnOfferWords} = await import('../src/components/nativeExpressionCommands.ts')
  let shown = null
  const offers = dayReturnOffers({show: offer => {shown = offer}, shown: () => shown})
  const ran = []
  const offer = {question: 'What \u2066moves\u2069 here?', civil_date: '2026-11-09', field: 'Must', run: async () => {ran.push('run'); return 'Sent to Inbox for review.'}}
  assert.equal(offers(offer), null)
  assert.equal(shown.act, 'Return')
  assert.equal(shown.label, 'Nara')
  assert.equal(shown.words, dayReturnOfferWords(offer))
  assert.match(shown.words, /^Return Nara's answer to “\u2068What moves here\?\u2069” to your Day of 2026-11-09, field “\u2068Must\u2069”: /)
  assert.deepEqual(ran, [], 'offered, not run')
  // The person's press runs it once.
  const standing = shown
  assert.equal(await standing.run(), 'Sent to Inbox for review.')
  assert.deepEqual(ran, ['run'])
  // Another act standing: the Return is refused in words and the other act stays.
  const other = {label: 'Expressions', words: 'Run its trigger', act: 'Run', run: async () => ''}
  shown = other
  assert.equal(offers(offer), OFFER_STANDS)
  assert.equal(shown, other)
  // The relay's withdraw takes only its own offer away.
  assert.equal(offers(null), null)
  assert.equal(shown, other)
  shown = null
  assert.equal(offers(offer), null)
  assert.notEqual(shown, null)
  assert.equal(offers(null), null)
  assert.equal(shown, null)
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

// ---- Round 896 item 4: Factory's acts on the person's grant go by the shell window's channel ----
// REAL: the shell's two Factory senders (the Desk's factoryReads.ts factoryOwner, the devices' ownerRoutes.ts factoryOwnerWrite) over the
// kernel bridge; the host's invoke is a SCRIPTED STUB. CODE-READING: the kernel's own list (factory.rs OwnerRequest::person_act, its
// task_offer_verb capabilities) and its admission (lib.rs person_press), which the shell's predicate answers over every Factory request.
test('item 4: Factory\'s acts on the person\'s grant go by the shell window\'s channel, and its readings and carried acts by kernel_op', async () => {
  const factory = read('desktop/cradle/kernel/src/factory.rs')
  const kebab = name => name.replace(/[A-Z]/g, (letter, at) => (at ? '-' : '') + letter.toLowerCase())
  const enumBody = factory.slice(factory.indexOf('pub enum OwnerRequest {'), factory.indexOf('\n}\n', factory.indexOf('pub enum OwnerRequest {')))
  const kinds = [...enumBody.matchAll(/^ {4}([A-Z]\w+) *[{(,]/gm)].map(match => kebab(match[1]))
  assert.ok(kinds.length >= 50 && kinds.includes('task-offer-act') && kinds.includes('pads-read'), `the kernel's Factory requests are read (${kinds.length})`)
  const personAct = factory.slice(factory.indexOf('pub fn person_act(&self)'), factory.indexOf('\n    }\n', factory.indexOf('pub fn person_act(&self)')))
  const persons = [...personAct.matchAll(/OwnerRequest::(\w+) \{ \.\. \}/g)].map(match => kebab(match[1])).sort()
  assert.deepEqual(persons, ['attempt-launch', 'attempt-receiving', 'attempt-request-cancellation', 'attempt-retry', 'custody-hold', 'pads-preset-recall',
    'pads-preset-save', 'pads-write', 'rack-macros-write', 'run-close', 'wave-act'], 'the kernel\'s Factory acts on the person\'s grant')
  assert.match(personAct, /OwnerRequest::TaskOfferAct \{ verb, \.\. \} => match task_offer_verb\(verb\) \{\s*Some\(\(command, Some\(_\), _\)\) => command,/, 'a task offer\'s act is one where it presents a capability')
  const verbs = factory.slice(factory.indexOf('pub fn task_offer_verb('), factory.indexOf('\n}\n', factory.indexOf('pub fn task_offer_verb(')))
  // Every arm of the match, counted loosely: each `"…" =>` before the catch-all `_ =>` (1Z.1 item 3, the review's finding 2: a verb the
  // reading missed was missing from both sides, and the test passed). Each arm's verb is read with whether it presents a capability: its
  // second element is anything but `None`, whatever constant names it.
  const catchAll = verbs.indexOf('_ =>')
  assert.ok(catchAll > 0, 'task_offer_verb ends in its catch-all')
  const arms = [...verbs.slice(0, catchAll).matchAll(/^\s*"([^"]+)"\s*=>/gm)].map(match => match[1])
  const offerVerbs = [...verbs.slice(0, catchAll).matchAll(/"([^"]+)"\s*=>\s*\(\s*"[^"]*",\s*([^,]+?)\s*,/g)].map(match => [match[1], match[2] !== 'None'])
  // Every act on a task offered, by name (1Z: main's #945 added offer-check, and a count of 8 failed by number): the kernel's verbs, each
  // with whether it presents a capability, are exactly the shell's (bridge.ts FACTORY_OFFER_VERBS), so a verb either side adds fails here
  // by its name until the other names it too. The counts are equal, never a lower bound.
  assert.ok(arms.includes('offer-check'), `every act on a task offered is read (${arms})`)
  assert.deepEqual(offerVerbs.map(([verb]) => verb), arms, 'each arm is read with its capability')
  assert.equal(Bridge.FACTORY_OFFER_VERBS.size, arms.length, `the shell names as many acts as the kernel's arms (${[...Bridge.FACTORY_OFFER_VERBS.keys()]} / ${arms})`)
  assert.deepEqual(Object.fromEntries([...Bridge.FACTORY_OFFER_VERBS].sort()), Object.fromEntries([...offerVerbs].sort()), 'the shell names each of the kernel\'s acts on a task offered, and whose it is')
  const press = read('desktop/cradle/kernel/src/lib.rs')
  assert.ok(press.slice(press.indexOf('pub fn person_press'), press.indexOf('\n}\n', press.indexOf('pub fn person_press'))).includes('KernelOp::FactoryOwner { request, .. } if request.person_act().is_some()'), 'the press admits them')
  // The shell's predicate answers the kernel's list, over every Factory request and every act on a task offered.
  const by = request => Bridge.byShellWindow({op: 'factory_owner', request})
  for (const kind of kinds.filter(kind => kind !== 'task-offer-act')) assert.equal(by({kind}), persons.includes(kind), kind)
  for (const [verb, capability] of offerVerbs) assert.equal(by({kind: 'task-offer-act', verb}), capability, verb)
  assert.equal(by({kind: 'task-offer-act', verb: 'offer-steal'}), false, 'an act Factory does not name is no one\'s')
  assert.equal(by({kind: 'task-offer-act'}), false)
  // The shell's senders, over the host: each act on the person's grant by kernel_press, every reading and carried act by kernel_op.
  const {factoryOwner} = await import('../../../../desktop/cradle/src/contributions/factory/desk/factoryReads.ts')
  const {factoryOwnerWrite} = await import('../src/agent/devices/ownerRoutes.ts')
  const sent = []
  const prior = globalThis.window
  globalThis.window = {__TAURI_INTERNALS__: {invoke: async (command, args) => {
    sent.push([command, args.op.request.kind + (args.op.request.verb ? ` ${args.op.request.verb}` : '')])
    return {result: 'factory_development_reading', data: {}}
  }}}
  try {
    await factoryOwner(TAURI, {kind: 'run-close', state_path: '/s.json', run_ref: 'run:1', recognition_ref: 'recognition:1'})
    await factoryOwner(TAURI, {kind: 'attempt-receiving', state_path: '/s.json', run_ref: 'run:1', attempt_ref: 'attempt:1'})
    await factoryOwner(TAURI, {kind: 'workflow-inspect', state_path: '/s.json', run_ref: 'run:1'})
    await factoryOwner(TAURI, {kind: 'recognise', state_path: '/s.json', journey_ref: 'j', subject_ref: 's'})
    for (const kind of persons.filter(kind => kind !== 'run-close' && kind !== 'attempt-receiving')) await factoryOwnerWrite(TAURI, {kind, state_path: '/s.json'}, kind)
    for (const verb of ['offer-make', 'offer-revoke', 'offer-accept', 'offer-take', 'offer-check', 'offer-return', 'offer-receive', 'offer-revoked']) {
      await factoryOwnerWrite(TAURI, {kind: 'task-offer-act', state_path: '/s.json', verb, request: {}}, verb)
    }
    await factoryOwnerWrite(TAURI, {kind: 'pads-read', state_path: '/s.json', project_ref: 'p'}, 'pads-read')
  } finally {
    if (prior === undefined) delete globalThis.window; else globalThis.window = prior
  }
  assert.deepEqual(sent, [
    ['kernel_press', 'run-close'], ['kernel_press', 'attempt-receiving'], ['kernel_op', 'workflow-inspect'], ['kernel_op', 'recognise'],
    ['kernel_press', 'attempt-launch'], ['kernel_press', 'attempt-request-cancellation'], ['kernel_press', 'attempt-retry'], ['kernel_press', 'custody-hold'],
    ['kernel_press', 'pads-preset-recall'], ['kernel_press', 'pads-preset-save'], ['kernel_press', 'pads-write'], ['kernel_press', 'rack-macros-write'],
    ['kernel_press', 'wave-act'],
    ['kernel_press', 'task-offer-act offer-make'], ['kernel_press', 'task-offer-act offer-revoke'], ['kernel_press', 'task-offer-act offer-accept'],
    ['kernel_press', 'task-offer-act offer-take'], ['kernel_op', 'task-offer-act offer-check'], ['kernel_op', 'task-offer-act offer-return'],
    ['kernel_op', 'task-offer-act offer-receive'], ['kernel_op', 'task-offer-act offer-revoked'], ['kernel_op', 'pads-read'],
  ])
  // A frame's relay sends none of them by the shell window's channel.
  const relayed = await overTheHost(() => Bridge.kernelWireOp(TAURI, {op: 'factory_owner', request: {kind: 'pads-write', state_path: '/s.json'}}))
  assert.deepEqual(relayed, [['kernel_op', 'factory_owner factory_owner']])
})
