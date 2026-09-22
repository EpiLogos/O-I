/**
 * The pending "open this native Expression in the presented Technē field"
 * request — a small buffered store, deliberately separate from the general
 * `summonExpression` broadcast.
 *
 * `summonExpression` (oi:expression-compose) is a global window event with
 * several independent consumers (the panel's Composition plane, the
 * Expressions centre focus, the graph navigator). The live Technē field (the
 * imported application) is NOT one of them, and must not become an
 * uncoordinated fifth listener: a raw global listener on every mounted host
 * would open a summon twice (the field AND the Composition plane) and would
 * fire from a concealed, inactive host that merely stayed mounted.
 *
 * Instead there is ONE recorder and ONE consumer. The composition root
 * (CradleFrame), which alone knows the ACTIVE workspace mode, records a ref
 * here only while the workspace stands in the Technē cut — so the field is the
 * presented centre, never a concealed one. The presented Technē host consumes
 * it: a ref recorded before the frame was ready (the natural author-in-Wiki-
 * then-enter-Technē sequence) is buffered and opened on ready; later ones open
 * live. Consuming clears it, so a summon opens exactly once. Refs only — the
 * kernel document stays the store; nothing here is persisted.
 */
import {useSyncExternalStore} from "react";

let pending: string | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of [...listeners]) listener(); };

/** Record a ref to open in the presented Technē field. Ignores a non-Expression
 * ref rather than recording something the field would refuse. */
export function requestTechneFieldOpen(expressionRef: string): void {
  if (typeof expressionRef !== "string" || !expressionRef.startsWith("expression:")) return;
  if (pending === expressionRef) return;
  pending = expressionRef;
  emit();
}

/** Take the pending ref (at most once) and clear it, so a summon opens once. */
export function consumeTechneFieldOpen(): string | null {
  const ref = pending;
  if (ref === null) return null;
  pending = null;
  emit();
  return ref;
}

/** Read the pending ref without clearing it (test/inspection seam). */
export function peekTechneFieldOpen(): string | null { return pending; }

export function subscribeTechneFieldOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Clear any pending ref — the composition root calls this when the workspace
 * leaves the Technē cut, so a stale ref cannot open in a field the person is no
 * longer looking at. */
export function resetTechneFieldOpen(): void {
  if (pending === null) return;
  pending = null;
  emit();
}

/** React hook: the current pending ref (drives the presented host's consume). */
export function useTechneFieldOpen(): string | null {
  return useSyncExternalStore(subscribeTechneFieldOpen, peekTechneFieldOpen, peekTechneFieldOpen);
}
