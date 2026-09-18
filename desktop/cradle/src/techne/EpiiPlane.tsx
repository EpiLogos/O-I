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
 * Epii's own enrichment, delegation and M′ refraction have no owner contract
 * in this tree: they are named as unavailable, with no status, data or
 * control invented for them. Meaning is authored in
 * docs/experience/TECHNE-DUAL-READING.md.
 */
import type {PanelSubject} from "../expressions/panelSubject";
import {useFocusedInstrumentReadings} from "../instrument/useFocusedInstrumentReadings";
import {materialRefText, useMaterialState, type MaterialItem} from "./material";
import "../expressions/expressions.css";
import "./techne.css";

const NO_OPERATION = "No owner operation discloses this yet";
const UNAVAILABLE = ["Epii enrichment", "Delegation to Epii", "M′ refraction"] as const;

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
      <ul className="tn-epii-list">{UNAVAILABLE.map(name => <li key={name} className="xa-reading" data-disclosed="false"><div className="xa-reading-row"><span>{name}</span></div><span className="xa-unavailable">{NO_OPERATION}</span></li>)}</ul>
    </section>
  </div>;
}
