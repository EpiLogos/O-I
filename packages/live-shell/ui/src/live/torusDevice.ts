// The M1 torus as a device of the runtime (FOUNDATION F5, the reference device; lock §0.2.3: "the compact rack widget
// (mini torus + ≤4 macros), the expanded instrument in the browser pool, the full torus in the centre pane"). Its four
// macros are the owner's determinants, each an enumerated row whose choices are the owner's own; a change is the owner's
// own instrument edit through the hosted stage channel (torusInstrument.ts), and a refusal comes back in the owner's words.
// The whole view adds the owner's other parameters — sound, level, cadence and scale, as the native field panel groups them
// (ported from live/LiveInstrumentSection.tsx:74-105 through inhabitants/ql/devices/qlDevices.ts qlPresentation, the rows the QL
// field/PCM face carries) — so the pool holds every parameter the owner exposes (DLW §21.2 Whole).
// Its light reads the owner's standing: on while the instrument follows or is held, off otherwise, dark with no reading.
// O-I 850: the Torus plays as QL designs it. Its Pulse, Shape, Tuning and Polyphony are QL's M1′ session (QL-MEF m1_prime.rs; the
// host's torus-state and torus-set), which the frame announces as parameters.torus and takes as the stage channel's `torus` edit; the
// compact four are Rate, Fundamental, Carrier and Damping (manual §21.2 Compact), and the determinants stand in Mode and tuning.
import type {DeviceDeclaration, SdkParamRow} from '../inhabitants/sdk/define'
import type {DeviceInstance, ParamValue} from '../frame/devices/deviceRuntime'
import type {DesignBinding, Standing, Value, ValueChange} from '../frame/devices/designed'
import {qlInstrumentEdit, qlPresentation, QL_PRESENTATION_KEYS, QL_WRITE_PATH} from '../inhabitants/ql/devices/qlDevices'
import {commitLiveInstrumentEdit, liveInstrumentWritable, liveTorusMacroRows, LIVE_TORUS_TOPOLOGY, type LiveTorusState,
  torusSessionOf, TORUS_RATE, TORUS_FUNDAMENTAL, TORUS_POLYPHONY, TORUS_TEMPO, TORUS_TUNINGS, TORUS_SHAPES, TORUS_TUNING_WORD, TORUS_SHAPE_WORD, TORUS_BAND_WORD, TORUS_NOTE_LENGTHS, torusSessionEdit, type TorusSession, type TorusSettingsEdit} from './torusInstrument'
import type {FrameInstrumentCondition, FrameStageReading, InstrumentEdit} from '@epilogos/expressions-boundary'
import {hostedChrome} from '../projections/expressionsPaneHost'
import {qlRackState, rackPage, type QlRackState} from '../inhabitants/ql/devices/qlRack'
import {handsFor, heldFor, hold as holdDesign} from '../techne/devices/designDevices'
import type {StageRun} from '../components/expressions/studio/StudioStage'
import {bodyTable, coordinateNames, NO_CONDITION, tattvaBody, tattvaKeys, type BodySource, type BodyTable, type CoordinateName} from '../inhabitants/ql/devices/qlCoordinateName'
import {refusalWords} from '../../../../../desktop/cradle/src/shared/Refusal.tsx'
import type {ModeInForce} from './modes'

// The session's law (its ranges and its `torus` edit) is torusInstrument.ts's, so the MIDI map reaches it without this device's faces.
export {torusSessionOf, TORUS_RATE, TORUS_FUNDAMENTAL, TORUS_POLYPHONY, TORUS_TEMPO, TORUS_TUNINGS, TORUS_SHAPES, TORUS_TUNING_WORD, TORUS_SHAPE_WORD, TORUS_BAND_WORD, TORUS_NOTE_LENGTHS, torusSessionEdit, type TorusSession, type TorusSettingsEdit}

export const TORUS_DEVICE_ID = 'live:m1-torus'

/** The torus's family and face are the catalogue's (`quaternal-logic:torus`, inhabitants/catalogue/panels/torus.tsx): the M1 torus is
 * Quaternal Logic's instrument, and Live plays it (DLW §21.2). designKey(family, face.id) is the design's id, so the runtime draws
 * the design on the binding this module writes. */
export const TORUS_FAMILY = 'quaternal-logic'

export const TORUS_DEVICE: DeviceDeclaration = {
  id: 'torus', title: 'M1 torus', icon: 'live', liveSemantic: 'device-instrument',
  invariant: {generates: QL_WRITE_PATH}, note: 'The one instrument: the bi-phasal oscillator on the torus, played from the keyboard.',
} as DeviceDeclaration

const WRITE_PATH = QL_WRITE_PATH

/** The torus as the runtime draws it, over the owner's current reading. The compact four are the manual's macros (§21.2 Compact): Rate,
 * Fundamental and Carrier, QL's M1′ session, and Damping, the body's Q. The determinants follow in Mode and tuning, then Shape, Tuning and
 * Polyphony, then the owner's presentation parameters. */
export function torusDevice(state: LiveTorusState | null): DeviceInstance {
  const macros = liveTorusMacroRows(state)
  const session = torusSessionOf(state)
  const writable = liveInstrumentWritable(state)
  const at = (key: string, title: string, type: string, group: string, rest: Partial<SdkParamRow>, why: string | null = null): SdkParamRow => ({
    family: 'live', deviceInstance: TORUS_DEVICE_ID, key, title, type, group, ...rest,
    // An instrument that takes no edits says so first; a following one names the owner op a row still waits on.
    ...(writable && why === null ? {writePath: WRITE_PATH} : {disclosure: writable ? why : NOT_WRITABLE}),
  }) as SdkParamRow
  const noSession = state?.ok && !session ? `${NO_SESSION}.` : null
  const rows: SdkParamRow[] = [
    at('rate', 'Rate', 'number', 'Pulse', {compact: true, range: {min: TORUS_RATE.min, max: TORUS_RATE.max, unit: 'steps/s'}}, noSession),
    at('fundamental', 'Fundamental', 'number', 'Pulse', {compact: true, range: {min: TORUS_FUNDAMENTAL.min, max: TORUS_FUNDAMENTAL.max, unit: 'Hz'}}, noSession),
    at('carrier', 'Carrier', 'number', 'Pulse', {compact: true, range: {min: 0, max: 100, unit: '%'}}, noSession),
    at('damping', 'Damping', 'number', 'Body', {compact: true, range: {min: TORUS_Q.min, max: TORUS_Q.max, unit: 'Q'}}),
  ]
  rows.push(...macros.map(row => at(row.macro.id, row.macro.label, 'enumerated', 'Mode and tuning', {values: row.options.map(option => option.label)})))
  rows.push(
    at('tuning', 'Tuning', 'enumerated', 'Mode and tuning', {values: TORUS_TUNINGS.map(tuning => TORUS_TUNING_WORD[tuning])}, noSession),
    at('shape', 'Shape', 'enumerated', 'Shape', {values: TORUS_SHAPES.map(shape => TORUS_SHAPE_WORD[shape])}, noSession),
    at('polyphony', 'Polyphony', 'number', 'Notes and output', {range: {min: TORUS_POLYPHONY.min, max: TORUS_POLYPHONY.max, unit: 'notes'}}, noSession),
  )
  // The owner's other parameters, after the session's: never compact.
  const presentation = qlPresentation('live', TORUS_DEVICE_ID, state, false)
  rows.push(...presentation.rows)
  const values: Record<string, ParamValue> = {...presentation.values}
  for (const row of macros) {
    const option = row.options.find(choice => choice.value === row.selected)
    if (option) values[row.macro.id] = option.label
  }
  if (session) {
    const read = torusSessionValues(session)
    for (const key of ['rate', 'fundamental', 'carrier', 'polyphony'] as const) if (typeof read[key] === 'number') values[key] = read[key] as number
    values.tuning = TORUS_TUNING_WORD[session.settings.tuning]
    values.shape = TORUS_SHAPE_WORD[session.settings.shape]
  }
  if (state?.ok) values.enabled = state.value.standing === 'following' || state.value.standing === 'held'
  const word = <T extends string>(words: Readonly<Record<T, string>>, label: ParamValue): T | undefined => (Object.keys(words) as T[]).find(key => words[key] === label)
  return {
    id: TORUS_DEVICE_ID, family: TORUS_FAMILY, face: TORUS_DEVICE, rows, values, enabledKey: state?.ok ? 'enabled' : undefined,
    submit: async changes => {
      for (const change of changes) {
        const edit = QL_PRESENTATION_KEYS.includes(change.key) ? qlInstrumentEdit(change.key, change.value)
          : change.key === 'damping' ? {kind: 'damping' as const, q_factor: dampingQ(change.value)}
          : TORUS_SESSION_KEYS.has(change.key) ? (() => {
            if (!session) throw new Error(`${NO_SESSION}.`)
            const value = change.key === 'tuning' ? word(TORUS_TUNING_WORD, change.value) : change.key === 'shape' ? word(TORUS_SHAPE_WORD, change.value) : change.value
            return {kind: 'torus' as const, edit: torusSessionEdit(session, {key: change.key, value: value as Value})}
          })() : (() => {
          const row = macros.find(item => item.macro.id === change.key)
          const option = row?.options.find(choice => choice.label === change.value)
          if (!row || !option) throw Error(`${change.key}: not one of the owner's choices`)
          return row.edit(option.value)
        })()
        const result = await commitLiveInstrumentEdit(edit)
        if (!result.ok) throw Error(result.error)
      }
    },
  }
}

// ── the Torus design's binding ───────────────────────────────────────────────
// The catalogue's Torus (inhabitants/catalogue/panels/torus.tsx, `quaternal-logic:torus`) drawn on the owner's readings and writes
// (frame/devices/designed.ts DesignBinding; the pattern of central/devices/dayBinding.ts). Owners write, faces read: a design key is
// given a value only where the owner reports one, and a change only where the owner takes one (manual §16.12, §8.1). The owner is the
// native field in the hosted Expressions frame; what it announces is its standing, its four determinants and its presentation
// parameters (packages/expressions-boundary/src/protocol.ts readHostedDeterminants, readHostedParameters), and what it takes is the
// stage channel's instrument edits (desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts InstrumentEdit).

/** The design's id. */
export const TORUS_DESIGN_ID = 'quaternal-logic:torus'

/** The owner's determinants by the value key the binding gives them — the macro row's own key (torusInstrument.ts LIVE_TORUS_MACROS),
 * so the generic plate that stands in for a view reads them too. The design draws them as its compact four and its Determinants
 * (catalogue/panels/torus.tsx `determinants`), by the labels of the owner's choices; a design key that is a row key is wrapped as that
 * row is on the chain (MIDI map, DeviceView.tsx useHosting). */
export const TORUS_DETERMINANT_KEYS: Readonly<Record<string, string>> = {'lens': 'lens', 'context-frame': 'context-frame', 'harmonic-basis': 'harmonic-basis', 'm3-transcription': 'm3-transcription'}

/** The Torus's Damping range: a Q factor (manual §21.2, "Damping | Q factor 0.1 to 40"; stageCommands.ts STAGE_INSTRUMENT_Q). */
export const TORUS_Q = {min: 0.1, max: 40} as const
/** Strike's range on the page, in per cent of a key's velocity; the owner's session holds it as a share 0..1 (QL m1_prime.rs Settings.strike). */
export const TORUS_STRIKE = {min: 0, max: 100} as const
/** An owner whose M1′ session predates Strike (QL torus-state before O-I 854) states none, so no share of velocity reaches it. */
const NO_STRIKE_SESSION = 'The owner\'s Torus session states no Strike: QL\'s torus-state reports no share of velocity for the keys to excite the body by'

const NO_FIELD_PARAMETER = 'the native field announces only its lens, context frame, harmonic basis, M3 transcription, the Torus\'s M1′ session, sound, level, cadence and scale, and takes only those and the body\'s Damping through the stage channel (stageCommands.ts InstrumentEdit)'

/** The Stage page (manual §21.2): the hosted frame's native field holds the procedural stage and announces the disclosure it last read
 * (stageReading.ts, HostedAppState.instrumentStage): each owned slot's owner and revision, each procedure bound to the flow, the
 * procedures the frame holds (its Studio's example, stageReading.ts STUDIO_PROCEDURE: no owner lists the person's own) and the last
 * act's standing. The four acts are the stage's own operations, sent through the frame's stage channel (stageCommands.ts
 * 'procedural-stage') to the native field's own stage operations and on through the kernel's native_expression exchange (native_expression.rs
 * EXCHANGE_OPERATIONS admits all five): Evaluate, Bind (with the budget you hold), Unbind and Retire, each with the procedure's ref, and
 * the stage read back after. The procedure you choose and the budget are the view's own. */
const NO_STAGE_READ = 'The native field has disclosed no stage yet: it reads its stage when asked (the Studio\'s Procedural stage · Read stage state), and announces what it last read'
const NO_STAGE_FRAME = 'No Expressions application is mounted, so no stage act reaches the native field: open the Expressions pane.'
const NO_LAST = 'No stage act has run since the stage was read: the last receipt is the next act\'s.'
/** The stage keys and why each has no reading or write here, before the field discloses its stage. */
const STAGE_ABSENT: Readonly<Record<string, string>> = {
  'stage.slots': `${NO_STAGE_READ}.`, 'stage.bindings': `${NO_STAGE_READ}.`, 'stage.procedures': `${NO_STAGE_READ}.`,
  'stage.last': `${NO_STAGE_READ}.`, 'stage.why': `${NO_STAGE_READ}.`,
  'stage.evaluate': `Evaluate: ${NO_STAGE_READ}.`, 'stage.bind': `Bind: ${NO_STAGE_READ}.`, 'stage.unbind': `Unbind: ${NO_STAGE_READ}.`, 'stage.retire': `Retire: ${NO_STAGE_READ}.`,
}
/** The stage's four acts, each the stage's own operation (stageCommands.ts STAGE_PROCEDURAL_ACTIONS). */
export const TORUS_STAGE_ACTS: Readonly<Record<string, 'evaluate' | 'bind' | 'unbind' | 'retire'>> = {'stage.evaluate': 'evaluate', 'stage.bind': 'bind', 'stage.unbind': 'unbind', 'stage.retire': 'retire'}
/** The view's own: the procedure you choose and a binding's budget (DesignBinding.local, held in the shell). */
export const TORUS_STAGE_LOCAL = ['stage.procedure', 'stage.budget'] as const
/** The rack face's own (DLW build ruling, 4 November: macros each with its range, and variations): its macros, the macro you choose to set,
 * and its variations (DesignBinding.local, held in the shell until Keep rack keeps them in the Scene). */
export const TORUS_RACK_LOCAL = ['macros', 'macro', 'variations'] as const
const RACK_CHAIN_READ = 'A reading: the effects on the Torus\'s chain, in the order they sound, each with the settings the owner keeps. Keep rack keeps them.'
const RACK_CHAIN_NONE = 'The owner reports no effects on the Torus\'s chain, so a rack has no chain to keep.'
/** The Torus's chain as a rack keeps it (manual §21.2: "The Torus with its note devices and effects"): the effects the owner keeps after
 * the Torus, in the order they sound, each with its settings (a flat record of numbers, switches and words); none where the owner reports
 * no effects. */
export function torusRackChain(state: LiveTorusState | null): {device_ref: string; role: 'effect'; state: Record<string, number | boolean | string>}[] | undefined {
  const effects = state?.ok ? state.parameters?.effects : undefined
  if (!effects) return undefined
  const settings = effects as unknown as Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>>
  return effects.chain.map(effect => ({device_ref: effect, role: 'effect' as const, state: Object.fromEntries(Object.entries(settings[effect] ?? {})
    .filter((entry): entry is [string, number | boolean | string] => typeof entry[1] === 'boolean' || typeof entry[1] === 'string' || (typeof entry[1] === 'number' && Number.isFinite(entry[1]))))}))
}
/** The stage the frame announced, as the Torus design reads it (torus.tsx `stage.slots`, `stage.bindings`, `stage.procedures`,
 * `stage.last`, `stage.why`), with the procedure and budget the view holds. */
export function torusStageValues(stage: FrameStageReading | null | undefined, held: Readonly<Record<string, Value>> = {}): Record<string, Value> {
  const values: Record<string, Value> = {}
  for (const key of TORUS_STAGE_LOCAL) if (held[key] !== undefined) values[key] = held[key]!
  if (!stage) return values
  values['stage.slots'] = JSON.stringify(stage.slots.map(slot => ({slot: slot.slot, ...(slot.owner ? {owner: slot.owner} : {}), ...(slot.revision !== undefined ? {revision: slot.revision} : {})})))
  values['stage.bindings'] = JSON.stringify(stage.bindings.map(binding => ({procedure: binding.procedure, trigger: binding.trigger, evaluations: binding.evaluations, max: binding.max, standing: binding.standing})))
  if (stage.procedures) values['stage.procedures'] = JSON.stringify(stage.procedures.map(procedure => ({ref: procedure.ref, revision: procedure.revision, trigger: procedure.trigger, selector: procedure.selector})))
  if (stage.last) {
    values['stage.last'] = stage.last.standing
    if (stage.last.why) values['stage.why'] = stage.last.why
  }
  return values
}

/** The stage command a Torus act sends: the act's own operation on the procedure it names, a bind with the budget you hold. */
export function torusStageCommand(change: ValueChange, held: Readonly<Record<string, Value>> = {}) {
  const action = TORUS_STAGE_ACTS[change.key]
  if (!action) throw new Error(`${change.key}: no act of the stage.`)
  if (typeof change.value !== 'string' || !change.value) throw new Error('A stage act names the procedure it acts on.')
  const budget = held['stage.budget']
  return action === 'bind'
    ? {command: 'procedural-stage' as const, action, procedure_ref: change.value, ...(typeof budget === 'number' ? {max_evaluations: Math.round(budget)} : {})}
    : {command: 'procedural-stage' as const, action, procedure_ref: change.value}
}
// The Rack page (manual §16.16, §22.9) reads M1′'s rack from the map's ledger, and holds the part you choose (qlRack.ts).

/** Why each design key the binding leaves absent has no reading (manual §16.12: "When a reading is missing, say which one"). */
export const TORUS_ABSENT: Readonly<Record<string, string>> = {
  // strike: the owner's M1′ session Strike, written as its torus edit while the instrument follows or is held (torusBody).
  strike: 'No Strike here: the share of velocity is the owner\'s Torus session setting, written while the instrument follows or is held, and no owner reading stands.',
  // damping: the body's Q, written through the stage channel's damping edit while the instrument follows or is held (torusBody).
  damping: 'No damping here: the body\'s Q is written through the stage channel while the instrument follows or is held, and no owner reading stands.',
  // body, body.form and modes: what rings, the owner's (its Torus session's `body`; QL-MEF `torus-body`, O-I 852), chosen through the stage
  // channel's body edit while the instrument follows or is held (torusBody); absent with their reason until the owner names it.
  pan: `No pan: ${NO_FIELD_PARAMETER}.`,
  // material: the surface the lens in force gives the sound (QL m2_material.rs LensMaterial, the owner's Torus session `material`, O-I 854).
  material: 'No material here: the owner\'s Torus session names none for the lens in force, so the surface\'s colour, grain and give are not read.',
  meter: 'The owner reports no level meter: its audio receipt carries the presentation gain and its block counts, not a level.',
  // chain: the effects on the Torus's chain, the rack face's reading of the owner's effects (torusRackChain), absent until it reports them.
  chain: RACK_CHAIN_NONE,
  // mode.followed: the lens and mode Follow takes (torusFollowed), read where the host reads the clip and the set's mode (TorusOnChain.tsx).
  'mode.followed': 'No clip or set reading reaches the Torus in this host, so Follow has nothing to read: the lens and mode are the ones you choose.',
  sounding: 'No key is lit from the owner here: the keyboard strikes each key through QL\'s torus-play, which counts it as a note at its moving point, and the sounding notes stand in Notes (each key and the arc it struck); this picture lights pitch classes, which that reading does not name.',
  // body.source: the hand's choice over M2's body constants (QL's table, `ql kernel body-constants`; qlCoordinateName.ts BodyTable), written
  // as the body's Damping through the stage channel (torusBody); absent with its reason until the table is read and the owner takes edits.
  'body.source': 'Reading M2\'s body constants…',
  // tattva.name and tattva.fibre: the live scene's M2 condition the frame announces (qlCoordinateName.ts tattvaKeys), absent with its reason
  // until it does. tattva.standing: the standing of M2's body constants, once read.
  'tattva.name': NO_CONDITION,
  'tattva.fibre': NO_CONDITION,
  'tattva.standing': 'Reading M2\'s body constants…',
  ...STAGE_ABSENT,
}

const NOT_WRITABLE = 'The owner takes edits only while the instrument follows or is held.'

// ── View (manual §21.2 "View | Surface · Wire · Both, and Receiver On · Off | Surface · Off | What the pane draws") ─────────────────
// Surface, wire or both is a way of drawing the pane, which no owner keeps: the hand keeps it (techne/devices/designDevices.ts holds),
// as it keeps Body source, so it reads back as you set it and the pane draws it (TorusOnChain.tsx TorusPicture, the design's picture).
// Receiver is the owner's (torusReceiver).

export const TORUS_VIEWS = ['surface', 'wire', 'both'] as const
export type TorusView = (typeof TORUS_VIEWS)[number]
/** The View the hand holds: Surface until another is chosen (manual §21.2 default). */
export const torusViewOf = (held: Readonly<Record<string, Value>> | undefined): TorusView =>
  (TORUS_VIEWS as readonly unknown[]).includes(held?.view) ? held!.view as TorusView : 'surface'

// ── Lens and mode: Follow (manual §21.2 "Lens and mode | Follow · a lens and a mode | Follow | The lens and mode the Torus reads. Follow
// takes the clip's mode, or the set's when the clip has none") ─────────────────────────────────────────────────────────────────────
// QL's own spellings, read from its source: a mode is a context frame (QL-MEF crates/ql-mef/src/music.rs ModeKind::context_frame,
// Ionian CF1 … Locrian CF7); the mode catalogue names a lens by its code ("L0" … "L5'") and a frame by its code ("CF1" … "CF7")
// (crates/ql-cli/src/music_command.rs `lens`, `context_frame`; context_frame.rs ContextFrameId::code; lens.rs LensId::code); the owner's
// edits take `lens12`, the lens's place in LensId::ALL (0 … 11), and `context_frame` 1 … 7 (m1_engine.rs: ContextFrameId::ALL[cf - 1]).
// A clip carries its own mode when Live's scale is on for it (live-set edit.rs "scale" = IsInKey, "The clip's own mode"; "mode" is one
// of the seven, or none when Live names another scale). A clip's mode names no lens, so it takes the set's when one is in force.

/** The seven modes in QL's order (music.rs ModeKind::ALL): the n-th is CFn. */
export const TORUS_FOLLOW_MODES = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'] as const
export const TORUS_FOLLOW = 'mode.follow'
export const TORUS_FOLLOWED = 'mode.followed'
/** What Follow takes: the lens (or none, where nothing names one) and the frame, from the clip or the set, in words; or why nothing. */
export type TorusFollow =
  | {readonly from: 'clip' | 'set'; readonly lens12: number | null; readonly context_frame: number; readonly words: string; readonly short: string}
  | {readonly from: null; readonly reason: string}
/** The clip's own mode, as the set's owner reads the clip (kernel LiveClipReading `scale`, `mode`). */
export interface TorusClipMode {readonly scale: boolean | null; readonly mode: string | null}

const lensLabel = (lens12: number) => `L${lens12 >> 1}${lens12 & 1 ? '′' : ''}`
const modeWord = (mode: string) => mode.charAt(0).toUpperCase() + mode.slice(1)
/** A catalogue lens code ("L3'", or the shell's "L3′") as its place in LensId::ALL, or null. */
function lens12Of(code: string | undefined): number | null {
  const match = typeof code === 'string' ? /^L([0-5])(['′]?)$/.exec(code) : null
  return match ? Number(match[1]) * 2 + (match[2] ? 1 : 0) : null
}
/** A mode's frame (music.rs ModeKind::context_frame), or null for a name outside the seven. */
function frameOfMode(mode: string | null | undefined): number | null {
  const index = (TORUS_FOLLOW_MODES as readonly (string | null | undefined)[]).indexOf(mode)
  return index < 0 ? null : index + 1
}

/** What Follow takes now: the clip's own mode on the set's lens, else the set's lens and mode. Pure. */
export function torusFollowed(clip: TorusClipMode | null, set: ModeInForce): TorusFollow {
  const scale = set.state === 'in-force' ? set.selection.scale : null
  const lensMode = scale?.kind === 'lens-cf' ? scale : null
  const setLens = lens12Of(lensMode?.lens)
  const clipFrame = clip?.scale === true ? frameOfMode(clip.mode) : null
  if (clipFrame !== null) {
    const mode = modeWord(clip!.mode!)
    return setLens !== null
      ? {from: 'clip', lens12: setLens, context_frame: clipFrame, words: `the clip's mode, ${mode} (CF${clipFrame}), on the set's lens ${lensLabel(setLens)}`, short: `Clip: ${mode}, ${lensLabel(setLens)}`}
      : {from: 'clip', lens12: null, context_frame: clipFrame, words: `the clip's mode, ${mode} (CF${clipFrame}); the set names no lens, so the lens stands as it is`, short: `Clip: ${mode}`}
  }
  if (lensMode && setLens !== null) {
    const coded = /^CF([1-7])$/.exec(lensMode.contextFrame ?? '')
    const frame = coded ? Number(coded[1]) : frameOfMode(lensMode.mode)
    if (frame !== null) {
      const mode = modeWord(lensMode.mode)
      return {from: 'set', lens12: setLens, context_frame: frame, words: `the set's mode, ${mode} on ${lensLabel(setLens)} (CF${frame})`, short: `Set: ${mode}, ${lensLabel(setLens)}`}
    }
  }
  if (scale && scale.kind === 'source') return {from: null, reason: `The clip carries no mode of its own, and the set's mode in force is ${scale.label}, a ${scale.family} scale, which names no lens or frame: the lens and mode stand as they are.`}
  if (scale) return {from: null, reason: `The clip carries no mode of its own, and the set's mode in force, ${scale.label}, names no lens or frame QL reads: the lens and mode stand as they are.`}
  return {from: null, reason: `The clip carries no mode of its own, and the set has none in force (${set.line.replace(/\.$/, '')}).`}
}

/** The owner's edits that bring its lens and frame to what Follow takes, only where they differ and only while it takes edits. Pure. */
export function torusFollowEdits(state: LiveTorusState | null, follow: TorusFollow | null): InstrumentEdit[] {
  if (!follow || follow.from === null || state === null || !state.ok || !liveInstrumentWritable(state)) return []
  const d = state.determinants ?? null
  const edits: InstrumentEdit[] = []
  if (follow.lens12 !== null && d?.lens.lens12 !== follow.lens12) edits.push({kind: 'lens', lens12: follow.lens12})
  if (d?.contextFrame !== follow.context_frame) edits.push({kind: 'context-frame', context_frame: follow.context_frame})
  return edits
}
const FOLLOWED_KEYS: ReadonlySet<string> = new Set(['lens', 'context-frame'])
const NO_FOLLOW = TORUS_ABSENT['mode.followed']!
const FOLLOW_OFF = 'Follow is off: the lens and mode are the ones you choose.'
/** Follow on the binding: whether it is on (the hand's, on until you turn it off), what it takes, and the Lens and Frame it sets. */
function torusFollowKeys(follow: TorusFollow | null, held: Readonly<Record<string, Value>>): {values: Record<string, Value>; standing: Record<string, Standing>; sets: boolean} {
  if (follow === null) return {values: {}, standing: {[TORUS_FOLLOW]: {disabled: NO_FOLLOW}, [TORUS_FOLLOWED]: {disabled: NO_FOLLOW}}, sets: false}
  const on = held[TORUS_FOLLOW] !== false
  if (!on) return {values: {[TORUS_FOLLOW]: false}, standing: {[TORUS_FOLLOWED]: {disabled: FOLLOW_OFF}}, sets: false}
  const said = follow.from === null ? follow.reason : `Follow takes ${follow.words}.`
  const standing: Record<string, Standing> = {}
  for (const key of FOLLOWED_KEYS) standing[key] = {disabled: `${said} Turn Follow off to choose a lens and a mode.`}
  if (follow.from === null) standing[TORUS_FOLLOWED] = {disabled: follow.reason}
  else standing[TORUS_FOLLOWED] = {disabled: `The lens and mode Follow takes: ${follow.words}.`}
  return {values: {[TORUS_FOLLOW]: true, ...(follow.from === null ? {} : {[TORUS_FOLLOWED]: follow.short})}, standing, sets: true}
}

// ── Receiver (manual §21.2 View: "Receiver On makes your camera the place where the torus is heard"; Rules: "A camera move does not
// change the sound, unless Receiver is On") ─────────────────────────────────────────────────────────────────────────────────────────
// The frame announces Receiver On or Off, the context the owner hears in and its refusal (parameters.receiver; never the place), and takes
// the stage channel's `receiver` edit: On asks the owner to hear the torus from where the camera stands, Off gives it back to the world.

const NO_RECEIVER = 'The native field announces no receiver: this frame does not say where the torus is heard from.'
/** Receiver on the binding: the owner's On or Off, the key's standing (the owner's refusal in its words), and its one write. Pure but for
 * the write. */
export function torusReceiver(state: LiveTorusState | null, commit: (edit: InstrumentEdit) => Promise<{ok: boolean; error?: string}>):
  {values: Record<string, Value>; standing: Record<string, Standing>; writes: ReadonlySet<string>; write: (change: ValueChange) => Promise<void>} {
  const receiver = state !== null && state.ok ? state.parameters?.receiver ?? null : null
  const values: Record<string, Value> = receiver ? {receiver: receiver.on} : {}
  const why = !liveInstrumentWritable(state) ? (state === null ? 'No owner reading stands in this host.' : NOT_WRITABLE) : receiver ? null : NO_RECEIVER
  const standing: Record<string, Standing> = why ? {receiver: {disabled: why}} : receiver?.refusal ? {receiver: {refused: receiver.refusal}} : {}
  const writes: ReadonlySet<string> = new Set(why ? [] : ['receiver'])
  const write = async (change: ValueChange) => {
    if (why) throw new Error(why)
    if (typeof change.value !== 'boolean') throw new Error('Receiver is On or Off.')
    const result = await commit({kind: 'receiver', on: change.value})
    if (!result.ok) throw new Error(result.error ?? 'The native field refused the receiver.')
  }
  return {values, standing, writes, write}
}

/** The owner's presentation gain (0–4, an amplitude) as the design's level in dB; silence is the design's floor. */
export const gainToDb = (gain: number): number => (gain <= 0.001 ? -60 : Math.round(20 * Math.log10(gain) * 10) / 10)
/** The design's level in dB as the owner's presentation gain, within the owner's 0–4. */
export const dbToGain = (db: number): number => (db <= -60 ? 0 : Math.min(4, Math.max(0, Math.round(10 ** (db / 20) * 1000) / 1000)))

/** The design's values from the owner's reading. Only what the owner reports. */
export function torusDesignValues(state: LiveTorusState | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (state === null || !state.ok) return values
  const standing = state.value.standing
  values.light = standing === 'following' || standing === 'held' ? 'lit' : 'dark'
  values.standing = standing
  // What rings is the owner's Torus session's (torusBody): never drawn here before the owner names it.
  if (typeof state.parameters?.level === 'number') values.level = gainToDb(state.parameters.level)
  const presentation = qlPresentation(TORUS_FAMILY, TORUS_DEVICE_ID, state, false).values
  for (const key of ['sound', 'cadence', 'scale']) if (presentation[key] !== undefined) values[key] = presentation[key]!
  for (const row of liveTorusMacroRows(state)) {
    const key = Object.keys(TORUS_DETERMINANT_KEYS).find(name => TORUS_DETERMINANT_KEYS[name] === row.macro.id)
    const option = row.options.find(choice => choice.value === row.selected)
    if (key && option) values[key] = option.label
  }
  return values
}

// ── the Pulse, Mode and tuning, Shape and Notes groups (manual §21.2; O-I 850) ──────────────────────────────────────────
// QL's M1′ session (QL-MEF crates/ql-mef/src/m1_prime.rs; the field host's torus-state and torus-set) owns the Torus's pulse and its
// voices: Rate (Free in steps a second, one step a year to 40,000; or Sync, a note length from 1/64 to 8 bars at the set's tempo) with
// its band beside it, the Fundamental (the map's 1:1, the Sun, or 20 to 2,000 Hz; every voice is a ratio over it), Carrier (0 to
// 100 %), Shape (Auto by the band; Sequence, the scene's shapes; or one held) with the figure the torus shows, the Comma gathered since
// the Torus opened, Tuning (Logic, Maqām or Sky, only what the scene holds resident) and Polyphony with the notes the owner counts. The
// frame announces the session as parameters.torus (instrumentAnnouncement.mjs) and takes the stage channel's `torus` edit
// (stageCommands.ts TorusSettingsEdit), which the frame sends to QL as torus-set; what the binding shows is the owner's reply, read back.
// The tempo Sync steps to is the set's (the transport's Tempo): the chain keeps the owner's on it (followSetTempoOnTorus), as it keeps
// the Delay's, so here it is a reading.


const NO_SESSION = 'The native field announces no Torus session yet: QL\'s torus-state has not answered (the frame reads it while the instrument follows)'
/** The session's keys the binding writes as the owner's `torus` edit. */
export const TORUS_SESSION_KEYS: ReadonlySet<string> = new Set(['rate', 'rate.mode', 'rate.note', 'fundamental', 'fundamental.source', 'carrier', 'shape', 'tuning', 'polyphony'])
/** The session's readings, and what each is. */
const TORUS_SESSION_READINGS: Readonly<Record<string, string>> = {
  band: 'A reading: the band the pulse stands in, by its rate (Cosmic below one step in a thousand seconds, Breath below one every two seconds, Rhythm below 20 a second, Pitch to 20,000, then Beyond).',
  figure: 'A reading: the figure the torus shows, as the owner gives it. Shape sets it.',
  comma: 'A reading: the comma gathered since the Torus opened, one Pythagorean comma (23.46 cents) for each full return of the pulse. You read it; you do not set it.',
  notes: 'A reading: the notes the owner counts. Polyphony sets how many may sound.',
  'carrier.drive': 'The owner\'s word for the Carrier\'s drive. Under the pulse, each step of the pulse drives the body between strikes by the Carrier\'s share of an event\'s excitation (QL\'s native carrier).',
  tempo: 'A reading: the set\'s tempo, from the transport, which Sync steps one note length at. The transport is where it changes.',
  'tuning.resident': 'A reading: the tunings this scene holds voices for.',
  'tuning.maqam': 'A reading: the M2 condition\'s maqām, and the owner\'s words for why the scene holds no voices of it.',
}

/** The design's values from the owner's session. Only what the owner reports. Pure. */
export function torusSessionValues(session: TorusSession): Record<string, Value> {
  const t = session.settings
  const values: Record<string, Value> = {
    'rate.mode': t.rate.mode, rate: session.steps_per_second, tempo: t.tempo_bpm, band: TORUS_BAND_WORD[session.band],
    'fundamental.source': t.fundamental.source, fundamental: session.fundamental_hz,
    carrier: Math.round(t.carrier * 1000) / 10, 'carrier.drive': session.carrier_drive,
    shape: t.shape, comma: session.comma_cents, tuning: t.tuning, 'tuning.resident': JSON.stringify(session.resident_tunings),
    polyphony: t.polyphony, notes: session.notes,
  }
  if (t.rate.mode === 'sync') values['rate.note'] = `${t.rate.note.numerator}/${t.rate.note.denominator}`
  if (session.figure !== null) values.figure = session.figure
  // The maqām the owner names (O-I 855): its name, and its words for the absence while the scene holds none of its voices.
  if (session.maqam) values['tuning.maqam'] = JSON.stringify({name: session.maqam.name, absent: session.maqam.absent})
  // The surface the lens in force gives the sound (manual §21.2 "The body": its colour, its grain, how far it gives; a lens and its partner
  // show the same notes on opposite surfaces), as the owner derives it (M2-1′, QL m2_material.rs LensMaterial; O-I 854). A reading.
  const m = session.material
  if (m && !('absent' in m)) values.material = JSON.stringify({lens: m.lens, partner: m.partner, face: m.face, valence: m.valence, colour: m.colour_rgb,
    grain: m.roughness, give: m.elasticity, affinity: m.particle_affinity, tension: m.tension})
  return values
}


/** The owner's session kept on the set's tempo: the `torus` edit that brings the owner's tempo to the set's (the transport's reading, to
 * the hundredth), or null when it already is, when the set states no tempo or one outside the owner's 20 to 999 BPM, or when there is no
 * session or the owner takes no edit now. Pure. */
export function torusTempoEdit(state: LiveTorusState | null, tempoBpm: number | null): Extract<InstrumentEdit, {kind: 'torus'}> | null {
  const session = torusSessionOf(state)
  if (!session || !liveInstrumentWritable(state) || tempoBpm === null || !Number.isFinite(tempoBpm)) return null
  const value = Math.round(tempoBpm * 100) / 100
  if (session.settings.tempo_bpm === value) return null
  try { return {kind: 'torus', edit: torusSessionEdit(session, {key: 'tempo', value})} } catch { return null }
}

/** Bring the owner's session to the set's tempo when it is not already there, so a tempo change moves the pulse under Sync. */
export async function followSetTempoOnTorus(state: LiveTorusState | null, tempoBpm: number | null,
  commit: (edit: InstrumentEdit) => Promise<{ok: boolean; error?: string}> = commitLiveInstrumentEdit): Promise<void> {
  const edit = torusTempoEdit(state, tempoBpm)
  if (!edit) return
  const result = await commit(edit)
  if (!result.ok) throw new Error(result.error ?? 'The native field refused the set\'s tempo.')
}

/** The session groups on the binding: the owner's values and standing, the keys it takes now, and its one write (the `torus` edit). */
export function torusSession(state: LiveTorusState | null, commit: (edit: InstrumentEdit) => Promise<{ok: boolean; error?: string}>):
  {values: Record<string, Value>; standing: Record<string, Standing>; writes: ReadonlySet<string>; write: (change: ValueChange) => Promise<void>} {
  const session = torusSessionOf(state)
  const values: Record<string, Value> = session ? torusSessionValues(session) : {}
  const standing: Record<string, Standing> = {}, writes = new Set<string>()
  const why = state === null ? 'No owner reading stands in this host.' : state.ok && !liveInstrumentWritable(state) ? NOT_WRITABLE : !session ? `${NO_SESSION}.` : null
  for (const key of TORUS_SESSION_KEYS) if (why) standing[key] = {disabled: why}; else writes.add(key)
  for (const [key, reading] of Object.entries(TORUS_SESSION_READINGS)) standing[key] = {disabled: session ? reading : why ?? reading}
  if (session && session.figure === null) standing.figure = {disabled: 'Shape is Sequence: the scene\'s own shapes set the figure (O-I issue 851), and QL names none here.'}
  // The lens's material: a reading the lens in force sets, or the owner's words for why there is none.
  if (session?.material) standing.material = {disabled: 'absent' in session.material ? session.material.absent
    : 'A reading: the surface the lens in force gives the sound. Changing the lens changes it and leaves the notes alone.'}
  const write = async (change: ValueChange) => {
    if (!writes.has(change.key)) throw new Error(standing[change.key]?.disabled ?? `${change.key} cannot be set now.`)
    const result = await commit({kind: 'torus', edit: torusSessionEdit(session!, change)})
    if (!result.ok) throw new Error(result.error ?? 'The native field refused the Torus\'s setting.')
  }
  return {values, standing, writes, write}
}

// ── the Body group (manual §21.2 "The body source") ────────────────────────
// Body source is the view's own choice (the hand's hold, as Resonance's is, fieldDesignBinding.ts): Declared keeps the Damping you set;
// Tattva takes it from the tattva of the M2 condition through its element fibre, by M2's body constants (QL's table), and holds it while
// the tattva sets it. Damping is a Q factor, written through the stage channel's damping edit (stageCommands.ts InstrumentEdit), which the
// frame lowers to the scene's decay rate (nativeField.ts lowerQDamping). The owner keeps that rate, not the Q, so the Q you set is the
// hand's. Strike has no QL scene term: it stays dimmed and says so, with what the fibre would set. (Agitation is the plate's, §20.14.)

export const TORUS_BODY_SOURCE = 'body.source'
/** The body source the hand holds: Declared until Tattva is chosen (manual §21.2 default). */
export const torusBodySourceOf = (held: Readonly<Record<string, Value>>): BodySource => (held[TORUS_BODY_SOURCE] === 'tattva' ? 'tattva' : 'declared')

/** The edits the body source writes: under Tattva the fibre's Q through the stage channel and its Strike as the owner's torus edit (when
 * the owner's session states Strike); none under Declared or under a tattva without a fibre (Space keeps the declared values). Pure. */
export function torusBodyEdits(condition: FrameInstrumentCondition | null | undefined, table: BodyTable | null, source: BodySource,
  session: TorusSession | null): InstrumentEdit[] {
  if (source !== 'tattva') return []
  const set = tattvaBody(condition, table)
  if (!set.row) return []
  return [{kind: 'damping', q_factor: set.row.q_factor},
    ...(typeof session?.settings.strike === 'number' ? [{kind: 'torus' as const, edit: {strike: set.row.strike_share}}] : [])]
}
/** The Strike you set, as the owner's share 0..1, or the words for why not. */
function strikeShare(value: Value | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < TORUS_STRIKE.min || value > TORUS_STRIKE.max) throw new Error('Strike takes 0 to 100 %.')
  return Math.round(value * 10) / 1000
}

/** How many modes of a form's body each voice rings (QL-MEF form_instrument/body.rs MAX_BODY_MODES; stageCommands.ts STAGE_BODY_MODES_MAX).
 * A form chosen before you set a count rings 8 a voice, as QL's own fold body does (QL-MEF tests/torus_host.rs `fold`). */
export const TORUS_FORM_MODES = {min: 1, max: 64, def: 8} as const
/** Modes you set, as the count a voice the body edit takes, or the words for why not. */
function formModes(value: Value | undefined): number {
  if (!Number.isInteger(value) || (value as number) < TORUS_FORM_MODES.min || (value as number) > TORUS_FORM_MODES.max) throw new Error(`Modes takes ${TORUS_FORM_MODES.min} to ${TORUS_FORM_MODES.max} a voice.`)
  return value as number
}
const BODY_UNNAMED = 'The owner\'s Torus session names no body: QL\'s torus-state from before torus-body says nothing of what rings, so nothing is drawn as ringing.'
const MODES_UNDER_TORUS = 'The torus rings the voices of its tunings, each through its own mode, so a count of modes is a form\'s: choose A form, then set how many modes each voice rings.'

/** The Damping you set, as a Q the stage channel takes, or the words for why not. */
function dampingQ(value: Value | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < TORUS_Q.min || value > TORUS_Q.max) throw new Error(`Damping takes a Q factor ${TORUS_Q.min} to ${TORUS_Q.max}.`)
  return value
}

/** The Body group on the binding: its values and standing, whether Body, Modes, Body source, Strike and Damping take a change now, and their
 * writes. What rings is the owner's Torus session's `body` (the torus, or a form with its form, material, modes and voices): Body chooses it
 * as the stage channel's body edit, and under a form Modes, Damping and Body source choose it again, since the owner damps a form at the Q
 * it was made at (QL refuses set-damping under one). */
export function torusBody(state: LiveTorusState | null, condition: FrameInstrumentCondition | null | undefined, table: BodyTable | null,
  held: Readonly<Record<string, Value>>, commit: (edit: InstrumentEdit) => Promise<{ok: boolean; error?: string}>,
  keep: (key: string, value: Value) => void): {values: Record<string, Value>; standing: Record<string, Standing>; writes: ReadonlySet<string>; write: (change: ValueChange) => Promise<void>} {
  const values: Record<string, Value> = {}, standing: Record<string, Standing> = {}, writes = new Set<string>()
  const source = torusBodySourceOf(held), set = tattvaBody(condition, table), row = set.row, session = torusSessionOf(state)
  const owner = !liveInstrumentWritable(state) ? (state === null ? 'No owner reading stands in this host.' : NOT_WRITABLE) : null
  // What rings: the owner's naming of it, or why none stands.
  const rings = session?.body ?? null, formed = rings?.kind === 'form' ? rings : null
  const unnamed = !session ? (owner ?? `${NO_SESSION}.`) : !rings ? BODY_UNNAMED : null
  if (rings) values.body = rings.kind
  if (unnamed) standing.body = {disabled: unnamed}
  else if (owner) standing.body = {disabled: owner}
  else writes.add('body')
  if (formed) {
    values.modes = formed.modes
    values['body.form'] = formed.form.form_ref
    standing['body.form'] = {disabled: `A reading: the form that rings, the scene's M3 form (${formed.form.kind} ${formed.form.form_ref}) as the owner prepared it, of ${formed.material.fibre}, ${formed.modes} modes a voice through ${formed.voices} voices.`}
    if (owner) standing.modes = {disabled: owner}
    else writes.add('modes')
  } else {
    standing.modes = {disabled: unnamed ?? MODES_UNDER_TORUS}
    standing['body.form'] = {disabled: unnamed ?? 'The torus rings: no form is made a body. Choose A form to ring the scene\'s M3 form.'}
  }
  const would = row ? ` M2's table gives the ${row.fibre} fibre Strike ${Math.round(row.strike_share * 100)}% and Damping ${row.q_factor} (${table?.ok ? table.standing : 'unread'}).` : ''
  // The table's standing, a reading; Body source, the hand's choice once the table is read and the owner takes edits.
  if (table?.ok) {
    values['tattva.standing'] = table.standing
    standing['tattva.standing'] = {disabled: 'A reading: the standing of M2\'s body constants (QL\'s table: a starting point, to be tuned by ear).'}
    values[TORUS_BODY_SOURCE] = source
    if (owner) standing[TORUS_BODY_SOURCE] = {disabled: `${owner}${would}`}
    else writes.add(TORUS_BODY_SOURCE)
  } else {
    const why = table?.reason ?? 'Reading M2\'s body constants…'
    standing['tattva.standing'] = {disabled: why}
    standing[TORUS_BODY_SOURCE] = {disabled: why}
  }
  // Damping: the fibre's Q held under Tattva; the Q you set under Declared, or under a tattva that carries no element; under a form, the Q
  // the owner made it at.
  if (source === 'tattva' && row) {
    values.damping = row.q_factor
    standing.damping = {disabled: `Body source is Tattva: the ${row.fibre} fibre sets it (Q ${row.q_factor}, M2's body constants, ${table?.ok ? table.standing : 'unread'}). Set Body source to Declared to set it by hand.`}
  } else {
    if (formed) values.damping = formed.material.q_factor
    else if (typeof held.damping === 'number') values.damping = held.damping
    if (owner) standing.damping = {disabled: owner}
    else writes.add('damping')
  }
  // Strike: the owner's session share of velocity; the fibre's held under Tattva, the share you set under Declared or a tattva without one.
  const strikeOwned = typeof session?.settings.strike === 'number'
  if (source === 'tattva' && row) {
    values.strike = Math.round(row.strike_share * 100)
    standing.strike = {disabled: `Body source is Tattva: the ${row.fibre} fibre sets it (Strike ${Math.round(row.strike_share * 100)}%, M2's body constants, ${table?.ok ? table.standing : 'unread'}). Set Body source to Declared to set it by hand.`}
  } else if (!strikeOwned) {
    standing.strike = {disabled: session ? `${NO_STRIKE_SESSION}.` : owner ?? `${NO_SESSION}.`}
  } else {
    values.strike = Math.round((session!.settings.strike as number) * 1000) / 10
    if (owner) standing.strike = {disabled: owner}
    else writes.add('strike')
  }
  const send = async (edit: InstrumentEdit) => { const result = await commit(edit); if (!result.ok) throw new Error(result.error ?? 'The native field refused the body\'s setting.') }
  // A form chosen, or chosen again: so many modes a voice at a Q, its material declared or the tattva's. The owner's refusal is said in words.
  const choose = async (body: {modes: number; q_factor: number; material: BodySource} | null) => {
    const result = await commit({kind: 'body', body})
    if (!result.ok) throw new Error(refusalWords(body === null ? 'The torus was not given the body back.' : 'The body was not chosen.', result.error))
  }
  const write = async ({key, value}: ValueChange) => {
    if (key === 'body') {
      if (value !== 'torus' && value !== 'form') throw new Error('The body is The torus or A form.')
      if (!writes.has(key)) throw new Error(standing.body?.disabled ?? 'The body cannot be chosen now.')
      if (value === 'torus') return choose(null)
      const q = source === 'tattva' && row ? row.q_factor : formed ? formed.material.q_factor : typeof held.damping === 'number' ? held.damping : null
      if (q === null) throw new Error('A form rings at the Damping you set: set Damping, then choose A form.')
      const modes = formed ? formed.modes : typeof held.modes === 'number' ? held.modes : TORUS_FORM_MODES.def
      return choose({modes, q_factor: q, material: source})
    }
    if (key === 'modes') {
      if (!writes.has(key) || !formed) throw new Error(standing.modes?.disabled ?? 'Modes cannot be set now.')
      const modes = formModes(value)
      keep('modes', modes)
      return choose({modes, q_factor: formed.material.q_factor, material: source})
    }
    if (key === TORUS_BODY_SOURCE) {
      if (value !== 'declared' && value !== 'tattva') throw new Error('The body source is Declared or Tattva.')
      if (!writes.has(key)) throw new Error(standing[key]?.disabled ?? 'The body source cannot be chosen now.')
      keep(TORUS_BODY_SOURCE, value)
      const edits = torusBodyEdits(condition, table, value, session)
      if (formed) {
        // Under a form its Q is the form's own: the fibre's Strike goes to the session, then the form is made again of the material chosen.
        for (const edit of edits) if (edit.kind !== 'damping') await send(edit)
        if (!edits.length && value === 'declared' && strikeOwned && typeof held.strike === 'number') await send({kind: 'torus', edit: {strike: held.strike}})
        const fibre = edits.find(edit => edit.kind === 'damping')
        return choose({modes: formed.modes, q_factor: fibre?.kind === 'damping' ? fibre.q_factor : typeof held.damping === 'number' ? held.damping : formed.material.q_factor, material: value})
      }
      for (const edit of edits) await send(edit)
      if (!edits.length && value === 'declared') {
        // Declared gives back the values you set.
        if (typeof held.damping === 'number') await send({kind: 'damping', q_factor: held.damping})
        if (strikeOwned && typeof held.strike === 'number') await send({kind: 'torus', edit: {strike: held.strike}})
      }
      return
    }
    if (key === 'strike') {
      if (!writes.has(key)) throw new Error(standing.strike?.disabled ?? 'Strike cannot be set now.')
      const share = strikeShare(value)
      keep('strike', share)
      await send({kind: 'torus', edit: {strike: share}})
      return
    }
    if (key === 'damping') {
      if (!writes.has(key)) throw new Error(standing.damping?.disabled ?? 'Damping cannot be set now.')
      const q = dampingQ(value)
      keep('damping', q)
      // A form is damped at the Q it is made at: it is made again (the owner refuses set-damping under a form).
      if (formed) return choose({modes: formed.modes, q_factor: q, material: source})
      await send({kind: 'damping', q_factor: q})
      return
    }
    throw new Error(`${key}: no key of the Body group.`)
  }
  return {values, standing, writes, write}
}

/** Whether the owner takes a change of this design key now, and why not when it does not. */
function writeStanding(state: LiveTorusState | null, key: string): string | null {
  if (TORUS_ABSENT[key]) return TORUS_ABSENT[key]!
  if (key === 'light') return 'The owner has no on or off: the light reads whether the instrument follows or is held.'
  if (key === 'standing') return 'A reading: the owner reports its standing.'
  if (!(key === 'level' || QL_PRESENTATION_KEYS.includes(key) || key in TORUS_DETERMINANT_KEYS)) return `${key}: no parameter of the owner's instrument.`
  if (!liveInstrumentWritable(state)) return state === null ? 'No owner reading stands in this host.' : NOT_WRITABLE
  if (state !== null && state.ok && key === 'cadence' && (state.parameters?.cadence ?? null) === null) return 'No scene is open, so there is no cadence to set.'
  if (state !== null && state.ok && key === 'scale' && (state.parameters?.scale?.unitsPerMetre ?? null) === null) return 'The owner states no scale.'
  return null
}

/** The device's row changes for the design's changes, in the owner's own forms (labels for choices, the gain for the level). Throws
 * in words for a key the owner does not take. */
export function torusRowChanges(changes: readonly ValueChange[]): {key: string; value: ParamValue}[] {
  return changes.map(change => {
    if (change.key === 'level') {
      if (typeof change.value !== 'number' || !Number.isFinite(change.value)) throw new Error('Level takes a number of dB.')
      return {key: 'level', value: dbToGain(change.value)}
    }
    const macro = TORUS_DETERMINANT_KEYS[change.key]
    if (macro) return {key: macro, value: change.value}
    if (QL_PRESENTATION_KEYS.includes(change.key)) return {key: change.key, value: change.value}
    throw new Error(TORUS_ABSENT[change.key] ?? `${change.key}: no parameter of the owner's instrument.`)
  })
}

/** The Body group's keys the binding writes itself (torusBody), not as the device's rows. */
const BODY_KEYS: ReadonlySet<string> = new Set([TORUS_BODY_SOURCE, 'damping', 'strike', 'body', 'modes', 'body.form'])

/** Every key the binding speaks for: the design's keys and the owner's own. Receiver's standing is its own (torusReceiver). */
const TORUS_KEYS = ['light', 'standing', 'level', ...QL_PRESENTATION_KEYS.filter(key => key !== 'level'), ...Object.keys(TORUS_DETERMINANT_KEYS), ...Object.keys(TORUS_ABSENT)]

/** The binding the runtime hosts the Torus design on: the owner's readings, the device's one submit (the stage channel), and every
 * key the owner does not take disabled with the reason. */
export function torusDesignBinding(state: LiveTorusState | null, device: DeviceInstance = torusDevice(state), skyHeld: Readonly<Record<string, string>> = {},
  stage: FrameStageReading | null | undefined = hostedChrome()?.state?.instrumentStage ?? null, rack: QlRackState = qlRackState(1),
  run: StageRun | null = hostedChrome()?.run ?? null, held: Readonly<Record<string, Value>> = heldFor(TORUS_DESIGN_ID),
  condition: FrameInstrumentCondition | null | undefined = hostedChrome()?.state?.instrumentCondition ?? null,
  tattvaName: CoordinateName | null = condition?.tattva_ref ? coordinateNames().get(condition.tattva_ref) ?? null : null,
  table: BodyTable | null = bodyTable(), commit: (edit: InstrumentEdit) => Promise<{ok: boolean; error?: string}> = commitLiveInstrumentEdit,
  keep: (key: string, value: Value) => void = (key, value) => holdDesign(TORUS_DESIGN_ID, key, value),
  follow: TorusFollow | null = null): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const key of TORUS_KEYS) {
    const why = writeStanding(state, key)
    if (why) standing[key] = {disabled: why}
  }
  // The Rack page: M1′'s rack from the map's ledger, and the part you choose in your own hand (qlRack.ts).
  const page = rackPage(1, rack)
  Object.assign(standing, page.standing)
  // The Stage page: what the field disclosed, and its four acts through the frame's stage channel once there is a stage and a frame.
  const acting = !!stage && !!run
  if (stage) {
    for (const key of ['stage.slots', 'stage.bindings', 'stage.procedures']) standing[key] = {disabled: 'A reading of the stage the native field disclosed: its acts change it.'}
    standing['stage.last'] = {disabled: stage.last ? 'The last stage act\'s standing, as the owner returned it.' : NO_LAST}
    standing['stage.why'] = {disabled: stage.last?.why ? 'The owner\'s refusal of the last stage act, in its words.' : stage.last ? 'The last stage act was not refused.' : NO_LAST}
    for (const key of Object.keys(TORUS_STAGE_ACTS)) if (acting) delete standing[key]; else standing[key] = {disabled: NO_STAGE_FRAME}
  }
  // The Body group's tattva: the live scene's M2 condition, as the frame announces it, by the map's name for its coordinate.
  const tattva = tattvaKeys(condition, tattvaName)
  Object.assign(standing, tattva.standing)
  // The Body group: the hand's Body source over M2's body constants, and the body's Damping through the stage channel.
  const body = torusBody(state, condition, table, held, commit, keep)
  Object.assign(tattva.values, body.values)
  for (const key of body.writes) delete standing[key]
  Object.assign(standing, body.standing)
  // The Pulse, Mode and tuning, Shape and Notes groups: QL's M1′ session, read back from the owner, written as its `torus` edit.
  const session = torusSession(state, commit)
  Object.assign(standing, session.standing)
  // Receiver: where the torus is heard from, the owner's own context, written as the stage channel's receiver edit.
  const receiver = torusReceiver(state, commit)
  Object.assign(standing, receiver.standing)
  // The rack face: the chain from the owner's effects, read; the macros, the macro chosen and the variations in your hand.
  const chain = torusRackChain(state)
  standing.chain = {disabled: chain ? RACK_CHAIN_READ : RACK_CHAIN_NONE}
  const rackValues: Record<string, Value> = chain ? {chain: JSON.stringify(chain)} : {}
  for (const key of TORUS_RACK_LOCAL) if (held[key] !== undefined) rackValues[key] = held[key]!
  // View, the pane's own way of drawing, and Follow, both in your hand; under Follow the Lens and Frame are what it takes.
  rackValues.view = torusViewOf(held)
  const followKeys = torusFollowKeys(follow, held)
  Object.assign(standing, followKeys.standing)
  Object.assign(rackValues, followKeys.values)
  const followed = (key: string) => followKeys.sets && FOLLOWED_KEYS.has(key)
  const local: Record<string, (value: Value | undefined) => void> = {...page.local, ...handsFor(TORUS_DESIGN_ID, TORUS_STAGE_LOCAL), ...handsFor(TORUS_DESIGN_ID, TORUS_RACK_LOCAL),
    ...handsFor(TORUS_DESIGN_ID, ['view', TORUS_FOLLOW])}
  const submit = device.submit
  const stageAct = async (change: ValueChange) => {
    if (!run) throw new Error(NO_STAGE_FRAME)
    const result = await run(torusStageCommand(change, held))
    if (!result.ok) throw new Error(result.error)
  }
  return {
    id: device.id,
    values: {...torusDesignValues(state), ...session.values, ...receiver.values, ...torusStageValues(stage, held), ...page.values, ...tattva.values, ...rackValues},
    writes: key => (key in TORUS_STAGE_ACTS ? acting : body.writes.has(key) || session.writes.has(key) || receiver.writes.has(key)
      || (key !== 'rack' && key !== 'receiver' && !BODY_KEYS.has(key) && !TORUS_SESSION_KEYS.has(key) && !followed(key) && writeStanding(state, key) === null)),
    standing,
    local,
    ...(page.waiting ? {waiting: ['rack']} : {}),
    ...(submit || acting || body.writes.size || session.writes.size || receiver.writes.size ? {write: async (changes: readonly ValueChange[]) => {
      for (const change of changes.filter(c => c.key in TORUS_STAGE_ACTS)) await stageAct(change)
      for (const change of changes.filter(c => BODY_KEYS.has(c.key))) await body.write(change)
      for (const change of changes.filter(c => TORUS_SESSION_KEYS.has(c.key))) await session.write(change)
      for (const change of changes.filter(c => c.key === 'receiver')) await receiver.write(change)
      const rows = changes.filter(c => !(c.key in TORUS_STAGE_ACTS) && !BODY_KEYS.has(c.key) && !TORUS_SESSION_KEYS.has(c.key) && c.key !== 'receiver')
      if (rows.length) { if (!submit) throw new Error(NOT_WRITABLE); await submit(torusRowChanges(rows)) }
    }} : {}),
    // The level, scale, Carrier or Rate a planet moves (designBindings/skyModulation.ts): the status bar names the planet, the base and the
    // value now.
    ...(Object.keys(skyHeld).length ? {modulatedBy: skyHeld} : {}),
  }
}

// ── the device's picture ─────────────────────────────────────────────────────
// The torus the device wears at all three sizes (lock §0.2.3; FOUNDATION F5: no text-only cards). It is the M1 embedding's
// own outline — the surface x=(R+cos θ1)cos θ2, y=(R+cos θ1)sin θ2, z=sin θ1 with R and r from LIVE_TORUS_TOPOLOGY (the QL
// kernel's constants, cited there) — drawn as meridians and parallels seen from a fixed tilt, with the far side of the
// surface fainter than the near. It is geometry, not state: the oscillation (the cymatic, playable torus, sound and picture
// from one state) is the simulation's render on the stage and is never redrawn here (lock §0.2.2). Nothing in the outline
// claims a phase; the owner's standing tints it (torusTone) and that is all the owner's reading adds.

/** How densely each size draws the outline: more lines where there is more room. */
export const TORUS_FIGURE_DETAIL = {
  compact: {meridians: 12, parallels: 5},
  whole: {meridians: 18, parallels: 7},
  full: {meridians: 28, parallels: 11},
} as const

export type TorusFigureSize = keyof typeof TORUS_FIGURE_DETAIL

export interface TorusFigure {
  /** The outline's near side and far side, as SVG path data. */
  front: string
  back: string
  /** The surface's silhouette, one closed path: where the outward normal turns edge-on to the viewer on the outer side of the tube. */
  outline: string
  /** The viewBox that holds the whole outline, in the embedding's own units. */
  view: {x: number; y: number; width: number; height: number}
}

const TILT = 62 * Math.PI / 180
const STEPS = 72
const TAU = Math.PI * 2
const round = (value: number) => Math.round(value * 1000) / 1000

/** The torus outline for a size. Pure: the same size always draws the same figure. */
export function torusFigure(size: TorusFigureSize, topology: Pick<typeof LIVE_TORUS_TOPOLOGY, 'major_radius' | 'minor_radius'> = LIVE_TORUS_TOPOLOGY): TorusFigure {
  const {meridians, parallels} = TORUS_FIGURE_DETAIL[size]
  const R = topology.major_radius, r = topology.minor_radius
  const sin = Math.sin(TILT), cos = Math.cos(TILT)
  let front = '', back = ''
  // one point on the surface, seen from the tilt: its screen position and whether its outward normal faces the viewer
  const point = (theta1: number, theta2: number) => {
    const ring = R + r * Math.cos(theta1)
    const x = ring * Math.cos(theta2), y = ring * Math.sin(theta2), z = r * Math.sin(theta1)
    const ny = Math.cos(theta1) * Math.sin(theta2), nz = Math.sin(theta1)
    return {x, y: y * cos - z * sin, near: ny * sin + nz * cos > 0}
  }
  // a curve is drawn as runs: a run keeps going while the curve stays on one side of the surface, and starts afresh where it turns
  const curve = (at: (t: number) => {x: number; y: number; near: boolean}) => {
    let previous = at(0)
    let side: boolean | null = null
    for (let step = 1; step <= STEPS; step++) {
      const next = at(step / STEPS)
      const near = previous.near && next.near
      const move = side === near ? `L${round(next.x)} ${round(next.y)}` : `M${round(previous.x)} ${round(previous.y)}L${round(next.x)} ${round(next.y)}`
      if (near) front += move; else back += move
      side = near
      previous = next
    }
  }
  for (let index = 0; index < meridians; index++) { const theta2 = TAU * index / meridians; curve(t => point(TAU * t, theta2)) }
  for (let index = 0; index < parallels; index++) { const theta1 = TAU * index / parallels; curve(t => point(theta1, TAU * t)) }
  // The silhouette: the normal is edge-on where cos θ1 sin θ2 sin α + sin θ1 cos α = 0, so on the tube's outer side θ1 = atan(−sin θ2 tan α).
  let outline = ''
  for (let step = 0; step < STEPS * 2; step++) {
    const theta2 = TAU * step / (STEPS * 2), at = point(Math.atan(-Math.sin(theta2) * Math.tan(TILT)), theta2)
    outline += `${step ? 'L' : 'M'}${round(at.x)} ${round(at.y)}`
  }
  outline += 'Z'
  // the outline's extent: the ring's reach across, and its reach down once tilted (at θ2 = 90°, y' = R cos α + r cos(θ1 + α))
  const across = R + r, down = R * cos + r
  const pad = 0.15
  return {front, back, outline, view: {x: round(-across - pad), y: round(-down - pad), width: round(2 * (across + pad)), height: round(2 * (down + pad))}}
}

/** How strongly the owner's standing lights the outline: following and held are the instrument at work, opening is on its way,
 * and manual, unavailable or no reading leave it unlit. A tint is a reading of the standing and nothing more. */
export function torusTone(state: LiveTorusState | null): 'lit' | 'rising' | 'unlit' {
  if (state === null || !state.ok) return 'unlit'
  const standing = state.value.standing
  return standing === 'following' || standing === 'held' ? 'lit' : standing === 'opening' ? 'rising' : 'unlit'
}
