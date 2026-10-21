// CreatureFace: a creature as the face of an agent (manual §19.4, §19.15, §25.6). The figure is drawn by the face rig's engine, live, in the
// posture of the agent's run state (face-rig CREATURE-SPEC.md 25), in its own line ink; the element's ink is the colour of the act, drawn as a
// bar under the face. A figure that is not built yet draws its glyph, named and dark. Give it a figure, or a pattern and it takes that
// pattern's creature.
import {memo, useEffect, useRef, useState, type CSSProperties} from 'react'
import {DIM, ELEMENT_FUNCTION, INK, built, elementColour, faceOf, figureOf, type Figure} from './figures'
import type {RunState} from './agency'
import {mountFace, type Face} from './mount'
import {thumbOf} from './thumb'
import './faces.css'

/** Whether the person asked for reduced motion: posture changes only, no breath. */
export function useReducedMotion(): boolean {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const q = matchMedia('(prefers-reduced-motion: reduce)'), read = () => setOn(q.matches)
    q.addEventListener('change', read)
    return () => q.removeEventListener('change', read)
  }, [])
  return on
}

export interface CreatureFaceProps {
  /** A figure's id (`eagle`), or a pattern's (`watch`) to take its creature. */
  readonly figure?: string
  readonly pattern?: string
  readonly state?: RunState
  /** The side of the square the face stands in, px. */
  readonly size?: number
  /** Reduced motion; absent, the person's setting. */
  readonly reduced?: boolean
  /** Name the figure under the face. */
  readonly named?: boolean
  readonly className?: string
}

const figureFor = (p: CreatureFaceProps): Figure => (p.figure ? figureOf(p.figure) : p.pattern ? faceOf(p.pattern) : figureOf('serpent'))

/** The glyph of a figure that is not built: its sign, or its name's first letter, in a dashed ring, dark. */
export function Glyph({figure, size}: {figure: Figure; size: number}) {
  const mark = figure.sign ? `${figure.sign}︎` : figure.name.charAt(0)
  return <svg className="fx-glyph" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 4" opacity="0.7" />
    <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize={figure.sign ? 38 : 34} fill="currentColor" opacity="0.8" fontFamily="system-ui, sans-serif">{mark}</text>
  </svg>
}

export const CreatureFace = memo(function CreatureFace(props: CreatureFaceProps) {
  const figure = figureFor(props), size = props.size ?? 96, state = props.state ?? 'queued'
  const system = useReducedMotion(), reduced = props.reduced ?? system
  const host = useRef<HTMLDivElement>(null), face = useRef<Face | null>(null)
  const latest = useRef({state, reduced})
  latest.current = {state, reduced}
  const [ready, setReady] = useState(false), [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    const el = host.current
    if (!el || !built(figure)) return
    let gone = false
    setReady(false); setFailed(null)
    mountFace(figure, el, {size, state: latest.current.state, reduced: latest.current.reduced}).then(f => {
      if (gone) { f?.destroy(); return }
      face.current = f
      if (f) { f.show(latest.current.state); f.setReduced(latest.current.reduced); setReady(true) }
    }, cause => { if (!gone) setFailed(cause instanceof Error ? cause.message : String(cause)) })
    return () => { gone = true; face.current?.destroy(); face.current = null }
  }, [figure.id, size])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { face.current?.show(state) }, [state])
  useEffect(() => { face.current?.setReduced(reduced) }, [reduced])
  // An off-screen face holds still: its clock stops with the page.
  useEffect(() => {
    const el = host.current
    if (!el || typeof IntersectionObserver !== 'function') return
    const seen = new IntersectionObserver(es => { for (const e of es) face.current?.setRunning(e.isIntersecting) })
    seen.observe(el)
    return () => seen.disconnect()
  }, [])
  const element = elementColour(figure)
  const style = {width: size, '--fx-element': element, '--fx-ink': INK[figure.ink]} as CSSProperties
  const dark = !built(figure)
  return <div className={`fx-face ${props.className ?? ''}`} style={style} data-figure={figure.id} data-state={state} data-built={dark ? 'false' : 'true'} data-ready={ready ? 'true' : 'false'}
    role="img" aria-label={dark ? `${figure.name}, not drawn yet` : `${figure.name}, ${state}`}>
    <div className="fx-clip" ref={host} style={{opacity: dark ? 1 : 1 - DIM[state]}} data-state={state}>
      {dark && <Glyph figure={figure} size={size} />}
      {!dark && !ready && <Glyph figure={figure} size={size} />}
    </div>
    <span className="fx-bar" data-on={state === 'acting' || state === 'producing' || state === 'thinking' ? 'true' : 'false'} title={figure.element ? `${figure.element}: ${ELEMENT_FUNCTION[figure.element]}` : undefined} />
    {props.named && <span className="fx-name">{figure.name}{dark ? ' · not drawn' : ''}</span>}
    {failed && <span className="fx-err" title={failed}>!</span>}
  </div>
})

/** A figure at rest as a small picture: for a list of patterns, where a live body for each row would be a page of bodies. */
export const FigureThumb = memo(function FigureThumb({figure, size = 44, dim}: {figure: Figure; size?: number; dim?: boolean}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let gone = false
    thumbOf(figure).then(u => { if (!gone) setUrl(u) }, () => { /* the row keeps its glyph */ })
    return () => { gone = true }
  }, [figure])
  return <span className="fx-thumb" style={{width: size, height: size, opacity: dim ? 0.55 : 1}} data-built={built(figure) ? 'true' : 'false'} aria-hidden="true">
    {url ? <img src={url} width={size} height={size} alt="" draggable={false} /> : <Glyph figure={figure} size={size} />}
  </span>
})
