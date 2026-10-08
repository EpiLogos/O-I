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
  for (const key of ['sceneIndex', 'sceneCount'] as const) {
    if (raw[key] === undefined) continue;
    if (!Number.isSafeInteger(raw[key]) || Number(raw[key]) < 0) return null;
    state[key] = Number(raw[key]);
  }
  for (const key of ['sceneName', 'sceneState', 'tool'] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== 'string' || String(raw[key]).length > 4096) return null;
    state[key] = String(raw[key]);
  }
  for (const key of ['playing', 'journeyPlaying', 'fieldPaused', 'libraryOpen'] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== 'boolean') return null;
    state[key] = raw[key] as boolean;
  }
  if (raw.hostMode !== undefined) {
    if (!isHostedAppMode(raw.hostMode)) return null;
    state.hostMode = raw.hostMode;
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
