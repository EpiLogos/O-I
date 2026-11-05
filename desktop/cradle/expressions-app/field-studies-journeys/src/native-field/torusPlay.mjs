/** What the torus plays now, read off the instrument (DLW §20.14 Frequency driver = Torus; §20.2 Key source). The owner's pitches only:
 * every frequency here is a voice's own `frequency_hz` from the scene owner's influence reading (scene.ts `SceneVoice`), or a note's
 * voice's own from the owner's bank in its frame (QL-MEF #287), never one the frame makes up. Two sources are read:
 *
 *  - the torus: the voices sounding now, while the field is running. The native frame carries each voice's amplitude (the torus
 *    object's reading, controller.ts `torus_object`, O-I 851): a voice sounds while it rings above a thousandth of the strike, so a
 *    chord rings out as the body does, each note's voices at their own pitches (torusObject.ts soundingOf). An owner whose frames give no amplitudes is read as before: the voices the instrument was last
 *    struck on (controller.ts `struck`), the latest strike standing until the next one.
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
    return {torus: {tonesHz: [], silentBecause: closed}, sky: {tonesHz: [], absentBecause: closed}, root: {hz: null, absentBecause: closed}, body: null, pulse: null,
      classes: {absentBecause: closed}, material: {absentBecause: closed}};
  }
  const voices = Array.isArray(acting.voices) ? acting.voices : [];
  // Each voice by the owner's own mode ref (a Logic or Maqām voice names no planet, O-I #850), else its planet's.
  const pitchOf = new Map(voices.map(voice => [voice.mode_ref || voiceModeRef(voice.planet_ref), voice.frequency_hz]));
  const amplitudes = Array.isArray(instrument.torus_object?.amplitudes) ? instrument.torus_object.amplitudes : null;
  const strike = instrument.influence?.material?.strike_metres;
  const sounding = Array.isArray(instrument.torus_object?.sounding_hz) ? instrument.torus_object.sounding_hz : null;
  return {torus: sounding ? pitchesReading(reading.status, sounding, pitchOf) : amplitudes ? soundingReading(reading.status, amplitudes, pitchOf, strike) : torusReading(reading.status, instrument.struck, pitchOf),
    sky: skyReading(acting.sky, voices), root: rootReading(voices),
    // The body the plate reads its eight and four from (torusDrive.ts rolesOf), and the pulse that rings it.
    body: {influence: instrument.influence ?? null, amplitudes},
    pulse: pulseReading(instrument.torus),
    // Where each of the twelve classes stands on the body and what it sounds: the symbols' own harmonies (symbolHarmony.ts).
    classes: classesReading(reading.status, instrument.torus),
    // The surface's material the lens in force gives it (O-I 854): the engine lays it on the marks (src/engine/surfaceMaterial.ts).
    material: materialReading(instrument.torus)};
}

/** The surface's material in the owner's Torus reading (QL scene_field.rs `lens_material_of`, m2_material.rs MATERIAL_LAW): the lens in
 * force at its position, its partner, a colour and four magnitudes, each 0..1, as given. */
function materialReading(torus) {
  const m = torus?.material;
  if (!m || typeof m !== 'object') return {absentBecause: "The owner's Torus reading names no material, so the surface keeps the scene's own"};
  if (typeof m.absent === 'string') return {absentBecause: `The owner gives no material: ${m.absent}`};
  const share = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  const colour = Array.isArray(m.colour_rgb) && m.colour_rgb.length === 3 ? m.colour_rgb : null;
  if (typeof m.lens !== 'string' || typeof m.partner !== 'string' || !colour || ![...colour, m.roughness, m.elasticity, m.particle_affinity, m.tension].every(share)
    || (m.valence !== 1 && m.valence !== -1) || !Number.isInteger(m.position)) {
    return {absentBecause: "The owner's material is not a lens's surface (a colour and four magnitudes, each 0..1), so the surface keeps the scene's own"};
  }
  return {lens: m.lens, partner: m.partner, face: m.face === 'night' ? 'night' : 'day', position: m.position, valence: m.valence, colour_rgb: [...colour],
    roughness: m.roughness, elasticity: m.elasticity, particle_affinity: m.particle_affinity, tension: m.tension,
    standing: typeof m.standing === 'string' ? m.standing : null, absentBecause: null};
}

/** The twelve classes of the owner's Torus reading (QL scene_field.rs `class_sounds`, CLASS_SOUNDS_LAW): each at the one place of its helix,
 * its point on the body at the reading's steps, and what it sounds of each voice of the tuning in force. The pulse carries the points on
 * between reads at the owner's rate while the field follows it, and holds them while it is held. */
function classesReading(status, torus) {
  const classes = torus?.classes;
  if (!classes || typeof classes !== 'object') return {absentBecause: "The owner's Torus reading names no classes, so no symbol has a harmony of its own yet"};
  if (typeof classes.absent === 'string') return {absentBecause: `The owner gives no classes: ${classes.absent}`};
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const rows = (Array.isArray(classes.by_class) ? classes.by_class : []).map(row => ({
    pitch_class: row?.pitch_class, pitch_name: typeof row?.pitch_name === 'string' ? row.pitch_name : String(row?.pitch_class),
    place_arc: row?.place?.arc ?? row?.point?.place?.arc, phi: row?.point?.phi, theta: row?.point?.theta,
    sounds: (Array.isArray(row?.sounds) ? row.sounds : []).filter(sound => typeof sound?.mode_ref === 'string' && finite(sound.frequency_hz) && finite(sound.coupling))
      .map(sound => ({mode_ref: sound.mode_ref, frequency_hz: sound.frequency_hz, coupling: sound.coupling})),
  }));
  if (rows.length !== 12 || !finite(classes.steps) || !rows.every((row, c) => row.pitch_class === c && [row.place_arc, row.phi, row.theta].every(finite))) {
    return {absentBecause: "The owner's classes are not the twelve, each with its place and its point, so no symbol has a harmony of its own"};
  }
  const rate = status === 'following' && finite(torus.steps_per_second) ? torus.steps_per_second : 0;
  return {tuning: typeof classes.tuning === 'string' ? classes.tuning : null, steps: classes.steps, steps_per_second: rate, by_class: rows, absentBecause: null};
}

/** A voice sounds while its amplitude rings above this share of the strike (torusObject.ts voicePoints lets go at the same level). */
export const SOUNDING_SHARE = 1e-3;

function soundingReading(status, amplitudes, pitchOf, strike) {
  if (status !== 'following') return torusReading(status, null, pitchOf);
  const full = typeof strike === 'number' && strike > 0 ? strike : 0.08;
  const tonesHz = amplitudes.filter(a => Math.hypot(a.re, a.im) / full >= SOUNDING_SHARE).map(a => pitchOf.get(a.mode_ref)).filter(hz => typeof hz === 'number');
  return tonesHz.length ? {tonesHz, silentBecause: null} : {tonesHz: [], silentBecause: 'The torus has rung down: no voice sounds now'};
}

/** The pitches the object reads sounding now (torusObject.ts soundingOf: the bank's notes at their own, QL-MEF #287). */
function pitchesReading(status, sounding, pitchOf) {
  if (status !== 'following') return torusReading(status, null, pitchOf);
  const tonesHz = sounding.filter(hz => typeof hz === 'number' && Number.isFinite(hz) && hz > 0);
  return tonesHz.length ? {tonesHz, silentBecause: null} : {tonesHz: [], silentBecause: 'The torus has rung down: no voice sounds now'};
}

function pulseReading(torus) {
  const steps = torus?.pulse?.steps, sps = torus?.steps_per_second;
  if (typeof steps !== 'number' || typeof sps !== 'number') return null;
  return {steps, steps_per_second: sps, band: torus.band ?? null};
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
