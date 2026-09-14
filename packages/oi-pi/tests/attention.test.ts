import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveAttention } from "../contrib/lib/attention.ts";
import type { AttentionNotification } from "../contrib/lib/model.ts";

const notification = (partial: Partial<AttentionNotification>): AttentionNotification => ({
  ref: "n/1",
  kind: "inbox",
  requiresAttention: true,
  acknowledged: false,
  summary: "s",
  ...partial,
});

test("attention is derived from notification semantics, not prose", () => {
  const result = deriveAttention([
    notification({ ref: "n/1", requiresAttention: true, acknowledged: false }),
    notification({ ref: "n/2", requiresAttention: false, acknowledged: false }),
    notification({ ref: "n/3", requiresAttention: true, acknowledged: true }),
  ]);
  assert.equal(result.count, 1);
  assert.deepEqual(result.refs, ["n/1"]);
  assert.equal(result.derivedFrom, "activity-notification-attention");
});

test("no notifications means no attention", () => {
  const result = deriveAttention([]);
  assert.equal(result.count, 0);
  assert.deepEqual(result.refs, []);
});

test("an acknowledged notification never demands attention", () => {
  const result = deriveAttention([
    notification({ ref: "n/1", requiresAttention: true, acknowledged: true }),
  ]);
  assert.equal(result.count, 0);
});
