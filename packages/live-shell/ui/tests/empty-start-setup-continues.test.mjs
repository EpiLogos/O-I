// An empty start walks Setup's five steps without the shell drawing a fault between them (seen on the native candidate, 12 Nov: Setup's
// Ground made the Central, then "The host has not disclosed its native World and physical Workcell binding" stood over the shell and
// Setup's next step came up empty, because the world had a ground and no Workcell yet; Setup's Machines step makes the Workcell).
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const {qualifiedWorld, setupUnfinished} = await import('../src/native/worldReading.ts')
const ground = {owner: 'central', world: 'control:root', personal_ground: '/w/Central'}

test('a world with a ground and no Workcell yet is Setup under way, not a fault', () => {
  assert.equal(setupUnfinished({onboarding: true}), true, 'no ground yet: Setup')
  assert.equal(setupUnfinished({onboarding: false, world_scope: {...ground, workcell_ref: null}}), true, 'a ground, no Workcell: Setup goes on')
  assert.equal(setupUnfinished({onboarding: false, world_scope: {...ground, workcell_ref: 'workcell:mac'}}), false, 'ground and Workcell: the world opens')
  assert.equal(setupUnfinished({onboarding: false, world_error: 'oi current-world failed'}), false, 'a host that cannot read the world is a fault')
  assert.equal(qualifiedWorld({world_scope: {...ground, workcell_ref: 'workcell:mac'}}), true)
  assert.equal(qualifiedWorld({world_scope: {...ground, workcell_ref: null}}), false)
})

test('the foundation keeps Setup open, with no fault, while Setup is under way', () => {
  const foundation = readFileSync(new URL('../src/native/Foundation.tsx', import.meta.url), 'utf8')
  assert.match(foundation, /import \{qualifiedWorld, setupUnfinished\} from '\.\/worldReading'/)
  assert.match(foundation, /setFault\(settingUp \? null : reason\)/, 'no fault band while Setup is under way')
  assert.match(foundation, /if \(settingUp && !setupOpened\.current\)/, 'Setup opens (once) while it is under way')
})
