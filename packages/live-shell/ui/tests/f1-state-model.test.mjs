import test from 'node:test'
import assert from 'node:assert/strict'

// FOUNDATION F1 in the candidate: Live's selection is the world's one selection (a ref the open set anchors), and each
// mode first opens on its registered frame. Loaded as erasable TypeScript (--experimental-strip-types).
const {liveWorldSelection, setSelectionOf} = await import('../src/shell/liveSelection.ts')
const {MODE_FRAMES} = await import('../src/shell/modeFrames.ts')
const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')

const set = {path: '/sets/demo.als', tracks: [{name: 'Pad', kind: 'midi', devices: []}, {name: 'Bass', kind: 'audio', devices: []}]}

test('a Live track, slot or clip becomes the one selection and reads back the same', () => {
  for (const value of [{track: 1, scene: null}, {track: 0, scene: 3}, {track: 1, scene: null, clip: 2}]) {
    const selection = liveWorldSelection(value, set)
    assert.equal(selection.mode, 'live')
    assert.deepEqual(setSelectionOf(selection, set.path), value.clip === undefined ? value : {track: 1, scene: null, clip: 2})
  }
  assert.equal(liveWorldSelection({track: 0, scene: null}, set).title, 'Pad')
  assert.equal(liveWorldSelection({track: 0, scene: 3}, set).track, 'als:/sets/demo.als#track/0', 'a slot names its track')
})

test('a selection elsewhere, or in another set, is not Live\'s', () => {
  assert.equal(liveWorldSelection({track: 0, scene: null}, null), null, 'with no set nothing of Live\'s is selected')
  assert.equal(setSelectionOf({mode: 'base', kind: 'day', ref: 'Control/agents/now/day/2026-10-14.md', title: 'x'}, set.path), null)
  assert.equal(setSelectionOf(liveWorldSelection({track: 0, scene: null}, set), '/sets/other.als'), null)
})

test('every mode has an opening frame, read from a table', () => {
  assert.deepEqual(Object.keys(MODE_FRAMES).sort(), [...SURF_MODES].sort())
  for (const frame of Object.values(MODE_FRAMES)) {
    assert.ok(frame.centerPanel && (frame.tab === 'session' || frame.tab === 'arrangement') && (frame.detailMode === 'clip' || frame.detailMode === 'device'))
  }
  assert.equal(MODE_FRAMES.live.detailMode, 'device', 'Live opens on its chain')
})
