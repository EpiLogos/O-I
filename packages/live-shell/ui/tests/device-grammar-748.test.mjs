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
const {createElement} = await import('react')
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
