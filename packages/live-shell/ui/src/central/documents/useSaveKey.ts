// ⌘S in a Central document's page (DLW §10.9: "Open a set, save it … ⌘O, ⌘S"; §17.8 Save). The page cannot reach its host's keys: a
// key pressed inside the hosted form is the form's, and the form's own ⌘S writes its portable copy, a download no owner hears. Every
// hosted document frame carries desktop/cradle/src/context/document-save-key.js (document/frame.ts useDocumentFrame), which takes the
// chord before the form does and asks its host to save; the face that hosts the frame hears it here and runs its own Save — the same
// Save as its head's, through Central — so ⌘S in the page and the head's Save are one act. The portable copy stays in the form's own
// menu and buttons. Nothing here reads or writes an owner.
import {useEffect, useRef, type RefObject} from 'react'

/** What the page sends its host on ⌘S. */
export const DOCUMENT_SAVE_MESSAGE = 'oi:document-save'

/** Run `save` when the page in `frame` asks for it (⌘S inside it). A face with no Save open now (still reading, a save in flight) does
 * nothing on the key, as its head's Save stands disabled. */
export function useSaveKey(frame: RefObject<HTMLIFrameElement | null>, save: (() => void) | undefined): void {
  const latest = useRef(save)
  latest.current = save
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return
      if ((event.data as {type?: unknown} | null)?.type !== DOCUMENT_SAVE_MESSAGE) return
      latest.current?.()
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [frame])
}
