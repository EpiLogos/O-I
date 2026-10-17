// The Graph opens on the subject the instruments hold [the ticket N, PATH §7 G2 (register lane-1:D1); DLW manual §10.2 "A pane
// follows what you select, unless you pin it"; FOUNDATION F1, one selection].
//
// Changing instrument keeps the subject. The stage's lenses (Canvas, Timeline, Journey, Palace) turn the one stage, which keeps its
// open Scene. The Graph is the atlas in its graph view (`projection.constellation`, registerAtlasHost.ts) — a pane of its own,
// which follows THE selection but, as the atlas's follow rule stands, does not turn to the selection already standing when it
// mounts (registerAtlasHost.ts `turnWithSubject`). So when the Graph opens, it turns to the subject held now, through the atlas's
// own focus: the manifestation of the subject's occurrence (registerAtlasHost.ts `stateForSubject`, ported from the atlas's pick,
// src/app/controller.ts `onPick`'s manifest navigation) handed to the atlas's own navigation (`Controller.navigate`). No second navigation
// state: the subject is THE selection, read from the pane's own encounter.
//
// When the Graph draws no node for the subject, it says so, plainly, where the instruments' outcomes are said (the Instruments
// section's line, frame/instrumentDoor.ts `reportInstrumentFault`) — never in the pane's body, never a toast.
//
// Pure TypeScript: the atlas, its focus rule and the line are handed in, so the module loads no atlas.

import type {EncounterBridge, PaneSubject} from '../../../../../../desktop/cradle/src/surface/projectionModules'
import {reportInstrumentFault} from '../../frame/instrumentDoor'

/** The mounted atlas as this needs it: its model, its controller's state and navigation (projections/atlas/mount.ts AtlasHandle). */
export interface FocusableAtlas<Model, State, Next> {
  readonly model: Model
  readonly ctl: {readonly state: State; navigate(next: Next): void}
}

export interface GraphOpen<Model, State extends {sky?: unknown}, Next> {
  /** The pane's subject: its pin, else the selection it follows. */
  subject: PaneSubject | undefined
  /** The pane's encounter, for the selection's words. */
  encounter: Pick<EncounterBridge, 'snapshot'>
  /** Non-null when another pane holds the atlas (this pane only says so). */
  held: string | null
  /** The mounted atlas, null when none is mounted. */
  atlas: FocusableAtlas<Model, State, Next> | null
  /** The atlas's own rule for the state that shows a subject (registerAtlasHost.ts `stateForSubject`). */
  stateFor: (model: Model, ref: string, current: State) => Next | null
}

export type GraphFocus = 'focused' | 'no-node' | 'none'

/** The words the Graph says when it draws no node for the held subject. */
export function noNodeWords(title: string | null): string {
  return `The Graph draws no node for ${title ?? 'the subject you hold'}: no subject your world's reading draws carries its ref, so the Graph opens where it was.`
}

/** The held subject's words: THE selection's (or the encounter subject's) title when it names the ref the pane shows. */
function titleOf(encounter: Pick<EncounterBridge, 'snapshot'>, ref: string): string | null {
  const snapshot = encounter.snapshot()
  if (snapshot.selection?.ref === ref) return snapshot.selection.title
  if (snapshot.subject?.ref === ref) return snapshot.subject.title
  return null
}

/** Turn the Graph, as it opens, to the subject the pane follows. A pinned pane is the atlas's own rule's (it turns to its pin at
 * mount); a held pane, or no atlas, turns nothing; a sky the person went into is left as it is. */
export function focusGraphOnOpen<Model, State extends {sky?: unknown}, Next>(open: GraphOpen<Model, State, Next>, say: (words: string | null) => void = reportInstrumentFault): GraphFocus {
  const {subject, atlas} = open
  if (!subject || subject.pinned() !== undefined || open.held !== null || !atlas) return 'none'
  const ref = subject.shown()
  if (!ref) return 'none'
  const next = open.stateFor(atlas.model, ref, atlas.ctl.state)
  if (next) {
    atlas.ctl.navigate(next)
    return 'focused'
  }
  if (atlas.ctl.state.sky) return 'none'
  say(noNodeWords(titleOf(open.encounter, ref)))
  return 'no-node'
}
