// A creature mounted as a face: the figure drawn in the posture of a run state (face-rig CREATURE-SPEC.md 25). Plain DOM, no React,
// so the faces, the crews and the stages share it. Rules it keeps (spec 25.2):
//   - no action without an event: a face's own life is off, and it moves only when its run state changes;
//   - the idle stays still: a state with no breath holds its pose, paused; breath exists only while check-ins arrive;
//   - a stall is frozen where it stopped and does not breathe;
//   - reduced motion means posture changes only: the figure is placed in its pose at once, and never breathes.
import {use} from './vendor'
import type {Kit} from './vendor'
import {BREATHES, POSES, ZOOM, built, type Figure, type Pose} from './figures'
import type {RunState} from './agency'

export interface Face {
  /** Show a run state: the pose of the state, then breath or stillness. */
  show(state: RunState): void
  setReduced(reduced: boolean): void
  /** Running or not: an off-screen face holds still. */
  setRunning(on: boolean): void
  destroy(): void
}

/** The face is a landscape box, the proportion of every creature's canvas (1000 by 780). */
export const ASPECT = 780 / 1000
/** A creature on the kit or the lion draws its whole canvas, and its own camera frames each posture inside it, so the face shows the
 * canvas. The serpent has no camera: its body is small in its view, so the face shows the window round it. */
const SERPENT_WINDOW = {cx: 22, cy: -66, w: 330}

type Sink = {c: Kit; kind: 'kit' | 'lion' | 'serpent'; d?: Kit}

/** The serpent with the acts a face needs: the roster serpent (creature-serpent.js) and the stage's small acts (stage-serpent-tree.js SDEF). */
export function serpentBody(): Kit {
  const w = window as unknown as {__faceSerpent?: Kit}
  if (w.__faceSerpent) return w.__faceSerpent
  const BD = window.CreatureBody, SD = window.SERPENT_DEF
  w.__faceSerpent = BD.build({...SD, chunk: 4, bouts: {}, actions: {...SD.actions,
    offer: {label: 'offer', ms: 2600, run: (x: Kit) => { x.busy(2400); x.goal('H', 52, 1100); x.goal('pitch', -0.16, 900); x.at(800, () => x.tongue(2)) }},
    rest: {label: 'rest', ms: 1600, run: (x: Kit) => { x.goal('H', x.state === 'heap' ? 18 : 2, 1500); x.goal('pitch', 0.06, 1200); x.goal('sb', 0, 1200) }},
    raise: {label: 'raise', ms: 1400, run: (x: Kit) => { x.goal('H', x.state === 'heap' ? 128 : 24, 1300); x.goal('pitch', -0.04, 1000) }},
    drop: {label: 'let the head fall', ms: 1800, run: (x: Kit) => { x.goal('H', 0, 900); x.goal('pitch', 0.3, 900); x.goal('sb', 0.2, 900) }},
    flick1: {label: 'one flick', ms: 500, run: (x: Kit) => x.tongue(1)},
    glance: {label: 'glance', ms: 1200, run: (x: Kit) => x.lookAt(x.f.headFwd + x.R(-1, 1), x.R(700, 1100))},
    watch: {label: 'look out', ms: 1000, run: (x: Kit) => x.lookAt(Math.PI / 2 + 0.25, 900)},
  }})
  return w.__faceSerpent
}

/** Mount a figure in `host` (a box `size` px square, clipped) and return its face; null for a figure that is not built. */
export async function mountFace(figure: Figure, host: HTMLElement, o: {size: number; state: RunState; reduced: boolean; running?: boolean}): Promise<Face | null> {
  const mount = figure.mount
  if (!mount || !built(figure)) return null
  await use('creature-kit')
  for (const file of mount.files) await use(file)
  if (!host.isConnected) return null
  const inner = document.createElement('div')
  inner.className = 'fx-figure'
  host.appendChild(inner)

  let sink: Sink
  const palette = {} as Record<string, string>
  if (mount.kind === 'kit') {
    const d = window.CreatureKit.get(mount.def)
    if (!d) throw new Error(`faces: the kit has no ${mount.def}`)
    sink = {c: window.CreatureKit.mount(d, inner, {size: o.size, live: true, life: false, palette}), kind: 'kit', d}
    inner.style.cssText = `position:absolute;left:0;top:0;pointer-events:none;transform:scale(${ZOOM[figure.id] ?? 1});transform-origin:50% 50%`
  } else if (mount.kind === 'lion') {
    sink = {c: window.mountCreature!(inner, {size: o.size, live: true, palette}), kind: 'lion'}
    inner.style.cssText = `position:absolute;left:0;top:0;pointer-events:none;transform:scale(${ZOOM.lion});transform-origin:50% 50%`
  } else {
    // the serpent's body draws small in a wide view: enlarge it and shift it so the window round the body fills the face
    const w = SERPENT_WINDOW, M = Math.round(o.size * 570 / w.w), px = M / 570
    sink = {c: serpentBody().mountCreature(inner, {size: M, live: true, life: false}), kind: 'serpent'}
    const vb = (inner.querySelector('svg') as SVGSVGElement).viewBox.baseVal
    inner.style.cssText = `position:absolute;left:${(-(w.cx - w.w / 2 - vb.x) * px).toFixed(1)}px;top:${(-(w.cy - w.w * ASPECT / 2 - vb.y) * px).toFixed(1)}px;width:${M}px;pointer-events:none`
  }
  const c = sink.c
  if (sink.kind !== 'serpent') c.setLife?.(false)
  else c.life(false)

  let state: RunState = o.state, reduced = o.reduced, running = o.running !== false
  let last: Pose | undefined
  let settle = 0
  const rest = sink.d?.REST_POSTURE as string | undefined

  const poseOf = (s: RunState): Pose | undefined => {
    const table = POSES[figure.id] ?? {}
    return s === 'stalled' ? last ?? table.acting ?? table.thinking : table[s]
  }
  // Hold a creature still: its clock stops, so a stalled body is frozen where it stopped and an idle one does not breathe.
  const hold = (on: boolean) => c.pause(on)
  const settled = (): boolean => {
    if (sink.kind === 'serpent') return c.lifeLog().busy <= 0 && !c.travelling()
    const p = c.posture?.()
    return !p || (!p.moving && !(p.route?.length) && !p.after && !(p.pending?.length) && !(c.actions?.some((a: Kit) => !a.cut)))
  }
  const place = (pose: Pose) => {
    if (sink.kind === 'serpent') { if (pose.act) c.play(pose.act); return }
    if (pose.gait) c.go(pose.gait)
    else if (pose.posture) c.go(pose.posture)
    else if (rest) c.go(rest)
    if (pose.act) c.play(pose.act, pose.args)
  }
  const apply = () => {
    window.clearInterval(settle)
    const pose = poseOf(state)
    if (state === 'stalled') { hold(true); return }
    if (pose) last = pose
    if (!pose) return
    if (sink.kind === 'serpent') {
      if (reduced) { hold(true); place(pose); c.advance(3000, 50); return }
      hold(!running); c.breath(BREATHES[state]); place(pose)
      if (!BREATHES[state]) settle = window.setInterval(() => { if (!BREATHES[state] && settled()) { window.clearInterval(settle); if (state !== 'stalled') hold(true) } }, 200)
      return
    }
    if (reduced) {
      // posture changes only: the figure is placed in its pose at once, and holds
      c.pause(true); place(pose); c.advance(pose.gait ? 3200 : 7000, 80)
      return
    }
    c.pause(!running)
    place(pose)
    if (!BREATHES[state]) settle = window.setInterval(() => { if (!BREATHES[state] && settled()) { window.clearInterval(settle); if (state !== 'stalled') c.pause(true) } }, 160)
  }
  apply()

  return {
    show(next) { if (next === state) return; state = next; apply() },
    setReduced(on) { if (on === reduced) return; reduced = on; apply() },
    setRunning(on) { running = on; if (reduced) return; if (BREATHES[state] || !settled()) c.pause(!on) },
    destroy() { window.clearInterval(settle); try { c.destroy?.() } catch { /* the kit already let go of it */ } inner.remove() },
  }
}
