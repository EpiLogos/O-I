// The Journey's walk rows (T-TIMELINE-WALKS leg 4): one shared rendering of the walks the World's track sets carry. Technē's
// live Session presents it above the session cells (WorldTimelinePresentation, in the Timeline's own scroll container); the
// centre's designed frame presents the same rows. One walk is one row of stop cells, numbered n/N, Live Session-view style.
//
// A stop focuses through the one rule the Timeline uses (walkStopFocus → applyWalkStopFocus). A stop that carries an
// Expression offers launching it through the shell's existing door (the workspace's requestExpression, the same request the
// Sources rows make). Renders nothing when no walk is carried: the caller names that absence in its own words.

import {useState} from 'react';
import {journeyStopCells, walkStopFocus} from './journeyWalks';
import {applyWalkStopFocus} from './walkFocus';
import type {TemporalEventRow} from './timeSpine';
import type {WorldWalk, WorldWalkStop} from './worldTrackAdapter';
import './JourneyRows.css';

/** The shell's door to an Expression — the workspace's request, the one the Sources rows use. */
/** A stop launches only what the Expression door opens: an expression: ref. Any other carried ref (a scene of the family's
 * own) is named, never handed to the door as if it were an Expression. */
const isExpressionRef = (ref: string) => ref.startsWith('expression:')

export interface JourneyPresentation {
  openExpression: (ref: string) => void;
}

export function JourneyRows({walks, eventByClipId, selectOccasion, journey}: {
  walks: readonly WorldWalk[];
  eventByClipId: ReadonlyMap<string, TemporalEventRow>;
  selectOccasion: (event: TemporalEventRow) => void;
  /** Present where the shell can open an Expression; absent, a stop's Expression is named but not launched. */
  journey?: JourneyPresentation;
}) {
  // The named absence of the last stop focus (an atlas epoch the atlas does not hold, a stop with no focus).
  const [named, setNamed] = useState<string | null>(null);
  if (walks.length === 0) return null;
  const focusStop = (walk: WorldWalk, stop: WorldWalkStop) => {
    const focus = walkStopFocus(walk, stop, eventByClipId);
    void applyWalkStopFocus(focus, selectOccasion).then(setNamed);
  };
  return <div className="journey-rows" aria-label="Journey walks">
    {walks.map(walk => {
      const total = walk.stops.length
      return <div key={walk.id} className="journey-walk" data-walk={walk.id} data-walk-kind={walk.kind} data-walk-derived={walk.derived ? 'derived' : 'curated'}>
        <div className="journey-walk-head">
          <strong>{walk.name}</strong>
          <span>{walk.kind}</span>
          <span>{walk.derived ? 'derived on read' : 'curated'}</span>
          <span>{`${total} ${total === 1 ? 'stop' : 'stops'}`}</span>
        </div>
        <div className="journey-walk-row">
          {walk.stops.map((stop, index) => {
            const cells = journeyStopCells(stop)
            const meta = [cells.place, cells.occasion].filter(Boolean).join(' · ')
            return <div key={`${walk.id}:${index}`} className="journey-stop-cell" data-stop={index + 1} data-stop-ref={stop.id}>
              <button type="button" className="journey-stop-index" onClick={() => focusStop(walk, stop)}
                data-i={`Walk stop ${index + 1} of ${total}|${stop.label}${cells.also ? ` — ${cells.also} attached reached from this stop` : ''}. A click focuses the stop: its occasion on the Timeline, or its epoch in the atlas.`}>
                {`${index + 1}/${total}`}
              </button>
              <span className="journey-stop-artefact" title={stop.label}>{cells.artefact}</span>
              {meta && <span className="journey-stop-meta" title={meta}>{meta}</span>}
              {cells.expression && journey && isExpressionRef(cells.expression) && <button type="button" className="journey-stop-expression" title={`Open ${cells.expression} in the instrument`}
                onClick={() => journey.openExpression(cells.expression!)}>▷ Expression</button>}
              {cells.expression && !(journey && isExpressionRef(cells.expression)) && <span className="journey-stop-meta" title="Launching an Expression is offered where the instrument is open">{cells.expression}</span>}
            </div>;
          })}
        </div>
      </div>;
    })}
    {named && <p className="journey-named" role="status">{named}</p>}
  </div>;
}
