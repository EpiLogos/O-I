/**
 * Live's designed empty states — the two presentations' frames when no set
 * is open (WORLD-SHELL-DESIGN Rev 5's Live row; the widget guide's
 * empty-state law: an absent reading renders as a DESIGNED surface at the
 * measured Live density — framed grid, browser affordances visible — NEVER
 * a bare sentence floating in a void; the audit's before-captures show
 * exactly that float).
 *
 * What the frame draws is STRUCTURE, ready to receive a set — never set
 * content: track columns carry the shell's display palette and structural
 * names ("Track 1…"), scene rows and the stop row are drawn as the ready
 * grid (the real captures' geometry: `live-session-real.png`,
 * `live-arrangement-real.png`), the Arrangement draws the integrated
 * overview ABOVE the ruler (the measured Live structure — the single
 * navigation surface, no second scrub bar), and the disclosure INSIDE each
 * frame names the read that fills it (the set opens through the browser's
 * Places › Open set, or the configured default set).
 *
 * The frames reuse the presentations' own classes (`.session-*`,
 * `.arrange-*`) so the density IS the presentations' density; every
 * control-shaped element is non-interactive and says so. No store, no
 * clock, no owner writes; the identity text is the grammar's
 * (`modeGrammar.ts` Live row).
 */

import type {CSSProperties} from 'react'
import {MODE_GRAMMAR} from '../modeGrammar'
import './liveEmpty.css'

/** The shell's session display palette — the same colours the frame's
 * `colors` prop derives for real tracks (App's PALETTE), declared here for
 * the designed empty frame's structural columns. Presentation only. */
const SESSION_DISPLAY_PALETTE = ['#79b6ce', '#779dcc', '#9885bc', '#8baf9c', '#b096b2'] as const

/** The ready grid's structural shape (the mockup's Live render): five work
 * track columns beside the Main scene rail, eight scene rows. */
const EMPTY_TRACK_COLUMNS = 5
const EMPTY_SCENE_ROWS = 8
/** The ruler's beat scale at rest — the Arrangement presentation's own
 * 32-beat ruler span (ArrangementView's `scale * 32` at zoom 1). */
const REST_RULER_SPAN_PX = 230

/** Live · Session, no set open: the framed clips-and-scenes grid. */
export function LiveSessionEmpty() {
  const centre = MODE_GRAMMAR.live.centre.session
  return <div className="session-view live-empty" data-live-empty="session" role="status">
    <div className="live-empty-disclosure" data-i={`${centre.label}|${centre.meaning} — no set is open; open a Live set from the browser and this grid receives it`}
      title={`${centre.label} — ${centre.meaning}. No set is open.`}>
      <strong>{centre.label}</strong>
      <span>{centre.meaning} — no set is open. Open a Live set from the <b>browser</b> (Places › Sets · Open set);
        the configured default set fills this grid when the shell starts with one.</span>
    </div>
    <div className="live-empty-grid">
      <div className="session-work-tracks"><div className="session-tracks">
        {SESSION_DISPLAY_PALETTE.map((color, index) => <section key={color} className="session-track" style={{'--track-color': color} as CSSProperties}>
          <div className="track-header" title={`Track ${index + 1} — a set's track opens here with its devices and routing`}>
            <span>Track {index + 1}</span>
          </div>
          <div className="track-slots" aria-hidden="true">
            {Array.from({length: EMPTY_SCENE_ROWS}, (_, scene) => <div key={scene} className="clip-slot live-empty-slot"><span className="slot-glyph">■</span></div>)}
          </div>
          <div className="track-stop-row" aria-hidden="true"><span className="track-stop">■</span><span className="track-stop-color" /></div>
        </section>)}
      </div></div>
      <section className="session-main">
        <div className="track-header">Main</div>
        <div className="track-slots">
          {Array.from({length: EMPTY_SCENE_ROWS}, (_, scene) => <div key={scene} className="scene-label" title={`Scene ${scene + 1} — a set's scene row opens here; launching waits for the native transport`}>
            <span>▷</span>{scene + 1}
          </div>)}
        </div>
        <div className="track-stop-row" aria-hidden="true"><span className="track-stop">■</span><span>▷</span></div>
      </section>
    </div>
  </div>
}

/** Live · Arrangement, no set open: the overview-above-ruler frame with the
 * track lanes drawn ready (the integrated overview stays the single
 * navigation surface — no second scrub bar). */
export function LiveArrangementEmpty() {
  const centre = MODE_GRAMMAR.live.centre.arrangement
  const bars = [1, 33, 65, 97, 129, 161, 193, 225]
  return <div className="arrange-view live-empty" data-live-empty="arrangement" role="status">
    <div className="live-empty-disclosure" data-i={`${centre.label}|${centre.meaning} — no set is open; the integrated overview above the ruler stays the single navigation surface`}
      title={`${centre.label} — ${centre.meaning}. No set is open.`}>
      <strong>{centre.label}</strong>
      <span>{centre.meaning} — no set is open. The <b>overview above the ruler</b> draws the whole song and
        traverses it; clips place on the lanes when a set's document reads.</span>
    </div>
    <div className="arrange-overview live-empty-overview" role="img"
      aria-label="Arrangement overview — the whole song draws here when a set opens"
      title="Arrangement overview · the whole song draws here when a set opens">
      <span className="live-empty-overview-note" aria-hidden="true">the whole song draws here</span>
    </div>
    <div className="arrange-ruler-row"><div className="arrange-ruler" aria-hidden="true">
      {bars.map(bar => <span key={bar} style={{width: REST_RULER_SPAN_PX}}>{bar}</span>)}
    </div><div className="arrange-header-space">
      <button disabled title="Locators set when the document owner reads a set">Set</button>
      <button disabled title="Automation drawing requires the native device owner">●</button>
    </div></div>
    <div className="arrange-scroll">
      {SESSION_DISPLAY_PALETTE.slice(0, EMPTY_TRACK_COLUMNS - 1).map((color, index) => <div key={color} className="arrange-row" style={{'--track-color': color} as CSSProperties}>
        <div className="arrange-lane live-empty-lane" aria-hidden="true" title={`Track ${index + 1}'s clips place here when a set opens`} />
        <div className="arrange-lane-label">
          <div className="arrange-track-identity"><span className="live-empty-track-name">Track {index + 1}</span></div>
        </div>
      </div>)}
    </div>
  </div>
}
