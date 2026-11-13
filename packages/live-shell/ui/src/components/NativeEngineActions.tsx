import {useId, useSyncExternalStore} from 'react'
import {askConfirm, type ConfirmAsk} from '../shell/ConfirmDialog'
import {dispatchNativeEngineCommand, engineCommandReason, readNativeEngineMounted, subscribeNativeEngineMounted, type NativeEngineRequest} from '../native/engineCommand'

/** The physics runtime actions as buttons. Each sends one engine request through the
 * Expressions panel to the mounted field. Reset reseeds the particles and nothing gives
 * them back, so it asks first in the shell's confirm dialog (shell/ConfirmDialog.tsx, the
 * world-shell mockup's .dlg), and the frame runs it only with confirmed: true. */
export function NativeEngineActions({disabled}: {disabled: boolean}) {
  const mounted = useSyncExternalStore(subscribeNativeEngineMounted, readNativeEngineMounted, () => false)
  const noteId = useId()
  const reason = engineCommandReason({mounted, busy: disabled})
  return <NativeEngineActionsView reason={reason} noteId={noteId} onRequest={dispatchNativeEngineCommand}
    onAskReset={() => void askConfirm(RESET_ASK).then(yes => { if (yes) dispatchNativeEngineCommand({action: 'reset', confirmed: true}) })} />
}

/** What the reset asks: what it does, and what it does not. */
export const RESET_ASK: ConfirmAsk = {
  title: 'Reset the field',
  body: <>Resetting reseeds <b>every particle</b> of the mounted field: their places and phases start again and nothing brings the
    old ones back. The field's forms and settings stay as they are.</>,
  ok: 'Reset field',
  plain: 'Resetting reseeds every particle of the mounted field; nothing brings the old ones back. The forms and settings stay.',
}

/** Presentation only, with no hooks: the reason and the requests are the caller's; Reset field asks through `onAskReset`. */
export function NativeEngineActionsView({reason, noteId, onRequest, onAskReset}: {
  reason: string | null; noteId: string; onRequest: (request: NativeEngineRequest) => void; onAskReset: () => void
}) {
  const off = reason !== null
  const title = reason ?? undefined
  const describedBy = reason !== null ? noteId : undefined
  return <div className="native-engine-actions" role="group" aria-label="Physics runtime actions">
    <button type="button" disabled={off} title={title} aria-describedby={describedBy} onClick={() => onRequest({action: 'disperse'})}>Disperse particles</button>
    <button type="button" disabled={off} title={title} aria-describedby={describedBy} onClick={() => onRequest({action: 'reset-phases'})}>Reset phases</button>
    <button type="button" disabled={off} title={title} aria-describedby={describedBy} onClick={() => onRequest({action: 'recover'})}>Recover field</button>
    <button type="button" disabled={off} title={title} aria-describedby={describedBy} onClick={onAskReset}>Reset field</button>
    {reason && <small id={noteId} className="native-engine-note">{reason}</small>}
  </div>
}
