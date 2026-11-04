// The instrument's Presets (T-LIVE-TORUS-INSTRUMENT leg 6; the browser's Presets category). A preset is the owner's performance basis
// (PerformanceBasis, oi.expression-performance-basis/v1) on the presented Scene. Every action goes to the owner through the host
// (host.performance): the owner reads the Scene's bases with the kernel's own inspect, refuses a save by name where the native readings or the
// name are absent, and answers a recall with the instrument edits the basis can express. Recall applies those edits through the instrument
// command (torusInstrument.ts commitLiveInstrumentEdit), and names what it cannot apply. Nothing is stored in the shell or the browser.

import {useEffect, useState} from 'react'
import {registerPanel} from '../shell/panels'
import type {InstrumentEdit, PerformanceAction, PerformanceBasisSummary, PerformanceReply, StageCommand, StageResult, StageSoundMove, StageTorusSound,
  TorusKeptSummary} from '@epilogos/expressions-boundary'
import type {WorldActionReceipt} from '../timeline/worldTrackAdapter'
import {commitLiveInstrumentEdit, commitLiveStage} from './torusInstrument'
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
  if (row?.state === 'sound' && typeof row.sound === 'object' && row.sound !== null) return reply as PerformanceReply
  if (row?.state === 'kept' && typeof row.sound_ref === 'string' && typeof row.name === 'string' && typeof row.unsaved === 'boolean') return reply as PerformanceReply
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

// ── a sound saved and opened (O-I #852, manual §21.2 "Save the instrument as you tuned it"; "Drag it onto a part to play it") ─────────
// The Torus's sounds go through the same owners as the presets: the stage (the owner keeps a checkpoint; the kernel seals the sound from
// it, or opens a kept one against the Torus as it stands) and the Scene's performance (it keeps the sound, and gives its record back).

/** The owners a sound goes through: the frame's stage channel and the Scene's performance (by default the mounted host's). */
export interface LiveSoundOwners {
  readonly stage: (command: StageCommand) => Promise<StageResult>
  readonly perform: (action: PerformanceAction) => Promise<PerformanceReply>
}
const SOUND_OWNERS: LiveSoundOwners = {stage: command => commitLiveStage(command), perform: action => commitLivePerformance(action)}

type KeptListener = (kept: TorusKeptSummary | null) => void
const keptListeners = new Set<KeptListener>()
/** Hear what the Scene keeps on the Torus each time a sound is kept (the browser's Instruments lists it again). Returns the unsubscribe. */
export function subscribeTorusKept(listener: KeptListener): () => void {
  keptListeners.add(listener)
  return () => { keptListeners.delete(listener) }
}

/** Save the Torus as it rings as a sound the Scene keeps: the owner keeps a checkpoint and the kernel seals the sound from it by `name`
 * (the stage's `torus-sound` save), then the Scene keeps it (the performance's keep-sound). Settles with the words, or the owner's refusal. */
export async function saveTorusSound(name: string, owners: LiveSoundOwners = SOUND_OWNERS): Promise<{ok: true; words: string} | {ok: false; error: string}> {
  const named = name.trim()
  if (!named) return {ok: false, error: 'Name the sound first: the browser lists it by its name.'}
  const sealed = await owners.stage({command: 'torus-sound', action: 'save', name: named})
  if (!sealed.ok) return {ok: false, error: sealed.error}
  if (!sealed.sound) return {ok: false, error: 'The owner answered the save with no sound'}
  const kept = await owners.perform({action: 'keep-sound', sound: sealed.sound})
  if (kept.state === 'refused') return {ok: false, error: kept.reason}
  if (kept.state !== 'kept') return {ok: false, error: 'The Scene answered the keep in another shape'}
  for (const listener of [...keptListeners]) listener(kept.kept)
  return {ok: true, words: kept.unsaved ? `Saved "${kept.name}" under the Torus. The Scene keeps it until the Expression is saved, then the file does.`
    : `Saved "${kept.name}" under the Torus.`}
}

const movedWords = (name: string, moved: readonly StageSoundMove[]) => moved.length
  ? `"${name}" opens as saved. Moved since it was saved: ${moved.map(row => row.words.charAt(0).toLowerCase() + row.words.slice(1)).join('; ')}.`
  : `"${name}" opens as saved; nothing it was tuned from has moved.`

/** Open a kept sound on the Torus: the Scene's record by its ref, opened against the Torus as it stands now; the owner restores it as saved
 * (the stage's `torus-sound` open). Settles with what has moved since it was saved, in the kernel's words, or the owner's refusal. */
export async function openKeptSound(soundRef: string, owners: LiveSoundOwners = SOUND_OWNERS): Promise<{ok: true; name: string; moved: readonly StageSoundMove[]; words: string} | {ok: false; error: string}> {
  const record = await owners.perform({action: 'sound', sound_ref: soundRef})
  if (record.state === 'refused') return {ok: false, error: record.reason}
  if (record.state !== 'sound') return {ok: false, error: 'The Scene answered the sound in another shape'}
  const sound = record.sound as StageTorusSound
  const opened = await owners.stage({command: 'torus-sound', action: 'open', sound})
  if (!opened.ok) return {ok: false, error: opened.error}
  // An answer that names no sample it rang again from, or no word of what moved, opened nothing.
  if (opened.landed_at_samples_elapsed === undefined || opened.moved === undefined) return {ok: false, error: 'The frame answered the opening with no sample it rang again from: the sound was not opened'}
  const moved = opened.moved, name = String(sound.name)
  return {ok: true, name, moved, words: movedWords(name, moved)}
}

/** Play a kept sound on the part `track` of the set at `path` (manual §21.2 "Drag it onto a part to play it"): it opens on the Torus,
 * then the part keeps the Torus as it then stands (live/liveTake.ts createTorusKeeper keepOn), so the set opens with it again. */
export async function playKeptSoundOn(path: string, track: number, soundRef: string,
  owners: LiveSoundOwners & {readonly keepOn?: (path: string, track: number) => Promise<string | null>} = SOUND_OWNERS): Promise<WorldActionReceipt> {
  const opened = await openKeptSound(soundRef, owners)
  if (!opened.ok) return {ok: false, error: opened.error}
  const keepOn = owners.keepOn ?? (async (at: string, part: number) => { const {keeper} = await (await import('./liveTake')).liveRecord(); return keeper.keepOn(at, part) })
  const refused = await keepOn(path, track)
  return {ok: true, note: `${opened.words} ${refused ?? 'The part keeps it.'}`}
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
