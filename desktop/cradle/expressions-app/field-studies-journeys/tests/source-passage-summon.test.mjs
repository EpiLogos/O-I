/** Lane-2 T19b (frame side): a Timeline event's source summon carries the one passage its reading discloses, bounded and
 * shape-checked before it leaves the frame (app.ts `sourceEvidenceCarry`, read from its source and run through the
 * TypeScript transpiler). The shell proves the passage again against the file's revision; this proves only the shape.
 *
 * Covers: a text span, a timestamp range and an image region are carried in their own shape; a reversed, negative,
 * non-integer, oversize or control-character field is refused (undefined); top and absent carry their reason; keys the
 * shell does not read are dropped; summonSource's context is rebuilt from node, relationField and the carried anchor only. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'

const appSource = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8')
const from = appSource.indexOf('function sourceEvidenceCarry(')
const to = appSource.indexOf('function summonSource(')
assert.ok(from >= 0 && to > from, 'app.ts defines sourceEvidenceCarry before summonSource')
const js = ts.transpileModule(appSource.slice(from, to), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText
const sourceEvidenceCarry = new Function(`${js}\nreturn sourceEvidenceCarry`)()

const SOURCE = 'central:notes/ledger.md'
const passage = (selector, extra = {}) => ({state: 'passage', source_ref: SOURCE, selector, ...extra})

test('a disclosed text span is carried in its own shape, and nothing else rides with it', () => {
  assert.deepEqual(sourceEvidenceCarry(passage({unit: 'text_span', start: 4, end: 9, anchor_ref: null})), {
    state: 'passage', source_ref: SOURCE, selector: {unit: 'text_span', start: 4, end: 9},
  })
})

test('a text span is refused when it is reversed, negative, fractional, or not integers', () => {
  for (const selector of [
    {unit: 'text_span', start: 9, end: 4},
    {unit: 'text_span', start: -1, end: 4},
    {unit: 'text_span', start: 1.5, end: 4},
    {unit: 'text_span', start: '1', end: 4},
    {unit: 'text_span', start: 1},
  ]) assert.equal(sourceEvidenceCarry(passage(selector)), undefined, JSON.stringify(selector))
})

test('a timestamp range and an image region are carried, so the shell can name why it cannot place them', () => {
  assert.deepEqual(sourceEvidenceCarry(passage({unit: 'timestamp_range', from: '00:00:01', to: '00:00:02'})), {
    state: 'passage', source_ref: SOURCE, selector: {unit: 'timestamp_range', from: '00:00:01', to: '00:00:02'},
  })
  assert.deepEqual(sourceEvidenceCarry(passage({unit: 'image_region', x: 0, y: 1, width: 2, height: 3})), {
    state: 'passage', source_ref: SOURCE, selector: {unit: 'image_region', x: 0, y: 1, width: 2, height: 3},
  })
  assert.equal(sourceEvidenceCarry(passage({unit: 'image_region', x: Number.NaN, y: 0, width: 1, height: 1})), undefined)
  assert.equal(sourceEvidenceCarry(passage({unit: 'timestamp_range', from: '', to: '00:00:02'})), undefined)
})

test('a source ref that is empty, oversize or carries a control character is refused', () => {
  const selector = {unit: 'text_span', start: 4, end: 9}
  assert.equal(sourceEvidenceCarry({state: 'passage', source_ref: '', selector}), undefined)
  assert.equal(sourceEvidenceCarry({state: 'passage', source_ref: 'x'.repeat(2049), selector}), undefined)
  assert.equal(sourceEvidenceCarry({state: 'passage', source_ref: 'central:\u0007x', selector}), undefined)
})

test('top and absent carry their reason, and a reason that is missing or oversize is refused', () => {
  assert.deepEqual(sourceEvidenceCarry({state: 'top', source_ref: SOURCE, reason: 'No passage is disclosed for this event.'}), {state: 'top', reason: 'No passage is disclosed for this event.'})
  assert.deepEqual(sourceEvidenceCarry({state: 'absent', reason: 'No source is disclosed for this event.'}), {state: 'absent', reason: 'No source is disclosed for this event.'})
  assert.equal(sourceEvidenceCarry({state: 'top'}), undefined)
  assert.equal(sourceEvidenceCarry({state: 'absent', reason: 'x'.repeat(513)}), undefined)
})

test('an unknown state, a non-object or an array is carried by nothing', () => {
  assert.equal(sourceEvidenceCarry({state: 'verso', reason: 'x'}), undefined)
  assert.equal(sourceEvidenceCarry('passage'), undefined)
  assert.equal(sourceEvidenceCarry(null), undefined)
  assert.equal(sourceEvidenceCarry([passage({unit: 'text_span', start: 4, end: 9})]), undefined)
  assert.equal(sourceEvidenceCarry(undefined), undefined)
})

test('summonSource rebuilds its context from node, relationField and the carried anchor only, and names a malformed passage', () => {
  const start = appSource.indexOf('function summonSource(')
  const body = appSource.slice(start, appSource.indexOf('\n', appSource.indexOf('hostRequest({request:\'summon\'', start)) + 1)
  assert.match(appSource, /function summonSource\(ref:string,context\?:\{node\?:unknown;relationField\?:unknown;anchor\?:unknown\}\)/, 'the context type admits the anchor')
  assert.match(body, /const evidence=context\?\.anchor===undefined\?undefined:sourceEvidenceCarry\(context\.anchor\)/)
  assert.match(body, /const carried=context\?\{node:context\.node,relationField:context\.relationField,\.\.\.\(evidence\?\{anchor:evidence\}:\{\}\)\}:undefined/)
  assert.match(body, /context:carried/, 'the summon detail carries the rebuilt context')
  assert.match(appSource, /toast\('The passage this event discloses is malformed; its source opens at its top\.'\)/, 'a malformed passage is named in the frame')
})
