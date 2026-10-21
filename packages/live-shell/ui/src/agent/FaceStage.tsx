/**
 * The agent's face, live: the face rig's own page (public/face/face.html, vendored by scripts/sync-face.mjs from EpiLogos/face-rig)
 * in a same-origin iframe, driven only through the face's own bounded surface (face-speech.js `window.FACE_RIG_CHAT`: `apply`
 * with its named agent states, expressions, emotions and affect, and `setSpeechMode`). Nothing is drawn or redrawn here: the
 * polygon mesh, its muscles, its springs and its life are the rig's. A change of state glides by the face's own springs; nothing
 * here eases it.
 *
 * Until the live face stands — on the server, in the manual's static figures, while it loads, and wherever it cannot load — the
 * stage draws the static mask (maskFace.ts) in the same pose. A request for reduced motion keeps the face and stops its own life
 * (public/face/face-embed.js turns the face's `motion` off); every state still shows.
 *
 * The frame takes no pointer unless the host asks (`interactive`), so a device's handles and rows under it keep their hand.
 * The Answer (catalogue/panels/central__nara-conversation.tsx) stands it in its well and its pane; the Agent can stand it too.
 */
import {memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties} from 'react'
import {maskStatic, type FaceExpr} from './maskFace'
import './FaceStage.css'

/** What the agent does now, as the owner reports it. */
export type FaceState = 'idle' | 'reading' | 'answering'

/** The face's own agent states and emotions this stage uses (face-core.js AGENTS, EMOTIONS). */
export type FaceAgent = 'idle' | 'working' | 'speaking'
export type FaceEmotion = 'sleepy'

/** One action on the face's bounded surface (face-speech.js FACE_RIG_CHAT.apply). */
export type FaceAction =
  | {readonly type: 'agent'; readonly name: FaceAgent}
  | {readonly type: 'expression'; readonly name: FaceExpr; readonly weight: number}
  | {readonly type: 'emotion'; readonly name: FaceEmotion}
  | {readonly type: 'affect'; readonly valence: number; readonly arousal: number}

/** One call on that surface: an action to apply, or the speech mode (true: the mouth waits for a voice's timeline; false: the
 * speaking state moves the mouth itself). */
export type FaceCall = {readonly apply: FaceAction} | {readonly speechMode: boolean}

export interface FacePose {
  readonly state?: FaceState
  /** An expression held over the state's own (one of the face's named expressions). */
  readonly expression?: FaceExpr
  /** The feeling, as valence and arousal, each −1..1 (the face's affect plane). */
  readonly affect?: readonly [number, number]
  /** Whether the mouth moves while the agent answers. Default: yes. Off, the mouth waits for a voice to move it (§19.21). */
  readonly speaking?: boolean
  /** No conversation is bound: the face sleeps. */
  readonly dim?: boolean
}

/** The agent state each phase puts the face in: at rest; reading the packet, focused, eyes down on it (the face's own
 * `working`: focus, gaze down); answering, speaking. */
export const FACE_AGENT_OF: Readonly<Record<FaceState, FaceAgent>> = {idle: 'idle', reading: 'working', answering: 'speaking'}
/** The mask's pose for each phase, where the live face is not standing (the shell's earlier mapping). */
export const MASK_OF: Readonly<Record<FaceState, FaceExpr>> = {idle: 'neutral', reading: 'focus', answering: 'speak'}

const unit = (x: number) => (Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0)

/** The calls that put the face in a pose, in order. Pure: the same pose gives the same calls. Asleep (dim), the face is at
 * rest with its eyes closed and its manner sleepy, and nothing else is held over it. */
export function faceCalls(pose: FacePose): FaceCall[] {
  if (pose.dim) {
    return [{apply: {type: 'agent', name: 'idle'}}, {apply: {type: 'expression', name: 'sleep', weight: 1}}, {apply: {type: 'emotion', name: 'sleepy'}}]
  }
  const state = pose.state ?? 'idle'
  const calls: FaceCall[] = [{apply: {type: 'agent', name: FACE_AGENT_OF[state]}}]
  if (state === 'answering') calls.push({speechMode: pose.speaking === false})
  if (pose.expression) calls.push({apply: {type: 'expression', name: pose.expression, weight: 1}})
  if (pose.affect) calls.push({apply: {type: 'affect', valence: unit(pose.affect[0]), arousal: unit(pose.affect[1])}})
  return calls
}

/** The mask's pose: the held expression, else sleep when dim, else the phase's. */
export const maskOf = (pose: FacePose): FaceExpr => pose.expression ?? (pose.dim ? 'sleep' : MASK_OF[pose.state ?? 'idle'])

/** The face's bounded surface as the page gives it (face-speech.js). */
interface FaceSurface {
  readonly apply: (action: FaceAction) => unknown
  readonly setSpeechMode: (active: boolean) => void
}

/** Where the shell serves the face: beside its own page (Vite's public/, under the app's base). */
export const FACE_PAGE = `${import.meta.env?.BASE_URL ?? '/'}face/face.html`
/** How long the face may take to stand before the stage keeps the mask. */
const FACE_PATIENCE_MS = 15000

/** Before the first paint in a browser; on the server, where nothing is painted, not at all (and without React's warning). */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** The shell's agent ink and ground, read once from its tokens (the mask is drawn as markup, so it needs the colours, not the
 * variables). */
export function useFaceColours() {
  const [colours, setColours] = useState({ink: 'var(--fizz)', ground: 'var(--bg-0)'})
  useBeforePaint(() => {
    const style = getComputedStyle(document.documentElement)
    const hex = (name: string, fallback: string) => { const x = style.getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(x) ? x : fallback }
    setColours({ink: hex('--fizz', 'var(--fizz)'), ground: hex('--bg-0', 'var(--bg-0)')})
  }, [])
  return colours
}

const surfaceOf = (frame: HTMLIFrameElement | null): FaceSurface | null => {
  try {
    const face = (frame?.contentWindow as (Window & {FACE_RIG_CHAT?: FaceSurface}) | null | undefined)?.FACE_RIG_CHAT
    return face && typeof face.apply === 'function' && typeof face.setSpeechMode === 'function' ? face : null
  } catch {
    return null // another origin (a copy of the manual opened from disk): the mask stands
  }
}

const run = (face: FaceSurface, calls: readonly FaceCall[]) => {
  for (const call of calls) {
    try {
      if ('apply' in call) face.apply(call.apply)
      else face.setSpeechMode(call.speechMode)
    } catch {
      // The face refused one action (a name it no longer has): it keeps the pose it has, and the next call still goes.
    }
  }
}

export interface FaceStageProps extends FacePose {
  /** Words for the face, read by assistive technology (the frame itself is hidden from it). */
  readonly label?: string
  /** The frame takes the pointer (the face answers a press with its own ripple). Default: it does not. */
  readonly interactive?: boolean
  /** The face page (default FACE_PAGE). */
  readonly src?: string
  readonly className?: string
  readonly style?: CSSProperties
}

/** The face, filling the box it is given: live where it stands, the mask in the same pose until then or instead. */
export const FaceStage = memo(function FaceStage({label, interactive, src = FACE_PAGE, className, style, ...pose}: FaceStageProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const face = useRef<FaceSurface | null>(null)
  // off: not mounted (the server, the first draw); loading; live; failed. The frame is drawn once mounted, behind the mask.
  const [stand, setStand] = useState<'off' | 'loading' | 'shown' | 'failed'>('off')
  const calls = useMemo(() => faceCalls(pose), [pose.state, pose.expression, pose.affect?.[0], pose.affect?.[1], pose.speaking, pose.dim])
  const key = JSON.stringify(calls)
  const plan = useRef({calls, key})
  plan.current = {calls, key}
  /** The pose the face was last put in: each pose goes once. */
  const applied = useRef<string | null>(null)
  const putInPose = (found: FaceSurface) => { if (applied.current !== plan.current.key) { run(found, plan.current.calls); applied.current = plan.current.key } }

  useEffect(() => { setStand('loading') }, [src])
  useEffect(() => {
    if (stand !== 'loading') return
    const late = setTimeout(() => setStand(was => (was === 'loading' ? 'failed' : was)), FACE_PATIENCE_MS)
    return () => clearTimeout(late)
  }, [stand])
  // Each new pose goes to the standing face at once; the face's springs carry it there.
  useEffect(() => { if (stand === 'shown' && face.current) putInPose(face.current) }, [key, stand])

  // The face takes its pose before it is shown, so it is never seen arriving from the rig's own rest.
  const onLoad = () => {
    const found = surfaceOf(frame.current)
    face.current = found
    applied.current = null
    if (found) putInPose(found)
    setStand(found ? 'shown' : 'failed')
  }

  const {ink, ground} = useFaceColours()
  const mask = useMemo(() => maskStatic(maskOf(pose), ink, ink, 150, ground), [maskOf(pose), ink, ground])
  const live = stand === 'shown'
  return <div className={['face-stage', className].filter(Boolean).join(' ')} style={style} data-face={live ? 'live' : 'mask'} data-dim={pose.dim ? 'true' : undefined}
    role="img" aria-label={label}>
    {!live && <div className="face-stage-mask" aria-hidden="true" dangerouslySetInnerHTML={{__html: mask}} />}
    {(stand === 'loading' || live) && <iframe ref={frame} className="face-stage-frame" src={src} title={label ?? 'Face'} aria-hidden="true" tabIndex={-1}
      sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" onLoad={onLoad} onError={() => setStand('failed')}
      data-interactive={interactive ? 'true' : undefined} />}
  </div>
})
