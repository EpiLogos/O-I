// be2m, O-I's half (DLW build ruling 2026-11-10 and its follow-ups of 2026-11-12): words that hold a joiner are kept. O-I's rule
// (desktop/cradle/src/shared/joinerRule.ts) is Central's (ctrl/src/names.rs), written once more, and is held to it here by the same data:
// the two files Central keeps, byte for byte under one sha256 each, every row of the cases run through O-I's rule, the data the rule
// reads held to the list and to the engine, and the verdicts on 823,216 strings pinned to what Central's rule gave on the same strings.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) return r
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out};
}`)}`, import.meta.url)

const rule = await import('../../../../desktop/cradle/src/shared/joinerRule.ts')
const data = await import('../../../../desktop/cradle/src/shared/joinerData.ts')
const plain = await import('../../../../desktop/cradle/src/shared/plainText.ts')
const parts = await import('../src/central/plainParts.ts')
const bind = await import('../src/central/devices/dayBinding.ts')
const {fuzzStrings, verdictLine} = await import('./joiner-fuzz-strings.mjs')

/** The two files Central keeps (ctrl/src/continuous_work/joiner-cases.json and emoji-zwj-sequences.txt), the same bytes here: a file
 * that moves on one side without the other's sha256 changing fails here or there (be2m item 5; Central pins the same two digests in
 * day_moves_tests.rs and names.rs). */
const JOINER_CASES_SHA256 = '4a79efda78eb645605cab6de61e50683e18e7bb34d184fd66d47d33ea280f506'
const EMOJI_ZWJ_SEQUENCES_SHA256 = '3466f7002716b502b61957afbb751af85aee3bd379b577004c96f14d47dc151b'
/** The sha256 of O-I's verdicts on the fuzz strings, one line a string (joiner-fuzz-strings.mjs verdictLine). Central's rule gave the
 * same lines on the same strings (the differential run of 12 Nov 2026: Central main after be2m.5, `prose_fault`, `joiner_kept` and
 * `shown_prose` on each string, compared byte for byte), so this pin holds O-I's rule to Central's on every one of them. */
const VERDICTS_SHA256 = '1a23f6c252f3f1b095f38e03710613390a161fd5fde81eefc72e93ffda2d1756'
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const casesBytes = await readFile(new URL('./fixtures/joiner-cases.json', import.meta.url))
const listBytes = await readFile(new URL('./fixtures/emoji-zwj-sequences.txt', import.meta.url))
const cases = JSON.parse(casesBytes.toString('utf8'))
const list = listBytes.toString('utf8')
const sequences = list.split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split(' ').map(hex => parseInt(hex, 16)))
const oneLine = text => text.split(/\s+/).filter(Boolean).join(' ')
const hex = text => Array.from(text, char => char.codePointAt(0).toString(16)).join(' ')

test('be2m item 5: the cases and the emoji sequence list are Central\'s bytes, each under one sha256, never converted on checkout', async () => {
  assert.equal(sha256(casesBytes), JOINER_CASES_SHA256, 'joiner-cases.json')
  assert.equal(sha256(listBytes), EMOJI_ZWJ_SEQUENCES_SHA256, 'emoji-zwj-sequences.txt')
  assert.equal(cases.length, 112)
  assert.equal(sequences.length, 1614)
  const attributes = await readFile(new URL('../../../../.gitattributes', import.meta.url), 'utf8')
  for (const file of ['joiner-cases.json', 'emoji-zwj-sequences.txt']) assert.ok(attributes.split('\n').includes(`packages/live-shell/ui/tests/fixtures/${file} -text`), `${file} is kept as bytes`)
})

test('be2m item 6: every row of the cases reads through O-I\'s rule as Central reads it: kept or refused, what stood in the way, and the shown form', () => {
  const kinds = new Set()
  for (const row of cases) {
    const fault = rule.proseFault(row.text)
    assert.equal(fault, row.kind ?? null, `${row.name}: what stands in the way`)
    assert.equal(fault === null, row.kept, `${row.name}: kept`)
    const shown = rule.shownProse(row.text)
    assert.equal(hex(oneLine(shown)), hex(row.shown), `${row.name}: the shown form`)
    assert.equal(rule.proseFault(shown), null, `${row.name}: the shown form holds nothing the rule refuses`)
    assert.equal(rule.shownProse(shown), shown, `${row.name}: shown again, it is the same`)
    assert.equal(hex(oneLine(rule.proseText(row.text))), hex(row.shown), `${row.name}: as other people's prose is shown`)
    if (!/[\p{Cc}]/u.test(row.text)) assert.equal(rule.plainButForKeptJoiners(row.text), row.kept, `${row.name}: a label holds it`)
    if (/[\u{200c}\u{200d}]/u.test(row.text)) assert.ok(plain.UNPLAIN.test(row.text), `${row.name}: a name refuses it`)
    if (row.kind) kinds.add(row.kind)
  }
  assert.deepEqual([...kinds].sort(), ['a bidi control or mark', 'a blank filler', 'a byte order mark', 'a carriage return with no line break after it', 'a control character',
    'a format character that draws nothing', 'a joiner between emoji that Unicode 17.0 does not list as one emoji', 'a joiner outside an emoji or a joined word',
    'a line or paragraph separator', 'a soft hyphen', 'a tag character', 'a zero-width space'], 'one case at least for each kind')
  assert.equal(rule.UNLISTED_EMOJI_SEQUENCE, 'a joiner between emoji that Unicode 17.0 does not list as one emoji')
  assert.equal(rule.JOINER_OUT_OF_PLACE, 'a joiner outside an emoji or a joined word')
  for (const name of ['proseFault', 'proseText', 'shownProse', 'plainButForKeptJoiners']) assert.equal(parts[name], rule[name], `plainParts.ts hands on ${name}`)
})

test('be2m item 2: the data the rule reads is the list\'s and Unicode\'s, generated: the sequences are the list\'s lines and the table names the list\'s Unicode', () => {
  assert.equal(data.EMOJI_ZWJ_SEQUENCES, `\n${list.split('\n').filter(line => line && !line.startsWith('#')).join('\n')}\n`, 'the sequences are the list\'s lines as they stand')
  const listed = list.match(/^# The RGI emoji ZWJ sequences of Unicode (\S+) /)[1]
  assert.equal(data.JOINER_DATA_UNICODE, listed, 'the table and the list are of one Unicode')
  assert.ok(rule.UNLISTED_EMOJI_SEQUENCE.includes(`Unicode ${listed} does not list`), 'and the refusal names it')
  // what no JavaScript engine tells: the combining class, Joining_Type and Indic_Syllabic_Category, by what Central's tests hold
  const bits = point => { const value = rule.joinerReading(point); return {klass: (value >> 2) & 3, joining: (value >> 4) & 7, syllabic: (value >> 7) & 7} }
  const viramas = []
  for (let point = 0; point < 0x110000; point++) if (bits(point).klass === 1) viramas.push(point)
  assert.equal(viramas.length, 69, 'the characters of the virama class')
  assert.equal(viramas.filter(point => [1, 2].includes(bits(point).syllabic)).length, 41, 'those that conjoin: Virama or Invisible_Stacker')
  assert.deepEqual(viramas.filter(point => bits(point).syllabic === 0), [0x2d7f], 'the one the syllabic categories do not reach: the Tifinagh consonant joiner')
  assert.deepEqual([0x094d, 0x1039, 0x103a, 0x0e3a, 0x093e, 0x0915].map(point => bits(point).syllabic), [1, 2, 4, 4, 3, 4], 'a virama, a stacker, two killers, a dependent vowel, a consonant')
  assert.deepEqual([0x0645, 0x0627, 0x064e, 0x0061, 0x200d, 0xa872, 0x07ca].map(point => bits(point).joining), [2, 3, 4, 0, 0, 1, 2], 'Dual, Right, Transparent, none, Join_Causing, Left, Dual')
  assert.deepEqual([0x0301, 0x093c, 0x094d, 0x0915].map(point => bits(point).klass), [2, 2, 1, 0], 'a mark of a class, a nukta, a virama, a letter')
})

test('be2m item 2: where the JavaScript engine has a property the rule reads, the table says what the engine says for every code point', t => {
  if (process.versions.unicode !== data.JOINER_DATA_UNICODE) {
    t.skip(`this Node is on Unicode ${process.versions.unicode} and the table on ${data.JOINER_DATA_UNICODE}: the engine is not compared (the rule reads the table alone, so it is the same rule here)`)
    return
  }
  const scripts = data.SCRIPTS.split(/\s+/).filter(Boolean)
  const engine = {letter: /\p{L}/u, mark: /\p{Mn}/u, tone: /\p{Emoji_Modifier}/u, emoji: /\p{Emoji}/u, pictographic: /\p{Extended_Pictographic}/u}
  const ofScript = scripts.map(name => new RegExp(`\\p{Script=${name}}`, 'u'))
  const off = []
  for (let point = 0; point < 0x110000 && off.length < 5; point++) {
    if (point >= 0xd800 && point <= 0xdfff) continue
    const value = rule.joinerReading(point), char = String.fromCodePoint(point)
    const read = {letter: (value & 1) !== 0, mark: (value & 2) !== 0, tone: ((value >> 10) & 1) !== 0, emoji: ((value >> 11) & 1) !== 0, pictographic: ((value >> 12) & 1) !== 0}
    for (const [name, pattern] of Object.entries(engine)) if (pattern.test(char) !== read[name]) off.push(`U+${point.toString(16)} ${name}`)
    if (!ofScript[value >> 13].test(char)) off.push(`U+${point.toString(16)} Script ${scripts[value >> 13]}`)
  }
  assert.deepEqual(off, [], 'no code point reads otherwise')
  assert.equal(scripts.length, 175, 'every Script of this Unicode, Unknown among them')
})

test('be2m: the fuzz. O-I\'s rule on the strings Central\'s rule was run on gives the same verdicts, and what is shown holds nothing refused', () => {
  const digest = createHash('sha256')
  let strings = 0, kept = 0, refused = 0
  const tally = {}
  for (const points of fuzzStrings({sequences, cases: cases.map(row => row.text)})) {
    const line = verdictLine(points, rule)
    digest.update(`${line}\n`); strings++
    const [fault, flags] = line.split('|')
    for (const flag of flags) flag === '1' ? kept++ : refused++
    tally[fault] = (tally[fault] ?? 0) + 1
    const text = String.fromCodePoint(...points), shown = rule.shownProse(text)
    // the invariants a second writing is not needed for
    if (rule.proseFault(shown) !== null || rule.shownProse(shown) !== shown) assert.fail(`the shown form of ${hex(text)} holds something refused, or changes when shown again`)
    if (fault === '-') {
      if (shown !== text.trim()) assert.fail(`${hex(text)} is kept and shown otherwise than as given, trimmed`)
      const first = points[0], last = points.at(-1)
      if (first === 0x200c || first === 0x200d || last === 0x200c) assert.fail(`${hex(text)} is kept with a joiner first or a ZWNJ last`)
      if (points.some((point, at) => (point === 0x200c || point === 0x200d) && (points[at + 1] === 0x200c || points[at + 1] === 0x200d))) assert.fail(`${hex(text)} is kept with two joiners side by side`)
    }
    if (!flags) {
      // a text with no joiner is judged as before any joiner was kept, and shown as plain text is
      const before = !/\r(?!\n)/.test(text) && !Array.from(text).some(char => (plain.CONTROL.test(char) && !'\n\r\t'.includes(char)) || plain.INVISIBLE.test(char))
      if ((fault === '-') !== before) assert.fail(`${hex(text)} holds no joiner and is judged otherwise than before`)
      if (rule.proseText(text) !== plain.plainText(text)) assert.fail(`${hex(text)} holds no joiner and is shown otherwise than plain text`)
    }
  }
  console.log(`[joiner-fuzz] ${strings} strings; joiners kept ${kept}, refused ${refused}; kept texts ${tally['-']}`)
  assert.equal(strings, 823_216)
  assert.ok(kept > 5000 && refused > 500_000, 'both verdicts are reached')
  assert.equal(digest.digest('hex'), VERDICTS_SHA256, 'the verdicts are the ones Central\'s rule gave on these strings')
})

test('be2m item 4: an entry of the Day offered as a part is labelled with a joiner in its place: each case\'s text, as an item of a list, is offered under its shown form', () => {
  const fields = [{id: 'p1_must', label: 'Must', template_pointer: '/fields/p1_must'}]
  const items = cases.map((row, at) => ({id: `j${at}`, text: row.text}))
  const offers = bind.dayEntryCandidates(fields, {fields: {p1_must: items}})
  const byId = new Map(offers.map(offer => [offer.id, offer.label]))
  for (const [at, row] of cases.entries()) {
    const label = byId.get(`${bind.DAY_ENTRY_CANDIDATE}p1_must@j${at}`) ?? ''
    assert.equal(hex(label), hex(row.shown), `${row.name}: Central's label of the entry read as a part, once it keeps a joiner`)
  }
  assert.equal(cases.filter(row => /[\u{200c}\u{200d}]/u.test(row.shown)).length, 44, 'the cases shown with a joiner in its place')
})
