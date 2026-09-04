export const KERNEL_EVENT_SCHEMA: 'oi.kernel-event/v1';
export const KERNEL_EVENT_VERSION: 1;
export const KERNEL_EVENT_TOPIC: 'oi:kernel-event';
export const KERNEL_EVENT_TAGS: readonly KernelEventTag[];

export type KernelEventTag =
  | 'focus_changed'
  | 'world_changed'
  | 'source_changed'
  | 'activity_updated'
  | 'session_changed'
  | 'knowledge_changed'
  | 'attention_raised'
  | 'attention_resolved'
  | 'run_changed'
  | 'journey_changed'
  | 'material_changed'
  | 'composition_changed'
  | 'shared_field_changed';

/** The exact opaque ref the kernel names (`oi.desktop-shell/v1` `SemanticRef`). */
export type KernelSemanticRef = {
  ref: string;
  kind: string;
  native_owner: string;
  provenance: { source: string; revision?: string };
};

/** The one global focus relation (02 §7) as the kernel serialises it. */
export type KernelFocusRelation = {
  world?: KernelSemanticRef | null;
  project?: KernelSemanticRef | null;
  subject?: KernelSemanticRef | null;
  journey?: KernelSemanticRef | null;
  agency_encounter?: KernelSemanticRef | null;
};

export type KernelEvent =
  | ({ event: 'focus_changed' } & { focus: KernelFocusRelation })
  | ({ event: 'world_changed' } & { world: KernelSemanticRef; summary: string })
  | ({ event: 'source_changed' } & { source: KernelSemanticRef; summary: string })
  | ({ event: 'activity_updated' } & { activity_ref: string; subject: KernelSemanticRef; summary: string })
  | ({ event: 'session_changed' } & { session: KernelSemanticRef; summary: string })
  | ({ event: 'knowledge_changed' } & { subject: KernelSemanticRef; summary: string })
  | ({ event: 'attention_raised' } & { attention_ref: string; subject: KernelSemanticRef; summary: string })
  | ({ event: 'attention_resolved' } & { attention_ref: string; summary: string })
  | ({ event: 'run_changed' } & { run: KernelSemanticRef; summary: string })
  | ({ event: 'journey_changed' } & { journey: KernelSemanticRef; summary: string })
  | ({ event: 'material_changed' } & { material: KernelSemanticRef; summary: string })
  | ({ event: 'composition_changed' } & { condition: string; summary: string })
  | ({ event: 'shared_field_changed' } & { field: KernelSemanticRef; summary: string });

export type KernelEventEnvelope = { schema: 'oi.kernel-event/v1'; version: 1 } & KernelEvent;

export type KernelEventSourceStatus = 'unbound' | 'live' | 'degraded';

export function parseKernelEventEnvelope(raw: unknown): KernelEvent;
export function emptyFocus(): KernelFocusRelation;
export function normalizeFocus(value: KernelFocusRelation): KernelFocusRelation;
export function sameFocus(left: KernelFocusRelation | null, right: KernelFocusRelation | null): boolean;
export function focusFromSnapshot(snapshot: { focus?: KernelFocusRelation; selection?: KernelSemanticRef } | null | undefined): KernelFocusRelation | null;
export function reduceFocus(current: KernelFocusRelation | null, envelope: KernelEvent): KernelFocusRelation | null;
export function createFocusConsumer(initial?: KernelFocusRelation | null): {
  apply(envelope: KernelEvent): KernelFocusRelation | null;
  /** Adopt a snapshot pull; refused (null) once a FocusChanged has been applied. */
  seed(pulled: KernelFocusRelation | null): KernelFocusRelation | null;
  eventDerived(): boolean;
  current(): KernelFocusRelation | null;
  subject(): KernelSemanticRef | null;
};
export function createKernelEventSource(): {
  ingest(raw: unknown): KernelEvent | null;
  subscribe(consumer: (envelope: KernelEvent) => void): () => boolean;
  events(): KernelEvent[];
  drainErrors(): unknown[];
  status(): KernelEventSourceStatus;
  markLive(): void;
  markDegraded(reason: unknown): void;
};
export function bindKernelEventSource(
  source: ReturnType<typeof createKernelEventSource>,
  listen: (topic: string, handler: (event: { payload?: unknown }) => void) => Promise<() => void>,
): { ready: Promise<unknown>; stop(): void };
