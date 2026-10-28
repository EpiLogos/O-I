// O-I #769, "The pool of QL frames and MEF lenses" (decision #709 "The pool": "QL frames and MEF lenses are the DLW's grooves — extracted
// from a constellation, chosen in the Clip panel, applied without changing the source, a lens's sublenses as its parameters, Commit writing
// the reading into the wiki. Live mode keeps Live's grooves beside them. A workspace's layout is kept by its set; reusable arrangements are
// templates in the browser"). Manual §10.3 The pool, §16.5 (Groove), §16.7 The pool, §17.4 (forms), §17.11 (lenses).
// Channels: FIXTURE — a wiki register as AIKit's `wiki-construct apply` wrote it (28 Oct, scratch run), QL's lens registry as
// `ql mef lenses --json` answers it (28 Oct). SCRIPTED — a kernel behind the bridge's fetch that records every op. OWNER — where AIKit and
// QL are installed, the same kernel hands the Commit to the real `aikit wiki-construct apply --file` on a scratch register (an isolated
// AIKIT_HOME) and the refraction to the real `ql wiki refract -`, and the reading is read back from AIKit (`wiki-construct inspect`).
// Production modules in memory through the transpiling loader (clip-source-constellation.test.mjs's). NOT a screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {spawnSync} from 'node:child_process'
import {mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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
  if (u.includes('?raw') || u.includes('.html') || u.endsWith('.svg') || u.endsWith('.png') || u.endsWith('.md')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const noop = () => {}
const stored = new Map()
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage = {getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)), removeItem: key => stored.delete(key), key: () => null, length: 0}

const {createElement: h} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const grooves = await import('../src/frame/browser/grooves.ts')
const pool = await import('../src/frame/browser/poolStore.ts')
const owners = await import('../src/owners/grooveOwners.ts')
const {decodeRegister} = await import('../../../../desktop/cradle/src/knowledge/construction.ts')
const {GROOVE, MADE_OF} = await import('../src/inhabitants/catalogue/clips/design.ts')
const {loadClip} = await import('../src/inhabitants/catalogue/clips/index.ts')
const clipGroove = await import('../src/frame/detail/clipGroove.ts')
const {clipBinding, resetViewHolds} = await import('../src/frame/detail/clipBinding.ts')
const {GroovePool} = await import('../src/frame/browser/GroovePool.tsx')
const templates = await import('../src/frame/browser/templates.ts')
const {TemplateRowsView} = await import('../src/frame/browser/TemplateRows.tsx')
const {readFile} = await import('node:fs/promises')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const BRIDGE = {kind: 'bridge', url: 'http://kernel.test'}

// ---------------------------------------------------------------------------------------------------------------- the owners' readings

/** QL's lens registry, as `ql mef lenses --json` answered it on 28 Oct (registry 1.0.0-q2): the lenses this fixture's members stand in. */
const sub = (code, labels) => labels.map((label, position) => ({label, position, sublensRef: `mef:sublens:${code}.${position}@1`}))
const LENSES = [
  {lensRef: 'mef:lens:L0@1', code: 'L0', name: 'Quaternal', face: 'day', square: 'articulation', sublenses: sub('L0', ['Why', 'What', 'How', 'Whom/Which/When', 'Where/Why-for', 'Why-so/Why-not'])},
  {lensRef: 'mef:lens:L1@1', code: 'L1', name: 'Causal', face: 'day', square: 'encounter',
    sublenses: sub('L1', ['Svātantrya', 'Material cause', 'Efficient cause', 'Formal cause', 'Final cause', 'Icchā Śakti / Will'])},
  {lensRef: "mef:lens:L1'@1", code: "L1'", name: 'Phenomenal', face: 'night', square: 'encounter', sublenses: sub("L1'", ['a', 'b', 'c', 'd', 'e', 'f'])},
  {lensRef: 'mef:lens:L2@1', code: 'L2', name: 'Logical', face: 'day', square: 'becoming', sublenses: sub('L2', ['a', 'b', 'c', 'd', 'e', 'f'])},
]
const ROLE = (key, position, conjugate = false) => ({role_ref: `${key}:role:${conjugate ? 'conjugate' : 'direct'}:${position}`, label: `${position}${conjugate ? '′' : ''}`,
  address: {position, conjugate, face: conjugate ? 'conjugate' : 'direct'}})
const THREEFOLD_KEY = 'ql:authoring:1.0.0:threefold-123'
const THREEFOLD = {shape_ref: 'ql:shape:1.0.0:constellation:threefold-123', contract_ref: 'ql.shape@1.0.0', roles: [1, 2, 3].map(p => ROLE(THREEFOLD_KEY, p)), provenance: [], standing: 'proposed'}
const PAIR_KEY = 'ql:authoring:1.0.0:pair:A:0'
const PAIR = {shape_ref: 'ql:shape:1.0.0:constellation:twofold', contract_ref: 'ql.shape@1.0.0', roles: [0, 1].map(p => ROLE(PAIR_KEY, p)), provenance: [], standing: 'proposed'}

const SOURCE = 'wiki:anchor:lived-in', TARGET = 'wiki:anchor:days-turning'
const node = (ref, title) => ({object: 'node', profile: 'okf-wiki/v1', ref, title, type: 'note', space_refs: ['wiki:space:o-i'], provenance: [], revision: 1})
const NODES = [node('wiki:node:ground', 'Ground'), node('wiki:node:material', 'Material'), node('wiki:node:process', 'Process'), node('wiki:node:night', 'Night')]
const SPACE = {object: 'space', profile: 'okf-wiki/v1', ref: 'wiki:space:o-i', title: 'O-I', node_refs: NODES.map(n => n.ref), child_space_refs: [], provenance: [], revision: 1}

/** The register as AIKit's `wiki-construct apply` writes a constellation someone authored (the frame row's shape, 28 Oct). */
function frameRow({ref, anchor, title, frame, members, revision = 2}) {
  return {object: 'frame', profile: 'okf-wiki/v1', ref, revision, provenance: [], space_refs: ['wiki:space:o-i'], external_refs: [], member_refs: [anchor, ...members.map(m => m.ref)],
    'aikit.constellation/v1': {title, inquiry: {question: `What does ${title} hold?`, purpose: ''}, authored_by: 'human:cradle-wiki', frame, alternatives: [], applied: {}, compositions: [], relation_refs: [], variant_of: null},
    constellations: [{anchor_ref: anchor, returns: [], members: members.map(m => ({ref: m.ref, conjugate: false,
      'aikit.constellation-participation/v1': {participation_ref: m.participation, role_ref: m.role ?? null, sources: [], note: '', nested: null}}))}]}
}
const SOURCE_ROW = frameRow({ref: 'wiki:frame:lived', anchor: SOURCE, title: 'The lived-in world', frame: THREEFOLD, members: [
  {ref: 'wiki:node:material', participation: 'participation:wiki:m', role: `${THREEFOLD_KEY}:role:direct:1`},
  {ref: 'wiki:node:process', participation: 'participation:wiki:p', role: `${THREEFOLD_KEY}:role:direct:2`}]})
const TARGET_ROW = frameRow({ref: 'wiki:frame:turning', anchor: TARGET, title: 'The day\'s turning', frame: PAIR, members: [
  {ref: 'wiki:node:ground', participation: 'participation:wiki:g', role: `${PAIR_KEY}:role:direct:0`},
  {ref: 'wiki:node:material', participation: 'participation:wiki:t', role: `${PAIR_KEY}:role:direct:1`}]})
const REGISTER = {objects: [SPACE, ...NODES, SOURCE_ROW, TARGET_ROW]}
const content = objects => JSON.stringify(objects, null, 2)
const fileOf = text => ({location: {schema: 'central.path-ref/v1', ref: 'native:Work/O-I/ProjectCentral/agents/wiki/wiki.json', root: '/ground', path: 'Work/O-I/ProjectCentral/agents/wiki/wiki.json'},
  revision: createHash('sha256').update(text).digest('hex'), content: text})

/** The constellations as the wiki's projection lists them (owners/constellations.ts Constellation). */
const LIVED = {ref: SOURCE, title: 'The lived-in world', kind: 'frame', register: 'O-I', registerTitle: 'O-I', project: 'O-I',
  members: [{ref: 'wiki:node:material', title: 'Material', position: null}, {ref: 'wiki:node:process', title: 'Process', position: null}]}
const TURNING = {ref: TARGET, title: 'The day\'s turning', kind: 'frame', register: 'O-I', registerTitle: 'O-I', project: 'O-I',
  members: [{ref: 'wiki:node:ground', title: 'Ground', position: null}, {ref: 'wiki:node:material', title: 'Material', position: null}]}
const O_I = {ref: 'wiki:node:project-root/o-i', title: 'O-I', kind: 'space', register: 'O-I', registerTitle: 'O-I', project: 'O-I',
  members: [{ref: 'wiki:node:o-i/dlw', title: 'The DLW', position: 2}, {ref: 'wiki:node:project-root/o-i', title: 'O-I', position: null}]}

// ---------------------------------------------------------------------------------------------------------------- the scripted kernel

/** A kernel behind the bridge's fetch: Central discloses the O-I register and its file, QL reads, and AIKit's construction action runs —
 * on the held text (`apply`), or through the real AIKit on a scratch file. Every op is recorded. */
function kernel({text, apply, refract}) {
  const sent = []
  let held = text
  const ok = outcome => ({json: async () => ({ok: true, outcome})})
  const invoked = (owner_operation, data) => ok({result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation, data}})
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    const file = fileOf(held())
    if (body.op === 'world_browse') return ok({result: 'world_read', snapshot: {navigator: {root: {work: {projects: [{name: 'O-I', path: 'Work/O-I'}]}}}}})
    if (body.op === 'project_browse') return ok({result: 'world_read', snapshot: {navigator: {project: {project: {name: 'O-I', path: 'Work/O-I'}}}}})
    if (body.op === 'invoke_action' && body.invocation.action === 'projectcentral.wiki.read')
      return invoked('projectcentral.wiki.read', {schema: 'central.wiki-reading/v1', source: {path: 'ProjectCentral/agents/wiki/wiki.json', ref: 'project:O-I:wiki', revision: file.revision}})
    if (body.op === 'files_list') return ok({result: 'directory_read', directory: {location: file.location, entries: [{name: 'wiki.json', kind: 'file', location: file.location}]}})
    if (body.op === 'file_read') return ok({result: 'file_read', reading: file})
    if (body.op === 'invoke_action' && body.invocation.action === 'aikit.constellation.apply') {
      if (body.invocation.input.expected_file_revision !== file.revision) return {json: async () => ({ok: false, error: 'wiki_revision_conflict'})}
      const answer = apply(body.invocation.input.request, file.content)
      if (!answer.ok) return ok({result: 'action_dispatched', dispatch: {state: 'owner_refused', owner_operation: 'aikit wiki-construct apply', message: answer.error}})
      return invoked('aikit wiki-construct apply', answer.data)
    }
    if (body.op === 'ql_read' && body.request.kind === 'wiki-refract') return ok({result: 'owner_route_reading', route: 'ql wiki refract', data: refract(body.request.request)})
    return {json: async () => ({ok: false, error: `the fixture kernel answers no ${body.op}`})}
  }
  return {sent, fetch, set: next => { held = next }}
}
async function withKernel(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}
const writes = sent => sent.filter(body => body.op === 'invoke_action' && !body.invocation.action.endsWith('.wiki.read') || /write|operation|apply/.test(body.op))
/** QL's answer to a refraction, as `ql wiki refract -` gave it on 28 Oct for a frame target read through L1, Efficient cause. */
const QL_ANSWER = request => ({contract: 'ql-mef/wiki-refraction/v1', status: 'complete', target_ref: request.target.target_ref, target_snapshot_hash: request.target.target_snapshot_hash, notices: [],
  readings: [{contract: 'ql-mef/wiki-refraction/v1', reading_ref: `ql-mef:reading:registry:${request.target.target_ref}:L1`, reading_type: 'MEF-derived', target_ref: request.target.target_ref,
    lens_ref: request.lenses[0].lens_ref, ...(request.lenses[0].sublens_ref ? {sublens_ref: request.lenses[0].sublens_ref} : {}), disclosure: `Causal / Efficient cause refractive reading of ${request.target.target_ref}`,
    explanation: 'QL-MEF refracted stable target without mutating client identity', result_class: 'deterministic'}]})

const has = command => spawnSync('sh', ['-c', `command -v ${command}`]).status === 0

// ---------------------------------------------------------------------------------------------------------------- extraction

test('a constellation gives up its frame and the lenses its members stand in, each as its owner gives it; one with no form gives up lenses only', () => {
  const register = decodeRegister(fileOf(content(REGISTER)), 'project:O-I:wiki')
  const lived = register.frames.find(frame => frame.constellations[0].anchor_ref === SOURCE)
  const from = {ref: SOURCE, title: 'The lived-in world', register: 'O-I'}
  const {grooves: taken, said} = grooves.groovesOf({from, frame: lived['aikit.constellation/v1'].frame, stands: grooves.standsOfConstruction(lived), lenses: LENSES})
  assert.deepEqual(taken.map(g => [g.kind, g.name]), [['frame', 'Threefold 1–2–3'], ['lens', 'L1 Causal'], ['lens', 'L2 Logical']],
    'its form, then the lenses at the positions its members hold (roles 1 and 2)')
  assert.deepEqual(taken[0].frame, THREEFOLD, 'the frame is the form its author gave it, verbatim')
  assert.deepEqual(taken[1].sublenses.map(s => s.label), LENSES[1].sublenses.map(s => s.label), 'a lens stands with its six sublenses, QL\'s labels in position order')
  assert.equal(taken[1].sublenses[2].ref, 'mef:sublens:L1.2@1')
  assert.deepEqual(said, [])
  const space = grooves.groovesOf({from: {ref: O_I.ref, title: 'O-I', register: 'O-I'}, frame: null, stands: grooves.standsOfConstellation(O_I), lenses: LENSES})
  assert.deepEqual(space.grooves.map(g => g.name), ['L2 Logical'], 'a space\'s member at position 2 (its node\'s ql.position) gives up L2')
  assert.match(space.said[0], /O-I has no frame of its own/)
  const night = grooves.groovesOf({from, frame: null, stands: [{ref: 'x', position: 1, conjugate: true}, {ref: 'y', position: 5, conjugate: false}], lenses: LENSES})
  assert.deepEqual(night.grooves.map(g => g.name), ['L1′ Phenomenal'], 'the conjugate face reads through the night lens')
  assert.match(night.said.at(-1), /registry gives no L5/, 'a lens QL\'s registry does not give is named, never drawn')
})

test('a constellation carries the project its register reads are scoped to, as the projection\'s register says; your world\'s carries none', async () => {
  const {parseWiki} = await import('../../../../desktop/cradle/src/techne/wikiReading.ts')
  const {projectWikiExpression} = await import('../../../../desktop/cradle/src/techne/wikiExpression.ts')
  const constellations = await import('../src/owners/constellations.ts')
  const projected = (register, objects) => {
    const reading = {state: 'ready', register, wiki: parseWiki(JSON.stringify(objects)), wikiBasis: {path: 'wiki.json', revision: 'r1', location: {schema: 'central.path-ref/v1', ref: 'x', root: '/g', path: 'wiki.json'}},
      relations: {state: 'unavailable', focusRef: '', reason: 'not read in this fixture'}}
    return {phase: 'projected', reading, projection: projectWikiExpression(reading)}
  }
  const central = {key: 'central', title: 'Central'}, oi = {key: 'O-I', title: 'O-I', project: 'O-I', projectPath: 'Work/O-I'}
  const rows = constellations.constellationsOf({registers: [central, oi], standings: {central: projected(central, {objects: [{object: 'space', ref: 'central:wiki:root', title: 'Central', node_refs: []}]}),
    'O-I': projected(oi, REGISTER)}}).rows
  assert.equal(rows.find(row => row.ref === SOURCE).project, 'O-I', 'the register\'s project: Commit reads and writes that project\'s wiki')
  assert.equal(rows.find(row => row.register === 'central').project, undefined, 'your world\'s register is scoped to no project')
})

test('dropping a constellation on the pool reads its owners and writes nothing: the register through Central, the lenses from QL', async () => {
  const owner = kernel({text: () => content(REGISTER), apply: () => assert.fail('extraction writes nothing'), refract: () => assert.fail('extraction reads no reading')})
  const taken = await withKernel(owner, () => owners.extractGroovesFrom(LIVED, {transport: BRIDGE, lenses: LENSES}))
  assert.equal(taken.ok, true, taken.error)
  assert.deepEqual(taken.grooves.map(g => g.name), ['Threefold 1–2–3', 'L1 Causal', 'L2 Logical'])
  assert.deepEqual(writes(owner.sent), [], 'nothing is written by taking grooves out of a constellation')
  assert.ok(owner.sent.some(body => body.op === 'invoke_action' && body.invocation.action === 'projectcentral.wiki.read'), 'the register is the one Central discloses')
  const space = await withKernel(owner, () => owners.extractGroovesFrom(O_I, {transport: BRIDGE, lenses: LENSES}))
  assert.deepEqual(space.grooves.map(g => g.name), ['L2 Logical'], 'a space is read from the projection\'s declared positions')
})

// ---------------------------------------------------------------------------------------------------------------- the pool

test('the pool holds the frames and lenses taken out, once each; it holds no workspace; Live\'s grooves stand beside them', () => {
  pool.resetPool()
  const from = {ref: SOURCE, title: 'The lived-in world', register: 'O-I'}
  const {grooves: taken} = grooves.groovesOf({from, frame: THREEFOLD, stands: [{ref: 'a', position: 1, conjugate: false}], lenses: LENSES})
  pool.addGrooves(taken)
  pool.addGrooves(taken)
  assert.deepEqual(pool.poolNow().grooves.map(g => g.name), ['Threefold 1–2–3', 'L1 Causal'], 'a groove taken twice stands once')
  const html = renderToStaticMarkup(h(GroovePool, {face: null}))
  assert.match(html, /data-pool="frames-and-lenses"/)
  for (const column of ['Name', 'Hot-swap', 'Sublenses', 'Commit']) assert.match(html, new RegExp(`role="columnheader"[^>]*>${column}<`), `the ${column} column`)
  assert.match(html, /data-groove="frame:ql:shape:1\.0\.0:constellation:threefold-123@1,2,3"[\s\S]*Threefold 1–2–3/)
  assert.match(html, /data-groove="lens:mef:lens:L1@1"[\s\S]*L1 Causal/)
  assert.match(html, /<select[^>]*aria-label="Sublens of L1 Causal"[^>]*>[\s\S]*Whole lens[\s\S]*Efficient cause/, 'a lens\'s sublenses are its parameter')
  for (const gone of ['Workspaces', 'Panes', 'Instruments', 'Opens in', 'On launch', 'Keep context', 'Launch', 'workspace-pool'])
    assert.doesNotMatch(html, new RegExp(gone), `no workspace stands in the pool (${gone})`)
  const live = renderToStaticMarkup(h(GroovePool, {face: {label: 'Grooves', face: h('div', {'data-set-grooves': 'yes'})}}))
  assert.match(live, /data-pool="frames-and-lenses"[\s\S]*data-set-grooves="yes"/, 'in Live the set\'s grooves stand beside the frames and lenses, no switch between')
  assert.doesNotMatch(live, /data-action="pool-face"/)
  pool.resetPool()
  assert.match(renderToStaticMarkup(h(GroovePool, {face: null})), /Drop a constellation here/, 'empty, the pool says how to fill it')
})

// ---------------------------------------------------------------------------------------------------------------- chosen on a clip

const fromLived = {ref: SOURCE, title: 'The lived-in world', register: 'O-I'}
const TAKEN = () => grooves.groovesOf({from: fromLived, frame: THREEFOLD, stands: [{ref: 'a', position: 1, conjugate: false}], lenses: LENSES}).grooves
const FRAME_ID = 'frame:ql:shape:1.0.0:constellation:threefold-123@1,2,3', LENS_ID = 'lens:mef:lens:L1@1'

test('Groove in the Clip panel chooses a frame or a lens from the pool in each mode, and in Live also the set\'s grooves', async () => {
  pool.resetPool(); pool.addGrooves(TAKEN())
  for (const mode of ['techne', 'central', 'expressions', 'factory', 'live']) {
    const design = await loadClip(mode)
    const v = {...design.defaults, ...clipGroove.grooveValues(pool.poolNow(), `clip:${mode}:c1`, null)}
    const html = renderToStaticMarkup(h('div', null, design.panel[0].draw({v, set: noop, size: 'detail', room: {w: 1180, h: 300}})))
    assert.match(html, /<select[^>]*aria-label="Groove"[^>]*>[\s\S]*Threefold 1–2–3[\s\S]*L1 Causal/, `${mode}: Groove offers the pool's frame and lens`)
    if (mode === 'live') assert.match(html, /aria-label="Groove"[\s\S]*Swing 16-55/, 'Live\'s Groove also offers the set\'s grooves')
    assert.doesNotMatch(html, /Causal reading of the turning/, `${mode}: a clip read through nothing shows no reading`)
    pool.chooseGroove(`clip:${mode}:c1`, LENS_ID)
    const read = {...design.defaults, ...clipGroove.grooveValues(pool.poolNow(), `clip:${mode}:c1`, {state: 'read', words: 'Causal reading of the turning'})}
    const grooved = renderToStaticMarkup(h('div', null, design.panel[0].draw({v: read, set: noop, size: 'detail', room: {w: 1180, h: 300}})))
    assert.match(grooved, /<option value="lens:mef:lens:L1@1" selected="">L1 Causal/, `${mode}: the groove the clip is read through stands chosen`)
    assert.match(grooved, /Causal reading of the turning/, `${mode}: the clip's reading through it shows in the Clip panel`)
  }
})

test('choosing a groove on a clip changes neither the clip\'s source nor the wiki: the choice is the set\'s, the clip is read through it', async () => {
  pool.resetPool(); pool.addGrooves(TAKEN()); resetViewHolds()
  for (const mode of ['techne', 'central']) {
    const base = clipBinding({mode, ref: 'c1', values: {[MADE_OF.name]: 'The day\'s turning', [MADE_OF.ref]: TARGET}, wiring: {reads: {[MADE_OF.name]: 'wiki'}, acts: {}, view: {}, refused: {}}})
    const owner = kernel({text: () => content(REGISTER), apply: () => assert.fail('choosing writes nothing'), refract: QL_ANSWER})
    const bound = clipGroove.withGroove(base, pool.poolNow(), null)
    assert.equal(bound.writes(GROOVE.choice), true)
    await withKernel(owner, () => bound.write([{key: GROOVE.choice, value: LENS_ID}]))
    assert.equal(pool.chosenOf(base.id), LENS_ID, `${mode}: the clip reads through the lens`)
    const after = clipGroove.withGroove(base, pool.poolNow(), {state: 'read', words: 'Causal reading'})
    assert.equal(after.values[GROOVE.choice], LENS_ID)
    assert.equal(after.values[GROOVE.reading], 'Causal reading')
    assert.equal(after.values[MADE_OF.ref], TARGET, 'the source stays as it is')
    assert.deepEqual(owner.sent, [], 'choosing asks no owner and writes nothing')
  }
})

test('a clip read through a lens is QL\'s refraction of its constellation, sublens and all; a frame reads its roles; nothing is written', async () => {
  const [, lens] = TAKEN()
  const owner = kernel({text: () => content(REGISTER), apply: () => assert.fail('a reading writes nothing'), refract: QL_ANSWER})
  const read = await withKernel(owner, () => owners.readThrough({constellation: TURNING, groove: lens, sublens: 2, transport: BRIDGE}))
  assert.equal(read.ok, true, read.error)
  assert.equal(read.words, `Causal / Efficient cause refractive reading of ${TARGET}`, 'QL\'s own disclosure')
  const asked = owner.sent.find(body => body.op === 'ql_read').request.request
  assert.equal(asked.contract, 'ql-mef/wiki-refraction/v1')
  assert.equal(asked.target.target_ref, TARGET, 'the clip\'s source is the target')
  assert.equal(asked.target.target_frame_ref, 'wiki:frame:turning')
  assert.deepEqual(asked.target.subjects, [{subject_ref: 'wiki:node:ground', position: 0, face: 'direct'}, {subject_ref: 'wiki:node:material', position: 1, face: 'direct'}],
    'the members at the positions their roles give them')
  assert.deepEqual(asked.lenses, [{lens_ref: 'mef:lens:L1@1', sublens_ref: 'mef:sublens:L1.2@1'}], 'the sublens turned is the reading\'s')
  assert.match(asked.target.target_snapshot_hash, /^sha256:[0-9a-f]{64}$/)
  assert.deepEqual(writes(owner.sent), [], 'a reading writes nothing')
  if (has('ql')) {
    const real = spawnSync('ql', ['wiki', 'refract', '-', '--json'], {input: JSON.stringify(asked), encoding: 'utf8'})
    assert.equal(real.status, 0, real.stderr)
    const answer = JSON.parse(real.stdout)
    assert.equal(answer.status, 'complete', 'the installed QL takes the request as built')
    assert.equal(answer.readings[0].sublens_ref, 'mef:sublens:L1.2@1')
    assert.match(answer.readings[0].disclosure, /Causal \/ Efficient cause/)
  }
  const frame = await withKernel(owner, () => owners.readThrough({constellation: TURNING, groove: TAKEN()[0], sublens: null, transport: BRIDGE}))
  assert.equal(frame.words, 'Read through Threefold 1–2–3: 1 of 3 roles filled, 2, 3 open; 1 member outside the form.')
})

// ---------------------------------------------------------------------------------------------------------------- Commit

/** Runs the real AIKit on a scratch register: `wiki-construct apply --file`, with the kernel's own input ({request, basis_content}). */
function realAikit(dir) {
  const env = {...process.env, AIKIT_HOME: join(dir, 'aikit-home'), HOME: join(dir, 'aikit-home')}
  const file = join(dir, 'wiki.json')
  const run = (args, input) => spawnSync('aikit', args, {cwd: dir, env, input: input === undefined ? undefined : JSON.stringify(input), encoding: 'utf8'})
  return {file, text: () => readFileSync(file, 'utf8'),
    apply: (request, basis) => { const done = JSON.parse(run(['wiki-construct', 'apply', '--file', file, '--json'], {request, basis_content: basis}).stdout || '{}'); return done.ok ? {ok: true, data: done.data} : {ok: false, error: done.error?.message ?? 'AIKit refused'} },
    inspect: ref => JSON.parse(run(['wiki-construct', 'inspect', '--file', file, ref, '--json']).stdout).data.reading.frame}
}

test('Commit writes the clip\'s reading through a frame into the wiki through AIKit, where the constellation keeps it; it is read back from AIKit', {skip: has('aikit') ? false : 'AIKit is not installed on this machine'}, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'oi-769-pool-'))
  try {
    mkdirSync(join(dir, 'aikit-home'))
    const aikit = realAikit(dir)
    // The register as AIKit writes it: the nodes, then two constellations someone authored, each through AIKit's own create.
    writeFileSync(aikit.file, content({objects: [SPACE, ...NODES]}))
    const create = (ref, anchor, title, frame, members) => aikit.apply({schema: 'aikit.constellation-action/v1', frame_ref: ref, expected_revision: 0, actor_ref: 'human:cradle-wiki', operation_ref: `operation:wiki:${ref}`,
      changes: [{change: 'create', anchor_ref: anchor, title, inquiry: {question: `What does ${title} hold?`}, space_refs: ['wiki:space:o-i'], frame},
        ...members.map(([subject, participation, role]) => ({change: 'member_add', member: {subject_ref: subject, participation: {participation_ref: participation, role_ref: role, sources: [], note: ''}}}))]}, aikit.text())
    assert.equal(create('wiki:frame:lived', SOURCE, 'The lived-in world', THREEFOLD, [['wiki:node:material', 'participation:wiki:m', `${THREEFOLD_KEY}:role:direct:1`]]).ok, true)
    assert.equal(create('wiki:frame:turning', TARGET, 'The day\'s turning', PAIR, [['wiki:node:ground', 'participation:wiki:g', `${PAIR_KEY}:role:direct:0`],
      ['wiki:node:material', 'participation:wiki:t', `${PAIR_KEY}:role:direct:1`]]).ok, true)
    const owner = kernel({text: aikit.text, apply: aikit.apply, refract: QL_ANSWER})
    const taken = await withKernel(owner, () => owners.extractGroovesFrom(LIVED, {transport: BRIDGE, lenses: LENSES}))
    const frame = taken.grooves.find(g => g.kind === 'frame')
    const before = aikit.text()
    await withKernel(owner, () => owners.readThrough({constellation: TURNING, groove: frame, sublens: null, transport: BRIDGE}))
    assert.equal(aikit.text(), before, 'reading through the frame leaves the wiki as it was')
    const committed = await withKernel(owner, () => owners.commitReading({constellation: TURNING, groove: frame, sublens: null, transport: BRIDGE}))
    assert.equal(committed.ok, true, committed.error)
    assert.match(committed.note, /The day's turning now stands in Threefold 1–2–3 in the wiki/)
    const kept = aikit.inspect('wiki:frame:turning')
    assert.equal(kept['aikit.constellation/v1'].frame.shape_ref, THREEFOLD.shape_ref, 'AIKit reads back the frame the reading put the constellation in')
    const roles = Object.fromEntries(kept.constellations[0].members.map(m => [m.ref, m['aikit.constellation-participation/v1'].role_ref]))
    assert.deepEqual(roles, {'wiki:node:ground': null, 'wiki:node:material': `${THREEFOLD_KEY}:role:direct:1`},
      'the member at 1 holds the form\'s role at 1; the one at 0 stands outside the form')
    assert.equal(aikit.inspect('wiki:frame:lived')['aikit.constellation/v1'].frame.shape_ref, THREEFOLD.shape_ref, 'the constellation the frame came out of is unchanged')
    const apply = owner.sent.filter(body => body.op === 'invoke_action' && body.invocation.action === 'aikit.constellation.apply')
    assert.equal(apply.length, 1, 'only Commit writes, once')
    assert.equal(apply[0].invocation.target_ref, 'wiki:frame:turning')
  } finally { rmSync(dir, {recursive: true, force: true}) }
})

test('Commit of a lens\'s reading stands refused, naming the operation AIKit lacks; it writes nothing', async () => {
  const [, lens] = TAKEN()
  const owner = kernel({text: () => content(REGISTER), apply: () => assert.fail('nothing is written'), refract: QL_ANSWER})
  const committed = await withKernel(owner, () => owners.commitReading({constellation: TURNING, groove: lens, sublens: 2, transport: BRIDGE}))
  assert.equal(committed.ok, false)
  assert.match(committed.error, /missing op: aikit\.constellation\.apply reading_put \(AIKit\)/)
  assert.deepEqual(writes(owner.sent), [])
  const space = await withKernel(owner, () => owners.commitReading({constellation: O_I, groove: TAKEN()[0], sublens: null, transport: BRIDGE}))
  assert.equal(space.ok, false, 'a space keeps no frame: no one authored it round a question')
  assert.match(space.error, /O-I is a space of your wiki/)
})

// ---------------------------------------------------------------------------------------------------------------- templates

const tree = tag => ({root: null, surfaces: {[`s-${tag}`]: {id: `s-${tag}`, kind: 'projection', title: tag}}, mode: 'techne'})
const BOOK = () => ({active: 'set', workspaces: [
  {id: 'set', name: 'Today', writing: '', layout: tree('front')},
  {id: 'tpl', name: 'Reading room', writing: '', layout: tree('reading'), modeLayouts: {base: tree('reading-central')}, widgets: {open: ['w1']}},
]})

test('a reusable arrangement is a template in the browser: starting from it gives the set its layout and leaves the template as it was', () => {
  const book = BOOK()
  assert.deepEqual(templates.templatesOf(book).map(t => t.name), ['Reading room'], 'the set you are in is not its own template')
  const started = templates.startFromTemplate(book, 'tpl', 5)
  assert.equal(started.active, 'set', 'the set stays the set')
  const front = started.workspaces.find(w => w.id === 'set')
  assert.deepEqual(Object.keys(front.layout.surfaces), ['s-reading'], 'the set takes the template\'s layout')
  assert.deepEqual(front.modeLayouts, {base: tree('reading-central')})
  assert.deepEqual(front.widgets, {open: ['w1']})
  assert.deepEqual(started.workspaces.find(w => w.id === 'tpl'), book.workspaces[1], 'the template is unchanged')
  const saved = templates.saveAsTemplate(book, 'Night desk', 'n1', 7)
  assert.equal(saved.active, 'set', 'Save Set as Template… keeps you in your set')
  const kept = saved.workspaces.find(w => w.id === 'n1')
  assert.equal(kept.name, 'Night desk')
  assert.deepEqual(kept.layout, book.workspaces[0].layout, 'the template keeps the arrangement in front of you')
  assert.equal(templates.saveAsTemplate(book, '  ', 'x', 1), book, 'no name, no template')
  const html = renderToStaticMarkup(h(TemplateRowsView, {templates: templates.templatesOf(book), query: '', onStart: noop, onSave: noop}))
  assert.match(html, /data-template="tpl"[^>]*>[\s\S]*Reading room/)
  assert.match(html, /Save Set as Template…/)
})

// ---------------------------------------------------------------------------------------------------------------- the frame

test('the browser draws the pool of frames and lenses; the workspace pool is retired; Clip view reads the clip through its groove (code-reading)', async () => {
  const browser = await source('frame/browser/Browser.tsx')
  assert.match(browser, /<GroovePool face=\{poolFace\} \/>/)
  assert.doesNotMatch(browser, /WorkspacePool/)
  await assert.rejects(source('frame/browser/WorkspacePool.tsx'), {code: 'ENOENT'}, 'the workspace pool is retired; templates in the browser replace it')
  assert.match(await source('frame/detail/ClipHost.tsx'), /const binding = useClipGroove\(owned\)/, 'every mode\'s clip is hosted with its groove')
  assert.match(await source('shell/modeBrowsers.tsx'), /TemplateRows/, 'templates stand in the browser in every mode')
})
