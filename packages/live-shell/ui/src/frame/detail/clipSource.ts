// A clip's source, the same in every mode's clip binding (manual §16.5: "A clip's source is its constellation, as a sample is an audio
// clip's. The Clip panel names it under Constellation, in every mode, and Show in Browser beside it selects it in the browser (§10.3).
// An edit changes the clip, never the constellation"; decision #709: "each clip's source is its constellation").
//
// Each mode's owner keeps the source in its own format (#709 "Files": "each mode keeps its own format"): a page's island, a scene's
// body, the wiki that gathers an event's subject. The mode's binding reads it from that owner and hands it here as a ClipSource; this
// module names it from the wiki's reading (owners/constellations.ts) onto the design's keys (clips/design.ts MADE_OF) and wires Show in
// Browser to the browser's selection (frame/browser/constellationFocus.ts). Where no owner keeps a clip's source yet, the key stands
// absent and Show in Browser stands dimmed, naming the operation the owner lacks. Pure.
import {MADE_OF} from '../../inhabitants/catalogue/clips/design'
import {constellationNamed, type Constellation} from '../../owners/constellations'
import {showConstellationInBrowser} from '../browser/constellationFocus'
import type {ClipWiring, Value, Values} from './clipBinding'

/** What a clip's owner reports of its source. */
export type ClipSource =
  /** Made of the constellation `ref`; `by` names where its owner keeps it. */
  | {readonly made: 'of'; readonly ref: string; readonly by: string}
  /** The owner reads the clip and it was made of no constellation. */
  | {readonly made: 'none'; readonly by: string}
  /** No owner reports the clip's source: `why`, in the owner's words. */
  | {readonly made: 'unread'; readonly why: string}

export const NONE = 'None'
const NOTHING_TO_SHOW = 'The clip was made of no constellation, so there is nothing to show in the browser.'

/** The source's values on the design's keys: the constellation's name as the wiki reads it (its ref while the wiki does not name it),
 * and its ref; "None" for a clip made of none; nothing for one no owner reports. Pure. */
export function madeOfValues(source: ClipSource, rows: readonly Constellation[] | null | undefined): Values {
  if (source.made === 'none') return {[MADE_OF.name]: NONE}
  if (source.made === 'unread') return {}
  return {[MADE_OF.name]: constellationNamed(rows ?? [], source.ref)?.title ?? source.ref, [MADE_OF.ref]: source.ref}
}

/** A wiring with the source's keys named: read from the owner `by` names, or absent with why; Show in Browser an act where the clip was
 * made of a constellation, else refused in words. Pure. */
export function withMadeOf(wiring: ClipWiring, source: ClipSource): ClipWiring {
  const refused: Record<string, string> = {...wiring.refused}
  const acts: Record<string, (value: Value) => Promise<void>> = {...wiring.acts}
  const reads: Record<string, string> = {...wiring.reads}
  const absent: Record<string, string> = {...wiring.absent ?? {}}
  for (const key of [MADE_OF.name, MADE_OF.ref]) { delete reads[key]; delete absent[key] }
  delete refused[MADE_OF.show]; delete acts[MADE_OF.show]
  if (source.made === 'unread') {
    absent[MADE_OF.name] = source.why; absent[MADE_OF.ref] = source.why
    refused[MADE_OF.show] = source.why
  } else {
    reads[MADE_OF.name] = `the constellation's name in the wiki's reading (owners/constellations.ts), from ${source.by}`
    reads[MADE_OF.ref] = source.by
    if (source.made === 'of') { const ref = source.ref; acts[MADE_OF.show] = async () => showConstellationInBrowser(ref) }
    else refused[MADE_OF.show] = NOTHING_TO_SHOW
  }
  return {...wiring, reads, acts, refused, absent}
}
