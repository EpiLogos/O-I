// Your world's body (T-WORLDS §5 W3; manual §17.2 "Build a planet"): the owner's record read, the owner's write asked for, and the
// globe kept in step. Owners write, faces read: the record lives in AIKit's wiki facts (`aikit.world-body/v1` on the register's
// root space, ai-kit knowledge_wiki_facts.rs), read through the kernel's `world_body_read` (kernel construction.rs read_body) and
// written as a `body_set` change through the `aikit.wiki.facts.apply` Action — the same Action, CAS and receipt a place's PlaceSet
// takes (desktop/cradle/src/knowledge/wikiFacts.ts:68-85 saveFacts: readRegister, the exact revision, invoke, readback). This
// module holds the last reading and nothing else: no body is kept, defaulted or invented here, and a reroll is the owner's write of
// a new seed.
//
// What the shell holds itself is only the view's choice of which body to look at (`own`, `earth`, `other`): a presentation, never
// owner state. The globe draws the Earth unless your own body is chosen and its record reads.
//
// Bound by the atlas's attach (AtlasProjectionPanel.tsx) for as long as the Earth stands, released with it.

import type {KernelTransportStatus, WorldBodyReading} from '../../../../../../../desktop/cradle/src/kernel/types'
import {kernelOp} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import {ACTOR, invoke, newRef, object, readRegister} from '../../../../../../../desktop/cradle/src/knowledge/construction'
import {
  CONTINENTS_RANGE, TILT_RANGE, WORLD_BODY_GENERATOR, WORLD_BODY_GENERATOR_VERSION, isWorldBody, nextSeed, parseWorldBody, type WorldBodyRecord,
} from '../src/globe/body'

export type BodyChoice = 'own' | 'earth' | 'other'
export const BODY_CHOICES: readonly BodyChoice[] = ['own', 'earth', 'other']

/** The owner's reading, as this session last had it. */
export type WorldBodyState =
  | {readonly state: 'unbound'}
  | {readonly state: 'reading'}
  /** `record` is null while the register's root space carries no body yet. */
  | {readonly state: 'read'; readonly reading: WorldBodyReading; readonly record: WorldBodyRecord | null}
  | {readonly state: 'refused'; readonly reason: string}

/** The owner as this module reaches it: the kernel's read, and the BodySet write against the exact space revision. Injectable. */
export interface WorldBodyOwner {
  read(): Promise<WorldBodyReading>
  /** Replace the body whole on the root space read at `basis`; resolves once the owner confirms the save. */
  write(body: WorldBodyRecord, basis: {readonly space_ref: string; readonly revision: number}): Promise<void>
}

// The owner's words for the states in which there is nothing to write to.
export const NOT_BOUND = 'The Earth has not mounted in this session, so your world’s body is not read; its controls stand with the Earth pane.'
export const NOT_READ = 'Your world’s body is being read from its owner.'
export const NO_BODY = 'Your world has no body yet. Build one: its owner keeps it on your register’s root space.'
export const GIVEN = 'Earth is given: you place things on it, and its land stays as it is.'
export const READ_ONLY = 'Another world’s body is its owner’s: you see what they show.'
export const NO_OTHER = 'No other world’s body is read in this session; the World shows only the worlds whose owners show their bodies.'

/** One setting of the body: its value key on the World design (inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx:774-789),
 * its words, its group on the Body page and the range its owner keeps (ai-kit knowledge_wiki_facts.rs WorldBody::validate). */
export interface BodySetting {
  readonly key: string
  readonly title: string
  readonly group: 'Landmass' | 'Climate' | 'Sky'
  readonly range: {readonly min: number; readonly max: number; readonly unit?: string}
}
export const WORLD_BODY_SETTINGS: readonly BodySetting[] = [
  {key: 'seaLevel', title: 'Sea level', group: 'Landmass', range: {min: 0, max: 1}},
  {key: 'continents', title: 'Continents', group: 'Landmass', range: {min: CONTINENTS_RANGE.min, max: CONTINENTS_RANGE.max}},
  {key: 'relief', title: 'Relief', group: 'Landmass', range: {min: 0, max: 1}},
  {key: 'warmth', title: 'Warmth', group: 'Climate', range: {min: 0, max: 1}},
  {key: 'moisture', title: 'Moisture', group: 'Climate', range: {min: 0, max: 1}},
  {key: 'iceCaps', title: 'Ice caps', group: 'Climate', range: {min: 0, max: 1}},
  {key: 'atmosphere', title: 'Atmosphere', group: 'Sky', range: {min: 0, max: 1}},
  {key: 'clouds', title: 'Clouds', group: 'Sky', range: {min: 0, max: 1}},
  {key: 'tilt', title: 'Tilt', group: 'Sky', range: {min: TILT_RANGE.min, max: TILT_RANGE.max, unit: '°'}},
]
/** The setter a body key is written through (agent/shellSetterBridge.ts registerWorldBodyShellSetters). */
export const bodyWriter = (key: string): string => `shell.setWorldBody${key[0]!.toUpperCase()}${key.slice(1)}`

let current: WorldBodyState = {state: 'unbound'}
let choice: BodyChoice = 'earth'
let owner: WorldBodyOwner | null = null
const listeners = new Set<() => void>()
const notify = () => { for (const listener of [...listeners]) listener() }

export const worldBodyState = (): WorldBodyState => current
export const bodyChoice = (): BodyChoice => choice
export function subscribeWorldBody(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Choose the body the World shows. The view's own choice: it moves no owner state. */
export function chooseBody(next: BodyChoice): void {
  if (next === choice) return
  choice = next
  notify()
}

/** The record the globe draws now: your own body while it is chosen and reads, else null (the Earth). While your register's root space
 * carries no body yet, the body seeded from its ref (firstBody: the very body its first change builds on) is drawn, and the Body page
 * says there is none yet (NO_BODY): nothing is written until the person acts (T-WORLDS §5 W3 phase B, "a world with no record yet is
 * drawn from a body seeded from its ref, and says so"). */
export function shownBody(): WorldBodyRecord | null {
  if (choice !== 'own' || current.state !== 'read') return null
  return current.record ?? firstBody(current.reading.space.ref, current.reading.space.revision)
}

/** Why a body control cannot write now, or null when it can. */
export function bodyWriteRefusal(): string | null {
  if (choice === 'earth') return GIVEN
  if (choice === 'other') return READ_ONLY
  if (current.state === 'unbound') return NOT_BOUND
  if (current.state === 'reading') return NOT_READ
  if (current.state === 'refused') return current.reason
  return null
}

/** Read the owner again (after a write, or when the Earth mounts). The state says what came back, in the owner's words. */
export async function refreshWorldBody(): Promise<WorldBodyState> {
  const reader = owner
  if (!reader) return current
  if (current.state !== 'read') { current = {state: 'reading'}; notify() }
  try {
    const reading = await reader.read()
    if (owner !== reader) return current
    if (reading.body === null || reading.body === undefined) {
      current = {state: 'read', reading, record: null}
    } else {
      const parsed = parseWorldBody(reading.body)
      current = isWorldBody(parsed) ? {state: 'read', reading, record: parsed} : {state: 'refused', reason: `The owner’s world body cannot be drawn: ${parsed.refused}.`}
    }
  } catch (error) {
    if (owner !== reader) return current
    current = {state: 'refused', reason: messageOf(error)}
  }
  notify()
  return current
}

/** Ask the owner to replace the body whole, then read it back. Resolves with the owner's acknowledgement; throws its refusal. */
export async function writeWorldBody(next: WorldBodyRecord): Promise<string> {
  const writer = owner
  const refusal = bodyWriteRefusal()
  if (!writer || refusal) throw Error(refusal ?? NOT_BOUND)
  const parsed = parseWorldBody(next)
  if (!isWorldBody(parsed)) throw Error(`The body is refused before it is sent: ${parsed.refused}`)
  const read = current as Extract<WorldBodyState, {state: 'read'}>
  try {
    await writer.write(parsed, {space_ref: read.reading.space.ref, revision: read.reading.space.revision})
  } catch (error) {
    // the owner refused (a stale revision, a range): read it again, so the next change starts from what the owner holds
    void refreshWorldBody()
    throw error
  }
  const after = await refreshWorldBody()
  if (after.state !== 'read' || !same(after.record, parsed)) throw Error('The owner confirmed the save, but the body did not read back as written. Read before retrying.')
  return `Your world’s body is saved at revision ${after.reading.space.revision}.`
}

/** The settings a change of the World device's keys makes, on the record as it reads now; a reroll asks for a new seed. A key the
 * body does not carry is refused by name. Pure. */
export function changedBody(record: WorldBodyRecord, revision: number, changes: Readonly<Record<string, unknown>>): WorldBodyRecord {
  const landmass = {...record.landmass}, climate = {...record.climate}, sky = {...record.sky}
  let seed = record.seed
  for (const [key, value] of Object.entries(changes)) {
    switch (key) {
      case 'seed': seed = value as number; break
      case 'reroll': seed = nextSeed(record, revision); break
      case 'seaLevel': landmass.sea_level = value as number; break
      case 'continents': landmass.continents = value as number; break
      case 'relief': landmass.relief = value as number; break
      case 'coast': landmass.coast = value as WorldBodyRecord['landmass']['coast']; break
      case 'warmth': climate.warmth = value as number; break
      case 'moisture': climate.moisture = value as number; break
      case 'iceCaps': climate.ice_caps = value as number; break
      case 'atmosphere': sky.atmosphere = value as number; break
      case 'clouds': sky.clouds = value as number; break
      case 'tilt': sky.axial_tilt_deg = value as number; break
      default: throw Error(`${key} is not a setting of the body`)
    }
  }
  // a body built by an older generator is rebuilt by the current one on its next change, whatever the change (T-PROCEDURAL-BODY: the record keeps its fields; its
  // generator version is what says which generator draws it); no change, no rebuild
  const generator = Object.keys(changes).length ? {...record.generator, version: WORLD_BODY_GENERATOR_VERSION} : record.generator
  return {...record, generator, seed, landmass, climate, sky}
}

/** The settings a first body is built with when the register's root space carries none: the World device's own dial defaults
 * (inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx:774-789, what a double-click on each dial returns to). Nothing is
 * built until the person moves a setting or rerolls: the first write is theirs. */
export const FIRST_BODY_SETTINGS = {
  landmass: {sea_level: .5, continents: 1.7, relief: .55, coast: 'smooth'},
  climate: {warmth: .58, moisture: .6, ice_caps: .3},
  sky: {atmosphere: .6, clouds: .35, axial_tilt_deg: 18},
} as const

/** The body a register's first change builds on: the first settings, the body named for its space, and a seed named from the space
 * and its revision (body.ts nextSeed), never a random one. Pure. */
export function firstBody(spaceRef: string, revision: number): WorldBodyRecord {
  const stub: WorldBodyRecord = {body_ref: `body:${spaceRef}`, seed: 0, generator: {id: WORLD_BODY_GENERATOR, version: WORLD_BODY_GENERATOR_VERSION},
    landmass: {...FIRST_BODY_SETTINGS.landmass}, climate: {...FIRST_BODY_SETTINGS.climate}, sky: {...FIRST_BODY_SETTINGS.sky}}
  return {...stub, seed: nextSeed(stub, revision)}
}

/** The body a change applies to: the owner's record, or the first body while the root space carries none. */
export function baseBody(state: Extract<WorldBodyState, {state: 'read'}>): WorldBodyRecord {
  return state.record ?? firstBody(state.reading.space.ref, state.reading.space.revision)
}

/** The kernel's owner: `world_body_read`, and the BodySet through `aikit.wiki.facts.apply` on the register file's exact revision. */
export function kernelWorldBodyOwner(transport: KernelTransportStatus, project?: string): WorldBodyOwner {
  return {
    async read() {
      const call = await kernelOp(transport, {op: 'world_body_read', project: project ?? null})
      if (call.outcome?.result !== 'world_body_reading') throw Error(('error' in call ? call.error : undefined) ?? 'The kernel did not return your world’s body.')
      return call.outcome.document
    },
    async write(body, basis) {
      const register = await readRegister(transport, project)
      const raw: unknown = JSON.parse(register.file.content)
      const rows = Array.isArray(raw) ? raw : object(raw) && Array.isArray(raw.objects) ? raw.objects : []
      const row = rows.find((item: unknown) => object(item) && item.object === 'space' && item.ref === basis.space_ref)
      if (!object(row) || row.revision !== basis.revision) throw Error('Your world’s body changed since it was read. It is read again; make the change again.')
      const request = {schema: 'aikit.wiki-facts-action/v1', target: {kind: 'space', ref: basis.space_ref}, expected_revision: basis.revision,
        actor_ref: ACTOR, operation_ref: newRef('operation:world-body'), changes: [{change: 'body_set', body}]}
      const result = await invoke<Record<string, unknown>>(transport, project, 'aikit.wiki.facts.apply', basis.space_ref,
        {location: register.file.location, expected_file_revision: register.file.revision, request, sources: []})
      if (result.persisted !== true || !['saved', 'unchanged'].includes(String(result.state))) throw Error('The owner did not confirm this exact save. Read before retrying.')
      const warnings = Array.isArray(result.continuity_warnings) ? result.continuity_warnings.filter((value): value is string => typeof value === 'string') : []
      if (result.continuity === 'reconciliation_required' || warnings.length) throw Error(`The owner saved the body, but its readback needs reconciliation. ${warnings.join(' ')}`.trim())
    },
  }
}

/** Bind your world's body while the Earth stands: read it from its owner, and keep the globe drawing the body the view chose. */
export function bindWorldBody(options: {
  /** The globe (globe/engine.ts setBody). A host whose globe draws no body (a stub in a test) leaves it out, and only the record reads. */
  readonly engine: {setBody?(record: WorldBodyRecord | null): void}
  readonly owner: WorldBodyOwner
  /** The atlas's own change notice for its faces (app/controller.ts facesChanged), so the World device reads the body again. */
  readonly changed?: () => void
}): {dispose(): void} {
  owner = options.owner
  const draw = () => { options.engine.setBody?.(shownBody()); options.changed?.() }
  const unsubscribe = subscribeWorldBody(draw)
  draw()
  void refreshWorldBody()
  return {
    dispose() {
      unsubscribe()
      if (owner === options.owner) {
        owner = null
        current = {state: 'unbound'}
        notify()
      }
    },
  }
}
