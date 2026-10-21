// TakesGrove: the attempts of a run, one tree for each take (manual §19.1 Takes, §19.5 Experiment, §25.6; face-rig CREATURE-SPEC.md 24: a tree is
// a run). Every take is its own tree: a retry is a new take, and the earlier tree stays. A take that finished stands in leaf and bears its
// fruit, ripe where its checks passed and gold where it landed; a take that failed is grey and its crown has come down, held and not erased;
// a take that is running is still growing; one not started is a seed. The take that stands has a gold bar under it.
import {memo, useEffect, useRef, useState} from 'react'
import {use, type Kit} from './vendor'
import {useReducedMotion} from './CreatureFace'
import './faces.css'

/** A take's state. `dormant` and `archived` are a field's seasons (manual §25.6): a NOW clearing that is quiescent stands bare, and one in the record stands dim. */
export type TakeState = 'queued' | 'running' | 'done' | 'failed' | 'dormant' | 'archived'
export interface Take {readonly id: string; readonly label: string; readonly state: TakeState; /** The take that stands (the one you chose). */ readonly stands?: boolean; /** Its fruit have landed. */ readonly landed?: boolean}

const YEAR: Readonly<Record<TakeState, number>> = {queued: 0.03, running: 0.55, done: 0.9, failed: 0.62, dormant: 1, archived: 1}

/** The screen box of a generated tree and a margin round it, in the engine's screen units (as the stage computes its view). */
function viewOf(ET: Kit, T: Kit): [number, number, number, number] {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
  const see = (p: number[]) => { const s = ET.proj(p); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]) }
  for (const b of T.B) for (const p of b.pts) see(p)
  for (const L of T.leaves) see(L.pet)
  see([0, 520, 0]); see([-300, 0, 0]); see([300, 0, 0])
  return [Math.round(x0 - 40), Math.round(y0 - 40), Math.round(x1 - x0 + 80), Math.round(y1 - y0 + 80)]
}

function Tree({take, seed, width}: {take: Take; seed: number; width: number}) {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    let gone = false, handle: Kit = null
    use('environ-tree').then(async () => {
      await new Promise(r => setTimeout(r, seed * 40))   // trees are made one at a time: each takes about 150 ms
      if (gone) return
      const ET = window.EnvironTree!, K = window.CreatureKit!
      const T = ET.generate({seed}), view = viewOf(ET, T), id = `groveTree${seed}`
      if (!K.get(id)) ET.figure({T, view, id, ground: false})
      const size = width, t = K.mount(id, el, {size, live: true, life: false, palette: {ground: '#0f1113'}})
      handle = t
      t.setBeh({style: 'off'})
      ET.setYear(t, YEAR[take.state], {instant: true})
      ET.setDieback(t, take.state === 'failed' ? 1 : 0, {instant: true})
      const fruit = take.state === 'done' ? [take.landed ? 'harvested' : 'ripe', 'ripe', 'ripening'].slice(0, take.stands ? 3 : 2) : []
      const zones = {roots: take.state === 'queued' ? 'dark' : 'rest', trunk: take.state === 'running' ? 'growing' : take.state === 'queued' ? 'rest' : 'grown',
        crown: take.state === 'done' ? 'in leaf' : take.state === 'archived' ? 'dim' : 'rest', height: take.state === 'done' ? 1 : take.state === 'running' ? 0.5 : 0, fruit, season: 'active'}
      ET.setLook(t, zones, performance.now(), {instant: true, yHead: null, load: 0, sway: 0})
      for (let k = 0; k < 40; k++) { ET.growStep(t, 100); t.advance(100) }   // the growth the take stands at, placed and held
      t.pause(true)
    }).catch(cause => { if (!gone) setFailed(cause instanceof Error ? cause.message : String(cause)) })
    return () => { gone = true; try { handle?.destroy() } catch { /* already gone */ } }
  }, [take.state, take.stands, take.landed, seed, width])
  return <div className="fx-tree" ref={host} data-state={take.state}>{failed && <span className="fx-err" title={failed}>!</span>}</div>
}

export const TakesGrove = memo(function TakesGrove({takes, width = 130}: {takes: readonly Take[]; width?: number}) {
  useReducedMotion()
  return <div className="fx-grove" role="list" aria-label="Takes">
    {takes.map((t, i) => <figure key={t.id} role="listitem" className="fx-take" data-state={t.state} data-stands={t.stands ? 'true' : undefined} style={{width}}>
      <div className="fx-take-tree" style={{width, height: Math.round(width * 1.05)}}><Tree take={t} seed={11 + i * 5} width={width} /></div>
      <figcaption><b>{t.label}</b><span>{t.stands ? 'stands' : t.state}</span></figcaption>
    </figure>)}
  </div>
})
