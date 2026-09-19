// collection-manifest-probe — the collections/library refit manifest proof
// (landing lane N; gaps D1 + D3 of the E4 row).
//
// (1) THE ENVELOPE LAW (D1), node-side, against the REAL regenerated export:
//     legacy-collections/manifest.json carries the oi.collection-provenance/v1
//     envelope (register/root, paths, ground, exported-at, generator+revision);
//     an OLD manifest (pre-envelope) still validates and imports; an envelope
//     this build does not know is carried verbatim, never rejected; a journey
//     carrying an unknown additive envelope still passes validateJourney.
// (2) COLLECTION IMPORT SEMANTICS (D3), node-side: importing the manifest
//     restores it AS A COLLECTION — full membership in manifest order, zero
 //    silent drops; a member that cannot be read is a NAMED error beside the
//     members that returned; the default collection (oi-mark, Day/Night) and
//     its variant stay RETAINED, never flattened into the legacy export.
// (3) THE CRADLE BRIDGE over the standing dev server: the Expressions centre
//     serves the freshly built dist through the files seam and opens the
//     retained default (Day/Night); src/expressions/collectionReadings.ts
//     reads a REAL Central manifest path through the seam (members in
//     manifest order, provenance disclosed), the pure core is fed
//     identically by the walk kernel_op relay, and a nonexistent path is a
//     named absence — never a throwaway error.
//
// Usage: node walk/collection-manifest-probe.mjs   (attaches to DESK_URL,
// default http://localhost:1421/ — the standing dev server; spawns its own
// kernel walk-bridge on COLLECTION_BRIDGE_PORT, default 4197).
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cradleRoot = resolve(here, '..');
const appRoot = join(cradleRoot, 'expressions-app');
const collectionsDir = join(appRoot, 'legacy-collections');
const artifactsDir = join(here, 'artifacts');
const deskUrl = process.env.DESK_URL ?? 'http://localhost:1421/';
const bridgePort = process.env.COLLECTION_BRIDGE_PORT ?? '4197';
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
const MANIFEST_PATH = 'Work/O-I/desktop/cradle/expressions-app/legacy-collections/manifest.json';

const fails = [];
const fail = (step, detail) => { console.log(`FAIL ${step}: ${detail}`); fails.push(step); };
const ok = (step, detail = '') => console.log(`ok — ${step}${detail ? ` · ${detail}` : ''}`);
const assert = (condition, step, detail = '') => { if (condition) ok(step, detail); else fail(step, detail); };

// ---------------------------------------------------------------------------
// (1) The envelope law (D1) and (2) collection import semantics (D3) — node.
const model = await import(join(appRoot, 'field-studies-journeys/build/model.js'));
const collectionManifest = await import(join(appRoot, 'field-studies-journeys/build/collectionManifest.js'));
const expressions = await import(join(appRoot, 'field-studies-journeys/build/expressions.js'));
const {validateCollectionManifest, collectionMembership, validateJourney, oiMark, COLLECTION_PROVENANCE_SCHEMA} = model;
const {importCollectionManifest} = collectionManifest;
const {featuredExpressions} = expressions;

const manifestRaw = JSON.parse(fs.readFileSync(join(collectionsDir, 'manifest.json'), 'utf8'));
let manifest, membership;
try {
  manifest = validateCollectionManifest(manifestRaw);
  membership = collectionMembership(manifest);
  assert(true, 'the regenerated manifest validates under the envelope law', `${manifest.schema}, ${membership.length} members`);
} catch (cause) {
  fail('the regenerated manifest validates', cause instanceof Error ? cause.message : String(cause));
  process.exit(1);
}

const p = manifest.provenance;
assert(!!p && p.schema === COLLECTION_PROVENANCE_SCHEMA, 'the manifest carries the provenance envelope', String(p?.schema));
assert(p?.register === 'project' && p?.root === 'Work/O-I', 'the envelope names register and root', `${p?.register} / ${p?.root}`);
assert(Array.isArray(p?.paths) && p.paths.includes('Work/O-I/desktop/cradle/expressions-app/legacy-collections'), 'the envelope names its Central path(s)', JSON.stringify(p?.paths));
assert(typeof p?.ground === 'string' && p.ground.includes('field-studies-journeys'), 'the envelope names the ground it was read from', String(p?.ground).slice(0, 60) + '…');
assert(!Number.isNaN(Date.parse(p?.exported_at ?? 'x')) && !Number.isNaN(Date.parse(manifest.exported_at ?? 'x')), 'the envelope and manifest carry exported-at civil dates', String(p?.exported_at));
assert(typeof p?.generator?.name === 'string' && typeof p?.generator?.revision === 'string', 'the envelope names the generator and its revision', `${p?.generator?.name} @ ${p?.generator?.revision}`);

const readMemberFromDisk = async (entry) => JSON.parse(fs.readFileSync(join(collectionsDir, entry.file), 'utf8'));
const roundTrip = await importCollectionManifest(manifestRaw, readMemberFromDisk);
assert(roundTrip.collection.restored === membership.length && roundTrip.collection.failed === 0 && roundTrip.errors.length === 0,
  'the round-trip restores the collection with full membership and zero silent drops', `${roundTrip.collection.restored}/${membership.length} restored, ${roundTrip.collection.failed} failed`);
assert(roundTrip.members.map((m) => m.entry.file).join() === membership.map((e) => e.file).join(),
  'membership order survives the round-trip intact', `featured ${manifest.featured.length} then starters ${manifest.starters.length}, in listed order`);
assert(roundTrip.members.every((m) => validateJourney(m.journey).id === m.entry.id), 'every restored member validates as an oi.journey and keeps its identity');
assert(roundTrip.collection.provenance_known === true, 'the import discloses the provenance envelope as known');

const oldManifest = structuredClone(manifestRaw);
delete oldManifest.provenance;
const oldImport = await importCollectionManifest(oldManifest, readMemberFromDisk);
assert(oldImport.collection.restored === membership.length && oldImport.errors.length === 0 && oldImport.collection.provenance === null,
  'an OLD manifest (pre-envelope) still validates and imports', `${oldImport.collection.restored} restored, provenance ${JSON.stringify(oldImport.collection.provenance)}`);

const futureManifest = structuredClone(manifestRaw);
futureManifest.provenance = {schema: 'oi.collection-provenance/v9-does-not-exist-yet', note: 'an envelope this build does not know'};
const futureImport = await importCollectionManifest(futureManifest, readMemberFromDisk);
assert(futureImport.collection.restored === membership.length && JSON.stringify(futureImport.collection.provenance) === JSON.stringify(futureManifest.provenance) && futureImport.collection.provenance_known === false,
  'an unknown envelope is carried verbatim, never rejected, and disclosed as unknown');

const envelopedJourney = oiMark();
envelopedJourney.someUnknownEnvelope = {schema: 'oi.something-future/v1', facts: {kept: true}};
let keptEnvelope = null;
try { keptEnvelope = validateJourney(envelopedJourney).someUnknownEnvelope ?? null; } catch { keptEnvelope = null; }
assert(keptEnvelope?.schema === 'oi.something-future/v1', 'validateJourney still accepts additive envelopes it does not know', 'the unknown envelope rides through validation untouched');

const absentName = manifest.starters[0].file;
const absentImport = await importCollectionManifest(manifestRaw, async (entry) => {
  if (entry.file === absentName) throw new Error(`member file absent from the reading: ${entry.file}`);
  return readMemberFromDisk(entry);
});
assert(absentImport.collection.restored === membership.length - 1 && absentImport.errors.length === 1
  && absentImport.errors[0].file === absentName && /absent/.test(absentImport.errors[0].message)
  && absentImport.collection.restored + absentImport.collection.failed === membership.length,
  'a member that cannot be read is a NAMED error, never silently dropped', `${absentImport.errors[0].id} @ slot ${absentImport.errors[0].slot}: ${absentImport.errors[0].message}`);

const mark = oiMark();
assert(mark.id === 'oi-mark' && mark.scenes.map((s) => s.name).join() === 'Day,Night'
  && mark.scenes.every((s) => s.entities.map((e) => e.text).join('') === 'OI')
  && mark.scenes[0].field.background === '#f4f2eb' && mark.scenes[1].field.background === '#1d231f',
  'the default expression is retained: oi-mark, Day/Night, the light/dark variant intact');
assert(featuredExpressions()[0].id === 'oi-mark' && !membership.some((e) => e.id === 'oi-mark' || e.id === 'source-twelve-faces')
  && (manifest.retained_non_legacy ?? []).map((r) => r.id).join() === 'oi-mark,source-twelve-faces',
  'the default collection and the Epii face stay OUT of the legacy export, retained in the app', `retained_non_legacy: ${(manifest.retained_non_legacy ?? []).map((r) => r.id).join(', ')}`);

// ---------------------------------------------------------------------------
// (3) The cradle bridge over the standing dev server.
let bridge = null;
let browser = null;
try {
  bridge = spawn('cargo', ['run', '--quiet', '--manifest-path', join(cradleRoot, 'kernel/Cargo.toml'), '--bin', 'walk-bridge', '--', `127.0.0.1:${bridgePort}`], {stdio: ['ignore', 'pipe', 'pipe']});
  bridge.stderr.on('data', (chunk) => process.stderr.write(chunk));
  const started = Date.now();
  let up = false;
  while (Date.now() - started < 240_000) {
    try { if ((await fetch(`${bridgeUrl}/state`)).ok) { up = true; break; } } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) throw new Error('the kernel walk-bridge did not come up');
  ok('the kernel walk-bridge is up', `${bridgeUrl} (${Math.round((Date.now() - started) / 1000)}s)`);

  browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript((bridge) => {
    try {
      window.__OI_KERNEL_BRIDGE__ = bridge;
      sessionStorage.setItem('oi-cradle.welcome.v1', 'probe');
      localStorage.setItem('oi-cradle.welcome.v1', 'probe');
    } catch {}
  }, bridgeUrl);
  await page.goto(deskUrl);
  await page.waitForSelector('.desktop-shell', {timeout: 20000});
  ok('the standing dev server serves the cradle shell', deskUrl);

  // The collection-readings bridge over a REAL Central path, through the files seam.
  const reading = await page.evaluate(async (manifestPath) => {
    const module = await import('/src/expressions/collectionReadings.ts');
    const read = await module.readCollection({kind: 'bridge', url: window.__OI_KERNEL_BRIDGE__}, manifestPath);
    return {
      status: read.status,
      manifest_path: read.manifest_path,
      provenance: read.status === 'ready' ? read.envelope.provenance : null,
      member_count: read.status === 'ready' ? read.members.length : 0,
      error_count: read.status === 'ready' ? read.errors.length : 0,
      order: read.status === 'ready' ? read.members.map((m) => m.file) : [],
      first: read.status === 'ready' ? {id: read.members[0]?.id, name: read.members[0]?.name, group: read.members[0]?.group} : null,
      message: read.status === 'ready' ? null : read.message,
    };
  }, MANIFEST_PATH).catch((cause) => ({status: 'probe-threw', message: String(cause)}));

  assert(reading.status === 'ready', 'the bridge reads the REAL Central manifest through the files seam', `${reading.manifest_path ?? MANIFEST_PATH} → ${reading.status}${reading.message ? ` (${reading.message})` : ''}`);
  if (reading.status === 'ready') {
    assert(reading.member_count === membership.length && reading.error_count === 0, 'the reading carries every member with no errors', `${reading.member_count} members, ${reading.error_count} errors`);
    assert(reading.order.join() === membership.map((e) => e.file).join(), 'the reading keeps manifest order end to end');
    assert(reading.provenance?.schema === COLLECTION_PROVENANCE_SCHEMA && reading.provenance?.register === 'project', 'the reading discloses the provenance envelope', `${reading.provenance?.schema}, register ${reading.provenance?.register}`);
    assert(reading.first?.id === manifest.featured[0].id, 'the first member is the first featured expression', `${reading.first?.id} (${reading.first?.group})`);
    fs.writeFileSync(join(artifactsDir, 'collection-manifest-reading.json'), JSON.stringify({manifest_path: reading.manifest_path, provenance: reading.provenance, members: reading.member_count, errors: reading.error_count, first: reading.first}, null, 2) + '\n');
  }

  // The pure core fed by the walk relay (the host→frame relay shape): the
  // same manifest text + kernel_op file_read as the member reader must give
  // the same reading as the direct files-seam call.
  const relayReading = await page.evaluate(async (manifestPath) => {
    const module = await import('/src/expressions/collectionReadings.ts');
    const walk = window.__cradle?.walk;
    if (!walk) throw new Error('the walk channel is not mounted');
    const cut = manifestPath.lastIndexOf('/');
    const dir = manifestPath.slice(0, cut), name = manifestPath.slice(cut + 1);
    const list = await walk.invoke.kernel_op({op: 'files_list', path: dir});
    const entry = (list.data?.outcome ?? list.outcome)?.directory?.entries?.find((e) => e.name === name);
    if (!entry) throw new Error('relay: manifest not listed');
    const read = await walk.invoke.kernel_op({op: 'file_read', location: entry.location});
    const manifestText = (read.data?.outcome ?? read.outcome)?.reading?.content ?? '';
    return module.assembleCollectionReading(manifestPath, manifestText, async (file) => {
      const memberCut = file.lastIndexOf('/');
      const memberList = await walk.invoke.kernel_op({op: 'files_list', path: `${dir}/${file.slice(0, memberCut)}`});
      const memberEntry = (memberList.data?.outcome ?? memberList.outcome)?.directory?.entries?.find((e) => e.name === file.slice(memberCut + 1));
      if (!memberEntry) throw new Error(`relay: member not listed: ${file}`);
      const memberRead = await walk.invoke.kernel_op({op: 'file_read', location: memberEntry.location});
      return JSON.parse(((memberRead.data?.outcome ?? memberRead.outcome)?.reading?.content ?? '{}'));
    });
  }, MANIFEST_PATH).catch((cause) => ({status: 'probe-threw', message: String(cause)}));
  if (relayReading.status !== 'ready') fail('the pure core is fed identically by the walk relay', `relay reading: ${relayReading.status} · ${relayReading.message}`);
  else assert(relayReading.members?.length === membership.length && relayReading.errors?.length === 0,
    'the pure core is fed identically by the walk relay', `relay reading: ${relayReading.status}, ${relayReading.members?.length ?? 0} members`);

  // The honest absent state for a nonexistent path.
  const absent = await page.evaluate(async () => {
    const module = await import('/src/expressions/collectionReadings.ts');
    return module.readCollection({kind: 'bridge', url: window.__OI_KERNEL_BRIDGE__}, 'Work/O-I/desktop/cradle/expressions-app/legacy-collections/manifest-absent.json');
  }).catch((cause) => ({status: 'probe-threw', message: String(cause)}));
  assert(absent.status === 'manifest-absent' && typeof absent.message === 'string' && absent.message.includes('manifest-absent.json'),
    'a nonexistent manifest is a named absence', absent.message ?? JSON.stringify(absent));

  // The hosted Expressions centre: the freshly built dist serves through the
  // seam and opens the RETAINED default (Day/Night) — undisturbed.
  await page.locator('.world-mode-strip [data-mode="expressions"]').click();
  await page.waitForSelector('.pcd-host[data-state="ready"]', {timeout: 30000});
  const appFrame = page.frames().find((f) => f !== page.mainFrame());
  if (!appFrame) fail('the hosted Expressions centre', 'no child frame stood up');
  else {
    await appFrame.waitForFunction(() => window.__FIELD_STUDIES__, {timeout: 30000}).catch(() => {});
    const doc = await appFrame.evaluate(() => window.__FIELD_STUDIES__?.getDocument?.() ?? null).catch(() => null);
    assert(!!doc && doc.id === 'oi-mark' && doc.scenes.map((s) => s.name).join() === 'Day,Night',
      'the hosted app opens the retained default: oi-mark Day/Night', doc ? `${doc.id}: ${doc.scenes.map((s) => s.name).join(', ')} (served from the regenerated dist)` : 'the hosted app did not expose its document in time');
  }
  await page.waitForTimeout(1200);
  await page.screenshot({path: join(artifactsDir, 'collection-manifest-probe.png')});
  ok('screenshot artifact', 'walk/artifacts/collection-manifest-probe.png');
  if (errors.length) fail('the host page is quiet', errors.slice(0, 4).join(' | '));
  else ok('the host page is quiet');
} catch (cause) {
  fail('the cradle bridge act', cause instanceof Error ? cause.message : String(cause));
} finally {
  await browser?.close();
  bridge?.kill();
}

console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL OK');
process.exit(fails.length ? 1 : 0);
