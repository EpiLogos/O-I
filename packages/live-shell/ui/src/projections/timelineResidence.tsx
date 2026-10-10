/**
 * The Timeline projection's presentation residence (WORLD-SHELL-DESIGN §3.2,
 * §10 seams 1/5; UI-UX-CONVERGENCE-STUDY fault table, App.tsx row).
 *
 * Session and Arrangement are the TWO PRESENTATIONS OF ONE TIMELINE
 * PROJECTION over the current work — not audio-mode features and not two
 * independent inhabitants. This component is that one projection instance as
 * the App frame hosts it:
 *
 * - both presentations mount retained (the App's hidden-inhabitant pattern:
 *   CSS-hidden residents stay mounted), so returning to a presentation
 *   restores its exact state;
 * - which presentation stands is read from the ENCOUNTER (mode × the
 *   application-view identity), never from a second store:
 *   `timelinePresentation` is the whole mapping;
 * - the recorded fault stays fixed: choosing a presentation never switches
 *   the workspace to audio — the audio cut keeps its existing props and its
 *   `tab` presentation; the native cut keeps the established
 *   `native.session` / `native.arrangement` identity the instrumentation
 *   receiving joins are bound to, with the native prop grammar
 *   (`NativeCompositionViewSource`, `revealDetail`) untouched;
 * - no second scrub bar (the Arrangement presentation's integrated overview
 *   stays the single navigation surface) and no false tab strip (the
 *   transport's Session/Arrangement controls select a presentation).
 *
 * The component renders a FRAGMENT: the two presentation divs remain direct
 * children of `.center-body`, byte-identical in the DOM contract that
 * `NativeCompositionResidence.css` and the receiving joins key on. The
 * projection identity rides `data-projection-kind`, not new structure.
 */
import {Fragment} from 'react'
import {ArrangementView} from '../components/ArrangementView'
import {SessionView, type SetSelection} from '../components/SessionView'
import type {NativeCompositionViewSource} from '../shell/compositionViews'
import type {SetDocument} from '../shell/document'
import type {SetSummary} from '../shell/useSet'
import type {WorldTimelineView} from './useWorldTemporalReading'
import {PROJECTION_TIMELINE_KIND, timelinePresentation, type TimelinePresentation} from './timelinePresentation'

export {PROJECTION_TIMELINE_KIND, timelinePresentation}
export type {TimelinePresentation}

export interface TimelineResidenceProps {
  set: SetSummary | null
  document: SetDocument | null
  selection: SetSelection
  select: (value: SetSelection) => void
  colors: string[]
  setColor: (track: number, value: string) => void
  /** The native composition sources for the two presentations, already
   * qualified by the caller (undefined for the audio cut — its grammar). */
  session: NativeCompositionViewSource | undefined
  arrangement: NativeCompositionViewSource | undefined
  compactTransport: boolean
  /** The presented presentation per the encounter; null = both concealed. */
  presented: TimelinePresentation | null
  /** The World cut (L4 seam 5): World material as tracks over the kernel's
   * temporal read. Additive — the native cut keeps absolute precedence
   * inside each view, and with the prop absent every existing byte of the
   * DOM/CSS contract is unchanged. */
  world?: WorldTimelineView
}

export function TimelineProjectionResidence({set, document, selection, select, colors, setColor, session, arrangement, compactTransport, presented, world}: TimelineResidenceProps) {
  return <Fragment>
    <div className="inhabitant composition-view" data-projection-kind={PROJECTION_TIMELINE_KIND} data-projection-presentation="session" hidden={presented !== 'session'}>
      <SessionView set={set} document={document} selection={selection} select={select} colors={colors} setColor={setColor} native={session} compactTransport={compactTransport} world={world} />
    </div>
    <div className="inhabitant composition-view" data-projection-kind={PROJECTION_TIMELINE_KIND} data-projection-presentation="arrangement" hidden={presented !== 'arrangement'}>
      <ArrangementView set={set} document={document} selection={selection} select={select} colors={colors} native={arrangement} compactTransport={compactTransport} world={world} />
    </div>
  </Fragment>
}
