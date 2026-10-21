// The stage: a run as a creature on its environ (manual §19.4 Full, §25.6; face-rig CREATURE-SPEC.md 24 and 25). The environ is the process,
// read in time: a tree whose growth is the run's work, whose fruit are its artefacts, whose ripeness is their validation, which greys and
// loses its leaves when the run fails. The creature is the agent: the serpent climbs the trunk to the crown as the run writes and returns;
// another type's creature stands at the zone the run has reached, in the posture of its state. Both are driven by the run's events and by
// nothing else (no action without an event); a stall freezes them; reduced motion places them and never moves them.
import {memo, useEffect, useRef, useState, type CSSProperties} from 'react'
import {RUN_STATES, type RunState} from './agency'
import {BREATHES, faceOf, figureOf, INK, type Figure} from './figures'
import {CreatureFace, useReducedMotion} from './CreatureFace'
import {recordedRun, use, type Kit} from './vendor'
import type {Recording} from './runs'
import './faces.css'

/** The zone of the tree the run has reached: where an agent that is not the serpent stands. */
const ZONES = {roots: {top: 66, label: 'roots · gather'}, trunk: {top: 36, label: 'trunk · make'}, crown: {top: 4, label: 'crown · deliver'}} as const
type Zone = keyof typeof ZONES

export interface StageProps {
  /** The run to show: events as O-I records them (runs.ts). */
  readonly run: Recording | 'recorded'
  /** The agent's state now: the face takes its posture, and the chips light the state. */
  readonly state: RunState
  /** The agent's creature: the serpent climbs the tree; any other stands at its zone. */
  readonly figure?: string
  /** Width, px. */
  readonly width?: number
  readonly reduced?: boolean
  /** Play the recording on its own clock; absent, the stage shows the run where it stands (at its end). */
  readonly play?: boolean
  /** Where in the run to stand, as a fraction of its length; absent, the run as it stands at its last event. */
  readonly at?: number
}

export const EnvironStage = memo(function EnvironStage({run, state, figure = 'serpent', width = 320, reduced: asked, play, at}: StageProps) {
  const system = useReducedMotion(), reduced = asked ?? system
  const box = useRef<HTMLDivElement>(null), wrap = useRef<HTMLDivElement>(null)
  const api = useRef<Kit>(null), visible = useRef(true)
  const [zone, setZone] = useState<Zone>('roots')
  const [error, setError] = useState<string | null>(null)
  const fig: Figure = figureOf(figure)
  const serpent = fig.id === 'serpent'
  const latest = useRef({state, reduced, play})
  latest.current = {state, reduced, play}

  useEffect(() => {
    const el = box.current
    if (!el) return
    let gone = false, raf = 0, last = 0, settle = 0, lastZone: Zone | undefined
    ;(async () => {
      const rec = run === 'recorded' ? await recordedRun('run-refinement-close-2026-10-18') as Recording : run
      await use('stage-serpent-tree')
      if (gone) return
      const st = window.StageSerpentTree!.mount(el, {run: rec, speed: 40, reduced: latest.current.reduced, size: width, live: false})
      api.current = st
      if (!serpent) { const layer = el.children[2] as HTMLElement | undefined; if (layer) layer.style.display = 'none' }
      if (latest.current.play) st.play()
      else { st.seek(Math.round(at === undefined ? Math.max(0, st.total - 1500) : st.total * at)); st.pause() }   // (the run's last 1.5 s: at its very end the stage closes the year)
      settle = 6000
      const loop = (t: number) => {
        raf = requestAnimationFrame(loop)
        const dt = last ? Math.min(80, t - last) : 16
        last = t
        if (!visible.current || document.hidden) return
        const now = latest.current
        // The clock runs while the recording plays, while a living state breathes, and while the tree finishes its growth; a held stage rests.
        if (st.playing() || (BREATHES[now.state] && !now.reduced) || settle > 0) { st.advance(dt, dt); settle -= dt }
        const where = st.signals()?.where?.phase as Zone | undefined
        if (where && where !== lastZone) { lastZone = where; setZone(where) }
        if (st.S.error) setError(String(st.S.error.message ?? st.S.error))
      }
      raf = requestAnimationFrame(loop)
    })().catch(cause => { if (!gone) setError(cause instanceof Error ? cause.message : String(cause)) })
    return () => { gone = true; cancelAnimationFrame(raf); try { api.current?.destroy() } catch { /* the stage already let go */ } api.current = null }
  }, [run, width, serpent, at]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.setReduced(reduced) }, [reduced])
  useEffect(() => { if (play) api.current?.play(); else api.current?.pause() }, [play])
  useEffect(() => {
    const el = wrap.current
    if (!el || typeof IntersectionObserver !== 'function') return
    const seen = new IntersectionObserver(es => { for (const e of es) visible.current = e.isIntersecting })
    seen.observe(el)
    return () => seen.disconnect()
  }, [])

  const z = ZONES[zone]
  const faceW = Math.round(width * 0.3)
  const style = {width, '--fx-ink': INK[faceOf('watch').ink]} as CSSProperties
  return <div className="fx-stage" ref={wrap} style={style} data-state={state}>
    <div className="fx-stage-view" ref={box} />
    {!serpent && <div className="fx-stage-agent" style={{top: `${z.top}%`}}><CreatureFace figure={fig.id} state={state} size={faceW} reduced={reduced} /></div>}
    <div className="fx-stage-foot">
      <div className="fx-states" role="img" aria-label={`Run state: ${state}`}>
        <span className="fx-ticks">{RUN_STATES.map(s => <i key={s.id} data-on={s.id === state ? 'true' : 'false'} data-breath={s.breath ? 'true' : 'false'} title={`${s.id}: ${s.what}${s.breath ? '' : ' (no breath)'}`} />)}</span>
        <b className="fx-state">{state}</b>
      </div>
      <span className="fx-sig" title="A tree is a run: it stands for one task, grows with the work, bears its artefacts as fruit.">tree · annual · {z.label}</span>
    </div>
    {error && <span className="fx-err" title={error}>!</span>}
  </div>
})
