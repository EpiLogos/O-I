/**
 * The Technè lens contract. A lens is a bounded reading of ONE material item
 * mounted in the surface's lens host. It receives the item (a reference) and
 * the owner's live reading of it; it may read more through the owner, but it
 * invents no analysis — a lens that cannot read shows the owner's refusal
 * verbatim.
 *
 * Lenses register here; the host lists the ones that accept the selected
 * item, in registration order. The lenses that are real today register
 * themselves from `./lenses`.
 */
import type {ComponentType} from "react";
import type {MaterialItem} from "./material";
import type {MaterialReading} from "./readings";

export interface TechneLens {
  id: string;
  label: string;
  accepts(item: MaterialItem): boolean;
  Body: ComponentType<{item: MaterialItem; reading: MaterialReading}>;
}

const lenses = new Map<string, TechneLens>();
const listeners = new Set<() => void>();
let ordered: TechneLens[] = [];

export function registerTechneLens(lens: TechneLens): () => void {
  if (!lens.id.trim()) throw new Error("A Technè lens needs a stable id");
  lenses.set(lens.id, lens);
  ordered = [...lenses.values()];
  for (const listener of [...listeners]) listener();
  return () => {
    if (lenses.get(lens.id) !== lens) return;
    lenses.delete(lens.id);
    ordered = [...lenses.values()];
    for (const listener of [...listeners]) listener();
  };
}
/** The registered lenses, in registration order (a stable array between changes). */
export const techneLenses = (): TechneLens[] => ordered;
export function subscribeTechneLenses(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
