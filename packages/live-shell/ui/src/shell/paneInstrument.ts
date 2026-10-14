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
 * - world.ground, native.session, native.arrangement, projection.timeline: the
 *   Timeline projection's presentations, paired as TechneLensBar pairs them —
 *   `arrangement` is the Timeline lens (techne:m2), `session` is the Journey
 *   lens (techne:m3). See ModeDetail.tsx LENSES. The projection.timeline pane
 *   (a Factory pane body) carries its presentation as its own state.
 * - world.expressions → the instrument of the hosted Expressions lens the
 *   frame stands in (HOSTED_INSTRUMENT: project→m0, canvas→m1, timeline→m2,
 *   journey→m3, place→m4, palace→m5). Until the frame reports a lens, the
 *   pane holds none (null).
 * - native.workbench, native.agent, world.settings, documents and any other
 *   pane hold no instrument → null.
 *
 * Lens bar (owner ruling, lock §0.1: the Device side and the lens follow the
 * focused pane): when the hosted Expressions pane stands focused, the bar
 * reads and drives the hosted lens. The two vocabularies differ in two ids,
 * mapped in one table here (BAR_LENS_OF_HOSTED); the rest are identical.
 *
 * Frame gates (deviceInstrumentFor): Live's centre is the audio cut, which
 * hides every centre pane but world.knowledge, so Live presents no
 * instrument and keeps its audio device chain. In Expressions, the native
 * panes keep their native device rack (NativeWorldDetail), the pane's own
 * controls, rather than being replaced by a held-face rack; the hosted pane
 * keeps it too while the hosted lens is canvas (m1), whose native rack is the
 * Expressions Canvas's own.
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

/** The hosted Expressions lens ids (protocol HostedTechneLens; the frame's own vocabulary). */
export type HostedLens = 'project' | 'canvas' | 'timeline' | 'journey' | 'place' | 'palace'

/** The hosted lens → the Technē holder it stands on. */
export const HOSTED_INSTRUMENT: Readonly<Record<HostedLens, TechneInstrumentId>> = {
  project: 'techne:m0',
  canvas: 'techne:m1',
  timeline: 'techne:m2',
  journey: 'techne:m3',
  place: 'techne:m4',
  palace: 'techne:m5',
}

/** The Technē lens bar's id → the hosted lens id, where the two vocabularies differ. Every other bar id is the hosted id. */
export const HOSTED_LENS_OF_BAR_ID: Readonly<Record<string, HostedLens>> = {
  'project-graph': 'project',
  places: 'place',
}

/** The hosted lens → the Technē lens bar's id: the one table both directions read. */
export const BAR_LENS_OF_HOSTED: Readonly<Record<HostedLens, string>> = {
  project: 'project-graph',
  canvas: 'canvas',
  timeline: 'timeline',
  journey: 'journey',
  place: 'places',
  palace: 'palace',
}

/** The hosted lens a lens bar entry drives, or null when the entry names no hosted lens. */
export function hostedLensOfBarId(barId: string): HostedLens | null {
  if (barId in HOSTED_LENS_OF_BAR_ID) return HOSTED_LENS_OF_BAR_ID[barId]
  return (Object.keys(BAR_LENS_OF_HOSTED) as HostedLens[]).find(lens => BAR_LENS_OF_HOSTED[lens] === barId) ?? null
}

/** The centre panels whose device side is their own native rack in Expressions. */
const EXPRESSIONS_OWN_DEVICES: ReadonlySet<string> = new Set(['world.expressions', 'native.session', 'native.arrangement', 'projection.expressions', 'projection.timeline'])

/** The instrument the focused centre pane holds, or null when it holds none.
 * `hostedLens` is the hosted Expressions lens the frame reports (null until it does). */
export function instrumentOfPane(
  centerPanel: string,
  presentation: TimelinePresentation | null,
  _atlasView: AtlasView,
  hostedLens: HostedLens | null = null,
): PaneInstrumentId | null {
  switch (centerPanel) {
    case 'projection.earth':
      // The 0 instrument: the atlas's Graph and Earth views are one instrument.
      return 'techne:m0'
    case 'world.knowledge':
      // The knowledge graph: its own standalone instrument.
      return 'knowledge-graph'
    case 'world.expressions':
      return hostedLens ? HOSTED_INSTRUMENT[hostedLens] : null
    case 'projection.expressions':
      // The stage pane (T-EXPRESSIONS-PANE-LEASE) presents the one hosted frame: its instrument is the lens the frame stands in.
      return hostedLens ? HOSTED_INSTRUMENT[hostedLens] : null
    case 'world.ground':
    case 'native.session':
    case 'native.arrangement':
    case 'projection.timeline':
      // The Session · Arrangement pane is a view of the mode's material, never Technē's Journey or Timeline instrument
      // (FOUNDATION F3): it holds no instrument, so the Device side stays the mode's own chain.
      void presentation
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
  hostedLens: HostedLens | null = null,
): PaneInstrumentId | null {
  if (frameMode === 'live') return null
  // In Expressions mode the hosted pane is the mode's own instrument: its own studio and native rack stand, whatever lens the
  // frame reports (it reports `project` by default) — never removed by the ruling. Elsewhere the hosted lens governs.
  if (frameMode === 'expressions' && EXPRESSIONS_OWN_DEVICES.has(centerPanel)) return null
  return instrumentOfPane(centerPanel, presentation, atlasView, hostedLens)
}

/** Whether the Technē lens bar stands above the centre: the centre holds an
 * instrument pane (the World cut, the Earth atlas or the hosted Expressions
 * pane), in any mode but Live. */
export function showsLensBar(frameMode: FrameModeName, centerPanel: string): boolean {
  if (frameMode === 'live') return false
  // Factory's centre is the pane tree, and the lens bar is how an instrument pane opens there: it stands over the agent tab
  // as over any instrument pane (its un-admitted lenses disabled with their reason).
  if (frameMode === 'factory') return true
  // The hosted Expressions pane carries the lens bar outside Expressions mode; in it, the pane's own studio is its chrome.
  if (centerPanel === 'world.expressions') return frameMode !== 'expressions'
  return centerPanel === 'world.ground' || centerPanel === 'projection.earth'
}

/** The centre pane a focused Factory tab stands for, so the existing `deviceInstrumentFor` reads its instrument (owner ruling,
 * 13 Oct 2026: a pane instrument works in Factory at full capability). The agent tab stands for AgentShellDeviceDetail: it
 * names `native.agent`, which holds no instrument. An Earth or Graph pane holds the 0 instrument; a Timeline pane holds the
 * Timeline lens (techne:m2) or the Journey (techne:m3), by its own presentation (`timelinePresentation`, the pane's state);
 * a knowledge pane is the standalone knowledge graph. Any other tab holds none. */
export function factoryFocusedPane(surfaceKind: string | undefined, timelinePresentation: TimelinePresentation = 'arrangement'): {pane: string; presentation: TimelinePresentation | null} {
  if (surfaceKind === 'projection.earth' || surfaceKind === 'projection.constellation') return {pane: 'projection.earth', presentation: null}
  if (surfaceKind === 'projection.timeline') return {pane: 'projection.timeline', presentation: timelinePresentation}
  if (surfaceKind === 'knowledge') return {pane: 'world.knowledge', presentation: null}
  if (surfaceKind === 'projection.expressions') return {pane: 'projection.expressions', presentation: null}
  if (surfaceKind === undefined || surfaceKind === 'agent-shell') return {pane: 'native.agent', presentation: null}
  return {pane: 'native.workbench', presentation: null}
}
