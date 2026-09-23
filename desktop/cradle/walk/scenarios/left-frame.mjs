/**
 * The left frame's geometry and states (10-SIDEBARS §5.1 L1–L8), walked
 * against the real kernel through the walk bridge on a disposable ground.
 *
 *   L1 rest        head, body, foot; width 240 (200–330); head and foot
 *                  pinned while the body scrolls; no scrollbar pixels
 *   L2 collapsed   ⌘B round-trip restores width and scroll; the scope name
 *                  moves into the topbar
 *   L3 compact     at 1000px titles intact, times hidden
 *   L4 overlay     <640px opens over the centre, focus trapped, Escape
 *                  closes, focus returns to the invoker
 *   L5 resizing    drag and keyboard both clamp to the tokens (200–330)
 *   L6 reading     the head keeps the last known scope; "Reading…" under the
 *                  body's first section; no invented projects
 *   L8 mode switch head and foot boxes identical before and after (±0.5px);
 *                  only the body changes
 *
 * L7 (unreadable) has its own walk (left-unreadable) — it kills the transport.
 */
import {setup as groundSetup, bindDefaultCentral} from "./left-ground.mjs";

export async function setup(args) { return groundSetup(args); }

const box = async (locator) => { const b = await locator.boundingBox(); return b ? {x: Math.round(b.x * 2) / 2, y: Math.round(b.y * 2) / 2, width: Math.round(b.width * 2) / 2, height: Math.round(b.height * 2) / 2} : null; };
const same = (a, b) => !!a && !!b && Math.abs(a.x - b.x) <= 0.5 && Math.abs(a.y - b.y) <= 0.5 && Math.abs(a.width - b.width) <= 0.5 && Math.abs(a.height - b.height) <= 0.5;

export default async function run({page, baseUrl, check, shot, channel, metric, provision: p}) {
  // L6 first: the navigator's world read is held back so the pending state
  // is observable, then released.
  let releaseWorld;
  const held = new Promise(resolve => { releaseWorld = resolve; });
  let holdWorld = false;
  await page.route("**/op", async route => {
    const body = route.request().postDataJSON?.();
    if (holdWorld && body?.op === "world_browse") { await held; }
    await route.continue();
  });
  const opErrors = [];
  page.on("response", async response => {
    if (!response.url().endsWith("/op")) return;
    try { const reply = await response.json(); if (reply.error) opErrors.push({op: response.request().postDataJSON()?.op, error: String(reply.error).slice(0, 300)}); } catch {}
  });
  const inflight = new Map();
  page.on("request", request => { if (request.url().endsWith("/op")) inflight.set(request, {at: Date.now(), body: (request.postData() ?? "").slice(0, 160)}); });
  page.on("requestfinished", request => inflight.delete(request));
  page.on("requestfailed", request => inflight.delete(request));
  globalThis.__leftInflight = () => [...inflight.values()].map(entry => ({age: Date.now() - entry.at, body: entry.body}));
  page.on("console", message => { if (message.type() === "error") opErrors.push({console: message.text().slice(0, 300)}); });
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const left = page.locator('[data-region="left"]');
  const head = left.locator("[data-left-head]");
  const foot = left.locator("[data-left-foot]");
  const body = left.locator("[data-left-body]");
  await head.waitFor();
  await page.locator('[data-project-path="Work/Alpha"]').waitFor({timeout: 30000});

  // ---- L1 rest
  const leftBox = await box(left);
  check(leftBox && Math.abs(leftBox.width - 240) <= 0.5, "L1: the left rests at the --oi-sidebar-width token (240px)", leftBox);
  const headText = (await head.innerText()).replace(/\s+/g, " ").trim();
  check(/Central/.test(headText) && await head.getByRole("button", {name: "Search"}).count() === 1 && await head.getByRole("button", {name: "Create"}).count() === 1, "L1: the head names the scope (Central) and carries search and + create", headText);
  const footText = (await foot.innerText()).replace(/\s+/g, " ").trim();
  const strip = foot.getByRole("radiogroup", {name: "Workspace mode"});
  const modeNames = await strip.getByRole("radio").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label")));
  check(footText.startsWith("Inbox") && JSON.stringify(modeNames) === JSON.stringify(["Base", "Factory", "Expressions", "Technè"]) && await foot.getByRole("button", {name: "Settings", exact: true}).count() === 1, "L1: the foot is Inbox, then Base · Factory · Expressions · Technè, then Settings (one label)", {footText, modeNames});
  check(await left.getByText("My O:I").count() === 0 && await left.getByText("Personal ground").count() === 0 && await left.getByRole("button", {name: "System", exact: true}).count() === 0, "L1: the hardcoded 'My O:I / Personal ground' heading and the 'System' label are gone");
  // Pin: fill the body past its height (expand Control and the projects),
  // scroll it, and prove head and foot hold still.
  for (const project of ["Alpha", "Beta", "O-I"]) await page.locator(`[data-project-path="Work/${project}"]`).click();
  await left.locator('[data-file-path="Control/user"]').click().catch(() => {});
  await page.setViewportSize({width: 1440, height: 520});
  await page.waitForTimeout(300);
  const headBefore = await box(head), footBefore = await box(foot);
  const scrollable = await body.evaluate(node => node.scrollHeight > node.clientHeight + 4);
  await body.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await page.waitForTimeout(120);
  const scrolled = await body.evaluate(node => node.scrollTop);
  const headAfter = await box(head), footAfter = await box(foot);
  check(scrollable && scrolled > 0 && same(headBefore, headAfter) && same(footBefore, footAfter), "L1: the body scrolls while the head and foot stay pinned (two-sided ±0.5px)", {scrollable, scrolled, headBefore, headAfter, footBefore, footAfter});
  const bar = await body.evaluate(node => ({offset: node.offsetWidth - node.clientWidth, css: getComputedStyle(node).scrollbarWidth}));
  check(bar.offset === 0 && bar.css === "none", "L1: no scrollbar pixels in the body (offsetWidth − clientWidth = 0, scrollbar-width none)", bar);
  await body.evaluate(node => { node.scrollTop = 40; });
  await page.setViewportSize({width: 1440, height: 900});
  await page.waitForTimeout(200);
  await shot("L1-rest-1440");

  // ---- L5 resizing: drag and keyboard clamp to the tokens
  const separator = left.getByRole("separator", {name: "Resize left region"});
  const valueMin = await separator.getAttribute("aria-valuemin"), valueMax = await separator.getAttribute("aria-valuemax");
  check(valueMin === "200" && valueMax === "330", "L5: the separator declares the token clamp 200–330 (not the old 600)", {valueMin, valueMax});
  const sep = await separator.boundingBox();
  await page.mouse.move(sep.x + sep.width / 2, sep.y + 200);
  await page.mouse.down();
  await page.mouse.move(sep.x + 400, sep.y + 200, {steps: 6});
  const badge = await left.locator(".region-resize-badge").innerText().catch(() => "");
  await page.mouse.up();
  await page.waitForTimeout(250);
  const wide = await box(left);
  check(badge === "330" && Math.abs(wide.width - 330) <= 0.5, "L5: dragging far right clamps at 330px, with the live px badge reading 330", {badge, width: wide.width});
  await separator.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(250);
  const narrow = await box(left);
  check(Math.abs(narrow.width - 200) <= 0.5, "L5: the keyboard clamps at 200px", {width: narrow.width});
  await page.keyboard.press("Home");
  await page.waitForTimeout(250);
  const reset = await box(left);
  check(Math.abs(reset.width - 240) <= 0.5, "L5: Home returns the width to the 240px token", {width: reset.width});

  // ---- L2 collapsed: ⌘B round-trip restores width and scroll; scope in topbar
  await page.setViewportSize({width: 1440, height: 520});
  await page.waitForTimeout(200);
  await body.evaluate(node => { node.scrollTop = 60; });
  const scrollBefore = await body.evaluate(node => node.scrollTop);
  const widthBefore = (await box(left)).width;
  const topScopeBefore = await page.locator("[data-shell-scope]").count();
  await page.keyboard.press("Meta+b");
  await page.waitForTimeout(350);
  const collapsedBox = await left.boundingBox();
  const topScope = await page.locator("[data-shell-scope]").innerText().catch(() => "");
  const corner = await page.getByRole("button", {name: "Toggle left region"}).isVisible();
  check((!collapsedBox || collapsedBox.width < 1) && topScopeBefore === 0 && topScope === "Central" && corner, "L2: collapsed, the region is gone, the corner toggle stays and the scope name moves into the topbar", {collapsedBox, topScope, corner});
  await page.keyboard.press("Meta+b");
  await page.waitForTimeout(350);
  const widthAfter = (await box(left)).width;
  const scrollAfter = await body.evaluate(node => node.scrollTop);
  check(Math.abs(widthAfter - widthBefore) <= 0.5 && scrollAfter === scrollBefore && await page.locator("[data-shell-scope]").count() === 0, "L2: ⌘B round-trip restores the width and the body's scroll position; the topbar scope leaves", {widthBefore, widthAfter, scrollBefore, scrollAfter});
  await page.setViewportSize({width: 1440, height: 900});

  // ---- L3 compact (≤1000px): titles intact, times yield. The Inbox row
  // carries a real arrival time; it is shown wide and yields at 1000px.
  await page.setViewportSize({width: 1440, height: 820});
  await foot.getByRole("button", {name: /^Inbox/}).click();
  const arrival = left.locator(".left-inbox .receiving-row").first();
  await arrival.waitFor({timeout: 20000});
  const readRow = () => arrival.evaluate(node => {
    const time = node.querySelector("time");
    const origin = node.querySelector(".receiving-origin");
    return {time: time?.textContent, timeShown: !!time && getComputedStyle(time).display !== "none" && time.getBoundingClientRect().width > 0, origin: origin?.textContent, originWidth: origin?.getBoundingClientRect().width ?? 0};
  });
  const wideRow = await readRow();
  await page.setViewportSize({width: 1000, height: 820});
  await page.waitForTimeout(300);
  const compactRow = await readRow();
  check(wideRow.timeShown && !!wideRow.time && !compactRow.timeShown && compactRow.origin === wideRow.origin && compactRow.originWidth > 0, "L3: at 1440 the row shows its time; at 1000px the time yields and the title text is intact", {wideRow, compactRow});
  await foot.getByRole("button", {name: /^Inbox/}).click();
  const conversation = left.locator(".left-conversation").first();
  try { await conversation.waitFor({timeout: 20000}); }
  catch (error) { throw new Error(`no conversation rows; op errors: ${JSON.stringify(opErrors.slice(-12))}; inflight: ${JSON.stringify(globalThis.__leftInflight())}`); }
  const compact = await conversation.evaluate(node => {
    const title = node.querySelector(".left-conversation-title");
    return {titleVisible: !!title && title.getBoundingClientRect().height > 0, titleText: title?.textContent, accessible: node.querySelector(".left-row-main")?.getAttribute("aria-label")};
  });
  check(compact.titleVisible && !!compact.titleText && compact.accessible?.startsWith(compact.titleText), "L3: at 1000px a conversation's full native title is present (clamped visually, whole in its accessible name)", compact);
  await shot("L3-compact-1000");

  // ---- L4 overlay (<640px): over the centre, focus trapped, Escape closes, focus returns
  await page.setViewportSize({width: 600, height: 820});
  await page.waitForTimeout(300);
  const invoker = page.getByRole("button", {name: "Toggle left region"});
  await invoker.focus();
  await invoker.click();
  await page.locator('[data-region="left"][data-overlay="true"]').waitFor({timeout: 5000});
  const overlay = await box(left);
  const centre = await box(page.locator('[data-region="centre"]'));
  const inside = [];
  for (let i = 0; i < 40; i++) { await page.keyboard.press("Tab"); inside.push(await page.evaluate(() => !!document.activeElement?.closest('[data-region="left"]'))); }
  check(!!overlay && overlay.width > 0 && !!centre && overlay.x <= centre.x + 1, "L4: below 640px the left opens as an overlay over the centre", {overlay, centre});
  check(inside.every(Boolean), "L4: focus is trapped inside the overlay (40 Tab presses stay inside)", {stayed: inside.filter(Boolean).length});
  await shot("L4-overlay-600");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const closed = await page.locator('[data-region="left"][data-overlay="true"]').count();
  const refocused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  check(closed === 0 && refocused === "Toggle left region", "L4: Escape closes the overlay and focus returns to the invoker", {closed, refocused});
  await page.setViewportSize({width: 1280, height: 820});
  await page.waitForTimeout(300);

  // ---- L6 scope reading: last known scope in the head, "Reading…" in the body
  holdWorld = true;
  await page.reload(); await channel("info");
  await head.waitFor();
  const pendingLine = left.getByText("Reading Central…");
  await pendingLine.waitFor({timeout: 15000});
  const pendingHead = (await head.locator(".left-scope-name").innerText()).trim();
  const inventedProjects = await left.locator("[data-project-path]").count();
  const firstSection = await left.locator(".left-section").first().getAttribute("data-section");
  check(pendingHead === "Central" && inventedProjects === 0 && firstSection === "control", "L6: while Central is being read, the head keeps the last known scope, 'Reading Central…' stands under the body's first section, and no project is invented", {pendingHead, inventedProjects, firstSection});
  await shot("L6-reading");
  holdWorld = false; releaseWorld();
  await page.locator('[data-project-path="Work/Alpha"]').waitFor({timeout: 30000});
  check(await left.getByText("Reading Central…").count() === 0, "L6: the reading line leaves when the reading lands");
  // ---- L8 mode switch (last: Settings fires its own slow owner reads, which
  // queue behind one another on the kernel seam): head and foot hold still
  const h0 = await box(head), f0 = await box(foot), headScope0 = await head.innerText();
  const modeRows = [];
  for (const mode of ["factory", "expressions", "techne", "settings", "base"]) {
    if (mode === "settings") await foot.getByRole("button", {name: "Settings", exact: true}).click();
    else await strip.locator(`[data-mode="${mode}"]`).click();
    await page.locator(`.desktop-shell[data-mode="${mode}"]`).waitFor({timeout: 15000});
    await page.waitForTimeout(220);
    const h1 = await box(head), f1 = await box(foot);
    modeRows.push({mode, head: same(h0, h1), foot: same(f0, f1), h1, f1, scope: (await head.innerText()) === headScope0});
  }
  check(modeRows.every(row => row.head && row.foot && row.scope), "L8: across Base → Factory → Expressions → Technè → Settings → Base the head and foot bounding boxes are identical (±0.5px) and the head's text is unchanged", modeRows);
  const fade = await page.evaluate(async () => {
    const node = document.querySelector('[data-region="left"] .left-body');
    const headNode = document.querySelector('[data-left-head]');
    const button = document.querySelector('.world-mode-strip [data-mode="factory"]');
    button.click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const bodyAnimations = node.getAnimations().map(animation => animation.effect?.getTiming?.().duration);
    const headAnimations = headNode.getAnimations().length;
    return {bodyAnimations, headAnimations};
  });
  check(fade.headAnimations === 0 && fade.bodyAnimations.every(duration => typeof duration === "number" && duration <= 160), "L8: only the body cross-fades, for at most 160ms; the head does not animate", fade);
  await strip.locator('[data-mode="base"]').click();
  await page.locator('.desktop-shell[data-mode="base"]').waitFor();

  await page.unroute("**/op");
}
