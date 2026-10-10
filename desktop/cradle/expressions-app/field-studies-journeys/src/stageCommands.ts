/** Stage controls the shell may drive in the presented Expressions application.
 * Pure: no DOM. The host boundary, the frame handler and the shell import this
 * one closed vocabulary, so the three cannot disagree. Each command runs the
 * application's own action body (app.ts action()); nothing here re-implements a
 * control. Camera pan/zoom/orbit stay pointer gestures on the stage itself. */
import {NATIVE_BINDINGS} from './nativeParameters.js';
export const STAGE_COMMANDS = ['view', 'capture', 'present', 'export', 'import', 'tool', 'engine', 'take', 'tracks', 'automation', 'live'] as const;
export type StageCommandName = (typeof STAGE_COMMANDS)[number];
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
  | {command: 'live'; action: 'release'};
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
