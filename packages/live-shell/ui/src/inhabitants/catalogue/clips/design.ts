// A designed clip: Clip view for one mode, laid out as Live 12 lays out its Clip View (ProjectCentral/docs/1-vision/dlw/DLW.md §16.5; the captures in
// Work/reverse-engineering/ableton-live-12.0.25/evidence/ui/clip-view, caps 01–28 and 46–47). Live's anatomy is fixed in the kit
// (clipKit.tsx): the head across the panels, panel one with its Clip and Launch tabs, panel two with the tools in tabs, and the
// editor in tabs beside them. A design fills those places for its mode's clip, and every place draws from one set of values and
// asks for changes with `set`, as a designed device does (../panels/design.ts): material is a value key (JSON for structured
// content) whose sample sits in `defaults` or `fixtures`, and a key the owner has not reported reaches the view absent.
//
// Which tab each place shows is a value too (`view.panel`, `view.tools`, `view.editor`), so the detail area and the expanded
// view, drawn from the same values, always show the same tabs.
import type {ReactNode} from 'react'
import type {Standing} from '../../sdk/panel'
import type {Value, Values} from '../panels/design'

export type {Value, Values}

export type ClipMode = 'techne' | 'central' | 'factory' | 'expressions' | 'live'

/** Where Clip view stands: the detail area under the panes, or expanded into the main area (Live's ⌥⌘E, cap 29). */
export type ClipSize = 'detail' | 'expanded'

/** The room each size gives, in px at 100 %: the detail area's width, its height under the panes, and the main area's. */
export const CLIP_ROOM: Readonly<Record<ClipSize, {readonly w: number; readonly h: number}>> = {
  detail: {w: 1180, h: 300},
  expanded: {w: 1180, h: 640},
}

export interface ClipProps {
  readonly v: Values
  readonly set: (key: string, value: Value | undefined) => void
  /** The standing of each value by key, as a designed device takes it (automated, held, waiting, disabled with the reason). */
  readonly standing?: Readonly<Record<string, Standing>>
  readonly size: ClipSize
  /** The room this place has, in px. The editor's content may grow into it; the panels keep Live's measures. */
  readonly room: {readonly w: number; readonly h: number}
}

/** One tab of a place. */
export interface ClipTab {
  readonly id: string
  readonly label: string
  /** What the tab shows, for the status bar. */
  readonly does: string
  readonly draw: (p: ClipProps) => ReactNode
  /** The editor's own toggles at the head of the editor while this tab shows (Live's Fold, Scale and Highlight Scale, cap 10–12). */
  readonly bar?: (p: ClipProps) => ReactNode
  /** Whether the clip has this tab (a Flow reads as Dialogue, Flow and Journal where another page reads as Page). Absent: always. */
  readonly shows?: (v: Values) => boolean
}

export interface DesignedClip {
  /** `clip:<mode>`, as the manual embeds it. */
  readonly id: string
  readonly mode: ClipMode
  readonly title: string
  readonly defaults: Values
  /** Named readings to try the clip on, each laid over the defaults. A key set to undefined drops that reading. */
  readonly fixtures?: Readonly<Record<string, Readonly<Record<string, Value | undefined>>>>
  /** The head: the value keys of the clip's name, its colour, and its activator where the clip has one. */
  readonly head: {readonly name: string; readonly colour: string; readonly active?: string}
  /** Panel one: Clip, then Launch where the clip launches. */
  readonly panel: readonly ClipTab[]
  /** Panel two: the tools. Empty when the clip has none, and the editor takes the room. */
  readonly tools: readonly ClipTab[]
  /** The editor's tabs. The first is the clip's own material. */
  readonly editor: readonly ClipTab[]
  /** The editor head's right corner (Live's grid chooser). */
  readonly corner?: (p: ClipProps) => ReactNode
}

/** The value keys that hold which tab each place shows. */
export const TAB_KEY = {panel: 'view.panel', tools: 'view.tools', editor: 'view.editor'} as const

/** The value keys of the clip's source, the same in every mode (manual §16.5: "A clip's source is its constellation, as a sample is an
 * audio clip's. The Clip panel names it under Constellation, in every mode, and Show in Browser beside it selects it in the browser"):
 * the constellation's name as the clip's owner reports it ("None" when the owner says the clip was made of none), its ref, and the
 * Show in Browser press. */
export const MADE_OF = {name: 'madeOf', ref: 'madeOf.ref', show: 'madeOf.show'} as const
export type Place = keyof typeof TAB_KEY
