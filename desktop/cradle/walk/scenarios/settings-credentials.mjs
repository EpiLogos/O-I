/**
 * 12-SETTINGS §3.4 — Credentials, walked against the real kernel and the
 * installed AIKit in a disposable world. The owner's keychain is NEVER
 * written: AIKit's binding store is an isolated AIKIT_HOME, the only key
 * material is a dummy, and the one binding the walk makes is a stored-secret
 * reference to a varlock file in the disposable world.
 *
 *   S12 credential entry: Add key reveals ONE write-only field; Save sends
 *       the dummy key to the kernel (which hands it to AIKit on STDIN, or —
 *       on an AIKit that cannot read a key from the app — refuses before
 *       anything runs and names the missing operation). The field empties;
 *       the value is absent from the DOM and every attribute, from every
 *       input, from the clipboard, from the console, from the kernel's event
 *       log and from the walk bridge's output. A stored secret binds for real
 *       and the card reads Configured.
 *   S13 credential verify: Verify runs the owner's one live check; the card
 *       shows working / refused / unreachable with the time — the same
 *       verdict the owner gives when asked directly.
 */
import {settingsWorld, DUMMY_KEY} from "../lib/settings-world.mjs";
import {enterSettings, openSection, settled} from "../lib/settings-walk.mjs";

export async function setup() {
  return settingsWorld();
}

export default async function run({page, baseUrl, bridgeUrl, check, shot, provision: world, serviceOutput, log}) {
  const consoleLines = [];
  page.on("console", (message) => consoleLines.push(message.text()));
  page.on("pageerror", (error) => consoleLines.push(String(error)));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await enterSettings(page, {root: world.root, baseUrl});
  await openSection(page, "credentials");
  await settled(page);
  const card = (provider) => page.locator(`[data-credential-card="${provider}"]`);
  await card("anthropic").waitFor({timeout: 240000});
  check(((await card("anthropic").locator("[data-credential-status]").textContent()) ?? "").startsWith("Not configured"),
    "the isolated world starts with no Anthropic key (read through credential_list)");

  // --- S12 · the write-only field ---------------------------------------------
  await card("anthropic").getByRole("button", {name: "Add key"}).click();
  const field = card("anthropic").locator('[data-credential-field="anthropic"]');
  await field.waitFor();
  check(await card("anthropic").locator("input").count() === 1 && (await field.getAttribute("type")) === "password" && (await field.getAttribute("autocomplete")) === "off",
    "S12 Add key reveals ONE write-only field (password, no autocomplete)");
  await field.fill(DUMMY_KEY);
  check((await field.getAttribute("value")) === null, "S12 typing never writes the key into an attribute");
  await card("anthropic").getByRole("button", {name: "Save"}).click();
  await card("anthropic").locator("[data-credential-message]").waitFor({timeout: 120000});
  const message = (await card("anthropic").locator("[data-credential-message]").textContent()) ?? "";
  const listing = world.aikit("credential", "list");
  const bound = (listing.data?.bindings ?? []).some((binding) => /anthropic/.test(binding.credential_ref));
  log(`save outcome: ${message}`);
  const missingSentence = (await card("anthropic").locator("[data-settings-missing]").textContent().catch(() => "")) ?? "";
  check(bound ? message.startsWith("Saved") : (message.startsWith("This key wasn't saved.") && /--stdin/.test(missingSentence)),
    "S12 Save reports the owner's truth: saved when AIKit bound it, else \"This key wasn't saved.\" with the missing STDIN operation named in one sentence", {message, missingSentence, bound});
  check((await field.inputValue().catch(() => "")) === "", "S12 the field is empty after Save");
  const html = await page.content();
  const inputs = await page.evaluate(() => [...document.querySelectorAll("input,textarea")].map((element) => element.value));
  check(!html.includes(DUMMY_KEY), "S12 the key is absent from the DOM and every attribute after Save");
  check(!inputs.some((value) => value.includes(DUMMY_KEY)), "S12 the key is in no input's value");
  const clipboard = await page.evaluate(() => navigator.clipboard?.readText?.().catch(() => "") ?? "").catch(() => "");
  check(!String(clipboard).includes(DUMMY_KEY), "S12 the key never reached the clipboard");
  const events = await (await fetch(`${bridgeUrl}/events?since=1`)).text();
  check(!events.includes(DUMMY_KEY), "S12 the key is absent from the kernel's event log");
  check(!consoleLines.some((line) => line.includes(DUMMY_KEY)), "S12 the key is absent from the console");
  check(!serviceOutput().includes(DUMMY_KEY), "S12 the key is absent from the walk bridge's and preview's output");
  check(!JSON.stringify(listing).includes(DUMMY_KEY), "S12 the key is absent from AIKit's binding metadata");
  await shot("key-entry");

  // A stored secret binds for real (a varlock reference in the disposable world).
  await card("deepseek").getByRole("button", {name: "Use a stored secret"}).click();
  await card("deepseek").locator('[data-credential-reference="deepseek"]').fill(world.dummyRef);
  await card("deepseek").getByRole("button", {name: "Save"}).click();
  await page.waitForFunction(() => document.querySelector('[data-credential-card="deepseek"]')?.getAttribute("data-configured") === "true", null, {timeout: 120000});
  const deepseek = (world.aikit("credential", "list").data?.bindings ?? []).find((binding) => binding.credential_ref === "credential:deepseek");
  check(deepseek?.declared_secret_ref === world.dummyRef && !deepseek.revoked, "S12 the stored secret is bound by the owner exactly as named");
  check(((await card("deepseek").locator("[data-credential-status]").textContent()) ?? "") === "Configured · varlock", "S12 the card reads \"Configured · varlock\" — presence, never the key");
  check(!(await page.content()).includes(DUMMY_KEY), "S12 binding a stored secret never brings the key into the page");

  // --- S13 · verify -----------------------------------------------------------------
  await card("deepseek").getByRole("button", {name: "Verify"}).click();
  await card("deepseek").locator("[data-credential-checked][data-verdict]").waitFor({timeout: 120000});
  const shown = await card("deepseek").locator("[data-credential-checked]").evaluate((node) => ({verdict: node.getAttribute("data-verdict"), text: node.textContent}));
  const owner = world.aikit("credential", "verify", "credential:deepseek").data?.verdict;
  check(["working", "refused", "unreachable"].includes(shown.verdict) && shown.verdict === owner,
    `S13 the card's verdict is the owner's own (${owner})`, {shown, owner});
  check(new RegExp(`${shown.verdict} \\(\\d{1,2}:\\d{2}( ?[AP]M)?\\)$`).test(shown.text ?? "") && /(Checked|Verified) (just now|\d+s ago)/.test(shown.text ?? ""),
    "S13 the verdict is shown in words with the time it was checked", {text: shown.text});
  const recorded = (world.aikit("credential", "list").data?.bindings ?? []).find((binding) => binding.credential_ref === "credential:deepseek");
  check(owner === "unreachable" || typeof recorded?.last_verified_at_unix_seconds === "number", "S13 a definitive verdict is recorded by the owner");
  await shot("verified");

  // Revoke is the owner's own verb, confirmed with a second click.
  await card("deepseek").getByRole("button", {name: "Revoke"}).click();
  await card("deepseek").locator("[data-credential-revoke-confirm]").click();
  await page.waitForFunction(() => document.querySelector('[data-credential-card="deepseek"] [data-credential-status]')?.textContent?.startsWith("Revoked"), null, {timeout: 120000});
  const revoked = (world.aikit("credential", "list").data?.bindings ?? []).find((binding) => binding.credential_ref === "credential:deepseek");
  check(revoked?.revoked === true, "revoking marks the owner's binding revoked (nothing deleted)");

  // Look for keys on this machine: presence-only proposals.
  await page.locator("[data-credential-discover]").click();
  await page.locator("[data-credential-discovery]").waitFor({timeout: 120000});
  const discovery = (await page.locator("[data-credential-discovery]").textContent()) ?? "";
  check(/^(No new keys found on this machine\.|Found \d+ keys? on this machine)/.test(discovery), "Look for keys runs the owner's discovery and reports it in words", {discovery});
  check(!(await page.content()).includes(DUMMY_KEY), "discovery shows names and places only");
  await shot("discovered");
}
