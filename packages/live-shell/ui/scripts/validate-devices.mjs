// The device law's CI voice: validate every admitted family against the
// door's manifest law and the SDK's §14 cross-checks, and confirm the icon
// module has not drifted from icon-cut.html.
//
//   node scripts/validate-devices.mjs           # table + exit code
//   node scripts/validate-devices.mjs --json    # machine-readable
//
// Exit 0 = the world passes the gate; exit 1 = faults (they name the law).

import {register} from 'node:module'
import {readFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'

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

const door = await import(pathToFileURL(join(uiRoot, 'src/inhabitants/familyManifest.ts')).href)
const schema = await import(pathToFileURL(join(uiRoot, 'src/inhabitants/manifest.ts')).href)
const world = await import(pathToFileURL(join(uiRoot, 'src/inhabitants/worldShellFamilies.ts')).href)
const sdkValidate = await import(pathToFileURL(join(uiRoot, 'src/inhabitants/sdk/validate.ts')).href)

world.loadWorldShellFamilies()

const manifestFaults = schema.validateAllInhabitantManifests()
const gate = sdkValidate.validateAdmittedWorld()

const iconCheck = spawnSync(process.execPath, [join(here, 'sync-icons.mjs'), '--check'], {encoding: 'utf8'})
const iconFault = iconCheck.status !== 0 ? iconCheck.stderr.trim() : null

const json = process.argv[2] === '--json'
const families = door.allFamilyManifests().map(manifest => manifest.id)

let faulted =
  manifestFaults.size > 0 || gate.byFamily.size > 0 || gate.cross.length > 0 || iconFault !== null

const payload = {
  families,
  manifestFaults: Object.fromEntries(manifestFaults),
  sdkFaults: Object.fromEntries(gate.byFamily),
  cross: gate.cross,
  icons: iconFault ? {fault: iconFault} : {ok: true},
  pass: !faulted,
}

if (json) {
  console.log(JSON.stringify(payload, null, 2))
} else {
  console.log(`admitted families: ${families.join(', ')}`)
  for (const [family, faults] of manifestFaults) {
    faulted = true
    console.error(`\n${family} (door validator):`)
    for (const fault of faults) console.error(`  - ${fault}`)
  }
  for (const [family, faults] of gate.byFamily) {
    faulted = true
    console.error(`\n${family} (device gate):`)
    for (const fault of faults) console.error(`  - ${fault}`)
  }
  if (gate.cross.length) {
    faulted = true
    console.error('\ncross-family:')
    for (const fault of gate.cross) console.error(`  - ${fault}`)
  }
  if (iconFault) {
    faulted = true
    console.error(`\nicons: ${iconFault}`)
  }
  if (!faulted) console.log('device gate: PASS (manifests, §14 cross-checks, icon sync)')
}

process.exit(faulted ? 1 : 0)
