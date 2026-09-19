import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read = name => readFile(new URL(`../src/${name}`, import.meta.url), "utf8");

const prepared = await read("context/prepared.ts");
const panel = await read("context/PreparedPanel.tsx");
const context = await read("context/PreparedContext.tsx");
const frame = await read("CradleFrame.tsx");
const editor = await read("editor/TextEditor.tsx");
const chrome = await read("editor/EditorChrome.tsx");
const shell = await read("workspace/DesktopShell.tsx");
const sharedField = await read("receiving/SharedFieldMaterial.tsx");
const encounterSurface = await read("encounter/EncounterSurface.tsx");
const encounterView = await read("encounter/EncounterView.tsx");
const encounterClient = await read("encounter/client.ts");

test("the context-selection modal is gone from the ordinary path", () => {
  assert.doesNotMatch(frame, /ContextTray/);
  assert.match(frame, /<PreparedContext bindings=/);
  assert.match(frame, /oi:reveal-prepared/);
  assert.match(context, /oi:context-candidate/);
  assert.match(context, /admitCandidate/);
  assert.doesNotMatch(context, /context-scrim/);
});

test("staging validates currency before an item exists, in the tray's own words", () => {
  assert.match(prepared, /The selected source is no longer available\. Select it again\./);
  assert.match(prepared, /The selected file changed before its revision could be recorded\. Select it again\./);
  assert.match(prepared, /The selected component changed\. Pick it again\./);
  assert.match(prepared, /The selected material changed\. Select it again before including it\./);
});

test("delivery revalidates and travels through the native owners only", () => {
  assert.match(panel, /composeValidated/);
  assert.match(panel, /action:"view",agent_session:accompanying\.ref/);
  assert.match(panel, /basis:read\.draft\.revision/);
  assert.match(panel, /nothing has been disclosed/);
  assert.match(panel, /recognition is the human owner's separate act/);
});

test("items keep exact identity: ref, revision, range, observation", () => {
  assert.match(prepared, /sourceRef\?:string/);
  assert.match(prepared, /revision\?:string/);
  assert.match(prepared, /start\?:number/);
  assert.match(prepared, /observationKey\?:string/);
  assert.match(panel, /Resolve in AIKit/);
});

test("the source cue is presentation-only and not saved editor state", () => {
  assert.match(editor, /contextCues/);
  assert.match(editor, /refreshCues/);
  assert.doesNotMatch(editor, /JSON\.stringify\(\{ doc: v\.state\.doc\.toString\(\), contextCues/);
  assert.match(editor, /Add selection to context/);
  assert.match(chrome, /Add to context/);
});

test("the companion control is quiet and counts prepared context", () => {
  assert.match(shell, /Glyph name="companion"/);
  assert.match(shell, /usePreparedItems/);
  assert.match(shell, /shell-agent-count/);
  assert.match(shell, /Toggle agents and context region/);
});

test("A2A is removed from the desktop", async () => {
  for (const [name, src] of [["SharedFieldMaterial", sharedField], ["EncounterSurface", encounterSurface], ["EncounterView", encounterView], ["encounter client", encounterClient]]) {
    assert.doesNotMatch(src, /a2a\.mjs/, `${name} still imports the A2A floor`);
    assert.doesNotMatch(src, /[Aa]2[Aa]/, `${name} still references A2A`);
  }
  const run = await readFile(new URL("../walk/run.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(run, /a2a-exchange|agency-a2a/);
});
