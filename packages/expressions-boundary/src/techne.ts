/** The native Technē centre's owner routing, joined to the retained host.
 * Construction is inert. Only an explicit open or a canonical human selection
 * request prepares/focuses native work. The existing Wiki projection owns its
 * reading/selection; this adapter holds no document, scene or graph store. */
import {kernelOp} from '../../../desktop/cradle/src/kernel/bridge';
import type {KernelTransportStatus} from '../../../desktop/cradle/src/kernel/types';
import {
  ensureWikiNativeExpression, focusWikiNativeExpression, publishWikiNativeRegisters,
  selectedWikiNativeRegister, selectWikiNativeRegister, wikiNativeRegisters,
} from '../../../desktop/cradle/src/techne/wikiNativeExpression';
import {
  consumeWikiSelectionRequest, getWikiProjectionState, subscribeWikiProjection,
} from '../../../desktop/cradle/src/techne/wikiProjectionStore';
import type {WikiRegister} from '../../../desktop/cradle/src/techne/wikiExpression';
import type {SceneConstellationTarget} from '../../../desktop/cradle/src/techne/wikiReadingProvider';
import type {ExpressionsHost} from './host.ts';
import {boundedText, isDeepInstrument, type HostedTechneLens} from './protocol.ts';

export type {WikiRegister, SceneConstellationTarget};
export interface NativeTechneSelection {
  registerKey: string;
  sceneRef: string;
  entityRef: string | null;
  relationRef?: string | null;
  lens?: HostedTechneLens;
}
/** This is the acknowledged native basis, not an acknowledgement that the
 * application has finished opening. Its own state announcement proves that. */
export interface NativeTechneOpen {
  register: string;
  expression_ref: string;
  revision: number;
  scene_ref: string;
  entity_ref: string | null;
  drift?: string;
}
export interface NativeTechneNavigatorOptions {
  transport: KernelTransportStatus;
  host: ExpressionsHost;
  isPresented: () => boolean;
  onError?: (reason: string) => void;
}
/** A mounted source editor opens the exact owner-resolved frame. It returns
 * an owner ref/revision; the kernel keeps authoring, source-CAS and receipts.
 * This callback does not copy its draft or introduce a browser Wiki store. */
export type NativeConstellationEditor = (
  target: SceneConstellationTarget,
  request: Readonly<{expression_ref: string; revision: number; scene_ref: string; entity_ref: string}>,
) => Promise<{frame_ref: string; frame_revision: number}>;

export function createNativeTechneNavigator(options: NativeTechneNavigatorOptions) {
  let live = true, generation = 0, stopSelection: (() => void) | undefined;
  const abort = new AbortController();
  const active = () => {
    if (!live) throw Error('The Technē navigator was disposed');
  };
  const presented = () => {
    active();
    if (!options.isPresented()) throw Error('The retained Technē application is concealed');
  };
  const registerFor = (key: string) => {
    if (!boundedText(key)) throw Error('Choose a disclosed Wiki register');
    const register = wikiNativeRegisters().find(row => row.key === key);
    if (!register) throw Error('This Wiki register is not disclosed by the native World');
    return register;
  };
  const refreshRegisters = async (): Promise<readonly WikiRegister[]> => {
    active();
    const result = await kernelOp(options.transport, {op: 'world_read'}, abort.signal);
    active();
    if (result.error || result.outcome?.result !== 'world_read') throw Error(result.error ?? 'The native World did not supply a snapshot');
    const projects = result.outcome.snapshot.navigator?.root?.work.projects ?? [];
    return publishWikiNativeRegisters(projects.map(row => ({name: row.name, path: row.path})));
  };
  const opened = (register: WikiRegister, prepared: Awaited<ReturnType<typeof ensureWikiNativeExpression>>, token: number, lens?: HostedTechneLens, refresh = false): NativeTechneOpen => {
    presented();
    if (token !== generation) throw Error('A newer Technē open superseded this request; native work was retained');
    selectWikiNativeRegister(register.key);
    options.host.openExpression(prepared.document.expression_ref, options.host.bindingId, {refresh, lens});
    return {register: register.key, expression_ref: prepared.document.expression_ref, revision: prepared.document.revision,
      scene_ref: prepared.document.selection.scene_ref, entity_ref: prepared.document.selection.entity_ref ?? null,
      ...(prepared.drift ? {drift: prepared.drift} : {})};
  };
  const openRegister = async (key: string, request: {lens?: HostedTechneLens} = {}): Promise<NativeTechneOpen> => {
    presented();
    if (request.lens !== undefined && !isDeepInstrument(request.lens)) throw Error('Unknown deep instrument');
    const token = ++generation;
    await refreshRegisters();
    if (token !== generation) throw Error('A newer Technē open superseded this request');
    const register = registerFor(key);
    const prepared = await ensureWikiNativeExpression(options.transport, register);
    return opened(register, prepared, token, request.lens);
  };
  const openSelection = async (request: NativeTechneSelection): Promise<NativeTechneOpen> => {
    presented();
    if (!request || !boundedText(request.registerKey) || !boundedText(request.sceneRef)
      || request.entityRef !== null && !boundedText(request.entityRef)
      || request.relationRef !== undefined && request.relationRef !== null && !boundedText(request.relationRef)
      || request.lens !== undefined && !isDeepInstrument(request.lens)) throw Error('Choose a bounded native Scene selection and deep instrument');
    const token = ++generation;
    await refreshRegisters();
    presented();
    if (token !== generation) throw Error('A newer Technē selection superseded this request');
    const register = registerFor(request.registerKey);
    const prepared = await focusWikiNativeExpression(options.transport, register, request);
    return opened(register, prepared, token, request.lens, true);
  };
  /** Consume the existing graph/wiki request seam, only while this one host
   * is presented. Concealed hosts leave the same request for its owner. */
  const connectSelectionRequests = () => {
    active();
    if (stopSelection) throw Error('This Technē navigator already consumes selection requests');
    let draining = false, connected = true;
    const drain = async () => {
      if (draining || !connected || !live || !options.isPresented()) return;
      draining = true;
      try {
        while (connected && live && options.isPresented()) {
          const request = getWikiProjectionState().request;
          if (!request) break;
          consumeWikiSelectionRequest();
          try {await openSelection(request);}
          catch (error) {if (connected && live) options.onError?.(error instanceof Error ? error.message : String(error));}
        }
      } finally {draining = false;}
    };
    const unsubscribe = subscribeWikiProjection(() => {void drain();});
    const disconnect = () => {if (!connected) return; connected = false; generation++; unsubscribe(); if (stopSelection === disconnect) stopSelection = undefined;};
    stopSelection = disconnect;
    void drain();
    return disconnect;
  };
  return {
    refreshRegisters,
    registers: () => {active(); return wikiNativeRegisters();},
    selectedRegister: () => {active(); return selectedWikiNativeRegister();},
    openRegister, openSelection, connectSelectionRequests,
    selectInstrument: (lens: HostedTechneLens) => {presented(); options.host.selectInstrument(lens);},
    dispose: () => {if (!live) return; live = false; generation++; abort.abort(); stopSelection?.();},
  };
}
