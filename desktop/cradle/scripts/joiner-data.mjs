#!/usr/bin/env node
// joiner-data.mjs EXPORT LIST: writes desktop/cradle/src/shared/joinerData.ts, the Unicode data the joiner rule reads
// (src/shared/joinerRule.ts; be2m, DLW build ruling 2026-11-10 and its follow-ups of 2026-11-12).
//
//   EXPORT  a folder of ICU's property export, one .toml a property, made with no network by
//             icuexportdata -m uprops --all -d EXPORT
//           It reads gc, sc, ccc, jt, InSC, Emoji, ExtPict and EMod, and refuses an export whose files name different
//           Unicode versions.
//   LIST    emoji-zwj-sequences.txt, the list Central keeps (ctrl/src/continuous_work/), copied byte for byte to
//           packages/live-shell/ui/tests/fixtures/. Its lines are carried as they stand; its header's Unicode version must
//           be the export's.
//
// The output is never edited by hand. A test (packages/live-shell/ui/tests/joiner-rule-be2m.test.mjs) holds its sequences
// to the list, and its table to the JavaScript engine for every property the engine has, when the engine is on the same
// Unicode.
import {createHash} from 'node:crypto'
import {readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const [dir, listPath] = process.argv.slice(2)
if (!dir || !listPath) { console.error('joiner-data.mjs EXPORT LIST'); process.exit(2) }
const FILES = ['gc', 'sc', 'ccc', 'jt', 'InSC', 'Emoji', 'ExtPict', 'EMod']
const texts = Object.fromEntries(FILES.map(name => [name, readFileSync(join(dir, `${name}.toml`), 'utf8')]))
const versionOf = (text, key) => text.match(new RegExp(`^${key} = "([^"]+)"`, 'm'))?.[1]
const unicode = versionOf(texts.gc, 'unicode_version'), icu = versionOf(texts.gc, 'icu_version')
for (const name of FILES) if (versionOf(texts[name], 'unicode_version') !== unicode) throw new Error(`${name}.toml is of another Unicode than gc.toml (${unicode})`)

const POINTS = 0x110000
/** An enumerated property: each code point's value, by its short name (or its long name with `long`). */
function enumerated(name, long = false) {
  const names = new Map([...texts[name].matchAll(/\{discr = (\d+), long = "([^"]*)", short = "([^"]*)"/g)].map(([, discr, l, s]) => [Number(discr), long ? l : s]))
  const out = new Array(POINTS).fill(null)
  for (const [, a, b, v] of texts[name].matchAll(/\{a=0x([0-9a-f]+), b=0x([0-9a-f]+), v=(\d+)/g)) {
    const value = names.get(Number(v)) ?? v
    for (let point = parseInt(a, 16); point <= parseInt(b, 16); point++) out[point] = value
  }
  return out
}
/** A binary property: whether each code point is in the set. */
function binary(name) {
  const out = new Uint8Array(POINTS)
  const ranges = texts[name].split('ranges = [')[1].split('\nstrings')[0]
  for (const [, a, b] of ranges.matchAll(/\[0x([0-9a-f]+), 0x([0-9a-f]+)\]/g)) out.fill(1, parseInt(a, 16), parseInt(b, 16) + 1)
  return out
}
const gc = enumerated('gc'), sc = enumerated('sc'), jt = enumerated('jt'), insc = enumerated('InSC', true)
const emoji = binary('Emoji'), pictographic = binary('ExtPict'), modifier = binary('EMod')
// The combining class: each code point's class as its number (the export's discriminant is the class).
const cccNumber = (() => {
  const out = new Uint16Array(POINTS)
  for (const [, a, b, v] of texts.ccc.matchAll(/\{a=0x([0-9a-f]+), b=0x([0-9a-f]+), v=(\d+)/g)) out.fill(Number(v), parseInt(a, 16), parseInt(b, 16) + 1)
  return out
})()

const JOINING = {L: 1, D: 2, R: 3, T: 4}
const SYLLABIC = {Other: 0, Virama: 1, Invisible_Stacker: 2, Vowel_Dependent: 3}
const scripts = []
const scriptAt = name => { let at = scripts.indexOf(name); if (at < 0) at = scripts.push(name) - 1; return at }
scriptAt('Zzzz')
/** One code point's reading, packed: bit 0 a letter (L), 1 a nonspacing mark (Mn), 2-3 the combining class (0 none, 1 the
 * virama class 9, 2 any other), 4-6 Joining_Type (0 U or C, 1 L, 2 D, 3 R, 4 T), 7-9 Indic_Syllabic_Category (0 Other,
 * 1 Virama, 2 Invisible_Stacker, 3 Vowel_Dependent, 4 any other), 10 Emoji_Modifier, 11 Emoji, 12 Extended_Pictographic,
 * from bit 13 the Script's place in SCRIPTS. */
const packed = point => {
  const category = gc[point] ?? 'Cn'
  const klass = cccNumber[point] === 0 ? 0 : cccNumber[point] === 9 ? 1 : 2
  const syllabic = SYLLABIC[insc[point] ?? 'Other'] ?? 4
  return (category.startsWith('L') ? 1 : 0) | (category === 'Mn' ? 2 : 0) | (klass << 2) | ((JOINING[jt[point]] ?? 0) << 4) | (syllabic << 7)
    | (modifier[point] << 10) | (emoji[point] << 11) | (pictographic[point] << 12) | (scriptAt(sc[point] ?? 'Zzzz') << 13)
}
const values = [], starts = [], runs = []
let last = -1, lastStart = 0
for (let point = 0; point < POINTS; point++) {
  const value = packed(point)
  if (value === last) continue
  let at = values.indexOf(value)
  if (at < 0) at = values.push(value) - 1
  starts.push((point - lastStart).toString(36)); runs.push(at.toString(36))
  last = value; lastStart = point
}

const list = readFileSync(listPath, 'utf8')
const listed = list.match(/^# The RGI emoji ZWJ sequences of Unicode (\S+) /)?.[1]
if (listed !== unicode) throw new Error(`the list names Unicode ${listed}, the export Unicode ${unicode}`)
const lines = list.split('\n').filter(line => line && !line.startsWith('#'))
const sha = text => createHash('sha256').update(text).digest('hex')
const wrap = (words, width = 116) => {
  const out = []; let line = ''
  for (const word of words) { if (line && line.length + 1 + word.length > width) { out.push(line); line = word } else line = line ? `${line} ${word}` : word }
  if (line) out.push(line)
  return out
}
const block = (name, doc, words) => `/** ${doc} */\nexport const ${name} = \`\n${wrap(words).join('\n')}\n\`\n`
const out = `// GENERATED by desktop/cradle/scripts/joiner-data.mjs: never edited by hand. Generate it again with that script.
//
// The Unicode data the joiner rule reads (joinerRule.ts), Unicode ${unicode}, from ICU4C ${icu}'s property export
// (icuexportdata -m uprops --all; no network): General_Category, Script, Canonical_Combining_Class, Joining_Type,
// Indic_Syllabic_Category, Emoji, Extended_Pictographic and Emoji_Modifier, and the RGI emoji ZWJ sequences as
// emoji-zwj-sequences.txt lists them (sha256 ${sha(list)}).
// It is the Unicode of the data Central's rule reads (ctrl/src/names.rs, icu_properties). The properties the joiner rule
// itself reads all come from this table, so where a joiner is kept is the same in Node and in the app's web view whatever
// Unicode each is on. What is a control (Cc), what is invisible (Cf) and Bidi_Control are the engine's (plainText.ts).
// It loads with the Day's binding and the field's model, never with the first frame.

/** The Unicode version of everything in this file. */
export const JOINER_DATA_UNICODE = '${unicode}'

${block('SCRIPTS', "Each Script's short name, by its place.", scripts)}
${block('VALUES', `The distinct readings, each packed in base 36: bit 0 a letter (L), 1 a nonspacing mark (Mn), 2-3 the combining class (0 none,
 * 1 the virama class 9, 2 any other), 4-6 Joining_Type (0 U or C, 1 L, 2 D, 3 R, 4 T), 7-9 Indic_Syllabic_Category (0 Other,
 * 1 Virama, 2 Invisible_Stacker, 3 Vowel_Dependent, 4 any other), 10 Emoji_Modifier, 11 Emoji, 12 Extended_Pictographic,
 * from bit 13 the Script's place in SCRIPTS.`, values.map(value => value.toString(36)))}
${block('RUN_STARTS', 'Where each run of code points with one reading starts, as its distance from the start before it, in base 36.', starts)}
${block('RUN_VALUES', "Each run's reading, as its place in VALUES, in base 36.", runs)}
/** The ${lines.length} RGI emoji ZWJ sequences of Unicode ${unicode}, fully qualified, one a line as code points in hexadecimal: the lines of
 * emoji-zwj-sequences.txt under its header, as they stand. */
export const EMOJI_ZWJ_SEQUENCES = \`
${lines.join('\n')}
\`
`
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared', 'joinerData.ts')
writeFileSync(target, out)
console.log(`${target}: Unicode ${unicode} (ICU ${icu}), ${starts.length} runs, ${values.length} readings, ${scripts.length} scripts, ${lines.length} sequences, ${Buffer.byteLength(out)} bytes, sha256 ${sha(out)}`)
