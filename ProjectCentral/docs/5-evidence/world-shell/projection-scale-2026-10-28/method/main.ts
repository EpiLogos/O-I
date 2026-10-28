// The projection-scale harness: the atlas's own globe engine and graph view, mounted on a Field at a chosen multiple, measured
// frame by frame. Read nothing of the owner's text into the page beyond the Field the harness is given (scratch only).
import { buildModel } from '@atlas/src/data/model';
import { GlobeEngine } from '@atlas/src/globe/engine';
import { TimeModel } from '@atlas/src/state/timeModel';
import { GraphView } from '@atlas/src/graph/view';

type Field = any;
const q = new URLSearchParams(location.search);
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const p95 = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; };
const r2 = (x: number) => Math.round(x * 100) / 100;

function multiply(f: Field, k: number): Field {
  if (k === 1) return f;
  const occ: any[] = [];
  for (let c = 0; c < k; c++) {
    const s = c ? `~x${c}` : '';
    // a copy stands a little apart from the original (a jitter of up to ~0.5°), as more records of the same places would
    for (const o of f.occurrences) occ.push({ ...o, id: o.id + s, subject_ref: o.subject_ref ? o.subject_ref + s : undefined, parallelIds: (o.parallelIds ?? []).map((p: string) => p + s),
      lat: c ? Math.max(-89, Math.min(89, o.lat + (((c * 7919 + o.lat * 13) % 100) / 100 - 0.5))) : o.lat, lon: c ? o.lon + (((c * 104729 + o.lon * 17) % 100) / 100 - 0.5) : o.lon });
  }
  return { ...f, occurrences: occ };
}

async function globe(field: Field, k: number) {
  const f = multiply(field, k);
  let t = performance.now(); const model = buildModel(f); const modelMs = performance.now() - t;
  const div = document.createElement('div'); div.className = 'stage'; document.body.append(div);
  const time = new TimeModel();
  t = performance.now();
  const cb = { onPick() {}, onHover() {}, onInteract() {}, onGrab() {}, onPalette() {} };
  const engine: any = new GlobeEngine(div, model, time, cb, false);
  await engine.ready;
  const readyMs = performance.now() - t;
  engine.running = false; engine.cancelFrame();
  const renderer = engine.renderer; const gl = renderer.getContext();
  const sync = () => { const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  const frame = () => { const a = performance.now(); engine.frame(1 / 60, true); sync(); return performance.now() - a; };
  for (let i = 0; i < 40; i++) frame();
  const pres = engine.presences;
  // how often the density texture is redrawn: counted at the renderer, by its target
  let densityPasses = 0; const setRT = renderer.setRenderTarget.bind(renderer);
  renderer.setRenderTarget = (t: any, ...rest: any[]) => { if (t === pres.densityTarget) densityPasses++; return setRT(t, ...rest); };
  // 1. at rest: no filter eases; the time model runs as the engine runs it
  const rest: number[] = []; densityPasses = 0; for (let i = 0; i < 90; i++) rest.push(frame());
  const densityAtRest = densityPasses;
  // 1b. the density pass alone (three copies of every presence splatted into the 1024x512 texture), forced
  const dens: number[] = []; for (let i = 0; i < 40; i++) { pres.densityDirty = true; const a = performance.now(); pres.renderDensity(); sync(); dens.push(performance.now() - a); }
  // 2. time playing: the density texture is redrawn every frame (its signature changes with the cursor), and a filter eases levels
  const n = model.occ.length; const targets = new Float32Array(n + 32);
  const play: number[] = [];
  for (let i = 0; i < 90; i++) {
    if (i % 30 === 0) { for (let j = 0; j < targets.length; j++) targets[j] = ((j * 2654435761 + i) % 7) < 3 ? 0.15 : 1; pres.setTargets(targets.subarray(0, pres.rel.length)); }
    pres.densityDirty = true; play.push(frame());
  }
  // 3. the same frame with the presences hidden and no density pass: what the frame costs without the occurrences
  pres.mesh.visible = false; const step = pres.renderDensity.bind(pres); pres.renderDensity = () => {};
  const bare: number[] = []; for (let i = 0; i < 90; i++) bare.push(frame());
  pres.mesh.visible = true; pres.renderDensity = step;
  // 3b. where an at-rest frame goes: the frame's CPU work without the draw, then the draw and the GPU's finish
  const cpuOnly: number[] = []; const drawSync: number[] = [];
  for (let i = 0; i < 60; i++) {
    const a = performance.now(); engine.frame(1 / 60, false); const b = performance.now();
    renderer.render(engine.scene, engine.camera); sync(); drawSync.push(performance.now() - b); cpuOnly.push(b - a);
  }
  // 3c. the draw alone, with the presences hidden (the Earth, its shell, backdrop and markers)
  pres.mesh.visible = false; const drawBare: number[] = [];
  for (let i = 0; i < 60; i++) { const b = performance.now(); renderer.render(engine.scene, engine.camera); sync(); drawBare.push(performance.now() - b); }
  pres.mesh.visible = true;
  // 4. the hover pick: CPU, every visible presence tested, once per pointer move
  const cam = engine.camera; const pk: number[] = [];
  for (let i = 0; i < 300; i++) { const a = performance.now(); pres.pick(400 + (i % 400), 300 + (i % 200), cam, engine.width, engine.height, 14); pk.push(performance.now() - a); }
  // 5. the rel easing step alone (CPU, once a frame while a filter eases)
  pres.setTargets(targets.subarray(0, pres.rel.length)); const ease: number[] = [];
  for (let i = 0; i < 60; i++) { const a = performance.now(); pres.step(1 / 60); ease.push(performance.now() - a); }
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const located = model.located.filter(Boolean).length;
  engine.dispose?.(); div.remove();
  return { surface: 'globe', multiple: k, occurrences: n, located, model_build_ms: r2(modelMs), engine_ready_ms: r2(readyMs),
    frame_rest_ms: { median: r2(median(rest)), p95: r2(p95(rest)) }, frame_playing_ms: { median: r2(median(play)), p95: r2(p95(play)) },
    frame_without_presences_ms: { median: r2(median(bare)), p95: r2(p95(bare)) }, pick_ms: { median: r2(median(pk)), p95: r2(p95(pk)) },
    ease_step_ms_per_60: r2(ease.reduce((x, y) => x + y, 0)), density_passes_in_90_rest_frames: densityAtRest, density_pass_ms: { median: r2(median(dens)), p95: r2(p95(dens)) }, frame_cpu_no_draw_ms: { median: r2(median(cpuOnly)), p95: r2(p95(cpuOnly)) },
    draw_and_finish_ms: { median: r2(median(drawSync)), p95: r2(p95(drawSync)) }, draw_without_presences_ms: { median: r2(median(drawBare)), p95: r2(p95(drawBare)) }, gpu, viewport: [engine.width, engine.height], dpr: devicePixelRatio };
}

async function graph(field: Field, k: number, maxFrames: number) {
  const f = multiply(field, k);
  const model = buildModel(f);
  const div = document.createElement('div'); div.className = 'stage'; document.body.append(div);
  const time = new TimeModel();
  let t = performance.now();
  const gv: any = new GraphView(div, model, time, { onSelect() {}, onEarth() {} }, false);
  const ctorMs = performance.now() - t;
  t = performance.now();
  gv.show(true);
  gv.setTarget({ subject: null, selected: null, emphasis: null });
  const showMs = performance.now() - t;
  if (gv.raf) { gv.raf(); gv.raf = null; }
  const ctx: CanvasRenderingContext2D = gv.ctx;
  const flush = () => ctx.getImageData(0, 0, 1, 1);
  // the settling frames, as the loop runs them: step (up to two ticks within 6 ms) then draw
  const frames: number[] = []; const stepMs: number[] = []; const drawMs: number[] = [];
  let i = 0;
  while (gv.sim.alpha() > gv.sim.alphaMin() && i < maxFrames) {
    const a = performance.now(); gv.step(1 / 60); const b = performance.now(); gv.draw(); flush(); const c = performance.now();
    frames.push(c - a); stepMs.push(b - a); drawMs.push(c - b); i++;
  }
  const settled = gv.sim.alpha() <= gv.sim.alphaMin();
  // at rest: a redraw (a hover, a pan) is a draw alone
  const rest: number[] = []; for (let j = 0; j < 40; j++) { const a = performance.now(); gv.draw(); flush(); rest.push(performance.now() - a); }
  // a tick alone
  gv.sim.alpha(0.3); const tick: number[] = []; for (let j = 0; j < 20; j++) { const a = performance.now(); gv.sim.tick(); tick.push(performance.now() - a); }
  const stats = gv.stats;
  const total = frames.reduce((s, v) => s + Math.max(v, 1000 / 60), 0);
  gv.hide(); div.remove();
  return { surface: 'atlas-graph', multiple: k, occurrences: model.occ.length, graph_nodes: gv.g.nodes.length, graph_edges: gv.g.edges.length, shown_nodes: stats.nodes, shown_edges: stats.edges,
    ctor_ms: r2(ctorMs), show_ms: r2(showMs), settle_frames: i, settled, settle_seconds_at_60fps_floor: r2(total / 1000),
    frame_settling_ms: { median: r2(median(frames)), p95: r2(p95(frames)) }, step_ms: { median: r2(median(stepMs)) }, draw_settling_ms: { median: r2(median(drawMs)), p95: r2(p95(drawMs)) },
    draw_rest_ms: { median: r2(median(rest)), p95: r2(p95(rest)) }, tick_ms: { median: r2(median(tick)), p95: r2(p95(tick)) } };
}

(async () => {
  const out: any[] = [];
  try {
    const field = await (await fetch(`/app/@fs${q.get('field')}`)).json();
    for (const k of (q.get('k') ?? '1').split(',').map(Number)) {
      if (q.get('surface') !== 'graph') out.push(await globe(field, k));
      if (q.get('surface') !== 'globe') out.push(await graph(field, k, Number(q.get('frames') ?? 1500)));
      (window as any).__partial = out;
    }
  } catch (e) { out.push({ error: String((e as Error)?.stack ?? e) }); }
  (window as any).__result = out;
})();
