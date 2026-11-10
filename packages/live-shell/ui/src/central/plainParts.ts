/**
 * What a part shown in the field may carry, in one place (be2g; DLW build ruling 2026-11-09), so the Day device, the field's own requests and
 * the label cleaner can never disagree. A leaf: it imports nothing, so neither of the modules that use it is drawn into the other's chunk.
 *
 * The invisible set is Unicode's own, never kept by hand: every format character (general category Cf: a bidi control or mark, a
 * zero-width character, a soft hyphen, a tag character…), the line and paragraph separators, and the controls (Cc). Variation selectors
 * are marks (Mn), not in it: they choose how a character is drawn, and an emoji needs them. Central derives the same set (ctrl
 * day_moves.rs); each side's test checks its set against tests/fixtures/invisible-code-points.txt, the same list byte for byte in both
 * repos under one sha256.
 */
const CONTROLS = '\\p{Cc}'
const SEPARATORS = '\\u2028\\u2029'
const FORMATS = '\\p{Cf}'

/** A control character (Cc: U+0000–001F and U+007F–009F), as Rust's `char::is_control` reads it. */
export const CONTROL = new RegExp(`[${CONTROLS}]`, 'u')
/** A line or paragraph separator: in words, it stands as a space. */
export const SEPARATOR = new RegExp(`[${SEPARATORS}]`, 'u')
/** An invisible character: a line or paragraph separator, or a format character. */
export const INVISIBLE = new RegExp(`[${SEPARATORS}${FORMATS}]`, 'u')
/** Not plain text: a control character or an invisible one. */
export const UNPLAIN = new RegExp(`[${CONTROLS}${SEPARATORS}${FORMATS}]`, 'u')

/** The prefix of the ids the Day device gives its offers (dayBinding.ts dayEntryCandidates): such a part is never shown as itself, only as
 * the part Central names for it on the person's press (atlasDevices.ts actYours), and the field's own request refuses it (fieldModel.ts
 * yourRequest). */
export const DAY_ENTRY_CANDIDATE = 'day-entry-candidate:'
