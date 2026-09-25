import type {ReactNode} from 'react';
import {Glyph} from '../Glyph';
import './primitives.css';
/** Window functions have one entry point per container; content invokes the existing owner operations. */
export function WindowFunctionsMenu({label, children, attention = false}: {label: string; children: ReactNode; attention?: boolean}) {
  return <details className="window-functions desktop-menu" data-attention={attention} onKeyDown={event => {if (event.key === 'Escape') {event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus();}}}>
    <summary aria-label={label} title={label}><Glyph name="more" size={14}/></summary>
    <div className="oi-menu" onClick={event => {if ((event.target as HTMLElement).closest('button:not(:disabled)')) event.currentTarget.closest('details')?.removeAttribute('open');}}>{children}</div>
  </details>;
}
