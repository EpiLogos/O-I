// Sync the device-SDK icon module from icon-cut.html — the shell specimen
// that owns the icon language (owner direction: device faces follow the
// icon sets of icon-cut.html).
//
//   node scripts/sync-icons.mjs            regenerate src/inhabitants/sdk/icons.ts
//   node scripts/sync-icons.mjs --check    exit 1 when the module has drifted
//
// The module carries a generated provenance header; hand edits are overruns.
// Run from anywhere; the specimen path is resolved against this file.
//
// What is extracted, and how (everything byte-faithful to the specimen):
// - `ICON_MARKS` — the specimen's `const I = {…}` dictionary, source-verbatim.
// - `CHEVRON_FOLD` / `CHEVRON_POP` — the specimen's FOLD / POP constants
//   (the device header's fold chevron and pop-out mark), source-verbatim.
// - `KIND_SHAPES` — the `kindShape()` kind marks (the filled node drawings
//   with their facet shading). kindShape is pure, so the sync evaluates the
//   extracted function and stores each kind's RESOLVED inner markup — the
//   exact bytes the specimen renders at runtime; renderKindShape reproduces
//   the specimen's wrapper exactly.
// - `WOOD_MARKS` — the woodcut marks (skill / skillset / method /
//   methodology, in both sets). Their path templates interpolate helper
//   coordinates (swordAt), so the sync evaluates the extracted pure
//   definitions and stores each mark's resolved {tf, line, hatch, small};
//   renderWood reproduces the specimen's size/state/stroke rule verbatim.

import {readFile, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const uiRoot = join(here, '..')
// The specimen lives in the new-shell lane of the reverse-engineering
// campaign (outside this repository) — resolvable on the working machines.
const SPECIMEN_CANDIDATES = [
  join(uiRoot, '..', '..', '..', '..', 'Work', 'reverse-engineering', '2026-10-07-techne-instrument-re', 'new-shell', 'icon-cut.html'),
  join(uiRoot, '..', '..', '..', '..', '..', 'Work', 'reverse-engineering', '2026-10-07-techne-instrument-re', 'new-shell', 'icon-cut.html'),
  '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/icon-cut.html',
]
const OUT = join(uiRoot, 'src', 'inhabitants', 'sdk', 'icons.ts')

async function readSpecimen() {
  for (const candidate of SPECIMEN_CANDIDATES) {
    try {
      return await readFile(candidate, 'utf8')
    } catch {
      // next candidate
    }
  }
  throw new Error(`icon-cut.html not found — looked in:\n  ${SPECIMEN_CANDIDATES.join('\n  ')}`)
}

/** Slice a balanced `{…}` (or function) block starting at `open`, honouring
 * string literals so nested braces inside templates do not miscount. */
function sliceBalanced(source, open) {
  let depth = 0
  let inString = false
  let quote = ''
  for (let i = open; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === quote) inString = false
      continue
    }
    if (ch === '`' || ch === '"' || ch === "'") {
      inString = true
      quote = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  throw new Error('unbalanced block in icon-cut.html extraction')
}

/** Extract `const I = { … };` verbatim from the specimen. */
function extractMarks(specimen) {
  const start = specimen.indexOf('const I = {')
  if (start < 0) throw new Error('icon-cut.html carries no `const I = {` icon dictionary')
  const open = specimen.indexOf('{', start)
  return sliceBalanced(specimen, open)
}

/** Extract `const NAME = …;` (template literal) verbatim — for FOLD / POP. */
function extractConstTemplate(specimen, name) {
  const start = specimen.indexOf(`const ${name} = `)
  if (start < 0) throw new Error(`icon-cut.html carries no \`const ${name}\``)
  const tick = specimen.indexOf('`', start)
  const end = specimen.indexOf('`;', tick)
  if (tick < 0 || end < 0) throw new Error(`const ${name} is not a template literal`)
  return specimen.slice(tick + 1, end)
}

/** Extract a top-level `function name(…) {…}` verbatim. */
function extractFunction(specimen, name) {
  const start = specimen.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`icon-cut.html carries no function ${name}`)
  const open = specimen.indexOf('{', start)
  return specimen.slice(start, open) + sliceBalanced(specimen, open)
}

/** Extract a top-level `const name = …;` statement verbatim (any value
 * shape — object literal, arrow function, array), by scanning to the `;`
 * that closes it at depth zero. */
function extractStatement(specimen, name) {
  const start = specimen.indexOf(`const ${name} = `)
  if (start < 0) throw new Error(`icon-cut.html carries no const ${name}`)
  let depth = 0
  let inString = false
  let quote = ''
  for (let i = start; i < specimen.length; i++) {
    const ch = specimen[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === quote) inString = false
      continue
    }
    if (ch === '`' || ch === '"' || ch === "'") {
      inString = true
      quote = ch
      continue
    }
    if (ch === '(' || ch === '{' || ch === '[') depth++
    else if (ch === ')' || ch === '}' || ch === ']') depth--
    else if (ch === ';' && depth === 0) return specimen.slice(start, i + 1)
  }
  throw new Error(`const ${name} is unterminated in icon-cut.html`)
}

/** Extract a `const NAME = {…}` object literal verbatim. */
function extractObject(specimen, name) {
  const start = specimen.indexOf(`const ${name} = {`)
  if (start < 0) throw new Error(`icon-cut.html carries no const ${name}`)
  const open = specimen.indexOf('{', start)
  return `const ${name} = ${sliceBalanced(specimen, open)}`
}

/** Validate each mark: an entry is `name:\`<svg … />\`` template source; keep
 * the raw source text so the generated module is byte-faithful. */
function parseMarks(block) {
  const marks = []
  // Entries look like `  name:`<…>`,`  — template-literal values only.
  const entry = /([A-Za-z][A-Za-z0-9]*)\s*:\s*`((?:[^`\\]|\\.)*)`/g
  let match
  while ((match = entry.exec(block))) {
    const [, name, body] = match
    if (!body || !body.includes('<')) continue
    marks.push({name, body})
  }
  if (!marks.length) throw new Error('no icon marks parsed from the specimen dictionary')
  return marks
}

/** Evaluate the specimen's pure kind/wood definitions and resolve them to
 * the exact strings the specimen renders at runtime. */
function resolveSpecimenDrawings(specimen) {
  const kindShapeFn = extractFunction(specimen, 'kindShape')
  const ksSrc = extractStatement(specimen, 'ks')
  const swordAtFn = extractStatement(specimen, 'swordAt')
  const rackStmt = extractStatement(specimen, 'RACK')
  const woodObj = extractObject(specimen, 'WOOD')
  const woodPenObj = extractObject(specimen, 'WOOD_PEN')

  const sandbox = new Function(
    `${swordAtFn}\n${rackStmt}\n${woodObj}\n${woodPenObj}\n${kindShapeFn}\n${ksSrc}\n` +
    'return {kindShape, ks, WOOD, WOOD_PEN}',
  )()

  // kindShape's wrapper is exactly this prefix/suffix at any size s.
  const wrapper = s => [`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke-linejoin="round">`, '</svg>']
  const kindShapes = {}
  for (const [kind] of sandbox.ks) {
    const [open, close] = wrapper(16)
    const svg = sandbox.kindShape(kind, 16)
    if (!svg.startsWith(open) || !svg.endsWith(close)) {
      throw new Error(`kindShape("${kind}") does not wear the specimen's expected wrapper`)
    }
    kindShapes[kind] = svg.slice(open.length, svg.length - close.length)
  }
  return {kindShapes, wood: sandbox.WOOD, woodPen: sandbox.WOOD_PEN}
}

function render(marks, chevrons, resolved) {
  const rows = marks.map(({name, body}) => `  ${name}: \`${body}\`,`).join('\n')
  const names = marks.map(({name}) => `  | '${name}'`).join('\n')
  const kindRows = Object.entries(resolved.kindShapes)
    .map(([kind, inner]) => `  '${kind}':\n    '${inner.replaceAll("'", "\\'")}',`)
    .join('\n')
  const kindNames = Object.keys(resolved.kindShapes).map(kind => `  | '${kind}'`).join('\n')
  const woodJson = JSON.stringify({blade: resolved.wood, pen: resolved.woodPen}, null, 2)
    .replaceAll('\n', '\n  ')
  return `/** The shell icon language, generated from icon-cut.html.
 *
 * GENERATED by scripts/sync-icons.mjs — regenerate, never hand-edit
 * (derived-surfaces law; the source of truth is the specimen's icon
 * dictionary and its svg() wrapper, byte-faithful below).
 *
 * The device-SDK icon law: a face uses a NAMED mark from this module
 * (renderIcon / <Icon>), never an inline SVG invention. The mark vocabulary
 * is the owner's cut; extending it means cutting new marks into
 * icon-cut.html and re-running the sync, so the specimen stays the one
 * place the language is readable.
 *
 * Alongside the dictionary this module carries the specimen's other
 * drawings, resolved by the same sync from the same file:
 * - CHEVRON_FOLD / CHEVRON_POP — the device header's fold and pop-out marks.
 * - KIND_SHAPES + renderKindShape — the filled kind marks (facet-shaded
 *   node drawings), each kind's inner markup resolved exactly as the
 *   specimen renders it.
 * - WOOD_MARKS + renderWood — the woodcut marks (skill / skillset / method
 *   / methodology, blade and pen sets), with the specimen's own
 *   size/state/stroke rule reproduced verbatim in renderWood.
 *
 * Pure: no store, no view, no I/O. */

/** Every mark of the cut, verbatim inner-SVG (24×24 grid, currentColor).
 * Some marks set their own fills; the wrapper below supplies the stroke
 * grammar for the rest. */
export const ICON_MARKS = {
${rows}
} as const

/** The union of mark names — the only icons a face may declare. */
export type IconName = keyof typeof ICON_MARKS

export function isIconName(candidate: string): candidate is IconName {
  return Object.prototype.hasOwnProperty.call(ICON_MARKS, candidate)
}

export const ICON_NAMES: readonly IconName[] = Object.keys(ICON_MARKS) as IconName[]

export interface IconOptions {
  /** Stroke width; the specimen's default 1.7. */
  readonly sw?: number
  /** Keep the wrapper from setting fill="none" (marks that paint themselves
   * set their own fills inside; this option is for wrapper-level fills). */
  readonly fill?: boolean
}

/** The specimen's svg() wrapper, exactly: 24×24 viewBox, round caps and
 * joins, currentColor stroke. */
export function renderIcon(name: IconName, size = 16, options: IconOptions = {}): string {
  const sw = options.sw ?? 1.7
  const fill = options.fill ? '' : ' fill="none"'
  return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24"\${fill} stroke="currentColor" stroke-width="\${sw}" stroke-linecap="round" stroke-linejoin="round">\${ICON_MARKS[name]}</svg>\`
}

// ————————————————————————————————————————————————————————————————————————
// The device header's fold chevron and pop-out mark — the specimen's FOLD
// and POP constants, verbatim (10×10 grid, currentColor stroke).

export const CHEVRON_FOLD = '${chevrons.fold}'

export const CHEVRON_POP = '${chevrons.pop}'

// ————————————————————————————————————————————————————————————————————————
// The kind marks — the specimen's kindShape() drawings (filled nodes with
// their darker facet), each kind's inner markup resolved by the sync.

export const KIND_SHAPES = {
${kindRows}
} as const

/** The union of kind-mark names. */
export type KindShapeName = keyof typeof KIND_SHAPES

export function isKindShape(candidate: string): candidate is KindShapeName {
  return Object.prototype.hasOwnProperty.call(KIND_SHAPES, candidate)
}

export const KIND_SHAPE_NAMES: readonly KindShapeName[] = Object.keys(KIND_SHAPES) as KindShapeName[]

/** The specimen's kindShape wrapper, exactly: 24×24, no stroke grammar of
 * the wrapper's own (the marks paint themselves), round joins. */
export function renderKindShape(kind: KindShapeName, size = 16): string {
  return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" stroke-linejoin="round">\${KIND_SHAPES[kind]}</svg>\`
}

// ————————————————————————————————————————————————————————————————————————
// The woodcut marks (skill / skillset / method / methodology) in both sets,
// each mark's {tf, line, hatch, small} resolved by the sync from the
// specimen's own templates. renderWood reproduces the specimen's rule:
// the small drawing at 20px and below; hatching from 28px up; the warn
// state draws the same line in the stall colour; denied dims (the .wood.dim
// class the specimen's stylesheet carries).

export const WOOD_MARKS = ${woodJson} as const

export type WoodSet = keyof typeof WOOD_MARKS
export type WoodKind = keyof typeof WOOD_MARKS.blade
export type WoodState = 'whole' | 'outline' | 'warn'

/** The two sets' marks differ in shape (some carry a transform, some do
 * not); the WoodMark view makes 'tf' optional so renderWood reads both. */
export interface WoodMark {
  readonly tf?: string
  readonly line: string
  readonly hatch: string
  readonly small: string
}

export function isWoodKind(candidate: string): candidate is WoodKind {
  return Object.prototype.hasOwnProperty.call(WOOD_MARKS.blade, candidate)
}

export function renderWood(kind: WoodKind, size = 16, state: WoodState = 'whole', set: WoodSet = 'blade'): string {
  const g: WoodMark = WOOD_MARKS[set][kind]
  const small = size <= 20
  const sw = size >= 64 ? 1.35 : size >= 32 ? 1.15 : small ? 1.2 : 1.1
  const col = state === 'warn' ? 'var(--stall)' : 'currentColor'
  const body = small ? g.small : g.line + (size >= 28 ? \`<g stroke-width="\${(sw * .72).toFixed(2)}">\${g.hatch}</g>\` : '')
  return \`<svg class="wood\${state === 'outline' ? ' dim' : ''}" width="\${size}" height="\${size}" viewBox="0 0 64 64" fill="none" stroke="\${col}" stroke-width="\${sw}" stroke-linecap="round" stroke-linejoin="round"><g\${g.tf ? \` transform="\${g.tf}"\` : ''}>\${body}</g></svg>\`
}
`
}

const specimen = await readSpecimen()
const marks = parseMarks(extractMarks(specimen))
const chevrons = {
  fold: extractConstTemplate(specimen, 'FOLD'),
  pop: extractConstTemplate(specimen, 'POP'),
}
const resolved = resolveSpecimenDrawings(specimen)
const rendered = render(marks, chevrons, resolved)

if (process.argv[2] === '--check') {
  const current = await readFile(OUT, 'utf8').catch(() => '')
  if (current !== rendered) {
    console.error(`icons.ts has drifted from icon-cut.html (${marks.length} marks). Run: node scripts/sync-icons.mjs`)
    process.exit(1)
  }
  console.log(`icons.ts matches icon-cut.html (${marks.length} marks).`)
} else {
  await writeFile(OUT, rendered)
  console.log(`wrote ${OUT} — ${marks.length} marks, ${Object.keys(resolved.kindShapes).length} kind shapes, 4+4 wood marks from icon-cut.html`)
}
