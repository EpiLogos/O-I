import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'

// T-DEVICES-FACTORY: Factory's agent chain (gateway → agent → skills → scope → landing) as devices of the runtime, and the skills
// rack as a rack. The rows are the verified address table's, the Live semantics the admitted manifests', the readings the
// owners', the writes the rows' own write paths. Loader as live-browser-chain.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
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
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const family = await import('../src/inhabitants/familyManifest.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const {AGENT_SHELL_ADDRESS_TABLE, agentAddress, agentAddressesForDevice} = await import('../src/inhabitants/agentParamAddresses.ts')
const {validateFaceSemantic} = await import('../src/inhabitants/sdk/semantics.ts')
const {compactRows, lightOf} = await import('../src/frame/devices/deviceRuntime.ts')
const {DeviceView} = await import('../src/frame/devices/DeviceView.tsx')
const door = await import('../src/frame/devices/deviceDoor.ts')
const {DevicePool} = await import('../src/frame/devices/DevicePool.tsx')
const {DeviceFullPane} = await import('../src/frame/devices/devicePane.tsx')
const model = await import('../src/agent/devices/agentChainDevices.ts')
const pictures = await import('../src/agent/devices/AgentDevicePictures.tsx')
const selection = await import('../src/agent/devices/skillRackSelection.ts')

family.resetFamilyManifestsForTest()
loadAgentShellFamilies()

const html = element => renderToStaticMarkup(element)
const SLOTS = ['gateway', 'agent', 'skillset', 'world', 'git']
const SHELL = {effort: 'high', steer: true, heartbeat: true, writeArm: false}
const fired = row => ({kind: 'fired', channel: 'shell', writePath: row.writePath, note: 'acknowledged'})
const ROSTER = {schema: 'central.agent-profile-roster/v1', profiles: [
  {accepted: true, profile: {agent_ref: 'agent/ada', skill_refs: ['vault-read', 'gazetteer']}},
  {accepted: true, profile: {agent_ref: 'agent/ash', skill_refs: ['gazetteer']}},
  {accepted: false, profile: {agent_ref: 'agent/zed', skill_refs: ['zeta']}},
]}
const chain = (over = {}) => model.agentChainDevices({
  sessionRef: over.sessionRef ?? null,
  reading: {...model.INITIAL_READING, ...over.reading},
  shell: {...SHELL, ...over.shell},
}, over.write ?? (async row => fired(row)))
const slotOf = (set, id) => set.find(entry => entry.slot.id === id)
const context = (over = {}) => ({reading: {...model.INITIAL_READING, ...over.reading}, sessionRef: over.sessionRef ?? null, onFrames() {}, onThread() {}})
const params = markup => [...markup.matchAll(/data-param="([^"]+)"/g)].map(match => match[1])
const read = path => readFileSync(new URL(`../src/agent/${path}`, import.meta.url), 'utf8')

test('the chain is the admitted slots in the declared order, each a device over the address table\'s rows — none invented, none dropped', () => {
  const set = chain()
  assert.deepEqual(set.map(entry => entry.device.id), SLOTS.map(slot => `factory:${slot}`))
  for (const slot of SLOTS) {
    const {device} = slotOf(set, slot)
    const table = agentAddressesForDevice(slot)
    assert.deepEqual([...device.rows.map(row => row.key)].sort(), table.map(row => row.key).sort(), `${slot}: the table's rows`)
    for (const row of device.rows) {
      const address = agentAddress(slot, row.key)
      assert.equal(row.family, address.family, `${slot}/${row.key}: one owning family`)
      assert.ok(row.title && row.group, `${slot}/${row.key}: a label and a group`)
      assert.ok(!row.writePath || row.writePath === address.writePath, `${slot}/${row.key}: a write path is the table's own, never added`)
    }
  }
  assert.equal(AGENT_SHELL_ADDRESS_TABLE.length, SLOTS.flatMap(slot => agentAddressesForDevice(slot)).length, 'the table has no row off the chain')
})

test('every device keeps its Live semantic and invariant (lock §1, §5) — the gate finds no fault in any of the five', () => {
  const set = chain({reading: {chains: model.rosterChains(ROSTER)}})
  assert.deepEqual(set.map(entry => entry.device.face.liveSemantic), ['return', 'device-instrument', 'rack', 'device-audio-fx', 'return'])
  for (const {slot, device} of set) assert.deepEqual(validateFaceSemantic(device.face, {family: slot.family}), [], `${slot.id} keeps its semantic`)
  const rack = slotOf(set, 'skillset').device.face
  assert.deepEqual(rack.invariant.chains, ['gazetteer', 'vault-read', 'zeta'], 'the rack declares the chains it holds')
  assert.ok(rack.invariant.chainSelector, 'and its chain selector')
  assert.equal(slotOf(chain(), 'skillset').device.face.invariant.chains.length >= 1, true, 'a rack never declares fewer than one chain')
})

test('compact is a picture and at most four controls: the rack\'s are its macros, the others their most-played rows', () => {
  const set = chain()
  const compact = slot => compactRows(slotOf(set, slot).device.rows).map(row => row.key)
  assert.deepEqual(compact('gateway'), ['transport', 'approvals', 'connect', 'readiness'])
  assert.deepEqual(compact('agent'), ['autonomy', 'effort', 'budget-used', 'input'], 'the mockup\'s four: autonomy, effort, budget, input')
  assert.deepEqual(compact('skillset'), ['thoroughness', 'test-depth', 'reach', 'risk'])
  assert.deepEqual(compact('world'), ['write-mode'])
  assert.deepEqual(compact('git'), ['commit-policy', 'push-policy', 'land'])
  for (const {device} of set) assert.ok(compactRows(device.rows).length <= 4)
  assert.ok(slotOf(set, 'skillset').device.rows.every(row => row.macro && !row.writePath), 'the rack\'s macros are macro rows, and readings: ai-kit has no writer for them')
})

test('a light is the owner\'s reading: dark while the owner has not answered, lit or unlit as it reports', () => {
  const dark = chain()
  assert.deepEqual(SLOTS.map(slot => lightOf(slotOf(dark, slot).device)), ['unknown', 'off', 'unknown', 'off', 'unknown'], 'gateway, skills and git stay dark until read; the agent and the write arm are the shell\'s own known state')
  const answered = chain({sessionRef: 'session:1', shell: {writeArm: true}, reading: {gatewayAdmitted: true, gitAdmitted: false, chains: model.rosterChains(ROSTER)}})
  assert.deepEqual(SLOTS.map(slot => lightOf(slotOf(answered, slot).device)), ['on', 'on', 'on', 'on', 'off'])
  assert.equal(lightOf(slotOf(chain({reading: {chains: []}}), 'skillset').device), 'off', 'a roster with no admitted skill is an answered "no"')
  assert.equal(lightOf(slotOf(chain({reading: {chains: model.rosterChains({profiles: [{accepted: false, profile: {skill_refs: ['x']}}]})}}), 'skillset').device), 'off', 'carried is not admitted')
})

test('a value with no reading stays unknown — no default stands in for it', () => {
  const {device: gateway} = slotOf(chain(), 'gateway')
  for (const key of ['transport', 'approvals', 'connect', 'readiness', 'spend']) assert.equal(gateway.values[key], undefined, key)
  const {device: agent} = slotOf(chain(), 'agent')
  for (const key of ['autonomy', 'budget-used', 'identity', 'model']) assert.equal(agent.values[key], undefined, key)
  assert.equal(agent.values.effort, 'high', 'the shell\'s own state is a reading')
  assert.equal(agent.values.input, 'steer')
  const read = slotOf(chain({sessionRef: 's', reading: {budget: {used: 3, cap: 12}, autonomy: 'review', identity: 'agent/ada'}}), 'agent').device
  assert.deepEqual([read.values['budget-used'], read.values.autonomy, read.values.identity], ['3 / 12', 'review', 'agent/ada'])
  const git = slotOf(chain({reading: {gitRepo: {branch: 'dlw/build', uncommitted: 4}}}), 'git').device
  assert.deepEqual([git.values.branch, git.values.uncommitted], ['dlw/build', 4])
})

test('owners write, faces read: a write row reaches its own write path, a reading row has none, a refusal comes back in the owner\'s words', async () => {
  const calls = []
  const write = async (row, value) => { calls.push({key: row.key, path: row.writePath, value}); return fired(row) }
  const {device} = slotOf(chain({write}), 'agent')
  await device.submit([{key: 'effort', value: 'max'}])
  await device.submit([{key: 'input', value: 'queue'}])
  await device.submit([{key: 'input', value: 'steer'}])
  await device.submit([{key: 'heartbeat', value: false}])
  assert.deepEqual(calls, [
    {key: 'effort', path: 'shell.setEffort', value: 'max'},
    {key: 'input', path: 'shell.setSteer', value: false},
    {key: 'input', path: 'shell.setSteer', value: true},
    {key: 'heartbeat', path: 'shell.setHeartbeat', value: false},
  ], 'the shell\'s steer setter takes the boolean the transport gives it')
  await assert.rejects(() => device.submit([{key: 'autonomy', value: 'auto'}]), /no owner write is declared/, 'autonomy is a reading here')
  await assert.rejects(() => device.submit([{key: 'budget-used', value: '1'}]), /no owner write is declared/)
  assert.equal(calls.length, 4, 'a reading dispatched nothing')

  const world = slotOf(chain({write}), 'world').device
  await world.submit([{key: 'write-mode', value: 'direct'}])
  await world.submit([{key: 'write-mode', value: 'propose'}])
  await assert.rejects(() => world.submit([{key: 'write-mode', value: 'draft'}]), /draft awaits its writer/, 'draft has no writer: refused by name, not sent')
  assert.deepEqual(calls.slice(4), [{key: 'write-mode', path: 'shell.setWriteArm', value: true}, {key: 'write-mode', path: 'shell.setWriteArm', value: false}])

  const refusing = slotOf(chain({write: async row => ({kind: 'refused', channel: 'kernel', writePath: row.writePath, reason: 'the gateway refused the carrier'})}), 'gateway').device
  await assert.rejects(() => refusing.submit([{key: 'transport', value: 'ws'}]), /the gateway refused the carrier/)
})

test('a write the table declares but gives no domain for stays a reading in the device — no knob on an invented 0..1', () => {
  const stall = slotOf(chain(), 'gateway').device.rows.find(row => row.key === 'stall-after')
  assert.equal(agentAddress('gateway', 'stall-after').writePath, 'kernel:harness_agent_control')
  assert.equal(stall.writePath, undefined)
  assert.match(stall.disclosure, /no domain/)
})

test('the harness\'s document supplies the gateway rows only under the carrier\'s own names and inside the declared choices', () => {
  assert.deepEqual(model.gatewayDisclosed({state: 'ready', transport: 'ws', approvals: 'sometimes', connect: true, stall_after_seconds: 30}),
    {readiness: 'ready', transport: 'ws', connect: true}, 'a choice outside the declared set is not a reading')
  assert.deepEqual(model.gatewayDisclosed({refused: {message: 'no'}}), {})
  assert.deepEqual(model.gatewayDisclosed(null), {})
  assert.equal(model.gatewayLine({schema: 's', binding: 'b'}), 'schema s · binding b')
  assert.deepEqual(model.gitRepoReading({repo_root: '/r', head_branch: 'main', worktrees: [{path: '/x', dirty_files: 9}, {path: '/r', dirty_files: 2}]}), {branch: 'main', uncommitted: 2})
  assert.deepEqual(model.gitRepoReading({repo_root: '/r', worktrees: []}), {})
  assert.deepEqual(model.taskReading({turns: {used: 2, cap: 8}, custody: 'review'}), {used: 2, cap: 8, autonomy: 'review'})
  assert.equal(model.budgetLine({used: 2}), '2')
  assert.equal(model.budgetLine(null), undefined)
})

test('the skills rack is a rack: chains with admit lights, a selector, its macros as macro rows', () => {
  selection.selectSkillChain(null)
  const chains = model.rosterChains(ROSTER)
  assert.deepEqual(chains.map(c => [c.ref, c.admitted, c.carriedBy]), [
    ['gazetteer', true, ['agent/ada', 'agent/ash']], ['vault-read', true, ['agent/ada']], ['zeta', false, ['agent/zed']],
  ])
  assert.equal(model.rosterAdmits(ROSTER), 2)
  assert.equal(model.rosterIdentity(ROSTER), 'agent/ada')
  const reading = {chains, skillsNote: '2 accepted agents with skill refs disclosed.'}
  for (const size of ['compact', 'whole', 'full']) {
    const markup = html(pictures.chainPicture('skillset', context({reading}), size))
    assert.match(markup, /role="listbox"/, `${size}: the chains stand in a selector`)
    assert.equal((markup.match(/role="option"/g) ?? []).length, 3)
    assert.match(markup, /data-chain="zeta" data-admitted="false"/, 'a carried skill that is not admitted is a dark chain')
    assert.match(markup, /data-chain="gazetteer" data-admitted="true"/)
    assert.match(markup, /role="option" aria-selected="true" data-chain="gazetteer"/, 'the first chain is selected until another is chosen')
  }
  assert.doesNotMatch(html(pictures.chainPicture('skillset', context({reading}), 'compact')), /data-chain-detail/)
  assert.match(html(pictures.chainPicture('skillset', context({reading}), 'whole')), /data-chain-detail="gazetteer"/, 'whole shows the chosen chain\'s detail')
  selection.selectSkillChain('zeta')
  const chosen = html(pictures.chainPicture('skillset', context({reading}), 'full'))
  assert.match(chosen, /role="option" aria-selected="true" data-chain="zeta"/, 'one choice for every size')
  assert.match(chosen, /data-chain-detail="zeta"[\s\S]*carried, not admitted/)
  selection.selectSkillChain('not-a-chain')
  assert.equal(selection.chosenChain(chains, 'not-a-chain'), 'gazetteer', 'a stale choice falls back to the first chain')
  selection.selectSkillChain(null)
  const waiting = html(pictures.chainPicture('skillset', context({reading: {chains: [], skillsNote: 'waiting on Central — roster refused'}}), 'compact'))
  assert.match(waiting, /waiting on Central — roster refused/)
  assert.doesNotMatch(waiting, /role="option"/)
})

test('one device in three sizes: the same live rows, a picture in each — no text-only card', () => {
  const set = chain({sessionRef: 's', reading: {chains: model.rosterChains(ROSTER), gatewayAdmitted: true, gitRepo: {branch: 'dlw/build', uncommitted: 1}}})
  for (const {slot, device} of set) {
    const compact = compactRows(device.rows).map(row => row.key)
    const markups = ['compact', 'whole', 'full'].map(size => html(createElement(DeviceView, {device, size, picture: pictures.chainPicture(slot.id, context({sessionRef: 's', reading: {chains: model.rosterChains(ROSTER)}}), size)})))
    markups.forEach((markup, index) => {
      assert.match(markup, new RegExp(`data-device="factory:${slot.id}" data-device-size="${['compact', 'whole', 'full'][index]}"`))
      assert.match(markup, /class="device-picture"/, `${slot.id}: the picture stands in every size`)
      assert.match(markup, new RegExp(`fd-pic--${slot.id === 'skillset' ? 'rack' : slot.id}`), `${slot.id}: the device's own picture`)
    })
    assert.deepEqual(params(markups[0]), compact, `${slot.id}: compact draws exactly its compact rows`)
    assert.deepEqual([...params(markups[1])].sort(), device.rows.map(row => row.key).sort(), `${slot.id}: whole draws every row`)
    assert.deepEqual(params(markups[2]), params(markups[1]), `${slot.id}: full draws the same rows as whole`)
    assert.doesNotMatch(markups[0], /<legend>/, 'compact folds the groups')
    assert.match(markups[1], /<legend>/)
  }
  const rack = html(createElement(DeviceView, {device: slotOf(set, 'skillset').device, size: 'compact', picture: null}))
  assert.equal((rack.match(/sdk-row--reading/g) ?? []).length, 4, 'the macros are readings: no control without an owner write')
  assert.doesNotMatch(rack, /sdk-enum|sdk-bool|role="slider"/)
  const agent = html(createElement(DeviceView, {device: slotOf(set, 'agent').device, size: 'compact', picture: null}))
  assert.equal((agent.match(/sdk-enum/g) ?? []).length, 2, 'effort and input are the rows with an owner write')
  assert.match(agent, /sdk-row--reading"[^>]*><span class="sdk-row__name">Autonomy<\/span>/, 'autonomy is a reading until the task record discloses it')
})

test('the door shows the chosen device whole in the pool and full in a pane — the same device, the same live settings', () => {
  const set = chain({reading: {chains: model.rosterChains(ROSTER)}})
  const ctx = context({reading: {chains: model.rosterChains(ROSTER)}})
  for (const {slot, device} of set) door.publishDevice(device.id, {device, picture: size => pictures.chainPicture(slot.id, ctx, size)})
  try {
    door.selectDevice('factory:skillset')
    const pool = html(createElement(DevicePool))
    assert.match(pool, /data-device-pool="factory:skillset"/)
    assert.match(pool, /data-device-size="whole"/)
    assert.match(pool, /<legend>Macros<\/legend>/)
    assert.match(pool, /fd-pic--rack/)
    const pane = html(createElement(DeviceFullPane, {id: 'factory:skillset'}))
    assert.match(pane, /data-device-size="full"/)
    assert.deepEqual(params(pane), params(pool), 'the pool and the pane show the same rows')
    for (const slot of SLOTS) assert.match(html(createElement(DeviceFullPane, {id: `factory:${slot}`})), /data-device-size="full"/, `${slot} opens full`)
  } finally {
    for (const {device} of set) door.publishDevice(device.id, null)
    door.selectDevice(null)
  }
  assert.match(html(createElement(DeviceFullPane, {id: 'factory:agent'})), /not on any chain right now/, 'withdrawn with its chain')
})

test('the Device side is these devices, wired to the door, the pane and the owner\'s write path — and no colour is written raw', () => {
  const detail = read('AgentShellDeviceDetail.tsx')
  assert.match(detail, /<FactoryDeviceChain sessionRef=/)
  assert.doesNotMatch(detail, /from '\.\/(AgentDeviceChain|NativeAgentDeviceRack)'/, 'the chain\'s cards no longer draw the Device side')
  const view = read('devices/FactoryDeviceChain.tsx')
  assert.match(view, /<DeviceView device=\{device\} size="compact"/, 'every device draws through DeviceView at its compact size')
  assert.match(view, /publishDevice\(device\.id, \{device, picture:/, 'each device is published to the door')
  assert.match(view, /publishDevice\(id, null\)/, 'and withdrawn with the chain')
  assert.match(view, /selectDevice\(chainDeviceId\(slotId\)\)/, 'choosing one shows it whole in the pool')
  assert.match(view, /openInstrument\(DEVICE_PANE_KIND, undefined, \{ref: chainDeviceId\(slotId\), title\}\)/, 'opening one full puts it in a pane')
  assert.match(view, /fireWritePath\(row, value, \{transport, binding\}\)/, 'a change goes to the row\'s own write path through the one resolver')
  assert.match(view, /chainDropDecision\(active\.drag\)/, 'the aperture law\'s drop receiver is kept')
  assert.match(view, /MISSING_OPS\.order/, 'and the slide\'s refusal by name')
  assert.doesNotMatch(view, /from '\.\.\/(AgentDeviceChain|NativeAgentDeviceRack)'/)
  for (const file of ['devices/FactoryDeviceChain.tsx', 'devices/AgentDevicePictures.tsx', 'devices/agentChainDevices.ts', 'devices/factoryDevices.css']) {
    const source = read(file)
    assert.deepEqual(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], `${file}: shell tokens only`)
    assert.doesNotMatch(source, /is-on/, `${file}: no hardcoded lit lamp`)
  }
})
