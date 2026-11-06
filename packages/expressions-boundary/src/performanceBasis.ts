// The presets' owner path (ticket T-LIVE-TORUS-INSTRUMENT leg 6; the kernel's PerformanceBasis, desktop/cradle/kernel/src/expression_performance.rs).
// The owner persists an instrument state as a PerformanceBasis (schema oi.expression-performance-basis/v1), digest-sealed by the kernel and
// admitted by PerformanceOperation::AdmitBasis into a Scene's retained performance (oi.expression-performance/v3).
//
// This module holds only what the boundary may do with that record: validate the frame's request, summarise the bases the kernel reads back,
// refuse a save by name where the native readings are absent, and turn a recalled basis into instrument edits (or name what cannot be
// applied). It never seals or hashes a basis: every digest here is the kernel's own, read back from its inspected document.
import {readInstrumentEdit, STAGE_TORUS_TAKE_BYTES_MAX, type InstrumentEdit} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts';

export const PERFORMANCE_BASIS_SCHEMA = 'oi.expression-performance-basis/v1';
/** The native readings a PerformanceBasis needs from its producer (kernel validate_content). The frame holds none of them today. */
export const REQUIRED_NATIVE_READINGS = Object.freeze(['m2_plan', 'audio_determination', 'm3_score', 'm3_replay', 'prepared_body', 'tuning', 'force_state', 'form_state'] as const);
/** Basis fields the instrument command cannot apply when recalled (they are native performance state, not instrument settings). */
const NOT_INSTRUMENT_FIELDS = Object.freeze(['m2_plan', 'audio_determination', 'm3_score', 'm3_replay', 'prepared_body', 'tuning', 'force_state', 'form_state', 'm4_episode'] as const);

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const closed = (raw: Record<string, unknown>, keys: readonly string[]) => Object.keys(raw).every(key => keys.includes(key));
const refText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value);

/** A preset name: one trimmed line, 1–64 characters, no control characters. */
export function readPresetName(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64 || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

/** The Scene's performance actions: list its presets and what it keeps on the Torus; save a preset (refused by name); recall a preset; read
 * a kept sound back whole by its ref, to open it; keep a sound the kernel sealed; keep, by `name`, the form's body a kept sound rings
 * on as an instrument with the sounds made on it (O-I #852); and keep, by `name`, the rack the Torus's rack face holds (DLW build ruling,
 * 4 November). */
export type PerformanceAction = {action: 'list'} | {action: 'save'; name: string} | {action: 'recall'; basis_ref: string}
  | {action: 'sound'; sound_ref: string} | {action: 'keep-sound'; sound: Readonly<Record<string, unknown>>}
  | {action: 'keep-instrument'; name: string; sound_ref: string} | {action: 'keep-rack'; name: string; rack: TorusRackDraft}
  /** A Torus take laid under the Scene (O-I #855): the record live/liveTake.ts torusTakeRecord builds from the take the kernel sealed. */
  | {action: 'record-take'; record: TorusTakeRecordEdit}
  /** A stretch of a Torus take lane comped into the row's main lane, and a take lane's Activator and Solo (O-I #855 round 25; DLW build
   * ruling 2026-11-05: "give the Torus take lanes Audition and Comp, and show their Activator and Solo, as Live's take lanes have them"). */
  | ({action: 'comp-take'} & TakeCompStretch) | {action: 'take-lane'; lane_ref: string; enabled: boolean; solo: boolean};
export type FramePerformanceRequest = PerformanceAction & {operation: 'performance'; expression_ref: string; scene_ref: string};

/** A frame or host performance request, exact in shape, or null. Every key is closed to its action. */
export function readFramePerformanceRequest(raw: unknown): FramePerformanceRequest | null {
  if (!object(raw) || raw.operation !== 'performance' || !refText(raw.expression_ref) || !refText(raw.scene_ref)) return null;
  const base = {operation: 'performance' as const, expression_ref: raw.expression_ref, scene_ref: raw.scene_ref};
  const common = ['operation', 'action', 'expression_ref', 'scene_ref'];
  if (raw.action === 'list') return closed(raw, common) ? {...base, action: 'list'} : null;
  if (raw.action === 'save') {
    const name = closed(raw, [...common, 'name']) ? readPresetName(raw.name) : null;
    return name === null ? null : {...base, action: 'save', name};
  }
  if (raw.action === 'recall') {
    return closed(raw, [...common, 'basis_ref']) && typeof raw.basis_ref === 'string' && DIGEST.test(raw.basis_ref)
      ? {...base, action: 'recall', basis_ref: raw.basis_ref} : null;
  }
  if (raw.action === 'sound') {
    return closed(raw, [...common, 'sound_ref']) && typeof raw.sound_ref === 'string' && DIGEST.test(raw.sound_ref)
      ? {...base, action: 'sound', sound_ref: raw.sound_ref} : null;
  }
  if (raw.action === 'keep-sound') {
    const sound = closed(raw, [...common, 'sound']) ? readTorusSound(raw.sound) : null;
    return sound ? {...base, action: 'keep-sound', sound} : null;
  }
  if (raw.action === 'keep-instrument') {
    return closed(raw, [...common, 'name', 'sound_ref']) && keptName(raw.name) && typeof raw.sound_ref === 'string' && DIGEST.test(raw.sound_ref)
      ? {...base, action: 'keep-instrument', name: raw.name, sound_ref: raw.sound_ref} : null;
  }
  if (raw.action === 'record-take') {
    const record = closed(raw, [...common, 'record']) ? readTakeRecord(raw.record) : null;
    return record ? {...base, action: 'record-take', record} : null;
  }
  if (raw.action === 'keep-rack') {
    const rack = closed(raw, [...common, 'name', 'rack']) && keptName(raw.name) ? readRackDraft(raw.rack) : null;
    return rack ? {...base, action: 'keep-rack', name: raw.name as string, rack} : null;
  }
  if (raw.action === 'comp-take') {
    if (!closed(raw, [...common, 'lane_ref', 'start_sample', 'end_sample']) || !takeLane(raw.lane_ref)) return null;
    const start = counter(raw.start_sample), end = counter(raw.end_sample);
    return start !== null && end !== null && start < end
      ? {...base, action: 'comp-take', lane_ref: raw.lane_ref, start_sample: raw.start_sample as string, end_sample: raw.end_sample as string} : null;
  }
  if (raw.action === 'take-lane') {
    return closed(raw, [...common, 'lane_ref', 'enabled', 'solo']) && takeLane(raw.lane_ref) && typeof raw.enabled === 'boolean' && typeof raw.solo === 'boolean'
      ? {...base, action: 'take-lane', lane_ref: raw.lane_ref, enabled: raw.enabled, solo: raw.solo} : null;
  }
  return null;
}

/** A Torus take lane's layer ref (kernel expression_performance/torus.rs: a take lane is a layer `take-lane:torus/<n>`). */
const TORUS_TAKE_LANE = 'take-lane:torus/';
const takeLane = (value: unknown): value is string => refText(value) && value.startsWith(TORUS_TAKE_LANE) && value.length > TORUS_TAKE_LANE.length;
/** A sample of the Scene's transport as the kernel's Counter carries it: a decimal u64 in a string, or null. */
const counter = (value: unknown): bigint | null => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(value)) return null;
  const n = BigInt(value);
  return n <= 0xffffffffffffffffn ? n : null;
};
/** A stretch of a take lane the row's main lane sounds (kernel torus.rs TakeComp): its lane and from and to which sample. */
export interface TakeCompStretch {readonly lane_ref: string; readonly start_sample: string; readonly end_sample: string}

/** A name as the kernel keeps one on the Torus (kernel expression_performance/kept.rs `name`, MAX_NAME): 1 to 120 characters, not blank,
 * no control character. */
export const KEPT_NAME_MAX = 120;
const keptName = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && [...value].length <= KEPT_NAME_MAX
  && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
/** The most a sound carries across the boundary: its checkpoint (the stage's bound, 1 MiB) and a body beside it. */
const SOUND_BYTES_MAX = 2 * 1024 * 1024;
/** A sound the kernel sealed (`oi.torus-sound/v1`), carried whole within its bound, or null. Its seal is the kernel's to judge. */
function readTorusSound(raw: unknown): Readonly<Record<string, unknown>> | null {
  if (!object(raw) || raw.schema !== 'oi.torus-sound/v1' || typeof raw.sound_ref !== 'string' || !DIGEST.test(raw.sound_ref) || !keptName(raw.name)) return null;
  let bytes: number;
  try { bytes = new TextEncoder().encode(JSON.stringify(raw)).length; } catch { return null; }
  return bytes <= SOUND_BYTES_MAX ? raw : null;
}

/** A Torus take as the frame lays it under the Scene (kernel expression_performance.rs RecordTorusTake, `record_torus_take`; O-I #855): the
 * take the kernel sealed (native-expression `torus_take`, `oi.torus-take/v1`, carried whole: the seal is the kernel's to judge), its take lane,
 * the sample of the Scene's transport it lies from and the tempo it lies on. */
export interface TorusTakeRecordEdit {
  readonly operation: 'record_torus_take'
  readonly take: Readonly<Record<string, unknown>>
  readonly lane: {readonly layer_ref: string; readonly title: string; readonly enabled: boolean; readonly solo: boolean}
  readonly at_sample: string
  readonly micros_per_quarter: number
}
/** A take record exact in shape, its take the kernel's `oi.torus-take/v1` within its bound (the stage's STAGE_TORUS_TAKE_BYTES_MAX, the
 * kernel's own bound on what crosses to it), or null. */
function readTakeRecord(raw: unknown): TorusTakeRecordEdit | null {
  if (!object(raw) || !closed(raw, ['operation', 'take', 'lane', 'at_sample', 'micros_per_quarter']) || raw.operation !== 'record_torus_take') return null;
  const take = raw.take, lane = raw.lane;
  if (!object(take) || take.schema !== 'oi.torus-take/v1' || typeof take.seal !== 'string' || !refText(take.take_ref) || !Number.isSafeInteger(take.sample_rate)) return null;
  if (!object(lane) || !closed(lane, ['layer_ref', 'title', 'enabled', 'solo']) || !refText(lane.layer_ref) || !keptName(lane.title)
    || typeof lane.enabled !== 'boolean' || typeof lane.solo !== 'boolean') return null;
  if (typeof raw.at_sample !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(raw.at_sample)) return null;
  if (!Number.isSafeInteger(raw.micros_per_quarter) || (raw.micros_per_quarter as number) < 1 || (raw.micros_per_quarter as number) > 0xffffffff) return null;
  let bytes: number;
  try { bytes = new TextEncoder().encode(JSON.stringify(take)).length; } catch { return null; }
  return bytes <= STAGE_TORUS_TAKE_BYTES_MAX ? raw as unknown as TorusTakeRecordEdit : null;
}

export interface PerformanceBasisSummary {readonly basis_ref: string; readonly event_ref: string; readonly m1_coordinate: string}
/** A sound the Scene keeps (kernel kept.rs `oi.torus-sound/v1`): its digest and name as the kernel holds them, and what it rings on. */
export interface KeptSoundSummary {readonly sound_ref: string; readonly name: string; readonly body: 'torus' | 'form'; readonly body_ref: string | null; readonly sample_rate: number}
/** An instrument the Scene keeps (`oi.torus-instrument/v1`): a form's body, with the sounds made on it that the Scene keeps. */
export interface KeptInstrumentSummary {readonly instrument_ref: string; readonly name: string; readonly body_ref: string; readonly sounds: readonly KeptSoundSummary[]}
/** One device of a kept rack's chain: its reference, and whether it plays before the Torus (a note device) or after it (an effect). */
export interface KeptRackDevice {readonly device_ref: string; readonly role: 'note' | 'effect'
  /** The settings the device kept, each by its own name (an effect's are its law's, native-field/effectsLaw.ts): its drop carries them
   * onto Live's device where the corpus pins the setting (O-I #852 round 10). */
  readonly state: Readonly<Record<string, number | boolean | string>>}
/** One parameter a macro turns (a device of the chain's, or the Torus's), over its range: the macro at 0 sets `min`, at 1 `max` (kernel
 * kept.rs MacroTarget). */
export interface KeptMacroTarget {readonly device_ref: string; readonly parameter: string; readonly min: number; readonly max: number}
/** One macro of a kept rack: its name, where it stands (0 to 1), and the parameters it turns, each over its range. */
export interface KeptRackMacro {readonly name: string; readonly value: number; readonly targets: readonly KeptMacroTarget[]}
/** One variation of a kept rack: its name, and a value for every macro, in macro order. */
export interface KeptRackVariation {readonly name: string; readonly values: readonly number[]}
/** A rack the Scene keeps (`oi.torus-rack/v1`): the Torus with its chain, its macros and their variations, as its drop places them on a
 * part (O-I #852: Live's Instrument Rack, packages/live-set/src/acts.rs `rack_place`). */
export interface KeptRackSummary {readonly rack_ref: string; readonly name: string; readonly sound: string | null; readonly chain: readonly KeptRackDevice[]
  readonly macros: readonly KeptRackMacro[]; readonly variations: readonly KeptRackVariation[]}
/** What the Scene keeps on the Torus (manual §21.2 Sounds and instruments): the sounds that stand under the Torus itself, the
 * instruments with their sounds under them, and the racks. */
export interface TorusKeptSummary {readonly sounds: readonly KeptSoundSummary[]; readonly instruments: readonly KeptInstrumentSummary[]; readonly racks: readonly KeptRackSummary[]}
export type PerformanceReply =
  | {readonly state: 'listed'; readonly bases: readonly PerformanceBasisSummary[]; readonly kept?: TorusKeptSummary}
  | {readonly state: 'refused'; readonly reason: string; readonly missing: readonly string[]}
  | {readonly state: 'recalled'; readonly basis_ref: string; readonly edits: readonly InstrumentEdit[]; readonly not_applied: readonly {readonly field: string; readonly reason: string}[]}
  /** A kept sound as the Scene keeps it, whole, to open (O-I #852). */
  | {readonly state: 'sound'; readonly sound: Readonly<Record<string, unknown>>}
  /** A sound the Scene now keeps, and all it keeps on the Torus then; `unsaved` while the Expression is not yet written with it. */
  | {readonly state: 'kept'; readonly sound_ref: string; readonly name: string; readonly unsaved: boolean; readonly kept: TorusKeptSummary | null}
  /** An instrument the Scene now keeps, with how many sounds stand under it, and all it keeps on the Torus then (O-I #852). */
  | {readonly state: 'instrument-kept'; readonly instrument_ref: string; readonly name: string; readonly sounds: number; readonly unsaved: boolean
    readonly kept: TorusKeptSummary | null}
  /** A rack the Scene now keeps, with how many macros and variations it holds, and all it keeps on the Torus then (DLW build ruling, 4 November). */
  | {readonly state: 'rack-kept'; readonly rack_ref: string; readonly name: string; readonly macros: number; readonly variations: number; readonly unsaved: boolean
    readonly kept: TorusKeptSummary | null}
  /** A Torus take the Scene now lays under it (O-I #855): the take by its ref, its lane and the sample it lies from. */
  | {readonly state: 'take-recorded'; readonly take_ref: string; readonly lane_ref: string; readonly at_sample: string; readonly unsaved: boolean}
  /** A stretch of a take lane the Scene's main lane now sounds (O-I #855 round 25). */
  | ({readonly state: 'take-comped'; readonly unsaved: boolean} & TakeCompStretch)
  /** A take lane's Activator and Solo as the Scene now holds them (O-I #855 round 25). */
  | {readonly state: 'take-lane-set'; readonly lane_ref: string; readonly enabled: boolean; readonly solo: boolean; readonly unsaved: boolean};

/** The bases the kernel reports for a Scene: each digest and identity exactly as the kernel holds it. A malformed record is not listed. */
export function summarizePerformanceBases(bases: unknown): PerformanceBasisSummary[] {
  if (!Array.isArray(bases)) return [];
  const listed: PerformanceBasisSummary[] = [];
  for (const basis of bases) {
    if (!object(basis) || basis.schema !== PERFORMANCE_BASIS_SCHEMA || typeof basis.content_digest !== 'string' || !DIGEST.test(basis.content_digest)) continue;
    const identity = object(basis.identity) ? basis.identity : null;
    if (!identity || !refText(identity.event_ref) || typeof basis.m1_coordinate !== 'string') continue;
    listed.push({basis_ref: basis.content_digest, event_ref: identity.event_ref, m1_coordinate: basis.m1_coordinate});
  }
  return listed;
}

const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const preparationOf = (body: unknown): string | null => object(body) && object(body.request) && refText(body.request.preparation_ref) ? body.request.preparation_ref : null;

function keptSound(raw: unknown): KeptSoundSummary | null {
  if (!object(raw) || raw.schema !== 'oi.torus-sound/v1' || typeof raw.sound_ref !== 'string' || !DIGEST.test(raw.sound_ref) || !keptName(raw.name)) return null;
  if (typeof raw.sample_rate !== 'number' || !Number.isInteger(raw.sample_rate) || raw.sample_rate <= 0 || !object(raw.body)) return null;
  if (raw.body.kind === 'torus') return {sound_ref: raw.sound_ref, name: raw.name, body: 'torus', body_ref: null, sample_rate: raw.sample_rate};
  const body_ref = raw.body.kind === 'form' ? preparationOf(raw.body.prepared) : null;
  return body_ref === null ? null : {sound_ref: raw.sound_ref, name: raw.name, body: 'form', body_ref, sample_rate: raw.sample_rate};
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const share = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;
/** The most settings a kept device's state is read with (the Torus's effects keep at most nine, native-field/effectsLaw.ts). */
const KEPT_DEVICE_SETTINGS = 32;
/** A kept device's state as a flat record of settings, each a finite number, a switch or a word; null where it is anything else. */
function keptSettings(raw: unknown): Record<string, number | boolean | string> | null {
  if (!object(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length > KEPT_DEVICE_SETTINGS) return null;
  for (const [key, value] of entries) {
    if (!refText(key)) return null;
    if (typeof value === 'number' ? !Number.isFinite(value) : typeof value === 'string' ? !refText(value) : typeof value !== 'boolean') return null;
  }
  return Object.fromEntries(entries) as Record<string, number | boolean | string>;
}
/** A kept rack's chain, macros and variations as the kernel validated them (kept.rs `KeptRack::validate`), or null where a row is not
 * what it says: a device a note device or an effect, a macro and each variation's values shares of 0 to 1, a value for every macro. */
function keptRackRows(raw: Record<string, unknown>): Pick<KeptRackSummary, 'chain' | 'macros' | 'variations'> | null {
  if (!Array.isArray(raw.chain) || !Array.isArray(raw.macros) || !Array.isArray(raw.variations)) return null;
  const chain: KeptRackDevice[] = [];
  for (const row of raw.chain) {
    const state = object(row) ? keptSettings(row.state) : null;
    if (!object(row) || !refText(row.device_ref) || (row.role !== 'note' && row.role !== 'effect') || !state) return null;
    chain.push({device_ref: row.device_ref, role: row.role, state});
  }
  const macros: KeptRackMacro[] = [];
  for (const row of raw.macros) {
    if (!object(row) || !keptName(row.name) || !share(row.value) || !Array.isArray(row.targets)) return null;
    const targets = row.targets.map(target => object(target) && refText(target.device_ref) && refText(target.parameter) && finite(target.min) && finite(target.max)
      ? {device_ref: target.device_ref, parameter: target.parameter, min: target.min, max: target.max} : null);
    if (targets.includes(null)) return null;
    macros.push({name: row.name, value: row.value, targets: targets as KeptRackMacro['targets']});
  }
  const variations: KeptRackVariation[] = [];
  for (const row of raw.variations) {
    if (!object(row) || !keptName(row.name) || !Array.isArray(row.values) || row.values.length !== macros.length || !row.values.every(share)) return null;
    variations.push({name: row.name, values: [...row.values]});
  }
  return {chain, macros, variations};
}

/** What the Scene keeps on the Torus, each record as the kernel holds it (kernel expression_performance/kept.rs, `torus_kept`): a sound
 * made on a kept instrument stands under that instrument, in its order, and not again under the Torus; a record that is not what it
 * says, or an instrument's sound the Scene does not keep, is not listed. Null when the Scene keeps nothing. Reads only: the kernel
 * sealed and validated every record when the Scene kept it. */
export function summarizeTorusKept(kept: unknown): TorusKeptSummary | null {
  if (!object(kept)) return null;
  const sounds = new Map<string, KeptSoundSummary>();
  for (const raw of list(kept.sounds)) { const sound = keptSound(raw); if (sound && !sounds.has(sound.sound_ref)) sounds.set(sound.sound_ref, sound); }
  const onInstrument = new Set<string>();
  const instruments: KeptInstrumentSummary[] = [];
  for (const raw of list(kept.instruments)) {
    const body_ref = object(raw) ? preparationOf(raw.body) : null;
    if (!object(raw) || raw.schema !== 'oi.torus-instrument/v1' || !refText(raw.instrument_ref) || !keptName(raw.name) || body_ref === null) continue;
    const made = list(raw.sounds).flatMap(ref => typeof ref === 'string' && sounds.has(ref) ? [sounds.get(ref)!] : []);
    for (const sound of made) onInstrument.add(sound.sound_ref);
    instruments.push({instrument_ref: raw.instrument_ref, name: raw.name, body_ref, sounds: made});
  }
  const racks: KeptRackSummary[] = [];
  for (const raw of list(kept.racks)) {
    if (!object(raw) || raw.schema !== 'oi.torus-rack/v1' || !refText(raw.rack_ref) || !keptName(raw.name)) continue;
    const rows = keptRackRows(raw);
    if (rows) racks.push({rack_ref: raw.rack_ref, name: raw.name, sound: typeof raw.sound === 'string' && sounds.has(raw.sound) ? raw.sound : null, ...rows});
  }
  const torus = [...sounds.values()].filter(sound => !onInstrument.has(sound.sound_ref));
  return torus.length || instruments.length || racks.length ? {sounds: torus, instruments, racks} : null;
}

/** The owner's listing of the presented Scene's performance: its bases (the presets), and what it keeps on the Torus when it keeps any. */
export function listPerformance(performance: unknown): Extract<PerformanceReply, {state: 'listed'}> {
  const bases = summarizePerformanceBases(object(performance) ? performance.bases : []);
  const kept = summarizeTorusKept(object(performance) ? performance.torus_kept : undefined);
  return kept ? {state: 'listed', bases, kept} : {state: 'listed', bases};
}

/** The one edit that keeps a sound the kernel sealed in the Scene's performance (kernel expression.rs `scene_performance_edit`, the
 * performance's `keep_torus_sound`): the kernel opens the Scene's performance with it, or keeps it in the one the Scene has, and refuses
 * in its words a sound it did not seal or one the Scene keeps already. */
export function keepSoundChange(sceneRef: string, sound: Readonly<Record<string, unknown>>) {
  return {change: 'scene_performance_edit', scene_ref: sceneRef, operations: [{operation: 'keep_torus_sound', sound}]};
}
/** What the Scene keeps once the edit is made: the sound kept, by its ref and name, with all the Scene keeps on the Torus; refused in
 * words where the Scene does not keep it. */
export function keptSoundReply(performance: unknown, sound: Readonly<Record<string, unknown>>, unsaved: boolean): PerformanceReply {
  const kept = listPerformance(performance).kept ?? null, ref = String(sound.sound_ref), name = String(sound.name);
  const keeps = !!kept && [...kept.sounds, ...kept.instruments.flatMap(instrument => instrument.sounds)].some(row => row.sound_ref === ref);
  return keeps ? {state: 'kept', sound_ref: ref, name, unsaved, kept} : {state: 'refused', reason: `The Scene did not keep "${name}".`, missing: []};
}
/** An instrument as the kernel keeps one (kernel kept.rs `KeptInstrument`, `oi.torus-instrument/v1`). */
export interface TorusInstrumentRecord {readonly schema: 'oi.torus-instrument/v1'; readonly instrument_ref: string; readonly name: string
  readonly body: Readonly<Record<string, unknown>>; readonly sounds: readonly string[]}
/** The instrument a kept sound's body makes (manual §21.2: "A body made from a form, with the sounds made on it"): the form's body as its
 * owner prepared it, and every sound the Scene keeps on that body, in its order. One body is one instrument, by its preparation, so
 * keeping it again replaces it with the sounds made on it since. A sound on the torus itself, or one the Scene does not keep, makes
 * none, said by why. Pure. */
export function instrumentToKeep(performance: unknown, name: string, soundRef: string): {instrument: TorusInstrumentRecord} | {reason: string} {
  const sounds = list(object(performance) && object(performance.torus_kept) ? performance.torus_kept.sounds : undefined)
    .flatMap(raw => { const sound = readTorusSound(raw), summary = sound && keptSound(sound); return summary ? [{sound: sound!, summary}] : []; });
  const chosen = sounds.find(row => row.summary.sound_ref === soundRef);
  if (!chosen) return {reason: `The Scene keeps no sound ${soundRef}.`};
  const body = chosen.summary.body_ref, prepared = object(chosen.sound.body) ? chosen.sound.body.prepared : null;
  if (body === null || !object(prepared)) return {reason: `"${chosen.summary.name}" rings on the torus itself, and an instrument is a form's body with the sounds made on it. Make a form the body, save a sound on it, then keep it.`};
  return {instrument: {schema: 'oi.torus-instrument/v1', instrument_ref: `instrument:${body}`, name, body: prepared,
    sounds: sounds.filter(row => row.summary.body_ref === body).map(row => row.summary.sound_ref)}};
}
/** The one edit that keeps an instrument in the Scene's performance (the performance's `keep_torus_instrument`): the kernel keeps it, or
 * replaces the one it keeps under the same ref, and refuses in its words a body or a sound it does not hold. */
export function keepInstrumentChange(sceneRef: string, instrument: TorusInstrumentRecord) {
  return {change: 'scene_performance_edit', scene_ref: sceneRef, operations: [{operation: 'keep_torus_instrument', instrument}]};
}
/** What the Scene keeps once the instrument's edit is made: the instrument by its ref and name, how many sounds stand under it, with all
 * the Scene keeps on the Torus; refused in words where the Scene does not keep it. */
export function keptInstrumentReply(performance: unknown, instrument: TorusInstrumentRecord, unsaved: boolean): PerformanceReply {
  const kept = listPerformance(performance).kept ?? null;
  const row = kept?.instruments.find(item => item.instrument_ref === instrument.instrument_ref);
  return row ? {state: 'instrument-kept', instrument_ref: row.instrument_ref, name: row.name, sounds: row.sounds.length, unsaved, kept}
    : {state: 'refused', reason: `The Scene did not keep "${instrument.name}".`, missing: []};
}

/** What the Torus's rack face holds to keep as a rack (DLW build ruling, 4 November): the sound its Torus opens with, when it opens one; its
 * chain, its macros each with its range, and its variations, as kept.rs KeptRack holds them. */
export interface TorusRackDraft {readonly sound?: string; readonly chain: readonly KeptRackDevice[]; readonly macros: readonly KeptRackMacro[]
  readonly variations: readonly KeptRackVariation[]}
/** A kept rack's bounds (kernel kept.rs MAX_RACK_DEVICES, MAX_MACROS, MAX_MACRO_TARGETS, MAX_VARIATIONS). */
const RACK_BOUNDS = {devices: 64, macros: 16, targets: 32, variations: 128} as const;
/** A rack draft, exact in shape and within the rack's bounds, or null. What it turns and opens is the kernel's to judge. */
function readRackDraft(raw: unknown): TorusRackDraft | null {
  if (!object(raw) || !closed(raw, ['sound', 'chain', 'macros', 'variations'])) return null;
  if (raw.sound !== undefined && (typeof raw.sound !== 'string' || !DIGEST.test(raw.sound))) return null;
  if (!Array.isArray(raw.chain) || raw.chain.length > RACK_BOUNDS.devices || !Array.isArray(raw.macros) || raw.macros.length > RACK_BOUNDS.macros
    || !Array.isArray(raw.variations) || raw.variations.length > RACK_BOUNDS.variations) return null;
  if (!raw.chain.every(row => object(row) && closed(row, ['device_ref', 'role', 'state'])) || !raw.variations.every(row => object(row) && closed(row, ['name', 'values']))
    || !raw.macros.every(row => object(row) && closed(row, ['name', 'value', 'targets']) && Array.isArray(row.targets) && row.targets.length <= RACK_BOUNDS.targets
      && row.targets.every(target => object(target) && closed(target, ['device_ref', 'parameter', 'min', 'max'])))) return null;
  const rows = keptRackRows(raw);
  return rows ? {...(raw.sound === undefined ? {} : {sound: raw.sound}), ...rows} : null;
}
/** A rack as the kernel keeps one (kernel kept.rs `KeptRack`, `oi.torus-rack/v1`). */
export interface TorusRackRecord extends TorusRackDraft {readonly schema: 'oi.torus-rack/v1'; readonly rack_ref: string; readonly name: string}
/** The rack the face holds, kept under its name (manual §21.2: "A rack | The Torus with its note devices and effects, its macros and their
 * variations"): its ref is its name, so keeping it again by name replaces it, as a preset saved again under its name. A sound the Scene does
 * not keep opens none, said by why. Pure. */
export function rackToKeep(performance: unknown, name: string, draft: TorusRackDraft): {rack: TorusRackRecord} | {reason: string} {
  if (draft.sound !== undefined) {
    const sounds = list(object(performance) && object(performance.torus_kept) ? performance.torus_kept.sounds : undefined);
    if (!sounds.some(raw => keptSound(raw)?.sound_ref === draft.sound)) return {reason: `The Scene keeps no sound ${draft.sound} for the rack to open.`};
  }
  return {rack: {schema: 'oi.torus-rack/v1', rack_ref: `rack:torus/${name.trim()}`, name, ...draft}};
}
/** The one edit that lays a Torus take under the Scene (kernel expression.rs `scene_performance_edit`, the performance's `record_torus_take`;
 * O-I #855): the kernel opens the Scene's performance with it, or lays it in the one it has, and refuses in its words a take it did not seal. */
export function recordTakeChange(sceneRef: string, record: TorusTakeRecordEdit) {
  return {change: 'scene_performance_edit', scene_ref: sceneRef, operations: [record]};
}
/** Where the Scene lays the take once the edit is made: the take by its ref, on its lane, from the sample the Scene keeps; refused in words
 * where the Scene does not lay it. */
export function takeRecordedReply(performance: unknown, record: TorusTakeRecordEdit, unsaved: boolean): PerformanceReply {
  const ref = record.take.take_ref;
  const row = (object(performance) && Array.isArray(performance.torus_takes) ? performance.torus_takes : [])
    .find((item: unknown) => object(item) && object(item.take) && item.take.take_ref === ref) as Record<string, unknown> | undefined;
  return row && typeof ref === 'string' ? {state: 'take-recorded', take_ref: ref, lane_ref: record.lane.layer_ref, at_sample: String(row.at_sample), unsaved}
    : {state: 'refused', reason: `The Scene did not lay ${record.lane.title} under it.`, missing: []};
}

/** The one edit that comps a stretch of a take lane into the row's main lane (the performance's `comp_torus_take`, kernel
 * expression_performance.rs CompTorusTake; O-I #855 round 25): the kernel lays it over what was comped before, and refuses in its words a
 * stretch no take of its lane lies under. */
export function compTakeChange(sceneRef: string, stretch: TakeCompStretch) {
  return {change: 'scene_performance_edit', scene_ref: sceneRef,
    operations: [{operation: 'comp_torus_take', comp: {lane_ref: stretch.lane_ref, start_sample: stretch.start_sample, end_sample: stretch.end_sample}}]};
}
/** The stretch as the Scene comps it once the edit is made, or refused in words where it does not. */
export function takeCompedReply(performance: unknown, stretch: TakeCompStretch, unsaved: boolean): PerformanceReply {
  const comps = object(performance) && Array.isArray(performance.torus_comp) ? performance.torus_comp : [];
  const comped = comps.some((row: unknown) => object(row) && row.lane_ref === stretch.lane_ref && String(row.start_sample) === stretch.start_sample
    && String(row.end_sample) === stretch.end_sample);
  return comped ? {state: 'take-comped', lane_ref: stretch.lane_ref, start_sample: stretch.start_sample, end_sample: stretch.end_sample, unsaved}
    : {state: 'refused', reason: `The Scene did not comp the stretch of ${stretch.lane_ref}.`, missing: []};
}
/** A take lane of the Scene's performance: its layer and where it stands among the layers, or undefined. */
function takeLaneLayer(performance: unknown, laneRef: string): {index: number; layer: Record<string, unknown>} | undefined {
  if (!laneRef.startsWith(TORUS_TAKE_LANE)) return undefined;
  const layers = object(performance) && Array.isArray(performance.layers) ? performance.layers : [];
  const index = layers.findIndex((row: unknown) => object(row) && row.layer_ref === laneRef);
  return index < 0 ? undefined : {index, layer: layers[index] as Record<string, unknown>};
}
/** The one edit that sets a take lane's Activator and Solo (the performance's `layer_set` of the lane's own layer, its title kept; the kernel's
 * layer law then says which lanes sound), or the words that say the Scene has no such take lane. */
export function takeLaneChange(sceneRef: string, performance: unknown, laneRef: string, enabled: boolean, solo: boolean) {
  const lane = takeLaneLayer(performance, laneRef);
  if (!lane) return {reason: `The Scene has no take lane ${laneRef}.`};
  return {change: 'scene_performance_edit', scene_ref: sceneRef, operations: [{operation: 'layer_set', index: lane.index, layer: {...lane.layer, enabled, solo}}]};
}
/** The take lane's Activator and Solo as the Scene holds them once the edit is made, or refused in words where it has no such lane. */
export function takeLaneReply(performance: unknown, laneRef: string, unsaved: boolean): PerformanceReply {
  const lane = takeLaneLayer(performance, laneRef);
  return lane && typeof lane.layer.enabled === 'boolean' && typeof lane.layer.solo === 'boolean'
    ? {state: 'take-lane-set', lane_ref: laneRef, enabled: lane.layer.enabled, solo: lane.layer.solo, unsaved}
    : {state: 'refused', reason: `The Scene has no take lane ${laneRef}.`, missing: []};
}

/** The one edit that keeps a rack in the Scene's performance (the performance's `keep_torus_rack`): the kernel keeps it, or replaces the
 * one it keeps under the same ref, and refuses in its words a macro that turns a device off the rack's chain or a variation short of a
 * value for every macro. */
export function keepRackChange(sceneRef: string, rack: TorusRackRecord) {
  return {change: 'scene_performance_edit', scene_ref: sceneRef, operations: [{operation: 'keep_torus_rack', rack}]};
}
/** What the Scene keeps once the rack's edit is made: the rack by its ref and name, how many macros and variations it holds, with all the
 * Scene keeps on the Torus; refused in words where the Scene does not keep it. */
export function keptRackReply(performance: unknown, rack: TorusRackRecord, unsaved: boolean): PerformanceReply {
  const kept = listPerformance(performance).kept ?? null;
  const row = kept?.racks.find(item => item.rack_ref === rack.rack_ref);
  return row ? {state: 'rack-kept', rack_ref: row.rack_ref, name: row.name, macros: row.macros.length, variations: row.variations.length, unsaved, kept}
    : {state: 'refused', reason: `The Scene did not keep "${rack.name}".`, missing: []};
}

/** A sound the Scene keeps, whole, by its ref: what opens it (the kernel opens it against the Torus as it stands). */
export function keptSoundRecord(performance: unknown, soundRef: string): PerformanceReply {
  const kept = object(performance) && object(performance.torus_kept) ? performance.torus_kept : null;
  const sound = readTorusSound(list(kept?.sounds).find(raw => object(raw) && raw.sound_ref === soundRef));
  return sound && keptSound(sound) ? {state: 'sound', sound} : {state: 'refused', reason: `The Scene keeps no sound ${soundRef}.`, missing: []};
}

/** The native readings a save must carry and the frame does not supply: each one absent is named. */
export function missingNativeReadings(readings: Readonly<Record<string, unknown>>): string[] {
  return REQUIRED_NATIVE_READINGS.filter(key => readings[key] === undefined || readings[key] === null);
}

/** A save is refused by name: the native readings and the Scene's retained performance must exist, and a basis record has no name field. */
export function refusePerformanceSave(scene: {readonly performance?: unknown}, name: string, readings: Readonly<Record<string, unknown>> = {}): PerformanceReply {
  const missing = missingNativeReadings(readings).map(key => `native reading ${key}`);
  if (!scene.performance) missing.push('a retained performance on this Scene (the native recording path creates it)');
  missing.push(`a name field on ${PERFORMANCE_BASIS_SCHEMA} (the record cannot keep "${name}")`);
  return {state: 'refused', reason: `Save as "${name}" needs ${missing.join('; ')}. Nothing was saved.`, missing};
}

/** A recall reads one stored basis and states the instrument edits it can express, each validated through the instrument command's own reader.
 * Anything it cannot express is named as not applied. The owner writes nothing here: the shell applies the edits through the instrument command. */
export function recallPerformanceBasis(bases: unknown, basisRef: string): PerformanceReply {
  const basis = Array.isArray(bases) ? bases.find(row => object(row) && row.content_digest === basisRef) : undefined;
  if (!object(basis)) return {state: 'refused', reason: 'No saved basis has this reference on the presented Scene.', missing: []};
  const config = object(basis.m1) && object(basis.m1.config) ? basis.m1.config : {};
  const edits: InstrumentEdit[] = [];
  const notApplied: {field: string; reason: string}[] = [];
  const lens = readInstrumentEdit({kind: 'lens', lens12: config.lens12});
  if (lens) edits.push(lens); else notApplied.push({field: 'lens', reason: 'the basis states no lens (config.lens12)'});
  const contextFrame = readInstrumentEdit({kind: 'context-frame', context_frame: config.context_frame});
  if (contextFrame) edits.push(contextFrame); else notApplied.push({field: 'context frame', reason: 'the basis states no context frame (config.context_frame)'});
  notApplied.push({field: 'harmonic basis', reason: 'the basis M1 configuration states no harmonic source'});
  notApplied.push({field: 'transcription', reason: 'the basis states no M3 transcription the instrument command can set'});
  for (const field of NOT_INSTRUMENT_FIELDS) {
    if (basis[field] !== undefined && basis[field] !== null) notApplied.push({field, reason: 'native performance state, not an instrument setting; the instrument command cannot apply it'});
  }
  return {state: 'recalled', basis_ref: basisRef, edits, not_applied: notApplied};
}
