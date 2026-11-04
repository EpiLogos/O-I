// The presets' owner path (ticket T-LIVE-TORUS-INSTRUMENT leg 6; the kernel's PerformanceBasis, desktop/cradle/kernel/src/expression_performance.rs).
// The owner persists an instrument state as a PerformanceBasis (schema oi.expression-performance-basis/v1), digest-sealed by the kernel and
// admitted by PerformanceOperation::AdmitBasis into a Scene's retained performance (oi.expression-performance/v3).
//
// This module holds only what the boundary may do with that record: validate the frame's request, summarise the bases the kernel reads back,
// refuse a save by name where the native readings are absent, and turn a recalled basis into instrument edits (or name what cannot be
// applied). It never seals or hashes a basis: every digest here is the kernel's own, read back from its inspected document.
import {readInstrumentEdit, type InstrumentEdit} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts';

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
 * a kept sound back whole by its ref, to open it; and keep a sound the kernel sealed (O-I #852). */
export type PerformanceAction = {action: 'list'} | {action: 'save'; name: string} | {action: 'recall'; basis_ref: string}
  | {action: 'sound'; sound_ref: string} | {action: 'keep-sound'; sound: Readonly<Record<string, unknown>>};
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
  return null;
}

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

export interface PerformanceBasisSummary {readonly basis_ref: string; readonly event_ref: string; readonly m1_coordinate: string}
/** A sound the Scene keeps (kernel kept.rs `oi.torus-sound/v1`): its digest and name as the kernel holds them, and what it rings on. */
export interface KeptSoundSummary {readonly sound_ref: string; readonly name: string; readonly body: 'torus' | 'form'; readonly body_ref: string | null; readonly sample_rate: number}
/** An instrument the Scene keeps (`oi.torus-instrument/v1`): a form's body, with the sounds made on it that the Scene keeps. */
export interface KeptInstrumentSummary {readonly instrument_ref: string; readonly name: string; readonly body_ref: string; readonly sounds: readonly KeptSoundSummary[]}
/** A rack the Scene keeps (`oi.torus-rack/v1`): the Torus with its chain, its macros and their variations. */
export interface KeptRackSummary {readonly rack_ref: string; readonly name: string; readonly sound: string | null; readonly devices: number; readonly macros: readonly string[]; readonly variations: readonly string[]}
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
  | {readonly state: 'kept'; readonly sound_ref: string; readonly name: string; readonly unsaved: boolean; readonly kept: TorusKeptSummary | null};

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
    const named = (rows: unknown) => list(rows).flatMap(row => object(row) && keptName(row.name) ? [row.name] : []);
    racks.push({rack_ref: raw.rack_ref, name: raw.name, sound: typeof raw.sound === 'string' && sounds.has(raw.sound) ? raw.sound : null,
      devices: list(raw.chain).length, macros: named(raw.macros), variations: named(raw.variations)});
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
