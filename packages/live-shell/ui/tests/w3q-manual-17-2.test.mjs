// T-PROCEDURAL-BODY — the manual's World (docs/dlw/DLW.md §17.2, and the places §2 repeats it) held to the code, so the two cannot drift
// apart again. A doc/code tripwire: it reads the manual's words and the sources' declarations (no GPU, no network).
//
// The lead's. Every test is real: the ones that needed the lanes' work carried `todo` until it landed, and no longer do.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const here = new URL('.', import.meta.url)
const manual = readFileSync(new URL('../../../../docs/dlw/DLW.md', here), 'utf8')
const atlas = new URL('../src/projections/atlas/', here)
const read = path => readFileSync(new URL(path, atlas), 'utf8')

const section = (from, to) => {
  const a = manual.indexOf(from)
  assert.ok(a >= 0, `the manual has "${from}"`)
  const b = manual.indexOf(to, a + from.length)
  return manual.slice(a, b >= 0 ? b : undefined)
}
const world = section('### 17.2 World', '### 17.3 ')

test('M1 the manual puts only agents at work and what they make in orbit, in every place it says what circles', () => {
  const opening = section('## 2. Worlds', '## 3.')
  for (const [where, text] of [['§2 Worlds', opening], ['§17.2 World', world]]) {
    assert.doesNotMatch(text, /files and context you (have to hand|hold)/i, `${where} no longer puts files and context in orbit`)
    assert.doesNotMatch(text, /moments (still )?open (from today|now)[^.]*(circle|ride|orbit)|open moments of today/i, `${where} no longer puts open moments in orbit`)
    assert.doesNotMatch(text, /recent scenes[^.]*(circle|orbit)|scenes you made\s+last week/i, `${where} no longer puts scenes in orbit`)
  }
  assert.match(world, /\| System \|[^|]*agents at work circle it[^|]*just made[^|]*Nothing else is in orbit/, 'the System scale row says what circles and that nothing else does')
  assert.match(world, /Only agents at work and what they make circle a body/, '"Your system" says it')
  assert.match(world, /Only agents at work and what they have just made are in orbit/, 'the Rules say it')
})

test('M2 the manual says what a planet is made of: each element the generator draws is named', () => {
  const made = section('##### What a planet is made of', '#### Your system')
  for (const word of ['seed and its settings', 'Land and sea', 'Relief', 'Coasts', 'fjord', 'archipelago', 'Lakes', 'Rivers', 'sea floor', 'desert', 'forest', 'jungle', 'tundra', 'snow line', 'ragged margins', 'Air and weather', 'follow the occasion', 'Seasons', 'does not change as you come closer'])
    assert.ok(made.includes(word), `the manual names "${word}" in what a planet is made of`)
})

test('M3 the manual says how a world is finished: a grey moon to a planet with weather, read and never stored', () => {
  assert.match(world, /barely begun is a small grey moon: dry, airless, with no cloud/)
  assert.match(world, /Three things count: how long the world has existed, how much it holds[^.]*how many times you have shaped it, by its body or by its places/)
  assert.match(world, /read from those, never stored/)
  assert.match(world, /Earth is always as it is/)
  assert.match(world, /Until you land it yourself, a world stands at a spot named from its ref, and says so; Land keeps the spot you choose/, 'an unlanded world is drawn where its ref puts it, said so, and never written until the person acts')
})

test('M4 the code’s satellite kinds are the manual’s: a session and an artefact, nothing else', () => {
  const model = read('system/systemModel.ts')
  assert.match(model, /export type SatelliteKind = 'session' \| 'artifact'(?![\w|])/, 'SatelliteKind is exactly session | artifact')
  assert.doesNotMatch(model, /kind: 'page'|kind: 'file'|kind: 'work'/, 'no satellite of a page, a file or a work is built')
})

test('M5 the code has what the manual describes: a look from how lived in a world is, weather from the occasion, body widths', () => {
  const body = read('src/globe/body.ts'), engine = read('src/globe/engine.ts')
  assert.match(body, /export (interface|type) BodyLook\b/, 'BodyLook (the look) is the contract’s')
  assert.match(body, /export (function|const) weatherShift\b/, 'weather follows the occasion through weatherShift')
  assert.match(body, /export const BODY_WIDTHS\b/)
  assert.match(engine, /setBodyTime\s*\(/, 'the engine takes the occasion')
  assert.match(engine, /setBody\s*\(\s*record[^)]*look/, 'the engine takes the look')
  assert.ok(read('system/maturity.ts').includes('export function maturityOf'), 'maturity is read by a pure function')
})

test('M6 a body’s look and weather are never written: no setting, no key, no record field carries them', () => {
  const worldBody = read('body/worldBody.ts')
  assert.doesNotMatch(worldBody, /case 'barren'|case 'maturity'|case 'look'|case 'weather'/, 'changedBody has no key for the look or weather: the dials are the record’s')
  const bodyTs = read('src/globe/body.ts')
  assert.doesNotMatch(bodyTs.slice(bodyTs.indexOf('export interface WorldBodyRecord'), bodyTs.indexOf('const isObject')), /barren|maturity|weather/, 'the owner’s record has no field for them')
})

test('M7 an older body’s rule is the manual’s: the generator version is named and the current one is 2', () => {
  assert.match(world, /A body built by an older generator draws as it always did, until you next change it/)
  assert.match(read('src/globe/body.ts'), /WORLD_BODY_GENERATOR_VERSION = 2\b/)
})
