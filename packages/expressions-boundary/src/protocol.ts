/** One application, two cuts. Native subject identity and Action ownership
 * survive the cut. Layout, camera and instrument-local preferences stay in
 * the application that made them; this boundary has no document store.
 * Wire compatibility: desktop/cradle/src/expressions/hostedApp.ts and the
 * vendored app's kernelExpressions.ts/app.ts. */
import {TECHNE_INSTRUMENTS, type TechneActionRoute, type TechneReading} from '../../../desktop/cradle/src/techne/contract.ts';
import {resolveActionRoute} from '../../../desktop/cradle/src/techne/m0m5/adapter.ts';
import type {HostedAppState as CradleHostedAppState, HostedAppMode, HostedTechneLens, HostedInstrument, HostedInstrumentDeterminants, HostedInstrumentParameters, HostedTorusSession, HostedTorusClass, HostedAddress} from '../../../desktop/cradle/src/expressions/hostedApp'; import type {FramePresentation, FrameChromeReading} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts'; import {readFrameResearch, type FrameResearchReading} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchReading.ts'; import {readFrameStage, type FrameStageReading} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageReading.ts';
export type {HostedAppMode, HostedTechneLens, HostedInstrument, HostedInstrumentDeterminants, HostedInstrumentParameters, HostedTorusSession, HostedAddress}; /** The cradle's reading and (T-FRAME-CHROME-ONTO-PLATES) the presentation the shell declared and the frame's chrome as data. */ export type HostedAppState = CradleHostedAppState & {presentation?: FramePresentation; chrome?: FrameChromeReading; /** lane W4-Technē: the research instruments' state as the frame holds it (researchReading.ts). */ research?: FrameResearchReading; /** lane W4-Technē: the procedural stage the native field last disclosed (stageReading.ts). */ instrumentStage?: FrameStageReading; /** W6: the live scene's M2 condition, its tattva and material fibre, as the native field last inspected it (instrumentCondition.ts). */ instrumentCondition?: FrameInstrumentCondition};
export type {FrameStageReading, FrameStageSlot, FrameStageBinding} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageReading.ts';
import {readFrameCondition, type FrameInstrumentCondition} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/instrumentCondition.ts';
export type {FrameInstrumentCondition} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/instrumentCondition.ts';
export type {FrameResearchReading, FrameJourneyReading, FrameJourneyStop, FrameCanvasReading, FrameCanvasItem, FrameCanvasLine, FrameTimelineReading, FrameTimelineEvent} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchReading.ts';
/** lane-3 E22: the frame's own deep-link grammar (`?expression=&scene=&t=&marker=`), one parse and one format for frame, boundary
 * and shell: the announced address is read with it, the shell opens the frame with it and copies the address in it. */
import {formatDeepLink, parseDeepLink} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/deepLinks.ts';
export {formatDeepLink, parseDeepLink, DEEP_LINK_KEYS, type DeepLinkAddress} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/deepLinks.ts';
// The QL instrument reading parser (the owner shape, ql.instrument-reading/v1), owned by this package: the boundary validates the instrument with it.
import {parseQlInstrumentReading} from './qlInstrumentReading.ts';
import {readEffectsState} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/effectsLaw.ts';
/** The torus's effects' law (manual §21.5, and the Resonator bank §22.7), the owner's: the shell's effect devices draw and refuse by it. */
export {PRESENTATION_EFFECTS, EFFECT_LAW, EFFECT_TITLES, DELAY_DIVISIONS, effectRefusal, effectChainRefusal, isPresentationEffect, resonatorRootHz, resonatorBodies, type PresentationEffect, type EffectValue, type EffectParameterLaw, type EffectsState} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/effectsLaw.ts';
export type {TechneReading, TechneActionRoute, TechneActionReceipt, NativeActionRef} from '../../../desktop/cradle/src/techne/contract.ts';
export {assertReading, resolveActionRoute} from '../../../desktop/cradle/src/techne/m0m5/adapter.ts';

export const CHANNEL_VERSION = 1;
export const NATIVE_CHANNEL = 'oi.native-expression/v1';
export const DEEP_INSTRUMENT_IDS = TECHNE_INSTRUMENTS.filter((id): id is HostedTechneLens => id !== 'expressions');
export const FRAME_EXPRESSION_OPERATIONS = new Set(['profile_define', 'profile_inspect', 'list', 'inspect', 'create', 'edit', 'open', 'open_file', 'save_as', 'save', 'export', 'fork', 'index', 'close', 'invoke_action', 'performance']);
// The presets' owner path: an exact performance request, read by readFramePerformanceRequest (performanceBasis.ts).
export {readFramePerformanceRequest, summarizePerformanceBases, refusePerformanceSave, recallPerformanceBasis, readPresetName, missingNativeReadings, REQUIRED_NATIVE_READINGS, PERFORMANCE_BASIS_SCHEMA} from './performanceBasis.ts';
export type {FramePerformanceRequest, PerformanceAction, PerformanceReply, PerformanceBasisSummary, TorusKeptSummary} from './performanceBasis.ts';
export const isHostedAppMode = (v: unknown): v is HostedAppMode => v === 'expressions' || v === 'techne' || v === 'live';
export const isDeepInstrument = (v: unknown): v is HostedTechneLens => DEEP_INSTRUMENT_IDS.includes(v as HostedTechneLens);
export const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const boundedText = (v: unknown, max = 4096): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
export const positiveInteger = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
export const expressionRef = (v: unknown): v is string => boundedText(v) && v.startsWith('expression:') && v.length > 'expression:'.length;
/** The app's own Studio nav list: the host validates sections against the same ids the app renders. */
export {STUDIO_SECTIONS, isStudioSection, studioPlacement, type StudioSection} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/studioSections.ts';
import {isStudioSection, type StudioSection} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/studioSections.ts';
/** The stage-control vocabulary (view, capture, present, export, import, tool, engine): one closed list for host, frame and shell. */
export {STAGE_COMMANDS, STAGE_VIEW_ACTIONS, STAGE_CAPTURE_WIDTHS, STAGE_CAPTURE_ASPECTS, STAGE_EXPORT_FORMATS, STAGE_TOOLS, STAGE_TOOL_READINGS, STAGE_ENGINE_ACTIONS, STAGE_TAKE_MODES, STAGE_TRACK_ACTIONS, stageOneOf, stageRefusal,
  readStageRequest, stageRequestMessage, stageReplyMessage, readStageResult, readStageAudioClock, isStageSampleCursor, readStageJournal, stageJournalLanding, STAGE_JOURNAL_ACTS_MAX, STAGE_JOURNAL_BYTES_MAX, readStageTorusCheckpoint, STAGE_TORUS_CHECKPOINT_BYTES_MAX, STAGE_RENDER_FRAMES_MAX, STAGE_RENDER_ACTS_MAX, STAGE_INSTRUMENT_TIMED_KINDS, STAGE_EDIT_AHEAD_SECONDS, STAGE_JANKO_KEYS_MAX, readInstrumentEdit, STAGE_INSTRUMENT_CADENCES, STAGE_INSTRUMENT_LEVEL, STAGE_INSTRUMENT_SCALE_MAX, FRAME_PRESENTATIONS, FRAME_CHROME_HOMES, FRAME_CHROME_KINDS, FRAME_CHROME_LIMITS, readFrameChrome, type FramePresentation, type FrameChromeHome, type FrameChromeKind, type FrameChromeControl, type FrameChromeOption, type FrameChromeReading,
  type StageCommand, type StageCommandName, type StageResult, type StageAudioClock, type StageJournalAct, type StagePerformanceJournal, type StageTorusCheckpoint, type StageTorusSound, type StageSoundMove, type StageTakeAct, type StageTakeRender, type StageKey, type StageViewAction, type StageCaptureSettings, type StageCaptureWidth, type StageCaptureAspect, type StageExportFormat, type StageTakeMode, type StageTrackAction,
  type StageTool, type StageToolReading, type StageEngineAction, type InstrumentEdit,
} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts';
import {stageOneOf, STAGE_TAKE_MODES, STAGE_TOOL_READINGS, FRAME_PRESENTATIONS, readFrameChrome} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts';
/** Host→frame command that opens one Studio section. The frame answers with a
 * host-command-result, which carries no request id: its command name is its key. */
export const OPEN_STUDIO_COMMAND = 'open-studio';
export function readOpenStudioResult(raw: Record<string, unknown>): {ok: true; section: StudioSection} | {ok: false; error: string} | null {
  if (raw.command !== OPEN_STUDIO_COMMAND || typeof raw.ok !== 'boolean') return null;
  if (raw.ok) return isStudioSection(raw.section) ? {ok: true, section: raw.section} : null;
  return boundedText(raw.error, 512) ? {ok: false, error: raw.error} : null;
}

/** The owner's determinants (scene.ts SceneActing): the lens, context frame, harmonic basis and M3 transcription the native M1 body acts on.
 * Exact or refused: a determinant the owner does not state is absent (null), never a guessed value. */
export function readHostedDeterminants(raw: unknown): HostedInstrumentDeterminants | null | string {
  if (raw === null || raw === undefined) return null;
  if (!object(raw) || !object(raw.lens) || !object(raw.harmonic)) return 'determinants: expected lens, contextFrame, harmonic and rna';
  const {lens, harmonic} = raw;
  if (!Number.isSafeInteger(lens.lens12) || Number(lens.lens12) < 0 || Number(lens.lens12) > 11) return 'determinants.lens.lens12: expected 0..11';
  if (!boundedText(lens.label, 16)) return 'determinants.lens.label: expected the owner label';
  if (!Number.isSafeInteger(raw.contextFrame) || Number(raw.contextFrame) < 1 || Number(raw.contextFrame) > 7) return 'determinants.contextFrame: expected 1..7';
  if (harmonic.selection === 'selected-source-row') {
    // the selected source row carries no index
  } else if (harmonic.selection === 'canonical-basis' && Number.isSafeInteger(harmonic.index) && Number(harmonic.index) >= 0 && Number(harmonic.index) <= 7) {
    // one of the eight native bases
  } else return 'determinants.harmonic: expected the selected source row or canonical basis 0..7';
  if (typeof raw.rna !== 'boolean') return 'determinants.rna: expected a boolean';
  const harmonicSource = harmonic.selection === 'canonical-basis'
    ? {selection: 'canonical-basis' as const, index: Number(harmonic.index)} : {selection: 'selected-source-row' as const};
  return {lens: {lens12: Number(lens.lens12), label: String(lens.label)}, contextFrame: Number(raw.contextFrame), harmonic: harmonicSource, rna: raw.rna};
}

const TORUS_BANDS = ['cosmic', 'breath', 'rhythm', 'pitch', 'beyond'] as const;
const TORUS_FIGURES = ['torus', 'figure-eight', 'spiral', 'klein-bottle'] as const;
const TORUS_SHAPES = ['auto', 'sequence', ...TORUS_FIGURES] as const;
const TORUS_TUNINGS = ['logic', 'maqam', 'sky'] as const;
/** The Torus's M1′ session the frame announces (instrumentAnnouncement.mjs `parameters.torus`, from QL's `torus-state`), exact or the
 * fault named. Nothing is defaulted: a missing or mistyped value refuses the whole session. */
export function readHostedTorus(raw: unknown): HostedTorusSession | string {
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const positive = (v: unknown): v is number => finite(v) && v > 0;
  const count = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
  const among = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
  if (!object(raw) || !object(raw.settings)) return 'expected settings, the rate and its band, the Fundamental, figure, comma, notes and resident tunings';
  const t = raw.settings;
  const rate = object(t.rate) && t.rate.mode === 'free' && positive(t.rate.steps_per_second) ? {mode: 'free' as const, steps_per_second: t.rate.steps_per_second}
    : object(t.rate) && t.rate.mode === 'sync' && object(t.rate.note) && Number.isSafeInteger(t.rate.note.numerator) && Number.isSafeInteger(t.rate.note.denominator)
      && Number(t.rate.note.numerator) > 0 && Number(t.rate.note.denominator) > 0 ? {mode: 'sync' as const, note: {numerator: Number(t.rate.note.numerator), denominator: Number(t.rate.note.denominator)}} : null;
  const fundamental = object(t.fundamental) && t.fundamental.source === 'map' ? {source: 'map' as const}
    : object(t.fundamental) && t.fundamental.source === 'hz' && positive(t.fundamental.hz) ? {source: 'hz' as const, hz: t.fundamental.hz} : null;
  if (!rate || !fundamental || !finite(t.carrier) || t.carrier < 0 || t.carrier > 1 || !among(TORUS_SHAPES, t.shape) || !among(TORUS_TUNINGS, t.tuning)
    || !count(t.polyphony) || !positive(t.tempo_bpm)) return 'settings: expected the rate, Fundamental, Carrier 0..1, shape, tuning, polyphony and tempo';
  if (!positive(raw.steps_per_second)) return 'steps_per_second: expected a positive rate';
  if (!among(TORUS_BANDS, raw.band)) return 'band: expected cosmic, breath, rhythm, pitch or beyond';
  if (!positive(raw.fundamental_hz)) return 'fundamental_hz: expected a frequency';
  if (!positive(raw.map_hz)) return 'map_hz: expected the map\'s 1:1';
  if (raw.figure !== null && !among(TORUS_FIGURES, raw.figure)) return 'figure: expected a figure or null';
  if (!finite(raw.comma_cents) || raw.comma_cents < 0) return 'comma_cents: expected the comma gathered, in cents';
  if (!count(raw.notes)) return 'notes: expected a count';
  if (!Array.isArray(raw.resident_tunings) || !raw.resident_tunings.every(v => among(TORUS_TUNINGS, v))) return 'resident_tunings: expected logic, maqam or sky';
  if (!boundedText(raw.carrier_drive, 64)) return 'carrier_drive: expected the owner\'s word';
  // Strike (O-I #854): an owner from before it states none, and then the session has none; a stated Strike outside 0..1 refuses it.
  if (t.strike !== undefined && (!finite(t.strike) || t.strike < 0 || t.strike > 1)) return 'settings: expected Strike as a share 0..1';
  // The maqām, the lens's material and the twelve classes (O-I #855): an owner from before them states none, and then the session
  // carries none; one stated is read exact or refuses the session by name.
  const maqam = raw.maqam === undefined ? undefined : readTorusMaqam(raw.maqam);
  if (typeof maqam === 'string') return `maqam: ${maqam}`;
  const material = raw.material === undefined ? undefined : readTorusMaterial(raw.material);
  if (typeof material === 'string') return `material: ${material}`;
  const classes = raw.classes === undefined ? undefined : readTorusClasses(raw.classes);
  if (typeof classes === 'string') return `classes: ${classes}`;
  return {settings: {rate, fundamental, carrier: t.carrier, shape: t.shape, tuning: t.tuning, polyphony: t.polyphony, tempo_bpm: t.tempo_bpm,
    ...(t.strike !== undefined ? {strike: t.strike as number} : {})},
    steps_per_second: raw.steps_per_second, band: raw.band, fundamental_hz: raw.fundamental_hz, map_hz: raw.map_hz, figure: raw.figure as HostedTorusSession['figure'],
    comma_cents: raw.comma_cents, notes: raw.notes, resident_tunings: [...raw.resident_tunings] as HostedTorusSession['resident_tunings'], carrier_drive: raw.carrier_drive,
    ...(maqam ? {maqam} : {}), ...(material ? {material} : {}), ...(classes ? {classes} : {})};
}

const textOrNull = (v: unknown): v is string | null => v === null || boundedText(v, 512);
const share = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const absentOf = (raw: Record<string, unknown>): {absent: string} | null =>
  Object.keys(raw).length === 1 && boundedText(raw.absent, 1024) ? {absent: raw.absent as string} : null;
/** The M2 condition's maqām (QL scene_field.rs maqam_reading): its eight pitches while the scene holds its voices, or the owner's
 * words for their absence, exactly one of the two. */
function readTorusMaqam(raw: unknown): NonNullable<HostedTorusSession['maqam']> | string {
  if (!object(raw)) return 'expected the M2 condition\'s maqām';
  if (!textOrNull(raw.name) || !textOrNull(raw.coordinate) || !textOrNull(raw.role) || !textOrNull(raw.tuning) || !textOrNull(raw.standing)
    || !(raw.tonic_hz === null || (typeof raw.tonic_hz === 'number' && Number.isFinite(raw.tonic_hz) && raw.tonic_hz > 0)))
    return 'expected its name, coordinate, role, tonic, tuning and standing, each or null';
  const pitches = raw.pitches_hz === null ? null : Array.isArray(raw.pitches_hz) && raw.pitches_hz.length > 0
    && raw.pitches_hz.every(v => typeof v === 'number' && Number.isFinite(v) && v > 0) ? [...raw.pitches_hz as number[]] : undefined;
  if (pitches === undefined) return 'pitches_hz: expected its pitches, each a frequency, or null';
  if (!(raw.absent === null || boundedText(raw.absent, 1024))) return 'absent: expected the owner\'s words or null';
  if ((pitches === null) === (raw.absent === null)) return 'expected its pitches or the words for their absence, exactly one';
  return {name: raw.name, coordinate: raw.coordinate, role: raw.role, tonic_hz: raw.tonic_hz as number | null, tuning: raw.tuning,
    standing: raw.standing, pitches_hz: pitches, absent: raw.absent as string | null};
}
/** The lens's material (QL m2_material.rs LensMaterial), or the owner's words for none. */
function readTorusMaterial(raw: unknown): NonNullable<HostedTorusSession['material']> | string {
  if (!object(raw)) return 'expected the lens\'s material or the words for none';
  const none = absentOf(raw);
  if (none) return none;
  if (!boundedText(raw.lens, 16) || !boundedText(raw.partner, 16) || (raw.face !== 'day' && raw.face !== 'night')
    || !Number.isSafeInteger(raw.position) || (raw.position as number) < 0 || (raw.position as number) > 5 || (raw.valence !== 1 && raw.valence !== -1))
    return 'expected the lens, its partner, face, position 0..5 and valence ±1';
  if (!Array.isArray(raw.colour_rgb) || raw.colour_rgb.length !== 3 || !raw.colour_rgb.every(share)) return 'colour_rgb: expected three channels 0..1';
  if (![raw.roughness, raw.elasticity, raw.particle_affinity, raw.tension].every(share)) return 'expected roughness, elasticity, particle affinity and tension, each 0..1';
  if (!boundedText(raw.standing, 64) || !boundedText(raw.law, 1024)) return 'expected its standing and law';
  return {lens: raw.lens as string, partner: raw.partner as string, face: raw.face, position: raw.position as number, valence: raw.valence,
    colour_rgb: [...raw.colour_rgb] as [number, number, number], roughness: raw.roughness as number, elasticity: raw.elasticity as number,
    particle_affinity: raw.particle_affinity as number, tension: raw.tension as number, standing: raw.standing as string, law: raw.law as string};
}
/** The twelve classes (QL scene_field.rs class_sounds), in class order, or the owner's words for none. */
function readTorusClasses(raw: unknown): NonNullable<HostedTorusSession['classes']> | string {
  if (!object(raw)) return 'expected the twelve classes or the words for none';
  const none = absentOf(raw);
  if (none) return none;
  if (!TORUS_TUNINGS.includes(raw.tuning as never)) return 'tuning: expected logic, maqam or sky';
  if (typeof raw.steps !== 'number' || !Number.isFinite(raw.steps) || !boundedText(raw.law, 1024)) return 'expected the steps read and the law';
  if (!Array.isArray(raw.by_class) || raw.by_class.length !== 12) return 'by_class: expected the twelve classes';
  const rows: HostedTorusClass[] = [];
  for (const [c, row] of raw.by_class.entries()) {
    const angle = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
    if (!object(row) || row.pitch_class !== c || !boundedText(row.pitch_name, 16) || !object(row.key) || !Number.isSafeInteger(row.key.row)
      || !Number.isSafeInteger(row.key.column) || !object(row.point) || !angle(row.point.theta) || !angle(row.point.phi) || !angle(row.point.arc)
      || !Array.isArray(row.sounds)) return `by_class[${c}]: expected class ${c} with its name, key, point and sounds`;
    const sounds = row.sounds.map(v => object(v) && boundedText(v.mode_ref, 128) && typeof v.frequency_hz === 'number' && Number.isFinite(v.frequency_hz)
      && v.frequency_hz > 0 && typeof v.coupling === 'number' && Number.isFinite(v.coupling)
      ? {mode_ref: v.mode_ref as string, frequency_hz: v.frequency_hz, coupling: v.coupling} : null);
    if (sounds.some(v => v === null)) return `by_class[${c}].sounds: expected each voice's mode, frequency and coupling`;
    rows.push({pitch_class: c, pitch_name: row.pitch_name as string, key: {row: row.key.row as number, column: row.key.column as number},
      point: {theta: row.point.theta as number, phi: row.point.phi as number, arc: row.point.arc as number},
      sounds: sounds as HostedTorusClass['sounds'][number][]});
  }
  return {tuning: raw.tuning as HostedTorusSession['resident_tunings'][number], steps: raw.steps, by_class: rows, law: raw.law as string};
}

/** Where the Torus is heard from (O-I 856), exactly: Receiver On or Off, the owner's context and its refusal. The place is the listener's
 * own and is never announced, so any other field is refused by name. */
function readHostedReceiver(raw: unknown): NonNullable<HostedInstrumentParameters['receiver']> | string {
  if (!object(raw)) return 'expected on, context and refusal';
  const other = Object.keys(raw).find(key => key !== 'on' && key !== 'context' && key !== 'refusal');
  if (other !== undefined) return `${other}: not announced; where the Torus is heard from is the listener's own`;
  if (typeof raw.on !== 'boolean') return 'on: expected a boolean';
  if (raw.context !== 'world' && raw.context !== 'personal') return "context: expected 'world' or 'personal'";
  if (raw.refusal !== null && !boundedText(raw.refusal, 512)) return 'refusal: expected bounded text or null';
  return {on: raw.on, context: raw.context, refusal: raw.refusal as string | null};
}

/** The owner's presentation parameters, exact or refused: a value the owner does not state is refused by name, never defaulted. */
export function readHostedParameters(raw: unknown): HostedInstrumentParameters | string {
  if (!object(raw) || !object(raw.scale)) return 'parameters: expected muted, level, scale, cadence and refusal';
  if (typeof raw.muted !== 'boolean') return 'parameters.muted: expected a boolean';
  if (typeof raw.level !== 'number' || !Number.isFinite(raw.level) || raw.level < 0 || raw.level > 4) return 'parameters.level: expected the presentation gain 0..4';
  const scale = raw.scale;
  if (scale.unitsPerMetre !== null && (typeof scale.unitsPerMetre !== 'number' || !Number.isFinite(scale.unitsPerMetre) || scale.unitsPerMetre <= 0)) return 'parameters.scale.unitsPerMetre: expected a positive number or null';
  if (scale.mode !== 'domain-follow' && scale.mode !== 'manual-presentation-override' && scale.mode !== 'manual') return 'parameters.scale.mode: expected the owner mode';
  let cadence: HostedInstrumentParameters['cadence'] = null;
  if (raw.cadence !== null) {
    const c = raw.cadence;
    if (!object(c) || typeof c.rate !== 'number' || !Number.isFinite(c.rate) || c.rate < 0 || c.rate > 12 || typeof c.playing !== 'boolean' || typeof c.source !== 'string') return 'parameters.cadence: expected rate 0..12, playing and source';
    cadence = {rate: c.rate, playing: c.playing, source: c.source};
  }
  if (raw.refusal !== null && !boundedText(raw.refusal, 512)) return 'parameters.refusal: expected bounded text or null';
  // The torus's four effects: every parameter within the owner's law, or the fault named; a frame that announces none carries none.
  const effects = raw.effects === undefined ? undefined : readEffectsState(raw.effects);
  if (typeof effects === 'string') return `parameters.effects: ${effects}`;
  // The Torus's M1′ session: exact or the fault named; a frame that announces none carries none.
  const torus = raw.torus === undefined ? undefined : readHostedTorus(raw.torus);
  if (typeof torus === 'string') return `parameters.torus${/^[a-z_]+:/.test(torus) ? '.' : ': '}${torus}`;
  // Where the Torus is heard from: exact or the fault named; a frame that announces none carries none (O-I 856).
  const receiver = raw.receiver === undefined ? undefined : readHostedReceiver(raw.receiver);
  if (typeof receiver === 'string') return `parameters.receiver${/^[a-z_]+:/.test(receiver) ? '.' : ': '}${receiver}`;
  return {muted: raw.muted, level: raw.level, scale: {unitsPerMetre: scale.unitsPerMetre as number | null, mode: scale.mode}, cadence, refusal: raw.refusal as string | null,
    ...(effects ? {effects} : {}), ...(torus ? {torus} : {}), ...(receiver ? {receiver} : {})};
}

/** The instrument the frame announces: the owner reading (ql.instrument-reading/v1, parsed by the shell's reader), the owner's determinants and its presentation parameters.
 * A malformed or refused reading is carried as its named fault: the shell renders the refusal, never a plausible state. */
export function readHostedInstrument(raw: unknown): HostedInstrument {
  if (!object(raw)) return {ok: false, fault: 'instrument: expected the announced reading envelope'};
  let reading;
  try {reading = parseQlInstrumentReading(raw.reading);}
  catch (cause) {return {ok: false, fault: cause instanceof Error ? cause.message : String(cause)};}
  const determinants = readHostedDeterminants(raw.determinants);
  if (typeof determinants === 'string') return {ok: false, fault: determinants};
  const parameters = readHostedParameters(raw.parameters);
  if (typeof parameters === 'string') return {ok: false, fault: parameters};
  return {ok: true, reading, determinants, parameters};
}

/** lane-3 E22: the address the frame announces, read with the frame's own deep-link grammar: the link it names must parse back
 * whole (a ref with whitespace, a negative or overlong time, a marker that is not a ref) or the address is refused. The time is
 * kept as the link carries it (to the millisecond). The marker's name is words for the shell, never part of the link. */
export function readHostedAddress(raw: unknown): HostedAddress | null {
  if (!object(raw)) return null;
  const {scene, t, marker, markerName} = raw;
  if (scene !== undefined && typeof scene !== 'string') return null;
  if (marker !== undefined && typeof marker !== 'string') return null;
  if (t !== undefined && (typeof t !== 'number' || !Number.isFinite(t) || t < 0)) return null;
  if (markerName !== undefined && (typeof markerName !== 'string' || markerName.length > 4096 || marker === undefined)) return null;
  const parsed = parseDeepLink(formatDeepLink('', {scene, t, marker}));
  if (parsed.refused.length || parsed.address.scene !== scene || parsed.address.marker !== marker || (t === undefined) !== (parsed.address.t === undefined)) return null;
  return {...(scene !== undefined ? {scene} : {}), ...(parsed.address.t !== undefined ? {t: parsed.address.t} : {}),
    ...(marker !== undefined ? {marker} : {}), ...(typeof markerName === 'string' ? {markerName} : {})};
}

/** lane-3 E22: the whole address in the frame's own form — `?expression=…&scene=…&t=…&marker=…` — for copying and for opening
 * the frame where it stood. Only refs travel; an absent part is absent from the link. */
export function addressLink(expression: string | undefined, address: HostedAddress | undefined): string {
  return formatDeepLink('', {expression, scene: address?.scene, t: address?.t, marker: address?.marker});
}

/** The refs of an address, as the shell keeps it beside the open work (surface/types.ts engine.address): no words. */
export function addressRefs(address: HostedAddress | undefined): {scene?: string; t?: number; marker?: string} | undefined {
  if (!address) return undefined;
  const refs = {...(address.scene !== undefined ? {scene: address.scene} : {}), ...(address.t !== undefined ? {t: address.t} : {}),
    ...(address.marker !== undefined ? {marker: address.marker} : {})};
  return Object.keys(refs).length ? refs : undefined;
}

/** The frame's entry opened at a kept address: its own `scene`, `t` and `marker` parameters set in the entry's query, every
 * other parameter (mode, world, host-load, expression) kept where it stands. No address, the entry as it was. */
export function entryAtAddress(entry: string, address: HostedAddress | undefined): string {
  const refs = addressRefs(address);
  if (!refs) return entry;
  const at = entry.indexOf('?');
  return (at < 0 ? entry : entry.slice(0, at)) + formatDeepLink(at < 0 ? '' : entry.slice(at), refs);
}

/** Selection is a reading of what the application shows, never a request. */
export function readHostedState(raw: unknown): HostedAppState | null {
  if (!object(raw)) return null;
  const state: HostedAppState = {};
  if (raw.nativeScene !== undefined) {
    const s = raw.nativeScene;
    if (!object(s) || !expressionRef(s.expression_ref) || !positiveInteger(s.revision) || !boundedText(s.scene_ref)) return null;
    state.nativeScene = {expression_ref: s.expression_ref, revision: s.revision, scene_ref: s.scene_ref};
  }
  if (raw.document !== undefined) {
    if (!object(raw.document)) return null;
    const {id, name} = raw.document;
    if (id !== undefined && !boundedText(id) || name !== undefined && typeof name !== 'string') return null;
    state.document = {...(typeof id === 'string' ? {id} : {}), ...(typeof name === 'string' ? {name} : {})};
    if (state.nativeScene && id !== undefined && id !== state.nativeScene.expression_ref) return null;
  }
  for (const key of ['sceneIndex', 'sceneCount', 'automationHeld'] as const) {
    if (raw[key] === undefined) continue;
    if (!Number.isSafeInteger(raw[key]) || Number(raw[key]) < 0) return null;
    state[key] = Number(raw[key]);
  }
  for (const key of ['sceneName', 'sceneState', 'tool'] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== 'string' || String(raw[key]).length > 4096) return null;
    state[key] = String(raw[key]);
  }
  // The lens the frame stands in: one of the six holders. Absent is valid (a frame that has not reported one); any other value refuses the reading like every field here.
  if (raw.lens !== undefined) {
    if (!isDeepInstrument(raw.lens)) return null;
    state.lens = raw.lens;
  }
  for (const key of ['playing', 'journeyPlaying', 'fieldPaused', 'libraryOpen', 'recording', 'presenting', 'automationLoop', 'propertyRecording', 'propertyPreview', 'presentsInstrument', 'soundMuted'] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== 'boolean') return null;
    state[key] = raw[key] as boolean;
  }
  // Read-only camera framing and tool readings for the shell's toggles. The frame still owns them.
  if (raw.stage !== undefined) {
    const stage = raw.stage;
    if (!object(stage) || !stageOneOf(['2d', '3d'] as const, stage.mode) || typeof stage.grid !== 'boolean' || typeof stage.snap !== 'boolean' || typeof stage.guides !== 'boolean') return null;
    if (stage.tool !== undefined && !stageOneOf(STAGE_TOOL_READINGS, stage.tool)) return null;
    if (stage.repeatPins !== undefined && typeof stage.repeatPins !== 'boolean') return null;
    if (stage.videoTake !== undefined && typeof stage.videoTake !== 'boolean') return null;
    state.stage = {mode: stage.mode, grid: stage.grid, snap: stage.snap, guides: stage.guides,
      ...(stage.tool !== undefined ? {tool: stage.tool} : {}), ...(stage.repeatPins !== undefined ? {repeatPins: stage.repeatPins} : {}),
      ...(stage.videoTake !== undefined ? {videoTake: stage.videoTake} : {})};
  }
  // The native instrument the frame announces (the Live torus reads it). A reading the owner does not produce is carried as its named refusal.
  if (raw.instrument !== undefined) state.instrument = readHostedInstrument(raw.instrument);
  if (raw.hostMode !== undefined) {
    if (!isHostedAppMode(raw.hostMode)) return null;
    state.hostMode = raw.hostMode;
  }
  // T-FRAME-CHROME-ONTO-PLATES: the presentation the shell declared, and the chrome as the frame reads it. A malformed one refuses the
  // reading like every field here; absent is valid (a frame before its chrome stands, or one that predates the door).
  if (raw.presentation !== undefined) {
    if (!stageOneOf(FRAME_PRESENTATIONS, raw.presentation)) return null;
    state.presentation = raw.presentation;
  }
  if (raw.chrome !== undefined) {
    const chrome = readFrameChrome(raw.chrome);
    if (!chrome) return null;
    state.chrome = chrome;
  }
  // lane W4-Technē: the walk, the board and the ruler as the frame holds them. A malformed one refuses the reading like every field here;
  // absent is valid (a frame that predates it).
  if (raw.research !== undefined) {
    const research = readFrameResearch(raw.research);
    if (!research) return null;
    state.research = research;
  }
  if (raw.instrumentStage !== undefined) {
    const stage = readFrameStage(raw.instrumentStage);
    if (!stage) return null;
    state.instrumentStage = stage;
  }
  // W6: the live scene's M2 condition (instrumentCondition.ts). A malformed one refuses the reading; absent is valid (no inspect yet).
  if (raw.instrumentCondition !== undefined) {
    const condition = readFrameCondition(raw.instrumentCondition);
    if (!condition) return null;
    state.instrumentCondition = condition;
  }
  // The property take's append/replace mode, as the frame's own take-mode reading.
  if (raw.takeMode !== undefined) {
    if (!stageOneOf(STAGE_TAKE_MODES, raw.takeMode)) return null;
    state.takeMode = raw.takeMode;
  }
  if (raw.selection !== undefined) {
    if (!Array.isArray(raw.selection) || raw.selection.length > 10000) return null;
    const selection: {id: string; name?: string}[] = [];
    for (const entry of raw.selection) {
      if (!object(entry) || !boundedText(entry.id) || entry.name !== undefined && typeof entry.name !== 'string') return null;
      selection.push({id: entry.id, ...(typeof entry.name === 'string' ? {name: entry.name} : {})});
    }
    state.selection = selection;
  }
  // lane-3 E22: where the frame stands. Absent is valid (a link not yet settled); a malformed address refuses the reading.
  if (raw.address !== undefined) {
    const address = readHostedAddress(raw.address);
    if (!address) return null;
    state.address = address;
  }
  // A bare {} is not evidence the application started. The real app always
  // announces its cut and concrete scene count, even while native boot waits.
  if (!isHostedAppMode(state.hostMode) || state.sceneCount === undefined) return null;
  return state;
}

/** The frame's routed Return (lane-5 T19 Accept): one disclosed native action, the subject it names, the reading the proposal was
 * made from, the reading request the owner re-reads, and the human actor the Return is attributed to. The frame asserts no
 * authority: the owner decides whether the reading still offers the action. */
export interface FrameActionRequest {
  operation: 'invoke_action';
  route: TechneActionRoute;
  reading_ref: string;
  reading_request: {expression_ref: string; revision: number; scene_ref: string; scope?: 'expression'};
  actor: string;
}
/** Parse one frame action exactly. Anything else is null: the gate refuses it by name and the owner never sees it. */
export function readFrameActionRequest(raw: unknown): FrameActionRequest | null {
  if (!object(raw) || raw.operation !== 'invoke_action' || !object(raw.route) || !object(raw.reading_request)) return null;
  const route = raw.route, reading = raw.reading_request;
  if (!boundedText(route.action_ref, 256) || !boundedText(route.subject_ref) || !boundedText(raw.reading_ref) || !boundedText(raw.actor, 256)) return null;
  if (route.selection_ref !== undefined && route.selection_ref !== null && !boundedText(route.selection_ref)) return null;
  if (route.input !== undefined && !object(route.input)) return null;
  if (!expressionRef(reading.expression_ref) || !positiveInteger(reading.revision) || !boundedText(reading.scene_ref)) return null;
  if (reading.scope !== undefined && reading.scope !== 'expression') return null;
  return {
    operation: 'invoke_action',
    route: {action_ref: route.action_ref, subject_ref: route.subject_ref, selection_ref: (route.selection_ref as string | null | undefined) ?? null,
      ...(route.input !== undefined ? {input: route.input} : {})},
    reading_ref: raw.reading_ref,
    reading_request: {expression_ref: reading.expression_ref, revision: reading.revision, scene_ref: reading.scene_ref,
      ...(reading.scope === 'expression' ? {scope: 'expression' as const} : {})},
    actor: raw.actor,
  };
}
export type FrameActionVerdict = {ok: true; action: string; target_ref: string; input: Record<string, unknown>} | {ok: false; reason: string};
/** The owner's decision over the reading it re-read: a proposal from an earlier reading is stale; a route the reading does not
 * offer (or that names another subject) is refused by the routing law, by name. An offered action is returned with the actor and
 * the source reading attached to its input. Pure: nothing is invoked here. */
export function decideFrameAction(reading: TechneReading, request: FrameActionRequest): FrameActionVerdict {
  if (reading.reading_ref !== request.reading_ref) {
    return {ok: false, reason: `stale: the proposal was made from reading ${request.reading_ref}, and the owner now discloses ${reading.reading_ref}; propose the Return again`};
  }
  let receipt;
  try {receipt = resolveActionRoute(reading, request.route);}
  catch (cause) {return {ok: false, reason: cause instanceof Error ? cause.message : String(cause)};}
  if (!receipt.routed) return {ok: false, reason: receipt.reason ?? `action ${request.route.action_ref} is not offered by reading ${reading.reading_ref}`};
  return {
    ok: true,
    action: request.route.action_ref,
    target_ref: request.route.subject_ref,
    input: {...((request.route.input as Record<string, unknown> | undefined) ?? {}), actor: request.actor, source_reading_ref: reading.reading_ref},
  };
}

// lane-3 E21: the frame asks the owner where its selected subject stands in the wiki projections. One typed request and one
// reply, matched by req on the boundary channel. The owner answers for the exact basis it holds for the frame's Scene.
export const WIKI_SUBJECT_STANDING_CHANNEL = 'wiki-subject-standing';
export interface WikiSubjectStandingRequest {subject_ref: string; expression_ref: string; revision: number;}
export interface WikiSubjectStandingRow {register_key: string; expression_ref: string; scene_ref: string; scene_title: string; entity_ref: string; entity_title: string; subject_ref: string;}
export interface WikiSubjectStandingReply {subject_ref: string; expression_ref: string; revision: number; standing_revision: number; rows: WikiSubjectStandingRow[];}
/** Parse one frame standing request exactly. Anything else is null, and the boundary refuses it by name. */
export function readWikiSubjectStandingRequest(raw: unknown): WikiSubjectStandingRequest | null {
  if (!object(raw) || !boundedText(raw.subject_ref, 512) || !expressionRef(raw.expression_ref) || !positiveInteger(raw.revision)) return null;
  return {subject_ref: raw.subject_ref, expression_ref: raw.expression_ref, revision: raw.revision};
}
// O-I #768: a scene made of a constellation keeps it as its body, a knowledge whole (DLW §16.5, §20.1). The frame resolves the whole it
// places from the wiki's own reading of it: one typed request naming the whole's wiki ref, and one reply, matched by req on the boundary
// channel. The owner answers from the one wiki projection the shell reads (live-shell native/wikiSubjectStanding.ts).
export const KNOWLEDGE_WHOLE_CHANNEL = 'knowledge-whole';
/** The longest wiki ref a whole is named by (AIKit keeps a task's source at the same bound, encounter_task_settings.rs). */
export const KNOWLEDGE_WHOLE_REF_MAX = 1024;
export interface KnowledgeWholeRequest {ref: string;}
/** One reading of a constellation's whole, as the wiki discloses it: its subject reading, the readings it was observed through, its
 * name and the register that holds it. `requested_ref` is the ref asked for, so the frame refuses an answer about another whole. */
export interface KnowledgeWholeReading {
  requested_ref: string;
  ref: string;
  native_owner: string;
  title: string;
  register: string;
  reading: KnowledgeWholeReadingRef;
  provenance: KnowledgeWholeReadingRef[];
}
/** A reading ref as the kernel keeps one (expression.rs ReadingRef; the frame's kernelDocumentBridge.ts KernelReadingRef). */
export interface KnowledgeWholeReadingRef {ref: string; revision: string; availability: 'available' | 'unavailable' | 'withheld' | 'stale';}
/** Parse one frame knowledge-whole request exactly: a wiki ref and nothing else. Anything else is null, refused by name. */
export function readKnowledgeWholeRequest(raw: unknown): KnowledgeWholeRequest | null {
  if (!object(raw) || Object.keys(raw).some(key => key !== 'ref')) return null;
  const ref = raw.ref;
  if (!boundedText(ref, KNOWLEDGE_WHOLE_REF_MAX) || !ref.startsWith('wiki:') || ref.length <= 'wiki:'.length || ref !== ref.trim()) return null;
  return {ref};
}
export interface HostTarget {
  bindingId: string;
  epoch: number;
  scene: NonNullable<HostedAppState['nativeScene']>;
}
export interface ChannelContext {
  mode: HostedAppMode;
  bindingId: string;
  epoch: number;
  signal: AbortSignal;
  state: HostedAppState | null;
  current: () => boolean;
}
/** Owners answer through their real native seam. Returning data does not
 * imply saving: its native operation's receipt determines that outcome. */
export type ChannelOwner = (request: unknown, context: ChannelContext) => Promise<unknown>;
export interface ExpressionsOwners {
  channels: Readonly<Record<string, ChannelOwner>>;
  unavailableReason?: string;
  native?: ChannelOwner;
  /** Existing bounded facades (Nara/Epii) attach here, below the origin guard. */
  attach?: (frame: HTMLIFrameElement, state: () => HostedAppState | null) => () => void;
}
