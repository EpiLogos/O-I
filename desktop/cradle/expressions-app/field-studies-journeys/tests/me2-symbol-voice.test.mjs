// ME2 (DLW §20.2 Field): "A symbol can carry a voice: a name or a mode from M2′'s store of sound (§22.1). The voice carries part of the torus's
// sound to where the symbol stands. It does not sound on its own." Owner, 20 Oct: "a symbol's voice is a name or mode carrying the torus's
// sound, never its own oscillator". What is proved here:
//
//   - the voice's shape {enabled, carry, gain, attack, release}, and that the oscillator's four fields are refused in words (the kernel says the
//     same: kernel/tests/expression_scene.rs);
//   - a voice written for an oscillator is migrated, with a receipt naming each field it dropped, and carries nothing until someone chooses;
//   - a voice with no carry is silent and says why; Symbol voices Off silences every voice without touching a symbol's block;
//   - a mode's bands come from the catalogue's row and the owner's root, with widths from the mode itself;
//   - a name the store gives no sound for is absent with the store's reason, and a mode is never put in its place;
//   - the graph: bands on the controller's tap, one bank per mode, an envelope and a place per symbol, and no oscillator anywhere;
//   - the sound, rendered offline in a real browser (Chromium and WebKit): a band carries energy at its degree and not between degrees, a silent
//     torus makes a silent voice, a voice's place follows its symbol's x.
//
//   node --test desktop/cradle/expressions-app/field-studies-journeys/tests/me2-symbol-voice.test.mjs
//
// The sources are TypeScript: they are bundled with the app's own esbuild into a temporary directory (as me1-torus-drive.test.mjs does). The
// browsers are Playwright's (desktop/cradle/node_modules); a browser that cannot start fails the test, it is never skipped.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, readFileSync, readdirSync, rmSync, statSync} from 'node:fs';
import {loadavg, tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const {chromium, webkit} = await import('playwright');
// The tree under test: this one, unless a run is pointed at another copy of the sources (the red run against the sources before ME2).
const journeys = process.env.ME2_JOURNEYS ?? fileURLToPath(new URL('..', import.meta.url));
const native = join(journeys, 'src/native-field');
const out = mkdtempSync(join(tmpdir(), 'me2-voice-'));
after(() => rmSync(out, {recursive: true, force: true}));
const cache = new Map();
const bundle = (entry, name) => {
  if (!cache.has(name)) cache.set(name, (async () => {
    const outfile = join(out, `${name}.mjs`);
    await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
      loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
    return import(pathToFileURL(outfile).href);
  })());
  return cache.get(name);
};
const sound = () => bundle(join(native, 'entitySound.ts'), 'sound');
const catalogue = () => bundle(join(native, 'modeCatalogue.ts'), 'catalogue');
const voices = () => bundle(join(native, 'symbolVoices.ts'), 'voices');
const store = () => bundle(join(native, 'modeStore.ts'), 'store');
const model = () => bundle(join(journeys, 'src/model.ts'), 'model');
const camera = () => bundle(join(journeys, 'src/camera.ts'), 'camera');
const controls = () => bundle(join(journeys, 'src/soundControls.ts'), 'controls');
const play = () => import(pathToFileURL(join(native, 'torusPlay.mjs')).href);
const fixtureJson = JSON.parse(readFileSync(new URL('./fixtures/ql-music-modes-trimmed.json', import.meta.url), 'utf8'));
const parsed = async () => { const {parseModeCatalogue} = await catalogue(); const result = parseModeCatalogue(structuredClone(fixtureJson)); assert.ok(result.ok, result.refusal); return result.catalogue; };

const near = (actual, expected, tolerance, what) => assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);
const ROOT = 130.81279;
const SUN = '#2-5-0/1';

// ── the voice's shape ───────────────────────────────────────────────────────

test('the voice is {enabled, carry, gain, attack, release}, and the oscillator\'s four fields are refused in words, one by one', async () => {
  const {validateEntitySound, SOUND_FIELDS, REMOVED_SOUND_FIELDS, DEFAULT_ENTITY_SOUND} = await sound();
  assert.deepEqual([...SOUND_FIELDS], ['enabled', 'carry', 'gain', 'attack', 'release']);
  assert.deepEqual([...REMOVED_SOUND_FIELDS], ['frequencyHz', 'followCymatic', 'waveform', 'pan']);
  assert.deepEqual(DEFAULT_ENTITY_SOUND, {enabled: false, gain: 0.2, attack: 0.08, release: 0.8});
  assert.equal(validateEntitySound(undefined), undefined);
  const full = {enabled: true, carry: {kind: 'mode', ref: "chromatic/L0'/aeolian"}, gain: 0.3, attack: 0.05, release: 1.5};
  assert.deepEqual(validateEntitySound(full), full);
  assert.deepEqual(validateEntitySound({enabled: false, carry: {kind: 'name', ref: 'shem'}}), {enabled: false, carry: {kind: 'name', ref: 'shem'}});
  const words = {
    frequencyHz: /frequencyHz was removed: a symbol's voice carries the torus's sound and has no pitch of its own/,
    followCymatic: /followCymatic was removed: a symbol's voice carries the torus's sound and does not follow a plate/,
    waveform: /waveform was removed: a symbol's voice has no oscillator/,
    pan: /pan was removed: a symbol's voice stands where its symbol stands/,
  };
  for (const [field, value] of [['frequencyHz', 330], ['followCymatic', false], ['waveform', 'sine'], ['pan', 0.5]]) {
    assert.throws(() => validateEntitySound({enabled: true, [field]: value}), words[field], field);
  }
  for (const bad of [{enabled: 'yes'}, {gain: 0.2}, {enabled: true, gain: 1.01}, {enabled: true, attack: -1}, {enabled: true, release: 31}, {enabled: true, detune: 3},
    {enabled: true, carry: {kind: 'oscillator', ref: 'x'}}, {enabled: true, carry: {kind: 'mode'}}, {enabled: true, carry: {kind: 'mode', ref: ''}}, {enabled: true, carry: {kind: 'mode', ref: 'x', hz: 3}},
    {enabled: true, carry: 'maqam/00'}, null, []]) {
    assert.throws(() => validateEntitySound(bad), /Invalid entity sound/, JSON.stringify(bad));
  }
});

// ── the migration ───────────────────────────────────────────────────────────

const OLD = {enabled: true, followCymatic: false, frequencyHz: 330, gain: 0.3, waveform: 'triangle', attack: 0.12, release: 1.1, pan: -0.2};

test('a voice written for an oscillator is migrated: four fields dropped and named, the rest kept, no carry made up', async () => {
  const {migrateEntitySound, NO_CARRY} = await sound();
  const {sound: after, migration} = migrateEntitySound(OLD);
  console.log('voice BEFORE migration:', JSON.stringify(OLD));
  console.log('voice AFTER migration: ', JSON.stringify(after));
  console.log('receipt:', JSON.stringify(migration));
  assert.deepEqual(after, {enabled: true, gain: 0.3, attack: 0.12, release: 1.1});
  assert.equal('carry' in after, false, 'no mode is made up from an old frequency');
  assert.deepEqual(migration.dropped.map(d => d.field), ['frequencyHz', 'followCymatic', 'waveform', 'pan']);
  assert.deepEqual(migration.dropped.map(d => d.was), [330, false, 'triangle', -0.2], 'the receipt keeps what each field held');
  assert.equal(migration.silenced, true, 'it was sounding and is silent now');
  assert.ok(migration.words.includes('frequencyHz, followCymatic, waveform, pan') && migration.words.includes(NO_CARRY), migration.words);
  // A voice that was off is not newly silenced; a voice already in the new shape migrates to itself with no receipt.
  assert.equal(migrateEntitySound({...OLD, enabled: false}).migration.silenced, false);
  const fresh = {enabled: true, carry: {kind: 'mode', ref: 'maqam/00'}, gain: 0.2};
  assert.deepEqual(migrateEntitySound(fresh), {sound: fresh, migration: null});
  assert.deepEqual(migrateEntitySound(undefined), {sound: undefined, migration: null});
  // A carry already there survives; a field that is neither old nor new is refused, never silently dropped.
  assert.deepEqual(migrateEntitySound({...fresh, pan: 0.3}).sound, fresh);
  assert.throws(() => migrateEntitySound({...OLD, detune: 1}), /unsupported field detune/);
  assert.throws(() => migrateEntitySound({...OLD, gain: 4}), /gain must sit inside/);
});

test('opening a journey migrates its voices, in the working scenes and the saved ones, with a receipt on the journey; a second opening adds none', async () => {
  const {blankJourney, validateJourney, entity, clone} = await model();
  const journey = blankJourney();
  const scene = journey.scenes[0];
  const a = entity('Root', 'O'), b = entity('Crown', 'O');
  a.sound = {...OLD}; b.sound = {enabled: true, carry: {kind: 'mode', ref: 'maqam/01'}, gain: 0.25};
  scene.entities = [a, b];
  journey.savedScenes = {[scene.id]: clone(scene)};
  journey.savedScenes[scene.id].entities[0].sound = {...OLD, frequencyHz: 440, pan: 0.5};
  const opened = validateJourney(JSON.parse(JSON.stringify(journey)));
  assert.deepEqual(opened.scenes[0].entities[0].sound, {enabled: true, gain: 0.3, attack: 0.12, release: 1.1});
  assert.deepEqual(opened.scenes[0].entities[1].sound, {enabled: true, carry: {kind: 'mode', ref: 'maqam/01'}, gain: 0.25}, 'a voice that carries something is untouched');
  assert.deepEqual(opened.savedScenes[scene.id].entities[0].sound, {enabled: true, gain: 0.3, attack: 0.12, release: 1.1});
  assert.equal(opened.soundMigration.length, 2, 'one receipt for the working voice and one for the saved one');
  const [working, saved] = opened.soundMigration;
  assert.deepEqual([working.scene, working.entity, working.saved], [scene.id, a.id, undefined]);
  assert.deepEqual([saved.scene, saved.entity, saved.saved], [scene.id, a.id, true]);
  assert.deepEqual(saved.dropped.map(d => d.was), [440, false, 'triangle', 0.5]);
  const again = validateJourney(JSON.parse(JSON.stringify(opened)));
  assert.deepEqual(again.soundMigration, opened.soundMigration, 'a second opening adds no receipt');
  assert.deepEqual(again.scenes, opened.scenes);
  assert.equal('soundMigration' in validateJourney(JSON.parse(JSON.stringify(blankJourney()))), false, 'a journey with nothing to migrate carries no receipt');
  for (const bad of [{...OLD, detune: 1}, {enabled: 'yes'}]) { const j = clone(journey); j.scenes[0].entities[0].sound = bad; assert.throws(() => validateJourney(j), /Invalid entity sound/); }
});

// ── the plan: what sounds, and why a voice does not ─────────────────────────

test('a voice with no carry is silent and says why; Symbol voices Off silences every voice and leaves every block as it was', async () => {
  const {entitySoundPlan, NO_CARRY, VOICES_OFF} = await sound();
  assert.equal(NO_CARRY, 'This voice has no name or mode yet: choose one on the Sound page');
  const carry = {kind: 'mode', ref: "chromatic/L0'/aeolian"};
  const entities = [
    {id: 'a', sound: {enabled: true, carry, gain: 0.4}},
    {id: 'b', sound: {enabled: true}},
    {id: 'c', sound: {enabled: true, carry}, enabled: false},
    {id: 'd', sound: {enabled: false, carry}},
    {id: 'e'},
  ];
  const plan = entitySoundPlan({entities});
  assert.deepEqual(plan.voices.map(v => v.entityId), ['a']);
  assert.deepEqual(plan.voices[0], {entityId: 'a', carry, gain: 0.4, attack: 0.08, release: 0.8}, 'the defaults of an omitted field are the voice\'s own');
  assert.deepEqual(plan.silent, [{entityId: 'b', because: NO_CARRY}], 'a symbol that is not present, or whose voice is off, is not a silent voice: it has none to speak of');
  assert.deepEqual(entitySoundPlan({entities}, new Set(['b'])).voices, [], 'an active set narrows the plan (travelling focus)');
  const blocks = JSON.stringify(entities);
  for (const composition of [{symbolVoices: false}, {symbolVoices: true}, {}]) {
    const off = entitySoundPlan({entities, composition}).voices.length === 0;
    assert.equal(off, composition.symbolVoices === false, JSON.stringify(composition));
  }
  const silenced = entitySoundPlan({entities, composition: {symbolVoices: false}});
  assert.deepEqual(silenced.voices, []);
  assert.deepEqual(silenced.silent.map(s => [s.entityId, s.because]), [['a', VOICES_OFF], ['b', VOICES_OFF]]);
  assert.equal(JSON.stringify(entities), blocks, 'Off changes no symbol\'s block');
});

test('Symbol voices is an optional On or Off in the scene\'s composition: absent reads On, anything else is refused', async () => {
  const {blankJourney, validateJourney} = await model();
  const withVoices = value => { const j = JSON.parse(JSON.stringify(blankJourney())); if (value !== undefined) j.scenes[0].composition.symbolVoices = value; return j; };
  for (const value of [undefined, true, false]) assert.doesNotThrow(() => validateJourney(withVoices(value)), String(value));
  assert.equal('symbolVoices' in validateJourney(withVoices(undefined)).scenes[0].composition, false, 'a new scene writes no switch: absent is On');
  assert.equal(validateJourney(withVoices(false)).scenes[0].composition.symbolVoices, false);
  for (const bad of ['on', 1, null, {on: true}]) assert.throws(() => validateJourney(withVoices(bad)), /Invalid composition/, JSON.stringify(bad));
});

// ── the owner's catalogue, and the bands it gives ───────────────────────────

test('the catalogue: the owner\'s rows are read as they are stated, and a reading that is not the owner\'s is refused by name', async () => {
  const {parseModeCatalogue} = await catalogue();
  const cat = await parsed();
  assert.deepEqual([...cat.modes.keys()], ["chromatic/L0'/aeolian", "fifths/L0'/aeolian", "chromatic/L0'/dorian", 'maqam/00', 'maqam/01']);
  const aeolian = cat.modes.get("chromatic/L0'/aeolian");
  assert.equal(aeolian.label, "aeolian on L0', chromatic basis");
  assert.equal(aeolian.group, "L0' on the chromatic basis");
  const semitones = [0, 2, 3, 5, 7, 8, 10];
  aeolian.ratios.forEach((ratio, i) => near(ratio, 2 ** (semitones[i] / 12), 1e-12, `aeolian degree ${i}`));
  assert.match(aeolian.tuning, /semitone steps \(2 1 2 2 1 2 2\) at twelve to the octave; the catalogue states no other tuning for a lens mode/);
  const maqam = cat.modes.get('maqam/01');
  [0, 150, 350, 500, 650, 850, 1000].forEach((cents, i) => near(maqam.ratios[i], 2 ** (cents / 1200), 1e-12, `maqam/01 degree ${i}`));
  assert.equal(maqam.ratios.length, 7, 'the octave (1200) is the next octave\'s root, not a degree');
  assert.match(maqam.tuning, /cents from the root \(0 150 350 500 650 850 1000 1200\), exact/);
  assert.deepEqual([...cat.absent.keys()], ['shem', 'ficino-planetary']);
  assert.equal(cat.absent.get('shem').status, 'absent');
  assert.match(cat.absent.get('shem').reason, /Register72::Shem is a register of 72 names on an 8 by 9 choir grid/);
  const refusal = mutate => { const doc = structuredClone(fixtureJson); mutate(doc); const r = parseModeCatalogue(doc); assert.equal(r.ok, false); return r.refusal; };
  assert.match(refusal(d => { d.schema = 'ql.music-modes/v2'; }), /not a ql\.music-modes\/v1 reading/);
  assert.match(refusal(d => { d.lens_cf[0].steps_semitones[0] = 3; }), /does not follow steps_semitones|does not sum/);
  assert.match(refusal(d => { d.lens_cf[0].tuning = {num: 1, den: 1}; }), /lens row states no tuning/);
  assert.match(refusal(d => { d.source_scales[0].cents_from_root[3] = 100; }), /does not rise from 0 to the octave/);
  assert.match(refusal(d => { d.source_scales[0].quarter_tones_from_root[2] = 9; }), /does not follow quarter_tone_steps/);
  assert.match(refusal(d => { d.source_scales[1].key = 'maqam/00'; }), /duplicate key maqam\/00/);
  assert.match(refusal(d => { delete d.sources_absent[0].reason; }), /sources_absent\[0\]\.reason is not a non-empty string/);
  assert.equal(parseModeCatalogue(null).ok, false);
});

test('the bands: a degree in every audible octave, each as wide as half its nearer neighbour is distant, centred on the catalogue\'s degrees over the owner\'s root', async () => {
  const {bandPlan, AUDIBLE_HZ} = await voices();
  const cat = await parsed();
  const aeolian = cat.modes.get("chromatic/L0'/aeolian");
  const bands = bandPlan(aeolian.ratios, ROOT, 48000);
  assert.deepEqual([AUDIBLE_HZ.low, AUDIBLE_HZ.high], [20, 20000]);
  assert.ok(bands.length > 50 && bands.length < 80, `seven degrees over about ten octaves: ${bands.length} bands`);
  for (const band of bands) {
    assert.ok(band.centreHz >= 20 && band.centreHz < 20000, `${band.centreHz} Hz is audible`);
    near(band.centreHz / (ROOT * 2 ** band.octave * aeolian.ratios[band.degree]), 1, 1e-12, `band ${band.octave}/${band.degree}`);
  }
  for (let i = 1; i < bands.length; i++) assert.ok(bands[i].centreHz > bands[i - 1].centreHz, 'ascending');
  // No audible degree is missing: count them by brute force.
  let expected = 0; for (let o = -10; o <= 20; o++) for (const r of aeolian.ratios) { const hz = ROOT * 2 ** o * r; if (hz >= 20 && hz < 20000) expected++; }
  assert.equal(bands.length, expected);
  // The width comes from the mode: half the distance to the nearer neighbouring degree.
  bands.forEach((band, i) => {
    const below = i > 0 ? band.centreHz - bands[i - 1].centreHz : Infinity, above = i < bands.length - 1 ? bands[i + 1].centreHz - band.centreHz : Infinity;
    near(band.widthHz, Math.min(below, above) / 2, 1e-9, `width at ${band.centreHz.toFixed(2)} Hz`);
    near(band.q, band.centreHz / band.widthHz, 1e-9, 'q is centre over width');
  });
  // The root stands alone: it is the owner's 1:1. Move the root and every band moves with it.
  const moved = bandPlan(aeolian.ratios, ROOT * 1.5, 48000);
  const rootBand = moved.find(b => b.degree === 0 && b.octave === 0);
  near(rootBand.centreHz, ROOT * 1.5, 1e-9, 'the root is the owner\'s');
  // A mode with quarter tones has its own spacing, and its widths follow it: the same rule, read off the maqam's own cents (0 150 350 500 650 850 1000).
  const maqamMode = cat.modes.get('maqam/01'), maqam = bandPlan(maqamMode.ratios, ROOT, 48000);
  const at = (list, degree) => list.find(b => b.octave === 0 && b.degree === degree);
  near(at(maqam, 1).centreHz, ROOT * 2 ** (150 / 1200), 1e-9, 'maqam/01 degree 1 sits 150 cents above the root');
  near(at(maqam, 1).widthHz, Math.min(ROOT * 2 ** (150 / 1200) - ROOT, ROOT * 2 ** (350 / 1200) - ROOT * 2 ** (150 / 1200)) / 2, 1e-9, 'half the nearer neighbour (the root, 150 cents under)');
  assert.notEqual(at(maqam, 1).widthHz, at(bands, 1).widthHz, 'two modes, two spacings, two widths');
  maqam.forEach((band, i) => {
    const below = i > 0 ? band.centreHz - maqam[i - 1].centreHz : Infinity, above = i < maqam.length - 1 ? maqam[i + 1].centreHz - band.centreHz : Infinity;
    near(band.widthHz, Math.min(below, above) / 2, 1e-9, `maqam width at ${band.centreHz.toFixed(2)} Hz`);
  });
  // Nothing is made up when there is no root or no degree.
  assert.deepEqual(bandPlan(aeolian.ratios, 0, 48000), []);
  assert.deepEqual(bandPlan([], ROOT, 48000), []);
  assert.deepEqual(bandPlan(aeolian.ratios, Number.NaN, 48000), []);
  // A band stands below the device's Nyquist: at 32 kHz nothing above 16 kHz is made.
  assert.ok(Math.max(...bandPlan(aeolian.ratios, ROOT, 32000).map(b => b.centreHz)) < 16000);
});

test('a carry is resolved against the store: a mode to its bands, a name to the store\'s own reason, and a mode is never put in a name\'s place', async () => {
  const {resolveCarry} = await voices();
  const cat = await parsed();
  const root = {hz: ROOT, absentBecause: null};
  const mode = resolveCarry({kind: 'mode', ref: 'maqam/00'}, cat, null, root, 48000);
  assert.equal(mode.state, 'carrying');
  assert.equal(mode.mode.key, 'maqam/00'); assert.equal(mode.rootHz, ROOT); assert.ok(mode.bands.length > 50);
  assert.match(mode.tuning, /cents from the root/);
  const name = resolveCarry({kind: 'name', ref: 'shem'}, cat, null, root, 48000);
  assert.equal(name.state, 'absent');
  assert.equal(name.because, `shem (absent): ${cat.absent.get('shem').reason}`, 'the store\'s own status and reason, verbatim');
  assert.match(resolveCarry({kind: 'name', ref: 'ficino-planetary'}, cat, null, root, 48000).because, /^ficino-planetary \(needs owner authoring\): QL-MEF holds no authored planetary scale/);
  assert.match(resolveCarry({kind: 'name', ref: 'asma-ul-husna'}, cat, null, root, 48000).because, /^The store names no "asma-ul-husna"/);
  // The name 'maqam/00' is a mode's key, and a name voice asking for it is not given the mode.
  assert.equal(resolveCarry({kind: 'name', ref: 'maqam/00'}, cat, null, root, 48000).state, 'absent');
  assert.match(resolveCarry({kind: 'mode', ref: 'shem'}, cat, null, root, 48000).because, /^The mode catalogue has no mode "shem"/);
  assert.match(resolveCarry({kind: 'mode', ref: 'maqam/99'}, cat, null, root, 48000).because, /has no mode "maqam\/99"/);
  assert.match(resolveCarry({kind: 'mode', ref: 'maqam/00'}, cat, null, {hz: null, absentBecause: 'No instrument is open'}, 48000).because, /^No instrument is open/);
  assert.equal(resolveCarry({kind: 'mode', ref: 'maqam/00'}, null, 'The mode catalogue is being read from the kernel', root, 48000).because, 'The mode catalogue is being read from the kernel');
  assert.match(resolveCarry({kind: 'mode', ref: 'maqam/00'}, null, null, root, 48000).because, /not been read yet/);
});

test('the owner\'s 1:1 is read off the instrument, from the voice the owner names at the Sun, and is absent with its reason when the owner names none', async () => {
  const {torusPlayReading, ROOT_PLANET_REF} = await play();
  assert.equal(ROOT_PLANET_REF, SUN);
  const voice = (planet_ref, frequency_hz) => ({index: 0, planet_ref, longitude_degrees: 0, frequency_hz, m: 1, n: 1, helix: 'x', ql_position: 1, weight: 1, phase_radians: 0});
  const open = voices => ({status: 'following', instrument: {acting: {sky: {kind: 'none'}, voices}, struck: null}});
  assert.deepEqual(torusPlayReading(open([voice('#2-5-2', 147.2), voice(SUN, 130.8), voice('#2-5-3', 163.5)])).root, {hz: 130.8, absentBecause: null}, 'the Sun voice, wherever the owner lists it');
  const none = torusPlayReading(open([voice('#2-5-2', 147.2)])).root;
  assert.equal(none.hz, null); assert.match(none.absentBecause, /names no voice at #2-5-0\/1, the Sun of M2-5 and the 1:1/);
  assert.match(torusPlayReading(open([])).root.absentBecause, /names no voices/);
  assert.match(torusPlayReading(open([voice(SUN, 0)])).root.absentBecause, /has no frequency/);
  assert.deepEqual(torusPlayReading(null).root, {hz: null, absentBecause: 'No instrument is open'});
  assert.deepEqual(torusPlayReading({status: 'manual', instrument: null}).root, {hz: null, absentBecause: 'No instrument is open'});
});

test('a voice stands where its symbol stands: the place is the symbol\'s x on the stage, in half the stage\'s width', async () => {
  const {placeOf} = await voices();
  const {project, defaultCamera} = await camera();
  assert.equal(placeOf(500, 1000), 0); assert.equal(placeOf(0, 1000), -1); assert.equal(placeOf(1000, 1000), 1);
  assert.equal(placeOf(250, 1000), -0.5); assert.equal(placeOf(750, 1000), 0.5);
  assert.equal(placeOf(-300, 1000), -1, 'off the stage to the left is the left'); assert.equal(placeOf(2000, 1000), 1);
  assert.equal(placeOf(Number.NaN, 1000), 0); assert.equal(placeOf(10, 0), 0);
  // Through the stage's own projection: moving a symbol right moves its voice right, and the stage's middle is not at x = 0.
  const cam = defaultCamera(), w = 1200, h = 800;
  const places = [-0.9, -0.5, 0, 0.5, 0.9].map(x => placeOf(project({x, y: 0, z: 0}, cam, w, h).x, w));
  for (let i = 1; i < places.length; i++) assert.ok(places[i] > places[i - 1], `x rises, the place rises: ${places}`);
  assert.ok(places[0] < -0.3 && places[4] > 0.3, `${places}`);
  near(placeOf(project({x: 0, y: 0, z: 0}, cam, w, h).x, w), 0.02, 0.001, 'the stage centres its middle at 51 % of its width (camera.ts stageCentre), so x = 0 is just right of the middle');
});

// ── the graph, wired (a recording context) ──────────────────────────────────

/** An audio context that records its nodes and their edges; createOscillator throws, so a voice that calls it fails the test. */
function recording() {
  const nodes = [], calls = [];
  const param = value => ({value, events: [], setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]); }, setTargetAtTime(v, t) { this.value = v; this.events.push(['target', v, t]); },
    linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]); }, cancelScheduledValues(t) { this.events.push(['cancel', t]); }});
  const node = (kind, extra = {}) => {
    const n = {kind, out: new Set(), connect(target) { this.out.add(target); return target; }, disconnect(target) { if (target === undefined) this.out.clear(); else this.out.delete(target); }, ...extra};
    nodes.push(n); return n;
  };
  const context = {sampleRate: 48000, currentTime: 0, destination: {kind: 'destination', out: new Set()},
    createGain: () => node('gain', {gain: param(1)}),
    createBiquadFilter: () => node('biquad', {type: 'lowpass', frequency: param(350), Q: param(1)}),
    createStereoPanner: () => node('panner', {pan: param(0)}),
    createOscillator() { calls.push('createOscillator'); throw new Error('a symbol\'s voice has no oscillator'); },
    createBufferSource() { calls.push('createBufferSource'); throw new Error('a symbol\'s voice makes no source'); }};
  return {context, nodes, calls, of: kind => nodes.filter(n => n.kind === kind)};
}
const inputs = async (over = {}) => {
  const {entitySoundPlan} = await sound();
  const cat = await parsed();
  const entities = over.entities ?? [{id: 'a', sound: {enabled: true, carry: {kind: 'mode', ref: "chromatic/L0'/aeolian"}, gain: 0.4, attack: 0.5, release: 2}}];
  return {plan: entitySoundPlan({entities, composition: over.composition}), catalogue: cat, catalogueWhy: null, root: {hz: ROOT, absentBecause: null}, torusSilentBecause: null,
    places: new Map(entities.map((e, i) => [e.id, over.places?.[i] ?? 0])), muted: false, ...over.inputs};
};
const deferred = () => { const waiting = []; return {waiting, defer: (run, ms) => { const entry = {run, ms}; waiting.push(entry); return () => { const at = waiting.indexOf(entry); if (at >= 0) waiting.splice(at, 1); }; }, settle: () => { while (waiting.length) waiting.shift().run(); }}; };

test('the graph: the bands stand on the controller\'s tap, each symbol has an envelope and a place, and no oscillator is made', async () => {
  const {SymbolVoices, bandPlan} = await voices();
  const r = recording(), tap = {context: r.context, input: {kind: 'tap', out: new Set(), connect(t) { this.out.add(t); return t; }, disconnect(t) { if (t === undefined) this.out.clear(); else this.out.delete(t); }}};
  const bank = new SymbolVoices();
  const input = await inputs({places: [-0.5]});
  const cat = input.catalogue, aeolian = cat.modes.get("chromatic/L0'/aeolian");
  assert.equal(bank.attach(tap), true); assert.equal(bank.attach(tap), false, 'the same tap is no change');
  const readings = bank.sync(input);
  assert.deepEqual(readings.map(v => [v.entityId, v.state, v.mode, v.bands, v.place]), [['a', 'carrying', "chromatic/L0'/aeolian", bandPlan(aeolian.ratios, ROOT, 48000).length, -0.5]]);
  const plan = bandPlan(aeolian.ratios, ROOT, 48000);
  const filters = r.of('biquad');
  assert.equal(filters.length, plan.length, 'one band-pass for each band of the mode');
  filters.forEach((filter, i) => { assert.equal(filter.type, 'bandpass'); assert.equal(filter.frequency.value, plan[i].centreHz); assert.equal(filter.Q.value, plan[i].q); assert.ok(tap.input.out.has(filter), 'fed from the tap'); });
  const [sum] = r.of('gain').filter(g => filters.every(f => f.out.has(g)));
  assert.ok(sum, 'the bands meet in one sum');
  const env = [...sum.out][0];
  assert.equal(sum.out.size, 1); assert.equal(env.kind, 'gain');
  const [panner] = r.of('panner');
  assert.ok(env.out.has(panner) && panner.out.has(r.context.destination), 'the envelope, then the place, then the device');
  assert.equal(panner.pan.value, -0.5, 'the place is the symbol\'s');
  const ramp = env.gain.events.find(e => e[0] === 'ramp');
  assert.deepEqual([ramp[1], ramp[2]], [0.4, 0.5], 'the voice\'s gain is reached in its attack');
  assert.deepEqual(r.calls, [], 'no oscillator, and no source of any kind');
  // The same plan again changes nothing: the envelope is not restarted by a look.
  const events = env.gain.events.length, count = r.nodes.length;
  bank.sync(input);
  assert.equal(env.gain.events.length, events, 'an unchanged plan does not reschedule the envelope'); assert.equal(r.nodes.length, count);
  // The reading says what the voice is built on.
  assert.equal(bank.inspect().voices[0].tuning, aeolian.tuning);
  assert.deepEqual(bank.inspect().banks.map(b => [b.mode, b.rootHz, b.bands, b.users]), [["chromatic/L0'/aeolian", ROOT, plan.length, ['a']]]);
  bank.dispose();
  assert.ok(filters.every(f => f.out.size === 0), 'dispose takes the bands apart');
});

test('two symbols that carry the same mode share one bank, each with its own envelope and place; another mode has its own bank', async () => {
  const {SymbolVoices} = await voices();
  const r = recording(), tap = {context: r.context, input: {kind: 'tap', out: new Set(), connect(t) { this.out.add(t); return t; }, disconnect() {}}};
  const bank = new SymbolVoices();
  const aeolian = {kind: 'mode', ref: "chromatic/L0'/aeolian"}, dorian = {kind: 'mode', ref: "chromatic/L0'/dorian"};
  const input = await inputs({entities: [{id: 'a', sound: {enabled: true, carry: aeolian}}, {id: 'b', sound: {enabled: true, carry: aeolian}}, {id: 'c', sound: {enabled: true, carry: dorian}}], places: [-1, 1, 0]});
  bank.attach(tap); bank.sync(input);
  const status = bank.inspect();
  assert.deepEqual(status.banks.map(b => [b.mode, b.users]), [["chromatic/L0'/aeolian", ['a', 'b']], ["chromatic/L0'/dorian", ['c']]]);
  assert.equal(r.of('panner').length, 3, 'a place for each symbol');
  assert.deepEqual(r.of('panner').map(p => p.pan.value), [-1, 1, 0]);
  const perBank = status.banks.map(b => b.bands);
  assert.equal(r.of('biquad').length, perBank[0] + perBank[1], 'two banks of filters, not three');
  assert.deepEqual(r.calls, []);
});

test('the torus is silent, so the voice is silent: with no tap nothing is built, and the reading says why in the owner\'s words', async () => {
  const {SymbolVoices} = await voices();
  const r = recording();
  const bank = new SymbolVoices();
  const closed = 'No instrument is open';
  const readings = bank.sync(await inputs({inputs: {torusSilentBecause: closed}}));
  assert.deepEqual(readings.map(v => [v.state, v.because]), [['silent', closed]]);
  assert.equal(r.nodes.length, 0, 'no instrument, no graph');
  // With a tap but a torus that plays nothing the voice stands ready and says the torus is silent: it makes nothing.
  const tap = {context: r.context, input: {kind: 'tap', out: new Set(), connect(t) { this.out.add(t); return t; }, disconnect() {}}};
  bank.attach(tap);
  const held = bank.sync(await inputs({inputs: {torusSilentBecause: 'The field is held'}}));
  assert.deepEqual(held.map(v => [v.state, v.because]), [['carrying', 'The torus is silent: The field is held']]);
  assert.deepEqual(r.calls, []);
});

test('a name the store gives no sound for is absent and says the store\'s reason; no bank is built for it', async () => {
  const {SymbolVoices} = await voices();
  const r = recording(), tap = {context: r.context, input: {kind: 'tap', out: new Set(), connect(t) { this.out.add(t); return t; }, disconnect() {}}};
  const bank = new SymbolVoices(); bank.attach(tap);
  const cat = await parsed();
  const readings = bank.sync(await inputs({entities: [{id: 'a', sound: {enabled: true, carry: {kind: 'name', ref: 'shem'}}}]}));
  assert.deepEqual(readings.map(v => [v.state, v.because]), [['absent', `shem (absent): ${cat.absent.get('shem').reason}`]]);
  assert.equal(r.nodes.length, 0);
  assert.equal(bank.inspect().banks.length, 0);
});

test('Symbol voices Off builds nothing, and a voice that leaves releases on its own envelope before its nodes go', async () => {
  const {SymbolVoices} = await voices();
  const r = recording(), tap = {context: r.context, input: {kind: 'tap', out: new Set(), connect(t) { this.out.add(t); return t; }, disconnect(t) { if (t === undefined) this.out.clear(); else this.out.delete(t); }}};
  const later = deferred();
  const bank = new SymbolVoices(later.defer); bank.attach(tap);
  const off = bank.sync(await inputs({composition: {symbolVoices: false}}));
  assert.deepEqual(off.map(v => [v.entityId, v.state]), [['a', 'silent']]);
  assert.match(off[0].because, /Symbol voices are off for this scene/);
  assert.equal(r.nodes.length, 0, 'Off builds no graph');
  bank.sync(await inputs());
  const [panner] = r.of('panner');
  const env = r.of('gain').find(g => g.out.has(panner));
  assert.ok(env && r.of('biquad').length > 0);
  r.context.currentTime = 10;
  bank.sync(await inputs({entities: []}));
  const release = env.gain.events.filter(e => e[0] === 'ramp').at(-1);
  assert.deepEqual([release[1], release[2]], [0, 12], 'the voice falls silent over its own release (2 s), from where it was');
  assert.ok(env.out.has(panner), 'its nodes stay while it releases');
  assert.equal(later.waiting.at(-1).ms, 2050, 'and go when the release has run out');
  later.settle();
  assert.equal(env.out.size, 0); assert.ok(r.of('biquad').every(f => f.out.size === 0), 'the bank goes with its last user');
  assert.equal(bank.inspect().banks.length, 0);
  // Muted: the object-sound mute takes the gain to 0 without removing the voice.
  const muted = new SymbolVoices(later.defer), r2 = recording();
  muted.attach({context: r2.context, input: {kind: 'tap', out: new Set(), connect(t) { this.out.add(t); return t; }, disconnect() {}}});
  muted.sync(await inputs({inputs: {muted: true}}));
  const env2 = r2.of('gain').find(g => g.out.size && [...g.out].every(t => t.kind === 'panner'));
  assert.equal(env2.gain.events.find(e => e[0] === 'ramp')[1], 0);
});

test('the sources hold no oscillator: no symbol voice, in the frame\'s sources, makes one', () => {
  const root = join(journeys, 'src');
  const found = [];
  const walk = dir => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (/\.(ts|tsx|mjs)$/.test(name)) {
    const text = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/ \/\/ .*$/gm, '');
    if (/createOscillator|new OscillatorNode|EntitySoundBank/.test(text)) found.push(path.replace(root, 'src'));
  } } };
  walk(root);
  assert.deepEqual(found, [], 'no per-symbol tone, and no second audio context for one, anywhere in the frame');
  const bankSource = readFileSync(join(native, 'symbolVoices.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/new AudioContext|new webkitAudioContext/.test(bankSource), false, 'the voices live in the controller\'s context');
});

// ── the controller's tap ────────────────────────────────────────────────────

const fixture = () => import(pathToFileURL(join(journeys, '../../tests/native-expression-fixture.mjs')).href);
test('the controller owns the tap: a unity node after the presentation level and before the effects, in its own context, null when nothing is open', async () => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const THREE = await import('three');
  const {NativeFieldController} = await bundle(join(native, 'controller.ts'), 'controller');
  class Recording extends ControlledAudio {
    created = [];
    createGain() { const node = {kind: 'gain', gain: {value: 1, setValueAtTime(v) { this.value = v; }}, out: new Set(), connect(t) { this.out.add(t); return t; }, disconnect() {}}; this.created.push(node); return node; }
  }
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}};
  const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
    releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}};
  const audio = new Recording(), c = new NativeFieldController(new ControlledSceneOwner(), renderer, () => audio);
  assert.equal(c.voiceTap(), null, 'no instrument, no tap');
  await c.compose({sky: 'none'});
  try {
    const tap = c.voiceTap();
    assert.ok(tap); assert.equal(tap.context, audio, 'the tap is in the controller\'s own context');
    const [level] = audio.created;
    assert.ok(level.out.has(tap.input), 'listening after the level');
    assert.equal(tap.input.out.size, 0, 'and not feeding anything of its own: it listens');
    assert.equal(tap.input.gain.value, 1, 'a unity node: it changes nothing');
    assert.equal(c.voiceTap().input, tap.input, 'the same node while the instrument stays open');
    const {torusPlayReading} = await play();
    assert.equal(torusPlayReading(c.reading).root.hz, c.reading.instrument.acting.voices.find(v => v.planet_ref === SUN).frequency_hz, 'the root is the owner\'s Sun voice, as the controlled owner names it');
  } finally { await c.dispose(); }
  assert.equal(c.voiceTap(), null, 'released with the instrument');
});

// ── the sound, rendered in a real browser ───────────────────────────────────

const browserBundle = async () => (await esbuild.build({absWorkingDir: journeys, bundle: true, format: 'iife', globalName: 'voices', write: false, logLevel: 'silent',
  stdin: {resolveDir: native, loader: 'ts', contents: `export {SymbolVoices, bandPlan, placeOf} from './symbolVoices.ts'; export {entitySoundPlan} from './entitySound.ts'; export {parseModeCatalogue} from './modeCatalogue.ts';`}})).outputFiles[0].text;

for (const [engine, launcher] of [['Chromium', chromium], ['WebKit', webkit]]) {
  test(`${engine}: a band carries energy at its degree and not between degrees; a silent torus makes a silent voice; two modes carry two parts of one sound; the place follows the symbol`, async t => {
    const script = await browserBundle();
    const browser = await launcher.launch();
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>me2</title>');
    await page.addScriptTag({content: script});
    const r = await page.evaluate(async ({fixture, ROOT}) => {
      const {SymbolVoices, bandPlan, entitySoundPlan, parseModeCatalogue} = window.voices;
      const RATE = 48000, SECONDS = 1.2;
      const catalogue = parseModeCatalogue(fixture).catalogue;
      const aeolianKey = "chromatic/L0'/aeolian", dorianKey = "chromatic/L0'/dorian";
      /** Render `seconds` of a torus stand-in (a buffer: the test's own sound) through the symbols' voices; each voice reports its two channels. */
      async function render({signal, entities, places, symbolVoices = true}) {
        const context = new OfflineAudioContext(2, Math.round(SECONDS * RATE), RATE);
        const buffer = context.createBuffer(1, context.length, RATE), data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = signal(i);
        const source = context.createBufferSource(); source.buffer = buffer;
        const tap = context.createGain(); source.connect(tap); source.start(0);
        const bank = new SymbolVoices(run => { run(); return () => {}; });
        bank.attach({context, input: tap});
        const readings = bank.sync({plan: entitySoundPlan({entities, composition: {symbolVoices}}), catalogue, catalogueWhy: null, root: {hz: ROOT, absentBecause: null}, torusSilentBecause: null,
          places: new Map(entities.map((e, i) => [e.id, places?.[i] ?? 0])), muted: false});
        const rendered = await context.startRendering();
        return {left: rendered.getChannelData(0), right: rendered.getChannelData(1), readings};
      }
      const rms = (d, from = Math.round(0.4 * RATE), to = d.length) => { let s = 0; for (let i = from; i < to; i++) s += d[i] * d[i]; return Math.sqrt(s / (to - from)); };
      const sine = (hz, amp = 0.5) => i => amp * Math.sin(2 * Math.PI * hz * i / RATE);
      const voice = (id, key, gain = 1) => ({id, sound: {enabled: true, carry: {kind: 'mode', ref: key}, gain, attack: 0.005, release: 0.05}});
      const out = {};
      // 0 dB is the tone as the device would hear it straight through a centred stereo place (equal power: each channel carries 1/√2 of it).
      const DRY = 0.5 / Math.SQRT2 * Math.SQRT1_2;
      const aeolian = catalogue.modes.get(aeolianKey), dorian = catalogue.modes.get(dorianKey);
      const bands = bandPlan(aeolian.ratios, ROOT, RATE);
      // A. A tone at each of the seven degrees of the lowest two octaves passes; a tone midway between two degrees is held back.
      out.degrees = []; out.between = [];
      const octaves = [0, 1];
      for (const octave of octaves) for (let k = 0; k < 7; k++) {
        const hz = ROOT * 2 ** octave * aeolian.ratios[k], next = ROOT * 2 ** octave * (aeolian.ratios[k + 1] ?? 2), mid = Math.sqrt(hz * next);
        const atDegree = await render({signal: sine(hz), entities: [voice('a', aeolianKey)]}), between = await render({signal: sine(mid), entities: [voice('a', aeolianKey)]});
        out.degrees.push({octave, k, hz, db: 20 * Math.log10(rms(atDegree.left) / DRY)});
        out.between.push({octave, k, hz: mid, db: 20 * Math.log10(rms(between.left) / DRY)});
      }
      // B. A silent torus (nothing on the tap) makes a silent voice, to the last sample.
      const quiet = await render({signal: () => 0, entities: [voice('a', aeolianKey)]});
      out.silentPeak = Math.max(...quiet.left.map(Math.abs), ...quiet.right.map(Math.abs));
      // C. Two modes carry two parts of one sound: the aeolian's 8th semitone passes the aeolian voice and not the dorian's (its 9th).
      const eight = ROOT * 2 ** (8 / 12);
      const a = await render({signal: sine(eight), entities: [voice('a', aeolianKey)]}), d = await render({signal: sine(eight), entities: [voice('d', dorianKey)]});
      out.aeolianAt8 = 20 * Math.log10(rms(a.left) / DRY); out.dorianAt8 = 20 * Math.log10(rms(d.left) / DRY);
      // D. Two voices on the same torus are summed at the device; each is gained by its own symbol.
      const loud = await render({signal: sine(ROOT), entities: [voice('a', aeolianKey, 1)]}), quietVoice = await render({signal: sine(ROOT), entities: [voice('a', aeolianKey, 0.25)]});
      out.gainDb = 20 * Math.log10(rms(quietVoice.left) / rms(loud.left));
      // E. The place: a voice at the left sounds on the left only, at the right on the right only, in the middle on both equally.
      const placed = [];
      for (const place of [-1, 0, 1]) { const x = await render({signal: sine(ROOT), entities: [voice('a', aeolianKey)], places: [place]}); placed.push({place, left: rms(x.left), right: rms(x.right)}); }
      out.placed = placed;
      // F. Symbol voices Off: the same sound reaches the device without any voice.
      const off = await render({signal: sine(ROOT), entities: [voice('a', aeolianKey)], symbolVoices: false});
      out.offPeak = Math.max(...off.left.map(Math.abs), ...off.right.map(Math.abs)); out.offReadings = off.readings.map(v => v.state);
      out.bandCount = bands.length;
      // G. The cost: 10 s of noise through every mode of the fixture at once (five banks, one symbol each), rendered offline.
      { const noise = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return (a / 4294967296 * 2 - 1) * 0.1; }; })();
        const keys = [...catalogue.modes.keys()];
        const context = new OfflineAudioContext(2, RATE * 10, RATE);
        const buffer = context.createBuffer(1, context.length, RATE), data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = noise();
        const source = context.createBufferSource(); source.buffer = buffer;
        const tap = context.createGain(); source.connect(tap); source.start(0);
        const bank = new SymbolVoices(run => { run(); return () => {}; });
        bank.attach({context, input: tap});
        const entities = keys.map((key, i) => voice('v' + i, key, 0.5));
        bank.sync({plan: entitySoundPlan({entities, composition: {}}), catalogue, catalogueWhy: null, root: {hz: ROOT, absentBecause: null}, torusSilentBecause: null,
          places: new Map(entities.map((e, i) => [e.id, i / (keys.length - 1) * 2 - 1])), muted: false});
        const status = bank.inspect();
        const t0 = performance.now(); const rendered = await context.startRendering();
        out.cost = {banks: status.banks.length, biquads: status.banks.reduce((n, b) => n + b.bands, 0), renderMsFor10sAudio: Math.round(performance.now() - t0), peak: (() => { let m = 0; const d = rendered.getChannelData(0); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m; })()}; }
      return out;
    }, {fixture: fixtureJson, ROOT});
    console.log(`${engine}: degrees ${r.degrees.map(x => x.db.toFixed(1)).join(' ')} dB · between ${r.between.map(x => x.db.toFixed(1)).join(' ')} dB · bands ${r.bandCount}`);
    for (const x of r.degrees) assert.ok(x.db > -1 && x.db < 3, `${engine}: degree ${x.k} of octave ${x.octave} (${x.hz.toFixed(1)} Hz) passes: ${x.db.toFixed(2)} dB`);
    for (const x of r.between) assert.ok(x.db < -5, `${engine}: ${x.hz.toFixed(1)} Hz, between degrees ${x.k} and ${x.k + 1}, is held back: ${x.db.toFixed(2)} dB`);
    const weakestDegree = Math.min(...r.degrees.map(x => x.db)), strongestBetween = Math.max(...r.between.map(x => x.db));
    assert.ok(weakestDegree - strongestBetween > 6, `${engine}: the weakest degree is ${(weakestDegree - strongestBetween).toFixed(1)} dB over the strongest gap`);
    assert.equal(r.silentPeak, 0, `${engine}: a silent torus makes a silent voice, to the last sample`);
    assert.ok(r.aeolianAt8 > -1, `${engine}: the aeolian voice carries its 8th semitone: ${r.aeolianAt8.toFixed(2)} dB`);
    assert.ok(r.dorianAt8 < -5, `${engine}: the dorian voice, whose degree is the 9th, does not: ${r.dorianAt8.toFixed(2)} dB`);
    near(r.gainDb, 20 * Math.log10(0.25), 0.05, `${engine}: the symbol's gain scales its voice`);
    const [left, middle, right] = r.placed;
    assert.ok(left.right < left.left * 1e-3 && left.left > 0, `${engine}: at the left only the left sounds`);
    assert.ok(right.left < right.right * 1e-3 && right.right > 0, `${engine}: at the right only the right sounds`);
    near(middle.left / middle.right, 1, 0.01, `${engine}: in the middle both sound alike`);
    assert.equal(r.offPeak, 0, `${engine}: Symbol voices Off, the voice is gone and the torus's own sound is not here to leak`);
    assert.deepEqual(r.offReadings, ['silent']);
    console.log(`${engine}: cost ${JSON.stringify(r.cost)} (load average ${loadavg().map(x => x.toFixed(1)).join(' ')})`);
    assert.equal(r.cost.banks, 5); assert.ok(r.cost.biquads > 250 && r.cost.biquads < 400, `${r.cost.biquads} band-pass filters in five banks`);
    assert.ok(r.cost.peak > 0 && r.cost.peak < 1, 'the banks pass some of the noise and clip none');
    assert.ok(r.cost.renderMsFor10sAudio < 10000, `${engine}: five banks render 10 s of audio in ${r.cost.renderMsFor10sAudio} ms, faster than it plays`);
  });
}

// ── the Sound control in the frame's inspector ──────────────────────────────

test('the frame\'s Sound control has no frequency, follow, waveform or pan; it chooses a name or a mode from the catalogue and says what the voice does', async () => {
  const {soundControlsHTML, applySoundControl, voiceNote, carryValue, carryFromValue} = await controls();
  const {NO_CARRY} = await sound();
  const cat = await parsed();
  const reading = {catalogue: cat, why: null};
  const html = soundControlsHTML({enabled: true, carry: {kind: 'mode', ref: 'maqam/00'}, gain: 0.3}, false, reading);
  for (const gone of [/frequencyHz/i, /followCymatic/i, /waveform/i, /Waveform/, /data-sound="pan"/, /Frequency/, /Follow/]) assert.equal(gone.test(html), false, String(gone));
  assert.match(html, /<span>Name or mode<\/span>/);
  assert.match(html, /<optgroup label="L0&#39; on the chromatic basis">/); assert.match(html, /<optgroup label="maqam">/);
  assert.match(html, /<option value="mode:maqam\/00" selected>Maqam 0 \(family 0, mode 0\)<\/option>/);
  assert.match(html, /<optgroup label="names of the store"><option value="name:shem" >shem · absent<\/option>/);
  assert.match(html, /data-sound="gain"/); assert.match(html, /data-sound="attack"/); assert.match(html, /data-sound="release"/);
  assert.match(voiceNote({enabled: true, carry: {kind: 'mode', ref: 'maqam/00'}}, reading), /^Carries Maqam 0 \(family 0, mode 0\) of the torus's sound, over the torus's root\. Degrees: the catalogue's cents from the root/);
  assert.equal(voiceNote({enabled: true}, reading), NO_CARRY);
  assert.match(voiceNote({enabled: true, carry: {kind: 'name', ref: 'shem'}}, reading), /^shem \(absent\): Register72::Shem is a register of 72 names/);
  assert.equal(voiceNote({enabled: true, carry: {kind: 'mode', ref: 'maqam/00'}}, {catalogue: null, why: 'The kernel could not be asked'}), 'The kernel could not be asked');
  // The control writes exactly the validated block.
  let s = applySoundControl(undefined, 'enabled', true);
  assert.deepEqual(s, {enabled: true});
  s = applySoundControl(s, 'carry', 'mode:maqam/01'); s = applySoundControl(s, 'gain', '0.4'); s = applySoundControl(s, 'attack', '0.5');
  assert.deepEqual(s, {enabled: true, carry: {kind: 'mode', ref: 'maqam/01'}, gain: 0.4, attack: 0.5});
  assert.equal(carryValue(s.carry), 'mode:maqam/01'); assert.deepEqual(carryFromValue('name:shem'), {kind: 'name', ref: 'shem'}); assert.equal(carryFromValue(''), undefined);
  assert.deepEqual(applySoundControl(s, 'carry', ''), {enabled: true, gain: 0.4, attack: 0.5}, 'None yet removes the carry');
  assert.throws(() => applySoundControl(s, 'gain', '3'), /gain/); assert.throws(() => applySoundControl(s, 'carry', 'oscillator:x'), /mode or a name/);
  assert.match(soundControlsHTML(undefined, false, reading), /data-sound="gain"[^>]*disabled/, 'off until enabled');
});

test('the catalogue store hands the voices the owner\'s reading, or the reason there is none', async () => {
  const {modeCatalogueReading, setModeCatalogueReader, onModeCatalogue, refreshModeCatalogue, NOT_HOSTED} = await store();
  setModeCatalogueReader(null);
  assert.deepEqual(modeCatalogueReading(), {catalogue: null, why: NOT_HOSTED});
  let calls = 0, changes = 0;
  const stop = onModeCatalogue(() => { changes++; });
  setModeCatalogueReader(async () => { calls++; return structuredClone(fixtureJson); });
  const first = modeCatalogueReading();
  assert.equal(first.catalogue, null); assert.match(first.why, /being read from the kernel/);
  await new Promise(resolve => setTimeout(resolve, 20));
  const second = modeCatalogueReading();
  assert.equal(calls, 1, 'one read, however many looks'); assert.ok(second.catalogue.modes.has('maqam/00')); assert.equal(second.why, null); assert.ok(changes >= 1, 'listeners hear when it arrives');
  setModeCatalogueReader(async () => ({schema: 'nope'}));
  modeCatalogueReading(); await new Promise(resolve => setTimeout(resolve, 20));
  assert.match(modeCatalogueReading().why, /ql music modes refused: the reading is not a ql\.music-modes\/v1 reading/);
  setModeCatalogueReader(async () => { throw new Error('the kernel host channel is unavailable'); });
  modeCatalogueReading(); await new Promise(resolve => setTimeout(resolve, 20));
  assert.match(modeCatalogueReading().why, /The kernel could not be asked for the mode catalogue: the kernel host channel is unavailable/);
  refreshModeCatalogue(); assert.equal(modeCatalogueReading().catalogue, null);
  stop(); setModeCatalogueReader(null);
});
