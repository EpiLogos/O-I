// The Graph and source receiver's door (O-I #820): what the frame carries of it from its first frame. The receiver itself
// (panels/knowledgeReceiver.tsx) loads the first time a source is opened — from the search line, the Workbench, a page's place, the
// Constellation — never with the first frame (tests/first-load-budget.test.mjs LOADS_LATER). Until it arrives and listens, the door
// holds each open in the order it came and hands them to the receiver when it does; a receiver that did not load answers each open it
// held, in words, through the open's own `complete` (the way panels/knowledge.tsx answered a refusal). Before this door the receiver
// stood only once its pane had been shown (App.tsx panels, WhenShown), so an open from anywhere else was heard by no one.
// No React: a reference to what waits.

/** The one event every opener of the Graph and source surface sends (native/Workbench.tsx, central/constellation.ts, …). */
export const KNOWLEDGE_OPEN = 'oi:epi-open-knowledge'

/** What an open carries that the door reads: its own answer to a refusal. The rest is the receiver's to admit. */
export interface HeldOpen {readonly complete?: (error?: string) => void; readonly [key: string]: unknown}

let listening = false
const held: HeldOpen[] = []

/** The receiver says when it listens itself (on mount) and when it leaves; while it listens the door holds nothing back. */
export function receiverListening(on: boolean): void { listening = on }

/** The opens that came before the receiver listened, in order, handed over once. */
export function heldOpens(): HeldOpen[] { return held.splice(0) }

/** The door's listener: hold the open and ask for the receiver (once, until it arrives or fails). `load` fetches the receiver's module
 * and mounts it; its refusal answers every open held. */
export function knowledgeDoorReceiver(load: () => Promise<unknown>): (event: Event) => void {
  let loading = false
  return event => {
    if (listening) return
    const detail = (event as CustomEvent<HeldOpen | null>).detail
    held.push(detail && typeof detail === 'object' ? detail : {})
    if (loading) return
    loading = true
    load().catch(cause => {
      loading = false
      const reason = `The Graph and source receiver did not load: ${cause instanceof Error ? cause.message : String(cause)}`
      for (const open of held.splice(0)) { try { open.complete?.(reason) } catch { /* the opener has gone */ } }
    })
  }
}
