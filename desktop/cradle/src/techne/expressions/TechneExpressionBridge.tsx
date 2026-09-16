/**
 * The Technē Expressions bridge (L5 Technē T7) — the "expressions"
 * instrument surface. It makes the shared Technē selection instantiable as a
 * living Expression and embodyable through the M′ focused instrument,
 * without duplicating any host:
 *
 *   - Instantiate Expression from this selection — builds the portable cue
 *     (`./cue`) and opens through the EXISTING summon path only: the
 *     kernelOp `{op:"expression", operation:"open"}` sequence the Nara
 *     composition uses, then the canonical `oi:expression-compose` summon.
 *     No second opening path exists here.
 *   - Embody through the M′ instrument — the gate in `./embody`; when the
 *     descriptor is embodyable the existing K9 open request addresses
 *     `ql.techne:source:<subject_ref>` (registered by `./register`); when it
 *     is not, the honest reason shows.
 *   - Verso / sources — the reading's provenance stays reachable without
 *     leaving the Expression identity.
 *
 * Laws held in code: refs verbatim (the cue asserts byte-verbatim carriage);
 * the same AgentSession (agent_session_ref rides the selection, never
 * minted); no shadow object (the bridge never clones the subject into a new
 * entity — it passes refs, and the substrate itself refuses an expression
 * ref in a subject binding); QL cues only when warranted; ONE Global
 * Expression Stage — this surface creates no renderer, canvas or animation
 * loop of its own.
 */
import {useMemo, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {kernelOp} from "../../kernel/bridge";
import {summonExpression} from "../../expression/summon";
import {requestFocusedInstrumentOpen} from "../../instrument/source";
import {buildExpressionCue, expressionDocumentFromCue} from "./cue";
import {embody} from "./embody";
import type {TechneSurfaceProps} from "../registry";

const ACTOR = "human:techne-expression";

function selectorSummary(selector: unknown): string | null {
  if (!selector || typeof selector !== "object") return null;
  const unit = (selector as {unit?: string}).unit;
  const rest = (selector as Record<string, unknown>);
  switch (unit) {
    case "text_span": return `text ${String(rest.start)}–${String(rest.end)}`;
    case "timestamp_range": return `${String(rest.from)} → ${String(rest.to)}`;
    case "image_region": return `region ${String(rest.x)},${String(rest.y)} ${String(rest.width)}×${String(rest.height)}`;
    case "other": return `${String(rest.kind)}: ${String(rest.value)}`;
    default: return null;
  }
}

export function TechneExpressionBridge({selection, reading}: TechneSurfaceProps) {
  const kernel = useKernel();
  const [busy, setBusy] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [embodyError, setEmbodyError] = useState<string | null>(null);

  // The cue is rebuilt from the reading and the selection as they move; a
  // refusal is surfaced, never smoothed into a best-effort cue.
  const gate = useMemo(() => {
    if (!reading || !selection) return {cue: null, error: null as string | null};
    try {
      return {cue: buildExpressionCue(reading, selection), error: null};
    } catch (cause: unknown) {
      return {cue: null, error: cause instanceof Error ? cause.message : String(cause)};
    }
  }, [reading, selection]);

  const embodiment = useMemo(() => {
    if (!reading || !selection) return null;
    try {
      return embody(reading, selection);
    } catch (cause: unknown) {
      return {embodyable: false as const, reason: cause instanceof Error ? cause.message : String(cause)};
    }
  }, [reading, selection]);

  if (!reading || !selection) {
    return <p className="techne-absent">No selection is disclosed — the Expression bridge has no subject to instantiate over.</p>;
  }

  const instantiate = async () => {
    const cue = gate.cue;
    if (!cue || busy) return;
    setBusy(true);
    setOpenError(null);
    setNote(null);
    try {
      if (cue.scene_focus && cue.scene_focus.expression_ref.startsWith("expression:")) {
        // The Nara composition's exact sequence: compose → kernelOp open →
        // canonical summon. The kernel returns revision_conflict rather than
        // ever replacing an open Expression; that state is surfaced, not fought.
        const document = expressionDocumentFromCue(cue);
        const reply = await kernelOp(kernel.transport, {op: "expression", request: {operation: "open", document, actor: ACTOR}});
        if (reply.error || reply.outcome?.result !== "expression") throw new Error(reply.error ?? "The Expression owner is unavailable in this world");
        const data = reply.outcome.data as {state?: string; current_revision?: number} | undefined;
        if (data?.state === "revision_conflict") {
          setNote(`The owner already holds ${document.expression_ref} at revision ${String(data.current_revision)} — an open Expression is never replaced implicitly.`);
          return;
        }
        if (data?.state !== "ready") throw new Error(`The Expression owner did not open the composition (state ${String(data?.state)})`);
        summonExpression(document.expression_ref);
        setNote(`Opened ${document.expression_ref} over the same subject refs; the canonical composer has it.`);
      } else {
        // The bound identity lives in another owner grammar (or none is
        // bound): the existing summon path opens the canonical composer; the
        // bound refs stay shown here, verbatim, never re-keyed.
        summonExpression();
        setNote(cue.scene_focus
          ? `The bound Expression ${cue.scene_focus.expression_ref} stays in its owner's grammar — the canonical composer's chooser is opened for a desktop instantiation.`
          : "No Expression is bound to this subject — the canonical composer's chooser is opened.");
      }
    } catch (cause: unknown) {
      setOpenError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const embodyThroughInstrument = () => {
    if (!embodiment || busy) return;
    setEmbodyError(null);
    if (!embodiment.embodyable) return; // the reason is already on the surface
    try {
      requestFocusedInstrumentOpen(embodiment.descriptor.ref, embodiment.descriptor.title);
    } catch (cause: unknown) {
      setEmbodyError(`The M′ instrument is not wired for this subject: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };

  const cue = gate.cue;

  return (
    <div style={{flex: 1, display: "flex", flexDirection: "column", gap: "var(--oi-space-3)", padding: "var(--oi-space-3)", background: "var(--oi-canvas-ground)", overflow: "auto"}}>
      <header>
        <p className="techne-eyebrow">Expressions · Technē bridge</p>
        <code className="techne-subject">{reading.subject.subject_ref}</code>
      </header>

      <section aria-label="Expression bindings">
        <p className="techne-eyebrow">Expression bindings</p>
        {reading.expressions?.length
          ? (
            <ul className="techne-instruments">
              {reading.expressions.map((binding) => (
                <li key={binding.expression_ref} className="techne-instrument">
                  <code className="techne-subject">{binding.expression_ref}</code>
                  <span className="techne-standing">revision {binding.revision ?? "unavailable"}{binding.scene_ref ? ` · scene ${binding.scene_ref}` : ""}{binding.profile_ref ? ` · profile ${binding.profile_ref}` : ""}</span>
                </li>
              ))}
            </ul>
          )
          : <p className="techne-absent">No Expression is bound to this subject — the disclosure carries the honest reason.</p>}
      </section>

      <div style={{display: "flex", gap: "var(--oi-space-2)", flexWrap: "wrap", alignItems: "center"}}>
        <button type="button" className="techne-open" disabled={busy || !cue} onClick={() => void instantiate()}>
          Instantiate Expression from this selection
        </button>
        <button type="button" className="techne-open" disabled={busy || !embodiment?.embodyable} onClick={embodyThroughInstrument}>
          Embody through the M′ instrument
        </button>
        {selection.selection_standing ? <span className="techne-standing" data-standing={selection.selection_standing}>selection {selection.selection_standing}</span> : null}
      </div>

      {gate.error && <p role="alert" className="techne-absent">The cue was refused: {gate.error}</p>}
      {openError && <p role="alert" className="techne-absent">The instantiation was refused: {openError}</p>}
      {note && <p role="status" className="techne-absent">{note}</p>}
      {embodiment && !embodiment.embodyable && <p role="status" className="techne-absent">M′ embodiment unavailable — {embodiment.reason}</p>}
      {embodyError && <p role="alert" className="techne-absent">{embodyError}</p>}

      {embodiment?.embodyable && (
        <section aria-label="M-prime embodiment descriptor">
          <p className="techne-eyebrow">M′ embodiment descriptor</p>
          <code className="techne-subject">{embodiment.descriptor.ref}</code>
          <p className="techne-absent">
            source {embodiment.descriptor.snapshot.source_ref ?? "—"}{embodiment.descriptor.snapshot.source_revision ? ` @ ${embodiment.descriptor.snapshot.source_revision}` : ""}
            {embodiment.descriptor.snapshot.coordinate_ref ? ` · coordinate ${embodiment.descriptor.snapshot.coordinate_ref}` : ""}
          </p>
        </section>
      )}

      {cue?.ql && (
        <section aria-label="QL profile cues">
          <p className="techne-eyebrow">QL profile cues · warranted</p>
          <ul className="techne-instruments">
            <li className="techne-instrument"><span className="techne-standing">lens</span> <code className="techne-subject">{cue.ql.lens_ref ?? "—"}</code></li>
            {cue.ql.sublens_ref && <li className="techne-instrument"><span className="techne-standing">sublens</span> <code className="techne-subject">{cue.ql.sublens_ref}</code></li>}
            {cue.ql.address && <li className="techne-instrument"><span className="techne-standing">address</span> <code className="techne-subject">{cue.ql.address}</code></li>}
            {cue.ql.shape_ref && <li className="techne-instrument"><span className="techne-standing">shape</span> <code className="techne-subject">{cue.ql.shape_ref}</code></li>}
            <li className="techne-instrument"><span className="techne-standing">warrant</span> <code className="techne-subject">{cue.ql.warrant.result_class} · {cue.ql.warrant.provenance_ref}</code></li>
          </ul>
        </section>
      )}
      {cue && !cue.ql && <p className="techne-absent">No warranted QL facet — the cue carries no QL cues. Absence is data, not a gap to fill.</p>}

      <section aria-label="Verso — sources">
        <p className="techne-eyebrow">Verso · sources</p>
        {reading.provenance?.length
          ? (
            <ul className="techne-instruments">
              {reading.provenance.map((entry) => {
                const selector = selectorSummary(entry.selector);
                return (
                  <li key={entry.source_ref} className="techne-instrument">
                    <code className="techne-subject">{entry.source_ref}</code>
                    <span className="techne-standing">
                      {entry.native_owner}{entry.source_revision ? ` @ ${entry.source_revision}` : ""}{entry.standing ? ` · ${entry.standing}` : ""}{selector ? ` · ${selector}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )
          : <p className="techne-absent">The reading discloses no provenance.</p>}
        {reading.snapshot?.basis_ref && <p className="techne-absent">reading basis {reading.snapshot.basis_ref}{reading.snapshot.revision ? ` @ ${reading.snapshot.revision}` : ""}</p>}
      </section>

      <footer className="techne-notes">
        <p className="techne-absent">
          Same subject refs, same AgentSession — the agent-session ref rides the selection
          {" "}<code className="techne-subject">{selection.agent_session_ref ?? "null"}</code>{", "}
          never minted. The bridge passes refs; it never clones the subject into a new entity,
          and the Expression substrate itself refuses an expression ref as a subject binding.
        </p>
      </footer>
    </div>
  );
}
