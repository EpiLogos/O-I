import type {CentralRackApertures} from './centralRack'

/** The owner's non-ready Day standing, named above the Devices chain: the Day die
 * has no document to draw, so the chain says what the owner answered. Today's Day
 * opens by itself on its civil date and Central makes its page from the Day form at
 * the Day's turn (`central.day.turn`, O-I 1005): a Day not open yet, or not made
 * yet, is no fault and no press stands in for it. */
export function CentralDayNotice({notice}: {notice: NonNullable<CentralRackApertures['dayNotice']>}) {
  if (notice.state === 'unopened') return <DayNotice message={notice.message} />
  // The Day stands without its page: Central makes it at the Day's turn. Central's own sentence and op stay on the element for a
  // reader, never as text.
  if (notice.state === 'uninitialised') {
    return <DayNotice message="Today's page is not made yet. Central makes it from the Day form at the Day's turn."
      attrs={{'data-central-day-notice': 'uninitialised', 'data-owner': notice.owner, 'data-owner-op': notice.op, 'data-owner-said': notice.message}} />
  }
  return (
    <div className="inhabitant-device-fault" role="alert" data-central-day-notice="refused">
      Day {notice.civilDate}: the owner refused the Day document — “{notice.message}”
    </div>
  )
}

function DayNotice({message, attrs = {'data-central-day-notice': 'unopened'}}: {message: string; attrs?: Readonly<Record<string, string>>}) {
  return (
    <div className="inhabitant-device-notice" role="status" {...attrs}>
      <p>{message}</p>
    </div>
  )
}
