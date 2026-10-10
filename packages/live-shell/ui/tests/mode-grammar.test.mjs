import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// The mode grammar is DATA (WORLD-SHELL-DESIGN Rev 5): these tests hold the
// tables to the design and to the inhabitants' own declaration of the same
// Rev-5 rows (inhabitants/sdk/modes.ts), so neither can drift. Production
// sources in memory, same loader pattern as the sibling tests: .ts/.tsx
// transpiled, .css stubbed.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const {MODE_GRAMMAR, SURF_MODES, TRANSPORT_SLOT_IDS, slotMeaning, slotDataI, surfModeOf, detailPairOf} = await import('../src/shell/modeGrammar.ts')
const {SDK_MODE_DECLARATIONS} = await import('../src/inhabitants/sdk/modes.ts')
const {ICON_MARKS} = await import('../src/inhabitants/sdk/icons.ts')

test('the surf carries the five Rev-5 modes in order, each with its icon-cut mark', () => {
  assert.deepEqual([...SURF_MODES], ['live', 'base', 'factory', 'expressions', 'techne'])
  for (const mode of SURF_MODES) {
    const grammar = MODE_GRAMMAR[mode]
    assert.equal(grammar.name, mode)
    assert.ok(Object.hasOwn(ICON_MARKS, grammar.mark), `${mode}'s mark "${grammar.mark}" must be an icon-cut mark`)
    assert.ok(grammar.title.length > 0 && grammar.hint.length > 0)
  }
})

test('the mode marks agree with the inhabitants\' declaration of the same Rev-5 modes', () => {
  for (const declaration of SDK_MODE_DECLARATIONS) {
    assert.equal(MODE_GRAMMAR[declaration.name].mark, declaration.mark, `${declaration.name}'s mark`)
    assert.equal(MODE_GRAMMAR[declaration.name].title, declaration.title)
  }
})

test('every mode keeps the same transport slots in the same places, whole', () => {
  for (const mode of SURF_MODES) {
    const grammar = MODE_GRAMMAR[mode]
    assert.deepEqual(grammar.transport.map(slot => slot.id), [...TRANSPORT_SLOT_IDS],
      `${grammar.title}: the slot order is the fixed shell order`)
    for (const slot of grammar.transport) {
      assert.ok(slot.label.length > 0, `${grammar.title}.${slot.id} has a label`)
      assert.ok(slot.fn.length > 0, `${grammar.title}.${slot.id} has a function`)
      assert.equal(slotDataI(slot), `${slot.label}|${slot.fn}`, 'the data-i string IS the meaning pair')
    }
  }
})

const ROW_OF_SLOT = {
  'link-tap': ['link', 'tap'],
  'tempo-signature': ['tempo', 'signature'],
  'metronome-quantize': ['metro', 'quantize'],
  'key-scale': ['key'],
  'transport': ['play', 'stop', 'record', 'overdub'],
  'arm-capture': ['arm', 're-enable', 'capture'],
  'punch-loop': ['punch-in', 'loop', 'punch-out'],
  'draw-keys': ['draw', 'keys', 'midi-map', 'rate', 'cpu'],
}

test('Rev 5, first table: every mode\'s slot meanings carry the design\'s words', () => {
  // The design's exact meanings, per row, per mode (the Rev-5 table plus the
  // mockups' fuller function lines — asserted by their load-bearing words).
  const WORDS = {
    base: {
      link: ['ground sync'], tap: ['stamp Now', 'document'],
      tempo: ['die face'], signature: ['4 + 2'],
      metro: ['autosave'], quantize: ['save timing'],
      key: ['packet token'],
      play: ['answer', 'packet'], arm: ['write-arm'], capture: ['selection', 'packet'],
      'punch-in': ['08:30'], loop: ['close routine'], 'punch-out': ['21:00'],
      draw: ['highlight pen'], rate: ['carrier'], cpu: ['save state'],
    },
    factory: {
      link: ['peer'], tap: ['ping', 'agent'],
      tempo: ['effort'], signature: ['budget'],
      metro: ['heartbeat'], quantize: ['interrupt'],
      key: ['tokens'],
      play: ['run'], record: ['voice'], overdub: ['steer'],
      arm: ['write arm'], 're-enable': ['hand back'], capture: ['capture'],
      'punch-in': ['write'], loop: ['routine'],
      draw: ['point'], rate: ['tokens/s'], cpu: ['context'],
    },
    expressions: {
      link: ['field sync'], tap: ['tap tempo'],
      tempo: ['field tempo'], signature: ['5 : 3'],
      metro: ['pulse'], quantize: ['scene quantize'],
      key: ['☿'],
      play: ['scene'], record: ['take'], arm: ['studio arm'], capture: ['gestures', 'scene'],
      loop: ['scene loop'],
      draw: ['draw form'], rate: ['fps'], cpu: ['gpu'],
    },
    techne: {
      link: ['field carrier'], tap: ['back to now'],
      tempo: ['walk pace'], signature: ['stop n/8'],
      metro: ['presence'], quantize: ['arrival'],
      key: ['aperture', 'view as'],
      play: ['walk'], record: ['record walk'], overdub: ['extend'],
      arm: ['instrument writes'], capture: ['view', 'scene'],
      'punch-in': ['occasion'], loop: ['occasion'],
      draw: ['place tool'], rate: ['carrier'], cpu: ['projected'],
    },
  }
  for (const [mode, rows] of Object.entries(WORDS)) {
    for (const [slot, words] of Object.entries(rows)) {
      const meaning = slotMeaning(mode, slot)
      for (const word of words) {
        assert.ok(`${meaning.label} ${meaning.fn}`.toLowerCase().includes(word.toLowerCase()),
          `${MODE_GRAMMAR[mode].title}.${slot} ("${meaning.label} — ${meaning.fn}") must carry "${word}"`)
      }
    }
  }
})

test('Rev 5, second table: Session and Arrangement mean what the design says, per mode', () => {
  const EXPECT = {
    live: ['clips and scenes', 'the song over time'],
    base: ['the day as clips', 'today on one ruler'],
    factory: ['sessions and tasks', 'the run viewer'],
    expressions: ['scene rows', 'the scenes over time'],
    techne: ['journey', 'relation field'],
  }
  for (const [mode, [session, arrangement]] of Object.entries(EXPECT)) {
    const grammar = MODE_GRAMMAR[mode]
    assert.ok(grammar.session.meaning.toLowerCase().includes(session.toLowerCase()), `${mode} session: ${grammar.session.meaning}`)
    assert.ok(grammar.arrangement.meaning.toLowerCase().includes(arrangement.toLowerCase()), `${mode} arrangement: ${grammar.arrangement.meaning}`)
  }
})

test('Rev 4: the Clip | Device detail pair per arrangement', () => {
  const EXPECT = {
    live: ['Clip', 'Device'],
    base: ['Document', 'Devices'],
    factory: ['Task log', 'Agent chain'],
    expressions: ['Scene', 'Studio'],
    techne: ['Clip', 'Instruments'],
  }
  for (const [mode, [clip, device]] of Object.entries(EXPECT)) {
    const pair = detailPairOf(mode)
    assert.equal(pair.clip.label, clip, `${mode} clip side`)
    assert.equal(pair.device.label, device, `${mode} device side`)
    assert.ok(pair.clip.meaning.length > 0 && pair.device.meaning.length > 0)
  }
})

test('the spine maps onto the surf; unknown modes light nothing', () => {
  assert.equal(surfModeOf('audio'), 'live')
  assert.equal(surfModeOf('base'), 'base')
  assert.equal(surfModeOf('factory'), 'factory')
  assert.equal(surfModeOf('expressions'), 'expressions')
  assert.equal(surfModeOf('techne'), 'techne')
  assert.equal(surfModeOf('settings'), null)
  assert.equal(surfModeOf('anything'), null)
  assert.equal(detailPairOf('settings'), null)
})

test('the grammar agrees with the inhabitants\' Rev-5 rows (no second table drifting)', () => {
  const ROW_KEYS = Object.keys(ROW_OF_SLOT)
  for (const declaration of SDK_MODE_DECLARATIONS) {
    const grammar = MODE_GRAMMAR[declaration.name]
    for (const row of declaration.rows) {
      assert.ok(ROW_KEYS.includes(row.row), `sdk row "${row.row}" is held by the test's row map`)
      for (const slot of ROW_OF_SLOT[row.row]) {
        const meaning = slotMeaning(declaration.name, slot)
        // The tables agree in substance: some significant word (≥4 letters)
        // of the design's row must surface in the slot's label or function.
        const text = `${meaning.label} ${meaning.fn}`.toLowerCase()
        const tokens = row.meaning.toLowerCase().split(/[^a-z\u00c0-\u024f]+/).filter(word => word.length >= 3)
        // Symbol-only rows (Live's "▶ ■ ● +") carry no words to agree in.
        if (!tokens.length) continue
        // Unit phrases (t/s, kHz) agree as whole phrases, not letter tokens.
        const phrases = row.meaning.toLowerCase().split('·').map(word => word.trim()).filter(word => word.length >= 2)
        const hit = tokens.some(word => text.includes(word)) || phrases.some(word => text.includes(word))
        assert.ok(hit, `${declaration.name}.${slot} ("${meaning.label} — ${meaning.fn}") agrees with the sdk row "${row.row}" ("${row.meaning}")`)
      }
    }
  }
})

test('every waiting state names the mode\'s honesty note', () => {
  for (const mode of SURF_MODES) {
    const grammar = MODE_GRAMMAR[mode]
    assert.ok(grammar.waitingNote.length > 20, `${grammar.title} names what its waiting controls wait for`)
  }
})

// ————————————————————————————————————————————————————————————————————————
// The per-mode frame compositions (browser, centre, status) — the commission's
// tables as data, held to Revision 3's left column, Revision 5's centre
// meanings, and the audit's findings.

test('the browser table: Live and Expressions keep their own browsers; the others declare the design\'s columns', () => {
  // Live keeps the audio pane, Expressions the retained library — the audit
  // holds both correct; the grammar records no categories there.
  assert.deepEqual(MODE_GRAMMAR.live.browser, [], 'live keeps its own browser')
  assert.deepEqual(MODE_GRAMMAR.expressions.browser, [], 'expressions keeps its own browser')
  const byId = mode => Object.fromEntries(MODE_GRAMMAR[mode].browser.map(category => [category.id, category]))
  // Base·Central — the mockup's Base column: Days, Flows, Beings, Things,
  // Goals; Files, Wiki.
  const base = byId('base')
  assert.deepEqual(Object.keys(base), ['central-days', 'central-flows', 'central-beings', 'central-things', 'central-goals', 'central-files', 'central-wiki'])
  assert.deepEqual(base['central-days'].group, 'Central')
  assert.deepEqual(base['central-files'].group, 'Project')
  // Factory — per its manifest: Sessions · Agents · Runs · Knowledge.
  assert.deepEqual(Object.keys(byId('factory')), ['factory-sessions', 'factory-agents', 'factory-runs', 'factory-knowledge'])
  // Technē — to-hand sources · files, then the World groups.
  assert.deepEqual(Object.keys(byId('techne')),
    ['techne-sources', 'techne-files', 'techne-bodies', 'techne-locations', 'techne-places', 'techne-palaces', 'techne-journeys'])
})

test('every browser category carries a cut mark, a hint, an honest state; waiting names its family', () => {
  for (const mode of SURF_MODES) {
    for (const category of MODE_GRAMMAR[mode].browser) {
      assert.ok(Object.hasOwn(ICON_MARKS, category.mark), `${mode}/${category.id}: mark "${category.mark}" is an icon-cut mark`)
      assert.ok(category.hint.length > 20, `${mode}/${category.id} names what its rows are`)
      assert.ok(['cut', 'waiting'].includes(category.state), `${mode}/${category.id} states its admission`)
      assert.ok(category.group.length > 0, `${mode}/${category.id} names its group`)
      if (category.state === 'waiting') {
        assert.ok(category.family, `${mode}/${category.id}: a waiting category names the family whose owner it waits for`)
        assert.ok(!category.hint.includes('Expressions'), `${mode}/${category.id}: a waiting category never offers another mode's content`)
      }
    }
  }
  // The cut categories that name no family compose from the shell's own
  // owners (the ground listing, the works list).
  const base = Object.fromEntries(MODE_GRAMMAR.base.browser.map(category => [category.id, category]))
  assert.equal(base['central-days'].state, 'cut')
  assert.equal(base['central-files'].state, 'cut')
  assert.equal(base['central-wiki'].state, 'waiting')
})

test('the centre compositions per mode × presentation carry the Rev-5 meanings', () => {
  const EXPECT = {
    live: ['clips and scenes', 'the song over time'],
    base: ['day as clips', 'today on one ruler'],
    factory: ['sessions, clips are tasks', 'the runs over time'],
    expressions: ['scene rows', 'the scenes over time'],
    techne: ['walk stops', 'relation field'],
  }
  for (const [mode, [session, arrangement]] of Object.entries(EXPECT)) {
    const centre = MODE_GRAMMAR[mode].centre
    assert.ok(centre.session.meaning.toLowerCase().includes(session.toLowerCase()), `${mode} centre.session: ${centre.session.meaning}`)
    assert.ok(centre.arrangement.meaning.toLowerCase().includes(arrangement.toLowerCase()), `${mode} centre.arrangement: ${centre.arrangement.meaning}`)
    assert.ok(centre.session.label.length > 0 && centre.arrangement.label.length > 0)
  }
})

test('the status identity is per mode and never another mode\'s name', () => {
  const EXPECT = {
    live: 'Live', base: 'Central', factory: 'Factory', expressions: 'Expressions', techne: 'Technē',
  }
  for (const [mode, label] of Object.entries(EXPECT)) {
    const status = MODE_GRAMMAR[mode].status
    assert.equal(status.label, label, `${mode}'s status identity`)
    assert.ok(status.fn.length > 10, `${mode}'s status identity names its field`)
  }
  // The audit's finding, held as law: Base·Central's identity line never
  // says "Expressions".
  const baseIdentity = JSON.stringify([MODE_GRAMMAR.base.status, MODE_GRAMMAR.base.centre])
  assert.ok(!baseIdentity.includes('Expressions'), 'Base·Central\'s status and centre never say "Expressions"')
})
