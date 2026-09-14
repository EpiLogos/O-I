import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

import { buildCensus, CENSUS_STAGES } from "../contrib/lib/census.ts";
import type { CensusInputs } from "../contrib/lib/census.ts";

const fixture: CensusInputs = {
  treeRows: [
    { path: "registries/mattpocock", summary: "41 capsules" },
    { path: "sets/mattpocock", summary: "9 members, 1 projected, 8 withheld" },
    { path: "inbox/inb_1", summary: "open item" },
  ],
  active: [{ id: "skill/mattpocock/engineering/wayfinder", kind: "skill", name: "wayfinder" }],
  catalogued: 323,
  events: [
    { event_id: "evt_1", action: "trust-review", outcome: "success", capability: "skill/a" },
    { event_id: "evt_2", action: "run", outcome: "success", capability: "skill/b" },
  ],
};

test("census ladder is generated from live registry shapes", () => {
  const census = buildCensus(fixture);
  assert.equal(census.totalEligible, 323);
  assert.equal(census.counts.eligible, 1); // registries/mattpocock
  assert.equal(census.counts.selected, 1); // sets/mattpocock projected
  assert.equal(census.counts.loaded, 1); // wayfinder active
  assert.equal(census.counts.granted, 1); // trust-review success
  assert.equal(census.counts.invoked, 1); // run with capability
  assert.equal(census.counts.realised, 2); // both events successful
  for (const stage of CENSUS_STAGES) {
    assert.ok(stage in census.stages, `${stage} stage present`);
    assert.equal(typeof census.counts[stage], "number");
  }
});

test("census is generated from the live aikit registries at test time", (t) => {
  const probe = spawnSync("aikit", ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) {
    t.skip("aikit is not reachable; live census check skipped");
    return;
  }

  const json = (args: string[]): unknown => {
    // Resolve against a neutral cwd so the package's own parent project profile
    // (Work/O-I/.aikit/profile.toml) cannot shadow the live registry check.
    const result = spawnSync("aikit", ["-C", tmpdir(), ...args, "--json"], {
      encoding: "utf8",
      timeout: 20_000,
    });
    assert.equal(result.status, 0, `aikit ${args.join(" ")} failed: ${result.stderr}`);
    return JSON.parse(result.stdout);
  };

  const status = json(["status"]) as {
    data?: { active?: Array<{ id: string; name?: string; kind?: string }>; active_count?: number };
  };
  const tree = json(["tree", "--all"]) as { data?: { rows?: Array<{ path: string; summary: string }> } };
  const recent = json(["recent"]) as {
    data?: { events?: Array<{ event_id?: string; action?: string; outcome?: string; capability?: string | null }> };
  };
  const stats = json(["stats"]) as { data?: { catalogued?: number } };

  const census = buildCensus({
    treeRows: tree.data?.rows ?? [],
    active: status.data?.active ?? [],
    catalogued: stats.data?.catalogued ?? 0,
    events: recent.data?.events ?? [],
  });

  // The loaded count must equal the live resolver's own active_count.
  assert.equal(census.counts.loaded, status.data?.active_count ?? 0);
  // Eligible registries must be a subset of the live tree's registry rows.
  assert.ok(census.counts.eligible <= (tree.data?.rows ?? []).length);
});
