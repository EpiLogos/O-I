// The constellation the browser holds in focus, as the reader reads it (manual §3: "Whatever you work on, one thing stands in focus: a
// constellation of your wiki"; §10.3, the browser's Material › Constellations). The candidate's browser publishes the whole it selects
// (packages/live-shell/ui/src/frame/browser/constellationFocus.ts); this module keeps only that ref, and names the constellation from the
// one wiki projection the browser itself reads (techne/wikiProjectionStore.ts): its title, and the register its acts go to. The reader's
// "Add to constellation" gathers a passage into it (KnowledgeSurface.tsx, O-I #742).
import {useSyncExternalStore} from 'react';
import type {KernelTransportStatus} from '../kernel/types';
import {getWikiProjectionState, refreshWikiProjectionReading, subscribeWikiProjection, wikiProjectionOf} from '../techne/wikiProjectionStore';

export interface ConstellationInFocus {
  /** Its whole's ref: the constellation's name in the browser. */
  readonly whole: string;
  readonly title: string;
  /** The project whose register holds it; absent for your world's own. */
  readonly project?: string;
  /** The register's key in the projection (to read it again after an act). */
  readonly register: string;
}

let whole: string | null = null;
const listeners = new Set<() => void>();

/** The browser's selection, published as it changes (null: none). */
export function setConstellationInFocus(next: string | null): void {
  if (whole === next) return;
  whole = next;
  for (const listener of [...listeners]) listener();
}

/** The constellation in focus, named from the projection; null with none selected, or one no register discloses now. Pure over the store. */
export function constellationInFocus(): ConstellationInFocus | null {
  if (!whole) return null;
  const state = getWikiProjectionState();
  for (const register of state.registers) {
    const found = wikiProjectionOf(state.standings[register.key])?.constellations.find(row => row.wholeRef === whole && !row.disclosedChild);
    if (found) return {whole, title: found.title, register: register.key, ...(register.project ? {project: register.project} : {})};
  }
  return null;
}

let named: {whole: string | null; revision: number; focus: ConstellationInFocus | null} = {whole: null, revision: -1, focus: null};
const current = () => {
  const revision = getWikiProjectionState().revision;
  if (named.whole !== whole || named.revision !== revision) named = {whole, revision, focus: constellationInFocus()};
  return named.focus;
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const projection = subscribeWikiProjection(listener);
  return () => { listeners.delete(listener); projection(); };
};
export function useConstellationInFocus(): ConstellationInFocus | null {
  return useSyncExternalStore(subscribe, current, current);
}

/** The browser's door: bring a constellation into focus there (the candidate publishes it; frame/browser/constellationFocus.ts). */
type FocusDoor = (whole: string) => void;
let door: FocusDoor | null = null;
export function publishConstellationFocusDoor(next: FocusDoor | null): void { door = next; }
/** Bring the constellation round `whole` into focus in the browser, where what it holds stands and its menu holds its acts. Throws when no
 * browser is mounted in this window. */
export function focusConstellation(whole: string): void {
  if (!door) throw new Error('No browser is mounted in this window to show the constellation in.');
  door(whole);
}

/** Read the constellation's register again after an owner wrote it, so the browser, the Form and the reader read what it holds now. */
export async function rereadRegisterOf(focus: Pick<ConstellationInFocus, 'register'>, transport: KernelTransportStatus): Promise<void> {
  const register = getWikiProjectionState().registers.find(row => row.key === focus.register);
  if (register) await refreshWikiProjectionReading(register, transport);
}
