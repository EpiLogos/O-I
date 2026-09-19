/**
 * The Technè centre surface, rebuilt as the DUAL-MODE body (owner wayfinder
 * 2026-09-19, PR #387 §11–13, §26 T1). ONE Expressions system, two
 * full-screen operating cuts around the SAME stage:
 *
 *   EXPRESSIONS cut — the hosted application with its full physics authoring
 *   HUD, exactly as the Expressions centre (PointCloudHost) shows it.
 *
 *   TECHNÈ cut — the same living field full-screen, the application's
 *   authoring chrome stood down through the host↔frame mode channel
 *   (hostedApp.postHostMode → the app's oi-host-techne class), and a compact
 *   persistent cradle-side HUD over it: the Expressions ⇄ Technē switch,
 *   Interact/Select (driven through host-command), Library / Search / verso
 *   (dispatched to the T2 summon seam), face (return to the bare field),
 *   source/open depth (the material scene, MaterialDepth.tsx), the position
 *   readout (the application's own oi-app-state announcements), the lens
 *   chooser (lensMount.ts registry — ONLY the active lens's body mounts),
 *   Epii summon, and the Lens Studio dock.
 *
 * The stage is the ONE living iframe (the one hosted-application instance
 * this surface stands): switching cuts NEVER remounts it — the app's scene,
 * selection, draft and session ride through. The six-instrument tab strip
 * and its waiting slot panes are retired as primary UX; the rail's persisted
 * active-instrument id survives as the lens chooser's initial state
 * (instrumentRail.getInstrumentRail / selectInstrument).
 *
 * Honesty: the lens registry may be empty (the instrument lanes register
 * through lensMount.ts) — the chooser says so and the field stands bare; a
 * lens the disclosure refuses stays discoverable with the actual reason;
 * the position readout shows only what the application reported.
 */
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject} from "react";
import type {SurfaceBinding} from "../surface/types";
import type {NativeFileEntry} from "../kernel/types";
import {useKernel} from "../kernel/KernelProvider";
import {listFiles} from "../files/client";
import {
  EXPRESSIONS_APP_DIST,
  EXPRESSIONS_APP_ENTRY,
  materialUrl,
  postHostMode,
  relayKernelChannel,
  trackHostedAppState,
  trackShellCutout,
  type HostedAppState,
  type HostedAppMode,
} from "../expressions/hostedApp";
import {Glyph} from "../workspace/Glyph";
import {ICON} from "../expressions/icons";
import {useDock} from "../expressions/dock";
import {EpiiPlane} from "./EpiiPlane";
import {MaterialDepth} from "./MaterialDepth";
import {getInstrumentRail, selectInstrument} from "./instrumentRail";
import {subscribeTechneLenses, techneLenses, type TechneLens, type TechneLensStudio} from "./lensMount";
import {registerTechneReadingProvider, refreshTechneDisclosure, useTechneDisclosure, type TechneInstrumentId} from "./techneReading";
import {useTechneGroundSubject, wikiTechneReadingProvider, wikiExpressionDocumentFor, wikiRegisterForSubject} from "./wikiReadingProvider";
import {registerTechneAdapter, registerTechneSource} from "./m0m5/adapter";
import {kernelTechneAdapter, kernelTechneSource} from "./kernelTechneAdapter";
import {setCut, useSurfaceCut} from "./dualMode";
import {TechneCutRecall, TechneHud, dispatchTechneSummon} from "./TechneHud";
// The six M′ lenses register as a side effect of this import (T3's
// instrumentLenses.ts) — the chooser reads the registry from lensMount.ts.
import "./instrumentLenses";
import "./techne.css";

/** The Lens Studio / material depth share one right-edge dock slot (one
 * panel at a time, the application's own exclusivity law). */
const DOCK_KEY = "oi-cradle.techne.dual-dock.v1";
type DockGuest = "studio" | "material" | null;

export function TechneSurface({binding, subject}: {binding: SurfaceBinding; subject?: {ref?: string; kind?: string; title: string; project?: string}}) {
  const sceneId = binding.id;
  const cut = useSurfaceCut(sceneId);
  // The field's effective subject: the workspace's selected subject, else
  // the mode's own ground — the current register's wiki local whole (the
  // M0′ law: the web IS the opening). Everything below stands on it: the
  // disclosure, the session, the HUD readout and the lens bodies.
  const groundSubject = useTechneGroundSubject(subject);
  const disclosure = useTechneDisclosure(groundSubject);
  const lenses = useSyncExternalStore(subscribeTechneLenses, techneLenses, techneLenses);

  // ---- the one stage ------------------------------------------------------
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [stageStanding, setStageStanding] = useState<"reading" | "ready" | "refused">("reading");
  const [stageReason, setStageReason] = useState<string | undefined>();
  const [entry, setEntry] = useState<NativeFileEntry | undefined>();
  const kernel = useKernel();

  // The application's position announcements (hostedApp.trackHostedAppState)
  // — the HUD's Web/Scene/selection readout. Honest absence until one
  // arrives: the readout names that nothing is reported yet.
  const [appState, setAppState] = useState<HostedAppState | null>(null);

  // Resolve the vendored app's entry through the files seam — the same
  // hosting path as the Expressions centre (hostedApp.ts carries it).
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const directory = await listFiles(kernel.transport, EXPRESSIONS_APP_DIST);
        const found = directory.entries.find(candidate => candidate.name === EXPRESSIONS_APP_ENTRY);
        if (!found) throw new Error(`The Expressions application is not built at ${EXPRESSIONS_APP_DIST} — build it with the one law in desktop/cradle/expressions-app/README.md`);
        if (!alive) return;
        setEntry(found); setStageStanding("ready");
      } catch (error) {
        if (!alive) return;
        setStageStanding("refused"); setStageReason(String(error instanceof Error ? error.message : error));
      }
    })();
    return () => { alive = false; };
  }, [kernel.transport]);

  const src = entry
    ? kernel.transport.kind === "tauri"
      ? materialUrl(entry.location)
      : kernel.transport.kind === "bridge"
        ? `${kernel.transport.url}/material/${encodeURIComponent(JSON.stringify(entry.location))}/`
        : undefined
    : undefined;

  // The shell cutout alignment, the kernel host channel, the mode channel
  // and the app-state tracking — each one hostedApp seam, stood up per
  // frame. The mode effect re-posts on every cut change (postHostMode also
  // re-announces on frame load, the race-free initial ask).
  useEffect(() => {
    const node = frameRef.current;
    return node ? trackShellCutout(node) : undefined;
  }, [stageStanding]);
  useEffect(() => {
    const node = frameRef.current;
    if (!node || stageStanding !== "ready") return;
    return relayKernelChannel(node, kernel.transport);
  }, [stageStanding, kernel.transport]);
  useEffect(() => {
    const node = frameRef.current;
    return node ? postHostMode(node, cut) : undefined;
  }, [cut, stageStanding]);
  useEffect(() => {
    const node = frameRef.current;
    if (!node || stageStanding !== "ready") return;
    return trackHostedAppState(node, setAppState);
  }, [stageStanding]);

  // The wiki-grounded reading provider stands while the surface stands: the
  // subject's disclosure is composed from the register's real wiki reading
  // (the Wayfinder's resolve-once path, §20). With it stand the kernel
  // Technē source and its adapter override — the Journey save lane: a
  // routed `oi.expression.edit` scene_create crosses the native authority
  // seam (the kernel's expression op) and the saved document returns to the
  // ONE projection state. The QL TechneAdapter, when its owner registers
  // one in this window, was already registered first and serves instead.
  useEffect(() => {
    if (kernel.transport.kind === "unavailable") return;
    const unregisterProvider = registerTechneReadingProvider(wikiTechneReadingProvider(kernel.transport));
    const unregisterSource = registerTechneSource(kernelTechneSource(kernel.transport));
    const unregisterAdapter = registerTechneAdapter("oi-cradle.wiki-reading/v1", kernelTechneAdapter(kernel.transport));
    return () => {
      unregisterProvider();
      unregisterSource();
      unregisterAdapter();
    };
  }, [kernel.transport]);

  // The disclosure follows the register's Expression generation: when the
  // M0′ projection opens the document (or a saved Journey scene advances
  // its revision), the reading basis grew what the first read could not
  // carry — refresh the disclosure once per basis change.
  const expressionBasis = useRef<string | null>(null);
  useEffect(() => {
    const register = wikiRegisterForSubject(groundSubject);
    const document = register ? wikiExpressionDocumentFor(register.key) : undefined;
    const basis = document ? `${document.expression_ref}@${document.revision}` : null;
    if (expressionBasis.current === null) { expressionBasis.current = basis; return; }
    if (basis !== expressionBasis.current) {
      expressionBasis.current = basis;
      refreshTechneDisclosure();
    }
  }, [groundSubject]);

  // ---- the shared dock slot ------------------------------------------------
  const dock = useDock(DOCK_KEY, {open: false, size: 400}, {min: 260, max: 760}, "right");
  const [dockGuest, setDockGuest] = useState<DockGuest>(null);
  const dockRef = useRef(dock);
  dockRef.current = dock;
  const setGuest = useCallback((guest: DockGuest) => {
    setDockGuest(guest);
    dockRef.current.setOpen(guest !== null);
  }, []);

  // ---- the lens chooser ---------------------------------------------------
  // The rail's persisted active instrument survives as the chooser's initial
  // state; a lens id with no registered lens mounts nothing (honest).
  const [activeId, setActiveId] = useState<TechneInstrumentId | null>(() => getInstrumentRail().active);
  const activeLens = useMemo(() => lenses.find(lens => lens.instrument === activeId), [lenses, activeId]);
  const openLens = useCallback((lens: TechneLens | null) => {
    setActiveId(lens ? lens.instrument : null);
    if (lens) selectInstrument(lens.instrument);
    // Choosing a lens opens its Studio; leaving it closes the Studio slot.
    if (lens) { setDockGuest(current => current === "material" ? "material" : "studio"); dockRef.current.setOpen(true); }
    else setDockGuest(current => current === "studio" ? null : current);
  }, []);
  // A lens leaving with the Studio open closes the slot — never an empty
  // panel standing over the field.
  useEffect(() => {
    if (!activeLens && dockGuest === "studio") setGuest(null);
  }, [activeLens, dockGuest, setGuest]);

  // ---- the Lens Studio contract (lensMount.TechneLensStudio) --------------
  const [studioBody, setStudioBody] = useState<ReactNode | null>(null);
  const [studioTools, setStudioTools] = useState<ReactNode | null>(null);
  const studio = useMemo<TechneLensStudio>(() => ({setBody: setStudioBody, setTools: setStudioTools}), []);
  // Clear Studio/toolbelt content on lens switch and unmount — both
  // directions: before the next lens mounts, and when the surface leaves.
  const activeKey = activeLens?.instrument;
  useEffect(() => {
    setStudioBody(null); setStudioTools(null);
    return () => { setStudioBody(null); setStudioTools(null); };
  }, [activeKey]);

  // ---- Epii summon (companion overlay, never a permanent sidebar) ---------
  const [epiiOpen, setEpiiOpen] = useState(false);
  // The material depth's transient refusals, carried at the surface level so
  // they survive the dock's own lifecycle.
  const [dockNotice, setDockNotice] = useState<string | null>(null);

  const onSummon = useCallback((kind: "library" | "verso" | "search") => dispatchTechneSummon(kind), []);
  const onCut = useCallback((next: HostedAppMode) => setCut(sceneId, next), [sceneId]);

  return <section className="tn-surface tn-dual" aria-label="Technè" data-surface-id={binding.id}
      data-cut={cut} data-stage={stageStanding} data-lens={activeLens?.instrument}
      data-subject={groundSubject ? "grounded" : "none"}
      data-ground={groundSubject === subject ? "workspace" : "register"} data-disclosure={disclosure.standing}>
    {/* THE one hosted-application stage. Never remounted by a cut switch:
      * the iframe stands in both cuts; only the HUD around it changes. */}
    {stageStanding === "refused" && <div className="tn-stage-refusal" role="alert">
      <strong>The Expressions application is unavailable here</strong>
      <p>{stageReason}</p>
      {src === undefined && <p className="oi-note">This view serves through the owner's material seam in the desktop build; a plain browser window cannot host it.</p>}
    </div>}
    {src && <iframe
      ref={frameRef}
      src={src}
      title="O:I Expressions — the one stage of the Technè dual mode"
      className="tn-stage-frame"
      allow="fullscreen"
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-forms allow-downloads allow-same-origin"/>}

    {/* THE TECHNÈ CUT: the compact persistent HUD over the same field. */}
    {cut === "techne" && <TechneHud
      cut={cut} onCut={onCut}
      disclosure={disclosure} subject={groundSubject}
      lenses={lenses} activeLens={activeLens} onLens={openLens}
      appState={appState} frameRef={frameRef as RefObject<HTMLIFrameElement | null>}
      onSummon={onSummon}
      depthOpen={dockGuest === "material" && dock.state.open}
      onDepth={() => setGuest(dockGuest === "material" ? null : "material")}
      studioOpen={dockGuest === "studio" && dock.state.open}
      onStudio={() => setGuest(dockGuest === "studio" ? null : "studio")}
      epiiOpen={epiiOpen} onEpii={() => setEpiiOpen(value => !value)}/>}

    {/* THE ACTIVE LENS — the only rich renderer, mounted as the primary
      * working surface over the field. Dismissed with Face or by choosing
      * the active lens again. */}
    {cut === "techne" && activeLens && <div className="tn-lens-stage" role="region" aria-label={`M${activeLens.mPrime}′ ${activeLens.label}`} data-instrument={activeLens.instrument}>
      <activeLens.Body key={`${activeLens.instrument}:${sceneId}`} binding={binding} subject={groundSubject}
        disclosure={disclosure} sceneId={sceneId} studio={studio}/>
    </div>}

    {/* THE SHARED DOCK SLOT: Lens Studio / the material depth. */}
    {cut === "techne" && dock.state.open && dockGuest && <>
      <div className="oi-resize-handle" aria-label="Resize the dock" {...dock.handle}/>
      <aside className="tn-dock" aria-label={dockGuest === "studio" ? "Lens Studio" : "Source depth — the material scene"}
        style={{inlineSize: dock.state.size}} data-guest={dockGuest}>
        <div className="oi-panel-head">
          <span className="oi-panel-head-title">{dockGuest === "studio" ? (activeLens ? `Lens Studio — ${activeLens.label}` : "Lens Studio") : "Source depth"}</span>
          <span className="oi-panel-head-tools">
            <button type="button" className="oi-tool" aria-label="Close the dock" onClick={() => setGuest(null)}><Glyph name={ICON.close} size={13}/></button>
          </span>
        </div>
        <div className="tn-dock-body oi-scroll" tabIndex={-1}>
          {dockGuest === "studio"
            ? (studioBody ?? <p className="oi-note" role="status">{activeLens ? "The active lens parked no Studio controls." : "No lens is active — choose one in the lens chooser."}</p>)
            : <MaterialDepth sceneId={sceneId} project={binding.project} onNotice={setDockNotice}/>}
        </div>
      </aside>
    </>}

    {/* The dock's transient notice line (the material depth's refusals). */}
    {cut === "techne" && dockNotice && <p className="oi-refusal tn-notice tn-dock-notice" role="status">{dockNotice}
      <button type="button" className="oi-tool" aria-label="Dismiss" onClick={() => setDockNotice(null)}><Glyph name={ICON.close} size={12}/></button>
    </p>}

    {/* THE EXPRESSIONS CUT: the application shows its own full physics HUD;
      * one thin floating control returns to the deep cut. */}
    {cut === "expressions" && stageStanding === "ready" && <TechneCutRecall binding={binding} onCut={onCut}/>}

    {/* Epii: a summonable companion overlay over the field. */}
    {cut === "techne" && epiiOpen && <aside className="tn-epii" role="complementary" aria-label="Epii — the Technē depth agent" data-open="true">
      <header className="tn-epii-head">
        <span className="oi-eyebrow">Epii · summoned</span>
        <button type="button" className="oi-tool" aria-label="Send Epii away" onClick={() => setEpiiOpen(false)}><Glyph name={ICON.close} size={13}/></button>
      </header>
      <div className="tn-epii-body oi-scroll-quiet">
        <EpiiPlane subject={{ref: groundSubject.ref, kind: groundSubject.kind, title: groundSubject.title, project: groundSubject.project}}/>
      </div>
    </aside>}

    {/* The lens's pinned tools — the contextual toolbelt of the deep cut. */}
    {cut === "techne" && studioTools && <div className="tn-toolbelt" role="toolbar" aria-label="Lens tools" data-instrument={activeLens?.instrument}>{studioTools}</div>}

    {/* The whole-surface disclosure standing, named for readers and agents
      * (the HUD's state chip carries the same line in the strip). */}
    {cut === "techne" && disclosure.standing === "unavailable" && <span className="tn-disclosure-refusal" role="status">
      QL reading unavailable: {disclosure.reason}
    </span>}
  </section>;
}
