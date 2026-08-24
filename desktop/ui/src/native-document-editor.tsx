import React from 'react';

export type NativeDocumentEditorProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  readOnly?: boolean;
  className?: string;
};

/**
 * Generic primary-Canvas text Surface for an already-resolved native document.
 *
 * This component owns only the editable presentation buffer. Source identity,
 * current revision, write authority, save/conflict semantics and history stay in
 * the native owner/application that supplies `value` and receives `onChange`.
 * Flow is its first revision-safe writable consumer; ordinary source documents
 * can use the same Surface when their native owner exposes an equivalent write
 * contract.
 */
export function NativeDocumentEditor({
  value,
  onChange,
  ariaLabel,
  readOnly = false,
  className = '',
}: NativeDocumentEditorProps) {
  return <textarea
    className={className}
    aria-label={ariaLabel}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    readOnly={readOnly}
    placeholder=""
    spellCheck
  />;
}
