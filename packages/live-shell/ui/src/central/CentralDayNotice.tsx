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
  // The Day stands without its page (ensure-day ran, initialise-day has not): the same press makes it (openToday skips the ensure and
  // initialises), so this is no dead end. Central's own sentence and op stay on the element for a reader, never as text.
  if (notice.state === 'uninitialised') {
    return <UnopenedDay message="Today's page is not made yet. Open today makes it." transport={transport}
      attrs={{'data-central-day-notice': 'uninitialised', 'data-owner': notice.owner, 'data-owner-op': notice.op, 'data-owner-said': notice.message}} />
  }
  return (
    <div className="inhabitant-device-fault" role="alert" data-central-day-notice="refused">
      Day {notice.civilDate}: the owner refused the Day document — “{notice.message}”
    </div>
  )
}

function UnopenedDay({message, transport, attrs = {'data-central-day-notice': 'unopened'}}: {message: string; transport: KernelTransportStatus | null; attrs?: Readonly<Record<string, string>>}) {
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
    <div className="inhabitant-device-notice" role="status" {...attrs}>
      <p>{message}</p>
      {transport && <button type="button" disabled={pending} onClick={press} data-central-day-open="today">{pending ? 'Opening today…' : 'Open today'}</button>}
      {fault != null && <Refusal className="inhabitant-device-fault" said="Today did not open." error={fault} />}
    </div>
  )
}
