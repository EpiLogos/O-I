import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const descriptorPath = join(here, "..", "oi-pi.package.json");
const descriptor = JSON.parse(readFileSync(descriptorPath, "utf8")) as Record<string, unknown>;

const numericVersion = /^[0-9]+(?:\.[0-9]+)*$/;
const nonempty = (value: unknown): string => {
  assert.equal(typeof value, "string");
  assert.ok((value as string).trim().length > 0);
  return value as string;
};

test("descriptor carries the oi.package/v1 schema const", () => {
  assert.equal(descriptor.schema, "oi.package/v1");
});

test("required package fields are present and non-empty", () => {
  nonempty(descriptor.package_ref);
  nonempty(descriptor.version);
  const source = descriptor.source as Record<string, unknown>;
  nonempty(source.kind);
  nonempty(source.locator);
  nonempty(source.revision);
});

test("versions use the numeric dotted form", () => {
  assert.match(nonempty(descriptor.version), numericVersion);
  for (const req of (descriptor.compatibility as Array<Record<string, unknown>>) ?? []) {
    nonempty(req.product);
    assert.match(nonempty(req.minimum_version), numericVersion);
  }
});

test("permissions are unique non-empty disclosures", () => {
  const permissions = (descriptor.permissions ?? []) as string[];
  assert.deepEqual(permissions, [...new Set(permissions)]);
  for (const permission of permissions) nonempty(permission);
});

test("the package declares at least one native contribution", () => {
  const contributions = descriptor.contributions as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(contributions));
  assert.ok(contributions.length >= 1);
});

test("each contribution satisfies the native contract declaration floor", () => {
  const contributions = descriptor.contributions as Array<Record<string, unknown>>;
  const refs = new Set<string>();
  for (const contribution of contributions) {
    const contributionRef = nonempty(contribution.contribution_ref);
    // Contribution identity stays distinct from package identity.
    assert.notEqual(contributionRef, descriptor.package_ref);
    assert.ok(!refs.has(contributionRef), `duplicate contribution_ref ${contributionRef}`);
    refs.add(contributionRef);

    nonempty(contribution.target_product);
    nonempty(contribution.target_contract);
    assert.match(nonempty(contribution.minimum_contract_version), numericVersion);
    nonempty(contribution.artifact);

    const native = contribution.native_verification as Record<string, unknown>;
    nonempty(native.operation);
  }
});

test("the surface contribution targets the component-surface-authoring contract", () => {
  const contributions = descriptor.contributions as Array<Record<string, unknown>>;
  const surface = contributions.find(
    (c) => c.contribution_ref === "contribution:oi/observatory-surface",
  );
  assert.ok(surface, "observatory-surface contribution present");
  assert.equal(surface.target_product, "ai-kit");
  assert.equal(surface.target_contract, "aikit.component-surface-authoring/v1");
});
