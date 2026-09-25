import { useEffect, useMemo, useRef, useState } from "react";
import type { SurfaceBinding } from "../surface/types";
import { readDocumentIdentity, islandSpan, FAMILY_LABEL } from "./identity";
import { documentScripts, useDocumentHostRead, type FrameIsland } from "./frame";
import { useMaterialContext } from "../context/PageContext";
import "./document-host.css";

/**
 * The document host rendered view for SOURCE surfaces (DOCUMENT-SURFACE.md).
 *
 * A bound source whose content carries a crafted payload — a project vision
 * page, a mockup, a ql-doc family document — renders here as itself: the
 * sandboxed opaque-origin frame, the document's own art direction, the
 * host bar with identity and one save. It follows the Day die's law inside
 * SourceSurface: the rendered view is presentation over the canonical
 * buffer; a page save composes the page's own payload island into the
 * buffer and saves through the kernel's source CAS, so a stale basis meets
 * the existing structured conflict, never an overwrite. Selection runs on
 * the same page-context observation route as every material frame.
 */
export function SourceDocumentHost({ binding, text, bufferDirty, conflicted, onComposeSave }: {
  binding: SurfaceBinding;
  /** The surface's current editor text (buffer mirrored + pending edits). */
  text: string;
  bufferDirty: boolean;
  conflicted: boolean;
  /** Save one composed whole source through the surface's buffer CAS.
   * The host awaits it, so the save's own state follows the real act. */
  onComposeSave: (composed: string) => void | Promise<void>;
}) {
  const identity = useMemo(() => readDocumentIdentity(text), [text]);
  const frame = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const readIsland = useDocumentHostRead(frame, true);
  const [frameIsland, setFrameIsland] = useState<FrameIsland>();
  const [savePending, setSavePending] = useState(false);
  const [note, setNote] = useState<string>();
  useMaterialContext(containerRef, binding, "document-host");
  useEffect(() => {
    let live = true;
    const poll = () => { void readIsland().then(value => { if (live && value) setFrameIsland(value); }); };
    poll();
    const timer = setInterval(poll, 2000);
    return () => { live = false; clearInterval(timer); };
  }, [readIsland, text]);
  const savedIslandText = identity?.payload === "ql-doc" ? islandSpan(text, "ql-doc")?.text ?? null : null;
  const pageDirty = identity?.payload === "ql-doc"
    && frameIsland?.text != null && savedIslandText != null && frameIsland.text !== savedIslandText;
  const save = async () => {
    if (savePending || conflicted || identity?.payload !== "ql-doc") return;
    setSavePending(true);
    setNote(undefined);
    try {
      // A rebased buffer keeps the person's edit by law (SourceSurface's
      // conflict grammar); saving lands it on the new basis. The page's
      // own island, when edited, composes into that same act.
      let composed = text;
      if (pageDirty) {
        const value = await readIsland();
        const islandText = typeof value?.text === "string" && value.text.length > 0 ? value.text : undefined;
        if (!islandText) throw new Error("this page did not answer the document host; nothing was saved");
        const span = islandSpan(text, "ql-doc");
        if (!span) throw new Error("the source no longer carries this document's payload island");
        if (span.text !== islandText) composed = text.slice(0, span.start) + islandText + text.slice(span.end);
      }
      await onComposeSave(composed);
    } catch (error) {
      setNote(String(error instanceof Error ? error.message : error));
    } finally {
      setSavePending(false);
    }
  };
  const state = conflicted
    ? { tone: "alert" as const, label: "The source changed behind this page — resolve it in Source view; nothing was overwritten" }
    : savePending
      ? { tone: "status" as const, label: "Saving…" }
      : note
        ? { tone: "alert" as const, label: note }
        : pageDirty
          ? { tone: "status" as const, label: "Unsaved on the page" }
          : bufferDirty
            ? { tone: "status" as const, label: "Source changes pending save" }
            : { tone: "status" as const, label: "Saved" };
  if (!identity) return null;
  const savable = identity.payload === "ql-doc";
  return (
    <section className="document-host" data-document-host data-document-family={FAMILY_LABEL[identity.family] ?? identity.family}>
      <header className="document-host-bar">
        <span className="document-host-family">{FAMILY_LABEL[identity.family] ?? identity.label}</span>
        {identity.templateRef && <span className="document-host-template" title={`Template ${identity.templateRef}`}>{identity.templateRef}</span>}
        {identity.documentRevision != null && <span className="document-host-revision">r{identity.documentRevision}</span>}
        <span className="document-host-state" role={state.tone} data-document-state={state.label}>{state.label}</span>
        {savable && <button type="button" className="document-host-save" data-document-save disabled={savePending || conflicted || (!pageDirty && !bufferDirty)} onClick={() => void save()}>Save</button>}
      </header>
      {identity.relations && (identity.relations.design_refs.length > 0 || identity.relations.vision_refs.length > 0 || identity.relations.capability_refs.length > 0) && (
        <dl className="document-host-relations">
          {identity.relations.design_refs.length > 0 && <><dt>Design</dt><dd>{identity.relations.design_refs.join(", ")}</dd></>}
          {identity.relations.vision_refs.length > 0 && <><dt>Vision</dt><dd>{identity.relations.vision_refs.join(", ")}</dd></>}
          {identity.relations.capability_refs.length > 0 && <><dt>Capability</dt><dd>{identity.relations.capability_refs.join(", ")}</dd></>}
        </dl>
      )}
      <div ref={containerRef} className="document-host-body">
        <iframe
          ref={frame}
          className="document-frame"
          data-page-context
          title={binding.title}
          sandbox="allow-scripts allow-forms allow-downloads"
          referrerPolicy="no-referrer"
          srcDoc={documentFrameHtml(text)}
        />
      </div>
    </section>
  );
}

/** The whole source, unmodified except the injected observation + host
 * scripts (page-context and document-host). A document in the human ground
 * is self-contained by law, so no base href is needed; the frame keeps an
 * opaque origin either way. */
function documentFrameHtml(html: string): string {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, match => `${match}${documentScripts}`);
  return `${documentScripts}${html}`;
}
