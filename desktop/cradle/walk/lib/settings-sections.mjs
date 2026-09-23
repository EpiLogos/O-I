/**
 * Round-trip acceptance for the rebuilt settings sections
 * (HARNESS-SETTINGS-RESEARCH-2026-09-22 §2: status, harnesses, models,
 * credentials, skills). One implementation, two invokers — the
 * configuration walk (live world) and the system-settings walk (the empty
 * fixture `oi` world, where the AIKit disclosure is honestly absent AND
 * the harness/catalogue reads refuse through the suite dispatcher, since
 * the kernel routes them through OI_BIN: the panels must render those
 * refusals as their distinct failed states — `stance: "fixture"`).
 *
 * In the live stance the expectation is computed from the LIVE owner reads
 * the walk runs itself — `aikit system --json` (the owner's own
 * oi.product-settings-disclosure/v2 document), `aikit --json client
 * status`, `aikit model-catalogue show --json` — the same binaries the
 * walk bridge resolves (OI_AIKIT_BIN, else `aikit` on PATH). The surface
 * must equal the reads, row by row; masked law means presence and state
 * only, never material.
 */
import { execFileSync } from "node:child_process";

export function readLiveAikit(args) {
  const aikit = process.env.OI_AIKIT_BIN ?? "aikit";
  const run = execFileSync(aikit, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(run);
}

export function readLiveSystemDisclosure() {
  return readLiveAikit(["system", "--json"]);
}

export function readLiveClientStatus() {
  return readLiveAikit(["--json", "client", "status"]);
}

export function readLiveCatalogue() {
  return readLiveAikit(["model-catalogue", "show", "--json"]);
}

/** The disclosure facts, shaped the way the panels shape them (the same
 * pure contract as src/configuration/systemDisclosure.ts). Pass the
 * descriptor the PAGE actually read (`readDisclosureViaBridge` — the same
 * seam, the same kernel project context); without one, this falls back to
 * the ambient `aikit system --json`, which resolves a different project
 * context than the kernel's cwd and disagrees on context-scoped axes
 * (observed: the skills active axis, 2026-09-22). */
export function liveDisclosureFacts(descriptor) {
  const document = descriptor ?? readLiveSystemDisclosure();
  const section = (id) => document.sections.find((row) => row.id === id) ?? null;
  const axis = (sectionId, key, name = "effective") => {
    const setting = section(sectionId)?.settings.find((row) => row.key === key);
    return setting?.axes?.[name]?.value;
  };
  const inventory = Array.isArray(axis("models", "models.inventory")) ? axis("models", "models.inventory") : [];
  const requirements = axis("models", "models.credentials");
  const capabilityRows = Array.isArray(axis("skills", "skills.capabilities")) ? axis("skills", "skills.capabilities") : [];
  const activeIds = new Set(Array.isArray(axis("skills", "skills.capabilities", "active")) ? axis("skills", "skills.capabilities", "active") : []);
  return {
    version: document.owner?.owner_version ?? null,
    credentials: inventory.map((row) => String(row?.credential ?? "")),
    requirementStates: Object.values(requirements ?? {}).reduce((acc, row) => {
      if (row?.credential_ref) acc[String(row.credential_ref)] = String(row.state ?? "unknown");
      return acc;
    }, {}),
    skills: capabilityRows.map((row) => ({ id: String(row?.id ?? ""), active: activeIds.has(row?.id) })),
  };
}

async function openPanel(page, panel) {
  const toc = page.locator(".settings-toc");
  await toc.locator("button", { hasText: panel }).first().click();
  return page.locator(`[data-${panel === "status" ? "status" : panel === "harnesses" ? "harness" : panel}-panel]`);
}

/** The panel's own L5 duty: whatever else it shows, no raw JSON reaches it
 * (the shared scanner is imported by the scenarios themselves). */

export async function assertStatusPanel({ page, check, disclosureAvailable, facts: precomputed }) {
  const panel = await openPanel(page, "status");
  await panel.waitFor({ timeout: 120000 });
  if (!disclosureAvailable) {
    check((await panel.locator("[data-disclosure-absent]").count()) === 1,
      "Status: the absent AIKit disclosure renders its named absence — the suite facts still read (L3)");
  }
  if (disclosureAvailable) {
    const facts = precomputed ?? liveDisclosureFacts();
    const versionShown = (await panel.locator("[data-status-suite] dd").allTextContents()).join("\n");
    check(facts.version !== null && versionShown.includes(facts.version),
      `Status: the AIKit version shown equals the live disclosure's owner_version (${facts.version})`);
    const authRows = await panel.locator("[data-auth-row]").evaluateAll((nodes) =>
      nodes.map((node) => ({ credential: node.getAttribute("data-credential"), state: node.getAttribute("data-auth-state") })));
    const expected = Object.entries(facts.requirementStates);
    check(authRows.length === expected.length
      && expected.every(([credential, state]) => authRows.some((row) => row.credential === credential && row.state === state)),
      "Status: the sign-in rows equal the live disclosure's credential requirements, state by state",
      { authRows, expected });
  }
  check((await panel.locator("[data-status-connectivity]").count()) === 1,
    "Status: connectivity renders its honest line");
  return panel;
}

export async function assertHarnessesPanel({ page, check, stance = "live" }) {
  const panel = await openPanel(page, "harnesses");
  await panel.waitFor({ timeout: 120000 });
  if (stance === "fixture") {
    // The fixture world's harness face honestly refuses: the kernel routes
    // the harness census through the suite dispatcher (OI_BIN), and the
    // fixture `oi` implements only the census reads. The panel must render
    // that refusal as its distinct failed state — no cards, no spinner.
    const failed = panel.locator("[data-harnesses-failed]");
    await failed.waitFor({ timeout: 30000 });
    const message = ((await failed.textContent()) ?? "").trim();
    check(message.length > 0,
      "Harnesses: the fixture world's harness refusal renders as the panel's named failed state (failed ≠ loading ≠ absent)");
    check((await panel.locator("[data-harness-card]").count()) === 0,
      "Harnesses: a failed harness read fabricates no cards (L3)");
    return panel;
  }
  const live = readLiveClientStatus();
  const clients = Array.isArray(live?.data?.clients) ? live.data.clients : [];
  const expected = clients.map((row) => String(row?.harness || row?.client || ""));
  const rendered = await panel.locator("[data-harness-card]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      harness: node.getAttribute("data-harness"),
      detected: node.getAttribute("data-detected"),
      installed: node.getAttribute("data-installed"),
    })));
  check(rendered.length === expected.length,
    `Harnesses: one card per live client-status row — ${rendered.length} rendered / ${expected.length} live`);
  check(expected.every((name, index) => rendered[index]?.harness === name),
    "Harnesses: the cards are the live rows, in live order", { expected, rendered });
  const detectedLives = clients.map((row) => (row?.detection === "detected" || row?.detection === "self") ? "true" : "false");
  check(detectedLives.every((state, index) => rendered[index]?.detected === state),
    "Harnesses: each card's detection state equals the live read");
  // L4, per card: an uninstalled-but-DETECTED harness names the real install
  // path; an undetected one has nothing to install into and says so. Neither
    // may render a fake button.
  const cardTexts = await panel.locator("[data-harness-card]").allTextContents();
  const installHonesty = clients.every((row, index) => {
    const text = cardTexts[index] ?? "";
    if (row?.installed === true) return true;
    const detected = row?.detection === "detected" || row?.detection === "self";
    return detected ? text.includes("aikit client install") : text.includes("not detected");
  });
  check(installHonesty,
    "Harnesses: every uninstalled card names the real install path (aikit client install) or honestly reports not-detected — never a fake button (L4)");
  return panel;
}

export async function assertModelsPanel({ page, check, stance = "live" }) {
  const panel = await openPanel(page, "models");
  await panel.waitFor({ timeout: 120000 });
  const picker = panel.locator("[data-default-provider-picker]");
  check((await picker.count()) === 1, "Models: the default-provider picker renders");
  if (stance === "fixture") {
    // The catalogue read rides the same suite dispatcher, so the fixture
    // world refuses it by name: the panel must show that refusal, and the
    // L4 obligation naming still holds.
    const failed = panel.locator("[data-catalogue-failed]");
    await failed.waitFor({ timeout: 30000 });
    const message = ((await failed.locator("[role=alert]").textContent()) ?? "").trim();
    check(message.length > 0,
      "Models: the fixture world's catalogue refusal renders as the section's named failed state");
    check((await panel.locator("[data-catalogue-ok]").count()) === 0,
      "Models: a failed catalogue read fabricates no catalogue table (L3)");
  } else {
    const catalogueLive = readLiveCatalogue();
    const liveEntries = Array.isArray(catalogueLive?.data?.entries) ? catalogueLive.data.entries : [];
    const liveCount = typeof catalogueLive?.data?.catalogued === "number" ? catalogueLive.data.catalogued : liveEntries.length;
    const countShown = await panel.locator("[data-catalogue-count]").textContent();
    check(countShown !== null && new RegExp(`\\b${liveCount}\\b`).test(countShown),
      `Models: the catalogue count the surface shows equals the live read (${liveCount})`, { shown: countShown });
  }
  check((await panel.locator("[data-model-obligations] code").allTextContents()).join(" ").includes("aikit compose --json"),
    "Models: route availability names its real native path — aikit compose --json (L4)");
  return panel;
}

export async function assertCredentialsPanel({ page, check, disclosureAvailable, facts: precomputed }) {
  const panel = await openPanel(page, "credentials");
  await panel.waitFor({ timeout: 120000 });
  if (!disclosureAvailable) {
    check((await panel.locator("[data-disclosure-absent]").count()) === 1,
      "Credentials: the absent disclosure renders its named absence (L3)");
    return panel;
  }
  const facts = precomputed ?? liveDisclosureFacts();
  const rendered = await panel.locator("[data-credential-card]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-credential")));
  check(rendered.length === facts.credentials.length && facts.credentials.every((name) => rendered.includes(name)),
    `Credentials: one card per live inventory row — ${rendered.length} rendered / ${facts.credentials.length} live`,
    { rendered, live: facts.credentials });
  const actions = (await panel.locator("[data-credential-actions] code").allTextContents()).join(" ");
  check(["setup", "verify", "rotate", "revoke"].every((verb) => actions.includes(`aikit credential ${verb}`)),
    "Credentials: every verb names the owner's real credential path (setup/verify/rotate/revoke) — no fake buttons (L4)");
  const panelText = (await panel.textContent()) ?? "";
  check(!/sk-[A-Za-z0-9]{8}/.test(panelText),
    "Credentials: no key-material-shaped text renders anywhere on the panel (masked law)");
  return panel;
}

export async function assertSkillsPanel({ page, check, disclosureAvailable, facts: precomputed }) {
  const panel = await openPanel(page, "skills");
  await panel.waitFor({ timeout: 120000 });
  if (!disclosureAvailable) {
    check((await panel.locator("[data-disclosure-absent]").count()) === 1,
      "Skills: the absent disclosure renders its named absence (L3)");
    return panel;
  }
  const facts = precomputed ?? liveDisclosureFacts();
  const rendered = await panel.locator("[data-skill-row]").evaluateAll((nodes) =>
    nodes.map((node) => ({ id: node.getAttribute("data-skill"), active: node.getAttribute("data-active") })));
  check(rendered.length === facts.skills.length,
    `Skills: one row per live resolved capability — ${rendered.length} rendered / ${facts.skills.length} live`);
  check(facts.skills.every((skill, index) => rendered[index]?.id === skill.id),
    "Skills: the rows are the live capabilities, in live order");
  check(facts.skills.every((skill, index) => (rendered[index]?.active === "true") === skill.active),
    "Skills: each row's active state equals the disclosure's active axis");
  check((await panel.locator("[data-skill-obligations] code").allTextContents()).join(" ").includes("aikit enable"),
    "Skills: scope enable/disable names the real native verbs — aikit enable/disable (L4)");
  return panel;
}
