import {useId, useState, useSyncExternalStore} from 'react'
import {dispatchNativeEngineCommand, engineCommandReason, readNativeEngineMounted, subscribeNativeEngineMounted, type NativeEngineRequest} from '../native/engineCommand'

/** The physics runtime actions as buttons. Each sends one engine request through the
 * Expressions panel to the mounted field. Reset reseeds the particles, so it is two
 * steps here and the frame runs it only with confirmed: true. */
export function NativeEngineActions({disabled}: {disabled: boolean}) {
  const mounted = useSyncExternalStore(subscribeNativeEngineMounted, readNativeEngineMounted, () => false)
  const [confirming, setConfirming] = useState(false)
  const noteId = useId()
  const reason = engineCommandReason({mounted, busy: disabled})
  return <NativeEngineActionsView reason={reason} confirming={confirming} noteId={noteId}
    onRequest={request => {setConfirming(false); dispatchNativeEngineCommand(request)}}
    onAskConfirm={() => setConfirming(true)} onCancelConfirm={() => setConfirming(false)} />
}

/** Presentation only, with no hooks: the reason, the confirm step and the requests are the caller's. */
export function NativeEngineActionsView({reason, confirming, noteId, onRequest, onAskConfirm, onCancelConfirm}: {
  reason: string | null; confirming: boolean; noteId: string; onRequest: (request: NativeEngineRequest) => void; onAskConfirm: () => void; onCancelConfirm: () => void
}) {
  const off = reason !== null
  const title = reason ?? undefined
  const describedBy = reason !== null ? noteId : undefined
  return <div className="native-engine-actions" role="group" aria-label="Physics runtime actions">
    <button type="button" disabled={off} title={title} aria-describedby={describedBy} onClick={() => onRequest({action: 'disperse'})}>Disperse particles</button>
    <button type="button" disabled={off} title={title} aria-describedby={describedBy} onClick={() => onRequest({action: 'reset-phases'})}>Reset phases</button>
    <button type="button" disabled={off} title={title} aria-describedby={describedBy} onClick={() => onRequest({action: 'recover'})}>Recover field</button>
    {confirming
      ? <>
        <button type="button" className="native-engine-confirm" disabled={off} title={title} aria-describedby={describedBy}
          onClick={() => onRequest({action: 'reset', confirmed: true})}>Confirm reset (reseeds particles)</button>
        <button type="button" onClick={onCancelConfirm}>Cancel reset</button>
      </>
      : <button type="button" disabled={off} title={title} aria-describedby={describedBy} onClick={onAskConfirm}>Reset field</button>}
    {reason && <small id={noteId} className="native-engine-note">{reason}</small>}
  </div>
}
