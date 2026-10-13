/** The Jankó note path's strike plan (ticket T-LIVE-JANKO-DEVICE). A key is a pitch class; the owner decides which of its voices sound, from
 * the played reading the native owner supplies (`influence.played_addresses.by_class`, the same reading the Studio's Jankó keys use). This
 * module maps pitch classes to the owner's mode references and never synthesises a voice. A chord with any silent class is refused whole,
 * naming the silent classes: nothing sounds that the owner did not name. */
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** The owner's voices for each pitch class, or a refusal naming why the owner supplies none. */
export function planJankoStrike(played, pitchClasses) {
  if (!Array.isArray(pitchClasses) || pitchClasses.length < 1 || pitchClasses.some(pc => !Number.isInteger(pc) || pc < 0 || pc > 11)) {
    return {refs: [], silent: [], refusal: 'A Jankó note names one to twelve pitch classes, 0–11.'};
  }
  const classes = [...new Set(pitchClasses)].sort((a, b) => a - b);
  if (!played || !Array.isArray(played.by_class)) {
    return {refs: [], silent: classes, refusal: 'The owner\'s played reading carries no Jankó voices (influence.played_addresses), so no key sounds a voice.'};
  }
  const voicesOf = new Map();
  for (const row of played.by_class) {
    if (!row || !Number.isInteger(row.pitch_class) || !Array.isArray(row.voices)) continue;
    const refs = row.voices.map(voice => voice?.mode_ref).filter(ref => typeof ref === 'string' && ref.length > 0);
    if (refs.length) voicesOf.set(row.pitch_class, [...(voicesOf.get(row.pitch_class) ?? []), ...refs]);
  }
  const silent = classes.filter(pc => !voicesOf.has(pc));
  if (silent.length) {
    return {refs: [], silent, refusal: `No voice of this sky sounds at ${silent.map(pc => NAMES[pc]).join(', ')}: the owner names none for ${silent.length === 1 ? 'that note' : 'those notes'}, so the chord is not sent.`};
  }
  const refs = [...new Set(classes.flatMap(pc => voicesOf.get(pc)))];
  return {refs, silent: [], refusal: null};
}
