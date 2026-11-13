// Home in the transport (world-shell-mockup rev 5 `#home`, between the playing keys and the map in every mode: "Earth · Home — Your
// body in the field, Earth at its root (opens Technē · M4′)"). The same control in every mode: pressed, Technē stands and the Earth
// comes into view in its panes (frame/instrumentDoor.ts bringInstrumentIntoView, the browser's Instruments › Earth by another road).
// Outside Technē the mode switches first: the switch and the Earth's placing are one queue of updates on the book (desktop/cradle
// workspace/store.ts switchMode, setLayout), so the Earth lands in Technē's own panes, never in the mode you left.
// The frame hands the switch in through TransportHome (components/TransportBar.tsx); the bar knows no mode.
import {createContext, useContext, useState} from 'react'
import {Icon as CutIcon} from '../../inhabitants/sdk/Icon'
import type {SurfMode} from '../../shell/modeGrammar'
import {bringInstrumentIntoView} from '../instrumentDoor'

/** Where Home goes, in every mode alike: the Earth's pane kind (frame/instruments.ts NAMED 'projection.earth') in the mode it lives in.
 * One destination, never a per-mode difference: the bar's other slots differ by registration (shell/modeTransports.tsx). */
export const HOME: Readonly<{mode: SurfMode; kind: string}> = {mode: 'techne', kind: 'projection.earth'}
export const HOME_WORDS = 'Home|Your body in the field, Earth at its root: opens the Earth in Technē.'

export interface TransportHomeDoor {
  readonly mode: SurfMode
  readonly chooseMode: (mode: SurfMode) => void
}
export const TransportHome = createContext<TransportHomeDoor | null>(null)

/** What a press does, given the mode in front of you: switch to Technē unless it stands, then bring the Earth. Pure over its two acts. */
export function pressHome(mode: SurfMode, acts: {chooseMode: (mode: SurfMode) => void; bringEarth: () => void}): void {
  if (mode !== HOME.mode) acts.chooseMode(HOME.mode)
  acts.bringEarth()
}

export function HomeSlot() {
  const door = useContext(TransportHome)
  const [refused, setRefused] = useState<string | null>(null)
  const bring = () => {
    try { bringInstrumentIntoView(HOME.kind); setRefused(null) } catch (cause) { setRefused(cause instanceof Error ? cause.message : String(cause)) }
  }
  const title = refused ? `Home — the Earth did not open: ${refused}` : 'Home — your body in the field, Earth at its root: opens the Earth in Technē.'
  return <button type="button" className="native-control transport-home" data-transport-home aria-label="Home" data-i={refused ? `Home|The Earth did not open: ${refused}` : HOME_WORDS}
    title={title} disabled={!door} aria-disabled={!door}
    onClick={() => { if (door) pressHome(door.mode, {chooseMode: door.chooseMode, bringEarth: bring}) }}>
    <CutIcon name="earth" size={13} />
  </button>
}
