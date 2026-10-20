// Your system (manual §17.2 "Your system"; §2 "every world is drawn as a body in space"; T-WORLDS §5 W3 phase B; T-PROCEDURAL-BODY §6): each
// world in today's set is a body of its own, built from its register's own world body, landing at its place on your planet, and only
// what agents do circles the body it belongs to. A pure model: the owners' readings in, the bodies and their satellites out. No DOM, no
// React, no transport, and no clock (the instant it is drawn for is an input).
//
// It reads, and never re-derives:
//   - the worlds Central discloses and today's set (central/centralWorlds.ts worldsOf; central/daySet.ts daySetOf through
//     frame/tracks/useCentralTracks.ts setReadingOf): your world first, then the Day's set in its own order;
//   - each world's body, `aikit.world-body/v1` on its register's root space, as the kernel's `world_body_read` answers it (project
//     worlds by their project; kernel construction.rs read_body);
//   - the agent sessions at work (agent/AgentSessionsProvider.tsx), each in the world its SessionSpace belongs to (system/sessionWorld.ts),
//     on the inner ring;
//   - what agents have just made: the changes of each register's change horizon that an agent made (system/artifacts.ts, Central's
//     `projectcentral.change.horizon`), on the outer ring, for a Day and the newest six at most.
// A page that plays, the file you have open and the works to hand are on the ground, not in orbit (manual §17.2: "Only agents at work and
// what they make circle a body").
//
// Laws kept: a world with no body yet is drawn from a body seeded from its ref (body/worldBody.ts firstBody, the very body its first
// change would build on) and says so; nothing is written until the person acts. A world whose body is not read is drawn hollow, with the
// owner's words. Its colour is the world's colour everywhere (provider/suiteReading.ts paletteOfRef of its body_ref). Every satellite's
// place on its ring is keyed by its subject (fnv1a of its ref), so it keeps its place however the list around it changes. No creature:
// a satellite is drawn as the plain satellite it is (the owner places the faces of agent types; T-WORLDS §1, withdrawn).
import type {WorldBodyReading} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {CentralWorld} from '../../../central/centralWorlds'
import type {Palette} from '../src/types/field'
import type {BodyLook, WorldBodyRecord} from '../src/globe/body'
import {fnv1a, paletteOfRef} from '../provider/suiteReading'
import {firstBody} from '../body/worldBody'
import {lookOf, maturityOf, type WorldFacts} from './maturity'

/** A world's body as its owner last answered. */
export type SystemBodyReading =
  | {readonly state: 'reading'}
  /** `record` is null while the register's root space carries no body yet. */
  | {readonly state: 'read'; readonly reading: WorldBodyReading; readonly record: WorldBodyRecord | null}
  | {readonly state: 'refused'; readonly reason: string}

/** What a satellite is: an agent session at work, or a file an agent has just made. Nothing else circles a body. */
export type SatelliteKind = 'session' | 'artifact'

export interface SystemSatellite {
  /** the subject's own ref (a session's ref, an artefact's source ref): its key and its place */
  readonly id: string
  readonly name: string
  readonly ring: 'inner' | 'outer'
  readonly kind: SatelliteKind
  /** its place on its ring, radians, from its ref alone */
  readonly phase: number
  /** how far along its window it is: 0 just made, approaching 1 at the edge it drifts off at; 0 for a session, which is at work now */
  readonly age: number
  /** the file an artefact is, Central-relative: what a press opens (absent for a session) */
  readonly path?: string
  /** what it is, in a line */
  readonly hint: string
}

export type SystemBodyState = 'built' | 'seeded' | 'reading' | 'refused'

export interface SystemBody {
  /** the orbit-body key (sky/orbits.ts worldOrbitKey): `world:<the world's ref>` */
  readonly key: `world:${string}`
  readonly world: CentralWorld
  readonly yours: boolean
  readonly state: SystemBodyState
  /** the body drawn: the owner's record, the body seeded from its ref, or null while it is not read */
  readonly record: WorldBodyRecord | null
  /** the body's ref (the record's, or the seeded body's): the key of its colour */
  readonly bodyRef: string
  readonly colour: Palette
  /** what the body says, in one line: built, seeded and not yet written, being read, or the owner's refusal */
  readonly standing: string
  /** where it lands on your planet; null for your own world, and for a world that has not landed on it */
  /** how finished its body looks, read from how lived in the world is (system/maturity.ts): none for a world whose readings are not in */
  readonly look: BodyLook
  readonly landing: {readonly lat: number; readonly lon: number} | null
  /** why it has no landing on your planet (null for your own world and a landed one) */
  readonly unlanded: string | null
  /** its place on the ring of worlds around your planet, radians (your own world stands at its centre: 0) */
  readonly phase: number
  readonly satellites: readonly SystemSatellite[]
}

/** An agent session at work, as the sessions provider builds its tracks (agent/agentRunModel.ts AgentSessionTrack), and the project its
 * SessionSpace belongs to (system/sessionWorld.ts sessionsOf). */
export interface SessionLike {
  readonly sessionRef: string
  readonly agentName: string | null
  readonly purpose: string | null
  readonly group: boolean
  /** the project of the world it is at work in; null or absent is your world */
  readonly project?: string | null
}

/** A file an agent made, from its register's change horizon (system/artifacts.ts artifactsOf). */
export interface SystemArtifact {
  /** the file's source ref: its key and its place on the ring */
  readonly ref: string
  readonly name: string
  /** Central-relative, what opens it */
  readonly path: string
  /** the instant its newest change was observed, ms */
  readonly atMs: number
  /** the project of the world it is in; null is your world */
  readonly project: string | null
  readonly sessionRef: string | null
  readonly actor: string | null
}

export interface SystemInput {
  /** the worlds of today's set, your world first (systemWorlds) */
  readonly worlds: readonly CentralWorld[]
  /** each world's body, by the world's ref; your world's is the root register's (body/worldBody.ts) */
  readonly bodies: ReadonlyMap<string, SystemBodyReading>
  readonly sessions: readonly SessionLike[]
  /** what agents have made, in every world of the set */
  readonly artifacts?: readonly SystemArtifact[]
  /** the instant the System is drawn for, ms (the artefacts' ages are read against it) */
  readonly nowMs?: number
  /** how lived in each world is, by the world's ref (system/worldFacts.ts); a world not in it claims no look */
  readonly facts?: ReadonlyMap<string, WorldFacts>
}

/** How long an artefact stays in orbit: one Day, rolling, from the moment it was made. Reasoning, from the owner's ground
 * (Control/agents/governance/field-and-now/day-close.md): NOW is a moving horizon that ends — "what was live is carried, what finished is
 * removed, and what the day held stays readable in a dated record" — and a close is a closure at a civil date, the field opening clean the
 * next morning. That law gives the size of the horizon (one Day) and nothing finer: it names no recency of its own. So an artefact rides for
 * a Day's length from its making and then belongs to the day's record, not to the sky. It is a rolling Day and not the civil boundary
 * because the boundary is the owner's policy (Control/user/civil-time-policy.json: a timezone, a boundary minute, a rollover that may be
 * automatic) and would empty every ring at once at midnight instead of letting each artefact drift off as it ages. */
export const ARTIFACT_WINDOW_MS = 24 * 60 * 60 * 1000
/** The most artefacts a world's outer ring carries: the newest six (owner, 20 Oct: orbits to a minimum). */
export const ARTIFACTS_PER_WORLD = 6

const TAU = Math.PI * 2

/** A place on a ring, radians, from a ref alone: the same ref stands at the same place whatever else rides the ring. */
export const ringPhase = (ref: string): number => (fnv1a(ref) / 4294967296) * TAU

/** The orbit-body key of a world (sky/orbits.ts keeps world bodies in a key space of their own, apart from the sky's BodyKey). */
export const worldKey = (ref: string): `world:${string}` => `world:${ref}`

const tail = (ref: string): string => {
  const trimmed = ref.replace(/[:/]+$/, '')
  const cut = Math.max(trimmed.lastIndexOf(':'), trimmed.lastIndexOf('/'))
  return cut >= 0 ? trimmed.slice(cut + 1) : trimmed
}

/** The worlds of today's set: your world first, then each world the Day's set holds, in the set's order (useCentralTracks.ts inSet
 * keeps the disclosure's order; the System keeps the set's, which is the order the person brought them in). A world the set names
 * that Central no longer discloses is left out. Pure. */
export function systemWorlds(disclosed: readonly CentralWorld[], setWorlds: readonly string[]): CentralWorld[] {
  const yours = disclosed.find(world => world.kind === 'yours')
  const held = setWorlds.flatMap(ref => disclosed.filter(world => world.ref === ref && world.kind !== 'yours'))
  return [...(yours ? [yours] : []), ...held.filter((world, index) => held.findIndex(other => other.ref === world.ref) === index)]
}

/** The world a project's agents work in: that project's world, your world for none (the root register's). */
const worldOfProject = (worlds: readonly CentralWorld[], project: string | null): CentralWorld | undefined =>
  project ? worlds.find(world => world.project === project) : worlds.find(world => world.kind === 'yours')

/** What circles one world: its agents at work on the inner ring, in the order given, then the newest artefacts agents made there on the
 * outer, newest first (ties by ref, so the same six ride however the list is ordered). A satellite's place is its own ref's; an artefact
 * rides while it is no older than the window and not later than the instant shown (a past occasion shows what had been made by then). */
function satellitesOf(world: CentralWorld, input: SystemInput): SystemSatellite[] {
  const here = (project: string | null | undefined) => worldOfProject(input.worlds, project ?? null)?.ref === world.ref
  const sessions: SystemSatellite[] = input.sessions.filter(session => !session.group && here(session.project)).map(session => {
    const name = session.agentName ?? session.purpose ?? tail(session.sessionRef)
    return {id: session.sessionRef, name, ring: 'inner', kind: 'session', phase: ringPhase(session.sessionRef), age: 0,
      hint: `${name} — an agent at work (${session.sessionRef})${session.purpose && session.agentName ? `: ${session.purpose}` : ''}. Select to choose its session.`}
  })
  const now = input.nowMs ?? 0
  const artifacts: SystemSatellite[] = (input.artifacts ?? [])
    .filter(item => here(item.project) && item.atMs <= now && now - item.atMs < ARTIFACT_WINDOW_MS)
    .sort((a, b) => b.atMs - a.atMs || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))
    .slice(0, ARTIFACTS_PER_WORLD)
    .map(item => ({id: item.ref, name: item.name, ring: 'outer', kind: 'artifact', phase: ringPhase(item.ref), age: (now - item.atMs) / ARTIFACT_WINDOW_MS, path: item.path,
      hint: `${item.path} — made by ${item.actor ?? 'an agent'}. Select to open it.`}))
  return [...sessions, ...artifacts]
}

/** A world's look: from its own readings, your own world is not exempt; none (the generator's default) while they are not in. */
function lookOfWorld(world: CentralWorld, input: SystemInput): BodyLook {
  const facts = input.facts?.get(world.ref)
  return facts ? lookOf(maturityOf(facts)) : {}
}

const NO_BODY_YET = 'no body yet: drawn from a body seeded from its ref, and nothing is written until you build it'

/** One world's body: the owner's record, or the body seeded from its ref, or hollow while it is not read. Pure. */
export function bodyOf(world: CentralWorld, reading: SystemBodyReading | undefined): Pick<SystemBody, 'state' | 'record' | 'bodyRef' | 'standing'> {
  if (!reading || reading.state === 'reading') return {state: 'reading', record: null, bodyRef: `body:${world.ref}`, standing: 'its body is being read from its owner'}
  if (reading.state === 'refused') return {state: 'refused', record: null, bodyRef: `body:${world.ref}`, standing: reading.reason}
  if (reading.record) return {state: 'built', record: reading.record, bodyRef: reading.record.body_ref, standing: `built from seed ${reading.record.seed}`}
  const seeded = firstBody(reading.reading.space.ref, reading.reading.space.revision)
  return {state: 'seeded', record: seeded, bodyRef: seeded.body_ref, standing: NO_BODY_YET}
}

/** Your system: each world of today's set as a body, yours first, each with what circles it. Pure. */
export function systemOf(input: SystemInput): SystemBody[] {
  const yours = input.worlds.find(world => world.kind === 'yours')
  const yourBody = yours ? bodyOf(yours, input.bodies.get(yours.ref)) : null
  return input.worlds.map(world => {
    const body = bodyOf(world, input.bodies.get(world.ref))
    const isYours = world.kind === 'yours'
    const landing = !isYours && body.state === 'built' ? body.record!.landing : undefined
    const landsHere = !!landing && !!yourBody && landing.on_ref === yourBody.bodyRef
    const unlanded = isYours ? null
      : landsHere ? null
        : landing ? `it lands on another body (${landing.on_ref}), not on your planet`
          : body.state === 'built' ? 'its owner keeps no landing for it yet: land it on your planet'
            : body.state === 'seeded' ? 'it has no body yet, so no landing: land it on your planet and its body is built'
              : 'its body is not read, so its landing is not known'
    return {
      key: worldKey(world.ref), world, yours: isYours, ...body, colour: paletteOfRef(body.bodyRef),
      landing: landsHere ? {lat: landing!.lat, lon: landing!.lon} : null, unlanded,
      phase: isYours ? 0 : ringPhase(world.ref), look: lookOfWorld(world, input), satellites: satellitesOf(world, input),
    }
  })
}

/** Where a world with no landing stands on your planet until its person lands it: a spot named from its ref alone, short of the poles, so the
 * same world is always at the same place (as a body with none yet is the body seeded from its ref, body/worldBody.ts firstBody). Pure. */
function spotOf(key: string): {lat: number; lon: number} {
  const h = fnv1a(key)
  return {lat: (h % 1201) / 10 - 60, lon: ((h >>> 11) % 3600) / 10 - 180}
}

/** One world as a place on your planet: where it lands, and whether that is written (its own body record's landing) or only where its ref puts it. */
export interface LandingLocation {
  readonly id: string
  readonly name: string
  readonly lat: number
  readonly lon: number
  readonly kind: 'place'
  /** false: the world is not landed yet and stands where its ref puts it; nothing is written until its person lands it (Land) */
  readonly written: boolean
}

/** Your planet's locations from today's worlds (manual §17.2: "Every world you start lands as a place on your planet"): each world whose body is
 * read, at its landing where its owner wrote one, else at the spot its ref names, said unwritten. A world that lands on another body is a place
 * on that one, and a world whose body is not read claims none: no reading, no claim. Pure. */
export function landingLocations(bodies: readonly SystemBody[]): LandingLocation[] {
  return bodies.flatMap((body): LandingLocation[] => {
    if (body.yours) return []
    if (body.landing) return [{id: body.key, name: body.world.name, lat: body.landing.lat, lon: body.landing.lon, kind: 'place', written: true}]
    if ((body.state !== 'built' && body.state !== 'seeded') || body.record?.landing) return []
    return [{id: body.key, name: body.world.name, ...spotOf(body.key), kind: 'place', written: false}]
  })
}

/** A world's colour wherever it shows (manual §17.2 "Your system": "on its track, its clips and its body"): the palette of its body's
 * ref as your system reads it, else of the ref its body is seeded with (`body:<the world's ref>`, the ref firstBody gives a register's
 * root space). For the world's track and clips (timeline/centralTrackAdapter.ts), so they wear the body's colour. Pure. */
export function worldColourOf(bodies: readonly SystemBody[], worldRef: string): Palette {
  return paletteOfRef(bodies.find(body => body.world.ref === worldRef)?.bodyRef ?? `body:${worldRef}`)
}
