// A mode's bar with its bindings (shell/modeTransports.tsx registers one per mode, loaded when that mode's transport first draws; O-I
// #740). Until it arrives the one transport stands unbound — every slot drawn waiting with its grammar meaning, the frame's readouts
// shown (modeTransports.tsx ModeTransport) — then the mode's bindings take it.
import {useEffect} from 'react'
import type {SurfMode} from '../modeGrammar'
import {publishTransportKeys} from '../../frame/keys/keyDoors'
import {Transport} from '../../frame/transport/Transport'
import {slotWords, type TransportReading, type UseModeTransport} from '../modeTransports'
import {useFramePresentation} from '../../components/expressions/studio/framePresentation'
import {useSittingTransport} from '../../inhabitants/ql/devices/qlSitting'

/** The mode's bar: its bindings over the one transport. Keyed by mode where it is mounted, so each mode keeps its hook order. */
export const boundTransport = (use: UseModeTransport) => function BoundTransport({mode, reading}: {mode: SurfMode; reading: TransportReading}) {
  const bindings = use(reading)
  // The hosted frame's presentation (T-FRAME-CHROME-ONTO-PLATES): its controls on the devices in a pane, its own at full size. Declared
  // from here because the transport stands in every mode, as the frame can stand in a pane of any mode; one hook, no mode branch.
  useFramePresentation()
  // The keys press the same slots (F9: Space plays or stops, Esc stops), so they read the bindings drawn here.
  useEffect(() => { publishTransportKeys(bindings); return () => publishTransportKeys(null) })
  return <Transport bindings={bindings} words={id => slotWords(mode, id)} />
}

/** A mode's transport with the sitting in front of you over it (manual §24.3 "Transport": Play rings the bell and begins, Stop ends it
 * and keeps the time sat, Loop shows the intervals): while a sitting is armed or plays its three slots are the sitting's, and the mode's
 * own stand again when it ends (inhabitants/ql/devices/qlSitting.ts). */
export const withSitting = (use: UseModeTransport): UseModeTransport => reading => ({...use(reading), ...useSittingTransport()})
