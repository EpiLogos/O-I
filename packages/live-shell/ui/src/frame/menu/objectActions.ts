// Every object's acts, after Live's (manual §10.9 and each mode's action table, §17.1–§21.1): a clip, a track, an empty slot, a row,
// a take. Each act names the owner operation it runs; one no owner carries stands disabled and names the operation it waits for, so
// the list of what to build is read off the menu itself. A clip's own facts (its name, its colour, whether it plays) are written by
// its Clip view (frame/menu/objectDoor.ts): the clip's binding says which of them the owner takes, and in what words it refuses.
// The set's other acts are the set's `actions` (timeline/worldTrackAdapter.ts WorldTrackActions). The frame knows no mode here: what
// differs by mode is what each mode's set carries. Pure, apart from the acts it hands back to run.
import type {ClipBinding} from '../detail/clipBinding'
import type {WorldTrackActions, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import {LIVE_CLIP_PALETTE} from '../../live/livePalette'
import {MADE_OF} from '../../inhabitants/catalogue/clips/design'
import {NOT_AN_EXPRESSION} from '../detail/clipSource'
import type {ObjectMenuItem} from './useObjectMenu'
import type {UndoStep} from './undo'
import {heldClip, holdClip} from './clipboard'

/** What the menu stands on: an object of the set the views draw. */
export type ObjectTarget =
  | {readonly kind: 'clip'; readonly id: string; readonly trackId: string; readonly name: string}
  | {readonly kind: 'track'; readonly id: string; readonly name: string}
  | {readonly kind: 'slot'; readonly trackId: string; readonly rowId: string; readonly name: string}
  | {readonly kind: 'row'; readonly id: string; readonly name: string}

/** An act as the menu and the keys run it: the press's words, and the owner call. */
export type ObjectRun = (key: string, what: string, run: () => unknown) => void

/** What the acts reach besides the set: the clip's binding while Clip view holds it, the press (its receipt), in-place rename, the
 * fold the grid keeps, and the view standing. */
export interface ObjectContext {
  readonly view: 'session' | 'arrangement'
  readonly binding: ClipBinding | null
  readonly press: ObjectRun
  readonly rename: (target: ObjectTarget) => void
  readonly writeClip: (clipId: string, key: string, value: unknown) => Promise<unknown>
  /** Arrangement view's insert marker, where the pane stands one (a point of the ruler, in its units): Split cuts there. */
  readonly marker?: number | null
  /** Arrangement view's time selection, where the pane holds one: Consolidate joins what plays there. */
  readonly span?: {readonly start: number; readonly end: number} | null
  readonly folded?: (trackId: string) => boolean | undefined
  readonly fold?: (trackId: string) => void
  /** The undo list's door (frame/menu/undo.ts): a change the owner took, with its way back. */
  readonly record?: (step: UndoStep) => void
  /** Ask for a text where the object stands (its in-place field, as Rename's): the words naming it and the text it starts from; `done`
   * takes the text kept (Enter, or leaving the field), never one let go (Esc). Edit info text asks through it. */
  readonly ask?: (target: ObjectTarget, field: {readonly label: string; readonly value: string}, done: (text: string) => void) => void
}

/** A change the owner may refuse, recorded for Undo only once it is taken (an answer `{ok: false}` or a throw is a refusal). */
export function undoable(context: Pick<ObjectContext, 'record'>, label: string, run: () => unknown, back: () => unknown): () => Promise<unknown> {
  return async () => {
    const answer = await run()
    if (!(answer && typeof answer === 'object' && (answer as {ok?: unknown}).ok === false)) context.record?.({label, undo: back, redo: run})
    return answer
  }
}

/** The words of an act no owner carries: the operation it waits for, and whose. Pure. */
export function missingAct(op: string, actions: WorldTrackActions | undefined): string {
  const waits = actions?.waiting?.[op]
  return `No owner operation carries it yet — missing op: ${op} (${actions?.owner ?? 'this work\'s owner'}).${waits ? ` It waits for ${waits}.` : ''}`
}

const sep = (id: string): ObjectMenuItem => ({id, type: 'separator'})

/** Whether Clip view's binding holds this clip: its own id, that id with the owner's suffix, or the clip the binding says it holds (a
 * Central page, read as the browser's subject for it). Pure. */
const holdsClip = (binding: ClipBinding | null, clipId: string): binding is ClipBinding =>
  !!binding && (binding.ref === clipId || binding.ref.startsWith(`${clipId}#`) || binding.clip === clipId)

/** A clip's own fact through its Clip view: enabled where the binding takes it (or where Clip view is not holding it yet — it comes
 * forward and the owner answers), disabled with the owner's words where the binding refuses it. Pure. */
function clipFact(binding: ClipBinding | null, clipId: string, key: string): {disabled?: boolean; why?: string} {
  if (!holdsClip(binding, clipId)) return {}
  const refused = binding.standing?.[key]?.disabled
  if (refused) return {disabled: true, why: refused}
  if (!binding.writes?.(key)) return {disabled: true, why: `${key}: a reading — the owner reports it, and nothing in Clip view changes it.`}
  return {}
}

/** One act of the set: live where the set carries its op, else disabled with the op it waits for. Pure. */
function act(id: string, label: string, shortcut: string | undefined, carried: {op: string} | undefined, missing: string, actions: WorldTrackActions | undefined,
  run: () => void, tone?: 'destructive', readOnly = false): ObjectMenuItem {
  const base = {id, label, ...(shortcut ? {shortcut} : {}), ...(tone ? {tone} : {})}
  if (readOnly) return {...base, disabled: true, why: READ_ONLY}
  return carried ? {...base, onSelect: run} : {...base, disabled: true, why: missingAct(missing, actions)}
}

/** Why nothing on a track read from another reading is the set's to change (the spine's firings, a merged reading). */
export const READ_ONLY = 'This track is read from another reading: nothing on it is the set\'s to change.'

/** A clip's menu (Live's clip menu: launch and stop; cut, copy, paste, duplicate, delete; rename, switch off, info; in Arrangement
 * view split, consolidate and crop; the colours). Pure. */
function clipMenu(target: Extract<ObjectTarget, {kind: 'clip'}>, set: WorldTrackSet, context: ObjectContext): ObjectMenuItem[] {
  const a = set.actions
  const readOnly = set.tracks.find(track => track.id === target.trackId)?.readOnly === true
  const {press, binding} = context
  // Its own facts as its Clip view reads them, where Clip view holds this clip.
  const holding = holdsClip(binding, target.id) ? binding : null
  const held = holding ? holding.values : null
  // A clip with no name of its own (Live's Insert MIDI Clip names none) is "the clip" in the words its acts say.
  const named = target.name || 'the clip'
  const fact = (key: string) => readOnly ? {disabled: true, why: READ_ONLY} : clipFact(binding, target.id, key)
  const write = (key: string, value: unknown, was: unknown, what: string) => () => press(`${key}:${target.id}`, what,
    undoable(context, what, () => context.writeClip(target.id, key, value), () => context.writeClip(target.id, key, was)))
  const off = held?.active === false
  const items: ObjectMenuItem[] = []
  if (context.view === 'session') {
    items.push(act('launch', 'Launch', '↵', a?.launch, 'clip.launch', a, () => press(`clip:${target.id}`, `Launch ${named}`, () => a!.launch!.run(target.id)), undefined, readOnly))
    items.push(act('stop', 'Stop', undefined, a?.stopTrack, 'track.stop', a, () => press(`stop:${target.trackId}`, `Stop ${named}`, () => a!.stopTrack!.run(target.trackId)), undefined, readOnly))
    items.push(sep('s1'))
  }
  // Cut and Copy hold the clip for Paste (frame/menu/clipboard.ts), where the set's owner takes a paste.
  const hold = (cut: boolean) => () => press(`${cut ? 'cut' : 'copy'}:${target.id}`, `${cut ? 'Cut' : 'Copy'} ${named}`, () => {
    holdClip({clipId: target.id, name: named, cut})
    return {ok: true, note: `${named} is held: Paste ${cut ? 'moves it to' : 'puts a copy in'} an empty slot.`}
  })
  items.push(act('cut', 'Cut', '⌘X', a?.pasteClip, 'clip.paste', a, hold(true), undefined, readOnly))
  items.push(act('copy', 'Copy', '⌘C', a?.pasteClip, 'clip.paste', a, hold(false), undefined, readOnly))
  items.push(act('duplicate', 'Duplicate', '⌘D', a?.duplicateClip, 'clip.duplicate', a,
    () => press(`duplicate:${target.id}`, `Duplicate ${named}`, () => a!.duplicateClip!.run(target.id)), undefined, readOnly))
  items.push(act('delete', 'Delete', '⌫', a?.deleteClip, 'clip.delete', a,
    () => press(`delete:${target.id}`, `Delete ${named}`, () => a!.deleteClip!.run(target.id)), 'destructive', readOnly))
  items.push(sep('s2'))
  items.push({id: 'rename', label: 'Rename', shortcut: '⌘R', ...fact('name'), onSelect: () => context.rename(target)})
  items.push({id: 'switch-off', label: off ? 'Switch on' : 'Switch off', shortcut: '0', ...fact('active'),
    onSelect: write('active', off, !off, `${off ? 'Switch on' : 'Switch off'} ${named}`)})
  // Edit info text (Live's Edit Info Text): the owner's text, asked for where the clip stands and written back, its way back recorded.
  const info = context.ask ? a?.clipInfo : undefined
  items.push(act('info', 'Edit info text', undefined, info, 'clip.info', a, () => {
    const label = `Edit info text of ${named}`
    void info!.read(target.id).then(current => context.ask!(target, {label: `Info text of ${named}`, value: current},
      text => press(`info:${target.id}`, label, undoable(context, label, () => info!.run(target.id, text), () => info!.run(target.id, current)))),
    (cause: unknown) => press(`info:${target.id}`, label, () => ({ok: false, error: cause instanceof Error ? cause.message : String(cause)})))
  }, undefined, readOnly))
  if (context.view === 'arrangement') {
    items.push(sep('s3'))
    // Split cuts the clip at the insert marker; Consolidate joins what the clip's track plays over the time selection (each the pane's
    // own, handed to the owner); one with no place to act says where to set it, rather than naming an op to build.
    const placed = set.clips.find(clip => clip.id === target.id)?.at
    const marker = context.marker ?? null, span = context.span ?? null
    const split = readOnly ? undefined : a?.splitClip, joins = readOnly ? undefined : a?.consolidateClips
    const inside = marker !== null && placed?.end !== undefined && marker > placed.start && marker < placed.end
    items.push(split && !inside ? {id: 'split', label: 'Split', shortcut: '⌘E', disabled: true,
      why: `Set the insert marker inside ${named} on the ruler: Split cuts it there.`}
      : act('split', 'Split', '⌘E', split, 'clip.split', a, () => press(`split:${target.id}`, `Split ${named}`, () => split!.run(target.id, marker!)), undefined, readOnly))
    const joinRefused = joins?.refuses?.(target.trackId)
    items.push(joins && joinRefused ? {id: 'consolidate', label: 'Consolidate', shortcut: '⌘J', disabled: true, why: joinRefused}
      : joins && !span ? {id: 'consolidate', label: 'Consolidate', shortcut: '⌘J', disabled: true,
        why: 'Select a stretch of the ruler (press to set the insert marker, then Shift-press its other end): Consolidate joins what plays there.'}
      : act('consolidate', 'Consolidate', '⌘J', joins, 'clip.consolidate', a,
        () => press(`consolidate:${target.trackId}`, `Consolidate ${set.tracks.find(t => t.id === target.trackId)?.name ?? 'the track'}`,
          () => joins!.run(target.trackId, span!)), undefined, readOnly))
    items.push(act('crop', 'Crop', '⇧⌘J', undefined, 'clip.crop', a, () => {}, undefined, readOnly))
  }
  // In Central, Open and Reveal the page's file (§10.9): listed only where the set carries them; neither changes the clip.
  if (a?.openFile || a?.revealFile) {
    items.push(sep('s-open'))
    if (a.openFile) items.push(act('open', 'Open', undefined, a.openFile, 'work.open', a, () => press(`open:${target.id}`, `Open ${named}`, () => a.openFile!.run(target.id))))
    if (a.revealFile) items.push(act('reveal', 'Reveal', undefined, a.revealFile, 'work.reveal', a, () => press(`reveal:${target.id}`, `Reveal ${named}`, () => a.revealFile!.run(target.id))))
  }
  // Open in (§18.1 Opening a page: "choose Open in from its menu … A choice the page has nothing for stays closed and says why"; §24.1 "A
  // concern … Opens as: Flow, or Reading as an Expression"): how the clip opens when it is launched, a fact the clip keeps and its Clip
  // view writes (Central: the page owner's launch field, central/clipBinding.ts `opensAs`), read back when Clip view reads the clip
  // again; Launch then opens it so. Listed where Clip view holds the clip and says its ways; the way it opens now is checked.
  const ways = holding?.openIn ?? []
  if (ways.length) {
    items.push(sep('s-open-in'))
    const standing = fact('opensAs')
    const was = ways.find(way => way.chosen)?.way
    for (const way of ways) items.push({id: `open-in:${way.way}`, label: `Open in ${way.label}`, checked: way.chosen,
      ...(way.closed ? {disabled: true, why: way.closed} : standing),
      ...(way.chosen ? {} : {onSelect: write('opensAs', way.way, was ?? null, `Open ${named} in ${way.label}`)})})
  }
  // Show in Browser, for a clip made of a constellation (§10.9; §16.7): the Clip panel's own press, through the clip's binding, so it
  // selects the constellation in the browser — and stands dark, saying why, for a clip made of none. It changes nothing, so a track read
  // from another reading keeps it.
  items.push(sep('s-source'))
  items.push({id: 'show-in-browser', label: 'Show in Browser', ...clipFact(binding, target.id, MADE_OF.show),
    onSelect: () => press(`show:${target.id}`, `Show ${named}'s constellation in the browser`, () => context.writeClip(target.id, MADE_OF.show, Date.now()))})
  // Return to constellation, for an Expressions clip made of one (O-I #742): its Expression saved and attached, so the constellation links
  // to it; dimmed, saying why, in every other mode and for a clip made of none.
  if (holdsClip(binding, target.id) && binding.writes?.(MADE_OF.ret) && binding.standing?.[MADE_OF.ret]?.disabled !== NOT_AN_EXPRESSION)
    items.push({id: 'return-to-constellation', label: 'Return to constellation', ...clipFact(binding, target.id, MADE_OF.ret),
      onSelect: () => press(`return:${target.id}`, `Return ${named} to its constellation`, () => context.writeClip(target.id, MADE_OF.ret, Date.now()))})
  const colour = fact('colour')
  items.push(sep('s4'))
  items.push({id: 'colour', type: 'swatches', label: 'Colour', colours: LIVE_CLIP_PALETTE, current: typeof held?.colour === 'string' ? held.colour : null, ...colour,
    onPick: picked => write('colour', picked, typeof held?.colour === 'string' ? held.colour : null, `Colour ${named}`)()})
  return items
}

/** A track's menu (Live's track menu: rename, colour, duplicate, delete, switch off, solo, arm, group, fold, move). Pure. */
function trackMenu(target: Extract<ObjectTarget, {kind: 'track'}>, set: WorldTrackSet, context: ObjectContext): ObjectMenuItem[] {
  const a = set.actions
  const track = set.tracks.find(t => t.id === target.id)
  const readOnly = track?.readOnly === true
  const {press} = context
  const named = target.name
  const own = <T,>(carried: T | undefined) => readOnly ? undefined : carried
  const mixer = a?.mixer
  const items: ObjectMenuItem[] = [
    act('rename', 'Rename', '⌘R', own(a?.renameTrack), 'track.rename', a, () => context.rename(target)),
    act('duplicate', 'Duplicate', '⌘D', own(a?.duplicateTrack), 'track.duplicate', a,
      () => press(`duplicate-track:${target.id}`, `Duplicate ${named}`, () => a!.duplicateTrack!.run(target.id))),
    act('delete', 'Delete', '⌫', own(a?.removeTrack), 'track.remove', a,
      () => press(`remove:${target.id}`, `Remove ${named}`, () => a!.removeTrack!.run(target.id)), 'destructive'),
    sep('s1'),
    act('switch-off', track?.mix?.activator === false ? 'Switch on' : 'Switch off', '0', own(mixer?.activator), 'track.activator', a,
      () => press(`mix:activator:${target.id}`, `Switch ${named}`, undoable(context, `Switch ${named}`, () => mixer!.activator!.run(target.id, track?.mix?.activator === false),
        () => mixer!.activator!.run(target.id, track?.mix?.activator !== false)))),
    act('solo', track?.mix?.solo ? 'Unsolo' : 'Solo', undefined, own(mixer?.solo), 'track.solo', a,
      () => press(`mix:solo:${target.id}`, `Solo ${named}`, undoable(context, `Solo ${named}`, () => mixer!.solo!.run(target.id, !track?.mix?.solo),
        () => mixer!.solo!.run(target.id, !!track?.mix?.solo)))),
    act('arm', track?.mix?.arm ? 'Disarm' : 'Arm', undefined, own(mixer?.arm), 'track.arm', a,
      () => press(`mix:arm:${target.id}`, `Arm ${named}`, undoable(context, `Arm ${named}`, () => mixer!.arm!.run(target.id, !track?.mix?.arm),
        () => mixer!.arm!.run(target.id, !!track?.mix?.arm)))),
    sep('s2'),
    act('group', 'Group', '⌘G', own(a?.groupTracks), 'tracks.group', a,
      () => press(`group:${target.id}`, `Group ${named}`, () => a!.groupTracks!.run([target.id]))),
  ]
  if (context.fold && set.tracks.some(t => t.parentId === target.id)) {
    const folded = context.folded?.(target.id) === true
    items.push({id: 'fold', label: folded ? 'Unfold' : 'Fold', shortcut: 'U', onSelect: () => context.fold!(target.id)})
  }
  const move = (by: -1 | 1) => () => press(`move:${target.id}`, `Move ${named} ${by < 0 ? 'left' : 'right'}`,
    undoable(context, `Move ${named} ${by < 0 ? 'left' : 'right'}`, () => a!.moveTrack!.run(target.id, by), () => a!.moveTrack!.run(neighbour(by), (-by) as -1 | 1)))
  /** Where the track stands once moved, for a set whose track ids are places (Live's: als:…#track/<i>): its neighbour's on that side,
   * from which Undo moves it back. */
  const neighbour = (by: -1 | 1) => {
    const order = set.tracks.filter(t => !t.main && !t.returns)
    return order[order.findIndex(t => t.id === target.id) + by]?.id ?? target.id
  }
  items.push(act('move-left', 'Move left', '⌘←', own(a?.moveTrack), 'track.move', a, move(-1)))
  items.push(act('move-right', 'Move right', '⌘→', own(a?.moveTrack), 'track.move', a, move(1)))
  if (a?.retry && !readOnly) items.push(sep('s3'), {id: 'retry', label: 'Retry', onSelect: () => press(`retry:${target.id}`, `Retry ${named}`, () => a.retry!.run(target.id))})
  // Edit info text on a track (Live's Edit Info Text; Expressions: the Expression's description, manual §20.1 The track): listed only where
  // the set carries it; the owner's text, asked for where the track stands and written back, its way back recorded.
  const info = context.ask && !readOnly ? a?.trackInfo : undefined
  if (info) items.push({id: 'info', label: 'Edit info text', onSelect: () => {
    const label = `Edit info text of ${named}`
    void info.read(target.id).then(current => context.ask!(target, {label: `Info text of ${named}`, value: current},
      text => press(`info:${target.id}`, label, undoable(context, label, () => info.run(target.id, text), () => info.run(target.id, current)))),
    (cause: unknown) => press(`info:${target.id}`, label, () => ({ok: false, error: cause instanceof Error ? cause.message : String(cause)})))
  }})
  else if (a?.waiting?.['track.info']) items.push({id: 'info', label: 'Edit info text', disabled: true, why: `The info text is not read here yet: it waits for ${a.waiting['track.info']}.`})
  // In Central, Open and Reveal the world's folder (§10.9): listed only where the set carries them; neither changes the track.
  if (a?.openFolder || a?.revealFolder) {
    items.push(sep('s-open'))
    if (a.openFolder) items.push(act('open', 'Open', undefined, a.openFolder, 'work.open', a, () => press(`open:${target.id}`, `Open ${named}'s folder`, () => a.openFolder!.run(target.id))))
    if (a.revealFolder) items.push(act('reveal', 'Reveal', undefined, a.revealFolder, 'work.reveal', a, () => press(`reveal:${target.id}`, `Reveal ${named}'s folder`, () => a.revealFolder!.run(target.id))))
  }
  items.push(sep('s4'))
  items.push({id: 'colour', type: 'swatches', label: 'Colour', colours: LIVE_CLIP_PALETTE, current: track?.color ?? null,
    ...(own(a?.colourTrack) ? {} : {disabled: true, why: missingAct('track.colour', a)}),
    onPick: picked => press(`colour:${target.id}`, `Colour ${named}`, () => a!.colourTrack!.run(target.id, picked))})
  return items
}

/** An empty slot's menu (Live: insert a clip, paste, record on an armed track, the slot's stop button). Pure. */
function slotMenu(target: Extract<ObjectTarget, {kind: 'slot'}>, set: WorldTrackSet, context: ObjectContext): ObjectMenuItem[] {
  const a = set.actions
  const track = set.tracks.find(t => t.id === target.trackId)
  const readOnly = track?.readOnly === true
  const {press} = context
  const own = <T,>(carried: T | undefined) => readOnly ? undefined : carried
  // Paste takes the clip Copy or Cut held (frame/menu/clipboard.ts); with nothing held it says so, rather than naming an op to build.
  const held = heldClip()
  const pasting = own(a?.pasteClip)
  const paste: ObjectMenuItem = pasting && !held
    ? {id: 'paste', label: 'Paste', shortcut: '⌘V', disabled: true, why: 'Nothing is held: Copy or Cut a clip first, and Paste puts it here.'}
    : act('paste', 'Paste', '⌘V', pasting, 'clip.paste', a, () => press(`paste:${target.trackId}:${target.rowId}`, `Paste ${held!.name} on ${target.name}`, () => {
      if (held!.cut) holdClip(null)
      return a!.pasteClip!.run(held!.clipId, target.trackId, target.rowId, held!.cut)
    }))
  // The slot's stop button (Live: Remove Stop Button, and Add Stop Button where it was removed), its way back recorded for Undo.
  const stopless = track?.stopless?.includes(target.rowId) === true
  const button = stopless ? 'Add stop button' : 'Remove stop button'
  return [
    act('insert', 'Insert clip', '⇧⌘M', own(a?.insertClip), 'clip.insert', a,
      () => press(`insert:${target.trackId}:${target.rowId}`, `Insert a clip on ${target.name}`, () => a!.insertClip!.run(target.trackId, target.rowId))),
    paste,
    ...(track?.mix?.arm === true ? [act('record', 'Record here', undefined, own(a?.recordSlot), 'slot.record', a,
      () => press(`rec:${target.trackId}:${target.rowId}`, `Record on ${target.name}`, () => a!.recordSlot!.run(target.trackId, target.rowId)))] : []),
    act('stop', 'Stop the track', undefined, own(a?.stopTrack), 'track.stop', a,
      () => press(`stop:${target.trackId}:${target.rowId}`, `Stop ${target.name}`, () => a!.stopTrack!.run(target.trackId))),
    act('stop-button', button, '⌘E', own(a?.stopButton), 'slot.stop-button', a,
      () => press(`stop-button:${target.trackId}:${target.rowId}`, `${button} on ${target.name}`,
        undoable(context, `${button} on ${target.name}`, () => a!.stopButton!.run(target.trackId, target.rowId, stopless),
          () => a!.stopButton!.run(target.trackId, target.rowId, !stopless)))),
  ]
}

/** A row's menu (Live's scene menu: launch, insert, rename, duplicate, delete, the Main track's stop all). Pure. */
function rowMenu(target: Extract<ObjectTarget, {kind: 'row'}>, set: WorldTrackSet, context: ObjectContext): ObjectMenuItem[] {
  const a = set.actions
  const {press} = context
  return [
    act('launch', 'Launch', '↵', a?.launchStop, 'row.launch', a, () => press(`row:${target.id}`, `Launch row ${target.name}`, () => a!.launchStop!.run(target.id))),
    act('stop-all', 'Stop all clips', undefined, a?.stopAll, 'set.stop-all', a, () => press('stop-all', 'Stop All', () => a!.stopAll!.run())),
    sep('s1'),
    act('insert', 'Insert row', '⌘I', a?.insertRow, 'row.insert', a, () => press(`insert-row:${target.id}`, 'Insert a row', () => a!.insertRow!.run(target.id))),
    act('rename', 'Rename', '⌘R', a?.renameRow, 'row.rename', a, () => context.rename(target)),
    act('duplicate', 'Duplicate', '⌘D', a?.duplicateRow, 'row.duplicate', a, () => press(`duplicate-row:${target.id}`, `Duplicate row ${target.name}`, () => a!.duplicateRow!.run(target.id))),
    act('delete', 'Delete', '⌫', a?.deleteRow, 'row.delete', a, () => press(`delete-row:${target.id}`, `Delete row ${target.name}`, () => a!.deleteRow!.run(target.id)), 'destructive'),
  ]
}

/** An object on a track read from another reading: every act that would change it says so (folding is the view's, and stays, as do Open
 * and Reveal, which change nothing). Pure. */
const readOnlyItems = (items: ObjectMenuItem[]): ObjectMenuItem[] =>
  items.map(item => item.type === 'separator' || item.id === 'fold' || OPENS.has(item.id) ? item : {...item, disabled: true, why: READ_ONLY} as ObjectMenuItem)
/** Open and Reveal change nothing (§10.9 "Neither changes the world"), so a track read from another reading keeps them. */
const OPENS = new Set(['open', 'reveal'])

/** The object's acts, as its menu lists them. Pure. */
export function objectMenu(target: ObjectTarget, set: WorldTrackSet, context: ObjectContext): ObjectMenuItem[] {
  const readOnly = (trackId: string) => set.tracks.find(track => track.id === trackId)?.readOnly === true
  switch (target.kind) {
    case 'clip': return clipMenu(target, set, context)
    case 'track': return readOnly(target.id) ? readOnlyItems(trackMenu(target, set, context)) : trackMenu(target, set, context)
    case 'slot': return readOnly(target.trackId) ? readOnlyItems(slotMenu(target, set, context)) : slotMenu(target, set, context)
    case 'row': return rowMenu(target, set, context)
  }
}

/** The key an object act answers to (Live's keys, manual §10.8), or null. Pure. */
export function objectKeyAct(event: {readonly key: string; readonly code?: string; readonly metaKey: boolean; readonly shiftKey: boolean; readonly altKey: boolean;
  readonly ctrlKey: boolean}): string | null {
  if (event.ctrlKey || event.altKey) return null
  const key = event.key.toLowerCase()
  if (event.metaKey && !event.shiftKey) {
    if (key === 'r') return 'rename'
    if (key === 'd') return 'duplicate'
    if (key === 'g') return 'group'
    if (key === 'i') return 'insert'
    if (key === 'e') return 'split'
    if (key === 'j') return 'consolidate'
    if (event.key === 'ArrowLeft') return 'move-left'
    if (event.key === 'ArrowRight') return 'move-right'
    return null
  }
  if (event.metaKey && event.shiftKey) {
    if (key === 'j') return 'crop'
    if (key === 'm') return 'insert'
    return null
  }
  if (event.shiftKey) return null
  if (event.key === 'Delete' || event.key === 'Backspace') return 'delete'
  // 0 and U act only where the selection takes them, and pass on otherwise (0 to the tenth row, U to the playing keys). Live's S and C
  // (solo and arm) stay in the menu: C is a macro key here and S a note of the Jankó surface (frame/keys/keyMap.ts).
  if (event.key === '0') return 'switch-off'
  if (key === 'u') return 'fold'
  return null
}

/** The menu entry a key runs, among the object's entries: the one with that id, when it can run. Pure. */
export function entryForKey(items: readonly ObjectMenuItem[], id: string): Extract<ObjectMenuItem, {onSelect?: unknown}> | null {
  const item = items.find(entry => entry.id === id)
  if (!item || item.type === 'separator' || item.type === 'swatches') return null
  return item
}
