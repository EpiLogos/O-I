// The torus and its two helices with the twelve pitch classes standing on them: the picture the Live note and tuning devices fill a
// pane with (manual §21.3 and §21.4, Full). The torus carries one whole-tone family on each helix (§21.1): C, D, E, F♯, G♯, A♯ on the
// first, C♯, D♯, F, G, A, B on the second. Round the ring the twelve classes stand a semitone apart and alternate helices, so a step of
// a semitone always crosses from one helix to the other. Every mark is drawn from the marks a device hands in; nothing here holds a
// reading of its own. Not a device module (no `__` in the name): the Scale mapping and Exact-ratio tuning designs import it.
import type {ReactElement} from 'react'

/** One pitch class as a device shows it on the torus. */
export interface HelixMark {
  readonly name: string
  /** In the mode (true), out of it (false), or no pitch set to say (null). */
  readonly lit: boolean | null
  /** The class it sounds as, when the device moves it. */
  readonly to?: number
  /** A short reading under the name: a ratio, cents. */
  readonly note?: string
  /** How the reading reads: a value, an act, or faint. */
  readonly noteTone?: 'value' | 'on' | 'dim'
}

const TAU = Math.PI * 2
const f1 = (x: number) => x.toFixed(1)

/** The torus at a three-quarter view, the two helices wound round it, the classes on the top of the tube. `root` rings one class. */
export function HelixTorus({w, h, marks, root, caption}: {w: number; h: number; marks: readonly HelixMark[]; root?: number; caption?: readonly string[]}): ReactElement {
  const cx = w / 2, cy = h * .46, R = Math.min(w * .3, h * .62), r = R * .13, k = .42
  /** A point on the surface: θ round the ring (C at the back), φ round the tube (π/2 the top). */
  const P = (th: number, ph: number) => [cx + (R + r * Math.cos(ph)) * Math.cos(th), cy + (R + r * Math.cos(ph)) * Math.sin(th) * k - r * Math.sin(ph) * .9] as const
  /** Whether the surface faces the viewer: its normal against the view, which looks down at the ring from 25° above it. */
  const facing = (th: number, ph: number) => Math.cos(ph) * Math.sin(th) * .9 + Math.sin(ph) * .42
  const at = (n: number) => -Math.PI / 2 + n * Math.PI / 6
  // The helices: six windings each, the first on the top of the tube at the even classes, the second at the odd.
  const strand = (family: number) => {
    const runs: {d: string; near: boolean}[] = []
    let cur = '', side: boolean | null = null
    for (let i = 0; i <= 720; i++) {
      const th = -Math.PI / 2 + TAU * i / 720, ph = Math.PI / 2 + 6 * (th + Math.PI / 2) + family * Math.PI
      const [x, y] = P(th, ph), near = facing(th, ph) > -.05
      if (near !== side) { if (cur) runs.push({d: cur, near: side!}); cur = `M${f1(x)} ${f1(y)}`; side = near } else cur += `L${f1(x)} ${f1(y)}`
    }
    if (cur) runs.push({d: cur, near: side!})
    return runs
  }
  const label = (n: number) => [cx + (R + r + 22) * Math.cos(at(n)), cy + ((R + r) * k + 20) * Math.sin(at(n)) - r * .45] as const
  return <g>
    <ellipse cx={cx} cy={cy} rx={R + r} ry={(R + r) * k + r * .25} className="dp-faint" />
    <ellipse cx={cx} cy={cy - r * .2} rx={R - r} ry={(R - r) * k} className="dp-faint" />
    {/* the top of the tube, where the classes stand */}
    <ellipse cx={cx} cy={cy - r * .9} rx={R} ry={R * k} className="dp-faint" opacity={.6} />
    {[0, 1].map(family => strand(family).map((seg, i) => <path key={`${family}-${i}`} d={seg.d} fill="none"
      stroke={family ? 'var(--dp-on)' : 'var(--dp-value)'} strokeWidth={1.1} opacity={seg.near ? .55 : .14} />))}
    {/* what the device does: an arrow along the top of the tube from each class it moves to the class it sounds as */}
    {marks.map((m, n) => {
      if (m.to === undefined || m.to === n) return null
      const [ax, ay] = P(at(n), Math.PI / 2), [bx, by] = P(at(m.to), Math.PI / 2), mid = (at(n) + at(m.to) + (Math.abs(m.to - n) > 6 ? TAU : 0)) / 2
      const [mx, my] = P(mid, Math.PI / 2), lift = 26
      const qx = mx, qy = my - lift, len = Math.hypot(bx - qx, by - qy) || 1, ux = (bx - qx) / len, uy = (by - qy) / len
      return <g key={`a${n}`}>
        <path d={`M${f1(ax)} ${f1(ay - 6)}Q${f1(qx)} ${f1(qy)} ${f1(bx - ux * 9)} ${f1(by - uy * 9)}`} className="dp-curve-on" strokeWidth={1.8} />
        <path d={`M${f1(bx - ux * 9 - uy * 4)} ${f1(by - uy * 9 + ux * 4)}L${f1(bx - ux * 3)} ${f1(by - uy * 3)}L${f1(bx - ux * 9 + uy * 4)} ${f1(by - uy * 9 - ux * 4)}`} className="dp-curve-on" strokeWidth={1.8} />
      </g>
    })}
    {marks.map((m, n) => {
      // On the far side of the ring the reading stands above the name, clear of the class's point.
      const [x, y] = P(at(n), Math.PI / 2), [lx, ly] = label(n), family = n % 2, back = Math.sin(at(n)) < -.3
      return <g key={n}>
        {root === n && <circle cx={x} cy={y} r={11} fill="none" stroke="var(--dp-on)" strokeWidth={1.4} />}
        <circle cx={x} cy={y} r={m.lit === false ? 5.5 : 7} fill={m.lit === true ? (family ? 'var(--dp-on)' : 'var(--dp-value)') : 'var(--dp-well)'}
          stroke={m.lit === null ? 'var(--dp-value-dim)' : family ? 'var(--dp-on)' : 'var(--dp-value)'} strokeWidth={1.4} opacity={m.lit === false ? .5 : 1} />
        <text x={lx} y={ly - (back && m.note !== undefined ? 13 : 0)} textAnchor="middle" className={m.lit === false ? 'dp-ink-dim' : 'dp-ink'} style={{fontSize: 13}}>{m.name}</text>
        {m.note !== undefined && <text x={lx} y={back ? ly : ly + 14} textAnchor="middle" className="dp-ink-dim"
          style={{fontSize: 10.5, fill: m.noteTone === 'on' ? 'var(--dp-on)' : m.noteTone === 'value' ? 'var(--dp-value)' : undefined}}>{m.note}</text>}
      </g>
    })}
    {(caption ?? []).map((line, i) => <text key={i} x={18} y={h - 18 - ((caption?.length ?? 1) - 1 - i) * 14} className={i ? 'dp-ink-dim' : 'dp-ink'}>{line}</text>)}
    <text x={w - 18} y={h - 32} textAnchor="end" className="dp-axis"><tspan fill="var(--dp-value)">●</tspan> C D E F♯ G♯ A♯</text>
    <text x={w - 18} y={h - 18} textAnchor="end" className="dp-axis"><tspan fill="var(--dp-on)">●</tspan> C♯ D♯ F G A B</text>
  </g>
}
