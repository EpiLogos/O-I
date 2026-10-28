// Transfer-side cost: the bytes of the root AIKit reading at a multiple and V8's JSON.parse of them (CPU), as the shell parses an op reply.
import {readFileSync} from 'node:fs'
const S = process.argv[2]
const doc = JSON.parse(readFileSync(`${S}/private/yours-root-aikit-warm.json`, 'utf8'))
const r = doc.outcome.reading
const out = []
for (const k of [1, 4, 16, 64]) {
  const nodes = [], edges = []
  for (let c = 0; c < k; c++) { const s = c ? `~x${c}` : ''; for (const n of r.nodes) nodes.push({...n, ref: n.ref + s}); for (const e of r.edges) edges.push({...e, from_ref: e.from_ref + s, to_ref: e.to_ref + s}) }
  const text = JSON.stringify({ok: true, outcome: {result: 'graph_reading', reading: {...r, nodes, edges}}})
  const times = []
  for (let i = 0; i < 7; i++) { const a = process.cpuUsage(); JSON.parse(text); const b = process.cpuUsage(a); times.push((b.user + b.system) / 1000) }
  times.sort((a, b) => a - b)
  out.push({multiple: k, nodes: nodes.length, edges: edges.length, bytes: text.length, bytes_per_node: Math.round(text.length / nodes.length), json_parse_cpu_ms_median: +times[3].toFixed(1)})
}
console.log(JSON.stringify(out))
