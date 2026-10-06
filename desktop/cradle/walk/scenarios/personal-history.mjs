/**
 * Personal-history intake walk (Central #242 packet C): the /user entrance
 * in the personal ground drives a real disposable Central world through the
 * complete intake journey — choose → inspect → plan → the human-accepted
 * apply → verify.
 *
 * Setup stands a fresh Central world with an anchored person (openly
 * authored controlled corpus — no private material), and the walk bridge
 * runs in that ground so the kernel's Action dispatch reaches the real
 * `central.personal.*` owner operations. PERSONAL_HISTORY_CTRL names the
 * ctrl build carrying the intake actions; the walk is honest about its
 * absence rather than serving a fixture answer.
 */
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ENTRY = "2026-03-14";
const WORLD_DAY = "2026-03-14-first-thaw";

function write(world, relative, body) {
  const target = path.join(world, relative);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, body);
}

/** Setup runs before the browser: run() reads the fixture paths it left here. */
const fixture = {archive: "", central: ""};

export async function setup({cradleRoot}) {
  const ctrl = process.env.PERSONAL_HISTORY_CTRL
    ?? (() => {
      try { return execFileSync("which", ["ctrl"]).toString().trim(); } catch { return ""; }
    })();
  if (!ctrl || !fs.existsSync(ctrl)) {
    throw new Error("personal-history walk needs a ctrl carrying central.personal.* — set PERSONAL_HISTORY_CTRL to that build");
  }
  const world = fs.mkdtempSync(path.join(os.tmpdir(), "oi-walk-personal-history-"));
  const central = path.join(world, "Central");
  for (const dir of ["Control/user/identity", "Control/agents", "Control/machines", "Work"]) {
    fs.mkdirSync(path.join(central, dir), {recursive: true});
  }
  execFileSync(ctrl, ["--json", "--root", central, "init"], {stdio: "ignore"});
  // The person anchor: ordinary authored ground, the ordinary manifest.
  write(path.join(central), "Control/user/identity/present.md", "I keep field notes.\n");
  write(path.join(central), "Control/user/identity/manifest.json", JSON.stringify({
    schema: "central.pasu.identity-manifest/v1", revision: "1",
    subject: {ref: "central:pasu:nara:local", title: "Walk subject"},
    identity_source: {
      path: "Control/user/identity", provenance_law: "walk corpus",
      sources: [{path: "Control/user/identity/present.md", standing: "authored-ground"}],
    },
  }, null, 1));
  // The controlled collection: openly authored, varied on purpose.
  const archive = path.join(world, "archive");
  fixture.archive = archive;
  fixture.central = central;
  // The desktop's own workspace binding: without it the frame shows the
  // connect screen and the personal ground never opens.
  write(path.join(world), ".config/oi/composition.json", JSON.stringify({
    schema: 1,
    personal_ground: central,
    modules: {},
  }, null, 1));
  write(archive, `journal/${WORLD_DAY}.md`, `---\ndate: ${ENTRY}\ntype: journal\nweather: sleet\n---\n# First thaw\n\nSnowdrops — स्नोड्रॉप्स 🌱 — by the back step.\n`);
  write(archive, "journal/2026-04-02-dream.md", "---\ndate: 2026-04-02\ntype: dream\n---\n# The two doors\n\nA mood with furniture.\n");
  fs.writeFileSync(path.join(archive, "journal/2026-04-30-scan.bin"), Buffer.from([0x00, 0x01, 0xff, 0xfe]));
  return {
    env: {
      CENTRAL_ROOT: central,
      CENTRAL_CTRL_BIN: ctrl,
      // The kernel spawns owner CLIs from the bridge's ground: the walk
      // world is that ground, never this checkout. The toolchain keeps its
      // real homes — a borrowed HOME must not hide rustup's default.
      HOME: world,
      RUSTUP_HOME: process.env.RUSTUP_HOME ?? path.join(os.homedir(), ".rustup"),
      CARGO_HOME: process.env.CARGO_HOME ?? path.join(os.homedir(), ".cargo"),
    },
    bridgeCwd: central,
    cleanup: () => fs.rmSync(world, {recursive: true, force: true}),
  };
}

export default async function run({page, baseUrl, check, shot}) {
  await page.goto(`${baseUrl}/`, {waitUntil: "domcontentloaded"});
  // Open the Central destination: the intake flow lives in the personal
  // ground (root register, Intent section of the left body).
  // The world read settles before the disclosure: a click racing the
  // navigation store's load is overwritten by it.
  await page.getByText("CONTROL", {exact: true}).first().waitFor({timeout: 60_000});
  // Selecting the root register is the workspace's own act (Start writing
  // drafts in the chosen register); without it the Central disclosure has no
  // key to persist under and the personal ground never opens.
  await page.locator('button', {hasText: "Start writing"}).first().click();
  await page.waitForTimeout(1500);
  const row = page.locator('[data-destination="central"] button').first();
  await row.click();
  await page.waitForTimeout(2000);
  try {
    await page.locator('.left-central-root').waitFor({timeout: 15_000});
  } catch {
    const state = {
      rowText: (await row.textContent())?.slice(0, 60),
      ariaCurrent: await row.getAttribute("aria-current"),
      centralRows: await page.locator("[data-destination]").evaluateAll(nodes =>
        nodes.map(node => ({d: node.getAttribute("data-destination"), buttons: node.querySelectorAll("button").length}))),
      leftButtons: (await page.locator(".world-navigator button").allTextContents()).slice(0, 14),
    };
    throw new Error(`Central destination did not disclose: ${JSON.stringify(state)}`);
  }
  const flow = page.locator("[data-personal-history]");
  await flow.waitFor({timeout: 120_000});
  await flow.locator(".ph-anchor").filter({hasText: "central:pasu:nara:local"})
    .waitFor({timeout: 120_000});
  check(true, "the personal ground opens on the anchored person readback");

  // Choose → inspect: the controlled archive, with its dispositions named.
  await flow.locator(".ph-path").fill(fixture.archive);
  await flow.locator("button", {hasText: "Inspect…"}).click();
  await flow.locator(".ph-inspection").waitFor({timeout: 120_000});
  const dispositions = await flow.locator(".ph-member").evaluateAll(nodes =>
    nodes.map(node => node.getAttribute("data-disposition")));
  check(dispositions.filter(d => d === "retained").length === 2,
    "both readable entries are retained", {dispositions});
  check(dispositions.includes("unreadable"),
    "the binary member stays visible as unreadable, never silently dropped", {dispositions});
  await shot("inspected");

  // Plan: the placement review, whole-file retention, no conflicts.
  await flow.locator("button", {hasText: "Plan the placement…"}).click();
  await flow.locator(".ph-review").waitFor({timeout: 120_000});
  check((await flow.locator(".ph-conflict").count()) === 0,
    "the reviewed plan carries no conflicts");
  check((await flow.locator(".ph-plan-entry[data-entry-action='copy-register']").count()) === 3,
    "every member is a fresh bring-in on the first import");
  check((await flow.locator(".ph-plan").textContent()).includes("central:pasu:nara:local"),
    "the plan names the anchored person it adopts for");

  // The human-accepted act, then the receipt.
  await flow.locator("button", {hasText: "Adopt into my world"}).click();
  await flow.locator(".ph-result").waitFor({timeout: 120_000});
  const receipt = await flow.locator(".ph-result").textContent();
  check(receipt.includes("3 brought in"), "the receipt names what arrived", {receipt});
  check((await flow.locator(".ph-refused").count()) === 0, "nothing was refused");

  // Verify: the retained material rechecks against its recorded revisions.
  await flow.locator("button", {hasText: "Verify retained material"}).click();
  await flow.locator(".ph-verify").waitFor({timeout: 120_000});
  const verify = await flow.locator(".ph-verify").textContent();
  check(verify.includes('"verified": 3'), "verification accounts for every member", {verify});
  check(verify.includes('"entries_total": 3'), "the total includes the unreadable member's retention", {verify});
  await shot("verified");
}
