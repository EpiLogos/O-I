import {useState} from 'react'
import {plainReason} from '../../../../../desktop/cradle/src/shared/Refusal.tsx'
import {agentDataI} from './agentFidelity'
import './agentShell.css'

/**
 * The disclosure card: the mockup's refusing grammar — named, one styled
 * line, the raw receipt folded in a <details>, dismissible. Every place the
 * shell used to dump raw JSON into a panel renders through this (or through
 * ReadingCard below) instead. The refusal is never swallowed: the named
 * owner error stays readable, in place, until dismissed.
 */
export function RefusalCard({title, line, receipt, onDismiss, dataI}: {
  title: string
  line: string
  /** The verbatim receipt (raw JSON / error text) — folded, never the surface. */
  receipt?: string | null
  onDismiss?: () => void
  dataI?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="agent-refusal" data-i={dataI} role="note" data-refusal={title}>
      <div className="agent-refusal-row">
        <b>{title}</b>
        <span className="line">{line}</span>
        {onDismiss && (
          <button type="button" className="dismiss" aria-label={`Dismiss ${title}`} onClick={onDismiss}>✕</button>
        )}
      </div>
      {receipt != null && receipt.trim() !== '' && (
        <details open={open} onToggle={event => setOpen((event.target as HTMLDetailsElement).open)}>
          <summary>{open ? 'Receipt' : 'Receipt (folded)'}</summary>
          <pre>{receipt}</pre>
        </details>
      )}
    </section>
  )
}

/** The reading card: an answered owner reading, rendered as named rows —
 * scalar fields one level deep as kv rows, the full document folded as the
 * receipt. Never a raw JSON dump as the surface. */
export function ReadingCard({title, line, document, dataI}: {
  title: string
  line: string
  document: unknown
  dataI?: string
}) {
  const rows = scalarEntries(document)
  return (
    <section className="agent-refusal answered" data-i={dataI} role="note" data-reading={title}
      style={{borderColor: 'var(--line-strong)', background: 'var(--bg-2)'}}>
      <div className="agent-refusal-row">
        <b style={{color: 'var(--text)'}}>{title}</b>
        <span className="line">{line}</span>
      </div>
      {rows.length > 0 && (
        <div style={{marginTop: 4}}>
          {rows.map(([key, value]) => (
            <div className="agent-kv" key={key} style={{padding: '1px 0'}}>
              <span>{key}</span>
              <span>{String(value)}</span>
            </div>
          ))}
        </div>
      )}
      {document != null && (
        <details>
          <summary>Receipt</summary>
          <pre>{safeJson(document)}</pre>
        </details>
      )}
    </section>
  )
}

/** Scalar entries one level deep — the honest kv surface of a reading. */
export function scalarEntries(document: unknown): [string, string | number | boolean][] {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return []
  const rows: [string, string | number | boolean][] = []
  for (const [key, value] of Object.entries(document as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      rows.push([key, value])
    } else if (isPlainRecord(value)) {
      for (const [inner, iv] of Object.entries(value)) {
        if (typeof iv === 'string' || typeof iv === 'number' || typeof iv === 'boolean') {
          rows.push([`${key}.${inner}`, iv])
        }
      }
    }
  }
  return rows.slice(0, 8)
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export function safeJson(value: unknown): string {
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

/** A named summary line for a refused outcome: the owner's reason in plain words, read by the product's one refusal reader
 * (desktop/cradle/src/shared/Refusal.tsx `plainReason`: a JSON refusal is read for its message, a thrown-error prefix, a
 * path, a dump or an owner code never reaches the line), else the place's own fallback. */
export function refusalLine(error: string | null | undefined, fallback: string): string {
  return plainReason(error) ?? fallback
}

export {agentDataI}
