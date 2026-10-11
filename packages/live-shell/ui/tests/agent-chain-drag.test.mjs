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

test('the chain resolves the drop target and hands ONE payload to the aperture receiver', async () => {
  const rack = await read('NativeAgentDeviceRack.tsx')
  assert.match(rack, /onDragOver=\{onRowDragOver\}/)
  assert.match(rack, /onDrop=\{onRowDrop\}/)
  assert.match(rack, /decodeChainDrag\(event\.dataTransfer\.getData\(AGENT_CHAIN_MIME\)\) \?\? activeChainDrag\(\)/)
  assert.match(rack, /closest<HTMLElement>\('\[data-slot\]'\)/, 'the target is the card under the pointer, or the zone')
  assert.match(rack, /\{kind: 'zone', label: 'the drop zone'\}/)
  assert.match(rack, /\{kind: 'card', id: card\.id, label: `«\$\{card\.title\}»`\}/, 'a card drop names the card it landed beside')
  assert.match(rack, /data-slot=\{device\.id\}/, 'every card is a named drop target')
  assert.match(rack, /data-slot="zone"/, 'the zone is the semantic-position target')
  assert.match(rack, /agent-chain-gap/, 'the slide’s drop slot is visible in the row')
  assert.match(rack, /held \? dropZoneLine\(held\) : 'Drop gateways, agents, skillsets, worlds or git here'/, 'the zone updates to what is held')
  assert.match(rack, /window\.addEventListener\('dragend'/, 'a gesture that ends anywhere clears the mirror')
})

test('the chain card carries a slide grip, and the grip refuses through the receiver', async () => {
  const rack = await read('NativeAgentDeviceRack.tsx')
  assert.match(rack, /agent-chain-grip/)
  assert.match(rack, /setActiveChainDrag\(\{kind: 'reorder', reorder\}\)/)
  assert.match(rack, /event\.dataTransfer\.setData\(AGENT_CHAIN_MIME, encodeChainDrag\(reorder\)\)/)
  assert.match(rack, /void onDropAttempt\(\{kind: 'reorder', reorder: \{id, title\}\}/, 'Alt+Arrow reaches the same honest refusal')
})

test('the drop dispatches through the declared owners; refusals render as the landed card', async () => {
  const chain = await read('AgentDeviceChain.tsx')
  assert.match(chain, /harnessAgentControl\(transport, binding, decision\.operation\.control\)/, 'the agent seat dispatches harness_agent_control')
  assert.match(chain, /shell\.setSelectedTrackId\(active\.drag\.ref\)/, 'the session drop rides the run model’s selection')
  assert.match(chain, /missing op \$\{decision\.missingOp\}/, 'the refusal card names the exact missing op')
  assert.match(chain, /MISSING_OPS\.order/, 'the slide refusal names the missing order op')
  assert.match(chain, /<RefusalCard/, 'refusals render through the landed disclosure card')
  assert.match(chain, /onDismiss=\{\(\) => setDropOutcome\(null\)\}/)
  assert.match(chain, /agent-transport-note/, 'receipts render as the styled note, never a JSON dump')
  assert.doesNotMatch(chain, /JSON\.stringify\(.*drop/i, 'no raw dump on the chain surface')
  assert.match(chain, /safeJson\(outcome\.document\)/, 'the owner’s outcome document rides folded as the receipt')
})

test('the chain composition still comes from the family door — no parallel order state', async () => {
  const rack = await read('NativeAgentDeviceRack.tsx')
  const catalogue = await readFile(new URL('../src/inhabitants/agentDeviceCatalogue.ts', import.meta.url), 'utf8')
  assert.match(rack, /const devices = agentDeviceCatalogue\(\)/, 'the rack renders the declared composition')
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
