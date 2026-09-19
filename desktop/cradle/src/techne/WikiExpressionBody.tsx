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
 * projection predates the current reading), and the not-admitted
 * audience-filtered SharedField staging — each is named exactly.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {SurfaceBinding} from "../surface/types";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {listFiles} from "../files/client";
import {useVisuals} from "../visuals/ParticleExpression";
import {visuals} from "../visuals/store";
import {useExpressionStage, type StagePresentation} from "../stage/ExpressionStage";
import {expressionConfig} from "../expression/engineProjection";
import type {ExpressionDocument, ExpressionResult} from "../expression/types";
import {requestExpressionOpen} from "../expressions/selection";
import {Glyph} from "../workspace/Glyph";
import {ICON} from "../expressions/icons";
import {scrollWithin} from "../shared/scrollWithin";
import {
  projectWikiExpression,
  readWikiRegister,
  wikiRegistersFrom,
  type WikiProjection,
  type WikiRegister,
  type WikiRegisterReading,
} from "./wikiExpression";
import "./techne.css";

const REGISTER_KEY = "oi-cradle.techne.m0-register.v1";
const ACTOR = "human:techne-instrument-0";
/** The window's one composition presentation — the same id the Expressions
 * surface and the composer present under, so the two can never stand at once. */
const PRESENTATION_ID = "expression-application";
const short = (revision: string) => revision.length > 18 ? `${revision.slice(0, 16)}…` : revision;
const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

type ProjectionState =
  | { phase: "reading"; register: WikiRegister }
  | { phase: "unavailable"; register: WikiRegister; reason: string }
  | { phase: "absent"; register: WikiRegister }
  | { phase: "drift"; register: WikiRegister; standing: ExpressionDocument; projection: WikiProjection; reason: string }
  | { phase: "ready"; register: WikiRegister; projection: WikiProjection; document: ExpressionDocument };

export function WikiExpressionBody({binding, subject}: {binding: SurfaceBinding; subject?: {ref?: string; kind?: string; title: string; project?: string}}) {
  const kernel = useKernel();
  const stage = useExpressionStage();
  const {snapshot: visualsSnapshot} = useVisuals();
  const registers = useMemo(
    () => wikiRegistersFrom((kernel.snapshot.navigator?.root?.work.projects ?? []).map(row => ({name: row.name, path: row.path}))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kernel.snapshot.navigator?.root?.work.projects],
  );
  const [registerKey, setRegisterKey] = useState(() => {
    const remembered = typeof window !== "undefined" ? window.localStorage.getItem(REGISTER_KEY) : null;
    if (remembered && registers.some(register => register.key === remembered)) return remembered;
    return binding.project && registers.some(register => register.key === binding.project) ? binding.project : "central";
  });
  useEffect(() => { try { window.localStorage.setItem(REGISTER_KEY, registerKey); } catch { /* per-viewer convenience only */ } }, [registerKey]);
  const register = registers.find(row => row.key === registerKey) ?? registers[0];

  const [state, setState] = useState<ProjectionState>({phase: "reading", register});
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const registerRef = useRef(register);
  registerRef.current = register;

  // ---- read → project → open through the kernel's expression op ----------
  const focus = useCallback(async (expressionRef: string, expectedRevision: number, sceneRef: string, entityRef: string | null) => {
    const reply = await kernelOp(kernel.transport, {op: "expression", request: {
      operation: "edit", expression_ref: expressionRef, expected_revision: expectedRevision, actor: ACTOR,
      changes: [{change: "focus", scene_ref: sceneRef, entity_ref: entityRef}],
    }});
    const data = reply.outcome?.result === "expression" ? reply.outcome.data as ExpressionResult : undefined;
    if (reply.error || !data?.document) { setError(reply.error ?? "the kernel did not return the focused document"); return; }
    setError(null);
    setState(current => (current.phase === "ready" || current.phase === "drift") && (current.phase === "ready" ? current.document : current.standing).expression_ref === data.document!.expression_ref
      ? current.phase === "ready" ? {...current, document: data.document!} : {...current, standing: data.document!}
      : current);
  }, [kernel.transport]);

  useEffect(() => {
    const target = registerRef.current;
    if (!target) return;
    const ticket = ++generation.current;
    setState({phase: "reading", register: target});
    setError(null);
    void (async () => {
      try {
        const reading: WikiRegisterReading = await readWikiRegister(kernel.transport, target);
        if (generation.current !== ticket) return;
        if (reading.state === "absent") { setState({phase: "absent", register: target}); return; }
        if (reading.state === "unavailable") { setState({phase: "unavailable", register: target, reason: reading.reason}); return; }
        const projection = projectWikiExpression(reading);
        // A projection whose generation is already open in the kernel STANDS:
        // the kernel never replaces an open draft implicitly, and the
        // standing document — with the person's scene and focus edits — IS
        // the position this instrument restores to. Only an absent
        // generation opens. (The projection identity is content-addressed
        // over the reading, so a changed wiki basis opens as a new
        // generation rather than silently replacing this one.)
        const standingReply = await kernelOp(kernel.transport, {op: "expression", request: {operation: "inspect", expression_ref: projection.document.expression_ref}});
        const standing = standingReply.outcome?.result === "expression" ? (standingReply.outcome.data as ExpressionResult).document : undefined;
        if (standing) { setState({phase: "ready", register: target, projection, document: standing}); return; }
        const reply = await kernelOp(kernel.transport, {op: "expression", request: {operation: "open", document: projection.document, actor: ACTOR}});
        if (generation.current !== ticket) return;
        const data = reply.outcome?.result === "expression" ? reply.outcome.data as ExpressionResult : undefined;
        if (reply.error || !data) { setState({phase: "unavailable", register: target, reason: reply.error ?? "the kernel refused to open the projection"}); return; }
        if (data.state === "revision_conflict") {
          // Unreachable in the ordinary flow (inspect-first above stands the
          // open generation); a race or identity collision lands here. The
          // kernel never replaces an open draft implicitly — read it back
          // and disclose the difference rather than forcing it.
          const conflictReply = await kernelOp(kernel.transport, {op: "expression", request: {operation: "inspect", expression_ref: projection.document.expression_ref}});
          const standingDoc = conflictReply.outcome?.result === "expression" ? (conflictReply.outcome.data as ExpressionResult).document : undefined;
          if (standingDoc) { setState({phase: "drift", register: target, standing: standingDoc, projection, reason: "an open draft already carries this generation's identity with different content"}); return; }
          setState({phase: "unavailable", register: target, reason: "the open projection could not be read back"}); return;
        }
        if (!data.document) { setState({phase: "unavailable", register: target, reason: "the kernel opened the projection without returning its document"}); return; }
        setState({phase: "ready", register: target, projection, document: data.document});
      } catch (cause) {
        if (generation.current !== ticket) return;
        setState({phase: "unavailable", register: target, reason: text(cause)});
      }
    })();
  }, [registerKey, kernel.transport]);

  // ---- the stage presentation: the Expressions workspace's own path ------
  const stageHost = useRef<HTMLDivElement | null>(null);
  const presentation = useRef<StagePresentation | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const document = state.phase === "ready" ? state.document : state.phase === "drift" ? state.standing : undefined;
  const projection = state.phase === "ready" || state.phase === "drift" ? state.projection : undefined;
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
      setStageError(cause instanceof Error ? cause.message : String(cause));
    }
    return () => {
      acquired?.release();
      if (presentation.current === acquired) presentation.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing, stage, retry, document?.expression_ref]);

  // Re-present the same field on every document change; while the clock is
  // held the still is LANDED (the Expressions surface's own two-frames law).
  useEffect(() => {
    const standing = presentation.current;
    if (!standing || !ready || !document) return;
    try {
      const apply = () => standing.updateConfig(expressionConfig(document), document.selection.scene_ref, document.selection.entity_ref ? [document.selection.entity_ref] : []);
      apply();
      standing.command({type: "reset-field"});
      apply();
    } catch (cause) { setStageError(cause instanceof Error ? cause.message : String(cause)); }
  }, [document, ready]);

  if (!register) return null;
  // The owner-named open path for a wiki page: the frame's knowledge open
  // (`oi:epi-open-knowledge` → CradleFrame's openKnowledge). From the Technè
  // arrangement the page's surface opens into this mode's own tree, which
  // the mode centre stands in front of — presenting it INSIDE the instrument
  // needs the frame's portal runtime, named-unimplemented in the kernel's
  // own expression capabilities ("portal_runtime_open_close"). The panel
  // names that state; it never fakes a presentation.
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

  return <div className="wiki-expression" data-register={register.key} data-state={state.phase} data-expression-ref={document?.expression_ref}
      aria-label="Instrument 0 — the wiki local whole as an Expression">
    <header className="wx-head">
      <div className="wx-head-title">
        <label className="oi-field wx-register">
          <span className="oi-eyebrow">Instrument 0 · Project / Wiki / Graph</span>
          <select className="oi-input" aria-label="Register (whose local whole is projected)" value={register.key} onChange={event => setRegisterKey(event.target.value)}>
            {registers.map(row => <option key={row.key} value={row.key}>{row.title}</option>)}
          </select>
        </label>
        <span className="oi-state wx-basis" data-phase={state.phase} title={basis ? `Wiki basis ${basis.ref} at ${basis.revision}` : undefined}>
          {state.phase === "reading" && "reading the register's wiki…"}
          {state.phase === "unavailable" && `wiki reading unavailable: ${state.reason}`}
          {state.phase === "absent" && "this register discloses no wiki yet — an overview with no constellations, never fabricated objects"}
          {state.phase === "drift" && `projection drift — ${state.reason}; the standing generation shows`}
          {state.phase === "ready" && `wiki basis ${short(basis?.revision ?? "")} · ${state.projection.boundRelationCount} typed relations bound`}
          {state.phase === "ready" && state.projection.adriftRelationCount > 0 && ` · ${state.projection.adriftRelationCount} outside this whole`}
        </span>
      </div>
      <div className="wx-head-tools">
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
        <p className="oi-note" data-unavailable="shared-field">Audience-filtered SharedField staging is not admitted in this cut (#366 EX3A6) — the local projection is the whole of what stands here.</p>
      </section>
    </div>
    <footer className="wx-subject-tools">
      <button type="button" className="oi-action oi-action-primary" onClick={() => onOpenKnowledge(subject.subject_ref, entity.title)}>Open the page</button>
      {sources[0] && <button type="button" className="oi-action" onClick={() => onOpenSource(sources[0].ref)}>Open the source</button>}
      <p className="oi-note wx-subject-open-note" data-unavailable="page-presentation">The page opens through the frame's knowledge path into this arrangement's tree; presenting it inside Technè needs the portal runtime — named-unimplemented in the kernel's expression capabilities.</p>
    </footer>
  </aside>;
}
