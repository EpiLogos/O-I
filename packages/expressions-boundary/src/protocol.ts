/** One application, two cuts. Native subject identity and Action ownership
 * survive the cut. Layout, camera and instrument-local preferences stay in
 * the application that made them; this boundary has no document store.
 * Wire compatibility: desktop/cradle/src/expressions/hostedApp.ts and the
 * vendored app's kernelExpressions.ts/app.ts. */
import {TECHNE_INSTRUMENTS} from '../../../desktop/cradle/src/techne/contract.ts';
import type {HostedAppState, HostedAppMode, HostedTechneLens} from '../../../desktop/cradle/src/expressions/hostedApp';
export type {HostedAppState, HostedAppMode, HostedTechneLens};
export type {TechneReading, TechneActionRoute, TechneActionReceipt, NativeActionRef} from '../../../desktop/cradle/src/techne/contract.ts';
export {assertReading, resolveActionRoute} from '../../../desktop/cradle/src/techne/m0m5/adapter.ts';

export const CHANNEL_VERSION = 1;
export const NATIVE_CHANNEL = 'oi.native-expression/v1';
export const DEEP_INSTRUMENT_IDS = TECHNE_INSTRUMENTS.filter((id): id is HostedTechneLens => id !== 'expressions');
export const FRAME_EXPRESSION_OPERATIONS = new Set(['profile_define', 'profile_inspect', 'list', 'inspect', 'create', 'edit', 'open', 'open_file', 'save_as', 'save', 'export', 'fork', 'index', 'close']);
export const isHostedAppMode = (v: unknown): v is HostedAppMode => v === 'expressions' || v === 'techne';
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
  readStageRequest, stageRequestMessage, stageReplyMessage, readStageResult,
  type StageCommand, type StageCommandName, type StageResult, type StageViewAction, type StageCaptureSettings, type StageCaptureWidth, type StageCaptureAspect, type StageExportFormat, type StageTakeMode, type StageTrackAction,
  type StageTool, type StageToolReading, type StageEngineAction,
} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts';
import {stageOneOf, STAGE_TAKE_MODES, STAGE_TOOL_READINGS} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts';
/** Host→frame command that opens one Studio section. The frame answers with a
 * host-command-result, which carries no request id: its command name is its key. */
export const OPEN_STUDIO_COMMAND = 'open-studio';
export function readOpenStudioResult(raw: Record<string, unknown>): {ok: true; section: StudioSection} | {ok: false; error: string} | null {
  if (raw.command !== OPEN_STUDIO_COMMAND || typeof raw.ok !== 'boolean') return null;
  if (raw.ok) return isStudioSection(raw.section) ? {ok: true, section: raw.section} : null;
  return boundedText(raw.error, 512) ? {ok: false, error: raw.error} : null;
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
  for (const key of ['playing', 'journeyPlaying', 'fieldPaused', 'libraryOpen', 'recording', 'presenting', 'automationLoop', 'propertyRecording', 'propertyPreview'] as const) {
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
  if (raw.hostMode !== undefined) {
    if (!isHostedAppMode(raw.hostMode)) return null;
    state.hostMode = raw.hostMode;
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
  // A bare {} is not evidence the application started. The real app always
  // announces its cut and concrete scene count, even while native boot waits.
  if (!isHostedAppMode(state.hostMode) || state.sceneCount === undefined) return null;
  return state;
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
