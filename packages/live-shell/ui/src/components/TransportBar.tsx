import { Icon } from './Icon'

/**
 * Transport bar — the frame's top strip.
 *
 * Buttons are inert stubs: each tooltip names the milestone that lands the
 * behavior. Only the tempo readout carries real data (the opened set).
 */

function TransportButton(props: {
  icon: string
  label: string
  title: string
  tone?: 'default' | 'rec'
}) {
  return (
    <button
      type="button"
      className={`transport-btn${props.tone === 'rec' ? ' transport-btn-rec' : ''}`}
      title={props.title}
      aria-label={props.label}
    >
      <Icon name={props.icon} size={13} />
    </button>
  )
}

export function TransportBar({ tempoBpm }: { tempoBpm: number | null }) {
  return (
    <header className="transport">
      <div className="transport-group">
        <TransportButton
          icon="play"
          label="Play"
          title="Transport play — lands M4 (session launch semantics)"
        />
        <TransportButton
          icon="stop"
          label="Stop"
          title="Transport stop — lands M4 (session launch semantics)"
        />
        <TransportButton
          icon="record"
          label="Record"
          tone="rec"
          title="Transport record — lands M4 (session workflow)"
        />
        <TransportButton
          icon="loop"
          label="Loop"
          title="Loop region — lands M5 (arrangement + warp)"
        />
      </div>

      <div className="transport-readout">
        <span className="transport-readout-value">
          {tempoBpm != null ? tempoBpm.toFixed(2) : '---.--'}
        </span>
        <span className="micro-label">bpm</span>
      </div>

      <div
        className="transport-clock transport-clock-stub"
        title="Beat-clock display (bars . beats . sixteenths) — lands M4, wired to the live-engine transport"
      >
        <span className="micro-label">position</span>
        <span className="transport-clock-value">- . - . -</span>
      </div>

      <div className="transport-spacer" />
      <div className="transport-brand micro-label">live-shell · m2 frame</div>
    </header>
  )
}
