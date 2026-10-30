import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {register} from 'node:module'

// Lane AJ (O-I #741): Autosave as the manual specifies it.
//   §17.8 Document — "Autosave | On · Off | On | Saves a short time after you stop." (Parameters); "Turns saving as you go on or off"
//     (Compact); the Save group (Whole); the transport's Metronome "Saves as you go" and Quantize "Sets when a save lands", which
//     Central's transport names Autosave and Save timing (shell/modeGrammar.ts).
//   §17.4 Canvas — "Autosave | On · Off | On | Saves a short time after a gesture, and at once after a delete. A small glyph shows saved,
//     saving or held."
// After VS Code's workbench, the manual's source for Central's editor side (campaign-evidence/2026-10-29-vscode-workbench-re/DECODE.md
// "Saving", read again in the bundle for this lane): files.autoSave off · afterDelay · onFocusChange · onWindowChange, files.autoSaveDelay
// 1000 ms; EditorAutoSave.scheduleAutoSave discards the scheduled save on every change and schedules it again, and saves when the delay
// passes only if the document is still dirty; "ignoring auto save request for … working copy that is in conflict or error" — an auto
// save never runs on a document in conflict or error, until a save by hand or a revert.
// Channels: SCRIPTED (the page script in a vm realm; the pure controller on a fake clock; the bindings; the faces' sources).
// The Central editor walk (af741-central-editor.browser.mjs, steps I) walks it on a scratch Central root in Chromium and WebKit.
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
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(['.html','.svg','.png','.md'].some(ext=>url.split('?')[0].endsWith(ext))||url.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})
globalThis.__CRADLE_WALK__ = false
const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop

/** This device's storage, as the window keeps it; `refuse` makes it keep nothing (a full or blocked store). */
const stored = new Map()
let refuse = false
globalThis.localStorage = {getItem: key => (stored.has(key) ? stored.get(key) : null), setItem: (key, value) => { if (refuse) throw new Error('QuotaExceededError'); stored.set(key, String(value)) },
  removeItem: key => { stored.delete(key) }, key: i => [...stored.keys()][i] ?? null, get length() { return stored.size }}

const read = path => readFile(new URL(path, import.meta.url), 'utf8').catch(() => null)
const autosave = () => import('../src/central/documents/autosave.ts')

/** A clock the test turns by hand. */
function fakeClock() {
  let now = 0, next = 1
  const timers = new Map()
  return {
    timer: {set: (run, ms) => { const id = next++; timers.set(id, {run, at: now + ms}); return id }, clear: id => { timers.delete(id) }},
    async advance(ms) {
      const until = now + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0]); now = due[1].at; due[1].run()
        for (let i = 0; i < 20; i++) await Promise.resolve()
      }
      now = until
      for (let i = 0; i < 20; i++) await Promise.resolve()
    },
    get pending() { return timers.size },
  }
}

// ---- the page tells its host that an edit happened, and nothing else

const editScript = await read('../../../../desktop/cradle/src/context/document-edit.js')

/** The page script in a realm framed by a host (`parent` is another window) or standing alone. */
function editRealm(framed) {
  const posted = [], heard = []
  const host = {postMessage: (message, origin) => posted.push({message, origin})}
  const window = {addEventListener: (type, listener, capture) => heard.push({type, listener, capture})}
  window.window = window
  window.parent = framed ? host : window
  vm.runInContext(editScript, vm.createContext({window, parent: window.parent}))
  return {posted, heard}
}

test('the page tells its host each edit and each press as it happens, and when it loses the focus — and never a word of the page', () => {
  assert.ok(editScript, 'desktop/cradle/src/context/document-edit.js: the edit every hosted document frame announces')
  const {posted, heard} = editRealm(true)
  const on = type => heard.find(h => h.type === type)
  for (const type of ['input', 'change', 'paste', 'cut', 'drop']) {
    assert.ok(on(type), `${type} is heard`)
    assert.equal(on(type).capture, true, `${type}: on the window, capturing — before any handler of the form can stop it`)
  }
  for (const type of ['click', 'pointerup']) assert.ok(on(type), `${type}: a press, as a page's own buttons edit too`)
  assert.ok(on('blur'), 'the page losing the focus (Save timing: when you leave the page)')
  on('input').listener({target: {innerHTML: 'secret words'}})
  on('click').listener({target: {}})
  on('blur').listener({})
  // (Read out of the page's realm: its objects carry that realm's prototype.)
  assert.deepEqual(posted.map(p => ({...p.message})), [{type: 'oi:document-edit', gesture: 'input'}, {type: 'oi:document-edit', gesture: 'press'},
    {type: 'oi:document-edit', gesture: 'leave'}], 'which gesture, and nothing of the page')
  assert.ok(posted.every(p => Object.keys(p.message).sort().join() === 'gesture,type'), 'the message carries no content')
})

test('a page opened by itself says nothing: with no host there is no one to tell', () => {
  assert.ok(editScript, 'the page script exists')
  const {heard} = editRealm(false)
  assert.equal(heard.length, 0)
})

test('every hosted document frame carries it, after the find and ⌘S, and the host never writes into the page', async () => {
  const frame = await read('../../../../desktop/cradle/src/document/frame.ts')
  assert.match(frame, /document-edit\.js\?raw/, 'frame.ts carries the page script')
  assert.match(frame, /withFrameScript\(withFrameScript\(withFrameScript\(\w+, documentFindScript\), documentSaveScript\), documentEditScript\)/,
    'useDocumentFrame frames every hosted document with it')
  const model = await autosave()
  assert.equal(model.DOCUMENT_EDIT_MESSAGE, 'oi:document-edit')
  assert.equal(model.pageGesture({type: 'oi:document-edit', gesture: 'input'}), 'input')
  assert.equal(model.pageGesture({type: 'oi:document-edit', gesture: 'press'}), 'press')
  assert.equal(model.pageGesture({type: 'oi:document-edit', gesture: 'leave'}), 'leave')
  assert.equal(model.pageGesture({type: 'oi:document-edit', gesture: 'save-this-now'}), null, 'a gesture it does not know is no gesture')
  assert.equal(model.pageGesture({type: 'oi:document-save'}), null)
  assert.equal(model.pageGesture(null), null)
  // The host side only listens: no hook posts into the frame.
  const hook = await read('../src/central/documents/useAutosave.ts')
  assert.ok(hook, 'src/central/documents/useAutosave.ts: the faces\' one hook')
  assert.doesNotMatch(hook, /postMessage/, 'the bridge is read-only by construction: the host never pushes into the sandbox')
})

// ---- the setting

test('Autosave is On by default, with VS Code\'s delay of a second; the setting is this device\'s, and a store that keeps nothing still turns it', async () => {
  const model = await autosave()
  stored.clear(); model.forgetAutosaveSetting()
  assert.deepEqual(model.autosaveSetting(), {on: true, timing: 'pause'}, 'the manual\'s default: On; VS Code\'s afterDelay')
  assert.equal(model.AUTOSAVE_DELAY_MS, 1000, 'files.autoSaveDelay default:1e3')
  model.setAutosave(false)
  assert.equal(model.autosaveSetting().on, false)
  model.forgetAutosaveSetting()
  assert.equal(model.autosaveSetting().on, false, 'read back from this device\'s store')
  model.setSaveTiming('page')
  assert.deepEqual(model.autosaveSetting(), {on: false, timing: 'page'})
  assert.equal(model.nextSaveTiming('pause'), 'page')
  assert.equal(model.nextSaveTiming('page'), 'window')
  assert.equal(model.nextSaveTiming('window'), 'pause', 'Save timing turns round, as the transport\'s Quantize steps')
  // Something else in the slot is the default, never a guess.
  stored.set(model.AUTOSAVE_KEY, '{"on":"yes","timing":"hourly"}'); model.forgetAutosaveSetting()
  assert.deepEqual(model.autosaveSetting(), {on: true, timing: 'pause'})
  // A store that keeps nothing: the setting still turns for this window.
  refuse = true
  model.setAutosave(false)
  assert.equal(model.autosaveSetting().on, false)
  refuse = false
  let heard = 0
  const stop = model.subscribeAutosave(() => heard++)
  model.setAutosave(true)
  stop()
  assert.equal(heard, 1, 'a change is heard')
  for (const timing of ['pause', 'page', 'window']) assert.ok(model.saveTimingWords(timing).face.length <= 6, `${timing}: a face the transport's slot holds`)
})

test('when a save lands: a pause saves only under After a pause; leaving the page under On leaving the page; leaving the window under both', async () => {
  const {savesAt} = await autosave()
  const on = timing => ({on: true, timing})
  assert.equal(savesAt('pause', on('pause')), true)
  assert.equal(savesAt('leave', on('pause')), false, 'afterDelay saves on the delay only')
  assert.equal(savesAt('window', on('pause')), false)
  assert.equal(savesAt('pause', on('page')), false)
  assert.equal(savesAt('leave', on('page')), true, 'onFocusChange')
  assert.equal(savesAt('window', on('page')), true, 'onFocusChange saves on a window change too')
  assert.equal(savesAt('leave', on('window')), false)
  assert.equal(savesAt('window', on('window')), true, 'onWindowChange')
  for (const moment of ['pause', 'leave', 'window']) assert.equal(savesAt(moment, {on: false, timing: 'pause'}), false, `${moment}: Off saves nothing`)
})

// ---- the controller: a save a short time after you stop, through the face's own Save

/** A face as the controller sees it: its draft fact is read by `settle`, its Save counted. */
function fakeFace(over = {}) {
  const face = {draft: true, pending: false, held: undefined, saves: 0, settles: 0, ...over}
  face.view = () => ({settle: async () => { face.settles++; return face.draft }, save: face.noSave ? undefined : async () => { face.saves++ }, pending: face.pending, held: face.held})
  return face
}

test('it saves a second after you stop, never while you type: every edit puts the save back, as VS Code schedules it again', async () => {
  const model = await autosave()
  const clock = fakeClock()
  const face = fakeFace()
  const typing = []
  const control = model.createAutosave({face: face.view, setting: () => ({on: true, timing: 'pause'}), timer: clock.timer, typing: on => typing.push(on)})
  // Typing, a key every 300 ms for three seconds: no save while it goes on.
  for (let i = 0; i < 10; i++) { control.gesture('input'); await clock.advance(300) }
  assert.equal(face.saves, 0, 'a draft still being typed is never written')
  assert.equal(face.settles, 0, 'nor even read for its save')
  await clock.advance(700)
  assert.equal(face.settles, 1, 'the pause: the face reads its page once')
  assert.equal(face.saves, 1, 'and saves through its own Save, once')
  assert.deepEqual([typing[0], typing.at(-1)], [true, false], 'typing while the edits came, and not after the pause')
  assert.equal(typing.filter(on => on === false).length, 1, 'typing ends once')
  // A press that changed nothing: the page is read, and nothing saved.
  face.draft = false
  control.gesture('press')
  await clock.advance(1000)
  assert.equal(face.settles, 2)
  assert.equal(face.saves, 1, 'no draft, no save')
  assert.equal(clock.pending, 0)
})

test('the glyph never shows saved between the pause and its save: typing stands until the pause is answered', async () => {
  const model = await autosave()
  const clock = fakeClock()
  const face = fakeFace()
  const seen = []
  face.view = () => ({settle: async () => { seen.push('settle'); return true }, save: async () => { seen.push('save') }, pending: false})
  const control = model.createAutosave({face: () => face.view(), setting: () => ({on: true, timing: 'pause'}), timer: clock.timer, typing: on => seen.push(on ? 'typing' : 'stopped')})
  control.gesture('input')
  await clock.advance(1000)
  assert.deepEqual(seen, ['typing', 'settle', 'save', 'stopped'], 'until the read and the save are answered, the edit stands as being saved')
  // An input during the pause's read keeps it typing: the next pause ends it.
  seen.length = 0
  let release
  face.view = () => ({settle: () => new Promise(done => { release = done }), save: async () => { seen.push('save') }, pending: false})
  control.gesture('input')
  await clock.advance(1000)
  control.gesture('input')
  release(true)
  for (let i = 0; i < 20; i++) await Promise.resolve()
  assert.deepEqual(seen, ['typing', 'typing', 'save'], 'the later input heard while the read stood, then the save of what the read found')
  assert.ok(!seen.includes('stopped'), 'and typing stands: the next pause ends it')
  await clock.advance(1000)
  release(true)
  for (let i = 0; i < 20; i++) await Promise.resolve()
  assert.deepEqual(seen.slice(-2), ['save', 'stopped'], 'the next pause saves it, and typing ends')
})

test('Off: the pause still reads the draft (its tab marks it), and nothing is saved', async () => {
  const model = await autosave()
  const clock = fakeClock()
  const face = fakeFace()
  const control = model.createAutosave({face: face.view, setting: () => ({on: false, timing: 'pause'}), timer: clock.timer})
  control.gesture('input')
  await clock.advance(1000)
  assert.equal(face.settles, 1, 'the draft fact follows the pause, not a poll')
  assert.equal(face.saves, 0, 'Autosave Off saves nothing')
})

test('held: a face in conflict or error is not saved by itself — it waits for Save or Re-read, as VS Code ignores an auto save then', async () => {
  const model = await autosave()
  const clock = fakeClock()
  const face = fakeFace({held: 'stale — the native source moved; review before saving'})
  const control = model.createAutosave({face: face.view, setting: () => ({on: true, timing: 'pause'}), timer: clock.timer})
  control.gesture('input')
  await clock.advance(1000)
  assert.equal(face.saves, 0, 'never written over the moved document')
  face.held = undefined
  control.gesture('input')
  await clock.advance(1000)
  assert.equal(face.saves, 1, 'once Save or Re-read has cleared it, saving as you go comes back')
})

test('a save in flight: the pause waits for it, then saves what came after; a face still reading has no Save to run', async () => {
  const model = await autosave()
  const clock = fakeClock()
  const face = fakeFace({pending: true})
  const control = model.createAutosave({face: face.view, setting: () => ({on: true, timing: 'pause'}), timer: clock.timer})
  control.gesture('input')
  await clock.advance(1000)
  assert.equal(face.saves, 0, 'not over a save in flight')
  face.pending = false
  control.settled()
  for (let i = 0; i < 20; i++) await Promise.resolve()
  assert.equal(face.saves, 1, 'the save that came due runs once the one in flight is answered')
  const reading = fakeFace({noSave: true})
  const early = model.createAutosave({face: reading.view, setting: () => ({on: true, timing: 'pause'}), timer: clock.timer})
  early.gesture('input')
  await clock.advance(1000)
  assert.equal(reading.saves, 0)
})

test('Save timing: on leaving the page, or the window, the save lands then and not at the pause', async () => {
  const model = await autosave()
  const clock = fakeClock()
  const face = fakeFace()
  let timing = 'page'
  const control = model.createAutosave({face: face.view, setting: () => ({on: true, timing}), timer: clock.timer})
  control.gesture('input')
  await clock.advance(1000)
  assert.equal(face.saves, 0, 'the pause reads the draft, and does not save it')
  control.gesture('leave')
  for (let i = 0; i < 20; i++) await Promise.resolve()
  assert.equal(face.saves, 1, 'leaving the page saves it')
  timing = 'window'
  control.gesture('input'); await clock.advance(1000)
  control.gesture('leave'); for (let i = 0; i < 20; i++) await Promise.resolve()
  assert.equal(face.saves, 1, 'not on leaving the page')
  control.windowLeft(); for (let i = 0; i < 20; i++) await Promise.resolve()
  assert.equal(face.saves, 2, 'leaving the window saves it')
})

// ---- the glyph: saved, saving or held

test('the glyph shows saved, saving or held, and says why it holds', async () => {
  const {autosaveGlyph, autosaveHeldOf} = await autosave()
  const base = {on: true, timing: 'pause', dirty: false, typing: false, pending: false}
  assert.equal(autosaveGlyph(base).state, 'saved')
  assert.equal(autosaveGlyph({...base, typing: true}).state, 'saving', 'an edit that will be saved a second after you stop')
  assert.equal(autosaveGlyph({...base, dirty: true}).state, 'saving')
  assert.equal(autosaveGlyph({...base, pending: true}).state, 'saving', 'a save in flight')
  const off = autosaveGlyph({...base, on: false, dirty: true})
  assert.equal(off.state, 'held', 'Autosave Off: the edit stands held in the page')
  assert.match(off.words, /Autosave is off/)
  const moved = autosaveGlyph({...base, dirty: true, held: 'stale — the native source moved; review before saving'})
  assert.equal(moved.state, 'held')
  assert.match(moved.words, /the native source moved/, 'with its reason')
  assert.equal(autosaveGlyph({...base, on: false}).state, 'saved', 'Off, with nothing edited, Central holds what the page shows')
  // What holds: the router's stale, conflict and refused, or a Day blocked under Review; saved and unchanged hold nothing.
  for (const outcome of ['stale', 'conflict', 'refused']) assert.ok(autosaveHeldOf({outcome, detail: 'x'}), `${outcome} holds`)
  for (const outcome of ['saved', 'unchanged']) assert.equal(autosaveHeldOf({outcome}), undefined, `${outcome} holds nothing`)
  assert.equal(autosaveHeldOf(undefined), undefined)
  assert.match(autosaveHeldOf(undefined, 'Native source changed; review its current revision before saving retained drafts.'), /Native source changed/)
})

// ---- the faces

test('each Central document face saves as you go through its own Save, and shows the glyph by its state', async () => {
  for (const file of ['../src/inhabitants/DocumentFlowFace.tsx', '../src/inhabitants/DocumentPageFace.tsx', '../src/inhabitants/DocumentDayDieFace.tsx']) {
    const source = await read(file)
    assert.match(source, /useAutosave\(frame, \{/, `${file}: the face's one autosave, on its own frame`)
    assert.match(source, /<AutosaveGlyph /, `${file}: the glyph`)
    assert.match(source, /autosaveHeldOf\(/, `${file}: a stale, conflicting or refused save holds autosave, with its reason`)
  }
  // The Day's own form already says when it is edited (dayForm.ts projectDieDocument: touch() posts `dirty`): that is an edit too.
  const daySource = await read('../src/inhabitants/DocumentDayDieFace.tsx')
  assert.match(daySource, /editedRef\.current = autosave\.edited/)
  assert.match(daySource.slice(daySource.indexOf("event.data.type === 'dirty'"), daySource.indexOf("event.data.type === 'dirty'") + 200), /editedRef\.current\?\.\(\)/)
  // Re-read sets the draft aside, and with it the outcome that held autosave (VS Code: a revert ends conflict and error).
  const flow = await read('../src/inhabitants/DocumentFlowFace.tsx')
  assert.match(flow.slice(flow.indexOf('const reread = useCallback'), flow.indexOf('const markDraft')), /setSave\(undefined\)/)
  const glyph = await read('../src/central/documents/AutosaveGlyph.tsx')
  assert.ok(glyph, 'src/central/documents/AutosaveGlyph.tsx')
  assert.match(glyph, /data-save-state=\{glyph\.state\}/)
  assert.match(glyph, /aria-label=/)
})

test('Re-read: the page it replaces is never read as the new basis — no draft stands after it, and autosave saves nothing of it', async () => {
  const flow = await read('../src/inhabitants/DocumentFlowFace.tsx')
  const reread = flow.slice(flow.indexOf('const reread = useCallback'), flow.indexOf('const markDraft'))
  assert.match(reread, /frameGeneration\.current\+\+/, 'Re-read begins a new page: a read of the old one answered later is not the new basis')
  assert.match(reread, /setFace\(undefined\)/, 'the old page leaves the frame (WebKit answers from it until the new one commits)')
  const standing = flow.slice(flow.indexOf('const refreshDraftStanding = useCallback'), flow.indexOf('const unanswered = useRef'))
  assert.ok((standing.match(/!== frameGeneration\.current\) return/g) ?? []).length >= 2, 'the poll and the pause each drop a read begun before it')
})

test('a save leaves the page in its frame when the owner holds what it shows: an edit typed during the save is never thrown away', async () => {
  const flow = await read('../src/inhabitants/DocumentFlowFace.tsx')
  const save = flow.slice(flow.indexOf('const saveToOwner = useCallback'), flow.indexOf('const reread = useCallback'))
  assert.match(save, /result\.current/, 'only an owner that holds something else is read again')
  assert.match(save, /baselineText\.current = text/, 'the page as saved is the new basis')
  const page = await read('../src/inhabitants/DocumentPageFace.tsx')
  const pageSave = page.slice(page.indexOf('const saveToOwner = useCallback'), page.indexOf('const reread = useCallback'))
  assert.match(pageSave, /result\.reading/, 'the verified reading is the page\'s new basis')
  const day = await read('../src/inhabitants/DocumentDayDieFace.tsx')
  const daySave = day.slice(day.indexOf('const saveToNative = useCallback'), day.indexOf('const reviewNative = useCallback'))
  assert.match(daySave, /formEdits\(next, value\)/, 'the form is drawn again only when it shows other than the owner holds')
})

// ---- the Document device and the transport

test('the Document\'s Autosave reads and turns the one setting; the transport\'s Autosave and Save timing press it', async () => {
  const model = await autosave()
  stored.clear(); model.forgetAutosaveSetting()
  const bindings = await import('../src/central/devices/pageBindings.ts')
  assert.ok(!('autosave' in bindings.DOCUMENT_WIRING.refused), 'Autosave is no longer refused')
  assert.ok(!('autosave' in bindings.DOCUMENT_WIRING.absent))
  assert.match(bindings.DOCUMENT_WIRING.local.autosave, /autosave\.ts/, 'the shell holds it')
  bindings.resetHolds()
  const reached = {form: 'Flow', tabTitle: 'Flow · f', dirty: false, outcome: null, name: 'f'}
  const doc = bindings.documentBinding('central:document', reached, null)
  assert.equal(doc.values.autosave, true, 'On, as the setting stands')
  doc.local.autosave(false)
  assert.equal(model.autosaveSetting().on, false, 'the Document\'s toggle turns the one setting')
  assert.equal(bindings.documentBinding('central:document', reached, null).values.autosave, false)
  assert.equal(doc.standing.autosave, undefined, 'and stands enabled')

  const R = await import('../src/shell/transports/transportReadings.ts')
  const turned = []
  const bar = R.centralBindings({ground: null, groundError: null, packet: null, config: null, transport: {kind: 'unavailable', reason: 'x'},
    autosave: {setting: {on: true, timing: 'pause'}, set: on => turned.push(['on', on]), time: timing => turned.push(['timing', timing])}})
  assert.equal(bar.metro.lit, true, 'the Autosave slot lit while it is on')
  assert.ok(bar.metro.press, 'and pressable')
  bar.metro.press()
  assert.equal(bar.quantize.readout.value, '1 s', 'Save timing shows when a save lands')
  bar.quantize.press()
  assert.deepEqual(turned, [['on', false], ['timing', 'page']])
  assert.match(bar.metro.title, /second after you stop/)
  const off = R.centralBindings({ground: null, groundError: null, packet: null, config: null, transport: {kind: 'unavailable', reason: 'x'},
    autosave: {setting: {on: false, timing: 'window'}, set: noop, time: noop}})
  assert.equal(off.metro.lit, false)
  assert.equal(off.quantize.readout.value, 'window')
  assert.match(off.quantize.title, /Autosave is off/)
  const hook = await read('../src/shell/transports/useCentralTransport.tsx')
  assert.match(hook, /useAutosaveSetting\(\)/, 'the hook reads the one setting')
})

// ---- the Canvas (§17.4): its own Autosave, held by the research frame, turned by the frame's own act

test('the Canvas\'s Autosave reads what the frame holds and turns it through the frame\'s own act; its glyph is the frame\'s', async () => {
  const frameB = await import('../src/techne/devices/frameBindings.ts')
  const board = (over = {}) => ({items: [], lines: [], frames: [], selected: [], drawing: false, erasing: false, lasso: false, snap: false, autosave: true, ...over})
  const sent = []
  const frame = canvas => ({state: {lens: 'canvas', research: {canvas}, chrome: null}, run: async command => { sent.push(command); return {ok: true} }, window: undefined})
  const on = frameB.canvasBinding(frame(board()))
  assert.equal(on.values.autosave, true, 'On, as the frame holds it')
  assert.equal(on.writes('autosave'), true)
  assert.equal(on.standing.autosave, undefined, 'and stands enabled while the Canvas is presented')
  await on.write([{key: 'autosave', value: false}])
  assert.deepEqual(sent, [{command: 'canvas', action: 'autosave', on: false}], 'the frame\'s own act, nothing else')
  assert.equal(frameB.canvasBinding(frame(board({autosave: false}))).values.autosave, false)
  const unsaid = frameB.canvasBinding(frame(board({autosave: undefined})))
  assert.equal(unsaid.values.autosave, undefined, 'a frame that does not say holds no reading: never the design\'s default')
  const away = frameB.canvasBinding({state: {lens: 'm2', research: {}}, run: async () => ({ok: true}), window: undefined})
  assert.match(away.standing.autosave.disabled, /Canvas/, 'not presented: disabled, and why')
})
