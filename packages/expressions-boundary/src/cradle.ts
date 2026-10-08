/** O:I owner adapter. It imports the application's existing native readers,
 * save/recovery family and personal facade. This module is the normal package
 * join, not a second implementation or a second semantic store.
 * The portable protocol/core does not import this desktop adapter. */
import {kernelOp} from '../../../desktop/cradle/src/kernel/bridge';
import type {CentralLocation, KernelOp, KernelOutcome, KernelReceipt, KernelTransportStatus} from '../../../desktop/cradle/src/kernel/types';
import {listFiles, readFile, readFileBytes, resolveFileLocation} from '../../../desktop/cradle/src/files/client';
import {hostedCompositionFile} from '../../../desktop/cradle/src/expressions/hostedComposition';
import {relayNaraChannel} from '../../../desktop/cradle/src/expressions/naraChannel';
import {readLibrary} from '../../../desktop/cradle/src/library/libraryReading';
import {readSceneBlueprint} from '../../../desktop/cradle/src/knowledge/constructionBlueprint';
import {readWikiSceneTechne, resolveSceneConstellation} from '../../../desktop/cradle/src/techne/wikiReadingProvider';
import {relateSceneConstellation} from '../../../desktop/cradle/src/techne/sceneConstellationRelation';
import {ensureWikiNativeExpression, publishWikiNativeRegisters, selectedWikiNativeRegister, selectWikiNativeRegister, wikiNativeRegisters} from '../../../desktop/cradle/src/techne/wikiNativeExpression';
import {boundedText, object, type ChannelContext, type ExpressionsOwners} from './protocol.ts';

export type {KernelTransportStatus, KernelReceipt, NativeFileReading, NativeFileEntry, NativeDirectory, CentralLocation} from '../../../desktop/cradle/src/kernel/types';
export {listFiles, readFile, resolveFileLocation} from '../../../desktop/cradle/src/files/client';
export {readAgency} from '../../../desktop/cradle/src/agency/agencySources';
export type {AgencyReading, AgencySessionRow} from '../../../desktop/cradle/src/agency/agencyTypes';
export {readAgentCard} from '../../../desktop/cradle/src/agency/agentCardReading';
export type {HumanAgentCard, CardField} from '../../../desktop/cradle/src/agency/agentCardReading';
export {agentController} from '../../../desktop/cradle/src/agency/nativeAgentClient';
export type {NativeReview} from '../../../desktop/cradle/src/agency/nativeAgent';
export {dayRead} from '../../../desktop/cradle/src/day/client';
export type {DayReading} from '../../../desktop/cradle/src/day/client';
export interface CradleOwnersOptions {
  /** Project is host-owned context for the existing Nara/Epii facade. */
  project: string | (() => string);
  onOpenConstellation?: (target: Awaited<ReturnType<typeof resolveSceneConstellation>>, request: unknown) => Promise<void>;
  personal?: boolean;
  onReceipts?: (receipts: readonly KernelReceipt[]) => void;
  /** Hosted-native receipts retain their separate World/generation identity. */
  onOutcome?: (outcome: KernelOutcome) => void;
  /** The host's current native access, independent of frame visibility. */
  isCurrent?: () => boolean;
  retainSelectionOnDispose?: boolean;
}

/** The existing kernel bridge handles Tauri or explicit loopback /op. Only
 * this host chooses the transport; messages cannot choose another owner URL. */
export function createCradleOwners(transport: KernelTransportStatus, options: CradleOwnersOptions): ExpressionsOwners {
  if (transport.kind === 'unavailable') return {channels: {}, unavailableReason: transport.reason};
  const requireCurrent = (context?: ChannelContext) => {
    if (context && !context.current() || options.isCurrent && !options.isCurrent()) throw Error('The native owner access changed before this operation completed');
  };
  const data = async (op: KernelOp, result: string, context?: ChannelContext, cleanup = false): Promise<unknown> => {
    if (!cleanup) requireCurrent(context);
    const call = await kernelOp(transport, op, context?.signal);
    if (call.error || !call.outcome || call.outcome.result !== result) throw Error(call.error ?? `The native owner did not answer ${result}`);
    if (!cleanup) {
      try {requireCurrent(context);}
      catch (cause) {
        if (op.op === 'native_expression' && object(op.request) && op.request.operation === 'open'
          && 'data' in call.outcome && object(call.outcome.data) && boundedText(call.outcome.data.lease)) {
          const closed = await kernelOp(transport, {op: 'native_expression', request: {operation: 'close', lease: call.outcome.data.lease}} as KernelOp);
          if (closed.error) throw Error(`Retired native access; cleanup of lease ${call.outcome.data.lease} failed: ${closed.error}`);
        }
        throw cause;
      }
    }
    options.onOutcome?.(call.outcome);
    if (call.outcome.receipts?.length) options.onReceipts?.(call.outcome.receipts);
    return (call.outcome as unknown as {data: unknown}).data;
  };
  const relativePath = (raw: unknown): string => {
    if (!boundedText(raw) || raw.startsWith('/') || raw.includes('\\') || raw.split('/').some(part => !part || part === '..')) throw Error('Choose a bounded Central-relative file path');
    return raw;
  };
  const centralReading = async (path: string) => {
    const slash = path.lastIndexOf('/');
    const directory = await listFiles(transport, slash > 0 ? path.slice(0, slash) : '');
    const file = directory.entries.find(row => row.name === path.slice(slash + 1) && row.kind === 'file');
    if (!file?.retrieval_allowed) throw Error(`Central does not disclose ${path} for retrieval`);
    return readFile(transport, file.location);
  };
  const subjectLocation = async (raw: unknown): Promise<CentralLocation> => {
    if (!boundedText(raw)) throw Error('A native subject reference is required');
    if (raw.startsWith('central:')) return resolveFileLocation(transport, raw);
    const slash = raw.lastIndexOf('/'), parent = slash < 0 ? '' : raw.slice(0, slash), name = raw.slice(slash + 1);
    const directory = await listFiles(transport, parent, true);
    const file = directory.entries.find(row => row.name === name && row.kind === 'file');
    if (!file?.retrieval_allowed) throw Error('Central does not disclose this subject for retrieval');
    return file.location;
  };
  return {
    channels: {
      'kernel-expression': (request, context) => data({op: 'expression', request} as KernelOp, 'expression', context),
      'kernel-expression-world': (request, context) => {
        if (!object(request) || !boundedText(request.operation, 128)) throw Error('A native world operation is required');
        return data({op: 'expression_world', request} as KernelOp, 'expression_world', context);
      },
      'expression-recovery': (request, context) => data({op: 'expression_recovery', request} as KernelOp, 'expression_recovery', context),
      'expression-file': request => hostedCompositionFile(transport, request),
      'scene-blueprint': request => readSceneBlueprint(transport, request as Parameters<typeof readSceneBlueprint>[1]),
      'library-read': request => readLibrary(transport, {scope: object(request) && request.scope === 'shared' ? 'shared' : 'local'}),
      'central-read': async request => {
        const path = relativePath(object(request) ? request.path : null), reading = await centralReading(path);
        return {path, revision: reading.revision, byte_len: reading.byte_len, content: reading.content};
      },
      'central-subject-text': async request => {
        const ref = object(request) ? request.ref : null, location = await subjectLocation(ref), reading = await readFile(transport, location);
        return {requested_ref: ref, ...reading, ref: reading.location.ref, native_owner: 'central'};
      },
      'central-subject-bytes': async request => {
        const ref = object(request) ? request.ref : null, location = await subjectLocation(ref), reading = await readFileBytes(transport, location);
        return {requested_ref: ref, ...reading, ref: reading.location.ref, native_owner: 'central'};
      },
      'techne-reading': request => readWikiSceneTechne(transport, request),
      'techne-constellation': async (request, context) => {
        requireCurrent(context);
        if (!object(request)) throw Error('A constellation operation is required');
        if (request.operation === 'relate') return relateSceneConstellation(transport, request);
        if (request.operation !== 'inspect' && request.operation !== 'open') throw Error('Unknown constellation operation');
        const target = await resolveSceneConstellation(transport, request);
        requireCurrent(context);
        if (request.operation === 'open') {
          if (!options.onOpenConstellation) throw Error('This shell has no mounted constellation editor');
          await options.onOpenConstellation(target, request);
          requireCurrent(context);
        }
        return target;
      },
      'techne-world': async (request, context) => {
        requireCurrent(context);
        if (!object(request)) throw Error('A Wiki world operation is required');
        // Same canonical projection registry used by the Cradle centre.
        // Fresh owner navigator projects supply the current World disclosure.
        const snapshot = await kernelOp(transport, {op: 'world_read'});
        requireCurrent(context);
        if (snapshot.error || snapshot.outcome?.result !== 'world_read') throw Error(snapshot.error ?? 'The native World did not supply a snapshot');
        const projects = snapshot.outcome.snapshot.navigator?.root?.work.projects ?? [];
        publishWikiNativeRegisters(projects.map(row => ({name: row.name, path: row.path})));
        if (request.operation === 'list') return {registers: wikiNativeRegisters(), selected: selectedWikiNativeRegister()?.key};
        if (request.operation !== 'open' || !boundedText(request.register)) throw Error('Choose a disclosed Wiki register');
        const register = wikiNativeRegisters().find(row => row.key === request.register);
        if (!register) throw Error('This Wiki register is not disclosed by the native World');
        const prepared = await ensureWikiNativeExpression(transport, register, {
          identity: JSON.stringify([transport, context?.bindingId, context?.epoch]),
          current: () => (!context || context.current()) && (!options.isCurrent || options.isCurrent()),
        });
        requireCurrent(context);
        selectWikiNativeRegister(register.key);
        return {expression_ref: prepared.document.expression_ref, register: register.key};
      },
    },
    native: async (request, context) => {
      if (!object(request)) throw Error('A native Expression request is required');
      if (request.operation === 'source') {
        const path = relativePath(request.path), reading = await centralReading(path);
        if (reading.byte_len > 32 * 1024 * 1024) throw Error('The native binding source exceeds 32 MiB');
        return {path, location: reading.location, revision: reading.revision, content: reading.content};
      }
      // Lease cleanup must reach the native owner after the frame aborts.
      return data({op: 'native_expression', request} as KernelOp, 'native_expression', request.operation === 'close' ? undefined : context, request.operation === 'close');
    },
    attach: options.personal === false ? undefined : (frame, state) => {
      // The reused personal facade predates strict targetOrigin. Its existing
      // live/epoch guard is disposed at pagehide, before a navigating frame
      // can receive personal replies. This requires same-origin serving.
      if (new URL(frame.src).origin !== window.location.origin) throw Error('Serve the candidate Expressions application at the shell origin before attaching its personal facade');
      let live = true, stop = () => {}, currentWindow: Window | null = null;
      const leaving = () => {stop(); stop = () => {};};
      const loaded = () => {
        leaving();
        if (!live) return;
        currentWindow?.removeEventListener('pagehide', leaving);
        currentWindow = frame.contentWindow;
        // A foreign navigation is refused before any facade is attached.
        try {if (currentWindow?.location.origin !== window.location.origin) return;}
        catch {return;}
        currentWindow?.addEventListener('pagehide', leaving);
        stop = relayNaraChannel(frame, transport, {
          project: () => typeof options.project === 'function' ? options.project() : options.project,
          expression: () => state()?.nativeScene ?? null,
          isCurrent: options.isCurrent,
          retainSelectionOnDispose: options.retainSelectionOnDispose,
        });
      };
      frame.addEventListener('load', loaded);
      // The core mount binds before append; the first load installs the facade.
      // Existing already-loaded frames can be joined without another reload.
      if (frame.contentDocument?.readyState === 'complete' && frame.contentWindow?.location.href !== 'about:blank') loaded();
      return () => {live = false; leaving(); currentWindow?.removeEventListener('pagehide', leaving); frame.removeEventListener('load', loaded);};
    },
  };
}
