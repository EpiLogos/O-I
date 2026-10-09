/** The scaffolder — a new family's starting files, generated to pass the
 * gate.
 *
 * `scaffoldFamilyFiles` is PURE: it returns the files' paths and contents;
 * the CLI (scripts/scaffold-device.mjs) writes them and refuses overwrites.
 * The generated starter device carries READINGS ONLY — a scaffold never
 * pretends a writer; the commented examples show exactly where a writePath
 * lands once the owner write exists. The generated test runs the real gate.
 *
 * The templates follow the house module shape: a loader function named
 * `load<Family>Family` (idempotent — the door refuses only differing
 * contents), a face component beside it, and a test in the tests/ loader
 * style. */

import type {IconName} from './icons.ts'
import {ICON_NAMES, isIconName} from './icons.ts'
import type {FamilyDeclaration} from './define.ts'
import {buildFamilyDeclaration} from './define.ts'
import {validateDeclaredFamily} from './validate.ts'

export interface ScaffoldInput {
  /** Family id: lowercase kebab (`acme`). */
  readonly family: string
  /** The native owner the family belongs to (the disclosure law). */
  readonly owner: string
  /** Starter device id: lowercase kebab (`probe`). */
  readonly device: string
  /** Starter device title (the plate's name). */
  readonly deviceTitle: string
  /** The device's mark from the cut. Default `form`. */
  readonly icon?: string
}

export interface ScaffoldFile {
  /** Path relative to the ui package root (`packages/live-shell/ui/`). */
  readonly path: string
  readonly contents: string
}

const pascal = (value: string): string =>
  value.split(/[-_]/).map(part => part ? part[0]!.toUpperCase() + part.slice(1) : '').join('')

const FAMILY_ID = /^[a-z][a-z0-9-]*$/
const DEVICE_ID = /^[a-z][a-z0-9-]*$/

/** Faults for a malformed input (id shapes, icon law). Empty = scaffoldable. */
export function checkScaffoldInput(input: ScaffoldInput): readonly string[] {
  const faults: string[] = []
  if (!FAMILY_ID.test(input.family)) faults.push(`family id must be lowercase kebab, got "${input.family}"`)
  if (!DEVICE_ID.test(input.device)) faults.push(`device id must be lowercase kebab, got "${input.device}"`)
  if (!input.owner.trim()) faults.push('a family names its native owner')
  if (!input.deviceTitle.trim()) faults.push('a device declares its human title')
  const icon = input.icon ?? 'form'
  if (!isIconName(icon)) {
    faults.push(`icon "${icon}" is not a mark of the cut — pick one of: ${ICON_NAMES.join(', ')}`)
  }
  return faults
}

// ---------------------------------------------------------------------------
// templates

const manifestTemplate = (input: ScaffoldInput): string => {
  const familyPascal = pascal(input.family)
  const icon: IconName = (input.icon ?? 'form') as IconName
  return `import {admitFamily, reading} from './sdk/define.ts'

/** ${familyPascal} — ${input.owner}'s device family (WORLD-SHELL-DESIGN §12).
 *
 * Authored by the native owner's lane; the shell's door is neutral, the
 * keys are held by owners. One family, four surfaces and nowhere else
 * (§16): browser categories, rack faces, projection adapters, inspectors —
 * plus time bindings and telemetry.
 *
 * Honesty law: a param row carries writePath ONLY where a real owner write
 * exists today; every other row is a reading (with a verbatim disclosure
 * when the source itself is missing). This starter carries readings only —
 * replace them with the family's actual addresses as owners land.
 *
 * The full procedure — gaps, scaffold, implement, validate, verify, return —
 * is DEVICE-SDK.md beside this module's sdk/ directory. */
export function load${familyPascal}Family(): void {
  admitFamily({
    id: '${input.family}',
    owner: '${input.owner}',
    browser: ['${input.family}'],
    paramsGrammar: '${input.family}/parameter-address/v1',
    devices: [
      {
        id: '${input.device}',
        title: '${input.deviceTitle}',
        icon: '${icon}',
        note: 'Starter face: honest readings over the family\\'s own owner ops. Name the kernel ops this face reads (op <op>) and what waits for its writer.',
        params: [
          reading({key: 'readiness', title: 'Readiness', type: 'string', disclosure: 'No owner reading wired yet — this row discloses absence until the op lands.'}),
          // A write path lands ONLY with its owner writer, e.g.:
          // numberParam({key: 'level', title: 'Level', type: 'number', range: {min: 0, max: 1}, writePath: 'shell.setLevel', icon: 'form'}),
        ],
      },
    ],
  })
}
`
}

const faceTemplate = (input: ScaffoldInput): string => {
  const familyPascal = pascal(input.family)
  const devicePascal = pascal(input.device)
  return `import type {DeviceFaceAperture} from './sdk/controls.tsx'
import {Disclosure, FacePlate, ReadingRow} from './sdk/controls.tsx'
import {facePresentation, sdkParamRows} from './sdk/define.ts'
import {load${familyPascal}Family} from './${familyPascal}FamilyManifest.ts'

/** The ${input.device} face of the ${input.family} family — composed from
 * the kit's controls against the proven aperture. The face NEVER dispatches
 * a write of its own: readings render honestly; writes (when the owner
 * lands them) bind through useFaceDrafts mapped onto the aperture's apply. */
export function ${familyPascal}${devicePascal}Face({aperture}: {aperture: DeviceFaceAperture}) {
  load${familyPascal}Family() // idempotent admission
  const presentation = facePresentation('${input.family}', '${input.device}')
  if (!presentation) throw new Error('The ${input.family} family has not admitted the ${input.device} face')
  const rows = sdkParamRows('${input.family}').filter(row => row.deviceInstance === '${input.device}')
  const state = (aperture.reading ?? {}) as Record<string, string | number | boolean>
  return (
    <FacePlate presentation={presentation} power="unknown">
      {rows.map(row => <ReadingRow key={row.key} param={row} value={state[row.key]} />)}
      <Disclosure
        title="${input.deviceTitle}"
        instanceRef="${input.family}:${input.device}"
        owner={presentation.owner}
      />
    </FacePlate>
  )
}
`
}

const testTemplate = (input: ScaffoldInput): string => {
  const familyPascal = pascal(input.family)
  return `import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production modules in memory (the house loader pattern: .ts/.tsx
// transpiled, CSS stubbed, expressions-boundary resolved to source).
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', root).href
register(\`data:text/javascript,\${encodeURIComponent(\`
import ts from \${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = \${JSON.stringify(boundary)};
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
}\`)}\`, import.meta.url)

const door = await import('../src/inhabitants/familyManifest.ts')
const sdkDefine = await import('../src/inhabitants/sdk/define.ts')
const sdkValidate = await import('../src/inhabitants/sdk/validate.ts')
const family = await import('../src/inhabitants/${familyPascal}FamilyManifest.ts')

test('the ${input.family} family admits through the kit and passes the gate', () => {
  door.resetFamilyManifestsForTest()
  family.load${familyPascal}Family()
  const manifest = door.familyManifest('${input.family}')
  assert.ok(manifest, 'the family is admitted at the door')
  assert.deepEqual([...sdkValidate.validateInhabitantManifest(manifest)], [], 'the manifest passes the door validator')
  const world = sdkValidate.validateAdmittedWorld()
  assert.deepEqual(world.byFamily.get('${input.family}') ?? [], [], 'the family passes the SDK gate')
  // §14: every kit row addresses a declared face of the family.
  const faceIds = new Set(manifest.faces.map(face => face.id))
  for (const row of sdkDefine.sdkParamRows('${input.family}')) {
    assert.ok(faceIds.has(row.deviceInstance), \\\`row \\\${row.key} addresses declared face \\\${row.deviceInstance}\\\`)
  }
  // Honesty: the scaffold carries no writePath — a starter never pretends a writer.
  for (const row of sdkDefine.sdkParamRows('${input.family}')) {
    assert.equal(row.writePath, undefined, \\\`starter row \\\${row.key} is a reading\\\`)
  }
})
`
}

// ---------------------------------------------------------------------------

/** The family declaration the scaffold will admit, built and validated —
 * exposed so the CLI and tests can check BEFORE any file is written. */
export function scaffoldDeclaration(input: ScaffoldInput): {
  declaration: FamilyDeclaration
  manifest: ReturnType<typeof buildFamilyDeclaration>['manifest']
  params: ReturnType<typeof buildFamilyDeclaration>['params']
  faults: readonly string[]
} {
  const declaration: FamilyDeclaration = {
    id: input.family,
    owner: input.owner,
    browser: [input.family],
    paramsGrammar: `${input.family}/parameter-address/v1`,
    devices: [
      {
        id: input.device,
        title: input.deviceTitle,
        icon: (input.icon ?? 'form') as IconName,
        note: 'Starter face: honest readings over the family\'s own owner ops. Name the kernel ops this face reads (op <op>) and what waits for its writer.',
        params: [
          {key: 'readiness', title: 'Readiness', type: 'string', disclosure: 'No owner reading wired yet — this row discloses absence until the op lands.'},
        ],
      },
    ],
  }
  const built = buildFamilyDeclaration(declaration)
  return {declaration, manifest: built.manifest, params: built.params, faults: validateDeclaredFamily(declaration, built.manifest, built.params)}
}

/** The scaffold's files, in write order. Throws when the input breaks the
 * law — a scaffold that would fail the gate is never generated. */
export function scaffoldFamilyFiles(input: ScaffoldInput): readonly ScaffoldFile[] {
  const faults = checkScaffoldInput(input)
  if (faults.length) throw new Error(`Refusing to scaffold:\n- ${faults.join('\n- ')}`)
  const familyPascal = pascal(input.family)
  return [
    {path: `src/inhabitants/${familyPascal}FamilyManifest.ts`, contents: manifestTemplate(input)},
    {path: `src/inhabitants/${familyPascal}${pascal(input.device)}Face.tsx`, contents: faceTemplate(input)},
    {path: `tests/${input.family}-family.test.mjs`, contents: testTemplate(input)},
  ]
}
