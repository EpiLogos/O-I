// Sync the SDK's kernel-op registry from the cradle kernel's own type union —
// the writer-membership law for `kernel:<op>` write paths gates against the
// ops the kernel actually carries, not against a guess.
//
//   node scripts/sync-kernel-ops.mjs            regenerate src/inhabitants/sdk/kernelOps.ts
//   node scripts/sync-kernel-ops.mjs --check    exit 1 when the module has drifted
//
// The source of truth is desktop/cradle/src/kernel/types.ts (`export type
// KernelOp`); this script lives in the ui package and reads across the
// worktree the same way the dev harnesses read cradle sources.

import {readFile, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const uiRoot = join(here, '..')
const KERNEL_TYPES = join(uiRoot, '..', '..', '..', 'desktop', 'cradle', 'src', 'kernel', 'types.ts')
const OUT = join(uiRoot, 'src', 'inhabitants', 'sdk', 'kernelOps.ts')

/** The known native-owner tools for `<tool>:<command>` write paths. The
 * command itself stays shape-checked — the CLIs live in their own
 * repositories; the tool id is the identity the gate can stand behind. */
const KNOWN_TOOLS = ['workcell-cli', 'ctrl', 'aikit', 'oi']

async function extractOps() {
  const source = await readFile(KERNEL_TYPES, 'utf8')
  const start = source.indexOf('export type KernelOp =')
  if (start < 0) throw new Error('kernel types carry no `export type KernelOp`')
  const block = source.slice(start)
  const end = block.indexOf('export type KernelOpResult')
  if (end < 0) throw new Error('the KernelOp union is unterminated')
  const ops = [...block.slice(0, end).matchAll(/\{\s*op:\s*"([a-z_]+)"/g)].map(match => match[1])
  if (!ops.length) throw new Error('no kernel ops parsed from the union')
  return ops
}

function render(ops) {
  const rows = ops.map(op => `  '${op}',`).join('\n')
  const tools = KNOWN_TOOLS.map(tool => `  '${tool}',`).join('\n')
  return `/** The kernel's op union and the known native-owner tools, GENERATED
 * from desktop/cradle/src/kernel/types.ts (export type KernelOp) by
 * scripts/sync-kernel-ops.mjs — regenerate, never hand-edit. This is the
 * writer-membership law's registry: a \`kernel:<op>\` write path must name
 * one of these ops; a \`<tool>:<command>\` path must name one of these
 * tools. Drift is gated by tests/device-sdk.test.mjs — against the
 * WORKING TREE (the kernel the shell actually runs against); while a lane
 * carries an uncommitted kernel-op addition, the generated module carries
 * it too and a fresh HEAD checkout regenerates it identically only after
 * that lane lands.
 *
 * Pure: no view, no store, no I/O. */

export const KERNEL_OPS = [
${rows}
] as const

export type KernelOpName = (typeof KERNEL_OPS)[number]

export function isKernelOp(candidate: string): candidate is KernelOpName {
  return (KERNEL_OPS as readonly string[]).includes(candidate)
}

export const KNOWN_TOOLS = [
${tools}
] as const

export type KnownTool = (typeof KNOWN_TOOLS)[number]

export function isKnownTool(candidate: string): candidate is KnownTool {
  return (KNOWN_TOOLS as readonly string[]).includes(candidate)
}
`
}

const ops = await extractOps()
const rendered = render(ops)

if (process.argv[2] === '--check') {
  const current = await readFile(OUT, 'utf8').catch(() => '')
  if (current !== rendered) {
    console.error(`kernelOps.ts has drifted from the kernel's op union (${ops.length} ops). Run: node scripts/sync-kernel-ops.mjs`)
    process.exit(1)
  }
  console.log(`kernelOps.ts matches the kernel union (${ops.length} ops).`)
} else {
  await writeFile(OUT, rendered)
  console.log(`wrote ${OUT} — ${ops.length} ops from the kernel union`)
}
