/**
 * The shared pieces every Settings section is built from (12-SETTINGS §2):
 * a row (title, description, the value or control on the right, the
 * "changed" mark and Undo), a read-only value (lock + the owning place +
 * Open file — never a disabled control), the one-sentence missing
 * operation, the section states (Reading / Couldn't load + Retry), and cards.
 */
import type {ReactNode} from "react";
import {expect, plain} from "./settingsData";
import {useState} from "react";

export function Row({id, title, description, changed, onUndo, children, className}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  changed?: boolean;
  onUndo?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return <div className={`settings-line${changed ? " is-changed" : ""}${className ? ` ${className}` : ""}`} data-settings-row={id} data-changed={changed ? "true" : undefined}>
    <div className="settings-line-text">
      <div className="settings-line-title">{title}</div>
      {description && <div className="settings-line-desc">{description}</div>}
    </div>
    <div className="settings-line-value">
      {children}
      {changed && onUndo && <button type="button" className="settings-undo" onClick={onUndo}>Undo</button>}
    </div>
  </div>;
}

export function Lock() {
  return <svg className="settings-lock" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11V8a3.5 3.5 0 017 0v3"/></svg>;
}

/** A value the page cannot change: the value, a lock, and the place that
 * owns it (S11). "Open file" reveals the owner's own file when one exists. */
export function ReadOnly({value, place, path}: {value?: ReactNode; place: string; path?: string | null}) {
  const [note, setNote] = useState<string | null>(null);
  return <span className="settings-readonly" data-settings-readonly>
    <Lock/>
    {value !== undefined && value !== null && <span className="settings-readonly-value">{value}</span>}
    {value !== undefined && value !== null && <span aria-hidden="true">·</span>}
    <span className="settings-readonly-place">{place}</span>
    {path && <button type="button" className="settings-link" data-settings-open-file={path} title={path}
      onClick={() => {
        setNote(null);
        void expect({op: "settings_reveal", path}, "settings_revealed").catch((cause) => setNote(plain(cause)));
      }}>Open file</button>}
    {note && <span className="settings-inline-error" role="alert">{note}</span>}
  </span>;
}

/** A native operation that does not exist: one plain sentence (S15). */
export function Missing({children}: {children: ReactNode}) {
  return <p className="settings-missing" data-settings-missing>{children}</p>;
}

export function Reading({label = "Reading settings…"}: {label?: string}) {
  return <div className="settings-reading" role="status" aria-live="polite" data-settings-reading>
    <p>{label}</p>
    <div className="settings-skeleton" aria-hidden="true"><span/><span/><span/></div>
  </div>;
}

export function Unreadable({error, onRetry}: {error: string; onRetry: () => void}) {
  return <div className="settings-unreadable" role="alert" data-settings-unreadable>
    <p><strong>Couldn't load these settings.</strong> <span className="settings-unreadable-reason">{error}</span></p>
    <button type="button" className="settings-button" onClick={onRetry}>Retry</button>
  </div>;
}

export function Card({title, children, id, className}: {title: ReactNode; children?: ReactNode; id?: string; className?: string}) {
  return <section className={`settings-card${className ? ` ${className}` : ""}`} data-settings-card={id} data-settings-row={id ? `card:${id}` : undefined}>
    <h3>{title}</h3>
    {children}
  </section>;
}

export function Group({title, count, children, collapsible, defaultOpen = true, id, summary}: {title: string; count?: number; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean; id?: string; summary?: ReactNode}) {
  const [open, setOpen] = useState(defaultOpen);
  const label = `${title}${count !== undefined ? ` · ${count}` : ""}`;
  if (!collapsible) return <section className="settings-group-block" data-settings-group={id}><h3 className="settings-eyebrow">{label}</h3>{children}</section>;
  return <section className="settings-group-block" data-settings-group={id} data-open={open ? "true" : "false"}>
    <button type="button" className="settings-eyebrow settings-eyebrow-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="settings-caret" aria-hidden="true">›</span>{label}
    </button>
    {open ? children : summary}
  </section>;
}
