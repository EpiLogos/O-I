// CrewFace: a crew as the face of a crew pattern (manual §19.15, §25.6; face-rig CREATURE-SPEC.md 19 and 21: a swarm is a Count, not a bigger
// creature). A pattern whose Count is Pair, Crew or Swarm is several whole creatures in one pane, each a complete body with every posture it
// has, each in the posture of its own run state. The pane holds them as the pattern holds its members: a pair face to face, a crew in an arc
// with the lead at the front, a swarm scattered and small, a queue by size. A member whose creature is not drawn yet stands as its glyph, dark.
import {memo, useEffect, useRef, useState, type CSSProperties} from 'react'
import {countOf, PATTERNS, type RunState} from './agency'
import {built, faceOf, figureOf, type Figure} from './figures'
import {CreatureFace, Glyph, useReducedMotion} from './CreatureFace'
import {SCENES, mountScene, type Scene} from './scene'
import './faces.css'

export interface CrewMember {readonly id?: string; readonly name?: string; readonly state?: RunState; readonly lead?: boolean}
export interface CrewFaceProps {
  readonly pattern: string
  /** The crew's state; each member takes its own when `members` gives it. */
  readonly state?: RunState
  readonly members?: readonly CrewMember[]
  /** Width of the pane, px. */
  readonly width?: number
  readonly reduced?: boolean
}

type Shape = 'pair' | 'arc' | 'swarm' | 'queue' | 'abreast'
interface Slot {readonly x: number; readonly y: number; readonly s: number; readonly flip?: boolean}
/** Where the members stand, as fractions of the pane: x and y of the member's centre, and its width as a fraction of the pane's. */
const SLOTS: Readonly<Record<Shape, readonly Slot[]>> = {
  pair: [{x: 0.27, y: 0.62, s: 0.48}, {x: 0.73, y: 0.62, s: 0.48, flip: true}],
  arc: [{x: 0.2, y: 0.72, s: 0.4}, {x: 0.5, y: 0.8, s: 0.44}, {x: 0.8, y: 0.72, s: 0.4}, {x: 0.5, y: 0.46, s: 0.3}],
  abreast: [{x: 0.17, y: 0.6, s: 0.33}, {x: 0.5, y: 0.68, s: 0.35}, {x: 0.83, y: 0.6, s: 0.33}],
  queue: [{x: 0.14, y: 0.66, s: 0.3}, {x: 0.37, y: 0.66, s: 0.26}, {x: 0.58, y: 0.66, s: 0.22}, {x: 0.77, y: 0.66, s: 0.19}, {x: 0.92, y: 0.66, s: 0.16}],
  swarm: [{x: 0.18, y: 0.34, s: 0.28}, {x: 0.5, y: 0.3, s: 0.28}, {x: 0.82, y: 0.34, s: 0.28}, {x: 0.3, y: 0.72, s: 0.3}, {x: 0.62, y: 0.76, s: 0.3}, {x: 0.86, y: 0.7, s: 0.26}],
}
/** The shape each crew pattern takes: from its mechanism (agency.ts `does`). */
const SHAPE: Readonly<Record<string, Shape>> = {vacate: 'queue', relay: 'queue', drive: 'abreast', guard: 'abreast'}
const shapeOf = (pattern: string): Shape => SHAPE[pattern] ?? (countOf(PATTERNS[pattern]!) === 'Pair' ? 'pair' : countOf(PATTERNS[pattern]!) === 'Swarm' ? 'swarm' : 'arc')
const SIZE: Readonly<Record<Shape, number>> = {pair: 2, arc: 4, abreast: 3, queue: 5, swarm: 6}

/** The second member of a pair, where it is not the same figure: a mount's carried rider, which is not drawn yet. */
const PARTNER: Readonly<Record<string, string>> = {mount: 'rider'}

/** A pattern with a scene is performed by the face rig's own crew: its bodies walk, dance and carry as the pattern says. */
function CrewScene({pattern, state, width, reduced, refused}: {pattern: string; state: RunState; width: number; reduced: boolean; refused: () => void}) {
  const host = useRef<HTMLDivElement>(null), scene = useRef<Scene | null>(null)
  const latest = useRef({state, reduced})
  latest.current = {state, reduced}
  const [failed, setFailed] = useState<string | null>(null)
  const [aspect, setAspect] = useState(0.62)
  useEffect(() => {
    const el = host.current
    if (!el) return
    let gone = false
    mountScene(el, pattern, latest.current).then(s => {
      if (gone) { s?.destroy(); return }
      scene.current = s
      if (s) setAspect(s.aspect); else refused()
    }, cause => { if (!gone) setFailed(cause instanceof Error ? cause.message : String(cause)) })
    return () => { gone = true; scene.current?.destroy(); scene.current = null }
  }, [pattern])
  useEffect(() => { scene.current?.set(state) }, [state])
  useEffect(() => { scene.current?.setReduced(reduced) }, [reduced])
  useEffect(() => {
    const el = host.current
    if (!el || typeof IntersectionObserver !== 'function') return
    const seen = new IntersectionObserver(es => { for (const e of es) scene.current?.setRunning(e.isIntersecting) })
    seen.observe(el)
    return () => seen.disconnect()
  }, [])
  return <div className="fx-crew fx-crew--scene" style={{width, height: Math.round(width * aspect)}} role="img" aria-label={`${PATTERNS[pattern]!.name} crew, ${state}`}>
    <div className="fx-scene" ref={host} />
    {failed && <span className="fx-err" title={failed}>!</span>}
  </div>
}

export const CrewFace = memo(function CrewFace({pattern, state = 'queued', members, width = 360, reduced: asked}: CrewFaceProps) {
  const system = useReducedMotion(), reduced = asked ?? system
  const [tableau, setTableau] = useState(false)
  const p = PATTERNS[pattern]
  if (!p) return null
  if (SCENES[pattern] && !members && !tableau) return <CrewScene pattern={pattern} state={state} width={width} reduced={reduced} refused={() => setTableau(true)} />
  const shape = shapeOf(pattern), slots = SLOTS[shape], figure = faceOf(pattern)
  const n = Math.min(slots.length, members?.length ?? SIZE[shape])
  const height = Math.round(width * 0.62)
  const at = (i: number): Figure => (i === 1 && shape === 'pair' && PARTNER[pattern] ? figureOf(PARTNER[pattern]!) : figure)
  return <div className="fx-crew" style={{width, height, '--fx-ink': 'currentColor'} as CSSProperties} data-shape={shape} data-pattern={pattern} role="img"
    aria-label={`${p.name}: ${n} ${figure.name}${n === 1 ? '' : 's'}, ${state}`}>
    <div className="fx-crew-ground" />
    {slots.slice(0, n).map((slot, i) => {
      const f = at(i), m = members?.[i], w = Math.round(width * slot.s), dark = !built(f)
      return <div key={m?.id ?? i} className="fx-crew-member" data-lead={m?.lead ? 'true' : undefined} data-dark={dark ? 'true' : undefined}
        style={{left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: w, zIndex: Math.round(slot.y * 100), transform: `translate(-50%, -78%)${slot.flip && f.id !== 'fishes' ? ' scaleX(-1)' : ''}`}}
        title={m?.name ? `${m.name}: ${m.state ?? state}` : undefined}>
        {dark ? <Glyph figure={f} size={w} /> : <CreatureFace figure={f.id} state={m?.state ?? state} size={w} reduced={reduced} />}
      </div>
    })}
  </div>
})
