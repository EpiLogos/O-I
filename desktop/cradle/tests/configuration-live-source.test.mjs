/**
 * The live configuration-plane source (`src/configuration/liveSource.ts`)
 * driven against a stub kernel transport: proves the op payloads the source
 * sends, the verbatim pass-through of contract documents, the plan→request
 * binding that carries ONE requested value to apply, and the honest
 * refusals — no React, no fixtures, no product branches.
 *
 * Run: node --test tests/configuration-live-source.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createLiveConfigPlaneSource } from "../src/configuration/liveSource.ts";

/** A stub kernel transport: records every op, answers from a per-op table
 * (or a default builder). Mirror of the typed seam, not of product logic. */
function stubSource(answers) {
  const ops = [];
  const source = createLiveConfigPlaneSource(async (op) => {
    ops.push(op);
    const answer = answers[op.op];
    if (!answer) throw new Error(`stub has no answer for ${op.op}`);
    if (answer.error) return { outcome: null, error: answer.error };
    return { outcome: { receipts: [], ...answer.outcome } };
  });
  return { source, ops };
}

const SCOPE = { scope_kind: "project", scope_ref: "epilogos/o-i" };
const MOUNT = {
  owner_ref: "ai-kit",
  document: {
    schema: "oi.configuration-contribution/v1",
    owner: { owner_ref: "ai-kit", owner_kind: "product" },
    sections: [{
      id: "resolution",
      title: "Resolution",
      settings: [{
        setting_ref: "ai-kit:resolution:model.default",
        section_ref: "resolution",
        title: "Default model",
        value_schema: { type: "enum", options: [{ value: "sonnet-next" }] },
        allowed_scopes: [{ scope_kind: "project", scope_ref: null }],
        writable: true, profileable: true, sensitive: false,
        effect: { kind: "session-restart-required" },
        operations: { validate: true, plan: true, apply: true, reset: true },
        native_ref: "aikit:model.default",
      }],
    }],
  },
  availability: { state: "available", reason: null },
  error: null,
};
const RESOLUTION = {
  schema: "oi.config-resolution/v1",
  setting_ref: "ai-kit:resolution:model.default",
  scope: SCOPE,
  desired: null,
  native: { effective: { value: "sonnet-current" } },
  native_reading: { reading_digest: "aa", observed_at_unix_ms: 1 },
  reconciliation: { status: "satisfied", reason: null },
};

test("readRegistry and readResolutions cross verbatim", async () => {
  const { source, ops } = stubSource({
    config_registry_read: { outcome: { result: "config_registry_reading", reading: { schema: "oi.cradle.config-registry/v1", observed_at_unix_ms: 7, mounts: [MOUNT] } } },
    config_resolutions_read: { outcome: { result: "config_resolutions", resolutions: [RESOLUTION] } },
  });

  const registry = await source.readRegistry();
  assert.equal(registry.observed_at_unix_ms, 7);
  assert.equal(registry.mounts[0].owner_ref, "ai-kit");
  assert.deepEqual(registry.mounts[0].availability, { state: "available", reason: null });

  const resolutions = await source.readResolutions([{ setting_ref: "ai-kit:resolution:model.default", scope: SCOPE }]);
  assert.equal(resolutions[0].native.effective.value, "sonnet-current", "the owner's own axes pass through unmodified");

  assert.deepEqual(ops[1].pairs, [{ setting_ref: "ai-kit:resolution:model.default", scope: SCOPE }]);
});

test("hold and discard cross the request wire-shape", async () => {
  const { source, ops } = stubSource({
    config_desired_hold: { outcome: { result: "config_desired_held", entry: { value: "sonnet-next" } } },
    config_desired_discard: { outcome: { result: "config_desired_discarded", document: { removed: true } } },
  });
  await source.holdDesired({ setting_ref: "ai-kit:resolution:model.default", scope: SCOPE, value: "sonnet-next" });
  await source.discardDesired("ai-kit:resolution:model.default", SCOPE);
  assert.deepEqual(ops[0].request, { setting_ref: "ai-kit:resolution:model.default", scope: SCOPE, value: "sonnet-next", secret_reference: null });
  assert.deepEqual(ops[1], { op: "config_desired_discard", setting_ref: "ai-kit:resolution:model.default", scope: SCOPE });
});

test("a kernel-level refusal travels as the engine's own words", async () => {
  const { source } = stubSource({
    config_desired_hold: { error: "unsupported_scope: project:p is not within the allowed scopes of `ai-kit:resolution:model.default`" },
  });
  await assert.rejects(
    () => source.holdDesired({ setting_ref: "ai-kit:resolution:model.default", scope: SCOPE, value: "x" }),
    /unsupported_scope/,
  );
});

test("plan binds each owner plan to its request; apply carries the same values", async () => {
  const plan = {
    schema: "oi.config-plan/v1", plan_id: "plan-1", plan_digest: "digest-1",
    setting_ref: "ai-kit:resolution:model.default", scope: SCOPE,
    changes: [], expected_effect: { kind: "value-change" },
  };
  const changeset = { schema: "oi.config-changeset/v1", changeset_id: "cs-cradle-1", status: "verified", operations: [] };
  const { source, ops } = stubSource({
    config_plan: { outcome: { result: "config_planned", plans: [plan], errors: [{ schema: "oi.config-error/v1", error_code: "unsupported_setting", message: "nope" }] } },
    config_apply: { outcome: { result: "config_applied", changeset, owner_receipts: [{ receipt_id: "r1" }] } },
  });

  const bundle = await source.plan([{ setting_ref: "ai-kit:resolution:model.default", scope: SCOPE, value: "sonnet-next" }]);
  assert.equal(bundle.plans[0].plan_id, "plan-1");
  assert.equal(bundle.errors[0].error_code, "unsupported_setting");

  const applied = await source.apply(bundle.plans);
  assert.equal(applied.changeset_id, "cs-cradle-1");
  assert.deepEqual(ops[1].requests, [{ setting_ref: "ai-kit:resolution:model.default", scope: SCOPE, value: "sonnet-next", secret_reference: null }],
    "apply carries the SAME requested value the plan was built from");
});

test("apply refuses a plan this session never planned", async () => {
  const { source } = stubSource({});
  await assert.rejects(
    () => source.apply([{ schema: "oi.config-plan/v1", plan_id: "plan-x", plan_digest: "d", setting_ref: "s:a:b", scope: SCOPE, changes: [], expected_effect: { kind: "none" } }]),
    /plan the change again/,
  );
});

test("profile use plan enriches settings from the registry and use moves nothing", async () => {
  const { source } = stubSource({
    config_registry_read: { outcome: { result: "config_registry_reading", reading: { schema: "oi.cradle.config-registry/v1", observed_at_unix_ms: 7, mounts: [MOUNT] } } },
    profile_use_plan: {
      outcome: {
        result: "profile_use_planning",
        plan: {
          profile_ref: "dev",
          entries: [{ setting_ref: "ai-kit:resolution:model.default", scope: SCOPE, target: { value: "sonnet-next" }, current: null }],
          native_profiles: [{ owner_ref: "ai-kit", native_profile_ref: "coding" }],
        },
      },
    },
    profile_use_apply: { outcome: { result: "profile_used", activation: { schema: "oi.profile-activation/v1", active_profile: "dev" } } },
  });
  const plan = await source.profileUsePlan("dev");
  assert.equal(plan.entries[0].setting.title, "Default model", "the setting enriches from the mounted contribution");
  assert.deepEqual(plan.entries[0].target, { value: "sonnet-next" });
  assert.equal(plan.native_profiles[0].native_profile_ref, "coding", "native profiles stay references");
  const result = await source.applyProfileUse("dev");
  assert.equal(result, null, "the engine's `use` moves no native state, so no ChangeSet exists");
});

test("create works and in-place profile edits refuse honestly", async () => {
  const profile = { schema: "oi.profile/v1", profile_ref: "staging", desired: [], native_profiles: [] };
  const { source } = stubSource({
    profile_create: { outcome: { result: "profile_created", profile } },
  });
  const created = await source.createProfile("staging", "Staging");
  assert.equal(created.profile_ref, "staging");
  await assert.rejects(() => source.saveProfile(profile), /does not offer in-place profile edits yet/);
});
