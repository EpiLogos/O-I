import type {CentralRackApertures} from './centralRack'

/** The owner's non-ready Day standing, named above the Devices chain: the Day die
 * has no document to draw, so the chain says what the owner answered and which
 * owner op would admit it. */
export function CentralDayNotice({notice}: {notice: NonNullable<CentralRackApertures['dayNotice']>}) {
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
