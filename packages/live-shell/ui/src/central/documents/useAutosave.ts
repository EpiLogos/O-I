// A Central document face's autosave (autosave.ts): the face's page tells it each edit (desktop/cradle/src/context/document-edit.js, in
// every hosted document frame), and the face saves through its own Save a short time after you stop — or when you leave the page or the
// window, as Save timing says. The bridge stays read-only: this only listens to the face's own frame, and what the page holds the face
// learns by its own bounded read (`settle`). Nothing here reads or writes an owner.
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject} from 'react'
import {autosaveGlyph, autosaveSetting, createAutosave, pageGesture, subscribeAutosave, type AutosaveFace, type AutosaveGlyph, type AutosaveSetting} from './autosave'

/** The one autosave setting (autosave.ts), as a reading that follows it. */
export function useAutosaveSetting(): AutosaveSetting {
  return useSyncExternalStore(subscribeAutosave, autosaveSetting, autosaveSetting)
}

export interface FaceAutosave {
  /** The glyph: saved, saving or held, and why. */
  readonly glyph: AutosaveGlyph
  /** An edit the face heard by another way (the Day's form says it is edited): as a gesture of the page. */
  readonly edited: () => void
}

/** Autosave over the face's frame. `face` is read afresh at each moment; `dirty` is the face's draft fact, for the glyph. */
export function useAutosave(frame: RefObject<HTMLIFrameElement | null>, face: AutosaveFace & {readonly dirty: boolean}): FaceAutosave {
  const setting = useAutosaveSetting()
  const latest = useRef(face)
  latest.current = face
  const settingNow = useRef(setting)
  settingNow.current = setting
  const [typing, setTyping] = useState(false)
  const control = useMemo(() => createAutosave({face: () => latest.current, setting: () => settingNow.current, typing: setTyping}), [])
  useEffect(() => () => control.cancel(), [control])
  // The page's gestures, from this face's own frame only.
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return
      const gesture = pageGesture(event.data)
      if (gesture) control.gesture(gesture)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [frame, control])
  // Leaving the window: its focus gone to another window (a focus moved into a page leaves the window's own focus standing), or hidden.
  useEffect(() => {
    if (typeof document === 'undefined') return
    let check: ReturnType<typeof setTimeout> | undefined
    const blurred = () => { clearTimeout(check); check = setTimeout(() => { if (!document.hasFocus()) control.windowLeft() }, 0) }
    const hidden = () => { if (document.visibilityState === 'hidden') control.windowLeft() }
    window.addEventListener('blur', blurred)
    document.addEventListener('visibilitychange', hidden)
    return () => { clearTimeout(check); window.removeEventListener('blur', blurred); document.removeEventListener('visibilitychange', hidden) }
  }, [control])
  // A save in flight answered: what came due meanwhile runs now.
  useEffect(() => { if (!face.pending) control.settled() }, [face.pending, control])
  const edited = useCallback(() => control.gesture('input'), [control])
  return {glyph: autosaveGlyph({on: setting.on, timing: setting.timing, dirty: face.dirty, typing, pending: face.pending, held: face.held}), edited}
}
