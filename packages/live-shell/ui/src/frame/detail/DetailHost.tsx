// The one detail host (manual §3, §10.1; FOUNDATION F4): "Select a clip, and the bottom of the window shows it in detail …
// Clip view shows the thing itself, with everything you can do to it. Device view shows what is working on it." One
// residence for every mode, under one head line (the mockup's `#dth`, drawn from the mode's registration): the mode's
// registered clip editor under a shell-owned clip box, or its registered chain — or, when a pane holding an instrument has
// focus, that instrument's devices. One rule for the Clip side in every mode: while nothing is selected it shows one line
// saying what it waits for (the mode's own words) and no body under it; a mode whose clip is not chosen from its tracks
// registers that, and its body stands. Bodies are mounted on first use and kept mounted-concealed after (the
// hidden-inhabitant law), so a mode's detail returns as it was left.
import {useRef, useState, type DragEvent} from 'react'
import {useDetailReading} from './detailReading'
import {ClipBox, useSelectedClip} from './ClipBox'
import {ClipWaiting} from './ClipView'
import {MODE_DETAILS, type ChainDrop} from '../../shell/modeDetails'
import {InstrumentDeviceDetail} from '../../shell/ModeDetail'
import {useStandingInstrument} from '../../inhabitants/ql/devices/standingInstrument'
import type {SurfMode} from '../../shell/modeGrammar'
import './detail.css'

export function DetailHost({side}: {side: 'clip' | 'device'}) {
  const reading = useDetailReading()
  const selected = useSelectedClip()
  const visited = useRef(new Set<string>())
  const registration = MODE_DETAILS[reading.mode]
  const instrument = side === 'device' && !registration.ownsDeviceSide ? reading.focusedInstrument : null
  const waiting = side === 'clip' && !selected.ref && !registration.clipUngated
  const key = instrument ? `instrument` : `${reading.mode}:${side}`
  if (!waiting) visited.current.add(key)
  // The head names the instrument the rack stands open over the focused pane's (M4′ or M5′ over the Earth's M0′; lane BT), not the pane's.
  const standing = useStandingInstrument(instrument)
  const head = registration.head[side]({detail: reading, selected, instrument: standing === undefined ? instrument : (standing as typeof instrument)})
  return <div className="detail-host" data-detail-side={side} data-detail-mode={reading.mode}>
    <header className="detail-head" data-detail-head={side}><b>{head.name}</b>{head.line && <span className="detail-head-line"> — {head.line}</span>}</header>
    {waiting && <div className="detail-body detail-body--clip" data-detail-waiting="true"><ClipWaiting line={registration.clipWaits} /></div>}
    {[...visited.current].map(held => {
      const shown = held === key && !waiting
      // The focused pane's instrument takes the whole row (lane E): its rack folds and stands Compact to fit, and no drop strip ends it —
      // the strip it carried received nothing (no drop handler), and the mockup's instrument row has none (world-shell-mockup.html:1461).
      if (held === 'instrument') return <div key={held} className="detail-body" hidden={!shown}><div className="detail-chain">{instrument && <InstrumentDeviceDetail transport={reading.transport} instrument={instrument} centralDevices={!!registration.devicesLeadInstrument} />}</div></div>
      const [mode, which] = held.split(':') as [SurfMode, 'clip' | 'device']
      const table = MODE_DETAILS[mode]
      const Body = table[which]
      // The device side is a chain that ends where a device can be dropped (the mockup's .dropz), unless the chain draws its own
      // receiver; the clip side is the mode's editor under the shell's clip box — which stands in the props column instead
      // wherever the editor is a Clip view (ClipBox.tsx clipBoxRows; detail.css hides the strip over a .clipv).
      return <div key={held} className={`detail-body${which === 'clip' ? ' detail-body--clip' : ''}`} hidden={!shown} data-detail-body={held}>
        {which === 'clip' && <ClipBox />}
        {which === 'clip' ? <Body /> : <div className="detail-chain"><div className="detail-chain-devices"><Body /></div>{table.dropHint !== null && <ChainEnd hint={table.dropHint} drop={table.drop} />}</div>}
      </div>
    })}
  </div>
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
