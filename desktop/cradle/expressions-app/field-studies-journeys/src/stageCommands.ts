/** Stage controls the shell may drive in the presented Expressions application.
 * Pure: no DOM. The host boundary, the frame handler and the shell import this
 * one closed vocabulary, so the three cannot disagree. Each command runs the
 * application's own action body (app.ts action()); nothing here re-implements a
 * control. Camera pan/zoom/orbit stay pointer gestures on the stage itself. */
import {NATIVE_BINDINGS} from './nativeParameters.js';
import {effectChainRefusal, readEffectOperands, type EffectValue, type PresentationEffect} from './native-field/effectsLaw.js';
export const STAGE_COMMANDS = ['view', 'capture', 'present', 'export', 'import', 'tool', 'engine', 'take', 'tracks', 'automation', 'live', 'instrument', 'janko', 'presentation', 'chrome', 'sound'] as const;
export type StageCommandName = (typeof STAGE_COMMANDS)[number];
/** How the shell presents the frame (T-FRAME-CHROME-ONTO-PLATES; manual §16.1: "A pane is a device at full size. Its controls stay out
 * of the pane and appear in Device view below it"). 'devices': a pane — the frame draws only its field, and every control its chrome
 * draws stands on the shell's devices through the chrome reading below. 'frame': the pane at full size (the pane grammar's maximise) —
 * the frame's own controls stand inside it, as the standalone application has them. A frame nobody declares to stays 'frame'. */
export const FRAME_PRESENTATIONS = ['devices', 'frame'] as const;
export type FramePresentation = (typeof FRAME_PRESENTATIONS)[number];
/** Where a control of the frame's chrome belongs, in the manual's own groups (DLW.md §17.3 Canvas "Tools, Lines, Relation, Look,
 * Views", §17.4 Timeline "Lens, Readings, Standing, Window", §17.5 Journey "Stops, Pace, Transitions, Takes"), and for the stage-wide
 * chrome the masthead's and scene bar's own clusters: work (Save, Undo, Redo), tools (the rail and the workspace menu), capture, nara,
 * scene (the scene bar), side (the toolbelt handle), lens (the M0′–M3′ chooser). The editors the frame summons over its field stand as
 * homes of their own while they are open (lane BE: in the 'devices' presentation they stand down over the field and stand on a device in
 * the shell's pool instead): acts (the scene bar's Acts, actPanel.ts), nara:instrument (the personal Nara instrument, naraInstrument.tsx)
 * and canvas:find (Find on Canvas, canvasFindOverlay.tsx). One closed list for frame, boundary and shell. */
export const FRAME_CHROME_HOMES = ['work', 'tools', 'capture', 'nara', 'scene', 'side', 'lens', 'acts', 'nara:instrument',
  'canvas:tools', 'canvas:lines', 'canvas:relation', 'canvas:look', 'canvas:views', 'canvas:find',
  'timeline:lens', 'timeline:readings', 'timeline:standing', 'timeline:window',
  'journey:stops', 'journey:pace', 'journey:transitions', 'journey:takes',
  'project:view'] as const;
export type FrameChromeHome = (typeof FRAME_CHROME_HOMES)[number];
/** What a control is, as the frame draws it: a press, a toggle (its pressed state the frame's own aria reading), a choice among the
 * frame's options, a value it commits (colour, text, number, range), or a reading it shows (a status line, a time, a count). */
export const FRAME_CHROME_KINDS = ['button', 'toggle', 'select', 'color', 'text', 'number', 'range', 'reading'] as const;
export type FrameChromeKind = (typeof FRAME_CHROME_KINDS)[number];
export interface FrameChromeOption {value: string; label: string; group?: string}
/** One control of the frame's chrome, by value: the frame's own words, its own state; never a copy the shell keeps. */
export interface FrameChromeControl {
  id: string; home: FrameChromeHome; kind: FrameChromeKind; label: string
  /** The control's visible word, where the frame draws one short enough to stand on a key. */
  short?: string; title?: string; pressed?: boolean; disabled?: boolean; value?: string
  options?: FrameChromeOption[]; min?: number; max?: number; step?: number
}
/** The editors the frame hands to the shell to open in their own device home, in the 'devices' presentation (lane BE): the Library, which
 * the shell opens full in a pane on its own page (library.html) instead of over the field. */
export const FRAME_SUMMONS = ['library'] as const;
export type FrameSummon = (typeof FRAME_SUMMONS)[number];
/** The frame's chrome as it stands: the cut and lens it is drawn for, and every control, in the frame's order; and how many times since it
 * started the frame has handed each summon to the shell (a count, so a reading never replays a summon the shell has answered). */
export interface FrameChromeReading {lens: string; controls: FrameChromeControl[]; summons?: Partial<Record<FrameSummon, number>>}
export const FRAME_CHROME_LIMITS = {controls: 400, options: 200, text: 512, id: 200} as const;
const chromeText = (value: unknown, max: number = FRAME_CHROME_LIMITS.text): value is string => typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
/** A value the frame's own control holds (a choice's value, a field's text): bounded, and carried as it is — the frame's choices join
 * their parts with control characters (researchInstruments.tsx "apply\u0000<name>"), so a value is never cleaned, only bounded. */
const chromeValue = (value: unknown): value is string => typeof value === 'string' && value.length <= FRAME_CHROME_LIMITS.text;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
/** The chrome reading, exact or refused (null): every key is closed and every string bounded. */
export function readFrameChrome(raw: unknown): FrameChromeReading | null {
  if (!plain(raw) || !closed(raw, ['lens', 'controls', 'summons']) || !chromeText(raw.lens, 64) || !Array.isArray(raw.controls) || raw.controls.length > FRAME_CHROME_LIMITS.controls) return null;
  let summons: Partial<Record<FrameSummon, number>> | undefined;
  if (raw.summons !== undefined) {
    if (!plain(raw.summons) || !closed(raw.summons, FRAME_SUMMONS)) return null;
    summons = {};
    for (const key of FRAME_SUMMONS) {
      const count = raw.summons[key];
      if (count === undefined) continue;
      if (!Number.isSafeInteger(count) || (count as number) < 0) return null;
      summons[key] = count as number;
    }
  }
  const controls: FrameChromeControl[] = [];
  const ids = new Set<string>();
  for (const item of raw.controls) {
    if (!plain(item) || !closed(item, ['id', 'home', 'kind', 'label', 'short', 'title', 'pressed', 'disabled', 'value', 'options', 'min', 'max', 'step'])) return null;
    if (!chromeText(item.id, FRAME_CHROME_LIMITS.id) || !item.id || ids.has(item.id) || !stageOneOf(FRAME_CHROME_HOMES, item.home) || !stageOneOf(FRAME_CHROME_KINDS, item.kind) || !chromeText(item.label)) return null;
    ids.add(item.id);
    const control: FrameChromeControl = {id: item.id, home: item.home, kind: item.kind, label: item.label};
    for (const key of ['short', 'title', 'value'] as const) {
      if (item[key] === undefined) continue;
      if (!(key === 'value' ? chromeValue(item[key]) : chromeText(item[key]))) return null;
      control[key] = item[key] as string;
    }
    for (const key of ['pressed', 'disabled'] as const) {
      if (item[key] === undefined) continue;
      if (typeof item[key] !== 'boolean') return null;
      control[key] = item[key] as boolean;
    }
    for (const key of ['min', 'max', 'step'] as const) {
      if (item[key] === undefined) continue;
      if (!finite(item[key])) return null;
      control[key] = item[key] as number;
    }
    if (item.options !== undefined) {
      if (!Array.isArray(item.options) || item.options.length > FRAME_CHROME_LIMITS.options) return null;
      const options: FrameChromeOption[] = [];
      for (const option of item.options) {
        if (!plain(option) || !closed(option, ['value', 'label', 'group']) || !chromeValue(option.value) || !chromeText(option.label) || option.group !== undefined && !chromeText(option.group)) return null;
        options.push({value: option.value, label: option.label, ...(option.group !== undefined ? {group: option.group as string} : {})});
      }
      control.options = options;
    }
    controls.push(control);
  }
  return {lens: raw.lens, controls, ...(summons ? {summons} : {})};
}
/** Rail tools the shell may choose. Text and formation open their panels; pin is a placement mode. Orbit is a stage pointer gesture, never a command. */
export const STAGE_TOOLS = ['select', 'interact', 'pin', 'text', 'formation'] as const;
export type StageTool = (typeof STAGE_TOOLS)[number];
/** Every tool value the frame reports: the commandable tools plus orbit, which only the stage pointer sets. */
export const STAGE_TOOL_READINGS = ['select', 'interact', 'pin', 'text', 'formation', 'orbit'] as const;
export type StageToolReading = (typeof STAGE_TOOL_READINGS)[number];
/** Physics runtime actions. Reset reseeds the particle field and runs only with confirmed: true. */
export const STAGE_ENGINE_ACTIONS = ['disperse', 'reset-phases', 'recover', 'reset'] as const;
export type StageEngineAction = (typeof STAGE_ENGINE_ACTIONS)[number];
export const STAGE_VIEW_ACTIONS = ['view-2d', 'view-3d', 'guides', 'grid', 'snap', 'face-plane', 'fit-view', 'keep-view', 'restore-view'] as const;
export type StageViewAction = (typeof STAGE_VIEW_ACTIONS)[number];
/** The Image suite's own options: the width select, the frame select and the two checkboxes. */
export const STAGE_CAPTURE_WIDTHS = [1280, 1440, 1920, 3840] as const;
export type StageCaptureWidth = (typeof STAGE_CAPTURE_WIDTHS)[number];
export const STAGE_CAPTURE_ASPECTS = ['stage', '16:9', '1:1', '9:16'] as const;
export type StageCaptureAspect = (typeof STAGE_CAPTURE_ASPECTS)[number];
export const STAGE_EXPORT_FORMATS = ['json', 'native', 'html'] as const;
export type StageExportFormat = (typeof STAGE_EXPORT_FORMATS)[number];
/** Property takes (app.ts record-properties and take-mode): start arms a take in the append or replace mode; stop finishes it. Tracks preview the Scene's recorded tracks in the legacy scene clock, or stops that preview. */
export const STAGE_TAKE_MODES = ['append', 'replace'] as const;
export type StageTakeMode = (typeof STAGE_TAKE_MODES)[number];
export const STAGE_TRACK_ACTIONS = ['preview', 'stop-preview'] as const;
export type StageTrackAction = (typeof STAGE_TRACK_ACTIONS)[number];
/** Automation runtime (app.ts automation-play and automation-loop). play fires every enabled one-shot ramp; loop sets the global loop flag, which is not a document value. Pausing is a document change (each group's enabled flag), so it is not a stage command. resume hands every parameter held by a live gesture back to its automation: runtime state in the frame, never a document write. */
export const STAGE_AUTOMATION_ACTIONS = ['play', 'loop', 'resume'] as const;
export type StageAutomationAction = (typeof STAGE_AUTOMATION_ACTIONS)[number];
/** Live parameter channel. A drag streams `set` at about 20 Hz: the frame applies the value as a transient engine override and writes NO document.
 * The one released gesture is committed through the shared editor path, then `release` clears the override. `hold` keeps a manual value on a parameter
 * that automation drives (runtime only) until `automation resume`. Targets are the registry's continuous Field parameters, `field.<key>`, bound under
 * field.params or engine; discrete solver cardinalities are commit-only. Values must sit inside the registry's hard bounds. */
export const STAGE_LIVE_ACTIONS = ['set', 'hold', 'release'] as const;
export type StageLiveAction = (typeof STAGE_LIVE_ACTIONS)[number];
const DISCRETE_PATHS = ['medium.iterations', 'medium.gridRes', 'particleCount', 'cymatics.modeCount'];
const LIVE_BINDINGS = new Map(NATIVE_BINDINGS.filter(b => (b.bind.startsWith('field.params.') || b.bind.startsWith('engine.')) && !DISCRETE_PATHS.includes(b.path)).map(b => ['field.' + b.key, b]));
/** The registry binding a live target names, or undefined when it is outside the closed live set. */
export const stageLiveBinding = (target: unknown) => typeof target === 'string' ? LIVE_BINDINGS.get(target) : undefined;
/** Why a live value is refused, or null when the target is live-admitted and the value finite and inside the hard bounds. */
export function stageLiveRefusal(target: unknown, value: unknown): string | null {
  const binding = stageLiveBinding(target);
  if (!binding) return 'This parameter is not live-adjustable.';
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'A live value must be a finite number.';
  if (value < binding.hardMin || value > binding.hardMax) return `${binding.label} must be between ${binding.hardMin} and ${binding.hardMax}.`;
  return null;
}
/** The Live instrument's edits: the owner's determinant edits (the scene's lens, context frame, harmonic basis and transcription) and its
 * presentation writes (sound, tick cadence, level, scale, the torus's effects chain and one parameter of one of its four effects, manual
 * §21.5). Each runs
 * the same controller operation the Studio's native controls run. The cadence presets and the level and scale ranges are the Studio's
 * own controls; the owner's bounds are the outer law. An effect's operands are closed and typed here; its range is the owner's to
 * refuse in its own words (native-field/effectsLaw.ts). */
export const STAGE_INSTRUMENT_CADENCES = ['hold', 1, 12] as const;
export const STAGE_INSTRUMENT_LEVEL = {min: 0, max: 4} as const;
export const STAGE_INSTRUMENT_SCALE_MAX = 1000000;
export type InstrumentEdit =
  | {kind: 'lens'; lens12: number}
  | {kind: 'context-frame'; context_frame: number}
  | {kind: 'harmonic'; source: {selection: 'canonical-basis'; index: number} | {selection: 'selected-source-row'}}
  | {kind: 'transcription'; rna: boolean}
  | {kind: 'muted'; muted: boolean}
  | {kind: 'cadence'; rate: (typeof STAGE_INSTRUMENT_CADENCES)[number]}
  | {kind: 'level'; value: number}
  | {kind: 'scale'; units_per_metre: number}
  | {kind: 'follow-scale'}
  | {kind: 'effect'; effect: PresentationEffect; key: string; value: EffectValue}
  | {kind: 'effect-chain'; chain: PresentationEffect[]};
/** A closed, validated instrument edit, or null. Every operand is exact: a determinant outside the owner's range is refused here. */
export function readInstrumentEdit(raw: unknown): InstrumentEdit | null {
  if (!plain(raw) || typeof raw.kind !== 'string') return null;
  const integer = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
  switch (raw.kind) {
    case 'lens': return closed(raw, ['kind', 'lens12']) && integer(raw.lens12, 0, 11) ? {kind: 'lens', lens12: raw.lens12} : null;
    case 'context-frame': return closed(raw, ['kind', 'context_frame']) && integer(raw.context_frame, 1, 7) ? {kind: 'context-frame', context_frame: raw.context_frame} : null;
    case 'harmonic': {
      if (!closed(raw, ['kind', 'source']) || !plain(raw.source)) return null;
      const source = raw.source;
      if (source.selection === 'selected-source-row' && closed(source, ['selection'])) return {kind: 'harmonic', source: {selection: 'selected-source-row'}};
      if (source.selection === 'canonical-basis' && closed(source, ['selection', 'index']) && integer(source.index, 0, 7)) return {kind: 'harmonic', source: {selection: 'canonical-basis', index: source.index}};
      return null;
    }
    case 'transcription': return closed(raw, ['kind', 'rna']) && typeof raw.rna === 'boolean' ? {kind: 'transcription', rna: raw.rna} : null;
    case 'muted': return closed(raw, ['kind', 'muted']) && typeof raw.muted === 'boolean' ? {kind: 'muted', muted: raw.muted} : null;
    case 'cadence': return closed(raw, ['kind', 'rate']) && (raw.rate === 'hold' || raw.rate === 1 || raw.rate === 12) ? {kind: 'cadence', rate: raw.rate} : null;
    case 'level': return closed(raw, ['kind', 'value']) && typeof raw.value === 'number' && Number.isFinite(raw.value) && raw.value >= STAGE_INSTRUMENT_LEVEL.min && raw.value <= STAGE_INSTRUMENT_LEVEL.max ? {kind: 'level', value: raw.value} : null;
    case 'scale': return closed(raw, ['kind', 'units_per_metre']) && typeof raw.units_per_metre === 'number' && Number.isFinite(raw.units_per_metre) && raw.units_per_metre > 0 && raw.units_per_metre <= STAGE_INSTRUMENT_SCALE_MAX ? {kind: 'scale', units_per_metre: raw.units_per_metre} : null;
    case 'follow-scale': return closed(raw, ['kind']) ? {kind: 'follow-scale'} : null;
    case 'effect-chain': return closed(raw, ['kind', 'chain']) && effectChainRefusal(raw.chain) === null ? {kind: 'effect-chain', chain: [...(raw.chain as PresentationEffect[])]} : null;
    case 'effect': { const operands = closed(raw, ['kind', 'effect', 'key', 'value']) ? readEffectOperands(raw) : null; return operands ? {kind: 'effect', ...operands} : null; }
  }
  return null;
}
export interface StageCaptureSettings {width?: StageCaptureWidth; aspect?: StageCaptureAspect; includeText?: boolean; transparent?: boolean}
export type StageCommand =
  | {command: 'view'; action: StageViewAction}
  | {command: 'capture'; mediaKind: 'png'; settings?: StageCaptureSettings}
  | {command: 'capture'; mediaKind: 'video'; action: 'start'; settings?: StageCaptureSettings}
  | {command: 'capture'; mediaKind: 'video'; action: 'stop'}
  | {command: 'capture'; mediaKind: 'video'; action: 'save'}
  | {command: 'present'; on: boolean}
  | {command: 'export'; format: StageExportFormat}
  | {command: 'import'}
  | {command: 'tool'; tool: StageTool; repeat?: boolean}
  | {command: 'engine'; action: StageEngineAction; confirmed?: boolean}
  | {command: 'take'; action: 'start'; mode: StageTakeMode}
  | {command: 'take'; action: 'stop'}
  | {command: 'tracks'; action: StageTrackAction}
  | {command: 'automation'; action: 'play'}
  | {command: 'automation'; action: 'loop'; on: boolean}
  | {command: 'automation'; action: 'resume'}
  | {command: 'live'; action: 'set' | 'hold'; target: string; value: number}
  | {command: 'live'; action: 'release'}
  | {command: 'instrument'; edit: InstrumentEdit}
  | {command: 'janko'; action: 'play'; pitch_classes: number[]; amplitude: number}
  | {command: 'presentation'; chrome: FramePresentation}
  | {command: 'chrome'; id: string; value?: string}
  /** The Expression's own sound (DLW §20.1 the mixer row's Activator and Solo): every object sound of the open Expression silenced or
   * not, as the Sound panel's own "Mute all object sound here" does. The picture still plays. */
  | {command: 'sound'; muted: boolean};
/** A Jankó note: one to twelve distinct pitch classes (0–11) struck together as one act, at an amplitude in (0, 1] (modal metres; the owner's strike bound). */
export const STAGE_JANKO_AMPLITUDE_MAX = 1;
export type StageResult = {ok: true} | {ok: false; error: string};

const BASE_KEYS = ['v', 'kind', 'command', 'req'] as const;
const SETTING_KEYS = ['width', 'aspect', 'includeText', 'transparent'] as const;
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const closed = (raw: Record<string, unknown>, keys: readonly string[]) => Object.keys(raw).every(key => keys.includes(key));
export const stageOneOf = <T extends string | number>(list: readonly T[], value: unknown): value is T => (list as readonly unknown[]).includes(value);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const bounded = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value);

/** Settings are optional and closed: undefined is absent, null is refused. */
function readSettings(raw: unknown): StageCaptureSettings | undefined | null {
  if (raw === undefined) return undefined;
  if (!plain(raw) || !closed(raw, SETTING_KEYS)) return null;
  const out: StageCaptureSettings = {};
  const width = raw.width, aspect = raw.aspect, includeText = raw.includeText, transparent = raw.transparent;
  if (width !== undefined) {if (!stageOneOf(STAGE_CAPTURE_WIDTHS, width)) return null; out.width = width;}
  if (aspect !== undefined) {if (!stageOneOf(STAGE_CAPTURE_ASPECTS, aspect)) return null; out.aspect = aspect;}
  if (includeText !== undefined) {if (typeof includeText !== 'boolean') return null; out.includeText = includeText;}
  if (transparent !== undefined) {if (typeof transparent !== 'boolean') return null; out.transparent = transparent;}
  return out;
}

/** A host-command from the shell, or null. Every key and value is a closed enum. */
export function readStageRequest(raw: unknown): {req: number; command: StageCommand} | null {
  if (!plain(raw) || raw.v !== 1 || raw.kind !== 'host-command' || !positive(raw.req) || !stageOneOf(STAGE_COMMANDS, raw.command)) return null;
  const req = raw.req;
  switch (raw.command) {
    case 'view':
      if (!closed(raw, [...BASE_KEYS, 'action']) || !stageOneOf(STAGE_VIEW_ACTIONS, raw.action)) return null;
      return {req, command: {command: 'view', action: raw.action}};
    case 'capture': {
      if (!closed(raw, [...BASE_KEYS, 'mediaKind', 'action', 'settings'])) return null;
      const settings = readSettings(raw.settings);
      if (settings === null) return null;
      const extra: {settings?: StageCaptureSettings} = settings === undefined ? {} : {settings};
      if (raw.mediaKind === 'png') return raw.action === undefined ? {req, command: {command: 'capture', mediaKind: 'png', ...extra}} : null;
      if (raw.mediaKind !== 'video') return null;
      if (raw.action === 'start') return {req, command: {command: 'capture', mediaKind: 'video', action: 'start', ...extra}};
      if (raw.action === 'stop' && settings === undefined) return {req, command: {command: 'capture', mediaKind: 'video', action: 'stop'}};
      if (raw.action === 'save' && settings === undefined) return {req, command: {command: 'capture', mediaKind: 'video', action: 'save'}};
      return null;
    }
    case 'sound':
      return closed(raw, [...BASE_KEYS, 'muted']) && typeof raw.muted === 'boolean' ? {req, command: {command: 'sound', muted: raw.muted}} : null;
    case 'present':
      return closed(raw, [...BASE_KEYS, 'on']) && typeof raw.on === 'boolean' ? {req, command: {command: 'present', on: raw.on}} : null;
    case 'export':
      return closed(raw, [...BASE_KEYS, 'format']) && stageOneOf(STAGE_EXPORT_FORMATS, raw.format) ? {req, command: {command: 'export', format: raw.format}} : null;
    case 'import':
      return closed(raw, BASE_KEYS) ? {req, command: {command: 'import'}} : null;
    case 'tool': {
      // repeat is the pin placement mode only; it is refused on every other tool.
      if (!closed(raw, [...BASE_KEYS, 'tool', 'repeat']) || !stageOneOf(STAGE_TOOLS, raw.tool)) return null;
      if (raw.repeat === undefined) return {req, command: {command: 'tool', tool: raw.tool}};
      return raw.tool === 'pin' && typeof raw.repeat === 'boolean' ? {req, command: {command: 'tool', tool: 'pin', repeat: raw.repeat}} : null;
    }
    case 'engine': {
      // confirmed is accepted only on reset. The frame, not this reader, refuses an unconfirmed reset (stageRefusal).
      if (!closed(raw, [...BASE_KEYS, 'action', 'confirmed']) || !stageOneOf(STAGE_ENGINE_ACTIONS, raw.action)) return null;
      if (raw.confirmed === undefined) return {req, command: {command: 'engine', action: raw.action}};
      return raw.action === 'reset' && typeof raw.confirmed === 'boolean' ? {req, command: {command: 'engine', action: 'reset', confirmed: raw.confirmed}} : null;
    }
    case 'take':
      // mode belongs to start only; a stop that names a mode is refused rather than ignored.
      if (raw.action === 'start') return closed(raw, [...BASE_KEYS, 'action', 'mode']) && stageOneOf(STAGE_TAKE_MODES, raw.mode) ? {req, command: {command: 'take', action: 'start', mode: raw.mode}} : null;
      return raw.action === 'stop' && closed(raw, [...BASE_KEYS, 'action']) ? {req, command: {command: 'take', action: 'stop'}} : null;
    case 'tracks':
      return closed(raw, [...BASE_KEYS, 'action']) && stageOneOf(STAGE_TRACK_ACTIONS, raw.action) ? {req, command: {command: 'tracks', action: raw.action}} : null;
    case 'automation':
      // on belongs to loop only; play names no operand.
      if (raw.action === 'play') return closed(raw, [...BASE_KEYS, 'action']) ? {req, command: {command: 'automation', action: 'play'}} : null;
      if (raw.action === 'resume') return closed(raw, [...BASE_KEYS, 'action']) ? {req, command: {command: 'automation', action: 'resume'}} : null;
      return raw.action === 'loop' && closed(raw, [...BASE_KEYS, 'action', 'on']) && typeof raw.on === 'boolean' ? {req, command: {command: 'automation', action: 'loop', on: raw.on}} : null;
    case 'janko': {
      // A chord is one act: distinct pitch classes, struck at one amplitude. Anything else is refused before the owner sees it.
      if (!closed(raw, [...BASE_KEYS, 'action', 'pitch_classes', 'amplitude']) || raw.action !== 'play' || !Array.isArray(raw.pitch_classes)) return null;
      const classes = raw.pitch_classes;
      if (classes.length < 1 || classes.length > 12 || !classes.every(pc => Number.isSafeInteger(pc) && pc >= 0 && pc <= 11)) return null;
      if (new Set(classes).size !== classes.length) return null;
      if (typeof raw.amplitude !== 'number' || !Number.isFinite(raw.amplitude) || raw.amplitude <= 0 || raw.amplitude > STAGE_JANKO_AMPLITUDE_MAX) return null;
      return {req, command: {command: 'janko', action: 'play', pitch_classes: [...classes], amplitude: raw.amplitude}};
    }
    case 'presentation':
      return closed(raw, [...BASE_KEYS, 'chrome']) && stageOneOf(FRAME_PRESENTATIONS, raw.chrome) ? {req, command: {command: 'presentation', chrome: raw.chrome}} : null;
    case 'chrome':
      // One control of the frame's own chrome, by the id its reading gives it, and — for a choice or a value — what to set. The frame
      // refuses an id its reading does not hold (presentedChrome.ts press).
      if (!closed(raw, [...BASE_KEYS, 'id', 'value']) || !chromeText(raw.id, FRAME_CHROME_LIMITS.id) || !raw.id) return null;
      if (raw.value === undefined) return {req, command: {command: 'chrome', id: raw.id}};
      return chromeValue(raw.value) ? {req, command: {command: 'chrome', id: raw.id, value: raw.value}} : null;
    case 'instrument': {
      const edit = closed(raw, [...BASE_KEYS, 'edit']) ? readInstrumentEdit(raw.edit) : null;
      return edit ? {req, command: {command: 'instrument', edit}} : null;
    }
    case 'live':
      // target and value belong to set and hold; release names no operand. A refused value never reaches the frame's override layer.
      if (raw.action === 'release') return closed(raw, [...BASE_KEYS, 'action']) ? {req, command: {command: 'live', action: 'release'}} : null;
      if ((raw.action !== 'set' && raw.action !== 'hold') || !closed(raw, [...BASE_KEYS, 'action', 'target', 'value']) || stageLiveRefusal(raw.target, raw.value) !== null) return null;
      return {req, command: {command: 'live', action: raw.action, target: raw.target as string, value: raw.value as number}};
  }
  return null;
}

/** Why the frame refuses a valid command before running it, or null. Reset reseeds the particle field, so only an explicit confirmed: true runs it. */
export function stageRefusal(command: StageCommand): string | null {
  if (command.command === 'engine' && command.action === 'reset' && command.confirmed !== true) return 'Reset reseeds the particle field and needs confirmation.';
  return null;
}

/** The exact message the host posts. Undefined fields are dropped; the result is re-read by readStageRequest, so an invalid command yields null. */
export function stageRequestMessage(req: number, command: StageCommand): Record<string, unknown> | null {
  const message = Object.fromEntries(Object.entries({v: 1, kind: 'host-command', req, ...command}).filter(([, value]) => value !== undefined));
  return readStageRequest(message) ? message : null;
}

/** The application's answer. Capture answers by host-capture-result; the other commands by host-command-result. Errors are bounded and control-free. */
export function stageReplyMessage(req: number, result: StageResult, command?: StageCommand): Record<string, unknown> {
  const outcome = result.ok ? {ok: true} : {ok: false, error: String(result.error).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 512) || 'The application refused the stage command.'};
  if (command?.command === 'capture') return {v: 1, kind: 'host-capture-result', req, ...outcome};
  return {v: 1, kind: 'host-command-result', ...(command ? {command: command.command} : {}), req, ...outcome};
}

/** A stage answer, or null. Open-studio answers carry no req and are not read here. */
export function readStageResult(raw: unknown): ({req: number} & StageResult) | null {
  if (!plain(raw) || raw.v !== 1 || (raw.kind !== 'host-command-result' && raw.kind !== 'host-capture-result') || !positive(raw.req) || typeof raw.ok !== 'boolean') return null;
  const req = raw.req, ok = raw.ok, error = raw.error;
  if (ok) return {req, ok: true};
  return bounded(error) ? {req, ok: false, error} : null;
}
