/**
 * corpus-return-of-zero — the REAL Return-of-Zero corpus enters the desktop
 * through the one public path (track-3 commission, 2026-09-19):
 *
 *   real essay sources (byte-exact, sha-verified against the corpus
 *   bindings) → native AIKit knowledge search → the bounded local whole
 *   projected as a live Expression → the corpus artifacts imported through
 *   the existing artifact import as saved, editable, reopenable kernel
 *   expressions → shared graph/page/Expression selection over exact native
 *   refs → source portals through the real host → an ExpressiveAct held,
 *   checkpointed and restored → currentness: a saved source change makes
 *   the recorded basis stale, detection names it, and an explicit rebase
 *   re-resolves (refusals for a stale expectation and a no-op) → the
 *   collections read through the files seam under the application's
 *   manifest law with full census membership → the Library lists the
 *   corpus collections and opens an exact source.
 *
 * No toy datasets: the sources and artifacts are byte-copies of the real
 * corpus at its accepted revision (EpiLogos/Antykathera-Essay-Work
 * `dbf3b17` sources; EpiLogos/Point-Cloud-Demo E0 artifacts), verified by
 * sha256 at setup. The temp ground is removed afterwards; nothing outside
 * it is written.
 */
import {setup as sourceSetup} from './editor.mjs';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, existsSync, readdirSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cradleRoot = resolve(here, '..', '..'); // walk/scenarios → desktop/cradle
const oiRoot = resolve(cradleRoot, '..', '..');
const essayRepo = join(oiRoot, 'Antykathera-Essay-Work');
const corpusRoot = resolve(oiRoot, '..', 'Point-Cloud-Demo', 'production', 'return-of-zero');

/** The representative slice — one artifact per corpus family, all six E0
 * workers covered. The full 52-artifact census rides at the collection
 * layer below; the slice proves the route, the manifests carry coverage. */
const SLICE = [
  'essay/roz-essay-reading.journey.json',
  'rooms/roz-room-02-return-of-zero.journey.json',
  'arguments-a/roz-a-arguments.journey.json',
  'conjugates-a-prime/roz-a-prime-conjugates.journey.json',
  'episteme/roz-c-concepts-1.journey.json',
  'matheme/roz-matheme-computation.journey.json',
  'symbolon/roz-symbolon-whole.journey.json',
  'mytheme/roz-mytheme-the-prisoner.journey.json',
];

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function listArtifacts(root, base = '') {
  const out = [];
  for (const entry of readdirSync(join(root, base), {withFileTypes: true})) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listArtifacts(root, rel));
    else if (entry.name.endsWith('.journey.json')) out.push(rel);
  }
  return out;
}

export async function setup() {
  // A dedicated isolated ground: one project (EssayCorpus) holding the real
  // corpus, no other registered projects — AIKit's project discovery walks
  // every registration, and a deleted registration aborts it (found here
  // the hard way: the editor fixture's removed projects emptied the wiki).
  const root = mkdtempSync(join(tmpdir(), 'oi-cradle-corpus-'));
  const home = mkdtempSync(join(tmpdir(), 'oi-cradle-corpus-home-'));
  const ctrlBin = process.env.OI_CENTRAL_CTRL_BIN ?? 'ctrl';
  const call = (action, input = {}) => {
    const r = JSON.parse(execFileSync(ctrlBin, ['--root', root, '--json', 'action', 'run', action, JSON.stringify(input)], {encoding: 'utf8'}));
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.data;
  };
  call('central.init');
    const projectRoot = join(root, 'Work', 'EssayCorpus');
    mkdirSync(projectRoot, {recursive: true});
    call('projectcentral.init', {project: 'EssayCorpus', project_id: 'essay-corpus-walk'});
    // The project's World declaration must exist before AIKit's knowledge
    // discovery reads central.world.effective-sources — the current ctrl
    // hard-refuses a missing world (world_declaration_absent), which empties
    // the SemanticWiki material (same record the knowledge walk saves).
    call('central.world-relations.save', {scope: 'root', record: {schema: 'central.world-relations/v1', ref: 'essay-corpus-walk', revision: 'walk-1', sources: []}});

    // The corpus bindings are the source of truth for source currentness.
    const bindings = new Map();
    for (const name of readdirSync(join(corpusRoot, 'bindings'))) {
      if (!name.endsWith('.binding.json')) continue;
      const binding = JSON.parse(readFileSync(join(corpusRoot, 'bindings', name), 'utf8'));
      if (binding.artifact) bindings.set(binding.artifact, binding);
    }

  // 1 — every corpus artifact + cover into the ground (the full census at
  // the collection layer), and the slice's real sources byte-verified.
  const artifacts = listArtifacts(corpusRoot);
  const groundBase = join(projectRoot, 'ProjectCentral', 'user', 'collections'); // manifests + members share one tree
  for (const rel of artifacts) {
    const dest = join(groundBase, rel);
    mkdirSync(dirname(dest), {recursive: true});
    copyFileSync(join(corpusRoot, rel), dest);
    const cover = join(corpusRoot, rel.replace(/\.journey\.json$/, '.cover.png'));
    if (existsSync(cover)) copyFileSync(cover, dest.replace(/\.journey\.json$/, '.cover.png'));
  }
  const sourceRecordCount = new Map(); // canonical path → sha256 (from bindings)
  const bindingMismatches = []; // named corpus defect: binding sha vs actual bytes
  const sliceDocs = [];
  for (const rel of SLICE) {
    const doc = JSON.parse(readFileSync(join(corpusRoot, rel), 'utf8'));
    sliceDocs.push({rel, id: doc.id, scenes: doc.scenes.length});
    const binding = bindings.get(rel);
    if (!binding) throw new Error(`no corpus binding for slice artifact ${rel}`);
    for (const record of binding.source_revision?.records ?? []) {
      const src = join(essayRepo, record.path);
      if (!existsSync(src)) throw new Error(`binding source missing from the essay repo: ${record.path}`);
      const actual = sha256(readFileSync(src));
      // The binding's claim is verified, never trusted: the actual bytes at
      // the accepted revision are what rides into the ground. A binding
      // whose recorded hash disagrees is a corpus defect (found 2026-09-19:
      // the E2 A/A′ bindings hashed pre-5c22906 content) and is NAMED in
      // the receipt — never silently accepted, never papered over.
      if (actual !== record.sha256) bindingMismatches.push({path: record.path, artifact: rel, binding_sha: record.sha256.slice(0, 16), actual_sha: actual.slice(0, 16)});
      sourceRecordCount.set(record.path, actual);
      // The project register discloses ProjectCentral/ paths, so the
      // canonical repo-relative path rides BELOW ProjectCentral/user/ —
      // the binding provenance keeps the true canonical origin.
      const dest = join(projectRoot, 'ProjectCentral', 'user', record.path);
      mkdirSync(dirname(dest), {recursive: true});
      copyFileSync(src, dest);
    }
  }

  // 2 — family collection manifests (the application's envelope law), full
  // membership, zero silent drops.
  const collectionsDir = join(projectRoot, 'ProjectCentral', 'user', 'collections');
  mkdirSync(collectionsDir, {recursive: true});
  const exported = new Date().toISOString();
  const families = new Map();
  for (const rel of artifacts) {
    const family = rel.split('/')[0];
    if (!families.has(family)) families.set(family, []);
    const doc = JSON.parse(readFileSync(join(groundBase, rel), 'utf8'));
    families.get(family).push({id: doc.id, name: doc.name ?? doc.id, file: rel});
  }
  const manifestNames = [];
  for (const [family, members] of families) {
    const manifest = {
      schema: 'oi.legacy-collections/v1',
      exported_at: exported,
      source: `Return-of-Zero Expression corpus (E0) — family ${family}`,
      provenance: {
        schema: 'oi.collection-provenance/v1',
        register: 'project',
        root: 'Work/EssayCorpus',
        paths: ['Work/EssayCorpus/ProjectCentral/user/collections'],
        ground: 'EpiLogos/Point-Cloud-Demo production/return-of-zero (E0 six-worker corpus) + EpiLogos/Antykathera-Essay-Work sources at dbf3b17',
        exported_at: exported,
        generator: {name: 'walk/scenarios/corpus-return-of-zero.mjs', revision: 'track3-2026-09-19'},
        source_revision: {repo: 'EpiLogos/Antykathera-Essay-Work', commit: 'dbf3b17'},
      },
      featured: members,
    };
    writeFileSync(join(collectionsDir, `${family}.manifest.json`), JSON.stringify(manifest, null, 2));
    manifestNames.push(`${family}.manifest.json`);
  }

  // 3 — the horizon must disclose the copied sources; the ROOM source is
  // the currentness subject of the whole walk.
  const horizon = call('projectcentral.change.horizon', {project: 'EssayCorpus'});
  const sources = horizon.sources;
  const roomSource = sources.find(s => s.binding.path.endsWith('section-rooms/02-return-of-zero/ROOM.md'));
  if (!roomSource) throw new Error(`the ROOM source never joined the horizon (${sources.length} sources disclosed)`);

  // 4 — real AIKit knowledge over the corpus ground.
  // OI_CENTRAL_CTRL_BIN pins AIKit's own ctrl discovery to an absolute path —
  // its PATH lookup of plain `ctrl` has been observed to fail intermittently
  // (mux.command_spawn_failed ENOENT), which drops the SemanticWiki provider
  // from a status read.
  const env = {OI_CENTRAL_ROOT: root, OI_HOME: home, OI_CENTRAL_PROJECT_QUERY: 'EssayCorpus',
    OI_CENTRAL_CTRL_BIN: process.env.OI_CENTRAL_CTRL_BIN ?? '/Users/admin/.local/bin/ctrl',
    AIKIT_HOME: join(root, '.aikit-home'), OI_AIKIT_BIN: process.env.OI_AIKIT_BIN ?? '/Users/admin/.local/bin/aikit'};
  const bound = JSON.parse(execFileSync(env.OI_AIKIT_BIN, ['--json', '-C', projectRoot, 'project', 'bind', 'essay-corpus-walk', '--directory', projectRoot, '--no-default-skill-sets'], {encoding: 'utf8', env, maxBuffer: 256 * 1024 * 1024}));
  if (!bound.ok) throw new Error(JSON.stringify(bound));
  let knowledgeStatus = JSON.parse(execFileSync(env.OI_AIKIT_BIN, ['--json', '-C', projectRoot, 'knowledge', 'status'], {encoding: 'utf8', env, maxBuffer: 256 * 1024 * 1024}));
  if (!knowledgeStatus.ok) throw new Error(JSON.stringify(knowledgeStatus));
  // Known AIKit flake (reported): its central-wiki discovery shells out to
  // `ctrl` and intermittently gets a spawn ENOENT, dropping the SemanticWiki
  // provider from one status read. One retry; the retry is named in data.
  if (JSON.stringify(knowledgeStatus.data).includes('SemanticWiki provider absent')) {
    const retry = JSON.parse(execFileSync(env.OI_AIKIT_BIN, ['--json', '-C', projectRoot, 'knowledge', 'status'], {encoding: 'utf8', env, maxBuffer: 256 * 1024 * 1024}));
    knowledgeStatus = {...retry, data: {...retry.data, aikit_status_retry: 'first read dropped the SemanticWiki provider (known ctrl-spawn flake)'}};
  }

  return {
    root, home, projectRoot, sources, roomSource, sliceDocs, manifestNames,
    corpusArtifactCount: artifacts.length,
    sourceRecordCount: sourceRecordCount.size,
    bindingMismatches,
    knowledgeStatus,
    env,
    call,
    cleanup: () => { rmSync(root, {recursive: true, force: true}); rmSync(home, {recursive: true, force: true}); },
  };
}

export default async function run({page, baseUrl, bridgeUrl, check, metric, shot, channel, provision: p}) {
  const op = async (opName, request) => {
    const response = await fetch(`${bridgeUrl}/op`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({op: opName, request})});
    const envelope = await response.json();
    if (!envelope.ok) throw new Error(JSON.stringify(envelope));
    return envelope.outcome?.data ?? envelope.outcome;
  };
  // Ops whose KernelOp variant carries inline fields (FilesList/FileRead)
  // post flat bodies; expression/expression_world nest their requests.
  const flatOp = async (body) => {
    const response = await fetch(`${bridgeUrl}/op`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
    const envelope = await response.json();
    if (!envelope.ok) throw new Error(JSON.stringify(envelope));
    const outcome = envelope.outcome ?? {};
    return outcome.directory ?? outcome.reading ?? outcome.data ?? outcome;
  };
  const expression = (request) => op('expression', request);
  const world = (request) => op('expression_world', request);
  const native = (...args) => JSON.parse(execFileSync(process.env.OI_AIKIT_BIN ?? '/Users/admin/.local/bin/aikit', ['--json', '-C', p.projectRoot, 'knowledge', ...args], {encoding: 'utf8', env: {...process.env, ...p.env}, maxBuffer: 256 * 1024 * 1024})).data;

  await page.goto(baseUrl);
  await channel('info');
  check(JSON.stringify(p.knowledgeStatus).includes('semantic-wiki'), 'The corpus ground reports the native SemanticWiki provider', p.knowledgeStatus);
  check(p.corpusArtifactCount === 52, 'The full 52-artifact corpus rode into the ground', p.corpusArtifactCount);
  check(p.sourceRecordCount > 0, 'Slice sources were copied as the actual accepted bytes', p.sourceRecordCount);
  check(p.bindingMismatches.length === 0 || p.bindingMismatches.every(m => m.artifact.includes('arguments') || m.artifact.includes('conjugates')),
    'Binding sha256s verified against actual bytes — every disagreement named (known E2 A/A′ defect, reported to the corpus owners)',
    {mismatch_count: p.bindingMismatches.length, sample: p.bindingMismatches.slice(0, 3)});

  const roomCentralPath = join('Work/EssayCorpus', p.roomSource.binding.path); // binding.path is already project-relative
  const roomDir = dirname(roomCentralPath);
  const roomListing = await flatOp({op: 'files_list', path: roomDir});
  const roomEntry = roomListing.entries.find(entry => entry.name === 'ROOM.md');
  const liveBefore = await flatOp({op: 'file_read', location: roomEntry.location});
  const liveRevisionBefore = liveBefore.revision;

  // A — source → knowledge → bounded local whole → Expression (real corpus).
  await page.keyboard.press('Meta+k');
  const overlay = page.getByRole('dialog', {name: 'Search Central'});
  await overlay.waitFor();
  // Source search matches path/identity tokens, not file contents, so the
  // term is the ROOM source's own file name.
  await overlay.getByRole('searchbox').fill('ROOM.md');
  await page.waitForFunction(() => document.querySelector('.search-aperture ul')?.getAttribute('aria-busy') === 'false', null, {timeout: 45000});
  const expected = native('search', 'ROOM.md').hits;
  check(expected.length > 0, 'Native AIKit search resolves the real corpus sources', {hits: expected.length});
  const roomIndex = expected.findIndex(hit => String(hit.resource).includes('ROOM.md'));
  check(roomIndex >= 0, 'The corpus ROOM source is addressable in native search', expected.map(h => h.resource).slice(0, 6));
  await overlay.locator('li').nth(roomIndex).getByRole('button').first().click();
  await page.getByRole('article', {name: 'Selected node content'}).waitFor({timeout: 45000});
  const focus = (await channel('read.focus')).data;
  check(focus.subject.ref === expected[roomIndex].resource, 'Opening the hit focuses the exact corpus source ref');
  const express = page.getByRole('button', {name: 'Express local whole', exact: true});
  await express.waitFor();
  await express.click();
  const status = page.locator('.knowledge-expression-controls [role="status"]').first();
  await status.waitFor({timeout: 45000});
  const statusText = await status.innerText();
  const match = statusText.match(/(\d+) subjects · (\d+) typed relations · Expression r(\d+)/);
  check(!!match, 'The corpus source’s bounded local whole projects through the Expression application', statusText);
  metric('corpus_subjects', Number(match?.[1] ?? 0));
  metric('corpus_relations', Number(match?.[2] ?? 0));
  check((await channel('read.stage')).data.presentations.some(item => item.id.startsWith('knowledge-expression:')), 'The corpus local whole is visible on the shared stage');
  await shot('corpus-local-whole');
  await page.getByRole('button', {name: 'Return to knowledge', exact: true}).click();

  // B — the slice imports through the existing artifact import path and
  // opens as ordinary saved kernel expressions.
  const server = await createServer({root: cradleRoot, appType: 'custom', server: {middlewareMode: true}, logLevel: 'error'});
  let artifactImport;
  try {
    artifactImport = await server.ssrLoadModule('/src/expression/artifactImport.ts');
  } finally {
    await server.close();
  }
  const imported = [];
  for (const slice of p.sliceDocs) {
    const artifact = JSON.parse(readFileSync(join(p.projectRoot, 'ProjectCentral', 'user', 'collections', slice.rel), 'utf8'));
    const ref = `expression:corpus-${slice.rel.split('/').pop().replace('.journey.json', '')}`;
    const converted = artifactImport.artifactToExpression(ref, artifact, slice.id);
    const opened = await expression({operation: 'open', document: converted.document, actor: 'agent:corpus-walk'});
    check(opened.document.expression_ref === ref && opened.document.revision === 1 && opened.document.scenes.length === slice.scenes,
      `Imported ${slice.rel} as a saved oi.expression/v1 document (${slice.scenes} scenes)`, {ref, scenes: opened.document.scenes.length});
    imported.push({ref, doc: opened.document});
  }
  metric('corpus_imported', imported.length);
  const list = await expression({operation: 'list'});
  check(p.sliceDocs.every(slice => (list.expressions ?? []).some(entry => entry.expression_ref === `expression:corpus-${slice.rel.split('/').pop().replace('.journey.json', '')}`)),
    'The kernel expression list carries every imported corpus expression', (list.expressions ?? []).length);

  // C — saved, editable, reopenable: a real edit advances the revision and
  // the re-read returns the same advanced document.
  const essay = imported.find(entry => entry.ref.endsWith('roz-essay-reading'));
  const edited = await expression({operation: 'edit', expression_ref: essay.ref, expected_revision: 1, actor: 'human:corpus-walk',
    changes: [{change: 'focus', scene_ref: essay.doc.scenes[1].scene_ref, entity_ref: null}]});
  check(edited.document.revision === 2, 'A focus edit on the corpus Expression advances its revision', edited.document.revision);
  const reread = await expression({operation: 'inspect', expression_ref: essay.ref});
  check(reread.document.revision === 2 && reread.document.selection.scene_ref === essay.doc.scenes[1].scene_ref, 'The re-read returns the saved edit (reopenable)', {revision: reread.document.revision});

  // D — shared graph/page/Expression selection over exact native refs.
  const room = imported.find(entry => entry.ref.endsWith('roz-room-02-return-of-zero'));
  const subjectRef = p.roomSource.binding.ref;
  const roomBinding = JSON.parse(readFileSync(join(corpusRoot, 'bindings', 'roz-room-02-return-of-zero.binding.json'), 'utf8'));
  const roomPathCanonical = p.roomSource.binding.path.replace(/^ProjectCentral\/user\//, ''); // horizon path → canonical repo-relative
  const roomRecord = roomBinding.source_revision.records.find(record => record.path === roomPathCanonical) ?? roomBinding.source_revision.records.find(record => roomPathCanonical.endsWith(record.path));
  const sourceRevisionToken = `dbf3b17:${roomRecord.sha256.slice(0, 16)}`;
  let revision = room.doc.revision;
  const boundEntity = Object.keys(room.doc.entities)[0];
  const subjectBound = await expression({operation: 'edit', expression_ref: room.ref, expected_revision: revision, actor: 'human:corpus-walk',
    changes: [{change: 'subject_bind', entity_ref: boundEntity, binding: {subject_ref: subjectRef, native_owner: 'central', presentation_role: 'thing',
      sources: [{ref: subjectRef, revision: sourceRevisionToken, availability: 'available'}], readings: [], actions: []}}]});
  revision = subjectBound.document.revision;
  const selection = await world({operation: 'selection_set', origin: 'graph', subject_ref: subjectRef, kind: 'source', native_owner: 'central', revision: sourceRevisionToken, activity_ref: null, expression_ref: room.ref});
  check(selection.state === 'selected' && selection.expression?.entity_ref === boundEntity, 'A graph-origin selection focuses the exact bound corpus entity', selection.state);
  const events = await (await fetch(`${bridgeUrl}/events?since=0`)).json();
  check((events.receipts ?? []).some(receipt => receipt.event === 'focus_changed' && JSON.stringify(receipt).includes(subjectRef)), 'The shared selection moves the one global focus to the corpus source');
  // The reciprocal focus picks an entity that actually lives in the target
  // scene — scene membership is the document's own law.
  const scene0Entities = room.doc.scenes[0].entity_refs ?? [];
  const otherEntity = scene0Entities.find(ref => ref !== boundEntity) ?? scene0Entities[0] ?? Object.keys(room.doc.entities)[1] ?? boundEntity;
  const focusScene = scene0Entities.length > 0 ? room.doc.scenes[0].scene_ref : room.doc.scenes.find(scene => (scene.entity_refs ?? []).includes(otherEntity))?.scene_ref ?? room.doc.scenes[0].scene_ref;
  const focused = await expression({operation: 'edit', expression_ref: room.ref, expected_revision: revision, actor: 'human:corpus-walk',
    changes: [{change: 'focus', scene_ref: focusScene, entity_ref: otherEntity}]});
  revision = focused.document.revision;
  const readBack = await world({operation: 'selection_read'});
  check(readBack.state === 'selected' && readBack.selection?.origin === 'expression', 'An Expression focus edit updates the same shared selection', readBack.selection?.origin);

  // E — source portals through the real host, over the real corpus source.
  const refused = await world({operation: 'portal_open', portal_ref: 'portal:corpus-refused', target_ref: 'central:source:absent-corpus-source', surface_kind: 'file', surface_id: 'surface:corpus-refused', placement: 'overlay', title: 'absent source', actor: 'agent:corpus-walk'});
  check(refused.state === 'unavailable_surface', 'A portal over an absent target names the refusal instead of fabricating a surface');
  const portal = await world({operation: 'portal_open', portal_ref: 'portal:corpus-room', target_ref: subjectRef, surface_kind: 'source', surface_id: 'surface:corpus-room', placement: 'detached', title: 'ROOM.md (Return of Zero)', actor: 'agent:corpus-walk'});
  check(portal.state === 'portal_open' && portal.portal?.target_ref === subjectRef, 'A portal opens detached over the exact corpus source ref', portal.state);
  const redocked = await world({operation: 'portal_redock', portal_ref: 'portal:corpus-room', actor: 'agent:corpus-walk'});
  check(redocked.state === 'portal_redocked', 'The corpus portal re-docks with its binding intact');
  await world({operation: 'portal_close', portal_ref: 'portal:corpus-room', actor: 'agent:corpus-walk'});

  // F — an ExpressiveAct over a real corpus entity: perform, hold,
  // checkpoint, restore through a revision advance.
  const act = await world({operation: 'act_perform', act_ref: 'act:corpus-1', expression_ref: room.ref, expected_revision: revision, summary: 'foreground the room opening', actor: 'agent:corpus-walk', activity_ref: 'activity:corpus-1',
    changes: [{change: 'parameter_set', entity_ref: boundEntity, parameter: 'scale', value: 1.3}]});
  check(act.state === 'act_running' && act.act?.basis_revision === revision, 'A structured act performs over the corpus Expression', act.state);
  const held = await world({operation: 'act_interrupt', act_ref: 'act:corpus-1', actor: 'human:corpus-walk', reason: 'owner holds the act'});
  check(held.state === 'act_held', 'Human interruption holds the act');
  await world({operation: 'act_checkpoint', act_ref: 'act:corpus-1', checkpoint_ref: 'checkpoint:corpus-1', actor: 'agent:corpus-walk'});
  revision = (await expression({operation: 'inspect', expression_ref: room.ref})).document.revision;
  const drifted = await expression({operation: 'edit', expression_ref: room.ref, expected_revision: revision, actor: 'human:corpus-walk',
    changes: [{change: 'parameter_set', entity_ref: boundEntity, parameter: 'scale', value: 2}]});
  revision = drifted.document.revision;
  const restored = await world({operation: 'act_restore', act_ref: 'act:corpus-1', checkpoint_ref: 'checkpoint:corpus-1', expected_revision: revision, actor: 'agent:corpus-walk'});
  check(restored.state === 'act_restored' && restored.expression?.document?.entities?.[boundEntity]?.parameters?.scale?.value === 1.3,
    'Checkpoint restore returns the exact corpus document through a revision advance');

  // G — currentness: a real saved source change makes the whole's recorded
  // basis (the live revision read at bind time) stale; detection names it;
  // rebase is explicit and refuses both a stale expectation and a no-op.
  const wholeRef = 'whole:corpus-room-02';
  const boundWhole = await world({operation: 'whole_bind', whole_ref: wholeRef, basis: {ref: subjectRef, revision: liveRevisionBefore, availability: 'available'},
    locus_ref: subjectRef, members: [{subject: {ref: subjectRef, revision: liveRevisionBefore, availability: 'available'}, native_owner: 'central'}],
    relations: [], expression_ref: room.ref, actor: 'agent:corpus-walk'});
  check(boundWhole.state === 'whole_bound', 'The corpus whole binds over the real live source revision', boundWhole.state);
  // mutate through the real owner write path (the editor's own seam)
  const currentBytes = (await flatOp({op: 'file_read', location: roomEntry.location})).content;
  await channel('invoke.source_open', [subjectRef]); // a buffer exists only after the source is opened
  const buffered = await channel('invoke.source_edit', [subjectRef, currentBytes + '\n\nAccepted upstream correction (corpus walk currentness probe).\n']);
  check(buffered.ok !== false, 'The corpus source buffer edit went through the editor seam', buffered.error);
  const saved = await channel('invoke.source_save', [subjectRef]);
  check(saved.ok !== false, 'The corpus source change saved through the real CAS write path', saved.error);
  const liveAfter = await flatOp({op: 'file_read', location: roomEntry.location});
  check(liveAfter.revision !== liveRevisionBefore, 'The saved source change advanced the owner revision (stale binding detected)', {before: liveRevisionBefore, after: liveAfter.revision});
  metric('recorded_basis', String(liveRevisionBefore).slice(0, 24));
  metric('live_revision_after', String(liveAfter.revision).slice(0, 24));
  const staleExpectation = await world({operation: 'whole_rebase', whole_ref: wholeRef, expected_basis_revision: 'revision-that-was-never-recorded',
    basis: {ref: subjectRef, revision: liveAfter.revision, availability: 'available'},
    members: [{subject: {ref: subjectRef, revision: liveAfter.revision, availability: 'available'}, native_owner: 'central'}], relations: [], actor: 'agent:corpus-walk'});
  check(staleExpectation.state === 'whole_basis_conflict', 'A rebase carrying a stale expectation is refused', staleExpectation.state);
  const noOp = await world({operation: 'whole_rebase', whole_ref: wholeRef, expected_basis_revision: liveRevisionBefore,
    basis: {ref: subjectRef, revision: liveRevisionBefore, availability: 'available'},
    members: [{subject: {ref: subjectRef, revision: liveRevisionBefore, availability: 'available'}, native_owner: 'central'}], relations: [], actor: 'agent:corpus-walk'});
  check(noOp.state === 'whole_unchanged', 'A no-op rebase is refused rather than silently accepted', noOp.state);
  const rebased = await world({operation: 'whole_rebase', whole_ref: wholeRef, expected_basis_revision: liveRevisionBefore,
    basis: {ref: subjectRef, revision: liveAfter.revision, availability: 'available'},
    members: [{subject: {ref: subjectRef, revision: liveAfter.revision, availability: 'available'}, native_owner: 'central'}], relations: [], actor: 'agent:corpus-walk'});
  check(rebased.state === 'whole_rebased', 'The explicit rebase re-resolves the whole to the fresh owner revision', rebased.state);
  const afterRebase = await expression({operation: 'inspect', expression_ref: room.ref});
  check(!!afterRebase.document.entities?.[boundEntity], 'The bound corpus entity ref survives the rebase unchanged');

  // H — the real UI: the compose surface lists the corpus expressions,
  // presents the room reading (with its bound subject) on the one Global
  // Expression Stage, the verso reads the bound subject/source, and the
  // front restores the same canvas.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('oi:expression-compose', {detail: {}})));
  const editor = page.getByRole('region', {name: 'Expression composition'});
  await editor.getByLabel('Open Expression').selectOption(room.ref);
  await page.waitForFunction((ref) => document.querySelector('[role="region"][aria-label="Expression composition"]')?.getAttribute('data-expression-ref') === ref, room.ref, {timeout: 20000}).catch(() => {});
  check(await editor.getAttribute('data-expression-ref') === room.ref, 'The compose surface addresses the corpus Expression by its exact ref');
  await editor.getByRole('button', {name: 'Present on stage'}).click();
  await page.locator('.expression-stage-host canvas').waitFor({timeout: 45000});
  const stage = (await channel('read.stage')).data;
  check(stage.presentations?.some(item => item.id === 'expression-application'), 'The corpus room reading presents through the one Global Expression Stage');
  await page.locator('.expression-stage-host canvas').evaluate(element => { element.dataset.corpusIdentity = 'one-canvas'; });
  await editor.getByRole('button', {name: 'Flip to verso'}).click();
  const verso = page.locator('.expression-verso');
  await verso.waitFor();
  check(await verso.getAttribute('data-expression-ref') === room.ref, 'The verso names the exact corpus expression ref');
  check(await verso.locator(`[data-subject-ref="${subjectRef}"]`).count() === 1, 'The verso reads the bound corpus subject with its native ref');
  check(await verso.locator(`[data-source-ref="${subjectRef}"]`).count() === 1, 'The verso discloses the exact source ref');
  await shot('corpus-verso');
  await editor.getByRole('button', {name: 'Return to front'}).click();
  await page.locator('.expression-stage-host canvas[data-corpus-identity]').waitFor();
  check(await page.locator('.expression-stage-host canvas').getAttribute('data-corpus-identity') === 'one-canvas', 'Front/verso reuse the same renderer canvas — no engine fork');
  await shot('corpus-front');

  // I — collections through the files seam under the application's law:
  // the cradle's collectionReadings module fed by the real bridge reads.
  const server2 = await createServer({root: cradleRoot, appType: 'custom', server: {middlewareMode: true}, logLevel: 'error'});
  let collectionModule;
  try {
    collectionModule = await server2.ssrLoadModule('/src/expressions/collectionReadings.ts');
  } finally {
    await server2.close();
  }
  const bridgeTransport = {kind: 'bridge', url: bridgeUrl};
  const manifestDirCentral = 'Work/EssayCorpus/ProjectCentral/user/collections';
  let totalMembers = 0;
  let manifestReadings = 0;
  const collectionFailures = [];
  for (const name of p.manifestNames) {
    const reading = await collectionModule.readCollection(bridgeTransport, `${manifestDirCentral}/${name}`);
    if (reading.status !== 'ready') {
      collectionFailures.push(`${name}: ${reading.message}`);
      continue;
    }
    manifestReadings += 1;
    totalMembers += reading.members.length;
    if (reading.errors.length > 0) collectionFailures.push(`${name}: ${reading.errors.length} member errors — ${reading.errors[0]?.message}`);
    const envelope = reading.envelope;
    if (envelope.provenance?.schema !== 'oi.collection-provenance/v1') collectionFailures.push(`${name}: provenance envelope missing`);
    for (const member of reading.members) {
      const doc = member.content;
      if (!doc || doc.schema !== 'oi.journey') collectionFailures.push(`${name}#${member.id}: member is not an oi.journey document`);
      if (!member.location?.ref) collectionFailures.push(`${name}#${member.id}: member carries no disclosed location`);
    }
  }
  check(manifestReadings === p.manifestNames.length && collectionFailures.length === 0,
    'Every corpus collection reads through the files seam under the manifest law with zero silent drops', collectionFailures);
  check(totalMembers === p.corpusArtifactCount, 'The collections carry the full census membership', {members: totalMembers, artifacts: p.corpusArtifactCount});
  metric('collection_members', totalMembers);

  // J — the Library lists the corpus collection members through the
  // Collections provider: enter the Technē mode (whose HUD carries the
  // Library summon), open the Library, switch to the Search presentation,
  // and read the corpus rows.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('oi:techne-summon', {detail: {kind: 'library'}})));
  await page.waitForSelector('.library-overlay:not([hidden])', {timeout: 20000});
  // The corpus members feed the providers, which the Search (gallery)
  // presentation renders as rows; switch out of the default BROWSE view.
  await page.locator('.library-overlay:not([hidden]) [data-view-choice="gallery"]').click();
  await page.getByRole('radio', {name: 'This instance'}).click();
  const sawCorpusColumn = await page.waitForFunction(() => {
    const rows = document.querySelectorAll('.library-overlay:not([hidden]) .lib-row');
    return Array.from(rows).some(row => (row.textContent ?? '').toLowerCase().includes('return of zero'));
  }, null, {timeout: 60000}).then(() => true, () => false);
  const diagnostics = await page.evaluate(() => {
    const overlay = document.querySelector('.library-overlay:not([hidden])');
    return {
      overlay: !!overlay,
      groups: Array.from(overlay?.querySelectorAll('[data-group-key]') ?? []).map(group => group.getAttribute('data-group-key')),
      totalRows: overlay?.querySelectorAll('.lib-row').length ?? 0,
      columnSample: (overlay?.textContent ?? '').slice(0, 400),
      viewState: Array.from(overlay?.querySelectorAll('.lib-view [role="radio"]') ?? []).map(radio => `${radio.getAttribute('data-view-choice')}:${radio.getAttribute('aria-checked')}`),
    searchText: overlay?.querySelector('.lib-search')?.value ?? null,
      coverage: Array.from(overlay?.querySelectorAll('.lib-coverage-line') ?? []).map(line => line.textContent?.slice(0, 120)),
    };
  });
  const corpusRows = await page.evaluate(() => Array.from(document.querySelectorAll('.library-overlay:not([hidden]) .lib-row')).map(row => row.textContent).filter(text => text && text.toLowerCase().includes('return of zero')));
  check(corpusRows.length > 0, 'The Library lists the corpus collection members through the Collections provider', {corpusRows: corpusRows.slice(0, 3), ...diagnostics});
  await page.locator('.library-scrim').click({position: {x: 24, y: 24}});
  await shot('corpus-library');
}
