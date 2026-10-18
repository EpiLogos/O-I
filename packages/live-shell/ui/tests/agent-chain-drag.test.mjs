import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production drag model and components in memory, same loader as the sibling
// native drag tests (packages/live-shell/ui/tests/native-browser-drag.test.mjs).
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

const drag = await import('../src/agent/agentChainDrag.ts')
const src = new URL('../src/agent/', import.meta.url)
const read = name => readFile(new URL(name, src), 'utf8')

const session = {family: 'session', ref: 'space-1:ses-9', label: 're-plan port'}
const agent = {family: 'agent', ref: 'fizz', label: 'Fizz'}
const skillset = {family: 'skillset', ref: 'port-widgets', label: 'port-widgets'}
const git = {family: 'git', ref: 'workcell:mac', label: 'Git · workcell:mac'}

test('a chain drag payload round-trips with its family, ref and label', () => {
  for (const payload of [session, agent, skillset, git]) {
    const decoded = drag.decodeChainDrag(drag.encodeChainDrag(payload))
    assert.deepEqual(decoded, {kind: 'chain-item', drag: payload})
  }
})

test('malformed payloads from any source are refused', () => {
  const refuse = value => assert.equal(drag.parseAgentChainDrag(value), null, JSON.stringify(value))
  refuse(null)
  refuse([])
  refuse('chain-item')
  refuse({...session, family: 'gateway'})
  refuse({...session, family: 'world'})
  refuse({...session, ref: ''})
  refuse({...agent, label: ''})
  refuse({...skillset, label: 'x'.repeat(301)})
  refuse({...git, ref: 'x'.repeat(401)})
  assert.equal(drag.decodeChainDrag('{not json'), null)
  assert.equal(drag.decodeChainDrag('42'), null)
  assert.equal(drag.decodeChainDrag(JSON.stringify({family: 'session'})), null, 'a ref-less payload decodes to nothing')
})

test('a slide payload names a declared slot and refuses unknown ones', () => {
  const reorder = {id: 'gateway', title: 'Gateway · hermes'}
  assert.deepEqual(drag.decodeChainDrag(drag.encodeChainDrag(reorder)), {kind: 'reorder', reorder})
  assert.equal(drag.parseAgentChainReorder({id: 'macros', title: 'Macros'}), null, 'no such chain slot')
  assert.equal(drag.parseAgentChainReorder({id: 'gateway'}), null)
  assert.equal(drag.parseAgentChainReorder({id: 'gateway', title: ''}), null)
})

test('the chain slots are the mockup order: through → who → how → where → lands', () => {
  assert.deepEqual([...drag.CHAIN_SLOTS], ['gateway', 'agent', 'skillset', 'world', 'git'])
})

test('every browser family lands on its semantic position', () => {
  assert.equal(drag.chainSlotFor('session'), 'agent', 'a session drop seats at the who slot')
  assert.equal(drag.chainSlotFor('agent'), 'agent', 'an agent drop seats at the who slot')
  assert.equal(drag.chainSlotFor('skillset'), 'skillset', 'a skillset drop lands at the how slot')
  assert.equal(drag.chainSlotFor('git'), 'git', 'a git drop lands where the work lands')
})

test('the aperture table: two drops dispatch declared operations, two refuse by name', () => {
  const seat = drag.chainDropDecision(agent)
  assert.equal(seat.kind, 'operation')
  assert.deepEqual(seat.operation, {kind: 'harness-control', control: 'new'}, 'the agent seat op is harness_agent_control (new)')
  assert.match(seat.via, /harness_agent_control/)

  const subject = drag.chainDropDecision(session)
  assert.equal(subject.kind, 'operation')
  assert.deepEqual(subject.operation, {kind: 'select-session'}, 'the session drop rides the run model’s own selection')
  assert.match(subject.via, /selection/)

  const admit = drag.chainDropDecision(skillset)
  assert.equal(admit.kind, 'missing-op')
  assert.equal(admit.missingOp, 'agent-chain skillset admit')
  assert.match(admit.because, /agent_definition/, 'the refusal names who owns admission today')

  const seatGit = drag.chainDropDecision(git)
  assert.equal(seatGit.kind, 'missing-op')
  assert.equal(seatGit.missingOp, 'workcell git-seat attach')
  assert.match(seatGit.because, /workcell_status_read/, 'the refusal names the reading that exists and the op that does not')
})

test('the slide refuses with the named missing op — no order operation exists', () => {
  assert.equal(drag.MISSING_OPS.order, 'agent-chain order')
  // The model exposes no operation that reorders: the only order in the module
  // is the declared CHAIN_SLOTS constant (the family door's composition).
  assert.equal(typeof drag.setActiveChainDrag, 'function')
  assert.equal(typeof drag.moveChainCard, 'undefined', 'no invented move op')
  assert.equal(typeof drag.reorderChain, 'undefined', 'no invented reorder op')
  assert.equal(typeof drag.setChainOrder, 'undefined', 'no shadow order store')
})

test('the zone names what is held — operations promised, refusals admitted', () => {
  const line = active => drag.dropZoneLine(active)
  assert.match(line({kind: 'chain-item', drag: session}), /«re-plan port»/)
  assert.match(line({kind: 'chain-item', drag: session}), /selection/)
  assert.match(line({kind: 'chain-item', drag: agent}), /harness_agent_control/)
  assert.match(line({kind: 'chain-item', drag: skillset}), /missing op: agent-chain skillset admit/)
  assert.match(line({kind: 'chain-item', drag: git}), /missing op: workcell git-seat attach/)
  assert.match(line({kind: 'reorder', reorder: {id: 'gateway', title: 'Gateway · hermes'}}), /refuses/)
  assert.match(line({kind: 'reorder', reorder: {id: 'gateway', title: 'Gateway · hermes'}}), /agent-chain order/)
})

test('the slide’s gap follows the same midpoint rule as the parent rack', () => {
  const cards = [{left: 0, right: 100}, {left: 106, right: 206}, {left: 212, right: 312}]
  assert.equal(drag.chainInsertIndex(-5, cards), 0)
  assert.equal(drag.chainInsertIndex(49, cards), 0, 'left of the first midpoint opens the first slot')
  assert.equal(drag.chainInsertIndex(103, cards), 1)
  assert.equal(drag.chainInsertIndex(209, cards), 2)
  assert.equal(drag.chainInsertIndex(400, cards), 3, 'past every card opens the last slot')
  assert.equal(drag.chainInsertIndex(10, []), 0)
})

test('the gesture-held drag lives in the model for one gesture, then clears', () => {
  assert.equal(drag.activeChainDrag(), null)
  const held = {kind: 'chain-item', drag: agent}
  drag.setActiveChainDrag(held)
  assert.equal(drag.activeChainDrag(), held)
  drag.setActiveChainDrag(null)
  assert.equal(drag.activeChainDrag(), null)
})

// ---- Wiring: the gesture reaches the owners through the declared paths -----

test('the Browser arms disclosed rows only, with the row’s own card as the image', async () => {
  const browser = await read('AgentShellBrowser.tsx')
  assert.match(browser, /AGENT_CHAIN_MIME, encodeChainDrag, setActiveChainDrag/)
  assert.match(browser, /draggable=\{!!item\.drag\}/, 'a row without a disclosed item drags nothing')
  assert.match(browser, /event\.dataTransfer\.setData\(AGENT_CHAIN_MIME, encodeChainDrag\(item\.drag!\)\)/)
  assert.match(browser, /setActiveChainDrag\(\{kind: 'chain-item', drag: item\.drag!\}\)/)
  assert.match(browser, /onDragEnd=\{item\.drag \? \(\) => setActiveChainDrag\(null\)/, 'the held copy clears when the gesture ends')
  assert.doesNotMatch(browser, /setDragChip/, 'the drag image is the row card itself, not a substitute chip')
  // Refusal and empty rows never carry a payload.
  assert.match(browser, /skillsets-unadmitted|meta === 'skillset'/, 'only real skillset rows drag')
  assert.match(browser, /drag: \{family: 'git' as const, ref: workcellRef/, 'the git row drags only a disclosed workcell ref')
})

// The chain's cards are drawn by devices/FactoryDeviceChain.tsx (each a device of the one runtime through DeviceView); the old
// AgentDeviceChain.tsx / NativeAgentDeviceRack.tsx pair is gone, and the drop, slide and refusal behaviour below was ported to it.
test('the chain resolves the drop target and hands ONE payload to the aperture receiver', async () => {
  const rack = await read('devices/FactoryDeviceChain.tsx')
  assert.match(rack, /onDragOver=\{onRowDragOver\}/)
  assert.match(rack, /onDrop=\{onRowDrop\}/)
  assert.match(rack, /decodeChainDrag\(event\.dataTransfer\.getData\(AGENT_CHAIN_MIME\)\) \?\? activeChainDrag\(\)/)
  assert.match(rack, /closest<HTMLElement>\('\[data-slot\]'\)/, 'the target is the card under the pointer, or the zone')
  assert.match(rack, /\{kind: 'zone', label: 'the drop zone'\}/)
  assert.match(rack, /\{kind: 'card', id: card\.id, label: `«\$\{card\.title\}»`\}/, 'a card drop names the card it landed beside')
  assert.match(rack, /data-slot=\{slot\.id\}/, 'every card is a named drop target')
  assert.match(rack, /data-slot="zone"/, 'the zone is the semantic-position target')
  assert.match(rack, /agent-chain-gap/, 'the slide’s drop slot is visible in the row')
  assert.match(rack, /held \? dropZoneLine\(held\) : 'Drop gateways, agents, skillsets, worlds or git here'/, 'the zone updates to what is held')
  assert.match(rack, /window\.addEventListener\('dragend'/, 'a gesture that ends anywhere clears the mirror')
})

test('the chain card carries a slide grip, and the grip refuses through the receiver', async () => {
  const rack = await read('devices/FactoryDeviceChain.tsx')
  assert.match(rack, /agent-chain-grip/)
  assert.match(rack, /setActiveChainDrag\(\{kind: 'reorder', reorder\}\)/)
  assert.match(rack, /event\.dataTransfer\.setData\(AGENT_CHAIN_MIME, encodeChainDrag\(reorder\)\)/)
  assert.match(rack, /void attemptDrop\(\{kind: 'reorder', reorder: \{id: id as AgentChainSlotId, title\}\}/, 'Alt+Arrow reaches the same honest refusal')
})

test('the drop dispatches through the declared owners; refusals render as the landed card', async () => {
  const chain = await read('devices/FactoryDeviceChain.tsx')
  assert.match(chain, /harnessAgentControl\(transport, binding, decision\.operation\.control\)/, 'the agent seat dispatches harness_agent_control')
  assert.match(chain, /shell\.setSelectedTrackId\(active\.drag\.ref\)/, 'the session drop rides the run model’s selection')
  assert.match(chain, /missing op \$\{decision\.missingOp\}/, 'the refusal card names the exact missing op')
  assert.match(chain, /MISSING_OPS\.order/, 'the slide refusal names the missing order op')
  assert.match(chain, /<RefusalCard/, 'refusals render through the landed disclosure card')
  assert.match(chain, /onDismiss=\{\(\) => setNote\(null\)\}/)
  assert.match(chain, /agent-transport-note/, 'receipts render as the styled note, never a JSON dump')
  assert.doesNotMatch(chain, /JSON\.stringify\(.*drop/i, 'no raw dump on the chain surface')
  assert.match(chain, /safeJson\(outcome\.document\)/, 'the owner’s outcome document rides folded as the receipt')
})

test('the chain composition still comes from the family door — no parallel order state', async () => {
  const model = await read('devices/agentChainDevices.ts')
  const catalogue = await readFile(new URL('../src/inhabitants/agentDeviceCatalogue.ts', import.meta.url), 'utf8')
  assert.match(model, /deriveAgentDeviceRows\(allFamilyManifests\(\)\)/, 'the chain renders the composition the door declares')
  assert.match(catalogue, /const CHAIN_SLOTS: readonly AgentChainSlot\[\]/, 'the composition is a declaration, not a store')
  assert.doesNotMatch(catalogue, /setOrder|reorder|moveCard/i, 'the door declares no order operation')
})

test('the new drag styles use shell tokens, not literal colours', async () => {
  const css = await readFile(new URL('../src/agent/agentShell.css', import.meta.url), 'utf8')
  const slice = css.slice(css.indexOf('/* ============ detail: device chain'))
  assert.match(slice, /\.agent-chain-gap \{ flex:0 0 3px/)
  assert.match(slice, /\.agent-dropz\.armed/)
  assert.doesNotMatch(slice.slice(slice.indexOf('The slide grip')), /#[0-9a-fA-F]{3,8}\b/, 'the new rules carry no literal colour')
})

// ---- P0-R4: every family admitted through its owner, or waiting on it by name

test('each owner binding names its owner and the reading that admits the light', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(drag.OWNER_BINDINGS).map(([id, b]) => [id, b.owner])),
    {roster: 'Central', gateway: 'AIKit', workcell: 'Workcell', skillset: 'AIKit'},
    'owners follow the verified per-device family map (AGENT-DEVICE-OWNERSHIP)',
  )
  assert.equal(drag.OWNER_BINDINGS.gateway.reading, 'harness_agent_read')
  assert.equal(drag.OWNER_BINDINGS.workcell.reading, 'workcell_status_read')
  assert.match(drag.OWNER_BINDINGS.roster.reading, /agent_definition roster/)
})

test('the three missing ops from the table each name their owner and remedy, or an unnamed owner', () => {
  assert.equal(drag.MISSING_OP_OWNERS.skillset, 'AIKit')
  assert.equal(drag.MISSING_OP_OWNERS.git, 'Workcell')
  assert.equal(drag.MISSING_OP_OWNERS.order, null, 'the order is declared at the shell door; no product owner is guessed')
  assert.equal(drag.missingOpRemedy('skillset'), 'AIKit builds agent-chain skillset admit on its own seat, or declares it absent')
  assert.equal(drag.missingOpRemedy('git'), 'Workcell builds workcell git-seat attach on its own seat, or declares it absent')
  assert.match(drag.missingOpRemedy('order'), /no owner is named for agent-chain order yet/)
  const admit = drag.chainDropDecision(skillset)
  assert.equal(admit.owner, 'AIKit')
  assert.equal(admit.remedy, drag.missingOpRemedy('skillset'))
  const seatGit = drag.chainDropDecision(git)
  assert.equal(seatGit.owner, 'Workcell')
  assert.equal(seatGit.remedy, drag.missingOpRemedy('git'))
  assert.match(drag.dropZoneLine({kind: 'chain-item', drag: skillset}), /owed by AIKit/)
})

test('a refused reading waits on its owner by name; a transport failure is never put in the owner’s mouth', () => {
  const refused = drag.ownerRefusalLine('workcell', 'the owner refused — no seat registered')
  assert.equal(refused, 'waiting on Workcell — workcell_status_read refused: the owner refused — no seat registered')
  const unreached = drag.ownerRefusalLine('gateway', 'Transport unavailable', 'not-reached')
  assert.match(unreached, /^waiting on AIKit — harness_agent_read not reached: Transport unavailable$/, 'harness_agent_read is the AIKit agency gateway’s reading')
  assert.equal(drag.MISSING_OP_OWNERS.gateway, 'Actuation', 'the gateway transport face is Actuation’s')
  assert.ok(drag.ownerRefusalLine('roster', 'x'.repeat(400)).length <= 240, 'one bounded line, never a dump')
})

test('the chain earns every lamp from a reading and names who an unlit lamp waits on', async () => {
  const chain = await read('devices/FactoryDeviceChain.tsx')
  const model = await read('devices/agentChainDevices.ts')
  const readings = await read('devices/useAgentChainReading.ts')
  const pictures = await read('devices/AgentDevicePictures.tsx')
  assert.match(model, /gatewayAdmitted: null,/, 'the gateway lamp is dark until a reading answers — no default-on lamp')
  assert.match(model, /put\('admitted', reading\.gatewayAdmitted\)/, 'the device carries the earned gateway admission, not an assumed one')
  // Lane Q: the roster, the task record and the seat are the shared owner answers (owners/readers.ts); the lamps are composed
  // over them, with the same waits.
  assert.match(readings, /gatewayWaiting: gatewayAnswered \? null : OWNER_BINDINGS\.gateway\.owner/, 'the gateway names AIKit until its reading answers')
  assert.match(readings, /next\.waitingOn\.git = seatAnswered \? null : OWNER_BINDINGS\.workcell\.owner/, 'the git seat names Workcell until its reading answers')
  assert.match(pictures, /carried, not admitted/, 'an unlit skill chain says it is carried, not admitted')
  assert.match(pictures, /Waiting on/, 'and the skillset picture names who it waits on')
  assert.doesNotMatch(chain, /'unadmitted'/, 'no bare unadmitted wall')
  assert.match(chain, /owner \$\{decision\.owner \?\? 'not named'\}; remedy: \$\{decision\.remedy\}/, 'the drop refusal names owner and remedy')
  assert.match(chain, /remedy: \$\{missingOpRemedy\('order'\)\}/, 'the slide refusal names the order op’s remedy')
})

test('the browser names the owner that actually refused: Central for the roster, not the AIKit rack', async () => {
  const browser = await import('../src/agent/AgentShellBrowser.tsx')
  const refused = browser.skillsetRowsFromRoster(null, 'Action refused: unknown field')
  assert.match(refused[0].label, /waiting on Central — agent_definition roster refused: Action refused: unknown field/)
  assert.doesNotMatch(refused[0].label, /ai-kit skillset registry.*refused/)
  const empty = browser.skillsetRowsFromRoster({result: 'agent_definition_reading', data: {profiles: []}}, null)
  assert.match(empty[0].label, /waiting on AIKit: AIKit builds agent-chain skillset admit/)
  // The pool holds no device (W1, manual §16.7): the Factory device pool is retired — the rack, the Gateway, the Agent and Scope stand
  // whole in their bands above the chain, and the Git seat's Commit, Push and Land are the landing device's (workcell:git-seat).
  await assert.rejects(read('AgentDevicePool.tsx'), {code: 'ENOENT'})
  const source = await read('AgentShellBrowser.tsx')
  assert.doesNotMatch(source, /budgetCap=\{12\}|budgetUsed=\{0\}|effort=\{shell\.effort\}|autonomy=\{shell\.steer/, 'the shell\'s defaults are not passed as readings')
  assert.doesNotMatch(source, /op: 'harness_agent_read'/, 'nor is the gateway read a second time for a card the chain\'s Gateway replaces')
})
