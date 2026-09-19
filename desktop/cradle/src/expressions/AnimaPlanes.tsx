/**
 * The Expressions mode's right-panel planes — RECEIVING components. The
 * common panel draws the plane nav; these are bodies only.
 *
 * What is real today is the open Expression document (through its owner) and
 * whatever a registered focused-instrument source discloses. Neither Ta-Onta's
 * execution nor Anima's offices have an owner operation in this tree, so
 * nothing here reports status, progress or a control for them: an office with
 * no disclosing operation says exactly that.
 *
 * Authored meaning stays where it is authored:
 *   docs/experience/INHABITED-SYSTEM-ORIENTATION.md (Ta-Onta, Anima's offices)
 *   docs/experience/TECHNE-DUAL-READING.md (TD7 Anima / Technē agency)
 */
import type {ReactNode} from "react";
import type {PanelSubject} from "./panelSubject";
import type {ExpressionDocument, ReadingRef} from "../expression/types";
import {requestExpressionOpen, useExpressionSelection} from "./selection";
import {useExpressionDocument} from "./useExpressionDocument";
import {useFocusedInstrumentReadings, type FocusedInstrumentReading} from "../instrument/useFocusedInstrumentReadings";
import {projectNaraExpression, type NaraExpressionProjection} from "../instrument/nara-expression-adapter";
import "./expressions.css";

const ORIENTATION_DOC = "docs/experience/INHABITED-SYSTEM-ORIENTATION.md";

/** The shared inhabitable execution, in its authored order. */
const TA_ONTA_OFFICES = ["Khora", "Hen", "Pleroma", "Chronos", "Anima", "Aletheia"] as const;
const NO_OPERATION = "No owner operation discloses this yet";

function SubjectLine({subject}: {subject: PanelSubject}) {
  return <small>For {subject.title}{subject.ref ? <> · <span className="oi-ref">{subject.ref}</span></> : null}{subject.kind ? ` · ${subject.kind}` : ""}</small>;
}

export function TaOntaPlane({subject}: {subject: PanelSubject}) {
  return <div className="xa-plane oi-scroll-quiet" data-plane="ta-onta" role="region" aria-label="Ta-Onta">
    <header className="xa-plane-head"><strong>Ta-Onta</strong><SubjectLine subject={subject}/></header>
    <ol className="xa-offices" aria-label="Ta-Onta offices, in execution order">
      {TA_ONTA_OFFICES.map((office, index) => <li key={office} className="xa-office" data-office={office.toLowerCase()} data-disclosed="false">
        <span className="xa-office-ordinal" aria-hidden="true">{index + 1}</span>
        <span className="xa-office-name">{office}</span>
        <span className="xa-office-state xa-unavailable">{NO_OPERATION}</span>
      </li>)}
    </ol>
    <p className="oi-note">This plane receives the execution reading once an owner discloses one. Until then it shows the order only — no status, progress or control is invented. The meaning of each office is authored in <span className="oi-ref">{ORIENTATION_DOC}</span>.</p>
  </div>;
}

const availabilityChipState = (availability: ReadingRef["availability"]) => availability === "available" ? "used" : "stale";
function RefRow({reading, lead}: {reading: ReadingRef; lead?: string}) {
  return <div className="xa-reading-row">{lead && <span className="oi-state">{lead}</span>}<span className="oi-ref">{reading.ref}</span><span className="oi-chip" data-state={availabilityChipState(reading.availability)}>{reading.availability}</span><span className="oi-state">{reading.revision}</span></div>;
}

function Office({name, ordinal, children}: {name: string; ordinal: number; children: ReactNode}) {
  return <li className="xa-office" data-office={name.toLowerCase()}>
    <span className="xa-office-ordinal" aria-hidden="true">{ordinal}</span>
    <span className="xa-office-name">{name}</span>
    <div className="xa-office-body">{children}</div>
  </li>;
}

function CompositionReading({document}: {document: ExpressionDocument}) {
  const scene = document.scenes.find(candidate => candidate.scene_ref === document.selection.scene_ref);
  const entity = document.selection.entity_ref ? document.entities[document.selection.entity_ref] : undefined;
  const pending = document.refinements.filter(proposal => !proposal.decision);
  const decided = document.refinements.filter(proposal => proposal.decision);
  const accepted = decided.filter(proposal => proposal.decision?.state === "accepted").length;
  return <>
    <div className="xa-reading">
      <div className="xa-reading-row"><span className="oi-state">scene</span><span>{scene?.title ?? "none"}</span><span className="oi-state">{document.scenes.length} in all</span></div>
      <div className="xa-reading-row"><span className="oi-state">entity</span><span>{entity?.title ?? "none selected"}</span><span className="oi-state">{Object.keys(document.entities).length} in all</span></div>
    </div>
    {pending.length > 0
      ? <div className="xa-reading" data-reading="pending-refinements">
          <div className="xa-reading-row"><span className="oi-state" data-attention="true">{pending.length} refinement {pending.length === 1 ? "proposal awaits" : "proposals await"} human review</span></div>
          {pending.map(proposal => <div key={proposal.proposal_ref} className="xa-reading-row"><span>{proposal.summary}</span><span className="oi-state">{proposal.proposed_by} · {proposal.changes.length} changes</span></div>)}
          <button type="button" className="oi-action xa-link" onClick={() => requestExpressionOpen({expressionRef: document.expression_ref, focus: "review"})}>Review in the field</button>
        </div>
      : <span className="xa-unavailable">No refinement proposal awaits review.</span>}
    {decided.length > 0 && <div className="xa-reading-row"><span className="oi-state">reviewed</span><span>{accepted} accepted · {decided.length - accepted} rejected</span></div>}
  </>;
}

function MaterialReading({document}: {document: ExpressionDocument}) {
  const bound = Object.values(document.entities).filter(entity => entity.subject);
  if (!bound.length) return <span className="xa-unavailable">No entity is bound to a native subject, so there is no source material to read.</span>;
  return <>{bound.map(entity => <div key={entity.entity_ref} className="xa-reading" data-entity-ref={entity.entity_ref}>
    <div className="xa-reading-row"><span>{entity.title}</span><span className="oi-chip" data-role={entity.subject!.presentation_role}>{entity.subject!.presentation_role} · {entity.subject!.native_owner}</span></div>
    <div className="xa-reading-row"><span className="oi-ref">{entity.subject!.subject_ref}</span></div>
    {entity.subject!.sources.length === 0 && <span className="xa-unavailable">No source is bound for this subject.</span>}
    {entity.subject!.sources.map(source => <RefRow key={`${source.ref}@${source.revision}`} reading={source} lead="source"/>)}
  </div>)}</>;
}

function TemporalReading({document}: {document: ExpressionDocument}) {
  const automated = Object.values(document.entities).flatMap(entity => Object.entries(entity.parameters).filter(([, parameter]) => parameter.automation).map(([key, parameter]) => ({entity, key, automation: parameter.automation!})));
  if (!automated.length) return <span className="xa-unavailable">No parameter of this Expression is automated.</span>;
  return <div className="xa-reading">{automated.map(({entity, key, automation}) => <div key={`${entity.entity_ref}:${key}`} className="xa-reading-row">
    <span>{entity.title} · {key}</span><span className="oi-ref">{automation.waveform} {automation.min}–{automation.max} @ {automation.rate_hz} Hz</span>
  </div>)}</div>;
}

function IntegrationReading({document}: {document: ExpressionDocument}) {
  const relations = Object.values(document.relations);
  if (!relations.length && !document.representations.length && !document.provenance.length) return <span className="xa-unavailable">No relation, representation or provenance is bound to this Expression.</span>;
  return <div className="xa-reading">
    {relations.map(relation => <RefRow key={relation.binding_ref} reading={relation.relation} lead="relation"/>)}
    {document.representations.map(representation => <RefRow key={`${representation.kind}:${representation.representation.ref}`} reading={representation.representation} lead={representation.kind}/>)}
    {document.provenance.map(entry => <RefRow key={`${entry.ref}@${entry.revision}`} reading={entry} lead="provenance"/>)}
  </div>;
}

function NaraReading({readings}: {readings: FocusedInstrumentReading[]}) {
  const disclosed: {reading: FocusedInstrumentReading; projection: NaraExpressionProjection | null; error: string | null}[] = [];
  for (const reading of readings) {
    if (reading.state !== "read" || !reading.snapshot?.nara_expression) continue;
    try { disclosed.push({reading, projection: projectNaraExpression(reading.snapshot), error: null}); }
    catch (cause) { disclosed.push({reading, projection: null, error: cause instanceof Error ? cause.message : String(cause)}); }
  }
  if (!disclosed.length) return <p className="xa-unavailable" data-nara="absent">Nara is not resident in this world.</p>;
  return <>{disclosed.map(({reading, projection, error}) => <div key={reading.ref} className="xa-reading" data-nara={projection?.standing ?? "refused"}>
    <div className="xa-reading-row"><span>{reading.title}</span><span className="oi-ref">{reading.ref}</span></div>
    {error && <p className="oi-refusal">{error}</p>}
    {projection && <>
      <div className="xa-reading-row"><span className="oi-chip" data-state={projection.standing === "current" ? "used" : "stale"}>{projection.standing}</span><span className="oi-state">{projection.reason}</span></div>
      {projection.session && <ul className="xa-centres" aria-label="Seven centres, read-only">
        {[...projection.session.centres].sort((a, b) => a.ordinal - b.ordinal).map(centre => <li key={centre.locus_ref}><span>{centre.ordinal + 1}</span><span>{centre.label}</span><span className="oi-state">resonance {centre.resonance.toFixed(2)}</span></li>)}
        <li><span>⊕</span><span>EarthBody</span><span className="oi-ref">{projection.session.earth_body.frame_ref}</span></li>
      </ul>}
    </>}
  </div>)}</>;
}

export function AnimaPlane({subject}: {subject: PanelSubject}) {
  const selection = useExpressionSelection();
  const reading = useExpressionDocument(selection.expressionRef, selection.revision);
  const instruments = useFocusedInstrumentReadings();
  const document = reading.state === "read" || reading.state === "reading" ? reading.document : undefined;
  return <div className="xa-plane oi-scroll-quiet" data-plane="anima" role="region" aria-label="Anima">
    <header className="xa-plane-head">
      <strong>Anima</strong>
      <SubjectLine subject={subject}/>
      {document
        ? <small>Reading <span className="oi-ref">{document.expression_ref}</span> · {document.title} · revision {document.revision}</small>
        : reading.state === "reading" ? <small>Reading the open Expression…</small>
        : <small>No Expression is open in the field.</small>}
    </header>
    {reading.state === "refused" && <p className="oi-refusal" role="alert">{reading.error}</p>}
    <ol className="xa-offices" aria-label="Anima's offices over the open Expression">
      <Office name="Composition" ordinal={1}>{document ? <CompositionReading document={document}/> : <span className="xa-unavailable">{NO_OPERATION}</span>}</Office>
      <Office name="Material" ordinal={2}>{document ? <MaterialReading document={document}/> : <span className="xa-unavailable">{NO_OPERATION}</span>}</Office>
      <Office name="Temporal" ordinal={3}>{document ? <TemporalReading document={document}/> : <span className="xa-unavailable">{NO_OPERATION}</span>}</Office>
      <Office name="Integration" ordinal={4}>{document ? <IntegrationReading document={document}/> : <span className="xa-unavailable">{NO_OPERATION}</span>}</Office>
    </ol>
    <p className="oi-note">These readings are the open Expression document itself, placed under the office they belong to. Anima's own acts in each office have no owner operation in this tree yet, so none are shown.</p>
    <section className="xa-section" aria-label="Nara">
      <span className="oi-eyebrow">Nara</span>
      <NaraReading readings={instruments}/>
    </section>
  </div>;
}
