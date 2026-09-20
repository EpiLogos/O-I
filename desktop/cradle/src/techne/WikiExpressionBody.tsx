/**
 * Instrument 0's body (owner direction 2026-09-19): the register's wiki
 * local whole opened as a REAL Expression — `wikiExpression.ts` projects
 * the live wiki.json reading and the kernel's typed relations read into an
 * `oi.expression/v1` document, opened through the kernel's own expression
 * op, and presented on the window's one Expression stage through the same
 * presentation path the Expressions workspace uses (`expressionConfig` +
 * the "expression-application" presentation id, so the two can never stand
 * at once). Not a bespoke canvas, not a second graph store, and not the
 * wiki list this replaces: the overview scene carries the register's
 * disclosed constellations as addressable objects; entering one opens its
 * scene with the actual wiki nodes and actual typed relations.
 *
 * ONE STATE (QL-MEF #213 / O-I #366 EX3A): the projection's reading,
 * standing document and selection live in `wikiProjectionStore.ts` — the
 * one relation/selection state. This body is the only kernel actor (open,
 * focus, drift handling) and writes every result back to the store; the
 * Technè left body's LIST/TREE/GRAPH apertures and the Expressions graph
 * navigator render the SAME state and ask for selection through it, and
 * this body's selection is theirs (the bidirectional law): a sidebar click
 * consumes as a kernel focus edit here, and a focus here highlights the
 * same canonical ref in every aperture (`selection.ts` publishes it to the
 * Expressions navigator).
 *
 * Node interaction operates on the canonical wiki subject ref throughout:
 * selection is a kernel focus edit on the real document (so agents and the
 * Expressions workspace see the same Expression); the page opens through
 * the frame's ordinary open path (`oi:epi-open-knowledge`); the source
 * file resolves through the files seam before it is opened. Returning
 * restores the same position — scene and focus live in the kernel
 * document, the register choice persists, and re-entry re-presents from
 * that state.
 *
 * Honest states, never fabricated content: no kernel transport, no wiki,
 * relations unavailable, stage disabled, generation drift (the standing
 * projection predates the current reading), a selection request aimed at a
 * generation that no longer stands, and the not-admitted audience-filtered
 * SharedField staging — each is named exactly.
 *
 * The ENTRY SPACE is the Epii face (owner direction 2026-09-19): instrument
 * 0 opens onto the twelve-masks expression — "Twelve faces · one mask"
 * (`source-twelve-faces`) in the Expressions application's Source studies —
 * the guardian of the O:I web/wiki/graph spaces, served through the same
 * material seam as the Expressions centre. The wiki/graph projection this
 * file carries stands behind it and is entered from it; the face is the
 * default and the projection is one deliberate step in.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {SurfaceBinding} from "../surface/types";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {listFiles} from "../files/client";
import {
  EXPRESSIONS_APP_DIST,
  EXPRESSIONS_APP_ENTRY,
  materialUrl,
  relayKernelChannel,
  trackShellCutout,
} from "../expressions/hostedApp";
import {useVisuals} from "../visuals/ParticleExpression";
import {visuals} from "../visuals/store";
import {useExpressionStage, type StagePresentation} from "../stage/ExpressionStage";
import {expressionConfig} from "../expression/engineProjection";
import type {ExpressionDocument, ExpressionResult} from "../expression/types";
import {requestExpressionOpen, consumeExpressionRequest, publishExpressionSelection, useExpressionSelectionState} from "../expressions/selection";
import {Glyph} from "../workspace/Glyph";
import {ICON} from "../expressions/icons";
import {scrollWithin} from "../shared/scrollWithin";
import {
  wikiRegistersFrom,
  type WikiProjection,
  type WikiRegister,
} from "./wikiExpression";
import {
  consumeWikiSelectionRequest,
  ensureWikiProjection,
  getWikiProjectionState,
  setWikiProjectionRegister,
  setWikiProjectionRegisters,
  useWikiProjectionState,
  wikiRegisterOwning,
  wikiProjectionDocumentFocused,
  wikiProjectionDocumentReady,
  wikiProjectionDrift,
  wikiProjectionKernelUnavailable,
  wikiProjectionOpening,
  type RegisterStanding,
} from "./wikiProjectionStore";
import "./techne.css";

const ACTOR = "human:techne-instrument-0";
/** The window's one composition presentation — the same id the Expressions
 * surface and the composer present under, so the two can never stand at once. */
const PRESENTATION_ID = "expression-application";
const short = (revision: string) => revision.length > 18 ? `${revision.slice(0, 16)}…` : revision;
const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

export function WikiExpressionBody({binding, subject}: {binding: SurfaceBinding; subject?: {ref?: string; kind?: string; title: string; project?: string}}) {
  const kernel = useKernel();
  const stage = useExpressionStage();
  const {snapshot: visualsSnapshot} = useVisuals();
  const store = useWikiProjectionState();

  // The registers follow the kernel navigator's disclosed projects — one
  // publication, every aperture reads the same list.
  useEffect(() => {
    setWikiProjectionRegisters(wikiRegistersFrom((kernel.snapshot.navigator?.root?.work.projects ?? []).map(row => ({name: row.name, path: row.path}))));
  }, [kernel.snapshot.navigator?.root?.work.projects]);

  // Seed the register once (remembered → the workspace's binding project →
  // Central); afterwards the store remembers across modes and apertures.
  useEffect(() => {
    if (store.registerKey !== null || store.registers.length === 0) return;
    const seed = binding.project && store.registers.some(register => register.key === binding.project)
      ? binding.project
      : store.registers.find(register => register.key === "central")?.key ?? store.registers[0].key;
    setWikiProjectionRegister(seed);
  }, [store.registerKey, store.registers, binding.project]);

  const registerKey = store.registerKey;
  const register: WikiRegister | undefined = store.registers.find(row => row.key === registerKey) ?? store.registers[0];
  const standing: RegisterStanding = (registerKey ? store.standings[registerKey] : undefined) ?? {phase: "idle"};
  const document = standing.phase === "ready" || standing.phase === "drift" ? standing.document : undefined;
  const projection: WikiProjection | undefined = "projection" in standing ? standing.projection : undefined;

  // The entry face: instrument 0 opens ONTO the Epii expression; the whole
  // (the projection below) is entered from it — and returns.
  const [faceOpen, setFaceOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const flowRef = useRef<string | null>(null);

  // ---- ensure the reading; open the generation through the kernel --------
  useEffect(() => {
    if (!register) return;
    ensureWikiProjection(register, kernel.transport);
  }, [register, kernel.transport]);

  const focus = useCallback(async (expressionRef: string, expectedRevision: number, sceneRef: string, entityRef: string | null, attempt = 0) => {
    const reply = await kernelOp(kernel.transport, {op: "expression", request: {
      operation: "edit", expression_ref: expressionRef, expected_revision: expectedRevision, actor: ACTOR,
      changes: [{change: "focus", scene_ref: sceneRef, entity_ref: entityRef}],
    }});
    const data = reply.outcome?.result === "expression" ? reply.outcome.data as ExpressionResult : undefined;
    if (!reply.error && data?.document) {
      setError(null);
      const key = wikiRegisterOwning(expressionRef) ?? getWikiProjectionState().registerKey;
      if (key) wikiProjectionDocumentFocused(key, data.document);
      return;
    }
    // A stale expected revision — a rapid aperture ask during a prior
    // focus flight, or a concurrent editor: read the standing generation
    // back and re-apply the focus once. The kernel never replaces an open
    // draft implicitly and neither do we.
    if (attempt === 0 && data?.state === "revision_conflict") {
      const inspect = await kernelOp(kernel.transport, {op: "expression", request: {operation: "inspect", expression_ref: expressionRef}});
      const standingDocument = inspect.outcome?.result === "expression" ? (inspect.outcome.data as ExpressionResult).document : undefined;
      if (standingDocument) {
        const key = wikiRegisterOwning(expressionRef) ?? getWikiProjectionState().registerKey;
        if (key) wikiProjectionDocumentFocused(key, standingDocument);
        void focus(expressionRef, standingDocument.revision, sceneRef, entityRef, 1);
        return;
      }
    }
    setError(reply.error ?? "the kernel did not return the focused document");
  }, [kernel.transport]);

  useEffect(() => {
    if (!register) return;
    if (standing.phase !== "projected" && !(standing.phase === "opening" && flowRef.current !== register.key)) return;
    const target = register;
    const projection = "projection" in standing ? standing.projection : undefined;
    if (!projection) return;
    flowRef.current = target.key;
    wikiProjectionOpening(target.key);
    void (async () => {
      try {
        // A projection whose generation is already open in the kernel STANDS:
        // the kernel never replaces an open draft implicitly, and the
        // standing document — with the person's scene and focus edits — IS
        // the position this instrument restores to. Only an absent
        // generation opens. (The projection identity is content-addressed
        // over the reading, so a changed wiki basis opens as a new
        // generation rather than silently replacing this one.)
        const standingReply = await kernelOp(kernel.transport, {op: "expression", request: {operation: "inspect", expression_ref: projection.document.expression_ref}});
        const standingDocument = standingReply.outcome?.result === "expression" ? (standingReply.outcome.data as ExpressionResult).document : undefined;
        if (standingDocument) { wikiProjectionDocumentReady(target.key, standingDocument); return; }
        const reply = await kernelOp(kernel.transport, {op: "expression", request: {operation: "open", document: projection.document, actor: ACTOR}});
        const data = reply.outcome?.result === "expression" ? reply.outcome.data as ExpressionResult : undefined;
        if (reply.error || !data) { wikiProjectionKernelUnavailable(target.key, reply.error ?? "the kernel refused to open the projection"); return; }
        if (data.state === "revision_conflict") {
          // Unreachable in the ordinary flow (inspect-first above stands the
          // open generation); a race or identity collision lands here. The
          // kernel never replaces an open draft implicitly — read it back
          // and disclose the difference rather than forcing it.
          const conflictReply = await kernelOp(kernel.transport, {op: "expression", request: {operation: "inspect", expression_ref: projection.document.expression_ref}});
          const conflictDocument = conflictReply.outcome?.result === "expression" ? (conflictReply.outcome.data as ExpressionResult).document : undefined;
          if (conflictDocument) { wikiProjectionDrift(target.key, conflictDocument, "an open draft already carries this generation's identity with different content"); return; }
          wikiProjectionKernelUnavailable(target.key, "the open projection could not be read back");
          return;
        }
        if (!data.document) { wikiProjectionKernelUnavailable(target.key, "the kernel opened the projection without returning its document"); return; }
        wikiProjectionDocumentReady(target.key, data.document);
      } catch (cause) {
        wikiProjectionKernelUnavailable(target.key, text(cause));
      } finally {
        if (flowRef.current === target.key) flowRef.current = null;
      }
    })();
  }, [register, registerKey, standing.phase, kernel.transport]);

  // ---- aperture requests: a sidebar click IS a focus here ----------------
  const consumeRequestsRef = useRef({document, focus});
  consumeRequestsRef.current = {document, focus};
  useEffect(() => {
    const request = store.request;
    if (!request || !registerKey || request.registerKey !== registerKey) return;
    if (standing.phase !== "ready" && standing.phase !== "drift") return;
    const current = consumeRequestsRef.current.document;
    if (!current) return;
    const scene = current.scenes.find(entry => entry.scene_ref === request.sceneRef);
    const entityResolves = request.entityRef === null || !!current.entities[request.entityRef];
    consumeWikiSelectionRequest();
    if (!scene || !entityResolves) {
      setError(`That position belongs to a previous generation of the projection — the wiki's basis changed since it was asked for${request.title ? ` (${request.title})` : ""}. Re-enter the constellation and select again.`);
      return;
    }
    setFaceOpen(false);
    void consumeRequestsRef.current.focus(current.expression_ref, current.revision, request.sceneRef, request.entityRef);
  }, [store.request, registerKey, standing.phase]);

  // ---- the Expressions navigator's asks on THIS standing document --------
  // The ask names an expression ref; the projection owning that ref may not
  // be the active register (any aperture may ask from anywhere). The ask
  // resolves its own register, brings the projection forward, and focuses.
  const selectionState = useExpressionSelectionState();
  useEffect(() => {
    const request = selectionState.request;
    if (!request) return;
    const snapshot = getWikiProjectionState();
    const owningKey = wikiRegisterOwning(request.expressionRef);
    if (!owningKey) return;
    const standing = snapshot.standings[owningKey];
    const document = standing && (standing.phase === "ready" || standing.phase === "drift") ? standing.document : undefined;
    if (!document) return;
    const wanted = consumeExpressionRequest();
    if (!wanted) return;
    const sceneRef = wanted.sceneRef && document.scenes.some(entry => entry.scene_ref === wanted.sceneRef) ? wanted.sceneRef : document.selection.scene_ref;
    const entityRef = wanted.entityRef && document.entities[wanted.entityRef] ? wanted.entityRef : wanted.sceneRef ? null : document.selection.entity_ref;
    if (snapshot.registerKey !== owningKey) setWikiProjectionRegister(owningKey);
    setFaceOpen(false);
    void focus(document.expression_ref, document.revision, sceneRef, entityRef);
  }, [selectionState.request, focus]);

  // ---- what the centre shows is what every aperture shows ----------------
  useEffect(() => {
    if (faceOpen || !document) return;
    publishExpressionSelection({
      expressionRef: document.expression_ref,
      sceneRef: document.selection.scene_ref,
      entityRef: document.selection.entity_ref,
      revision: document.revision,
      title: document.title,
    });
  }, [document, faceOpen]);

  // ---- the stage presentation: the Expressions workspace's own path ------
  const stageHost = useRef<HTMLDivElement | null>(null);
  const presentation = useRef<StagePresentation | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const showing = visualsSnapshot.enabled && !!document;
  const latest = useRef({document});
  latest.current = {document};

  useEffect(() => {
    setStageError(null); setReady(false);
    if (!showing) return;
    const host = stageHost.current;
    const current = latest.current.document;
    if (!host || !current) return;
    let acquired: StagePresentation | null = null;
    try {
      acquired = stage.present({id: PRESENTATION_ID, plane: "overlay", recipe: "", config: expressionConfig(current), appearance: "host", sceneRef: current.selection.scene_ref, paused: true});
      if (!acquired) {
        const standingPresentations = (stage.inspect().presentations as {id: string}[] | undefined) ?? [];
        if (stage.error) setStageError(stage.error);
        else if (standingPresentations.length) setStageError(`Another view is presenting on this window's one Expression stage (${standingPresentations.map(entry => entry.id).join(", ")}). Close it there, then retry.`);
        return;
      }
      acquired.setContainer(host);
      presentation.current = acquired;
      setReady(true);
    } catch (cause) {
      acquired?.release();
      setStageError(cause instanceof Error ? cause.message : String(cause));
    }
    return () => {
      acquired?.release();
      if (presentation.current === acquired) presentation.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing, stage, retry, document?.expression_ref, faceOpen]);

  // Re-present the same field on every document change; while the clock is
  // held the still is LANDED (the Expressions surface's own two-frames law).
  useEffect(() => {
    const standingPresentation = presentation.current;
    if (!standingPresentation || !ready || !document) return;
    try {
      const apply = () => standingPresentation.updateConfig(expressionConfig(document), document.selection.scene_ref, document.selection.entity_ref ? [document.selection.entity_ref] : []);
      apply();
      standingPresentation.command({type: "reset-field"});
      apply();
    } catch (cause) { setStageError(cause instanceof Error ? cause.message : String(cause)); }
  }, [document, ready]);

  if (!register) return null;
  // The owner-named open path for a wiki page: the frame's knowledge open
  // (`oi:epi-open-knowledge` → CradleFrame's openKnowledge). The page's
  // surface opens as a REAL pane placement into this mode's own tree — the
  // workbench's own grammar carries it (beside/full/detach/re-dock are the
  // pane's own controls), and the frame leaves a reading trail so the return
  // chip brings the person back to this instrument. The kernel approves the
  // prerequisites: its expression-world seam IS the portal runtime
  // (portal_open/portal_close/portal_redock over the existing Surface host,
  // disclosed by oi.expression-world-capabilities/v1).
  const openKnowledge = (ref: string, title: string) =>
    window.dispatchEvent(new CustomEvent("oi:epi-open-knowledge", {detail: {ref, title, project: register.project}}));
  // A node's source file opens through the frame's full cross-arrangement
  // cycle for sources (`oi:epi-open-source`): it leaves a reading trail,
  // enters Base and opens the file — with the return chip bringing the
  // person back to this instrument. The source resolves through the files
  // seam first; an unresolvable ref is a named refusal, never a guess.
  const openSource = async (sourceRef: string) => {
    try {
      // The wiki carries its source refs in the owner's own forms: a
      // Central-relative path ("Control/user/identity.md") or a full
      // central source ref ("central:source:control:root:Control/…"). Both
      // reduce to the path the files seam resolves; anything else is a
      // named refusal, never a guess.
      let clean = sourceRef.replace(/^\/+/, "");
      if (clean.startsWith("central:source:")) {
        const rest = clean.slice("central:source:".length);
        const slash = rest.indexOf("/");
        const colon = slash < 0 ? -1 : rest.lastIndexOf(":", slash);
        clean = colon >= 0 ? rest.slice(colon + 1) : rest;
      }
      const slash = clean.lastIndexOf("/"), parent = slash < 0 ? "." : clean.slice(0, slash), name = clean.slice(slash + 1);
      const directory = await listFiles(kernel.transport, parent);
      const entry = directory.entries.find(candidate => candidate.name === name && candidate.kind === "file");
      if (!entry) { setError(`Central lists no "${name}" in ${parent === "." ? "its root" : parent} — this wiki source ref is not a Central file path`); return; }
      window.dispatchEvent(new CustomEvent("oi:epi-open-source", {detail: {location: entry.location}}));
    } catch (cause) { setError(text(cause)); }
  };

  const notices = projection?.notices ?? [];
  const basis = projection?.document.provenance[0];
  // The truthful data-state: the kernel flow's preparing phases are still
  // "reading" to every reader; the named states are the named states.
  const stateName = standing.phase === "ready" || standing.phase === "drift"
    ? standing.phase
    : standing.phase === "unavailable" || standing.phase === "absent" ? standing.phase : "reading";

  // The face renders INSIDE the root container: the projection's truthful
  // data-state standing stays on the container for every reader (probes,
  // agents); data-entry names which presentation stands.
  return <div className="wiki-expression" data-register={register.key} data-state={stateName} data-expression-ref={document?.expression_ref}
      data-entry={faceOpen ? "epii-face" : "whole"}
      aria-label="Instrument 0 — the wiki local whole as an Expression">
    {faceOpen ? <EpiiFace registerTitle={register.title} onEnterWhole={() => setFaceOpen(false)}/> : <>
    <header className="wx-head">
      <div className="wx-head-title">
        <label className="oi-field wx-register">
          <span className="oi-eyebrow">Instrument 0 · Project / Wiki / Graph</span>
          <select className="oi-input" aria-label="Register (whose local whole is projected)" value={register.key} onChange={event => setWikiProjectionRegister(event.target.value)}>
            {store.registers.map(row => <option key={row.key} value={row.key}>{row.title}</option>)}
          </select>
        </label>
        <span className="oi-state wx-basis" data-phase={stateName} title={basis ? `Wiki basis ${basis.ref} at ${basis.revision}` : undefined}>
          {(stateName === "reading") && (standing.phase === "opening" ? "opening the projection in the kernel…" : "reading the register's wiki…")}
          {stateName === "unavailable" && `wiki reading unavailable: ${(standing as Extract<RegisterStanding, {phase: "unavailable"}>).reason}`}
          {stateName === "absent" && "this register discloses no wiki yet — an overview with no constellations, never fabricated objects"}
          {stateName === "drift" && `projection drift — ${(standing as Extract<RegisterStanding, {phase: "drift"}>).reason}; the standing generation shows`}
          {stateName === "ready" && `wiki basis ${short(basis?.revision ?? "")} · ${projection?.boundRelationCount ?? 0} typed relations bound`}
          {stateName === "ready" && (projection?.adriftRelationCount ?? 0) > 0 && ` · ${projection?.adriftRelationCount} outside this whole`}
        </span>
      </div>
      <div className="wx-head-tools">
        <button type="button" className="oi-tool" title="Return to the Epii face — instrument 0's entry" aria-label="Return to the Epii face"
            onClick={() => setFaceOpen(true)}><Glyph name="release" size={13}/></button>
        {document && <button type="button" className="oi-tool" title="Open this projection in the Expressions workspace" aria-label="Open in Expressions"
            onClick={() => requestExpressionOpen({expressionRef: document.expression_ref, sceneRef: document.selection.scene_ref, entityRef: document.selection.entity_ref})}><Glyph name={ICON.present} size={13}/></button>}
        {stageError && <button type="button" className="oi-tool" onClick={() => setRetry(value => value + 1)} title={`Retry presenting: ${stageError}`} aria-label="Retry presenting"><Glyph name={ICON.refresh} size={13}/></button>}
      </div>
    </header>

    {(error || stageError) && <p className="oi-refusal wx-notice" role="status">
      {error ?? stageError}
      <button type="button" className="oi-tool" aria-label="Dismiss" onClick={() => { setError(null); setStageError(null); }}><Glyph name={ICON.close} size={12}/></button>
    </p>}

    {notices.length > 0 && <div className="wx-notices" role="status">
      {notices.map(notice => <p key={notice} className="oi-note wx-notice-line">{notice}</p>)}
    </div>}

    {/* The artboard: the window's one Expression stage placed here. With the
     * Expression master switch off this is the named static state — the same
     * law as the Expressions surface, with the real enable control. */}
    <div className="wx-field">
      {visualsSnapshot.enabled
        ? <div ref={stageHost} className="wx-stage-host" aria-label="The wiki local whole, projected" data-ready={ready || undefined}/>
        : <div className="wx-stage-off" role="status">
            <strong>The Expression stage is off.</strong>
            <p className="oi-note">The projection stands as a real oi.expression/v1 document; its living presentation needs the window's Expression stage.</p>
            <button type="button" className="oi-action" onClick={() => visuals.setEnabled(true)}>Enable the Expression stage</button>
          </div>}
      {document && <WikiSubjectPanel document={document} workspaceSubjectRef={subject?.ref} onOpenKnowledge={openKnowledge} onOpenSource={source => void openSource(source)}/>}
    </div>

    {document && <WikiTransport document={document} projection={projection}
        onFocus={(sceneRef, entityRef) => void focus(document.expression_ref, document.revision, sceneRef, entityRef)}
        onOpenKnowledge={openKnowledge}/>}
    </>}
  </div>;
}

/** The scene strip (overview first) and the current scene's entity row — the
 * Expression transport grammar: focus changes are kernel edits on the real
 * document; entering a constellation is the same edit. */
function WikiTransport({document, projection, onFocus, onOpenKnowledge}: {
  document: ExpressionDocument;
  projection: WikiProjection | undefined;
  onFocus(sceneRef: string, entityRef: string | null): void;
  onOpenKnowledge(ref: string, title: string): void;
}) {
  const selectedScene = document.scenes.find(scene => scene.scene_ref === document.selection.scene_ref);
  const constellationByScene = useMemo(() => new Map((projection?.constellations ?? []).map(entry => [entry.sceneRef, entry])), [projection]);
  const constellationByOverviewEntity = useMemo(() => new Map((projection?.constellations ?? []).map(entry => [entry.overviewEntityRef, entry])), [projection]);
  const selectedConstellation = selectedScene ? constellationByScene.get(selectedScene.scene_ref) : undefined;
  const scheme = selectedConstellation?.scheme;

  return <div className="wx-transport">
    <nav className="wx-scenes oi-plane-nav" aria-label="The local whole's scenes">
      {document.scenes.map(scene => {
        const entry = constellationByScene.get(scene.scene_ref);
        return <button key={scene.scene_ref} type="button" aria-pressed={scene.scene_ref === document.selection.scene_ref}
            data-scene-ref={scene.scene_ref} data-scheme={entry?.scheme}
            title={entry ? `${entry.title} — ${entry.scheme === "ql-constellation" ? "QL constellation layout, warranted by the wiki's own positions" : "radial presentation — the wiki declares no positional warrant"}` : scene.title}
            onClick={() => onFocus(scene.scene_ref, null)}>
          {scene.title}
        </button>;
      })}
    </nav>
    <div className="wx-entities" role="group" aria-label="This scene's entities">
      {(selectedScene?.entity_refs ?? []).map(ref => {
        const entity = document.entities[ref];
        if (!entity) return null;
        const constellation = constellationByOverviewEntity.get(ref);
        const role = constellation ? "constellation" : selectedConstellation?.wholeEntityRef === ref ? "whole" : "node";
        const subjectRef = entity.subject?.subject_ref;
        return <button key={ref} type="button" className="wx-entity" aria-pressed={document.selection.entity_ref === ref}
            data-entity-ref={ref} data-subject-ref={subjectRef} data-role={role}
            title={subjectRef ? `${entity.title} — ${subjectRef}` : entity.title}
            onClick={() => onFocus(selectedScene!.scene_ref, ref)}
            onDoubleClick={() => {
              if (constellation) onFocus(constellation.sceneRef, null);
              else if (subjectRef) onOpenKnowledge(subjectRef, entity.title);
            }}>
          {entity.title}
          {constellation && <span className="oi-state">{constellation.scheme === "ql-constellation" ? "warranted shape" : "radial"}</span>}
        </button>;
      })}
      {selectedScene && selectedScene.entity_refs.length === 0 && <span className="oi-note">This scene holds nothing yet.</span>}
    </div>
    {scheme && <span className="oi-state wx-scheme" data-scheme={scheme} title={scheme === "ql-constellation"
        ? "Members sit at the sixfold positions the wiki itself declares — presentation warrant, never a semantic edge"
        : "Members sit on an even ring — the wiki declares no positional warrant"}>
      {scheme === "ql-constellation" ? "QL constellation layout — warranted" : "radial layout — no warrant claimed"}
    </span>}
  </div>;
}

/** The selected subject's panel: everything the projection holds for the
 * canonical ref, with the real open paths and the exact unavailable states. */
function WikiSubjectPanel({document, workspaceSubjectRef, onOpenKnowledge, onOpenSource}: {
  document: ExpressionDocument;
  workspaceSubjectRef: string | undefined;
  onOpenKnowledge(ref: string, title: string): void;
  onOpenSource(sourceRef: string): void;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const entityRef = document.selection.entity_ref;
  const entity = entityRef ? document.entities[entityRef] : undefined;
  const subject = entity?.subject;
  useEffect(() => { if (entityRef) scrollWithin(panel.current?.querySelector(`[data-entity-row="${entityRef}"]`) ?? undefined); }, [entityRef]);

  if (!entity || !subject) return null;
  const relations = Object.values(document.relations).filter(relation => {
    const from = document.entities[relation.from_entity_ref]?.subject?.subject_ref;
    const to = document.entities[relation.to_entity_ref]?.subject?.subject_ref;
    return from === subject.subject_ref || to === subject.subject_ref;
  });
  const sources = subject.sources;
  const isWorkspaceSubject = workspaceSubjectRef !== undefined && workspaceSubjectRef === subject.subject_ref;

  return <aside ref={panel} className="wx-subject" aria-label="The selected subject" data-subject-ref={subject.subject_ref}>
    <header className="wx-subject-head">
      <span className="oi-eyebrow">Selected subject</span>
      <strong>{entity.title}</strong>
      <span className="oi-ref wx-subject-ref">{subject.subject_ref}</span>
      {isWorkspaceSubject && <span className="oi-chip" title="This is the workspace's selected subject — the same canonical ref">workspace subject</span>}
    </header>
    <div className="wx-subject-body oi-scroll">
      <p className="oi-note">native owner {subject.native_owner} · presentation role {subject.presentation_role}</p>
      {sources.length > 0 && <section className="wx-subject-section" aria-label="Sources">
        <span className="oi-eyebrow">Sources</span>
        {sources.map(source => <div key={source.ref} className="wx-subject-source">
          <button type="button" className="oi-ref wx-subject-source-ref" title={`Open ${source.ref} (resolved through the files seam before it opens)`} onClick={() => onOpenSource(source.ref)}>{source.ref}</button>
          <span className="oi-state">{short(source.revision)}</span>
        </div>)}
      </section>}
      <section className="wx-subject-section" aria-label="Typed relations">
        <span className="oi-eyebrow">Typed relations ({relations.length})</span>
        {relations.length === 0 && <p className="oi-note">{Object.keys(document.relations).length === 0
          ? "No typed relation is bound in this projection — the relations read did not serve one (the state line names why). Proximity never creates an edge."
          : "No bound typed relation touches this subject."}</p>}
        {relations.map(relation => {
          const from = document.entities[relation.from_entity_ref]?.subject?.subject_ref ?? relation.from_entity_ref;
          const to = document.entities[relation.to_entity_ref]?.subject?.subject_ref ?? relation.to_entity_ref;
          return <p key={relation.binding_ref} className="wx-subject-relation" data-relation={relation.relation.ref}>
            <span className="oi-ref">{relation.relation.ref}</span>
            <span className="oi-state">{from} → {to}</span>
            {relation.provenance.map(provenance => <span key={provenance.ref} className="oi-state">{provenance.ref}</span>)}
          </p>;
        })}
      </section>
      <section className="wx-subject-section" aria-label="Shared staging">
        <span className="oi-eyebrow">Shared staging</span>
        <p className="oi-note" data-unavailable="shared-field">Audience-filtered SharedField staging is not admitted in this cut (issue 366 EX3A6) — the local projection is the whole of what stands here.</p>
      </section>
    </div>
    <footer className="wx-subject-tools">
      <button type="button" className="oi-action oi-action-primary" onClick={() => onOpenKnowledge(subject.subject_ref, entity.title)}>Open the page</button>
      {sources[0] && <button type="button" className="oi-action" onClick={() => onOpenSource(sources[0].ref)}>Open the source</button>}
      <p className="oi-note wx-subject-open-note">The page opens through the frame's knowledge path into this mode's own tree — the kernel opens the surface and the tree carries it (under the dedicated stage it stands as the tree's hidden state and surfaces through the panel's Active Context); beside, full, detach and re-dock remain the workbench's own controls on the placement.</p>
    </footer>
  </aside>;
}

/** The Epii face: the twelve-masks expression ("Twelve faces · one mask",
 * `source-twelve-faces` in the Expressions application's Source studies)
 * opened through the same material seam as the Expressions centre —
 * instrument 0's entry presentation (owner direction 2026-09-19): "you are
 * met by the epii face, the guardian of the O:I web/wiki/graph spaces."
 * The application deep-links to the expression through its own
 * `?expression=` grammar; the shell's corner-cutout alignment applies here
 * exactly as it does in the Expressions centre. */
const EPII_EXPRESSION_ID = "source-twelve-faces";

function EpiiFace({registerTitle, onEnterWhole}: {registerTitle: string; onEnterWhole(): void}) {
  const kernel = useKernel();
  const [src, setSrc] = useState<string | undefined>();
  const [reason, setReason] = useState<string | undefined>();
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const directory = await listFiles(kernel.transport, EXPRESSIONS_APP_DIST);
        const found = directory.entries.find(candidate => candidate.name === EXPRESSIONS_APP_ENTRY);
        if (!found) throw new Error(`The Expressions application is not built at ${EXPRESSIONS_APP_DIST} — build it with the one law in desktop/cradle/expressions-app/README.md`);
        const query = `?expression=${EPII_EXPRESSION_ID}`;
        const url = kernel.transport.kind === "tauri"
          ? materialUrl(found.location, "", query)
          : kernel.transport.kind === "bridge"
            ? `${kernel.transport.url}/material/${encodeURIComponent(JSON.stringify(found.location))}/index.html${query}`
            : undefined;
        if (!url) throw new Error("The face is served through the owner's material seam in the desktop build; a plain browser window cannot host it.");
        if (!alive) return;
        setSrc(url);
      } catch (cause) {
        if (alive) setReason(text(cause));
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = frame.current;
    return node ? trackShellCutout(node) : undefined;
  }, [src]);

  // The face's frame rides the same kernel channel as the Expressions
  // centre (list/inspect/create/edit over the kernel's own op, central
  // reads through the files seam) — the hosted application speaks to its
  // kernel through one grammar wherever the shell hosts it.
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    return relayKernelChannel(node, kernel.transport);
  }, [src, kernel.transport]);

  return <div className="wx-face" data-state={src ? "ready" : reason ? "refused" : "reading"}>
    <header className="wx-face-head">
      <div className="wx-face-title">
        <span className="oi-eyebrow">Instrument 0 · entry</span>
        <strong>The Epii face</strong>
        <span className="oi-note">Twelve faces · one mask — the guardian of the O:I web, wiki and graph spaces. The whole of {registerTitle} stands behind the face.</span>
      </div>
      <button type="button" className="oi-action oi-action-primary" onClick={onEnterWhole}>Enter the wiki · graph whole</button>
    </header>
    {reason && <p className="oi-refusal wx-notice" role="alert">{reason}</p>}
    <div className="wx-face-stage">
      {src && <iframe
        ref={frame}
        src={src}
        title="The Epii face — twelve masks, one expression"
        className="wx-face-frame"
        allow="fullscreen"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-forms allow-downloads allow-same-origin"/>}
    </div>
  </div>;
}
