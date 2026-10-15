// Live's Clip side in the shared Clip view anatomy (manual §3: "In Live it holds a clip's name and colour, when and how it
// launches, what follows it, where it starts and ends and loops, and an editor for its notes or its sound"; lock §0.2.5: "each
// clip may carry its own mode and the piano roll folds to or highlights it"; frame/detail/ClipView.tsx; the mockup's
// liveDetail() clip, world-shell-mockup.html:1761-1762). The props column reads what the set's owner discloses of the clip — its
// name, its track's colour, its start and end and length for an arrangement clip — and the mode the clip plays in; whatever
// the owner does not disclose (loop, launch, follow action, signature, groove, transpose) shows "—". The Notes column is the
// roll's frame: the twelve pitch classes marked by the mode in force, the clip's bars along it, and one line for the notes the
// owner does not disclose yet. Replaces components/DeviceChainPanel.tsx:62-63's clip side (its inspector of read-only fields and
// disabled buttons, and its empty note grid).
import type {SetDocument} from '../shell/document'
import type {SetSummary} from '../shell/useSet'
import type {SetSelection} from '../shell/liveSelection'
import {ClipNone, ClipView, ClipWaiting, type ClipRow} from '../frame/detail/ClipView'
import {clipBoxRows, useSelectedClip} from '../frame/detail/ClipBox'
import {useLiveModeInForce} from '../native/liveModeCatalogue'
import {PITCH_CLASS_NAMES, pitchMask, type ModeInForce} from './modes'
import './liveSides.css'

/** The clip THE selection names in the open set: an arrangement clip (with its own start and end) or a session slot's clip. */
export interface LiveClipReading {
  name: string
  track: string | null
  /** The clip's own kind when the document gives it; a session slot's clip is the kind of its track (a MIDI track holds MIDI clips). */
  kind: 'audio' | 'midi' | null
  /** An arrangement clip's place, in beats from the set's start. */
  at: {start: number; end: number} | null
}

export function liveClipOf(set: SetSummary | null, document: SetDocument | null, selection: SetSelection): LiveClipReading | null {
  const deep = document?.tracks[selection.track]
  const track = set?.tracks[selection.track] ?? null
  const arrangement = selection.clip === undefined ? undefined : deep?.arrangementClips[selection.clip]
  if (arrangement) return {name: arrangement.name, track: track?.name ?? deep?.name ?? null, kind: arrangement.kind, at: {start: arrangement.start, end: arrangement.end}}
  const slot = selection.scene === null ? null : deep?.sessionSlots[String(selection.scene)] ?? null
  if (!slot) return null
  const trackKind = track?.kind ?? deep?.kind
  return {name: slot, track: track?.name ?? deep?.name ?? null, kind: trackKind === 'midi' ? 'midi' : trackKind === 'return' || trackKind === 'master' || !trackKind ? null : 'audio', at: null}
}

const UNDISCLOSED = "The set's owner does not disclose this yet."

/** The props column's rows: the clip box's facts where the tracks give them, the set's own for the rest, "—" where nothing is
 * disclosed (never guessed). `label` is the set ruler's bar.beat label. */
export function liveClipRows(clip: LiveClipReading, box: readonly ClipRow[], mode: ModeInForce, label: (beats: number) => string): ClipRow[] {
  const boxed = (key: string, fallback: ClipRow): ClipRow => box.find(row => row.key === key) ?? fallback
  const beats = (value: number) => `${value} beats from the set's start (the document's own value)`
  const held = mode.state === 'in-force' ? mode.selection : null
  return [
    boxed('track', {key: 'track', value: clip.track, title: 'The track it sits on'}),
    {key: 'start', value: clip.at ? label(clip.at.start) : null, title: clip.at ? beats(clip.at.start) : `A session clip's start: ${UNDISCLOSED}`},
    {key: 'end', value: clip.at ? label(clip.at.end) : null, title: clip.at ? beats(clip.at.end) : `A session clip's end: ${UNDISCLOSED}`},
    {key: 'length', value: clip.at ? `${clip.at.end - clip.at.start} beats` : null, title: clip.at ? 'End less start, in beats' : UNDISCLOSED},
    {key: 'loop', value: null, title: `Loop: ${UNDISCLOSED}`},
    {...boxed('launch', {key: 'launch', value: null}), title: `Launch mode and quantization${box.some(row => row.key === 'launch' && row.value !== null) ? '' : `: ${UNDISCLOSED}`}`},
    {...boxed('then', {key: 'then', value: null}), title: `Follow action: what comes after it${box.some(row => row.key === 'then' && row.value !== null) ? '' : `. ${UNDISCLOSED}`}`},
    {key: 'signature', value: null, title: `Signature: ${UNDISCLOSED}`},
    {key: 'groove', value: null, title: `Groove: ${UNDISCLOSED}`},
    {key: 'mode', value: held ? `${PITCH_CLASS_NAMES[held.root]} ${held.scale.label}` : null,
      title: held ? `The set's mode in force; this clip carries no mode of its own yet. ${mode.line}` : mode.line},
    {key: 'transpose', value: null, title: `Transpose: ${UNDISCLOSED}`},
  ]
}

/** The roll's frame (the mockup's Notes column): the twelve pitch classes top to bottom, each marked in or out of the mode in
 * force (the Jankó surface's own marks), and the clip's bars along the top when it has a place on the ruler. No note is drawn:
 * the owner does not disclose a clip's notes yet, and that is said once beneath. */
export function LiveNoteRoll({clip, mode, label}: {clip: LiveClipReading; mode: ModeInForce; label: (beats: number) => string}) {
  const mask = mode.state === 'in-force' ? pitchMask(mode.selection.scale) : null
  const bars = clip.at ? Math.min(32, Math.max(1, Math.ceil((clip.at.end - clip.at.start) / 4))) : 0
  return <>
    <div className="live-roll" data-live-roll={mask ? 'mode' : 'plain'} aria-label="Pitch classes">
      {bars > 0 && <div className="live-roll-ruler" aria-hidden="true"><span />{Array.from({length: bars}, (_, bar) => <span key={bar}>{label(clip.at!.start + bar * 4)}</span>)}</div>}
      {[...PITCH_CLASS_NAMES.keys()].reverse().map(pitch => <div key={pitch} className="live-roll-row" data-in-mode={mask ? (mask[pitch] ? 'yes' : 'no') : undefined}>
        <span className="live-roll-key">{PITCH_CLASS_NAMES[pitch]}</span><span className="live-roll-lane" />
      </div>)}
    </div>
    <ClipNone>The set's owner does not disclose a clip's notes yet; the roll fills when it does.</ClipNone>
  </>
}

export function LiveClip({set, document, selection, waits}: {set: SetSummary | null; document: SetDocument | null; selection: SetSelection; waits: string}) {
  const selected = useSelectedClip()
  const {mode} = useLiveModeInForce()
  const clip = liveClipOf(set, document, selection)
  if (!clip) return <ClipWaiting line={waits} />
  const label = selected.set?.ruler?.label ?? ((beats: number) => String(beats))
  const sound = clip.kind === 'midi' || clip.kind === null
  return <ClipView kind="live" name={clip.name} colour={selected.track?.color} rows={liveClipRows(clip, clipBoxRows(selected), mode, label)}
    columns={[{name: sound ? 'Notes' : 'Sample', body: sound
      ? <LiveNoteRoll clip={clip} mode={mode} label={label} />
      : <ClipNone>The set's owner does not disclose an audio clip's sample yet.</ClipNone>}]} />
}
