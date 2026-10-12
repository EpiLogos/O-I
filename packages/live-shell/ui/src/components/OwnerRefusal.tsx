import {refusalLine} from '../agent/RefusalCard'

/**
 * The owner-refusal disclosure (P0-R5 B): who refused, which boundary
 * operation was asked, the owner's own words, and a remedy only where the owner
 * names one. A refusal is never a JSON dump: no receipt is rendered here, and
 * a refusal mutates nothing. refusalLine reads a JSON refusal's message (or
 * kind) and cuts a mid-text JSON dump, so raw owner JSON never reaches the
 * panel as the surface.
 */
export function OwnerRefusal({owner, operation, error, fallback, remedy, copy, dataI}: {
  /** The native owner that refused, named as the owner names itself. */
  owner: string
  /** The boundary operation that was asked, in plain words. */
  operation: string
  /** The owner's words, verbatim or as a JSON refusal. */
  error?: string | null
  /** Shown only when the owner returned no words at all. */
  fallback: string
  /** Stated only when the owner itself names a remedy. */
  remedy?: string | null
  /** The retained copy reference, when the owner kept one. */
  copy?: string | null
  dataI?: string
}) {
  return (
    <section className="agent-refusal owner-refusal" role="alert" data-i={dataI} data-owner-refusal={owner}>
      <div className="agent-refusal-row">
        <b>{owner}</b>
        <span className="line">{refusalLine(error, fallback)}</span>
      </div>
      <p className="owner-note">{operation}{remedy ? ` · Remedy: ${remedy}` : ''}</p>
      {copy ? <p className="owner-note">Retained copy <code>{copy}</code></p> : null}
    </section>
  )
}
