import {execFileSync} from "node:child_process";
import {writeFileSync} from "node:fs";
import {join} from "node:path";
import {waitForDoc, docText, bindDefaultCentral} from "../editor-doc.mjs";

/** The canvas-editor/context native walk: the delivered editor, selection and
 *  prepared-context surface driven against the REAL native AIKit candidate —
 *  a disposable ground, a disposable AIKit home, a real session space and an
 *  authorised provider (the existing pi/GLM harness) for the one real Return.
 *  No ambient state is touched: AIKIT_HOME isolates the resident and store. */

// The disposable source carries frontmatter, two identical passages (the
// second is the exact repeated-text target; the emoji inside the selection
// proves UTF-16 units) and a table of unrelated bytes that must survive.
export const ORIGINAL = '---\nwalk: canvas-context\n---\n\n# Source document\n\nFirst same 🙂 passage.\n\nSecond same 🙂 passage.\n\n| A | B |\n| --- | --- |\n| keep | bytes |\n';
const NEEDLE = 'same 🙂';
const DRAFT = 'Explain the selected passage';

export async function setup({cradleRoot}) {
  const source = await (await import("./editor.mjs")).setup({cradleRoot});
  // A project-root document, so the format-aware material surface owns it
  // (context-check.html precedent) with its kernel buffer revision.
  const SOURCE_PATH = 'canvas-source.md';
  writeFileSync(join(source.projectRoot, SOURCE_PATH), ORIGINAL);
  const aikit = process.env.OI_AIKIT_BIN;
  if (!aikit) throw new Error("OI_AIKIT_BIN must name the native AIKit candidate under test");
  // The kernel routes owner calls through `<OI_BIN> aikit …`; the router
  // pins that route to the candidate binary under test (context-draft
  // precedent), so the UI talks to the same native owner the CLI does.
  const router = join(source.root, "oi-owner-router.mjs");
  const {chmodSync} = await import("node:fs");
  writeFileSync(router, `#!/usr/bin/env node\nimport {spawnSync} from "node:child_process";\nconst args = process.argv.slice(2);\nif (args[0] === "aikit") {\n  const child = spawnSync(${JSON.stringify(aikit)}, args.slice(1), {stdio: "inherit"});\n  process.exit(child.status ?? 1);\n}\nconst child = spawnSync("oi", args, {stdio: "inherit"});\nprocess.exit(child.status ?? 1);\n`);
  chmodSync(router, 0o755);
  const env = {...process.env, ...source.env, AIKIT_HOME: join(source.root, ".aikit-home"), OI_AIKIT_BIN: aikit, OI_BIN: router};
  // The session-space verbs live in the main aikit binary (O-I #376 fold).
  const native = (...parts) => {
    try {
      return JSON.parse(execFileSync(aikit, ["--json", "session-space", "-C", source.projectRoot, ...parts], {encoding: "utf8", env}));
    } catch (error) {
      const detail = String(error.output?.filter(Boolean).join(" ") ?? error.message);
      throw new Error(`native ${parts[0]} failed: ${detail.slice(0, 400)}`);
    }
  };
  const bind = JSON.parse(execFileSync(aikit, ["--json", "-C", source.projectRoot, "project", "bind", "editor-walk", "--directory", source.projectRoot, "--no-default-skill-sets"], {encoding: "utf8", env}));
  if (!bind.ok) throw new Error(JSON.stringify(bind));
  const apply = preview => native("apply", "--preview-json", JSON.stringify(preview));
  const space = "session-space/canvas-context-walk", ref = "agent-session/canvas-context-walk";
  apply(native("create", space, "--label", "Canvas context walk"));
  for (const intent of [
    {operation: "bind-project-context", binding: native("project-context")},
    {operation: "attach-agent-session", attachment: {agent_session: ref, purpose: "Canvas editor and prepared context acceptance", provenance: ["Explicit real canvas context acceptance"]}},
  ]) apply(native("stage", "--space", space, "--intent-json", JSON.stringify(intent)));
  // Two providers: one whose process fails immediately (failed-send
  // retention) and the existing pi/GLM harness for the one authorised real
  // Return. No new provider kind is launched and no unrelated conversation
  // is touched; the walk ground and home are disposable.
  native("encounter-configure", "--provider-json", JSON.stringify({id: "canvas-walk-false", label: "Canvas walk failing provider", argv: ["/usr/bin/false"]}));
  const piBin = process.env.OI_WALK_PI_BIN ?? "/Users/admin/.local/bin/pi";
  native("encounter-configure", "--provider-json", JSON.stringify({protocol: "pi-rpc", id: "canvas-walk-pi", label: "Canvas walk Pi (existing provider)", argv: [piBin, "--mode", "rpc"]}));
  const owner = native("encounter-start");
  if (!owner.ok) throw new Error(JSON.stringify(owner));
  const request = (action, fields = {}) => {
    const result = native("encounter", "--request-json", JSON.stringify({action, agent_session: ref, ...fields}));
    if (!result.ok) throw new Error(JSON.stringify(result));
    return result.data;
  };
  request("draft", {basis: 0, text: ""});
  return {
    ...source, env, native, request, space, ref,
    sourceRef: null,
    sourcePath: SOURCE_PATH,
    openProvider: provider => {
      try { return request("open", {space, provider}); }
      catch (error) { return {failed: String(error)}; }
    },
    reconnectProvider: provider => request("reconnect", {space, provider}),
    contextRead: (session = ref) => request("context", {request: {scope: {project: "editor-walk", agent_session: session}, request: {operation: "read"}}}),
    projectContextRead: () => request("context", {request: {scope: {project: "editor-walk", agent_session: null}, request: {operation: "read"}}}),
    adoptIntoSession: () => {
      const session0 = request("context", {request: {scope: {project: "editor-walk", agent_session: ref}, request: {operation: "read"}}});
      const project0 = request("context", {request: {scope: {project: "editor-walk", agent_session: null}, request: {operation: "read"}}});
      return request("context", {request: {scope: {project: "editor-walk", agent_session: ref}, request: {operation: "adopt", basis: session0.revision, project_basis: project0.revision}}});
    },
    cleanup: () => {
      try {process.kill(-owner.data.pid, "SIGTERM");} catch {}
      setTimeout(() => {try {process.kill(-owner.data.pid, "SIGKILL");} catch {}}, 600);
      // The provider may still flush into the ground; removal retries.
      setTimeout(() => {
        for (let attempt = 0; attempt < 4; attempt++) {
          try {source.cleanup(); return;} catch {}
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
        }
      }, 900);
    },
  };
}

async function activateTab(page, name) {
  const tab = page.getByRole("tab", {name, exact: false}).filter({hasText: name}).first();
  await tab.click({timeout: 15000});
}

async function expectDoc(page, expected, selector, label) {
  try {
    await waitForDoc(page, expected, selector, 8000);
  } catch {
    const actual = await docText(page, selector);
    throw new Error(`${label}: doc mismatch; actual=${JSON.stringify(actual)}`);
  }
}

async function selectRange(editor, start, end) {
  await editor.focus(); await editor.press("Meta+ArrowUp");
  for (let i = 0; i < start; i++) await editor.press("ArrowRight");
  for (let i = start; i < end; i++) await editor.press("Shift+ArrowRight");
}

export default async function run({page, baseUrl, check, shot, channel, provision: p}) {
  const calls = [];
  page.on("response", async response => {
    if (!response.url().endsWith("/op")) return;
    try {
      const body = await response.request().postDataJSON();
      calls.push({op: body.op, action: body.request?.action, result: null});
    } catch { /* teardown races a completed request */ }
    try {
      const body = await response.json();
      const entry = calls[calls.length - 1];
      if (entry) entry.result = body.outcome?.result ?? null;
    } catch { /* the response may already be consumed */ }
  });
  await page.goto(baseUrl); await channel("info");
  try {
    await bindDefaultCentral(page, p.root);
  } catch (error) {
    const chooserText = await page.getByRole("region", {name: "Central location"}).innerText().catch(() => "chooser gone");
    throw new Error(`bind failed: ${error}; chooser: ${chooserText.slice(0, 300)}`);
  }
  const nav = page.getByRole("complementary", {name: "World navigator"});
  await nav.locator('[data-project-path="Work/Editor"]').click();
  const conversation = page.getByRole("button", {name: "Canvas editor and prepared context acceptance", exact: true});
  try {await conversation.waitFor({timeout: 15000});} catch {
    throw new Error(`Conversation was not disclosed. Buttons: ${JSON.stringify(await nav.locator("button").allTextContents())}`);
  }
  // A left conversation row opens in the right panel's Chat (10-SIDEBARS
  // §3.5, D4); this walk works the conversation in the centre, so it takes
  // the row's own "Open in centre" action — the route the row offers.
  const row = nav.locator(".left-conversation").filter({has: conversation});
  await row.hover();
  await row.getByRole("button", {name: "Actions for Canvas editor and prepared context acceptance", exact: true}).click();
  await row.getByRole("menuitem", {name: "Open in centre", exact: true}).click();
  await page.locator('[data-region="centre"]').getByRole("textbox", {name: "Message", exact: true}).waitFor();
  // The prepared-context read model mounts in the right region's Context
  // plane, keyed to the accompanying conversation's project/session.
  await page.getByRole("button", {name: "Toggle right region", exact: true}).click();
  const panel = page.getByRole("region", {name: "Accompanying agent"});
  await panel.waitFor();
  const planesRow = () => panel.getByRole("navigation", {name: "Right region planes"});
  await planesRow().waitFor({timeout: 15000});
  const contextButton = planesRow().getByRole("button", {name: "Context", exact: true});
  try {
    await contextButton.click({timeout: 8000});
  } catch {
    // The panel re-renders while the conversation polls; the overflow menu
    // can detach between open and click, so open-and-click is retried.
    for (let attempt = 0; ; attempt++) {
      try {
        await planesRow().getByRole("button", {name: /More views \(/}).click();
        await panel.getByRole("group", {name: "More views"}).getByRole("button", {name: "Context", exact: true}).click({timeout: 3000});
        break;
      } catch (error) {
        await page.keyboard.press("Escape").catch(() => {});
        const row = await planesRow().getByRole("button").allInnerTexts().catch(() => []);
        if (attempt >= 6) throw new Error(`${error}; plane row buttons: ${JSON.stringify(row)}`);
      }
    }
  }
  const tray = panel.getByRole("region", {name: "Selected context"});
  await tray.getByText(/prepared · not sent/).waitFor({timeout: 15000});
  // The real existing provider is connected through the encounter's own
  // connect section, so the composer is live. (Dispatch-failure retention
  // itself is pinned natively by aikit-store
  // `failed_dispatch_retains_draft_and_selections`; a provider that cannot
  // spawn cannot open, so the UI never reaches a failed send.)
  await page.locator(".encounter-connect").getByRole("button", {name: "Canvas walk Pi (existing provider)"}).click({timeout: 15000});
  await page.locator(".encounter-send").waitFor({state: "visible", timeout: 30000});
  await page.getByText("Connected", {exact: true}).waitFor({timeout: 60000});
  check(await page.getByRole("dialog").count() === 0, "the prepared-context surface opens no modal");

  // Open the disposable source in the editor.
  const fileRow = nav.locator(`[data-file-path="Work/Editor/${p.sourcePath}"]`);
  try {
    await fileRow.click({timeout: 8000});
  } catch {
    // The project row discloses its sections; the files section discloses
    // the file rows. Both are ordinary disclosures a reader operates.
    await nav.locator('[data-project-path="Work/Editor"]').click().catch(() => {});
    await nav.getByRole("button", {name: "Editor: files", exact: true}).click({timeout: 10000}).catch(() => {});
    await fileRow.click({timeout: 10000});
  }
  // Fresh material opens rendered; the reader brings the source out.
  await page.getByRole("tab", {name: "Source", exact: true}).click({timeout: 15000});
  const sourceEditor = page.locator('.cm-content[data-source-ref*="canvas-source.md"]');
  await sourceEditor.waitFor({timeout: 20000});
  p.sourceRef = await sourceEditor.getAttribute("data-source-ref");
  const DOC = '.cm-content[data-source-ref*="canvas-source.md"]';
  try {
    await waitForDoc(page, ORIGINAL, DOC, 8000);
  } catch {
    const actual = await docText(page, DOC);
    throw new Error(`doc mismatch; actual=${JSON.stringify(actual)}`);
  }
  const start = ORIGINAL.indexOf(NEEDLE, ORIGINAL.indexOf(NEEDLE) + 1);
  check(start > 0 && ORIGINAL.slice(start, start + NEEDLE.length) === NEEDLE, "the exact repeated passage is locatable");
  // The keyboard walk moves one code point per press; the emoji before the
  // target makes that differ from the UTF-16 offset the native anchor uses.
  const cpStart = [...ORIGINAL.slice(0, start)].length;
  const cpLen = [...NEEDLE].length;

  // Format tools on the real editor: bold rewrites exactly the intended
  // range, one undo restores the exact bytes, split keeps one editor.
  await selectRange(sourceEditor, cpStart, cpStart + cpLen);
  await page.getByRole("button", {name: "Bold", exact: true}).click();
  const bolded = ORIGINAL.slice(0, start) + "**" + NEEDLE + "**" + ORIGINAL.slice(start + NEEDLE.length);
  await expectDoc(page, bolded, DOC, "after Bold");
  check(true, "bold rewrites exactly the selected range and no other bytes");
  await page.getByRole("button", {name: "Undo", exact: true}).click();
  await expectDoc(page, ORIGINAL, DOC, "after Undo");
  check(true, "one undo restores the exact source bytes");
  await sourceEditor.click(); // focus brings the material chrome out
  const expand = page.getByRole("button", {name: "Show editing tools", exact: true});
  if (await expand.isVisible().catch(() => false)) await expand.click();
  await page.getByRole("tab", {name: "Split", exact: true}).click({timeout: 10000});
  await page.locator(".material-preview-pane").getByRole("tab", {name: "Rendered", exact: true}).waitFor({timeout: 10000});
  check(await page.locator(".cm-editor").count() === 1, "split keeps exactly one source editor");
  await page.locator(".material-source-pane").getByRole("tab", {name: "Source", exact: true}).click();

  // Ordinary selection → non-modal native preparation.
  await selectRange(sourceEditor, cpStart, cpStart + cpLen);
  await page.getByRole("button", {name: "Add selected text to context", exact: true}).click();
  const item = tray.locator(".prepared-context-item");
  await item.waitFor();
  check(await page.getByRole("dialog").count() === 0, "ordinary selection preparation opens no modal");
  check(await item.getAttribute("data-selection-id") !== null, "the prepared row carries its native identity");
  await page.locator(".context-prepared-highlight").first().waitFor();
  check(true, "the prepared selection shows a retained source cue");

  // The native store holds the exact UTF-16 range at the exact revision.
  // Without a bound conversation the preparation lands at Project scope —
  // the designed "native Project preparation without an Agent" state.
  let native0 = p.projectContextRead();
  check(native0.items.length === 1, "AIKit holds exactly one prepared selection at Project scope");
  check(native0.items[0].selection.anchor.start === start && native0.items[0].selection.anchor.end === start + NEEDLE.length,
    "the native anchor is the exact UTF-16 range of the repeated occurrence");
  check(native0.items[0].selection.text === NEEDLE, "the native snapshot text is exact, emoji included");
  check((native0.items[0].selection.source_revision ?? "") !== "", "the native snapshot pins the source revision");

  // Reveal renders the cue back on the open source; remove empties the store.
  await item.getByRole("button", {name: /Reveal /}).click();
  await page.locator(".context-prepared-highlight").first().waitFor();
  check(true, "reveal re-renders the retained cue on the open source");
  await item.getByRole("button", {name: /from context/}).click();
  await tray.getByText("0 prepared · not sent").waitFor({timeout: 20000});
  check(p.projectContextRead().items.length === 0, "remove clears the native prepared selection");

  // Re-prepare, then resolve through native Vāk ownership.
  await selectRange(sourceEditor, cpStart, cpStart + cpLen);
  await page.getByRole("button", {name: "Add selected text to context", exact: true}).click();
  await item.waitFor();
  native0 = p.projectContextRead();
  check(typeof native0.items[0].canonical_expression === "string" && native0.items[0].canonical_expression.length > 0,
    "AIKit rendered the canonical native expression (Vāk stays native)");
  // Explicit adoption moves the Project preparation into this conversation.
  const adopted = p.adoptIntoSession();
  check(adopted.items.length === 1 && p.projectContextRead().items.length === 0,
    "adoption moves the prepared selection into the conversation scope");
  const knowledgeBefore = calls.filter(c => c.op === "knowledge").length;
  if (await item.locator("summary").count()) await item.locator("summary").click();
  await item.getByRole("button", {name: "Resolve expression", exact: true}).click();
  await page.getByText(/resolved references · preparation is unchanged/).waitFor({timeout: 20000});
  const resolveCalls = calls.filter(c => c.op === "knowledge").slice(knowledgeBefore);
  check(resolveCalls.some(c => c.result === "knowledge"), "Resolve answered through the real native knowledge owner");
  await shot("native-resolve-on-prepared-selection");

  // Stale-source refusal: the prepared range changes in the open buffer.
  const dispatchIndex = calls.length;
  await selectRange(sourceEditor, cpStart, cpStart + cpLen);
  await sourceEditor.type("x");
  await expectDoc(page, ORIGINAL.slice(0, start) + "x" + ORIGINAL.slice(start + NEEDLE.length), DOC, "after typing over the prepared range");
  await activateTab(page, "Canvas editor and prepared context acceptance");
  await page.getByRole("textbox", {name: "Message", exact: true}).waitFor({timeout: 15000});
  await page.getByRole("textbox", {name: "Message", exact: true}).fill(DRAFT);
  await page.locator(".encounter-send").click();
  await page.getByRole("alert").first().waitFor({timeout: 15000});
  check(p.contextRead().items.length === 1, "stale-source refusal retains the prepared selection natively");
  check(p.request("view").draft.text === DRAFT, "stale-source refusal retains the instruction");
  check(!calls.slice(dispatchIndex).some(c => c.op === "encounter" && (c.action === "prompt" || c.action === "prompt-context")),
    "the stale send dispatched nothing to the native owner");
  await shot("stale-source-refusal-retains-preparation");

  // Restore the exact bytes (undo) and re-prepare.
  await activateTab(page, "canvas-source.md");
  for (let undos = 0; undos < 6; undos++) {
    const current = await docText(page, DOC);
    if (current === ORIGINAL) break;
    await sourceEditor.press("ControlOrMeta+z");
    await page.waitForTimeout(150);
  }
  await expectDoc(page, ORIGINAL, DOC, "after undo of the stale edit");
  // Clear any adopted leftover, then adopt the fresh Project-scope
  // preparation (from the re-selection above) into this conversation.
  const sessHeld = p.contextRead();
  check(sessHeld.items.length === 1, "the restored preparation sits in the conversation scope before delivery");

  // Explicit delivery with the real existing provider, then the Return.
  await activateTab(page, "Canvas editor and prepared context acceptance");
  await page.getByRole("textbox", {name: "Message", exact: true}).waitFor({timeout: 15000});
  await page.getByRole("textbox", {name: "Message", exact: true}).fill(DRAFT);
  await page.waitForFunction(() => !document.querySelector(".encounter-send")?.disabled, undefined, {timeout: 30000});
  await page.locator(".encounter-send").click();
  await page.locator(".encounter-turn.encounter-user").first().waitFor({timeout: 30000});
  await page.locator(".encounter-turn.encounter-assistant").first().waitFor({timeout: 240000});
  let view = p.request("view");
  for (let reads = 0; reads < 4 && !view.blocks.some(b => b.kind === "user" && b.text.includes(DRAFT)); reads++) {
    await page.waitForTimeout(1200);
    view = p.request("view");
  }
  check(view.blocks.some(b => b.kind === "user" && b.text.includes(DRAFT)), "the instruction is recorded in the transcript");
  check(view.blocks.some(b => b.kind === "assistant" && b.text.trim().length > 0), "a real provider Return arrived (existing pi/GLM harness)");
  const receipts = view.prepared_context_receipts ?? [];
  check(receipts.length >= 1, "the submission recorded a structured prepared-context receipt");
  check(receipts[0]?.standing === "owner-recorded-submission-not-provider-memory", "the receipt states its honest standing");
  check((receipts[0]?.items ?? []).some(i => (i.source_ref ?? "").includes("canvas-source.md")), "the receipt names the delivered source");
  check(p.contextRead().items.length === 0, "successful delivery cleared the prepared selections");
  check(p.request("view").draft.text === "", "successful delivery cleared the draft");
  await shot("real-return-after-explicit-delivery");

}
