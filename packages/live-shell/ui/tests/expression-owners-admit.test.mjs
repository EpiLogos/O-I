// Review-4 #2: the shared-time slot admits only the presented Scene's own reading. A Journey sends one scoped read per
// beat card plus a whole-Expression read; admitting those overwrote the one slot and broke the next Timeline / Places
// time-window call. Source-level guard: the admission is conditioned on no facet, no scope and the presented basis.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('only an unscoped, facet-less read of the presented Scene is admitted into shared time', async () => {
  const source = await readFile(new URL('../src/native/expressionOwners.ts', import.meta.url), 'utf8')
  const admit = source.split('\n').find(line => line.includes('time.admit('))
  assert.ok(admit, 'the admission line exists')
  assert.match(admit, /request\.facet===undefined/)
  assert.match(admit, /request\.scope===undefined/)
  assert.match(admit, /presentsBasis\(access\.context,request\)/)
  assert.match(source, /scene\.expression_ref===request\.expression_ref&&scene\.revision===request\.revision&&scene\.scene_ref===request\.scene_ref/)
})
