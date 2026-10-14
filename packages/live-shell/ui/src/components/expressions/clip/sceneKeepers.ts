// What the Scene keeps while Expressions stands, whether or not its Clip side is shown. The Clip side is mounted on first use
// and Expressions opens on its Device side (shell/modeFrames.ts), so two things that must not wait for it are mounted with
// Expressions' bindings (shell/transports/useExpressionsTransport.tsx), the one part of Expressions that stands whenever the
// mode does:
//   • ⌘S (Ctrl S): the chord of Save, which travelled here with Save from the retired bar (it saved the open Expression from
//     anywhere in Expressions, unless a field had focus). The F9 keys layer (frame/keys) has no ⌘S and is not doubled.
//   • THE selection's focus (F3/F4: "selecting a clip shows its editor in every mode"): a scene clip selected in the Session or
//     the Arrangement is one `scene focus` request to the Expressions owner, once per selection (selectionFollow, sceneClip.ts).
// Each is the Scene's own owner call (sceneCalls.ts) on the source the frame published; neither keeps a value of its own.
import {useEffect, useRef} from 'react'
import {useTimelineReading} from '../../../projections/timelinePaneHost'
import type {NativeCompositionViewSource} from '../../../shell/compositionViews'
import {saveState} from '../../nativeExpressionCommands'
import {sendSave, sendScene, type LatestSource} from './sceneCalls'
import {selectionFollow} from './sceneClip'
import {markSeen, sceneBusy, seenSelection, useSceneBusy} from './sceneState'

/** The part of a keydown the chord reads (a real KeyboardEvent satisfies it). */
export interface ChordLike {key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; repeat: boolean}

/** Ctrl or ⌘ with S and nothing else, not a held key. */
export const isSaveChord = (event: ChordLike): boolean =>
  (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && !event.repeat && event.key.toLowerCase() === 's'

/** The field-focus rule the shell's other chords keep: a typing field keeps its own keys. */
const typing = (active: Element | null): boolean => !!(active instanceof HTMLElement && active.closest('input,textarea,select,[contenteditable="true"]'))

/** One keydown, end to end. True when the chord was taken (the default is the caller's to stop): Save is offered, no field has
 * focus, and the owner's save request is on its way. */
export function pressSaveChord(event: ChordLike, now: NativeCompositionViewSource | null, latest: LatestSource, typingNow: boolean): boolean {
  if (!isSaveChord(event) || !now?.content || typingNow) return false
  if (saveState({attached: !!now.actions, busy: sceneBusy(), standing: now.content.standing}).disabled) return false
  void sendSave(now, latest)
  return true
}

/** One look at THE selection: a scene clip it names that the owner is not focused on is one focus request, and the selection is
 * marked seen. Null when nothing was asked of the owner. */
export function followSelection(now: NativeCompositionViewSource | null, selected: string | null, ready: boolean, latest: LatestSource): Promise<boolean> | null {
  if (!now) return null
  const decided = selectionFollow({selected, seen: seenSelection(), content: now.content, ready})
  if (!decided.act || !now.isPresented()) return null
  markSeen(selected)
  return decided.focus ? sendScene(now, latest, {action: 'focus', scene_ref: decided.focus}) : null
}

export function useSceneKeepers(source: NativeCompositionViewSource | null): void {
  const latest = useRef(source); latest.current = source
  const busy = useSceneBusy()
  const selected = useTimelineReading()?.selectedRef ?? null
  const content = source?.content ?? null
  const ready = !!source?.actions && !!content && !content.standing.pending && !busy

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (pressSaveChord(event, latest.current, () => latest.current, typing(document.activeElement))) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Once per selection: the Scene selector and the stage move the owner's focus too, and an older selection never pulls it back.
  const ownerScene = content?.basis.scene_ref
  useEffect(() => { void followSelection(latest.current, selected, ready, () => latest.current) }, [selected, ownerScene, ready])
}
