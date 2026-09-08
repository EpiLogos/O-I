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
import { useKernel } from "../kernel/KernelProvider";
import type { SurfaceBinding } from "./types";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div
      className={`source-editor${buffer.dirty ? " dirty" : ""}${saveFailed ? " conflicted" : ""}`}
      data-kind="source"
      data-ref={binding.ref}
      data-dirty={buffer.dirty}
      data-conflicted={saveFailed}
      onKeyDown={onKeyDown}
    >
      {draftError && <p role="alert">{draftError}</p>}
      {error && <p className="source-note" role="alert">{error}</p>}
      <div className="source-status" role="status">
        <span className="source-revision source-location" data-revision={buffer.base_revision} title={`Central / Work / ${buffer.project} / ${buffer.path}`}>
          Central / Work / {buffer.project} / {buffer.path}
        </span>
        {buffer.dirty ? (
          <span className="source-dirty-marker" title="This source has unsaved changes">
            Unsaved changes
          </span>
        ) : (
          <span className="source-clean-marker">Saved</span>
        )}
        <button type="button" className="source-history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen(open => !open)}>History</button>
        <button type="button" className="source-save" onClick={onSave} disabled={!buffer.dirty}>Save · ⌘S</button>
      </div>
      <div className="source-editor-scroll">
        <div className="source-editor-body">
          <div className="source-gutter" aria-hidden="true">
            {Array.from({ length: Math.max(1, text.split("\n").length) }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="source-textarea"
            aria-label={`Editing ${binding.title}`}
            data-source-ref={binding.ref}
            spellCheck={false}
            value={text}
            onChange={(event) => onEdit(event.target.value)}
          />
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
      {/* Finding 28: a bare truncated hash with no label read as unexplained
          filler; "Rev" gives it the same reading the study's footer line
          has, at this row's 8px tracked-eyebrow scale. */}
      <div className="source-editor-foot">
        <span className="source-foot-revision" title={buffer.base_revision}>Rev {shortRevision(buffer.base_revision)}</span>
        <span>UTF-8 · LF</span>
      </div>
    </div>
  );
}
