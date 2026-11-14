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

test('the aperture table: every drop a browser row starts dispatches a declared operation', () => {
  const seat = drag.chainDropDecision(agent)
  assert.equal(seat.kind, 'operation')
  assert.deepEqual(seat.operation, {kind: 'harness-control', control: 'new'}, 'the agent seat op is the Action aikit.gateway.agent (new)')
  assert.match(seat.via, /^aikit\.gateway\.agent \(new\) on the gateway binding/)

  const subject = drag.chainDropDecision(session)
  assert.equal(subject.kind, 'operation')
  assert.deepEqual(subject.operation, {kind: 'select-session'}, 'the session drop rides the run model’s own selection')
  assert.match(subject.via, /selection/)

  // REPLACED (O-I #743; DLW build ruling 2026-11-12): a SkillSet's drop refused with the missing op "agent-chain skillset admit" and a
  // seat's with "workcell git-seat attach". Central admits a SkillSet to the profile the chain is (agent-profile.chain-admit), and the
  // seat instrument joins a seat (`seat join`, the Seat's own Join), so both dispatch.
  const admit = drag.chainDropDecision(skillset)
  assert.equal(admit.kind, 'operation')
  assert.deepEqual(admit.operation, {kind: 'admit-skillset'})
  assert.equal(admit.slot, 'skillset')
  assert.match(admit.via, /Central's agent-profile\.chain-admit adds it to what the agent carries/)
  assert.match(admit.via, /Hot-swap/, 'on a rack that carries one it is the Hot-swap')
  assert.match(admit.via, /where it lands inside the agent's own chain/, 'ahead of the Agent rack it is not this agent\'s alone')

  const seatGit = drag.chainDropDecision(git)
  assert.equal(seatGit.kind, 'operation')
  assert.deepEqual(seatGit.operation, {kind: 'join-seat'})
  assert.equal(seatGit.slot, 'git')
  assert.match(seatGit.via, /`seat join` \(the Action workcell\.seat\.join\): the Seat's Join/)
  // No family a browser row drags refuses for want of an operation; the slots no row is dragged to yet stay named.
  for (const family of ['session', 'agent', 'skillset', 'git', 'sources']) assert.equal(drag.chainDropDecision({family, ref: 'r', label: 'l'}).kind, 'operation', family)
  assert.deepEqual(Object.keys(drag.MISSING_OPS), ['world', 'gateway'])
})

test('Sources drags from the browser and stands before the Agent: AIKit places it where it is dropped (§19.9; DLW build ruling 2026-11-05)', async () => {
  const sources = {family: 'sources', ref: 'ai-kit:sources', label: 'Sources'}
  assert.deepEqual(drag.decodeChainDrag(drag.encodeChainDrag(sources)), {kind: 'chain-item', drag: sources}, 'a family of its own')
  assert.equal(drag.chainSlotFor('sources'), 'sources', 'it lands on Sources, before the Agent')
  const placed = drag.chainDropDecision(sources)
  assert.equal(placed.kind, 'operation')
  assert.deepEqual(placed.operation, {kind: 'place-sources'})
  assert.match(placed.via, /AIKit's encounter-session-settings/)
  assert.match(placed.via, /ahead of the Agent rack/)
  assert.match(drag.dropZoneLine({kind: 'chain-item', drag: sources}), /^Drop «Sources» — AIKit's encounter-session-settings/)
  // The browser's Context lists Sources, and it is the row that drags it.
  const browser = await import('../src/agent/AgentShellBrowser.tsx')
  const rows = browser.contextBrowserRows(['ledger'])
  const row = rows.find(item => item.key === 'sources')
  assert.deepEqual(row?.drag, sources, 'the Sources row carries the drag')
  assert.equal(rows.filter(item => item.drag).length, 1, 'only Sources drags: the tiles open on the rail')
})

test('the slide refuses with the rack\'s fixed place; the order inside it is Central\'s agent-profile.chain-order', () => {
  // REPLACED (BD r19, Central #318): the slide named the missing op "agent-chain order". Central writes the order of what the agent carries
  // (agent-profile.chain-order), so it is no missing op; the Skillset rack's own place on the chain is fixed.
  assert.equal('order' in drag.MISSING_OPS, false)
  assert.equal(drag.CHAIN_ORDER_OP, 'agent-profile.chain-order')
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
  assert.match(line({kind: 'chain-item', drag: agent}), /aikit\.gateway\.agent \(new\)/)
  // REPLACED (O-I #743): the zone said both drops refuse (missing ops); it says what each does.
  assert.match(line({kind: 'chain-item', drag: skillset}), /^Drop «port-widgets» — Central's agent-profile\.chain-admit/)
  assert.match(line({kind: 'chain-item', drag: git}), /^Drop «Git · workcell:mac» — the seat instrument's `seat join`/)
  assert.match(line({kind: 'reorder', reorder: {id: 'gateway', title: 'Gateway · hermes'}}), /refuses/)
  // REPLACED (BD r19): the reorder line named "agent-chain order"; it names Central's agent-profile.chain-order and the rack's fixed place.
  assert.match(line({kind: 'reorder', reorder: {id: 'gateway', title: 'Gateway · hermes'}}), /agent-profile\.chain-order/)
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
  assert.match(chain, /harnessAgentControl\(transport, binding, decision\.operation\.control\)/, 'the agent seat dispatches the Action aikit.gateway.agent')
  assert.match(chain, /shell\.setSelectedTrackId\(active\.drag\.ref\)/, 'the session drop rides the run model’s selection')
  // Sources (§19.9; DLW build ruling 2026-11-05): placed where it is dropped, through AIKit's settings of the session, never a group's.
  assert.match(chain, /const placement = sourcesPlacementOf\(target\.kind === 'card' \? target\.id : null\)/, 'the drop card says which reading it is')
  assert.match(chain, /writeSessionSettings\(transport, track\?\.project \?\? ROOT_REGISTER, sessionRef, sourcesPlaceRequest\(placement\)\)/,
    'AIKit places it on the session')
  assert.match(chain, /Sources stands on one session: each session of a group keeps its own/, 'a group refuses in words')
  assert.match(chain, /missing op \$\{decision\.missingOp\}/, 'the refusal card names the exact missing op')
  // REPLACED (BD r19): the slide refusal named MISSING_OPS.order; it says the rack's place and Central's order op (SLIDE_PLACE).
  assert.match(chain, /SLIDE_PLACE/, 'the slide refusal says the rack\'s place and Central\'s order op')
  // O-I #743 (DLW build ruling 2026-11-12): a SkillSet's drop goes through the agent's profile, the act chosen by where it lands; a seat's
  // drop presses the Seat's own Join, for this machine's Workcell only. Each says the owner's refusal in words.
  // The landing: the Skillset rack's card, another card inside the agent's own chain (factoryPlaces.ts RACK_CHAIN, as Sources reads it), or
  // ahead of the Agent rack (every other card, and the drop zone).
  assert.match(chain, /const card = target\.kind === 'card' \? target\.id : null\n\s*const drop = skillSetDropRequest\(chainProfile, active\.drag\.ref, card === 'skillset' \? 'rack' : sourcesPlacementOf\(card\) === 'chain' \? 'chain' : 'ahead'\)/,
    'the drop card says whether it is the rack, the agent\'s own chain or ahead of the Agent rack')
  assert.match(chain, /const asked = drop\.asked\n\s*if \('refused' in asked\) \{ refuse\(asked\.refused\); return \}\n\s*if \(!profileAct\) \{ refuse\(PROFILE_REFUSE\.noCarrier\(what\)\); return \}/,
    'a refusal (no profile, ahead of the rack, one carried already) or no carrier: Central is not asked')
  assert.match(chain, /await profileAct\(asked\.action, asked\.input\)\n\s*setNote\(drop\.act === 'swap'/, 'Central is asked through the person\'s carrier, and the receipt says which act')
  assert.match(chain, /const other = seatDropRefusal\(active\.drag\.ref, machineRef\)\n\s*if \(other\) \{ refuse\(other\); return \}/, 'another machine\'s seat joins nothing')
  assert.match(chain, /await seatDesignBinding\.write!\(\[\{key: 'join', value: Date\.now\(\)\}\]\)/, 'the seat drop is the Seat\'s own Join')
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
    // Ticket 743: and the browser's Skillsets rows, AIKit's set list.
    {roster: 'Central', gateway: 'AIKit', workcell: 'Workcell', skillset: 'AIKit', skillsets: 'AIKit'},
    'owners follow the verified per-device family map (AGENT-DEVICE-OWNERSHIP)',
  )
  assert.equal(drag.OWNER_BINDINGS.gateway.reading, 'harness_agent_read')
  assert.equal(drag.OWNER_BINDINGS.workcell.reading, 'workcell_status_read')
  assert.match(drag.OWNER_BINDINGS.roster.reading, /agent_definition roster/)
  assert.equal(drag.OWNER_BINDINGS.skillsets.reading, 'agent_definition skillsets (`aikit set list`)')
})

test('the three missing ops from the table each name their owner and remedy, or an unnamed owner', async () => {
  // REPLACED (O-I #743): AIKit owed the SkillSet's admission and Workcell the seat's attach; both stand (Central's chain-admit, `seat join`).
  assert.equal('skillset' in drag.MISSING_OP_OWNERS, false)
  assert.equal('git' in drag.MISSING_OP_OWNERS, false)
  // REPLACED (DLW build ruling 2026-11-05: the chain's order is Central's, which keeps the agent profile): the order named no owner, while
  // the chain's law (inhabitants/sdk/chains.ts) named Central for it; the two agree now.
  // REPLACED (BD r19, Central #318): the order is no missing op; the chain's law names Central's own operation for it, standing.
  assert.equal('order' in drag.MISSING_OP_OWNERS, false, 'Central built the order: it owes nothing here')
  const {CHAIN_LAWS} = await import('../src/inhabitants/sdk/chains.ts')
  assert.equal(CHAIN_LAWS['factory-session'].op.owner, 'Central', 'the chain\'s law names Central, which keeps the agent profile')
  assert.equal(CHAIN_LAWS['factory-session'].op.name, drag.CHAIN_ORDER_OP)
  assert.equal(drag.missingOpRemedy('gateway'), 'Actuation builds gateway transport attach on its own seat, or declares it absent')
  assert.match(drag.missingOpRemedy('world'), /no owner is named for world scope setter yet/, 'an unnamed owner is still said as unnamed')
  assert.doesNotMatch(drag.dropZoneLine({kind: 'chain-item', drag: skillset}), /owed by|missing op/)
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
  const pictures = await read('devices/AgentDevicePictures.tsx')
  assert.match(model, /gatewayAdmitted: null,/, 'the gateway lamp is dark until a reading answers — no default-on lamp')
  assert.match(model, /put\('admitted', reading\.gatewayAdmitted\)/, 'the device carries the earned gateway admission, not an assumed one')
  // REPLACED (O-I ticket 1006): the waits were composed in devices/useAgentChainReading.ts over the owners' own reads; the chain's reading is
  // composed from the World Model's slices (designBindings.ts chainFromModel), with the same waits: AIKit until the gateway's harness reading
  // answers, Workcell until its status answers.
  const {chainFromModel} = await import('../src/agent/devices/designBindings.ts')
  const slice = (name, value) => ({state: 'held', answer: {schema: 'oi.world-model-slice/v1', slice: name, owner: 'kernel', scopes: ['machine'], version: 1, state: 'read', error: null, read_at_unix_ms: 1, value}})
  const waits = (sessions, workcells) => chainFromModel({slices: {sessions, workcells}, sessionRef: 'agent-session/one', project: 'O-I', absent: null}).reading.waitingOn
  const reading = {state: 'reading'}
  assert.deepEqual(waits(reading, reading), {gateway: null, skillset: null, git: null}, 'nothing has answered: no owner is yet said to be waited on')
  const gateway = agent => slice('sessions', {spaces: [], gateway: {state: 'read', reading: {ecology: {}, binding: 'gateway-binding/one', agent}}})
  const cells = workcells => slice('workcells', {seats: {state: 'read', reading: {seats: []}}, workcells})
  assert.equal(waits(gateway({state: 'refused', why: 'the gateway at its socket did not answer'}), reading).gateway, drag.OWNER_BINDINGS.gateway.owner, 'the gateway names AIKit until its reading answers')
  assert.equal(waits(gateway({state: 'read', reading: {state: 'ready'}}), reading).gateway, null, 'and none once it has')
  assert.equal(waits(reading, cells({state: 'refused', why: 'workcell: no seat registered'})).git, drag.OWNER_BINDINGS.workcell.owner, 'the git seat names Workcell until its reading answers')
  assert.equal(waits(reading, cells({state: 'read', reading: {workcell_ref: 'workcell:mac'}})).git, null, 'and none once it has')
  assert.match(pictures, /carried, not admitted/, 'an unlit skill chain says it is carried, not admitted')
  assert.match(pictures, /Waiting on/, 'and the skillset picture names who it waits on')
  assert.doesNotMatch(chain, /'unadmitted'/, 'no bare unadmitted wall')
  assert.match(chain, /owner \$\{decision\.owner \?\? 'not named'\}; remedy: \$\{decision\.remedy\}/, 'the drop refusal names owner and remedy')
  // REPLACED (BD r19, Central PR 318): the slide refusal named the order op's remedy; Central built the order, so no remedy is owed.
  assert.doesNotMatch(chain, /missingOpRemedy\('order'\)/, 'no remedy is asked of an op that stands')
})

test('the browser names the owner that actually refused: AIKit for its set list', async () => {
  const browser = await import('../src/agent/AgentShellBrowser.tsx')
  // REPLACED (O-I #743; DLW build ruling 2026-11-12): the Skillsets rows were the roster's skill refs, so a refusal waited on Central; they
  // are AIKit's set list, and its refusal waits on AIKit.
  const refused = browser.skillsetRowsFromSets(null, 'Action refused: unknown field')
  assert.match(refused[0].label, /waiting on AIKit — agent_definition skillsets \(`aikit set list`\) refused: Action refused: unknown field/)
  assert.doesNotMatch(refused[0].label, /Central/)
  const empty = browser.skillsetRowsFromSets({result: 'agent_definition_reading', data: {sets: []}}, null)
  // REPLACED (O-I #743): the empty row waited on a missing op of AIKit's; it says where a SkillSet comes from.
  assert.match(empty[0].label, /a set made or installed through AIKit is listed here, to drag onto an agent's chain/)
  assert.doesNotMatch(empty[0].label, /missing op|builds/)
  // The chain's note where no accepted agent carries practice says where a SkillSet comes from and how the agent takes one.
  assert.match(drag.SKILLSETS_ARRIVE, /browser's Skillsets: drag one onto the agent's chain, and Central's agent-profile\.chain-admit adds it/)
  // The pool holds no device (W1, manual §16.7): the Factory device pool is retired — the rack, the Gateway, the Agent and Scope stand
  // whole in their bands above the chain, and the Git seat's Commit, Push and Land are the landing device's (workcell:git-seat).
  await assert.rejects(read('AgentDevicePool.tsx'), {code: 'ENOENT'})
  const source = await read('AgentShellBrowser.tsx')
  assert.doesNotMatch(source, /budgetCap=\{12\}|budgetUsed=\{0\}|effort=\{shell\.effort\}|autonomy=\{shell\.steer/, 'the shell\'s defaults are not passed as readings')
  assert.doesNotMatch(source, /op: 'harness_agent_read'/, 'nor is the gateway read a second time for a card the chain\'s Gateway replaces')
})
