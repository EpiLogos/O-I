import {useSyncExternalStore} from "react";

/** THE EPI-LOGOS LENS (10-SIDEBARS §3.1, ruling D2, amendment A5): a lens, not
 * a mode. Its toggle lives at the end of the hidden window footer; while it is
 * on, the head shows an "Epi-Logos" chip with × to leave, the file trees show
 * the corpus instead of the scope's files, context sources narrow to the
 * corpus, and Nara joins the right panel's agent menu. It opens no surface and
 * never changes the mode or the scope. Turning it off restores the trees
 * exactly as they were.
 *
 * Owned by the workspace's world context (`context.world === "epi-logos"`,
 * which the mode's acting-body default already reads); the frame binds the
 * writer and publishes the effective state, exactly like the scope. */
export interface EpiLens {
  on: boolean;
  /** The Work project whose file system is the corpus root while the lens is on. */
  corpusProject: string;
}

export const EPI_CORPUS_PROJECT = "epi";

const OFF: EpiLens = Object.freeze({on: false, corpusProject: EPI_CORPUS_PROJECT});
const ON: EpiLens = Object.freeze({on: true, corpusProject: EPI_CORPUS_PROJECT});

let current: EpiLens = OFF;
let writer: ((on: boolean) => void) | null = null;
const listeners = new Set<() => void>();

export function readLens(): EpiLens {
  return current;
}

export function publishLens(on: boolean): void {
  if (current.on === on) return;
  current = on ? ON : OFF;
  for (const listener of [...listeners]) listener();
}

export function bindLensWriter(next: (on: boolean) => void): () => void {
  writer = next;
  return () => {
    if (writer === next) writer = null;
  };
}

/** The footer toggle's and the head chip's only verb. */
export function setLens(on: boolean): void {
  if (writer) writer(on);
  else publishLens(on);
}

export function subscribeLens(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useEpiLens(): EpiLens {
  return useSyncExternalStore(subscribeLens, readLens, readLens);
}
