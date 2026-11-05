// The instrument's Presets (T-LIVE-TORUS-INSTRUMENT leg 6; the browser's Presets category). A preset is the owner's performance basis
// (PerformanceBasis, oi.expression-performance-basis/v1) on the presented Scene. Every action goes to the owner through the host
// (host.performance): the owner reads the Scene's bases with the kernel's own inspect, refuses a save by name where the native readings or the
// name are absent, and answers a recall with the instrument edits the basis can express. Recall applies those edits through the instrument
// command (torusInstrument.ts commitLiveInstrumentEdit), and names what it cannot apply. Nothing is stored in the shell or the browser.

import {useEffect, useState} from 'react'
import {registerPanel} from '../shell/panels'
import type {InstrumentEdit, PerformanceAction, PerformanceBasisSummary, PerformanceReply, StageCommand, StageResult, StageSoundMove, StageTorusCheckpoint,
  StageTorusSound, TorusKeptSummary, TorusRackDraft, TorusTakeRecordEdit} from '@epilogos/expressions-boundary'
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
  if (row?.state === 'instrument-kept' && typeof row.instrument_ref === 'string' && typeof row.name === 'string' && typeof row.sounds === 'number'
    && typeof row.unsaved === 'boolean') return reply as PerformanceReply
  if (row?.state === 'rack-kept' && typeof row.rack_ref === 'string' && typeof row.name === 'string' && typeof row.macros === 'number'
    && typeof row.variations === 'number' && typeof row.unsaved === 'boolean') return reply as PerformanceReply
  if (row?.state === 'take-recorded' && typeof row.take_ref === 'string' && typeof row.lane_ref === 'string' && typeof row.at_sample === 'string'
    && typeof row.unsaved === 'boolean') return reply as PerformanceReply
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
 * (the stage's `torus-sound` save), then the Scene keeps it (the performance's keep-sound). Settles with the words, the sound kept and
 * whether it rings on a form's body (as the kernel sealed it: an instrument is kept from such a sound), or the owner's refusal. */
export async function saveTorusSound(name: string, owners: LiveSoundOwners = SOUND_OWNERS): Promise<{ok: true; words: string; sound_ref: string; form: boolean} | {ok: false; error: string}> {
  const named = name.trim()
  if (!named) return {ok: false, error: 'Name the sound first: the browser lists it by its name.'}
  const sealed = await owners.stage({command: 'torus-sound', action: 'save', name: named})
  if (!sealed.ok) return {ok: false, error: sealed.error}
  if (!sealed.sound) return {ok: false, error: 'The owner answered the save with no sound'}
  const kept = await owners.perform({action: 'keep-sound', sound: sealed.sound})
  if (kept.state === 'refused') return {ok: false, error: kept.reason}
  if (kept.state !== 'kept') return {ok: false, error: 'The Scene answered the keep in another shape'}
  for (const listener of [...keptListeners]) listener(kept.kept)
  const body = sealed.sound.body as {kind?: unknown} | undefined
  return {ok: true, words: `Saved "${kept.name}" under the Torus.${kept.unsaved ? UNTIL_SAVED : ''}`, sound_ref: kept.sound_ref, form: body?.kind === 'form'}
}
const UNTIL_SAVED = ' The Scene keeps it until the Expression is saved, then the file does.'
/** The kernel's refusal of a seal by a checkpoint name it does not know (kernel expression_performance/torus.rs TakeWitness::seal). */
const UNKNOWN_CHECKPOINT = /No Torus checkpoint \S+ was given under this lease/

/** Lay a Live take under the Expression's scene (O-I #855, "A Live part placed under an Expression's scenes sounds on its ruler"), once it
 * was rendered through the relay: the kernel seals what the Torus's owner was sent from the checkpoint the take BEGAN at, by the name the
 * kernel relayed that checkpoint under (the stage's `torus-take` seal; the `torus` checkpoint a take begins at answers with it), the record
 * is built from the seal (liveTake.ts torusTakeRecord, loaded when asked), and the Scene lays it by one edit of its performance (the
 * performance's `record-take`, the kernel's `record_torus_take`). Where the kernel no longer knows that name (after a restart) it refuses the
 * seal in its words; given the checkpoint the take's course keeps (`checkpoint`), the seal is asked once more from the checkpoint itself,
 * which the kernel names (native_expression.rs TorusTake), and a second refusal stands. A take whose checkpoint the kernel relayed under no
 * name is sealed from that checkpoint at once (BB round 21). Settles with the words, or the owner's refusal. */
export async function layTorusTake(input: {readonly checkpoint_sha256?: string; readonly checkpoint?: StageTorusCheckpoint;
  readonly take: {readonly id: number; readonly name: string; readonly beat: number; readonly bpm: number}},
  owners: LiveSoundOwners = SOUND_OWNERS): Promise<{ok: true; words: string} | {ok: false; error: string}> {
  const {checkpoint_sha256: named, checkpoint} = input
  // by the name the kernel relayed the checkpoint under; where it relayed it under none, by the checkpoint itself at once (BB round 21)
  if (!named && !checkpoint) return {ok: false, error: 'The take keeps no checkpoint it began at, under a name or itself, so nothing seals it'}
  let sealed = await owners.stage(named ? {command: 'torus-take', action: 'seal', checkpoint_sha256: named} : {command: 'torus-take', action: 'seal', checkpoint: checkpoint!})
  if (!sealed.ok && named && checkpoint && UNKNOWN_CHECKPOINT.test(sealed.error)) sealed = await owners.stage({command: 'torus-take', action: 'seal', checkpoint})
  if (!sealed.ok) return {ok: false, error: sealed.error}
  if (!sealed.take) return {ok: false, error: 'The owner answered the seal with no take'}
  const {torusTakeRecord} = await import('./liveTake')
  const record = torusTakeRecord(sealed.take, input.take)
  if ('refused' in record) return {ok: false, error: record.refused}
  // the record is the builder's, read exactly by the boundary (performanceBasis.ts readTakeRecord) before the kernel is asked
  const laid = await owners.perform({action: 'record-take', record: record as unknown as TorusTakeRecordEdit})
  if (laid.state === 'refused') return {ok: false, error: laid.reason}
  if (laid.state !== 'take-recorded') return {ok: false, error: 'The Scene answered the take in another shape'}
  const title = input.take.name || `Take ${input.take.id}`
  return {ok: true, words: `${title} lies under the scene on its take lane, from sample ${laid.at_sample}.${laid.unsaved ? UNTIL_SAVED : ''}`}
}

/** Keep the form's body the kept sound `soundRef` rings on as an instrument named `name` (O-I #852, manual §21.2 Sounds and instruments;
 * Tips: "make a form the body, make sounds on it, and keep it"): the Scene keeps the body with every sound made on it (the performance's
 * keep-instrument), and it stands under the Torus with its sounds under it. Settles with the words, or the owner's refusal. */
export async function keepTorusInstrument(name: string, soundRef: string, owners: LiveSoundOwners = SOUND_OWNERS): Promise<{ok: true; words: string} | {ok: false; error: string}> {
  const named = name.trim()
  if (!named) return {ok: false, error: 'Name the instrument first: the browser lists it by its name.'}
  const kept = await owners.perform({action: 'keep-instrument', name: named, sound_ref: soundRef})
  if (kept.state === 'refused') return {ok: false, error: kept.reason}
  if (kept.state !== 'instrument-kept') return {ok: false, error: 'The Scene answered the keep in another shape'}
  for (const listener of [...keptListeners]) listener(kept.kept)
  const made = kept.sounds === 1 ? 'the sound' : `the ${kept.sounds} sounds`
  return {ok: true, words: `Kept "${kept.name}" under the Torus: its body, with ${made} made on it.${kept.unsaved ? UNTIL_SAVED : ''}`}
}

const counted = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
/** Keep the rack the Torus's rack face holds under `name` (DLW build ruling, 4 November; manual §21.2 Sounds and instruments: "A rack | The
 * Torus with its note devices and effects, its macros and their variations"): the Torus as it rings is saved as the sound the rack opens
 * with (saveTorusSound, under the rack's name), then the Scene keeps the rack, its chain, its macros each with its range, and its
 * variations (the performance's keep-rack); it stands in the browser as a rack, and its drop places it on a part. Settles with the words,
 * or the owners' refusal; a Torus that could not be saved keeps no rack. */
export async function keepTorusRack(name: string, face: Omit<TorusRackDraft, 'sound'>, owners: LiveSoundOwners = SOUND_OWNERS): Promise<{ok: true; words: string} | {ok: false; error: string}> {
  const named = name.trim()
  if (!named) return {ok: false, error: 'Name the rack first: the browser lists it by its name.'}
  const saved = await saveTorusSound(named, owners)
  if (!saved.ok) return saved
  const kept = await owners.perform({action: 'keep-rack', name: named, rack: {sound: saved.sound_ref, ...face}})
  if (kept.state === 'refused') return {ok: false, error: kept.reason}
  if (kept.state !== 'rack-kept') return {ok: false, error: 'The Scene answered the keep in another shape'}
  for (const listener of [...keptListeners]) listener(kept.kept)
  const notes = face.chain.filter(device => device.role === 'note').length, effects = face.chain.length - notes
  const chain = face.chain.length ? `${[notes ? counted(notes, 'note device') : '', effects ? counted(effects, 'effect') : ''].filter(Boolean).join(' and ')} on its chain` : 'nothing else on its chain'
  return {ok: true, words: `Kept "${kept.name}" in the browser as a rack: the Torus as it rings, ${chain}, ${counted(kept.macros, 'macro')} and ${counted(kept.variations, 'variation')}.${kept.unsaved ? UNTIL_SAVED : ''}`}
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
