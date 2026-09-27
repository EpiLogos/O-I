// Seed the curated Factory Expressions material into the material register
// (world.ts MATERIAL_REGISTER, `Work/O-I/desktop/cradle/material/
// expressive-material/<kind>/`) through the ordinary kernel path: the
// register's own folders come from `material_list` (`folders[kind]`, the
// owner-disclosed `parent` for save_as); each document is `open`ed in the
// running desktop's Expression field and saved with `save_as` through
// Central's own file operation. Never a copy around that path.
//
// Usage (the integration lead runs it against the installed desktop):
//   node material/factory-expressions/seed.mjs [--socket PATH] [--oi oi] [--dry-run]
// Output: one JSON line per document with the kernel's answer; exit 1 when
// any document was refused (the refusal is printed in the owner's words).
import {spawnSync} from "node:child_process";
import {readFileSync, readdirSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const known = new Set(["--socket", "--oi", "--dry-run"]);
if (args.includes("--help") || args.includes("-h") || args.some((arg, i) => arg.startsWith("-") && !known.has(arg) && !known.has(args[i - 1] ?? ""))) {
  console.log("usage: node material/factory-expressions/seed.mjs [--socket PATH] [--oi oi] [--dry-run]");
  process.exit(args.includes("--help") || args.includes("-h") ? 0 : 2);
}
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const socket = flag("--socket");
const oi = flag("--oi") ?? process.env.OI_BIN ?? "oi";
const dryRun = args.includes("--dry-run");
const ACTOR = "agent:factory-expressions-lane-c";
const stamp = new Date().toISOString().slice(0, 10);

function call(request) {
  const argv = ["desktop", "expression", ...(socket ? [socket] : []), JSON.stringify(request)];
  const done = spawnSync(oi, argv, {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
  if (done.status !== 0) throw new Error((done.stderr || done.stdout || `oi exited ${done.status}`).trim());
  return JSON.parse(done.stdout);
}
const dataOf = response => response?.outcome?.data ?? response?.outcome ?? response;

const listing = dryRun ? {state: "materials", folders: {}, materials: []} : dataOf(call({schema: "oi.expression-world/v1", operation: "material_list"}));
const folders = listing?.folders ?? {};
if (!listing || listing.state !== "materials") { console.error(`material_list did not answer: ${JSON.stringify(listing)}`); process.exit(1); }
const already = new Set((listing.materials ?? []).map(material => material.location?.path?.split("/").pop()));

let refused = 0;
for (const kind of ["character", "gesture", "scene", "expression"]) {
  for (const name of readdirSync(join(HERE, kind)).filter(file => file.endsWith(".expression.json")).sort()) {
    const document = JSON.parse(readFileSync(join(HERE, kind, name), "utf8"));
    const parent = folders[kind];
    if (!parent && !dryRun) { refused++; console.log(JSON.stringify({file: `${kind}/${name}`, state: "refused", refusal: `material_list disclosed no ${kind} folder`})); continue; }
    if (already.has(name)) { console.log(JSON.stringify({file: `${kind}/${name}`, state: "present", location: parent})); continue; }
    const saveAs = revision => ({operation: "save_as", expression_ref: document.expression_ref, expected_revision: revision, parent, name,
      operation_ref: `seed:factory-expressions:${kind}:${name}:${stamp}`, actor: ACTOR, actor_kind: "agent"});
    if (dryRun) { console.log(JSON.stringify({file: `${kind}/${name}`, open: {operation: "open", actor: ACTOR, document: document.expression_ref}, save_as: {...saveAs(document.revision), parent: `folders.${kind} from material_list`}})); continue; }
    try {
      let opened = dataOf(call({operation: "open", document, actor: ACTOR}));
      if (!opened?.document) opened = dataOf(call({operation: "inspect", expression_ref: document.expression_ref}));
      const revision = opened?.document?.revision ?? document.revision;
      const saved = dataOf(call(saveAs(revision)));
      const ok = saved?.state !== "save_refused" && saved?.state !== "conflict";
      if (!ok) refused++;
      console.log(JSON.stringify({file: `${kind}/${name}`, expression_ref: document.expression_ref, state: saved?.state ?? "saved", location: saved?.file?.location ?? saved?.location ?? null, refusal: ok ? undefined : saved}));
    } catch (error) {
      refused++;
      console.log(JSON.stringify({file: `${kind}/${name}`, expression_ref: document.expression_ref, state: "refused", refusal: String(error.message ?? error)}));
    }
  }
}
process.exit(refused ? 1 : 0);
