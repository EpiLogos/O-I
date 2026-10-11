// Scaffold a new device family: manifest module, face component, test.
//
//   node scripts/scaffold-device.mjs <family> <owner> <device> <device-title> [icon]
//   e.g. node scripts/scaffold-device.mjs acme "Acme Instruments" probe "Probe" form
//
// Refuses to overwrite existing files; validates the input BEFORE writing
// (a scaffold that would fail the gate is never generated). The generated
// starter carries readings only — a scaffold never pretends a writer.

import {access, constants, readFile, writeFile} from 'node:fs/promises'
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

const [family, owner, device, deviceTitle, icon] = process.argv.slice(2)
if (!family || !owner || !device || !deviceTitle) {
  console.error('usage: node scripts/scaffold-device.mjs <family> <owner> <device> <device-title> [icon]')
  process.exit(2)
}

const scaffold = await import(pathToFileURL(join(uiRoot, 'src/inhabitants/sdk/scaffold.ts')).href)
const input = {family, owner, device, deviceTitle, ...(icon ? {icon} : {})}

const check = scaffold.checkScaffoldInput(input)
if (check.length) {
  console.error(`Refusing to scaffold:\n- ${check.join('\n- ')}`)
  process.exit(1)
}

const declared = scaffold.scaffoldDeclaration(input)
if (declared.faults.length) {
  console.error(`The declaration would fail the gate — refusing to scaffold:\n- ${declared.faults.join('\n- ')}`)
  process.exit(1)
}

const files = scaffold.scaffoldFamilyFiles(input)
let exists = false
for (const file of files) {
  try {
    await access(join(uiRoot, file.path), constants.F_OK)
    console.error(`refusing to overwrite ${file.path}`)
    exists = true
  } catch {
    // free to write
  }
}
if (exists) process.exit(1)

for (const file of files) {
  await writeFile(join(uiRoot, file.path), file.contents)
  console.log(`wrote ${file.path}`)
}

const pascal = value => value.split(/[-_]/).map(part => (part ? part[0].toUpperCase() + part.slice(1) : '')).join('')
console.log(`
Next (the loop — full procedure in src/inhabitants/sdk/DEVICE-SDK.md):
  1. Fill the family's real faces/params in src/inhabitants/${pascal(family)}FamilyManifest.ts
     (writePath ONLY where a real owner write exists; disclosure verbatim otherwise).
  2. Compose the face from the kit's controls (src/inhabitants/sdk/controls.tsx).
  3. node --test tests/${family}-family.test.mjs
  4. node scripts/validate-devices.mjs
  5. npm run build   (tsc --noEmit && vite build)
`)
