/// <reference types="vite/client" />
// The face rig's creature kit, as the catalogue's faces draw it (manual §19.4, §19.15, §19.14, §25.6).
//
// SOURCE. `./vendor/*.js` are copies, byte for byte, of the plain-JS kit in the face-rig repository (EpiLogos/face-rig):
//   creature-kit.js, creature-agency.js, creature-ground.js, creature-ring.js, creature-swim.js, creature-horse.js,
//   creature-{eagle,bull,ram,fishes,crab,honeybee,ant,monarch,monarch-flight,lion}.js,
//   creature-body.js, creature-serpent.js, creature-crew.js, crew-{ant,honeybee,monarch}.js,
//   environ-{kit,growth,species,tree}.js, stage-serpent-tree.js, and the recorded run
//   `tools/runs/refinement-close-2026-10-18.json` (as run-refinement-close-2026-10-18.json).
// They were copied on 2026-10-20 from face-rig commit d6fb80f3f4e4c3d0f994dd00c8ed0603548c98b7, taken from the working tree,
// which was newer than that commit: creature-kit, creature-ground, creature-honeybee, creature-ant,
// creature-serpent, creature-body, environ-kit, environ-tree and stage-serpent-tree had uncommitted changes, and creature-crew,
// creature-monarch-flight, crew-ant, crew-honeybee, crew-monarch, environ-growth and environ-species were not
// committed at all.
// Never edit them here. Take a newer copy from face-rig and run the faces gate (the gallery draws every figure and stage with no
// page error); the spec is face-rig CREATURE-SPEC.md Part II, and creature-agency.js is its machine form.
//
// LOADING. Each file is an IIFE that sets a window global (window.CreatureKit and so on) and some of them build a whole body at load
// (the eagle takes 300 ms), so nothing runs until a face asks for it:
//   - in the shell's build a file is its own lazy chunk, executed when it is imported;
//   - in the gallery's build (ProjectCentral/docs/1-vision/dlw/gallery.mjs: one script for the manual) the catalogue's vite config wraps each file in
//     `export default function` (vite.config.mjs, `faceVendor`), so that it runs when this loader calls it, never at load.
// The loader runs a file once, after the files it needs.
type Module = {default?: () => void}
// Vite rewrites each import.meta.glob below in place. Under Node (the shell's test suites import the panels that import this file)
// import.meta.glob does not exist: the globs answer nothing, no vendored file runs and the agency is whatever a page already set.
const glob = <T>(read: () => Record<string, T>): Record<string, T> => { try { return read() } catch { return {} } }
const FILES = () => glob(() => import.meta.glob<Module>(['./vendor/*.js', '!./vendor/creature-agency.js']))
// The agency data (the contract's fields, the patterns, the run states) is small and the lists draw from it at once: it is loaded with
// this file and runs when it is first read.
const AGENCY = () => glob(() => import.meta.glob<Module>('./vendor/creature-agency.js', {eager: true}))
let agencyRan = false
/** The agency ontology (face-rig CREATURE-SPEC.md Part II as data): `window.CREATURE_AGENCY`. */
export function agency(): Kit | undefined {
  if (!agencyRan) {
    agencyRan = true
    const m = Object.values(AGENCY())[0]
    if (typeof m?.default === 'function') m.default()
  }
  return typeof window === 'undefined' ? undefined : window.CREATURE_AGENCY
}
const JSON_FILES = () => glob(() => import.meta.glob<{default: unknown}>('./vendor/*.json'))

// The files a file needs before it runs (the page order of face-rig's pages).
const NEEDS: Readonly<Record<string, readonly string[]>> = {
  'creature-ground': ['creature-kit'], 'creature-swim': ['creature-kit'], 'creature-horse': ['creature-kit'], 'creature-ring': [],
  'creature-eagle': ['creature-kit'], 'creature-bull': ['creature-kit'], 'creature-ram': ['creature-kit'],
  'creature-fishes': ['creature-kit', 'creature-swim'], 'creature-crab': ['creature-kit', 'creature-ground'],
  'creature-honeybee': ['creature-kit', 'creature-ground'], 'creature-ant': ['creature-kit', 'creature-ground'],
  'creature-monarch': ['creature-kit'], 'creature-monarch-flight': ['creature-kit', 'creature-ground'],
  'creature-lion': [],
  'creature-body': ['creature-ring'], 'creature-serpent': ['creature-body'],
  'creature-crew': ['creature-kit', 'creature-ground'],
  'crew-ant': ['creature-crew', 'creature-ant'], 'crew-honeybee': ['creature-crew', 'creature-honeybee'],
  'crew-monarch': ['creature-crew', 'creature-monarch-flight'],
  'environ-kit': ['creature-agency'], 'environ-growth': [], 'environ-species': [], 'environ-tree': ['creature-kit', 'creature-agency', 'environ-kit', 'environ-growth', 'environ-species'],
  'stage-serpent-tree': ['creature-kit', 'creature-ring', 'creature-body', 'creature-serpent', 'creature-agency', 'environ-kit', 'environ-tree'],
}

/** The crew scenes (face-rig crew-*.js) each build their own page when they run: `CreatureCrew.page(spec)`. A face has no page, so the scene's
 * own definition is kept instead, and `crewSpec` hands it over, to be set up in the face's pane. */
const SPECS = new Map<string, Kit>()
export const crewSpec = (title: string): Kit | undefined => SPECS.get(title)
const AFTER: Readonly<Record<string, () => void>> = {
  'creature-crew': () => { window.CreatureCrew.page = (spec: Kit) => { SPECS.set(spec.title, spec) } },
}

const loaded = new Map<string, Promise<void>>()
/** Run a vendored file, once, after the files it needs. Rejects with the file's name when it throws. */
export function use(name: string): Promise<void> {
  if (name === 'creature-agency') { agency(); return Promise.resolve() }
  let p = loaded.get(name)
  if (p) return p
  p = (async () => {
    for (const need of NEEDS[name] ?? []) await use(need)
    const file = FILES()[`./vendor/${name}.js`]
    if (!file) throw new Error(`faces: ${name}.js is not vendored`)
    const m = await file()
    // The gallery's build wraps the file, so it runs here; a file the shell imports plain has run already.
    if (typeof m.default === 'function') m.default()
    AFTER[name]?.()
  })().catch(cause => { loaded.delete(name); throw new Error(`faces: ${name}.js did not run: ${cause instanceof Error ? cause.message : String(cause)}`) })
  loaded.set(name, p)
  return p
}
/** Several files in order, yielding to the page between them: a file can take 300 ms to run. */
export async function useAll(names: readonly string[]): Promise<void> {
  for (const name of names) { await use(name); await new Promise(r => setTimeout(r, 0)) }
}
/** A vendored recorded run, as its JSON. */
export async function recordedRun(name: string): Promise<unknown> {
  const file = JSON_FILES()[`./vendor/${name}.json`]
  if (!file) throw new Error(`faces: no recorded run ${name}`)
  return (await file()).default
}

/** The window globals the kit sets, as the faces read them. They are the kit's own and untyped. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Kit = any
declare global {
  interface Window {
    CreatureKit?: Kit
    CREATURE_AGENCY?: Kit
    CreatureCrew?: Kit
    CreatureBody?: Kit
    CreatureRing?: Kit
    CreatureGround?: Kit
    EnvironKit?: Kit
    EnvironTree?: Kit
    StageSerpentTree?: Kit
    Serpent?: Kit
    SERPENT_DEF?: Kit
    mountCreature?: Kit
    creatureRestSvg?: Kit
    CREATURES?: Kit
  }
}
