// The torus's four effects as a real browser sounds them (native-field/presentationEffects.ts): each check renders a known signal
// through the graph in an OfflineAudioContext at the device's 48 kHz and measures what comes out. Off passes the input unchanged;
// the filter cuts what its type cuts; the compressor lowers what is over its threshold; the delay repeats after its time; the reverb's
// tail falls 60 dB in its decay. The reverb is also rendered in stereo (DLW §21.5 Reverb: Size, Decay, Damping, Pre-delay, Dry/wet): after
// the Pre-delay each side is that side's generated room (reverbImpulse, whose law tests/native-expression-effects.test.mjs reads), at one
// level for both sides and as loud as in Chromium, beside the dry at 1 − Dry/wet, and nothing else; at Damping 0 each side's tail falls
// 60 dB in Decay; a sound on one side rings on that side alone. WebKit on Linux (CI's) leaks each block's Nyquist bin through its convolver;
// the reverb corrects it where the page's measure finds it, and the measure's verdict is printed with each engine's measurements.
// Run: node tests/native-expression-effects-browser.mjs (headless Chromium and WebKit, Playwright; the desktop host is WebKit on macOS),
// from any directory.
import {build} from 'esbuild';
import {chromium, webkit} from 'playwright';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const src = fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/native-field', import.meta.url));
const bundle = await build({stdin: {contents: `export {PresentationEffects, reverbImpulse, convolverLeaksNyquist} from './presentationEffects.ts'; export {initialEffects, editEffects, editEffectChain} from './effectsLaw.ts';`,
  resolveDir: src, loader: 'ts'}, bundle: true, format: 'iife', globalName: 'effects', write: false});
/** The reverb's level for each room and side, as Chromium sounds it. */
let reference;
for (const [engine, launcher] of [['Chromium', chromium], ['WebKit', webkit]]) {
const browser = await launcher.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><title>effects</title>');
  await page.addScriptTag({content: bundle.outputFiles[0].text});
  const results = await page.evaluate(async () => {
    const {PresentationEffects, initialEffects, editEffects, editEffectChain, reverbImpulse, convolverLeaksNyquist} = window.effects;
    const RATE = 48000;
    // The reverb makes its first room once the page has measured its convolver; the renders below give it no time, so it is awaited.
    const leaks = await convolverLeaksNyquist();
    // Each check puts on the chain the effects its edits name, in that order, unless it names the chain itself.
    const state = edits => { const named = [...new Set(edits.filter(([e]) => e !== 'chain').map(([e]) => e))];
      const chain = edits.find(([e]) => e === 'chain')?.[1] ?? named;
      return edits.filter(([e]) => e !== 'chain').reduce((s, [effect, key, value]) => editEffects(s, effect, key, value), editEffectChain(initialEffects(), chain)); };
    /** Render `seconds` of a signal through the effects in this state; the signal is a function of the sample index. */
    async function render(edits, signal, seconds) {
      const context = new OfflineAudioContext(1, Math.round(seconds * RATE), RATE);
      const buffer = context.createBuffer(1, context.length, RATE), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = signal(i);
      const source = context.createBufferSource(); source.buffer = buffer;
      const graph = new PresentationEffects(context, context.destination, state(edits), run => { run(); return () => {}; });
      source.connect(graph.input); source.start(0);
      const out = (await context.startRendering()).getChannelData(0);
      return {input: data, out};
    }
    const sine = (hz, amp = 0.5) => i => amp * Math.sin(2 * Math.PI * hz * i / RATE);
    const impulse = i => (i === 0 ? 1 : 0);
    const rms = (d, from, to) => Math.sqrt(d.slice(from, to).reduce((s, x) => s + x * x, 0) / (to - from));
    const db = x => 20 * Math.log10(x);
    const r = {};
    { const {input, out} = await render([], sine(997), 0.25); r.emptyMaxDiff = Math.max(...out.map((x, i) => Math.abs(x - input[i]))); }
    { const off = ['filter', 'dynamics', 'delay', 'reverb'].map(effect => [effect, 'on', false]);
      const {input, out} = await render(off, sine(997), 0.25); r.offMaxDiff = Math.max(...out.map((x, i) => Math.abs(x - input[i]))); }
    { // Order: linear effects commute, so the order is heard through the compressor. Dynamics before the Delay compresses the burst and
      // its repeat apart, then sums them; the Delay before Dynamics sums them first, and the compressor holds the sum down.
      const dyn = [['dynamics', 'threshold', -40], ['dynamics', 'ratio', 20], ['dynamics', 'attack', 1], ['dynamics', 'release', 50], ['dynamics', 'makeup', 0]];
      const dly = [['delay', 'sync', false], ['delay', 'time', 100], ['delay', 'feedback', 0], ['delay', 'tone', 12000], ['delay', 'mix', 100]];
      const burst = i => (i < 14400 ? sine(300, 0.5)(i) : 0);
      const first = await render([['chain', ['dynamics', 'delay']], ...dyn, ...dly], burst, 0.5), second = await render([['chain', ['delay', 'dynamics']], ...dyn, ...dly], burst, 0.5);
      r.orderDb = db(rms(first.out, 7200, 14400) / rms(second.out, 7200, 14400)); }
    { const f = [['filter', 'on', true], ['filter', 'type', 'lowpass'], ['filter', 'cutoff', 500], ['filter', 'resonance', 0]];
      const high = await render(f, sine(8000), 0.25), low = await render(f, sine(100), 0.25);
      r.lowpassHighDb = db(rms(high.out, 4800, 12000) / rms(high.input, 4800, 12000)); r.lowpassLowDb = db(rms(low.out, 4800, 12000) / rms(low.input, 4800, 12000)); }
    { const hp = await render([['filter', 'on', true], ['filter', 'type', 'highpass'], ['filter', 'cutoff', 2000], ['filter', 'resonance', 0]], sine(100), 0.25);
      r.highpassLowDb = db(rms(hp.out, 4800, 12000) / rms(hp.input, 4800, 12000)); }
    { const c = await render([['dynamics', 'on', true], ['dynamics', 'threshold', -30], ['dynamics', 'ratio', 20], ['dynamics', 'attack', 1], ['dynamics', 'makeup', 0]], sine(220, 1), 1);
      r.compressDb = db(rms(c.out, 24000, 48000) / rms(c.input, 24000, 48000));
      const quiet = await render([['dynamics', 'on', true], ['dynamics', 'threshold', -30], ['dynamics', 'ratio', 20], ['dynamics', 'makeup', 6]], sine(220, 0.01), 1);
      r.compressQuietDb = db(rms(quiet.out, 24000, 48000) / rms(quiet.input, 24000, 48000)); }
    { const delay = [['delay', 'on', true], ['delay', 'sync', false], ['delay', 'time', 100], ['delay', 'feedback', 50], ['delay', 'tone', 12000], ['delay', 'mix', 50]];
      // Where: an impulse's repeats, each one Time after the last. How loud: a 20 ms burst at 300 Hz, below Tone, so Tone leaves it whole.
      const y = await render(delay, impulse, 0.5);
      const peakNear = at => { let best = 0, where = 0; for (let i = at - 240; i < at + 240; i++) if (Math.abs(y.out[i]) > best) { best = Math.abs(y.out[i]); where = i; } return where; };
      r.delayDry = y.out[0]; r.delayAt = [peakNear(4800), peakNear(9600), peakNear(14400)]; r.delayBetween = Math.max(...y.out.slice(200, 4500).map(Math.abs));
      const burst = await render(delay, i => (i < 960 ? sine(300, 0.5)(i) : 0), 0.5), level = at => rms(burst.out, at, at + 960) / rms(burst.input, 0, 960);
      r.delayLevels = [level(4800), level(9600)]; }
    { const v = await render([['reverb', 'on', true], ['reverb', 'decay', 1], ['reverb', 'predelay', 50], ['reverb', 'mix', 100], ['reverb', 'damping', 0]], impulse, 1.6);
      const start = rms(v.out, 2400 + 480, 2400 + 4800), late = rms(v.out, Math.round((0.05 + 0.95) * RATE), Math.round((0.05 + 1.05) * RATE));
      r.reverbBeforePredelay = Math.max(...v.out.slice(0, 2300).map(Math.abs)); r.reverbFallDb = db(late / start); r.reverbStart = start; }
    r.convolverLeaksNyquist = leaks;
    /** Render a mono sound, or a stereo one, through the effects into two channels. */
    async function stereo(edits, left, right, seconds) {
      const context = new OfflineAudioContext(2, Math.round(seconds * RATE), RATE);
      const buffer = context.createBuffer(right ? 2 : 1, context.length, RATE);
      for (let i = 0; i < context.length; i++) { buffer.getChannelData(0)[i] = left(i); if (right) buffer.getChannelData(1)[i] = right(i); }
      const source = context.createBufferSource(); source.buffer = buffer;
      const graph = new PresentationEffects(context, context.destination, state(edits), run => { run(); return () => {}; });
      source.connect(graph.input); source.start(0);
      const out = await context.startRendering();
      return [out.getChannelData(0), out.getChannelData(1)];
    }
    /** How long a tail takes to fall 60 dB: the slope of its energy decay curve (Schroeder's backward integral) between 5 and 35 dB under its
     * start (tests/mr-resonator-bank.test.mjs). */
    const fall60 = data => {
      const edc = new Float64Array(data.length); let sum = 0;
      for (let i = data.length - 1; i >= 0; i--) { sum += data[i] * data[i]; edc[i] = sum; }
      const level = i => 10 * Math.log10(edc[i] / edc[0]);
      let a = 0; while (a < edc.length && level(a) > -5) a++;
      let b = a; while (b < edc.length && level(b) > -35) b++;
      return b >= edc.length ? null : -60 * ((b - a) / RATE) / (level(b) - level(a));
    };
    /** What an impulse made of one side: the dry at 1 − Dry/wet and, from the Pre-delay on, the side's room at Dry/wet times one level (the
     * level that fits best, by least squares); what is left over, at its peak, in dB under the room's peak; and the tail's 60 dB fall. */
    function side(y, room, at, wet) {
      const dry = i => (1 - wet) * impulse(i);
      let yh = 0, hh = 0;
      for (let i = 0; i < room.length && at + i < y.length; i++) { yh += (y[at + i] - dry(at + i)) * room[i]; hh += room[i] * room[i]; }
      const level = yh / hh / wet;
      let residual = 0, peak = 0;
      for (let i = 0; i < y.length; i++) {
        const tail = i >= at && i - at < room.length ? wet * level * room[i - at] : 0;
        residual = Math.max(residual, Math.abs(y[i] - dry(i) - tail)); peak = Math.max(peak, Math.abs(tail));
      }
      return {level, residualDb: db(residual / peak), fall60: fall60(y.subarray(at))};
    }
    // An impulse through the reverb, each side measured against its room: the shortest, the default and the longest Decay at Damping 0, with
    // Size and Pre-delay at their ends, then the defaults whole (Damping 40 %, Dry/wet 22 %).
    r.rooms = [];
    for (const [decay, size, damping, predelay, mix] of [[0.2, 0, 0, 0, 100], [2.4, 50, 0, 20, 100], [20, 100, 0, 250, 100], [2.4, 50, 40, 20, 22]]) {
      const room = reverbImpulse(RATE, size, decay, damping), at = Math.round(predelay / 1000 * RATE);
      const out = await stereo([['reverb', 'on', true], ['reverb', 'size', size], ['reverb', 'decay', decay], ['reverb', 'damping', damping], ['reverb', 'predelay', predelay],
        ['reverb', 'mix', mix]], impulse, null, (at + room[0].length) / RATE + 0.1);
      r.rooms.push({decay, size, damping, predelay, mix, sides: out.map((y, index) => side(y, room[index], at, mix / 100))});
    }
    { // A stereo sound (a resonator bank before the reverb makes one) rings on its own sides: an impulse on the left alone.
      const room = reverbImpulse(RATE, 50, 0.2, 0);
      const [left, right] = await stereo([['reverb', 'on', true], ['reverb', 'decay', 0.2], ['reverb', 'damping', 0], ['reverb', 'predelay', 0], ['reverb', 'mix', 100]],
        impulse, () => 0, room[0].length / RATE + 0.1);
      r.stereo = {left: side(left, room[0], 0, 1), rightPeak: right.reduce((m, x) => Math.max(m, Math.abs(x)), 0)}; }
    return r;
  });
  console.log(engine, JSON.stringify(results));
  assert.ok(results.emptyMaxDiff < 1e-6, 'an empty chain passes the input unchanged');
  assert.ok(results.offMaxDiff < 1e-6, 'all four on the chain but off pass the input unchanged');
  assert.ok(results.orderDb > 4, `the order is the path: Dynamics then Delay sums two compressed sounds, louder than the Delay then Dynamics: +${results.orderDb.toFixed(1)} dB`);
  assert.ok(results.lowpassHighDb < -30, `a low-pass at 500 Hz cuts 8 kHz: ${results.lowpassHighDb.toFixed(1)} dB`);
  assert.ok(Math.abs(results.lowpassLowDb) < 1, `and passes 100 Hz: ${results.lowpassLowDb.toFixed(2)} dB`);
  assert.ok(results.highpassLowDb < -30, `a high-pass at 2 kHz cuts 100 Hz: ${results.highpassLowDb.toFixed(1)} dB`);
  assert.ok(results.compressDb < -24 && results.compressDb > -30, `a full-level sine over a −30 dB threshold at 20:1 comes down by the curve (−28.5 dB at its peak): ${results.compressDb.toFixed(1)} dB`);
  assert.ok(Math.abs(results.compressQuietDb - 6) < 0.5, `under the threshold only Makeup acts: ${results.compressQuietDb.toFixed(2)} dB`);
  assert.ok(Math.abs(results.delayDry - 1) < 1e-6, 'the dry impulse is at full');
  results.delayAt.forEach((at, k) => assert.ok(Math.abs(at - 4800 * (k + 1)) <= 3, `repeat ${k + 1} at ${100 * (k + 1)} ms: sample ${at}`));
  assert.ok(Math.abs(results.delayLevels[0] - 0.5) < 0.03, `the first repeat at Mix: ${results.delayLevels[0].toFixed(3)}`);
  assert.ok(Math.abs(results.delayLevels[1] - 0.25) < 0.03, `the second, Feedback times the first: ${results.delayLevels[1].toFixed(3)}`);
  assert.ok(results.delayBetween < 0.01, 'nothing between the repeats');
  assert.ok(results.reverbBeforePredelay < 1e-4, 'silence for the pre-delay');
  assert.ok(results.reverbStart > 1e-4 && results.reverbFallDb < -45 && results.reverbFallDb > -70, `the tail falls about 60 dB in its decay: ${results.reverbFallDb.toFixed(1)} dB`);
  // The room is as loud in every engine as in Chromium (measured first), whose convolver every check here has found exact; levels agree to a
  // thousandth (under 0.01 dB), well over the engines' own rounding of the room's power.
  reference ??= results.rooms.map(room => room.sides.map(side => side.level));
  results.rooms.forEach((room, row) => {
    const what = `${engine}: Decay ${room.decay} s, Size ${room.size} %, Damping ${room.damping} %, Pre-delay ${room.predelay} ms, Dry/wet ${room.mix} %`;
    const [left, right] = room.sides;
    assert.ok(Math.abs(left.level / right.level - 1) < 1e-3, `${what}: one level for both sides of the room, ${left.level} and ${right.level}`);
    room.sides.forEach((side, index) => {
      const name = index ? 'right' : 'left';
      assert.ok(side.residualDb < -80, `${what}: the ${name} side is its room and the dry, nothing else (what is left over peaks ${side.residualDb.toFixed(1)} dB under the room)`);
      assert.ok(Math.abs(side.level / reference[row][index] - 1) < 1e-3, `${what}: the ${name} side's room is as loud as Chromium makes it, ${side.level} against ${reference[row][index]}`);
      if (room.damping !== 0) return;
      assert.ok(side.fall60 !== null, `${what}: the ${name} tail falls 60 dB inside the render`);
      assert.ok(Math.abs(side.fall60 / room.decay - 1) <= 0.05, `${what}: the ${name} tail falls 60 dB in ${side.fall60} s`);
    });
  });
  assert.ok(results.stereo.left.residualDb < -80, `${engine}: a sound on the left alone rings as the left room (what is left over peaks ${results.stereo.left.residualDb.toFixed(1)} dB under it)`);
  assert.equal(results.stereo.rightPeak, 0, `${engine}: and the silent right side stays silent`);
  console.log(`effects: every check passed in ${engine}`);
} finally { await browser.close(); }
}
