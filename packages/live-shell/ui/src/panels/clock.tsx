import { registerPanel } from '../shell/panels'

/**
 * Clock — stub panel proving the registry round-trip.
 * The real beat clock lands M4, wired to the live-engine transport.
 */
export function ClockPanel() {
  return (
    <div className="clock-stub">
      <div className="clock-stub-readout">- . - . -</div>
      <p className="panel-hint">
        bars . beats . sixteenths — the transport clock lands M4 (session
        launch semantics), fed by the live-engine beat clock.
      </p>
    </div>
  )
}

registerPanel({
  id: 'core.clock',
  title: 'Clock',
  icon: 'clock',
  slot: 'right-dock',
  component: ClockPanel,
  order: 20,
  note: 'Transport clock stub — real beat clock lands M4',
})
