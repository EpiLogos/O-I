/**
 * The Epi-Logos LENS (10-SIDEBARS §3.1, ruling D2, amendment A5), on the
 * real kernel with a disposable ground.
 *
 *   on   the minimal toggle at the END of the hidden window footer turns it
 *        on; the head shows an "Epi-Logos" chip beside the scope (visible
 *        with the footer hidden); the trees re-root on the corpus (Work/epi);
 *        no surface or tab opens; the mode and the scope are unchanged
 *   mode it holds across a mode switch (a lens, not a mode)
 *   off  the chip's × turns it off; the tree rows are byte-identical to
 *        before (same ids, same expansion)
 */
import {setup as groundSetup, bindDefaultCentral} from "./left-ground.mjs";

export async function setup(args) { return groundSetup(args); }

/** A signature of the trees: every row's identity and expansion state. */
const treeSignature = left => left.evaluate(node => [...node.querySelectorAll('[data-section="control"] [data-file-path], [data-section="work"] [data-project-path], [data-section="work"] [data-file-path], [data-section="work"] [data-session-ref]')]
  .map(el => [el.getAttribute("data-file-path") ?? el.getAttribute("data-project-path") ?? el.getAttribute("data-session-ref"), el.getAttribute("aria-expanded"), el.getAttribute("aria-current")].join("|")));

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const left = page.locator('[data-region="left"]');
  const head = left.locator("[data-left-head]");
  await page.locator('[data-project-path="Work/Alpha"]').waitFor({timeout: 30000});
  // Shape the trees first: Control/user open, Alpha open on its files with
  // ProjectCentral/user expanded, Beta open on its chats.
  await left.locator('button[data-file-path="Control/user"]').click();
  await left.locator('button[data-file-path="Control/user/flows"]').waitFor({timeout: 20000});
  await page.locator('[data-project-path="Work/Alpha"]').click();
  await page.locator('[data-project-path="Work/Alpha"]').hover();
  await left.locator('li[data-navigation-path="Work/Alpha"]').getByRole("button", {name: "Alpha: files", exact: true}).click();
  await left.locator('button[data-file-path="Work/Alpha/notes.md"]').waitFor({timeout: 20000});
  await page.locator('[data-project-path="Work/Beta"]').click();
  await left.locator(".left-conversation[data-session-ref]").filter({hasText: "Beta"}).first().waitFor({timeout: 20000});
  await page.waitForTimeout(800);
  const before = await treeSignature(left);
  const tabsBefore = await page.locator('[role="tab"]').count();
  const surfacesBefore = Object.keys((await channel("read.state")).data.surfaces ?? {}).length;
  const modeBefore = await page.locator(".desktop-shell").getAttribute("data-mode");
  const scopeBefore = await head.locator(".left-scope-name").innerText();

  // ---- the toggle is the last control of the hidden window footer
  const footerEdge = page.locator(".workspace-footer-edge");
  await footerEdge.hover();
  const toggle = page.locator(".canvas-arrangement").getByRole("button", {name: "Epi-Logos lens"});
  const isLast = await page.locator(".canvas-arrangement").evaluate(node => [...node.children].at(-1)?.getAttribute("aria-label"));
  check(isLast === "Epi-Logos lens" && (await toggle.getAttribute("aria-pressed")) === "false", "A5: the lens toggle is the minimal last control of the window footer, off", {isLast});
  await toggle.click();
  // Move the pointer and the focus away, so the footer hides again.
  await page.mouse.move(700, 300);
  await page.evaluate(() => (document.activeElement)?.blur?.());
  await page.waitForTimeout(500);
  const footerHidden = await page.locator(".canvas-arrangement").evaluate(node => getComputedStyle(node).opacity === "0");
  const chip = head.getByRole("status", {name: "Epi-Logos lens is on"});
  check(footerHidden && await chip.isVisible() && (await chip.innerText()).trim() === "Epi-Logos", "D2: with the lens on and the footer hidden again, the head shows the Epi-Logos chip beside the scope", {footerHidden});
  const corpus = left.locator('[data-section="epi-corpus"]');
  await corpus.locator('button[data-file-path="Work/epi/essays"]').waitFor({timeout: 20000});
  const corpusRows = await corpus.locator("button[data-file-path]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-file-path")));
  const controlVisible = await left.locator('[data-section="control"]').isVisible();
  const workVisible = await left.locator('[data-section="work"]').isVisible();
  check(JSON.stringify([...corpusRows].sort()) === JSON.stringify(["Work/epi/bimba", "Work/epi/essays"]) && !controlVisible && !workVisible && (await corpus.getAttribute("aria-label")) === "Epi-Logos corpus", "D2: the trees re-root on the corpus — EPI-LOGOS CORPUS shows exactly Work/epi's entries; CONTROL and WORK stand aside", {corpusRows, controlVisible, workVisible});
  await corpus.locator('button[data-file-path="Work/epi/essays"]').click();
  await corpus.locator('button[data-file-path="Work/epi/essays/Return of Zero.md"]').waitFor({timeout: 20000});
  const tabsOn = await page.locator('[role="tab"]').count();
  const surfacesOn = Object.keys((await channel("read.state")).data.surfaces ?? {}).length;
  check(tabsOn === tabsBefore && surfacesOn === surfacesBefore && await page.locator(".desktop-shell").getAttribute("data-mode") === modeBefore && await head.locator(".left-scope-name").innerText() === scopeBefore, "D2: turning the lens on opened no surface or tab and changed neither the mode nor the scope", {tabsBefore, tabsOn, surfacesBefore, surfacesOn, modeBefore, scopeBefore});
  await shot("lens-on");
  // A lens, not a mode: it holds across a mode switch.
  await left.locator('.world-mode-strip [data-mode="factory"]').click();
  await page.locator('.desktop-shell[data-mode="factory"]').waitFor();
  check(await chip.isVisible(), "The lens holds across a mode switch (Factory keeps the chip)");
  await left.locator('.world-mode-strip [data-mode="base"]').click();
  await page.locator('.desktop-shell[data-mode="base"]').waitFor();

  // ---- off: the trees come back byte-identical
  await chip.getByRole("button", {name: "Leave the Epi-Logos lens"}).click();
  await chip.waitFor({state: "detached", timeout: 10000});
  await left.locator('[data-section="control"]').waitFor();
  await left.locator(".left-conversation[data-session-ref]").filter({hasText: "Beta"}).first().waitFor({timeout: 20000});
  await left.locator('button[data-file-path="Work/Alpha/notes.md"]').waitFor({timeout: 20000});
  await page.waitForTimeout(800);
  const after = await treeSignature(left);
  check(before.length > 10 && JSON.stringify(after) === JSON.stringify(before) && await left.locator('[data-section="epi-corpus"]').count() === 0, "D2: turning it off restores the trees exactly — every row's id and expansion identical to before", {rows: before.length, differing: before.map((row, index) => row === after[index] ? null : [row, after[index]]).filter(Boolean).slice(0, 6), afterRows: after.length});
  await footerEdge.hover();
  check((await toggle.getAttribute("aria-pressed")) === "false", "The footer toggle reads off again");
  await shot("lens-off");
}
