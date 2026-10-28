// The Knowledge graph's canvas (desktop/cradle/src/knowledge/GraphCanvas.tsx) over Yours' root reading at a multiple, laid out by
// its own ForceWorld; redraws driven by wheel gestures; the canvas's own DEV report ('C4 canvas draw') is the measurement.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { GraphCanvas } from '@cradle/knowledge/GraphCanvas';
import { ForceWorld } from '@cradle/knowledge/layout';
import { joinGraphInputs } from '@cradle/knowledge/graphProgress';
import { graphFitCamera } from '@cradle/knowledge/graph';
const q = new URLSearchParams(location.search);
const k = Number(q.get('k') ?? 1), ticks = Number(q.get('ticks') ?? 300);
const get = async (t: string) => (await (await fetch(`/app/@fs${q.get('dir')}/${t}.json`)).json()).outcome.reading;
(async () => {
  const joined = joinGraphInputs({ central_wiki: await get('yours-root-wiki-cold'), aikit_resolution: await get('yours-root-aikit-warm') } as any, []);
  const nodes: any[] = [], edges: any[] = [];
  for (let c = 0; c < k; c++) { const s = c ? `~x${c}` : ''; for (const n of joined.nodes) nodes.push({ ...n, ref: n.ref + s }); for (const e of joined.edges) edges.push({ ...e, from_ref: e.from_ref + s, to_ref: e.to_ref + s }); }
  const reading = { ...joined, nodes, edges, formations: [] };
  const world = new ForceWorld(reading as any); const t0 = performance.now(); const positions = world.advance(ticks); const layoutMs = performance.now() - t0;
  const camera = graphFitCamera(positions, { width: 1280, height: 800 }, { minZoom: 0.05, maxZoom: 4 }) ?? { zoom: 1, x: 0, y: 0 };
  (window as any).__meta = { nodes: nodes.length, edges: edges.length, layout_ticks: ticks, layout_ms: Math.round(layoutMs) };
  const el = document.getElementById('root')!;
  createRoot(el).render(<GraphCanvas nodes={nodes} positions={positions} model={reading as any} camera={camera} focused={new Set()} labels="automatic" minZoom={0.05} maxZoom={4}
    onCamera={() => {}} onOpen={() => {}} onClear={() => {}} />);
  (window as any).__ready = true;
})().catch(e => { (window as any).__error = String(e?.stack ?? e); });
