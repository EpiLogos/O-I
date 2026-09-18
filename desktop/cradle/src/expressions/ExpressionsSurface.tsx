/**
 * The Expressions centre surface (surface kind "expressions") — the living
 * Expressions application hosted in a pane, field-first.
 *
 * Structure (after the reference instrument, in the desktop's own grammar):
 *
 *   menubar    Composition / Library / Setup menus · the field-local toolbelt
 *   field      the stage ARTBOARD fills the body; under it the scene transport
 *              (scene planes, add scene, the entity row)
 *   Studio     a dock INSIDE this surface (right edge, or beneath when the
 *              pane is split small): the selected entity's parameters and
 *              binding, review, pedagogy, the full engine control set, and
 *              disclosure. It never touches the shell's right agent panel.
 *
 * Laws this surface keeps:
 *   - ONE production field per window. The artboard borrows the window's
 *     stage canvas through `stage.present` + `setContainer`; it never creates
 *     a renderer, a canvas or a clock. A composition presents under the same
 *     presentation id the composer uses ("expression-application"), so the
 *     two can never stand at once.
 *   - No default running physics. The artboard presents PAUSED: one still
 *     frame per change and no scheduled frames. The simulation clock runs only
 *     after the person presses Play, and stops again on Pause.
 *   - No motion expressions for UI events. Opening, closing, resizing and
 *     selecting draw nothing on the field.
 *   - With Expression disabled the artboard is a named static state carrying
 *     the real enable control.
 *
 * Authoring state is `useExpressionApplication`; the inspector, pedagogy and
 * review bodies are the composer's own parts; the engine controls are
 * Settings → Visuals' `ExpressionControls`. Nothing is re-implemented here.
 */
import {useCallback, useEffect, useId, useRef, useState} from "react";
import {scrollWithin} from "../shared/scrollWithin";
import type {SurfaceBinding} from "../surface/types";
import {useVisuals} from "../visuals/ParticleExpression";
import {visuals} from "../visuals/store";
import {useExpressionStage, type StagePresentation} from "../stage/ExpressionStage";
import {expressionConfig} from "../expression/engineProjection";
import {ExpressionVerso} from "../expression/ExpressionVerso";
import {ShareProjection} from "../explore/ShareProjection";
import {EXPRESSION_EDITOR_ACTOR as ACTOR, exportExpressionCopy, useExpressionApplication} from "../expression/useExpressionApplication";
import {ExpressionEntityInspector, ExpressionPedagogy, ExpressionRefinementReview, ExpressionReviewedDecisions} from "../expression/parts";
import {ExpressionControls} from "../workspace/settings/VisualsView";
import {PRESETS} from "@epilogos/oi-design-system/point-cloud/presets";
import type {PointCloudConfig, PointCloudPatch} from "@epilogos/oi-design-system/point-cloud/config";
import {Glyph} from "../workspace/Glyph";
import {ICON} from "./icons";
import {FieldMenu, FieldMenuCheck, FieldMenuItem} from "./FieldMenu";
import {useDock, useDockEdge} from "./dock";
import {consumeExpressionRequest, publishExpressionSelection, registerExpressionCentre, useExpressionSelectionState, type ExpressionFocusTarget} from "./selection";
import "../expression/expression.css";
import "../workspace/settings/visuals.css";
import "./expressions.css";

/** The window field's presentation while no composition is on the artboard. */
const FIELD_PRESENTATION = "oi-visuals-preview:expressions";
/** The composer's own presentation id: one composition presentation per window. */
const COMPOSITION_PRESENTATION = "expression-application";
const STUDIO_KEY = "oi-cradle.expressions.studio.v1";
const SECTIONS_KEY = "oi-cradle.expressions.studio-sections.v1";
const STUDIO_BOUNDS = {min: 240, max: 560};
const STUDIO_BOTTOM_BOUNDS = {min: 160, max: 520};

type StudioSection = "share" | "entity" | "review" | "pedagogy" | "engine" | "disclosure";
const SECTION_DEFAULTS: Record<StudioSection, boolean> = {share: true, entity: true, review: true, pedagogy: false, engine: false, disclosure: false};

function loadSections(): Record<StudioSection, boolean> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SECTIONS_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return SECTION_DEFAULTS;
    const next = {...SECTION_DEFAULTS};
    for (const key of Object.keys(next) as StudioSection[]) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "boolean") next[key] = value;
    }
    return next;
  } catch { return SECTION_DEFAULTS; }
}

export function ExpressionsSurface({binding}: {binding: SurfaceBinding}) {
  const {snapshot: visualsSnapshot} = useVisuals();
  const stage = useExpressionStage();
  const store = useExpressionSelectionState();
  const uid = useId();

  // Which Expression this surface shows: a pending request from the graph, the
  // binding's own ref, or the Expression the mode was last showing.
  const [targetRef, setTargetRef] = useState<string | undefined>(() =>
    store.request?.expressionRef ?? (binding.ref?.startsWith("expression:") ? binding.ref : undefined) ?? store.selection.expressionRef);
  const app = useExpressionApplication(targetRef);
  const {document, list, error, setError, pending, file, setFile, result, inspect, run, edit, resolveFile, selected, sceneEntities, pendingRefinements} = app;

  // ---- artboard: what it shows, and the one presentation that shows it -----
  const [presenting, setPresenting] = useState(true);
  const [face, setFace] = useState<"front" | "verso">("front");
  const [playing, setPlaying] = useState(false);
  const [forceMotion, setForceMotion] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const stageHost = useRef<HTMLDivElement | null>(null);
  const presentation = useRef<StagePresentation | null>(null);
  const enabled = visualsSnapshot.enabled;
  const fieldConfig = visualsSnapshot.config;
  const showing: "composition" | "field" | null = !enabled ? null : presenting && document ? "composition" : "field";
  // The window field's own authored colour choice: "Follow theme" (the
  // default) takes the host's current ink/paper, same as the composition;
  // an explicit "Ink on paper"/"Paper on ink" choice stands as authored so
  // the engine's own colorMode derivation is what renders it, in every
  // theme. This is what keeps the idle artboard from painting its fixed
  // recipe ground (white) over a dark shell.
  const fieldAppearance: "host" | "authored" = fieldConfig.colorMode === "followTheme" ? "host" : "authored";
  const latest = useRef({document, fieldConfig, playing, forceMotion, fieldAppearance});
  latest.current = {document, fieldConfig, playing, forceMotion, fieldAppearance};
  useEffect(() => { if (showing !== "composition") setFace("front"); }, [showing]);

  // Acquire the window's one stage for whatever the artboard shows, place its
  // existing canvas in the artboard, and hand it back on change or unmount.
  // The presentation starts PAUSED unless the person is already playing.
  useEffect(() => {
    setStageError(null); setReady(false);
    if (!showing) return;
    const host = stageHost.current;
    if (!host) return;
    let acquired: StagePresentation | null = null;
    try {
      const paused = !latest.current.playing;
      if (showing === "composition") {
        const current = latest.current.document;
        if (!current) return;
        acquired = stage.present({id: COMPOSITION_PRESENTATION, plane: "overlay", recipe: "", config: expressionConfig(current), appearance: "host", sceneRef: current.selection.scene_ref, paused, forceMotion: latest.current.forceMotion});
      } else {
        acquired = stage.present({id: FIELD_PRESENTATION, plane: "overlay", recipe: "", config: latest.current.fieldConfig as unknown as Record<string, unknown>, appearance: latest.current.fieldAppearance, sceneRef: FIELD_PRESENTATION, paused, forceMotion: latest.current.forceMotion});
      }
      if (!acquired) {
        // The stage answers null while its engine is still loading or an
        // opening stands (it re-announces itself, and this effect retries), or
        // because another view already presents. Only the last is a refusal.
        const standing = (stage.inspect().presentations as {id: string}[] | undefined) ?? [];
        if (stage.error) setStageError(stage.error);
        else if (standing.length) setStageError(`Another view is presenting on this window's one Expression stage (${standing.map(entry => entry.id).join(", ")}). Close it there, then retry.`);
        return;
      }
      acquired.setContainer(host);
      presentation.current = acquired;
      setReady(true);
    } catch (cause) {
      acquired?.release();
      acquired = null;
      setStageError(cause instanceof Error ? cause.message : String(cause));
    }
    return () => {
      acquired?.release();
      if (presentation.current === acquired) presentation.current = null;
    };
  // Re-acquire when the field's own colour choice moves in or out of
  // "Follow theme" — a different appearance is baked into the presentation
  // at stage.present time and cannot be patched onto a standing one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing, stage, retry, showing === "field" ? fieldAppearance : "n/a"]);

  // Accepted owner writes re-present the same field, with no reseed and no
  // remount. While the clock is held (paused, or reduced motion without the
  // deliberate override) nothing integrates, so a changed target would never
  // be reached: the still is LANDED instead — the engine's own reset places
  // the particles on their current targets and the same config is presented
  // once more to paint that still. Two frames per change, none scheduled.
  useEffect(() => {
    const standing = presentation.current;
    if (!standing || !ready) return;
    try {
      const apply = showing === "composition" && document
        ? () => standing.updateConfig(expressionConfig(document), document.selection.scene_ref, document.selection.entity_ref ? [document.selection.entity_ref] : [])
        : showing === "field" ? () => standing.updateConfig(fieldConfig as unknown as Record<string, unknown>, FIELD_PRESENTATION, []) : null;
      if (!apply) return;
      apply();
      const held = !latest.current.playing || (!latest.current.forceMotion && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (held) { standing.command({type: "reset-field"}); apply(); }
    } catch (cause) { setStageError(cause instanceof Error ? cause.message : String(cause)); }
  }, [document, fieldConfig, showing, ready]);
  useEffect(() => { if (ready) try { presentation.current?.setPaused(!playing); } catch { /* released meanwhile */ } }, [playing, ready]);
  useEffect(() => { if (ready) try { presentation.current?.setForceMotion(forceMotion); } catch { /* released meanwhile */ } }, [forceMotion, ready]);
  const currentPresentation = useCallback(() => presentation.current, []);
  const command = (next: Parameters<StagePresentation["command"]>[0]) => { try { presentation.current?.command(next); } catch (cause) { setNotice(cause instanceof Error ? cause.message : String(cause)); } };
  const capture = () => {
    const standing = presentation.current;
    if (!standing) return;
    try {
      const url = standing.capture().toDataURL("image/png");
      const anchor = window.document.createElement("a");
      anchor.href = url; anchor.download = "expression-capture.png"; anchor.click();
      setNotice(null);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : String(cause)); }
  };

  // ---- selection: publish what is shown, take what is asked ----------------
  useEffect(() => registerExpressionCentre(), []);
  useEffect(() => {
    if (document) publishExpressionSelection({expressionRef: document.expression_ref, sceneRef: document.selection.scene_ref, entityRef: document.selection.entity_ref, revision: document.revision, title: document.title});
  }, [document]);
  const pendingFocus = useRef<{expressionRef: string; sceneRef?: string; entityRef?: string | null} | null>(null);
  const [focusTarget, setFocusTarget] = useState<{target: ExpressionFocusTarget; seq: number} | null>(null);
  const applyPendingFocus = useCallback(() => {
    const wanted = pendingFocus.current, current = latest.current.document;
    if (!wanted || !current || wanted.expressionRef !== current.expression_ref) return;
    pendingFocus.current = null;
    const sceneRef = wanted.sceneRef ?? current.selection.scene_ref;
    if (!current.scenes.some(scene => scene.scene_ref === sceneRef)) return;
    const entityRef = wanted.entityRef === undefined ? (sceneRef === current.selection.scene_ref ? current.selection.entity_ref : null) : wanted.entityRef;
    if (sceneRef === current.selection.scene_ref && (entityRef ?? null) === (current.selection.entity_ref ?? null)) return;
    void edit([{change: "focus", scene_ref: sceneRef, entity_ref: entityRef ?? null}]);
  // `edit` closes over the current document; `latest` carries the same one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);
  useEffect(() => {
    const request = store.request;
    if (!request) return;
    consumeExpressionRequest();
    if (request.sceneRef !== undefined || request.entityRef !== undefined) pendingFocus.current = {expressionRef: request.expressionRef, sceneRef: request.sceneRef, entityRef: request.entityRef};
    if (request.focus) setFocusTarget({target: request.focus, seq: request.seq});
    setPresenting(true);
    if (request.expressionRef !== targetRef) { setFile(undefined); setTargetRef(request.expressionRef); }
    else applyPendingFocus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.request]);
  useEffect(() => { applyPendingFocus(); }, [applyPendingFocus, document?.expression_ref, document?.revision]);

  const openExpression = (ref: string) => {
    setFile(undefined);
    if (ref === targetRef) void inspect(ref).catch(cause => setError(String(cause)));
    else setTargetRef(ref);
    setPresenting(true);
  };

  // ---- Studio: a dock inside this surface ---------------------------------
  const surface = useRef<HTMLElement>(null);
  const edge = useDockEdge(surface, 600);
  const sideDock = useDock(STUDIO_KEY, {open: true, size: 300}, STUDIO_BOUNDS, "right");
  const bottomDock = useDock(`${STUDIO_KEY}:bottom`, {open: true, size: 240}, STUDIO_BOTTOM_BOUNDS, "bottom");
  const dock = edge === "right" ? sideDock : bottomDock;
  const [sections, setSections] = useState(loadSections);
  useEffect(() => { try { window.localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections)); } catch { /* per-viewer convenience only */ } }, [sections]);
  const studioBody = useRef<HTMLDivElement>(null);
  const bring = useCallback((section: StudioSection) => {
    dock.setOpen(true);
    setSections(current => current[section] ? current : {...current, [section]: true});
    requestAnimationFrame(() => {
      const head = studioBody.current?.querySelector<HTMLElement>(`[data-studio-section="${section}"] > h4 > button`);
      scrollWithin(head);
      head?.focus({preventScroll: true});
    });
  }, [dock]);
  useEffect(() => { if (focusTarget) bring(focusTarget.target === "review" ? "review" : focusTarget.target === "entity" ? "entity" : "engine"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [focusTarget?.seq]);
  useEffect(() => { if (sharing) bring("share"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sharing]);

  // ---- menus --------------------------------------------------------------
  const [menu, setMenu] = useState<"composition" | "library" | "setup" | null>(null);
  const closeMenu = () => setMenu(null);
  const [title, setTitle] = useState("Untitled Expression");
  const [filePath, setFilePath] = useState("");
  const [stateName, setStateName] = useState("");
  const artifactInput = useRef<HTMLInputElement>(null);
  const create = () => {
    const ref = `expression:${crypto.randomUUID()}`;
    setFile(undefined); closeMenu(); setPresenting(true);
    void run({operation: "create", expression_ref: ref, title, actor: ACTOR}).then(data => { if (data?.document) setTargetRef(data.document.expression_ref); });
  };
  const openFile = () => {
    closeMenu();
    void resolveFile(filePath).then(location => run({operation: "open_file", location, actor: ACTOR})).then(data => { if (data?.document) { setTargetRef(data.document.expression_ref); setPresenting(true); } }).catch(cause => setError(String(cause)));
  };
  const importArtifact = async (chosen: File | undefined) => {
    if (!chosen) return;
    try {
      const artifact: unknown = JSON.parse(await chosen.text());
      const {artifactToExpression} = await import("../expression/artifactImport");
      const imported = artifactToExpression(`expression:${crypto.randomUUID()}`, artifact, undefined);
      setFile(undefined);
      const data = await run({operation: "open", document: imported.document, actor: ACTOR});
      if (data?.document) { setTargetRef(data.document.expression_ref); setPresenting(true); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const applyToField = (patch: PointCloudPatch) => { visuals.patchConfig(patch); setPresenting(false); };

  const sceneTitle = document?.scenes.find(scene => scene.scene_ref === document.selection.scene_ref)?.title;
  const artboardState = !enabled ? "off" : stageError ? "refused" : !ready ? "opening" : showing;
  const studioId = `${uid}studio`;
  const section = (id: StudioSection, heading: string, state: string | null, body: React.ReactNode) =>
    <section className="xp-studio-section" data-studio-section={id} data-open={sections[id]}>
      <h4><button type="button" aria-expanded={sections[id]} onClick={() => setSections(current => ({...current, [id]: !current[id]}))}><span>{heading}</span>{state && <span className="oi-state" data-attention={id === "review" && pendingRefinements.length > 0 ? "true" : undefined}>{state}</span>}</button></h4>
      {sections[id] && <div className="xp-studio-section-body">{body}</div>}
    </section>;

  return <section ref={surface} className="xp-surface" aria-label="Expressions" data-surface-id={binding.id} data-expression-ref={document?.expression_ref} data-artboard={artboardState} data-face={face} data-playing={playing} data-dock-edge={edge} data-studio={dock.state.open ? "open" : "closed"}>
    <header className="xp-menubar" aria-label="Expressions menubar">
      <div className="xp-menus" role="group" aria-label="Expressions menus">
        <FieldMenu id={`${uid}m-composition`} label="Composition" open={menu === "composition"} onOpenChange={open => setMenu(open ? "composition" : null)} width={300}>
          <span className="oi-eyebrow">New</span>
          <div className="xp-menu-form">
            <input className="oi-input" aria-label="Expression title" value={title} onChange={event => setTitle(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); create(); } }}/>
            <button type="button" role="menuitem" className="oi-action" disabled={pending || !title.trim()} onClick={create}>New Expression</button>
          </div>
          <hr/>
          <span className="oi-eyebrow">Open</span>
          {list.length === 0 && <p className="oi-note xp-menu-note">No Expressions yet.</p>}
          {list.map(entry => <FieldMenuCheck key={entry.expression_ref} radio icon={ICON.expression} label={entry.title} hint={`r${entry.revision}${entry.dirty ? " · unsaved" : ""}`} checked={entry.expression_ref === document?.expression_ref} onSelect={() => { closeMenu(); openExpression(entry.expression_ref); }}/>)}
          <hr/>
          <span className="oi-eyebrow">Expression file</span>
          <div className="xp-menu-form">
            <input className="oi-input" aria-label="Expression file path" placeholder="Path relative to Central" value={filePath} onChange={event => setFilePath(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && filePath.trim()) { event.preventDefault(); openFile(); } }}/>
            <button type="button" role="menuitem" className="oi-action" disabled={pending || !filePath.trim()} onClick={openFile}>Open file</button>
          </div>
          <FieldMenuItem label="Import generated artifact…" icon={ICON.import} hint=".json" onSelect={() => { closeMenu(); artifactInput.current?.click(); }} title="An oi.journey document or an exported native state, through the engine's own import path"/>
          <hr/>
          <FieldMenuItem label="Export local copy" icon={ICON.export} hint="expression.json" disabled={!document || pending} onSelect={() => { closeMenu(); void exportExpressionCopy(app); }}/>
          <FieldMenuItem label="Save Expression file" icon={ICON.save} hint={file ? file.location.path : "not yet a file"} disabled={!document || !file || pending} onSelect={() => { closeMenu(); if (document && file) void run({operation: "save", expression_ref: document.expression_ref, expected_revision: document.revision, location: file.location, expected_file_revision: file.revision, actor: ACTOR, actor_kind: "human"}); }}/>
        </FieldMenu>
        <FieldMenu id={`${uid}m-library`} label="Library" open={menu === "library"} onOpenChange={open => setMenu(open ? "library" : null)} width={300}>
          <span className="oi-eyebrow">Formations</span>
          {PRESETS.map(preset => <FieldMenuItem key={preset.id} icon={ICON.formation} label={preset.name} title={preset.description} onSelect={() => { closeMenu(); applyToField(preset.config as PointCloudPatch); }}/>)}
          <hr/>
          <span className="oi-eyebrow">Saved states</span>
          {visualsSnapshot.savedStates.length === 0 && <p className="oi-note xp-menu-note">No saved states yet.</p>}
          {visualsSnapshot.savedStates.map(saved => <FieldMenuItem key={saved.id} icon={ICON.saved} label={saved.name} onSelect={() => { closeMenu(); visuals.loadState(saved.id); setPresenting(false); }}/>)}
          <div className="xp-menu-form">
            <input className="oi-input" aria-label="Saved state name" placeholder="Name this field state" value={stateName} onChange={event => setStateName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); visuals.saveState(stateName); setStateName(""); } }}/>
            <button type="button" role="menuitem" className="oi-action" onClick={() => { visuals.saveState(stateName); setStateName(""); }}>Save current</button>
          </div>
          <hr/>
          <FieldMenuItem label="Copy field config JSON" icon={ICON.copy} onSelect={() => { closeMenu(); void navigator.clipboard?.writeText(JSON.stringify(visuals.get().config, null, 2)); }}/>
          <p className="oi-note xp-menu-note">Formations and saved states shape the window field; the artboard switches to it.</p>
        </FieldMenu>
        <FieldMenu id={`${uid}m-setup`} label="Setup" open={menu === "setup"} onOpenChange={open => setMenu(open ? "setup" : null)} width={300}>
          <FieldMenuCheck icon={ICON.expression} label="Expression" hint={enabled ? "On" : "Off"} checked={enabled} onSelect={() => visuals.setEnabled(!enabled)}/>
          <FieldMenuCheck icon={ICON.studio} label="Studio" hint={dock.state.open ? "Docked" : "Closed"} checked={dock.state.open} onSelect={dock.toggle}/>
          <hr/>
          <span className="oi-eyebrow">Window field</span>
          <FieldMenuCheck icon={ICON.window} label="Relational system" hint={fieldConfig.relational.mode} checked={fieldConfig.relational.enabled} onSelect={() => visuals.patchConfig({relational: {enabled: !fieldConfig.relational.enabled}})}/>
          <FieldMenuCheck icon={ICON.refresh} label="Auto-morph" hint={`${fieldConfig.autoMorphDuration}s`} checked={fieldConfig.autoMorph} onSelect={() => visuals.patchConfig({autoMorph: !fieldConfig.autoMorph})}/>
          {([["stipple", "Stipple"], ["halftone", "Halftone"]] as const).map(([value, label]) => <FieldMenuCheck key={value} radio icon={ICON.formation} label={label} hint="Render" checked={fieldConfig.style === value} onSelect={() => visuals.patchConfig({style: value as PointCloudConfig["style"]})}/>)}
          {([["circle", "Circle"], ["square", "Square"]] as const).map(([value, label]) => <FieldMenuCheck key={value} radio icon={value === "circle" ? ICON.dot : ICON.square} label={label} hint="Dot" checked={fieldConfig.dotShape === value} onSelect={() => visuals.patchConfig({dotShape: value as PointCloudConfig["dotShape"]})}/>)}
          {([["followTheme", "Follow theme"], ["blackOnWhite", "Ink on paper"], ["whiteOnBlack", "Paper on ink"]] as const).map(([value, label]) => <FieldMenuCheck key={value} radio icon={ICON.colour} label={label} hint="Colour" checked={fieldConfig.colorMode === value} onSelect={() => visuals.patchConfig({colorMode: value as PointCloudConfig["colorMode"]})}/>)}
          <hr/>
          <span className="oi-eyebrow">Field actions</span>
          <FieldMenuItem icon={ICON.disperse} label="Disperse" hint={playing ? "impulse" : "while playing"} disabled={!ready || !playing} onSelect={() => command({type: "disperse", strength: 3.5})}/>
          <FieldMenuItem icon={ICON.reset} label="Reset field" hint="to targets" disabled={!ready} onSelect={() => command({type: "reset-field"})}/>
          <FieldMenuItem icon={ICON.restore} label="Restore field defaults" onSelect={() => { closeMenu(); visuals.resetConfig(); }}/>
          <FieldMenuCheck icon={ICON.play} label="Animate with reduced motion on" hint="override" checked={forceMotion} onSelect={() => setForceMotion(value => !value)}/>
        </FieldMenu>
      </div>
      <div className="xp-toolbelt" role="toolbar" aria-label="Field tools">
        <button type="button" className="oi-tool oi-tool-bordered" aria-label={presenting ? "Close presentation" : "Present on stage"} title={document ? (presenting ? "Close presentation — return the artboard to the window field" : "Present this composition on the artboard") : "Open an Expression to present it"} aria-pressed={showing === "composition"} disabled={!document || !enabled} onClick={() => setPresenting(value => !value)}><Glyph name={ICON.present}/></button>
        <button type="button" className="oi-tool oi-tool-bordered expression-flip" aria-label={face === "verso" ? "Return to front" : "Flip to verso"} title={face === "verso" ? "Return to front" : "Flip to verso — the generated reading of the same Expression"} aria-pressed={face === "verso"} disabled={showing !== "composition"} onClick={() => setFace(current => current === "front" ? "verso" : "front")}><Glyph name={ICON.flip}/></button>
        <button type="button" className="oi-tool oi-tool-bordered expression-share" aria-label={sharing ? "Close share" : "Share / Project"} title="Project this Expression for an audience: exact outward preview, omissions, audience, Projection, Open in Explore" aria-pressed={sharing} disabled={!document} onClick={() => setSharing(value => !value)}><Glyph name={ICON.share}/></button>
        <button type="button" className="oi-tool oi-tool-bordered" aria-label="Capture image" title="Capture the artboard as a PNG through the engine's own clean-frame capture" disabled={!ready} onClick={capture}><Glyph name={ICON.capture}/></button>
        <span className="xp-toolbelt-rule" aria-hidden="true"/>
        <button type="button" className="oi-tool oi-tool-bordered" aria-label={playing ? "Pause simulation" : "Play simulation"} title={playing ? "Pause — hold the field as a still" : "Play — run the field's simulation clock"} aria-pressed={playing} disabled={!ready} onClick={() => setPlaying(value => !value)}><Glyph name={playing ? ICON.pause : ICON.play}/></button>
        <button type="button" className="oi-tool oi-tool-bordered" aria-label="Studio" title={dock.state.open ? "Close the Studio dock" : "Open the Studio dock"} aria-pressed={dock.state.open} aria-controls={studioId} onClick={dock.toggle}><Glyph name={ICON.studio}/></button>
      </div>
    </header>
    <input ref={artifactInput} type="file" accept="application/json,.json" hidden aria-hidden="true" tabIndex={-1} onChange={event => { const chosen = event.target.files?.[0]; event.target.value = ""; void importArtifact(chosen); }}/>
    {error && <p role="alert" className="oi-refusal xp-refusal">{error}<button type="button" className="oi-tool" aria-label="Dismiss" onClick={() => setError("")}><Glyph name={ICON.close} size={12}/></button></p>}
    {notice && <p role="status" className="oi-refusal xp-refusal">{notice}<button type="button" className="oi-tool" aria-label="Dismiss" onClick={() => setNotice(null)}><Glyph name={ICON.close} size={12}/></button></p>}
    <div className="xp-body">
      <div className="xp-field">
        <div className="xp-artboard-wrap">
          {/* The window's production canvas is placed here while acquired.
              React keeps this element childless: the stage owns its content. */}
          <div ref={stageHost} className="xp-artboard" aria-label="Expression artboard" hidden={face === "verso" || !enabled}/>
          {!enabled && <div className="xp-artboard-state oi-empty" role="status">
            <strong>Expression is off</strong>
            <span>Off is absolute: no renderer, no simulation, no resources held. Turn it on to see and shape the field.</span>
            <button type="button" className="oi-action oi-action-primary" onClick={() => visuals.setEnabled(true)}>Turn Expression on</button>
          </div>}
          {enabled && stageError && <div className="xp-artboard-state" role="alert">
            <p className="oi-refusal">The artboard is unavailable: {stageError}</p>
            <button type="button" className="oi-action" onClick={() => setRetry(value => value + 1)}>Retry</button>
          </div>}
          {showing === "composition" && face === "verso" && document && <div className="xp-verso oi-scroll"><ExpressionVerso document={document}
            onInvokeAction={(entityRef, actionRef) => void run({operation: "invoke", expression_ref: document.expression_ref, expected_revision: document.revision, entity_ref: entityRef, action_ref: actionRef, input: null, project: null})}
            onOpenRef={entityRef => { void edit([{change: "focus", scene_ref: document.selection.scene_ref, entity_ref: entityRef}]); setFace("front"); }}/></div>}
          {enabled && !stageError && <span className="xp-artboard-label oi-state" aria-live="off">{showing === "composition" ? `Composition${sceneTitle ? ` · ${sceneTitle}` : ""}` : "Window field"} · {playing ? "playing" : "still"}</span>}
        </div>
        <div className="xp-transport oi-scroll">
          <div className="xp-identity">
            {document
              ? <><strong>{document.title}</strong><small><span className="oi-ref">{document.expression_ref}</span> · revision {document.revision}{file ? <> · <span className="oi-ref">{file.location.path ?? JSON.stringify(file.location)}</span></> : " · not yet a file"}</small></>
              : <><strong>No Expression open</strong><small>The artboard shows the window field. Open or begin an Expression from the Composition menu.</small></>}
          </div>
          {document && <>
            <nav className="expression-scenes oi-plane-nav xp-scenes oi-scroll-quiet" aria-label="Expression scenes">
              {document.scenes.map(scene => <button key={scene.scene_ref} aria-pressed={scene.scene_ref === document.selection.scene_ref} onClick={() => void edit([{change: "focus", scene_ref: scene.scene_ref, entity_ref: null}])}>{scene.title}</button>)}
              <button className="oi-tool expression-add" aria-label="Add scene" title="Add scene" disabled={pending} onClick={() => void edit([{change: "scene_create", scene_ref: `${document.expression_ref}:scene:${crypto.randomUUID()}`, title: `Scene ${document.scenes.length + 1}`}])}><Glyph name={ICON.add} size={13}/></button>
            </nav>
            <div className="expression-entities xp-entities" role="group" aria-label="Expression entities">
              {sceneEntities.map(ref => { const entity = document.entities[ref]; return <button key={ref} className="expression-entity" aria-pressed={selected?.entity_ref === ref} onClick={() => { void edit([{change: "focus", scene_ref: document.selection.scene_ref, entity_ref: ref}]); }} onDoubleClick={() => bring("entity")}>{entity.title}{entity.subject ? <span className="oi-state">{entity.subject.presentation_role} · {entity.subject.native_owner}</span> : null}</button>; })}
              <button className="oi-action expression-add" disabled={pending} onClick={() => void edit([{change: "entity_add", scene_ref: document.selection.scene_ref, entity_ref: `${document.expression_ref}:entity:${crypto.randomUUID()}`, title: `Thing ${Object.keys(document.entities).length + 1}`}])}>Add Thing</button>
              {sceneEntities.length === 0 && <span className="oi-note">This scene holds nothing yet.</span>}
            </div>
          </>}
        </div>
      </div>
      {dock.state.open && <>
        <aside id={studioId} className="xp-studio" aria-label="Studio" style={edge === "right" ? {inlineSize: dock.state.size} : {blockSize: dock.state.size}}>
          <div className="oi-resize-handle xp-studio-handle" aria-label="Resize Studio" {...dock.handle}/>
          <div className="oi-panel-head xp-studio-head"><span className="oi-eyebrow">Studio</span><button type="button" className="oi-tool" aria-label="Close Studio" onClick={() => dock.setOpen(false)}><Glyph name={ICON.close} size={13}/></button></div>
          <div ref={studioBody} className="xp-studio-body oi-scroll">
            {sharing && document && section("share", "Share / Project", null, <ShareProjection key={`${document.expression_ref}@${document.revision}`} document={document} onClose={() => setSharing(false)}/>)}
            {section("entity", "Entity", selected ? selected.title : "none selected", document
              ? selected ? <ExpressionEntityInspector app={app}/> : <p className="oi-empty">Select an entity in the row under the artboard to read and edit its parameters and subject binding.</p>
              : <p className="oi-empty">Open an Expression to compose scenes, Things and Beings.</p>)}
            {section("review", "Review", document ? (pendingRefinements.length ? `${pendingRefinements.length} awaiting` : "nothing awaiting") : null, document
              ? <>{pendingRefinements.length === 0 && <p className="oi-empty">No refinement proposals await human review.</p>}<ExpressionRefinementReview app={app}/><ExpressionReviewedDecisions app={app}/></>
              : <p className="oi-empty">Open an Expression to review proposals.</p>)}
            {section("pedagogy", "Pedagogy", null, document ? <ExpressionPedagogy app={app}/> : <p className="oi-empty">Open an Expression to propose structured pedagogy.</p>)}
            {section("engine", "Field engine", showing === "field" ? "on the artboard" : "window field", enabled
              ? <div className="visuals-expression xp-engine">
                  {showing !== "field" && <p className="oi-note">These controls shape the window field. <button type="button" className="oi-action" onClick={() => setPresenting(false)}>Show the field on the artboard</button></p>}
                  <ExpressionControls editableValues host={{presentation: currentPresentation, ready, paused: !playing, onPausedChange: paused => setPlaying(!paused)}}/>
                </div>
              : <p className="oi-empty">Expression is off. Turn it on to shape the field.</p>)}
            {section("disclosure", "Disclosure", null, document
              ? <pre className="xp-disclosure">{JSON.stringify({expression: document, last_result: result}, null, 2)}</pre>
              : <p className="oi-empty">No Expression open.</p>)}
          </div>
        </aside>
      </>}
    </div>
  </section>;
}
