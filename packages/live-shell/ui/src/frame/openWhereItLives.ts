// The shell's one act that opens a thing where it lives (manual §17.4 "Open, on a task, opens it in Clip view; on a song, opens its score;
// on a routine, opens it in Settings, Automations (§10.10)"). A device names where the thing lives; the shell takes it there:
//   - a clip: its mode stands landing on the clip — one move, one stop on the trail (App.tsx chooseMode, so Back returns where you
//     were, never to the clip's mode with what you had selected before), THE selection names the clip (App.tsx selectTrackItem, the
//     selection the move already landed on, so it adds none), the clip's own view holds are set (frame/detail/clipBinding.ts
//     setViewHold: which editor shows, the note chosen, the song opened inside a note), and Clip view comes forward
//     (frame/menu/objectDoor.ts showClipView);
//   - a routine: Settings opens on Automations in the routine's work context with the routine chosen (settings/host.ts openSettings);
//   - a track (an agent session where it runs, from face 2 of the Day, O-I ticket 1007): its mode stands landing on the track, as a clip's
//     does, and THE selection names it — in Factory the selected session (agent/AgentShellContext.tsx sessionOfSelection); no Clip view.
// Nothing here writes an owner. The frame publishes the door (useClipHomeDoor, from App.tsx); where no frame publishes one, opening a clip
// or a track is refused in words.
import {useEffect, useRef, useState} from 'react'
import type {Value} from './devices/designed'
import {setViewHold} from './detail/clipBinding'
import {showClipView} from './menu/objectDoor'
import {openSettings} from '../settings/host'
import type {SurfMode} from '../shell/modeGrammar'

/** Where a thing lives. */
export type NodeHome =
  | {readonly kind: 'clip'; readonly mode: SurfMode; readonly clip: string; readonly title: string; readonly track?: string
    /** The clip's own view holds to set as it opens, by its Clip view's host id (clipHostId): undefined drops a hold. */
    readonly view?: {readonly id: string; readonly holds: Readonly<Record<string, Value | undefined>>}}
  | {readonly kind: 'routine'; readonly routine: string; readonly name?: string
    /** The routine's work context: '' this AIKit home, else the project's name. */
    readonly project: string; readonly returnLabel?: string}
  /** A track of a mode (in Factory, an agent session's: its `trackKey`), named by `title`. */
  | {readonly kind: 'track'; readonly mode: SurfMode; readonly track: string; readonly title: string}

/** What the frame's door opens: a clip, or a track. */
type FrameHome = Extract<NodeHome, {kind: 'clip' | 'track'}>
let door: ((home: FrameHome) => void) | null = null

/** The frame's door for a clip or a track (App.tsx, through useClipHomeDoor). */
export function publishClipHomeDoor(next: ((home: FrameHome) => void) | null): void { door = next }

/** The words when no frame here opens a clip or a track. */
export const NO_CLIP_HOME = 'No window here opens a clip or a track where it lives: the frame publishes no door to its modes and Clip view.'

/** Open a thing where it lives. Throws in words where this window cannot. */
export function openWhereItLives(home: NodeHome): void {
  if (home.kind === 'routine') {
    openSettings({requestId: crypto.randomUUID(), page: 'automations', routine: home.routine,
      scope: home.project ? {scope_kind: 'project', scope_ref: home.project} : {scope_kind: 'world', scope_ref: null},
      ...(home.returnLabel ? {returnLabel: home.returnLabel} : {})})
    return
  }
  if (!door) throw new Error(NO_CLIP_HOME)
  if (home.kind === 'clip' && home.view) for (const [key, value] of Object.entries(home.view.holds)) setViewHold(home.view.id, key, value)
  door(home)
}

/** What an opened clip or track lands on: the clip or the track THE selection names (App.tsx selectTrackItem makes it). */
export interface ClipLanding {readonly kind: 'clip' | 'track'; readonly ref: string; readonly title: string; readonly track?: string}
/** The frame's mode switch (App.tsx chooseMode), which may land on a clip or a track with the mode. */
export type ChooseMode = (mode: SurfMode, landing?: ClipLanding) => void

export const clipLanding = (home: FrameHome): ClipLanding => (home.kind === 'track' ? {kind: 'track', ref: home.track, title: home.title}
  : {kind: 'clip', ref: home.clip, title: home.title, ...(home.track ? {track: home.track} : {})})

/** The door's first half: the mode the clip or track lives in stands, landing on it — one move, so the open is one stop on the trail. One
 * in the mode the frame stands in already needs no switch: the selection alone is the move. */
export function standClipHome(home: FrameHome, frame: {readonly mode: SurfMode; readonly chooseMode: ChooseMode}): void {
  if (frame.mode !== home.mode) frame.chooseMode(home.mode, clipLanding(home))
}

/** The frame's half of the act: the mode the clip or track lives in stands first, then THE selection names it — and, for a clip, Clip view
 * comes forward — once the mode's frame has rendered (the selection is made in the mode it belongs to). */
export function useClipHomeDoor(mode: SurfMode, chooseMode: ChooseMode, select: (target: ClipLanding) => void): void {
  const pending = useRef<FrameHome | null>(null)
  const [asked, ask] = useState(0)
  const now = useRef({mode, chooseMode, select})
  now.current = {mode, chooseMode, select}
  useEffect(() => {
    publishClipHomeDoor(home => {
      pending.current = home
      standClipHome(home, now.current)
      ask(n => n + 1)
    })
    return () => publishClipHomeDoor(null)
  }, [])
  useEffect(() => {
    const home = pending.current
    if (!home || home.mode !== mode) return
    pending.current = null
    select(clipLanding(home))
    if (home.kind === 'clip') showClipView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, asked])
}
