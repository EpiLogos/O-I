/**
 * Row-by-row LIVE acceptance for the configuration plane's owner groups
 * (docs/cradle/06-SYSTEM-SETTINGS §7 L1/L2/L3, §8 P2 phasing — the
 * acceptance floor of HARNESS-SETTINGS-RESEARCH-2026-09-22 §4, negative
 * roster 5: no acceptance on the fixture world where a real owner route
 * exists).
 *
 * One implementation, two invokers: `walk/verify-live-settings.mjs` (the
 * production-bundle verifier) and `walk/scenarios/configuration.mjs` (the
 * live legs of the configuration walk, through the walk bundle's
 * `?config-source=live` seam). Both drive the SAME live page the app
 * renders and compare it row by row with the owner reads the kernel
 * itself serves:
 *
 *   - `oi config list --json` (the listing: per-owner availability +
 *     named settings rows) — the CLI face of the registry read;
 *   - the bridge's `config_registry_read` (the same KernelOp the page
 *     consumed) — carrying per-mount owner refs, disclosed-at stamps and
 *     the registry's observed-at (spec L2: owner ref + observed-at);
 *   - one representative `config_resolutions_read` per group — the same
 *     kernel op that produced the page's value readings, stamped with its
 *     observed-at. (The `oi config show` CLI would refuse some frozen
 *     scope kinds — a named finding, not used here.)
 *
 * Per group the acceptance asserts the round trip: the live owner read
 * yields named, distinguishable settings rows (non-empty titles,
 * owner-prefixed refs) and the counts the surface shows (rows and the
 * table-of-contents badge) equal the live read, by title. An owner that
 * is genuinely unavailable renders its named absence with zero rows —
 * never fabricated content (L3).
 */
import { execFileSync } from "node:child_process";

/** The P2 disclosure order (06 §8): the `oi` composition layer first,
 * then Central → AIKit → Workcell → Actuation → QL. The `oi` owner group
 * IS the O:I composition layer on this surface — the file's own group
 * vocabulary is the owner refs the kernel registers. */
export const P2_GROUPS = ["central", "ai-kit", "workcell", "actuation", "quaternal-logic"];
export const ALL_GROUPS = ["oi", ...P2_GROUPS];

/** Display names for the table-of-contents badges. Kept in step with
 * `src/workspace/settings/v2/vocabulary.ts` (the UI's own translator). */
const PRODUCT_NAMES = {
  oi: "O:I",
  central: "Central",
  "ai-kit": "AIKit",
  workcell: "Workcell",
  actuation: "Actuation",
  "quaternal-logic": "Quaternal Logic",
};

/** The live owner read: the same executable the walk bridge drives
 * (`OI_BIN`, else `oi` on PATH) answering the listing verb. */
export function readLiveListing(oiBin) {
  const raw = execFileSync(oiBin, ["config", "list", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(raw);
}

/** One bridge op from the scenario process. `connection: close` because the
 * walk's page work between fetches outlives the bridge's keepalive window —
 * a pooled socket reused minutes later dies with `fetch failed` (observed
 * twice on 2026-09-22) — and one retry because a network-level failure here
 * is transport, never a verdict. */
export async function bridgeOp(bridgeUrl, op) {
  const call = () => fetch(`${bridgeUrl}/op`, {
    method: "POST",
    headers: { "content-type": "application/json", "connection": "close" },
    body: JSON.stringify(op),
  });
  let response;
  try {
    response = await call();
  } catch (cause) {
    response = await call();
  }
  return response;
}

/** The page's OWN disclosure read, from the same seam and the same kernel
 * context: `system_composition_read` over the walk bridge, the AIKit owner's
 * mounted descriptor. The ambient `aikit system --json` CLI read resolves a
 * DIFFERENT project context than the kernel's working directory — observed
 * 2026-09-22: the skills active axis differs between the two (ground-scoped
 * guidance skills are active from the personal ground, not from a project
 * checkout). The page is held against what the page actually reads. */
export async function readDisclosureViaBridge(bridgeUrl) {
  const response = await bridgeOp(bridgeUrl, { op: "system_composition_read" });
  if (!response.ok) throw new Error(`system_composition_read over the bridge answered HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.ok || payload.outcome?.result !== "system_composition_reading") {
    throw new Error(`system_composition_read answered ${payload.outcome?.result ?? JSON.stringify(payload).slice(0, 200)}`);
  }
  const mount = (payload.outcome.reading?.owners ?? []).find((row) => row.product_id === "ai-kit");
  if (!mount?.descriptor) {
    throw new Error(`the AIKit disclosure did not mount over the bridge: ${mount?.error ?? mount?.reason ?? "no descriptor"}`);
  }
  return mount.descriptor;
}

/** The kernel registry read the page itself consumed — one bridge op,
 * no second authority path. */
export async function readRegistryViaBridge(bridgeUrl) {
  const response = await bridgeOp(bridgeUrl, { op: "config_registry_read" });
  if (!response.ok) throw new Error(`config_registry_read over the bridge answered HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.ok || payload.outcome?.result !== "config_registry_reading") {
    throw new Error(`config_registry_read answered ${payload.outcome?.result ?? JSON.stringify(payload).slice(0, 200)}`);
  }
  return payload.outcome.reading;
}

/** One row-by-row live group acceptance. `check(ok, label, data)` records
 * each assertion; the return value is the group's verdict:
 *   "live" | "live-empty" | "unavailable-named" | "missing".
 */
export async function assertOwnerGroupLive({ page, owner, listing, registry, registryBridgeUrl, check }) {
  const productName = PRODUCT_NAMES[owner] ?? owner;
  const liveOwner = (listing.owners ?? []).find((row) => row.owner_ref === owner) ?? null;
  const liveRows = (listing.settings ?? []).filter((row) => row.owner_ref === owner);
  const state = liveOwner?.state ?? "unavailable";
  const group = page.locator(`[data-owner-group][data-owner="${owner}"]`);
  const groupCount = await group.count();

  // --- the honest-absence branch (L3): named absence, zero fabricated rows
  if (state !== "available" || liveRows.length === 0) {
    const honestlyEmpty = state === "available" && liveRows.length === 0;
    check(groupCount === 1, `${owner}: the group renders (${state})`, { groupCount, state });
    if (groupCount !== 1) return "missing";
    const availability = await group.getAttribute("data-availability");
    const noteCount = await group.locator(honestlyEmpty ? ".settings-empty" : "[data-owner-availability]").count();
    const renderedRows = await group.locator("[data-setting-ref]").count();
    const ok = honestlyEmpty
      ? renderedRows === 0 && noteCount >= 1
      : availability === state && noteCount === 1 && renderedRows === 0;
    check(
      ok,
      honestlyEmpty
        ? `${owner}: an available owner with no disclosed settings renders its honest emptiness — nothing fabricated (L3)`
        : `${owner}: the unavailable owner renders its named absence — ${state}, no fabricated rows (L3)`,
      { availability, noteCount, renderedRows, liveState: state, reason: liveOwner?.reason ?? null },
    );
    return honestlyEmpty ? "live-empty" : "unavailable-named";
  }

  // --- the live branch: rendered rows equal the live read, by title, with counts
  if (groupCount !== 1) {
    check(false, `${owner}: the live owner group renders`, { groupCount, liveState: state });
    return "missing";
  }
  const availability = await group.getAttribute("data-availability");
  check(
    availability === state,
    `${owner}: the group's availability label is the owner's own disclosed state (L1 — no fabricated readiness)`,
    { availability, liveState: state },
  );

  const renderedRefs = await group.locator("[data-setting-ref]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-setting-ref")),
  );
  check(
    renderedRefs.length === liveRows.length,
    `${owner}: the rows rendered equal the live owner read's named rows — ${renderedRefs.length} rendered / ${liveRows.length} live`,
    { rendered: renderedRefs.length, live: liveRows.length },
  );

  // The count the surface shows beside the group (the table of contents).
  const tocBadge = page.locator(".settings-toc button", { hasText: productName }).locator(".settings-toc-count");
  const tocText = (await tocBadge.count()) === 1 ? await tocBadge.first().textContent() : null;
  check(
    tocText !== null && Number(tocText) === liveRows.length,
    `${owner}: the count the surface shows (table of contents) matches the live read`,
    { shown: tocText, live: liveRows.length },
  );

  // Distinguishable rows: non-empty titles, equal to the live read's by
  // title; every ref carries the owner prefix (the owner-ref half of L2,
  // visible on the row itself).
  const renderedTitles = await group.locator("[data-setting-ref] .settings-row-title strong").allTextContents();
  const liveTitles = liveRows.map((row) => row.title);
  const emptyTitles = renderedTitles.filter((title) => !title || !title.trim());
  const ownerPrefixed = renderedRefs.every((ref) => ref?.startsWith(`${owner}:`));
  const byTitle = [...renderedTitles].sort().join("\u0000") === [...liveTitles].sort().join("\u0000");
  check(
    renderedTitles.length === liveRows.length && emptyTitles.length === 0 && ownerPrefixed && byTitle,
    `${owner}: every rendered row is a named, distinguishable row — titles equal the live read, refs carry the owner ref (L2)`,
    { emptyTitles, ownerPrefixed, byTitle, renderedTitles },
  );

  // L2 observed-at: the registry read behind the page stamps its reading,
  // the owner's disclosure carries its disclosed-at, the mounted value set
  // matches the listing, and every listing value names its owner.
  const mount = (registry?.mounts ?? []).find((row) => row.owner_ref === owner);
  const document_ = mount?.document ?? null;
  const documentSettings = (document_?.sections ?? []).flatMap((section) => section.settings ?? []);
  const provenanceOk =
    typeof registry?.observed_at_unix_ms === "number" &&
    document_?.owner?.owner_ref === owner &&
    typeof document_?.owner?.disclosed_at_unix_ms === "number" &&
    documentSettings.length === liveRows.length &&
    liveRows.every((row) => row.owner_ref === owner);
  check(
    provenanceOk,
    `${owner}: the kernel registry read behind the page carries observed-at + owner disclosed-at, and every listed value names its owner (L2)`,
    {
      observed_at_unix_ms: registry?.observed_at_unix_ms ?? null,
      disclosed_at_unix_ms: document_?.owner?.disclosed_at_unix_ms ?? null,
      mountedSettings: documentSettings.length,
      listingSettings: liveRows.length,
    },
  );

  // L2 per-value: one representative value's own reading is stamped with
  // its observed-at (freshness) — the value did not appear from nowhere.
  // Read through the same kernel resolutions op the page consumed (the
  // `oi config show` CLI refuses some frozen scope kinds — a named
  // finding). A non-singular scope kind disclosed with a null ref
  // (Workcell's `workcell` kind) resolves per-machine singleton under a
  // concrete ref — the walk addresses it `local`; the null-ref disclosure
  // itself is an owner-side finding, not worked around silently.
  const SINGULAR_SCOPES = new Set(["world", "ground", "machine"]);
  const representative =
    liveRows.find((row) => SINGULAR_SCOPES.has(row.allowed_scopes?.[0]?.scope_kind)) ?? liveRows[0];
  const scope = representative.allowed_scopes?.[0] ?? { scope_kind: "world", scope_ref: null };
  const readResolution = async (scopeRef) => {
    const response = await bridgeOp(registryBridgeUrl, {
      op: "config_resolutions_read",
      pairs: [{ setting_ref: representative.setting_ref, scope: { scope_kind: scope.scope_kind, scope_ref: scopeRef } }],
    });
    const payload = await response.json();
    return payload?.outcome?.resolutions?.[0] ?? null;
  };
  let resolution = await readResolution(scope.scope_ref ?? null);
  let addressed = `${scope.scope_kind}${scope.scope_ref ? `:${scope.scope_ref}` : ""}`;
  if (
    resolution?.reconciliation?.status === "unsupported" &&
    !scope.scope_ref &&
    !SINGULAR_SCOPES.has(scope.scope_kind)
  ) {
    resolution = await readResolution("local");
    addressed = `${scope.scope_kind}:local`;
  }
  const showOk =
    resolution?.setting_ref === representative.setting_ref &&
    typeof resolution?.native_reading?.observed_at_unix_ms === "number";
  check(
    showOk,
    `${owner}: the value's own reading carries its observed-at stamp (${representative.setting_ref}) (L2)`,
    {
      setting_ref: representative.setting_ref,
      scope: addressed,
      observed_at_unix_ms: resolution?.native_reading?.observed_at_unix_ms ?? null,
      status: resolution?.reconciliation?.status ?? null,
    },
  );

  return "live";
}
