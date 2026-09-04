import React, { useEffect, useState } from 'react';
import './world-tree.css';
import { NativeDocumentEditor } from './native-document-editor';
import {
  buildSubjectModel,
  conflictFromFailure,
  failureReason,
  projectNodeForSource,
  type SubjectReading,
  type TreeFocus,
  type TreeSubjectRef,
  type WorldTreeReading,
} from './world-tree-model.mjs';

export type SubjectSaveState = {
  busy?: boolean;
  /** The owner's write report on success (`source_ref`, `revision`, `changed`). */
  report?: { source_ref?: string; revision?: string | number; changed?: boolean } | null;
  /** The structured write failure (`reason`, `source_ref`, revisions, `detail`). */
  failure?: {
    reason?: string;
    source_ref?: string;
    expected_revision?: string;
    current_revision?: string;
    detail?: string;
  } | null;
};

/**
 * One opened subject (01 §2): a World/Project node, or a World source.
 *
 * Identity (World / Project) sits quietly beside the title (01 §4). Content is
 * edited only through the owner's document, saved through `save_subject`, and a
 * refused save is disclosed from its structured failure — never by parsing
 * prose (K2 fix F-M4).
 */
export function WorldSubjectSurface({
  reading,
  focus,
  treeReading,
  saveState,
  onSave,
  onReread,
  onOpenSubject,
}: {
  reading?: SubjectReading | null;
  focus?: TreeFocus;
  treeReading?: WorldTreeReading | null;
  saveState?: SubjectSaveState;
  onSave: (subject: TreeSubjectRef, sourceRef: string | null, expectedRevision: string | number | null, content: string) => void;
  onReread: (subject: TreeSubjectRef) => void;
  onOpenSubject: (subject: TreeSubjectRef) => void;
}) {
  const model = buildSubjectModel(reading ?? undefined);
  const [draft, setDraft] = useState<string | null>(null);

  // The draft tracks the owner's content, not the other way round: a re-read
  // replaces the draft unless the person has already edited it.
  useEffect(() => {
    setDraft(null);
  }, [reading]);

  if (!model) {
    return (
      <div className="oi-world-subject oi-world-subject--empty">
        <p>No subject reading. Open a node in the World tree — the subject is what the owner served, not what a surface assumes.</p>
      </div>
    );
  }

  const worldRef = focus?.world?.ref ?? null;
  const projectRef = focus?.project?.ref ?? null;
  // The subject ref the callbacks hand back is the one the kernel served,
  // provenance and all; only a reading that somehow arrived without one falls
  // back to naming the reading it came from.
  const subjectRef: TreeSubjectRef | null = model.subject ? {
    ref: model.subject.ref,
    kind: model.subject.kind,
    native_owner: model.subject.native_owner,
    provenance: model.subject.provenance ?? { source: 'oi.subject-reading/v1' },
  } : null;
  const editing = model.source != null && model.content != null && subjectRef != null;
  const dirty = draft != null && draft !== model.content;
  const conflict = conflictFromFailure(saveState?.failure ?? null);
  const refusal = !conflict ? failureReason(saveState?.failure ?? null) : null;

  // Cold host (K2 review): a bare source open on a cold host cannot bind the
  // Project relation, so the owner serves nothing. The disclosure is the
  // structured fact — an unobserved reading carrying no content — and the
  // project node to open first comes from walking the composed Projection,
  // never from parsing the ref.
  const unserved = model.content == null && model.provider.class === 'unobserved' && model.subject != null;
  const projectAdvice = unserved && model.subject ? projectNodeForSource(treeReading ?? undefined, model.subject.ref) : null;

  return (
    <article className="oi-world-subject">
      <header className="oi-world-subject__head">
        <h2 className="oi-world-subject__title">{model.subject?.ref ?? model.source?.ref ?? 'Subject'}</h2>
        {/* The identity line (01 §4): World/Project identity quietly beside the title. */}
        <p className="oi-world-subject__identity">
          {worldRef && <span data-identity="world">{worldRef}</span>}
          {projectRef && <span data-identity="project">{projectRef}</span>}
          <span className="oi-world-subject__provider" data-provider={model.provider.class}>{model.provider.class}</span>
        </p>
        {model.access_facts.length > 0 && <p className="oi-world-subject__facts">{model.access_facts.join(' · ')}</p>}
        {model.warnings.length > 0 && (
          <details className="oi-world-subject__warnings">
            <summary>{model.warnings.length} warning{model.warnings.length === 1 ? '' : 's'}</summary>
            <ul>{model.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          </details>
        )}
      </header>

      {model.source && (
        <p className="oi-world-subject__source">
          <span>{model.source.ref}</span>
          <span className="oi-world-subject__treatment">{model.source.treatment}</span>
          {model.revision != null && <code>rev {String(model.revision)}</code>}
        </p>
      )}

      {conflict && (
        <div className="oi-world-subject__conflict" role="alert">
          <strong>Save refused — the source changed under this draft</strong>
          <dl>
            <dt>source</dt><dd><code>{conflict.source_ref}</code></dd>
            <dt>this draft holds</dt><dd><code>{conflict.expected_revision}</code></dd>
            <dt>the owner holds</dt><dd><code>{conflict.current_revision}</code></dd>
          </dl>
          <button type="button" onClick={() => subjectRef && onReread(subjectRef)}>Re-read the source</button>
        </div>
      )}

      {refusal && typeof refusal === 'object' && (
        <div className="oi-world-subject__refusal" role="alert">
          <strong>Save refused — {refusal.reason}</strong>
          {refusal.detail && <p>{refusal.detail}</p>}
        </div>
      )}

      {unserved && (
        <div className="oi-world-subject__advice" data-served={false}>
          <p>{model.provider.detail ? String(model.provider.detail) : 'The owner did not serve this subject.'}</p>
          {projectAdvice && (
            <button type="button" onClick={() => onOpenSubject({
              ref: projectAdvice.ref,
              kind: projectAdvice.kind,
              native_owner: projectAdvice.native_owner,
              provenance: projectAdvice.provenance ?? { source: 'oi.world-tree/v1' },
            })}>Open {projectAdvice.ref} first</button>
          )}
        </div>
      )}

      {editing && subjectRef ? (
        <div className="oi-world-subject__editor">
          <NativeDocumentEditor
            value={draft ?? model.content ?? ''}
            onChange={setDraft}
            ariaLabel={`${model.source?.ref ?? 'source'} document`}
          />
          <div className="oi-world-subject__actions">
            <button
              type="button"
              disabled={!dirty || saveState?.busy}
              onClick={() => onSave(subjectRef, model.source?.ref ?? null, model.revision, draft ?? model.content ?? '')}
            >{saveState?.busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => subjectRef && onReread(subjectRef)}>Re-read</button>
            {saveState?.report && (
              <span className="oi-world-subject__saved" data-changed={saveState.report.changed}>
                saved{saveState.report.revision != null ? ` · rev ${String(saveState.report.revision)}` : ''}
              </span>
            )}
          </div>
        </div>
      ) : !unserved && (
        <div className="oi-world-subject__body">
          {model.content != null
            ? <pre>{model.content}</pre>
            : (
              <p className="oi-world-subject__node">
                A World/Project node — no owner source read was made. Its ground{model.subject?.native_owner ? ` (${model.subject.native_owner})` : ''} and Wiki presence are in the tree; open a source under it to read the document.
              </p>
            )}
          {model.source && subjectRef && (
            <button type="button" onClick={() => onReread(subjectRef)}>Re-read</button>
          )}
        </div>
      )}
    </article>
  );
}
