/**
 * The Technè lenses that are real today:
 *
 *   Reading    a file's owner reading — text as text, Markdown rendered through
 *              the material converter (everything else escaped), images from
 *              the binary-safe route. No renderer for a format = a named state.
 *   Reference  the item as a reference: ref, root, path, revisions, size,
 *              owner disclosure, when it was added, whether it changed since.
 *   Knowledge  a knowledge item's reading exactly as AIKit returned it:
 *              resource, provider, authority, why it was selected, evidence,
 *              content.
 *
 * None of them analyses anything. A lens that cannot read shows the owner's
 * refusal verbatim.
 */
import {useEffect, useMemo, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {readFileBytes} from "../files/client";
import {renderMarkdown} from "../material/markdown";
import {registerTechneLens} from "./lens";
import {materialRefText, requestOpenFileInCentre, type MaterialItem} from "./material";
import {materialStanding, type MaterialReading} from "./readings";

const READING_LIMIT = 200_000;

function Refusal({reading}: {reading: MaterialReading}) {
  if (reading.state === "reading") return <p className="oi-note" role="status">Reading through the owner…</p>;
  if (reading.state === "unavailable") return <p className="oi-refusal" role="alert">{reading.error}</p>;
  return null;
}

function ImageReading({item}: {item: MaterialItem}) {
  const {transport} = useKernel();
  const [state, setState] = useState<{url?: string; error?: string}>({});
  const location = item.ref.kind === "file" ? item.ref.location : undefined;
  useEffect(() => {
    if (!location) return;
    let live = true, url: string | undefined;
    setState({});
    void readFileBytes(transport, location).then(material => {
      if (!live) return;
      const bytes = Uint8Array.from(atob(material.content_base64), char => char.charCodeAt(0));
      url = URL.createObjectURL(new Blob([bytes], {type: material.mime_hint ?? "application/octet-stream"}));
      setState({url});
    }, cause => { if (live) setState({error: cause instanceof Error ? cause.message : String(cause)}); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [transport, location?.ref]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state.error) return <p className="oi-refusal" role="alert">{state.error}</p>;
  if (!state.url) return <p className="oi-note" role="status">Reading image bytes through the owner…</p>;
  return <img className="tn-lens-image" src={state.url} alt={item.name}/>;
}

function ReadingLens({item, reading}: {item: MaterialItem; reading: MaterialReading}) {
  const content = reading.state === "available" ? reading.file?.content : undefined;
  const format = reading.state === "available" ? reading.format : undefined;
  const html = useMemo(() => format === "markdown" && content !== undefined ? renderMarkdown(content.slice(0, READING_LIMIT), {resolveAsset: () => "data:,"}) : null, [format, content]);
  if (reading.state !== "available") return <Refusal reading={reading}/>;
  if (format === "image") return <ImageReading item={item}/>;
  if (content === undefined) return <div className="oi-empty" role="status">
    <span>The Reading lens has no renderer for this material{format ? ` (${format})` : ""}. Its owner reading is available: {reading.byteLen ?? "unknown"} bytes{reading.mime ? `, ${reading.mime}` : ""}.</span>
    {item.ref.kind === "file" && <button type="button" className="oi-action" onClick={() => item.ref.kind === "file" && requestOpenFileInCentre(item.ref.location)}>Open in a centre tab</button>}
  </div>;
  const clipped = content.length > READING_LIMIT;
  return <>
    {clipped && <p className="oi-note">Showing the first {READING_LIMIT.toLocaleString()} of {content.length.toLocaleString()} characters. The reference is the whole file.</p>}
    {html !== null
      // The converter escapes everything it does not recognise; links are inert here.
      ? <div className="tn-lens-prose" onClick={event => { if ((event.target as HTMLElement).closest("a")) event.preventDefault(); }} dangerouslySetInnerHTML={{__html: html}}/>
      : <pre className="tn-lens-text">{clipped ? content.slice(0, READING_LIMIT) : content}</pre>}
  </>;
}

function ReferenceLens({item, reading}: {item: MaterialItem; reading: MaterialReading}) {
  const standing = materialStanding(item, reading);
  const file = reading.state === "available" ? reading.file : undefined;
  return <>
    <dl className="oi-kv tn-lens-kv">
      <dt>Kind</dt><dd>{item.ref.kind === "file" ? "Central file" : `knowledge · ${item.ref.address.kind}`}</dd>
      <dt>Ref</dt><dd><span className="oi-ref">{item.ref.kind === "file" ? item.ref.location.ref : materialRefText(item.ref)}</span></dd>
      {item.ref.kind === "file" && <><dt>Root</dt><dd><span className="oi-ref">{item.ref.location.root}</span></dd><dt>Path</dt><dd><span className="oi-ref">{item.ref.location.path}</span></dd></>}
      {item.ref.kind === "knowledge" && item.ref.project && <><dt>Project</dt><dd>{item.ref.project}</dd></>}
      <dt>Current revision</dt><dd>{reading.state === "available" ? <span className="oi-ref">{reading.revision ?? "not disclosed"}</span> : reading.state === "reading" ? "reading…" : "unavailable"}</dd>
      <dt>Revision when added</dt><dd>{item.addedRevision ? <span className="oi-ref">{item.addedRevision}</span> : "not recorded"}</dd>
      <dt>State</dt><dd>{standing === "stale" ? "changed since added" : standing}</dd>
      {reading.state === "available" && reading.byteLen !== undefined && <><dt>Size</dt><dd>{reading.byteLen.toLocaleString()} bytes</dd></>}
      {reading.state === "available" && reading.mime && <><dt>Owner mime hint</dt><dd>{reading.mime}</dd></>}
      {file?.project && <><dt>Project</dt><dd>{file.project.name} · <span className="oi-ref">{file.project.path}</span></dd></>}
      {file?.source && <><dt>Source</dt><dd><span className="oi-ref">{file.source.ref}</span> · {file.source.treatment}</dd></>}
      {reading.state === "available" && reading.knowledge && <><dt>Provider</dt><dd>{reading.knowledge.provider}</dd><dt>Authority</dt><dd>{reading.knowledge.authority}</dd></>}
      <dt>Added</dt><dd>{item.addedAt ? new Date(item.addedAt).toLocaleString() : "unknown"}</dd>
    </dl>
    {reading.state === "unavailable" && <p className="oi-refusal" role="alert">{reading.error}</p>}
  </>;
}

function KnowledgeLens({reading}: {item: MaterialItem; reading: MaterialReading}) {
  if (reading.state !== "available") return <Refusal reading={reading}/>;
  const known = reading.knowledge;
  if (!known) return <p className="oi-note" role="status">The owner returned no knowledge reading for this item.</p>;
  return <>
    <dl className="oi-kv tn-lens-kv">
      <dt>Resource</dt><dd><span className="oi-ref">{known.resource}</span></dd>
      <dt>Provider</dt><dd>{known.provider}</dd>
      <dt>Authority</dt><dd>{known.authority}</dd>
      <dt>Revision</dt><dd>{known.revision ? <span className="oi-ref">{known.revision}</span> : "not disclosed"}</dd>
      <dt>Why selected</dt><dd>{known.why_selected}</dd>
    </dl>
    {known.evidence.length > 0 && <section className="tn-lens-section"><span className="oi-eyebrow">Evidence</span><ul className="tn-lens-list">{known.evidence.map(entry => <li key={entry}><span className="oi-ref">{entry}</span></li>)}</ul></section>}
    {known.content !== undefined
      ? <pre className="tn-lens-text">{known.content.length > READING_LIMIT ? known.content.slice(0, READING_LIMIT) : known.content}</pre>
      : <p className="oi-note">The reading carries no content body.</p>}
  </>;
}

let registered = false;
/** Register the lenses that are real today (once per window). */
export function registerBuiltInLenses() {
  if (registered) return;
  registered = true;
  registerTechneLens({id: "reading", label: "Reading", accepts: item => item.ref.kind === "file", Body: ReadingLens});
  registerTechneLens({id: "knowledge", label: "Knowledge", accepts: item => item.ref.kind === "knowledge", Body: KnowledgeLens});
  registerTechneLens({id: "reference", label: "Reference", accepts: () => true, Body: ReferenceLens});
}
