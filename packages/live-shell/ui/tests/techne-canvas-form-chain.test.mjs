// The Canvas's Form page, the construction chain end to end on its owners (O-I #742; manual §17.4 "Give the board a form"): a draft
// is checked before it is written (AIKit's `wiki-shape validate --stdin`), Declare writes a new frame with QL-MEF's shape binding
// (`ql shape bind`: its shape_ref and the generated relations Fold needs) through `wiki-shape declare`, a change of roles on a declared
// frame is the same declare on the revision it read (`--expected-revision`), Fold is the owner's `compress`, and QL's Technē reading of
// the declared whole (`ql techne reading` over the Wiki's own projection, `wiki-shape target`) stands on the page.
//
// The owners are stand-ins answering in the shapes the real owners gave through the kernel routes on a scratch world (29 Oct, built
// aikit dlw/742-form-chain and ql dlw/742-shape-binding): BOUND is `ql shape bind`'s answer, CHECKED the draft check's, and so on.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) return r
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const form = await import('../src/techne/devices/formBinding.ts')

const FILE = 'Work/Scratch/ProjectCentral/wiki/wiki.json'
const WHOLE = 'wiki:space:inquiry'
const FRAME = `wiki:frame:form:${WHOLE}`
const SIX = ['0', '1', '2', '3', '4', '5']
const member = i => `wiki:node:m${i}`
/** A space of the wiki with twelve members at no position: a whole with no frame yet. */
const SPACE = {ref: WHOLE, title: 'The inquiry', kind: 'space', register: 'scratch', registerTitle: 'Scratch', members:
  Array.from({length: 12}, (_, i) => ({ref: member(i), title: `Member ${i}`, position: null, face: null}))}
const focus = {constellation: SPACE, file: FILE}
/** The twelve roles drafted: m0..m5 direct, m6..m11 their conjugates. */
const TWELVE = Object.fromEntries([...SIX.map((role, i) => [role, member(i)]), ...SIX.map((role, i) => [`${role}′`, member(i + 6)])])

const generated = Object.fromEntries(SIX.map(p => [p, `ql:shape:1.0.0:generation:same-position-direct-conjugate:position-${p}:of:${WHOLE}`]))
const bound = roles => ({schema: 'ql.shape-bind/v1', owner: 'ql-core', grain: Object.keys(roles).length === 12 ? 'twelvefold' : 'sixfold',
  shape_ref: `ql:shape:1.0.0:constellation:${Object.keys(roles).length === 12 ? 'twelvefold' : 'sixfold'}`, fold_count: Object.keys(roles).length,
  binding_extension: 'ql-mef/shape-binding/v1', binding: {subject_ref: FRAME, shape_ref: 'ql:shape:1.0.0:constellation:twelvefold', whole_ref: WHOLE},
  generation_operator_ref: 'ql:shape:1.0.0:generation:same-position-direct-conjugate', generation_sites: [], generated: Object.keys(roles).length === 12 ? generated : {},
  constraints: {creates_members: false, asserts_relations: false, semantic_generation_requires_attributable_return: true}})
const frameReading = (roles, revision) => ({frame: FRAME, revision, constellations: [{anchor: WHOLE, anchor_stance: null, grain: 'twelvefold', returns: [],
  members: Object.entries(roles).map(([role, ref]) => ({ref, position: parseInt(role, 10), conjugate: role.endsWith('′'), stance: null}))}]})

/** The owners over one wiki file: what it holds changes when Declare writes, as AIKit's does. */
function owners({refuseBind, notHeld} = {}) {
  const asked = []
  let held = null
  const validated = () => ({command: 'wiki-shape.validate', file: FILE, valid: true, errors: [], frames: held ? [frameReading(held.roles, held.revision)] : []})
  const rolesOfBody = body => Object.fromEntries(body.constellations[0].members.map(m => [`${m.position}${m.conjugate ? '′' : ''}`, m.ref]))
  return {asked, holds: () => held, owners: {
    validate: async file => { asked.push(['validate', file]); return validated() },
    check: async (file, frame, expected) => {
      asked.push(['check', file, frame.ref, expected])
      const roles = rolesOfBody(frame)
      if (expected !== (held?.revision ?? null)) return {command: 'wiki-shape.validate', file, valid: false, frames: [],
        errors: [{frame: frame.ref, code: 'knowledge.wiki_revision_conflict', error: `${frame.ref} stands at revision ${held?.revision}, not ${expected}`}],
        draft: {ref: frame.ref, would: expected ? 'update' : 'create', basis_revision: expected, revision: null}}
      const reading = frameReading(roles, (held?.revision ?? 0) + 1)
      if (notHeld) reading.constellations[0].members[0].stance = 'not-held'
      return {command: 'wiki-shape.validate', file, valid: true, errors: [], frames: [reading],
        draft: {ref: frame.ref, would: expected ? 'update' : 'create', basis_revision: expected, revision: (held?.revision ?? 0) + 1}}
    },
    declare: async (file, frameRef, frame, expected) => {
      asked.push(['declare', file, frameRef, expected, frame])
      if (expected !== (held?.revision ?? null)) throw Error(`knowledge.wiki_revision_conflict: ${frameRef} stands at revision ${held?.revision}, not ${expected}`)
      held = {roles: rolesOfBody(frame), revision: (held?.revision ?? 0) + 1, body: frame}
      return {command: 'wiki-shape.declare', ref: frameRef, revision: held.revision, outcome: {changed: true}}
    },
    compress: async (file, anchor) => {
      asked.push(['compress', file, anchor])
      if (!held) throw Error(`${anchor} declares no constellation with this whole-anchor in this file`)
      return {anchor_ref: anchor, composites: SIX.map(p => ({position: +p, direct_ref: held.roles[p], conjugate_ref: held.roles[`${p}′`], generated_ref: generated[p]})),
        trinity: {zero: '6', slash: '6+6′', one: '6′'}}
    },
    bind: async request => {
      asked.push(['bind', request])
      if (refuseBind) throw Error('invalid Wiki structural field: QL shape binding: conjugate position 4 requires its direct position in this structural contract')
      return bound(Object.fromEntries(request.members.map(m => [`${m.position}${m.face === 'conjugate' ? '′' : ''}`, m.subject_ref])))
    },
    target: async (file, anchor) => {
      asked.push(['target', file, anchor])
      if (!held) throw Error(`${anchor} declares no constellation with this whole-anchor in this file`)
      return {command: 'wiki-shape.target', anchor, frame: FRAME, revision: held.revision, shape_binding: true,
        target: {kind: 'frame', target_ref: FRAME, target_revision: held.revision, target_snapshot_hash: 'sha256:x', extensions: {'ql-mef/shape-binding/v1': held.body.constellations[0]['ql-mef/shape-binding/v1']}}}
    },
    reading: async target => {
      asked.push(['reading', target.target_ref])
      return {contract: 'ql.techne/v1', reading: {whole: {whole_ref: WHOLE, member_refs: Object.values(held.roles)}, ql: {shape_ref: 'ql:shape:1.0.0:constellation:twelvefold', lens_ref: 'mef:lens:L1@1'},
        disclosure: {instruments: [{instrument: 'project', available: true}, {instrument: 'canvas', available: true}, {instrument: 'timeline', available: false}]}}, selections: []}
    },
    reread: async () => { asked.push(['reread']) },
  }}
}
const canvas = () => ({id: 'techne:canvas', values: {items: '[]'}, standing: {}, writes: () => true, write: async () => {}})
const hands = held => Object.fromEntries(form.FORM_LOCAL.map(key => [key, value => { if (value === undefined) delete held[key]; else held[key] = value }]))
const carry = (held, o) => form.canvasCarryingForm(canvas(), focus, held, hands(held), o)
const act = (held, o, key) => carry(held, o).write([{key, value: true}])

test('a drafted form is checked as a draft: QL binds its shape, AIKit checks the frame it would write, and nothing is written', async () => {
  form.resetFormState()
  const held = {form: 'twelvefold', roles: JSON.stringify(TWELVE)}
  const {asked, holds, owners: o} = owners()
  await act(held, o, 'checkAsk')
  const v = carry(held, o).values
  assert.equal(v.check, 'passed', v.checkWhy)
  assert.match(v.checkWhy, /AIKit checks the draft: twelvefold round The inquiry/)
  assert.match(v.checkWhy, new RegExp(`would write ${FRAME}`))
  assert.equal(holds(), null, 'a check writes nothing')
  const bind = asked.find(row => row[0] === 'bind')[1]
  assert.deepEqual([bind.subject_ref, bind.whole_ref, bind.members.length], [FRAME, WHOLE, 12])
  assert.deepEqual(bind.members.find(m => m.subject_ref === member(9)), {subject_ref: member(9), position: 3, face: 'conjugate'})
  assert.deepEqual(asked.find(row => row[0] === 'check').slice(1), [FILE, FRAME, null], 'a new frame is checked as a creation')
})

test('a draft QL or AIKit refuses is refused in the owner\'s words, and Declare waits for a passed check', async () => {
  form.resetFormState()
  const held = {form: 'twelvefold', roles: JSON.stringify(TWELVE)}
  const refusing = owners({refuseBind: true})
  await act(held, refusing.owners, 'checkAsk')
  let v = carry(held, refusing.owners).values
  assert.equal(v.check, 'refused')
  assert.match(v.checkWhy, /QL-MEF binds no shape.*conjugate position 4 requires its direct position/)
  form.resetFormState()
  const notHeld = owners({notHeld: true})
  await act(held, notHeld.owners, 'checkAsk')
  v = carry(held, notHeld.owners).values
  assert.equal(v.check, 'refused')
  assert.match(v.checkWhy, /wiki:node:m0 is not a thing your wiki holds/)
  form.resetFormState()
  const fresh = owners()
  await act(held, fresh.owners, 'declare')
  assert.equal(carry(held, fresh.owners).values.declared, 'held')
  assert.match(carry(held, fresh.owners).standing.declared.disabled, /Check the form first/)
  assert.equal(fresh.holds(), null, 'no write without a passed check')
})

test('Declare writes the new frame with QL\'s shape binding through the owner, reads it back, and reads the whole through QL', async () => {
  form.resetFormState()
  const held = {form: 'twelvefold', roles: JSON.stringify(TWELVE)}
  const {asked, holds, owners: o} = owners()
  await act(held, o, 'checkAsk')
  await act(held, o, 'declare')
  const v = carry(held, o).values
  assert.equal(v.declared, 'saved', v.declaredWhy)
  assert.match(v.declaredWhy, new RegExp(`${FRAME} stands in your wiki at revision 1`))
  const [, file, frameRef, expected, body] = asked.find(row => row[0] === 'declare')
  assert.deepEqual([file, frameRef, expected], [FILE, FRAME, null])
  const constellation = body.constellations[0]
  assert.equal(constellation.anchor_ref, WHOLE)
  assert.deepEqual(constellation['aikit.ql-shape/v1'], {shape_ref: 'ql:shape:1.0.0:constellation:twelvefold', grain: 'twelvefold', generated},
    'the shape binding QL gave, as AIKit takes it: shape_ref, grain and the generated relations')
  assert.equal(constellation['ql-mef/shape-binding/v1'].whole_ref, WHOLE, 'and QL\'s own binding view, for QL to read again')
  assert.ok(asked.some(row => row[0] === 'reread'), 'the register is read again')
  assert.deepEqual(holds().roles, TWELVE)
  // QL's reading of the declared whole stands on the page.
  assert.equal(v.reading, 'read', v.readingWhy)
  assert.match(v.readingWhy, /QL reads ql:shape:1\.0\.0:constellation:twelvefold round wiki:space:inquiry: 12 members through mef:lens:L1@1; it stands on project, canvas/)
  assert.deepEqual(asked.filter(row => row[0] === 'target' || row[0] === 'reading').map(row => row[0]), ['target', 'reading'])
})

test('a change of roles on the declared frame is checked and declared on the revision read, then folds and reads back', async () => {
  form.resetFormState()
  const held = {form: 'twelvefold', roles: JSON.stringify(TWELVE)}
  const {asked, holds, owners: o} = owners()
  await act(held, o, 'checkAsk')
  await act(held, o, 'declare')
  // Move m1 and m2 between roles 1 and 2.
  const moved = {...TWELVE, 1: member(2), 2: member(1)}
  held.roles = JSON.stringify(moved)
  assert.equal(carry(held, o).values.declared, undefined, 'new roles are not what your wiki holds')
  assert.equal(carry(held, o).values.check, undefined, 'a check holds only for the roles it was asked of')
  await act(held, o, 'checkAsk')
  assert.equal(carry(held, o).values.check, 'passed', carry(held, o).values.checkWhy)
  assert.match(carry(held, o).values.checkWhy, new RegExp(`would change ${FRAME} from revision 1 to 2`))
  assert.deepEqual(asked.filter(row => row[0] === 'check').at(-1).slice(1), [FILE, FRAME, 1])
  await act(held, o, 'declare')
  assert.equal(carry(held, o).values.declared, 'saved')
  assert.deepEqual(asked.filter(row => row[0] === 'declare').at(-1).slice(1, 4), [FILE, FRAME, 1], 'declared on the revision it read')
  assert.deepEqual(holds(), {...holds(), roles: moved, revision: 2})
  await act(held, o, 'fold')
  const v = carry(held, o).values
  assert.equal(v.folded, 'folded', v.foldWhy)
  assert.match(v.foldWhy, /AIKit folds the twelve into one round The inquiry: 6 positions.*6 : 6\+6′ : 6′ = 0 : \/ : 1/)
  // Read back: a later focus of the same whole stands on what the owner declares, whatever the projection read.
  form.resetFormState()
  await form.readForm(focus, o)
  const back = carry({form: 'twelvefold'}, o).values
  assert.deepEqual(JSON.parse(back.roles), moved, 'the roles are the owner\'s')
  assert.equal(back.declared, 'saved')
})

test('Fold before a declared twelvefold is the owner\'s refusal, held on the page', async () => {
  form.resetFormState()
  const held = {form: 'twelvefold', roles: JSON.stringify(TWELVE)}
  const {owners: o} = owners()
  await act(held, o, 'fold')
  const v = carry(held, o).values
  assert.equal(v.folded, 'refused')
  assert.match(v.foldWhy, /declares no constellation with this whole-anchor/)
})
