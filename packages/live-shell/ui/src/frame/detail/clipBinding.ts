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
// "no owner operation carries it yet — missing op: … (Owner)". A key no owner reports reaches the view absent. Pure, apart from the
// view holds' one store (keyed by clip, so the detail area and the expanded Clip view show the same tabs).
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
}): ClipBinding {
  const id = clipHostId(input.mode, input.ref)
  const held = viewHoldsOf(id)
  const values: Record<string, Value> = {...input.values}
  const isView = (key: string) => TAB_KEYS.includes(key) || find(input.wiring.view, key) !== undefined
  for (const [key, value] of Object.entries(input.viewDefaults ?? {})) if (isView(key)) values[key] = value
  for (const [key, value] of Object.entries(held)) values[key] = value
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(input.wiring.refused)) if (!key.endsWith('*')) standing[key] = {disabled: why}
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
    // A write the owner takes and a refused one both reach `write`, so the refusal is said in the wiring's own words.
    writes: key => key in input.wiring.acts || find(input.wiring.refused, key) !== undefined,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        const refused = find(input.wiring.refused, key)
        if (refused) throw new Error(refused)
        const act = input.wiring.acts[key]
        if (!act) throw new Error(READING(key))
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
