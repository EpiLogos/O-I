/**
 * The configuration walk (#299 §21, C6), rebuilt for the acceptance floor
 * (HARNESS-SETTINGS-RESEARCH-2026-09-22 §4: fixture-backed acceptance is
 * banned where a real owner route exists — this walk's row-by-row truth
 * moved LIVE; docs/cradle/06-SYSTEM-SETTINGS §7 L1/L2/L3, §8 P2 order).
 *
 * Two mounts, one scenario:
 *
 *  1. LIVE (`?config-source=live` binds the real engine in walk builds
 *     through the same `liveSource` kernel binding production uses): per
 *     owner group — oi (the composition layer), then Central, AIKit,
 *     Workcell, Actuation, Quaternal Logic in the P2 disclosure order —
 *     the rendered rows equal the live owner read (`oi config list`) by
 *     title, with the counts the surface shows (rows and the table of
 *     contents badge) matching; every row is named and owner-prefixed;
 *     the kernel registry read behind the page carries owner refs +
 *     disclosed-at + observed-at (L2); availability labels are the
 *     owners' own disclosed states (L1). The shared implementation is
 *     `walk/live-settings-acceptance.mjs` — the same checks
 *     `verify-live-settings.mjs` runs against a production bundle.
 *
 *  2. FIXTURE (the walk bundle's labelled fixture world) — kept ONLY for
 *     the generic-projection proofs that have no live route: the frozen
 *     reconciliation vocabulary rendering, honest absence on demand
 *     (owner outage, empty world), and the L6 descriptor-genericity row,
 *     which is fixture-backed by design and says so in its label: adding
 *     a section to a fixture descriptor changes the page with no cradle
 *     code change.
 */
import { ALL_GROUPS, assertOwnerGroupLive, readLiveListing, readRegistryViaBridge } from "../live-settings-acceptance.mjs";

const oiBin = process.env.OI_BIN ?? "oi"; // the same resolution the walk bridge uses

/** Open the settings surface. The shell remembers the settings mode per
 * session — when the reload already restored it, the strip toggle is in
 * its pressed state and must be left alone. */
async function openSettings(page) {
  await page.waitForSelector('.desktop-shell', {timeout: 30000});
  try {
    await page.waitForSelector('.settings-home', {timeout: 8000});
  } catch {
    await page.locator('.world-system-settings').first().click();
    await page.waitForSelector('.settings-home', {timeout: 60000});
  }
}

export default async function run({page,baseUrl,check,shot,bridgeUrl,log}) {
  // --- 1 · LIVE: row-by-row acceptance against the real engine ------------
  await page.goto(`${baseUrl}/?config-source=live`);
  await openSettings(page);
  await page.waitForSelector('[data-owner-group]', {timeout: 120000});
  check((await page.locator('[data-config-source="fixture"]').count()) === 0,
    'the live mount binds the LIVE source — the fixture banner never renders');
  check((await page.locator('[data-config-source="live"]').count()) === 1,
    'the live source note renders (read and driven through the oi configuration engine)');

  // The live reads BEFORE the assertions: what the owners disclose is the
  // expectation the rendered surface is held against (the round trip).
  const listing = readLiveListing(oiBin);
  const registry = await readRegistryViaBridge(bridgeUrl);

  const verdicts = {};
  for (const owner of ALL_GROUPS) {
    verdicts[owner] = await assertOwnerGroupLive({page, owner, listing, registry, registryBridgeUrl: bridgeUrl, check});
  }
  await shot('live-groups');
  log(`live per-group verdicts: ${Object.entries(verdicts).map(([owner, verdict]) => `${owner}=${verdict}`).join(", ")}`);

  // --- 2 · FIXTURE: only the generic-projection proofs remain -------------
  await page.goto(baseUrl);
  await openSettings(page);
  await page.waitForSelector('[data-config-source="fixture"]', {timeout: 120000});
  await page.waitForSelector('[data-owner]', {timeout: 30000});

  const ownerRefs = await Promise.all((await page.locator('[data-owner-group]').all()).map(g => g.getAttribute('data-owner')));
  check(ownerRefs.length === 4 && ownerRefs.includes('ai-kit') && ownerRefs.includes('oi')
    && ownerRefs.includes('workcell') && ownerRefs.includes('connector/factory-actuation'),
    'the fixture registry projects every mounted contribution generically (two products, the oi composition owner, a connector)', {ownerRefs});

  // The frozen reconciliation vocabulary renders from the fixture world's
  // disclosed states (the live world cannot be commanded into drift).
  const statuses = await Promise.all((await page.locator('[data-setting-ref]').all()).map(row => row.getAttribute('data-reconciliation')));
  check(['satisfied', 'drifted', 'pending', 'blocked'].every(s => statuses.includes(s)),
    'the frozen reconciliation vocabulary renders — satisfied, drifted, pending and blocked (fixture world)', {statuses});

  // Honest absence on demand: an owner outage renders its named absence.
  // (The console is a dev harness at the page's foot — drive it by event;
  // what the legs assert is the rendered result, never the click.)
  const consoleButton = (ref) => page.locator(`[data-config-fixture-console] [data-config-${ref}]`).dispatchEvent('click');
  await consoleButton('workcell-outage');
  const workcell = page.locator('[data-owner-group][data-owner="workcell"]');
  await workcell.locator('[data-owner-availability="unavailable"]').waitFor({timeout: 30000});
  const outageNote = (await workcell.locator('[data-owner-availability]').textContent()) ?? '';
  check((await workcell.getAttribute('data-availability')) === 'unavailable' && /unavailable/i.test(outageNote ?? ''),
    'the unavailable owner renders its named absence with the disclosed reason — no fabricated rows (L1/L3)', {outageNote});
  await consoleButton('workcell-outage');
  await page.waitForFunction(() => document.querySelector('[data-owner-group][data-owner="workcell"]')?.getAttribute('data-availability') === 'available', null, {timeout: 30000});

  // Empty registry is first-class (§6.2's honest beginning).
  await consoleButton('registry-mode');
  await page.locator('[data-config-empty-registry]').waitFor({timeout: 30000});
  check(true, 'an empty world renders the honest beginning — same system, no fabricated rows (fixture world)');
  await consoleButton('registry-mode');
  await page.locator('[data-owner-group]').first().waitFor({timeout: 30000});

  // L6 (fixture-backed, labelled): the product ships a new descriptor
  // section; the page changes with no cradle code change.
  await consoleButton('l6-section');
  const l6Row = page.locator('[data-owner-group][data-owner="oi"] [data-setting-ref="oi:walk-l6:descriptor-genericity"]');
  await l6Row.waitFor({timeout: 30000});
  const l6Group = page.locator('[data-owner-group][data-owner="oi"]');
  check((await l6Group.getByText('L6 · shipped mid-walk').count()) >= 1
    && ((await l6Row.locator('.settings-row-title strong').textContent()) ?? '').trim() === 'Section shipped mid-walk',
    'L6 (fixture-backed): a new section in a fixture descriptor changes the page — generic projection, zero cradle code per section');
  await shot('l6');
}
