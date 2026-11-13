// O-I #747 round 886, on the shell's side:
//   1. a playing scene reads as playing: Running is drawn as the legend names it — a lit triangle on a plate, the fill standing solid to
//      where the scene has got and faded past it — so Running, Waiting and Stopped stand apart at a glance on any colour of the palette;
//   2. the Expression's colour (DLW.md:8911 "The track head shows the Expression's title and colour"): its track and its clip cells take
//      it, its head carries a swatch of it, and the Colour menu writes it through the owner's `colour` scene edit; the ink, the waiting
//      outline and the running mark each read on every colour of the palette;
//   3. the receipt after a landing: a held launch's line says that it landed, or clears; it never keeps a stale "lands at";
//   4. Solo (DLW build ruling 2026-11-06, the lead's derivation): kept in the Expression's mixer with the Activator, written through the
//      owner's `mix` edit; another open Expression's Solo is what the frame hears (`silenced`), told once per change;
//   5. the one gain the frame announces beside the Torus's effects (parameters.mix) goes to the desktop's engine with them;
//   6. the Field's Level (§20.2 Field, "Level | −60 to 0 dB | −12 dB | Sets the loudness of the whole field"): the scene's own, read and
//      written as the editor's panel setting; no "missing op" stands in its place.
//   7. the Pulse walk's "Off press during play didn't take" (r885 run 2): the press was taken. The Metronome is the open scene's Pulse, a
//      launch opens the launched scene, so the light changed to that scene's own Pulse with no press, and the walk's next press turned
//      it on. The slot now says whose Pulse it shows, so a launch that changes it reads as the scene's own and not as a lost press.
// SCRIPTED: views rendered to static markup and CSS read as text; no frame is mounted, no audio device opened, nothing sounds.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFileSync} from 'node:fs'
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const src = path => new URL(`../src/${path}`, import.meta.url)
const grid = {...await import(src('frame/tracks/SessionGrid.tsx').href), ...await import(src('inhabitants/catalogue/panels/dlw__session-grid.tsx').href)}
const sound = await import(src('native/frameSound.ts').href)
const {projectExpressionsWork} = await import(src('timeline/expressionsTrackAdapter.ts').href)
const {expressionsControls, nativeTracks} = await import(src('frame/tracks/modeTracks.ts').href)
const {LIVE_CLIP_PALETTE} = await import(src('live/livePalette.ts').href)
const field = await import(src('components/devices/fieldInstrument.ts').href)
const engine = await import(src('live/liveEngine.ts').href)
const css = readFileSync(src('frame/tracks/tracks.css'), 'utf8')
const rule = selector => new RegExp(`(?:^|\\n|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''

// The shell's tokens (styles.css :root) and WCAG contrast.
const TOKENS = {'var(--bg-0)': '#26292d', 'var(--bg-2)': '#3f4348', 'var(--text)': '#d4d7da', 'var(--green)': '#8fd0a8'}
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const lum = hex => { const [r, g, b] = rgb(hex).map(c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }); return .2126 * r + .7152 * g + .0722 * b }
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
const over = (hex, ground, share) => '#' + rgb(hex).map((v, i) => Math.round(v * share + rgb(ground)[i] * (1 - share)).toString(16).padStart(2, '0')).join('')
const PALETTE = [...LIVE_CLIP_PALETTE, '#4a4e54']
const noop = () => {}
const SELECT = {select: noop}

test('r886 item 1: Running, Waiting and Stopped stand apart — a lit triangle on its plate, a dashed edge, full colour', () => {
  // Running: the lit triangle on a dark plate ringed in the text colour, blinking slowly; the plate stands still.
  assert.match(rule('.cs.clip.running .tri'), /background: var\(--bg-0\)/, 'the running mark stands on a plate')
  assert.match(rule('.cs.clip.running .tri'), /box-shadow: 0 0 0 1px var\(--text\)/, 'ringed in the text colour')
  assert.doesNotMatch(rule('.cs.clip.running .tri'), /animation/, 'the plate does not blink')
  assert.match(rule('.cs.clip.running .tri::before'), /border-left: 6px solid var\(--green\)/, 'its triangle lit, as Live lights a playing clip\'s')
  assert.match(rule('.cs.clip.running .tri::before'), /animation: tracks-blink 1s/, 'and blinking slowly')
  // The ground as the legend names it: solid to where it has got, faded past it — never the full colour of a stopped clip.
  assert.match(rule('.cs.clip.running'), /background: color-mix\(in srgb, var\(--tc\) 40%, var\(--bg-2\)\)/, 'faded where it has not got to')
  assert.match(rule('.cs.clip.running::before'), /background: var\(--tc\)/, 'the solid fill grows over it')
  assert.match(rule('.cs.clip.running::before'), /animation: tracks-fill/)
  assert.match(rule('.cs.clip.running'), /color: var\(--text\)/, 'its name in the text colour')
  // Its name on a dark tag, over the solid and the faded alike (walk 886: a halo alone left the name blurred on the palette's light colours).
  assert.match(rule('.cs.clip.running .cs-text'), /background: color-mix\(in srgb, var\(--bg-0\) 80%, transparent\)/, 'the running name stands on a tag')
  assert.doesNotMatch(rule('.cs.clip.running .cs-text'), /text-shadow/, 'not a halo')
  // Waiting: a faint ground, a dashed edge and a fast triangle, both in the text colour.
  assert.match(rule('.cs.clip.waiting'), /background: color-mix\(in srgb, var\(--tc\) 25%, var\(--bg-2\)\)/)
  assert.match(rule('.cs.clip.waiting'), /outline: 1px dashed var\(--text\)/)
  assert.match(rule('.cs.clip.waiting .tri'), /border-left-color: var\(--text\)/)
  assert.match(rule('.cs.clip.waiting .tri'), /animation: tracks-blink \.35s/)
  // Stopped: the full colour, its triangle and name in the ink chosen for that colour.
  assert.match(rule('.cs.clip'), /color: var\(--tc-ink, var\(--bg-0\)\)/)
  assert.match(rule('.cs .tri'), /border-left: 7px solid var\(--tc-ink, var\(--bg-0\)\)/)
  // The legend names Running by the same mark.
  assert.match(rule('.sg-legend .sg-key i[data-status="running"]::after'), /border-left: 5px solid var\(--green\)/, 'the legend\'s Running carries the lit triangle')
})

test('r886 items 1–2: on every colour of the palette the ink, the waiting edge and the running mark read (WCAG ≥ 3)', () => {
  for (const colour of PALETTE) {
    const ink = grid.trackInk(colour)
    assert.ok(ink === 'var(--bg-0)' || ink === 'var(--text)', `${colour}: ${ink}`)
    assert.ok(contrast(TOKENS[ink], colour) >= 3, `${colour}: stopped ink ${ink} ${contrast(TOKENS[ink], colour).toFixed(2)}`)
    const waiting = over(colour, TOKENS['var(--bg-2)'], .25)
    assert.ok(contrast(TOKENS['var(--text)'], waiting) >= 3, `${colour}: waiting edge ${contrast(TOKENS['var(--text)'], waiting).toFixed(2)}`)
    const faded = over(colour, TOKENS['var(--bg-2)'], .4)
    for (const ground of [colour, faded]) {
      const plate = Math.max(contrast(TOKENS['var(--bg-0)'], ground), contrast(TOKENS['var(--text)'], ground))
      assert.ok(plate >= 3, `${colour}: the running plate or its ring on ${ground} ${plate.toFixed(2)}`)
      const tag = over(TOKENS['var(--bg-0)'], ground, .8)
      assert.ok(contrast(TOKENS['var(--text)'], tag) >= 4.5, `${colour}: the running name on its tag over ${ground} ${contrast(TOKENS['var(--text)'], tag).toFixed(2)}`)
    }
  }
  assert.ok(contrast(TOKENS['var(--green)'], TOKENS['var(--bg-0)']) >= 4.5, 'the lit triangle on its plate')
  assert.equal(grid.trackInk(undefined), 'var(--text)', 'the shell\'s default track colour is dark')
  assert.equal(grid.trackInk('var(--accent)'), undefined, 'a colour the shell cannot read keeps the ink it had')
})

test('r886 item 2: the Expression\'s colour is its track\'s and its clips\'; the head carries a swatch; the Colour menu writes its document', async () => {
  const edits = []
  const reading = {expressions: [{id: 'expression:a', name: 'Dawn', colour: '#5480E4', scenes: [{id: 's1', name: 'Noon', duration: 4, status: 'running'}]}],
    controls: {sceneEdit: {op: 'scene-edit', run: intent => { edits.push(intent); return {ok: true, note: 'The Expression changed.'} }}}}
  const set = projectExpressionsWork(reading)
  assert.deepEqual(set.tracks.map(track => track.color), ['#5480E4', '#5480E4'], 'both lanes of the Expression wear its colour')
  assert.equal(projectExpressionsWork({...reading, expressions: [{...reading.expressions[0], colour: undefined}]}).tracks[0].color, undefined)
  const markup = renderToStaticMarkup(React.createElement(grid.SessionGridView, {set, selection: SELECT, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop}))
  assert.match(markup, /style="--tc:#5480E4;--tc-ink:var\(--bg-0\)"/, 'the clip cells take the colour, with the ink that reads on it')
  assert.match(markup, /<i class="trk-swatch" role="img" aria-label="Colour #5480E4" style="background:#5480E4"><\/i>/, 'the head shows the colour')
  assert.deepEqual(await set.actions.colourTrack.run('expression:expression:a:visual', '#FF94A6'), {ok: true, note: 'The Expression changed.'})
  assert.deepEqual(edits, [{operation: 'colour', colour: '#FF94A6'}])
  const content = {basis: {expression_ref: 'expression:a', scene_ref: 's1'}, playback: null,
    scenes: {colour: '#FF94A6', scenes: [{scene_ref: 's1', title: 'Noon', native_title: 'Noon', snapshot: {duration: 4}, working: {duration: 4}, material: {available: true}}]}}
  assert.equal(nativeTracks(content, 'Dawn').tracks[0].color, '#FF94A6', 'the scenes reading\'s colour reaches the track')
  assert.match(rule('.trk .thd .trk-swatch'), /background|width/)
  assert.match(rule('.tl-clip.waiting'), /outline: 1px dashed var\(--text\)/, 'the ruler\'s waiting edge reads on every colour too')
})

test('r886 item 3: a held launch\'s line says that it landed, or clears — never a stale "lands at"', () => {
  assert.deepEqual(grid.receiptOf({ok: true, note: 'Launched: it lands at 4.00 s of the playing scene, on its Quantize.', waits: true}),
    {ok: true, text: 'Launched: it lands at 4.00 s of the playing scene, on its Quantize.', waits: true})
  assert.equal('waits' in grid.receiptOf({ok: true, note: 'The scene plays.'}), false)
  const held = {key: 'clip:noon', what: 'Launch Noon', ok: true, text: 'Launched: it lands at 4.00 s of the playing scene, on its Quantize.', waits: true}
  const setWith = status => ({columns: [], tracks: [], clips: [{id: 'noon', trackId: 't', columnId: 'r', label: 'Noon', ...(status ? {status} : {})}]})
  const seen = grid.heldLaunchReceipt(held, setWith('waiting'))
  assert.equal(seen.seen, true, 'its clip waits: the line stands')
  assert.equal(grid.heldLaunchReceipt(seen, setWith('waiting')), seen, 'unchanged: the same line')
  assert.deepEqual(grid.heldLaunchReceipt(seen, setWith('running')), {key: 'clip:noon', what: 'Launch Noon', ok: true, text: 'Landed on its Quantize: Noon plays.'})
  assert.equal(grid.heldLaunchReceipt(seen, setWith('stopped')), null, 'it waits no more and does not play: the line clears')
  assert.equal(grid.heldLaunchReceipt(seen, {columns: [], tracks: [], clips: []}), null, 'its clip is gone: the line clears')
  assert.equal(grid.heldLaunchReceipt(held, setWith('stopped')), held, 'not yet seen waiting: the reading has not caught up')
  const plain = {key: 'clip:noon', what: 'Launch Noon', ok: true, text: 'The scene plays.'}
  assert.equal(grid.heldLaunchReceipt(plain, setWith('stopped')), plain, 'a line that waits for nothing stands')
  const source = readFileSync(src('inhabitants/catalogue/panels/dlw__session-grid.tsx'), 'utf8')
  assert.match(source, /useEffect\(\(\) => \{ setReceipt\(current => heldLaunchReceipt\(current, set\)\) \}, \[set\]\)/, 'the grid follows the set')
  const ruler = readFileSync(src('frame/tracks/ArrangementRuler.tsx'), 'utf8')
  assert.match(ruler, /heldLaunchReceipt\(current, set\)/, 'and so does the ruler')
})

test('r886 item 3: the launch\'s answer says it waits when the frame holds it, and the scene plays when it does not', async () => {
  const pending = {scene_ref: 's2', at_seconds: 4}
  const source = held => ({isPresented: () => true, content: {playback: {saved_sequence_playing: false}, scenes: {}},
    actions: {scene: async () => ({ok: true, reading: {playback: held ? {launch_pending: pending} : {launch_pending: null}}})}})
  const link = {state: null, run: null}
  assert.deepEqual(await expressionsControls(source(true), link).playScene.run('expression:a', 's2'),
    {ok: true, note: 'Launched: it lands at 4.00 s of the playing scene, on its Quantize.', waits: true})
  assert.deepEqual(await expressionsControls(source(false), link).playScene.run('expression:a', 's2'), {ok: true, note: 'The scene plays.'})
})

test('r886 item 4: Solo is the Expression\'s own, kept in its mixer; another open Expression\'s Solo is what the frame hears, told once', async () => {
  sound.resetFrameSound()
  const sent = [], link = {state: {nativeScene: {expression_ref: 'expression:a', revision: 1, scene_ref: 's'}}, run: async command => { sent.push(command); return {ok: true} }}
  assert.deepEqual(sound.frameSoundReading(link, {level: 1, main: 1, active: true, solo: true}), {active: true, solo: true, level: 1, main: 1, muted: null})
  assert.equal(sound.frameSoundReading(link, {level: 1, main: 1, active: true}).solo, false, 'a frame from before Solo: not soloed')
  assert.equal(sound.frameSoundReading(link, undefined).solo, null)
  const intents = [], edit = async intent => { intents.push(intent); return {ok: true} }
  await sound.setExpressionSolo(edit, true); await sound.setExpressionSolo(edit, false)
  assert.deepEqual(intents, [{operation: 'mix', set: {solo: true}}, {operation: 'mix', set: {solo: null}}], 'off is its default: the document keeps none')
  // Live's law: while any track is soloed, the others are silent; a soloed one is heard.
  const rows = [{expression_ref: 'expression:a', open: true}, {expression_ref: 'expression:b', open: true, solo: true}, {expression_ref: 'expression:c', open: false, solo: true}]
  assert.equal(sound.soloSilencedBy(rows, 'expression:a', false), true, 'another open Expression is soloed')
  assert.equal(sound.soloSilencedBy(rows, 'expression:a', true), false, 'soloed itself: heard')
  assert.equal(sound.soloSilencedBy(rows.slice(0, 1).concat(rows[2]), 'expression:a', false), false, 'a closed work sounds nowhere')
  sound.noteWorksSolo(rows)
  assert.deepEqual(await sound.syncSoloSilenced(link), {ok: true})
  assert.equal(await sound.syncSoloSilenced(link), null, 'told once')
  sound.noteSolo('expression:a', true)
  await sound.syncSoloSilenced(link)
  assert.deepEqual(sent, [{command: 'sound', silenced: true}, {command: 'sound', silenced: false}])
  sound.resetFrameSound()
  // The row: Solo reads the document's and writes the owner's `mix` edit; the track shows it.
  const edits = []
  const src2 = {isPresented: () => true, content: {playback: {saved_sequence_playing: false}, scenes: {mix: {level: 1, main: 1, active: true, solo: true}}},
    actions: {scene: async () => ({ok: true}), sceneEdit: async intent => { edits.push(intent); return {ok: true} }}}
  const controls = expressionsControls(src2, link)
  assert.equal(controls.sound.solo === undefined, false)
  assert.equal(controls.sound.soloed, undefined, 'no shell-held soloed Expression')
  assert.equal(controls.sound.soloOn, true)
  assert.deepEqual(await controls.sound.solo('expression:a', false), {ok: true, note: 'Every Expression sounds again.'})
  assert.deepEqual(edits, [{operation: 'mix', set: {solo: null}}])
  const set = projectExpressionsWork({expressions: [{id: 'expression:a', name: 'Dawn', scenes: [{id: 's1', name: 'One', duration: 4}]}], controls})
  assert.equal(set.tracks[0].mix.solo, true, 'the track shows the Solo its document keeps')
  sound.resetFrameSound()
})

test('r886 item 5: the one gain the frame announces goes to the engine with the Torus\'s effects', () => {
  const torus = parameters => ({ok: true, parameters: {effects: {chain: ['delay']}, level: 1, muted: false, ...parameters}})
  assert.deepEqual(engine.torusEffectsOf(torus({mix: 0.5})), {chain: ['delay'], level: 1, muted: false, mix: 0.5})
  assert.equal('mix' in engine.torusEffectsOf(torus({})), false, 'a frame that announces none: none sent')
  assert.equal(engine.torusEffectsOf(null), null)
})

test('r886 item 6: the Field\'s Level is the scene\'s own, −60 to 0 dB, −12 dB where it keeps none, set as the editor\'s panel setting', async () => {
  assert.equal(field.FIELD_NO_LEVEL, undefined, 'no missing op stands in its place')
  const frame = readFileSync(new URL('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/entitySound.ts', import.meta.url), 'utf8')
  const law = /FIELD_LEVEL_DB=Object\.freeze\(\{min:(-?\d+),max:(-?\d+),default:(-?\d+)\}\)/.exec(frame)
  assert.deepEqual({...field.FIELD_LEVEL_DB}, {min: +law[1], max: +law[2], default: +law[3]}, 'the shell reads the Level by the frame\'s law')
  const applied = []
  const input = level => ({reading: {scene: {composition: level === undefined ? {} : {fieldLevel: level}, entities: []}}, devices: {},
    sound: {muted: false, mute: async () => ({ok: true})}, apply: async changes => { applied.push(changes); return {ok: true} }})
  assert.equal(field.fieldValues(input(-6)).level, -6)
  assert.equal(field.fieldValues(input(undefined)).level, -12, 'a scene that keeps none sounds at −12 dB')
  assert.equal(field.fieldStanding(input(-6), 'level'), null, 'the Level takes a change')
  assert.equal(field.fieldValues({...input(-6), reading: null}).level, undefined, 'no reading: unread')
  await field.applyFieldChanges(input(-6), [{key: 'level', value: -20}])
  assert.deepEqual(applied, [[{kind: 'panel-setting', key: 'fieldLevel', value: -20}]])
  await assert.rejects(field.applyFieldChanges(input(-6), [{key: 'level', value: 3}]), /The Field's Level runs from −60 to 0 dB\./)
  const design = readFileSync(src('inhabitants/catalogue/panels/expressions__field.tsx'), 'utf8')
  assert.match(design, /LEVEL = \{min: -60, max: 0\}/, 'the design\'s dial runs over the manual\'s range')
  assert.match(design, /DIAL\(p, 'level', 'Level', 'Sets the loudness of the whole field\.', -12, LEVEL, decibels\)/)
  assert.match(design, /sound: true, level: -12,/, 'its default the manual\'s')
})

test('r886: the Metronome says whose Pulse it shows: the open scene\'s, each scene keeping its own, so a launch that changes it is not a lost press', async () => {
  const playback = await import(src('components/nativeScenePlayback.ts').href)
  const sent = []
  const on = playback.pulseSlot({on: true, reason: null, scene: 'Dawn', send: value => sent.push(value)})
  assert.match(on.title, /^Pulse — the field pulses on the beat of its Tempo: On\. Press to turn it off; it is Dawn's Pulse, and each scene keeps its own\.$/)
  on.press(); assert.deepEqual(sent, [false], 'the press asks for the other, as before')
  const busy = playback.pulseSlot({on: false, reason: 'The native editor is busy or not attached.', scene: 'Noon', send: value => sent.push(value)})
  assert.match(busy.title, /: Off\. Press to turn it on; it is Noon's Pulse, and each scene keeps its own\. The native editor is busy or not attached\.$/)
  // The transport hands it the open scene's title, the same scene whose Pulse it reads (editorReading.scene).
  const transport = readFileSync(src('shell/transports/useExpressionsTransport.tsx'), 'utf8')
  assert.match(transport, /pulseSlot\(\{on: pulseOn, reason: ready \? null : 'The native editor is busy or not attached\.', scene: current\?\.title,/)
})
