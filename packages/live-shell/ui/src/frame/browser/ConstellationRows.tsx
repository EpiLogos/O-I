// The constellations of your wiki in the one browser (manual §10.3: Material holds "the constellations of your wiki"; "Select a row once
// and its preview shows at the foot of the list … A constellation's preview is what this mode makes of it … Drag it onto a track and this
// mode makes its own clip of it"; §16.7's Preview, Make this mode's clip and Show in Browser rows).
//
// A row body under the browser's control (browserKinds.ts ControlledBrowser): the rows are the owner's reading (owners/constellations.ts),
// a press selects one (the browser's own selection, kept across modes: constellationFocus.ts), a drag carries its ref (CONSTELLATION_DRAG)
// to a track, and the selected one's preview is portalled to the foot of the list, drawn by the mode's registration (the preview it is
// handed: shell/constellationPreviews.tsx), never a branch here. Show in Browser brings its row into view.
import {useEffect, useRef, type ComponentType} from 'react'
import {createPortal} from 'react-dom'
import type {ControlledBrowser} from './browserKinds'
import {CONSTELLATION_DRAG, selectConstellation, useConstellationFocus} from './constellationFocus'
import {constellationNamed, useConstellations, type Constellation} from '../../owners/constellations'
import {Icon} from '../../inhabitants/sdk/Icon'

export interface ConstellationPreviewProps {readonly constellation: Constellation}

/** What a row says of its constellation on hover: what it is, what it gathers, and the three acts. Pure. */
export function constellationRowWords(row: Constellation): string {
  const gathered = row.members.length ? `gathers ${row.members.length}: ${row.members.slice(0, 4).map(member => member.title).join(', ')}${row.members.length > 4 ? '…' : ''}` : 'gathers nothing yet'
  return `${row.title} — ${row.kind === 'frame' ? 'a constellation' : 'a world\'s own constellation'} of ${row.registerTitle}'s wiki; ${gathered}. `
    + 'Select it to preview what this mode makes of it; drag it onto a track and this mode makes its own clip of it.'
}

export function ConstellationRows({controlled, Preview}: {controlled: ControlledBrowser; Preview: ComponentType<ConstellationPreviewProps>}) {
  const reading = useConstellations()
  const focus = useConstellationFocus()
  const list = useRef<HTMLDivElement>(null)
  const needle = controlled.query.trim().toLowerCase()
  const rows = needle ? reading.rows.filter(row => `${row.title} ${row.registerTitle}`.toLowerCase().includes(needle)) : reading.rows
  const chosen = constellationNamed(reading.rows, focus.ref)
  // Show in Browser brings the selected row into view, each time it is asked (focus.shown moves).
  useEffect(() => {
    if (!focus.ref) return
    const row = [...list.current?.querySelectorAll<HTMLElement>('[data-constellation]') ?? []].find(item => item.dataset.constellation === focus.ref)
    row?.scrollIntoView?.({block: 'nearest'})
  }, [focus.shown, focus.ref, rows.length])
  const waiting = reading.fault ? `The wiki was not read: ${reading.fault}`
    : !reading.registers ? 'The wiki is being read: Central has not disclosed its registers yet.'
    : reading.reading.length && !reading.rows.length ? `The wiki is being read (${reading.reading.join(', ')}).` : null
  const missing = focus.ref && !chosen && !reading.reading.length ? `${focus.ref} is no constellation the wiki's reading holds now.` : null
  return <div className="browser-results" data-browser-constellations ref={list}>
    <div className="browser-list-heading">Name <span>World</span></div>
    {rows.map(row => <button key={row.ref} type="button" className="browser-item" aria-pressed={row.ref === focus.ref} data-constellation={row.ref}
      data-i={`${row.title}|${constellationRowWords(row)}`} title={constellationRowWords(row)} draggable
      onClick={() => selectConstellation(row.ref)}
      onDragStart={event => { event.dataTransfer.setData(CONSTELLATION_DRAG, row.ref); event.dataTransfer.setData('text/plain', row.title); event.dataTransfer.effectAllowed = 'copy' }}>
      <Icon name="orbit" size={12} /><span>{row.title}</span><span className="mode-browser-row-meta">{row.registerTitle}</span>
    </button>)}
    {waiting && <p className="browser-empty" role="status">{waiting}</p>}
    {!waiting && !reading.rows.length && <p className="browser-empty">Your wiki holds no constellation yet.</p>}
    {!waiting && reading.rows.length > 0 && !rows.length && <p className="browser-empty">No constellation matches.</p>}
    {reading.unread.map(item => <p key={item.register} className="browser-empty" role="status">{item.register}'s wiki was not read: {item.reason}</p>)}
    {controlled.previewHost && createPortal(chosen ? <Preview constellation={chosen} /> : missing ? <p className="browser-empty" role="status">{missing}</p> : null, controlled.previewHost)}
  </div>
}
