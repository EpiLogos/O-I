// Embeds the pure plural-flow module (src/flow/plural.ts) into the standalone
// form, so the open page, the app and the native owners' conformance all run
// one validator/authoring path. `node documents/embed-plural.mjs` rewrites the
// block; `--check` fails when the form's embedded copy drifts from the source.
import {readFileSync, writeFileSync} from "node:fs";
import {createRequire} from "node:module";
const require = createRequire(import.meta.url);
const {transformSync} = require("esbuild");
const root = new URL("../", import.meta.url);
const source = readFileSync(new URL("src/flow/plural.ts", root), "utf8");
const {code} = transformSync(source, {loader: "ts", format: "iife", globalName: "QlPlural", target: "es2022", charset: "utf8", legalComments: "none"});
const block = `<!--ql-plural:begin-->\n<script id="ql-plural">\n${code.trim().replace(/<\/script/gi, "<\\/script")}\n</script>\n<!--ql-plural:end-->`;
const file = new URL("documents/ql-flow.html", root);
const html = readFileSync(file, "utf8");
const pattern = /<!--ql-plural:begin-->[\s\S]*?<!--ql-plural:end-->/;
if (!pattern.test(html)) throw new Error("ql-flow.html has no ql-plural markers");
const next = html.replace(pattern, () => block);
if (process.argv.includes("--check")) {
  if (next !== html) { console.error("ql-flow.html embeds a stale copy of src/flow/plural.ts — run: node documents/embed-plural.mjs"); process.exit(1); }
  console.log("ql-flow.html embeds the current plural-flow module");
} else { writeFileSync(file, next); console.log("embedded", code.length, "bytes"); }
