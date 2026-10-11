/**
 * devices-pro shared kit — the persistence plumbing and the pro face
 * controls. One hook (`useDeviceEdit`) owns the M3 round-trip per panel
 * (descriptors → stored values → debounced POST with saved/error marks);
 * the controls (`ProSlider`, `ProKnob`, `ProMenu`, `ProSegmented`,
 * `ProToggle`, `ProField`) render whatever a parameter-table row holds and
 * route every change through that hook. Nothing is hand-coded per
 * parameter: a control is (desc, stored, send).
 *
 * Endpoint client is the M3 family's (`../devices/api`) — one API surface,
 * two presentation families.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { SetSummary } from '../../shell/useSet'
import {
  deviceDescriptors,
  fetchDeviceParams,
  postDeviceParam,
  type ParamDescJson,
} from '../devices/api'

export type { ParamDescJson }

export type Status = 'saving' | 'saved' | 'error'

/** Short human value for a stored number (face readouts). */
export function fmtNum(v: number): string {
  const abs = Math.abs(v)
  let text: string
  if (abs >= 1000) text = v.toFixed(0)
  else if (abs >= 100) text = v.toFixed(1)
  else if (abs >= 10) text = v.toFixed(2)
  else if (abs >= 1) text = v.toFixed(2)
  else if (abs === 0) text = '0'
  else text = v.toFixed(3)
  if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '')
  return text
}

/** Displayed value text: stored number + unit. */
export function fmtStored(v: number, unit?: string): string {
  return unit ? `${fmtNum(v)} ${unit}` : fmtNum(v)
}

export interface DeviceEdit {
  /** Parameter table rows (the descriptors this panel renders). */
  rows: ParamDescJson[] | null
  /** Tracks carrying the device element. */
  carriers: SetSummary['tracks']
  /** Bound track (first carrier unless chosen). */
  track: string | null
  chooseTrack: (name: string) => void
  /** Stored values keyed by param id (lossless strings from the document). */
  values: Record<string, string>
  /** Per-control persistence status. */
  status: Record<string, Status>
  statusMsg: Record<string, string>
  /** Send one edit: debounce >0 for drag sources, 0 for clicks/menus. */
  send: (paramId: string, payload: number | boolean, debounceMs: number) => void
  /** Report a local validation failure on a control. */
  fail: (paramId: string, message: string) => void
  loadError: string | null
  /** Descriptor fetch failure (the tables are the panels' source). */
  descError: string | null
}

/**
 * The M3 editing session for one device on the opened set. Mirrors the
 * proven DevicePanel round-trip: load stored values for the bound track,
 * POST edits (slider debounce ~150 ms), adopt the server-persisted value,
 * and keep a per-control saving/saved/error mark.
 */
export function useDeviceEdit(
  set: SetSummary | null,
  tableKey: string,
  elementName: string,
): DeviceEdit {
  const [allRows, setAllRows] = useState<Record<string, ParamDescJson[]> | null>(null)
  const [descError, setDescError] = useState<string | null>(null)
  const [trackChoice, setTrackChoice] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [statusMsg, setStatusMsg] = useState<Record<string, string>>({})

  const loadId = useRef(0)
  const sendSeq = useRef<Record<string, number>>({})
  const timers = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    let live = true
    deviceDescriptors().then(
      (d) => live && setAllRows(d),
      (e: unknown) => live && setDescError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [])

  const rows = allRows?.[tableKey] ?? null

  const carriers = useMemo(
    () => (set ? set.tracks.filter((t) => t.devices.includes(elementName)) : []),
    [set, elementName],
  )
  const track = trackChoice ?? carriers[0]?.name ?? null

  useEffect(() => {
    setTrackChoice(null)
  }, [set?.path])

  useEffect(() => {
    if (!set || !track || !rows) {
      setValues({})
      return
    }
    const id = ++loadId.current
    setLoadError(null)
    fetchDeviceParams(set.path, track, elementName).then(
      (map) => {
        if (loadId.current !== id) return
        const stored: Record<string, string> = {}
        for (const [pid, p] of Object.entries(map)) stored[pid] = p.value
        setValues(stored)
      },
      (e: unknown) => {
        if (loadId.current === id) {
          setValues({})
          setLoadError(e instanceof Error ? e.message : String(e))
        }
      },
    )
  }, [set, track, elementName, rows])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const t of pending.values()) window.clearTimeout(t)
      pending.clear()
    }
  }, [])

  const send = useCallback(
    (paramId: string, payload: number | boolean, debounceMs: number) => {
      if (!set || !track) return
      const display =
        typeof payload === 'boolean' ? String(payload) : fmtNum(payload)
      const seq = (sendSeq.current[paramId] ?? 0) + 1
      sendSeq.current[paramId] = seq
      setValues((v) => ({ ...v, [paramId]: display }))
      setStatus((s) => ({ ...s, [paramId]: 'saving' }))
      setStatusMsg((m) => {
        if (!(paramId in m)) return m
        const next = { ...m }
        delete next[paramId]
        return next
      })
      const prev = timers.current.get(paramId)
      if (prev !== undefined) window.clearTimeout(prev)
      const t = window.setTimeout(() => {
        postDeviceParam(set.path, track, elementName, paramId, payload).then(
          (res) => {
            if (sendSeq.current[paramId] !== seq) return // a newer edit superseded it
            setValues((v) => ({ ...v, [paramId]: res.value }))
            setStatus((s) => ({ ...s, [paramId]: 'saved' }))
          },
          (e: unknown) => {
            if (sendSeq.current[paramId] !== seq) return
            setStatus((s) => ({ ...s, [paramId]: 'error' }))
            setStatusMsg((m) => ({
              ...m,
              [paramId]: e instanceof Error ? e.message : String(e),
            }))
          },
        )
      }, debounceMs)
      timers.current.set(paramId, t)
    },
    [set, track, elementName],
  )

  const fail = useCallback((paramId: string, message: string) => {
    setStatus((s) => ({ ...s, [paramId]: 'error' }))
    setStatusMsg((m) => ({ ...m, [paramId]: message }))
  }, [])

  return {
    rows,
    carriers,
    track,
    chooseTrack: setTrackChoice,
    values,
    status,
    statusMsg,
    send,
    fail,
    loadError,
    descError,
  }
}

// ------------------------------------------------------------- controls

export interface StatusMarkProps {
  status: Status | undefined
  statusMsg: string | undefined
}

/** The per-control persistence mark: · saving, ✓ saved, ✕ error. */
export function StatusMark({ status, statusMsg }: StatusMarkProps) {
  if (status === 'saving') {
    return (
      <span className="prp-status prp-status-saving" title="saving…">
        ·
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="prp-status prp-status-saved" title="saved to the set">
        ✓
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="prp-status prp-status-error" title={statusMsg ?? 'error'}>
        ✕
      </span>
    )
  }
  return null
}

export interface ErrorTextProps {
  show: boolean
  message: string | undefined
}

export function ErrorText({ show, message }: ErrorTextProps) {
  if (!show || !message) return null
  return <div className="prp-error-text">{message}</div>
}

export interface Bind {
  desc: ParamDescJson
  stored: string | undefined
  status?: Status
  statusMsg?: string
  send: DeviceEdit['send']
  fail: DeviceEdit['fail']
}

/** Use a table row bound to the edit session (or null while loading). */
export function useBind(edit: DeviceEdit): (id: string) => Bind | null {
  return useCallback(
    (id: string) => {
      const desc = edit.rows?.find((r) => r.id === id)
      if (!desc) return null
      return {
        desc,
        stored: edit.values[id],
        status: edit.status[id],
        statusMsg: edit.statusMsg[id],
        send: edit.send,
        fail: edit.fail,
      }
    },
    [edit],
  )
}

function tooltipOf(desc: ParamDescJson): string {
  const range =
    desc.kind === 'toggle'
      ? 'stored 0/1'
      : `stored ${fmtNum(desc.stored_min)}..${fmtNum(desc.stored_max)}${desc.unit ? ` ${desc.unit}` : ''}`
  return `${desc.id} — ${range}; ${desc.notes}`
}

function missingNote(desc: ParamDescJson) {
  return `not stored in this document — the set carries no “${desc.id}” element to edit`
}

function commitNumeric(
  bind: Bind,
  draft: string,
): void {
  const v = parseFloat(draft)
  if (Number.isNaN(v)) {
    bind.fail(bind.desc.id, `${bind.desc.ui_name}: “${draft}” is not a number`)
  } else if (bind.desc.kind === 'discrete') {
    const idx = Math.round(v)
    if (idx !== v) {
      bind.fail(bind.desc.id, `${bind.desc.id} is a menu — type a stored index`)
    } else if (idx < bind.desc.stored_min || idx > bind.desc.stored_max) {
      bind.fail(bind.desc.id, `index ${idx} outside the menu ${bind.desc.stored_min}..${bind.desc.stored_max}`)
    } else {
      bind.send(bind.desc.id, idx, 0)
    }
  } else if (v < bind.desc.stored_min || v > bind.desc.stored_max) {
    bind.fail(
      bind.desc.id,
      `value ${v} out of range for ${bind.desc.id} (stored ${bind.desc.stored_min}..${bind.desc.stored_max}${bind.desc.unit ? ` ${bind.desc.unit}` : ''})`,
    )
  } else {
    bind.send(bind.desc.id, v, 0)
  }
}

/** Shared numeric readout with double-click entry (the mandate's numeric
 * entry on continuous controls). Enter commits, Escape cancels. */
function useNumericEntry(bind: Bind, num: number, missing: boolean) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const input = editing ? (
    <input
      className="prp-slider-input"
      value={draft}
      autoFocus
      aria-label={`${bind.desc.ui_name} — stored value`}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commitNumeric(bind, draft)
          setEditing(false)
        } else if (e.key === 'Escape') setEditing(false)
      }}
      onBlur={() => setEditing(false)}
    />
  ) : null
  const open = () => {
    setDraft(missing || Number.isNaN(num) ? '' : String(num))
    setEditing(true)
  }
  return { editing, input, open }
}

export interface ProSliderProps {
  bind: Bind
  /** Nonlinear position mapping (2–3 for frequency spans). */
  curve?: number
  /** Vertical orientation (Glue Threshold/Range/Makeup). */
  vertical?: boolean
  height?: number
  /** Bipolar fill from center when the range crosses zero (auto). */
  tickCount?: number
  /** Compact face label (overrides desc.ui_name for display only — the
   * tooltip and stored identity stay the table's). */
  name?: string
}

/** Drag slider + stored-value readout; double-click the value to type.
 * Continuous and discrete table rows both drive it (discrete snaps to
 * integer indices). */
export function ProSlider({ bind, curve = 1, vertical = false, height, tickCount, name }: ProSliderProps) {
  const { desc, stored } = bind
  const missing = stored === undefined
  const num = missing ? NaN : parseFloat(stored)
  const min = desc.stored_min
  const max = desc.stored_max
  const discrete = desc.kind === 'discrete'
  const stepHint = useMemo(() => {
    if (discrete) return 1
    const raw = (max - min) / 400
    const pow = 10 ** Math.floor(Math.log10(raw))
    const m = raw / pow
    return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * pow
  }, [discrete, min, max])

  const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
  const toT = (v: number) => clamp01(Math.pow((v - min) / (max - min || 1), 1 / curve))
  const fromT = (t: number) => min + (max - min) * Math.pow(clamp01(t), curve)

  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)

  const valueAt = (clientX: number, clientY: number): number => {
    const el = trackRef.current
    if (!el) return min
    const rect = el.getBoundingClientRect()
    const t = vertical
      ? clamp01(1 - (clientY - rect.top) / rect.height)
      : clamp01((clientX - rect.left) / rect.width)
    let v = fromT(t)
    if (discrete) v = Math.round(v)
    else v = Math.round(v / stepHint) * stepHint
    return Math.min(max, Math.max(min, v))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (missing) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = true
    bind.send(desc.id, valueAt(e.clientX, e.clientY), 150)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || missing) return
    bind.send(desc.id, valueAt(e.clientX, e.clientY), 150)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  const frac = Number.isNaN(num) ? 0 : toT(num)
  const bipolar = min < 0 && max > 0
  const zeroT = bipolar ? toT(0) : 0
  const entry = useNumericEntry(bind, num, missing)
  const display = missing || Number.isNaN(num) ? '—' : fmtStored(num, desc.unit || undefined)

  const style = height ? { height } : undefined

  if (vertical) {
    // Vertical rail: fill from the bottom, thumb as a cap.
    const fillPct = (frac * 100).toFixed(1)
    return (
      <div className="prp-slider prp-slider-vert" style={{ width: 58, alignItems: 'center' }} title={tooltipOf(desc)}>
        <div className="prp-slider-head">
          <span className="prp-slider-name">
            {name ?? desc.ui_name}
            <StatusMark status={bind.status} statusMsg={bind.statusMsg} />
          </span>
        </div>
        <div
          ref={trackRef}
          className="prp-slider-track"
          style={{ width: 24, height: height ?? 120 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="slider"
          aria-label={desc.ui_name}
          aria-valuenow={Number.isNaN(num) ? undefined : num}
          aria-valuemin={min}
          aria-valuemax={max}
        >
          {!missing ? <div className="prp-slider-fill" style={{ height: `${fillPct}%` }} /> : null}
          {!missing ? <div className="prp-slider-thumb" style={{ bottom: `calc(${fillPct}% - 2px)` }} /> : null}
          {tickCount
            ? Array.from({ length: tickCount }, (_, i) => (
                <span key={i} className="prp-slider-tick" style={{ top: `${((i + 1) / (tickCount + 1)) * 100}%`, left: 0, width: '100%', height: 1 }} />
              ))
            : null}
        </div>
        {entry.editing ? (
          entry.input
        ) : (
          <input
            className="prp-slider-value"
            style={{ width: 52 }}
            value={display}
            readOnly
            aria-label={`${desc.ui_name} — stored value`}
            title="double-click to type a stored value"
            disabled={missing}
            onDoubleClick={entry.open}
          />
        )}
      </div>
    )
  }

  const fillLeft = bipolar ? `${(Math.min(frac, zeroT) * 100).toFixed(1)}%` : '0%'
  const fillW = (bipolar ? Math.abs(frac - zeroT) : frac) * 100
  return (
    <div className={'prp-slider' + (bipolar ? ' bipolar' : '')} title={tooltipOf(desc)}>
      <div className="prp-slider-head">
        <span className="prp-slider-name">
          {name ?? desc.ui_name}
          <StatusMark status={bind.status} statusMsg={bind.statusMsg} />
        </span>
        {entry.editing ? null : (
          <input
            className="prp-slider-value"
            value={display}
            readOnly
            aria-label={`${desc.ui_name} — stored value`}
            title="double-click to type a stored value"
            disabled={missing}
            onDoubleClick={entry.open}
          />
        )}
        {entry.editing ? entry.input : null}
      </div>
      <div
        ref={trackRef}
        className="prp-slider-track"
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="slider"
        aria-label={desc.ui_name}
        aria-valuenow={Number.isNaN(num) ? undefined : num}
        aria-valuemin={min}
        aria-valuemax={max}
      >
        {tickCount
          ? Array.from({ length: tickCount }, (_, i) => (
              <span key={i} className="prp-slider-tick" style={{ left: `${((i + 1) / (tickCount + 1)) * 100}%` }} />
            ))
          : null}
        {!missing ? <div className="prp-slider-fill" style={{ left: fillLeft, width: `${fillW.toFixed(1)}%` }} /> : null}
        {!missing ? <div className="prp-slider-thumb" style={{ left: `${(frac * 100).toFixed(1)}%` }} /> : null}
      </div>
      <ErrorText show={bind.status === 'error'} message={bind.statusMsg} />
      {missing ? <div className="prp-missing">{missingNote(desc)}</div> : null}
    </div>
  )
}

function polar(cx: number, cy: number, r: number, frac: number): [number, number] {
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

export interface ProKnobProps {
  bind: Bind
  size?: number
  curve?: number
  /** Compact face label (display only). */
  name?: string
}

/** Rotary knob with the same persistence wiring; double-click the value to
 * type. Drag vertically, Shift = fine. */
export function ProKnob({ bind, size = 38, curve = 1, name }: ProKnobProps) {
  const { desc, stored } = bind
  const missing = stored === undefined
  const num = missing ? NaN : parseFloat(stored)
  const min = desc.stored_min
  const max = desc.stored_max
  const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
  const toT = (v: number) => clamp01(Math.pow((v - min) / (max - min || 1), 1 / curve))
  const fromT = (t: number) => min + (max - min) * Math.pow(clamp01(t), curve)
  const step = useMemo(() => {
    if (desc.kind === 'discrete') return 1
    const raw = (max - min) / 300
    const pow = 10 ** Math.floor(Math.log10(raw))
    const m = raw / pow
    return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * pow
  }, [desc.kind, min, max])

  const last = useRef<number | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (missing) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    last.current = e.clientY
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (last.current === null || missing) return
    const dy = last.current - e.clientY
    last.current = e.clientY
    if (dy === 0) return
    let v = fromT(toT(num) + dy / (e.shiftKey ? 500 : 140))
    v = desc.kind === 'discrete' ? Math.round(v) : Math.round(v / step) * step
    bind.send(desc.id, Math.min(max, Math.max(min, v)), 150)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    last.current = null
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  const frac = Number.isNaN(num) ? 0 : toT(num)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 3
  const [px, py] = polar(cx, cy, r - 6, frac)
  const entry = useNumericEntry(bind, num, missing)
  const display = missing || Number.isNaN(num) ? '—' : fmtStored(num, desc.unit || undefined)

  return (
    <div className="prp-knob" title={tooltipOf(desc)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="slider"
        aria-label={desc.ui_name}
        aria-valuenow={Number.isNaN(num) ? undefined : num}
        aria-valuemin={min}
        aria-valuemax={max}
      >
        <path d={arcPath(cx, cy, r, 0, 1)} className="prp-knob-track" />
        {frac > 0.001 ? <path d={arcPath(cx, cy, r, 0, frac)} className="prp-knob-fill" /> : null}
        <circle cx={cx} cy={cy} r={r - 4.5} className="prp-knob-body" />
        <line x1={cx} y1={cy} x2={px} y2={py} className="prp-knob-pointer" />
      </svg>
      {entry.editing ? (
        entry.input
      ) : (
        <input
          className="prp-knob-value"
          style={{ border: 'none', background: 'transparent', width: 52, textAlign: 'center', padding: 0 }}
          value={display}
          readOnly
          aria-label={`${desc.ui_name} — stored value`}
          title="double-click to type a stored value"
          disabled={missing}
          onDoubleClick={entry.open}
        />
      )}
      <span className="prp-knob-name">
        {name ?? desc.ui_name}
        <StatusMark status={bind.status} statusMsg={bind.statusMsg} />
      </span>
      <ErrorText show={bind.status === 'error'} message={bind.statusMsg} />
      {missing ? <div className="prp-missing">not stored here</div> : null}
    </div>
  )
}

export interface ProMenuProps {
  bind: Bind
  /** Render as a segmented button row instead of a dropdown. */
  segmented?: boolean
  /** Compact face label (display only). */
  name?: string
}

/** Discrete control: the table's labels, indexed stored_min..stored_max.
 * Unknown entries (“?”) display as the bare index — the dossier honesty
 * rule. Small sets can render segmented. */
export function ProMenu({ bind, segmented, name }: ProMenuProps) {
  const { desc, stored } = bind
  const missing = stored === undefined
  const labels = desc.labels ?? []
  const min = Math.round(desc.stored_min)
  const idx = missing ? null : Math.round(parseFloat(stored))
  const show = (text: string, i: number) => (text === '?' ? String(min + i) : text)
  const unit = desc.unit ? ` ${desc.unit}` : ''
  const status = <StatusMark status={bind.status} statusMsg={bind.statusMsg} />

  if (segmented) {
    return (
      <div className="prp-menu-col" title={tooltipOf(desc)}>
        <div className="prp-seg" role="radiogroup" aria-label={name ?? desc.ui_name}>
          {labels.map((text, i) => {
            const value = min + i
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={idx === value}
                disabled={missing}
                className={'prp-seg-btn' + (idx === value ? ' is-on' : '')}
                onClick={() => bind.send(desc.id, value, 0)}
              >
                {show(text, i)}
              </button>
            )
          })}
        </div>
        <span className="prp-menu-name">
          {desc.ui_name}
          {status}
        </span>
        <ErrorText show={bind.status === 'error'} message={bind.statusMsg} />
        {missing ? <div className="prp-missing">{missingNote(desc)}</div> : null}
      </div>
    )
  }

  return (
    <div className="prp-menu-col" title={tooltipOf(desc)}>
      <span className="prp-menu-name">
        {name ?? desc.ui_name}
        {status}
      </span>
      <select
        className="prp-menu"
        aria-label={name ?? desc.ui_name}
        value={idx === null ? '' : String(idx)}
        disabled={missing}
        onChange={(e) => bind.send(desc.id, parseInt(e.target.value, 10), 0)}
      >
        {idx === null ? <option value="">—</option> : null}
        {labels.map((text, i) => {
          const value = min + i
          return (
            <option key={value} value={String(value)}>
              {show(text, i)}
              {unit}
            </option>
          )
        })}
      </select>
      <ErrorText show={bind.status === 'error'} message={bind.statusMsg} />
      {missing ? <div className="prp-missing">{missingNote(desc)}</div> : null}
    </div>
  )
}

export interface ProToggleProps {
  bind: Bind
  label?: string
}

/** Toggle switch — stored 0/1, posted as true/false. */
export function ProToggle({ bind, label }: ProToggleProps) {
  const { desc, stored } = bind
  const missing = stored === undefined
  const on = stored === 'true' || stored === '1'
  return (
    <div className="prp-switch-col" title={tooltipOf(desc)}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label ?? desc.ui_name}
        className={'prp-switch' + (on ? ' is-on' : '')}
        disabled={missing}
        onClick={() => bind.send(desc.id, !on, 0)}
      >
        <span className="prp-switch-knob" />
      </button>
      <span className="prp-switch-name">
        {label ?? desc.ui_name}
        <StatusMark status={bind.status} statusMsg={bind.statusMsg} />
      </span>
      <ErrorText show={bind.status === 'error'} message={bind.statusMsg} />
      {missing ? <div className="prp-missing">not stored here</div> : null}
    </div>
  )
}

export interface ProFieldProps {
  bind: Bind
  /** Display transform for the stored number (e.g. seconds → ms text). */
  format?: (v: number) => string
  /** Parse the typed text back to stored units. */
  parse?: (text: string) => number
  /** Compact face label (display only). */
  name?: string
}

/** Editable numeric field showing stored units (Echo delay seconds).
 * Commits on Enter, reverts on Escape/blur. */
export function ProField({ bind, format, parse, name }: ProFieldProps) {
  const { desc, stored } = bind
  const missing = stored === undefined
  const num = missing ? NaN : parseFloat(stored)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const display = missing || Number.isNaN(num) ? '—' : format ? format(num) : fmtStored(num, desc.unit || undefined)

  const commit = () => {
    const v = parse ? parse(draft) : parseFloat(draft)
    if (Number.isNaN(v)) {
      bind.fail(desc.id, `${desc.ui_name}: “${draft}” is not a number`)
    } else if (v < desc.stored_min - 1e-9 || v > desc.stored_max + 1e-9) {
      bind.fail(
        desc.id,
        `value ${v} out of range for ${desc.id} (stored ${desc.stored_min}..${desc.stored_max}${desc.unit ? ` ${desc.unit}` : ''})`,
      )
    } else {
      bind.send(desc.id, v, 0)
    }
    setEditing(false)
  }

  return (
    <div className="prp-field-col" title={tooltipOf(desc)}>
      <span className="prp-field-name">
        {name ?? desc.ui_name}
        <StatusMark status={bind.status} statusMsg={bind.statusMsg} />
      </span>
      {editing ? (
        <input
          className="prp-field"
          value={draft}
          autoFocus
          aria-label={`${desc.ui_name} — stored value`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            else if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <input
          className="prp-field"
          value={display}
          readOnly
          aria-label={`${desc.ui_name} — stored value`}
          title="click to type a stored value"
          disabled={missing}
          onClick={() => {
            setDraft(missing || Number.isNaN(num) ? '' : String(num))
            setEditing(true)
          }}
        />
      )}
      <ErrorText show={bind.status === 'error'} message={bind.statusMsg} />
      {missing ? <div className="prp-missing">{missingNote(desc)}</div> : null}
    </div>
  )
}

// ------------------------------------------------------------- frame

export interface ProFaceProps {
  name: string
  element: string
  edit?: DeviceEdit
  badge?: string
  children: React.ReactNode
}

/** The device face: name plate, bound-track selector, element tag, and the
 * grouped control body. */
export function ProFace({ name, element, edit, badge, children }: ProFaceProps) {
  return (
    <div className="prp-face">
      <div className="prp-face-head">
        <span className="prp-plate">{name}</span>
        {badge ? <span className="prp-badge">{badge}</span> : null}
        <span className="prp-head-spring" />
        {edit && edit.carriers.length > 0 ? (
          <span className="prp-track-label">
            <span className="prp-sub">track</span>
            <select
              className="prp-track-select"
              value={edit.track ?? ''}
              onChange={(e) => edit.chooseTrack(e.target.value)}
              aria-label={`${name} — track to edit`}
            >
              {edit.carriers.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </span>
        ) : null}
        <span className="prp-element-tag">{element}</span>
      </div>
      {children}
    </div>
  )
}

export interface SectionProps {
  title?: string
  children: React.ReactNode
  className?: string
}

/** A labeled control group with a hairline rule (the faces' block
 * structure). */
export function ProSection({ title, children, className }: SectionProps) {
  return (
    <div className={'prp-section' + (className ? ` ${className}` : '')}>
      {title ? (
        <div className="prp-section-title">
          {title}
          <span className="prp-section-rule" />
        </div>
      ) : null}
      <div className="prp-row">{children}</div>
    </div>
  )
}

/** Shared no-set / no-device hints (the M3 family's honest states). */
export function editGuard(
  set: SetSummary | null,
  loading: boolean,
  error: string | null,
  elementName: string,
  title: string,
  edit: DeviceEdit,
): React.ReactNode | null {
  if (loading) return <div className="prp-hint">reading set…</div>
  if (error) return <div className="prp-hint prp-hint-error">open failed: {error}</div>
  if (!set) return <div className="prp-hint">no set open — open one from the browser</div>
  if (edit.descError) {
    return <div className="prp-hint prp-hint-error">parameter tables unavailable: {edit.descError}</div>
  }
  if (edit.carriers.length === 0) {
    return (
      <div className="prp-hint">
        no {elementName} device in this set — the {title} face edits the stored parameters of a
        track carrying one
      </div>
    )
  }
  if (edit.loadError) {
    return <div className="prp-hint prp-hint-error">read failed: {edit.loadError}</div>
  }
  return null
}
