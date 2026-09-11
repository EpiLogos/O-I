import {TextEditor,EditorCommands,type EditorHandle} from "../editor/TextEditor";
/**
 * The source editor surface (U0.4, kind 'source') — the minimal editor the
 * kernel seam re-proof walks: a real file opened from the horizon
 * listing, content in a textarea-style canvas, edit with a dirty marker,
 * save with ⌘S through Central's compare-and-swap.
 *
 * Two state layers render side by side when they diverge (map §5 U0.4):
 * the textarea IS the cradle-held dirty buffer; the revision line shows
 * the Central-owned canonical layer. A failed CAS surfaces as the
 * structured conflict below — both sides preserved, no silent overwrite,
 * and the only way forward is an explicit re-read of the canonical layer.
 */

import { useEffect, useRef, useState } from "react";
import { readDraft, writeDraft } from "../workspace/drafts";
import { SourceHistory } from "./SourceHistory";
import { DocumentReturns } from "../receiving/DocumentReturns";
import { useKernel } from "../kernel/KernelProvider";
import type { SurfaceBinding } from "./types";
import {EditorFrame} from "../editor/EditorChrome";

export interface SourceSurfaceProps {
  binding: SurfaceBinding;
}

function shortRevision(revision: string | undefined): string {
  if (!revision) return "—";
  const tail = revision.split(":").pop() ?? revision;
  return `…${tail.slice(-12)}`;
}

export function SourceSurface(props: SourceSurfaceProps) {
  const { binding } = props;
  const kernel = useKernel();
  const buffer = kernel.snapshot.buffers[binding.ref ?? ""];
  const error = kernel.sourceErrors[binding.ref ?? ""];
  const [historyOpen, setHistoryOpen] = useState(false);
  const initialDraft = useRef(binding.ref ? readDraft(binding.ref) : null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [text, setText] = useState(initialDraft.current?.content ?? buffer?.content ?? "");
  const [caret,setCaret]=useState({line:1,column:1,selected:false});
  const textareaRef = useRef<EditorHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewKey = `oi-cradle.source-view:${binding.ref}`;
  const restoredView = useRef(false);
  const savedView = useRef((() => {
    try { return JSON.parse(localStorage.getItem(viewKey) ?? "null"); } catch { return null; }
  })());
  const retainView = () => {
    if (!restoredView.current || !textareaRef.current) return;
    const el = textareaRef.current;
    try { localStorage.setItem(viewKey, JSON.stringify({ start: el.selectionStart, end: el.selectionEnd, direction: el.selectionDirection, top: scrollRef.current?.scrollTop ?? 0, left: scrollRef.current?.scrollLeft ?? 0 })); } catch { /* View coordinates are optional; drafts retain their separate error path. */ }
  };
  useEffect(() => {
    if (!buffer || restoredView.current) return;
    const frame = requestAnimationFrame(() => {
      const view = savedView.current;
      if (view && Number.isInteger(view.start) && Number.isInteger(view.end)) {
        textareaRef.current?.setSelectionRange(view.start, view.end, view.direction);
        if (scrollRef.current) { scrollRef.current.scrollTop = Number(view.top) || 0; scrollRef.current.scrollLeft = Number(view.left) || 0; }
      }
      restoredView.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [!!buffer]);

  // Mirror the kernel buffer into the textarea only when the buffer's
  // content changed from OUTSIDE this surface (open, re-read, save) —
  // never while the person is editing. `lastSynced` is the content this
  // surface last authored or last mirrored; an edit updates it
  // synchronously, so the async edit op's return can never race the caret
  // back to a stale clean layer.
  const lastSynced = useRef<string | null>(null);
  const pendingEdits = useRef(0);
  useEffect(() => {
    if (!buffer) return;
    if (pendingEdits.current > 0) return;
    if (lastSynced.current === null && initialDraft.current && buffer.content !== initialDraft.current.content) return;
    if (buffer.dirty && lastSynced.current !== null) return;
    if (lastSynced.current === buffer.content) return;
    lastSynced.current = buffer.content;
    setText(buffer.content);
  }, [buffer]);

  // Focus the editor when its surface becomes the active one.
  useEffect(() => {
    // The restored pane arrangement owns interaction focus. A kernel
    // subject retained from before reload must not take an empty slot's
    // focus while its source is mounting in another pane.
    const pane = textareaRef.current?.closest<HTMLElement>('.pane.group');
    if (pane && pane.dataset.focused !== 'true') return;
    if (kernel.snapshot.focus.subject?.ref === binding.ref) {
      // Only when the browser focus is not already inside this surface.
      if (!textareaRef.current?.contains(document.activeElement)) {
        // Do not steal focus from an interacting element (menus, inputs).
        const interactive = document.activeElement as HTMLElement | null;
        if (!interactive || interactive === document.body) {
          textareaRef.current?.focus();
        }
      }
    }
  }, [kernel.snapshot.focus.subject?.ref, binding.ref]);

  const onEdit = (value: string) => {
    setText(value);
    if (binding.ref && buffer) {
      try { writeDraft(binding.ref, { content: value, base_revision: buffer.base_revision, saved_content: buffer.saved_content }); setDraftError(null); }
      catch { setDraftError("This draft could not be saved on this device. Keep this window open until the source is saved."); }
    }
    lastSynced.current = value; // this surface authored it — no mirror-back
    pendingEdits.current += 1;
    void kernel.editBuffer(binding.ref ?? "", value).finally(() => {
      pendingEdits.current -= 1;
    });
  };

  const onSave = () => {
    // Always queue an explicit save after preceding edits. The renderer's
    // dirty flag can still be one response behind a fast Cmd+S.
    if (binding.ref) void kernel.saveSource(binding.ref);
  };
  const updateCaret=()=>{const el=textareaRef.current;if(!el)return;const before=el.value.slice(0,el.selectionStart);const lines=before.split("\n");setCaret({line:lines.length,column:(lines[lines.length-1]?.length??0)+1,selected:el.selectionStart!==el.selectionEnd});retainView();};
  const extension=buffer?.path?.split(".").pop()?.toLowerCase();const markdown=extension==="md"||extension==="markdown";

  // ⌘S saves from anywhere in this surface (textarea, conflict panel) —
  // the save is the surface's act, wherever the caret idles. Every other
  // key belongs to the text.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.code === "KeyS") {
      event.preventDefault();
      event.stopPropagation();
      onSave();
    }
  };

  if (!binding.ref) {
    return (
      <div className="source-editor" data-kind="source">
        <p className="source-note">a source surface without a ref — nothing to open</p>
      </div>
    );
  }
  if (!buffer) {
    return (
      <div className="source-editor" data-kind="source" data-ref={binding.ref}>
        <p className="source-note source-note-muted" role="status">{error ?? `Opening ${binding.title}…`}</p>
      </div>
    );
  }

  const conflict = buffer.conflict;
  const saveFailed = conflict !== undefined;
  return (
    <EditorFrame
      className={`source-editor${buffer.dirty ? " dirty" : ""}${saveFailed ? " conflicted" : ""}`}
      label={`Editor ${binding.title}`}
      toolbar={<EditorCommands editor={textareaRef} markdown={markdown}/>}
      footer={<><span className="editor-path source-revision" data-revision={buffer.base_revision} title={`Central / Work / ${buffer.project} / ${buffer.path}`}>Central / Work / {buffer.project} / {buffer.path}</span><span>Ln {caret.line}, Col {caret.column}</span><span className={buffer.dirty?"source-dirty-marker":"source-clean-marker"}>{buffer.dirty?"Unsaved":"Saved"}</span><button type="button" aria-expanded={historyOpen} onClick={()=>setHistoryOpen(open=>!open)}>History</button><button type="button" onClick={onSave} disabled={!buffer.dirty}>Save · ⌘S</button></>}
      data={{kind:"source",ref:binding.ref,dirty:buffer.dirty,conflicted:saveFailed}}
    >
      {draftError && <p role="alert">{draftError}</p>}
      {error && <p className="source-note" role="alert">{error}</p>}
      <div className="source-editor-scroll" ref={scrollRef} onScroll={retainView} onKeyDown={onKeyDown}>
        <div className="source-editor-body">
          <TextEditor ref={textareaRef} binding={binding} filename={buffer.path} aria-label={`Editing ${binding.title}`} value={text} onChange={onEdit} onSelect={updateCaret} onSave={onSave}/>
        </div>
        {historyOpen && <SourceHistory sourceRef={binding.ref} revision={buffer.conflict?.current_revision ?? buffer.base_revision} />}
        {conflict ? (
        <div className="source-conflict" role="alert" data-conflict-kind="revision-conflict">
          <p className="source-conflict-title">
            revision conflict — the canonical layer moved while this buffer was open
          </p>
          <dl className="source-conflict-revisions">
            <div>
              <dt>expected (this buffer&apos;s base)</dt>
              <dd data-expected={conflict.expected_revision}>
                {shortRevision(conflict.expected_revision)}
              </dd>
            </div>
            <div>
              <dt>current (canonical now)</dt>
              <dd data-current={conflict.current_revision}>
                {shortRevision(conflict.current_revision)}
              </dd>
            </div>
          </dl>
          <p className="source-conflict-sides">
            both sides are preserved — the buffer above stays as you edited it; the
            canonical content below is what the owner holds now. nothing was overwritten.
          </p>
          <div className="source-conflict-canonical">
            <p className="source-conflict-canonical-label">canonical side (read-only)</p>
            <pre className="source-conflict-canonical-body" data-canonical="true">
              {conflict.canonical_content}
            </pre>
          </div>
          <button
            type="button"
            className="source-reread"
            data-action="source.reread"
            onClick={() =>
              void kernel.rereadSource(binding.ref!).then(() => {
                // The panel this button lives in unmounts when the conflict
                // resolves — return the caret to the writing layer.
                textareaRef.current?.focus();
              })
            }
          >
            Re-read canonical — rebase this buffer&apos;s base, keep your edit
          </button>
          <p className="source-conflict-hint">
            after the re-read, ⌘S saves your buffer on the new revision
          </p>
        </div>
        ) : null}
      </div>
      {buffer.project && <DocumentReturns sourceRef={binding.ref} project={buffer.project}/>}

    </EditorFrame>
  );
}
