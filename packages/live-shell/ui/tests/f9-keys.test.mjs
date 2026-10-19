import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// FOUNDATION F9: the window's keys (manual §10.8). One map from a key to an intent, suppressed while typing and wherever
// something takes its own keys; every intent pressed through the control's own door and enabled only when that control is.
// The frame knows no mode. Loader as live-browser-chain.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document = {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage = {getItem: () => null, setItem: () => {}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile, readdir} = await import('node:fs/promises')
const map = await import('../src/frame/keys/keyMap.ts')
const {planKey} = await import('../src/frame/keys/planKey.ts')
const doorsModule = await import('../src/frame/keys/keyDoors.ts')
const {handleKey, frameKeyDoors, FrameKeys, KeyReceiptLine} = await import('../src/frame/keys/FrameKeys.tsx')
const {publishDevice, selectDevice} = await import('../src/frame/devices/deviceDoor.ts')
const {publishInstrumentOpener} = await import('../src/frame/instrumentDoor.ts')
const {COMPUTER_KEY_PITCH} = await import('../src/live/janko/jankoInput.ts')
const {frameActionForKey} = await import('../../../../desktop/cradle/src/surface/keys.ts')
const {intentOfKey, suppressed, escapeClaimed, macroTurn, MACRO_KEYS, ROW_KEYS} = map

const press = (key, extra = {}) => ({key, ...extra})
const intents = [{id: 'play-stop'}, {id: 'stop'}, {id: 'search'}, {id: 'row', row: 0}, {id: 'macro', macro: 0, direction: 1}, {id: 'open', beside: false}]
const el = (tagName, attrs = {}, parentElement = null, extra = {}) => ({tagName, parentElement, getAttribute: name => (name in attrs ? attrs[name] : null), ...extra})
const body = el('BODY')

// ---------------------------------------------------------------------------------------------------------------------
// the map

test('§10.8: each key means one thing — Space, Esc, ⌘F, a row\'s number, a macro\'s letter, Enter and ⌥Enter', () => {
  assert.deepEqual(intentOfKey(press(' ', {code: 'Space'})), {id: 'play-stop'})
  assert.deepEqual(intentOfKey(press('Escape')), {id: 'stop'})
  assert.deepEqual(intentOfKey(press('f', {metaKey: true})), {id: 'search'})
  assert.deepEqual(intentOfKey(press('F', {ctrlKey: true})), {id: 'search'}, 'Ctrl F where there is no ⌘')
  assert.deepEqual(intentOfKey(press('1', {code: 'Digit1'})), {id: 'row', row: 0})
  assert.deepEqual(intentOfKey(press('9', {code: 'Digit9'})), {id: 'row', row: 8})
  assert.deepEqual(intentOfKey(press('0', {code: 'Digit0'})), {id: 'row', row: 9}, 'the tenth row is 0')
  assert.deepEqual(intentOfKey(press('3', {code: 'Numpad3'})), {id: 'row', row: 2})
  assert.deepEqual(intentOfKey(press('&', {code: 'Digit1'})), {id: 'row', row: 0}, 'the number row by position, so a layout that shifts its digits still counts')
  assert.deepEqual(intentOfKey(press('z')), {id: 'macro', macro: 0, direction: 1})
  assert.deepEqual(intentOfKey(press('v')), {id: 'macro', macro: 3, direction: 1})
  assert.deepEqual(intentOfKey(press('X', {shiftKey: true})), {id: 'macro', macro: 1, direction: -1}, 'Shift turns it back')
  assert.deepEqual(intentOfKey(press('Enter')), {id: 'open', beside: false})
  assert.deepEqual(intentOfKey(press('Enter', {altKey: true})), {id: 'open', beside: true})
  assert.equal(ROW_KEYS.length, 10)
  assert.equal(map.rowKeyOf(0), '1'); assert.equal(map.rowKeyOf(9), '0'); assert.equal(map.macroKeyOf(2), 'c'); assert.equal(map.macroKeyOf(4), undefined)
})

test('what §10.8 gives to the shell, and to the field being typed in, is not this map\'s', () => {
  assert.equal(intentOfKey(press('Tab', {code: 'Tab'})), null, 'Tab (Session ⇄ Arrangement) is App.tsx\'s')
  assert.equal(intentOfKey(press('b', {metaKey: true, altKey: true})), null, '⌘⌥B (browser) is App.tsx\'s')
  assert.equal(intentOfKey(press('l', {metaKey: true, altKey: true})), null, '⌘⌥L (detail) is App.tsx\'s')
  assert.equal(intentOfKey(press(',', {metaKey: true})), null, '⌘, (settings) is App.tsx\'s')
  assert.equal(intentOfKey(press('Enter', {metaKey: true})), null)
  assert.equal(intentOfKey(press('Enter', {metaKey: true, altKey: true})), null, '⌘⌥Enter maximizes a pane (the pane engine\'s)')
  assert.equal(intentOfKey(press('Enter', {shiftKey: true})), null, 'Shift Enter is a new line in the field being typed in')
  assert.equal(intentOfKey(press('1', {metaKey: true, code: 'Digit1'})), null, '⌘1 jumps to a tab (the pane engine\'s)')
  assert.equal(intentOfKey(press('1', {shiftKey: true, code: 'Digit1'})), null)
  assert.equal(intentOfKey(press(' ', {shiftKey: true, code: 'Space'})), null)
  assert.equal(intentOfKey(press('z', {altKey: true})), null)
  assert.equal(intentOfKey(press('a')), null, 'a note key of the Jankó keyboard is the keyboard\'s')
  assert.equal(intentOfKey(press('f')), null, 'the Earth\'s F is the Earth\'s')
  assert.equal(intentOfKey(press('z', {repeat: true})), null, 'a held key acts once')
  assert.equal(intentOfKey(press('Enter', {isComposing: true})), null, 'an IME composition is not a press')
})

test('no key of the map shadows a note key of the Jankó keyboard, a letter of the Earth, or a chord of the pane engine', () => {
  for (const key of MACRO_KEYS) assert.ok(!(key in COMPUTER_KEY_PITCH), `${key} plays a note`)
  for (const key of ['m', 'f', 't', 'l', 'a', 'r', 'd', 's', 'g']) assert.ok(!MACRO_KEYS.includes(key), `${key} is a key of the Earth`)
  const presses = [press(' ', {code: 'Space'}), press('Escape', {code: 'Escape'}), press('f', {metaKey: true, code: 'KeyF'}), press('1', {code: 'Digit1'}), press('z', {code: 'KeyZ'}),
    press('Enter', {code: 'Enter'}), press('Enter', {altKey: true, code: 'Enter'})]
  for (const event of presses) {
    assert.ok(intentOfKey(event), `${event.key} is a key of the window`)
    assert.equal(frameActionForKey({repeat: false, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, code: event.key, ...event}, false), null, `the pane engine also takes ${event.key}`)
  }
})

// ---------------------------------------------------------------------------------------------------------------------
// where a key does not act

test('manual §10.8: keys never act while you are typing — in an input, a textarea, a select, an editable region, a text box', () => {
  const typing = [
    el('INPUT', {type: 'search'}), el('TEXTAREA'), el('SELECT'), el('DIV', {contenteditable: 'true'}), el('DIV', {contenteditable: ''}),
    el('DIV', {contenteditable: 'plaintext-only'}), el('DIV', {role: 'textbox'}), el('DIV', {role: 'searchbox'}), el('DIV', {role: 'combobox'}),
    el('P', {}, null, {isContentEditable: true}), el('SPAN', {}, el('DIV', {contenteditable: 'true'}, body)),
  ]
  for (const target of typing) for (const intent of intents) assert.ok(suppressed(intent, target), `${target.tagName} ${JSON.stringify(intent)}`)
  const notTyping = [body, el('DIV', {contenteditable: 'false'}), null]
  for (const target of notTyping) assert.ok(!suppressed({id: 'stop'}, target))
})

test('an element that declares it takes keys keeps them: the application role (the Jankó keyboard), a dialog, a menu, a slider, data-takes-keys', () => {
  const janko = el('DIV', {role: 'application', tabindex: '0'}, body)
  const key = el('BUTTON', {}, janko)
  for (const intent of intents) assert.ok(suppressed(intent, key), `the Jankó keyboard keeps ${intent.id}`)
  for (const role of ['dialog', 'alertdialog', 'menu', 'listbox', 'slider']) assert.ok(suppressed({id: 'macro', macro: 0, direction: 1}, el('DIV', {role}, body)), role)
  assert.ok(suppressed({id: 'row', row: 0}, el('DIV', {'aria-modal': 'true'}, body)))
  assert.ok(suppressed({id: 'stop'}, el('DIV', {'data-takes-keys': ''}, body)), 'declared with no list: every key')
  assert.ok(suppressed({id: 'stop'}, el('DIV', {'data-takes-keys': 'all'}, body)))
  const some = el('DIV', {'data-takes-keys': 'space ESCAPE'}, body)
  assert.ok(suppressed({id: 'play-stop'}, some) && suppressed({id: 'stop'}, some), 'declared with a list: those keys')
  assert.ok(!suppressed({id: 'row', row: 0}, some) && !suppressed({id: 'macro', macro: 0, direction: 1}, some), 'and not the others')
  assert.ok(!suppressed({id: 'row', row: 0}, el('BUTTON', {}, el('DIV', {role: 'row'}, el('DIV', {role: 'grid', 'aria-label': 'Session'}, body)))), 'the Session grid is a grid: the row keys act inside it')
})

test('Space and Enter never press a second thing on a control they already press; the other keys pass through it', () => {
  for (const target of [el('BUTTON'), el('A', {href: '#'}), el('SUMMARY'), el('SPAN', {role: 'button'}), el('DIV', {role: 'checkbox'}), el('DIV', {role: 'menuitem'}), el('SPAN', {}, el('BUTTON'))]) {
    assert.ok(suppressed({id: 'play-stop'}, target), `${target.tagName} keeps Space`)
    assert.ok(suppressed({id: 'open', beside: false}, target), `${target.tagName} keeps Enter`)
    assert.ok(!suppressed({id: 'row', row: 0}, target) && !suppressed({id: 'macro', macro: 0, direction: 1}, target) && !suppressed({id: 'stop'}, target) && !suppressed({id: 'search'}, target))
  }
  assert.ok(!suppressed({id: 'play-stop'}, el('A')), 'an anchor without an href is not pressed by Space')
  assert.ok(!suppressed({id: 'play-stop'}, body))
})

test('Escape closes what is open first: a modal, an open dialog, a menu, a state that claims it — not what is hidden or claims other keys', () => {
  const doc = (...found) => ({querySelectorAll: () => found})
  assert.equal(escapeClaimed(doc()), false)
  assert.equal(escapeClaimed(doc(el('DIV', {'aria-modal': 'true'}))), true)
  assert.equal(escapeClaimed(doc(el('DIALOG', {open: ''}))), true)
  assert.equal(escapeClaimed(doc(el('DIV', {role: 'menu'}))), true)
  assert.equal(escapeClaimed(doc(el('OUTPUT', {'data-claims-keys': 'escape'}))), true, 'the map mode, a gesture')
  assert.equal(escapeClaimed(doc(el('OUTPUT', {'data-claims-keys': ''}))), true)
  assert.equal(escapeClaimed(doc(el('OUTPUT', {'data-claims-keys': 'space'}))), false)
  assert.equal(escapeClaimed(doc(el('DIV', {role: 'menu'}, el('SECTION', {hidden: ''})))), false, 'inside a hidden section')
  assert.equal(escapeClaimed(doc(el('DIV', {'aria-modal': 'true', 'aria-hidden': 'true'}))), false)
  assert.equal(escapeClaimed(doc(el('DIV', {role: 'menu'}, el('DIV', {inert: ''})))), false)
})

// ---------------------------------------------------------------------------------------------------------------------
// turning a macro

const row = (key, extra = {}) => ({family: 'f', deviceInstance: 'd', key, title: key, type: 'number', writePath: 'op:write', ...extra})
const owner = (values, submit = async () => {}) => ({values, submit})

test('a macro key turns the macro as its own control does: a fiftieth of its range, the owner\'s next choice, a flipped switch', () => {
  const level = row('level', {range: {min: 0, max: 100}})
  assert.deepEqual(macroTurn(owner({level: 10}), level, 1), {ok: true, key: 'level', value: 12})
  assert.deepEqual(macroTurn(owner({level: 10}), level, -1), {ok: true, key: 'level', value: 8})
  assert.deepEqual(macroTurn(owner({level: 100}), level, 1), {ok: false, reason: 'at-limit'}, 'it stays inside its range')
  assert.deepEqual(macroTurn(owner({level: 0}), level, -1), {ok: false, reason: 'at-limit'})
  assert.deepEqual(macroTurn(owner({level: 99}), level, 1), {ok: true, key: 'level', value: 100}, 'it stops at the end, not past it')
  assert.equal(macroTurn(owner({gain: 0.5}), row('gain'), 1).value, 0.52, 'a row with no range runs 0 to 1')
  const lens = row('lens', {type: 'enumerated', values: ['L0', 'L1', 'L2']})
  assert.equal(macroTurn(owner({lens: 'L0'}), lens, 1).value, 'L1')
  assert.equal(macroTurn(owner({lens: 'L2'}), lens, 1).value, 'L0', 'a choice wraps, as its click does')
  assert.equal(macroTurn(owner({lens: 'L0'}), lens, -1).value, 'L2')
  assert.equal(macroTurn(owner({lens: 'L1'}), lens, -1).value, 'L0')
  assert.deepEqual(macroTurn(owner({lens: 'L1'}), row('lens', {type: 'enumerated', values: []}), 1), {ok: false, reason: 'no-choices'})
  assert.deepEqual(macroTurn(owner({armed: false}), row('armed', {type: 'boolean'}), 1), {ok: true, key: 'armed', value: true})
  assert.deepEqual(macroTurn(owner({armed: true}), row('armed', {type: 'boolean'}), -1), {ok: true, key: 'armed', value: false})
})

test('a macro key is enabled only when its control is: a write, a write path and a reading', () => {
  const level = row('level')
  assert.deepEqual(macroTurn({values: {level: 0.5}}, level, 1), {ok: false, reason: 'no-write'}, 'a device with no owner write')
  assert.deepEqual(macroTurn(owner({level: 0.5}), row('level', {writePath: undefined}), 1), {ok: false, reason: 'no-write'}, 'a row that is a reading')
  assert.deepEqual(macroTurn(owner({}), level, 1), {ok: false, reason: 'no-reading'}, 'the owner has not disclosed the value: no guess')
  assert.deepEqual(macroTurn(owner({level: 'a word'}), level, 1), {ok: false, reason: 'no-write'})
})

// ---------------------------------------------------------------------------------------------------------------------
// the plans: each key through its control's own door

const bar = (pressed, extra = {}) => ({
  play: {press: () => pressed.push('play'), ...(extra.play ?? {})},
  stop: {press: () => pressed.push('stop'), ...(extra.stop ?? {})},
})
const doors = (parts = {}) => ({transport: () => null, rows: () => null, device: () => null, openable: () => null, searchAvailable: () => false, search: () => false, ...parts})

test('Space is the bar\'s Play, or its Stop while Play\'s light reads on and Stop can be pressed — only where a binding has a write path', () => {
  const pressed = []
  planKey({id: 'play-stop'}, doors({transport: () => bar(pressed)})).run()
  planKey({id: 'play-stop'}, doors({transport: () => bar(pressed, {play: {lit: true}})})).run()
  planKey({id: 'play-stop'}, doors({transport: () => bar(pressed, {play: {lit: false}})})).run()
  assert.deepEqual(pressed, ['play', 'stop', 'play'])
  pressed.length = 0
  planKey({id: 'play-stop'}, doors({transport: () => ({play: {press: () => pressed.push('play'), lit: true}})})).run()
  assert.deepEqual(pressed, ['play'], 'a play that is a toggle (no Stop) is pressed again')
  assert.equal(planKey({id: 'play-stop'}, doors()), null, 'no bar')
  assert.equal(planKey({id: 'play-stop'}, doors({transport: () => ({})})), null, 'a bar with nothing bound')
  assert.equal(planKey({id: 'play-stop'}, doors({transport: () => ({play: {readout: {value: '1', title: 't'}}})})), null, 'a binding with no write path')
  assert.equal(planKey({id: 'play-stop'}, doors({transport: () => ({play: {control: 'x'}})})), null, 'an owner\'s own control is pressed by hand')
  assert.equal(planKey({id: 'play-stop'}, doors({transport: () => bar([], {play: {refused: 'the owner refuses'}})})), null, 'a refused slot is drawn disabled: so is the key')
  assert.equal(planKey({id: 'play-stop'}, doors({transport: () => ({stop: {press: noop}})})), null, 'only Stop is bound and nothing is playing: Esc stops, Space does not')
})

test('Esc is the bar\'s Stop, where Stop can be pressed', () => {
  const pressed = []
  planKey({id: 'stop'}, doors({transport: () => bar(pressed)})).run()
  assert.deepEqual(pressed, ['stop'])
  assert.equal(planKey({id: 'stop'}, doors({transport: () => ({play: {press: noop}})})), null)
  assert.equal(planKey({id: 'stop'}, doors({transport: () => bar([], {stop: {refused: 'no'}})})), null)
  assert.equal(planKey({id: 'stop'}, doors()), null)
})

test('a press that throws is the owner\'s refusal, said as it was', async () => {
  const receipt = await planKey({id: 'stop'}, doors({transport: () => ({stop: {press: () => { throw new Error('The kernel refused the stop') }}})})).run()
  assert.deepEqual(receipt, {ok: false, what: 'Stop', text: 'The kernel refused the stop'})
})

const column = (id, name = '') => ({id, name})
const grid = (extra = {}, presented = 'session') => ({presented, set: {columns: [column('c1', 'Intro'), column('c2'), column('c3')], tracks: [], clips: [], actions: {launchStop: {op: 'stop.launch', run: id => { grid.ran.push(id); return {ok: true, note: `launched ${id}`} }}}, ...extra}})
grid.ran = []

test('a number key launches that row through the set\'s own launchStop, in the Session grid only', async () => {
  grid.ran.length = 0
  const plan = planKey({id: 'row', row: 1}, doors({rows: () => grid()}))
  assert.deepEqual(await plan.run(), {ok: true, what: 'Launch row 2', text: 'launched c2'}, 'the receipt names the row the way the grid does: its name, else its number')
  assert.deepEqual((await planKey({id: 'row', row: 0}, doors({rows: () => grid()})).run()).what, 'Launch row Intro')
  assert.deepEqual(grid.ran, ['c2', 'c1'])
  assert.equal(planKey({id: 'row', row: 3}, doors({rows: () => grid()})), null, 'there is no fourth row')
  assert.equal(planKey({id: 'row', row: 0}, doors({rows: () => grid({}, 'arrangement')})), null, 'rows exist in the Session grid, not the Arrangement ruler')
  assert.equal(planKey({id: 'row', row: 0}, doors({rows: () => grid({actions: {}})})), null, 'a set whose owner gives no row launch stays read-only')
  // A row whose every clip stands on a read-only track (the cron firings) is read, not launched — the grid's row button says so.
  const cron = grid({tracks: [{id: 'cron', name: 'cron · firings', readOnly: true}], clips: [{id: 'f1', trackId: 'cron', columnId: 'c3', label: 'firing'}]})
  assert.deepEqual(await planKey({id: 'row', row: 2}, doors({rows: () => cron})).run(), {ok: false, what: 'Launch row 3', text: 'every clip in this row is read, not launched'})
  assert.equal(planKey({id: 'row', row: 0}, doors({rows: () => grid({actions: undefined})})), null)
  assert.equal(planKey({id: 'row', row: 0}, doors()), null, 'no Session grid')
  const refused = await planKey({id: 'row', row: 0}, doors({rows: () => grid({actions: {launchStop: {op: 'x', run: () => { throw new Error('No agent is free') }}}})})).run()
  assert.deepEqual(refused, {ok: false, what: 'Launch row Intro', text: 'No agent is free'})
  const mute = await planKey({id: 'row', row: 0}, doors({rows: () => grid({actions: {launchStop: {op: 'x', run: () => 'started'}}})})).run()
  assert.equal(mute, null, 'an answer that is not words says nothing')
})

const device = (rows, values, submit) => ({id: 'dev', family: 'f', face: {id: 'dev', title: 'Reach', icon: 'live'}, rows, values, submit})

test('a letter key turns that macro of the selected device through the device\'s owner write; its refusal comes back in words', async () => {
  const writes = []
  const rows = [row('a', {macro: {maps: []}, range: {min: 0, max: 50}}), row('b', {macro: {maps: []}, type: 'enumerated', values: ['x', 'y']}), row('c', {macro: {maps: []}, type: 'boolean'}), row('plain')]
  const held = device(rows, {a: 25, b: 'x', c: false}, async changes => { writes.push(changes) })
  for (const [macro, direction] of [[0, 1], [1, 1], [2, -1], [0, -1]]) await planKey({id: 'macro', macro, direction}, doors({device: () => held})).run()
  assert.deepEqual(writes, [[{key: 'a', value: 26}], [{key: 'b', value: 'y'}], [{key: 'c', value: true}], [{key: 'a', value: 24}]])
  assert.equal(planKey({id: 'macro', macro: 3, direction: 1}, doors({device: () => held})), null, 'there are three macros on this face: the fourth key is not one')
  assert.equal(planKey({id: 'macro', macro: 0, direction: 1}, doors()), null, 'no device selected')
  const refusing = device(rows, {a: 25}, async () => { throw new Error('The owner takes edits only while the instrument follows') })
  assert.deepEqual(await planKey({id: 'macro', macro: 0, direction: 1}, doors({device: () => refusing})).run(), {ok: false, what: 'Turn a', text: 'The owner takes edits only while the instrument follows'})
  assert.equal(planKey({id: 'macro', macro: 0, direction: 1}, doors({device: () => device(rows, {a: 25})})), null, 'a device with no write is a reading')
  assert.equal(planKey({id: 'macro', macro: 0, direction: 1}, doors({device: () => device(rows, {}, async () => {})})), null, 'no reading, no turn')
  writes.length = 0
  const atEnd = planKey({id: 'macro', macro: 0, direction: 1}, doors({device: () => device(rows, {a: 50}, async changes => { writes.push(changes) })}))
  assert.equal(await atEnd.run(), null, 'a macro at the end of its range is heard and has nowhere to go')
  assert.deepEqual(writes, [])
})

test('the macros are the four a device draws on its compact face, macros first, in its order', async () => {
  const marked = [row('p'), row('q', {compact: true}), row('r', {compact: true})]
  const writes = []
  const held = device(marked, {p: 0.5, q: 0.5, r: 0.5}, async changes => { writes.push(changes) })
  await planKey({id: 'macro', macro: 1, direction: 1}, doors({device: () => held})).run()
  assert.deepEqual(writes, [[{key: 'r', value: 0.52}]], 'the face\'s second control, as the rack draws it')
})

test('Enter opens the selected thing in a pane, ⌥Enter beside the pane that has focus; a refusal comes back in words', async () => {
  const opened = []
  const target = {label: 'Graph', open: at => { opened.push(at ?? 'focused') }}
  assert.equal(await planKey({id: 'open', beside: false}, doors({openable: () => target})).run(), null)
  assert.equal(await planKey({id: 'open', beside: true}, doors({openable: () => target}), {focusedGroupId: 'g2'}).run(), null)
  assert.deepEqual(opened, ['focused', {groupId: 'g2', edge: 'right'}])
  assert.deepEqual(await planKey({id: 'open', beside: true}, doors({openable: () => target})).run(), {ok: false, what: 'Open Graph beside', text: 'No pane has focus to open beside.'})
  assert.equal(planKey({id: 'open', beside: false}, doors()), null, 'nothing selected, nothing to open')
  const refusing = {label: 'Earth', open: () => { throw new Error('No pane tree is mounted to open the instrument in') }}
  assert.deepEqual(await planKey({id: 'open', beside: false}, doors({openable: () => refusing})).run(), {ok: false, what: 'Open Earth', text: 'No pane tree is mounted to open the instrument in'})
})

test('⌘F reaches the browser\'s search, showing the browser first; with no browser registered it is no one\'s', () => {
  const calls = []
  const plan = planKey({id: 'search'}, doors({searchAvailable: () => true, search: reveal => { calls.push(reveal); return true }}), {revealBrowser: noop})
  plan.run()
  assert.deepEqual(calls, [noop])
  assert.equal(planKey({id: 'search'}, doors()), null)
})

// ---------------------------------------------------------------------------------------------------------------------
// the doors owners publish

test('the owners\' doors: the bar, the Session pane and a browser row publish what a key presses; the search box registers', () => {
  const { publishTransportKeys, transportKeys, publishTrackRows, trackRows, publishOpenable, openableNow, requestBrowserSearch, registerBrowserSearch, browserSearchAvailable } = doorsModule
  assert.equal(transportKeys(), null); assert.equal(trackRows(), null); assert.equal(openableNow(), null)
  const bindings = {play: {press: noop}}, pane = {presented: 'session', set: {columns: [], tracks: [], clips: []}}, target = {label: 'x', open: noop}
  publishTransportKeys(bindings); publishTrackRows(pane); publishOpenable(target)
  assert.equal(transportKeys(), bindings); assert.equal(trackRows(), pane); assert.equal(openableNow(), target)
  publishTransportKeys(null); publishTrackRows(null); publishOpenable(null)
  assert.equal(transportKeys(), null); assert.equal(trackRows(), null); assert.equal(openableNow(), null)
  // the search box
  assert.equal(browserSearchAvailable(), false)
  const order = []
  assert.equal(requestBrowserSearch(() => order.push('reveal')), false, 'no browser: the key is left to others')
  assert.deepEqual(order, [])
  const unregister = registerBrowserSearch({focus: () => order.push('focus')})
  assert.equal(browserSearchAvailable(), true)
  assert.equal(requestBrowserSearch(() => order.push('reveal')), true)
  assert.deepEqual(order, ['reveal', 'focus'], 'a hidden browser is shown before it is asked to take focus')
  unregister()
  assert.equal(browserSearchAvailable(), false)
})

test('the frame\'s doors: the selected device is the macro keys\' device, and Enter opens it full size in a pane, beside when asked', () => {
  const opens = []
  publishInstrumentOpener((kind, at, subject) => { opens.push({kind, at, subject}) })
  const held = device([row('a', {macro: {maps: []}})], {a: 0.5}, async () => {})
  assert.equal(frameKeyDoors.device(), null)
  assert.equal(frameKeyDoors.openable(), null, 'nothing selected')
  publishDevice('chain:dev', {device: held}); selectDevice('chain:dev')
  assert.equal(frameKeyDoors.device(), held)
  frameKeyDoors.openable().open()
  frameKeyDoors.openable().open({groupId: 'g1', edge: 'right'})
  assert.deepEqual(opens, [
    {kind: 'projection.device', at: undefined, subject: {ref: 'chain:dev', title: 'Reach'}},
    {kind: 'projection.device', at: {groupId: 'g1', edge: 'right'}, subject: {ref: 'chain:dev', title: 'Reach'}},
  ], 'the pane takes the published id, which is how the full-size pane finds the device again')
  // a browser row's selection is the more recent word
  doorsModule.publishOpenable({label: 'Earth', open: noop})
  assert.equal(frameKeyDoors.openable().label, 'Earth')
  doorsModule.publishOpenable(null)
  selectDevice(null); publishDevice('chain:dev', null); publishInstrumentOpener(null)
  assert.equal(frameKeyDoors.device(), null)
})

// ---------------------------------------------------------------------------------------------------------------------
// one keydown, end to end

function keydown(key, extra = {}) {
  const event = {key, code: '', target: body, defaultPrevented: false, prevented: 0, preventDefault() { this.defaultPrevented = true; this.prevented++ }, ...extra}
  return event
}
function rig(parts = {}, options = {}) {
  const shown = [], waiting = []
  const run = (event, document = {querySelectorAll: () => []}) => handleKey(event, doors(parts), options, receipt => shown.push(receipt), document, task => waiting.push(task))
  return {shown, waiting, run, settle: () => { while (waiting.length) waiting.shift()() }}
}

test('only ⌘F is claimed at once; Space and Esc wait for the handlers that were registered after this layer', () => {
  const pressed = []
  const keys = rig({transport: () => bar(pressed)})
  const space = keydown(' ', {code: 'Space'})
  assert.equal(keys.run(space), true)
  assert.deepEqual(pressed, [], 'Space has not acted yet')
  assert.equal(space.prevented, 0)
  const esc = keydown('Escape')
  assert.equal(keys.run(esc), true)
  assert.equal(esc.prevented, 0)
  keys.settle()
  assert.deepEqual(pressed, ['play', 'stop'])
})

test('no double handling: a press an established handler took stays that handler\'s', () => {
  const pressed = []
  const keys = rig({transport: () => bar(pressed), rows: () => grid()})
  // taken before this layer saw it
  assert.equal(keys.run(keydown(' ', {code: 'Space', defaultPrevented: true})), false)
  // taken after this layer saw it, by a handler registered later (the Expressions bar\'s Space plays and prevents default)
  const space = keydown(' ', {code: 'Space'})
  keys.run(space); space.preventDefault(); keys.settle()
  assert.deepEqual(pressed, [], 'Space was the Expressions bar\'s')
  // the same, for the Earth\'s Escape: stepBack and preventDefault
  const esc = keydown('Escape')
  keys.run(esc); esc.preventDefault(); keys.settle()
  assert.deepEqual(pressed, [], 'Esc was the Earth\'s')
  const digit = keydown('2', {code: 'Digit2'})
  grid.ran.length = 0
  keys.run(digit); digit.preventDefault(); keys.settle()
  assert.deepEqual(grid.ran, [], 'a mapped key the key map took stays the key map\'s')
})

test('typing, a key-taking element, a pressed control and a paused window all hold the key', () => {
  const pressed = []
  const keys = rig({transport: () => bar(pressed), rows: () => grid()})
  for (const target of [el('INPUT'), el('TEXTAREA'), el('DIV', {contenteditable: 'true'}), el('DIV', {role: 'application'}, body)]) {
    assert.equal(keys.run(keydown(' ', {code: 'Space', target})), false)
    assert.equal(keys.run(keydown('Escape', {target})), false)
    assert.equal(keys.run(keydown('1', {code: 'Digit1', target})), false)
  }
  assert.equal(keys.run(keydown(' ', {code: 'Space', target: el('BUTTON')})), false, 'Space on a focused button is the button\'s')
  assert.equal(keys.run(keydown('1', {code: 'Digit1', target: el('BUTTON')})), true, 'a number key passes through a focused button')
  keys.settle(); pressed.length = 0
  const paused = rig({transport: () => bar(pressed)}, {paused: true})
  assert.equal(paused.run(keydown(' ', {code: 'Space'})), false)
  assert.deepEqual(pressed, [])
})

test('Esc stands down while a menu, a modal or a claiming state is open — asked when the key is pressed, not after', () => {
  const pressed = []
  const keys = rig({transport: () => bar(pressed)})
  const open = {querySelectorAll: () => [el('DIV', {role: 'menu'})]}
  assert.equal(keys.run(keydown('Escape'), open), false)
  assert.equal(keys.run(keydown('Escape'), {querySelectorAll: () => [el('OUTPUT', {'data-claims-keys': 'escape'})]}), false)
  keys.settle()
  assert.deepEqual(pressed, [])
  assert.equal(keys.run(keydown('Escape')), true)
  keys.settle()
  assert.deepEqual(pressed, ['stop'])
})

test('a key with no enabled control is no one\'s: it is not claimed and the page keeps it', () => {
  const keys = rig({})
  for (const event of [keydown(' ', {code: 'Space'}), keydown('Escape'), keydown('1', {code: 'Digit1'}), keydown('z'), keydown('Enter'), keydown('f', {metaKey: true})]) {
    assert.equal(keys.run(event), false)
    assert.equal(event.prevented, 0)
  }
  assert.equal(keys.waiting.length, 0)
})

test('the owner\'s answer to a key is shown, a thrown press too', async () => {
  const keys = rig({rows: () => grid({actions: {launchStop: {op: 'x', run: () => ({ok: false, error: 'No row is ready'})}}}), transport: () => ({stop: {press: () => { throw new Error('Not now') }}})})
  keys.run(keydown('1', {code: 'Digit1'})); keys.settle()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(keys.shown, [{ok: false, what: 'Launch row Intro', text: 'No row is ready'}])
  keys.run(keydown('Escape')); keys.settle()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(keys.shown.at(-1), {ok: false, what: 'Stop', text: 'Not now'})
})

test('⌘F is claimed at once so the page does not find; it needs a registered browser', () => {
  const calls = []
  const keys = rig({searchAvailable: () => true, search: reveal => { calls.push(reveal); return true }}, {revealBrowser: noop})
  const find = keydown('f', {metaKey: true})
  assert.equal(keys.run(find), true)
  assert.equal(find.prevented, 1); assert.deepEqual(calls, [noop])
  assert.equal(keys.run(keydown('f', {metaKey: true, target: el('INPUT')})), false, 'typing in a field: the field\'s ⌘F')
})

// ---------------------------------------------------------------------------------------------------------------------
// the layer as built

test('the layer draws nothing until the owner answers, then one status line with the dismissal', () => {
  assert.equal(renderToStaticMarkup(React.createElement(FrameKeys, {})), '')
  const markup = renderToStaticMarkup(React.createElement(KeyReceiptLine, {receipt: {ok: false, what: 'Launch row 2', text: 'No agent is free'}, onDismiss: noop}))
  assert.match(markup, /role="status"/); assert.match(markup, /data-ok="false"/); assert.match(markup, /Launch row 2/); assert.match(markup, /No agent is free/); assert.match(markup, /aria-label="Dismiss"/)
})

test('one window listener, and the layer names no mode', async () => {
  const dir = new URL('../src/frame/keys/', import.meta.url)
  const files = (await readdir(dir)).filter(name => /\.(ts|tsx)$/.test(name))
  assert.deepEqual(files.sort(), ['FrameKeys.tsx', 'keyDoors.ts', 'keyMap.ts', 'planKey.ts'])
  let listeners = 0
  for (const name of files) {
    const text = await readFile(new URL(name, dir), 'utf8')
    listeners += (text.match(/addEventListener\(\s*'key/g) ?? []).length
    assert.doesNotMatch(text, /[!=]==\s*'(?:live|base|central|factory|expressions|techne|audio)'/, `${name} branches on a mode`)
  }
  assert.equal(listeners, 1, 'one keydown listener for the whole window')
  const hook = await readFile(new URL('FrameKeys.tsx', dir), 'utf8')
  assert.match(hook, /window\.addEventListener\('keydown'/); assert.match(hook, /window\.removeEventListener\('keydown'/)
})

test('Backspace never steps the shell back an encounter: held where no element takes it, kept where it is typed or taken (r20)', () => {
  // WebKit (the native candidate) steps the page back on a Backspace no element takes, and the shell's history is its encounters
  // (projections/encounterLink.ts): a Delete on a selection that held no focus walked the person out of where they stood.
  const key = (target, defaultPrevented = false) => { const event = {key: 'Backspace', target, defaultPrevented, prevented: 0, preventDefault() { event.prevented += 1 }}; return event }
  const quiet = {querySelectorAll: () => []}
  const loose = key(body)
  handleKey(loose, doors(), {}, () => {}, quiet, () => {})
  assert.equal(loose.prevented, 1, 'on the page: held, so WebKit does not go back')
  const held = key(body)
  handleKey(held, doors(), {paused: true}, () => {}, quiet, () => {})
  assert.equal(held.prevented, 1, 'under a modal too')
  const typed = key(el('INPUT', {}, body))
  handleKey(typed, doors(), {}, () => {}, quiet, () => {})
  assert.equal(typed.prevented, 0, 'in a field it deletes what is typed')
  const taken = key(el('BUTTON', {}, body), true)
  handleKey(taken, doors(), {}, () => {}, quiet, () => {})
  assert.equal(taken.prevented, 0, 'a handler that took it already is left alone')
  const other = {key: 'Delete', target: body, defaultPrevented: false, prevented: 0, preventDefault() { other.prevented += 1 }}
  handleKey(other, doors(), {}, () => {}, quiet, () => {})
  assert.equal(other.prevented, 0, 'forward Delete has no Back to hold')
})
