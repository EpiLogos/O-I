/**
 * The React host side of the projection module boundary
 * (WORLD-SHELL-DESIGN §10 seams 1–3): the encounter publication context and
 * the pane body that mounts an admitted module. The contract itself —
 * encounter bridge, module registration, admission door — lives in
 * `surface/projectionModules.ts` (language-pure, unit-tested outside a
 * browser); everything React is here.
 */
import {createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {absentEncounterBridge, projectionModule, type EncounterBridge, type ProjectionModuleHandle} from "./projectionModules";
import {isProjectionPaneKind, type SurfaceBinding} from "./types";

// ---------------------------------------------------------------------------
// the host side — pane body mounting, encounter delivery

/** The encounter spine a HOST publishes through. React hosts render this
 * provider above their pane host; the spine state itself stays wherever the
 * host already owns it (in this shell: the workspace book's WorldContext
 * plus the workspace's accessEpoch) — the provider only carries the
 * subscriber/router, never a shadow of the state. */
export interface ProjectionEncounterSource {
  bridge: EncounterBridge;
  /** Publish the current spine reading to every subscriber. React hosts
   * call it on each render of the provider (the render IS the spine's
   * publication); standalone hosts call it after each spine change. */
  publish(): void;
}

const ProjectionEncounterContext = createContext<ProjectionEncounterSource | null>(null);
export function ProjectionEncounterProvider({source, children}: {source: ProjectionEncounterSource | null; children: ReactNode}) {
  return <ProjectionEncounterContext.Provider value={source}>{children}</ProjectionEncounterContext.Provider>;
}
/** The admitted spine, or the honest absence bridge — never a guess. */
export function useProjectionEncounter(): ProjectionEncounterSource {
  return useContext(ProjectionEncounterContext) ?? {bridge: absentEncounterBridge, publish: () => {}};
}

/**
 * The pane body for a projection kind: mounts the admitted module into a
 * div, delivers the encounter, and keeps the body MOUNTED AND STATEFUL while
 * concealed — the pane tier hides the wrapper; the module is told through
 * `setVisible` and keeps its state until unmount. A kind with no admitted
 * module shows an honest absence note: presence of a kind is not a claim of
 * a body.
 */
export function ProjectionSurface({binding}: {binding: SurfaceBinding}) {
  const registration = isProjectionPaneKind(binding.kind) ? projectionModule(binding.kind) : undefined;
  const {bridge, publish} = useProjectionEncounter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ProjectionModuleHandle | null>(null);
  const presentedRef = useRef(true);
  const panePresentationRef = useRef<string | null>(null);
  const [fault, setFault] = useState<string | null>(null);
  // The pane's own view of the encounter: the shared spine reading plus this
  // pane's presented cut. `present` transitions are pane-local by contract
  // and stop here; subject/occasion route through to the spine.
  const paneEncounter = useMemo<EncounterBridge>(() => ({
    snapshot: () => ({...bridge.snapshot(), presented: presentedRef.current}),
    subscribe: listener => bridge.subscribe(reading => listener({...reading, presented: presentedRef.current})),
    transition: intent => {
      if (intent.kind === "present") {panePresentationRef.current = intent.presentation; return;}
      bridge.transition(intent);
    },
  }), [bridge]);
  // A new kernel connection generation remounts the pane's module: its old
  // registration was retired by the epoch guard, and a fresh mount
  // re-subscribes on the current epoch — the same accessEpoch/accessReady
  // pattern the shell's own views obey.
  const epoch = bridge.snapshot().accessEpoch;
  useEffect(() => {
    if (!registration || !elementRef.current) return;
    let live = true;
    setFault(null);
    Promise.resolve()
      .then(() => registration.create({
        kind: registration.kind,
        binding: {id: binding.id, title: binding.title, subject_ref: binding.projection?.subject_ref},
        element: elementRef.current!,
        encounter: paneEncounter,
      }))
      .then(handle => {
        if (!live) {handle.unmount(); return;}
        handleRef.current = handle;
      })
      .catch(reason => {
        if (live) setFault(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      live = false;
      handleRef.current?.unmount();
      handleRef.current = null;
    };
    // One mount per binding instance per connection generation; encounter
    // delivery rides `publish`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding.id, registration?.id, epoch]);
  useEffect(() => {
    publish();
  });
  // Concealed-retained notice (the pane tier hides the WRAPPER with
  // display:none): the same off-screen observation every viewport-gated
  // surface honours — an IntersectionObserver — tells the module it is
  // concealed so its engines may pause. Its state survives; only `unmount`
  // ends it.
  useEffect(() => {
    const wrapper = wrapperRef.current, handle = () => handleRef.current;
    if (!wrapper || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        presentedRef.current = entry.isIntersecting;
        handle()?.setVisible?.(entry.isIntersecting);
      }
    });
    observer.observe(wrapper);
    return () => {observer.disconnect(); presentedRef.current = false; handle()?.setVisible?.(false);};
  }, [!!registration]);
  if (!registration) {
    return <p role="status" className="source-note">No projection module is admitted for {binding.kind} — the pane kind exists; its body has not been admitted by any owner yet.</p>;
  }
  return (
    <div ref={wrapperRef} className="projection-pane-body" data-projection-kind={binding.kind} data-projection-subject={binding.projection?.subject_ref ?? undefined} style={{position: "relative", width: "100%", height: "100%", minHeight: 0}}>
      {fault
        ? <p role="alert" className="source-note">{binding.title} could not mount — {fault}</p>
        : <div ref={elementRef} style={{position: "absolute", inset: 0}} />}
    </div>
  );
}
