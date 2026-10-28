// Yours' composed Field (the atlas's own composition of the owners' readings), with places and dates it does not declare today
// supplied from the founding corpus's positions and years (cycled), so the globe can be measured at Yours' counts. Scratch only.
import {ROOT} from './loader.mjs'
import {readFileSync, writeFileSync} from 'node:fs'
const S = process.argv[2]
const atlas = new URL('packages/live-shell/ui/src/projections/atlas/', ROOT)
const {declarationsFromWiki} = await import(new URL('provider/suiteProvider.ts', atlas))
const {composeSuite, inputOfReading} = await import(new URL('provider/suiteReading.ts', atlas))
const reading = tag => JSON.parse(readFileSync(`${S}/private/${tag}.json`, 'utf8')).outcome.reading
const inputs = {central_wiki: inputOfReading('central_wiki', reading('yours-root-wiki-cold')), shared_field: inputOfReading('shared_field', reading('yours-root-shared-1')), aikit_resolution: inputOfReading('aikit_resolution', reading('yours-root-aikit-warm'))}
const basis = {path: 'Control/agents/wiki/wiki.json', revision: 'r', location: {schema: 'central.path-ref/v1', ref: 'ref:Control/agents/wiki/wiki.json', root: 'Control', path: 'Control/agents/wiki/wiki.json'}}
const declarations = declarationsFromWiki(readFileSync('<world>/Control/agents/wiki/wiki.json', 'utf8'), basis)
const {field} = composeSuite({inputs, declarations, readAt: new Date('2026-10-28T18:00:00Z')})
const founding = JSON.parse(readFileSync('<archetypal-earth>/dist/data/field.json', 'utf8'))
const pos = founding.occurrences.filter(o => o.geoPrecision !== 'none').map(o => [o.lat, o.lon, o.geoPrecision, o.year])
writeFileSync(`${S}/private/founding-positions.json`, JSON.stringify(pos))
let i = 0
let yMin = Infinity, yMax = -Infinity
for (const o of field.occurrences) {
  const [lat, lon, prec, year] = pos[i++ % pos.length]
  o.lat = lat; o.lon = lon; o.geoPrecision = prec; o.year = year; delete o.dated; o.yearDisplay = String(year)
  yMin = Math.min(yMin, year); yMax = Math.max(yMax, year)
}
field.meta.yearMin = yMin; field.meta.yearMax = yMax
writeFileSync(`${S}/private/field-yours-placed.json`, JSON.stringify(field))
writeFileSync(`${S}/private/field-founding.json`, JSON.stringify(founding))
console.log(JSON.stringify({yours: field.occurrences.length, families: field.families.length, archetypes: field.archetypes.length, founding: founding.occurrences.length, positions: pos.length, yMin, yMax}))
