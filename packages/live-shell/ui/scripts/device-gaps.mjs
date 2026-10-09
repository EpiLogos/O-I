// The development loop's front door: join the capability matrices with the
// admitted device surface, so an agent (or the owner) can point at a gap
// and see what the shell already declares for it.
//
//   node scripts/device-gaps.mjs                 # gap table (text)
//   node scripts/device-gaps.mjs --json          # machine-readable
//   node scripts/device-gaps.mjs --all           # include landed capabilities
//   node scripts/device-gaps.mjs --family central
//
// Sources (read, never rewritten — the catalogue law: this is a discovery
// join, NOT another capability matrix):
// - suite/capability-matrix.json   the S-level recovery matrix (standing:
//   landed / partial / claimed-only / historical)
// - suite/product-capabilities.json  the six products' capability records
//   (need / operation / outcome per capability ref)
// - the door: admitted family manifests + the SDK's kit rows
//
// A row's "surface" is what the family's devices already declare; the gap
// between the capability's need and that surface is the work candidate.
// Craft and acceptance stay governed by the sources themselves.

import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const uiRoot = join(here, '..')
const root = join(uiRoot, '..', '..', '..')
const compiler = join(uiRoot, 'node_modules', 'typescript', 'lib', 'typescript.js')
const boundary = pathToFileURL(join(root, 'packages', 'expressions-boundary', 'src') + '/').href

register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(pathToFileURL(compiler).href)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(s, c, n) {
  if (s.startsWith('@epilogos/expressions-boundary/')) return n(BOUNDARY + s.slice('@epilogos/expressions-boundary/'.length) + '.ts', c);
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const includeLanded = args.includes('--all')
const familyFilter = args.includes('--family') ? args[args.indexOf('--family') + 1] : null

// The door, loaded with the real world-shell families.
const door = await import(pathToFileURL(join(uiRoot, 'src/inhabitants/familyManifest.ts')).href)
const schema = await import(pathToFileURL(join(uiRoot, 'src/inhabitants/manifest.ts')).href)
const world = await import(pathToFileURL(join(uiRoot, 'src/inhabitants/worldShellFamilies.ts')).href)
const sdkDefine = await import(pathToFileURL(join(uiRoot, 'src/inhabitants/sdk/define.ts')).href)
world.loadWorldShellFamilies()

// Product scope → family id on the door (the six carvings). Suite and O-I
// records name no single family; they render with `(no family scope)`.
const PRODUCT_FAMILY = {
  central: 'central',
  actuation: 'actuation',
  'ai-kit': 'ai-kit',
  'software-factory': 'software-factory',
  workcell: 'workcell',
  'ql-mef': 'quaternal-logic',
}

const matrix = JSON.parse(await readFile(join(root, 'suite', 'capability-matrix.json'), 'utf8'))
const catalogue = JSON.parse(await readFile(join(root, 'suite', 'product-capabilities.json'), 'utf8'))

// capability ref → the products' need/operation records that cite it.
const needsByRef = new Map()
for (const record of catalogue.records ?? []) {
  for (const ref of record.capability_refs ?? []) {
    if (!needsByRef.has(ref)) needsByRef.set(ref, [])
    needsByRef.get(ref).push({owner_id: record.owner_id, need: record.need, operation: record.operation})
  }
}

const surfaceOf = familyId => {
  // The COMPOSED manifest (base + declared extensions) — what the family
  // actually fields, not just its owner-authored base.
  const manifest = schema.inhabitantManifest(familyId)
  if (!manifest) return {admitted: false, faces: [], params: []}
  return {
    admitted: true,
    faces: manifest.faces.map(face => face.id),
    params: sdkDefine.sdkParamRows(familyId).map(row => `${row.deviceInstance}/${row.key}${row.writePath ? '' : ' (reading)'}`),
  }
}

const rows = []
for (const record of matrix.records ?? []) {
  if (!includeLanded && record.standing === 'landed') continue
  if (includeLanded && record.standing === 'historical') continue
  // Family scope from the record's own product scope.
  const familyId = PRODUCT_FAMILY[String(record.product ?? '').toLowerCase()] ?? null
  if (familyFilter && familyId !== familyFilter) continue
  const needs = needsByRef.get(record.id) ?? []
  const surface = familyId ? surfaceOf(familyId) : {admitted: false, faces: [], params: []}
  rows.push({
    id: record.id,
    standing: record.standing,
    capability: record.claim ?? '',
    product: record.product ?? '',
    family: familyId ?? '(no family scope)',
    family_admitted: surface.admitted,
    faces: surface.faces,
    params: surface.params,
    needs: needs.map(need => ({product: need.owner_id, need: need.need})),
  })
}

if (asJson) {
  console.log(JSON.stringify({
    sources: {
      matrix: 'suite/capability-matrix.json',
      catalogue: 'suite/product-capabilities.json',
      door: 'packages/live-shell/ui/src/inhabitants (loaded: world-shell families)',
    },
    standing_rule: matrix.standing_rule,
    rows,
  }, null, 2))
} else {
  console.log(`device gaps — ${rows.length} candidate capabilities (standing filter: ${includeLanded ? 'all non-historical' : 'partial + claimed-only'})\n`)
  for (const row of rows) {
    console.log(`${row.id}  [${row.standing}]`)
    console.log(`  ${row.capability}`)
    console.log(`  family: ${row.family}${row.family_admitted ? ' (admitted)' : ' (NOT admitted at the door)'}`)
    if (row.faces.length) console.log(`  faces:  ${row.faces.join(', ')}`)
    if (row.params.length) console.log(`  params: ${row.params.join(', ')}`)
    for (const need of row.needs.slice(0, 2)) console.log(`  need (${need.product}): ${String(need.need ?? '').slice(0, 140)}`)
    console.log('')
  }
  console.log(`Read the thread law in the new-shell lane's UX-SPINE-ALIGNMENT.md; the procedure is src/inhabitants/sdk/DEVICE-SDK.md.`)
}
