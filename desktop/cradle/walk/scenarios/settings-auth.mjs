/**
 * 12-SETTINGS §3.3/§3.4 + HARNESS-SETTINGS-RESEARCH-2026-09-22 §2a — the
 * login option beside the API-key input, walked against the real kernel and
 * the installed AIKit. Nothing here is a fixture: the harnesses' declared
 * auth options are read live twice (once by the page through the kernel, once
 * by the walk through the owner's own CLI) and the two readings must agree.
 *
 *   A1 live render: every ready harness's Models row renders exactly what
 *      `aikit harness auth <slug> --json` declares — a runnable own-login
 *      becomes a "Log in with …" button whose command text is the declared
 *      argv; a note-only entry renders its note as visible instruction and
 *      NO button.
 *   A2 handover: clicking the Log in button opens a real terminal surface
 *      bound to the declared command (the login runs in a PTY, not in the
 *      page); the surface names the command it carries.
 *   A3 credentials cards: a provider card gains the Log in action exactly
 *      when some ready harness's live face declares a runnable login for it.
 *   A4 refuse copy: a note-only harness's login refuses in the owner's own
 *      words (`harness_auth.no_login_declared` + the note as instruction) —
 *      the note the page shows is the note the owner verb prints.
 */
import {execFileSync} from "node:child_process";
import {settingsWorld} from "../lib/settings-world.mjs";
import {enterSettings, openSection, settled} from "../lib/settings-walk.mjs";

const SLUG = (text) => String(text ?? "").trim();
const AIKIT_BIN = process.env.OI_AIKIT_BIN ?? "aikit";

export async function setup() {
  return settingsWorld();
}

export default async function run({page, baseUrl, check, shot, provision: world, log}) {
  await enterSettings(page, {root: world.root, baseUrl});

  // The harnesses' declared auth options, read live from the owner's CLI in
  // the same isolated world the walk bridge binds — the reference reading.
  const face = async (slug) => {
    const reply = world.aikit("harness", "auth", SLUG(slug), "--json");
    if (!reply.ok) throw new Error(`aikit harness auth ${slug}: ${JSON.stringify(reply.error)}`);
    return reply.data;
  };
  const runnableEntries = (authFace) => (authFace.own_login ?? []).filter((entry) => entry.runnable === true && Array.isArray(entry.argv) && entry.argv.length > 0);

  // --- A1 · the Models rows render the live face -----------------------------
  await openSection(page, "models");
  await settled(page);
  await page.waitForFunction(() => {
    const panel = document.querySelector("[data-models-panel]");
    return panel && panel.querySelectorAll("[data-harness-auth]").length > 0 && !panel.querySelector("[data-auth-reading]");
  }, null, {timeout: 120000});

  const rows = await page.evaluate(() => [...document.querySelectorAll("[data-models-panel] [data-harness-auth]")].map((block) => block.getAttribute("data-harness-auth")));
  check(rows.length > 0, "A1 the Models section shows at least one ready harness's auth options (live read)", {rows});
  let sawRunnable = false;
  let sawNoteOnly = false;
  const noteOnlySlugs = [];
  const shownNotes = {};
  for (const slug of rows) {
    const authFace = await face(slug);
    const block = page.locator(`[data-models-panel] [data-harness-auth="${slug}"]`);
    const runnable = runnableEntries(authFace);
    const buttons = block.locator("[data-auth-login-button]");
    if (runnable.length > 0) {
      sawRunnable = true;
      const declared = runnable[0].argv.join(" ");
      const declaredProgram = runnable[0].argv[0];
      const buttonText = SLUG(await buttons.first().textContent());
      check(buttonText.startsWith("Log in with") && buttonText.includes(declaredProgram),
        `A1 ${slug}: the runnable login renders a "Log in with ${declaredProgram}" button`, {buttonText, declared});
      const commandText = SLUG(await block.locator("[data-auth-command]").first().textContent());
      check(commandText === declared, `A1 ${slug}: the command shown is the declared argv verbatim, from the live read`, {commandText, declared});
      check(await buttons.count() === runnable.length, `A1 ${slug}: one login button per runnable entry, never more`, {buttons: await buttons.count(), runnable: runnable.length});
    } else {
      sawNoteOnly = true;
      noteOnlySlugs.push(slug);
      check(await buttons.count() === 0, `A1 ${slug}: a note-only login offers no button — the note is the instruction`);
      const note = (authFace.own_login ?? [])[0]?.note ?? authFace.note ?? "";
      const shown = SLUG(await block.locator("[data-auth-note]").first().textContent().catch(() => ""));
      shownNotes[slug] = shown;
      check(shown === note && note.length > 0, `A1 ${slug}: the note shows visibly, verbatim from the live read`, {shown, note});
    }
  }
  check(sawRunnable || sawNoteOnly, "A1 every rendered row matched its live `harness auth --json` reading", {sawRunnable, sawNoteOnly});

  // --- A2 · the handover: a real terminal surface bound to the command ------
  if (sawRunnable) {
    let slug = null;
    for (const candidate of rows) {
      if (runnableEntries(await face(candidate)).length > 0) { slug = candidate; break; }
    }
    const declared = runnableEntries(await face(slug))[0].argv.join(" ");
    await page.locator(`[data-models-panel] [data-harness-auth="${slug}"] [data-auth-login-button]`).first().click();
    // A login is interactive: the handover leaves the Settings page (which
    // has no terminal canvas of its own) and the workspace shows the login
    // terminal, carrying the declared command in its binding.
    const surface = page.locator(".terminal-surface[data-terminal-command]").filter({hasText: declared}).first();
    await surface.waitFor({state: "visible", timeout: 30000});
    const status = SLUG(await surface.locator(".terminal-footer").textContent());
    check(status.includes(declared) && status.includes("Login command"),
      "A2 the login opens a terminal surface that names the declared command it will run", {status, declared});
    check((await surface.getAttribute("data-terminal-command")) === declared,
      "A2 the terminal surface's binding carries the declared argv, nothing else", {binding: await surface.getAttribute("data-terminal-command"), declared});
    const body = SLUG(await surface.textContent());
    check(body.includes("Open the desktop app to use its terminal"),
      "A2 no silent pretend-run: without the app's PTY host the surface says so instead of faking a login", {body: body.slice(0, 160)});
    log(`handover proof: ${slug} → ${declared}`);
  } else {
    log("no runnable login on this machine's ready set; the handover leg is not exercised here");
  }

  // --- A3 · the Credentials cards match the same live reading ----------------
  // The A2 handover left Settings (it returned the person to the workspace);
  // re-enter through the same gear before reading the cards.
  if (!(await page.locator("[data-settings-page]").isVisible().catch(() => false))) {
    await page.locator(".world-system-settings").first().click();
    await page.locator("[data-settings-page]").waitFor({timeout: 60000});
  }
  await openSection(page, "credentials");
  await settled(page);
  await page.waitForFunction(() => !document.querySelector("[data-settings-reading]"), null, {timeout: 240000});
  const cards = await page.evaluate(() => [...document.querySelectorAll("[data-credential-card]")].map((card) => card.getAttribute("data-credential-card")));
  for (const provider of cards) {
    const implied = [];
    for (const slug of rows) {
      for (const entry of runnableEntries(await face(slug))) {
        const ref = String(entry.provider_ref ?? "").replace(/^provider:/, "").toLowerCase();
        if (ref === provider) implied.push(slug);
      }
    }
    const rendered = await page.locator(`[data-credential-card="${provider}"] [data-provider-logins="${provider}"] [data-auth-login-button]`).count();
    check(implied.length === 0 ? rendered === 0 : rendered > 0,
      `A3 ${provider}: the card's Log in action follows the live declared faces exactly (${implied.length ? `runnable via ${implied.join(", ")}` : "no runnable login declared"})`, {provider, implied, rendered});
  }

  // --- A4 · the refuse copy is the owner's own -------------------------------
  // Run mode (no --json) is the login: a note-only harness refuses before
  // anything spawns, printing its note as the instruction — the exact words
  // the page shows beside the (absent) button.
  const noteSlug = noteOnlySlugs[0];
  if (!noteSlug) {
    log("no note-only harness among the ready set; the refuse-copy leg is not exercised here");
  } else {
  const note = (await face(noteSlug)).own_login?.[0]?.note ?? "";
  let refusal = {code: 0, text: ""};
  try {
    execFileSync(AIKIT_BIN, ["harness", "auth", noteSlug], {encoding: "utf8", env: {...process.env, ...world.env}});
  } catch (error) {
    refusal = {code: error.status ?? 1, text: `${error.stdout ?? ""}\n${error.stderr ?? ""}`};
  }
  check(refusal.code !== 0 && /no declared one-shot login/.test(refusal.text) && refusal.text.includes(note),
    `A4 the owner verb refuses a note-only login (harness_auth.no_login_declared) with the same note the page shows as the instruction`, {slug: noteSlug, text: refusal.text.slice(0, 240)});
  check(shownNotes[noteSlug] === note, "A4 the visible note on the page is exactly the instruction the refusal prints", {shown: shownNotes[noteSlug], note});
  }

  await shotMatrixShots({page, shot});
}

/** Screenshots at two widths, both appearances (the section rows, not a matrix —
 * this walk rides the same page the other settings walks shoot). */
async function shotMatrixShots({page, shot}) {
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({colorScheme: scheme});
    await page.setViewportSize({width: 1440, height: 900});
    await page.waitForTimeout(250);
    await shot(`settings-auth-${scheme}`);
  }
  await page.emulateMedia({colorScheme: "light"});
  await page.setViewportSize({width: 1280, height: 820});
}
