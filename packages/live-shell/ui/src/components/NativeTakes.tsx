import {useState} from 'react'
import type {NativeEditorReading, NativeEditorReply, NativeEditorRequest} from '../../../../expressions-boundary/src/editor'
import {readNativeTakeTracks, type NativeTakeTrack} from '../../../../expressions-boundary/src/nativeTrackEdits'
import {frameTakeReason, takeEnvelope, tracksPreview, useFrameTakeLink, type FrameStageRun} from '../native/frameTakes'
import './NativeTakes.css'

const reasonOf = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
const ENVELOPE = {width: 160, height: 36}

/** The Scene's recorded property tracks, read from the owner's reading. Preview plays them in the
 * Expressions application; Delete is one validated track-remove edit. Recording happens in the frame. */
export function NativeTakes({reading, request}: {reading: NativeEditorReading | null; request: (operation: NativeEditorRequest) => Promise<NativeEditorReply>}) {
  const link = useFrameTakeLink()
  const [previewBusy, setPreviewBusy] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const tracks = reading ? readNativeTakeTracks(reading.scene) : []
  const previewing = link.state?.propertyPreview === true
  const recording = link.state?.propertyRecording === true
  const previewReason = frameTakeReason({link, busy: previewBusy, sceneRef: reading?.basis.scene_ref ?? null,
    want: previewing ? 'stop-preview' : 'preview', tracks: tracks.length})
  const deleteReason = !reading ? 'The native editor is still loading.'
    : reading.standing.pending ? 'The native owner is still answering the last edit.'
    : recording ? 'Finish the property take before removing a track.' : null

  const togglePreview = () => {
    const run: FrameStageRun | null = link.run
    if (!run || previewBusy || previewReason) return
    setPreviewBusy(true); setRefusal(null)
    let answer: ReturnType<FrameStageRun>
    try {answer = run(tracksPreview(!previewing))} catch (cause) {setPreviewBusy(false); setRefusal(reasonOf(cause)); return}
    void answer.then(result => {if (!result.ok) setRefusal(result.error)}, cause => setRefusal(reasonOf(cause)))
      .finally(() => setPreviewBusy(false))
  }
  const remove = (track: NativeTakeTrack) => {
    if (!reading || deleteReason || removing !== null) return
    setRemoving(track.id); setRefusal(null)
    let answer: Promise<NativeEditorReply>
    try {answer = request({operation: 'apply', basis: reading.basis, changes: [{kind: 'track-remove', track_id: track.id}]})}
    catch (cause) {setRemoving(null); setRefusal(reasonOf(cause)); return}
    void answer.then(reply => {if (!reply.ok) setRefusal(reply.error)}, cause => setRefusal(reasonOf(cause)))
      .finally(() => setRemoving(null))
  }

  return <section className="native-takes" aria-label="Recorded takes">
    <header className="native-takes-header">
      <h3 className="native-takes-title">Takes</h3>
      <span className="native-takes-count">{tracks.length} recorded {tracks.length === 1 ? 'track' : 'tracks'}</span>
      <button type="button" aria-pressed={previewing} disabled={!!previewReason} title={previewReason ?? (previewing ? 'Stop previewing the recorded tracks' : 'Play the recorded tracks in the Expressions application')}
        onClick={togglePreview}>{previewing ? 'Stop preview' : 'Preview'}</button>
    </header>
    {previewReason && <p className="native-takes-note">{previewReason}</p>}
    {tracks.length === 0
      ? <p className="native-takes-empty">No property takes are recorded in this Scene. Record chosen properties from the transport bar.</p>
      : <ul className="native-takes-list" aria-label="Recorded property tracks">
        {tracks.map(track => {
          const envelope = takeEnvelope(track.points, ENVELOPE.width, ENVELOPE.height)
          return <li key={track.id} className="native-take-row">
            <div className="native-take-name"><span>{track.label}</span><small>{track.point_count} points · {track.duration.toFixed(2)} s</small></div>
            <svg className="native-take-envelope" viewBox={`0 0 ${ENVELOPE.width} ${ENVELOPE.height}`} preserveAspectRatio="none" role="img" aria-label={`Envelope of ${track.label}`}>
              {envelope && <path d={envelope.path} />}
            </svg>
            <button type="button" aria-label={`Delete recorded track ${track.label}`} disabled={!!deleteReason || removing !== null}
              title={deleteReason ?? 'Remove this recorded track from the Scene'} onClick={() => remove(track)}>Delete</button>
          </li>
        })}
      </ul>}
    {refusal && <p role="alert" className="native-takes-refusal">{refusal}</p>}
  </section>
}
