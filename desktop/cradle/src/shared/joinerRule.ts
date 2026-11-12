/**
 * Words that hold a joiner are kept (be2m, DLW build ruling 2026-11-10; be2m.2 to be2m.5, DLW build rulings 2026-11-12): Central's rule for
 * prose (ctrl/src/names.rs `joiner_kept`, `prose_fault`, `shown_prose`), written once more. Prose is the words of a Day's field records
 * and entry parts, and a part's label; a name, a title or a ref keeps the whole rule (plainText.ts UNPLAIN).
 *
 * A joiner (U+200C, U+200D) that changes how the characters beside it are drawn is part of the words a person sees; one that draws nothing
 * where it stands is refused like any other invisible character. It is in its place:
 * - U+200D inside an emoji ZWJ sequence Unicode lists, in one of its spellings (the fully qualified form, with or without each of its
 *   U+FE0F), that stands whole: no ZWJ right before the stretch, and no ZWJ, U+FE0E, U+FE0F or skin tone right after it;
 * - inside a word of one script that joins or conjoins, in UAX #31's contexts: A1, U+200C between joining letters of one Script
 *   (Joining_Type Left or Dual before it, Right or Dual after it, across Transparent characters); A2, U+200C after a virama that conjoins
 *   and before a letter, across nonspacing marks of a class, the letters and the virama of one Script; B, U+200D after such a virama and
 *   not before a dependent vowel. A virama conjoins when it is of the virama class and Indic_Syllabic_Category calls it Virama or
 *   Invisible_Stacker;
 * - either joiner right after a character of the virama class that Indic_Syllabic_Category gives no category (the Tifinagh consonant
 *   joiner U+2D7F alone), which stands on a letter of its script, and right before another letter of that script;
 * - U+200C right after the Myanmar asat U+103A, which stands on nga, ra or Mon nga, and right before the Myanmar stacker U+1039 and a
 *   Myanmar letter. The three letters rest on a drawing on a Mac and on no property (Central's `KINZI_LETTERS`).
 *
 * The two rules are held to one by the same data: every property is read from joinerData.ts (Unicode's, generated, never the engine's),
 * the listed sequences are the lines of emoji-zwj-sequences.txt, and every row of joiner-cases.json, the same bytes as Central's under
 * one sha256, is run through this rule (packages/live-shell/ui/tests/joiner-rule-be2m.test.mjs). What is invisible and what is a control
 * are plainText.ts's, as before.
 *
 * This module carries the data, so it loads with the Day's binding and the field's model (central/plainParts.ts), never with the first
 * frame: plainText.ts does not import it.
 */
import {EMOJI_ZWJ_SEQUENCES, JOINER_DATA_UNICODE, RUN_STARTS, RUN_VALUES, VALUES} from './joinerData'
import {CONTROL, INVISIBLE} from './plainText'

const ZWNJ = 0x200c, ZWJ = 0x200d, TEXT_SELECTOR = 0xfe0e, EMOJI_SELECTOR = 0xfe0f
/** The Myanmar asat and stacker, and the letters under whose asat a ZWNJ before a stacker changes what is drawn (nga, ra, Mon nga). */
const MYANMAR_ASAT = 0x103a, MYANMAR_STACKER = 0x1039, KINZI_LETTERS: readonly number[] = [0x1004, 0x101b, 0x105a]

/** What a refused joiner is called, and a ZWJ refused between two emoji (Central's words, by the list's own Unicode version). */
export const JOINER_OUT_OF_PLACE = 'a joiner outside an emoji or a joined word'
export const UNLISTED_EMOJI_SEQUENCE = `a joiner between emoji that Unicode ${JOINER_DATA_UNICODE} does not list as one emoji`

const words = (block: string): string[] => block.split(/\s+/).filter(Boolean)
let table: {readonly starts: Uint32Array; readonly values: Uint32Array} | null = null
/** One code point's reading (joinerData.ts VALUES says what each bit is). */
function reading(point: number): number {
  if (!table) {
    const distinct = words(VALUES).map(value => parseInt(value, 36))
    const starts = Uint32Array.from(words(RUN_STARTS), start => parseInt(start, 36))
    for (let at = 1; at < starts.length; at++) starts[at] = starts[at]! + starts[at - 1]!
    table = {starts, values: Uint32Array.from(words(RUN_VALUES), value => distinct[parseInt(value, 36)]!)}
  }
  let low = 0, high = table.starts.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (table.starts[middle]! <= point) low = middle
    else high = middle - 1
  }
  return table.values[low]!
}
const letter = (point: number): boolean => (reading(point) & 1) !== 0
const mark = (point: number): boolean => (reading(point) & 2) !== 0
/** 0 no combining class, 1 the virama class, 2 any other. */
const klass = (point: number): number => (reading(point) >> 2) & 3
/** 0 Non_Joining or Join_Causing, 1 Left, 2 Dual, 3 Right, 4 Transparent. */
const joining = (point: number): number => (reading(point) >> 4) & 7
/** 0 Other, 1 Virama, 2 Invisible_Stacker, 3 Vowel_Dependent, 4 any other category. */
const syllabic = (point: number): number => (reading(point) >> 7) & 7
const tone = (point: number): boolean => ((reading(point) >> 10) & 1) !== 0
const emoji = (point: number): boolean => ((reading(point) >> 11) & 3) === 3
const script = (point: number): number => reading(point) >> 13
const reorderedMark = (point: number): boolean => mark(point) && klass(point) !== 0
const conjoins = (point: number): boolean => klass(point) === 1 && (syllabic(point) === 1 || syllabic(point) === 2)

let listed: {readonly spellings: ReadonlySet<string>; readonly longest: number} | null = null
/** Every spelling of every listed emoji ZWJ sequence (the fully qualified form, and that form with any of its U+FE0F left out), and the
 * length of the longest in code points. */
function listedEmoji(): {readonly spellings: ReadonlySet<string>; readonly longest: number} {
  if (listed) return listed
  const spellings = new Set<string>()
  let longest = 0
  for (const line of EMOJI_ZWJ_SEQUENCES.split('\n')) {
    if (!line) continue
    let forms: number[][] = [[]]
    for (const point of line.split(' ').map(hex => parseInt(hex, 16))) {
      const without = point === EMOJI_SELECTOR ? forms.map(form => [...form]) : []
      for (const form of forms) form.push(point)
      forms = forms.concat(without)
    }
    for (const form of forms) { spellings.add(form.join(' ')); longest = Math.max(longest, form.length) }
  }
  return (listed = {spellings, longest})
}

/** Whether the joiner at `at` is part of the words a person sees (Central's `joiner_kept`, line for line). `points` are the text's code
 * points. */
export function joinerKept(points: readonly number[], at: number): boolean {
  const joiner = points[at]
  if (joiner !== ZWNJ && joiner !== ZWJ) return false
  const count = points.length
  /** The letter the mark at `sign` stands on, across nonspacing marks: a letter of the mark's own script, or -1. */
  const standsOn = (sign: number): number => {
    let on = sign - 1
    while (on >= 0 && mark(points[on]!)) on--
    return on >= 0 && letter(points[on]!) && script(points[on]!) === script(points[sign]!) ? points[on]! : -1
  }
  // Inside a listed emoji sequence that stands whole.
  if (joiner === ZWJ) {
    const {spellings, longest} = listedEmoji()
    for (let from = Math.max(0, at - longest); from < at; from++) {
      if (from > 0 && points[from - 1] === ZWJ) continue
      for (let to = at + 2; to <= Math.min(count, from + longest); to++) {
        const next = points[to]
        if (next !== undefined && (next === ZWJ || next === TEXT_SELECTOR || next === EMOJI_SELECTOR || tone(next))) continue
        if (spellings.has(points.slice(from, to).join(' '))) return true
      }
    }
  }
  // A1: between joining letters of one script.
  if (joiner === ZWNJ) {
    let left = at - 1, right = at + 1
    while (left >= 0 && joining(points[left]!) === 4) left--
    while (right < count && joining(points[right]!) === 4) right++
    if (left >= 0 && right < count && (joining(points[left]!) === 1 || joining(points[left]!) === 2)
      && (joining(points[right]!) === 3 || joining(points[right]!) === 2) && script(points[left]!) === script(points[right]!)) return true
  }
  // Right after a sign that stands on a letter of its script, in two places of their own.
  if (at >= 1) {
    const sign = points[at - 1]!, on = standsOn(at - 1)
    if (on >= 0) {
      const letterAt = (next: number): boolean => next < count && letter(points[next]!) && script(points[next]!) === script(sign)
      // A virama the syllabic categories do not reach (the Tifinagh consonant joiner), before a letter.
      if (klass(sign) === 1 && syllabic(sign) === 0 && letterAt(at + 1)) return true
      // ZWNJ between the asat on nga, ra or Mon nga and the stacker of a letter.
      if (joiner === ZWNJ && sign === MYANMAR_ASAT && KINZI_LETTERS.includes(on) && points[at + 1] === MYANMAR_STACKER && letterAt(at + 2)) return true
    }
  }
  // After a virama that conjoins: `L M* V M1*` ends where the joiner stands, and the letter is of the virama's script. A virama is
  // itself a mark of its own class, so each one met on the way back may be the V.
  let carrier = -1
  for (let index = at - 1; index >= 0; index--) {
    if (conjoins(points[index]!)) {
      carrier = standsOn(index)
      if (carrier >= 0) break
    }
    if (!reorderedMark(points[index]!)) break
  }
  if (carrier < 0) return false
  if (joiner === ZWNJ) {
    // A2: a letter of the same script follows, across marks of a class.
    let next = at + 1
    while (next < count && reorderedMark(points[next]!)) next++
    return next < count && letter(points[next]!) && script(points[next]!) === script(carrier)
  }
  // B: no dependent vowel follows.
  return at + 1 >= count || syllabic(points[at + 1]!) !== 3
}

const BIDI_CONTROL = /\p{Bidi_Control}/u
const BLANKS: readonly number[] = [0x034f, 0x115f, 0x1160, 0x2800, 0x3164, 0xffa0]
/** What the invisible character at `at` is, in a person's terms (Central's `invisible_kind`). */
function invisibleKind(points: readonly number[], at: number): string {
  const point = points[at]!
  if (point === 0x2028 || point === 0x2029) return 'a line or paragraph separator'
  if (point === 0x00ad) return 'a soft hyphen'
  if (point === 0xfeff) return 'a byte order mark'
  if (point === 0x200b) return 'a zero-width space'
  if (point === ZWJ) {
    let before = at - 1
    while (before >= 0 && (points[before] === EMOJI_SELECTOR || tone(points[before]!))) before--
    if (before >= 0 && emoji(points[before]!) && at + 1 < points.length && emoji(points[at + 1]!)) return UNLISTED_EMOJI_SEQUENCE
  }
  if (point === ZWNJ || point === ZWJ) return JOINER_OUT_OF_PLACE
  if (point >= 0xe0000 && point <= 0xe007f) return 'a tag character'
  if (BLANKS.includes(point)) return 'a blank filler'
  if (BIDI_CONTROL.test(String.fromCodePoint(point))) return 'a bidi control or mark'
  return 'a format character that draws nothing'
}
/** What stands in the way of keeping the character at `at` in prose, or null when it reads as it is (Central's `prose_fault_at`). */
function proseFaultAt(points: readonly number[], at: number): string | null {
  const point = points[at]!
  if (point === 0x0a || point === 0x09) return null
  if (point === 0x0d) return points[at + 1] === 0x0a ? null : 'a carriage return with no line break after it'
  const char = String.fromCodePoint(point)
  if (CONTROL.test(char)) return 'a control character'
  return INVISIBLE.test(char) && !joinerKept(points, at) ? invisibleKind(points, at) : null
}
const pointsOf = (text: string): number[] => Array.from(text, char => char.codePointAt(0)!)
const textOf = (points: readonly number[]): string => { let text = ''; for (const point of points) text += String.fromCodePoint(point); return text }

/** What stands in the way of keeping prose as it is given, named by its kind, or null when it reads as it is (Central's `prose_fault`):
 * the first control character but a line break or a tab (a `\r` only before a `\n`), or invisible character that is not a joiner in its
 * place. Pure. */
export function proseFault(text: string): string | null {
  const points = pointsOf(text)
  for (let at = 0; at < points.length; at++) { const fault = proseFaultAt(points, at); if (fault) return fault }
  return null
}
/** What is left of `points` when every character in the way is taken out, read again until nothing more goes: a control character or a
 * separator in the way stands as a space (`spaced`), any other is left out; `trimmed` cuts the white space Rust counts from both ends on
 * each reading. */
function left(points: number[], trimmed: boolean): number[] {
  for (;;) {
    let out: number[] = []
    for (let at = 0; at < points.length; at++) {
      const point = points[at]!
      if (proseFaultAt(points, at) === null) out.push(point)
      else if (point === 0x2028 || point === 0x2029 || CONTROL.test(String.fromCodePoint(point))) out.push(0x20)
    }
    if (trimmed) {
      let from = 0, to = out.length
      while (from < to && RUST_SPACE.test(String.fromCodePoint(out[from]!))) from++
      while (to > from && RUST_SPACE.test(String.fromCodePoint(out[to - 1]!))) to--
      out = out.slice(from, to)
    }
    if (out.length === points.length && out.every((point, at) => point === points[at])) return out
    points = out
  }
}
/** Rust's White_Space (`char::is_whitespace`), as `str::trim` cuts it. */
const RUST_SPACE = /[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/
/** Prose as it is shown (Central's `shown_prose`): without the characters that stand in the way of keeping it and without the white
 * space at either end, so a joiner in its place stays. What is left holds nothing the rule refuses, and showing it again changes
 * nothing. Pure. */
export const shownProse = (text: string): string => textOf(left(pointsOf(text), true))
const SPACED = /[\p{Cc}\u2028\u2029]/gu
/** Prose as it is shown when someone else wrote it: plainText.ts's plainText (a control character or a line or paragraph separator as a
 * space, every other invisible character left out) but for a joiner in its place, which stays; a joiner whose partner went with what
 * was left out goes too. A text that holds no joiner reads exactly as plainText reads it. Pure. */
export const proseText = (text: string): string => textOf(left(pointsOf(text.replace(SPACED, ' ')), false))
/** Whether text holds nothing the plain rule refuses but joiners in their place: a part's label may (be2m; Central's label of an entry
 * read as a part keeps them). Pure. */
export const plainButForKeptJoiners = (text: string): boolean => {
  const points = pointsOf(text)
  return points.every((point, at) => {
    const char = String.fromCodePoint(point)
    return !CONTROL.test(char) && (!INVISIBLE.test(char) || joinerKept(points, at))
  })
}
/** One code point's reading, for the test that holds the table to the engine (joinerData.ts VALUES says what each bit is). */
export const joinerReading = (point: number): number => reading(point)
