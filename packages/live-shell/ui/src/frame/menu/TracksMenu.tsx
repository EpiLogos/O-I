// The object menu on the set's views (manual §10.9): Session view's grid and Arrangement view's ruler. One handler on the view finds
// the object under the pointer or the focus — a clip, an empty slot, a row of the Main column, a track — selects it, as Live selects
// what it opens a menu on, and lists its acts (frame/menu/objectActions.ts). Live's keys run the same acts on the selection while the
// view stands (⌘R, ⌘D, ⌫, 0, U, S, C, ⌘G, ⌘I, ⌘E …), and the native menu bar's Edit and Create items reach them through the same door
// (frame/menu/commandDoor.ts). Rename edits the name where it stands: Enter keeps it, Esc lets it go, Tab keeps it and moves on to
// the next of the same kind.
import {useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent} from 'react'
import {createPortal} from 'react-dom'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {TracksSelection} from '../tracks/SessionGrid'
import {ObjectMenu} from './ObjectMenu'
import {entryForKey, objectKeyAct, objectMenu, undoable, type ObjectContext, type ObjectRun, type ObjectTarget} from './objectActions'
import {recordStep} from './undo'
import {bindsClip, hostedClip, subscribeHostedClip, writeClip} from './objectDoor'
import {opensMenu, useObjectMenu} from './useObjectMenu'
import {publishObjectCommands} from './commandDoor'

const typing = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input,textarea,select,[contenteditable="true"]')

/** The object an element stands for, in the set the view draws: the nearest clip, empty slot, row or track. Pure over the DOM. */
export function objectAt(element: Element | null, set: WorldTrackSet): ObjectTarget | null {
  if (!element) return null
  const clipEl = element.closest<HTMLElement>('[data-clip]')
  const clip = clipEl?.dataset.clip ? set.clips.find(c => c.id === clipEl.dataset.clip) : undefined
  if (clip) return {kind: 'clip', id: clip.id, trackId: clip.trackId, name: clip.label}
  const slotEl = element.closest<HTMLElement>('[data-slot-row]')
  if (slotEl?.dataset.slotRow && slotEl.dataset.slotTrack) {
    const track = set.tracks.find(t => t.id === slotEl.dataset.slotTrack)
    if (track) return {kind: 'slot', trackId: track.id, rowId: slotEl.dataset.slotRow, name: track.name}
  }
  const rowEl = element.closest<HTMLElement>('[data-row]')
  const row = rowEl?.dataset.row ? set.columns.find(c => c.id === rowEl.dataset.row) : undefined
  if (row) return {kind: 'row', id: row.id, name: row.name || row.id}
  const trackEl = element.closest<HTMLElement>('[data-track]')
  const track = trackEl?.dataset.track ? set.tracks.find(t => t.id === trackEl.dataset.track) : undefined
  if (track) return {kind: 'track', id: track.id, name: track.name}
  return null
}

/** The selected object of the set (what Live's keys act on): the selected clip or track. Pure. */
export function selectedObject(set: WorldTrackSet, ref: string | undefined): ObjectTarget | null {
  if (!ref) return null
  const clip = set.clips.find(c => c.id === ref)
  if (clip) return {kind: 'clip', id: clip.id, trackId: clip.trackId, name: clip.label}
  const track = set.tracks.find(t => t.id === ref)
  return track ? {kind: 'track', id: track.id, name: track.name} : null
}

/** The element that draws an object, for rename's field and the keyboard's menu. Pure over the DOM. */
function elementOf(root: HTMLElement | null, target: ObjectTarget): HTMLElement | null {
  if (!root) return null
  const quote = (value: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"'))
  if (target.kind === 'clip') return root.querySelector<HTMLElement>(`[data-clip="${quote(target.id)}"]`)
  if (target.kind === 'row') return root.querySelector<HTMLElement>(`[data-row="${quote(target.id)}"]`)
  if (target.kind === 'slot') return root.querySelector<HTMLElement>(`[data-slot-track="${quote(target.trackId)}"][data-slot-row="${quote(target.rowId)}"]`)
  const column = root.querySelector<HTMLElement>(`[data-track="${quote(target.id)}"]`)
  return column?.querySelector<HTMLElement>('.thd, .tl-head') ?? column
}

/** The in-place field: Rename's, or a text an act asks for (Edit info text), which `save` keeps when it changed from `initial`. */
interface Renaming {readonly target: ObjectTarget; readonly box: DOMRect; readonly value: string
  readonly label?: string; readonly initial?: string; readonly save?: (text: string) => void}

/** The menu and the keys over one view of the set. `press` is the view's own (its receipt line says the owner's answer). */
export function useTracksMenu({set, selection, view, press, folded, fold, marker, span}: {set: WorldTrackSet; selection: TracksSelection
  view: 'session' | 'arrangement'; press: ObjectRun; folded?: (trackId: string) => boolean | undefined; fold?: (trackId: string) => void
  /** Arrangement view's insert marker and time selection, the pane's own (Split and Consolidate act on them). */
  marker?: number | null; span?: {start: number; end: number} | null}) {
  const menu = useObjectMenu()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [renaming, setRenaming] = useState<Renaming | null>(null)
  const latest = useRef({set, selection, view, press, folded, fold, marker, span})
  latest.current = {set, selection, view, press, folded, fold, marker, span}

  const rename = useCallback((target: ObjectTarget) => {
    const element = elementOf(rootRef.current, target)
    if (!element) return
    setRenaming({target, box: element.getBoundingClientRect(), value: target.name})
  }, [])

  const ask = useCallback((target: ObjectTarget, field: {readonly label: string; readonly value: string}, done: (text: string) => void) => {
    const element = elementOf(rootRef.current, target)
    if (!element) return
    setRenaming({target, box: element.getBoundingClientRect(), value: field.value, label: field.label, initial: field.value, save: done})
  }, [])

  const context = useCallback((): ObjectContext => ({view: latest.current.view, binding: hostedClip(), press: latest.current.press, rename,
    writeClip, folded: latest.current.folded, fold: latest.current.fold, record: recordStep, ask, marker: latest.current.marker ?? null,
    span: latest.current.span ?? null}), [rename, ask])

  const select = (target: ObjectTarget) => {
    if (target.kind === 'clip') latest.current.selection.select({kind: 'clip', ref: target.id, title: target.name, track: target.trackId})
    else if (target.kind === 'track') latest.current.selection.select({kind: 'track', ref: target.id, title: target.name})
  }

  /** The object the standing menu lists: its acts are read again when its Clip view publishes it (below). */
  const shown = useRef<ObjectTarget | null>(null)

  /** Open an object's menu: selected first, its acts read once Clip view has taken the selection (two frames). */
  const open = (target: ObjectTarget, x: number, y: number, trigger: HTMLElement | null, source: 'pointer' | 'keyboard') => {
    select(target)
    // A short wait, not animation frames: a frame never comes in a window the system holds hidden, and the menu must still open.
    setTimeout(() => { shown.current = target; menu.openAt(x, y, objectMenu(target, latest.current.set, context()), target.name, trigger, source) }, 40)
  }

  // While a clip's menu stands, each binding its Clip view publishes for it reads the clip's acts again: a page read after the menu opened
  // brings what it says (its facts' standing, its Open in), where it stands, without moving the menu or its focus.
  const refresh = menu.refresh
  useEffect(() => {
    if (!menu.isOpen) { shown.current = null; return }
    return subscribeHostedClip(binding => {
      const target = shown.current
      if (!binding || target?.kind !== 'clip' || !bindsClip(binding, target.id)) return
      refresh(objectMenu(target, latest.current.set, context()))
    })
  }, [menu.isOpen, refresh, context])

  const onContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    const target = objectAt(event.target as Element, latest.current.set)
    if (!target) return
    event.preventDefault()
    open(target, event.clientX, event.clientY, (event.target as HTMLElement).closest<HTMLElement>('button,[tabindex]') ?? event.currentTarget, 'pointer')
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!opensMenu(event) || typing(event.target)) return
    const target = objectAt(document.activeElement, latest.current.set) ?? selectedObject(latest.current.set, latest.current.selection.ref)
    if (!target) return
    event.preventDefault()
    const box = (elementOf(rootRef.current, target) ?? (event.target as HTMLElement)).getBoundingClientRect()
    open(target, Math.round(box.left + 12), Math.round(box.top + 12), event.target as HTMLElement, 'keyboard')
  }

  /** Run an act on the selection by its id (a key, or the menu bar's item); true when it ran. */
  const runAct = useCallback((id: string): boolean => {
    const {set: shown, selection: chosen} = latest.current
    const target = selectedObject(shown, chosen.ref)
    if (!target) return false
    const entry = entryForKey(objectMenu(target, shown, context()), id)
    if (!entry || entry.disabled || !('onSelect' in entry) || !entry.onSelect) return false
    entry.onSelect(id)
    return true
  }, [context])

  // Live's keys on the selection, while this view stands and the focus is not in a field (a key the view doesn't take passes on).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || typing(event.target) || menu.isOpen) return
      if (!rootRef.current || rootRef.current.closest('[hidden]')) return
      const id = objectKeyAct(event)
      if (!id) return
      if (runAct(id)) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runAct, menu.isOpen])

  // The menu bar's Edit and Create items reach the view that stands (frame/menu/commandDoor.ts).
  useEffect(() => publishObjectCommands(id => !!rootRef.current && !rootRef.current.closest('[hidden]') && runAct(id)), [runAct])

  const commit = (move: boolean) => {
    const held = renaming
    if (!held) return
    setRenaming(null)
    // A text an act asked for: kept where it changed, and nothing moves on.
    if (held.save) { if (held.value !== held.initial) held.save(held.value); return }
    const name = held.value.trim()
    const {set: shown, press: run} = latest.current
    if (name && name !== held.target.name) {
      const target = held.target
      const label = `Rename ${target.name}`
      const ctx = {record: recordStep}
      if (target.kind === 'clip') run(`name:${target.id}`, label, undoable(ctx, label, () => writeClip(target.id, 'name', name), () => writeClip(target.id, 'name', target.name)))
      else if (target.kind === 'track' && shown.actions?.renameTrack) {
        const rename = shown.actions.renameTrack
        run(`name:${target.id}`, label, undoable(ctx, label, () => rename.run(target.id, name), () => rename.run(target.id, target.name)))
      } else if (target.kind === 'row' && shown.actions?.renameRow) {
        const rename = shown.actions.renameRow
        run(`name:${target.id}`, label, undoable(ctx, label, () => rename.run(target.id, name), () => rename.run(target.id, target.name)))
      }
    }
    if (!move) return
    // Tab: on to the next of the same kind, as Live moves to the next track or scene while renaming.
    const target = held.target
    const order: ObjectTarget[] = target.kind === 'clip'
      ? shown.clips.filter(c => c.trackId === target.trackId).map(c => ({kind: 'clip', id: c.id, trackId: c.trackId, name: c.label}))
      : target.kind === 'track' ? shown.tracks.filter(t => !t.main).map(t => ({kind: 'track', id: t.id, name: t.name}))
        : target.kind === 'row' ? shown.columns.map(c => ({kind: 'row', id: c.id, name: c.name || c.id})) : []
    const at = order.findIndex(item => 'id' in item && 'id' in target && item.id === target.id)
    const next = at >= 0 ? order[at + 1] : undefined
    if (next) { select(next); setTimeout(() => rename(next), 40) }
  }

  const field = renaming && typeof document !== 'undefined' ? createPortal(<input className="object-rename" aria-label={renaming.label ?? `Rename ${renaming.target.name}`} autoFocus
    style={{left: renaming.box.left, top: renaming.box.top + Math.max(0, (renaming.box.height - 22) / 2), width: Math.max(120, renaming.box.width)}}
    value={renaming.value} onChange={event => setRenaming({...renaming, value: event.target.value})}
    onBlur={() => commit(false)}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); commit(false) }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setRenaming(null) }
      else if (event.key === 'Tab') { event.preventDefault(); commit(!renaming.save) }
    }} />, document.body) : null

  return {rootRef, onContextMenu, onKeyDown, layer: <><ObjectMenu menu={menu} />{field}</>}
}
