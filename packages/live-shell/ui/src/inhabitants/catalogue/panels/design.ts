// A designed device: its six views, each drawn from one set of values (manual §16.3). The host owns the values, the navigation
// and the room each view stands in; a view only reads them and asks for changes. The gallery hosts the reference devices on a
// labelled fixture; the shell hosts the same views on the owner's values and writes (frame/devices/designed.ts, the
// DesignBinding).
//
// Two rules make a design bindable:
// - Everything a view draws comes from `v`. Material the picture shows (entries, rows, names, lists) is a value key — a JSON
//   string for structured content — and its sample content sits in `defaults` or `fixtures`, never in a module constant.
// - A key the owner has not reported reaches a view absent. A view never turns an absent key into drawn text: it hands the kit
//   undefined (the kit draws "—" with the No-reading standing) and names the missing reading in its well. Never num()/str() of
//   an absent key into SVG text, a corner or a folded reading; use the helpers below, which keep absence absent.
import type {ReactNode} from 'react'
import type {Standing} from '../../sdk/panel'

export type Value = number | string | boolean
export type Values = Readonly<Record<string, Value>>

export interface Nav {
  /** Show the device whole in the pool (the press on a chain plate). */
  readonly select?: () => void
  /** Show the device's expanded view: Whole as a band across the detail area, above the chain (Live's Toggle Expanded View);
   * pressed again, it hides. The panes above shrink to make room. The frame is 'flip'. */
  readonly expand?: () => void
  /** Open the device full size in a pane. */
  readonly full?: () => void
  /** Pop the device out into its own window: its material with every control (Live's plug-in window). */
  readonly popout?: () => void
  readonly fold?: () => void
  readonly unfold?: () => void
  /** Keep the device on the widget rail. */
  readonly rail?: () => void
  /** Take the device off the rail (its tile's ✕). */
  readonly close?: () => void
  /** The place's own marks for the head, before ⤢. The host also gives these, with rail and close, through the kit's
   * PlaceContext, so a view need not pass them on. */
  readonly marks?: ReactNode
}

export interface ViewProps {
  readonly v: Values
  readonly set: (key: string, value: Value | undefined) => void
  readonly nav: Nav
  /** The page shown in the head, where the device has pages. */
  readonly page: string
  readonly setPage: (page: string) => void
  /** The standing of each value by key (manual §16.11: waiting, refused, held, automated, modulated, disabled). */
  readonly standing?: Readonly<Record<string, Standing>>
  /** The owner's readings alone, without what the hand holds or what waits on the owner: a light reads these. */
  readonly owner?: Values
  /** The room the host gives this view, in px at 100 %. Whole stands in the pool (400 wide) or expanded above the chain (the
   * detail area's width, up to the panes' height); Full in a pane; Pop-out in its window. A view may grow its display into the
   * room; its controls keep their size. Absent: draw at the standard measures. */
  readonly room?: Room
  /** Where this view stands, for a view that arranges itself differently in each (Whole in the pool or expanded: frame 'flip'). */
  readonly frame?: Frame
  /** A rack's door to its members: the host draws the device `id` (`<family>:<face>`) in its Whole view at the pool's measures,
   * on that device's own owner, with every setting live. A rack's Full is its devices (manual §16.3): it lays them out and draws
   * only its own head and order. The door answers null for a device the host does not hold, and is absent where the host draws
   * no members; the rack draws its own stand-in for that member then. */
  readonly member?: (id: string) => ReactNode | null
}

export interface Room {readonly w: number; readonly h: number}
export type Frame = 'chain' | 'flip' | 'pane' | 'window' | 'rail'
/** The six views (manual §16.3). */
export type ViewName = 'folded' | 'compact' | 'whole' | 'full' | 'popout' | 'widget'

export interface DesignedDevice {
  /** `<family>:<face>`, as the manual's catalogue embeds it. */
  readonly id: string
  readonly title: string
  readonly kind: 'instrument' | 'effect' | 'rack'
  readonly defaults: Values
  /** Named readings to try the device on, each laid over the defaults (the gallery's fixture switch). A key set to undefined
   * drops that reading, as an owner that reports nothing for it would. */
  readonly fixtures?: Readonly<Record<string, Readonly<Record<string, Value | undefined>>>>
  readonly firstPage?: string
  readonly folded: (p: ViewProps) => ReactNode
  readonly compact: (p: ViewProps) => ReactNode
  readonly whole: (p: ViewProps) => ReactNode
  readonly full: (p: ViewProps) => ReactNode
  /** The device in its own window, which can fill the screen: the material, with every control docked under it. Absent, the
   * host draws Full over Whole (`popout.tsx`), which most devices need; a device writes its own only where its controls
   * belong beside the material rather than under it. */
  readonly popout?: (p: ViewProps) => ReactNode
  readonly widget: (p: ViewProps) => ReactNode
}

export const num = (v: Values, key: string) => Number(v[key])
export const str = (v: Values, key: string) => String(v[key])
export const on = (v: Values, key: string) => v[key] === true

/** What a view draws where a reading is absent. */
export const NONE = '—'
/** Whether the owner reported this key. */
export const has = (v: Values, key: string) => v[key] !== undefined && v[key] !== null && !(typeof v[key] === 'number' && Number.isNaN(v[key]))
/** A number, or undefined when absent (hand it to the kit, which draws "—"). */
export const numOf = (v: Values, key: string): number | undefined => (has(v, key) ? Number(v[key]) : undefined)
/** A string, or undefined when absent. */
export const strOf = (v: Values, key: string): string | undefined => (has(v, key) ? String(v[key]) : undefined)
/** A boolean, or undefined when absent (a Toggle takes `unknown` then). */
export const boolOf = (v: Values, key: string): boolean | undefined => (has(v, key) ? v[key] === true : undefined)
/** Text to draw for a key: formatted when present, "—" when absent. */
export const shown = (v: Values, key: string, format: (x: Value) => string = String) => (has(v, key) ? format(v[key]!) : NONE)
/** Structured content carried as a JSON string: parsed, or `fallback` (an empty list, say) when absent or unreadable. */
export function json<T>(v: Values, key: string, fallback: T): T {
  if (!has(v, key)) return fallback
  try { return JSON.parse(String(v[key])) as T } catch { return fallback }
}
/** The standing the host reports for a key (waiting, held, disabled with the owner's reason, automated…), to spread into the
 * control that draws it: `<Dial {...st(p, 'drive')} …/>`. An action takes its key's standing too, so an act the owner has no
 * operation for stands disabled with the host's reason. */
export const st = (p: ViewProps, key: string): Standing => p.standing?.[key] ?? {}

/** Where the gallery serves the document templates, or undefined in the shell (which draws a template's Full itself). */
export const cradleDocuments = (): string | undefined => (typeof __CRADLE_DOCUMENTS__ === 'string' ? __CRADLE_DOCUMENTS__ : undefined)

export const pct = (x: number) => `${Math.round(x)} %`
export const fixed = (d: number) => (x: number) => x.toFixed(d)
export const db = (x: number) => (x <= -60 ? '−∞ dB' : `${x > 0 ? '+' : ''}${x.toFixed(1)} dB`)
export const secs = (x: number) => (x < 1 ? `${Math.round(x * 1000)} ms` : `${x.toFixed(x < 10 ? 2 : 1)} s`)
export const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`
export const signed = (d: number) => (x: number) => `${x > 0 ? '+' : ''}${x.toFixed(d)}`
export const clampTo = (low: number, high: number, x: number) => Math.min(high, Math.max(low, x))

/** Whole in a wide frame — expanded above the chain (frame 'flip') or under the material in its window ('window') — with its room. */
export const wideFrame = (p: ViewProps): boolean => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
/** A measure that grows into a wide frame's room (manual §16.3: "the bands stand side by side and the display grows into the room"):
 * `base` in the pool; in a wide frame, the room less what else the view stands there (`others`, px), never under `base` nor over
 * `max`. For a display whose drawing reads across its width; a figure bound by the band's height keeps its size. */
export const grown = (p: ViewProps, base: number, others: number, max = Infinity): number =>
  wideFrame(p) ? Math.round(clampTo(base, max, p.room!.w - others)) : base

declare global {
  /** Where the gallery serves the cradle's document templates (vite.config.mjs `define`). */
  const __CRADLE_DOCUMENTS__: string
}

/** A view onto the values kept under a prefix, for a device that carries another's page — the Agent carries Custody's and
 * Identity's as its own pages, and the Thread as its Full. Keys read and write as `prefix + key`; the shared keys are the
 * device's own (its light, the autonomy both pages show). A binding hosts the carried page by prefixing that page's binding. */
export function scoped(p: ViewProps, prefix: string, shared: readonly string[] = []): ViewProps {
  const own = (key: string) => (shared.includes(key) ? key : prefix + key)
  function pick<T>(all: Readonly<Record<string, T>>): Record<string, T> {
    return Object.fromEntries(Object.entries(all).flatMap(([k, x]) => (shared.includes(k) ? [[k, x]] : k.startsWith(prefix) ? [[k.slice(prefix.length), x]] : [])))
  }
  return {...p, v: pick(p.v), owner: p.owner && pick(p.owner), standing: p.standing && pick(p.standing), set: (key, value) => p.set(own(key), value)}
}

/** A carried page's values, under its prefix (its defaults and fixtures, as the carrying device holds them). */
export function prefixed(prefix: string, values: Readonly<Record<string, Value | undefined>>, shared: readonly string[] = []): Record<string, Value | undefined> {
  return Object.fromEntries(Object.entries(values).filter(([k]) => !shared.includes(k)).map(([k, x]) => [prefix + k, x]))
}
