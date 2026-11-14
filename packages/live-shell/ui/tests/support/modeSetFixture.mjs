// A mode's Set in the shape the kernel answers `set_subscribe` with (kernel mode_set.rs `ModeSet`, `oi.mode-set/v1`), for the tests that
// draw a Set through the window's one projection (frame/tracks/kernelSet.ts). The Set itself is the kernel's, built from the World
// Model's slices and tested there (mode_set.rs); these name only the parts a test needs, the rest empty as the kernel leaves them.

/** A Set with the parts given and every other part empty. */
export function modeSetOf(parts = {}) {
  return {owner: 'the mode\'s owner', sources: [], rows: [], tracks: [], clips: [], takes: [], mixer: {}, lanes_absent: {}, acts: {}, waiting: {}, ...parts}
}

/** One of the Set's tracks: an Agent session's, a world's or a workcell's, as the kernel names it. */
export function setTrack(id, name, parts = {}) {
  return {id, name, kind: parts.kind ?? 'track', depth: 0, main: false, returns: false, read_only: false, acts: {}, ...parts}
}

/** One of the Set's clips on its track and row. */
export function setClip(id, track, row, label, parts = {}) {
  return {id, track, row, label, acts: {}, ...parts}
}

/** The answer `set_subscribe` gives for a mode's Set at its version. */
export function setAnswerOf(mode, set, version = 1) {
  return {result: 'mode_set', data: {schema: 'oi.mode-set/v1', mode, version, set}}
}
