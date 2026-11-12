import {useState} from 'react'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {CentralRackApertures} from './centralRack'
import {Refusal} from '../../../../../desktop/cradle/src/shared/Refusal'

/** The owner's non-ready Day standing, named above the Devices chain: the Day die
 * has no document to draw, so the chain says what the owner answered and which
 * owner op would admit it. A ground with no Day open yet (a fresh world) is no
 * fault: it says so and offers Open today, Central's ensure-day (centralDeviceWrites.ts openToday). */
export function CentralDayNotice({notice, transport = null}: {notice: NonNullable<CentralRackApertures['dayNotice']>; transport?: KernelTransportStatus | null}) {
  if (notice.state === 'unopened') return <UnopenedDay message={notice.message} transport={transport} />
  if (notice.state === 'uninitialised') {
    return (
      <div className="inhabitant-device-notice" role="status" data-central-day-notice="uninitialised" data-owner={notice.owner} data-owner-op={notice.op}>
        <p>Day {notice.civilDate} has no Day document yet. The owner says: “{notice.message}”</p>
        <p>Owner: {notice.owner} · op: <span className="mono">{notice.op}</span></p>
        <p>{notice.remedy}</p>
      </div>
    )
  }
  return (
    <div className="inhabitant-device-fault" role="alert" data-central-day-notice="refused">
      Day {notice.civilDate}: the owner refused the Day document — “{notice.message}”
    </div>
  )
}

function UnopenedDay({message, transport}: {message: string; transport: KernelTransportStatus | null}) {
  const [pending, setPending] = useState(false)
  const [fault, setFault] = useState<unknown>(null)
  const press = () => {
    if (!transport || pending) return
    setPending(true); setFault(null)
    // The Day re-reads on the owner's day_changed receipt (owners/day.ts), so nothing here redraws it by hand.
    // Loaded on the press: the Day's writes are not part of the first frame (tests/first-load-budget.test.mjs).
    import('./devices/centralDeviceWrites').then(writes => writes.openToday(transport)).catch(cause => setFault(cause ?? 'Central gave no reason.')).finally(() => setPending(false))
  }
  return (
    <div className="inhabitant-device-notice" role="status" data-central-day-notice="unopened">
      <p>{message}</p>
      {transport && <button type="button" disabled={pending} onClick={press} data-central-day-open="today">{pending ? 'Opening today…' : 'Open today'}</button>}
      {fault != null && <Refusal className="inhabitant-device-fault" said="Today did not open." error={fault} />}
    </div>
  )
}
