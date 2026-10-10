/**
 * devices-b2 shared control kit — the visual control primitives for the
 * faithful device-panel ports (batch 2).
 *
 * Own palette usage on the shell's tokens (`ui/src/styles.css`); all classes
 * carry the `b2-` prefix and inject once from `./styles`. Original assets
 * only — layout and interaction are the port; no Live-derived artwork.
 */

/** One stored parameter a panel port binds a control to (mirrors the
 * live-dynamics ParamDesc shape, ui_name/labels included). */
export interface ParamSpec {
  id: string
  label: string
  min: number
  max: number
  unit?: string
  kind: 'continuous' | 'discrete' | 'toggle'
  labels?: string[]
  /** Factory/default this port initializes to (defaults to min). */
  def?: number | boolean
  /** One-line semantics note surfaced as the control tooltip. */
  note?: string
}

/** The per-panel stored-value store: ids to numbers (toggles 0/1). */
export type ParamValues = Record<string, number>

import { useCallback, useRef, useState } from 'react'

/** Local device state: controls read and write this until the M3 edit API
 * lands per-device persistence. */
export function useDeviceState(specs: ParamSpec[], initial?: ParamValues) {
  const [values, setValues] = useState<ParamValues>(() => {
    const v: ParamValues = {}
    for (const s of specs) {
      if (initial && s.id in initial) v[s.id] = initial[s.id]
      else if (s.kind === 'toggle') v[s.id] = s.def === true ? 1 : 0
      else v[s.id] = typeof s.def === 'number' ? s.def : s.min
    }
    return v
  })
  const set = useCallback((id: string, value: number) => {
    setValues((prev) => (prev[id] === value ? prev : { ...prev, [id]: value }))
  }, [])
  return { values, set }
}

const TWO_PI = Math.PI * 2

function polar(cx: number, cy: number, r: number, frac: number): [number, number] {
  // -135deg .. +135deg sweep, 0deg at 12 o'clock
  const a = (-135 + 270 * frac) * (Math.PI / 180) - Math.PI / 2
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function arcPath(cx: number, cy: number, r: number, f0: number, f1: number): string {
  const [x0, y0] = polar(cx, cy, r, f0)
  const [x1, y1] = polar(cx, cy, r, f1)
  const large = Math.abs(f1 - f0) * 270 > 180 ? 1 : 0
  const sweep = f1 > f0 ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

/** Displayed value text (raw stored number with unit where pinned). */
export function fmtValue(v: number, unit?: string): string {
  const abs = Math.abs(v)
  const text = abs >= 100 ? v.toFixed(0) : abs >= 10 ? v.toFixed(1) : Number.isInteger(v) ? String(v) : v.toFixed(2)
  return unit ? `${text} ${unit}` : text
}

interface DragProps {
  onDelta: (delta: number, fine: boolean) => void
  onReset?: () => void
}

/** Vertical-drag behavior shared by knob and fader. */
function useVerticalDrag({ onDelta, onReset }: DragProps) {
  const last = useRef<number | null>(null)
  return {
    onPointerDown: (e: React.PointerEvent) => {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      last.current = e.clientY
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (last.current === null) return
      const dy = last.current - e.clientY
      last.current = e.clientY
      if (dy !== 0) onDelta(dy / (e.shiftKey ? 600 : 150), e.shiftKey)
    },
    onPointerUp: (e: React.PointerEvent) => {
      last.current = null
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    },
    onDoubleClick: onReset,
  }
}

export interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  /** Nonlinear (log-style) mapping: the arc position is linear in t where
   * value = min + (max-min) * t^curve. */
  curve?: number
  step?: number
  size?: number
  onChange: (v: number) => void
  title?: string
}

/** Rotary knob — the workhorse control of the family. Drag vertically,
 * Shift for fine, double-click resets to min (or def via the panel). */
export function Knob({ label, value, min, max, unit, curve = 1, step, size = 34, onChange, title }: KnobProps) {
  const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
  const toT = useCallback(
    (v: number) => clamp01(Math.pow((v - min) / (max - min || 1), 1 / curve)),
    [min, max, curve],
  )
  const fromT = useCallback(
    (t: number) => min + (max - min) * Math.pow(clamp01(t), curve),
    [min, max, curve],
  )
  const quant = useCallback(
    (v: number) => {
      let out = Math.min(max, Math.max(min, v))
      if (step) out = Math.round(out / step) * step
      return out
    },
    [min, max, step],
  )
  const drag = useVerticalDrag({
    onDelta: (d) => onChange(quant(fromT(toT(value) + d))),
  })

  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 3
  const frac = toT(value)
  const [px, py] = polar(cx, cy, r - 5, frac)
  const [vx, vy] = polar(cx, cy, r, frac)
  return (
    <div className="b2-knob" title={title ?? `${label}${unit ? ` (${unit})` : ''} — stored ${min}..${max}; drag, Shift = fine, double-click = min`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} {...drag} role="slider" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}>
        <path d={arcPath(cx, cy, r, 0, 1)} className="b2-knob-track" fill="none" />
        {frac > 0.001 ? <path d={arcPath(cx, cy, r, 0, frac)} className="b2-knob-fill" fill="none" /> : null}
        <circle cx={cx} cy={cy} r={r - 4} className="b2-knob-body" />
        <line x1={cx} y1={cy} x2={px} y2={py} className="b2-knob-pointer" />
        <circle cx={vx} cy={vy} r={1.4} className="b2-knob-tip" />
      </svg>
      <span className="b2-knob-value">{fmtValue(value, unit)}</span>
      <span className="b2-knob-label">{label}</span>
    </div>
  )
}

export interface MenuProps {
  label?: string
  value: number
  labels: string[]
  min?: number
  onChange: (v: number) => void
  title?: string
}

/** Menu (select) — Discrete parameters; unknown entries render as "N". */
export function Menu({ label, value, labels, min = 0, onChange, title }: MenuProps) {
  const shown = (i: number) => {
    const text = labels[i] ?? '?'
    return text === '?' ? String(min + i) : text
  }
  const sel = (
    <select
      className="b2-menu"
      value={String(value)}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      title={title ?? `${label ?? ''} — menu, stored index`}
      aria-label={label ?? 'menu'}
    >
      {labels.map((_, i) => (
        <option key={i} value={String(min + i)}>
          {shown(i)}
        </option>
      ))}
    </select>
  )
  if (!label) return sel
  return (
    <div className="b2-menu-wrap">
      {sel}
      <span className="b2-knob-label">{label}</span>
    </div>
  )
}

export interface SegmentedProps {
  label?: string
  value: number
  labels: string[]
  min?: number
  onChange: (v: number) => void
  title?: string
  /** Vertical stack (the Delay sync grids stack). */
  columns?: number
}

/** Segmented buttons — small Discrete menus the real panel draws as a button
 * row (drive character, 12/24 slope, mode tabs, sync grids). */
export function Segmented({ label, value, labels, min = 0, onChange, title, columns }: SegmentedProps) {
  return (
    <div className="b2-seg-wrap" title={title ?? `${label ?? ''} — stored ${min}..${min + labels.length - 1}`}>
      <div className={'b2-seg' + (columns ? ` b2-seg-cols-${columns}` : '')} role="radiogroup" aria-label={label}>
        {labels.map((text, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === min + i}
            className={'b2-seg-btn' + (value === min + i ? ' is-on' : '')}
            onClick={() => onChange(min + i)}
          >
            {text === '?' ? String(min + i) : text}
          </button>
        ))}
      </div>
      {label ? <span className="b2-knob-label">{label}</span> : null}
    </div>
  )
}

export interface SwitchProps {
  label?: string
  value: boolean
  onChange: (on: boolean) => void
  title?: string
}

/** Toggle switch — stored 0/1. */
export function Switch({ label, value, onChange, title }: SwitchProps) {
  const el = (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      title={title ?? `${label ?? ''} — stored 0/1`}
      className={'b2-switch' + (value ? ' is-on' : '')}
      onClick={() => onChange(!value)}
    >
      <span className="b2-switch-knob" />
    </button>
  )
  if (!label) return el
  return (
    <div className="b2-switch-wrap">
      {el}
      <span className="b2-knob-label">{label}</span>
    </div>
  )
}

export interface FaderProps {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  height?: number
  onChange: (v: number) => void
  title?: string
}

/** Vertical fader (DrumBuss level columns, Multiband output cells). */
export function Fader({ label, value, min, max, unit, height = 64, onChange, title }: FaderProps) {
  const drag = useVerticalDrag({
    onDelta: (d) => onChange(Math.min(max, Math.max(min, value + (max - min) * d))),
  })
  const frac = Math.min(1, Math.max(0, (value - min) / (max - min || 1)))
  return (
    <div className="b2-fader" title={title ?? `${label} — stored ${min}..${max}${unit ? ` ${unit}` : ''}`}>
      <div className="b2-fader-track" style={{ height }} {...drag} role="slider" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}>
        <div className="b2-fader-fill" style={{ height: `${(frac * 100).toFixed(1)}%` }} />
        <div className="b2-fader-cap" style={{ bottom: `calc(${(frac * 100).toFixed(1)}% - 4px)` }} />
      </div>
      <span className="b2-knob-value">{fmtValue(value, unit)}</span>
      <span className="b2-knob-label">{label}</span>
    </div>
  )
}

export interface ReadoutProps {
  value: string
  label?: string
  wide?: boolean
}

/** Static numeric readout cell (DrumBuss Trin, feedback %). */
export function Readout({ value, label, wide }: ReadoutProps) {
  return (
    <div className={'b2-readout' + (wide ? ' b2-readout-wide' : '')}>
      <span className="b2-readout-value">{value}</span>
      {label ? <span className="b2-knob-label">{label}</span> : null}
    </div>
  )
}

/** A bordered device section with a micro header (real panels group
 * controls into labeled blocks; ports mirror the grouping). */
export function Section({ label, children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={'b2-section' + (className ? ` ${className}` : '')}>
      {label ? <div className="b2-section-label">{label}</div> : null}
      <div className="b2-section-body">{children}</div>
    </div>
  )
}

/** The corner badge: persistence for these ports lands with the M3
 * device-editing API. Corner only — no prose on the canvas. */
export function EditApiBadge() {
  return <span className="b2-badge">awaiting M3 edit API</span>
}

export interface StoredExtrasProps {
  specs: ParamSpec[]
  values: ParamValues
  set: (id: string, v: number) => void
}

/** The stored-parameter footer: every remaining ParamDesc gets a control
 * here, compacted into a wrap row. The port renders the full table. */
export function StoredExtras({ specs, values, set }: StoredExtrasProps) {
  return (
    <div className="b2-extras">
      <span className="b2-extras-label">stored params</span>
      {specs.map((s) => {
        const v = values[s.id] ?? s.min
        const title = `${s.id} — stored ${s.min}..${s.max}${s.unit ? ` ${s.unit}` : ''}${s.note ? `; ${s.note}` : ''}`
        if (s.kind === 'toggle') {
          return <Switch key={s.id} label={s.label} value={v === 1} onChange={(on) => set(s.id, on ? 1 : 0)} title={title} />
        }
        if (s.kind === 'discrete') {
          const labels = s.labels ?? []
          if (labels.length <= 4) {
            return <Segmented key={s.id} label={s.label} value={v} labels={labels} min={s.min} onChange={(nv) => set(s.id, nv)} title={title} />
          }
          return <Menu key={s.id} label={s.label} value={v} labels={labels} min={s.min} onChange={(nv) => set(s.id, nv)} title={title} />
        }
        return (
          <Knob
            key={s.id}
            label={s.label}
            value={v}
            min={s.min}
            max={s.max}
            unit={s.unit}
            size={26}
            onChange={(nv) => set(s.id, nv)}
            title={title}
          />
        )
      })}
    </div>
  )
}

/** Shared frame: device header row (name + element tag + badge) and body. */
export function DevicePortFrame({ name, element, children }: { name: string; element: string; children: React.ReactNode }) {
  return (
    <div className="b2-device">
      <div className="b2-device-head">
        <span className="b2-device-name">{name}</span>
        <span className="b2-device-element">{element}</span>
        <span className="b2-device-spring" />
        <EditApiBadge />
      </div>
      {children}
    </div>
  )
}

/** Lissajous-free helper for simple LFO wave paths (Auto Pan / Chorus
 * displays): one period of the wave across the given box. */
export function wavePath(w: number, h: number, cycles = 3, phase = 0): string {
  const pts: string[] = []
  const n = 72
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w
    const y = h / 2 - Math.sin(phase + TWO_PI * cycles * (i / n)) * (h / 2 - 3)
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return pts.join(' ')
}
