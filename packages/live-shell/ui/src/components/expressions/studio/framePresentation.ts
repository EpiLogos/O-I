// How the shell presents the hosted frame, declared to it over the one channel (T-FRAME-CHROME-ONTO-PLATES; manual §16.1 "A pane is a device
// at full size. Its controls stay out of the pane and appear in Device view below it"; §20.1 "No panel, list or tool opens inside the
// field pane").
//   • Wherever the frame stands — a pane, a pane at full size, the stage in Live — the presentation is 'devices': the frame draws only its
//     field, and its controls stand on the devices (frameChrome.tsx), the Studio's pane and Clip view.
//   • The owner's ruling of 15 Oct kept the frame's own controls inside a pane at full size ('frame'). The owner's of 20 Oct puts that UI in
//     the Studio device instead (its Full holds every device of the field), so no size of pane brings the frame's own controls back.
// The declaration is the shell's; the presentation the frame stands in is the frame's reading (its state's `presentation`), so a
// declaration is sent only when the reading differs from what the placement asks — never kept as a copy here. The frame's pane is read
// from the published placement (projections/expressionsPaneHost.ts useFramePlacement).
import {useEffect, useRef, useState} from 'react'
import type {FramePresentation} from '@epilogos/expressions-boundary'
import {useFramePlacement, useHostedChrome} from '../../../projections/expressionsPaneHost'
import {useSummonedEditors} from '../../devices/summonedEditors'

/** The presentation a placement asks for: 'devices', at every size (manual §20.1). Pure. */
export function wantedPresentation(): FramePresentation {
  return 'devices'
}

/** Declare the presentation to the one hosted frame whenever its reading differs from what its placement asks. Mounted once with the
 * transport, which stands in every mode (shell/modeTransports.tsx ModeTransport). Only a frame that reads a presentation is asked (one
 * that predates the door reads none and is left as it stands). A declaration the host refuses — the frame concealed, or a new frame not
 * yet answering — is asked again on the frame's next reading, or after a wait that grows to ten seconds. */
export function useFramePresentation(): void {
  // The editors the frame summons stand in their device homes while it stands on the devices (lane BE, summonedEditors.tsx).
  useSummonedEditors()
  const chrome = useHostedChrome()
  const placement = useFramePlacement()
  const want = wantedPresentation()
  const state = chrome?.state ?? null
  const have = state?.presentation
  const run = chrome?.run ?? null
  const asked = useRef<{pending: boolean; refused: number}>({pending: false, refused: 0})
  const latest = useRef(run)
  latest.current = run
  const [again, setAgain] = useState(0)
  useEffect(() => {
    const send = latest.current
    if (!send || have === undefined || have === want) {asked.current.refused = 0; return}
    if (asked.current.pending) return
    const entry = asked.current
    entry.pending = true
    const settle = (ok: boolean) => {
      entry.pending = false
      if (ok) {entry.refused = 0; return}
      entry.refused += 1
      setTimeout(() => setAgain(value => value + 1), Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** Math.min(entry.refused - 1, 3)))
    }
    void Promise.resolve().then(() => send({command: 'presentation', chrome: want})).then(result => settle(result.ok), () => settle(false))
  }, [want, have, state, run !== null, placement?.paneId, again])
}
const RETRY_MS = 1500
const RETRY_MAX_MS = 10000
