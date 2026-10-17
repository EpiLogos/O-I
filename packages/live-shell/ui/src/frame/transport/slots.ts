// The transport's slot contract (FOUNDATION F7; manual §10.5: "The transport keeps Live's controls in Live's places in every
// kind of work. What each control does follows the work in front of you."). The bar has 28 slots in fixed places
// (shell/modeGrammar.ts TRANSPORT_SLOT_IDS); a mode binds what a slot does. A slot is enabled only by a binding with a write
// path (`press`, `step` or an owner `control`); a light shows only the owner's reading (`lit`); a value appears only in a
// readout, and a word only where the mockup names the control with one (Link, Ground, Stamp, Tap, Map). Pure TypeScript.
import type {ReactNode} from 'react'
import type {TransportSlotId} from '../../shell/modeGrammar'

export type {TransportSlotId}

export interface SlotBinding {
  /** The owner's write for a press. Present → the slot is enabled. */
  press?: () => void
  /** A stepped slot's write (the tempo nudges, an occasion step): ‹ is -1, › is +1. */
  step?: (direction: 1 | -1) => void
  /** The owner's own control where a press is not enough (a choice of root or scale, the map toggles): drawn in the slot's
   * place, in place of its mark. */
  control?: ReactNode
  /** The owner's reading of the slot: lit when true, dark when false; no light when the owner discloses none. */
  lit?: boolean
  /** The slot's readout: the owner's value and whose reading it is. */
  readout?: {value: string; title: string}
  /** What pressing does here and through whose op — the slot's title. */
  title?: string
  /** Pressing is refused right now, and why (the owner's standing): the slot stays drawn, disabled, with this reason. */
  refused?: string
}

export type TransportBindings = Partial<Record<TransportSlotId, SlotBinding>>

/** What a slot means in the mode in front of you (the grammar's per-mode meaning), and its waiting line when unbound. */
export interface SlotWords {
  label: string
  fn: string
  dataI: string
  waiting: string
  /** The word a word-faced slot (Link, Tap, the maps) wears in this mode — the mockup's word, a name and never a value. */
  face?: string
}
