// The strings the joiner rule is fuzzed on (be2m; DLW build ruling 2026-11-12): the same ones every run, each a list of code points.
// tests/joiner-rule-be2m.test.mjs runs O-I's rule over them and pins the sha256 of its verdicts; Central's rule gave the same verdicts
// on the same strings (the differential run named there), so a change to either rule's behaviour on any of them moves the pin.
//
// No lone surrogate is made: a Rust string holds none.
const ZWNJ = 0x200c, ZWJ = 0x200d
/** The characters the rule turns on, and neighbours that are none of them. */
export const ALPHABET = [
  ZWNJ, ZWNJ, ZWNJ, ZWJ, ZWJ, ZWJ, ZWJ, 0xfe0f, 0xfe0f, 0xfe0e, 0x1f3fb, 0x1f3fd,
  0x1f468, 0x1f469, 0x1f467, 0x1f466, 0x1f4bb, 0x2764, 0x1f525, 0x1f9d1, 0x26f9, 0x2640, 0x2642, 0x1f3f3, 0x1f308, 0x1faf1, 0x1faf2, 0xa9, 0xae, 0x23, 0x1f1ec, 0x1f02c, 0x1f642, 0x2194,
  0x0645, 0x06cc, 0x062e, 0x0627, 0x0648, 0x064e, 0x07ca, 0x07cb, 0x1820, 0x1821, 0x0710, 0x0712,
  0x0915, 0x0937, 0x094d, 0x093e, 0x093c, 0x09b0, 0x09cd, 0x09af, 0x0d15, 0x0d4d, 0x0dca, 0x0d9a, 0x17d2, 0x1780,
  0x0e01, 0x0e3a, 0x0f40, 0x0f84, 0x1703, 0x1714, 0x1715, 0x1b13, 0x1b44, 0x1b8a, 0x1baa, 0x1bab, 0xabc0, 0xabed, 0xaaf6, 0x11103, 0x11133, 0x11134, 0x1107f, 0x11005,
  0x1000, 0x1004, 0x101b, 0x105a, 0x1019, 0x1039, 0x103a, 0x102c, 0x1040,
  0x2d4e, 0x2d5c, 0x2d7f, 0x2d30,
  0x61, 0x62, 0x20, 0x20, 0x301, 0x2e, 0x31,
  0xad, 0x200b, 0x200e, 0x202e, 0x2066, 0xfeff, 0x2028, 0x2029, 0xe0041, 0x115f, 0x34f, 0x061c, 0x2060, 0x0600,
  0x0a, 0x0d, 0x09, 0x07, 0x85, 0xa0,
]
/** The neighbours every short arrangement around a joiner is made of. */
export const AROUND = [0x1f468, 0x1f469, 0xfe0f, 0x1f3fb, 0x2764, 0x1f525, 0x0645, 0x0627, 0x0915, 0x094d, 0x093e, 0x0e01, 0x0e3a, 0x1004, 0x1000, 0x103a, 0x1039, 0x2d4e, 0x2d7f, 0x61, 0x301, ZWJ, ZWNJ, 0xad]

const mulberry = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
/** Every listed sequence's spellings: the fully qualified form with each subset of its U+FE0F left out. */
export const spellingsOf = sequence => {
  let forms = [[]]
  for (const point of sequence) {
    const without = point === 0xfe0f ? forms.map(form => [...form]) : []
    for (const form of forms) form.push(point)
    forms = forms.concat(without)
  }
  return forms
}
/** The strings, in groups. `sequences` are the listed emoji ZWJ sequences as code points; `cases` the texts of joiner-cases.json;
 * `random` how many random strings to make (the differential run makes more than the suite does). */
export function* fuzzStrings({sequences, cases, random = 40_000, arrangements = true}) {
  for (const text of cases) yield Array.from(text, char => char.codePointAt(0))
  const next = mulberry(0x9e3779b9)
  for (let made = 0; made < random; made++) {
    const length = 1 + Math.floor(next() * 12)
    yield Array.from({length}, () => ALPHABET[Math.floor(next() * ALPHABET.length)])
  }
  // every arrangement of up to two neighbours, a joiner, and up to two neighbours
  if (arrangements) {
    const sides = [[]]
    for (const a of AROUND) { sides.push([a]); for (const b of AROUND) sides.push([a, b]) }
    for (const before of sides) for (const after of sides) for (const joiner of [ZWNJ, ZWJ]) yield [...before, joiner, ...after]
  }
  // every Myanmar letter of the main block and the extensions under the asat, before the stacker and ka, with each joiner
  for (const [from, to] of [[0x1000, 0x109f], [0xa9e0, 0xa9ff], [0xaa60, 0xaa7f], [0x116d0, 0x116e3]])
    for (let point = from; point <= to; point++) for (const joiner of [ZWNJ, ZWJ]) yield [point, 0x103a, joiner, 0x1039, 0x1000]
  // every character from U+0900 to U+11FFF after the one or two before it, then a joiner and that neighbour again: every virama
  // and killer after a letter of its block among them
  for (let point = 0x0900; point <= 0x11fff; point++) {
    if (point >= 0xd800 && point <= 0xe001) continue
    if (point % 3 === 0) yield [point - 1, point, ZWJ, point - 1]
    else if (point % 3 === 1) yield [point - 2, point, ZWNJ, point - 2]
  }
  // every listed sequence in each spelling, and in seven forms that are none
  for (const sequence of sequences) {
    for (const spelling of spellingsOf(sequence)) yield spelling
    yield [...sequence, ZWJ, 0x1f525]; yield [0x1f525, ZWJ, ...sequence]; yield [...sequence, 0xfe0f]; yield [...sequence, 0x1f3fb]; yield [...sequence, 0xfe0e]
    yield sequence.map(point => (point === ZWJ ? ZWNJ : point)); yield sequence.slice(0, -1)
  }
}
/** One string's verdict as a line: what stands in the way (or `-`), whether each joiner is kept, and the shown form, in hexadecimal. */
export const verdictLine = (points, {proseFault, joinerKept, shownProse}) => {
  const text = String.fromCodePoint(...points)
  const kept = points.map((point, at) => (point === ZWNJ || point === ZWJ ? (joinerKept(points, at) ? '1' : '0') : '')).join('')
  return `${proseFault(text) ?? '-'}|${kept}|${Array.from(shownProse(text), char => char.codePointAt(0).toString(16)).join(' ')}`
}
