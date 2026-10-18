// The torus's four effects as a real browser sounds them (native-field/presentationEffects.ts): each check renders a known signal
// through the graph in an OfflineAudioContext at the device's 48 kHz and measures what comes out. Off passes the input unchanged;
// the filter cuts what its type cuts; the compressor lowers what is over its threshold; the delay repeats after its time; the reverb's
// tail falls 60 dB in its decay. Run: node tests/native-expression-effects-browser.mjs (headless Chromium and WebKit, Playwright; the
// desktop host is WebKit on macOS).
import {build} from 'esbuild';
import {chromium, webkit} from 'playwright';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const src = resolve('expressions-app/field-studies-journeys/src/native-field');
const bundle = await build({stdin: {contents: `export {PresentationEffects} from './presentationEffects.ts'; export {initialEffects, editEffects, editEffectChain} from './effectsLaw.ts';`,
  resolveDir: src, loader: 'ts'}, bundle: true, format: 'iife', globalName: 'effects', write: false});
for (const [engine, launcher] of [['Chromium', chromium], ['WebKit', webkit]]) {
const browser = await launcher.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><title>effects</title>');
  await page.addScriptTag({content: bundle.outputFiles[0].text});
  const results = await page.evaluate(async () => {
    const {PresentationEffects, initialEffects, editEffects, editEffectChain} = window.effects;
    const RATE = 48000;
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
  console.log(`effects: every check passed in ${engine}`);
} finally { await browser.close(); }
}
