/**
 * The configuration walk (#299 §21, C6), re-contracted to the 12-SETTINGS
 * page: each owner's contributed settings are that product's page, opened
 * from the left body's PRODUCTS list.
 *
 *  1. LIVE (the default in every build now — 12-SETTINGS §5): per owner —
 *     oi, then Central, AIKit, Workcell, Actuation, Quaternal Logic in the
 *     P2 order — the rendered rows equal the live owner read (`oi config
 *     list`) by title; every row is named and owner-prefixed; read-only rows
 *     carry no control; the kernel registry read behind the page carries
 *     owner refs + disclosed-at + observed-at (L2). The shared
 *     implementation is `walk/live-settings-acceptance.mjs` — the same
 *     checks `verify-live-settings.mjs` runs against a production bundle.
 *     Reads only: this leg never stages or applies anything.
 *
 *  2. FIXTURE (`?fixtures=1`, clearly labelled on the page) — kept ONLY for
 *     the generic-projection proofs that have no live route: the frozen
 *     reconciliation vocabulary, an owner outage's named absence, the empty
 *     registry, and the L6 descriptor-genericity row (a new section in a
 *     fixture descriptor changes the page with no cradle code change).
 */
import { ALL_GROUPS, assertOwnerGroupLive, readLiveListing, readRegistryViaBridge } from "../live-settings-acceptance.mjs";
import { enterSettings, rawJsonOutsideShowRaw } from "../lib/settings-walk.mjs";

const oiBin = process.env.OI_BIN ?? "oi"; // the same resolution the walk bridge uses

export default async function run({page, baseUrl, check, shot, bridgeUrl, log}) {
  // --- 1 · LIVE: row-by-row acceptance against the real engine ------------
  await enterSettings(page, {baseUrl});
  check((await page.locator('[data-config-source="fixture"]').count()) === 0,
    "the default build binds the LIVE plane — the fixture label never renders");
  const listing = readLiveListing(oiBin);
  const registry = await readRegistryViaBridge(bridgeUrl);
  const verdicts = {};
  for (const owner of ALL_GROUPS) {
    verdicts[owner] = await assertOwnerGroupLive({page, owner, listing, registry, registryBridgeUrl: bridgeUrl, check});
    check((await rawJsonOutsideShowRaw(page)).length === 0, `${owner}: the product page shows no raw JSON outside Show raw (L5)`);
  }
  await shot("live-product");
  log(`live per-owner verdicts: ${Object.entries(verdicts).map(([owner, verdict]) => `${owner}=${verdict}`).join(", ")}`);

  // --- 2 · FIXTURE: only the generic-projection proofs remain -------------
  await enterSettings(page, {baseUrl, query: "?fixtures=1"});
  await page.locator('[data-config-source="fixture"]').waitFor({timeout: 120000});
  check(((await page.locator('[data-config-source="fixture"]').textContent()) ?? "").includes("not this machine's settings"),
    "the fixture world is labelled in visible words on the page");
  await page.locator('[data-settings-product="connector/factory-actuation"]').waitFor({timeout: 120000});
  const owners = await page.locator("[data-settings-product]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-settings-product")));
  check(["ai-kit", "oi", "workcell", "connector/factory-actuation"].every((owner) => owners.includes(owner)),
    "every mounted contribution gets a page generically — two products, the oi composition owner and a connector", {owners});

  // The frozen reconciliation vocabulary renders from the fixture world's
  // disclosed states, as visible words on the rows.
  const statuses = new Set();
  const words = new Set();
  for (const owner of ["ai-kit", "oi", "workcell", "connector/factory-actuation"]) {
    await page.locator(`[data-settings-product="${owner}"]`).click();
    await page.locator(`[data-product-page="${owner}"]`).waitFor({timeout: 120000});
    await page.waitForTimeout(1500);
    for (const status of await page.locator("[data-settings-row][data-reconciliation]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-reconciliation")))) statuses.add(status);
    for (const word of await page.locator("[data-reconciliation-word]").allTextContents()) words.add(word.trim());
  }
  // A held drifted setting is a staged change: it shows in the pending strip.
  const pending = await page.locator("[data-settings-pending]").count();
  check(["satisfied", "drifted", "pending", "blocked"].every((status) => statuses.has(status)) && ["Staging", "Blocked"].every((word) => words.has(word)) && pending === 1,
    "the frozen reconciliation vocabulary renders — satisfied, drifted (staged in the strip), pending and blocked, in words (fixture world)", {statuses: [...statuses], words: [...words], pending});

  // Honest absence on demand: an owner outage renders its named absence.
  await page.locator("[data-config-fixture-console] summary").click();
  await page.locator("[data-config-workcell-outage]").click();
  await page.locator('[data-settings-product="workcell"]').click();
  await page.locator('[data-product-page="workcell"] [data-owner-availability="unavailable"]').waitFor({timeout: 120000});
  const outage = (await page.locator('[data-product-page="workcell"] [data-owner-availability]').textContent()) ?? "";
  check(/unavailable/i.test(outage) && await page.locator('[data-product-page="workcell"] [data-settings-row^="setting:workcell:"]').count() === 0,
    "the unavailable owner renders its named absence with the disclosed reason — no fabricated rows (L1/L3)", {outage});
  await page.locator("[data-config-workcell-outage]").click();

  // The empty registry is first-class (§6.2's honest beginning).
  await page.locator("[data-config-registry-mode]").click();
  await page.locator("[data-config-empty-registry]").waitFor({timeout: 120000});
  check(((await page.locator("[data-config-empty-registry]").textContent()) ?? "") === "Nothing installed to configure yet." && await page.locator('[data-settings-row^="setting:"]').count() === 0,
    "an empty world renders the honest beginning — no fabricated rows (fixture world)");
  await shot("empty");
  await page.locator("[data-config-registry-mode]").click();

  // L6 (fixture-backed, labelled): a new section in the oi descriptor.
  await page.locator("[data-config-l6-section]").click();
  await page.locator('[data-settings-product="oi"]').click();
  const l6 = page.locator('[data-settings-row="setting:oi:walk-l6:descriptor-genericity"]');
  await l6.waitFor({timeout: 120000});
  check(((await l6.locator(".settings-line-title").textContent()) ?? "").trim() === "Section shipped mid-walk",
    "L6 (fixture-backed): a new section in a fixture descriptor changes the page — generic projection, zero cradle code per section");
  await shot("l6");
}
