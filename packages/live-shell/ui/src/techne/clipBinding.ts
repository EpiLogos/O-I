// Technē's clip binding (manual §17.1 Clip view; §16.5's table: "Technē — An event or a walk's stop — Material, Relations,
// Constellation, Source — Arrival, and the walk's next stop — None"): what THE selection holds, on the owners the replaced bodies
// read, mapped onto the keys of the designed clip `clip:techne` (inhabitants/catalogue/clips/techne.tsx). It replaces three Clip
// side bodies (shell/modeDetails.tsx TechneClip, as it stood):
//   - an event over the World cut — shell/ModeDetail.tsx TechneClipDetail: the spine's retained occasion and the event row it was
//     retained from (projections/useWorldTemporalReading.ts): its summary, kind, the owner's verbatim standing (techne/m0m5/
//     timeline/standing.ts — a class never upgrades it), its instant and civil day, its stream and place in it, its admission, and
//     the evidence it names as its relations and its bounded whole;
//   - a stop of a walk on the Technē tracks — timeline/techneTrackAdapter.ts: its label, its year on the ruler, and the next stop it
//     follows to (its `launch.follow`, which only a grid cell's hover text showed);
//   - a World subject in hand — techne/subject/WorldSubjectClip.tsx: what it is, its ref, and the Scenes the subject door found that
//     carry it, as the material it gathers.
// A Scene clip of the open Expression selected in Technē is an Expressions clip: the Expressions binding hosts it (the selected
// clip's mode). An event and a stop have no tools and no envelopes. Their launch settings (arrival, transition, curve, switch) have
// no owner yet, and refuse in the journey owner's words. Pure, apart from the hook at the end.
import {useEffect, useState} from 'react'
import {standingOf} from '../../../../../desktop/cradle/src/techne/m0m5/timeline/standing'
import type {Value, Values} from '../frame/devices/designed'
import {clipBinding, missingOp, useViewHoldsVersion, type ClipBinding, type ClipWiring} from '../frame/detail/clipBinding'
import {madeOfValues, withMadeOf, type ClipSource} from '../frame/detail/clipSource'
import {constellationOfSubject, useConstellations, type Constellation} from '../owners/constellations'
import {useSelectedClip, type SelectedClip} from '../frame/detail/ClipBox'
import {useDetailReading} from '../frame/detail/detailReading'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import {useTimelinePanePresentation} from '../projections/timelinePaneHost'
import {chooseHeldScene, hasScenes, useSubjectOpenings, type SubjectOpening} from './subject/subjectOpenings'
import {sceneRowsOf} from './subject/worldRows'

/** The design's standing words (clips/techne.tsx STANDING). */
const STANDINGS = new Set(['fact', 'claim', 'inference', 'guess', 'dispute', 'gap'])
/** The owner's verbatim standing as the design names it: the word itself where it is one of the design's six; a disputed or alleged
 * claim (standing.ts DISPUTED) as a dispute; anything else is not the design's word and stays absent (never upgraded). Pure. */
export function designStanding(verbatim: string | null, visual: string): string | undefined {
  const word = verbatim?.trim().toLowerCase()
  if (word && STANDINGS.has(word)) return word
  return visual === 'disputed' ? 'dispute' : undefined
}

const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && value !== '' && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

/** The ref's last part, as a node's name (TechneClipDetail's TechneConstellation label). */
const tail = (ref: string) => (ref.split(/[/:#]/).filter(Boolean).pop() ?? ref).slice(0, 24)

/** The selected clip's span, in the ruler's words. */
function spanOf(selected: SelectedClip): string | undefined {
  const clip = selected.clip
  if (!clip) return undefined
  const label = selected.set?.ruler?.label ?? ((at: number) => String(at))
  const start = clip.at?.start ?? clip.span?.start, end = clip.at?.end ?? clip.span?.end
  return start === undefined ? undefined : `${label(start)}${end !== undefined && end !== start ? ` – ${label(end)}` : ''}`
}

/** An event over the World cut: the spine's retained occasion and its event row (ported from TechneClipDetail). Null when the spine
 * retains none. Pure. */
export function worldEventValues(world: WorldTimelineView, selected: SelectedClip): Values | null {
  const occasion = world.spine.occasion() ?? null
  if (!occasion) return null
  const event = world.source.events.find(row => row.subject_ref === occasion.basis.ref && (row.instant_unix_ms ?? null) === occasion.basis.instantUnixMs) ?? null
  const evidence = occasion.basis.evidenceRefs ?? event?.evidence_refs ?? []
  const standing = standingOf({standing: undefined, evidence_refs: evidence})
  const word = designStanding(standing.verbatim, standing.visual)
  const values: Record<string, Value> = {kind: 'event'}
  put(values, 'name', occasion.basis.summary ?? occasion.basis.ref)
  put(values, 'colour', selected.track?.color)
  put(values, 'event.kind', event?.kind)
  put(values, 'standing', word)
  const instant = occasion.basis.instantUnixMs != null ? `${new Date(occasion.basis.instantUnixMs).toISOString().slice(0, 16).replace('T', ' ')} UTC` : null
  const day = occasion.basis.civilDayRef ?? event?.day_ref ?? null
  put(values, 'date', instant ? `${instant}${day ? ` · ${day}` : ''}` : day)
  put(values, 'span', spanOf(selected))
  if (event?.stream) values['source.ref'] = `${event.stream}${event.stream_position ? ` · ${event.stream_position}` : ''}`
  put(values, 'source.text', occasion.basis.summary)
  const admission = occasion.admission ?? null
  if (admission) values['source.admitted'] = `${admission.admitted ? 'Admitted' : 'No longer in the reading'}${admission.disclosure ? ` · ${admission.disclosure}` : ''}`
  if (evidence.length) {
    values.relations = JSON.stringify(evidence.map(ref => ({type: 'evidence', to: ref, standing: word ?? standing.verbatim ?? '—', ...(event?.stream ? {by: event.stream} : {})})))
    const focus = {id: 'focus', label: occasion.basis.summary ?? occasion.basis.ref}
    const shown = evidence.slice(0, 12)
    values.constellation = JSON.stringify({nodes: [focus, ...shown.map((ref, i) => ({id: `e${i}`, label: tail(ref)}))],
      edges: shown.map((_, i) => ({from: 'focus', to: `e${i}`, standing: word ?? '—'}))})
  }
  return values
}

/** A stop of a walk on the Technē tracks: its label, its year on the ruler, its next stop (techneTrackAdapter.ts). Null when the
 * selected clip is no stop. Pure. */
export function walkStopValues(selected: SelectedClip): Values | null {
  const clip = selected.clip
  if (!clip || !clip.columnId.startsWith('techne:row:stop:')) return null
  const values: Record<string, Value> = {kind: 'stop', name: clip.label}
  put(values, 'colour', selected.track?.color)
  const label = selected.set?.ruler?.label
  if (clip.at && label) values['stop.moment'] = label(clip.at.start)
  if (clip.launch?.follow) values.follow = 'next'
  return values
}

/** A World subject in hand (ported from WorldSubjectClip.tsx): what it is, its ref, and the Scenes that carry it. Pure. */
export function worldSubjectValues(subject: {kind: string; ref: string; title: string}, opening: SubjectOpening | undefined): Values {
  const values: Record<string, Value> = {kind: 'event', name: subject.title, 'event.kind': SUBJECT_KIND[subject.kind] ?? subject.kind, 'source.ref': subject.ref}
  if (opening?.state === 'absent' || opening?.state === 'refused') values['source.admitted'] = opening.reason
  const scenes = sceneRowsOf(opening, subject.title)
  if (scenes.length) values.material = JSON.stringify(scenes.map(scene => ({at: scene.asked ? 'asked' : '', kind: 'scene', text: scene.name, source: scene.standing})))
  return values
}
const SUBJECT_KIND: Readonly<Record<string, string>> = {location: 'Location · a project space on your planet', place: 'Earth place · declared by its owner'}

const JOURNEY = 'Technē journey (the World cut\'s walks, timeline/techneTrackAdapter.ts)'
const STOP_SETTING = (what: string, field: string) => missingOp(what, `walk_stop_set {walk, stop, ${field}} → the stop at its new reading`, JOURNEY)

/** clip:techne's wiring before its source: every key the design draws or sets. */
const EVENT_WIRING: ClipWiring = {
  reads: {
    kind: 'event (the World cut\'s occasion, a World subject) or stop (a walk\'s stop clip)', name: 'the occasion\'s summary; the stop\'s or the subject\'s name',
    colour: 'the clip\'s track colour', 'event.kind': 'the event row\'s kind; what a subject is', standing: 'the owner\'s verbatim standing, where it is one of the six',
    date: 'the occasion\'s instant and civil day', span: 'the clip\'s place on the ruler', 'source.ref': 'the event\'s stream and its place in it; the subject\'s ref',
    'source.text': 'the event as the reading gives it', 'source.admitted': 'the occasion\'s current admission; the subject door\'s answer',
    relations: 'the evidence the event names, in its standing', constellation: 'the event and the evidence it names', material: 'the Scenes that carry a subject',
    'stop.moment': 'the stop\'s year on the ruler', follow: 'the stop follows to the walk\'s next stop',
  },
  acts: {},
  view: {},
  refused: {
    arrival: STOP_SETTING('Arrival', 'arrival: global|fly|cut|fade'), follow: STOP_SETTING('Follow action', 'follow: next|stay|start'),
    transition: STOP_SETTING('Transition time', 'transition_s'), curve: STOP_SETTING('Curve', 'curve'), switch: STOP_SETTING('Switch', 'switch: once|step|end'),
  },
  absent: {
    place: 'the World cut\'s reading places no event', parent: 'the reading names no parent event', 'source.revision': 'the World cut\'s reading carries no revision for an event',
    'stop.place': 'a stop clip carries no place', 'stop.thing': 'a stop clip names no thing', 'stop.scene': 'a stop clip names no scene', 'stop.narration': 'no narration is read',
    arrival: 'no stop holds an arrival', transition: 'not read', curve: 'not read', switch: 'not read',
  },
}

/** Where an event's source is read (manual §17.1 The Clip panel: "Constellation — A constellation of your wiki — The event's source"): the
 * wiki, whose constellation is the subject's own whole or gathers it (owners/constellations.ts constellationOfSubject). */
const WIKI_GATHERS = 'the wiki: the constellation whose whole the event\'s subject is, or that gathers it (owners/constellations.ts)'

/** clip:techne's wiring: every key the design draws or sets. */
export const TECHNE_WIRING: ClipWiring = withMadeOf(EVENT_WIRING, {made: 'none', by: WIKI_GATHERS})

/** An event's or a World subject's source: the constellation the wiki gathers its subject in, or none once every register is read;
 * unread while the wiki, or a register that may gather it, is still being read. Pure. */
export function subjectSourceOf(subjectRef: string | null | undefined, constellations: readonly Constellation[] | null | undefined, pending = false): ClipSource {
  const unread: ClipSource = {made: 'unread', why: 'The wiki is still being read, so the constellation that gathers the event is not named yet.'}
  if (!constellations) return unread
  const found = constellationOfSubject(constellations, subjectRef)
  return found ? {made: 'of', ref: found.ref, by: WIKI_GATHERS} : pending ? unread : {made: 'none', by: WIKI_GATHERS}
}
/** A walk's stop names no thing the wiki could gather (TECHNE_WIRING absent 'stop.thing'). */
const STOP_SOURCE: ClipSource = {made: 'unread', why: 'A walk\'s stop names no thing, so no constellation gathers it: the walk keeps no stop\'s thing yet.'}

/** A World subject's wiring: clip:techne's, and the subject door's own act — open another Scene that carries it (WorldSubjectClip.tsx's
 * press on a Scene row, `chooseHeldScene`), by its row in the material. The design's Material rows draw no press yet (PROPOSE): the
 * act stands ready for `material.open` with the row's index. */
export function subjectWiring(subject: {ref: string; title: string}, opening: SubjectOpening | undefined): ClipWiring {
  return {...TECHNE_WIRING, acts: {...TECHNE_WIRING.acts, 'material.open': async value => {
    const scene = hasScenes(opening) ? opening.scenes[Number(value)] : undefined
    if (!scene) throw new Error('The subject door holds no such Scene: double-click the subject\'s row in the browser to ask again.')
    if (!chooseHeldScene(subject.ref, scene, subject.title)) throw new Error('The subject door no longer holds that Scene for this subject.')
  }}}
}

export interface TechneClipInput {
  readonly worldCut: boolean
  readonly world: WorldTimelineView | null
  readonly worldSubject?: {kind: string; ref: string; title: string} | null
  readonly opening?: SubjectOpening
  readonly selected: SelectedClip
  readonly placed?: boolean
  /** The wiki's constellations, which gather the event's subject (owners/constellations.ts), and whether a register is still being read. */
  readonly constellations?: readonly Constellation[] | null
  readonly wikiPending?: boolean
}

/** Technē's clip binding: a World subject, a walk stop, or the World cut's event, in that order; null when none stands. Pure. */
export function techneClipBinding(input: TechneClipInput): ClipBinding | null {
  const {selected} = input
  const rows = input.constellations
  if (input.worldSubject) {
    const source = subjectSourceOf(input.worldSubject.ref, rows, input.wikiPending)
    return clipBinding({mode: 'techne', ref: `subject:${input.worldSubject.ref}`, values: {...worldSubjectValues(input.worldSubject, input.opening), ...madeOfValues(source, rows)},
      wiring: withMadeOf(subjectWiring(input.worldSubject, input.opening), source), placed: true, viewDefaults: {'view.editor': 'material'}})
  }
  const stop = walkStopValues(selected)
  if (stop) return clipBinding({mode: 'techne', ref: selected.ref ?? selected.clip!.id, values: stop, wiring: withMadeOf(TECHNE_WIRING, STOP_SOURCE), placed: input.placed})
  if (input.worldCut && input.world) {
    const event = worldEventValues(input.world, selected)
    const source = subjectSourceOf(input.world.spine.occasion()?.basis.ref, rows, input.wikiPending)
    if (event) return clipBinding({mode: 'techne', ref: selected.ref ?? `occasion:${String(event.name)}`, values: {...event, ...madeOfValues(source, rows)},
      wiring: withMadeOf(TECHNE_WIRING, source), placed: input.placed, viewDefaults: {'view.editor': 'relations'}})
  }
  return null
}

/** The Technē clip THE selection holds, re-read when the spine moves (TechneClipDetail subscribed the same way). */
export function useTechneClip(): ClipBinding | null {
  const {worldCut, world, worldSubject} = useDetailReading()
  const selected = useSelectedClip()
  const openings = useSubjectOpenings()
  const presentation = useTimelinePanePresentation()
  const [, setTick] = useState(0)
  useEffect(() => world?.spine.subscribe(() => setTick(value => value + 1)), [world])
  useViewHoldsVersion()
  const wiki = useConstellations()
  // Until the World has disclosed the registers nothing is read, and while a register is read the source may still be found there:
  // either way it is unread, never "None".
  return techneClipBinding({worldCut, world, worldSubject, opening: worldSubject ? openings.get(worldSubject.ref) : undefined, selected,
    placed: presentation === 'arrangement', constellations: wiki.registers > 0 ? wiki.rows : null, wikiPending: wiki.reading.length > 0})
}
