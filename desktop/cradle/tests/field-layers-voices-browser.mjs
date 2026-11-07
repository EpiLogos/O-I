// XS04 slice 3 as a real browser sounds it (O-I #747 round 891): an Expression held over the presented one sounds in the Main mix with it
// (DLW.md §20.1 The mixer row: "Activator | The Expression plays, or it does not", "Solo | Lets you hear only this Expression's sound",
// "Volume | The level of the Expression's sound"; The Main track "sets the level of every Expression's sound together"). Each check renders
// the field's symbol voices (native-field/symbolVoices.ts, the bank production.ts drives) in an OfflineAudioContext — to a buffer, no output
// device: the page's AudioContext is taken away before anything runs, so nothing can sound — over one known torus output (seeded noise into
// the tap), with each voice's mix read as the field reads it (entitySound.ts fieldVoiceMix over setExpressionMix / setLayerMixes /
// setFieldLevel, what the frame tells it). It measures what reaches the destination:
//   - a held Expression's voice reaches the Main mix, as loud as the presented one's at the same level, and the two sum there sample by sample;
//   - its Volume, the Main level and the Field's Level scale it; its Activator off silences it, on again restores it to the sample;
//   - a Solo on the held one leaves exactly its sound (the presented one's voice gone), and a Solo on the presented one exactly its own.
// What the owner hears on the desktop is a walk step this does not replace.
// Run: node tests/field-layers-voices-browser.mjs (headless Chromium with --mute-audio, and WebKit — the desktop host is WebKit on macOS).
import {build} from 'esbuild';
import {chromium, webkit} from 'playwright';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const src = fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/native-field', import.meta.url));
const fixture = JSON.parse(readFileSync(new URL('../expressions-app/field-studies-journeys/tests/fixtures/ql-music-modes-trimmed.json', import.meta.url), 'utf8'));
const bundle = await build({stdin: {contents: `export {SymbolVoices} from './symbolVoices.ts';
export {entitySoundPlan, fieldVoiceMix, setExpressionMix, setLayerMixes, setFieldLevel, expressionMixOf} from './entitySound.ts';
export {parseModeCatalogue} from './modeCatalogue.ts';`, resolveDir: src, loader: 'ts'}, bundle: true, format: 'iife', globalName: 'voices', write: false});

for (const [engine, launcher, args] of [['Chromium', chromium, ['--mute-audio']], ['WebKit', webkit, []]]) {
  const browser = await launcher.launch({args});
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>layer voices</title>');
    // No output device: a realtime context cannot be made on this page.
    await page.evaluate(() => { const refuse = function () { throw new Error('No output device: this proof renders offline only.') }; window.AudioContext = refuse; window.webkitAudioContext = refuse });
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    const result = await page.evaluate(async fixture => {
      const v = window.voices;
      const parsed = v.parseModeCatalogue(fixture);
      if (!parsed.ok) throw new Error(parsed.refusal);
      const RATE = 48000, SECONDS = 0.6, TIDE = 'expression:tide', REEF = 'expression:reef';
      const carry = {kind: 'mode', ref: "chromatic/L0'/aeolian"};
      const voice = id => ({id, sound: {enabled: true, carry, gain: 0.4, attack: 0.01, release: 2}});
      let realtime = 0;
      try { new AudioContext() } catch { realtime = -1 }
      /** One render: the field's state as the frame tells it, these symbols, the torus's output into the tap; the destination's samples. */
      async function render({ids, presented = {}, layers = {}, fieldDb = 0}) {
        v.setExpressionMix(presented); v.setLayerMixes(new Map(Object.entries(layers).map(([ref, mix]) => [ref, v.expressionMixOf(mix)]))); v.setFieldLevel(fieldDb);
        const context = new OfflineAudioContext(2, Math.round(SECONDS * RATE), RATE);
        const noise = context.createBuffer(1, Math.round(SECONDS * RATE), RATE), data = noise.getChannelData(0);
        let seed = 7; for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = (seed / 2 ** 32 - 0.5) * 0.8 }
        const source = context.createBufferSource(); source.buffer = noise;
        const tap = context.createGain(); source.connect(tap); source.start(0);
        const bank = new v.SymbolVoices(() => () => {});
        bank.attach({context, input: tap});
        const entities = ids.map(voice);
        const readings = bank.sync({plan: v.entitySoundPlan({entities}), catalogue: parsed.catalogue, catalogueWhy: null, root: {hz: 130.81279, absentBecause: null},
          torusSilentBecause: null, places: new Map(entities.map(e => [e.id, 0])), muted: false, mixOf: v.fieldVoiceMix});
        const out = await context.startRendering();
        const from = Math.round(0.2 * RATE), samples = [];
        for (let c = 0; c < out.numberOfChannels; c++) samples.push(Array.from(out.getChannelData(c).subarray(from)));
        return {samples, states: readings.map(r => r.state)};
      }
      const rms = ({samples}) => Math.sqrt(samples.flat().reduce((n, x) => n + x * x, 0) / samples.flat().length);
      const apart = (a, b) => Math.max(...a.samples.flatMap((ch, c) => ch.map((x, i) => Math.abs(x - b.samples[c][i]))));
      const sum = (a, b) => ({samples: a.samples.map((ch, c) => ch.map((x, i) => x + b.samples[c][i]))});
      const held = {[TIDE]: {}}, both = {[TIDE]: {}, [REEF]: {}};
      const r = {
        presented: await render({ids: ['a']}),
        tide: await render({ids: [`${TIDE}#a`], layers: held}),
        reef: await render({ids: [`${REEF}#b`], layers: both}),
        together: await render({ids: ['a', `${TIDE}#a`, `${REEF}#b`], layers: both}),
        tideHalf: await render({ids: [`${TIDE}#a`], layers: {[TIDE]: {level: 0.5}}}),
        mainHalf: await render({ids: [`${TIDE}#a`], presented: {main: 0.5}, layers: held}),
        field: await render({ids: [`${TIDE}#a`], layers: held, fieldDb: -12}),
        off: await render({ids: [`${TIDE}#a`], layers: {[TIDE]: {active: false}}}),
        onAgain: await render({ids: [`${TIDE}#a`], layers: {[TIDE]: {active: true}}}),
        soloHeld: await render({ids: ['a', `${TIDE}#a`], layers: {[TIDE]: {solo: true}}}),
        soloPresented: await render({ids: ['a', `${TIDE}#a`], presented: {solo: true}, layers: held}),
        soloOther: await render({ids: ['a', `${TIDE}#a`], layers: {[TIDE]: {}, [REEF]: {solo: true}}}),
      };
      return {realtime, states: r.together.states,
        rms: Object.fromEntries(Object.entries(r).map(([k, x]) => [k, rms(x)])),
        apart: {together: apart(r.together, sum(sum(r.presented, r.tide), r.reef)), onAgain: apart(r.onAgain, r.tide), tideVsPresented: Math.abs(rms(r.tide) - rms(r.presented)),
          soloHeld: apart(r.soloHeld, r.tide), soloPresented: apart(r.soloPresented, r.presented)}};
    }, fixture);
    const {rms, apart} = result;
    const db = x => (20 * Math.log10(x)).toFixed(1);
    console.log(`${engine}: presented ${db(rms.presented)} dBFS, held ${db(rms.tide)}, held at Volume 0.5 ${db(rms.tideHalf)}, Main 0.5 ${db(rms.mainHalf)}, Field −12 dB ${db(rms.field)}, Activator off ${rms.off === 0 ? 'silence' : db(rms.off)}, together ${db(rms.together)}`);
    assert.equal(result.realtime, -1, `${engine}: no realtime context could be made, so no device was opened`);
    assert.deepEqual(result.states, ['carrying', 'carrying', 'carrying'], `${engine}: every voice is wired to the torus`);
    assert.ok(rms.presented > 1e-3, `${engine}: the presented symbol's voice sounds (${rms.presented})`);
    assert.ok(rms.tide > 1e-3 && rms.reef > 1e-3, `${engine}: each held Expression's voice reaches the Main mix (${rms.tide}, ${rms.reef})`);
    assert.ok(apart.tideVsPresented < 1e-6 * Math.max(1, rms.presented) + 1e-7, `${engine}: at the same level, a held voice is as loud as the presented one's`);
    assert.ok(apart.together < 1e-5, `${engine}: the presented and both held voices sum in the Main mix, sample by sample (${apart.together})`);
    const near = (actual, expected, what) => assert.ok(Math.abs(actual / expected - 1) < 1e-3, `${engine}: ${what}: ${actual} against ${expected}`);
    near(rms.tideHalf, rms.tide * 0.5, 'its Volume at 0.5 halves it');
    near(rms.mainHalf, rms.tide * 0.5, 'the Main level at 0.5 halves it with every Expression');
    near(rms.field, rms.tide * 10 ** (-12 / 20), 'the Field\'s Level at −12 dB takes it 12 dB down');
    assert.ok(rms.off < 1e-7, `${engine}: its Activator off, it is silent (${rms.off})`);
    assert.ok(apart.onAgain < 1e-7, `${engine}: on again, it is as it was, to the sample (${apart.onAgain})`);
    assert.ok(apart.soloHeld < 1e-7, `${engine}: the held Expression soloed, only its sound is heard: the presented voice is gone (${apart.soloHeld})`);
    assert.ok(apart.soloPresented < 1e-7, `${engine}: the presented one soloed, only its own (${apart.soloPresented})`);
    assert.ok(rms.soloOther < 1e-7, `${engine}: another held Expression soloed, neither of these is heard (${rms.soloOther})`);
  } finally {
    await browser.close();
  }
}
console.log('XS04 slice 3: every check passed in Chromium and WebKit, offline.');
