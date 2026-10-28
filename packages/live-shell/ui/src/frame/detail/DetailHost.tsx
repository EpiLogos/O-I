// The one detail host (manual §16.4–§16.5; FOUNDATION F4): "The detail area holds Clip view above Device view, both at once when there
// is room, as Live 12 does. Hide either one, or switch between them when only one shows" (Live 12.0.25 cap 31). Clip view is the
// mode's designed clip on its clip binding (the registration's `clip`, hosted by frame/detail/ClipHost.tsx); Device view is the
// selected track's chain under its head line (the mockup's `#dth`) — or, when a pane holding an instrument has focus, that
// instrument's devices. ⌥⌘E gives Clip view the main area (cap 29): the clip's editor takes the space of the panes, drawn there at
// its expanded size, and the detail area keeps Device view. One rule for the Clip side in every mode: while nothing is selected it
// shows one line saying what it waits for (the mode's own words); a mode whose clip is not chosen from its tracks registers that.
//
// The device's expanded band (frame/devices/DeviceFlip.tsx, the frame's `.device-flip-host`) stands between Clip view and the chain
// (manual §16.4 "between Clip view and the chain"), under Device view's head; its place is the frame's (styles.css, lane R1). While
// both sides stand this host publishes the height Clip view takes above Device view on the frame (`--clip-stack-h`), which that place
// reads. Device bodies are mounted on first use and kept mounted-concealed after (the hidden-inhabitant law), so a mode's chain
// returns as left.
import {useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent} from 'react'
import {createPortal} from 'react-dom'
import {useDetailReading} from './detailReading'
import {useSelectedClip} from './ClipBox'
import {ClipWaiting} from './ClipView'
import {useMeasuredRoom, type ClipPlace} from './ClipHost'
import {clipHeightIn, publishShownSides, shownSides, type DetailSides} from './detailSides'
import {MODE_DETAILS, type ChainDrop} from '../../shell/modeDetails'
import {InstrumentDeviceDetail} from '../../shell/ModeDetail'
import {useStandingInstrument} from '../../inhabitants/ql/devices/standingInstrument'
import type {SurfMode} from '../../shell/modeGrammar'
import './detail.css'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** The host's own box and the band the frame stands above the detail row (styles.css `--frame-band`), followed as they change. */
function useHostBox(): [(element: HTMLDivElement | null) => void, {h: number; band: number}, HTMLDivElement | null] {
  const [box, setBox] = useState({h: 0, band: 0})
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  useIsoLayoutEffect(() => {
    if (!element) return
    const read = () => {
      const band = parseFloat(getComputedStyle(element).getPropertyValue('--frame-band')) || 0
      const h = Math.floor(element.getBoundingClientRect().height)
      setBox(was => (was.h === h && was.band === band ? was : {h, band}))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, box, element]
}

export function DetailHost({sides = {front: 'clip', hidden: {clip: false, device: false}}, expanded = false}: {
  /** The sides the person keeps, and the front one (⇧Tab). */
  sides?: DetailSides
  /** Clip view stands in the main area (⌥⌘E). */
  expanded?: boolean
}) {
  const reading = useDetailReading()
  const selected = useSelectedClip()
  const visited = useRef(new Set<string>())
  const registration = MODE_DETAILS[reading.mode]
  const [hostRef, box, host] = useHostBox()
  // The band stands inside the host's own box (under Device view's head): the room the two sides share is the box less the band.
  const room = Math.max(0, box.h - box.band)
  const shown = shownSides(sides, room, expanded)
  const both = shown.clip && shown.device
  const clipH = clipHeightIn(room, both)
  useEffect(() => { publishShownSides(shown) }, [shown.clip, shown.device])
  // The height Clip view takes above Device view, for the band's place (styles.css `.device-flip-host` reads --clip-stack-h).
  useIsoLayoutEffect(() => {
    const frame = host?.closest('.frame') as HTMLElement | null
    if (!frame) return
    if (both) frame.style.setProperty('--clip-stack-h', `${clipH}px`); else frame.style.removeProperty('--clip-stack-h')
    return () => { frame.style.removeProperty('--clip-stack-h') }
  }, [host, both, clipH])

  const instrument = !registration.ownsDeviceSide ? reading.focusedInstrument : null
  const waiting = !selected.ref && !registration.clipUngated
  const deviceKey = instrument ? 'instrument' : reading.mode
  if (shown.device) visited.current.add(deviceKey)
  // The head names the instrument the rack stands open over the focused pane's (World / Places or the Palace over the Earth's Project; lane BT), not the pane's.
  const standing = useStandingInstrument(instrument)
  const head = registration.head.device({detail: reading, selected, instrument: standing === undefined ? instrument : (standing as typeof instrument)})
  const clipHead = registration.head.clip({detail: reading, selected, instrument: null})
  const Clip = registration.clip
  const stack = both ? 'both' : shown.clip ? 'clip' : shown.device ? 'device' : 'none'
  return <div ref={hostRef} className="detail-host" data-detail-mode={reading.mode} data-stack={stack} data-detail-side={shown.clip && !shown.device ? 'clip' : 'device'}>
    {shown.clip && <ClipSide key={`${reading.mode}:clip`} label={clipHead.name} height={both ? clipH : undefined} waiting={waiting ? registration.clipWaits : null}
      Clip={Clip} size="detail" />}
    {expanded && <ExpandedClip host={host} label={clipHead.name} waiting={waiting ? registration.clipWaits : null} Clip={Clip} />}
    <section className="detail-side detail-side--device" data-detail-side="device" hidden={!shown.device} aria-label={head.name}>
      <header className="detail-head" data-detail-head="device"><b>{head.name}</b>{head.line && <span className="detail-head-line"> — {head.line}</span>}</header>
      {[...visited.current].map(held => {
        const current = held === deviceKey && shown.device
        // The focused pane's instrument takes the whole row (lane E): its rack folds and stands Compact to fit, and no drop strip ends it.
        if (held === 'instrument') return <div key={held} className="detail-body" hidden={!current}><div className="detail-chain">{instrument && <InstrumentDeviceDetail transport={reading.transport} instrument={instrument} centralDevices={!!registration.devicesLeadInstrument} />}</div></div>
        const table = MODE_DETAILS[held as SurfMode]
        const Body = table.device
        // The device side is a chain that ends where a device can be dropped (the mockup's .dropz), unless the chain draws its own.
        return <div key={held} className="detail-body" hidden={!current} data-detail-body={`${held}:device`}>
          <div className="detail-chain"><div className="detail-chain-devices"><Body /></div>{table.dropHint !== null && <ChainEnd hint={table.dropHint} drop={table.drop} />}</div>
        </div>
      })}
    </section>
  </div>
}

/** Clip view in the detail area: the mode's clip at the room this side measures, or the one line it waits with. */
function ClipSide({label, height, waiting, Clip, size}: {label: string; height?: number; waiting: string | null; Clip: (typeof MODE_DETAILS)[SurfMode]['clip']; size: ClipPlace['size']}) {
  const [ref, room] = useMeasuredRoom()
  const style: CSSProperties | undefined = height !== undefined ? {height, flex: 'none'} : undefined
  return <section ref={ref} className="detail-side detail-side--clip" data-detail-side="clip" aria-label={`Clip view: ${label}`} style={style}>
    {waiting !== null ? <ClipWaiting line={waiting} /> : room && room.w > 0 && room.h > 0 ? <Clip place={{size, room}} /> : null}
  </section>
}

/** Clip view in the main area (⌥⌘E, Live cap 29): over the panes, at the main area's room; press ⌥⌘E again to return. */
function ExpandedClip({host, label, waiting, Clip}: {host: HTMLElement | null; label: string; waiting: string | null; Clip: (typeof MODE_DETAILS)[SurfMode]['clip']}) {
  const target = host?.closest('.frame')?.querySelector('main.center > .center-body') ?? null
  const [ref, room] = useMeasuredRoom()
  const hand = useCallback((element: HTMLElement | null) => ref(element), [ref])
  if (!target) return null
  return createPortal(<section ref={hand} className="clip-expanded" data-detail-side="clip" data-clip-expanded="true" aria-label={`Clip view, expanded: ${label}`}
    data-i="Clip view|The clip's editor in the main area. Press ⌥⌘E to return it to the detail area.">
    {waiting !== null ? <ClipWaiting line={waiting} /> : room && room.w > 0 && room.h > 0 ? <Clip place={{size: 'expanded', room}} /> : null}
  </section>, target)
}

/** The chain's end (the mockup's .dropz): a hint, and — where the mode registers a receiver — the place a dragged device lands.
 * It arms while a drag it accepts is held over it (Factory's own end, agent/devices/FactoryDeviceChain.tsx, is the idiom) and
 * says a refusal in place until the next drag. */
function ChainEnd({hint, drop}: {hint: string; drop?: ChainDrop}) {
  const [armed, setArmed] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  if (!drop) return <div className="dropz">{hint}</div>
  const accepted = (event: DragEvent<HTMLElement>) => event.dataTransfer.types.includes(drop.accepts)
  return <div className={'dropz' + (armed ? ' armed' : '')} data-chain-end="receives" data-i={`Chain end|${hint}: drag a device from the browser and let go here.`}
    onDragEnter={event => {if (accepted(event)) {event.preventDefault(); setArmed(true); setRefused(null)}}}
    onDragOver={event => {if (accepted(event)) {event.preventDefault(); event.dataTransfer.dropEffect = 'copy'}}}
    onDragLeave={() => setArmed(false)}
    onDrop={event => {
      if (!accepted(event)) return
      event.preventDefault()
      setArmed(false)
      setRefused(drop.receive(event.dataTransfer.getData(drop.accepts)))
    }}>{refused ?? hint}</div>
}
