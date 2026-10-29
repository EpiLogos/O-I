// The Canvas's Form page on its owners (O-I #742; manual §17.4 "Give the board a form"): the constellation the browser focuses stands
// on the Form page as its whole and the cards round it on their roles; Check, Declare and Fold are AIKit's `wiki-shape` commands over
// the register's wiki file, and Declare reads back what it wrote (techne/devices/formBinding.ts, wired in techneDesigns.ts). The owners
// here are stand-ins that answer in the shapes the real owner gave through the kernel route (`aikit wiki-shape validate` over the walk's
// Own fixture world, 29 Oct: recorded below as VALIDATED). A draft's check, a new frame's shape binding and a change of roles on a
// declared frame are the chain's own test (techne-canvas-form-chain.test.mjs); here, the reading of what the wiki already declares.
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

// The owner's own answer through the kernel's aikit route (owner_route_reading data), as AIKit gave it for a threefold round the identity.
const VALIDATED = {command: 'wiki-shape.validate', errors: [], file: 'Control/agents/wiki/wiki.json', valid: true, frames: [{frame: 'wiki:frame:b742-threefold',
  constellations: [{anchor: 'wiki:node:identity', anchor_stance: null, grain: 'threefold-123', shape_field_refs: [], validated_shape_fields: 0,
    returns: [{ground_kind: 'own', ground_ref: 'wiki:node:identity', through_anchor_ref: 'wiki:node:identity'}],
    members: [{conjugate: false, position: 1, ref: 'wiki:node:staged/propose-not-write', stance: null},
      {conjugate: false, position: 2, ref: 'wiki:node:root/ta-onta-and-the-thought-stream', stance: null},
      {conjugate: false, position: 3, ref: 'wiki:node:place-provider-reconciles-like-the-floor', stance: null}]}]}]}
/** The focused constellation as owners/constellations.ts reads it from the register. */
const THREEFOLD = {ref: 'wiki:node:identity', title: 'User identity', kind: 'frame', register: 'central', registerTitle: 'Central', members: [
  {ref: 'wiki:node:staged/propose-not-write', title: 'You may propose', position: 1, face: 'direct'},
  {ref: 'wiki:node:root/ta-onta-and-the-thought-stream', title: 'The beings', position: 2, face: 'direct'},
  {ref: 'wiki:node:place-provider-reconciles-like-the-floor', title: 'Nowhere yet', position: 3, face: 'direct'},
  {ref: 'wiki:node:delivered-lane-loses-install', title: 'A lane', position: null, face: null}]}
const focusOf = constellation => ({constellation, file: 'Control/agents/wiki/wiki.json'})

/** The Canvas binding the Form is carried over: its Form keys refused as frameBindings.ts leaves them, one board card of its own. */
function canvas() {
  const own = []
  return {own, binding: {id: 'techne:canvas', values: {items: JSON.stringify([{id: 'e:root', kind: 'card', name: 'Root of the board', x: 0, y: 0, w: 10, h: 10}])},
    standing: Object.fromEntries(['form', 'whole', 'roles', 'layout', 'role', 'checkAsk', 'declare', 'fold', 'check', 'checkWhy', 'declared', 'suggest']
      .map(key => [key, {disabled: 'The form: no owner operation carries it here — missing op: kernel ops for aikit wiki-shape validate · declare · compress (AIKit).'}])),
    writes: () => true, write: async changes => { own.push(...changes) }}}
}
function owners(answers = {}) {
  const asked = []
  return {asked, owners: {
    validate: async file => { asked.push(['validate', file]); return answers.validate?.() ?? VALIDATED },
    compress: async (file, anchor) => { asked.push(['compress', file, anchor]); throw Error('the shape declaration carries no `generated` map of position -> generated-relation ref') },
    reread: async () => { asked.push(['reread']) },
    check: async () => { throw Error('unasked') }, declare: async () => { throw Error('unasked') }, bind: async () => { throw Error('unasked') },
    target: async () => { throw Error('unasked') }, reading: async () => { throw Error('unasked') },
  }}
}
const hands = held => Object.fromEntries(form.FORM_LOCAL.map(key => [key, value => { if (value === undefined) delete held[key]; else held[key] = value }]))

test('the focused constellation is the Form\'s composition: its whole at the centre, each member on the role its wiki position names', () => {
  const c = form.compositionOf(THREEFOLD)
  assert.equal(c.whole, 'wiki:node:identity')
  assert.deepEqual(c.roles, {1: 'wiki:node:staged/propose-not-write', 2: 'wiki:node:root/ta-onta-and-the-thought-stream', 3: 'wiki:node:place-provider-reconciles-like-the-floor'})
  assert.deepEqual(c.unplaced, ['wiki:node:delivered-lane-loses-install'], 'a member at no position stands on the board, on no role')
  assert.deepEqual(c.cards.map(card => [card.id, card.name]).slice(0, 2), [['wiki:node:identity', 'User identity'], ['wiki:node:staged/propose-not-write', 'You may propose']])
  assert.equal(form.roleOfMember({position: 4, face: 'prime'}), '4′', 'the prime face is the conjugate role')
  assert.equal(form.formOfRoles(c.roles), 'threefold-123')
  assert.equal(form.formOfRoles({0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e', 5: 'f', '4′': 'g'}), 'twelvefold')
})

test('on the Canvas binding: the Form page reads the composition, its choosers are the view\'s own, and nothing of it stays refused', () => {
  form.resetFormState()
  const held = {}
  const {binding} = canvas()
  const carried = form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), owners().owners)
  const v = carried.values
  assert.deepEqual([v.whole, v.form, v.layout], ['wiki:node:identity', 'threefold-123', 'form'])
  assert.deepEqual(JSON.parse(v.roles), form.compositionOf(THREEFOLD).roles)
  const ids = JSON.parse(v.items).map(item => item.id)
  assert.equal(ids[0], 'e:root', 'the board\'s own items stand first')
  assert.ok(['wiki:node:identity', 'wiki:node:staged/propose-not-write', 'wiki:node:delivered-lane-loses-install'].every(id => ids.includes(id)), 'the composition\'s cards join the board')
  assert.equal(v.declared, 'saved', 'a frame the wiki holds, on the roles it declares, is in your wiki')
  for (const key of ['form', 'whole', 'roles', 'layout', 'role', 'checkAsk', 'declare', 'fold']) assert.equal(carried.standing[key], undefined, `${key} is not refused`)
  assert.match(carried.standing.suggest.disabled, /missing op/, 'Suggest stays the Decision helper\'s')
  carried.local.form('sixfold')
  carried.local.roles(JSON.stringify({...form.compositionOf(THREEFOLD).roles, 4: 'wiki:node:delivered-lane-loses-install'}))
  const drafted = form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), owners().owners)
  assert.equal(drafted.values.form, 'sixfold', 'the view holds the form it was set to')
  assert.equal(JSON.parse(drafted.values.roles)[4], 'wiki:node:delivered-lane-loses-install', 'a placed card is the hand\'s draft until Declare')
  assert.equal(drafted.values.declared, undefined, 'a draft is not what your wiki holds')
})

test('Check is the owner\'s: it passes on the roles AIKit reads round the whole, and a draft or the owner\'s error is refused in words', async () => {
  form.resetFormState()
  const held = {}
  const {binding} = canvas()
  const {asked, owners: o} = owners()
  await form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), o).write([{key: 'checkAsk', value: true}])
  assert.deepEqual(asked, [['validate', 'Control/agents/wiki/wiki.json']], 'one validate of the register\'s wiki file')
  let v = form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), o).values
  assert.equal(v.check, 'passed')
  assert.match(v.checkWhy, /threefold-123 round User identity in wiki:frame:b742-threefold/)
  held.roles = JSON.stringify({...form.compositionOf(THREEFOLD).roles, 4: 'wiki:node:delivered-lane-loses-install'})
  assert.equal(form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), o).values.check, undefined, 'a check holds only for the roles it was asked of')
  delete held.roles
  const failing = owners({validate: () => ({...VALIDATED, valid: false, errors: ['conjugate 4′ has no direct 4']})})
  await form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), failing.owners).write([{key: 'checkAsk', value: true}])
  v = form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), failing.owners).values
  assert.deepEqual([v.check, v.checkWhy], ['refused', 'The Wiki owner refuses the frame: conjugate 4′ has no direct 4.'])
})

test('Declare reads back what your wiki holds round the whole; new roles, and a whole with no frame, wait on a passed check; Fold\'s refusal is the owner\'s', async () => {
  form.resetFormState()
  const held = {}
  const {binding, own} = canvas()
  const {asked, owners: o} = owners()
  await form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), o).write([{key: 'declare', value: true}])
  assert.deepEqual(asked.map(row => row[0]), ['reread', 'validate'], 'the register read again, then the owner\'s reading of it')
  assert.equal(form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), o).values.declared, 'saved')
  assert.deepEqual(own, [], 'nothing of the Form went to the frame\'s own write')
  // New roles on the frame the wiki holds: held until the owner checked them (the change itself is the chain test's).
  form.resetFormState()
  held.roles = JSON.stringify({...form.compositionOf(THREEFOLD).roles, 4: 'wiki:node:delivered-lane-loses-install'})
  await form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), o).write([{key: 'declare', value: true}])
  const moved = form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), o)
  assert.equal(moved.values.declared, 'held')
  assert.match(moved.standing.declared.disabled, /Check the form first/)
  delete held.roles
  // A space of the wiki is a whole with no frame: Declare waits on a checked form too (QL binds its shape then).
  form.resetFormState()
  const space = {...THREEFOLD, ref: 'central:wiki:root', title: 'Central', kind: 'space'}
  await form.canvasCarryingForm(binding, focusOf(space), held, hands(held), o).write([{key: 'declare', value: true}])
  const waiting = form.canvasCarryingForm(binding, focusOf(space), held, hands(held), o)
  assert.equal(waiting.values.declared, 'held')
  assert.match(waiting.standing.declared.disabled, /Check the form first/)
  await form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), o).write([{key: 'fold', value: true}])
  const folded = form.canvasCarryingForm(binding, focusOf(THREEFOLD), held, hands(held), o).values
  assert.deepEqual([folded.folded, folded.foldWhy], ['refused', 'the shape declaration carries no `generated` map of position -> generated-relation ref'], 'the owner\'s refusal, held')
})

test('with no constellation focused, the Form says what it waits for', () => {
  form.resetFormState()
  const {binding} = canvas()
  const carried = form.canvasCarryingForm(binding, null, {}, {}, owners().owners)
  for (const key of ['form', 'whole', 'roles', 'checkAsk', 'declare']) assert.match(carried.standing[key].disabled, /Select a constellation in the browser/, key)
  assert.equal(carried.values.whole, undefined)
})
