// How the shell presents the hosted frame, declared to it over the one channel (T-FRAME-CHROME-ONTO-PLATES; owner, 15 Oct: "UI inside in
// fullscreen, UI outside in devices/instruments panel when normal pane view"; manual §16.1 "A pane is a device at full size. Its
// controls stay out of the pane and appear in Device view below it").
//   • In a pane — and wherever the frame stands that is not a pane at full size — the presentation is 'devices': the frame draws only
//     its field and its controls stand on the devices (frameChrome.tsx).
//   • The pane at full size is the pane grammar's own maximise (desktop/cradle/src/surface/registry.ts :200 `surface.maximize`, the
//     group's `data-maximized`), reached from the pane's ⊞ menu, Full size (Workbench.tsx GroupPane): there the presentation is 'frame'
//     and the frame's own controls stand inside it, as the standalone application has them.
// The declaration is the shell's; the presentation the frame stands in is the frame's reading (its state's `presentation`), so a
// declaration is sent only when the reading differs from what the placement asks — never kept as a copy here. The frame's pane is read
// from the published placement (projections/expressionsPaneHost.ts useFramePlacement), and its maximise from the pane group's own
// attribute in the shell's document.
import {useEffect, useRef, useState} from 'react'
import type {FramePresentation} from '@epilogos/expressions-boundary'
import {useFramePlacement, useHostedChrome} from '../../../projections/expressionsPaneHost'
import {useSummonedEditors} from '../../devices/summonedEditors'

/** The presentation a placement asks for: the frame's own controls only in a pane at full size. Pure. */
export function wantedPresentation(maximised: boolean): FramePresentation {
  return maximised ? 'frame' : 'devices'
}

/** Whether the pane that holds the frame stands at full size: its group's own maximise. */
function useHolderMaximised(slot: HTMLElement | null): boolean {
  const [maximised, setMaximised] = useState(false)
  useEffect(() => {
    const group = slot?.closest<HTMLElement>('.pane.group')
    if (!group) {setMaximised(false); return}
    const read = () => setMaximised(group.getAttribute('data-maximized') === 'true')
    read()
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(read)
    observer.observe(group, {attributes: true, attributeFilter: ['data-maximized']})
    return () => observer.disconnect()
  }, [slot])
  return maximised
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
  const want = wantedPresentation(useHolderMaximised(placement?.slot ?? null))
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
