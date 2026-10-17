// T-FRAME-CHROME-ONTO-PLATES: the frame's chrome rides the one channel. The shell declares how it presents the frame (`presentation`:
// 'devices' in a pane, 'frame' at full size) and presses a control of the frame's chrome (`chrome`, by the id the frame's reading gives
// it); the frame publishes the presentation it stands in and its chrome as data with its state. Every key is closed and every string
// bounded: a malformed reading refuses the whole state, as every field of the reader does.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readHostedState, readStageRequest, stageRequestMessage, readFrameChrome, FRAME_CHROME_HOMES, FRAME_PRESENTATIONS} from '../src/index.ts';

const reading = extra => ({hostMode: 'techne', sceneIndex: 0, sceneCount: 1, document: {id: 'expression:kept', name: 'Kept work'}, ...extra});
const chrome = controls => ({lens: 'canvas', controls});
const key = (id, extra = {}) => ({id, home: 'canvas:tools', kind: 'button', label: 'Note', ...extra});

test('the presentation and the chrome reading are carried through the state reader', () => {
  const state = readHostedState(reading({presentation: 'devices', chrome: chrome([
    key('tools/l:Note'),
    {id: 'tools/l:Snap', home: 'canvas:tools', kind: 'toggle', label: 'Snap', pressed: true},
    {id: 'views/l:Saved views', home: 'canvas:views', kind: 'select', label: 'Saved views', value: '', options: [{value: '', label: 'Views…'}, {value: 'apply\u0000one', label: 'Apply', group: 'one'}]},
    {id: 'selected/k:input', home: 'canvas:look', kind: 'number', label: 'Width', value: '200', min: 40, step: 1},
    {id: 'tools/.research-save-glyph', home: 'canvas:tools', kind: 'reading', label: 'Saved', value: 'Saved'},
  ])}))
  assert.ok(state, 'the reading is admitted')
  assert.equal(state.presentation, 'devices')
  assert.equal(state.chrome.lens, 'canvas')
  assert.deepEqual(state.chrome.controls.map(control => control.kind), ['button', 'toggle', 'select', 'number', 'reading'])
  assert.equal(state.chrome.controls[1].pressed, true)
  assert.equal(state.chrome.controls[2].options[1].group, 'one')
})

test('a state without either is valid (a frame before its chrome stands) and carries neither', () => {
  const state = readHostedState(reading({}))
  assert.ok(state)
  assert.equal('presentation' in state, false)
  assert.equal('chrome' in state, false)
})

test('a presentation outside the two, or a malformed chrome reading, refuses the state', () => {
  for (const presentation of ['pane', 'fullscreen', true, null]) assert.equal(readHostedState(reading({presentation})), null, JSON.stringify(presentation))
  const malformed = [
    chrome([key('a'), key('a')]),                                  // one id twice
    chrome([key('a', {home: 'studio:tools'})]),                    // a home outside the closed list
    chrome([key('a', {kind: 'slider'})]),                          // a kind outside the closed list
    chrome([key('a', {onclick: 'x'})]),                            // a key outside the closed shape
    chrome([key('a', {pressed: 'yes'})]),                          // a state that is not a boolean
    chrome([key('a', {label: 'x'.repeat(600)})]),                  // an unbounded string
    chrome([key('a', {options: [{value: 'v'}]})]),                 // an option without its words
    chrome(Array.from({length: 401}, (_, n) => key(`k${n}`))),     // more than the bound
    {lens: 'canvas'},                                              // no controls
  ]
  for (const value of malformed) assert.equal(readHostedState(reading({chrome: value})), null, JSON.stringify(value).slice(0, 80))
  assert.equal(readFrameChrome({lens: 'canvas', controls: [], extra: 1}), null)
})

test('the shell declares the presentation and presses a control through the closed command vocabulary', () => {
  assert.deepEqual([...FRAME_PRESENTATIONS], ['devices', 'frame'])
  for (const value of FRAME_PRESENTATIONS) {
    const message = stageRequestMessage(4, {command: 'presentation', chrome: value})
    assert.deepEqual(readStageRequest(message), {req: 4, command: {command: 'presentation', chrome: value}})
  }
  assert.deepEqual(readStageRequest(stageRequestMessage(5, {command: 'chrome', id: 'tools/l:Note'})), {req: 5, command: {command: 'chrome', id: 'tools/l:Note'}})
  assert.deepEqual(readStageRequest(stageRequestMessage(6, {command: 'chrome', id: 'selected/k:input', value: '240'})), {req: 6, command: {command: 'chrome', id: 'selected/k:input', value: '240'}})
  // Refused before the frame sees it: an unknown presentation, an empty id, a value that is not text, a key outside the shape.
  assert.equal(stageRequestMessage(7, {command: 'presentation', chrome: 'fullscreen'}), null)
  assert.equal(readStageRequest({v: 1, kind: 'host-command', req: 8, command: 'chrome', id: ''}), null)
  assert.equal(readStageRequest({v: 1, kind: 'host-command', req: 9, command: 'chrome', id: 'a', value: 3}), null)
  assert.equal(readStageRequest({v: 1, kind: 'host-command', req: 10, command: 'chrome', id: 'a', press: true}), null)
})

test('every home names a group the manual or the frame\'s chrome gives', () => {
  // Lane BE: the editors the frame summons over its field (Acts, the Nara instrument, Find on Canvas) are homes of their own while open.
  for (const home of FRAME_CHROME_HOMES) assert.match(home, /^(work|tools|capture|nara|scene|side|lens|acts|nara:instrument|canvas:(tools|lines|relation|look|views|find)|timeline:(lens|readings|standing|window)|journey:(stops|pace|transitions|takes)|project:view)$/)
})
