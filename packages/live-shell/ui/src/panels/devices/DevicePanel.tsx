import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { SetSummary } from '../../shell/useSet'
import {
  deviceDescriptors,
  fetchDeviceParams,
  postDeviceParam,
  type ParamDescJson,
} from './api'

/**
 * Generic device panel — the whole panel family is generated from the
 * live-dynamics parameter tables this component is fed (never hand-coded
 * per parameter):
 *
 * - Continuous → slider + numeric field (double-click to type), stored unit
 * - Discrete   → stepper + menu of the stored index labels
 * - Toggle     → switch
 *
 * Every control is live: moving it POSTs the new stored value
 * (`POST /api/document/device-param`, slider debounced ~150 ms) and the
 * panel shows the value the server persisted. Each control carries its own
 * saved / error indicator. The panel edits the device on the bound track —
 * the first track carrying the device unless another carrier is chosen.
 */

type Status = 'saving' | 'saved' | 'error'

export interface DevicePanelProps {
  /** Device element name in the document (e.g. "GlueCompressor"). */
  elementName: string
  /** Product title for hints and headers. */
  displayTitle: string
  set: SetSummary | null
  loading: boolean
  error: string | null
}

/** A keyboard-accessible slider step that is nice to type: ~1/500 of the
 *  range snapped to 1/2/5×10^k. */
function niceStep(desc: ParamDescJson): number {
  const raw = (desc.stored_max - desc.stored_min) / 500
  const pow = 10 ** Math.floor(Math.log10(raw))
  const m = raw / pow
  const nice = m >= 5 ? 5 : m >= 2 ? 2 : 1
  return nice * pow
}

function decimalsOf(step: number): number {
  return Math.max(0, -Math.floor(Math.log10(step) + 1e-9))
}

/** The short human note under each control (kind + stored unit). */
function shortNote(desc: ParamDescJson): string {
  switch (desc.kind) {
    case 'toggle':
      return 'on/off — stored 0..1'
    case 'discrete':
      return desc.unit ? `menu — stored ${desc.unit}` : 'menu — stored index'
    case 'continuous':
      return desc.unit ? `stored ${desc.unit}` : 'stored value'
  }
}

function StatusMark({ status, statusMsg }: { status: Status | undefined; statusMsg: string | undefined }) {
  if (status === 'saving') {
    return (
      <span className="devp-status devp-status-saving" title="saving…">
        ·
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="devp-status devp-status-saved" title="saved to the set">
        ✓
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="devp-status devp-status-error" title={statusMsg ?? 'error'}>
        ✕
      </span>
    )
  }
  return null
}

export function DevicePanel({ elementName, displayTitle, set, loading, error }: DevicePanelProps) {
  const [descriptors, setDescriptors] = useState<Record<string, ParamDescJson[]> | null>(null)
  const [descError, setDescError] = useState<string | null>(null)

  // The track this panel edits: first carrier unless the user picks one.
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
      (d) => live && setDescriptors(d),
      (e: unknown) => live && setDescError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [])

  const descRows = descriptors?.[elementName] ?? null

  const carriers = useMemo(
    () => (set ? set.tracks.filter((t) => t.devices.includes(elementName)) : []),
    [set, elementName],
  )
  const track = trackChoice ?? carriers[0]?.name ?? null

  // A newly opened set resets the manual track choice.
  useEffect(() => {
    setTrackChoice(null)
  }, [set?.path])

  // Load the device's stored values whenever the bound track moves.
  useEffect(() => {
    if (!set || !track || !descRows) {
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
  }, [set, track, elementName, descRows])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const t of pending.values()) window.clearTimeout(t)
      pending.clear()
    }
  }, [])

  const commit = useCallback(
    (paramId: string, payload: number | boolean, display: string, delay: number) => {
      if (!set || !track) return
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
            setStatusMsg((m) => ({ ...m, [paramId]: e instanceof Error ? e.message : String(e) }))
          },
        )
      }, delay)
      timers.current.set(paramId, t)
    },
    [set, track, elementName],
  )

  const failLocal = useCallback((paramId: string, message: string) => {
    setStatus((s) => ({ ...s, [paramId]: 'error' }))
    setStatusMsg((m) => ({ ...m, [paramId]: message }))
  }, [])

  if (loading) return <div className="panel-hint">reading set…</div>
  if (error) return <div className="panel-hint panel-hint-error">open failed: {error}</div>
  if (!set) return <div className="panel-hint">no set open — open one from the browser</div>
  if (descError) {
    return <div className="panel-hint panel-hint-error">parameter tables unavailable: {descError}</div>
  }
  if (!descRows) return <div className="panel-hint">reading parameter tables…</div>
  if (carriers.length === 0) {
    return (
      <div className="panel-hint">
        no {elementName} device in this set — the {displayTitle} panel edits the stored
        parameters of a track carrying one
      </div>
    )
  }

  return (
    <div className="devp-panel">
      <div className="devp-header">
        <span className="micro-label">track</span>
        <select
          className="devp-track-select"
          value={track}
          onChange={(e) => setTrackChoice(e.target.value)}
          aria-label={`${displayTitle} — track to edit`}
        >
          {carriers.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="devp-device-tag">{elementName}</span>
      </div>

      {loadError ? (
        <div className="panel-hint panel-hint-error">read failed: {loadError}</div>
      ) : null}

      <div className="devp-rows">
        {descRows.map((desc) => (
          <ParamRow
            key={desc.id}
            desc={desc}
            stored={values[desc.id]}
            status={status[desc.id]}
            statusMsg={statusMsg[desc.id]}
            onSend={commit}
            onFail={failLocal}
          />
        ))}
      </div>
    </div>
  )
}

interface ParamRowProps {
  desc: ParamDescJson
  stored: string | undefined
  status: Status | undefined
  statusMsg: string | undefined
  onSend: (paramId: string, payload: number | boolean, display: string, delay: number) => void
  onFail: (paramId: string, message: string) => void
}

function ParamRow({ desc, stored, status, statusMsg, onSend, onFail }: ParamRowProps) {
  const missing = stored === undefined
  const num = missing ? NaN : parseFloat(stored)

  return (
    <div className="devp-row" title={desc.notes}>
      <div className="devp-row-head">
        <span className="devp-name">{desc.ui_name}</span>
        <StatusMark status={status} statusMsg={statusMsg} />
        {desc.kind === 'toggle' ? (
          <ToggleControl desc={desc} stored={stored} onSend={onSend} />
        ) : desc.kind === 'discrete' ? (
          <DiscreteControl desc={desc} stored={stored} onSend={onSend} />
        ) : (
          <ContinuousValue desc={desc} num={num} missing={missing} onSend={onSend} onFail={onFail} />
        )}
      </div>
      {desc.kind === 'continuous' && !missing ? (
        <ContinuousSlider desc={desc} num={num} onSend={onSend} />
      ) : null}
      {status === 'error' && statusMsg ? (
        <div className="devp-error-text">{statusMsg}</div>
      ) : null}
      {missing ? (
        <div className="devp-missing">
          not stored in this document — the set carries no “{desc.id}” element to edit
        </div>
      ) : (
        <div className="devp-note">{shortNote(desc)}</div>
      )}
    </div>
  )
}

function ToggleControl({
  desc,
  stored,
  onSend,
}: {
  desc: ParamDescJson
  stored: string | undefined
  onSend: ParamRowProps['onSend']
}) {
  const missing = stored === undefined
  const on = stored === 'true'
  return (
    <>
      {!missing ? <span className="devp-unit">{stored}</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={desc.ui_name}
        className={'devp-switch' + (on ? ' devp-switch-on' : '')}
        disabled={missing}
        onClick={() => onSend(desc.id, !on, String(!on), 0)}
      >
        <span className="devp-switch-knob" />
      </button>
    </>
  )
}

function DiscreteControl({
  desc,
  stored,
  onSend,
}: {
  desc: ParamDescJson
  stored: string | undefined
  onSend: ParamRowProps['onSend']
}) {
  const labels = desc.labels ?? []
  const min = Math.round(desc.stored_min)
  const max = Math.round(desc.stored_max)
  const parsed = stored === undefined ? NaN : parseFloat(stored)
  const idx = Number.isNaN(parsed) ? null : Math.round(parsed)

  const sendIndex = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next))
    onSend(desc.id, clamped, String(clamped), 0)
  }

  return (
    <>
      <button
        type="button"
        className="devp-step-btn"
        aria-label={`${desc.ui_name} — previous menu entry`}
        disabled={idx === null || idx <= min}
        onClick={() => idx !== null && sendIndex(idx - 1)}
      >
        −
      </button>
      <select
        className="devp-menu"
        aria-label={desc.ui_name}
        value={idx === null ? '' : String(idx)}
        disabled={idx === null}
        onChange={(e) => sendIndex(parseInt(e.target.value, 10))}
      >
        {idx === null ? <option value="">—</option> : null}
        {labels.map((label, i) => {
          const value = min + i
          return (
            <option key={value} value={String(value)}>
              {value}: {label}
              {desc.unit ? ` ${desc.unit}` : ''}
            </option>
          )
        })}
      </select>
      <button
        type="button"
        className="devp-step-btn"
        aria-label={`${desc.ui_name} — next menu entry`}
        disabled={idx === null || idx >= max}
        onClick={() => idx !== null && sendIndex(idx + 1)}
      >
        +
      </button>
    </>
  )
}

/** The right-aligned stored value + unit; double-click to type. */
function ContinuousValue({
  desc,
  num,
  missing,
  onSend,
  onFail,
}: {
  desc: ParamDescJson
  num: number
  missing: boolean
  onSend: ParamRowProps['onSend']
  onFail: ParamRowProps['onFail']
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const display = missing || Number.isNaN(num) ? '—' : String(num)

  const commitDraft = () => {
    const v = parseFloat(draft)
    if (Number.isNaN(v)) {
      onFail(desc.id, `${desc.ui_name}: “${draft}” is not a number`)
    } else if (v < desc.stored_min || v > desc.stored_max) {
      onFail(
        desc.id,
        `value ${v} out of range for ${desc.id} (stored ${desc.stored_min}..${desc.stored_max}` +
          (desc.unit ? ` ${desc.unit}` : '') +
          ')',
      )
    } else {
      onSend(desc.id, v, String(v), 0)
    }
    setEditing(false)
  }

  return (
    <>
      {desc.unit ? <span className="devp-unit">{desc.unit}</span> : null}
      {editing ? (
        <input
          className="devp-value-input"
          value={draft}
          autoFocus
          aria-label={`${desc.ui_name} — stored value`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDraft()
            else if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <input
          className="devp-value"
          value={display}
          readOnly
          title="double-click to type a stored value"
          aria-label={`${desc.ui_name} — stored value`}
          onDoubleClick={() => {
            setDraft(missing || Number.isNaN(num) ? '' : String(num))
            setEditing(true)
          }}
        />
      )}
    </>
  )
}

function ContinuousSlider({
  desc,
  num,
  onSend,
}: {
  desc: ParamDescJson
  num: number
  onSend: ParamRowProps['onSend']
}) {
  const step = useMemo(() => niceStep(desc), [desc])
  const decimals = decimalsOf(step)
  const value = Number.isNaN(num) ? desc.stored_min : num
  return (
    <input
      type="range"
      className="devp-slider"
      min={desc.stored_min}
      max={desc.stored_max}
      step={step}
      value={value}
      aria-label={desc.ui_name}
      onChange={(e) => {
        const v = parseFloat(e.target.value)
        onSend(desc.id, v, v.toFixed(decimals), 150)
      }}
    />
  )
}
