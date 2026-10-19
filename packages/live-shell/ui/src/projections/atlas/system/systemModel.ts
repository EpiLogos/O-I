// Your system (manual §17.2 "Your system"; §2 "every world is drawn as a body in space"; T-WORLDS §5 W3 phase B): each world in today's
// set is a body of its own, built from its register's own world body, landing at its place on your planet, and what you hold circles the
// body it belongs to. A pure model: the owners' readings in, the bodies and their satellites out. No DOM, no React, no transport.
//
// It reads, and never re-derives:
//   - the worlds Central discloses and today's set (central/centralWorlds.ts worldsOf; central/daySet.ts daySetOf through
//     frame/tracks/useCentralTracks.ts setReadingOf): your world first, then the Day's set in its own order;
//   - each world's body, `aikit.world-body/v1` on its register's root space, as the kernel's `world_body_read` answers it (project
//     worlds by their project; kernel construction.rs read_body);
//   - the pages that play now (useCentralTracks.ts playingOf: each a NOW clearing whose task is `oi:page:<ref>`), by the register
//     whose NOW holds them, and the agent sessions at work (agent/AgentSessionsProvider.tsx), on the inner ring;
//   - the files and context to hand (the workspace's open source and its works to hand, shell/workspaceTypes.ts), on the outer ring.
//
// Laws kept: a world with no body yet is drawn from a body seeded from its ref (body/worldBody.ts firstBody, the very body its first
// change would build on) and says so; nothing is written until the person acts. A world whose body is not read is drawn hollow, with the
// owner's words. Its colour is the world's colour everywhere (provider/suiteReading.ts paletteOfRef of its body_ref). Every satellite's
// place on its ring is keyed by its subject (fnv1a of its ref), so it keeps its place however the list around it changes. No creature:
// a satellite is drawn as the plain satellite it is (the owner places the faces of agent types; T-WORLDS §1, withdrawn).
import type {WorldBodyReading} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {CentralWorld} from '../../../central/centralWorlds'
import type {CentralPlaying} from '../../../timeline/centralTrackAdapter'
import type {Palette} from '../src/types/field'
import type {WorldBodyRecord} from '../src/globe/body'
import {fnv1a, paletteOfRef} from '../provider/suiteReading'
import {firstBody} from '../body/worldBody'

/** A world's body as its owner last answered. */
export type SystemBodyReading =
  | {readonly state: 'reading'}
  /** `record` is null while the register's root space carries no body yet. */
  | {readonly state: 'read'; readonly reading: WorldBodyReading; readonly record: WorldBodyRecord | null}
  | {readonly state: 'refused'; readonly reason: string}

/** What a satellite is: a page that plays, an agent session at work, a file open now, a work to hand. */
export type SatelliteKind = 'page' | 'session' | 'file' | 'work'

export interface SystemSatellite {
  /** the subject's own ref (a page's file ref, a session's ref, a file's ref, a work's expression ref): its key and its place */
  readonly id: string
  readonly name: string
  readonly ring: 'inner' | 'outer'
  readonly kind: SatelliteKind
  /** its place on its ring, radians, from its ref alone */
  readonly phase: number
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
  readonly landing: {readonly lat: number; readonly lon: number} | null
  /** why it has no landing on your planet (null for your own world and a landed one) */
  readonly unlanded: string | null
  /** its place on the ring of worlds around your planet, radians (your own world stands at its centre: 0) */
  readonly phase: number
  readonly satellites: readonly SystemSatellite[]
}

/** The files and context to hand: the source the workspace holds open, and the works it has to hand. */
export interface ToHand {
  readonly file: {readonly ref: string; readonly path: string; readonly name?: string} | null
  readonly works: readonly {readonly expression_ref: string; readonly title: string}[]
}

/** An agent session at work, as the sessions provider builds its tracks (agent/agentRunModel.ts AgentSessionTrack). */
export interface SessionLike {
  readonly sessionRef: string
  readonly agentName: string | null
  readonly purpose: string | null
  readonly group: boolean
}

export interface SystemInput {
  /** the worlds of today's set, your world first (systemWorlds) */
  readonly worlds: readonly CentralWorld[]
  /** each world's body, by the world's ref; your world's is the root register's (body/worldBody.ts) */
  readonly bodies: ReadonlyMap<string, SystemBodyReading>
  readonly playing: readonly CentralPlaying[]
  /** the pages' titles, by page ref (the page owner's listing of each world's folder); a page with none is named by its file */
  readonly titles?: ReadonlyMap<string, string>
  readonly sessions: readonly SessionLike[]
  readonly hand: ToHand
}

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
const fileName = (path: string): string => tail(path).replace(/\.[a-z0-9]+$/i, '')

/** The worlds of today's set: your world first, then each world the Day's set holds, in the set's order (useCentralTracks.ts inSet
 * keeps the disclosure's order; the System keeps the set's, which is the order the person brought them in). A world the set names
 * that Central no longer discloses is left out. Pure. */
export function systemWorlds(disclosed: readonly CentralWorld[], setWorlds: readonly string[]): CentralWorld[] {
  const yours = disclosed.find(world => world.kind === 'yours')
  const held = setWorlds.flatMap(ref => disclosed.filter(world => world.ref === ref && world.kind !== 'yours'))
  return [...(yours ? [yours] : []), ...held.filter((world, index) => held.findIndex(other => other.ref === world.ref) === index)]
}

/** The world a register's NOW belongs to: a project's world by its project, your world for the root's (null). */
const worldOfProject = (worlds: readonly CentralWorld[], project: string | null): CentralWorld | undefined =>
  project ? worlds.find(world => world.project === project) : worlds.find(world => world.kind === 'yours')

/** The world a file belongs to: the project world whose project folder (Work/<Name>/) holds it, else your world. */
export function worldOfPath(worlds: readonly CentralWorld[], path: string): CentralWorld | undefined {
  const project = worlds.find(world => world.project && (path.startsWith(`Work/${world.project}/`) || path.startsWith(`${world.folder}/`)))
  return project ?? worlds.find(world => world.kind === 'yours')
}

function satellitesOf(world: CentralWorld, input: SystemInput): SystemSatellite[] {
  const inner: SystemSatellite[] = input.playing
    .filter(item => worldOfProject(input.worlds, item.project)?.ref === world.ref)
    .map(item => {
      const name = input.titles?.get(item.pageRef) ?? fileName(item.pageRef)
      return {id: item.pageRef, name, ring: 'inner', kind: 'page', phase: ringPhase(item.pageRef),
        hint: `${name} — a page open now, in its moment ${item.nowRef}. Select to open it.`}
    })
  const sessions: SystemSatellite[] = world.kind === 'yours'
    ? input.sessions.filter(session => !session.group).map(session => {
      const name = session.agentName ?? session.purpose ?? tail(session.sessionRef)
      return {id: session.sessionRef, name, ring: 'inner', kind: 'session', phase: ringPhase(session.sessionRef),
        hint: `${name} — an agent at work (${session.sessionRef})${session.purpose && session.agentName ? `: ${session.purpose}` : ''}. Select to choose its session.`}
    })
    : []
  const file = input.hand.file
  const files: SystemSatellite[] = file && worldOfPath(input.worlds, file.path)?.ref === world.ref
    ? [{id: file.ref, name: file.name ?? fileName(file.path), ring: 'outer', kind: 'file', phase: ringPhase(file.ref), hint: `${file.path} — the file you have open now.`}]
    : []
  const works: SystemSatellite[] = world.kind === 'yours'
    ? input.hand.works.map(work => ({id: work.expression_ref, name: work.title, ring: 'outer', kind: 'work', phase: ringPhase(work.expression_ref),
      hint: `${work.title} — a work you have to hand (${work.expression_ref}). Select to open it in its instrument.`}))
    : []
  return [...inner, ...sessions, ...files, ...works]
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
      phase: isYours ? 0 : ringPhase(world.ref), satellites: satellitesOf(world, input),
    }
  })
}

/** Your planet's locations from today's worlds: each world that lands on your planet, at its landing, as the World design's Locations
 * read them (`{id, name, lat, lon, kind}`). Pure. */
export function landingLocations(bodies: readonly SystemBody[]): {id: string; name: string; lat: number; lon: number; kind: 'place'}[] {
  return bodies.flatMap(body => (body.landing ? [{id: body.key, name: body.world.name, lat: body.landing.lat, lon: body.landing.lon, kind: 'place' as const}] : []))
}

/** A world's colour wherever it shows (manual §17.2 "Your system": "on its track, its clips and its body"): the palette of its body's
 * ref as your system reads it, else of the ref its body is seeded with (`body:<the world's ref>`, the ref firstBody gives a register's
 * root space). For the world's track and clips (timeline/centralTrackAdapter.ts), so they wear the body's colour. Pure. */
export function worldColourOf(bodies: readonly SystemBody[], worldRef: string): Palette {
  return paletteOfRef(bodies.find(body => body.world.ref === worldRef)?.bodyRef ?? `body:${worldRef}`)
}
