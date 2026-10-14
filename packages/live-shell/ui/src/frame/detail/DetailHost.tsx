// The one detail host (manual §3, §10.1; FOUNDATION F4): "Select a clip, and the bottom of the window shows it in detail …
// Clip view shows the thing itself, with everything you can do to it. Device view shows what is working on it." One
// residence for every mode: the mode's registered clip editor under a shell-owned clip box, or its registered chain — or,
// when a pane holding an instrument has focus, that instrument's devices. Bodies are mounted on first use and kept
// mounted-concealed after (the hidden-inhabitant law), so a mode's detail returns as it was left.
import {useRef} from 'react'
import {useDetailReading} from './detailReading'
import {ClipBox} from './ClipBox'
import {MODE_DETAILS} from '../../shell/modeDetails'
import {InstrumentDeviceDetail} from '../../shell/ModeDetail'
import type {SurfMode} from '../../shell/modeGrammar'
import './detail.css'

export function DetailHost({side}: {side: 'clip' | 'device'}) {
  const reading = useDetailReading()
  const visited = useRef(new Set<string>())
  const registration = MODE_DETAILS[reading.mode]
  const instrument = side === 'device' && !registration.ownsDeviceSide ? reading.focusedInstrument : null
  const key = instrument ? `instrument` : `${reading.mode}:${side}`
  visited.current.add(key)
  return <div className="detail-host" data-detail-side={side} data-detail-mode={reading.mode}>
    {[...visited.current].map(held => {
      const shown = held === key
      if (held === 'instrument') return <div key={held} className="detail-body" hidden={!shown}>{instrument && <InstrumentDeviceDetail transport={reading.transport} instrument={instrument} centralDevices={!!registration.devicesLeadInstrument} />}</div>
      const [mode, which] = held.split(':') as [SurfMode, 'clip' | 'device']
      const Body = MODE_DETAILS[mode][which]
      return <div key={held} className="detail-body" hidden={!shown} data-detail-body={held}>
        {which === 'clip' && <ClipBox />}
        <Body />
      </div>
    })}
  </div>
}
