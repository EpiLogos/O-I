// Compose Yours' Graph readings through the atlas's own code (composeSuite → buildModel → buildGraph), at ×1 and synthetic multiples.
// Prints counts and CPU timings only.
import {ROOT} from './loader.mjs'
import {readFileSync} from 'node:fs'
const S = process.argv[2]
const atlas = new URL('packages/live-shell/ui/src/projections/atlas/', ROOT)
const {declarationsFromWiki} = await import(new URL('provider/suiteProvider.ts', atlas))
const {composeSuite, inputOfReading} = await import(new URL('provider/suiteReading.ts', atlas))
const {buildModel} = await import(new URL('src/data/model.ts', atlas))
const {buildGraph} = await import(new URL('src/graph/build.ts', atlas))
const reading = tag => JSON.parse(readFileSync(`${S}/private/${tag}.json`, 'utf8')).outcome.reading
const base = {central_wiki: reading('yours-root-wiki-cold'), shared_field: reading('yours-root-shared-1'), aikit_resolution: reading('yours-root-aikit-warm')}
const wiki = readFileSync('<world>/Control/agents/wiki/wiki.json', 'utf8')
const basis = {path: 'Control/agents/wiki/wiki.json', revision: 'r', location: {schema: 'central.path-ref/v1', ref: 'ref:Control/agents/wiki/wiki.json', root: 'Control', path: 'Control/agents/wiki/wiki.json'}}
const declarations = declarationsFromWiki(wiki, basis)
// ×k: every owner row and edge repeated k times under a suffixed ref (copy 0 keeps the owner's own ref); registers repeat too.
const multiply = (r, k) => {
  if (k === 1) return r
  const nodes = [], edges = []
  for (let c = 0; c < k; c++) {
    const sfx = c === 0 ? '' : `~x${c}`
    for (const n of r.nodes) nodes.push({...n, ref: n.ref + sfx})
    for (const e of r.edges) edges.push({...e, from_ref: e.from_ref + sfx, to_ref: e.to_ref + sfx})
  }
  return {...r, nodes, edges}
}
const cpu = f => { const a = process.cpuUsage(); const t = performance.now(); const v = f(); const b = process.cpuUsage(a); return [v, (b.user + b.system) / 1000, performance.now() - t] }
const out = []
for (const k of (process.argv[3] ?? '1,4,16,64').split(',').map(Number)) {
  const inputs = Object.fromEntries(Object.entries(base).map(([name, r]) => [name, inputOfReading(name, multiply(r, k))]))
  const [comp, composeCpu] = cpu(() => composeSuite({inputs, declarations, readAt: new Date('2026-10-28T18:00:00Z')}))
  const field = comp.field
  const [model, modelCpu] = cpu(() => buildModel(field))
  const [graph, graphCpu] = cpu(() => buildGraph(model))
  const byKind = {}; for (const n of graph.nodes) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1
  const eKind = {}; for (const e of graph.edges) eKind[e.kind] = (eKind[e.kind] ?? 0) + 1
  out.push({multiple: k, owner_rows: Object.values(inputs).reduce((s, i) => s + (i.reading?.nodes.length ?? 0), 0), owner_edges: Object.values(inputs).reduce((s, i) => s + (i.reading?.edges.length ?? 0), 0),
    declarations: {state: declarations.state, places: declarations.places.length, times: Object.keys(declarations.times).length, types: Object.keys(declarations.types).length},
    field: {occurrences: field.occurrences.length, located: field.occurrences.filter(o => o.geoPrecision !== 'none').length, dated: field.occurrences.filter(o => o.dated !== false).length,
      archetypes: field.archetypes.length, families: field.families.length, parallels: (field.parallels ?? []).length, joins: (field.joins ?? []).length},
    model: {occ: model.occ.length, located: model.located.filter(Boolean).length},
    graph: {nodes: graph.nodes.length, edges: graph.edges.length, nodes_by_kind: byKind, edges_by_kind: eKind},
    cpu_ms: {compose: +composeCpu.toFixed(1), model: +modelCpu.toFixed(1), graph_build: +graphCpu.toFixed(1)}})
}
console.log(JSON.stringify(out, null, 1))
