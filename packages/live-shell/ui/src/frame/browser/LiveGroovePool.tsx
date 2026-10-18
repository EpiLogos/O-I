// The pool's other face in Live (manual §16.7: "In Live a switch at the pool's head shows the set's grooves instead, as Live's pool
// does … Groove, Base, Quantize, Timing, Random and Velocity for each of the set's grooves, Global Amount at the foot"). Every value
// is the set's, read through its owner (live/liveGrooves.ts: kernel live_groove_pool_read) and written into it on the set's standing
// revision (live_groove_pool_write); a refusal stands under the table in the owner's words, and the set is read again either way.
// The face holds no groove of its own: a number is written when the hand lets go of it (Enter, or leaving the field).
import {useState, type KeyboardEvent} from 'react'
import {GROOVE_BASES, useLiveGrooves, writeLiveGlobalGroove, writeLiveGroove, type LiveGroove, type LiveGrooveField} from '../../live/liveGrooves'

const AMOUNTS: readonly {field: Exclude<LiveGrooveField, 'base'>; label: string; does: string}[] = [
  {field: 'quantize', label: 'Quantize', does: 'How far the notes are moved onto the groove\'s base grid before the groove applies.'},
  {field: 'timing', label: 'Timing', does: 'How far the groove\'s timing moves the notes.'},
  {field: 'random', label: 'Random', does: 'How much random timing the groove adds.'},
  {field: 'velocity', label: 'Velocity', does: 'How far the groove\'s accents set the notes\' velocities.'},
]

/** A number field that writes when the hand lets go of it; the owner's reading stands in it otherwise. */
function Amount({value, min, max, label, write}: {value: number | null; min: number; max: number; label: string; write: (value: number) => void}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value === null ? '' : String(Math.round(value)))
  const commit = () => {
    if (draft === null) return
    const next = Number(draft)
    setDraft(null)
    if (draft.trim() !== '' && Number.isFinite(next) && next !== value) write(Math.min(max, Math.max(min, next)))
  }
  const key = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); commit() }
    if (event.key === 'Escape') setDraft(null)
  }
  return <input type="number" aria-label={label} min={min} max={max} value={shown} placeholder={value === null ? '—' : undefined}
    onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={key} />
}

export function LiveGroovePool({path}: {path: string | null}) {
  const {pool, error} = useLiveGrooves(path)
  const [fault, setFault] = useState<string | null>(null)
  const run = (write: () => Promise<unknown>) => { setFault(null); void write().catch((cause: unknown) => setFault(cause instanceof Error ? cause.message : String(cause))) }
  if (!path) return <p className="groove-pool-empty">Open a set: its grooves are the set's own.</p>
  if (error) return <p className="groove-pool-fault" role="status">The set's owner did not read its grooves: {error}</p>
  if (!pool) return <p className="groove-pool-empty" role="status">Reading the set's grooves…</p>
  const range = pool.amountRange ?? {min: 0, max: 131.25}
  const row = (groove: LiveGroove, index: number) => <li key={`${groove.id ?? 'g'}-${index}`} className="groove-pool-row" data-groove={index}>
    <span title={groove.name}>{groove.name}</span>
    <select aria-label={`Base of ${groove.name}`} value={groove.base ?? ''} onChange={event => run(() => writeLiveGroove(path, index, 'base', event.target.value))}>
      {groove.base === null && <option value="">—</option>}
      {GROOVE_BASES.map(base => <option key={base} value={base}>{base}</option>)}
    </select>
    {AMOUNTS.map(amount => <Amount key={amount.field} label={`${amount.label} of ${groove.name}`} value={groove[amount.field]} min={0} max={100}
      write={value => run(() => writeLiveGroove(path, index, amount.field, value))} />)}
  </li>
  return <div className="groove-pool" aria-label="The set's grooves">
    <div className="groove-pool-columns" aria-hidden="true">
      <span>Groove</span><span>Base</span>{AMOUNTS.map(amount => <span key={amount.field} title={amount.does}>{amount.label.slice(0, 5)}</span>)}
    </div>
    {pool.grooves.length
      ? <ul className="groove-pool-rows">{pool.grooves.map(row)}</ul>
      : <p className="groove-pool-empty">The set's pool holds no grooves: drag one from the browser's Grooves onto a clip and Live keeps it here.</p>}
    <div className="groove-pool-footer">
      <span>Global Amount</span>
      <Amount label="Global Amount" value={pool.amount} min={range.min} max={range.max} write={value => run(() => writeLiveGlobalGroove(path, value))} />
      <span>%</span>
    </div>
    {fault && <p className="groove-pool-fault" role="status">{fault}</p>}
  </div>
}
