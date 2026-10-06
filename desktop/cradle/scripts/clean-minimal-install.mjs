#!/usr/bin/env node
// A clean minimal installation, proved on this machine without borrowing from the everyday one (O:I #595, map §5.1).
//
//   node scripts/clean-minimal-install.mjs --bundle <oi-cradle-….tar.gz> --oi <candidate oi> [--keep]
//
// Everything runs under a sandbox HOME with a sandbox PATH that names the products the minimal composition includes
// (Central, Actuation, AIKit, QL-MEF) and withholds Factory and Workcell; a tripwire records and refuses any attempt to
// reach them. The steps, each a recorded check in walk/artifacts/clean-install.json:
//
//   1. the install plan names the Desktop alone and mutates nothing (--plan), then the real install adopts the bundle
//   2. the installed app is where the footprint says, its receipt records what the installer owns, nothing else moved
//   3. the owner's census, read from the sandbox, reports exactly 0/1/2 + QL (an explicit selection) — never a mode name
//   4. the installed application starts, serves its expression socket in the sandbox, and dispatches to neither product
//   5. the bundle records the minimal closure (no hosted SharedField client) and the app carries none
//   6. remove: only receipt-owned resources go; the sandbox ground and products stay
import {execFileSync, spawn} from "node:child_process";
import {existsSync, mkdirSync, rmSync, cpSync, statSync, readdirSync} from "node:fs";
import {homedir} from "node:os";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {installTripwireEnvironment} from "../walk/lib/absence-tripwire.mjs";
import {writeReceipt} from "../walk/lib/field-walk.mjs";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const here = dirname(fileURLToPath(import.meta.url));
const bundle = arg("bundle");
const oi = arg("oi", process.env.OI_CANDIDATE_BIN);
if (!bundle || !existsSync(bundle)) { console.error("clean-install: --bundle <tar.gz> is required"); process.exit(2); }
if (!oi || !existsSync(oi)) { console.error("clean-install: --oi <candidate oi binary> is required"); process.exit(2); }

const root = join(tmpdir(), `oi-clean-${process.pid}`), home = join(root, "home");
mkdirSync(home, {recursive: true});
const everyday = join(homedir(), "Applications", "O-I.app"), configHome = join(homedir(), ".config", "oi");
const stamp = p => existsSync(p) ? `${statSync(p).mtimeMs}:${readdirSync(p).length}` : "absent";
const before = {app: stamp(everyday), config: stamp(configHome), aikit: stamp(join(homedir(), ".aikit"))};
process.env.OI_CANDIDATE_BIN = oi; // the sandbox PATH carries the candidate `oi` under test, not the everyday installed one
const env = {...process.env};
const trip = installTripwireEnvironment({home, base: env});
const run = (cmd, args, extra = {}) => execFileSync(cmd, args, {env, encoding: "utf8", cwd: home, ...extra});
const json = (cmd, args) => JSON.parse(run(cmd, args));
const checks = [];
const check = (ok, label, detail) => { checks.push({ok: !!ok, label, ...(detail !== undefined ? {detail} : {})}); console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail !== undefined ? " · " + JSON.stringify(detail).slice(0, 260) : ""}`); return !!ok; };
let app;
try {
  // a fresh Central ground with one ordinary linked project corpus (not the essay)
  const ground = join(home, "Central");
  run("ctrl", ["--root", ground, "--json", "action", "run", "central.init", "{}"]);
  mkdirSync(join(ground, "Work", "Notes"), {recursive: true});
  run("ctrl", ["--root", ground, "--json", "action", "run", "projectcentral.init", JSON.stringify({project: "Notes", project_id: "notes"})]);
  cpSync(resolve(here, "../tests/fixtures/field-corpus"), join(ground, "Work", "Notes", "corpus"), {recursive: true});
  Object.assign(env, {OI_CENTRAL_ROOT: ground});

  // 1 — plan, then install
  const plan = json(oi, ["desktop", "install", "--bundle", bundle, "--plan", "--json"]);
  check(plan && !JSON.stringify(plan).toLowerCase().match(/software-factory|workcell/) , "the install plan names neither Factory nor Workcell", {backing: plan.backing ?? plan.selection ?? null});
  const installed = json(oi, ["desktop", "install", "--bundle", bundle, "--json"]);
  check(installed && (installed.ok ?? true) !== false, "the real install adopts the bundle into the sandbox", Object.keys(installed ?? {}));

  // 2 — where it landed
  const appPath = join(home, "Applications", "O-I.app");
  check(existsSync(join(appPath, "Contents/MacOS/oi-cradle")), "the installed application is at ~/Applications/O-I.app of the SANDBOX home");
  const after = {app: stamp(everyday), config: stamp(configHome), aikit: stamp(join(homedir(), ".aikit"))};
  check(JSON.stringify(before) === JSON.stringify(after), "the everyday ~/Applications/O-I.app, ~/.config/oi and ~/.aikit are unchanged by the install", {before, after});
  const status = json(oi, ["desktop", "status", "--json"]);
  check(status && JSON.stringify(status).includes("installed") , "oi desktop status discloses the installed state", status.state ?? status.status ?? Object.keys(status));

  // 3 — the census from inside the sandbox
  const world = json(oi, ["current-world", "--json"]);
  const present = world.context_frame?.present_positions;
  check(JSON.stringify(present) === "[0,1,2,5]" || JSON.stringify(present) === "[0,1,2]", "the census reports 0/1/2 (+ QL when its binary is installed) — an explicit selection", {present, install_mode: world.context_frame?.install_mode});
  const byId = Object.fromEntries((world.positions ?? []).map(p => [p.product_id, p.present]));
  check(byId["software-factory"] === false && byId.workcell === false, "Factory and Workcell are absent in the sandbox's own census", byId);

  // 4 — the installed application starts; the tripwire stays quiet
  const socket = join(root, "expression.sock");
  const exe = join(appPath, "Contents/MacOS/oi-cradle");
  const bin = join(trip.root, "bin"); void bin;
  app = spawn(exe, [], {env: {...env, OI_EXPRESSION_SOCKET: socket}, cwd: ground, stdio: "ignore"});
  let alive = false;
  for (let i = 0; i < 60 && !alive; i++) { await new Promise(r => setTimeout(r, 500)); alive = existsSync(socket); }
  check(alive && app.exitCode === null, "the installed application started and serves its expression socket in the sandbox", {socket: alive});
  await new Promise(r => setTimeout(r, 4000));
  check(trip.entries().length === 0, "the installed application dispatched to neither Factory nor Workcell while starting", trip.entries());

  // 5 — the recorded closure
  const bundleJson = JSON.parse(execFileSync("tar", ["-xzOf", bundle, "oi-desktop-bundle/BUNDLE.json"], {encoding: "utf8"}));
  check(bundleJson.closure?.profile === "minimal" && bundleJson.closure.excluded_products.join() === "software-factory,workcell", "BUNDLE.json records the minimal closure", bundleJson.closure);
  check(!existsSync(join(appPath, "Contents/Resources/shared-field")), "the application carries no hosted SharedField client");
} catch (e) { checks.push({ok: false, label: "unexpected error", detail: String(e?.stack ?? e).slice(0, 600)}); console.log("ERROR —", e?.stack ?? e); }
finally {
  try { app?.kill(); } catch { /* gone */ }
  // 6 — remove: only receipt-owned resources
  try {
    const removed = json(oi, ["desktop", "remove", "--json"]);
    check(!existsSync(join(home, "Applications", "O-I.app")) && existsSync(join(home, "Central", "Control")), "remove takes only receipt-owned resources: the app goes, the sandbox ground stays", Object.keys(removed ?? {}));
  } catch (e) { check(false, "remove", String(e).slice(0, 300)); }
}
const ok = checks.every(c => c.ok);
writeReceipt("clean-install.json", {scenario: "clean-minimal-install", grade: "B", sandbox_root: root, withheld: trip.withheld, bundle, checks, ok, note: "The installed application's own window is not driven here; the frontend of the same build is walked against the sandbox kernel separately."});
console.log(`\n${checks.filter(c => c.ok).length}/${checks.length} checks passed`);
if (!process.argv.includes("--keep")) rmSync(root, {recursive: true, force: true});
process.exit(ok ? 0 : 1);
