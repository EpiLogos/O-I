// The Archetypal-Earth port pin and its drift check (T-AE-REPORT; DEVICE-SEMANTICS-LOCK §7.4.1).
//
// The atlas port (src/projections/atlas/src) is Archetypal-Earth's src/ copied verbatim at one pinned AE commit,
// then adapted at the host seam (lock §8.4). `PORT-PIN.json` beside the port records the commit, the sha-256 of
// every AE src module at that commit, which port modules are host-adapted (and why), which AE modules are host-only
// (excluded, and why), and the port-new modules. Three modes:
//
//   node scripts/atlas-port-pin.mjs --check     CI-safe: every port module equals its pinned AE bytes, or is a
//                                               recorded adaptation, or is recorded port-new; every pinned module
//                                               is present or recorded host-only. Exit 1 names each fault.
//   node scripts/atlas-port-pin.mjs --record    needs the AE checkout: (re)writes the pin's commit + hashes from git
//                                               (never the AE working tree) and the adapted list from the bytes.
//   node scripts/atlas-port-pin.mjs --drift     needs the AE checkout: names every AE module that differs between
//                                               the pin and AE's HEAD (the next re-port's work list).
//
// AE checkout: $ARCHETYPAL_EARTH, else ~/Central/Work/Archetypal-Earth.

import {createHash} from 'node:crypto'
import {readFile, readdir, writeFile} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {dirname, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {homedir} from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
export const PORT_ROOT = join(here, '..', 'src', 'projections', 'atlas', 'src')
export const PIN_PATH = join(here, '..', 'src', 'projections', 'atlas', 'PORT-PIN.json')
const AE = process.env.ARCHETYPAL_EARTH ?? join(homedir(), 'Central', 'Work', 'Archetypal-Earth')

const sha = bytes => createHash('sha256').update(bytes).digest('hex')

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(path))
    else out.push(path)
  }
  return out
}

export async function portHashes() {
  const files = await walk(PORT_ROOT)
  const out = {}
  for (const file of files) out[relative(PORT_ROOT, file).split('\\').join('/')] = sha(await readFile(file))
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}

function aeGit(...args) {
  return execFileSync('git', ['-C', AE, ...args], {encoding: 'buffer', maxBuffer: 64 * 1024 * 1024})
}

function aeHashes(commit) {
  const names = aeGit('ls-tree', '-r', '--name-only', commit, 'src').toString('utf8').trim().split('\n')
  const out = {}
  for (const name of names) out[name.replace(/^src\//, '')] = sha(aeGit('show', `${commit}:${name}`))
  return out
}

/** The CI-safe check: faults, and the list of modules that differ from the pin (each must be recorded). */
export async function checkPort(pin, port) {
  const faults = []
  const differing = []
  const adapted = new Set(Object.keys(pin.adapted))
  const portNew = new Set(Object.keys(pin.portNew))
  const hostOnly = new Set(Object.keys(pin.hostOnly))
  for (const [path, hash] of Object.entries(port)) {
    const pinned = pin.ae[path]
    if (pinned === undefined) {
      if (!portNew.has(path)) faults.push(`${path}: not in AE @ ${pin.commit} and not recorded port-new`)
      continue
    }
    if (pinned === hash) {
      if (adapted.has(path)) faults.push(`${path}: recorded as adapted but equals AE @ ${pin.commit} — drop the record`)
      continue
    }
    differing.push(path)
    if (!adapted.has(path)) faults.push(`${path}: differs from AE @ ${pin.commit} and is not a recorded host adaptation`)
  }
  for (const path of Object.keys(pin.ae)) {
    if (!(path in port) && !hostOnly.has(path)) faults.push(`${path}: in AE @ ${pin.commit} but missing from the port and not recorded host-only`)
  }
  for (const path of adapted) if (!(path in port)) faults.push(`${path}: recorded as adapted but absent from the port`)
  return {faults, differing}
}

async function main() {
  const mode = process.argv[2] ?? '--check'
  const pin = existsSync(PIN_PATH) ? JSON.parse(await readFile(PIN_PATH, 'utf8')) : null
  if (mode === '--check') {
    if (!pin) { console.error(`no pin at ${PIN_PATH}`); process.exit(1) }
    const {faults, differing} = await checkPort(pin, await portHashes())
    console.log(`atlas port pinned at AE ${pin.commit}: ${Object.keys(pin.ae).length} AE modules; ${differing.length} host-adapted; ${Object.keys(pin.portNew).length} port-new; ${Object.keys(pin.hostOnly).length} host-only`)
    for (const path of differing) console.log(`  adapted  ${path} — ${pin.adapted[path] ?? '(unrecorded)'}`)
    for (const fault of faults) console.error(`FAULT ${fault}`)
    process.exit(faults.length ? 1 : 0)
  }
  if (mode === '--record') {
    if (!pin) { console.error('--record updates an existing pin (commit + reasons are authored); none found'); process.exit(1) }
    const commit = process.argv[3] ?? pin.commit
    const full = aeGit('rev-parse', commit).toString('utf8').trim()
    const ae = aeHashes(full)
    const port = await portHashes()
    const adapted = {}
    for (const [path, hash] of Object.entries(port)) {
      if (ae[path] !== undefined && ae[path] !== hash) adapted[path] = pin.adapted[path] ?? 'UNRECORDED — write the reason'
    }
    const next = {...pin, commit: full, ae, adapted}
    await writeFile(PIN_PATH, JSON.stringify(next, null, 2) + '\n')
    console.log(`pin recorded at AE ${full}: ${Object.keys(ae).length} modules, ${Object.keys(adapted).length} adapted`)
    return
  }
  if (mode === '--drift') {
    if (!pin) { console.error('no pin'); process.exit(1) }
    const head = aeGit('rev-parse', 'HEAD').toString('utf8').trim()
    const now = aeHashes(head)
    const changed = []
    for (const path of new Set([...Object.keys(pin.ae), ...Object.keys(now)])) {
      if (pin.ae[path] !== now[path]) changed.push(`${pin.ae[path] === undefined ? 'added  ' : now[path] === undefined ? 'removed' : 'changed'} ${path}`)
    }
    console.log(`AE drift since the pin ${pin.commit.slice(0, 7)} → HEAD ${head.slice(0, 7)}: ${changed.length} module(s)`)
    for (const line of changed.sort()) console.log(`  ${line}`)
    return
  }
  console.error(`unknown mode ${mode}`)
  process.exit(2)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
