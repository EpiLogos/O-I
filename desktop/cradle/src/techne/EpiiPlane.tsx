/**
 * The Technè mode's right-panel plane for Epii, the Technè depth agent — a
 * RECEIVING component. The common panel draws the plane nav; this is the body.
 *
 * Real today:
 *   - the active Technè scene's material and its selected item, as references
 *     with the revision recorded for each. Nothing here sends them anywhere;
 *     the section says so.
 *   - whatever a registered focused-instrument source discloses: the M1–M5
 *     focus and its standing, the Bimba selection, the Vāk binding — read-only
 *     through the existing source API.
 *
 * Delegation and enrichment have a real owner contract in this tree since the
 * Nara speech experience lane landed (ql.nara-epii-delegation/v1 +
 * ql.epii-enrichment/v1, src/nara/dialogueContext.ts): this plane READS the
 * receipts the Nara surface records through its own session, via the shared
 * delegation ledger. It never applies an enrichment (retained-not-applied is
 * the contract) and never speaks for Epii — a live Epii AgentSession producer
 * remains native-owner work (AIKit/Actuation). M′ refraction still has no
 * owner contract here and stays named-unavailable. Meaning is authored in
 * docs/experience/TECHNE-DUAL-READING.md.
 */
import {useSyncExternalStore} from "react";
import type {PanelSubject} from "../expressions/panelSubject";
import {useFocusedInstrumentReadings} from "../instrument/useFocusedInstrumentReadings";
import {materialRefText, useMaterialState, type MaterialItem} from "./material";
import {delegationLedger, subscribeDelegationLedger} from "../nara/delegationLedger";
import "../expressions/expressions.css";
import "./techne.css";

const NO_OPERATION = "No owner operation discloses this yet";

function MaterialLine({item, selected}: {item: MaterialItem; selected?: boolean}) {
  return <li className="xa-reading" data-selected={selected || undefined}>
    <div className="xa-reading-row"><span>{item.name}</span>{selected && <span className="oi-chip" data-state="selected">selected</span>}</div>
    <div className="xa-reading-row"><span className="oi-ref">{materialRefText(item.ref)}</span><span className="oi-state">{item.addedRevision ? `revision ${item.addedRevision}` : "revision not recorded"}</span></div>
  </li>;
}

export function EpiiPlane({subject}: {subject: PanelSubject}) {
  const material = useMaterialState();
  const instruments = useFocusedInstrumentReadings();
  const scene = material.active ? material.scenes[material.active] : undefined;
  const selected = scene?.items.find(item => item.id === scene.selectedId);
  return <div className="xa-plane oi-scroll-quiet" data-plane="epii" role="region" aria-label="Epii">
    <header className="xa-plane-head">
      <strong>Epii</strong>
      <small>For {subject.title}{subject.ref ? <> · <span className="oi-ref">{subject.ref}</span></> : null}{subject.kind ? ` · ${subject.kind}` : ""}</small>
    </header>
    <section className="xa-section tn-epii-first" aria-label="Selected material">
      <span className="oi-eyebrow">Selected material — not sent to any agent</span>
      {!scene && <p className="xa-unavailable">No Technè surface is open, so there is no material scene to read.</p>}
      {scene && scene.items.length === 0 && <p className="xa-unavailable">The open scene holds no material yet.</p>}
      {scene && scene.items.length > 0 && <>
        {selected ? <ul className="tn-epii-list"><MaterialLine item={selected} selected/></ul> : <p className="xa-unavailable">Nothing is selected in the scene.</p>}
        <details className="oi-disclosure"><summary>Scene · {scene.items.length} {scene.items.length === 1 ? "reference" : "references"}</summary>
          <ul className="tn-epii-list">{scene.items.map(item => <MaterialLine key={item.id} item={item} selected={item.id === scene.selectedId}/>)}</ul>
        </details>
      </>}
    </section>
    <section className="xa-section" aria-label="Focused instrument">
      <span className="oi-eyebrow">Focused instrument</span>
      {instruments.length === 0 && <p className="xa-unavailable">No focused-instrument source is registered in this window.</p>}
      {instruments.map(instrument => <div key={instrument.ref} className="xa-reading" data-instrument-ref={instrument.ref}>
        <div className="xa-reading-row"><span>{instrument.title}</span><span className="oi-ref">{instrument.ref}</span></div>
        {instrument.state === "reading" && <span className="xa-unavailable">Reading the source…</span>}
        {instrument.state === "refused" && <p className="oi-refusal" role="alert">{instrument.error}</p>}
        {instrument.state === "read" && instrument.snapshot && <dl className="oi-kv">
          <dt>Focus</dt><dd>{instrument.snapshot.focus.focus.toUpperCase()} · {instrument.snapshot.focus.available ? "available" : "unavailable"} · {instrument.snapshot.focus.current ? "current" : "not current"}</dd>
          <dt>Focus standing</dt><dd>{instrument.snapshot.focus.standing}</dd>
          <dt>Bimba selection</dt><dd>{instrument.snapshot.selection ? <><span className="oi-ref">{instrument.snapshot.selection.coordinate_ref}</span> · {instrument.snapshot.selection_standing ?? "standing not disclosed"}</> : "none"}</dd>
          {instrument.snapshot.selection && <><dt>Selection source</dt><dd><span className="oi-ref">{instrument.snapshot.selection.source_ref}</span> @ {instrument.snapshot.selection.source_revision}</dd></>}
          <dt>Vāk binding</dt><dd>{instrument.snapshot.vak_expression ? <><span className="oi-ref">{instrument.snapshot.vak_expression.source_entry_ref}</span> @ {instrument.snapshot.vak_expression.source_revision}{instrument.snapshot.vak_expression.literal ? ` · “${instrument.snapshot.vak_expression.literal}”` : ""}</> : "none"}</dd>
          <dt>Source standing</dt><dd>{instrument.snapshot.standing}</dd>
        </dl>}
      </div>)}
    </section>
    <section className="xa-section" aria-label="Epii operations">
      <span className="oi-eyebrow">Epii</span>
      <DelegationReadings/>
      <ul className="tn-epii-list">
        <li className="xa-reading" data-disclosed="false"><div className="xa-reading-row"><span>M′ refraction</span></div><span className="xa-unavailable">{NO_OPERATION}</span></li>
      </ul>
    </section>
  </div>;
}
/** The delegation/enrichment readings — the same receipts the Nara surface
 * recorded, read through the shared ledger. Enrichment is disclosed as
 * RETAINED (never applied); the basis and scope refs travel verbatim. */
function DelegationReadings() {
  const entries = useSyncExternalStore(subscribeDelegationLedger, delegationLedger, () => []);
  if (entries.length === 0) {
    return <p className="xa-unavailable">No delegation has been recorded on this instance yet — delegate a question from the Nara surface over an open dialogue context.</p>;
  }
  return <ul className="tn-epii-list">
    {entries.map(entry => {
      const delegationRef = String(entry.delegation?.delegation_ref ?? "");
      const epiiSession = String(entry.delegation?.epii_session_ref ?? "");
      const scopeCount = Array.isArray(entry.delegation?.scope_refs) ? (entry.delegation.scope_refs as unknown[]).length : 0;
      const returned = entry.enrichment !== null;
      const enrichmentRef = returned ? String(entry.enrichment?.enrichment_ref ?? "") : null;
      const standing = returned ? String(entry.enrichment?.standing ?? "") : null;
      return <li key={delegationRef} className="xa-reading" data-delegation-state={returned ? "returned" : "delegated"}>
        <div className="xa-reading-row"><span>Delegation to Epii</span><span className="oi-state">{returned ? "enrichment returned — retained, not applied" : "delegated — Nara stays foreground"}</span></div>
        <div className="xa-reading-row"><span className="oi-ref">{delegationRef}</span><span className="oi-ref">{epiiSession}</span></div>
        <div className="xa-reading-row"><span className="oi-state">{scopeCount} admitted scope ref{scopeCount === 1 ? "" : "s"}</span></div>
        {returned && <div className="xa-reading-row"><span>Epii enrichment</span><span className="oi-ref">{enrichmentRef}</span><span className="oi-state">{standing}</span></div>}
      </li>;
    })}
  </ul>;
}
