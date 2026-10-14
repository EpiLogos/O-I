// What the App hands every widget body (FOUNDATION F8): the mode in front of you, the World cut's temporal reading, the
// kernel carrier and the selected Central subject. The bodies read it here; nothing here stores or writes.
import {createContext, useContext, type ReactNode} from 'react'
import type {SurfMode} from '../shell/modeGrammar'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'

export interface WidgetReading {
  mode: SurfMode
  world: WorldTimelineView | null
  transport: KernelTransportStatus
  subject: CentralSubjectSelection | null
}

const WidgetReadingContext = createContext<WidgetReading | null>(null)

export function WidgetReadingProvider({value, children}: {value: WidgetReading; children: ReactNode}) {
  return <WidgetReadingContext.Provider value={value}>{children}</WidgetReadingContext.Provider>
}

/** The reading, or null outside a rail (a render test, a detached view). */
export const useWidgetReading = (): WidgetReading | null => useContext(WidgetReadingContext)
