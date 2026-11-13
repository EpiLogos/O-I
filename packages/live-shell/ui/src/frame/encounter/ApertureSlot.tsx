// The browser's aperture slot (world-shell-mockup.html `.slot`/`.sloth`/`.sec`/`.ctx`, `renderSlot`): the focused pane's own
// context, under the browser's list. Its head names the pane in front — its kind, its tab, "pane i/N" and whether it follows the
// encounter or is pinned — and its Context section reads the field, the world, the subject and the occasion the panes follow
// (encounterRows.ts contextRows). It reads only what the shell already holds: the focused pane the Workbench publishes
// (native/workbenchDoor.ts), the book's WorldContext, the World the host discloses and the World cut's time spine. It writes one
// thing, the pane's own Follow/Pin (surface.pin-subject), and only for a pane whose kind follows the selection.
import {useContext, useEffect, useState} from 'react'
import {useOptionalContinuity} from '../../continuity/workspace'
import {KindMark} from '../../inhabitants/sdk/marks.tsx'
import {useFocusedPane, type FocusedPane} from '../../native/workbenchDoor'
import {useTimelineReading} from '../../projections/timelinePaneHost'
import {ShellConfigContext} from '../../shell/useSet'
import {contextRows, type ContextRow} from './encounterRows'

/** The pane's kind as the slot's head names it (the mockup's accent word): the last part of the binding's kind, in words. */
export function paneKindWord(kind: string): string {
  return (kind.split('.').pop() ?? kind).replace(/[-_]/g, ' ')
}

/** The slot's drawing, as a pure function of its readings (rendered headless by the tests). */
export function ApertureSlotView({pane, rows, selectionRef}: {pane: FocusedPane | null; rows: readonly ContextRow[]; selectionRef: string | null}) {
  const pinned = !!pane?.pinned
  const canPin = !!pane && pane.follows && (pinned || !!selectionRef)
  const pinWords = !pane ? '' : !pane.follows ? 'This pane holds its own subject: it has nothing to follow.'
    : pinned ? `Pinned to ${pane.pinned}. Press to follow the encounter again.`
    : selectionRef ? 'A pinned pane keeps its own subject while the encounter moves on. Press to pin it to what is selected now.'
    : 'Following the encounter. Select something to pin this pane to it.'
  return <section className="aperture-slot" aria-label="Aperture">
    <div className="aperture-slot-head">
      {pane
        ? <><span className="aperture-slot-kind">{paneKindWord(pane.kind)}</span><b>{pane.title}</b>
          <span className="aperture-slot-r">pane {pane.index}/{pane.count}
            {pane.follows
              ? <button type="button" className={`aperture-pin${pinned ? ' on' : ''}`} aria-pressed={pinned} disabled={!canPin} data-i={`Pin|${pinWords}`} title={pinWords}
                onClick={() => pane.pin(pinned ? undefined : selectionRef ?? undefined)}>{pinned ? 'pinned' : 'follows'}</button>
              : <span className="aperture-pin own" data-i={`Pin|${pinWords}`} title={pinWords}>own</span>}
          </span></>
        : <span className="aperture-slot-none">No pane in front</span>}
    </div>
    <div className="aperture-slot-body">
      <div className="aperture-slot-sec"><span>Context</span><span>{!pane ? '' : !pane.follows ? 'its own subject' : pinned ? 'pinned' : 'following the encounter'}</span></div>
      {rows.map(row => <div key={row.key} className="aperture-ctx" data-context={row.key} data-i={`${row.key}|${row.info}`} title={row.info}>
        <span className="k">{row.key}</span>
        <span className="v">{row.dot && <span className="dot" style={{background: row.dot}} />}{row.mark && <KindMark kind={row.mark} size={12} className="kg" />}
          {row.key === 'subject' && row.value !== '—' ? <b>{row.value}</b> : row.value}</span>
        <span className="s">{row.standing ?? ''}</span>
      </div>)}
    </div>
  </section>
}

/** The slot in the browser: its readings, live. */
export function ApertureSlot() {
  const pane = useFocusedPane()
  const context = useOptionalContinuity()?.current.context
  const config = useContext(ShellConfigContext)
  const spine = useTimelineReading()?.spine ?? null
  // Re-draw when the spine moves (its own subscription; nothing here keeps a clock).
  const [, setRevision] = useState(0)
  useEffect(() => (spine ? spine.subscribe(() => setRevision(value => value + 1)) : undefined), [spine])
  const rows = contextRows({pane, context, config, spine})
  return <ApertureSlotView pane={pane} rows={rows} selectionRef={context?.selection?.ref ?? null} />
}
