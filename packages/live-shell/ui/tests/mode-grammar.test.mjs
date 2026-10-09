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
