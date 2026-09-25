/** Technè operates inside the hosted Expressions application. The cradle
 * supplies owner readings; it never replaces the field with another lens UI. */
import {useCallback, useEffect, useRef, useState} from "react";
import {PointCloudHost} from "../expressions/PointCloudHost";
import {useKernel} from "../kernel/KernelProvider";
import {readWikiSceneTechne} from "./wikiReadingProvider";
import type {SurfaceBinding} from "../surface/types";
import type {HostedAppState} from "../expressions/hostedApp";
import type {TechneSubject} from "./techneReading";
import "./techneHud.css";
import {ensureWikiNativeExpression, focusWikiNativeExpression, publishWikiNativeRegisters, selectedWikiNativeRegister, selectWikiNativeRegister, wikiNativeRegisters} from "./wikiNativeExpression";
import {consumeWikiSelectionRequest, getWikiProjectionState, subscribeWikiProjection} from "./wikiProjectionStore";
import {requestTechneFieldOpen} from "../expressions/fieldOpen";

export function TechneCentre({binding, deepLink, onHostedState}: {
  binding: SurfaceBinding;
  subject?: TechneSubject;
  deepLink?: string;
  onHostedState?: (state: HostedAppState) => void;
}) {
  const kernel = useKernel();
  const centre = useRef<HTMLDivElement>(null);
  // Live engine checkpoints update deepLink while the first Wiki read is
  // pending. Only the mount-time checkpoint decides whether to open the
  // default Wiki; a fresh blank engine announcement must not cancel it.
  const initialWiki = useRef(!deepLink || deepLink === "oi-mark" || deepLink === "source-twelve-faces");
  const [presented, setPresented] = useState(false);
  useEffect(() => {
    const node = centre.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => setPresented(entries.some(entry => entry.isIntersecting)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    publishWikiNativeRegisters((kernel.snapshot.navigator?.root?.work.projects ?? []).map(row => ({name: row.name, path: row.path})));
  }, [kernel.snapshot.navigator?.root?.work.projects]);
  useEffect(() => {
    if (!presented) return;
    let live = true, generation = 0, draining = false;
    const openSelection = async () => {
      if (draining) return;
      draining = true;
      try { while (live) {
      const request = getWikiProjectionState().request;
      if (!request) break;
      const register = wikiNativeRegisters().find(row => row.key === request.registerKey);
      if (!register) break;
      initialWiki.current = false;
      consumeWikiSelectionRequest();
      const current = ++generation;
      try {
        const prepared = await focusWikiNativeExpression(kernel.transport, register, request);
        if (live && current === generation) {setFailure(undefined);requestTechneFieldOpen(prepared.document.expression_ref, binding.id, true);}
      } catch (error) { if (live && current === generation) setFailure(String(error instanceof Error ? error.message : error)); }
      } } finally {draining = false;}
    };
    const unsubscribe = subscribeWikiProjection(() => {void openSelection();});
    void openSelection();
    {
      // A restored authored work wins over the register's default projection.
      if (initialWiki.current) {
        const register = selectedWikiNativeRegister() ?? wikiNativeRegisters()[0];
        const current = generation;
        if (register) void ensureWikiNativeExpression(kernel.transport, register).then(prepared => {
          if (live && generation === current && initialWiki.current) {
            initialWiki.current = false;
            requestTechneFieldOpen(prepared.document.expression_ref, binding.id);
          }
        }).catch(error => {if (live && generation === current) setFailure(String(error instanceof Error ? error.message : error));});
      }
    }
    return () => {live = false; unsubscribe();};
  }, [kernel.transport, binding.id, presented]);
  const techneWorld = useCallback(async (request: unknown) => {
    const value = request as {operation?: unknown; register?: unknown} | null;
    if (value?.operation === 'list') return {registers: wikiNativeRegisters(), selected: selectedWikiNativeRegister()?.key};
    if (value?.operation !== 'open' || typeof value.register !== 'string') throw new Error('Choose a disclosed Wiki register');
    const register = wikiNativeRegisters().find(row => row.key === value.register);
    if (!register) throw new Error('This register is not disclosed by the current World');
    const prepared = await ensureWikiNativeExpression(kernel.transport, register);
    selectWikiNativeRegister(register.key);
    return {expression_ref: prepared.document.expression_ref, register: register.key};
  }, [kernel.transport]);
  const readTechne = useCallback((request: unknown) => readWikiSceneTechne(kernel.transport, request), [kernel.transport]);
  return <div ref={centre} className="techne-centre">
    {failure && <p className="techne-owner-error" role="alert">{failure}</p>}
    <div className="techne-centre-field">
      <PointCloudHost mode="techne" bindingId={binding.id} deepLink={deepLink} onHostedState={onHostedState} readTechne={readTechne} techneWorld={techneWorld}/>
    </div>
  </div>;
}
