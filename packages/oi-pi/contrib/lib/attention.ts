// `needs_attention` is derived from owner semantics (Activity → Notification →
// Attention), never from prose guessing. A notification demands attention only
// when its owner model carries an explicit `requires_attention` fact that is
// still unacknowledged.

import type { Attention, AttentionNotification } from "./model.ts";

export function deriveAttention(
  notifications: readonly AttentionNotification[],
): Attention {
  const pending = notifications.filter(
    (notification) => notification.requiresAttention && !notification.acknowledged,
  );
  return {
    count: pending.length,
    refs: pending.map((notification) => notification.ref),
    derivedFrom: "activity-notification-attention",
    notifications: [...pending],
  };
}

/** A live open-inbox item is an unacknowledged attention notification. */
export function notificationFromInboxRow(row: {
  path: string;
  summary: string;
}): AttentionNotification {
  return {
    ref: row.path,
    kind: "inbox",
    requiresAttention: true,
    acknowledged: false,
    summary: row.summary,
  };
}

/** A live run/hook failure is an unacknowledged attention notification. */
export function notificationFromFailure(failure: unknown): AttentionNotification | null {
  if (failure === null || typeof failure !== "object") return null;
  const record = failure as Record<string, unknown>;
  const ref =
    typeof record.event_id === "string"
      ? record.event_id
      : typeof record.id === "string"
        ? record.id
        : "failure/unknown";
  const summary =
    typeof record.detail === "string" && record.detail.length > 0
      ? record.detail
      : typeof record.reason === "string" && record.reason.length > 0
        ? record.reason
        : "recorded failure";
  return {
    ref,
    kind: "failure",
    requiresAttention: true,
    acknowledged: false,
    evidenceRef: typeof record.event_id === "string" ? record.event_id : undefined,
    summary,
  };
}
