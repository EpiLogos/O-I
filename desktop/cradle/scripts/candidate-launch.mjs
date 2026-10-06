#!/usr/bin/env node
// The candidate launch route for the site-led Base/Central (O:I #592 / #595): the real Cradle frontend and the real
// kernel on an ISOLATED candidate profile, so the person's everyday installation, workspaces and layouts are not touched.
//
//   node scripts/candidate-launch.mjs [--mode web|tauri] [--profile NAME] [--site-root DIR] [--ground DIR] [--oi PATH]
//                                      [--bridge-port N] [--vite-port N] [--edition-port N] [--no-open]
//
//   web    (default) the Cradle served by vite, the kernel as the loopback walk bridge — dev tooling that fronts the same
//          typed KernelOp seam the native host does. Opens in the default browser. No native build needed.
//   tauri  the native debug shell (`cargo build` in src-tauri; run once beforehand) loading the same vite dev server.
//
// Isolation: OI_HOME and the WebKit/browser store are per profile (~/.oi-candidates/<profile>/), so layouts, acts and
// settings never mix with the everyday app. The Central ground defaults to the real one (read/write as the person's
// own world; AIKit sessions started by the companion land in their real AIKit home — say --ground to point elsewhere).
// The essay edition is served from --site-root (a built site root: essay/static/fieldIndex.json) and handed to the
// Cradle as VITE_ESSAY_EDITION; the Epi-Logos lens (footer) then reads the real published essay.
import {spawn, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {homedir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {serveEdition} from "../walk/lib/field-edition-server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cradle = resolve(here, "..");
const repo = resolve(cradle, "../..");
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const flag = name => process.argv.includes(`--${name}`);

const mode = arg("mode", "web");
const profile = arg("profile", "central-field");
const profileDir = join(homedir(), ".oi-candidates", profile);
const home = join(profileDir, "oi-home");
mkdirSync(home, {recursive: true});
const siteRoot = resolve(arg("site-root", process.env.FIELD_SITE_ROOT ?? join(repo, "site/dist")));
const ground = resolve(arg("ground", process.env.OI_CENTRAL_ROOT ?? join(homedir(), "Central")));
const oi = arg("oi", process.env.OI_CANDIDATE_BIN ?? process.env.OI_BIN ?? "oi");
const bridgePort = Number(arg("bridge-port", 4311)), vitePort = Number(arg("vite-port", mode === "tauri" ? 1421 : 1431)), editionPort = Number(arg("edition-port", 4717));

if (!existsSync(join(siteRoot, "essay/static/fieldIndex.json"))) { console.error(`candidate: --site-root must name a built site root (essay/static/fieldIndex.json); got ${siteRoot}`); process.exit(2); }
if (!existsSync(ground)) { console.error(`candidate: the Central ground ${ground} does not exist`); process.exit(2); }

// A stable 32-hex id gives the native shell its own persistent WebKit store for this profile.
const storeFile = join(profileDir, "data-store-id");
if (!existsSync(storeFile)) writeFileSync(storeFile, createHash("sha256").update(`oi-candidate:${profile}`).digest("hex").slice(0, 32) + "\n");
const storeId = readFileSync(storeFile, "utf8").trim();

const children = [];
const stop = () => { for (const c of children) { try { c.kill(); } catch { /* gone */ } } process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
const waitHttp = async (url, label) => { for (let i = 0; i < 240; i++) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await new Promise(r => setTimeout(r, 250)); } throw new Error(`${label} did not answer at ${url}`); };

const edition = await serveEdition(siteRoot, editionPort);
const editionUrl = `http://127.0.0.1:${edition.port}/essay/`;
console.log(`candidate: essay edition   ${editionUrl}   (from ${siteRoot})`);

const env = {...process.env, OI_HOME: home, OI_CENTRAL_ROOT: ground, OI_BIN: oi, VITE_ESSAY_EDITION: editionUrl};
if (mode === "web") {
  const bridgeBin = process.env.FIELD_BRIDGE_BIN ?? join(cradle, "kernel/target/debug/walk-bridge");
  if (!existsSync(bridgeBin)) { console.error(`candidate: no walk bridge at ${bridgeBin} — build it: (cd desktop/cradle/kernel && cargo build --bin walk-bridge)`); process.exit(2); }
  const bridge = spawn(bridgeBin, [`127.0.0.1:${bridgePort}`], {cwd: ground, env, stdio: "inherit"});
  children.push(bridge);
  await waitHttp(`http://127.0.0.1:${bridgePort}/state`, "the kernel bridge");
  env.VITE_KERNEL_BRIDGE = `http://127.0.0.1:${bridgePort}`;
  console.log(`candidate: kernel (bridge) http://127.0.0.1:${bridgePort}   OI_HOME=${home}   ground=${ground}`);
}
const vite = spawn(process.execPath, [join(cradle, "node_modules/vite/bin/vite.js"), "--port", String(vitePort), "--strictPort", "--host", "127.0.0.1"], {cwd: cradle, env, stdio: "inherit"});
children.push(vite);
await waitHttp(`http://127.0.0.1:${vitePort}/`, "the Cradle dev server");
const url = `http://127.0.0.1:${vitePort}/`;
console.log(`candidate: Cradle          ${url}   (profile ${profile}, store ${storeId})`);

if (mode === "tauri") {
  const bin = join(cradle, "src-tauri/target/debug/oi-cradle");
  if (!existsSync(bin)) { console.error(`candidate: no native shell at ${bin} — build it: (cd desktop/cradle/src-tauri && cargo build)`); stop(); }
  const shell = spawn(bin, [], {cwd: ground, env: {...env, OI_CRADLE_DATA_STORE_ID: storeId}, stdio: "inherit"});
  children.push(shell);
  shell.on("exit", () => stop());
} else if (!flag("no-open")) {
  spawnSync("open", [url]);
}
console.log("candidate: running — Ctrl-C stops everything this launched (the everyday installation is untouched).");
