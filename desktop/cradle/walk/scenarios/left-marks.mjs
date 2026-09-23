/**
 * Row marks from REAL session state (10-SIDEBARS §5.2 R1–R5, §3.3) and chat
 * routing (§3.5, D4), on the real kernel with real provider turns in a
 * disposable ground and AIKit home.
 *
 *   R1  idle rows carry no mark
 *   R2  a real pi turn in flight → ● on the row (and the project aggregate);
 *       the turn ends → the working mark stops
 *   R4  that turn completed while the row was not open here → unread (dot,
 *       semibold title); opening it (right panel Chat, D4) clears it
 *   R3  a real OpenCode permission request → ! on the row and "! 1" on its
 *       project row; answering it through the desktop's consent card clears
 *       both
 *   R5  a refused connection (the owner refuses the failing provider) → ×
 *       with the owner's reason in the tooltip
 *
 * Every mark is read from the rendered DOM and cross-checked against the
 * owner's own `view` of the same session at that moment.
 */
import {setup as groundSetup, bindDefaultCentral, SESSIONS} from "./left-ground.mjs";

export async function setup(args) {
  process.env.OI_WALK_OPENCODE_BIN ??= "/opt/homebrew/bin/opencode";
  return groundSetup(args);
}

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const left = page.locator('[data-region="left"]');
  const right = page.locator('[data-region="right"]');
  await page.locator('[data-project-path="Work/Alpha"]').waitFor({timeout: 30000});
  await page.locator('[data-project-path="Work/Alpha"]').click();
  const alpha = left.locator('li[data-navigation-path="Work/Alpha"]');
  const alphaRow = page.locator('[data-project-path="Work/Alpha"]');
  const row = session => alpha.locator(`.left-conversation[data-session-ref="${session.ref}"]`);
  await row(SESSIONS.working).waitFor({timeout: 30000});
  const markOf = async session => row(session).getAttribute("data-mark");
  const view = session => p.request("view", {agent_session: session.ref});

  // ---- R1 idle
  await page.waitForTimeout(3000);
  const idle = {};
  for (const [name, session] of Object.entries(SESSIONS)) idle[name] = {mark: await markOf(session), glyph: (await row(session).locator(".left-mark").innerText()).trim(), owner: view(session).connection?.state ?? "unread"};
  check(Object.values(idle).every(entry => entry.mark === "idle" && entry.glyph === "") && Object.values(idle).every(entry => entry.owner !== "TurnInFlight"), "R1: with no turn, request or refusal in the owner's view, every row carries no mark", idle);
  check(await alphaRow.locator(".left-project-marks").count() === 0, "R1: the idle project row carries no aggregate mark");

  // ---- R2 working: a real pi turn, started through the owner
  p.request("open", {space: p.space, agent_session: SESSIONS.working.ref, provider: "left-walk-pi"});
  const draft = p.request("draft", {agent_session: SESSIONS.working.ref, basis: view(SESSIONS.working).draft.revision, text: "Write every number from one to four hundred in words, one per line, with no other text. Do not use tools."});
  p.request("prompt", {agent_session: SESSIONS.working.ref, draft_revision: draft.revision});
  const trace = [];
  for (let i = 0; i < 150; i++) {
    const mark = await markOf(SESSIONS.working);
    trace.push(`${mark}/${view(SESSIONS.working).connection?.state}`);
    if (mark === "working") break;
    await page.waitForTimeout(400);
  }
  if (await markOf(SESSIONS.working) !== "working") throw new Error(`never saw working: ${trace.join(" ")}`);
  const ownerDuring = view(SESSIONS.working).connection?.state;
  const working = await row(SESSIONS.working).evaluate(node => {
    const mark = node.querySelector(".left-mark");
    const before = getComputedStyle(mark, "::before");
    return {mark: node.getAttribute("data-mark"), dot: before.content !== "none" && parseFloat(before.width) > 0, animation: before.animationName, label: node.querySelector(".left-row-main").getAttribute("aria-label")};
  });
  const aggregate = await alphaRow.locator(".left-project-marks").getAttribute("aria-label").catch(() => null);
  check(working.mark === "working" && working.dot && working.animation === "left-breathe" && working.label.endsWith("— Working") && ownerDuring === "TurnInFlight", "R2: while the owner reports TurnInFlight the row shows the breathing ● and its name says Working", {working, ownerDuring});
  check(aggregate === "1 working", "R2 / §3.3: the project row carries the aggregate (1 working)", {aggregate});
  await shot("R2-working");
  await page.waitForFunction(ref => document.querySelector(`.left-conversation[data-session-ref="${ref}"]`)?.getAttribute("data-mark") !== "working", SESSIONS.working.ref, {timeout: 180000});
  const ownerAfter = view(SESSIONS.working);
  check(ownerAfter.connection?.state !== "TurnInFlight" && ownerAfter.blocks.some(block => block.kind === "completed"), "R2: the turn ends in the owner's view and the working mark stops", {state: ownerAfter.connection?.state});

  // ---- R4 unread: it completed while not open here
  await page.waitForFunction(ref => document.querySelector(`.left-conversation[data-session-ref="${ref}"]`)?.getAttribute("data-mark") === "unread", SESSIONS.working.ref, {timeout: 15000});
  const unread = await row(SESSIONS.working).evaluate(node => ({mark: node.getAttribute("data-mark"), dot: !!node.querySelector(".left-unread-dot"), weight: getComputedStyle(node.querySelector(".left-conversation-title")).fontWeight}));
  check(unread.mark === "unread" && unread.dot && Number(unread.weight) >= 600, "R4: the completed turn that arrived while the row was not open marks it unread — a dot before the time and a semibold title", unread);
  await shot("R4-unread");
  // §3.5 / D4: a conversation row opens in the right panel's Chat
  await row(SESSIONS.working).locator(".left-row-main").click();
  await page.waitForFunction(ref => document.querySelector(`.left-conversation[data-session-ref="${ref}"]`)?.getAttribute("data-mark") === "idle", SESSIONS.working.ref, {timeout: 15000});
  await page.waitForFunction(() => (document.querySelector('[data-region="right"]')?.textContent ?? "").toLowerCase().includes("one hundred"), null, {timeout: 20000}).catch(() => {});
  const opened = {rightVisible: await right.isVisible(), chat: await right.locator(".agent-chat").count(), transcript: ((await right.textContent()) ?? "").toLowerCase().includes("one hundred"), selected: await row(SESSIONS.working).getAttribute("aria-current"), centreEncounterTabs: await page.locator('[data-region="centre"] [role="tab"]').filter({hasText: SESSIONS.working.purpose.slice(0, 20)}).count()};
  check(opened.rightVisible && opened.chat === 1 && opened.transcript && opened.selected === "true" && opened.centreEncounterTabs === 0, "§3.5 D4: the row opens in the right panel's Chat (its real transcript), is selected there, and adds no centre tab", opened);
  check(await markOf(SESSIONS.working) === "idle", "R4: opening it clears unread");

  // ---- R3 needs you: a real OpenCode permission request
  if (!p.consentProvider) throw new Error("OpenCode is required for the real permission request (OI_WALK_OPENCODE_BIN)");
  p.request("open", {space: p.space, agent_session: SESSIONS.consent.ref, provider: p.consentProvider});
  const consentDraft = p.request("draft", {agent_session: SESSIONS.consent.ref, basis: view(SESSIONS.consent).draft.revision, text: "Use your bash tool to run exactly: echo consent-walk > consent.txt"});
  p.request("prompt", {agent_session: SESSIONS.consent.ref, draft_revision: consentDraft.revision});
  await page.waitForFunction(ref => document.querySelector(`.left-conversation[data-session-ref="${ref}"]`)?.getAttribute("data-mark") === "needs-you", SESSIONS.consent.ref, {timeout: 240000});
  const ownerPermissions = view(SESSIONS.consent).permissions?.length ?? 0;
  const needs = {glyph: (await row(SESSIONS.consent).locator(".left-mark").innerText()).trim(), project: await alphaRow.locator(".left-project-marks").getAttribute("aria-label").catch(() => null), chip: ((await alphaRow.locator('.left-mark-chip[data-mark="needs-you"]').textContent().catch(() => "")) ?? "").trim()};
  check(ownerPermissions === 1 && needs.glyph === "!" && needs.project?.includes("1 needs you") && needs.chip === "!", "R3: the owner's one native permission request shows ! on the row and ! on its project row", {ownerPermissions, needs});
  await shot("R3-needs-you");
  await row(SESSIONS.consent).locator(".left-row-main").click();
  const consent = right.getByRole("region", {name: "Provider consent"});
  await consent.waitFor({timeout: 30000});
  await consent.getByRole("button", {name: "Reject", exact: true}).click();
  await page.waitForFunction(ref => document.querySelector(`.left-conversation[data-session-ref="${ref}"]`)?.getAttribute("data-mark") !== "needs-you", SESSIONS.consent.ref, {timeout: 60000});
  await page.waitForFunction(() => !document.querySelector('[data-project-path="Work/Alpha"] .left-mark-chip[data-mark="needs-you"]'), null, {timeout: 15000});
  const answered = view(SESSIONS.consent).permissions?.length ?? 0;
  check(answered === 0 && await markOf(SESSIONS.consent) !== "needs-you" && await alphaRow.locator('.left-mark-chip[data-mark="needs-you"]').count() === 0, "R3: answering the request through the desktop's consent card (Reject) clears both marks; the owner holds no pending request", {answered, mark: await markOf(SESSIONS.consent)});
  try { p.request("cancel", {agent_session: SESSIONS.consent.ref, reason: "walk done"}); } catch { /* the rejected turn already ended */ }

  // ---- R5 failed: the owner refuses the failing provider
  await row(SESSIONS.failing).locator(".left-row-main").click();
  const connect = right.getByRole("button", {name: "Walk failing provider", exact: true});
  await connect.waitFor({timeout: 30000});
  await connect.click();
  await page.waitForFunction(ref => document.querySelector(`.left-conversation[data-session-ref="${ref}"]`)?.getAttribute("data-mark") === "failed", SESSIONS.failing.ref, {timeout: 60000});
  const failed = await row(SESSIONS.failing).evaluate(node => ({glyph: node.querySelector(".left-mark")?.textContent, tooltip: node.querySelector(".left-mark")?.getAttribute("title"), title: node.querySelector(".left-row-main")?.getAttribute("title"), label: node.querySelector(".left-row-main")?.getAttribute("aria-label")}));
  check(failed.glyph === "×" && /closed stdout|transport/i.test(failed.tooltip ?? "") && (failed.title ?? "").includes(failed.tooltip ?? "@@") && failed.label.includes("Failed"), "R5: the refused connection shows × with the owner's reason in the tooltip", failed);
  await shot("R5-failed");
}
