// The clip binding: one clip's values, standing and change path, as the shell hands them to the one clip host (manual §16.5
// "Select a clip and the detail area shows it. Clip view shows the clip and its editor"). Mirrors the device side's DesignBinding
// (frame/devices/designed.ts: values, writes, standing, the view's own hands) and is hosted by the same host law
// (frame/devices/deviceHost.tsx HostedDevice: a change goes to the owner when the hand lets go, waits in italics, a refusal says the
// owner's words on the Info line). What a clip adds to a device's binding: which mode's designed clip draws it
// (inhabitants/catalogue/clips/index.ts loadClip), the clip's own ref (its view holds are kept by it), whether it is placed rather
// than launched (Live's Arrangement clip, cap 47; a Central page: no Launch tab), and the tabs it lacks (an audio clip has no Notes).
//
// Owners write; faces read (lock §0.4). A wiring (ClipWiring) names every key of a clip's design: a reading of the owner, a write
// the owner takes, a key the view holds (which tab shows, a fold, the tool's own settings), or a refusal in the owner's terms —
// "no owner operation carries it yet — missing op: … (Owner)". A key no owner reports reaches the view absent. Pure, apart from two
// stores keyed by clip: the view holds (so the detail area and the expanded Clip view show the same tabs), and what this panel sent and
// last read of each value the owner takes, so a move that was not this panel's own send is named (`movedBy`).
import {useSyncExternalStore} from 'react'
import {onKeyRunsEnd} from '../../inhabitants/sdk/panel'
import {CONFIRM_GRACE_MS} from '../devices/deviceHost'
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../devices/designed'
import {TAB_KEY, type ClipMode, type ClipTab, type DesignedClip} from '../../inhabitants/catalogue/clips/design'

export type {Value, Values, ValueChange, Standing}

export interface ClipBinding extends DesignBinding {
  /** The mode whose designed clip draws it (`clip:<mode>`). */
  readonly mode: ClipMode
  /** The clip's own ref (THE selection's): its view holds are kept by it. */
  readonly ref: string
  /** Placed, not launched: an Arrangement clip (Live cap 47), a Central page. Clip view has no Launch tab. */
  readonly placed?: boolean
  /** Tabs of the design this clip lacks, by id (an audio clip has no Notes, no MPE and no MIDI tools): Clip view leaves them out. */
  readonly lacks?: readonly string[]
  /** The set's clip this binding holds, where the clip's id on the track is not the binding's ref: a Central page selected on a world's
   * track is the browser's subject (`subject:note:<path>`), and its clip is the page's Central-relative path. */
  readonly clip?: string
  /** Open in (manual §18.1 "choose Open in from its menu"): the ways the clip opens when it is launched, as its page keeps them, each
   * written through this binding's `opensAs`. A choice the clip has nothing for stays closed and says why. Absent: the clip has none. */
  readonly openIn?: readonly OpenInChoice[]
}

/** One way a clip opens when it is launched, for its Open in menu. */
export interface OpenInChoice {
  /** The value the clip's `opensAs` takes. */
  readonly way: string
  /** The way's name, as the menu says it after "Open in". */
  readonly label: string
  /** Whether the clip opens this way now, as its owner read it. */
  readonly chosen: boolean
  /** Why the clip has nothing for this way, in its owner's words: the choice stays closed. */
  readonly closed?: string
}

/** The three keys that hold which tab each place shows (clips/design.ts TAB_KEY): always the view's. */
export const TAB_KEYS: readonly string[] = [TAB_KEY.panel, TAB_KEY.tools, TAB_KEY.editor]

/** The owner's words for a change no owner operation carries yet (taskBindings.ts `missing`, the same sentence on every side). */
export const missingOp = (what: string, op: string, owner: string): string => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`

/** A key's pattern: the key itself, or a prefix ending in `*` (`arp.*`, `env.*`). */
const matches = (pattern: string, key: string): boolean => (pattern.endsWith('*') ? key.startsWith(pattern.slice(0, -1)) : pattern === key)
const find = <T,>(table: Readonly<Record<string, T>>, key: string): T | undefined => {
  if (key in table) return table[key]
  for (const [pattern, value] of Object.entries(table)) if (pattern.endsWith('*') && matches(pattern, key)) return value
  return undefined
}

/** One clip design's wiring to its owners: every key the design draws or sets is a reading, a write, the view's, or refused. */
export interface ClipWiring {
  /** key → the owner reading that fills it (documentation; the values carry the readings). */
  readonly reads: Readonly<Record<string, string>>
  /** key → the owner write it goes through: the act receives the value the hand set and resolves when the owner answered, or throws
   * the owner's own words. */
  readonly acts: Readonly<Record<string, (value: Value) => Promise<void>>>
  /** key (or `prefix*`) → why the view holds it: it changes only how Clip view shows the clip. */
  readonly view: Readonly<Record<string, string>>
  /** key (or `prefix*`) → why no owner takes a change of it: the change is refused in these words. */
  readonly refused: Readonly<Record<string, string>>
  /** key (or `prefix*`) → why no owner reports it: the view draws "—" (documentation; such a key is simply left out of the values). */
  readonly absent?: Readonly<Record<string, string>>
}

/** Every key the wiring names: read, written, the view's, refused or absent. */
export const wiredKey = (wiring: ClipWiring, key: string): boolean =>
  key in wiring.reads || key in wiring.acts || find(wiring.view, key) !== undefined || find(wiring.refused, key) !== undefined
  || find(wiring.absent ?? {}, key) !== undefined || TAB_KEYS.includes(key)

/** The words for a change of a pure reading. */
export const READING = (key: string): string => `${key}: a reading — the owner reports it, and nothing in Clip view changes it.`

/** A clip's binding over its wiring: the owner's readings with the view's own keys laid over them, the writes the owner takes, the
 * refusals in the owner's words (each control that spreads its standing stands disabled with them), and the view's hands. */
export function clipBinding(input: {
  readonly mode: ClipMode
  readonly ref: string
  readonly values: Values
  readonly wiring: ClipWiring
  readonly placed?: boolean
  readonly lacks?: readonly string[]
  /** The view's starting value of a key it holds, until the hand moves it (a fold, the tab a clip opens on). */
  readonly viewDefaults?: Readonly<Record<string, Value>>
  readonly clip?: string
  readonly openIn?: readonly OpenInChoice[]
  /** A call that reads no clip (Expressions asks its view's holds through one with no values before it reads the scene): it reads and
   * keeps no trail of who moved what (DLW build ruling 2026-11-09, 0D item 3). */
  readonly quiet?: boolean
}): ClipBinding {
  const id = clipHostId(input.mode, input.ref)
  const held = viewHoldsOf(id)
  const values: Record<string, Value> = {...input.values}
  const isView = (key: string) => TAB_KEYS.includes(key) || find(input.wiring.view, key) !== undefined
  for (const [key, value] of Object.entries(input.viewDefaults ?? {})) if (isView(key)) values[key] = value
  for (const [key, value] of Object.entries(held)) values[key] = value
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(input.wiring.refused)) if (!key.endsWith('*')) standing[key] = {disabled: why}
  const movedBy = input.quiet ? {} : readingsMoved(id, input.values, Object.keys(input.wiring.acts))
  // The view's keys: each set goes to the hold at once (DesignBinding.local), never to an owner.
  const local = new Proxy({} as Record<string, (value: Value | undefined) => void>, {
    get: (_, key) => typeof key === 'string' && isView(key) ? (value: Value | undefined) => setViewHold(id, key, value) : undefined,
    has: (_, key) => typeof key === 'string' && isView(key),
    ownKeys: () => [...new Set([...TAB_KEYS, ...Object.keys(input.wiring.view).filter(key => !key.endsWith('*')), ...Object.keys(held)])],
    getOwnPropertyDescriptor: (_, key) => typeof key === 'string' && isView(key) ? {enumerable: true, configurable: true, writable: false,
      value: (value: Value | undefined) => setViewHold(id, key, value)} : undefined,
  })
  return {
    id,
    mode: input.mode,
    ref: input.ref,
    values,
    standing,
    local,
    ...(input.placed ? {placed: true} : {}),
    ...(input.lacks?.length ? {lacks: input.lacks} : {}),
    ...(input.clip ? {clip: input.clip} : {}),
    ...(input.openIn?.length ? {openIn: input.openIn} : {}),
    ...(Object.keys(movedBy).length ? {movedBy} : {}),
    // A write the owner takes and a refused one both reach `write`, so the refusal is said in the wiring's own words.
    writes: key => key in input.wiring.acts || find(input.wiring.refused, key) !== undefined,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        const refused = find(input.wiring.refused, key)
        if (refused) throw new Error(refused)
        const act = input.wiring.acts[key]
        if (!act) throw new Error(READING(key))
        const sent = sentHere(id, key, value)
        try {
          await act(value)
        } catch (cause) {
          // Refused: the owner will give no answer to it (0D item 5).
          dropSent(id, key, sent)
          throw cause
        }
        sent.at = Date.now()
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the shape

/** The designed clip as this clip draws it: the tabs it lacks left out, and no Launch tab where it is placed (manual §16.5 "What a
 * clip lacks, Clip view leaves out"; "A clip on Arrangement view's ruler has no Launch tab, as in Live"). Pure. */
export function clipShape(design: DesignedClip, binding: Pick<ClipBinding, 'placed' | 'lacks'>): DesignedClip {
  const lacks = new Set([...(binding.lacks ?? []), ...(binding.placed ? ['launch'] : [])])
  if (!lacks.size) return design
  const keep = (tabs: readonly ClipTab[]) => tabs.filter(tab => !lacks.has(tab.id))
  return {...design, panel: keep(design.panel), tools: keep(design.tools), editor: keep(design.editor)}
}

/** The host's id of one clip: its mode and its ref. */
export const clipHostId = (mode: ClipMode, ref: string): string => `clip:${mode}:${ref}`

// ---------------------------------------------------------------------------------------------------------------- who moved it

/** The name a clip's control shows when its value moved and this panel did not move it: the owner cannot say who did (manual §16.10,
 * the name with the ring of a change; DLW build ruling 2026-11-09, round 48 item 0C-1). A second move of the value by another hand is
 * "another hand 2", and so on, so two moves read apart and each ends the kit's run of key steps (0D item 6). */
export const ANOTHER_HAND = 'another hand'
const anotherHand = (moves: number): string => (moves > 1 ? `${ANOTHER_HAND} ${moves}` : ANOTHER_HAND)

/** One send of this panel the owner has not answered: its value, and when its write resolved (absent while the write is in flight). */
interface Pending {readonly value: Value; at?: number}
/** One value's trail in this panel: the owner's last reading of it, the sends of this panel the owner has not answered yet (in the order
 * sent), who moved it where a reading was not this panel's, and how many moves of other hands it has read. */
interface Trail {readonly reading: Value | undefined; readonly pending: readonly Pending[]; readonly movedBy?: string; readonly moves: number}
/** The trails of the clips read most lately: a clip read again after TRAILS_KEPT others starts a trail afresh (0D item 5). */
const TRAILS_KEPT = 64
const trails = new Map<string, Map<string, Trail>>()
const trailOf = (id: string): Map<string, Trail> => {
  const held = trails.get(id) ?? new Map<string, Trail>()
  trails.delete(id)
  trails.set(id, held)
  for (const old of trails.keys()) { if (trails.size <= TRAILS_KEPT) break; trails.delete(old) }
  return held
}
/** An undo or a redo changes values as the owner's own (frame/menu/undo.ts): what it leaves is no other hand's, so every trail starts
 * afresh from the reading after it (0D item 3). */
onKeyRunsEnd(() => trails.clear())

/** Keys the owner keeps together: a send of one moves the others (a clip's Length moves its End). */
const LINKED: readonly (readonly string[])[] = [['start', 'end', 'length', 'position']]

const near = (a: number, b: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
const alike = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') return near(a, b)
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => alike(x, b[i]))
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>, keys = Object.keys(x)
  return keys.length === Object.keys(y).length && keys.every(key => key in y && alike(x[key], y[key]))
}
const parsed = (text: string): unknown => { try { return JSON.parse(text) } catch { return undefined } }
/** One reading and one value sent, as the owner gives it back: a number a hair off in the owner's own units (a clip's linear gain drawn
 * in dB) is the same, and so is a reading kept as JSON (an envelope's points, `env.mixer.*`) whose numbers are each a hair off (0D item
 * 3). */
const same = (a: Value | undefined, b: Value | undefined): boolean => {
  if (a === b) return true
  if (typeof a !== 'string' || typeof b !== 'string') return alike(a, b)
  const x = parsed(a), y = parsed(b)
  return x !== undefined && y !== undefined && alike(x, y)
}

/** This panel sends `value` for `key`: the owner's answer to it is no move, and the name of a move before it goes (the hand moved it
 * last). Answers the send, so its write can mark when it resolved, or drop it where it was refused. */
function sentHere(id: string, key: string, value: Value): Pending {
  const trail = trailOf(id), was = trail.get(key), sent: Pending = {value}
  trail.set(key, {reading: was?.reading, pending: [...(was?.pending ?? []), sent], moves: was?.moves ?? 0})
  return sent
}
function dropSent(id: string, key: string, sent: Pending): void {
  const trail = trails.get(id), was = trail?.get(key)
  if (trail && was) trail.set(key, {...was, pending: was.pending.filter(pending => pending !== sent)})
}

/** Who moved each of `keys` since the panel last read it: a reading that is neither the one read before nor the answer to a send of this
 * panel still awaited was moved by another hand. The owner answers in the order it was asked, so an answer to a send also answers every
 * send before it. A send is awaited while its write is in flight and for CONFIRM_GRACE_MS after it resolved, as the host waits for it
 * (0D item 5). No reading is no move, and the first reading of a value is none either; a linked key the owner moves in a reading while
 * a send of this panel to its group is awaited is this panel's own (0D item 3). */
function readingsMoved(id: string, values: Values, keys: readonly string[]): Record<string, string> {
  const trail = trailOf(id), moved: Record<string, string> = {}, at = Date.now()
  const awaited = (was: Trail | undefined): readonly Pending[] =>
    (was?.pending ?? []).filter(pending => pending.at === undefined || at - pending.at <= CONFIRM_GRACE_MS)
  const linked = new Set(LINKED.filter(group => group.some(key => awaited(trail.get(key)).length)).flat())
  for (const key of keys) {
    const now = values[key]
    if (now === undefined) continue
    const was = trail.get(key), pending = awaited(was)
    if (!was) { trail.set(key, {reading: now, pending: [], moves: 0}); continue }
    if (same(was.reading, now)) { trail.set(key, {...was, pending}); if (was.movedBy) moved[key] = was.movedBy; continue }
    const answered = pending.findIndex(sent => same(sent.value, now))
    if (answered >= 0) { trail.set(key, {reading: now, pending: pending.slice(answered + 1), moves: was.moves}); continue }
    if (was.reading === undefined || linked.has(key)) { trail.set(key, {reading: now, pending, moves: was.moves}); continue }
    const by = anotherHand(was.moves + 1)
    trail.set(key, {reading: now, pending: [], movedBy: by, moves: was.moves + 1})
    moved[key] = by
  }
  return moved
}

// ---------------------------------------------------------------------------------------------------------------- the view's holds

type Holds = Readonly<Record<string, Value>>
const holds = new Map<string, Holds>()
const listeners = new Set<() => void>()
let version = 0

export function viewHoldsOf(id: string): Holds { return holds.get(id) ?? {} }
export function setViewHold(id: string, key: string, value: Value | undefined): void {
  const was = viewHoldsOf(id)
  if (was[key] === value) return
  const next: Record<string, Value> = {...was}
  if (value === undefined) delete next[key]; else next[key] = value
  holds.set(id, next)
  version++
  for (const listener of listeners) listener()
}
export function resetViewHolds(): void { holds.clear(); version++; for (const listener of listeners) listener() }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
/** Re-read when any clip's view holds move (a binding hook reads its holds through clipBinding, so it re-renders on this). */
export const useViewHoldsVersion = (): number => useSyncExternalStore(subscribe, () => version, () => version)
