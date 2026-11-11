/**
 * Plain text: the one set of characters text is read without (be2g, be2i; DLW build ruling 2026-11-09). The candidate's Day device, the
 * field's requests and what the field shows of other people read it through packages/live-shell/ui/src/central/plainParts.ts; the engine's
 * own one-line cleaners (the agent tape, Factory's event map, the commission) read it here. A leaf: it imports nothing.
 *
 * Invisible means it draws nothing. The set is Unicode's own, never kept by hand: every format character (general category Cf: a bidi
 * control or mark, a zero-width character, ZWNJ and ZWJ among them, a soft hyphen, a tag character…), the whole tag block U+E0000–E007F,
 * assigned or not, the line and paragraph separators, and the letters that draw as blank space (the Hangul fillers U+115F, U+1160, U+3164
 * and U+FFA0, the Braille blank U+2800 and the combining grapheme joiner U+034F). The format characters that draw a visible sign are not in
 * it: the prepended concatenation marks U+0600–0605, U+06DD, U+0890, U+0891, U+08E2, U+110BD and U+110CD. Variation selectors are marks
 * (Mn), not in it: they choose how a character is drawn, and an emoji needs them. The controls (Cc) are apart from it.
 *
 * Central derives the same set (ctrl/src/names.rs `invisible`). Each side checks its set, with the controls, against one list,
 * invisible-code-points.txt, the same bytes in both repositories under one sha256 (packages/live-shell/ui/tests/world-field-858.test.mjs,
 * in Node and in the shell's web engines; ctrl day_moves_tests.rs).
 */
const CONTROLS = '\\p{Cc}'
const SEPARATORS = '\\u2028\\u2029'
const FORMATS = '\\p{Cf}'
const TAGS = '\\u{E0000}-\\u{E007F}'
const BLANKS = '\\u034F\\u115F\\u1160\\u2800\\u3164\\uFFA0'
/** The format characters that draw a sign. */
const SIGNS = '\\u0600-\\u0605\\u06DD\\u0890\\u0891\\u08E2\\u{110BD}\\u{110CD}'
const UNSEEN = `(?![${SIGNS}])[${SEPARATORS}${FORMATS}${TAGS}${BLANKS}]`

/** A control character (Cc: U+0000–001F and U+007F–009F), as Rust's `char::is_control` reads it. */
export const CONTROL = new RegExp(`[${CONTROLS}]`, 'u')
/** A line or paragraph separator: in words, it stands as a space. */
export const SEPARATOR = new RegExp(`[${SEPARATORS}]`, 'u')
/** An invisible character: one that draws nothing. */
export const INVISIBLE = new RegExp(UNSEEN, 'u')
/** Not plain text: a control character or an invisible one. */
export const UNPLAIN = new RegExp(`[${CONTROLS}]|${UNSEEN}`, 'u')

const SPACED = new RegExp(`[${CONTROLS}${SEPARATORS}]`, 'gu')
const UNSEEN_ALL = new RegExp(UNSEEN, 'gu')
/** Text as it is shown when someone else wrote it: a control character, or a line or paragraph separator, stands as a space, and every
 * other invisible character is left out (Central's day_moves.rs plain_text_words, before it collapses the spaces). Pure. */
export const plainText = (text: string): string => text.replace(SPACED, ' ').replace(UNSEEN_ALL, '')
/** Text on one line: plain (plainText), each run of space one space, trimmed. Pure. */
export const oneLineText = (text: string): string => plainText(text).replace(/\s+/g, ' ').trim()
const BROKEN = new RegExp(`[${SEPARATORS}]`, 'gu')
const SPACED_IN_BLOCK = /[^\P{Cc}\n\t]/gu
/** Text as it is shown in a block when someone else wrote it (an agent's reply on the tape, be2j ruling 3): its line breaks and tabs kept,
 * a line or paragraph separator standing as a line break, every other control character as a space, and every other invisible character
 * left out, as plainText leaves them out. Pure. */
export const blockText = (text: string): string => text.replace(BROKEN, '\n').replace(SPACED_IN_BLOCK, ' ').replace(UNSEEN_ALL, '')
/** What JSON leaves as it is and would reorder or hide what is drawn: the controls past those JSON escapes (U+007F–009F) and every
 * invisible character. */
const UNESCAPED = new RegExp(`[\\u007f-\\u009f]|${UNSEEN}`, 'gu')
/** Each of those characters written as its escape (`\\uXXXX`, one per UTF-16 unit). Pure. */
const unseenEscaped = (text: string): string => text.replace(UNESCAPED, found =>
  Array.from({length: found.length}, (_, at) => `\\u${found.charCodeAt(at).toString(16).padStart(4, '0')}`).join(''))
/** Text for a raw view (Show raw; be2k rulings 1 and 2): verbatim, with each of those characters written as its escape, so the view is
 * the text as it came and draws as it is. A backslash is doubled first (be2l ruling 8), so text that already reads as an escape is not
 * taken for the character. Pure. */
export const escapedText = (text: string): string => unseenEscaped(text.replace(/\\/g, '\\\\'))
/** A value as JSON for a raw view: JSON.stringify's, which doubles a backslash itself, its unescaped characters of the set escaped. What
 * JSON has no form for (undefined, a function) is its plain string. Pure. */
export const escapedJson = (value: unknown, indent?: number): string => unseenEscaped(JSON.stringify(value, null, indent) ?? String(value))
