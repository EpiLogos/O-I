// The Epi adapter's packaged-edition path: the kernel's `world_resolve` answer becomes an edition the essay source reads, served by the host
// (the walk bridge's /world/ route here; `oi-material://localhost/__world/…` in the Tauri host).
//   node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/field-world-resolve.test.mjs
// The last test starts the REAL walk bridge over an installed World and reads the whole edition through it:
//   OI_WORLDS_ROOT=<root an installed World lives under> FIELD_BRIDGE_BIN=<walk-bridge>   (skipped, with the reason, without them)
import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {createEssayFieldSource, resolveEssayEditionAsync, resolvePackagedEssayEdition, worldBase} from "../src/field/epi/essaySource.ts";

const available = {
  state: "available", world_id: "epi-logos/confronting-the-limit", root: "/w", revision: "0123456789abcdef", manifest_sha256: "ab".repeat(32),
  edition_dir: "/w/epi-logos/confronting-the-limit/revisions/0123456789abcdef/edition",
  source_addressing: {world: "project:Antykathera-Essay-Work", prefix: "submission-package/essay/"},
  counts: {pages: {nodes: 1057}}, verified: {level: "listing", files: 3054, bytes: 131558092},
  route_path: "__world/epi-logos%2Fconfronting-the-limit/0123456789abcdef/",
};
const answering = resolution => ({transport: undefined, op: async (_t, op) => { answering.last = op; return {outcome: {result: "world_resolve", receipts: [], resolution}}; }});
const bridge = {kind: "bridge", url: "http://127.0.0.1:4179"}, tauri = {kind: "tauri"};

test("the World route is addressed by transport: the bridge at /world/, the Tauri host through oi-material", () => {
  assert.equal(worldBase(bridge, available.route_path), "http://127.0.0.1:4179/world/epi-logos%2Fconfronting-the-limit/0123456789abcdef/");
  assert.equal(worldBase(tauri, available.route_path), "oi-material://localhost/__world/epi-logos%2Fconfronting-the-limit/0123456789abcdef/");
  assert.equal(worldBase({kind: "unavailable", reason: "none"}, available.route_path), undefined);
});

test("an available World becomes an edition: its files route, its addressing, its pages as files, the revision it was", async () => {
  for (const [transport, base] of [[bridge, "http://127.0.0.1:4179/world/"], [tauri, "oi-material://localhost/__world/"]]) {
    const edition = await resolvePackagedEssayEdition({...answering(available), transport});
    assert.equal(answering.last.op, "world_resolve");
    assert.equal(edition.baseUrl, `${base}epi-logos%2Fconfronting-the-limit/0123456789abcdef/edition/`);
    assert.deepEqual(edition.addressing, available.source_addressing);
    assert.equal(edition.pageFiles, true);
    assert.deepEqual(edition.packaged, {world_id: available.world_id, revision: available.revision, manifest_sha256: available.manifest_sha256, verified: available.verified});
  }
});

test("an absent, damaged or unreachable World is reported with its reason, never papered over", async () => {
  const absent = await resolvePackagedEssayEdition({...answering({state: "absent", world_id: "w", root: "/r", reason: "no World w is installed under /r"}), transport: bridge});
  assert.deepEqual([absent.state, absent.unavailable], ["absent", "The Return-of-Zero World is absent: no World w is installed under /r"]);
  const broken = await resolvePackagedEssayEdition({...answering({state: "broken", world_id: "w", root: "/r", reason: "the installed manifest differs from the one installed"}), transport: bridge});
  assert.equal(broken.state, "broken");
  assert.match(broken.unavailable, /broken: the installed manifest differs/);
  const noKernel = await resolvePackagedEssayEdition({transport: {kind: "unavailable", reason: "no kernel transport"}});
  assert.equal(noKernel.state, "unreachable");
  const refused = await resolvePackagedEssayEdition({transport: bridge, op: async () => ({outcome: null, error: "unreadable op: unknown variant `world_resolve`"})});
  assert.match(refused.unavailable, /could not resolve.*unknown variant/);
  const predates = await resolvePackagedEssayEdition({transport: bridge, op: async () => ({outcome: {result: "file_read", receipts: []}})});
  assert.match(predates.unavailable, /predates the World seam/);
  // an available answer missing what the adapter needs is not served either
  const partial = await resolvePackagedEssayEdition({...answering({...available, source_addressing: undefined}), transport: bridge});
  assert.match(partial.unavailable, /available/);
});

test("a configured edition keeps winning (the kernel is not asked); with none configured the installed World is", async () => {
  let asked = 0;
  const deps = {transport: bridge, op: async () => { asked++; return {outcome: {result: "world_resolve", receipts: [], resolution: available}}; }};
  globalThis.window = {__OI_ESSAY_EDITION__: "http://example.test/essay/", localStorage: {getItem: () => null}};
  try {
    assert.deepEqual(await resolveEssayEditionAsync(deps), {baseUrl: "http://example.test/essay/"});
    assert.equal(asked, 0);
    globalThis.window = {localStorage: {getItem: () => null}};
    const packaged = await resolveEssayEditionAsync(deps);
    assert.equal(asked, 1);
    assert.equal(packaged.pageFiles, true);
  } finally { delete globalThis.window; }
});

const root = process.env.OI_WORLDS_ROOT, bin = process.env.FIELD_BRIDGE_BIN ?? new URL("../kernel/target/debug/walk-bridge", import.meta.url).pathname;
test("the real walk bridge serves an installed World and the essay source reads the whole edition through it", {skip: root && existsSync(bin) ? false : "OI_WORLDS_ROOT (an installed World) and a walk-bridge binary are required"}, async () => {
  const port = 4300 + Math.floor(Math.random() * 500);
  const child = spawn(bin, [`127.0.0.1:${port}`], {env: {...process.env, OI_WORLDS_ROOT: root}, stdio: "ignore"});
  try {
    const url = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(`${url}/state`)).ok) break; } catch { /* not yet */ } await new Promise(r => setTimeout(r, 250)); }
    const edition = await resolvePackagedEssayEdition({transport: {kind: "bridge", url}});
    assert.ok(!("unavailable" in edition), JSON.stringify(edition));
    const source = createEssayFieldSource(edition);
    const standing = await source.standing();
    assert.equal(standing.state, "available", standing.reason);
    const index = await source.load();
    assert.equal(index.nodes.length, 1057);
    assert.ok(index.nodes.every(n => n.ref.startsWith("central:source:project:Antykathera-Essay-Work:submission-package/essay/") && /^sha256:/.test(n.revision)));
    const expressions = await source.expressions();
    assert.equal(expressions.entries.length, 135);
    assert.equal(source.expressionView(expressions.entries[0], undefined, "light"), null, "the package has no renderer page to frame");
    const texts = await source.searchText();
    assert.ok(texts.size > 1000);
    // an unlisted file and a traversal are refused by the host, through the same route
    const refused = await fetch(`${edition.baseUrl}../world.manifest.json`);
    assert.ok([403, 404].includes(refused.status), String(refused.status));
    assert.equal((await fetch(`${edition.baseUrl}nope.html`)).status, 404);
  } finally { child.kill(); }
});
