/**
 * The authored self definition of a native Agent: two exact Central source
 * pins (the particular self + the shared Relational Logos). A pin is never
 * hand-typed: the author reads a `central:source:` reference through the
 * native owner (or saves pasted prose through Central's own creation door)
 * and the RESOLVED digest of the exact bytes becomes the pin. The review
 * block shows the exact operative text Central reviewed — or the named
 * reason a source did not resolve — and blocks acceptance while unresolved.
 */
import {useState} from "react";
import type {NativeReview, SelfChange, SelfDefinitionDraft, SelfSourcePin, SelfSourceReading, SelfSourceResolution} from "./nativeAgent";

const shortDigest = (digest: string) => digest.length > 27 ? `${digest.slice(0, 15)}…${digest.slice(-8)}` : digest;
const shortRef = (reference: string) => reference.length > 72 ? `${reference.slice(0, 69)}…` : reference;

/** One pinned source: read-and-pin by reference, or save pasted prose as a
 * new root self-description source and pin from its resolved digest. */
function SelfPinField({label, pin, kind, onPin, onRead, onCreate, disabled}: {
 label: string;
 kind: "source" | "relationalLogos";
 pin?: SelfSourcePin;
 onPin: (pin: SelfSourcePin | undefined) => void;
 onRead: (reference: string) => Promise<SelfSourceReading | undefined>;
 onCreate: (name: string, content: string) => Promise<SelfSourceReading | undefined>;
 disabled?: boolean;
}) {
 const [reference, setReference] = useState("");
 const [reading, setReading] = useState<SelfSourceReading>();
 const [writing, setWriting] = useState(false);
 const [prose, setProse] = useState("");
 const [fileName, setFileName] = useState("");
 const [error, setError] = useState<string>();
 const read = async () => {
  setWriting(true); setError(undefined);
  try {
   const resolved = await onRead(reference);
   if (!resolved) return;
   setReading(resolved);
   onPin({reference: resolved.reference, contentDigest: resolved.content_digest});
  } finally { setWriting(false); }
 };
 const saveProse = async () => {
  setWriting(true); setError(undefined);
  try {
   const resolved = await onCreate(fileName, prose);
   if (!resolved) return;
   setReading(resolved);
   setReference(resolved.reference);
   onPin({reference: resolved.reference, contentDigest: resolved.content_digest});
  } finally { setWriting(false); }
 };
 const pinned = pin !== undefined;
 return <div className="self-definition-pin" data-self-pin={kind}>
  <label className="oi-field">{label} source reference
   <input className="oi-input" aria-label={`${label} source reference`} placeholder="central:source:control:root:Control/self/agents/…" value={reference}
    onChange={event => setReference(event.target.value)}/>
  </label>
  <button type="button" className="oi-action" disabled={disabled || writing || !reference.trim()} onClick={() => void read()}>{writing ? "Reading…" : "Read & pin"}</button>
  <details><summary>or write it here</summary>
   <label className="oi-field">File name under Control/self
    <input className="oi-input" aria-label={`${label} file name`} placeholder="agents/<name>/self.md" value={fileName} onChange={event => setFileName(event.target.value)}/>
   </label>
   <label className="oi-field">{label} text
    <textarea className="oi-input" aria-label={`${label} text`} rows={6} value={prose} onChange={event => setProse(event.target.value)}/>
   </label>
   <button type="button" className="oi-action" disabled={disabled || writing || !fileName.trim() || !prose.trim()} onClick={() => void saveProse()}>Save source and pin</button>
   <p className="oi-note">Saves once through Central&apos;s own human creation door (no overwrite); the created source is then read back and pinned from its resolved bytes.</p>
  </details>
  {reading&&<div data-self-reading={kind}>
   <p className="oi-note">Resolved <code className="oi-ref">{shortRef(reading.reference)}</code> · {reading.size_bytes} bytes · digest <code className="oi-ref">{reading.content_digest}</code>{reading.truncated?" · preview truncated":""}</p>
   <pre className="oi-note" aria-label={`${label} source preview`} style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:"12em",overflow:"auto"}}>{reading.text}</pre>
  </div>}
  {!reading&&pinned&&<p className="oi-note" data-self-pinned={kind}>Pinned: <code className="oi-ref">{shortRef(pin.reference)}</code> · <code className="oi-ref">{shortDigest(pin.contentDigest)}</code></p>}
  {error&&<p className="oi-refusal" role="alert">{error}</p>}
 </div>;
}

/** The creator's collapsible Self definition section: sits between the
 * individual Skills and the visual Character; both stay untouched. */
export function SelfDefinitionSection({value, onChange, onRead, onCreate, disabled}: {
 value?: SelfDefinitionDraft;
 onChange: (next: SelfDefinitionDraft | undefined) => void;
 onRead: (reference: string) => Promise<SelfSourceReading | undefined>;
 onCreate: (name: string, content: string) => Promise<SelfSourceReading | undefined>;
 disabled?: boolean;
}) {
 const set = (kind: "source" | "relationalLogos", pin: SelfSourcePin | undefined) => {
  const next: SelfDefinitionDraft = {...value};
  if (pin) next[kind] = pin; else delete next[kind];
  onChange(next.source || next.relationalLogos ? next : undefined);
 };
 const both = value?.source && value?.relationalLogos;
 return <fieldset className="oi-section self-definition-section" aria-label="Self definition" disabled={disabled}>
  <legend>Self definition</legend>
  <details>
   <summary>{both ? `Self definition — ${shortRef(value!.source!.reference)} · ${shortRef(value!.relationalLogos!.reference)}` : "Attach an authored self definition (optional)"}</summary>
   <p className="oi-note">Two exact Central source pins: the Agent&apos;s particular self and the shared Relational Logos. The exact bytes are what the Agent will carry; the digest is resolved by an actual read and checked at review.</p>
   <SelfPinField label="Self" kind="source" pin={value?.source} onPin={pin => set("source", pin)} onRead={onRead} onCreate={onCreate}/>
   <SelfPinField label="Relational Logos" kind="relationalLogos" pin={value?.relationalLogos} onPin={pin => set("relationalLogos", pin)} onRead={onRead} onCreate={onCreate}/>
   {both&&<p className="oi-note" data-self-summary="true">Pinned: <code className="oi-ref">{shortRef(value!.source!.reference)}</code> <code className="oi-ref">{shortDigest(value!.source!.contentDigest)}</code> · <code className="oi-ref">{shortRef(value!.relationalLogos!.reference)}</code> <code className="oi-ref">{shortDigest(value!.relationalLogos!.contentDigest)}</code></p>}
  </details>
 </fieldset>;
}

/** The exact operative text Central reviewed for each bound pin — or the
 * named reason a source did not resolve. Renders nothing without a bound
 * self, so existing no-self flows are unchanged. */
export function SelfReviewBlock({review}: {review: NativeReview}) {
 const pins: [string, SelfSourceResolution | undefined][] = [
  ["Self", review.self_definition?.source],
  ["Relational Logos", review.self_definition?.relational_logos],
 ];
 if (!review.self_definition || pins.every(([, pin]) => !pin)) return null;
 return <div className="self-review-block" aria-label="Review operative text" data-self-review="true">
  <h4>Review operative text</h4>
  {pins.map(([label, pin]) => !pin ? null : <div key={label} data-self-operative={label}>
   <p className="oi-note">{label}: <code className="oi-ref">{pin.reference}</code> · digest <code className="oi-ref">{pin.content_digest}</code> ·{" "}
    {pin.resolved ? <span data-self-resolved="true">resolved</span> : <span data-self-resolved="false" data-self-reason={pin.reason} role="alert">not resolved — {pin.reason ?? "unresolved"}</span>}</p>
   {pin.resolved && pin.text !== undefined && <pre aria-label={`${label} operative text`} style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:"18em",overflow:"auto"}}>{pin.text}</pre>}
  </div>)}
  {review.self_sources_resolved === false && <p className="oi-refusal" role="alert">The bound self sources are not all resolved on this source; acceptance is withheld until they resolve.</p>}
 </div>;
}

/** Change an EXISTING Agent's bound self definition: the same pins the
 * creator uses, plus an explicit save through Central's compare-and-swap
 * profile save (kernel `set-self`). A saved change advances the revision,
 * so an accepted Agent needs acceptance again. */
export function SelfDefinitionEditor({current, accepted, onRead, onCreate, onSave, disabled}: {
 current?: SelfDefinitionDraft;
 accepted?: boolean;
 onRead: (reference: string) => Promise<SelfSourceReading | undefined>;
 onCreate: (name: string, content: string) => Promise<SelfSourceReading | undefined>;
 onSave: (next: SelfDefinitionDraft | null) => Promise<SelfChange | undefined>;
 disabled?: boolean;
}) {
 const [draft, setDraft] = useState<SelfDefinitionDraft | undefined>(current);
 const [saving, setSaving] = useState(false);
 const [outcome, setOutcome] = useState<string>();
 const [error, setError] = useState<string>();
 const changed = JSON.stringify(draft ?? null) !== JSON.stringify(current ?? null);
 const save = async () => {
  setSaving(true); setError(undefined); setOutcome(undefined);
  try {
   const change = await onSave(draft ?? null);
   if (!change) { setError("The self definition change was not confirmed by Central."); return; }
   setOutcome(change.state === "unchanged" ? "The Agent already carries this self definition."
    : `Saved as revision ${change.revision}.${change.re_acceptance_required ? " This changed source must be accepted again before it can work." : ""}`);
  } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  finally { setSaving(false); }
 };
 return <div className="self-definition-editor">
  <details><summary>Change the bound self definition</summary>
   <SelfDefinitionSection value={draft} onChange={setDraft} onRead={onRead} onCreate={onCreate} disabled={disabled || saving}/>
   <div className="agency-action-row">
    <button type="button" className="oi-action" disabled={disabled || saving || !changed} onClick={() => void save()}>{saving ? "Saving…" : draft ? "Save self definition" : "Remove self definition"}</button>
    {changed && accepted && <span className="oi-state">Saving changes the Agent&apos;s source; it will need your acceptance again.</span>}
   </div>
  </details>
  {outcome && <p className="oi-note" role="status">{outcome}</p>}
  {error && <p className="oi-refusal" role="alert">{error}</p>}
 </div>;
}
