// Live's tree, healed of Central's documents (DEVICE-SEMANTICS-LOCK §0.2.3: Live mode's centre is the one instrument, "the
// full torus in the centre pane"). A fresh book stood in Central's mode for its first render, so Central's seed laid its Day
// and Flow (and the tracks pane beside them, shell/modeFrames.ts MODE_TREE_SEEDS.base) — and the old-Live rename
// (continuity/workspace.tsx standsInOldLive) then moved that tree into Live. Books that took it keep it. Such a tree is not
// Live's arrangement: every binding it has ever held is one Central's seed lays. Live's own seed replaces it, once — the
// replacement holds Live's instrument, so the tree never matches again; a Live tree that has ever held anything else (the
// torus, a tab the owner opened and closed, a detached view) is the owner's and is untouched. Pure layout over the cradle
// engine.
import {groupOf} from '../../../../../desktop/cradle/src/surface/engine'
import type {LayoutState} from '../../../../../desktop/cradle/src/surface/types'
import {CENTRAL_DOCUMENT_PANE_KIND} from '../central/documents/centralDocuments'

/** What Central's first tree lays: its documents, and the tracks pane it opens beside them. */
const CENTRAL_SEED_KINDS: ReadonlySet<string> = new Set([CENTRAL_DOCUMENT_PANE_KIND, 'projection.timeline'])

/** The tree is Central's seed standing in Live: a Central document is placed, every binding the tree has ever held is one
 * Central's seed lays, and no view of it stands in its own window. */
export function holdsCentralSeed(layout: LayoutState): boolean {
  const bindings = Object.values(layout.surfaces ?? {})
  if (layout.detached?.length) return false
  return bindings.some(binding => binding.kind === CENTRAL_DOCUMENT_PANE_KIND && !!groupOf(layout, binding.id))
    && bindings.every(binding => CENTRAL_SEED_KINDS.has(binding.kind))
}

/** Live's seed, run over a healed tree: Central's documents leave Live's book (they were never Live's; Central keeps its own),
 * the tree is cleared, and Live's own default is laid. Any other tree goes to the seed as it is, which leaves an arranged
 * tree alone. */
export function healLiveTree(seed: (layout: LayoutState) => LayoutState): (layout: LayoutState) => LayoutState {
  return layout => {
    if (!holdsCentralSeed(layout)) return seed(layout)
    const surfaces = Object.fromEntries(Object.entries(layout.surfaces).filter(([, binding]) => binding.kind !== CENTRAL_DOCUMENT_PANE_KIND))
    const cleared: LayoutState = {...layout, root: null, focusedGroupId: null, focusedTabId: undefined, maximizedGroupId: undefined,
      surfaces, closedStack: layout.closedStack.filter(id => id in surfaces)}
    return seed(cleared)
  }
}
