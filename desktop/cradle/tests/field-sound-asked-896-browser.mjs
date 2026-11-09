// O-I #747 round 896, 1S (DLW build ruling 2026-11-09, review c99c F1 and F2), as a real browser runs the Field's own panel
// (nativeField.ts installNativeField). field-sound-closed-896.test.mjs reads entitySound.ts fieldSoundClosed with `asked` handed in; here
// the panel's own closure keeps it, so its own operations are what move it:
//   - F2: the person closes the field on purpose (the panel's Close instrument) or disconnects it (Disconnect): it was not opened here any
//     more, so the Sound says nothing closed. Opened again and let go for a reopen (rebind), it was, and the Sound says so.
//   - F1: with the Sound On, an operation of the controller's own in flight says nothing and offers nothing, and the panel's Open sound
//     does nothing then (it never resumes a field its own operation holds); held after a reading, which waits on the person, the Sound
//     says it, the frame announces it, and one Open sound resumes it.
// The field opens over the controlled scene owner (tests/native-expression-fixture.mjs) through a stand-in for the host's channel, in
// offline audio contexts: the page's AudioContext opens none and renders nothing, so no device is opened and nothing can sound.
// Run: node tests/field-sound-asked-896-browser.mjs (headless Chromium with --mute-audio).
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const journeys = fileURLToPath(new URL('../expressions-app/field-studies-journeys/src', import.meta.url));
// The panel's channel to its host, stood in for by the controlled owner the page makes (window.__nativeOwner): answered, available.
const channel = {name: 'native-channel-stand-in', setup(builder) {
  builder.onResolve({filter: /\/channel$/}, args => args.importer.endsWith('nativeField.ts') ? {path: 'channel', namespace: 'stand-in'} : undefined);
  builder.onLoad({filter: /.*/, namespace: 'stand-in'}, () => ({loader: 'js',
    contents: 'export class NativeChannel{constructor(){const owner=window.__nativeOwner;owner.answered=true;owner.beat=()=>{};return owner;}}'}));
}};
const bundle = await build({stdin: {contents: `export {installNativeField} from './nativeField.ts';
import * as sound from './native-field/entitySound.ts';
export {sound};
export {ControlledSceneOwner} from '../../../tests/native-expression-fixture.mjs';
import * as THREE from 'three';
export {THREE};`, resolveDir: journeys, loader: 'ts'}, nodePaths: [fileURLToPath(new URL('../node_modules', import.meta.url))],
  bundle: true, format: 'iife', globalName: 'field', write: false, logLevel: 'silent', plugins: [channel],
  loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});

const browser = await chromium.launch({args: ['--mute-audio']});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.setContent('<!doctype html><title>field sound asked</title><body></body>');
  // Every context the controller opens is offline, and reads as a running device: nothing is rendered, nothing can sound.
  await page.evaluate(() => {
    window.AudioContext = function (options = {}) {
      const rate = options.sampleRate ?? 48000, target = new OfflineAudioContext(2, rate, rate);
      return new Proxy(target, {get: (t, key) => key === 'state' ? 'running' : key === 'resume' || key === 'close' ? async () => {}
        : typeof t[key] === 'function' ? t[key].bind(t) : t[key]});
    };
    window.webkitAudioContext = window.AudioContext;
  });
  await page.addScriptTag({content: bundle.outputFiles[0].text});
  const result = await page.evaluate(async () => {
    const f = window.field;
    const owner = window.__nativeOwner = new f.ControlledSceneOwner();
    // The owner's next reply to one operation is held until released: the controller's own work stands in flight meanwhile.
    const request = owner.request.bind(owner);
    let want = null, arrived = null, release = null;
    owner.request = async packet => {
      if (want && packet.request?.command?.operation === want) { want = null; const wait = new Promise(r => { release = r; }); arrived(); await wait; }
      return request(packet);
    };
    const gate = operation => { want = operation; return new Promise(r => { arrived = r; }); };
    const texture = () => new f.THREE.DataTexture(new Float32Array(16), 2, 2, f.THREE.RGBAFormat, f.THREE.FloatType);
    const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}};
    const engine = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port,
      setNativeDomain() {}, releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; },
      restoreRetainedField() {}};
    const announced = [];
    const field = f.installNativeField(engine, () => {}, {onSoundClosed: words => announced.push(words)});
    document.body.append(field.panel);
    const c = field.controller;
    let resumed = 0;
    const resume = c.resume.bind(c);
    c.resume = () => { resumed++; return resume(); };
    const wait = async (ok, what) => { for (let i = 0; i < 400; i++) { if (ok()) return; await new Promise(r => setTimeout(r, 5)); } throw new Error(`never: ${what} (${c.status}: ${c.reason}; ${owner.calls.map(x=>x.operation??x.request?.command?.operation).join(', ')})`); };
    const press = selector => field.panel.querySelector(selector).click();
    // Let go: the owner answered its close, and the release has finished (a new opening is refused while one is closing).
    const letGo = async what => { await wait(() => c.status === 'manual' && !c.reading.lease && !owner.active, what); await new Promise(r => setTimeout(r, 20)); };
    const open = async () => { press('[data-ni="open-default"]'); await wait(() => c.status === 'following', 'the field follows'); };
    const read = {};
    f.sound.setFieldSound(c, false);
    await open();
    read.opened = field.soundClosed();
    // F2: closed on purpose, from the panel's Close instrument.
    press('[data-ni="close"]');
    await letGo('the field is let go');
    read.closed = field.soundClosed();
    // F2: opened again, then disconnected from the panel's Disconnect.
    await open();
    press('button[data-native="disconnect"]');
    await letGo('the field is disconnected');
    read.disconnected = field.soundClosed();
    // F1: opened again, an operation of the controller's own in flight: nothing said, nothing announced, Open sound does nothing.
    await open();
    const before = announced.length;
    let reached = gate('m1-advance');
    const operation = c.operate({operation: 'm1-advance', ticks: 1});
    await reached;
    read.midStatus = [c.status, c.reason];
    read.midOperation = field.soundClosed();
    read.midOpen = field.openSound();
    read.resumedMid = resumed;
    release();
    await operation;
    await wait(() => c.status === 'following', 'the operation lets the field go');
    read.announcedMid = announced.slice(before).filter(Boolean);
    // F1: held after a reading on the held field: the hold waits on the person, said and announced; one Open sound resumes it.
    c.hold('held by you');
    reached = gate('influence');
    const reading = c.influence();
    await reached;
    read.midReading = field.soundClosed();
    release();
    await reading;
    await wait(() => announced.at(-1) !== null && announced.at(-1) !== undefined, 'the standing hold is announced');
    read.standing = field.soundClosed();
    read.announcedStanding = announced.at(-1);
    read.opensWith = field.openSound();
    await wait(() => c.status === 'following', 'Open sound resumes the field');
    read.resumedAfter = resumed;
    read.reopened = field.soundClosed();
    // F2: a reopen let go (another Expression opened: rebind) was opened here, and the Sound says it is closed until it opens again.
    read.rebind = field.rebind('Opened another Expression');
    read.letGo = field.soundClosed();
    field.dispose();
    return read;
  });
  assert.deepEqual(errors, [], 'no page error');
  assert.equal(result.opened, null, 'opened and following: heard');
  assert.equal(result.closed, null, 'closed on purpose (Close instrument): not opened here any more, nothing said');
  assert.equal(result.disconnected, null, 'disconnected (Disconnect): not opened here any more, nothing said');
  assert.deepEqual(result.midStatus, ['held', 'native operation']);
  assert.equal(result.midOperation, null, 'an operation in flight says nothing');
  assert.equal(result.midOpen, null, 'and Open sound does nothing then');
  assert.equal(result.resumedMid, 0, 'Open sound never resumes a field its own operation holds');
  assert.deepEqual(result.announcedMid, [], 'nothing announced the sound closed while the operation ran');
  assert.equal(result.midReading, null, 'a reading in flight says nothing');
  const words = 'The field\'s sound is closed: the field is held (influence reading complete; resume explicitly).';
  assert.equal(result.standing, words, 'held after the reading, the hold waits on the person: said');
  assert.equal(result.announcedStanding, words, 'and announced');
  assert.equal(result.opensWith, words, 'Open sound answers with the words it stood closed with');
  assert.equal(result.resumedAfter, 1, 'and resumes the field once');
  assert.equal(result.reopened, null, 'resumed: heard');
  assert.match(result.rebind, /^Opened another Expression: the live field let go/);
  assert.equal(result.letGo, `The field's sound is closed: ${result.rebind.replace(/[.\s]*$/, '')}.`, 'a reopen let go was opened here: said');
  console.log('field-sound-asked-896-browser: Chromium: Close and Disconnect clear the ask, a reopen let go says closed; no own-work hold says closed or is resumed by Open sound; a hold after a reading is said, announced and opened by one press');
} finally {
  await browser.close();
}
