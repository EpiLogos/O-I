import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setup as sourceSetup } from "./editor.mjs";

/** U3.3 remember-this (the desktop half): a selection remembered from the
 * context tray lands through the owner's typed remember operations —
 * `projectcentral.remember` / `central.remember` — as a generated proposal
 * with full provenance, in the chosen register. Recognition is the human
 * owner's separate act; the walk proves the receipt says so and no control
 * claims it. Owner readback runs through the owner's own disclosed
 * read_path, not a desktop assertion. */

export async function setup(args) {
  return await sourceSetup(args);
}

async function selectRange(editor, start, end) {
  await editor.focus(); await editor.press("Meta+ArrowUp");
  for (let i = 0; i < start; i++) await editor.press("ArrowRight");
  for (let i = start; i < end; i++) await editor.press("Shift+ArrowRight");
}

export default async function run({ page, baseUrl, check, shot, channel, provision: p }) {
  const dispatched = [];
  page.on("response", async response => {
    if (!response.url().endsWith("/op")) return;
    try {
      const body = await response.json();
      if (response.request().postDataJSON()?.op === "invoke_action") dispatched.push(body.outcome);
    } catch { /* transport frames that never settle are not dispatch evidence */ }
  });

  await page.goto(baseUrl);
  const nav = page.getByRole("complementary", { name: "World navigator" });
  await nav.locator('[data-project-path="Work/Editor"]').click();
  await nav.getByRole("button", { name: "Editor: files", exact: true }).click();
  const source = p.sources[0], content = p.originals.get(source.binding.path);
  await nav.locator(`[data-file-path="Work/Editor/${source.binding.path}"]`).click();
  const editor = page.locator('.cm-content[data-source-ref="' + source.binding.ref + '"]'); await editor.waitFor();

  const excerpt = content.slice(5, 12);
  await selectRange(editor, 5, 12);
  await page.getByRole("button", { name: "Context mode", exact: true }).click();
  await page.getByRole("button", { name: "Attach selection", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Include selected context" }); await dialog.waitFor();

  const rememberButton = dialog.getByRole("button", { name: "Remember this", exact: true });
  const scopeSelect = dialog.getByRole("combobox", { name: "Remember destination" });
  check(await rememberButton.isVisible(), "A revision-carrying source selection offers Remember");
  check(await scopeSelect.isVisible(), "The remember destination select names the registers");
  const options = await scopeSelect.locator("option").allInnerTexts();
  check(options.some(t => t.includes("Editor register")) && options.some(t => t.includes("Root register")), "Both the project and the root register are offered for a project source selection");
  check((await scopeSelect.inputValue()) === "project", "The selection's own project register is the default destination");

  // Remember into the project register.
  await rememberButton.click();
  await dialog.locator('[data-remembered-state="invoked"]').waitFor();
  const receipt = await dialog.locator('[data-remembered-state="invoked"]').innerText();
  check(receipt.includes("remembered-note:"), "The receipt names the owner's content-addressed note ref");
  check(receipt.includes("generated-proposal"), "The receipt carries the owner's generated-proposal authorship");
  check(receipt.includes("unrecognised") && receipt.includes("human owner's separate act"), "The receipt states recognition is the human owner's separate act and none is performed here");
  check(receipt.includes("projectcentral.remember"), "The receipt names the owner operation that ran");
  check(receipt.includes(source.binding.ref), "The receipt carries the exact Central source ref");
  check(await rememberButton.isVisible(), "The tray stays open on the receipt — the provenance is the result of the act");
  const invocation = dispatched.at(-1);
  check(invocation?.result === "action_dispatched" && invocation.dispatch.state === "invoked", "The kernel dispatch settles invoked");
  const ownerNote = invocation.dispatch.data.note;
  check(ownerNote.provenance.selection === excerpt, "The owner records the selection VERBATIM");
  check(ownerNote.provenance.source_ref === source.binding.ref, "The owner records the exact source ref");
  check(ownerNote.provenance.recognition === "unrecognised" && ownerNote.provenance.authorship === "generated-proposal", "The owner stamps the note generated-proposal/unrecognised");

  const projectDir = join(p.projectRoot, "ProjectCentral", "agents", "remembered");
  const projectFiles = readdirSync(projectDir);
  check(projectFiles.length === 1 && projectFiles[0].endsWith(".json"), "The note file exists in the project's remembered ground");
  const onDisk = JSON.parse(readFileSync(join(projectDir, projectFiles[0]), "utf8"));
  check(onDisk.provenance.selection === excerpt && onDisk.provenance.source_ref === source.binding.ref, "The on-disk note carries the verbatim selection and source ref");
  const reread = p.call(invocation.dispatch.data.read_path.action, invocation.dispatch.data.read_path.input);
  check(JSON.stringify(reread).includes(ownerNote.ref) && JSON.stringify(reread).includes("generated-proposal"), "The owner's own disclosed read path returns the remembered note");
  await shot("remember-project-register-receipt");

  // The same passage into the ROOT register.
  await scopeSelect.selectOption("root");
  await rememberButton.click();
  await dialog.locator('[data-remembered-state="invoked"]', { hasText: "central.remember" }).waitFor();
  const rootInvocation = dispatched.at(-1);
  check(rootInvocation.dispatch.state === "invoked" && rootInvocation.dispatch.data.note.provenance.origin_action === "central.remember", "The root-register remember runs the owner's central.remember operation");
  const rootDir = join(p.root, "Control", "agents", "remembered");
  const rootFiles = readdirSync(rootDir);
  check(rootFiles.length === 1 && rootFiles[0].endsWith(".json"), "The root-register note lands under Control/agents/remembered");
  const rootNote = JSON.parse(readFileSync(join(rootDir, rootFiles[0]), "utf8"));
  check(rootNote.provenance.source_ref === source.binding.ref && rootNote.provenance.selection === excerpt, "The root note preserves the project source's full ref and the verbatim selection");

  // A source that changed after selection is refused; no note lands.
  const dispatchCount = dispatched.length;
  await page.getByRole("button", { name: "Close context selection" }).click();
  await selectRange(editor, 8, 15);
  await page.getByRole("button", { name: "Context mode", exact: true }).click();
  await page.getByRole("button", { name: "Attach selection", exact: true }).click(); await dialog.waitFor();
  await channel("invoke.source_edit", [source.binding.ref, `Changed after selection.\n${content}`]);
  await page.waitForFunction(() => document.querySelector('.source-editor')?.getAttribute('data-dirty') === 'true');
  await rememberButton.click();
  const refusal = dialog.getByRole("alert"); await refusal.waitFor();
  check((await refusal.innerText()).includes("selected material changed"), "A source changed after selection is visibly refused");
  check(dispatched.length === dispatchCount, "A stale selection dispatches nothing");
  check(readdirSync(projectDir).length === 1 && readdirSync(rootDir).length === 1, "A stale remember changes no owner ground");
  await shot("remember-stale-refusal");

  // An observed component selection offers no Remember (no owner revision).
  await page.getByRole("button", { name: "Close context selection" }).click();
  await editor.locator('.cm-line').first().hover();
  await page.locator('.component-pick-bounds').waitFor();
  await editor.locator('.cm-line').first().click(); await dialog.waitFor();
  check(await dialog.getByRole("button", { name: "Remember this", exact: true }).count() === 0, "An observed component selection offers no Remember — nothing is advertised that cannot run");
}
