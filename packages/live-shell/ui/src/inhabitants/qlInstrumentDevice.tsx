// The QL instrument device face (L9) — the field/PCM owner docked as the
// quaternal-logic family's instrument device in the rack (WORLD-SHELL-DESIGN
// §18: "M1 — the field/PCM owner docks as an instrument device in the rack
// (the played torus/field as a device face with the proven aperture); the
// stage stays the instrument's visible body").
//
// The aperture is the proven one (NativeDeviceEditors.tsx:420-425):
// `{reading, disabled, apply, captureCurrent, renderControl, createCustody}`.
// `renderControl(path)` is the host's per-path control renderer; the face
// calls it for its named paths, exactly as FieldControl is composed. The
// reading is parsed against the owner's REAL shape (qlInstrumentReading.ts);
// a malformed or absent shape renders the HONEST REFUSING STATE — what would
// start the owner, verbatim from the launch contract — never a plausible
// substitute.
//
// The body renders at the instrument-card scale (the Technē detail row's
// instrument frame): named sections, hairline dividers, the meter grammar
// drawn (labelled hatched bars, each naming exactly what it reads). Meters
// measure SCHEDULING, never level: this lane leaves no sounding claim, and
// an analyser's place is named, not claimed.
//
// The offered writes are the session's own presentation-standing operations
// (set-muted, hold, recover) through a host-supplied transport sink. The
// performance act (strike) is NOT offered: performance input belongs to
// #281's packets. No transport in this host → controls render disabled with
// that named reason.

import {useMemo, useState, type ReactNode} from 'react'
import {
  QL_EMBEDDED_NATIVE_PLAYBACK, QL_IDENTITY_KEYS, QL_INSTRUMENT_PRESENTATION,
  QL_LAUNCH_CONTRACT, QL_SCENE_SAMPLE_RATE,
  parseQlInstrumentReading,
  type QlOwnerStanding,
} from './ql/qlInstrumentReading'
import {createQlSampleClockStratum} from '../timeline/qlSampleClock'
import {InhabitantCard, type CardLight} from './inhabitantCard.tsx'
import './qlInstrumentDevice.css'

/** A change this face may send — the session's presentation-standing
 * operations only. The performance act (strike) is deliberately absent. */
export type QlInstrumentChange =
  | {readonly operation: 'set-muted'; readonly muted: boolean}
  | {readonly operation: 'hold'; readonly reason: string}
  | {readonly operation: 'recover'; readonly reason: string}

/** Custody: an intended change retained until applied or discarded — the
 * Apply/Discard/Retry law, minimal and local to this face. The material is
 * given at the factory; retain/discard/free operate on it. */
export interface QlInstrumentCustody {
  readonly retain: () => void
  readonly discard: () => void
  readonly current: () => QlInstrumentChange | null
}

/** The proven aperture, bound to this face's reading and changes. */
export interface QlInstrumentDeviceProps {
  /** The owner's reading as the host received it — raw. The face parses; a
   * refused shape renders the refusing state with the fault named. */
  readonly reading: unknown
  readonly disabled?: boolean
  /** The host's authorised sink (the oi.native-expression/v1 channel's
   * session operations). Absent/undefined → writes disabled, reason shown. */
  readonly apply?: ((change: QlInstrumentChange) => Promise<void>) | null
  /** Capture the current acknowledged basis — the gesture's target. */
  readonly captureCurrent?: (() => unknown) | null
  /** The host's per-path control renderer; the face calls it with its named
   * paths ('muted' | 'hold' | 'recover'). Absent → the face's own controls. */
  readonly renderControl?: ((path: string) => ReactNode) | null
  /** Custody factory (the proven createCustody seam); a default local one
   * stands in when absent. */
  readonly createCustody?: ((aperture: string, material: QlInstrumentChange) => QlInstrumentCustody) | null
}

const STANDING_LABEL: Readonly<Record<QlOwnerStanding, string>> = Object.freeze({
  manual: 'manual — the owner stands but nothing follows',
  opening: 'opening — admission in flight',
  following: 'following — the driver schedules and presents',
  held: 'held — presentation stopped, native basis retained',
  unavailable: 'unavailable — the last lifetime ended',
})

/** The card light's reading, parsed once for the rack's header. No reading
 * or a refused one = off (the owner is not docked; nothing is illuminated). */
export function qlInstrumentLight(reading: unknown): CardLight {
  try {
    const value = parseQlInstrumentReading(reading)
    return value.available
      ? {state: 'on', title: 'The owner stands and this face reads it'}
      : {state: 'off', title: 'The last lifetime ended — explicit recovery required'}
  } catch {
    return {state: 'off', title: 'No reading stands — the owner is not docked; nothing is illuminated'}
  }
}

/** The standing chip the rack's header carries (label + the chip's data
 * state). A refused reading names itself "not docked". */
export function qlInstrumentStanding(reading: unknown): {label: string; title: string; state: string} {
  try {
    const value = parseQlInstrumentReading(reading)
    return {label: value.standing, title: STANDING_LABEL[value.standing], state: value.standing}
  } catch {
    return {label: 'not docked', title: 'No owner reading stands — the launch contract below names what would start it', state: 'refusing'}
  }
}

/** The instrument body: the sections the reading carries, at instrument-card
 * scale. Rendered inside the rack's card (the header belongs to the card). */
export function QlInstrumentBody({reading, disabled = false, apply = null, captureCurrent = null, renderControl, createCustody}: QlInstrumentDeviceProps) {
  const parsed = useMemo(() => {
    try {
      return {ok: true as const, value: parseQlInstrumentReading(reading)}
    } catch (error) {
      return {ok: false as const, fault: String(error instanceof Error ? error.message : error)}
    }
  }, [reading])

  const clock = useMemo(() => createQlSampleClockStratum(), [])

  if (!parsed.ok) {
    return (
      <div className="ql-instrument is-refusing" data-ql-instrument data-state="refusing">
        {reading !== null && <p className="ql-instrument-fault" role="alert">Refused reading: {parsed.fault}. A plausible owner state is never rendered.</p>}
        <LaunchContract/>
      </div>
    )
  }

  const value = parsed.value
  const audio = value.audio
  const writeAllowed = !disabled && typeof apply === 'function'

  return (
    <div className={`ql-instrument is-${value.standing}`} data-ql-instrument data-state={value.standing} data-available={value.available ? 'yes' : 'no'}>
      <p className="ql-instrument-standing-line" data-ql-standing-detail title="The owner's standing, named in full — the card header carries the word; this line carries its meaning">
        {STANDING_LABEL[value.standing]}
      </p>
      {value.reason && <p className="ql-instrument-reason" title={value.reason}>{value.reason}</p>}

      <section className="ql-instrument-section" aria-label="Identity tuple" data-ql-section="identity">
        <h4 className="ql-instrument-section-label">Identity</h4>
        <div className="ql-instrument-flds">
          {QL_IDENTITY_KEYS.map(key => (
            <span key={key} className="ql-instrument-fld" data-i={`${key}|the owner's identity tuple ref (native-audio.mjs IDENTITY)`}>
              <em>{key}</em>{value.identity[key]}
            </span>
          ))}
        </div>
      </section>

      <section className="ql-instrument-section" aria-label="Exact cursors" data-ql-section="cursors">
        <h4 className="ql-instrument-section-label">Cursors</h4>
        <div className="ql-instrument-flds">
          <span className="ql-instrument-fld" data-i="acknowledged.generation|the last acknowledged native generation (exact u64)">
            <em>gen</em>{value.acknowledged.generation}
          </span>
          <span className="ql-instrument-fld" data-i="acknowledged.samples_elapsed|the last acknowledged sample cursor, exact u64 @ 48 kHz">
            <em>samples</em>{value.acknowledged.samples_elapsed}
          </span>
          <span className="ql-instrument-fld" data-i="work-time|samples_elapsed through the declared mapping table (samples → seconds @ 48 kHz); a work-time readout, never a transport claim">
            <em>work-time</em>{(() => {const seconds = clock.samplesToSeconds(value.acknowledged.samples_elapsed); return seconds.ok ? `${seconds.value.toFixed(3)} s` : 'refused'})()}
          </span>
          <span className="ql-instrument-fld" data-i="presented|the last presented end-of-block cursor (targets actually applied)">
            <em>presented</em>{value.presented.generation}/{value.presented.samples_elapsed}
          </span>
        </div>
      </section>

      <section className="ql-instrument-section" aria-label="Scheduling meters (not level meters)" data-ql-section="meters">
        <h4 className="ql-instrument-section-label">Scheduling meters</h4>
        <div className="ql-instrument-meters">
          <div className="ql-instrument-meter" data-i="scheduled blocks|blocks the audio binding scheduled ahead of the device clock. A scheduling meter — never a level or loudness meter, and never proof of sound.">
            <em>scheduled</em>
            <span className="ql-instrument-bar"><i style={{width: `${Math.min(1, (audio?.scheduled_blocks ?? 0) / 32) * 100}%`}}/></span>
            <b>{audio?.scheduled_blocks ?? 0}</b>
          </div>
          <div className="ql-instrument-meter" data-i="discarded blocks|blocks dropped by a hold or epoch change. Grows on interruption; recovery rebases explicitly.">
            <em>discarded</em>
            <span className="ql-instrument-bar is-discarded"><i style={{width: `${Math.min(1, (audio?.discarded_blocks ?? 0) / 32) * 100}%`}}/></span>
            <b>{audio?.discarded_blocks ?? 0}</b>
          </div>
          <div className="ql-instrument-meter" data-i="queued presentation targets|bounded target queue depth (instrument-session.mjs maxBlocks ceiling)">
            <em>queued</em>
            <span className="ql-instrument-bar is-queued"><i style={{width: `${Math.min(1, value.queued_blocks / 16) * 100}%`}}/></span>
            <b>{value.queued_blocks}</b>
          </div>
        </div>
        <p className="ql-instrument-meter-law">Scheduling meters only. No level, loudness or analyser surface is claimed: measuring audio would claim sound, and no sounding claim leaves this lane.</p>
      </section>

      <section className="ql-instrument-section" aria-label="Playback policy and clock stratum" data-ql-section="policy">
        <h4 className="ql-instrument-section-label">Policy</h4>
        <div className="ql-instrument-flds">
          <span className="ql-instrument-fld" data-i="device rate|the composed owner's device rate (QL scene_field.rs default_field)">
            <em>rate</em>{QL_SCENE_SAMPLE_RATE} Hz
          </span>
          <span className="ql-instrument-fld" data-i="block|the embedded playback policy's block frames (controller.ts EMBEDDED_NATIVE_PLAYBACK)">
            <em>block</em>{QL_EMBEDDED_NATIVE_PLAYBACK.blockFrames}
          </span>
          <span className="ql-instrument-fld" data-i="lead/lookahead|the embedded policy's scheduling lead and lookahead, seconds">
            <em>lead/look</em>{QL_EMBEDDED_NATIVE_PLAYBACK.leadSeconds}/{QL_EMBEDDED_NATIVE_PLAYBACK.lookaheadSeconds} s
          </span>
          <span className="ql-instrument-fld" data-i="presentation|the M1 torus presentation scale, annotated as presentation — not a source value">
            <em>scale</em>{QL_INSTRUMENT_PRESENTATION.units_per_metre} u/m
          </span>
          <span className="ql-instrument-fld" data-i="mapping table|the declared sample-clock mapping table (one table, no silent conversion)">
            <em>mappings</em>{clock.mappings.length} declared
          </span>
        </div>
      </section>

      {audio && (
        <section className="ql-instrument-section" aria-label="Audio receipt" data-ql-section="audio">
          <h4 className="ql-instrument-section-label">Audio receipt</h4>
          <div className="ql-instrument-flds">
            <span className="ql-instrument-fld" data-i="audio status|the native audio receipt's own status word">
              <em>audio</em>{audio.status}
            </span>
            <span className="ql-instrument-fld" data-i="device epoch|the receiver's device epoch (rebase/realign counter)">
              <em>epoch</em>{audio.device_epoch}
            </span>
            <span className="ql-instrument-fld" data-i="muted|presentation mute — the native owner never resets">
              <em>muted</em>{audio.muted ? 'yes' : 'no'}
            </span>
          </div>
          <p className="ql-instrument-standing-line" title="The owner's own honesty line, carried verbatim">{audio.standing}</p>
        </section>
      )}

      <section className="ql-instrument-section" aria-label="Presentation writes" data-ql-section="writes">
        <h4 className="ql-instrument-section-label">Writes</h4>
        <p className="ql-instrument-writes-note">
          Writes are the session's presentation-standing operations through the host's authorised channel. The performance act
          (strike) is not offered here: performance input belongs to #281's packets. The stage stays the instrument's visible body.
        </p>
        {!writeAllowed && <p className="ql-instrument-writes-refusal" role="status">No authorised oi.native-expression/v1 channel in this host — writes disabled, readings live.</p>}
        <div className="ql-instrument-write-row">
          {typeof renderControl === 'function'
            ? <>{renderControl('muted')}{renderControl('hold')}{renderControl('recover')}</>
            : <>{(['muted', 'hold', 'recover'] as const).map(path => (
                <QlInstrumentControl key={path} path={path} reading={reading} disabled={disabled}
                  apply={apply} captureCurrent={captureCurrent} createCustody={createCustody}/>
              ))}</>}
        </div>
      </section>
    </div>
  )
}

/** The standalone card: the instrument as its own device card (a host that
 * composes the face directly). Inside the inhabitant rack the body is
 * rendered inside the family card instead. */
export function QlInstrumentDevice(props: QlInstrumentDeviceProps) {
  const light = qlInstrumentLight(props.reading)
  const standing = qlInstrumentStanding(props.reading)
  return (
    <InhabitantCard
      faceId="ql-instrument"
      kind="instrument"
      light={light}
      mark="expr"
      title="QL field / PCM owner"
      owner={`instrument · ${standing.label}`}
      status={<span className="inhabitant-standing-chip" data-ql-standing={standing.state} title={standing.title}>{standing.label}</span>}
      note={props.reading === null ? undefined : undefined}
      width="min(100%, 920px)"
    >
      <QlInstrumentBody {...props}/>
    </InhabitantCard>
  )
}

/** The face's control for one named path — exported for a host to compose
 * through renderControl={path => <QlInstrumentControl path={path} …/>}, the
 * FieldControl pattern. The control keeps its own custody: an intended
 * change is retained, applied once, or discarded; a refusal retains the
 * draft and shows the refusal. */
export function QlInstrumentControl({path, reading, disabled = false, apply, captureCurrent, createCustody}: {
  path: 'muted' | 'hold' | 'recover'
  reading: unknown
  disabled?: boolean
  apply?: ((change: QlInstrumentChange) => Promise<void>) | null
  captureCurrent?: (() => unknown) | null
  createCustody?: ((aperture: string, material: QlInstrumentChange) => QlInstrumentCustody) | null
}) {
  const parsed = useMemo(() => {
    try {
      return {ok: true as const, value: parseQlInstrumentReading(reading)}
    } catch (error) {
      return {ok: false as const, fault: String(error instanceof Error ? error.message : error)}
    }
  }, [reading])
  const [draft, setDraft] = useState<QlInstrumentChange | null>(null)
  const [outcome, setOutcome] = useState<string | null>(null)
  const writeAllowed = !disabled && typeof apply === 'function'

  if (!parsed.ok) return <span className="ql-instrument-fld" title={parsed.fault}>refused</span>
  const value = parsed.value

  const retain = (change: QlInstrumentChange) => {
    createCustody?.('ql-instrument', change)?.retain()
    setDraft(change)
    setOutcome(null)
  }
  const discard = () => {
    if (draft) createCustody?.('ql-instrument', draft)?.discard()
    setDraft(null)
  }
  const submit = async () => {
    if (!draft || !apply) return
    const basis = typeof captureCurrent === 'function' ? captureCurrent() : null
    try {
      await apply(draft)
      setOutcome(`applied at captured basis (${basis ? 'basis captured' : 'no basis captured'})`)
      setDraft(null)
    } catch (error) {
      // Refusal keeps the draft: the intended change survives until the
      // result is understood (the write-standing law).
      setOutcome(`refused: ${String(error instanceof Error ? error.message : error)} — draft retained`)
    }
  }

  const label = path === 'muted'
    ? (value.audio?.muted ? 'Unmute' : 'Mute')
    : path === 'hold' ? 'Hold' : 'Recover'
  const change: QlInstrumentChange = path === 'muted'
    ? {operation: 'set-muted', muted: !(value.audio?.muted ?? true)}
    : path === 'hold' ? {operation: 'hold', reason: 'control hold'} : {operation: 'recover', reason: 'control recovery'}

  return (
    <span className="ql-instrument-control" data-ql-control={path}>
      <button type="button" className="ql-instrument-btn" data-action={`retain-${path}`} disabled={!writeAllowed} onClick={() => retain(change)}>{label}</button>
      {draft ? (
        <span className="ql-instrument-draft" data-draft>
          retained
          <button type="button" className="ql-instrument-btn is-primary" data-action="apply" disabled={!writeAllowed} onClick={() => void submit()}>Apply</button>
          <button type="button" className="ql-instrument-btn" data-action="discard" onClick={discard}>Discard</button>
        </span>
      ) : null}
      {outcome && <span className="ql-instrument-outcome" role="status">{outcome}</span>}
    </span>
  )
}

function LaunchContract() {
  return (
    <section className="ql-instrument-launch" aria-label="What would start the owner">
      <p className="ql-instrument-launch-owner">{QL_LAUNCH_CONTRACT.owner}</p>
      <p><em>Launcher:</em> {QL_LAUNCH_CONTRACT.launcher}</p>
      <ul>{QL_LAUNCH_CONTRACT.bindings.map(binding => <li key={binding}>{binding}</li>)}</ul>
      <p><em>Compose:</em> <code>{QL_LAUNCH_CONTRACT.compose}</code></p>
      <p><em>Channel:</em> {QL_LAUNCH_CONTRACT.channel}</p>
      <div className="ql-instrument-launch-gaps">
        <em>The Tauri gate still lacks</em>
        <ul>{QL_LAUNCH_CONTRACT.shellStillLacks.map(gap => <li key={gap}>{gap}</li>)}</ul>
      </div>
    </section>
  )
}
