// The knowledge graph's published handle (the wiki constellation's own Device side, DEVICE-SEMANTICS-LOCK §8.1; ticket
// T-KNOWLEDGE-GRAPH-DEVICE). The open surface publishes its own state here: the view's filter state, the zoom the panel
// shows, the vocabularies the open reading holds, and the three acts the panel's controls call. Device faces read and
// drive that one state through this handle; nothing keeps a copy of it.
//
// A plain store, with no React: the live-shell reads it through useSyncExternalStore, so this module never carries a
// second React. One surface stands at a time (the latest to publish); only the surface that published may clear it, so
// a surface that is unmounting cannot clear another's handle.

import type {GraphFilters} from './filters';

/** The vocabularies the open reading holds, as the panel computes them (GraphFilters.tsx): null until the reading loads. */
export interface KnowledgeGraphDomains {
  readonly kinds: readonly string[];
  readonly relations: readonly string[];
}

/** The open surface's counts, as the panel's summary line reads them. */
export interface KnowledgeGraphCounts {
  readonly matched: number;
  readonly context: number;
  readonly displayed: number;
  readonly admitted: number;
  readonly hidden: number;
}

export interface KnowledgeGraphSurface {
  /** The view's own filter state: the one GraphFilters edits and filterGraph reads. */
  readonly filters: GraphFilters;
  /** The zoom the zoom readout shows (the view's camera). */
  readonly zoom: number;
  /** What the open reading holds, or null while the reading has not loaded. */
  readonly domains: KnowledgeGraphDomains | null;
  /** The filtered counts, or null while the reading has not loaded. */
  readonly counts: KnowledgeGraphCounts | null;
  /** The selected subject the local scope centres on, or null. */
  readonly selected: string | null;
  /** The panel's own filter change (changeFilters): the patch is merged onto the current filter state. */
  patchFilters(patch: Partial<GraphFilters>): void;
  /** The zoom buttons' own change: the zoom is set on the view's camera. */
  setZoom(zoom: number): void;
  /** The Fit button's own act. */
  fit(): void;
}

interface Standing {
  readonly token: object;
  readonly surface: KnowledgeGraphSurface;
}

let standing: Standing | null = null;
const listeners = new Set<() => void>();

/** Publish the surface's handle under its token, or clear it (null) when the token is the one standing. A publish from
 * any other token with null is a no-op, so a surface that is leaving cannot clear the one that replaced it. */
export function publishKnowledgeGraphHandle(token: object, surface: KnowledgeGraphSurface | null): void {
  if (surface) {
    standing = {token, surface};
  } else if (standing && standing.token === token) {
    standing = null;
  } else {
    return;
  }
  for (const listener of [...listeners]) listener();
}

/** The standing surface's handle, or null when no graph is open. Identity changes on each publish. */
export function knowledgeGraphSurface(): KnowledgeGraphSurface | null {
  return standing?.surface ?? null;
}

/** Subscribe to publishes and clears. Returns the unsubscribe. */
export function subscribeKnowledgeGraph(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
