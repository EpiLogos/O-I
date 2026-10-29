// The clip Copy or Cut holds for Paste (manual §10.9: Cut ⌘X, Copy ⌘C on a clip, Paste ⌘V on an empty slot). It holds the clip's id in
// its set and its name, never the clip: Paste asks the set's owner to copy the clip as the owner holds it then (Live's own paste copies
// what the clipboard took; the owner's copy is the document's own, so nothing of the clip passes through the window). A clip held by Cut
// is moved by Paste, and the hold ends there. One per window.
export interface HeldClip {
  readonly clipId: string
  readonly name: string
  readonly cut: boolean
}

let held: HeldClip | null = null

/** The clip held for Paste, or null. */
export const heldClip = (): HeldClip | null => held

/** Hold a clip for Paste (Copy, Cut), or let the hold go. */
export function holdClip(clip: HeldClip | null): void { held = clip }
