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
  const [text, setText] = useState(buffer?.content ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bufferRef = useRef(buffer);
  bufferRef.current = buffer;

  // Mirror the kernel buffer into the textarea only when the buffer's
  // content changed from OUTSIDE this surface (open, re-read, save) —
  // never while the person is editing. `lastSynced` is the content this
  // surface last authored or last mirrored; an edit updates it
  // synchronously, so the async edit op's return can never race the caret
  // back to a stale clean layer.
  const lastSynced = useRef<string | null>(null);
  useEffect(() => {
    if (!buffer) return;
    if (buffer.dirty) return; // the person's layer is never clobbered
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
    lastSynced.current = value; // this surface authored it — no mirror-back
    void kernel.editBuffer(binding.ref ?? "", value);
  };

  const onSave = () => {
    if (!binding.ref || bufferRef.current?.dirty || bufferRef.current?.conflict) {
      void kernel.saveSource(binding.ref ?? "");
    }
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
        <p className="source-note source-note-muted">opening {binding.ref}…</p>
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
      <div className="source-status" role="status">
        <span className="source-revision" data-revision={buffer.base_revision}>
          canonical {shortRevision(buffer.base_revision)}
        </span>
        {buffer.dirty ? (
          <span className="source-dirty-marker" title="The buffer differs from the canonical layer">
            edited — unsaved
          </span>
        ) : (
          <span className="source-clean-marker">clean</span>
        )}
        <span className="source-hint">⌘S save</span>
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
  );
}
