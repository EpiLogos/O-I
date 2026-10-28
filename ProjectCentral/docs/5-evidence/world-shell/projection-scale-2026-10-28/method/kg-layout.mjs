// The Knowledge graph's layout world (desktop/cradle/src/knowledge/layout.ts ForceWorld, the worker's simulation), driven
// synchronously through its own verification seam (advance), over Yours' root reading (central_wiki + aikit_resolution, joined
// by graphProgress.joinGraphInputs) at ×1 and synthetic multiples. CPU time per tick, ticks to settle, and the per-tick
// publication the worker makes (structuredClone of the points, as postMessage does). Counts and timings only.
import {ROOT} from './loader.mjs'
import {readFileSync} from 'node:fs'
const S = process.argv[2]
const {ForceWorld} = await import(new URL('desktop/cradle/src/knowledge/layout.ts', ROOT))
const {joinGraphInputs} = await import(new URL('desktop/cradle/src/knowledge/graphProgress.ts', ROOT))
const reading = tag => JSON.parse(readFileSync(`${S}/private/${tag}.json`, 'utf8')).outcome.reading
const joined = joinGraphInputs({central_wiki: reading('yours-root-wiki-cold'), aikit_resolution: reading('yours-root-aikit-warm')}, [])
const multiply = (r, k) => {
  if (k === 1) return r
  const nodes = [], edges = []
  for (let c = 0; c < k; c++) { const s = c ? `~x${c}` : ''
    for (const n of r.nodes) nodes.push({...n, ref: n.ref + s})
    for (const e of r.edges) edges.push({...e, from_ref: e.from_ref + s, to_ref: e.to_ref + s}) }
  return {...r, nodes, edges, formations: []}
}
const cpu = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000 }
const out = []
for (const k of (process.argv[3] ?? '1,4,16').split(',').map(Number)) {
  const r = multiply(joined, k)
  let c0 = cpu(); const w = new ForceWorld(r); const buildMs = cpu() - c0
  const sim = w.sim; sim.stop()
  const per = []; let ticks = 0, clone = []
  const limit = +(process.argv[4] ?? 400)
  while (sim.alpha() > sim.alphaMin() && ticks < limit) {
    c0 = cpu(); sim.tick(); const pts = w.positions(); per.push(cpu() - c0)
    if (ticks % 10 === 0) { const c1 = cpu(); structuredClone({kind: 'points', generation: 1, points: pts}); clone.push(cpu() - c1) }
    ticks++
  }
  per.sort((a, b) => a - b); clone.sort((a, b) => a - b)
  const sum = per.reduce((s, v) => s + v, 0)
  out.push({multiple: k, nodes: r.nodes.length, edges: r.edges.length, sim_nodes: sim.nodes().length, build_cpu_ms: +buildMs.toFixed(1),
    ticks, settled: sim.alpha() <= sim.alphaMin(), alpha_end: +sim.alpha().toFixed(4), tick_cpu_ms_median: +per[per.length >> 1].toFixed(2), tick_cpu_ms_p95: +per[Math.floor(per.length * .95)].toFixed(2),
    settle_cpu_s: +(sum / 1000).toFixed(2), publish_clone_cpu_ms_median: +clone[clone.length >> 1].toFixed(2)})
  console.error(JSON.stringify(out.at(-1)))
}
console.log(JSON.stringify(out, null, 1))
