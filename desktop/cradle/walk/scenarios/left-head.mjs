/**
 * The left head and foot at work (10-SIDEBARS §3.1, §3.6, rulings D3/D6),
 * on the real kernel with a disposable ground and AIKit home.
 *
 *   scope menu      the real census (Central, the Work projects with live
 *                   marks), no MACHINES section without a machine read,
 *                   All projects only in Factory; choosing is the one way the
 *                   scope changes; focusing another project's tab offers
 *                   "Focused tab is in X · Switch" and changes nothing itself
 *   workspace       New · Rename · Switch… · Recover arrangement live in the
 *                   scope menu's footer; switching restores arrangement and
 *                   scope together; the window footer keeps status only
 *   + create        mode-dependent entries, each a real route
 *   Inbox (D3)      the native count; opening an item opens its material in
 *                   a pane with its review controls beside it; at zero the
 *                   badge is absent and the row stays
 *   ⌘K              typed tabs over real sources
 */
import {setup as groundSetup, bindDefaultCentral, SESSIONS, BETA_SESSION} from "./left-ground.mjs";
import {execFileSync} from "node:child_process";
import {readdirSync} from "node:fs";
import {join} from "node:path";

export async function setup(args) { return groundSetup(args); }

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  const failures = [];
  page.on("requestfailed", request => { if (request.url().includes("/op")) failures.push({body: (request.postData() ?? "").slice(0, 200), error: request.failure()?.errorText}); });
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const left = page.locator('[data-region="left"]');
  const right = page.locator('[data-region="right"]');
  const head = left.locator("[data-left-head]");
  const foot = left.locator("[data-left-foot]");
  const scopeName = () => head.locator(".left-scope-name").innerText();
  const openScope = async () => { await head.locator(".left-scope-trigger").click(); await page.getByRole("group", {name: "Scope and workspace"}).waitFor(); return page.getByRole("group", {name: "Scope and workspace"}); };
  await page.locator('[data-project-path="Work/Alpha"]').waitFor({timeout: 30000});

  // ---- scope menu: the real census
  let menu = await openScope();
  await menu.locator('[data-scope-project="Alpha"]').waitFor();
  const census = await menu.evaluate(node => ({
    eyebrows: [...node.querySelectorAll(".left-menu-eyebrow")].map(el => el.textContent),
    central: node.querySelector('[role="menuitemradio"]')?.getAttribute("aria-checked"),
    projects: [...node.querySelectorAll("[data-scope-project]")].map(el => el.getAttribute("data-scope-project")),
    all: [...node.querySelectorAll('[role="menuitemradio"]')].some(el => el.textContent?.includes("All projects")),
  }));
  const owned = execFileSync("ctrl", ["--root", p.root, "--json", "action", "run", "central.world", "{}"], {encoding: "utf8"});
  const ownerProjects = (JSON.parse(owned).data?.work?.projects ?? []).map(entry => entry.name).sort();
  check(census.central === "true" && JSON.stringify([...census.projects].sort()) === JSON.stringify(ownerProjects) && !census.all, "Scope menu: Central is checked and WORK lists exactly the owner's projects; All projects is not offered outside Factory", {census, ownerProjects});
  check(!census.eyebrows.includes("Machines"), "Scope menu: with no remote machine recorded by Workcell the MACHINES section is absent (never invented)", {eyebrows: census.eyebrows});
  check(census.eyebrows.includes("Workspace") && await menu.getByRole("button", {name: "Switch…"}).count() === 1 && await menu.getByRole("button", {name: "Recover arrangement"}).count() === 1, "Scope menu footer: the workspace, Switch…, New · Rename · Recover arrangement");
  await shot("scope-menu");
  await menu.locator('[data-scope-project="Alpha"]').click();
  check(await scopeName() === "Alpha", "Choosing Alpha in the scope menu makes Alpha the scope");
  await page.reload(); await channel("info");
  await head.waitFor();
  await page.waitForFunction(() => document.querySelector(".left-scope-name")?.textContent === "Alpha", null, {timeout: 15000});
  check(await scopeName() === "Alpha", "The scope is the workspace's: it survives a reload");

  // ---- focusing another project's tab does not move the scope; the menu offers Switch
  await page.locator('[data-project-path="Work/Beta"]').waitFor({timeout: 30000});
  await page.locator('[data-project-path="Work/Beta"]').click();
  const beta = left.locator('li[data-navigation-path="Work/Beta"]');
  await beta.getByRole("button", {name: "Beta: files", exact: true}).click();
  const betaFile = left.locator('button[data-file-path="Work/Beta/ProjectCentral/project.json"]');
  await betaFile.waitFor({timeout: 20000});
  await betaFile.click();
  await page.locator('[data-region="centre"] [role="tab"]').filter({hasText: "project.json"}).first().waitFor({timeout: 20000});
  await page.waitForTimeout(600);
  check(await scopeName() === "Alpha", "Focusing a tab from Beta does not change the scope by itself (still Alpha)");
  menu = await openScope();
  const switchRow = menu.locator(".left-menu-switch");
  const switchText = (await switchRow.innerText()).replace(/\s+/g, " ").trim();
  check(switchText === "Focused tab is in Beta Switch", "The scope menu's first row offers 'Focused tab is in Beta · Switch'", {switchText});
  await switchRow.getByRole("button", {name: "Switch"}).click();
  check(await scopeName() === "Beta", "Switch makes Beta the scope");

  // ---- workspace: New / Switch… / Rename / Recover in the scope menu footer
  menu = await openScope();
  await menu.getByRole("button", {name: "New", exact: true}).click();
  await page.getByRole("textbox", {name: "Workspace name"}).fill("Walk second");
  await page.getByRole("button", {name: "Create workspace"}).click();
  await page.waitForFunction(() => document.querySelector(".desktop-shell")?.getAttribute("data-workspace-id") !== null, null);
  menu = await openScope();
  const current = (await menu.locator(".left-menu-workspace").innerText()).trim();
  await menu.getByRole("button", {name: "Switch…"}).click();
  const books = await menu.getByRole("group", {name: "Workspaces"}).getByRole("menuitemradio").allInnerTexts();
  check(current.startsWith("Walk second") && books.length === 2 && books.includes("Walk second"), "New creates a workspace and Switch… lists both", {current, books});
  const secondScope = await scopeName();
  await menu.getByRole("group", {name: "Workspaces"}).getByRole("menuitemradio").filter({hasNotText: "Walk second"}).click();
  await page.waitForFunction(() => document.querySelector(".left-scope-name")?.textContent === "Beta", null, {timeout: 15000});
  const firstTabs = await page.locator('[data-region="centre"] [role="tab"]').allInnerTexts();
  check(secondScope === "Central" && await scopeName() === "Beta" && firstTabs.some(text => text.includes("project.json")), "Switching workspace restores its arrangement and its scope together (Walk second is Central; back to the first: Beta with its tab)", {secondScope, firstTabs});
  menu = await openScope();
  await menu.getByRole("button", {name: "Rename", exact: true}).click();
  await page.getByRole("textbox", {name: "Workspace name"}).fill("Walk main");
  await page.getByRole("button", {name: "Save name"}).click();
  menu = await openScope();
  check((await menu.locator(".left-menu-workspace").innerText()).trim().startsWith("Walk main"), "Rename renames the current workspace");
  await menu.getByRole("button", {name: "Recover arrangement"}).click();
  await page.locator(".workspace-footer-edge").hover();
  await page.locator(".footer-status summary").click();
  const recoverWords = await page.locator(".footer-status .oi-menu").innerText();
  check(/no retained workspace recovery record/i.test(recoverWords), "Recover arrangement answers with the store's own words (no retained record on this device)", {recoverWords: recoverWords.slice(0, 160)});
  await page.keyboard.press("Escape");
  const footer = await page.locator(".canvas-arrangement").evaluate(node => ({
    buttons: [...node.querySelectorAll("button, summary, select")].map(el => el.getAttribute("aria-label") ?? el.textContent?.trim()).filter(Boolean),
    last: [...node.children].at(-1)?.getAttribute("aria-label"),
    menuText: node.querySelector('details.desktop-menu:not(.footer-status) .oi-menu')?.textContent ?? "",
  }));
  check(!footer.buttons.some(label => /^(Workspace|New workspace|Rename workspace)$/.test(label)) && !/Recover saved arrangement|Mode/.test(footer.menuText) && footer.last === "Epi-Logos lens", "The window footer keeps status only: no workspace select, no New/Rename/Recover, no mode radios; the Epi-Logos lens toggle is its last control", footer);

  // ---- + create: mode-dependent entries, each a real route
  const createEntries = async () => { await head.getByRole("button", {name: "Create"}).click(); const items = await left.getByRole("menu", {name: "Create"}).getByRole("menuitem").allInnerTexts(); return items.map(text => text.trim()); };
  const baseEntries = await createEntries();
  check(JSON.stringify(baseEntries) === JSON.stringify(["New chat", "New flow", "New agent…"]), "+ in Base: New chat, New flow, New agent…", {baseEntries});
  const flowsBefore = readdirSync(join(p.root, "Control/user/flows")).length;
  await left.getByRole("menu", {name: "Create"}).getByRole("menuitem", {name: "New flow"}).click();
  await page.locator('[data-region="centre"] [role="tab"]').filter({hasText: "Draft"}).first().waitFor({timeout: 15000});
  check(readdirSync(join(p.root, "Control/user/flows")).length === flowsBefore, "New flow opens writing in a Draft tab and mints nothing (the navigator's New flow law)");
  await head.getByRole("button", {name: "Create"}).click();
  await left.getByRole("menu", {name: "Create"}).getByRole("menuitem", {name: "New chat"}).click();
  await right.locator(".agent-chat").waitFor({timeout: 15000});
  check(await right.isVisible() && (await right.locator(".chat-connect").getAttribute("data-fact")) === "new-chat", "New chat opens the right panel's Chat on a fresh conversation", {fact: await right.locator(".chat-connect").getAttribute("data-fact").catch(() => null)});
  await left.locator('.world-mode-strip [data-mode="expressions"]').click();
  await page.locator('.desktop-shell[data-mode="expressions"]').waitFor();
  const expressionEntries = await createEntries();
  await page.keyboard.press("Escape");
  await left.locator('.world-mode-strip [data-mode="factory"]').click();
  await page.locator('.desktop-shell[data-mode="factory"]').waitFor();
  const factoryEntries = await createEntries();
  await page.keyboard.press("Escape");
  check(JSON.stringify(expressionEntries) === JSON.stringify(["New chat", "New flow", "New Expression", "New agent…"]) && JSON.stringify(factoryEntries) === JSON.stringify(["New chat", "New flow", "New agent…"]), "+ is mode-dependent: Expressions adds New Expression; Factory offers no New run… because no run-creation route is lent (omitted, not faked)", {expressionEntries, factoryEntries});
  menu = await openScope();
  check(await menu.getByRole("menuitemradio", {name: /All projects/}).count() === 1, "In Factory the scope menu offers All projects");
  await menu.getByRole("menuitemradio", {name: /All projects/}).click();
  check(await scopeName() === "All projects", "All projects becomes the Factory scope");
  menu = await openScope();
  await menu.locator('[data-scope-project="Alpha"]').click();
  await left.locator('.world-mode-strip [data-mode="base"]').click();
  await page.locator('.desktop-shell[data-mode="base"]').waitFor();

  // ---- Inbox (D3): the native count; open an item beside its review controls
  const native = JSON.parse(execFileSync("ctrl", ["--root", p.root, "--json", "action", "run", "central.receiving.list", JSON.stringify({project: "Alpha", limit: 20})], {encoding: "utf8", env: {...process.env, ...p.env}}));
  const nativeWaiting = (native.data?.returns ?? []).filter(row => ["pending", "needs-review", "accepted", "including", "uncertain"].includes(row.status)).length;
  const inbox = foot.getByRole("button", {name: /^Inbox/});
  await page.waitForFunction(() => document.querySelector("[data-inbox-badge]")?.textContent === "1", null, {timeout: 20000});
  check(nativeWaiting === 1 && (await inbox.getAttribute("aria-label")) === "Inbox, 1 waiting", "Inbox: the badge is the native count of material waiting (1, read through central.receiving.list)", {nativeWaiting});
  await inbox.click();
  const tray = left.getByRole("region", {name: "Inbox"});
  const detail = tray.locator(".receiving-detail");
  // The host's network interfaces can change under a walk (ERR_NETWORK_CHANGED
  // aborts every in-flight request, even to localhost); a person clicks again.
  for (let attempt = 0; attempt < 3 && !(await detail.isVisible().catch(() => false)); attempt++) {
    await tray.locator(".receiving-row").first().click();
    try { await detail.waitFor({timeout: 60000}); }
    catch { if (!failures.some(entry => entry.error === "net::ERR_NETWORK_CHANGED")) throw new Error(`no detail; failed requests: ${JSON.stringify(failures.slice(-8))}`); }
  }
  await page.locator('[data-region="centre"] [role="tab"]').filter({hasText: ".json"}).first().waitFor({timeout: 20000});
  check((await detail.innerText()).includes("A contribution waiting in the Inbox") && await tray.getByRole("button", {name: "Accept current basis"}).count() === 1, "Inbox: opening the item opens its document in a pane and keeps its review controls beside it", {tab: await page.locator('[data-region="centre"] [role="tab"][aria-selected="true"]').first().innerText().catch(() => "")});
  await shot("inbox-open-item");
  await tray.getByRole("button", {name: "Accept current basis"}).click();
  await page.waitForFunction(() => document.querySelector(".left-inbox .receiving-detail")?.textContent?.includes("accepted by"), null, {timeout: 20000});
  await tray.getByRole("button", {name: "Include into the document"}).click();
  await page.waitForFunction(() => document.querySelector(".left-inbox .receiving-detail")?.textContent?.includes("Included into the document."), null, {timeout: 20000});
  await page.waitForFunction(() => !document.querySelector("[data-inbox-badge]"), null, {timeout: 20000});
  check(await inbox.count() === 1 && (await inbox.getAttribute("aria-label")) === "Inbox" && await left.locator("[data-inbox-badge]").count() === 0, "Inbox: once included nothing waits — the badge is absent and the row stays");
  await inbox.click();

  // ---- ⌘K typed tabs over real sources
  await head.getByRole("button", {name: "Search"}).click();
  const palette = page.getByRole("dialog", {name: "Search Central"});
  await palette.waitFor();
  const tabs = await palette.getByRole("tablist", {name: "Result kinds"}).getByRole("tab").allInnerTexts();
  check(JSON.stringify(tabs) === JSON.stringify(["All", "Chats", "Agents", "Files", "Flows", "Actions"]), "⌘K: typed tabs All · Chats · Agents · Files · Flows · Actions", {tabs});
  await palette.getByRole("tab", {name: "Chats"}).click();
  const chatResults = palette.getByRole("list", {name: "Chats results"});
  await chatResults.waitFor({timeout: 30000});
  const chats = await chatResults.locator("strong").allInnerTexts();
  const expected = [...Object.values(SESSIONS).map(session => session.purpose), BETA_SESSION.purpose].sort();
  check(JSON.stringify([...chats].sort()) === JSON.stringify(expected), "⌘K Chats lists exactly the owner's five attached conversations across projects", {chats});
  await palette.getByRole("searchbox", {name: "Search or resolve"}).fill("Beta");
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Chats results"] li').length === 1, null, {timeout: 10000});
  await page.keyboard.press("Enter");
  await palette.waitFor({state: "detached", timeout: 15000}).catch(() => {});
  await page.locator('[data-project-path="Work/Beta"]').hover();
  await left.locator('li[data-navigation-path="Work/Beta"]').getByRole("button", {name: "Beta: chats and tasks", exact: true}).click();
  await page.waitForFunction(ref => document.querySelector(`.left-conversation[data-session-ref="${ref}"]`)?.getAttribute("aria-current") === "true", BETA_SESSION.ref, {timeout: 20000});
  check(!(await page.getByRole("dialog", {name: "Search Central"}).isVisible().catch(() => false)) && await left.locator(`.left-conversation[data-session-ref="${BETA_SESSION.ref}"][aria-current="true"]`).count() === 1, "⌘K Chats: typing filters to the one matching conversation and Enter opens it — Beta's conversation is the one open in the panel");
  await head.getByRole("button", {name: "Search"}).click();
  await palette.getByRole("tab", {name: "Flows"}).click();
  await palette.getByRole("list", {name: "Flows results"}).waitFor({timeout: 20000});
  const flows = await palette.getByRole("list", {name: "Flows results"}).locator("strong").allInnerTexts();
  await palette.getByRole("tab", {name: "Actions"}).click();
  const actions = await palette.getByRole("list", {name: "Actions results"}).locator("strong").allInnerTexts();
  await palette.getByRole("tab", {name: "Agents"}).click();
  await page.waitForFunction(() => !/Reading the agent roster/.test(document.querySelector(".search-typed")?.textContent ?? ""), null, {timeout: 30000});
  const agents = (await palette.locator(".search-typed").innerText()).trim();
  check(flows.includes("flow-2026-09-23-0900") && actions.includes("New chat") && actions.includes("New flow"), "⌘K Flows lists the ground's flow; Actions lists the app's real verbs", {flows, actions: actions.slice(0, 6)});
  check(agents.length > 0 && !/Reading/.test(agents), "⌘K Agents answers from the native roster (rows, or its honest absence / refusal — never a fixture)", {agents: agents.slice(0, 200)});
  await shot("palette-agents");
  await page.keyboard.press("Escape");
}
