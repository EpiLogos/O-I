/** What the torus plays now, read off the instrument (DLW §20.14 Frequency driver = Torus; §20.2 Key source). The owner's pitches only:
 * every frequency here is a voice's own `frequency_hz` from the scene owner's influence reading (scene.ts `SceneVoice`), never one the
 * frame makes up. Two sources are read:
 *
 *  - the torus: the voices the instrument was last struck on (controller.ts `struck`), while the field is running. A played note
 *    strikes the voices it names; a determinant event strikes every voice, and so does a touch at a point of the surface (each voice by
 *    its own shape there). Ring-out is not modelled: the owner reports no per-voice
 *    amplitude, so the latest strike stands until the next one.
 *  - the sky: the nine tuned voices, when the instrument was opened at a dated sky (`acting.sky.kind === 'dated'`).
 *
 * Each source that gives nothing says why in words; the engine (src/engine/torusDrive.ts) holds the last drive and says the torus is
 * silent. Pure: no DOM, no timers, no state. */

/** scene_field.rs `voice_mode_ref`: the one spelling of a scene voice's material mode (the resonator, the influence reading and the
 * played strike address all use it). */
export const voiceModeRef = planetRef => `scene:planet/${planetRef}`;

/** The owner's voice at the map's Sun, M2-5-(0/1): the 1:1 of M2-5's scale-degree table (M2-PARASHAKTI P2-F5-SUN). The scene owner names its
 * voices by their map node (`planet_ref`); this is the one that is the torus's root. */
export const ROOT_PLANET_REF = '#2-5-0/1';

/** The torus and sky readings the engine's `setTorusPlay` takes, from the controller's reading (or null when no controller). `root` is the
 * owner's 1:1 for the symbols' voices (symbolVoices.ts): the frequency of its voice at the Sun, absent with its reason when the owner names none. */
export function torusPlayReading(reading) {
  const instrument = reading?.instrument ?? null;
  const acting = instrument?.acting ?? null;
  if (!instrument || !acting) {
    const closed = 'No instrument is open';
    return {torus: {tonesHz: [], silentBecause: closed}, sky: {tonesHz: [], absentBecause: closed}, root: {hz: null, absentBecause: closed}};
  }
  const voices = Array.isArray(acting.voices) ? acting.voices : [];
  const pitchOf = new Map(voices.map(voice => [voiceModeRef(voice.planet_ref), voice.frequency_hz]));
  return {torus: torusReading(reading.status, instrument.struck, pitchOf), sky: skyReading(acting.sky, voices), root: rootReading(voices)};
}

function rootReading(voices) {
  const sun = voices.find(voice => voice.planet_ref === ROOT_PLANET_REF);
  if (!sun) return {hz: null, absentBecause: voices.length ? `The owner names no voice at ${ROOT_PLANET_REF}, the Sun of M2-5 and the 1:1, so the torus's root is not given` : 'The owner names no voices, so the torus has no root'};
  if (typeof sun.frequency_hz !== 'number' || !Number.isFinite(sun.frequency_hz) || sun.frequency_hz <= 0) return {hz: null, absentBecause: `The owner's voice at ${ROOT_PLANET_REF} has no frequency, so the torus's root is not given`};
  return {hz: sun.frequency_hz, absentBecause: null};
}

function torusReading(status, struck, pitchOf) {
  if (status !== 'following') {
    return {tonesHz: [], silentBecause: status === 'held' ? 'The field is held' : status === 'opening' ? 'The instrument is still opening, so the torus is not sounding' : 'The torus is not sounding'};
  }
  if (!struck || !Array.isArray(struck.refs)) return {tonesHz: [], silentBecause: 'The torus has not been struck yet'};
  const tonesHz = struck.refs.map(ref => pitchOf.get(ref)).filter(hz => typeof hz === 'number');
  if (tonesHz.length === 0) return {tonesHz: [], silentBecause: 'None of the voices that were struck are voices of the owner now'};
  return {tonesHz, silentBecause: null};
}

function skyReading(sky, voices) {
  if (sky?.kind !== 'dated') return {tonesHz: [], absentBecause: 'No dated sky is open on the instrument: open it at a dated sky for the sky to give a key'};
  const tonesHz = voices.map(voice => voice.frequency_hz).filter(hz => typeof hz === 'number');
  return tonesHz.length ? {tonesHz, absentBecause: null} : {tonesHz: [], absentBecause: 'The owner names no voices for this sky'};
}
