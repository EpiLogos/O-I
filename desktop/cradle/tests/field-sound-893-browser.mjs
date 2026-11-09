// O-I #747 round 893, item 9 (walk #857, XR: "the Cymatic Plate is silent in the frame"), as a real browser renders it. The owner's field
// rings once a scene opens (the installed QL host's PCM read −16 dBFS after open, with nothing struck), and the frame schedules it: the
// session's PCM → its presentation gain (the Sound, muted at open: the Live entry opens muted and sound is the person's choice) → the
// level → the Torus's effects → the Expression's mix → the device. What was wrong:
//   - a reopen (another Expression opened, a scene switched: nativeField.ts rebind) opened the session muted again while the controller
//     still read Sound on, so the Sound control showed On and nothing was heard;
//   - the Field's Sound in Expressions ("Lets the field sound", DLW.md §20.2, On by default) was the voices' mute alone: the field's PCM
//     stayed at its presentation mute, so in an Expressions window the field was never heard and the Field said Sound On.
// Round 894 (lane BB's note on C89: once, after a reopen, the frame read "sound off" where Sound had been on): where no field stood — before
// the first opening, and in a rebind's gap between letting the field go and opening it again — the Field read only the mute here, not the
// Sound the controller keeps for the next opening, so it read On over a field that would open, and did open, at Sound off: On before the
// reopen, Off after it, with nothing pressed. And the Field's Sound pressed where no field stood set only the mute here, so the field opened
// again at the Sound it had. The Field now reads the Sound the next opening opens at, and a press where no field stands is kept for it.
// Each check renders the frame's own controller graph (native-field/controller.ts, the session and NativeAudioBinding it opens) over the
// controlled scene owner (tests/native-expression-fixture.mjs: PCM 0.125 in every block) in an OfflineAudioContext, to a buffer. No output
// device: the page's AudioContext is taken away before anything runs, so nothing can sound.
// Run: node tests/field-sound-893-browser.mjs (headless Chromium with --mute-audio, and WebKit — the desktop host is WebKit on macOS).
import {build} from 'esbuild';
import {chromium, webkit} from 'playwright';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const journeys = fileURLToPath(new URL('../expressions-app/field-studies-journeys/src', import.meta.url));
const bundle = await build({stdin: {contents: `export {NativeFieldController, EMBEDDED_NATIVE_PLAYBACK} from './native-field/controller.ts';
import * as sound from './native-field/entitySound.ts';
export {sound};
export {ControlledSceneOwner} from '../../../tests/native-expression-fixture.mjs';
import * as THREE from 'three';
export {THREE};`, resolveDir: journeys, loader: 'ts'}, nodePaths: [fileURLToPath(new URL('../node_modules', import.meta.url))],
  bundle: true, format: 'iife', globalName: 'field', write: false, logLevel: 'silent',
  loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});

for (const [engine, launcher, args] of [['Chromium', chromium, ['--mute-audio']], ['WebKit', webkit, []]]) {
  const browser = await launcher.launch({args});
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>field sound</title>');
    await page.evaluate(() => { const refuse = function () { throw new Error('No output device: this proof renders offline only.') }; window.AudioContext = refuse; window.webkitAudioContext = refuse });
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    const result = await page.evaluate(async () => {
      const f = window.field, RATE = 48000, SECONDS = 1.5;
      let realtime = 0;
      try { new AudioContext() } catch { realtime = -1 }
      const texture = () => new f.THREE.DataTexture(new Float32Array(16), 2, 2, f.THREE.RGBAFormat, f.THREE.FloatType);
      const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}};
      const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
        releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}};
      // Each opening gets its own offline context, which reads as a running device until it is rendered.
      const contexts = [];
      const audio = rate => {
        const target = new OfflineAudioContext(2, Math.round(SECONDS * rate), rate);
        contexts.push(target);
        return new Proxy(target, {get: (t, key) => key === 'state' ? 'running' : key === 'resume' || key === 'close' ? async () => {}
          : typeof t[key] === 'function' ? t[key].bind(t) : t[key]});
      };
      const settle = ms => new Promise(resolve => setTimeout(resolve, ms));
      const rms = buffer => { let n = 0, s = 0; for (let c = 0; c < buffer.numberOfChannels; c++) for (const x of buffer.getChannelData(c)) { s += x * x; n++ } return Math.sqrt(s / n) };
      /** One case: a controller, what the person does, then what the last opening's context renders, and what the controls read. */
      async function heard(steps) {
        contexts.length = 0;
        const c = new f.NativeFieldController(new f.ControlledSceneOwner(), renderer, audio, f.EMBEDDED_NATIVE_PLAYBACK);
        try {
          await steps(c);
          await settle(400);
          const reading = {muted: c.reading.muted, status: c.reading.status, field: typeof f.sound.fieldSoundMuted === 'function' ? f.sound.fieldSoundMuted(c) : 'absent'};
          const out = await contexts.at(-1).startRendering();
          return {rms: rms(out), ...reading};
        } catch (error) { return {error: String(error && error.message || error)} }
        finally { f.sound.setObjectSoundMuted(false); await c.dispose().catch(() => {}); }
      }
      const fieldSound = (c, muted) => { if (typeof f.sound.setFieldSound !== 'function') throw new Error('setFieldSound is not a function'); f.sound.setFieldSound(c, muted); };
      // The Field's Sound as it reads before the first opening, open, in a rebind's gap and open again, with nothing pressed (round 894).
      const across = async () => {
        const c = new f.NativeFieldController(new f.ControlledSceneOwner(), renderer, audio, f.EMBEDDED_NATIVE_PLAYBACK);
        try {
          const fresh = f.sound.fieldSoundMuted(c); await c.compose({sky: 'none'}); const opened = f.sound.fieldSoundMuted(c)
          await c.release(true); const gap = f.sound.fieldSoundMuted(c); await c.compose({sky: 'none'}); const reopened = f.sound.fieldSoundMuted(c)
          return {fresh, opened, gap, reopened}
        } catch (error) { return {error: String(error && error.message || error)} }
        finally { f.sound.setObjectSoundMuted(false); await c.dispose().catch(() => {}); }
      };
      return {realtime, across: await across(),
        opened: await heard(c => c.compose({sky: 'none'})),
        soundOn: await heard(async c => { await c.compose({sky: 'none'}); c.setMuted(false); }),
        reopened: await heard(async c => { await c.compose({sky: 'none'}); c.setMuted(false); await c.release(true); await c.compose({sky: 'none'}); }),
        fieldOn: await heard(async c => { await c.compose({sky: 'none'}); fieldSound(c, false); }),
        fieldOff: await heard(async c => { await c.compose({sky: 'none'}); c.setMuted(false); fieldSound(c, true); }),
        fieldOnBeforeOpen: await heard(async c => { fieldSound(c, false); await c.compose({sky: 'none'}); }),
        fieldOnInGap: await heard(async c => { await c.compose({sky: 'none'}); await c.release(true); fieldSound(c, false); await c.compose({sky: 'none'}); }),
        fieldOffInGap: await heard(async c => { await c.compose({sky: 'none'}); c.setMuted(false); await c.release(true); fieldSound(c, true); await c.compose({sky: 'none'}); }),
      };
    });
    const db = x => x > 0 ? `${(20 * Math.log10(x)).toFixed(1)} dBFS` : 'silence';
    console.log(`${engine}: the Field across a reopen, nothing pressed: ${JSON.stringify(result.across)}`);
    console.log(`${engine}: ${Object.entries(result).filter(([k]) => k !== 'realtime' && k !== 'across').map(([k, r]) => `${k} ${r.error ? `error: ${r.error}` : `${db(r.rms)} (Sound read ${r.muted ? 'Off' : 'On'}, the Field ${r.field === 'absent' ? 'absent' : r.field ? 'Off' : 'On'})`}`).join('; ')}`);
    assert.equal(result.realtime, -1, `${engine}: no realtime context could be made, so no device was opened`);
    for (const [name, r] of Object.entries(result)) if (name !== 'realtime') assert.equal(r.error, undefined, `${engine}: ${name}: ${r.error}`);
    assert.deepEqual(result.across, {fresh: true, opened: true, gap: true, reopened: true}, `${engine}: with nothing pressed the Field reads Sound Off before the first opening, open, in a rebind's gap and open again: what the field opens at, never On over a field that opens muted (round 894)`);
    assert.ok(result.opened.rms === 0 && result.opened.muted === true, `${engine}: the field opens muted, as the Live entry has it: nothing is heard and Sound reads Off`);
    assert.ok(result.soundOn.rms > 1e-4 && result.soundOn.muted === false, `${engine}: Sound on, the field's PCM reaches the device (${result.soundOn.rms})`);
    assert.equal(result.reopened.muted, false, `${engine}: reopened, Sound still reads On`);
    assert.ok(result.reopened.rms > 1e-4, `${engine}: reopened after Sound was turned on (another Expression opened, a scene switched), the field is heard as Sound reads (${result.reopened.rms})`);
    assert.ok(Math.abs(result.reopened.rms / result.soundOn.rms - 1) < 1e-3, `${engine}: at the same level as before the reopen`);
    assert.equal(result.opened.field, true, `${engine}: the Field reads Sound Off while the field's PCM is muted: it says what is heard`);
    assert.ok(result.fieldOn.rms > 1e-4 && result.fieldOn.muted === false && result.fieldOn.field === false, `${engine}: the Field's Sound On lets the field sound, and Live's Sound reads On with it (${result.fieldOn.rms})`);
    assert.ok(Math.abs(result.fieldOn.rms / result.soundOn.rms - 1) < 1e-3, `${engine}: the Field's Sound On is heard as Live's Sound On is`);
    assert.ok(result.fieldOff.rms === 0 && result.fieldOff.muted === true && result.fieldOff.field === true, `${engine}: the Field's Sound Off silences the field, and Live's Sound reads Off with it`);
    assert.ok(result.fieldOnBeforeOpen.rms > 1e-4 && result.fieldOnBeforeOpen.muted === false && result.fieldOnBeforeOpen.field === false, `${engine}: the Field's Sound On pressed while no field stands is kept: the next opening is heard, and Live's Sound and the Field read On (round 894; round 893 left it muted while the Field read On) (${result.fieldOnBeforeOpen.rms})`);
    assert.ok(result.fieldOnInGap.rms > 1e-4 && result.fieldOnInGap.muted === false && result.fieldOnInGap.field === false, `${engine}: pressed On in a rebind's gap, the field opens again heard, and reads On (${result.fieldOnInGap.rms})`);
    assert.ok(result.fieldOffInGap.rms === 0 && result.fieldOffInGap.muted === true && result.fieldOffInGap.field === true, `${engine}: pressed Off in a rebind's gap after Sound was on, the field opens again silent, and Live's Sound and the Field read Off`);
  } finally {
    await browser.close();
  }
}
console.log('Item 9: every check passed in Chromium and WebKit, offline.');
