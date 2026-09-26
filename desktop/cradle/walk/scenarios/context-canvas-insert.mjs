import {setup as canvasSetup} from "./canvas-context.mjs";
import {bindDefaultCentral} from "../editor-doc.mjs";
import {openPanel, recordCalls, restoreScope} from "../lane2-support.mjs";
import {realProviderAuthorised, REAL_PROVIDER_SKIP_NOTE} from "../lib/walk-provider.mjs";

/** BASELINE (lane 2, step 0) — the right panel's Context canvas as it works
 *  today, walked against the real kernel before anything in the panel is
 *  rebuilt (10-SIDEBARS §4.6: "Preserve. The existing canvas insertion of
 *  files, terminals and browser material is the accepted specimen").
 *
 *  In a dedicated-stage mode (Expressions) the Context tab hosts the panel's
 *  own pane canvas. The walk inserts three kinds of material into it through
 *  the routes that exist today — a file (search → open lands in the visible
 *  canvas), a terminal and a browser page (the canvas's own New tab → the
 *  fresh tab's choices) — then goes to Chat, connects the existing pi
 *  provider and sends one message through the real encounter route. After
 *  the send it asserts the inserted material is still exactly there.
 *
 *  Disposable ground + isolated AIKIT_HOME (canvas-context setup): nothing
 *  of the owner's real state is touched. Needs OI_AIKIT_BIN. */
export async function setup(options) {
  return canvasSetup(options);
}

const MESSAGE = "Reply with exactly: canvas baseline received.";

const DRAFT_TEXT = "Canvas baseline writing — kept across the send.";
const SESSION_TITLE = "Canvas editor and prepared context acceptance";

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  const calls = recordCalls(page);
  await page.goto(baseUrl); await channel("info");
  await bindDefaultCentral(page, p.root);
  const nav = page.getByRole("complementary", {name: "World navigator"});
  // Open the disposable source from the Editor file tree in the centre.
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button", {name: "Editor: files", exact: true}).click({timeout: 15000});
  const fileRow = nav.locator(`[data-file-path="Work/Editor/${p.sourcePath}"]`);
  await fileRow.waitFor({timeout: 15000});
  await fileRow.click();
  await page.locator(".tab-title", {hasText: p.sourcePath}).first().waitFor({timeout: 20000});
  // Stand in the Editor scope (restored with the workspace, as on restart).
  await restoreScope(page, "Editor");
  await page.locator(".tab-title", {hasText: p.sourcePath}).first().waitFor({timeout: 20000});

  // Enter Expressions — a dedicated-stage mode whose panel hosts the canvas.
  await page.getByRole("radio", {name: "Expressions", exact: true}).first().click();
  const panel = await openPanel(page);
  const planes = panel.locator('[aria-label="Right region planes"]');
  const plane = name => planes.getByRole("button", {name, exact: true}).click();
  await plane("Context");
  const canvas = panel.locator('[data-plane="ta-onta-context"]');
  await canvas.waitFor({timeout: 15000});
  const sideTabs = () => canvas.locator(".tab-title").allInnerTexts();
  const lanes = () => canvas.locator(".ta-active-context .oi-side-row-title").allInnerTexts();
  const newTab = async () => {
    await canvas.getByRole("button", {name: "New tab", exact: true}).click();
    return canvas.getByRole("region", {name: "New tab"});
  };

  // 1 — a terminal: the canvas's own New tab → Open terminal.
  await (await newTab()).getByRole("button", {name: "Open terminal"}).click();
  await canvas.locator(".tab-title", {hasText: "Terminal"}).waitFor({timeout: 20000});
  await canvas.locator(".xterm, .terminal-surface, [data-surface-kind='terminal']").first().waitFor({timeout: 20000});
  check((await sideTabs()).filter(t => t === "Terminal").length === 1, "a terminal is inserted into the Context canvas as its own tab", await sideTabs());

  // 2 — browser material: New tab → Open browser.
  await (await newTab()).getByRole("button", {name: "Open browser"}).click();
  await canvas.locator(".tab-title", {hasText: "Browser"}).waitFor({timeout: 20000});
  check((await sideTabs()).filter(t => t === "Browser").length === 1, "a browser page is inserted into the Context canvas as its own tab", await sideTabs());

  // 3 — a document: New tab → Start writing; the writing is typed in place.
  await (await newTab()).getByRole("button", {name: "Start writing"}).click();
  await canvas.locator(".tab-title", {hasText: "Draft"}).waitFor({timeout: 20000});
  const writing = canvas.locator(".draft-surface .cm-content");
  await writing.waitFor({timeout: 20000});
  await writing.click();
  await page.keyboard.type(DRAFT_TEXT);
  await page.waitForFunction(text => [...document.querySelectorAll(".draft-surface .cm-line")].map(line => line.textContent).join("\n") === text, DRAFT_TEXT, {timeout: 10000});
  check(true, "a writing document is inserted into the Context canvas and holds the typed text");
  const before = await sideTabs();
  check(JSON.stringify(before) === JSON.stringify(["Terminal", "Browser", "Draft"]), "the canvas holds exactly the three inserted tabs, in insertion order", before);
  const lanesBefore = await lanes();
  check(["Terminal", "Browser", "Draft"].every(title => lanesBefore.includes(title)), "Active Context lists each inserted tab in its lane", lanesBefore);
  await shot("inserted");

  // 4 — send through the real route: Chat → choose the attached
  // conversation → connect the existing pi provider → send.
  if (!realProviderAuthorised()) {
    check(true, REAL_PROVIDER_SKIP_NOTE);
    return;
  }
  await plane("Chat");
  const chat = panel.getByRole("region", {name: "Agent chat"});
  await chat.getByRole("button", {name: "History"}).click({timeout: 15000});
  await chat.getByRole("button", {name: SESSION_TITLE}).first().click({timeout: 20000});
  await chat.locator(".chat-connect").getByRole("button", {name: "Canvas walk Pi (existing provider)"}).click({timeout: 30000});
  await chat.locator('.chat-composer[data-connection="connected"]').waitFor({timeout: 90000});
  const message = chat.getByRole("textbox", {name: "Message", exact: true});
  await message.fill(MESSAGE);
  await page.waitForFunction(() => !document.querySelector(".agent-chat .chat-send")?.disabled, undefined, {timeout: 30000});
  const sendIndex = calls.length;
  await chat.getByRole("button", {name: "Send", exact: true}).click();
  await chat.locator(".chat-turn-user", {hasText: MESSAGE}).first().waitFor({timeout: 30000});
  await chat.locator(".chat-turn-assistant:not(.chat-turn-pending)").last().waitFor({timeout: 240000});
  const prompts = calls.slice(sendIndex).filter(call => call.op === "encounter" && (call.action === "prompt" || call.action === "prompt-context"));
  check(prompts.length === 1 && prompts[0].result === "encounter_reading", "the send went through the real encounter prompt route exactly once", prompts);
  let view = p.request("view");
  for (let reads = 0; reads < 6 && !view.blocks.some(block => block.kind === "assistant" && block.text.trim()); reads++) { await page.waitForTimeout(1500); view = p.request("view"); }
  check(view.blocks.some(block => block.kind === "user" && block.text.includes(MESSAGE)), "the owner transcript records the sent message");
  check(view.blocks.some(block => block.kind === "assistant" && block.text.trim().length > 0), "a real provider reply arrived");
  await shot("sent");

  // 5 — after sending, the inserted material is exactly as it was.
  await plane("Context");
  const after = await sideTabs();
  check(JSON.stringify(after) === JSON.stringify(before), "after the send the canvas still holds the same three tabs", after);
  const lanesAfter = await lanes();
  check(JSON.stringify(lanesAfter) === JSON.stringify(lanesBefore), "after the send Active Context lists the same material", lanesAfter);
  await canvas.locator(".tab-title", {hasText: "Draft"}).click();
  const kept = await page.evaluate(() => [...document.querySelectorAll(".draft-surface .cm-line")].map(line => line.textContent).join("\n"));
  check(kept === DRAFT_TEXT, "the inserted writing keeps its exact text after the send", kept);
  await shot("after-send");
}
