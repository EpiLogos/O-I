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
}): ClipBinding {
  const id = clipHostId(input.mode, input.ref)
  const held = viewHoldsOf(id)
  const values: Record<string, Value> = {...input.values}
  const isView = (key: string) => TAB_KEYS.includes(key) || find(input.wiring.view, key) !== undefined
  for (const [key, value] of Object.entries(input.viewDefaults ?? {})) if (isView(key)) values[key] = value
  for (const [key, value] of Object.entries(held)) values[key] = value
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(input.wiring.refused)) if (!key.endsWith('*')) standing[key] = {disabled: why}
  const movedBy = readingsMoved(id, input.values, Object.keys(input.wiring.acts))
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
        sentHere(id, key, value)
        await act(value)
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
 * the name with the ring of a change; DLW build ruling 2026-11-09, round 48 item 0C-1). */
export const ANOTHER_HAND = 'another hand'

/** One value's trail in this panel: the owner's last reading of it, the values this panel sent that the owner has not answered yet (in
 * the order sent), and who moved it, where a reading was not this panel's. */
interface Trail {readonly reading: Value | undefined; readonly pending: readonly Value[]; readonly movedBy?: string}
const trails = new Map<string, Map<string, Trail>>()
const trailOf = (id: string): Map<string, Trail> => { let held = trails.get(id); if (!held) trails.set(id, held = new Map()); return held }
/** One reading and one value sent, as the owner gives it back: a number a hair off in the owner's own units (a clip's linear gain drawn
 * in dB) is the same. */
const same = (a: Value | undefined, b: Value | undefined): boolean =>
  a === b || (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)))

/** This panel sends `value` for `key`: the owner's answer to it is no move, and the name of a move before it goes (the hand moved it
 * last). */
function sentHere(id: string, key: string, value: Value): void {
  const trail = trailOf(id), was = trail.get(key)
  trail.set(key, {reading: was?.reading, pending: [...(was?.pending ?? []), value]})
}

/** Who moved each of `keys` since the panel last read it: a reading that is neither the one read before nor the answer to a send of this
 * panel still pending was moved by another hand. The owner answers in the order it was asked, so an answer to a send also answers every
 * send before it. The first reading of a value is no move. */
function readingsMoved(id: string, values: Values, keys: readonly string[]): Record<string, string> {
  const trail = trailOf(id), moved: Record<string, string> = {}
  for (const key of keys) {
    const now = values[key], was = trail.get(key)
    if (!was) { trail.set(key, {reading: now, pending: []}); continue }
    if (same(was.reading, now)) { if (was.movedBy) moved[key] = was.movedBy; continue }
    const answered = was.pending.findIndex(value => same(value, now))
    if (answered >= 0) { trail.set(key, {reading: now, pending: was.pending.slice(answered + 1)}); continue }
    trail.set(key, {reading: now, pending: [], movedBy: ANOTHER_HAND})
    moved[key] = ANOTHER_HAND
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
