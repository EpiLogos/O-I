// The parts every monitor's Full shares (manual §16.3): a monitor stands on the rail and in a pane only, so it has no Device view, and
// its settings stand in one head across the top of its pane — its name, its key readings, and every setting of its own display as
// compact kit controls. Under the head, the body holds the whole material and the item opened from the tile or the list.
//
// The head is one line where it fits; where its controls do not fit beside the readings, they take a second line under them. A
// reading the owner has not reported draws "—" in the faint ink, never NaN, "undefined" or zero. Styles: panels.css, "Monitors".
import {useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from 'react'
import {unread, type Tone} from '../../sdk/panel'
import {NONE, type Room} from './design'

/** One reading in the head: its value, with a short name before it where the value does not say what it is. */
export interface MonitorReading {
  readonly label?: string
  /** Absent: the owner has not reported it, and the head draws "—". */
  readonly value: ReactNode | undefined
  /** What the reading is, for the status bar. */
  readonly does?: string
  readonly tone?: Tone
  /** Text the reading copies when pressed (a branch, a ref): the kit's Readout `copy`. */
  readonly copy?: string
}

const said = (name: string | undefined, does: string | undefined) => (name || does ? [name ?? '', does ?? ''].filter(Boolean).join('|') : undefined)
const absent = (x: ReactNode | undefined) => x === undefined || x === null || x === false || ((typeof x === 'string' || typeof x === 'number') && unread(x))

/** The head of a monitor's pane: its name, its readings, then its controls (kit controls, laid in a row). */
export function MonitorHead({title, mark, readings = [], controls}: {readonly title: string; readonly mark?: ReactNode; readonly readings?: readonly (MonitorReading | false | undefined)[]; readonly controls?: ReactNode}) {
  return <header className="mon-head" aria-label={title}>
    <div className="mon-reads">
      {mark}
      <b className="mon-title">{title}</b>
      {readings.flatMap((r, i) => (r ? [<span key={`${i}:${r.label ?? ''}`} className="mon-read" data-i={said(r.label ?? title, r.does)} data-tone={absent(r.value) ? undefined : r.tone}
        data-unread={absent(r.value) ? 'true' : undefined}>{r.label && <small>{r.label}</small>}{absent(r.value) ? NONE : r.value}
        {r.copy && !absent(r.value) && <button type="button" className="mon-copy" aria-label={`Copy ${r.label ?? title}`} data-i={said('Copy', `Copy the ${r.label ?? 'reading'}.`)}
          onClick={() => { void navigator.clipboard?.writeText(r.copy!) }}>⧉</button>}</span>] : []))}
    </div>
    {controls !== undefined && controls !== null && controls !== false && <div className="mon-ctls">{controls}</div>}
  </header>
}

/** A labelled group of controls in the head (a set of toggles that share one key: the kinds of frame). */
export function MonitorGroup({label, children}: {readonly label: string; readonly children: ReactNode}) {
  return <span className="mon-group" role="group" aria-label={label}><span className="dp-label">{label}</span>{children}</span>
}

/** The room the body stands in, before the first measure: the pane's standard measures less the head. */
const ROOM0: Room = {w: 760, h: 390}

/** Measured before the paint in a browser; drawn at the standard measures where there is no layout (a static render). */
const useMeasure = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** The room of a box, measured as it stands and again when it changes. */
function useRoom<T extends HTMLElement>(): [RefObject<T>, Room] {
  const box = useRef<T>(null)
  const [room, setRoom] = useState<Room>(ROOM0)
  useMeasure(() => {
    const el = box.current
    if (!el) return
    const read = () => { const w = Math.round(el.clientWidth), h = Math.round(el.clientHeight); if (w > 0 && h > 0) setRoom(was => (was.w === w && was.h === h ? was : {w, h})) }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(read)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  return [box, room]
}

/** A monitor's Full: the head, then the body filling the rest of the pane. The body is the material at its own pixels: a picture
 * drawn into the room it is given (`children` as a function of the room), or parts that lay themselves out. `dark`: the body is a
 * dark ground for a picture, as the rail's wells are. */
export function MonitorPane({head, dark, label, children}: {readonly head: ReactNode; readonly dark?: boolean; readonly label?: string; readonly children: ReactNode | ((room: Room) => ReactNode)}) {
  const [box, room] = useRoom<HTMLDivElement>()
  return <div className="mon-pane" aria-label={label}>
    {head}
    <div className="mon-body" ref={box} data-dark={dark ? 'true' : undefined}>{typeof children === 'function' ? children(room) : children}</div>
  </div>
}

/** A picture in the body: an svg at the body's own pixels, its text in the well's inks (the kit's `.dp-display` classes). */
export function MonitorPicture({room, label, children}: {readonly room: Room; readonly label: string; readonly children: ReactNode}) {
  return <svg className="mon-svg" viewBox={`0 0 ${room.w} ${room.h}`} width={room.w} height={room.h} role="group" aria-label={label}>
    <g className="dp-display" style={{background: 'none', border: 'none'}}>{children}</g>
  </svg>
}
