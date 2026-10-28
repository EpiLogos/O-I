// R4 (T-REALIGN §3; DLW §16.1–§16.2; lock §0.3): each chain lists exactly §16.2's devices and none of the moved ones.
//   Central — a workspace: the Packet, the Agent that answers, its Scope (Ground hygiene and Impact on a workspace that holds code); the
//     Main track: the Day, then Approvals (src/central/devices/CentralDevices.tsx);
//   Factory — Agent, skills rack, scope (the Gateway and the landing are a workcell's); no Thread, Custody or Run beside them (agent/devices/FactoryDeviceChain.tsx);
//   Live — the note devices, the torus, then its effects; the keyboard is the part's input, no plate (live/LiveDeviceChain.tsx);
//   Search (@) — no chain device: a pane of its own kind, opened from the line where you type @ (central/searchPane.tsx).
// Channels: SCRIPTED (SSR over the production components, no owner behind them: every reading absent) and SOURCE READING where a
// placement is a component's structure. Not a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', new URL('../../../../', import.meta.url)).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(s, c, n) {
  if (s.startsWith('@epilogos/expressions-boundary/')) return n(BOUNDARY + s.slice('@epilogos/expressions-boundary/'.length) + '.ts', c)
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

const {loadWorldShellFamilies} = await import('../src/inhabitants/worldShellFamilies.ts')
loadWorldShellFamilies()
const chain = await import('../src/central/devices/CentralDevices.tsx')
const model = await import('../src/central/devices/centralDeviceModel.ts')
const {inhabitantManifest} = await import('../src/inhabitants/manifest.ts')
const {BaseDevicesDetail} = await import('../src/shell/ModeDetail.tsx')
const {deriveAgentDeviceRows} = await import('../src/inhabitants/agentDeviceCatalogue.ts')
const {allFamilyManifests} = await import('../src/inhabitants/familyManifest.ts')
const live = await import('../src/live/liveChainDevices.ts')
const search = await import('../src/central/searchPane.tsx')
const projections = await import('../../../../desktop/cradle/src/surface/projectionModules.ts')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')

const transport = {kind: 'unavailable', reason: 'the test carrier is down'}
const central = inhabitantManifest('central')
const quiet = run => {
  const said = console.error
  console.error = (first, ...rest) => { if (!/useLayoutEffect does nothing on the server/.test(String(first))) said(first, ...rest) }
  try { return run() } finally { console.error = said }
}
const MOVED = ['agent-identity', 'nara-conversation', 'context-world', 'search', 'workspace', 'flow-document', 'beings', 'things', 'document', 'text', 'highlight', 'notes']
/** Of the moved faces, those the 22 Oct manual rewrite retired as faces of their own (#725): the Answer is the Agent (PROGRAMME R25 item 5),
 * Context & world is Scope, the Workspace is the track's head and Docs (§18.1), the Flow, Beings and Things a page's Clip panel and editor
 * tabs, and Text, Highlight and Notes its editing tools (R25 item 4, §16.1). The rest stay declared, on no chain. */
const RETIRED_MOVED = ['nara-conversation', 'context-world', 'workspace', 'flow-document', 'beings', 'things', 'text', 'highlight', 'notes']
/** The device ids a chain's markup stands, in order (each slot's data-device on DeviceView). */
const devicesOf = markup => [...markup.matchAll(/data-device="([^"]+)" data-device-size="compact"/g)].map(match => match[1])

test('Central: the family\'s faces on a chain are the Day (the Main track) and the Packet and Docs (a world) — no moved face', () => {
  assert.deepEqual([...model.CENTRAL_MAIN_FACES], ['day-die'])
  // REPLACED (#725): W4's Packet, Ground hygiene, Machine and Impact — the three were retired (§19.16, §18.7, §18.6); Docs follows Scope on
  // every world (§16.2 "then Docs, the world's account on six tiers").
  assert.deepEqual([...model.CENTRAL_WORKSPACE_FACES], ['packet', 'docs'])
  assert.deepEqual(chain.placedFaces(central.faces).map(face => face.id), ['day-die', 'packet', 'docs'])
  // REPLACED (#725): every moved face still declared — the faces the 22 Oct rewrite retired are declared no more; the others stand on no chain.
  assert.deepEqual([...model.CENTRAL_OFF_CHAIN_FACES].sort(), MOVED.filter(id => !RETIRED_MOVED.includes(id)).sort())
  for (const id of MOVED) assert.equal(central.faces.some(face => face.id === id), !RETIRED_MOVED.includes(id), `${id}: ${RETIRED_MOVED.includes(id) ? 'retired, declared no more' : 'still declared, on no chain'}`)
})

test('Central: the selected track chooses the chain — the Main track (its head, the Day, a Day clip) the Day\'s; a workspace\'s track or page its own; none, both', () => {
  assert.equal(chain.centralChainOf({kind: 'track', ref: 'main'}), 'main')
  assert.equal(chain.centralChainOf({kind: 'track', ref: 'central:day'}), 'main')
  assert.equal(chain.centralChainOf({kind: 'clip', ref: 'Control/user/day/2026-10-18/day.md', track: 'central:day'}), 'main')
  assert.equal(chain.centralChainOf({kind: 'track', ref: 'central:workspace:o-i'}), 'workspace')
  assert.equal(chain.centralChainOf({kind: 'clip', ref: 'central:workspace:o-i#page/x.md', track: 'central:workspace:o-i'}), 'workspace')
  assert.equal(chain.centralChainOf({kind: 'track', ref: 'factory:session:x'}), 'both', 'another mode\'s track names no Central chain')
  assert.equal(chain.centralChainOf(null), 'both')
})

test('Central on screen (SSR): the Main track\'s chain is the Day, then Approvals; with no world\'s track selected, a world\'s is the Packet, the Agent, Scope and Docs', () => {
  const markup = quiet(() => renderToStaticMarkup(createElement(BaseDevicesDetail, {transport})))
  const main = markup.slice(markup.indexOf('data-track="main"'), markup.indexOf('data-track="workspace"'))
  const workspace = markup.slice(markup.indexOf('data-track="workspace"'))
  assert.ok(main.length > 0 && workspace.length > 0, 'with no Central track selected, both chains stand')
  assert.deepEqual(devicesOf(main), ['central:day-die', 'central:main:approvals'])
  // REPLACED (#725): the Packet, the Agent, its Voice and Scope — Voice is the Agent's Voice page (§19.21, the 22 Oct manual rewrite), and
  // Docs follows Scope (§16.2).
  assert.deepEqual(devicesOf(workspace), ['central:packet', 'central:agent', 'central:scope', 'central:docs'])
  assert.ok(!markup.includes('data-device="central:voice"'), 'no Voice beside the Agent')
  for (const id of MOVED) assert.ok(!markup.includes(`data-device="central:${id}"`), `${id} stands on no chain`)
  // The two devices of other families are their faces' own, drawn by their designs once loaded (actuation:harness-model, software-factory:context-write-mode).
  const others = chain.centralAgentDevices()
  assert.deepEqual([others.agent.family, others.agent.face.id, others.scope.family, others.scope.face.id, others.approvals.family, others.approvals.face.id],
    ['actuation', 'harness-model', 'software-factory', 'context-write-mode', 'software-factory', 'approvals'])
})

test('Central\'s source: no mode branch, no native pop-out of its own, the Day\'s track named by its adapter', async () => {
  const text = await source('central/devices/CentralDevices.tsx')
  assert.doesNotMatch(text, /[!=]==\s*'(?:live|base|central|factory|expressions|techne|audio)'/, 'no mode branch (switchboard tripwire)')
  assert.doesNotMatch(text, /data-action="pop-out"/, 'the door\'s ↗ stands alone (R1)')
  assert.match(text, /import \{CENTRAL_DAY_TRACK_ID\} from '\.\.\/\.\.\/timeline\/centralTrackAdapter'/)
})

test('Factory: the session\'s chain is Agent, skills rack, scope — no Thread, Custody or Run beside them; the Gateway and the landing are the workcell\'s', async () => {
  // The agent chain's devices are still the catalogue's five slots; since lane W1-Factory the session's chain draws three of them (§16.2) and a
  // workcell's chain the Gateway and Git / landing (§19.23 "A track has no gateway and no landing of its own"; factoryPlaces.ts).
  assert.deepEqual(deriveAgentDeviceRows(allFamilyManifests()).map(slot => slot.id), ['gateway', 'agent', 'skillset', 'world', 'git'])
  const places = await source('agent/devices/factoryPlaces.ts')
  assert.match(places, /export const SESSION_CHAIN: readonly FactorySlot\[\] = \['agent', 'skillset', 'world'\]/)
  assert.match(places, /export const WORKCELL_CHAIN: readonly FactorySlot\[\] = \['workcell', 'gateway', 'remote-carrier', 'git'\]/)
  const text = await source('agent/devices/FactoryDeviceChain.tsx')
  assert.doesNotMatch(text, /<DeviceView device=\{thread\}/, 'no Thread beside the Agent')
  assert.doesNotMatch(text, /placed\(CUSTODY_ID/, 'no Custody beside the Agent')
  assert.doesNotMatch(text, /placed\(RUN_ID/, 'no Run after the landing')
  assert.match(text, /composeAgentBinding\(agentDesignBinding, \{custody: custodyDesignBinding, identity: identityDesignBinding, thread: threadDesignBinding\}\)/,
    'the one Agent carries them')
  // REPLACED (#725): "the Seat stays inside the landing" as a device of its own — the Seat was retired into Git / landing's Seat page (§19.17
  // "Claiming a seat … is the Seat page of Git / landing"), carried on the landing's binding under `seat.`.
  assert.doesNotMatch(text, /placed\(SEAT_ID/, 'no Seat device inside the landing')
  assert.match(text, /carryPages\(gitDesignBinding, \[\{page: SEAT_PAGE, binding: seatDesignBinding\}/, 'the Seat is the landing\'s Seat page (§19.17)')
  assert.match(text, /case 'agentset': return placed\(AGENTSET_ID/, 'the Agentset rack leads a group\'s chain (§19.15)')
  assert.match(text, /seatBinding\(\{status: seats\.status === 'answered' \? seats\.value : null/, 'the Seat on the seat instrument (K1 seat_status_read)')
  assert.doesNotMatch(text, /linkBinding/, 'the Link is the transport\'s (§19.19)')
})

test('Live: the chain mounts the part\'s input, the note devices, the torus; no keyboard device is built or placed', async () => {
  assert.equal(live.keyboardDevice, undefined)
  assert.equal(live.KEYBOARD_DEVICE_ID, undefined)
  const text = await source('live/LiveDeviceChain.tsx')
  assert.ok(!text.includes('KeyboardOnChain />'), 'no keyboard plate')
  const input = text.indexOf('<PartInput />'), notes = text.indexOf('<NoteDeviceChain />'), torus = text.indexOf('<TorusOnChain state={torus} />')
  assert.ok(input > 0 && notes > input && torus > notes)
  const part = await source('live/KeyboardOnChain.tsx')
  assert.doesNotMatch(part, /<DeviceView |usePublishedDevice/, 'the input is no device')
  assert.match(await source('live/TorusOnChain.tsx'), /<JankoDevice plate layout=\{layout\} midi=\{false\} \/>/, 'the playing surface stands under the Torus\'s Full')
})

test('Search (@): no chain device; a pane of its own kind, opened on the line where an @ word is typed', () => {
  assert.equal(search.atQueryOf('Ask @ariadne'), '@ariadne')
  assert.equal(search.atQueryOf('@1 founding positions'), '@1 founding positions')
  assert.equal(search.atQueryOf('mail me at frank@example.org'), null, 'an @ inside a word is an address, no search')
  assert.equal(search.atQueryOf('no mark here'), null)
  assert.equal(search.atQueryOf('@a then @b'), '@b', 'the word being typed')
  assert.ok(projections.admittedProjectionKinds().includes(search.SEARCH_PANE_KIND), 'the Search pane\'s kind is registered')
  assert.equal(search.searchDevice().face.id, 'search', 'drawn by Central\'s Search face (its design, central:search)')
})

test('Approvals on both Main tracks: the project\'s returned work that waits (K1 source_returns_read) stands as proposals beside the consent requests', async () => {
  const receipts = await import('../src/agent/devices/receiptBindings.ts')
  const designs = await import('../src/agent/devices/designBindings.ts')
  // FIXTURE entries in Central's own shape (central.source-returns/v1, flow.rs SourceReturns; the ref minted `<prefix><unix nanos>-<pid>`,
  // ctrl source_return.rs:221-238). The real O-I reading answered none (K1 shapes/source-returns-o-i.json: entries []).
  const minted = 1_792_300_000_000
  const entries = [
    {return_ref: `central:return:project:o-i:${minted}000000-4242`, source_ref: 'central:source:project:O-I:ProjectCentral/docs/1-vision/dlw/DLW.md', basis_revision: 'r1', status: 'pending',
      agent_session_ref: 'agent-session/flint', current_revision: 'r1'},
    {return_ref: 'central:return:project:o-i:1-1', source_ref: 'central:source:project:O-I:README.md', basis_revision: 'r1', status: 'accepted', agent_session_ref: 'agent-session/flint', current_revision: 'r2'},
  ]
  const tracks = [{sessionRef: 'agent-session/flint', agentName: 'Flint', agentRef: 'agent/flint', purpose: 'Docs pass', group: false}]
  const rows = receipts.proposalRows(entries, tracks, minted + 90_000)
  assert.deepEqual(rows, [{id: entries[0].return_ref, kind: 'proposal', who: 'Flint', text: 'ProjectCentral/docs/1-vision/dlw/DLW.md', where: 'ProjectCentral/docs/1-vision/dlw/DLW.md', session: 'Docs pass', age: 90}],
    'a pending return waits; an accepted one does not')
  designs.resetHolds()
  const values = receipts.approvalsValues({gateway: {}, session: null, encounter: null, holds: designs.chainHolds(), returns: {entries}, tracks, nowUnixMs: minted + 90_000})
  assert.equal(JSON.parse(values.queue).length, 1)
  assert.equal(values.light, 'lit')
  assert.equal(receipts.approvalsValues({gateway: {}, session: null, encounter: null, holds: designs.chainHolds()}).queue, undefined, 'unread: no queue, never an empty one')
  const binding = receipts.approvalsBinding({gateway: {}, session: null, encounter: null, holds: designs.chainHolds(), returns: {entries}}, null, {}, 'central:main:approvals')
  assert.equal(binding.id, 'central:main:approvals')
  // REPLACED (W2): Approve is Central's projectcentral.source.return_accept, handed in as the chain's port; a chain that passes none
  // (here, as Central's Main track does today) stands it disabled in those words (tests/w2-hookups-binding.test.mjs carries the write).
  assert.equal(binding.standing.approve.disabled, receipts.APPROVE_UNWIRED)
})
