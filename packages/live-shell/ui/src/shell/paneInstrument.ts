/**
 * The focused centre pane's instrument (owner ruling, 13 Oct 2026): every
 * pane instrument works in every mode at full capability — nothing is
 * Technē-only. The detail row's Device side follows the focused pane's
 * instrument, whatever the mode; the mode supplies the material, the
 * instrument stays whole.
 *
 * The instrument ids are the six Technē holders (inhabitants/sdk/semantics.ts
 * TECHNE_INSTRUMENTS). The pane → instrument pairing is read from the code
 * that already pairs lenses with panels:
 * - projection.earth → techne:m0 (Project): the Earth and solar system with
 *   the atlas's Graph view. Its two atlas views, Earth and Graph, are the one
 *   0 instrument (lock §8.1; the lens bar's Project / graph and Places lenses
 *   both stand on this pane, App.tsx `atlasOpen`).
 * - world.knowledge → 'knowledge-graph': the wiki-constellation knowledge
 *   graph, a standalone instrument (owner correction, 13 Oct 2026). It is
 *   not the 0 instrument, and it has no device face declared yet: its Device
 *   side states that its controls are not yet declared.
 * - world.ground, native.session, native.arrangement: the Timeline
 *   projection's presentations, paired as TechneLensBar pairs them —
 *   `arrangement` is the Timeline lens (techne:m2), `session` is the Journey
 *   lens (techne:m3). See ModeDetail.tsx LENSES.
 * - world.expressions → techne:m1 (Canvas; the Expressions pane).
 * - native.workbench, native.agent, world.settings, documents and any other
 *   pane hold no instrument → null.
 *
 * Frame gates (deviceInstrumentFor): Live's centre is the audio cut, which
 * hides every centre pane but world.knowledge, so Live presents no
 * instrument and keeps its audio device chain. The Expressions native
 * panes keep their native device rack (NativeWorldDetail), the pane's own
 * controls, rather than being replaced by a held-face rack.
 *
 * Pure data: no React, no store, no I/O.
 */

import type {AtlasView} from '../projections/atlas/AtlasProjectionPanel'
import type {TimelinePresentation} from '../projections/timelinePresentation'

/** The six Technē instrument holders (sdk/semantics.ts TECHNE_INSTRUMENTS). */
export type TechneInstrumentId = 'techne:m0' | 'techne:m1' | 'techne:m2' | 'techne:m3' | 'techne:m4' | 'techne:m5'

/** A pane's instrument: a Technē holder, or the standalone knowledge graph
 * (no Technē holder, no device face declared yet). */
export type PaneInstrumentId = TechneInstrumentId | 'knowledge-graph'

/** The frame's mode reading (App.tsx `frameMode`). */
export type FrameModeName = 'live' | 'base' | 'factory' | 'expressions' | 'techne'

/** The centre panels whose device side is their own native rack in Expressions. */
const EXPRESSIONS_OWN_DEVICES: ReadonlySet<string> = new Set(['world.expressions', 'native.session', 'native.arrangement'])

/** The instrument the focused centre pane holds, or null when it holds none. */
export function instrumentOfPane(
  centerPanel: string,
  presentation: TimelinePresentation | null,
  _atlasView: AtlasView,
): PaneInstrumentId | null {
  switch (centerPanel) {
    case 'projection.earth':
      // The 0 instrument: the atlas's Graph and Earth views are one instrument.
      return 'techne:m0'
    case 'world.knowledge':
      // The knowledge graph: its own standalone instrument.
      return 'knowledge-graph'
    case 'world.expressions':
      return 'techne:m1'
    case 'world.ground':
    case 'native.session':
    case 'native.arrangement':
      if (presentation === 'arrangement') return 'techne:m2'
      if (presentation === 'session') return 'techne:m3'
      return null
    default:
      return null
  }
}

/** The instrument the detail row's Device side presents for this frame, or
 * null when the mode keeps its own Device side. */
export function deviceInstrumentFor(
  frameMode: FrameModeName,
  centerPanel: string,
  presentation: TimelinePresentation | null,
  atlasView: AtlasView,
): PaneInstrumentId | null {
  if (frameMode === 'live') return null
  if (frameMode === 'expressions' && EXPRESSIONS_OWN_DEVICES.has(centerPanel)) return null
  return instrumentOfPane(centerPanel, presentation, atlasView)
}

/** Whether the Technē lens bar stands above the centre: the centre holds an
 * instrument pane (the World cut or the Earth atlas), in any mode but Live. */
export function showsLensBar(frameMode: FrameModeName, centerPanel: string): boolean {
  return frameMode !== 'live' && (centerPanel === 'world.ground' || centerPanel === 'projection.earth')
}
