// The World cut's registration over a mode's tracks (FOUNDATION F3: the modes differ by registration, never by a branch in the
// views): wherever the mode's tracks are the World cut (shell/modeFrames.ts MODE_TRACK_SOURCES 'world': Central, Factory, Technē),
// its tracks hook is wrapped so the set it returns also carries what the World cut presentation drew beside them — the cron
// firings, the occasion stood in, the rails' stop focus (worldCutTracks.ts). The time spine is read here, through its own
// subscription, and nothing is written to it: the stop focus goes through the owners (walkStopFocus → applyWalkStopFocus, the
// rule techneControls already holds). With no World reading published, the mode's answer passes through untouched.
import {useEffect, useMemo, useState} from 'react'
import type {TimeSpine} from '../../timeline/timeSpine'
import type {UseModeTracks} from './modeTracks'
import {techneControls} from './useTechneTracks'
import {worldCutSet} from './worldCutTracks'

/** Re-read when the spine moves (an occasion stood, a firing landed, a qualification made): its own subscription, no clock. */
function useSpineRevision(spine: TimeSpine | undefined): number {
  const [revision, setRevision] = useState(0)
  useEffect(() => spine?.subscribe(() => setRevision(value => value + 1)), [spine])
  return revision
}

/** A mode's tracks hook, with the World cut's readings added to its set. */
export function worldCut(use: UseModeTracks): UseModeTracks {
  return reading => {
    const answer = use(reading)
    const view = reading.world
    const revision = useSpineRevision(view?.spine)
    return useMemo(() => {
      if (!view || !answer || 'waiting' in answer) return answer
      // A stop stands through the view this set was drawn from; the set is redrawn whenever the shell publishes another.
      const stand = techneControls(() => ({view, door: undefined})).stand
      return worldCutSet(answer, view.spine, view.source, stand)
    }, [answer, view, revision])
  }
}
