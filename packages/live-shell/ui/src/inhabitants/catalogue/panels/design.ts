// A designed device: its five views, each drawn from one set of values (docs/dlw/DEVICE-UI.md §2). The host owns the values
// and the navigation; a view only reads them and asks for changes. The gallery hosts the reference devices on a labelled
// fixture; the shell hosts the same views on the owner's values and writes.
import type {ReactNode} from 'react'

export type Value = number | string | boolean
export type Values = Readonly<Record<string, Value>>

export interface Nav {
  /** Show the device whole in the pool (the press on a chain plate). */
  readonly select?: () => void
  /** Open the device full size in a pane. */
  readonly full?: () => void
  readonly fold?: () => void
  readonly unfold?: () => void
}

export interface ViewProps {
  readonly v: Values
  readonly set: (key: string, value: Value | undefined) => void
  readonly nav: Nav
  /** The page shown in the head, where the device has pages. */
  readonly page: string
  readonly setPage: (page: string) => void
}

export interface DesignedDevice {
  /** `<family>:<face>`, as the manual's catalogue embeds it. */
  readonly id: string
  readonly title: string
  readonly kind: 'instrument' | 'effect' | 'rack'
  readonly defaults: Values
  /** Named readings to try the device on, each laid over the defaults (the gallery's fixture switch). */
  readonly fixtures?: Readonly<Record<string, Values>>
  readonly firstPage?: string
  readonly folded: (p: ViewProps) => ReactNode
  readonly compact: (p: ViewProps) => ReactNode
  readonly whole: (p: ViewProps) => ReactNode
  readonly full: (p: ViewProps) => ReactNode
  readonly widget: (p: ViewProps) => ReactNode
}

export const num = (v: Values, key: string) => Number(v[key])
export const str = (v: Values, key: string) => String(v[key])
export const on = (v: Values, key: string) => v[key] === true

export const pct = (x: number) => `${Math.round(x)} %`
export const fixed = (d: number) => (x: number) => x.toFixed(d)
export const db = (x: number) => (x <= -60 ? '−∞ dB' : `${x > 0 ? '+' : ''}${x.toFixed(1)} dB`)
export const secs = (x: number) => (x < 1 ? `${Math.round(x * 1000)} ms` : `${x.toFixed(x < 10 ? 2 : 1)} s`)
export const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`
export const signed = (d: number) => (x: number) => `${x > 0 ? '+' : ''}${x.toFixed(d)}`
export const clampTo = (low: number, high: number, x: number) => Math.min(high, Math.max(low, x))

declare global {
  /** Where the gallery serves the cradle's document templates (vite.config.mjs `define`). */
  const __CRADLE_DOCUMENTS__: string
}
