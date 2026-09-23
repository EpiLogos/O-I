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

/** The kernel registry read the page itself consumed — one bridge op,
 * no second authority path. */
export async function readRegistryViaBridge(bridgeUrl) {
  const response = await fetch(`${bridgeUrl}/op`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op: "config_registry_read" }),
  });
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
  // 12-SETTINGS §3.9: each owner is one product page, opened from the
  // left body's PRODUCTS list; its settings are the page's friendly rows.
  const entry = page.locator(`[data-settings-product="${owner}"]`);
  check((await entry.count()) === 1 && ((await entry.textContent()) ?? "").trim() === productName,
    `${owner}: the left body lists the product page under its own name (${productName})`);
  await entry.click();
  const group = page.locator(`[data-product-page="${owner}"]`);
  await group.waitFor({ timeout: 240000 });
  const rows = group.locator(`[data-settings-row^="setting:${owner}:"]`);
  await page.waitForFunction((sel) => ![...document.querySelectorAll(sel)].some((node) => node.textContent?.includes("Reading…")), `[data-product-page="${owner}"] [data-settings-row]`, { timeout: 300000 }).catch(() => {});
  const groupCount = await group.count();

  // --- the honest-absence branch (L3): named absence, zero fabricated rows
  if (state !== "available" || liveRows.length === 0) {
    const honestlyEmpty = state === "available" && liveRows.length === 0;
    const renderedRows = await rows.count();
    const health = await group.locator("[data-product-health]").getAttribute("data-product-health");
    check(renderedRows === 0 && (honestlyEmpty || health !== "available"),
      honestlyEmpty
        ? `${owner}: an available owner with no contributed settings renders no rows — nothing fabricated (L3)`
        : `${owner}: the unavailable owner renders its named absence — ${state}, no fabricated rows (L3)`,
      { renderedRows, health, liveState: state, reason: liveOwner?.reason ?? null });
    return honestlyEmpty ? "live-empty" : "unavailable-named";
  }

  // --- the live branch: rendered rows equal the live read, by title, with counts
  if (groupCount !== 1) {
    check(false, `${owner}: the live product page renders`, { groupCount, liveState: state });
    return "missing";
  }
  const renderedRefs = (await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-settings-row")))).map((ref) => ref?.replace(/^setting:/, ""));
  check(
    renderedRefs.length === liveRows.length,
    `${owner}: the rows rendered equal the live owner read's named rows — ${renderedRefs.length} rendered / ${liveRows.length} live`,
    { rendered: renderedRefs.length, live: liveRows.length },
  );
  const renderedTitles = await rows.locator(".settings-line-title").allTextContents();
  const liveTitles = liveRows.map((row) => row.title);
  const emptyTitles = renderedTitles.filter((title) => !title || !title.trim());
  const ownerPrefixed = renderedRefs.every((ref) => ref?.startsWith(`${owner}:`));
  const byTitle = [...renderedTitles].map((title) => title.trim()).sort().join("\u0000") === [...liveTitles].sort().join("\u0000");
  check(
    renderedTitles.length === liveRows.length && emptyTitles.length === 0 && ownerPrefixed && byTitle,
    `${owner}: every rendered row is a named, distinguishable row — titles equal the live read, refs carry the owner ref (L2)`,
    { emptyTitles, ownerPrefixed, byTitle, renderedTitles },
  );
  // L1: read-only rows never carry a control; writable rows the owner lets
  // the plane change carry one (never a disabled stand-in).
  const readOnlyRefs = liveRows.filter((row) => !row.writable).map((row) => row.setting_ref);
  const readOnlyWithControls = [];
  for (const ref of readOnlyRefs) {
    const row = group.locator(`[data-settings-row="setting:${ref}"]`);
    if (await row.locator("select, input, [role=switch]").count()) readOnlyWithControls.push(ref);
  }
  check(readOnlyWithControls.length === 0, `${owner}: read-only settings show a value and their owning place — no control (L1/S11)`, { readOnlyWithControls });

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
    const response = await fetch(`${registryBridgeUrl}/op`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        op: "config_resolutions_read",
        pairs: [{ setting_ref: representative.setting_ref, scope: { scope_kind: scope.scope_kind, scope_ref: scopeRef } }],
      }),
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
