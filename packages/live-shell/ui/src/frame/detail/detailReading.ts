// What the detail host and each mode's detail bodies read (FOUNDATION F4): the frame publishes it once, through a context,
// so a body never reaches into the frame and the host knows no mode.
import {createContext, useContext} from 'react'
import type {ComponentProps} from 'react'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import type {WorldTimelineView} from '../../projections/useWorldTemporalReading'
import type {CentralSubjectSelection} from '../../inhabitants/CentralSubjectDetail'
import type {PanelContext} from '../../shell/panels'
import type {SetDocument} from '../../shell/document'
import type {SetSelection} from '../../components/SessionView'
import type {NativeWorldDetail} from '../../components/NativeWorldDetail'
import type {AgentSessionTrack} from '../../agent/useAgencySessions'
import type {PaneInstrumentId} from '../../shell/paneInstrument'
import type {SurfMode} from '../../shell/modeGrammar'

export interface DetailReading {
  mode: SurfMode
  transport: KernelTransportStatus
  world: WorldTimelineView
  /** The focused pane is the Session · Arrangement pane over the World cut. */
  worldCut: boolean
  centralSubject: CentralSubjectSelection | null
  live: {ctx: PanelContext; document: SetDocument | null; selection: SetSelection}
  native: Omit<ComponentProps<typeof NativeWorldDetail>, 'mode'>
  factory: {tracks: AgentSessionTrack[]; task: FactorySessionReading}
  /** The focused pane's instrument, when it holds one: it takes the Device side in every mode but Live. */
  focusedInstrument: PaneInstrumentId | null
}

/** The Factory session the frame still publishes for the detail row (the agent shell's selected session, else the first). Nothing
 * reads it now: the Clip side, its head and the Device side's head read THE selection, as the agent chain does
 * (shell/modeDetails.tsx FactoryClip; agent/AgentShellContext.tsx sessionOfSelection). Kept typed while the frame hands it. */
export interface FactorySessionReading {
  taskLabel: string | null
  task?: {
    sessionRef: string
    purpose: string | null
    agentName: string | null
    needleState: string | null
    tasks?: AgentSessionTrack['tasks']
    budget?: {used: number | null; max: number | null} | null
  } | null
  /** Retired: the Desk's run join (factory/FactoryRunJoin.tsx) is no longer drawn on the Clip side — nothing in the candidate
   * selects a Desk run. The frame still hands it; nothing reads it. */
  join?: unknown
}

export const DetailContext = createContext<DetailReading | null>(null)

export function useDetailReading(): DetailReading {
  const reading = useContext(DetailContext)
  if (!reading) throw Error('The detail host is not mounted')
  return reading
}
