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
 *   0 instrument (lock §8.1; the Project / graph and Places views both stand
 *   on this pane, App.tsx `atlasOpen`).
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
 * Lens bar: retired (#762) with shell/ModeDetail.tsx's TechneLensBar; a lens's
 * controls stand on the Lens (manual §17.11), and the hosted lens the frame
 * reports is read through HOSTED_INSTRUMENT alone. Its two-way table of bar ids
 * (HOSTED_LENS_OF_BAR_ID, BAR_LENS_OF_HOSTED, hostedLensOfBarId) went with it.
 *
 * Mode gates. Live keeps its audio device chain whatever pane is focused: that
 * is MODE_DETAILS.live.ownsDeviceSide (shell/modeDetails.tsx), applied once, by
 * the one detail host (frame/detail/DetailHost.tsx) — this module pairs panes
 * with instruments and holds no Live rule. In Expressions, the native panes
 * keep their native device rack (NativeWorldDetail), the pane's own controls,
 * rather than being replaced by a held-face rack (OWN_DEVICE_PANELS, the one
 * table of it below); the hosted pane keeps it too while the hosted lens is
 * canvas (m1), whose native rack is the Expressions Canvas's own.
 *
 * Pure data: no React, no store, no I/O.
 */

import type {AtlasView} from '../projections/atlas/AtlasProjectionPanel'
import type {TimelinePresentation} from '../projections/timelinePaneHost'

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

/** The centre panels whose device side stays the mode's own native rack, by mode (a registration, never a branch): in
 * Expressions, the open work's panes. A mode absent here lets the focused pane's instrument take the Device side. */
const OWN_DEVICE_PANELS: Readonly<Partial<Record<FrameModeName, ReadonlySet<string>>>> = {
  expressions: new Set(['world.expressions', 'native.session', 'native.arrangement', 'projection.expressions', 'projection.timeline']),
}

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

/** The instrument the detail row's Device side presents for this frame, or null when the mode keeps its own Device side
 * for this pane. A mode that keeps its Device side whatever pane is focused (Live) is vetoed by the detail host, from
 * MODE_DETAILS.ownsDeviceSide — not here. */
export function deviceInstrumentFor(
  frameMode: FrameModeName,
  centerPanel: string,
  presentation: TimelinePresentation | null,
  atlasView: AtlasView,
  hostedLens: HostedLens | null = null,
): PaneInstrumentId | null {
  // In Expressions mode the hosted pane is the mode's own instrument: its own studio and native rack stand, whatever lens the
  // frame reports (it reports `project` by default) — never removed by the ruling. Elsewhere the hosted lens governs.
  if (OWN_DEVICE_PANELS[frameMode]?.has(centerPanel)) return null
  return instrumentOfPane(centerPanel, presentation, atlasView, hostedLens)
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
