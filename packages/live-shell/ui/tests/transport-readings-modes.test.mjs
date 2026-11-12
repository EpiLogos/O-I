import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Ticket C: the title line reads THE selection — the world · the day (the set's name in Live); every mode wears the mockup's
// words on its word-faced controls; Factory's key reads tokens in · out; Expressions' signature reads the field's hold share;
// Technē's clock carries the civil day; and the bar is the mockup's size. Channel: scripted (fixtures of the owners' shapes).
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
const {readFile} = await import('node:fs/promises')
const h = React.createElement
const R = await import('../src/shell/transports/transportReadings.ts')
const {ModeTransport, MODE_TITLE} = await import('../src/shell/modeTransports.tsx')
// A mode's bodies load when first drawn (shell/loadWhenDrawn.ts; O-I #740); a server render cannot wait for a module, so they are fetched first.
await (await import('../src/shell/loadWhenDrawn.ts')).loadEveryPart()
const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')
const {TransportTitle} = await import('../src/components/TransportBar.tsx')
const {ShellConfigContext} = await import('../src/shell/useSet.ts')
const {createTimeSpine} = await import('../src/timeline/timeSpine.ts')
const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
const DAY = 'central:day:control:root:2026-10-08'
const spineAt = () => { const spine = createTimeSpine(); spine.readNow({instantUnixMs: Date.UTC(2026, 9, 8, 13, 37), dayRef: DAY, source: 'the kernel temporal read'}); return spine }
const text = markup => markup.replace(/<[^>]+>/g, '').replaceAll('&amp;', '&')

test('the title line reads THE selection — the world · the day, and the open set in Live', () => {
  assert.deepEqual(R.titleLine({line: 'selection', selection: {title: 'Bollingen · the stone carved'}, world: 'Central', civilDayRef: DAY}),
    {lead: 'Bollingen · the stone carved', absent: null, context: 'Central · 08 Oct'}, 'the mockup\'s own line')
  assert.deepEqual(R.titleLine({line: 'selection', selection: null, world: null, civilDayRef: null}), {lead: null, absent: 'Nothing selected', context: null})
  assert.equal(R.worldName('epi-logos', null), 'Epi-Logos')
  assert.equal(R.worldName(undefined, {world_scope: {owner: 'central', world: 'control:root', personal_ground: '/g'}}), 'Central', 'the host\'s World when the book names none')
  assert.equal(R.worldName(undefined, null), null)
  assert.deepEqual(MODE_TITLE, {live: 'set', base: 'selection', factory: 'selection', expressions: 'selection', techne: 'selection'})
  // The drawn line: with nothing selected it says so, then the World the host discloses and the day the spine's civil reading stands in.
  const config = {world_scope: {owner: 'central', world: 'control:root', personal_ground: '/g', workcell_ref: 'workcell:mac'}}
  const drawn = renderToStaticMarkup(h(ShellConfigContext.Provider, {value: config}, h(TransportTitle, {line: 'selection', timeSpine: spineAt()})))
  assert.match(drawn, /data-region="title-line"/)
  // Back and Forward stand at the line's head (manual §10.7): ‹ ›, then the line.
  assert.equal(text(drawn), '‹›Nothing selected — Central · 08 Oct')
  assert.match(drawn, /<span class="title-trail"><button type="button" aria-label="Back" disabled=""/, 'Back waits while the trail is empty')
  assert.match(drawn, /<span class="set-title-absent">Nothing selected<\/span>/)
  assert.equal(text(renderToStaticMarkup(h(TransportTitle, {line: 'selection', workName: 'A working inquiry'}))), '‹›A working inquiry', 'with no selection, the open work in front of you')
  assert.equal(text(renderToStaticMarkup(h(TransportTitle, {line: 'set', setName: 'Mercurius sketch'}))), '‹›Mercurius sketch — Live set')
})

test('the bar names no mode in its title: the line is the registration\'s', async () => {
  const bar = await source('components/TransportBar.tsx')
  assert.match(bar, /<TransportTitle line=\{MODE_TITLE\[surf\]\}/)
  assert.doesNotMatch(bar, /mode === 'live'/)
})

test('every mode wears the mockup\'s words on Link, Tap and the maps, and keeps the 28 slots', () => {
  const words = Object.fromEntries(SURF_MODES.map(mode => {
    const markup = renderToStaticMarkup(h(ModeTransport, {mode, reading: {tempoBpm: null}}))
    const face = id => markup.match(new RegExp(`<button[^>]*data-slot="${id}"[^>]*>([^<]*)<`))?.[1] ?? null
    return [mode, ['link', 'tap', 'key-map', 'midi-map'].map(face)]
  }))
  // Live's two map toggles read Key and MIDI (manual §10.1): one place each, never two that read the same.
  assert.deepEqual(words.base, ['Ground', 'Stamp', 'Key', 'MIDI'])
  assert.deepEqual(words.factory, ['Link', 'Tap', 'Key', 'MIDI'])
  assert.deepEqual(words.expressions, ['Link', 'Tap', 'Key', 'MIDI'])
  assert.deepEqual(words.techne.slice(0, 1), ['Link'], 'Technē\'s Tap is Back to Now, drawn as its own control over the spine')
  assert.deepEqual(words.live.slice(0, 2), ['Link', 'Tap'], 'Live\'s map slot holds its own KEY and MIDI toggles')
})

test('Factory\'s key reads tokens in · out, as the mockup\'s Σ 142k · 38k', () => {
  const read = R.tokenReadout('142000', '38000', 'session')
  assert.equal(read.value, 'Σ 142k · 38k'); assert.match(read.title, /142000 read and 38000 written in the session scope/)
  assert.equal(R.tokenReadout('—', '—', 'all').value, 'Σ — · —', 'unread stays unread')
})

test('Expressions\' signature is the field\'s hold share as the simplest ratio', () => {
  assert.equal(R.holdRatio(0.625), '5 : 3'); assert.equal(R.holdRatio(0.5), '1 : 1'); assert.equal(R.holdRatio(0.75), '3 : 1')
  assert.equal(R.holdRatio(0.5235), '52 : 48', 'no small ratio within half a percent: the shares')
  assert.equal(R.holdRatio(0), null); assert.equal(R.holdRatio(1), null); assert.equal(R.holdRatio(null), null)
})

test('Technē\'s clock carries the civil day the spine stands in, as the mockup\'s 14:37 · 08 Oct', () => {
  const now = {value: '14:37', title: 'Now — derived from the kernel\'s own temporal read'}
  const markup = renderToStaticMarkup(h(ModeTransport, {mode: 'techne', reading: {tempoBpm: null, timeSpine: spineAt(), readouts: {position: now}}}))
  assert.match(markup, /<output[^>]*data-slot="position"[^>]*>14:37 · 08 Oct<\/output>/)
  const unread = renderToStaticMarkup(h(ModeTransport, {mode: 'techne', reading: {tempoBpm: null, timeSpine: spineAt(), readouts: {position: {value: '—', title: 'no reading'}}}}))
  assert.match(unread, /<output[^>]*data-slot="position"[^>]*>—<\/output>/, 'no Now, no clock: the day alone is not the clock')
})

test('Technē\'s Aperture and View as choose the World\'s field view, Projected reads what your world shows, and Carrier names the field\'s service and this window\'s round trip to it; each stands dimmed with the field\'s words while it is not read (O-I #858 TO04, TX14)', async () => {
  const store = await import('../src/projections/atlas/system/systemStore.ts')
  const model = await import('../src/projections/atlas/system/fieldModel.ts')
  const draw = () => renderToStaticMarkup(h(ModeTransport, {mode: 'techne', reading: {tempoBpm: null, timeSpine: spineAt(), readouts: {}}}))
  const select = (markup, label) => markup.match(new RegExp(`<select[^>]*aria-label="${label}"[^>]*>[\\s\\S]*?</select>`))?.[0] ?? ''
  const output = (markup, id) => markup.match(new RegExp(`<output[^>]*data-slot="${id}"[^>]*>[^<]*</output>`))?.[0] ?? ''
  const LOST = 'The SharedField is not reachable now. It comes back on its own once its service answers again; your world goes on here meanwhile.'
  try {
    store.publishField({state: 'unavailable', reason: LOST})
    let markup = draw()
    for (const label of ['Aperture', 'View as']) {
      assert.match(select(markup, label), /disabled=""/, `${label} stands dimmed while the field is not read`)
      assert.ok(select(markup, label).includes('not reachable now'), `${label} says why in the field’s words`)
    }
    assert.match(output(markup, 'rate'), />—</, 'no carrier read: no value')
    assert.ok(output(markup, 'rate').includes('not reachable now'), 'Carrier says the service is lost in plain words')
    assert.doesNotMatch(markup, /fetch failed/)
    assert.match(output(markup, 'cpu'), />—</)
    assert.doesNotMatch(markup, /data-slot="(root|scale|cpu|rate)"[^>]*(data-i|title)="[^"]*Not wired here yet/, 'none says it is not wired')

    store.publishSystem({state: 'read', bodies: [{yours: true, bodyRef: 'body:me'}], set: null})
    // the held field as SystemReadings publishes it: read through its service, with the window's round trip for the read, timed there
    const readings = await source('projections/atlas/system/SystemReadings.tsx')
    assert.match(readings, /const asked = performance\.now\(\), made = await read\(\); fieldTripMs = performance\.now\(\) - asked/, 'each read of the field is timed where it is read')
    assert.match(readings, /publishField\(read\.state === 'read' \? \{\.\.\.read, trip: fieldTripMs\} : read\)/, 'and its round trip rides the held field it publishes')
    store.publishField({...model.heldFieldOf({world_field: {state: 'held'}, world_scope: 'circle', target: {name: 'local', uri: 'ws://127.0.0.1:3917', database: 'oi-shared-field'},
      worlds: [{world_ref: 'world:ab12:Me', body: {body_ref: 'body:me'}, linked: true, mine: true}],
      clearings: [{world_ref: 'world:ab12:Me', part_ref: 'page:a', audience: 'field', shown: {kind: 'page', label: 'A page'}},
        {world_ref: 'world:ab12:Me', part_ref: 'page:b', star_ref: 'star:x', audience: 'star', shown: {kind: 'page', label: 'B page'}}],
      stars: [], gatherings: []}), trip: 42.4})
    markup = draw()
    assert.doesNotMatch(select(markup, 'Aperture'), /disabled=""/, 'Aperture chooses once the field is read')
    assert.match(select(markup, 'Aperture'), /<option value="world" selected="">World<\/option><option value="local">Local<\/option><option value="shared">Shared<\/option><option value="federated">Federated<\/option>/)
    assert.match(select(markup, 'View as'), /<option value="me" selected="">Me<\/option><option value="field">Field<\/option><option value="public">Public<\/option>/)
    store.chooseFieldView({aperture: 'federated', viewAs: 'field'})
    markup = draw()
    assert.match(select(markup, 'Aperture'), /<option value="federated" selected="">/, 'the World\'s own Aperture, as chosen there or here')
    assert.match(select(markup, 'View as'), /<option value="field" selected="">/)
    assert.match(output(markup, 'rate'), />local · 42 ms</, 'Carrier: the field\'s service and the window\'s round trip')
    for (const word of ['oi-shared-field', 'ws://127.0.0.1:3917', 'round trip']) assert.ok(output(markup, 'rate').includes(word), word)
    assert.match(output(markup, 'cpu'), />2 shown</, 'Projected: what your world shows in the field')
    assert.ok(output(markup, 'cpu').includes('1 to the field, 1 at a star'), 'and to whom, in the World\'s words')
  } finally {
    store.publishField({state: 'reading'}); store.publishSystem({state: 'unbound'}); store.chooseFieldView({aperture: 'world', viewAs: 'me'})
  }
})

test('Technē\'s Key turns the cloud on beside Aperture and View as, as Live\'s turns its scale on beside Root and Scale: lit, your World looks as the field (or the public) sees it; pressed again, as you know it; dimmed with the field\'s words while the field is not read (O-I #858 TO04, TO05, r43)', async () => {
  const store = await import('../src/projections/atlas/system/systemStore.ts')
  const model = await import('../src/projections/atlas/system/fieldModel.ts')
  const techne = await import('../src/shell/transports/useTechneTransport.tsx')
  const draw = () => renderToStaticMarkup(h(ModeTransport, {mode: 'techne', reading: {tempoBpm: null, timeSpine: spineAt(), readouts: {}}}))
  const key = markup => markup.match(/<button[^>]*data-slot="key"[^>]*>[^<]*<\/button>/)?.[0] ?? ''
  const press = () => techne.fieldKey(store.fieldView(), undefined).press?.()
  try {
    store.publishField({state: 'unavailable', reason: 'The SharedField is not reachable now.'})
    let markup = draw()
    assert.match(key(markup), /disabled=""/, 'Key stands dimmed while the field is not read')
    assert.ok(key(markup).includes('not reachable now'), 'and says why in the field’s words')
    assert.doesNotMatch(key(markup), /Not wired here yet/, 'never that it is not wired')
    assert.deepEqual(Object.keys(techne.fieldKey(store.fieldView(), 'The SharedField is not reachable now.')), ['refused'], 'refused, it offers no press')
    store.publishField(model.heldFieldOf({world_field: {state: 'held'}, world_scope: 'circle', worlds: [{world_ref: 'world:ab12:Me', body: {body_ref: 'body:me'}, linked: true, mine: true}],
      clearings: [], stars: [], gatherings: []}))
    markup = draw()
    assert.doesNotMatch(key(markup), /disabled=""/, 'Key presses once the field is read')
    assert.match(key(markup), /aria-pressed="false"[^>]*>♯</, 'as you know it: unlit, its face the bar’s own mark')
    assert.match(key(markup), /never what you show/, 'its words say it changes only what you see')
    press()
    assert.equal(store.fieldView().viewAs, 'field', 'pressed: the World looks as the field sees it')
    assert.match(key(draw()), /aria-pressed="true"/, 'and the Key is lit')
    assert.match(key(draw()), /under the one even cloud/, 'saying the cloud lies over what you have not shown')
    assert.match(draw(), /<option value="field" selected="">Field<\/option>/, 'View as beside it reads the same')
    press()
    assert.equal(store.fieldView().viewAs, 'me', 'pressed again: as you know it')
    store.chooseFieldView({viewAs: 'public', aperture: 'shared'})
    assert.match(key(draw()), /aria-pressed="true"/, 'View as chosen beside it lights it too')
    assert.match(key(draw()), /title="Aperture · view as — Shared, looked at as Public: your World as the public sees it/, 'and its words follow both')
    press()
    assert.equal(store.fieldView().viewAs, 'me', 'and from Public it turns the cloud off')
  } finally {
    store.publishField({state: 'reading'}); store.chooseFieldView({aperture: 'world', viewAs: 'me'})
  }
})

test('the bar is the mockup\'s size: a 14px title line over one row of 19–22px controls, 46px in all', async () => {
  const css = await source('styles.css')
  assert.match(css, /--transport-h:46px/)
  assert.match(css, /\.transport \{ margin:0 -6px; padding:2px 10px 5px;/)
  assert.match(css, /\.set-title \{ height:14px; line-height:14px;[^}]*font-size:11px/)
  assert.match(css, /:root\[data-window-chrome="overlay"\] \.set-title \{ padding:0 72px \}/, 'the title line clears the traffic lights on both sides')
  assert.match(css, /\.transport \.surface-icons button \{ width:24px; height:22px \}/)
  assert.doesNotMatch(css, /native-transport-pins/, 'the retired pins strip no longer grows the bar')
  // 2 + 14 + 22 + 5 + 3 = 46: the controls row holds the 22px play row and surface icons.
  const transport = await source('frame/transport/transport.css')
  assert.match(transport, /\.native-control \{ height: 19px;/); assert.match(transport, /\.transport-btn \{ width: 20px; height: 22px/)
})
