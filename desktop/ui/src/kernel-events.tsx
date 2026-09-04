import React, { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  bindKernelEventSource,
  createFocusConsumer,
  createKernelEventSource,
  focusFromSnapshot,
  sameFocus,
  type KernelEvent,
  type KernelEventSourceStatus,
  type KernelFocusRelation,
  type KernelSemanticRef,
} from './kernel-event-model.mjs';

/**
 * The renderer's single kernel-event subscription (02 §5: push, not poll).
 *
 * The source, the focus consumer and the host binding are module singletons:
 * however many surfaces consume kernel events, the renderer holds exactly one
 * transport subscription and every consumer reads the same kernel truth. When
 * the native bridge is absent (browser preview) the source degrades honestly —
 * no event is faked, and surfaces keep whatever kernel state their bootstrap
 * pull returned.
 */
const source = createKernelEventSource();

/** Presentation mirror of the kernel relation. Semantic focus stays
 * kernel-owned (02 §6): any surface may rebuild this from a snapshot pull. */
const focus = createFocusConsumer();

let binding: ReturnType<typeof bindKernelEventSource> | null = null;
let subscriptions = 0;

function ensureBound() {
  subscriptions += 1;
  if (!binding) {
    binding = bindKernelEventSource(source, listen);
  }
}

function release() {
  subscriptions = Math.max(0, subscriptions - 1);
}

/**
 * Subscribe to kernel events for the lifetime of a component. Returns the
 * unsubscribe function, so a consumer can never be leaked by accident.
 */
export function subscribeKernelEvents(consumer: (event: KernelEvent) => void): () => void {
  ensureBound();
  const unsubscribe = source.subscribe((event) => {
    focus.apply(event);
    consumer(event);
  });
  return () => {
    unsubscribe();
    release();
  };
}

/** How the seam stands, for surfaces that disclose it. */
export function kernelEventStatus(): KernelEventSourceStatus {
  return source.status();
}

/**
 * The one global focus relation, derived from kernel events (02 §7).
 *
 * `seed` is the kernel's own focus from a snapshot pull. The first render
 * usually precedes that pull (the static preview carries no focus), so the
 * seed is re-adopted every time it changes until the first `FocusChanged`
 * flows — after that the event stream is newer than any pull and a late seed
 * is refused rather than clobbering event-derived focus. This replaces
 * component-local selection copies: surfaces hold a mirror of kernel state,
 * never a second selection.
 */
export function useKernelFocus(seed?: KernelFocusRelation | KernelSemanticRef | null): KernelFocusRelation | null {
  const [mirror, setMirror] = useState<KernelFocusRelation | null>(() => focus.current() ?? bootstrap(seed));
  useEffect(() => subscribeKernelEvents((event) => {
    if (event.event === 'focus_changed') setMirror(focus.current());
  }), []);
  useEffect(() => {
    const adopted = focus.seed(bootstrap(seed));
    if (adopted) setMirror((previous) => (sameFocus(previous, adopted) ? previous : adopted));
  }, [seed]);
  return mirror;
}

function bootstrap(seed?: KernelFocusRelation | KernelSemanticRef | null): KernelFocusRelation | null {
  if (!seed) return null;
  return focusFromSnapshot('ref' in (seed as KernelSemanticRef) ? { selection: seed as KernelSemanticRef } : { focus: seed as KernelFocusRelation });
}

export type { KernelEvent, KernelFocusRelation, KernelSemanticRef };
