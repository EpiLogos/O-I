/**
 * What a part shown in the field may carry, in one place (be2g; DLW build ruling 2026-11-09), so the Day device, the field's own requests and
 * the label cleaner can never disagree. It imports only the shared engine's leaf, so neither of the modules that use it is drawn into the
 * other's chunk.
 *
 * The invisible set is the shared engine's (desktop/cradle/src/shared/plainText.ts, be2i), where the engine's own one-line cleaners read it
 * too: invisible means it draws nothing. Unicode's own format characters, minus those that draw a sign, the whole tag block, the line and
 * paragraph separators and the letters that draw as blank space; the controls (Cc) apart. Central derives the same set (ctrl names.rs);
 * each side's test checks its set against tests/fixtures/invisible-code-points.txt, the same list byte for byte in both repos under one
 * sha256.
 *
 * Prose (the words of a Day's field records and entry parts, and a part's label) keeps a joiner in its place (be2m; DLW build ruling
 * 2026-11-10): Central's rule, written once more in the shared engine's joinerRule.ts with the Unicode data it reads. It is read here
 * and not from plainText.ts, so the data loads with the Day's binding and the field's model and never with the first frame.
 */
export {CONTROL, INVISIBLE, NOTHING_VISIBLE, SEPARATOR, UNPLAIN, blockText, oneLineText, plainText, shownOrNothing} from '../../../../../desktop/cradle/src/shared/plainText'
export {JOINER_OUT_OF_PLACE, UNLISTED_EMOJI_SEQUENCE, plainButForKeptJoiners, proseFault, proseText, shownProse} from '../../../../../desktop/cradle/src/shared/joinerRule'

/** The prefix of the ids the Day device gives its offers (dayBinding.ts dayEntryCandidates): such a part is never shown as itself, only as
 * the part Central names for it on the person's press (atlasDevices.ts actYours), and the field's own request refuses it (fieldModel.ts
 * yourRequest). */
export const DAY_ENTRY_CANDIDATE = 'day-entry-candidate:'
