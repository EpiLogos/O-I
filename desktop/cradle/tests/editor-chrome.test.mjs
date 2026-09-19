import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const chrome=await readFile(new URL("../src/editor/EditorChrome.tsx",import.meta.url),"utf8");
const material=await readFile(new URL("../src/material/MaterialSurface.tsx",import.meta.url),"utf8");

test("EditorFrame keeps editing modes opt-in",()=>{
  assert.match(chrome,/interactive=true/);
  assert.match(chrome,/\{interactive&&<>/);
  assert.match(chrome,/\{interactive&&focused&&/);
  assert.match(chrome,/\{interactive&&menu&&/);
  assert.match(chrome,/if\(!interactive\|\|mode!=="writing"\)return/);
  assert.doesNotMatch(chrome,/data-editor-mode=\{interactive\?mode:"reading"\}[\s\S]*data-editor-mode=\{mode\}/);
});

test("rendered material is a quiet reader, not a fake writing surface",()=>{
  assert.match(material,/interactive=\{false\}/);
  assert.match(material,/toolbar=\{null\}/);
  assert.match(material,/sandbox="allow-scripts allow-forms allow-downloads"/);
});
