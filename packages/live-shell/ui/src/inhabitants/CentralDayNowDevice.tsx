import {useCallback, useEffect, useState} from 'react'

/** The day/now device — central family, face `day-now` (the L7 extension's
 * declared face; ticket L7 commission 3).
 *
 * The civil stratum as craft, beside the day-die and flow document devices:
 * - the civil field, read from the kernel's temporal read
 *   (`op temporal_events_read`) — the same owner the L4 spine reads; the
 *   policy row is the owner's civil-time contract carried verbatim;
 * - the day/now operations (close, rollover, archive recovery) as DECLARED
 *   temporal controls bound to their native actions — rendered, named,
 *   never fired from a device or a lane;
 * - when the selected material is a day, the device reads the day record
 *   through the owner's file route (`readFile` — CAS-revised) and walks its
 *   recovery end-to-end read-only: the record, its returns at close, its
 *   carry-forward refs, every step naming its boundary op.
 *
 * The save-router states come from the document device model (the same
 * named outcomes the day-die discloses); this device performs no writes, so
 * its strip shows the honest absent state until a document device acts. */

import {readFile} from '../../../../../desktop/cradle/src/files/client'
import type {CentralLocation, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {
  CIVIL_TEMPORAL_CONTROLS,
  casShort,
  parseDayRecord,
  subjectDayRef,
  type CivilFieldReading,
  type CentralSubjectBasis,
  type DayWalkReading,
} from './centralDayNowModel'
import './inhabitantDevices.css'

export interface CentralDayNowDeviceProps {
  readonly transport: KernelTransportStatus
  /** The selected day subject (the day record's Central path), when one is. */
  readonly dayPath?: string | null
  /** The ground root the day path is Central-relative to. */
  readonly groundRoot?: string
  readonly expanded?: boolean
}

interface CivilState {
  readonly field: CivilFieldReading | null
  readonly pending: boolean
}

interface WalkState {
  readonly walk: DayWalkReading | null
  readonly basis: CentralSubjectBasis | null
  readonly pending: boolean
  readonly fault: string | null
}

/** The day record's Central location for a civil date. */
export function dayLocation(groundRoot: string, dayPath: string): CentralLocation {
  return {
    schema: 'central.path-ref/v1',
    ref: `central:path:${groundRoot}:${dayPath}`,
    root: groundRoot,
    path: dayPath,
  }
}

export function CentralDayNowDevice({transport, dayPath, groundRoot = '/Users/admin/Central', expanded = false}: CentralDayNowDeviceProps) {
  const [civil, setCivil] = useState<CivilState>({field: null, pending: false})
  const [walk, setWalk] = useState<WalkState>({walk: null, basis: null, pending: false, fault: null})

  const readCivilField = useCallback(async () => {
    setCivil({field: null, pending: true})
    const at = new Date().toISOString()
    // The reading's own day scale. When a day stands, the window is that
    // civil day's UTC bounds — the same between-window grammar the Timeline
    // projection's poller reads (the owner's `day` window answers empty for
    // dated streams in the live boot; the between window is what answers,
    // so that is what the device binds, named exactly in the strip). When no
    // day stands, the whole field. Either way the OWNER scopes it; the
    // device invents no date.
    const dayKey = dayPath ? subjectDayRef(dayPath) : null
    const query = dayKey
      ? {window: {window: 'between' as const,
          from_unix_ms: Date.UTC(Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)) - 1, Number(dayKey.slice(8, 10))),
          to_unix_ms: Date.UTC(Number(dayKey.slice(0, 4)), Number(dayKey.slice(5, 7)) - 1, Number(dayKey.slice(8, 10)) + 1)}}
      // No day stands: the same bounded civil week the Timeline projection's
      // poller reads (the wall clock bounds the query window only — the same
      // law `useWorldTemporalReading` documents). Never a whole-stream walk.
      : (() => {
        const bound = new Date()
        return {window: {window: 'between' as const,
          from_unix_ms: Date.UTC(bound.getUTCFullYear(), bound.getUTCMonth(), bound.getUTCDate() - 7),
          to_unix_ms: Date.UTC(bound.getUTCFullYear(), bound.getUTCMonth(), bound.getUTCDate() + 1)}
        }
      })()
    const result = await kernelOp(transport, {op: 'temporal_events_read', query})
    const outcome = result.outcome as {result?: string; document?: {field?: Record<string, unknown>; observed_civil_instant?: string; window?: {day_ref?: string}}} | undefined
    if (result.error || outcome?.result !== 'temporal_events_reading') {
      setCivil({
        field: {dayRef: null, policy: {}, observedCivilInstant: null, boundaryOp: 'op temporal_events_read', at, refusal: result.error ?? 'the temporal reading did not answer'},
        pending: false,
      })
      return
    }
    const document = outcome.document ?? {}
    setCivil({
      field: {
        dayRef: dayKey ?? document.window?.day_ref ?? null,
        policy: document.field ?? {},
        observedCivilInstant: document.observed_civil_instant ?? null,
        boundaryOp: dayKey
          ? `op temporal_events_read (between ${dayKey}T00:00Z → +1d)`
          : 'op temporal_events_read (between civil week −7d → +1d)',
        at,
        refusal: null,
      },
      pending: false,
    })
  }, [dayPath, transport])

  const readDay = useCallback(async (path: string) => {
    setWalk({walk: null, basis: null, pending: true, fault: null})
    const at = new Date().toISOString()
    try {
      const location = dayLocation(groundRoot, path)
      const reading = await readFile(transport, location)
      const basis: CentralSubjectBasis = {
        ref: location.ref,
        revision: reading.revision,
        byteLen: reading.byte_len,
        project: reading.project?.name ?? null,
        dayRef: subjectDayRef(path),
        timePolicyRevision: null,
        saveOutcome: null,
        boundaryOp: 'op file_read (central.path-ref/v1)',
        at,
      }
      const parsed = parseDayRecord(reading.content)
      setWalk({
        walk: {
          day: subjectDayRef(path) ?? path,
          basis,
          steps: [
            {at, label: 'day record read', boundaryOp: basis.boundaryOp, detail: `revision ${reading.revision} · ${reading.byte_len} B`},
          ],
          carryForward: parsed.carryForward,
          returns: parsed.returns,
          sources: [{boundaryOp: basis.boundaryOp, channel: 'kernel-op', at}],
        },
        basis,
        pending: false,
        fault: null,
      })
    } catch (error) {
      setWalk({
        walk: null,
        basis: null,
        pending: false,
        fault: String(error),
      })
    }
  }, [groundRoot, transport])

  useEffect(() => {
    void readCivilField()
  }, [readCivilField])

  useEffect(() => {
    if (dayPath) void readDay(dayPath)
  }, [dayPath, readDay])

  const policy = civil.field?.policy ?? {}

  return (
    <article className="inhabitant-device" data-central-device="day-now" data-day={walk.walk?.day ?? ''}>
      <header className="inhabitant-device-head">
        <span className={`inhabitant-light${civil.field && !civil.field.refusal ? ' is-admitted' : ''}`} title={civil.field?.refusal ? 'The civil read was refused — see the reading' : 'The civil field stands on the kernel temporal read'} />
        <strong>Day / NOW</strong>
        <span className="inhabitant-device-sub">civil stratum · {civil.field?.dayRef ?? civil.field?.refusal ? (civil.field.refusal ? 'refused' : civil.field.dayRef) : 'not read'}</span>
        <span className="inhabitant-device-save" role="status" data-daynow-standing={civil.pending || walk.pending ? 'reading' : 'read'}>
          {civil.pending || walk.pending ? 'reading the owners…' : walk.basis ? `day at ${casShort(walk.basis.revision)}` : 'no day selected'}
        </span>
      </header>
      <div className="inhabitant-device-actions">
        <button type="button" data-action="read-civil" disabled={civil.pending} onClick={() => void readCivilField()}>Re-read the civil field</button>
      </div>
      {civil.field && (
        <div className="inhabitant-device-body" data-civil-field data-refused={civil.field.refusal ? 'true' : 'false'}>
          {civil.field.refusal
            ? <p className="inhabitant-reading-refusal" data-refusal-text>{civil.field.boundaryOp}: {civil.field.refusal}</p>
            : <ul className="inhabitant-reading-list" data-civil-policy>
                <li className="inhabitant-reading"><span className="inhabitant-reading-op">timezone</span><span className="inhabitant-reading-standing">{String(policy.timezone ?? 'unspecified')}</span></li>
                <li className="inhabitant-reading"><span className="inhabitant-reading-op">day boundary</span><span className="inhabitant-reading-standing">{String(policy.day_boundary_minutes ?? 'unspecified')} min past midnight</span></li>
                <li className="inhabitant-reading"><span className="inhabitant-reading-op">policy revision</span><span className="inhabitant-reading-standing" title={String(policy.policy_revision ?? '')}>{casShort(String(policy.policy_revision ?? ''))}</span></li>
                <li className="inhabitant-reading"><span className="inhabitant-reading-op">read</span><span className="inhabitant-reading-standing" title={civil.field.at}>{civil.field.boundaryOp} · {civil.field.observedCivilInstant ?? 'no civil instant disclosed'}</span></li>
              </ul>}
        </div>
      )}
      {expanded && (
        <div className="inhabitant-device-body" data-daynow-controls>
          <p className="inhabitant-device-note">Declared temporal controls — bound to their native actions, fired by nobody here:</p>
          <ul className="inhabitant-reading-list" data-civil-controls>
            {CIVIL_TEMPORAL_CONTROLS.map(control => (
              <li key={control.id} className="inhabitant-reading" data-civil-control={control.id} data-admission={control.admission}>
                <span className="inhabitant-reading-op">{control.label} → {control.nativeAction.split(' (')[0]}</span>
                <span className="inhabitant-reading-standing">{control.note}</span>
                <span className="inhabitant-reading-tender" title={`authority: ${control.authority} · receipt: ${control.receiptShape}`}>
                  declared · authority: {control.authority.split('(')[0].trim()} · receipt: {control.receiptShape.split('+')[0].trim()}
                </span>
              </li>
            ))}
          </ul>
          <div className="inhabitant-device-actions">
            {CIVIL_TEMPORAL_CONTROLS.map(control => (
              <button key={control.id} type="button" className="inhabitant-tender" data-tender={control.id} disabled
                title={`${control.nativeAction} — ${control.authority}. ${control.note}`}>
                {control.label} (declared)
              </button>
            ))}
          </div>
        </div>
      )}
      {expanded && dayPath && (
        <div className="inhabitant-device-body" data-day-walk data-walk-day={walk.walk?.day ?? ''}>
          {walk.fault && <p className="inhabitant-device-fault" role="alert" data-walk-fault>day record read refused: {walk.fault}</p>}
          {walk.pending && <p role="status">Reading the day record…</p>}
          {walk.walk && walk.basis && (
            <div data-walk-content>
              <p className="inhabitant-device-note" data-walk-basis>
                Basis · {walk.basis.ref} · <span className="mono" title={walk.basis.revision}>{casShort(walk.basis.revision)}</span>
                {walk.basis.byteLen !== null ? ` · ${walk.basis.byteLen} B` : ''} · via {walk.basis.boundaryOp}
              </p>
              <ul className="inhabitant-reading-list" data-walk-steps>
                {walk.walk.steps.map((step, index) => (
                  <li key={index} className="inhabitant-reading" data-walk-step={step.label}>
                    <span className="inhabitant-reading-op">{step.boundaryOp}</span>
                    <span className="inhabitant-reading-standing">{step.label} — {step.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="inhabitant-device-note">Returns at close: {walk.walk.returns.length} · carry-forward refs: {walk.walk.carryForward.length}</p>
              <ul className="inhabitant-reading-list" data-walk-returns>
                {walk.walk.returns.slice(0, 6).map((entry, index) => (
                  <li key={index} className="inhabitant-reading" data-walk-return data-return-status={entry.status}>
                    <span className="inhabitant-reading-op">{entry.kind} · {entry.status}</span>
                    <span className="inhabitant-reading-standing">{entry.subject}{entry.actor ? ` — ${entry.actor}` : ''}</span>
                  </li>
                ))}
                {walk.walk.returns.length > 6 && <li className="inhabitant-reading"><span className="inhabitant-reading-standing">… {walk.walk.returns.length - 6} more in the record (the record stays the authority)</span></li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
