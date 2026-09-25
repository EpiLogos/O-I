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
 * presented centre, never a concealed one — and it NAMES that presented centre
 * by its binding id (`target`). The consumer is the host whose own binding id
 * matches: a concealed Technē host that merely stayed mounted (a warm tree, a
 * foreign-tree pane tab) reads a `target` that is not its own and leaves the
 * ref for the presented host, so "one consumer" is enforced, not assumed. A
 * ref recorded before the frame was ready (the natural author-in-Wiki-then-
 * enter-Technē sequence) is buffered and opened on ready; later ones open live.
 * Consuming clears it, so a summon opens exactly once. When no target is named
 * (a standalone host with no binding identity) any Technē host may consume.
 * Refs only — the kernel document stays the store; nothing here is persisted.
 */
import {useSyncExternalStore} from "react";

interface Pending { ref: string; target: string | null; refresh: boolean; lens: string | null }
let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of [...listeners]) listener(); };

/** Record a ref to open in the presented Technē field, naming that presented
 * centre by its binding id so only it consumes (null = any Technē host may).
 * Ignores a non-Expression ref rather than recording something it would refuse. */
export function requestTechneFieldOpen(expressionRef: string, target: string | null = null, refresh = false, lens: string | null = null): void {
  if (typeof expressionRef !== "string" || !expressionRef.startsWith("expression:")) return;
  if (pending && pending.ref === expressionRef && pending.target === target && pending.refresh === refresh && pending.lens === lens) return;
  pending = {ref: expressionRef, target, refresh, lens};
  emit();
}

/** Take the pending ref (at most once) and clear it, so a summon opens once —
 * but only when the named target is this host (or no target was named). A host
 * whose id does not match reads null and leaves the ref for the presented one. */
export function consumeTechneFieldOpen(hostId: string | null = null): string | null {
  if (!pending) return null;
  if (pending.target !== null && pending.target !== hostId) return null;
  const ref = pending.ref;
  pending = null;
  emit();
  return ref;
}

/** Read the pending ref without clearing it (test/inspection seam). */
export function peekTechneFieldOpen(): string | null { return pending?.ref ?? null; }

/** Read the pending target without clearing it (test/inspection seam). */
export function peekTechneFieldTarget(): string | null { return pending?.target ?? null; }

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

export const peekTechneFieldRefresh = (): boolean => pending?.refresh ?? false;

/** The application lens the pending open asks the field to stand in (the
 * consumer posts it as the host-command `lens` after the open), or null. */
export const peekTechneFieldLens = (): string | null => pending?.lens ?? null;
