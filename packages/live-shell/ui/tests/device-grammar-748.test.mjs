// O-I #748, UI/UX phase 3: the device grammar (manual §16.3–§16.16, §19.4, §19.22, §18.2). Every catalogue device follows one grammar,
// drawn by the kit so every device inherits it: head and body; the picture first when flipped up (§16.9 "The display stands in a section of
// its own, at the left"; §16.12 "A rack's picture is its chain list"); macros after Live's racks (§16.3 Compact "up to four macros";
// §16.4 "A rack's head has three more marks, as Live's do: show or hide the macros, the chain list, and the devices of the selected
// chain" — Live 12.0.25 AreMacroControlsVisible, IsBranchesListVisible, AreDevicesVisible, devices/racks-session-model.md §1.2); chain
// order and drag (§16.1, §16.2, §19.23, §21.5: where the order is the person's, the owner's chain operation writes it; elsewhere a move is
// refused in the chain's own words, or names the operation it waits for); the pads where §16 gives them a job (§16.8, §18.2 Moves, §19.22);
// and the Agent's face (§19.4: Hears and Speaks at the face's lower corners; Context is AIKit's instrument's page, §19.26).
// Channel: SCRIPTED — the catalogue's designs rendered to static markup on their own defaults and fixtures, and the bindings' pure parts.
// Loader as factory-design-binding.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readdirSync, readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', new URL('../../../../', import.meta.url)).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(specifier,context,next){
  if(specifier.startsWith('@epilogos/expressions-boundary/'))return next(BOUNDARY+specifier.slice('@epilogos/expressions-boundary/'.length)+'.ts',context);
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.html')||url.includes('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    let source=await readFile(new URL(url).pathname,'utf8');
    if(url.endsWith('catalogue/panels/index.ts'))source=source.replace(/import\\.meta\\.glob[^(]*\\([^)]*\\)/g,'({})');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {createElement, Fragment} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const kit = await import('../src/inhabitants/sdk/panel.tsx')
const reg = await import('../src/inhabitants/catalogue/panels/index.ts')
const {deviceStates} = await import('../src/inhabitants/sdk/views.ts')
const {flippedOf} = await import('../src/inhabitants/catalogue/panels/popout.tsx')

// ---------------------------------------------------------------- a small tree of React's static markup
const VOID = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'stop', 'use'])
function parse(html) {
  const root = {tag: '#root', attrs: {}, kids: [], parent: null}
  let at = root
  const re = /<(\/)?([a-zA-Z][\w:-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/)?>|([^<]+)/g
  let m
  while ((m = re.exec(html))) {
    if (m[5] !== undefined) { at.kids.push({tag: '#text', text: m[5]}); continue }
    const [, close, tag, rawAttrs, self] = m
    if (close) { let n = at; while (n && n.tag !== tag) n = n.parent; if (n && n.parent) at = n.parent; continue }
    const attrs = {}
    for (const a of rawAttrs.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? ''
    const node = {tag, attrs, kids: [], parent: at}
    at.kids.push(node)
    if (!self && !VOID.has(tag)) at = node
  }
  return root
}
const has = (n, c) => (n.attrs?.class ?? '').split(/\s+/).includes(c)
function* walk(n) { yield n; for (const k of n.kids ?? []) if (k.tag !== '#text') yield* walk(k) }
const find = (n, pred) => { for (const x of walk(n)) if (pred(x)) return x; return null }
const all = (n, pred) => [...walk(n)].filter(pred)
const text = n => (n.tag === '#text' ? n.text : (n.kids ?? []).map(text).join(''))

// ---------------------------------------------------------------- every catalogue design, on its defaults
const panels = new URL('../src/inhabitants/catalogue/panels/', import.meta.url)
const designs = {...reg.DESIGNED}
for (const file of readdirSync(panels).filter(f => /__.*\.tsx$/.test(f))) {
  const id = file.slice(0, -4).replace('__', ':')
  const mod = await import(new URL(file, panels).href)
  designs[id] = {...mod.design, views: deviceStates(id) ?? mod.design.views}
}
const nav = {select() {}, expand() {}, full() {}, popout() {}, fold() {}, unfold() {}, rail() {}, close() {}}
const props = (d, extra = {}) => ({v: d.defaults ?? {}, set() {}, nav, page: d.firstPage ?? '', setPage() {}, standing: {}, owner: d.defaults ?? {}, ...extra})
const draw = (node, place = {onExpand() {}, onPopout() {}, onRail() {}}) => parse(renderToStaticMarkup(createElement(kit.PlaceContext.Provider, {value: place}, node)))
const CONTROL = ['dial', 'box', 'toggle', 'radio', 'chooser', 'swatch', 'text', 'action', 'pad']
const isControl = n => CONTROL.some(k => has(n, `dp-cell--${k}`))
const picture = n => find(n, x => has(x, 'dp-display') || has(x, 'dp-cell--rows'))

test('the audit covers the whole catalogue: sixty-two designs, each with its states declared once (views.ts)', () => {
  assert.ok(Object.keys(designs).length >= 62, `designs: ${Object.keys(designs).length}`)
  for (const id of Object.keys(designs)) assert.ok(deviceStates(id), `${id} declares its states in sdk/views.ts`)
})

test('head and body: every chain device draws the kit\'s head over its body in Compact and Whole, and folds to the kit\'s strip; a rail device draws the kit\'s tile', () => {
  for (const [id, d] of Object.entries(designs)) {
    const views = d.views ?? []
    if (views.includes('compact')) {
      for (const view of ['compact', 'whole']) {
        const tree = draw(d[view](props(d, {frame: view === 'compact' ? 'chain' : 'flip'})))
        assert.ok(find(tree, n => has(n, 'dp-head')), `${id} ${view}: a kit head`)
        assert.ok(find(tree, n => has(n, 'dp-body') || has(n, 'dp-band')), `${id} ${view}: a kit body`)
      }
      assert.ok(find(draw(d.folded(props(d, {frame: 'chain'}))), n => has(n, 'dp-folded')), `${id}: the kit's folded strip`)
    } else if (views.includes('widget')) {
      assert.ok(find(draw(d.widget(props(d, {frame: 'rail'}))), n => has(n, 'dp-tile')), `${id}: the kit's tile`)
    }
  }
})

test('the picture first when flipped up: expanded above the chain, the band and the section that hold the display (a rack\'s chain list) stand first', () => {
  const faults = []
  for (const [id, d] of Object.entries(designs)) {
    if (!(d.views ?? []).includes('whole')) continue
    const tree = draw(flippedOf(d, props(d, {frame: 'flip', room: {w: 1400, h: 191}}), {w: 1400, h: 191}))
    if (!picture(tree)) continue
    const band = find(tree, n => has(n, 'dp-band')) ?? find(tree, n => has(n, 'dp-body'))
    const first = band?.kids.find(k => k.tag !== '#text' && has(k, 'dp-sec'))
    if (!first || !picture(first)) faults.push(id)
  }
  assert.deepEqual(faults, [], `flipped up with the picture not first: ${faults.join(', ')}`)
})

test('macros after Live\'s racks: Compact holds four macros or fewer; a rack\'s head carries Live\'s three marks, and each hides its part', () => {
  const RACK_PARTS = ['macros', 'chains', 'devices']
  for (const [id, d] of Object.entries(designs)) {
    if (!(d.views ?? []).includes('compact')) continue
    const tree = draw(d.compact(props(d, {frame: 'chain'})))
    const mac = all(tree, n => has(n, 'dp-sec') && find(n, x => has(x, 'dp-sec-label') && /^macros$/i.test(text(x).trim())))
    const macros = mac.length ? mac.flatMap(s => all(s, isControl)).length : all(tree, isControl).length
    assert.ok(macros <= 4, `${id}: ${macros} macros in Compact`)
    if (d.kind !== 'rack') continue
    for (const view of ['compact', 'whole']) {
      const marks = all(draw(d[view](props(d, {frame: 'chain'}))), n => n.attrs?.['data-rack-mark'] !== undefined).map(n => n.attrs['data-rack-mark'])
      assert.deepEqual(marks, RACK_PARTS, `${id} ${view}: the rack's head marks`)
    }
    // Hidden by its mark, a part leaves the plate; the others stand.
    for (const part of RACK_PARTS) {
      const shown = Object.fromEntries(RACK_PARTS.map(x => [x, x !== part]))
      const whole = draw(d.whole(props(d, {frame: 'chain'})), {rackShown: shown, onRackShow() {}})
      assert.equal(all(whole, n => n.attrs?.['data-rack-part'] === part).length, 0, `${id}: ${part} hidden`)
      const mark = find(whole, n => n.attrs?.['data-rack-mark'] === part)
      assert.equal(mark.attrs['aria-pressed'], 'false', `${id}: the ${part} mark reads hidden`)
    }
    // Each rack names its macros and its chain list on its plates; the devices of the chosen chain where the rack draws them itself.
    const named = new Set([draw(d.compact(props(d, {frame: 'chain'}))), draw(d.whole(props(d, {frame: 'chain'}))),
      ...(id === 'expressions:studio' ? [draw(d.whole(props(d, {frame: 'chain', page: 'chains'})))] : [])]
      .flatMap(tree => all(tree, n => n.attrs?.['data-rack-part'] !== undefined).map(n => n.attrs['data-rack-part'])))
    assert.ok(named.has('macros') && named.has('chains'), `${id}: names its macros and chain list (${[...named]})`)
    if (id === 'expressions:studio' || id === 'software-factory:agentset-rack') assert.ok(named.has('devices'), `${id}: names the devices of its chosen chain`)
  }
})

test('the host keeps a rack\'s shown parts per device, as it keeps its fold: every place draws the same, and the chain beside it reads them', async () => {
  const host = await import('../src/frame/devices/deviceHost.tsx')
  host.resetHost('r:rack')
  assert.equal(host.rackShownOf('r:rack', 'devices'), true)
  host.setHostRack('r:rack', 'devices', false)
  assert.equal(host.rackShownOf('r:rack', 'devices'), false)
  assert.equal(host.rackShownOf('r:rack', 'macros'), true)
  host.resetHost('r:rack')
})

// ---------------------------------------------------------------- chain order and drag

test('chain order: every mode\'s chain has one law; where the manual fixes the order a move is refused in the chain\'s own words', async () => {
  const {CHAIN_LAWS, chainLaw, chainMove, slotStanding} = await import('../src/inhabitants/sdk/chains.ts')
  assert.deepEqual(Object.keys(CHAIN_LAWS).sort(), ['central-main', 'central-world', 'expressions-studio', 'factory-main', 'factory-session', 'live-part', 'techne-reading', 'workcell'])
  // The workcell: the order is the road's (§19.23), and nothing is proposed for it.
  const road = chainMove(chainLaw('workcell'), ['workcell', 'gateway', 'remote-carrier', 'git'], 'git', -1)
  assert.match(road.refused, /the road's/)
  assert.doesNotMatch(road.refused, /missing op/)
  // The agent chains: the Agent keeps its place; what stands after it waits on the chain owner's operation, named.
  const world = chainLaw('central-world')
  assert.match(chainMove(world, world.slots, 'agent', 1).refused, /keeps its order/)
  assert.match(chainMove(world, world.slots, 'docs', -1).refused, /missing op: agent-chain order \(Central\)/)
  // REPLACED (O-I #842): moving Scope on ['agent', 'skillset', 'world'] waited on "agent-chain order (Software Factory)" — a session's chain is
  // §16.2's Factory row around the Agent rack, its order fixed but for what an agent carries before its Agent, and that order is Central's
  // (§19.4 "The chain is the profile Central keeps for the agent").
  const session = chainLaw('factory-session')
  assert.match(chainMove(session, session.slots, 'world', -1).refused, /keeps its order/)
  // REPLACED (BD r19, Central #318): the order waited on "agent-chain order (Central)". Central writes it (agent-profile.chain-order), so the
  // law's op stands; the Skillset rack itself still cannot pass the Agent, which keeps its place.
  assert.deepEqual(session.op, {name: 'agent-profile.chain-order', owner: 'Central', stands: true})
  assert.match(chainMove(session, session.slots, 'skillset', 1).refused, /skillset cannot move past agent/)
  // Sources (DLW build ruling 2026-11-05; §19.9 "Chain: before the Agent"): ahead of the Agent rack, and inside an agent's chain before what it
  // carries; each place is the chain's meaning, so neither moves, and what the agent carries cannot pass the agent's own Sources.
  assert.deepEqual(session.slots, ['gateway', 'remote-carrier', 'sources', 'agentset', 'chain-sources', 'skillset', 'agent', 'world', 'git'])
  for (const slot of ['sources', 'chain-sources']) assert.match(chainMove(session, session.slots, slot, 1).refused, /keeps its order/, slot)
  assert.match(chainMove(session, session.slots, 'skillset', -1).refused, /skillset cannot move past chain-sources/)
  assert.match(session.means, /Sources ahead of the rack is the shared reading every agent of it reads/)
  assert.equal(slotStanding(world, 'packet').moves, false)
  // Live: an effect moves through the instrument's own effect-chain edit; nothing moves past the torus.
  const live = chainLaw('live-part')
  assert.deepEqual(chainMove(live, ['torus', 'effects:filter', 'effects:delay'], 'effects:delay', -1).order, ['torus', 'effects:delay', 'effects:filter'])
  assert.equal(chainMove(live, ['torus', 'effects:filter'], 'effects:filter', -1).refused.includes('past torus'), true)
  assert.match(chainMove(live, ['torus'], 'torus', 1).refused, /keeps its order/)
})

test('chain order on Central\'s and Factory\'s chains: each plate stands in a slot that names its law; its grip and ⌥←/⌥→ say why the order holds', async () => {
  const {ChainSlot, chainSlotOf} = await import('../src/frame/devices/ChainOrder.tsx')
  const {chainLaw} = await import('../src/inhabitants/sdk/chains.ts')
  const {centralChainSlots} = await import('../src/central/devices/CentralDevices.tsx')
  // Central's device ids name the law's slots, in the law's order.
  assert.deepEqual(centralChainSlots('world').map(id => chainSlotOf('central-world', id)), chainLaw('central-world').slots)
  assert.deepEqual(centralChainSlots('main').map(id => chainSlotOf('central-main', id)), chainLaw('central-main').slots)
  const law = chainLaw('central-world')
  const html = renderToStaticMarkup(createElement(ChainSlot, {law, slot: 'docs', order: law.slots, title: 'Docs'}, createElement('i', null, 'plate')))
  const tree = parse(html)
  const slot = find(tree, n => n.attrs?.['data-chain-slot'] === 'docs')
  assert.ok(slot, 'the plate stands in its chain slot')
  assert.equal(slot.attrs['data-chain'], 'central-world')
  const grip = find(slot, n => has(n, 'chain-grip'))
  assert.ok(grip, 'a grip')
  assert.match(grip.attrs['aria-label'], /missing op: agent-chain order/)
  assert.match(grip.attrs['aria-keyshortcuts'], /Alt\+ArrowLeft/)
  // A fixed slot's grip says the order holds, and names no operation.
  const fixed = parse(renderToStaticMarkup(createElement(ChainSlot, {law, slot: 'agent', order: law.slots, title: 'Agent'}, 'x')))
  assert.match(find(fixed, n => has(n, 'chain-grip')).attrs['aria-label'], /keeps its order/)
})

// ---------------------------------------------------------------- the Agent (§19.4)

const agentDesign = () => designs['actuation:harness-model']
const answering = d => ({...d.defaults, ...(d.fixtures?.['Answering on a page, hearing you'] ?? {})})

test('the Agent\'s face: Whole draws Hears and Speaks at the face\'s lower corners, and Chat, on the Answer page and the Face page', () => {
  const d = agentDesign()
  const v = answering(d)
  for (const page of ['answer', 'face']) {
    const tree = draw(d.whole(props(d, {v, owner: v, page, frame: 'flip'})))
    const face = find(tree, n => has(n, 'an-well') || has(n, 'an-preview'))
    assert.ok(face, `${page}: the whole face`)
    const marks = all(face, n => has(n, 'an-mark')).map(n => `${n.attrs['data-kind']}:${n.attrs['data-corner']}`)
    assert.deepEqual(marks, ['hears:lower-left', 'speaks:lower-right', 'chat:upper-right'], `${page}: the marks at the face's corners`)
  }
  // Full keeps its three.
  const pane = draw(d.full(props(d, {v, owner: v, frame: 'pane'})))
  assert.equal(all(pane, n => has(n, 'an-mark')).length, 3)
})

// REPLACED (§19.4 "Pages Run, Identity and Type… The Voice, Custody, Grants and Context pages leave the Agent"; §19.26 AIKit's
// instrument "Context"): the Context page is AIKit's instrument's, and neither draws a Git row — the manual names none.
test('the Agent keeps no Context page: Context stands on AIKit\'s instrument, its pressure and the last turn, and no Git row on either', () => {
  const d = agentDesign()
  const v = {...d.defaults, 'ctx.git': JSON.stringify({branch: 'dlw/build-lane', uncommitted: 3, repo: 'o-i'})}
  const run = draw(d.whole(props(d, {v, owner: v, page: 'context', frame: 'flip'})))
  assert.deepEqual(all(run, n => n.attrs?.role === 'tab').map(n => n.attrs['data-page']), ['agent', 'identity', 'type'])
  assert.equal(find(run, n => n.attrs?.['data-git-row'] !== undefined), null, 'the Agent draws no Git row')
  const aikit = designs['ai-kit:ai-kit']
  // REPLACED (§19.26 "AIKit's instrument stands only in a pane and on the rail, so it has two views, Full and Widget"; its Context page
  // holds, "for the agent you choose: the pressure and the last turn's blocks, what entered and what was withheld"): Context is a page of
  // its Full, the readings in the pane's head and the last turn's blocks under the picture.
  const context = draw(aikit.full(props(aikit, {page: 'context', frame: 'pane'})))
  assert.ok(find(context, n => has(n, 'mon-head')), 'AIKit\'s Context stands under a monitor\'s head')
  assert.match(text(context), /prompts/)
  assert.match(text(context), /moderate/)
  assert.match(text(context), /Receipts of the last edits/)
  assert.match(text(context), /withheld/)
  assert.equal(find(context, n => n.attrs?.['data-git-row'] !== undefined), null, 'AIKit\'s Context draws no Git row')
})

test('the Agent\'s Git reading, on both chains: the session\'s repository laid in as ctx.git, and why it is absent from the world scope', async () => {
  const {agentGitValues, composeAgentBinding, withAgentGit} = await import('../src/agent/devices/oneAgentBinding.ts')
  const {ROOT_KEEPS_NO_REPOSITORY, NO_SESSION} = await import('../src/agent/worldScope.ts')
  const read = agentGitValues({sessionRef: 's1', project: 'first-project', repo: {branch: 'main', uncommitted: 2}, repoRoot: '/w/first-project', error: null})
  assert.deepEqual(JSON.parse(read.values['ctx.git']), {branch: 'main', uncommitted: 2, repo: 'first-project'})
  assert.equal(agentGitValues({sessionRef: 's1', project: '', repo: null, error: null}).standing['ctx.git'].disabled, ROOT_KEEPS_NO_REPOSITORY)
  assert.equal(agentGitValues({sessionRef: null, project: '', repo: null, error: null}).standing['ctx.git'].disabled, NO_SESSION)
  assert.match(agentGitValues({sessionRef: 's1', project: 'p', repo: null, error: 'git_repository_read: no git repository'}).standing['ctx.git'].disabled, /no git repository/)
  const own = {id: 'factory:agent', values: {light: 'lit'}, write: async () => {}}
  let opened = 0
  // The Agent's own binding stands the row absent until the chain lays the repository in; laid in, the reading replaces that absence.
  const plain = composeAgentBinding({...own, standing: {'ctx.git': {disabled: 'laid in by the chain'}}}, {})
  const bound = withAgentGit(plain, {sessionRef: 's1', project: 'first-project', repo: {branch: 'main'}, error: null, openDiff: () => { opened += 1 }})
  assert.equal(bound.standing?.['ctx.git'], undefined)
  assert.ok(bound.values['ctx.git'])
  assert.equal(typeof bound.local?.['ctx.diff'], 'function', 'the press is the shell\'s own act: it opens Files\' Diff page')
  bound.local['ctx.diff'](true)
  assert.equal(opened, 1)
  assert.equal(bound.standing?.['ctx.diff'], undefined)
})

// ---------------------------------------------------------------- pads

test('pads where §16 gives them a job: the Day\'s five moves and Factory\'s sixteen prompt pads, each a trigger', () => {
  const count = (id, n) => {
    const d = designs[id]
    const tree = draw(d.whole(props(d, {frame: 'flip'})))
    const pads = all(tree, x => x.attrs?.['data-pad'] !== undefined)
    assert.equal(pads.length, n, `${id}: ${n} pads`)
    return pads.map(x => x.attrs['data-pad'])
  }
  // The Day's pad runs its move now (§18.2 "Press a pad and its move runs now"); a prompt pad is read by its press and started by Run now
  // (§19.22 The pads: "Press a pad to read it: its settings stand beside the pads, and Run now starts it").
  assert.deepEqual(count('central:day-die', 5), ['run', 'run', 'run', 'run', 'run'])
  assert.ok(count('software-factory:prompt-pads', 16).every(act => act === 'read'))
})

test('Prompt pads read Factory\'s schedule as the pad\'s own reading (↻ and its next time), open Automations to make a routine, and refuse Run now naming its launch', async () => {
  const {padRows, promptPadsBinding} = await import('../src/agent/devices/promptPadsBinding.ts')
  const bank = {schema: 'factory.prompt-pads-reading/v1', revision: 'r1', now_unix_ms: Date.UTC(2026, 9, 29, 7, 0), slots: [
    {index: 0, pad: {name: 'Checks', prompt: 'Run the checks', session: {kind: 'new'}, runs_at: {kind: 'daily', time: '08:00', days: ['mon', 'tue', 'wed', 'thu', 'fri']}}, next_at_unix_ms: Date.UTC(2026, 9, 29, 8, 0), running: null, last: null},
    {index: 1, pad: {name: 'Week', prompt: 'Write up the week', session: {kind: 'new'}, runs_at: {kind: 'every', hours: 6}}, next_at_unix_ms: null, running: null, last: null},
    {index: 2, pad: {name: 'Review', prompt: 'Review the branch', session: {kind: 'new'}, runs_at: {kind: 'off'}}, running: null, last: null},
  ]}
  const rows = padRows(bank, 'UTC')
  assert.equal(rows[0].routine?.when, 'weekdays 08:00')
  assert.equal(rows[1].routine?.when, 'every 6 h')
  assert.equal(rows[2].routine, undefined, 'a pad Factory gives no time runs only when pressed')
  const located = {status: 'answered', value: {locations: [{state: 'located', project: 'p', location: {statePath: '/s', projectRef: 'p'}}]}, error: null}
  const opened = []
  const binding = promptPadsBinding({located, bank: {status: 'answered', value: bank, error: null}, holds: {views: {}}}, {write: async () => {}, makeRoutine: pad => opened.push(pad)})
  assert.equal(typeof binding.local?.makeRoutine, 'function', 'Make routine is the shell\'s own act')
  assert.equal(binding.standing?.makeRoutine, undefined)
  binding.local.makeRoutine(2)
  assert.deepEqual(opened, [{index: 2, projectRef: 'p', project: 'p', name: 'Review'}])
  assert.match(binding.standing.press.disabled, /missing op/)
  // No Settings window handed in: Make routine stands closed and says so.
  assert.match(promptPadsBinding({located, bank: {status: 'answered', value: bank, error: null}, holds: {views: {}}}, {}).standing.makeRoutine.disabled, /Settings/)
})

// O-I ticket 748's remainder (DLW build ruling 2026-11-05, round 867): a rack stands on the chain as Live's does and as the shell mockup
// draws it (world-shell-mockup.html `.rack`): its head — the title bar over the macros and the chain list only, with the column of view
// buttons on the left under it — then the chosen chain's devices at full height, their title bars level with the rack's, then a narrow
// end bracket. Hide the macros and the chain list and the head stands as a strip with its name turned on its side.
test('a rack on the chain stands as Live\'s: its head, the chosen chain\'s devices after it at full height, the end bracket; hiding its macros and chain list leaves the head a named strip', () => {
  const RACK_PARTS = ['macros', 'chains', 'devices']
  const plateOf = tree => find(tree, n => n.tag === 'section' && n.attrs?.['data-rack'] === 'true')
  const kidsOf = n => (n?.kids ?? []).filter(k => k.tag !== '#text')
  const marksIn = n => all(n, x => x.attrs?.['data-rack-mark'] !== undefined).map(x => x.attrs['data-rack-mark'])
  let racks = 0
  for (const [id, d] of Object.entries(designs)) {
    if (d.kind !== 'rack' || !(d.views ?? []).includes('compact')) continue
    racks += 1
    const plate = plateOf(draw(d.compact(props(d, {frame: 'chain'}))))
    assert.ok(plate, `${id}: the rack's plate on the chain`)
    const kids = kidsOf(plate), head = kids[0]
    assert.ok(has(head, 'dp-rack-head'), `${id}: the head stands first`)
    const [bar, inside] = kidsOf(head)
    assert.ok(has(bar, 'dp-head'), `${id}: the title bar spans the head only`)
    assert.deepEqual(marksIn(bar), [], `${id}: the view buttons are not in the title bar`)
    assert.ok(has(kidsOf(inside)[0], 'dp-rack-col'), `${id}: the column of view buttons stands on the left, under the title bar`)
    assert.deepEqual(marksIn(kidsOf(inside)[0]), RACK_PARTS, `${id}: the column holds Live's three view buttons`)
    assert.equal(all(head, n => n.attrs?.['data-rack-part'] === 'devices').length, 0, `${id}: no device of the chosen chain stands inside the head`)
    assert.ok(has(kids.at(-1), 'dp-rack-end'), `${id}: the end bracket closes the rack`)
    const devs = kids.find(k => has(k, 'dp-rack-devs'))
    if (id === 'software-factory:agentset-rack') {
      assert.ok(devs && find(devs, n => n.attrs?.['data-rack-part'] === 'devices'), `${id}: the chosen chain's devices stand after the head`)
      assert.ok(kids.indexOf(devs) === 1, `${id}: between the head and the end bracket`)
    }
    // Hide the macros and the chain list: the head is a strip, its name turned on its side, its view buttons still on it.
    const stripped = plateOf(draw(d.compact(props(d, {frame: 'chain'})), {rackShown: {macros: false, chains: false, devices: true}, onRackShow() {}}))
    const strip = kidsOf(stripped)[0]
    assert.ok(has(strip, 'dp-rack-strip'), `${id}: the head stands as a strip`)
    assert.ok(find(strip, n => has(n, 'dp-activator')), `${id}: the strip keeps the activator`)
    assert.deepEqual(marksIn(strip), RACK_PARTS, `${id}: and the view buttons`)
    assert.ok(text(find(strip, n => has(n, 'dp-rack-strip-name')) ?? {kids: []}).trim().length > 0, `${id}: and the rack's name`)
    assert.equal(all(stripped, n => n.attrs?.['data-rack-part'] === 'macros' || n.attrs?.['data-rack-part'] === 'chains').length, 0, `${id}: the hidden parts leave`)
    assert.ok(has(kidsOf(stripped).at(-1), 'dp-rack-end'), `${id}: the bracket still closes it`)
  }
  assert.ok(racks >= 3, `the racks on the chain: ${racks}`)
  // Each rack fills the chain's height: the devices beside its head keep the chain's body, not the head's body less a title bar.
  const css = readFileSync(new URL('../src/inhabitants/sdk/panel.css', import.meta.url), 'utf8')
  assert.match(css, /\.dp\[data-rack="true"\]\[data-view="compact"\] \{[^}]*flex-direction: row/, 'the rack lays its head, devices and bracket in a row')
  assert.match(css, /\.dp-rack-strip-name \{[^}]*writing-mode: vertical-rl/, 'the strip\'s name reads upward')
})

// ---------------------------------------------------------------- every design state of every device (O-I #858 r40)
// Each design drawn in each state it ships (its defaults, and each fixture laid over them as the gallery lays it), in each view it has, on
// each page its head offers: [where, the markup]. A state that cannot be drawn is [where, the error]. And each state once more with every
// list its owner hands emptied (an array, or an array as JSON, made empty), so a list's own words for nothing are drawn.
const emptied = v => Object.fromEntries(Object.entries(v).map(([k, x]) => {
  if (Array.isArray(x)) return [k, []]
  if (typeof x === 'string' && x.startsWith('[')) { try { if (Array.isArray(JSON.parse(x))) return [k, '[]'] } catch {} }
  return [k, x]
}))
const STATE_VIEWS = ['compact', 'whole', 'full', 'widget']
const FRAMES = {compact: 'chain', whole: 'flip', full: 'pane', widget: 'rail'}
const ROOMS = {whole: {w: 1400, h: 191}, full: {w: 1200, h: 700}}
function everyState() {
  const out = []
  for (const [id, d] of Object.entries(designs)) {
    for (const [state, fixture] of [['defaults', {}], ...Object.entries(d.fixtures ?? {})]) {
      const read = {...d.defaults}
      for (const [k, x] of Object.entries(fixture)) { if (x === undefined) delete read[k]; else read[k] = x }
      for (const [named, v] of [[state, read], [`${state}, every list emptied`, emptied(read)]])
      for (const view of STATE_VIEWS.filter(x => (d.views ?? STATE_VIEWS).includes(x))) {
        const at = page => renderToStaticMarkup(createElement(kit.PlaceContext.Provider, {value: {onExpand() {}, onPopout() {}, onRail() {}}},
          d[view]({v, set() {}, nav, page, setPage() {}, standing: {}, owner: v, frame: FRAMES[view], room: ROOMS[view]})))
        const drawn = (where, page) => { try { out.push({where, markup: at(page)}) } catch (error) { out.push({where, error: String(error).split('\n')[0]}) } }
        let first = ''
        try { first = at(d.firstPage ?? '') } catch {}
        const pages = [...new Set([...first.matchAll(/data-page="([^"]*)"/g)].map(m => m[1]))]
        if (!pages.length) drawn(`${id} · ${named} · ${view}`, d.firstPage ?? '')
        for (const page of pages) drawn(`${id} · ${named} · ${view} · ${page}`, page)
      }
    }
  }
  return out
}
let states = null
const allStates = () => states ??= everyState()
const unescape = s => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/** The spans the designs' stylesheets give their own wrappers in a section's grid (`.x { grid-column: 1 / -1 }`, `span 2`): class → 'all' or n. */
const SPANS = new Map(readdirSync(panels).filter(f => f.endsWith('.css')).flatMap(f => [...readFileSync(new URL(f, panels), 'utf8').matchAll(/([^{}]+)\{[^}]*grid-column:\s*(1 \/ -1|span (\d+))/g)]
  .flatMap(([, selectors, , n]) => selectors.split(',').map(one => one.trim().match(/^\.([\w-]+)$/)?.[1]).filter(Boolean).map(c => [c, n ? Number(n) : 'all']))))

test('a control\'s name is never cut: in every design state of every device, each name over (or under) its control fits the column its section gives it, at the kit\'s measure (manual §16.9)', () => {
  const NAMED_CELLS = ['dial', 'box', 'radio', 'chooser', 'swatch', 'text', 'readout']
  const faults = new Set()
  let names = 0
  for (const {where, markup, error} of allStates()) {
    if (error) { faults.add(`${where}: cannot be drawn: ${error}`); continue }
    for (const sec of all(parse(markup), n => has(n, 'dp-sec'))) {
      const width = Number(sec.attrs.style?.match(/(?:^|;)width:([\d.]+)px/)?.[1])
      if (!width) continue // a section the design gives no measure takes its content's: its names stand whole
      const body = sec.kids.find(k => k.tag !== '#text' && has(k, 'dp-sec-body'))
      const cols = Number(body?.attrs.style?.match(/grid-template-columns:repeat\((\d+)/)?.[1] ?? 1)
      const room = (width - 12 - (cols - 1) * 4) / cols
      for (const cell of all(sec, n => NAMED_CELLS.some(k => has(n, `dp-cell--${k}`)))) {
        const label = cell.kids.find(k => k.tag === 'span' && has(k, 'dp-label'))
        if (!label) continue
        const name = unescape(text(label))
        names++
        // a cell (or the design's wrapper round it, standing in the section's grid) may span columns
        let place = cell
        while (place.parent && place.parent !== body) place = place.parent
        const style = place.attrs?.style ?? '', classes = (place.attrs?.class ?? '').split(/\s+/)
        const span = /grid-column:1 \/ -1/.test(style) || classes.some(c => SPANS.get(c) === 'all') ? cols
          : Math.min(cols, Number(style.match(/grid-column:span (\d+)/)?.[1] ?? classes.map(c => SPANS.get(c)).find(Number) ?? 1))
        const given = span * room + (span - 1) * 4
        if (kit.nameWidth(name) + 2 > given) faults.add(`${where.split(' · ')[0]} · ${where.split(' · ').slice(2).join(' · ')}: "${name}" needs ${Math.ceil(kit.nameWidth(name) + 2)} px, its column gives ${Math.floor(given)}`)
      }
    }
  }
  console.log(`[names] ${names} names read in ${allStates().length} drawn states`)
  assert.ok(names > 5000, `the guard reads the catalogue's names: ${names}`)
  assert.deepEqual([...faults], [], 'a name cut short in its column')
  // where the kit does not measure the place (a design's own grid, a tile), a name breaks at a space and a long word stands whole: never cut
  const rule = readFileSync(new URL('../src/inhabitants/sdk/panel.css', import.meta.url), 'utf8').match(/\.dp-cell:not\(\.dp-cell--rows\) > \.dp-label \{([^}]*)\}/)?.[1] ?? ''
  assert.match(rule, /white-space: normal/, 'a name breaks at a space where it must')
  assert.match(rule, /overflow: visible/, 'and is never clipped')
  assert.doesNotMatch(rule, /ellipsis/, 'and never shortened with an ellipsis')
})

// ---------------------------------------------------------------- a name measured in the face that draws it (O-I #858 r42, lane BA's finding)
// The kit measured a name with Helvetica's widths; the shell's system face draws names up to about a tenth wider at 10 px, so a section the
// table passed could still cut a name. Each name below stands in a section exactly as wide as that table gave it room (Atmosphere 53.9 px
// + 2 spare + 12 = 68), and in the face the browser draws it is wider than that room. Where a browser draws, the kit measures the drawn face.
const DRAWN_NAMES = `
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {createElement as h} from 'react'
import {Section, Dial, nameWidth} from './src/inhabitants/sdk/panel'
import './src/styles.css'
;(window as any).__drawn = (given: [string, number][]) => given.map(([name, width]) => {
  const host = document.createElement('div')
  host.className = 'dp'
  document.body.appendChild(host)
  const root = createRoot(host)
  flushSync(() => root.render(h(Section, {width, cols: 1}, h(Dial, {label: name, value: .5, scale: {min: 0, max: 1}, format: String}))))
  const label = host.querySelector('.dp-label') as HTMLElement, cell = label.parentElement as HTMLElement
  const out = {name, given: width, drawn: label.getBoundingClientRect().width, room: cell.getBoundingClientRect().width, measured: nameWidth(name)}
  root.unmount(); host.remove()
  return out
})
`
test('a name the old table passed is not cut where the face that draws it is wider: the kit measures the drawn face (O-I #858 r42)', {timeout: 120_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  const browser = await layoutBrowser(t, playwright)
  if (!browser) return
  try {
    const ui = fileURLToPath(new URL('..', import.meta.url))
    const {js, css} = await bundleEntry({contents: DRAWN_NAMES, resolveDir: ui, sourcefile: 'drawn-names.tsx', outfile: 'drawn-names.mjs'})
    const tab = await browser.newPage({viewport: {width: 800, height: 400}})
    const errors = []
    tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
    await tab.setContent(shellHtml({js, css: `${FACES}\n${css}`}), {waitUntil: 'load'})
    await tab.waitForFunction(() => window.__drawn, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })
    // the widths Helvetica's table gave each name room in, one column: its width + 2 spare + the section's 12
    const drawn = await tab.evaluate(given => window.__drawn(given), [['Atmosphere', 68], ['Integrity', 50], ['Moisture', 53], ['Light a star', 64]])
    assert.deepEqual(errors, [])
    assert.deepEqual(drawn.filter(({drawn, room}) => drawn > room + .5).map(({name, drawn, room}) => `${name}: drawn ${drawn.toFixed(1)} px in a column of ${room.toFixed(1)}`), [], 'a name drawn wider than its column')
    // where a browser draws, the kit's measure is the face's own: the width the name is drawn at
    assert.deepEqual(drawn.filter(({name, drawn, measured}) => !name.includes(' ') && Math.abs(measured - drawn) > .5).map(({name, drawn, measured}) => `${name}: measured ${measured.toFixed(1)}, drawn ${drawn.toFixed(1)}`), [])
  } finally { await browser.close() }
})

test('the kit measures a name as its sans draws it at 10 px, and a section widens to the names it holds: never its height', () => {
  // where nothing draws, the table: never narrower than the system face draws it (Atmosphere 58.2 px in Chromium on macOS, r42)
  assert.equal(Math.round(kit.nameWidth('Atmosphere') * 10) / 10, 60.4, 'Atmosphere: 60 px, never narrower than the face draws it')
  assert.ok(kit.nameWidth('Tilt') < kit.nameWidth('Clouds'))
  const dial = label => createElement(kit.Dial, {label, value: .5, scale: {min: 0, max: 1}, format: String})
  assert.equal(kit.sectionWidth([dial('Warmth'), dial('Clouds'), dial('Tilt')], 3, 150), 150, 'names that fit leave the section as the design gave it')
  assert.equal(kit.sectionWidth([dial('Atmosphere'), dial('Clouds'), dial('Tilt')], 3, 150), 208, 'the widest name sets every column')
  assert.equal(kit.sectionWidth(createElement(Fragment, null, dial('Atmosphere')), undefined, 60), 75, 'through a fragment, in one column')
  assert.equal(kit.sectionWidth([dial('Atmosphere')], undefined, undefined), undefined, 'a section with no measure takes its content\'s')
  assert.equal(kit.sectionWidth([dial('Height')], 1, undefined, 'Weakening'), 78, 'a section widens to its own name')
  assert.equal(kit.sectionWidth([dial('Height')], 1, undefined, 'Walls'), 56, 'a name that fits leaves it as given')
})

test('every list on every device, in every design state, says what it holds or lacks: read and empty in its own words, not read with the No-reading mark; never a never-read light over blank rows (DLW build ruling 2026-11-06)', () => {
  const faults = new Set()
  let lists = 0
  for (const {where, markup, error} of allStates()) {
    if (error) { faults.add(`${where}: cannot be drawn: ${error}`); continue }
    for (const {index} of markup.matchAll(/<div class="dp-cell dp-cell--rows"/g)) {
      const list = markup.slice(index, markup.indexOf('</ul>', index) + 5), head = list.slice(0, list.indexOf('<ul'))
      const section = markup.slice(0, index).match(/class="dp-sec-label">[^<]*</g)?.pop()?.slice(21, -1) ?? '?'
      const said = unescape(head.match(/data-i="([^"]*)"/)?.[1] ?? '').split('|')
      const at = `${where.split(' · ')[0]} · ${where.split(' · ').slice(2).join(' · ')} · ${section}${said[0] ? ` · ${said[0]}` : ''}`
      lists++
      if (/data-light="unknown"/.test(head)) faults.add(`${at}: a never-read light (${where.split(' · ')[1]})`)
      const rows = list.match(/<li class="dp-row[ "]/g)?.length ?? 0
      const first = list.match(/<li class="dp-row dp-row--empty"><span class="dp-row-name">([^<]*)</)?.[1]
      if (!rows) faults.add(`${at}: blank rows (${where.split(' · ')[1]})`)
      else if (first !== undefined && !first.trim()) faults.add(`${at}: a row's place without words (${where.split(' · ')[1]})`)
    }
  }
  console.log(`[lists] ${lists} lists read in ${allStates().length} drawn states`)
  assert.ok(lists > 2000, `the guard reads the catalogue's lists: ${lists}`)
  assert.deepEqual([...faults], [], 'a list that does not say what it holds or lacks')
  // its words stand whole in the first row's place: they break onto the lines they need, never cut short
  const rule = readFileSync(new URL('../src/inhabitants/sdk/panel.css', import.meta.url), 'utf8').match(/\.dp-row--empty \.dp-row-name \{([^}]*)\}/)?.[1] ?? ''
  assert.match(rule, /white-space: normal/, 'a list\'s words break where they must')
  assert.match(rule, /overflow: visible/, 'a list\'s words are never hidden')
  assert.doesNotMatch(rule, /ellipsis/, 'a list\'s words are never cut with an ellipsis')
})

// ---------------------------------------------------------------- a list's nothing is its own words, never a row (O-I #858 r41)
// A row the design makes to say the list holds nothing stands as an entry would: with a light, a choice and a row's place, counted among the
// rows. The list's own words (Rows `empty`, or `unreadRows` where it is not read) say it instead. Found by its stand-in id, or as a list's
// lone row whose words say nothing is there.
const STAND_IN_IDS = new Set(['none', 'empty', 'clear', 'nothing', 'unread'])
const SAYS_NOTHING = /^(No|Nothing|None)\b|^In no\b|^Every [\w ]+ (is|has been)\b|^The [\w ]+ (holds|asks for|runs|exposes) (no|nothing)\b/

test('no list draws a row of its own to say it holds nothing: in every design state of every device, the list\'s own words say it (O-I #858, DLW build ruling 2026-11-06)', () => {
  const faults = new Set()
  let rows = 0
  for (const {where, markup, error} of allStates()) {
    if (error) continue // the guards above name a state that cannot be drawn
    for (const {index} of markup.matchAll(/<div class="dp-cell dp-cell--rows"/g)) {
      const list = markup.slice(index, markup.indexOf('</ul>', index) + 5)
      const section = markup.slice(0, index).match(/class="dp-sec-label">[^<]*</g)?.pop()?.slice(21, -1) ?? '?'
      const said = unescape(list.slice(0, list.indexOf('<ul')).match(/data-i="([^"]*)"/)?.[1] ?? '').split('|')[0]
      const at = `${where.split(' · ')[0]} · ${where.split(' · ').slice(2).join(' · ')} · ${section}${said ? ` · ${said}` : ''}`
      const drawn = [...list.matchAll(/<li class="dp-row"[^>]*?data-id="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)].map(([, id, inner]) => ({id: unescape(id),
        name: unescape(inner.match(/class="dp-row-name[^"]*"[^>]*>([^<]*)</)?.[1] ?? '')}))
      rows += drawn.length
      for (const row of drawn) if (STAND_IN_IDS.has(row.id)) faults.add(`${at}: a row "${row.name}" (id ${row.id})`)
      if (drawn.length === 1 && SAYS_NOTHING.test(drawn[0].name)) faults.add(`${at}: a row "${drawn[0].name}" (id ${drawn[0].id})`)
    }
  }
  assert.ok(rows > 4000, `the guard reads the catalogue's rows: ${rows}`)
  // and in the source, where a state the designs do not ship would draw one
  const sources = ['../src/inhabitants/catalogue/panels/', '../src/inhabitants/catalogue/faces/', '../src/inhabitants/ql/devices/'].flatMap(dir =>
    readdirSync(new URL(dir, import.meta.url)).filter(f => /\.tsx?$/.test(f)).map(f => [`${dir.split('/').slice(-2, -1)[0]}/${f}`, readFileSync(new URL(dir + f, import.meta.url), 'utf8')]))
  const made = sources.flatMap(([file, text]) => [...text.matchAll(/\{id: '(none|empty|clear|nothing|unread)', name:/g)].map(m => `${file}:${text.slice(0, m.index).split('\n').length}`))
  assert.deepEqual([...faults, ...made.map(at => `${at}: a row made to say the list holds nothing`)], [], 'a list that draws a row to say it holds nothing')
})

// ---------------------------------------------------------------- the kit's curve rule is where a curve's line is set (O-I #858 r41)
// panel.css `.dp-display .dp-curve` (and `.dp-curve-on`) sets a curve's stroke and width; a presentation attribute on the same element loses
// to it, so a design that draws a curve heavier, lighter or in another colour by attribute draws nothing of it. It says so by style.
test('no design sets a curve\'s line by an attribute the kit\'s curve rule overrides: in every design state of every device, a stroke or a width is set by style (O-I #858)', () => {
  const css = readFileSync(new URL('../src/inhabitants/sdk/panel.css', import.meta.url), 'utf8')
  assert.match(css, /\.dp-display \.dp-curve \{[^}]*stroke:[^}]*stroke-width:/, 'the kit\'s rule sets a curve\'s stroke and width')
  const faults = new Set()
  let curves = 0
  for (const {where, markup, error} of allStates()) {
    if (error) continue
    for (const [tag] of markup.matchAll(/<(?:path|line|polyline|circle|ellipse|rect)\b[^>]*class="(?:[^"]* )?dp-curve(?:-on)?(?: [^"]*)?"[^>]*>/g)) {
      curves++
      const dead = [...tag.matchAll(/ (stroke|stroke-width)="([^"]*)"/g)].map(([, name, value]) => `${name}="${value}"`)
      if (dead.length) faults.add(`${where.split(' · ')[0]} · ${where.split(' · ').slice(2).join(' · ')}: ${dead.join(' ')}`)
    }
  }
  assert.ok(curves > 500, `the guard reads the catalogue's curves: ${curves}`)
  assert.deepEqual([...faults], [], 'a curve\'s line set by an attribute the kit\'s rule overrides')
})

// ---------------------------------------------------------------- a section's own name is never cut (O-I #858 r41)
test('a section\'s own name is never cut: in every design state of every device, each section\'s name fits the section, at the kit\'s measure (panel.css .dp-sec-label)', () => {
  const faults = new Set()
  let labels = 0
  for (const {where, markup, error} of allStates()) {
    if (error) continue
    for (const sec of all(parse(markup), n => has(n, 'dp-sec'))) {
      const width = Number(sec.attrs.style?.match(/(?:^|;)width:([\d.]+)px/)?.[1])
      const label = sec.kids.find(k => k.tag !== '#text' && has(k, 'dp-sec-label'))
      if (!width || !label) continue // a section the design gives no measure takes its content's, its name with it
      const name = unescape(text(label))
      labels++
      if (kit.labelWidth(name) + 2 > width - 12) faults.add(`${where.split(' · ')[0]} · ${where.split(' · ').slice(2).join(' · ')}: "${name}" needs ${Math.ceil(kit.labelWidth(name) + 2)} px, its section gives ${width - 12}`)
    }
  }
  assert.ok(labels > 3000, `the guard reads the catalogue's section names: ${labels}`)
  assert.deepEqual([...faults], [], 'a section\'s name cut short')
  assert.equal(Math.round(kit.labelWidth('Weakening')), 63, 'WEAKENING: 63 px, never narrower than the face draws it')
})

// ---------------------------------------------------------------- every design state laid out in Chromium (O-I #858 r41)
// What the markup cannot say, the browser lays out: every design state above (as read, and with every list emptied), in each view, on each
// page, drawn with the kit's stylesheet. No section's content runs past its foot; no control's name stands outside its section or over
// another's; no name, section name or tile title is cut; no light is squeezed. Each design's states are mounted together and measured at
// once. CI's candidate job installs Chromium before this suite (desktop.yml, O-I #858 r42), so there a missing Chromium fails the
// guard; on a machine without one the test says so and is skipped.
/** The Chromium the layout guards lay the designs out in: on CI (where the candidate job installs it first) a missing one fails the guard,
 * elsewhere the guard says so and is skipped. */
async function layoutBrowser(t, playwright) {
  try { return await playwright().chromium.launch() } catch (error) {
    const why = `no Chromium to lay the designs out in: ${String(error?.message ?? error).split('\n')[0]}`
    if (process.env.CI) throw new Error(`${why} (CI installs it before this suite: desktop.yml)`)
    t.skip(why); return undefined
  }
}
const FACES = `:root{--bg-0:#26292d;--bg-1:#33363b;--bg-2:#3f4348;--bg-3:#4a4e54;--line:#24262a;--line-strong:#3d4147;--text:#d4d7da;--text-dim:#a2a7ad;--text-faint:#71767c;--accent:#ffbe00;--green:#8fd0a8;--rec:#e0523f}
*{box-sizing:border-box}html,body{margin:0;background:#1b1d20;color:var(--text);font:12px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}`
const LAID_OUT = `
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {createElement as h} from 'react'
import {PlaceContext} from './src/inhabitants/sdk/panel'
import {deviceStates} from './src/inhabitants/sdk/views'
import {day} from './src/inhabitants/catalogue/panels/day'
import {memberDevice} from './src/inhabitants/catalogue/panels/member'
import {physics} from './src/inhabitants/catalogue/panels/physics'
import {scope} from './src/inhabitants/catalogue/panels/scope'
import {skills} from './src/inhabitants/catalogue/panels/skills'
import {torus} from './src/inhabitants/catalogue/panels/torus'
import './src/inhabitants/catalogue/panels/panels.css'
${readdirSync(panels).filter(f => /__.*\.tsx$/.test(f)).map((f, i) => `import {design as m${i}} from './src/inhabitants/catalogue/panels/${f.slice(0, -4)}'`).join('\n')}
const designs: any = {}
for (const d of [day, torus, physics, skills, memberDevice, scope, ${readdirSync(panels).filter(f => /__.*\.tsx$/.test(f)).map((_, i) => `m${i}`).join(', ')}] as any[]) designs[d.id] = {...d, views: deviceStates(d.id) ?? d.views}
const VIEWS = ['compact', 'whole', 'full', 'widget'], FRAMES: any = {compact: 'chain', whole: 'flip', full: 'pane', widget: 'rail'}
const ROOMS: any = {whole: {w: 1400, h: 191}, full: {w: 1200, h: 700}}
const nav = {select() {}, expand() {}, full() {}, popout() {}, fold() {}, unfold() {}, rail() {}, close() {}}, place = {onExpand() {}, onPopout() {}, onRail() {}}
const emptied = (v: any) => Object.fromEntries(Object.entries(v).map(([k, x]: any) => {
  if (Array.isArray(x)) return [k, []]
  if (typeof x === 'string' && x.startsWith('[')) { try { if (Array.isArray(JSON.parse(x))) return [k, '[]'] } catch {} }
  return [k, x]
}))
;(window as any).__ids = Object.keys(designs)
;(window as any).__lay = async (id: string) => {
  const d = designs[id], faults: string[] = [], mounts: {where: string; el: HTMLElement; root: any}[] = []
  const mount = (where: string, view: string, v: any, page: string) => {
    const el = document.createElement('div')
    el.className = view === 'whole' ? 'dp-wide' : ''
    el.style.width = view === 'full' ? '1200px' : '1400px'
    el.style.padding = '8px'
    document.body.appendChild(el)
    const root = createRoot(el)
    try { flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, d[view]({v, set() {}, nav, page, setPage() {}, standing: {}, owner: v, frame: FRAMES[view], room: ROOMS[view]})))) }
    catch (error) { faults.push(where + ': cannot be laid out: ' + String(error).split('\\n')[0]) }
    mounts.push({where, el, root})
    return el
  }
  for (const [state, fixture] of [['defaults', {}], ...Object.entries(d.fixtures ?? {})] as any[]) {
    const read: any = {...d.defaults}
    for (const [k, x] of Object.entries(fixture)) { if (x === undefined) delete read[k]; else read[k] = x }
    for (const [named, v] of [[state, read], [state + ', every list emptied', emptied(read)]] as any[])
      for (const view of VIEWS.filter(x => (d.views ?? VIEWS).includes(x))) {
        const first = mount(id + ' · ' + named + ' · ' + view, view, v, d.firstPage ?? '')
        const pages = [...new Set([...first.querySelectorAll('[data-page]')].map(x => x.getAttribute('data-page')!))].filter(x => x !== (d.firstPage ?? ''))
        for (const page of pages) mount(id + ' · ' + named + ' · ' + view + ' · ' + page, view, v, page)
      }
  }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  for (const {where, el} of mounts) {
    const say = (x: string) => faults.push(where + ': ' + x)
    for (const box of el.querySelectorAll<HTMLElement>('.dp-sec, .dp-tile')) {
      const b = box.getBoundingClientRect()
      if (box.classList.contains('dp-sec') && box.scrollHeight > box.clientHeight + 1)
        say('"' + (box.querySelector('.dp-sec-label')?.textContent ?? 'a section') + '" runs ' + (box.scrollHeight - box.clientHeight) + ' px past its foot')
      const names = [...box.querySelectorAll<HTMLElement>('.dp-cell > .dp-label')].filter(n => n.closest('.dp-sec, .dp-tile') === box).map(n => ({t: n.textContent, r: n.getBoundingClientRect()}))
      for (const n of names) if (n.r.left < b.left - .5 || n.r.right > b.right + .5) say('"' + n.t + '" stands outside its ' + (box.classList.contains('dp-tile') ? 'tile' : 'section'))
      names.forEach((n, i) => names.slice(i + 1).forEach(o => { if (n.r.left < o.r.right - .5 && o.r.left < n.r.right - .5 && n.r.top < o.r.bottom - .5 && o.r.top < n.r.bottom - .5) say('"' + n.t + '" runs into "' + o.t + '"') }))
      // a section's own buttons (its acts, the face's pressable words) stand within it and clear of one another (r41: the World's Acts
      // ran "Follow the thread" into "See in sky (the Sun)" and past the section's edge)
      if (box.classList.contains('dp-sec')) {
        const acts = [...box.querySelectorAll<HTMLElement>('button.dp-action')].filter(x => x.closest('.dp-sec') === box && x.getBoundingClientRect().width > 0).map(x => ({t: x.textContent, r: x.getBoundingClientRect()}))
        for (const x of acts) if (x.r.left < b.left - .5 || x.r.right > b.right + .5) say('"' + x.t + '" stands outside its section')
        acts.forEach((x, i) => acts.slice(i + 1).forEach(o => { if (x.r.left < o.r.right - .5 && o.r.left < x.r.right - .5 && x.r.top < o.r.bottom - .5 && o.r.top < x.r.bottom - .5) say('"' + x.t + '" runs into "' + o.t + '"') }))
      }
    }
    for (const x of el.querySelectorAll<HTMLElement>('.dp-label, .dp-sec-label, .dp-tile-title, .dp-folded-title span'))
      if (x.scrollWidth > x.clientWidth + .5) say('"' + x.textContent + '" is cut (' + x.clientWidth + ' of ' + x.scrollWidth + ' px)')
    for (const x of el.querySelectorAll<HTMLElement>('.dp-lamp')) if (x.getBoundingClientRect().width < 6.5) say('a light squeezed to ' + x.getBoundingClientRect().width.toFixed(1) + ' px')
  }
  for (const {root, el} of mounts) { root.unmount(); el.remove() }
  return faults
}
`
test('every design state laid out in Chromium: no section runs past its foot, no name stands outside its section or over another, no name, section name or tile title is cut, no light squeezed (O-I #858)', {timeout: 900_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  let browser
  browser = await layoutBrowser(t, playwright)
  if (!browser) return
  try {
    const ui = fileURLToPath(new URL('..', import.meta.url))
    const {js, css} = await bundleEntry({contents: LAID_OUT, resolveDir: ui, sourcefile: 'laid-out.tsx', outfile: 'laid-out.mjs'})
    const tab = await browser.newPage({viewport: {width: 1420, height: 900}})
    const errors = []
    tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
    await tab.setContent(shellHtml({js, css: `${FACES}\n${css}`}), {waitUntil: 'load'})
    await tab.waitForFunction(() => window.__ids, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })
    const ids = await tab.evaluate(() => window.__ids)
    assert.deepEqual([...ids].sort(), Object.keys(designs).sort(), 'the browser lays out the designs the markup guards read')
    const faults = []
    for (const id of ids) faults.push(...await tab.evaluate(x => window.__lay(x), id))
    assert.deepEqual(errors, [], 'no design throws while it is laid out')
    assert.deepEqual(faults, [], 'a design state whose layout runs past its section, cuts a name or squeezes a light')
  } finally { await browser.close() }
})

// ---------------------------------------------------------------- a Whole wider than its band is reached, never cut (O-I #858 walk, r41)
// The expanded band is as wide as the detail area; a Whole laid out wider than that (the World's Star and Shown pages, the day-die's
// Field) ran past the band's edge and its last sections could not be reached at all: in a 1440-wide window the World's Ask, Asked
// here, Hand on, Handed on and Reached you stood outside the window. The band scrolls sideways, as Live's Device View scrolls a chain
// wider than itself, and never up and down. Every page of every design's Whole, in a band 1160 wide.
const REACHED = `
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {createElement as h} from 'react'
import {PlaceContext} from './src/inhabitants/sdk/panel'
import {deviceStates} from './src/inhabitants/sdk/views'
import {day} from './src/inhabitants/catalogue/panels/day'
import {memberDevice} from './src/inhabitants/catalogue/panels/member'
import {physics} from './src/inhabitants/catalogue/panels/physics'
import {scope} from './src/inhabitants/catalogue/panels/scope'
import {skills} from './src/inhabitants/catalogue/panels/skills'
import {torus} from './src/inhabitants/catalogue/panels/torus'
import './src/inhabitants/catalogue/panels/panels.css'
import './src/frame/devices/devices.css'
import './src/styles.css'
${readdirSync(panels).filter(f => /__.*\.tsx$/.test(f)).map((f, i) => `import {design as m${i}} from './src/inhabitants/catalogue/panels/${f.slice(0, -4)}'`).join('\n')}
const all: any[] = [day, torus, physics, skills, memberDevice, scope, ${readdirSync(panels).filter(f => /__.*\.tsx$/.test(f)).map((_, i) => `m${i}`).join(', ')}]
const nav = {select() {}, expand() {}, full() {}, popout() {}, fold() {}, unfold() {}, rail() {}, close() {}}, place = {onExpand() {}, onPopout() {}, onRail() {}}
;(window as any).__reach = async () => {
  const faults: string[] = [], wider: string[] = [], starWide: string[] = []
  for (const d of all) {
    if (!(deviceStates(d.id) ?? d.views ?? ['whole']).includes('whole')) continue
    const draw = (page: string, v: any = d.defaults ?? {}) => {
      const host = document.createElement('div'), band = document.createElement('div')
      host.className = 'device-flip-host'
      host.style.cssText = 'width:1160px;height:200px'
      band.className = 'dp-wide dp-flip device-flip'
      host.appendChild(band)
      document.body.appendChild(host)
      const root = createRoot(band)
      flushSync(() => root.render(h(PlaceContext.Provider, {value: place}, h('div', {className: 'device-place device-place--whole'}, h('div', {className: 'device device--whole'},
        d.whole({v, set() {}, nav, page, setPage() {}, standing: {}, owner: v, frame: 'flip', room: {w: 1150, h: 191}}))))))
      return {band, root}
    }
    const first = draw(d.firstPage ?? '')
    const pages = [...new Set([...first.band.querySelectorAll('[data-page]')].map(x => x.getAttribute('data-page')!))]
    first.root.unmount(); first.band.parentElement!.remove()
    for (const page of pages.length ? pages : [d.firstPage ?? '']) {
      const {band, root} = draw(page)
      const where = d.id + ' · ' + (page || 'its page')
      const css = getComputedStyle(band), last = [...band.querySelectorAll<HTMLElement>('.dp-sec')].pop()
      if (band.scrollWidth > band.clientWidth + 1) {
        wider.push(where)
        if (!['auto', 'scroll'].includes(css.overflowX)) faults.push(where + ': ' + (band.scrollWidth - band.clientWidth) + ' px past the band cannot be reached')
        band.scrollLeft = band.scrollWidth
        if (last && last.getBoundingClientRect().right > band.getBoundingClientRect().right + 1) faults.push(where + ': its last section stays past the band')
        // and the plate holds what it scrolls to: no section stands off the plate on the band's bare ground
        const plate = band.querySelector<HTMLElement>('.dp')
        if (last && plate && last.getBoundingClientRect().right > plate.getBoundingClientRect().right + 1) faults.push(where + ': its sections run off the plate')
      }
      if (['auto', 'scroll'].includes(css.overflowY)) faults.push(where + ': the band scrolls up and down')
      root.unmount(); band.parentElement!.remove()
    }
    // the World's star, what was said there and its agents asked, each on a page of its own that stands within the band, in every state
    // the design gives (O-I #858 r42; the Star page laid out 2112 px wide)
    if (d.id === 'atlas-earth:globe-engine') for (const [state, fx] of Object.entries<any>(d.fixtures ?? {})) for (const page of ['star', 'said', 'talk']) {
      const {band, root} = draw(page, {...d.defaults, ...fx})
      if (band.scrollWidth > band.clientWidth + 1) starWide.push(state + ' · ' + page + ': ' + band.scrollWidth + ' px')
      root.unmount(); band.parentElement!.remove()
    }
  }
  return {faults, wider, starWide}
}
`
test('a Whole wider than its expanded band is reached by scrolling the band sideways, never cut, and the band never scrolls up and down (O-I #858 walk)', {timeout: 300_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  let browser
  browser = await layoutBrowser(t, playwright)
  if (!browser) return
  try {
    const ui = fileURLToPath(new URL('..', import.meta.url))
    const {js, css} = await bundleEntry({contents: REACHED, resolveDir: ui, sourcefile: 'reached.tsx', outfile: 'reached.mjs'})
    const tab = await browser.newPage({viewport: {width: 1420, height: 900}})
    const errors = []
    tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
    await tab.setContent(shellHtml({js, css: `${FACES}\n${css}`}), {waitUntil: 'load'})
    await tab.waitForFunction(() => window.__reach, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })
    const {faults, wider, starWide} = await tab.evaluate(() => window.__reach())
    assert.deepEqual(errors, [])
    // REPLACED (round 42): the World's Star page no longer lays out wider than the band (it is split, below); its Shown page still does
    assert.ok(wider.some(where => where.startsWith('atlas-earth:globe-engine · shown')), `the World's Shown page is wider than the band (${wider.join(', ')})`)
    assert.deepEqual(faults, [], 'a Whole whose sections past the band cannot be reached')
    assert.deepEqual(starWide, [], 'the World’s Star, Said and Talk pages stand within the expanded band in every state')
  } finally { await browser.close() }
})
