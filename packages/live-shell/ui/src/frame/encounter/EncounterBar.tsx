// The encounter bar (world-shell-mockup-r2.html `renderEncbar`, .encbar :1677; T-WORLDS §3): the strip above the panes that says
// where the encounter stands — field › world › subject › occasion — with Back and Forward along the trail. It holds what the browser's
// aperture slot held before W1; the pin went home to each pane's head (the Workbench's Follow/Pin), a document's Save and Re-read to
// its own head, a pane's view rows to its instrument's device. Every value is a reading (encounterRows.ts); Back and Forward return
// through the trail's one return (shell/TrailWidget.tsx returnToStop), never a second writer.
import {useContext, useEffect, useState} from 'react'
import {useFocusedPane} from '../../native/workbenchDoor'
import {useOptionalContinuity} from '../../continuity/workspace'
import {ShellConfigContext} from '../../shell/useSet'
import {useTimelineReading} from '../../projections/timelinePaneHost'
import {returnToStop} from '../../shell/TrailWidget'
import {KindMark} from '../../inhabitants/sdk/marks.tsx'
import type {TimeSpine} from '../../timeline/timeSpine'
import {contextRows, trailSteps, type ContextRow} from './encounterRows'
import './encounterBar.css'

/** Re-render when the spine moves (a Now read, an occasion chosen). */
function useSpine(spine: TimeSpine | null | undefined): void {
  const [, bump] = useState(0)
  useEffect(() => (spine ? spine.subscribe(() => bump(value => value + 1)) : undefined), [spine])
}

export function EncounterBar() {
  const pane = useFocusedPane()
  const continuity = useOptionalContinuity()
  const context = continuity?.current.context
  const config = useContext(ShellConfigContext)
  const reading = useTimelineReading()
  const spine = reading?.spine ?? reading?.world?.spine ?? null
  useSpine(spine)
  const trail = context?.trail ?? []
  // The bar's place on the trail: the newest stop, until Back or Forward moves it; a new stop brings it to the newest again.
  const [cursor, setCursor] = useState(trail.length - 1)
  useEffect(() => { setCursor(trail.length - 1) }, [trail.length])
  const steps = trailSteps(trail.length, cursor)
  const go = (index: number | null) => {
    const stop = index === null ? undefined : trail[index]
    if (!continuity || !stop || index === null) return
    setCursor(index)
    returnToStop(continuity, stop)
  }
  return <EncounterFace rows={contextRows({pane, context, config, spine})}
    back={steps.back === null ? null : {label: trail[steps.back]!.label, go: () => go(steps.back)}}
    forward={steps.forward === null ? null : {label: trail[steps.forward]!.label, go: () => go(steps.forward)}} />
}

/** The bar drawn from its readings (the face the hook above feeds; a fixture may feed it too). */
export function EncounterFace({rows, back, forward}: {rows: readonly ContextRow[]; back: {label: string; go: () => void} | null;
  forward: {label: string; go: () => void} | null}) {
  return <nav className="encounter-bar" aria-label="Encounter">
    <button type="button" className="encounter-step" aria-label="Back" disabled={!back} onClick={back?.go}
      data-i={back ? `Back|Return to ${back.label} (the trail keeps every encounter).` : 'Back|Nothing before this encounter on the trail yet.'}>‹</button>
    <button type="button" className="encounter-step" aria-label="Forward" disabled={!forward} onClick={forward?.go}
      data-i={forward ? `Forward|On to ${forward.label}, along the trail.` : 'Forward|Nothing after this encounter on the trail.'}>›</button>
    <div className="encounter-spine">
      {rows.map((row, index) => <span key={row.key} className="encounter-cell" data-context={row.key} data-i={`${row.key}|${row.info}`}>
        {index > 0 && <span className="encounter-chevron" aria-hidden="true">›</span>}
        <small>{row.key}</small>
        {row.dot && <span className="encounter-dot" style={{background: row.dot}} />}
        {row.mark && <span className="encounter-mark"><KindMark kind={row.mark} size={11} /></span>}
        {row.key === 'subject' && row.value !== '—' ? <b>{row.value}</b> : <span className="encounter-value">{row.value}</span>}
        {row.standing && <small className="encounter-standing">{row.standing}</small>}
      </span>)}
    </div>
  </nav>
}
