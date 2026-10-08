import {useEffect, useSyncExternalStore} from "react";
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
import type {CompositionReading} from "./settings/types";
import type {WorkspaceMode} from "./mode";

/**
 * Which suite products are present in the effective composition — read once
 * from the owner's census (`composition_read`, the current-world reading's
 * own `present` fact per position), never inferred from a binary on PATH, a
 * contribution that happens to be compiled in, or a hidden icon.
 *
 * Two questions, deliberately different:
 *  - `knownPresent`: may the host DISPATCH to this product? Only when the
 *    census said so — an unread or unreadable census never licenses a call
 *    (a minimal installation must not probe for an absent product).
 *  - `notKnownAbsent`: should the host still OFFER this product's surface?
 *    Yes until the census says it is absent — an unread census must not
 *    hide capability the person has.
 * A saved binding to an absent product's surface is untouched either way;
 * it shows unavailable (contributions/registry.ts), never substituted.
 */
export type ProductPresence = ReadonlySet<string> | undefined;

/** The mode that belongs to one product's surface. Modes not listed belong to
 * the core (Central, Actuation, AIKit) or to presentation of core facts. */
export const MODE_PRODUCT: Readonly<Partial<Record<WorkspaceMode, string>>> = {factory: "software-factory"};
/** Product id for Workcell as the census names it. */
export const WORKCELL = "workcell";

/** The set of products the census says are present, or undefined when it
 * discloses no `present` fact at all (an older census: unknown, not absent). */
export function presentProducts(reading: Pick<CompositionReading, "positions"> | undefined | null): ProductPresence {
  const positions = reading?.positions;
  if (!Array.isArray(positions)) return undefined;
  const disclosed = positions.filter(position => typeof position.current_world?.present === "boolean");
  if (disclosed.length === 0) return undefined;
  return new Set(disclosed.filter(position => position.current_world.present === true).map(position => position.product_id));
}

export const knownPresent = (presence: ProductPresence, product: string): boolean => !!presence && presence.has(product);
export const notKnownAbsent = (presence: ProductPresence, product: string): boolean => !presence || presence.has(product);

/** Modes the strip offers: every mode whose product is not known absent. */
export function modesOffered(modes: readonly WorkspaceMode[], presence: ProductPresence): WorkspaceMode[] {
  return modes.filter(mode => {
    const product = MODE_PRODUCT[mode];
    return !product || notKnownAbsent(presence, product);
  });
}

/* ---- one shared read for the whole window -------------------------------- */

let current: ProductPresence;
let inflight: Promise<void> | undefined;
const listeners = new Set<() => void>();
const announce = () => { for (const listener of listeners) listener(); };

async function read(transport: KernelTransportStatus): Promise<void> {
  const result = await kernelOp(transport, {op: "composition_read"});
  const outcome = result.outcome;
  if (outcome?.result === "composition_reading") current = presentProducts(outcome.reading);
  announce();
}

/** Read the census once per window (until invalidated); consumers re-render
 * when it lands. Never throws: an unreadable census leaves presence unknown. */
export function ensureProductPresence(transport: KernelTransportStatus): void {
  if (transport.kind === "unavailable" || inflight) return;
  inflight = read(transport).catch(() => announce());
}
export function invalidateProductPresence(): void { inflight = undefined; current = undefined; announce(); }
/** Test seam: set the presence the window holds without a kernel. */
export function setProductPresenceForTest(presence: ProductPresence): void { current = presence; inflight = Promise.resolve(); announce(); }

export function useProductPresence(transport: KernelTransportStatus): ProductPresence {
  useEffect(() => { ensureProductPresence(transport); }, [transport]);
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => current,
    () => current,
  );
}
