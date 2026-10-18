// The one clip host (manual §16.5; FOUNDATION F4; T-REALIGN R2): the selected clip's mode's designed clip (inhabitants/catalogue/
// clips/index.ts loadClip), drawn whole by the kit's ClipView (clips/clipKit.tsx: the head, the Clip and Launch tabs, the tools, the
// editor's tabs) on the clip's binding (clipBinding.ts), at the room the place gives it: the detail area's box (size 'detail') or
// the main area's when ⌥⌘E gives Clip view the main area (size 'expanded'). Clip view is laid out as Live lays it out in every mode;
// only what each part holds changes with the kind of clip.
//
// The change path is the device host's own (frame/devices/deviceHost.tsx HostedDevice, the law ported for devices from the plate's
// release law): the clip is hosted as the one view of a device whose id is the clip's, so a change waits for the hand to let go, goes
// to the owner in one change, waits in italics until the owner's reading confirms it, and a refusal returns the owner's value and
// says the owner's words on the status bar's Info line. The view's own keys (which tab shows, a fold, a tool's settings) go to the
// clip's view holds at once (clipBinding.ts). Nothing here reads an owner: the bindings do.
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {HostedDevice} from '../devices/deviceHost'
import type {DesignedDevice, ViewProps} from '../devices/designed'
import {ClipView} from '../../inhabitants/catalogue/clips/clipKit'
import {loadClip} from '../../inhabitants/catalogue/clips/index'
import type {ClipMode, ClipProps, ClipSize, DesignedClip} from '../../inhabitants/catalogue/clips/design'
import {clipShape, type ClipBinding} from './clipBinding'

/** Where the clip stands: its size and the room the place measured. */
export interface ClipPlace {
  readonly size: ClipSize
  readonly room: {readonly w: number; readonly h: number}
}

// ---------------------------------------------------------------------------------------------------------------- the designs

const loaded = new Map<ClipMode, DesignedClip>()
const failed = new Map<ClipMode, string>()

/** A mode's designed clip, loaded once (each is its own module, so one that does not build never stops another). */
export function useClipDesign(mode: ClipMode): {design: DesignedClip | null; fault: string | null} {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (loaded.has(mode) || failed.has(mode)) return
    let alive = true
    loadClip(mode).then(design => { loaded.set(mode, design) }, (cause: unknown) => { failed.set(mode, cause instanceof Error ? cause.message : String(cause)) })
      .finally(() => { if (alive) setTick(tick => tick + 1) })
    return () => { alive = false }
  }, [mode])
  return {design: loaded.get(mode) ?? null, fault: failed.get(mode) ?? null}
}

/** The designed clip as the one view of a device: the host's change path, and Clip view drawn from the host's values and standing.
 * Every view of the device is the same Clip view (only `whole` is ever asked for). Pure. */
export function clipAsDevice(design: DesignedClip, size: ClipSize, room: ClipPlace['room']): DesignedDevice {
  const draw = (p: ViewProps): ReactNode => {
    const props: ClipProps = {v: p.v, set: p.set, size, room: p.room ?? room, ...(p.standing ? {standing: p.standing} : {})}
    return <ClipView design={design} p={props} />
  }
  return {id: design.id, title: design.title, kind: 'effect', defaults: {}, folded: draw, compact: draw, whole: draw, full: draw, widget: draw}
}

const NAV = {}

/** One clip, hosted: its mode's design on its binding, at its place. */
export function HostedClip({binding, place}: {binding: ClipBinding; place: ClipPlace}) {
  const {design, fault} = useClipDesign(binding.mode)
  const shaped = useMemo(() => (design ? clipShape(design, binding) : null), [design, binding.placed, binding.lacks])
  const device = useMemo(() => (shaped ? clipAsDevice(shaped, place.size, place.room) : null), [shaped, place.size, place.room])
  if (fault) return <p className="clip-empty" role="alert" data-i={`Clip view|The ${binding.mode} clip's design did not load: ${fault}.`}>The {binding.mode} clip's design did not load: {fault}.</p>
  if (!device || !shaped) return <p className="clip-empty" role="status">Opening Clip view…</p>
  return <HostedDevice designed={device} binding={binding} view="whole" nav={NAV} room={place.room} title={shaped.title}
    className="clip-host" data={{'data-clip-host': binding.mode, 'data-clip-ref': binding.ref, 'data-clip-size': place.size,
      'data-clip-placed': binding.placed ? 'true' : undefined}} />
}

/** The room a place gives, measured: the element's content box, followed as it changes. Absent until first measured. */
export function useMeasuredRoom(): [(element: HTMLElement | null) => void, {w: number; h: number} | null] {
  const [room, setRoom] = useState<{w: number; h: number} | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const hand = useMemo(() => (element: HTMLElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!element) return
    const read = () => {
      const box = element.getBoundingClientRect()
      const next = {w: Math.max(0, Math.floor(box.width)), h: Math.max(0, Math.floor(box.height))}
      setRoom(was => (was && was.w === next.w && was.h === next.h ? was : next))
    }
    read()
    if (typeof ResizeObserver !== 'undefined') { observer.current = new ResizeObserver(read); observer.current.observe(element) }
  }, [])
  useEffect(() => () => observer.current?.disconnect(), [])
  return [hand, room]
}
