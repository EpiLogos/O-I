// The instrument's Presets (T-LIVE-TORUS-INSTRUMENT leg 6; the browser's Presets category). A preset is the owner's performance basis
// (PerformanceBasis, oi.expression-performance-basis/v1) on the presented Scene. Every action goes to the owner through the host
// (host.performance): the owner reads the Scene's bases with the kernel's own inspect, refuses a save by name where the native readings or the
// name are absent, and answers a recall with the instrument edits the basis can express. Recall applies those edits through the instrument
// command (torusInstrument.ts commitLiveInstrumentEdit), and names what it cannot apply. Nothing is stored in the shell or the browser.

import {useEffect, useState} from 'react'
import {registerPanel} from '../shell/panels'
import type {InstrumentEdit, PerformanceAction, PerformanceBasisSummary, PerformanceReply} from '@epilogos/expressions-boundary'
import {commitLiveInstrumentEdit} from './torusInstrument'
import './liveInstrumentSection.css'

export type LivePerformanceChannel = (action: PerformanceAction) => Promise<unknown>
let performanceChannel: LivePerformanceChannel | null = null

/** Register (or, with null, withdraw) the mounted host's performance channel. */
export function setLivePerformanceChannel(next: LivePerformanceChannel | null): void {
  performanceChannel = next
}

const REFUSED = (reason: string): PerformanceReply => ({state: 'refused', reason, missing: []})

/** One performance action through the owner. Settles with the owner's reply, or a refusal naming why it did not reach the owner. */
export async function commitLivePerformance(action: PerformanceAction): Promise<PerformanceReply> {
  if (performanceChannel === null) return REFUSED('No Expressions application is mounted for the presets')
  let reply: unknown
  try { reply = await performanceChannel(action) }
  catch (cause) { return REFUSED(cause instanceof Error ? cause.message : String(cause)) }
  const row = typeof reply === 'object' && reply !== null ? reply as Record<string, unknown> : null
  if (row?.state === 'listed' && Array.isArray(row.bases)) return reply as PerformanceReply
  if (row?.state === 'refused' && typeof row.reason === 'string') return reply as PerformanceReply
  if (row?.state === 'recalled' && Array.isArray(row.edits) && Array.isArray(row.not_applied)) return reply as PerformanceReply
  return REFUSED('The owner answered the preset request in an unknown shape')
}

export interface PresetRecallOutcome {
  readonly applied: number
  readonly refused: readonly {readonly edit: InstrumentEdit; readonly error: string}[]
  readonly notApplied: readonly {readonly field: string; readonly reason: string}[]
}

/** Apply a recalled basis's edits through the instrument command, one at a time, in the owner's order. A refused edit is named, never skipped silently. */
export async function applyPresetRecall(
  reply: Extract<PerformanceReply, {state: 'recalled'}>,
  apply: (edit: InstrumentEdit) => Promise<{ok: boolean; error?: string}> = edit => commitLiveInstrumentEdit(edit),
): Promise<PresetRecallOutcome> {
  let applied = 0
  const refused: {edit: InstrumentEdit; error: string}[] = []
  for (const edit of reply.edits) {
    const result = await apply(edit)
    if (result.ok) applied += 1
    else refused.push({edit, error: result.error ?? 'refused'})
  }
  return {applied, refused, notApplied: reply.not_applied}
}

function describe(outcome: PresetRecallOutcome): string {
  const parts = [`Recalled: ${outcome.applied} applied`]
  if (outcome.refused.length) parts.push(`refused by the owner: ${outcome.refused.map(row => row.error).join('; ')}`)
  if (outcome.notApplied.length) parts.push(`not applied: ${outcome.notApplied.map(row => `${row.field} (${row.reason})`).join('; ')}`)
  return parts.join('. ')
}

export function LivePresetsSection() {
  const [bases, setBases] = useState<readonly PerformanceBasisSummary[] | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const refresh = async () => {
    const reply = await commitLivePerformance({action: 'list'})
    if (reply.state === 'listed') setBases(reply.bases)
    else { setBases([]); setRefusal(reply.state === 'refused' ? reply.reason : null) }
  }
  useEffect(() => { void refresh() }, [])
  const recall = async (basis: PerformanceBasisSummary) => {
    setStatus(null); setRefusal(null)
    const reply = await commitLivePerformance({action: 'recall', basis_ref: basis.basis_ref})
    if (reply.state === 'refused') { setRefusal(reply.reason); return }
    if (reply.state !== 'recalled') { setRefusal('The owner did not recall this basis'); return }
    setStatus(describe(await applyPresetRecall(reply)))
  }
  return (
    <section className="live-presets" aria-label="Presets" data-live-presets={bases === null ? 'listing' : bases.length ? 'listed' : 'empty'}>
      <h4>Presets</h4>
      {bases === null && <p className="live-presets-note">Listing the presets of the presented Scene…</p>}
      {bases !== null && bases.length === 0 && <p className="live-presets-note">No presets are saved on this Scene.</p>}
      {bases !== null && bases.length > 0 && (
        <ul className="live-presets-list" aria-label="Saved presets">
          {bases.map(basis => (
            <li key={basis.basis_ref} className="live-presets-row" data-preset={basis.basis_ref}>
              <span title={basis.basis_ref}>{basis.event_ref} · {basis.m1_coordinate}</span>
              <button type="button" onClick={() => void recall(basis)}>Recall</button>
            </li>
          ))}
        </ul>
      )}
      {/* No Save control is offered while saving cannot succeed: a basis needs the native performance readings (M2 plan, audio
          determination, M3 score and replay, prepared body, tuning, force and form state), which no producer serves yet. The
          route (host.performance 'save') stands ready; the owner refuses it by name today. */}
      <p className="live-presets-note" data-live-presets-save="waiting">Saving a preset waits on the instrument's native performance readings (its M2 plan, audio determination, M3 score and replay, prepared body, tuning, force and form state), which nothing produces yet.</p>
      {status !== null && <p className="live-presets-note" role="status" data-live-presets-status>{status}</p>}
      {refusal !== null && <p className="live-presets-note is-refused" role="alert" data-live-presets-refusal>{refusal}</p>}
    </section>
  )
}

registerPanel({
  id: 'Presets',
  title: 'Presets',
  slot: 'browser-section',
  component: LivePresetsSection,
  order: 4,
  navigation: false,
  note: "The instrument's saved states: the presented Scene's performance bases, saved and recalled through the owner.",
})
