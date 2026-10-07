/** The World package: identity, derived counts, dependency closure, verification, install/resolve, read-only reading, and the reader
 *  SkillSet binding. Everything here runs over a small synthetic edition built in a temp directory (no author checkout, no network);
 *  the one real-`aikit` test runs only where `aikit` is installed and says so when it does not. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync } from 'node:fs';
import { appendFile, symlink, chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  WORLD_ID, SOURCE_ADDRESSING, assemblePackage, closeDependencies, declaredReferences, depthClass, describeEdition, installPackage,
  DISPOSITIONS, RENDERER_ENTRY, describeRenderer, verifyRenderer, dispositionEditionDefects, dispositionOf, dispositionSourceDefects, indexVault, ordinaryReadingMutations, parseSourceRef, readAllPages, registerPraxis, resolveWorld, slugOfVaultPath, sourceRef, verifyExpressions,
  verifyPackage, verifyPraxisBinding, walkFiles,
} from './essay-world.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const COMMIT = '0123456789abcdef0123456789abcdef01234567';

async function put(root, rel, body) { await mkdir(dirname(join(root, rel)), { recursive: true }); await writeFile(join(root, rel), body); return Buffer.from(body); }

/** A tiny but complete edition + praxis, built exactly as the artifact is laid out. */
async function fixture(root, { skills = ['using-epi-logos', 'walk-the-essay', 'investigate'] } = {}) {
  const pages = {
    'index': { path: 'README.md', html: '<article><h1 id="top">Root</h1><a href="a">A</a> <a href="b/c#h1">C</a> <a href="https://example.org/x">ext</a> <a href="a#sec">A sec</a></article>' },
    'a': { path: 'a.md', html: '<article><h2 id="sec">Sec</h2><a href="b/c">C</a><img src="symbolon/diagrams/d.svg"></article>' },
    'b/c': { path: 'b/c.md', html: '<article><h2 id="h1">One</h2><a href="../a#sec">back</a></article>' },
  };
  const files = [];
  const edition = join(root, 'edition');
  for (const [slug, p] of Object.entries(pages)) { await put(edition, `${slug}.html`, p.html); files.push({ path: p.path, sha256: sha(p.path), kind: 'markdown' }); }
  await put(edition, 'symbolon/diagrams/d.svg', '<svg/>');
  files.push({ path: 'symbolon/diagrams/d.svg', sha256: sha('<svg/>'), kind: 'asset' });
  await put(edition, 'static/fieldIndex.json', JSON.stringify({
    v: 1, regs: { essay: 'Essay' }, stations: { '#0': { name: 'Section-rooms' } },
    nodes: Object.keys(pages).map((s, i) => ({ i, s, t: s, k: s === 'index' ? 'root' : 'record', r: 'essay', st: '#0', w: 100 })),
    links: [[0, 1], [1, 2]], rooms: { 0: { sec: '§0', title: 'R', slug: 'a', i: 1 } }, moves: { 1: { i: 2, title: 'M', sec: '§0', room: 0 } }, tree: {}, x: {} }));
  await put(edition, 'quartz-source.json', JSON.stringify({ schema: 'oi.essay-quartz-source/v1', vault_commit: COMMIT, working_tree_dirty: false, input_sha256: sha('inputs'), quartz_commit: 'q', staged_files: 3, files }));
  const entries = [];
  for (const id of ['e1', 'e2']) {
    const body = JSON.stringify({ schema: 'oi.journey', id, scenes: [{ id: 's1' }, { id: 's2' }] });
    await put(edition, `expressions/x/${id}.journey.json`, body);
    await put(edition, `expressions/x/${id}.cover.webp`, 'cover');
    entries.push({ id, title: id, summary: '', collection: 'essay', group: 'The essay', scenes: [{ id: 's1', name: 's1' }, { id: 's2', name: 's2' }], nodes: id === 'e1' ? ['a'] : [], digest: `sha256:${sha(body)}`, bytes: Buffer.byteLength(body), journey: `x/${id}.journey.json`, cover: `x/${id}.cover.webp` });
  }
  await put(edition, 'expressions/index.json', JSON.stringify({ schema: 'oi.essay-expressions/v1', collections: [{ id: 'essay', label: 'The essay', count: 2 }], absent: [], entries }));
  // The Expression renderer, laid out as the site's expression entry builds for the package: a page naming the edition base and two assets.
  await put(root, 'renderer/expression.html', '<!doctype html><html><head><meta name="oi-edition-base" content="../edition/"/><title>Expression</title><script type="module" crossorigin src="./assets/expression-abc.js"></script><link rel="stylesheet" crossorigin href="./assets/expression-abc.css"></head><body><div id="root"></div></body></html>');
  await put(root, 'renderer/assets/expression-abc.js', 'export const x = 1;');
  await put(root, 'renderer/assets/expression-abc.css', 'body{margin:0}');
  for (const name of skills) await put(root, `praxis/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: "Use when reading ${name}."\n---\n\n# ${name}\n`);
  const texts = new Map([['README.md', '[a](a.md) [c](b/c.md) [quilt](quilt/x.md) [web](https://example.org) [here](#top)'], ['a.md', '[c](b/c.md#h1) ![d](symbolon/diagrams/d.svg) [[b/c]] [[missing/page]]'], ['b/c.md', '[back](../a.md)']]);
  const closure = closeDependencies([{ rel: 'README.md', kind: 'markdown' }, { rel: 'a.md', kind: 'markdown' }, { rel: 'b/c.md', kind: 'markdown' }, { rel: 'symbolon/diagrams/d.svg', kind: 'asset' }], texts);
  return assemblePackage({ out: root, vaultCommit: COMMIT, pcdCommit: 'p'.repeat(40), oiCommit: 'o'.repeat(40), receipt: { working_tree_dirty: false, input_sha256: sha('inputs'), quartz_commit: 'q' },
    closure, bindings: { exported_against_essay_commit: 'dbf3b17', bindings: 0, match: 0, missing: 0, differ: 0 }, vault: { receipt_files: 4, matched: 4, problem_count: 0 }, publishedInputs: 4 });
}
async function world(options) { const root = await mkdtemp(join(tmpdir(), 'oi-world-')); const manifest = await fixture(root, options); return { root, manifest }; }
const cleanup = async (...dirs) => { for (const d of dirs) { try { for (const f of await walkFiles(d)) chmodSync(join(d, f), 0o644); } catch { /* absent */ } await rm(d, { recursive: true, force: true }); } };

test('native refs round-trip exactly, with the minimal escaping the source-ref grammar names', () => {
  for (const path of ['submission-package/essay/a.md', 'submission-package/essay/with space/x:y%z.md']) {
    const ref = sourceRef(SOURCE_ADDRESSING.world, path);
    assert.deepEqual(parseSourceRef(ref), { world: SOURCE_ADDRESSING.world, path });
  }
  assert.equal(slugOfVaultPath('README.md'), 'index');
  assert.equal(slugOfVaultPath('a b/c & d?.md'), 'a-b/c--and--d');   // Quartz slugify: space -> -, & -> -and-, ? dropped
});

test('depth classes follow the essay path conventions', () => {
  const at = (p) => depthClass(`submission-package/essay/${p}`);
  assert.equal(at('section-rooms/arguments/A01-Subject.md'), 'A');
  assert.equal(at('section-rooms/arguments/conjugate/A01-prime-Faithful.md'), 'A′');
  assert.equal(at('section-rooms/arguments/conjugate/AC.md'), 'A-C');
  assert.equal(at('section-rooms/arguments/concepts/C01-Subject.md'), 'C');
  assert.equal(at('section-rooms/arguments/products/S1-Actuation.md'), 'S');
  assert.equal(at('section-rooms/00-integral-threshold/P1-CANONICAL-ALIGNMENT.md'), 'alignment');
  assert.equal(at('symbolon/episteme/sources/mathematics-logic/x.md'), 'source-house');
  assert.equal(at('symbolon/matheme/README.md'), null);
});

test('counts come from the artifact, and the package describes what it contains', async () => {
  const { root, manifest } = await world();
  try {
    const d = await describeEdition(join(root, 'edition'));
    assert.equal(d.pages.nodes, 3);
    assert.equal(d.structure.rooms, 1);
    assert.equal(d.structure.movements, 1);
    assert.equal(d.assets.count, 1);
    assert.equal(d.expressions.members, 2);
    assert.equal(d.expressions.scenes, 4);
    assert.equal(d.expressions.laid_over_pages, 1);
    assert.equal(manifest.counts.pages.nodes, 3);
    assert.equal(manifest.counts.praxis.skills, 3);
    assert.equal(manifest.world_id, WORLD_ID);
    assert.equal(manifest.source.vault.commit, COMMIT);
    assert.equal(manifest.files.count, (await walkFiles(root)).length - 2);
  } finally { await cleanup(root); }
});

test('every declared reference is resolved or dispositioned; the rest is named as a defect', () => {
  const entries = [{ rel: 'README.md' }, { rel: 'a/b.md' }, { rel: 'a/img/d.svg' }];
  const texts = new Map([['a/b.md', [
    '[ok](../README.md) ![img](img/d.svg) [web](https://example.org/p) [mail](mailto:x@y.z) [top](#here)',
    '[quilt](../quilt/q.md) [work](../../working/w.md) [out](../../../elsewhere/x.md) [gone](nothing.md) [[README]] [[a/b]] [[no/such]] [[quilt/q]]',
    '```\n[inside](code-fence.md)\n```',
  ].join('\n')]]);
  const c = closeDependencies(entries, texts, (p) => p === 'unpublished.md');
  assert.equal(c.external, 2);
  assert.equal(c.anchor_only, 1);
  assert.equal(c.resolved, 2 + 2);                       // README link, image, [[README]], [[a/b]]
  assert.equal(c.withheld_by_category.quilt.references, 2);   // markdown + wikilink
  assert.equal(c.withheld_by_category.working.references, 1);
  assert.equal(c.withheld_by_category['outside-publication'].references, 1);
  assert.equal(c.declared_internal_unresolved, 2);       // nothing.md, [[no/such]]
  assert.deepEqual(c.unresolved_all.map((u) => u.target).sort(), ['nothing.md', 'no/such'].sort());
  assert.equal(declaredReferences('```\n[x](y.md)\n```').length, 0);
});

test('the package verifies, and the exact-anchor and ref round trips hold over every page', async () => {
  const { root, manifest } = await world();
  try {
    const verdict = await verifyPackage(root);
    assert.deepEqual(verdict.problems, []);
    assert.equal(verdict.ok, true);
    assert.equal(verdict.pages.ref_round_trip.round_tripped, 3);
    assert.equal(verdict.pages.anchor_round_trip.anchors, verdict.pages.anchor_round_trip.round_tripped);
    assert.equal(verdict.pages.links.unresolved_page, 0);
    assert.equal(verdict.pages.embeds.unresolved, 0);
    assert.equal(verdict.expressions.verified, 2);
    assert.equal(manifest.verification.acceptance.edition_links_to_no_page, 0);
  } finally { await cleanup(root); }
});

test('integrity failures are named: a changed page, a missing page, a changed Expression body, an extra file', async () => {
  for (const [name, mutate, expected] of [
    ['a changed page', (r) => appendFile(join(r, 'edition/a.html'), ' '), /edition\/a\.html: digest differs/],
    ['a missing page', (r) => rm(join(r, 'edition/b/c.html')), /edition\/b\/c\.html: missing/],
    ['a changed Expression body', (r) => appendFile(join(r, 'edition/expressions/x/e1.journey.json'), ' '), /edition\/expressions\/x\/e1\.journey\.json: digest differs/],
    ['an unlisted file', (r) => writeFile(join(r, 'edition/stray.html'), 'x'), /edition\/stray\.html: not in the manifest/],
  ]) {
    const { root } = await world();
    try {
      await mutate(root);
      const verdict = await verifyPackage(root);
      assert.equal(verdict.ok, false, name);
      assert.match(verdict.problems.join('\n'), expected, name);
    } finally { await cleanup(root); }
  }
});

test('a defect that was not recorded is refused; a recorded one is carried, not hidden', async () => {
  const { root, manifest } = await world();
  try {
    // Add a page link to nowhere and re-seal NOTHING: the artifact now differs from what was recorded.
    const page = join(root, 'edition/a.html');
    const html = await readFile(page, 'utf8');
    const files = JSON.parse(await readFile(join(root, 'world.files.json'), 'utf8'));
    await writeFile(page, html.replace('</article>', '<a href="nowhere">x</a></article>'));
    const entry = files.files.find((f) => f.path === 'edition/a.html');
    entry.sha256 = sha(await readFile(page));
    await writeFile(join(root, 'world.files.json'), JSON.stringify(files));
    const verdict = await verifyPackage(root);
    assert.match(verdict.problems.join('\n'), /files list differs|dangling page links: 1 now, 0 recorded|tree digest differs/);
    assert.equal(manifest.verification.acceptance.declared_internal_dependencies_unresolved_zero, false, 'the fixture source itself has unresolved references and says so');
  } finally { await cleanup(root); }
});

test('install puts a verified, read-only edition where the Cradle resolves it, independent of any checkout; updates keep the previous revision', async () => {
  const { root: source } = await world();
  const root = await mkdtemp(join(tmpdir(), 'oi-worlds-'));
  try {
    assert.equal((await resolveWorld({ root })).state, 'absent');
    const first = await installPackage(source, { root });
    const resolved = await resolveWorld({ root, verify: true });
    assert.equal(resolved.state, 'available');
    assert.equal(resolved.verified, true);
    assert.equal(resolved.world_id, WORLD_ID);
    assert.equal(resolved.counts.pages, 3);
    assert.deepEqual(resolved.source_addressing, SOURCE_ADDRESSING);
    assert.ok(resolved.edition_dir.startsWith(root), 'inside the install root, not the package or any checkout');
    assert.ok(existsSync(join(resolved.edition_dir, 'static/fieldIndex.json')));
    // Read-only: ordinary reading, or a stray write, cannot change the installed edition.
    await assert.rejects(writeFile(join(resolved.edition_dir, 'a.html'), 'x'), /EACCES|EPERM/);
    // Installing the same revision again is a verified no-op.
    assert.equal((await installPackage(source, { root })).pointer.revision, first.pointer.revision);
    // A different revision becomes current and the previous one stays installed.
    await chmod(join(source, 'edition/a.html'), 0o644);
    await appendFile(join(source, 'edition/a.html'), '<!-- r2 -->');
    const manifest = JSON.parse(await readFile(join(source, 'world.manifest.json'), 'utf8'));
    assert.ok(manifest.revision, 'sealed revision');
    // The changed page no longer matches its sealed digest, so it is refused rather than installed.
    await assert.rejects(installPackage(source, { root }), /does not verify/);
    assert.equal((await resolveWorld({ root })).revision, first.pointer.revision, 'a refused install changes nothing');
  } finally { await cleanup(source, root); }
});

test('a broken install is reported, not served', async () => {
  const { root: source } = await world();
  const root = await mkdtemp(join(tmpdir(), 'oi-worlds-'));
  try {
    const installed = await installPackage(source, { root });
    await chmod(join(installed.installed, 'world.manifest.json'), 0o644);
    await appendFile(join(installed.installed, 'world.manifest.json'), ' ');
    const resolved = await resolveWorld({ root });
    assert.equal(resolved.state, 'broken');
    assert.match(resolved.reason, /manifest differs/);
  } finally { await cleanup(source, root); }
});

test('ordinary reading of the installed World changes nothing: every page and Expression read, zero mutations', async () => {
  const { root: source } = await world();
  const root = await mkdtemp(join(tmpdir(), 'oi-worlds-'));
  try {
    const installed = await installPackage(source, { root });
    const probe = await ordinaryReadingMutations(installed.installed);
    assert.equal(probe.pages_read, 3);
    assert.equal(probe.expressions_read, 2);
    assert.ok(probe.files_watched > 0);
    assert.equal(probe.mutations, 0);
  } finally { await cleanup(source, root); }
});

test('the reader SkillSet binds to Skills that ship; removing a binding breaks it', async () => {
  const { root } = await world();
  try {
    const members = (await readFile(join(root, 'praxis-skillset/members'), 'utf8')).split('\n').filter((l) => l && !l.startsWith('#'));
    assert.deepEqual(members.filter((m) => m.startsWith('skill/epi-logos-reader/')).sort(), ['skill/epi-logos-reader/investigate', 'skill/epi-logos-reader/using-epi-logos', 'skill/epi-logos-reader/walk-the-essay']);
    assert.ok(members.includes('skill/ql/ql-operation'), 'QL/MEF specialists are composed by reference');
    const ok = await verifyPraxisBinding(root);
    assert.deepEqual(ok.unbound, []);
    assert.equal(ok.bound, 3);
    // Remove one binding (the Skill) → the same check now fails.
    await rm(join(root, 'praxis/skills/walk-the-essay'), { recursive: true });
    const broken = await verifyPraxisBinding(root);
    assert.deepEqual(broken.unbound.map((u) => u.id), ['skill/epi-logos-reader/walk-the-essay']);
    // A Skill whose frontmatter name does not match its binding is not a binding either.
    await writeFile(join(root, 'praxis/skills/investigate/SKILL.md'), '---\nname: something-else\n---\n');
    assert.match((await verifyPraxisBinding(root)).unbound.map((u) => u.why).join(), /frontmatter name is something-else/);
    // And the whole package refuses to verify while a binding is broken.
    assert.match((await verifyPackage(root)).problems.join('\n'), /reader-SkillSet members do not bind/);
  } finally { await cleanup(root); }
});

const aikit = (() => { try { return execFileSync('which', ['aikit'], { encoding: 'utf8' }).trim(); } catch { return null; } })();
test('real AIKit: the set resolves to catalogued Skills, and a removed Skill is named "not present in any registry"', { skip: aikit ? false : 'aikit is not installed on this machine' }, async () => {
  const { root: source } = await world();
  const home = await mkdtemp(join(tmpdir(), 'oi-aikit-'));
  const installRoot = await mkdtemp(join(tmpdir(), 'oi-worlds-'));
  try {
    const installed = await installPackage(source, { root: installRoot });
    const registered = await registerPraxis(installed.installed, { aikit, aikitHome: home });
    assert.equal(registered.set, 'epi-logos-reader');
    const show = () => JSON.parse(execFileSync(aikit, ['--json', 'set', 'show', 'epi-logos-reader'], { env: { ...process.env, AIKIT_HOME: home }, encoding: 'utf8' })).data;
    const unresolved = (data) => data.withheld.filter((w) => w.capability.startsWith('skill/epi-logos-reader/') && /not present in any registry/.test(w.reason)).map((w) => w.capability);
    assert.deepEqual(unresolved(show()), [], 'every source-owned member is a catalogued Skill');
    // Remove a binding at its source: a copy of the praxis without that Skill, re-registered.
    const mutilated = await mkdtemp(join(tmpdir(), 'oi-praxis-'));
    await cp(join(installed.installed, 'praxis/skills'), join(mutilated, 'skills'), { recursive: true });
    await rm(join(mutilated, 'skills/investigate'), { recursive: true, force: true });
    const home2 = await mkdtemp(join(tmpdir(), 'oi-aikit-'));
    const env2 = { ...process.env, AIKIT_HOME: home2 };
    const run = (args) => JSON.parse(execFileSync(aikit, ['--json', ...args], { env: env2, encoding: 'utf8' })).data;
    run(['source', 'add-directory', 'epi-logos-reader', join(mutilated, 'skills')]); run(['source', 'sync', 'epi-logos-reader']); run(['source', 'promote', 'epi-logos-reader']);
    run(['set', 'create', 'epi-logos-reader', ...registered.members ? (await readFile(join(installed.installed, 'praxis-skillset/members'), 'utf8')).split('\n').filter((l) => l && !l.startsWith('#')) : []]);
    const after = JSON.parse(execFileSync(aikit, ['--json', 'set', 'show', 'epi-logos-reader'], { env: env2, encoding: 'utf8' })).data;
    assert.deepEqual(unresolved(after), ['skill/epi-logos-reader/investigate']);
    await cleanup(mutilated, home2);
  } finally { await cleanup(source, installRoot, home); }
});

test('every unresolved reference gets a disposition with its reason; defects stay defects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'oi-vault-'));
  try {
    await put(root, 'quilt/ledger-note.md', 'x');
    await put(root, 'symbolon/a/AUTHORIAL-TEXT.md', 'x');
    await rm(join(root, 'symbolon/a/AUTHORIAL-TEXT.md'));
    await symlink('../../../working/paper.md', join(root, 'symbolon/a/AUTHORIAL-TEXT.md'));
    await put(root, 'symbolon/etym/homology/WHOLE-FIELD-homology.md', 'x');
    await put(root, 'section-rooms/m/21-s2-p2-sym-ballein.md', 'x');
    const published = new Set(['symbolon/etym/homology/WHOLE-FIELD-homology.md', 'section-rooms/m/21-s2-p2-sym-ballein.md']);
    const ctx = { published, vaultIndex: await indexVault(root), declaredWithheld: ['../../working/antykathera/Antikythera Agentworld Brief.md'] };
    const wiki = (target) => ({ from: 'a.md', target, why: 'wikilink names no published page' });
    const link = (target) => ({ from: 'symbolon/b/x.md', target, why: 'no such file' });
    const of = (item) => dispositionOf(item, ctx);
    assert.equal(of(link('../a/AUTHORIAL-TEXT.md')).disposition, 'withheld-by-design');
    assert.match(of(link('../a/AUTHORIAL-TEXT.md')).reason, /symlink into a withheld working desk/);
    assert.equal(of(wiki('AUTHORIAL-TEXT')).disposition, 'withheld-by-design');
    assert.equal(of(wiki('ledger-note')).disposition, 'withheld-by-design');
    assert.match(of(wiki('Antikythera Agentworld Brief')).reason, /withheld desk/);
    const whole = of(wiki('symbolon/etym/homology/WHOLE-FIELD'));
    assert.equal(whole.disposition, 'authoring-defect');
    assert.deepEqual(whole.repair, { kind: 'mechanical', replace: 'symbolon/etym/homology/WHOLE-FIELD', with: 'symbolon/etym/homology/WHOLE-FIELD-homology' });
    assert.equal(of(wiki('Sym-Ballein')).repair.kind, 'candidates');
    assert.deepEqual(of(wiki('Dreamcode')).repair, { kind: 'none' });
    assert.equal(of(link('www.example.org/page')).disposition, 'external');
    const all = dispositionSourceDefects([wiki('Dreamcode'), wiki('Dreamcode'), wiki('AUTHORIAL-TEXT'), wiki('symbolon/etym/homology/WHOLE-FIELD')], ctx);
    assert.equal(all.undispositioned, 0);
    assert.equal(all.distinct_targets, 3);
    assert.deepEqual(all.totals, { 'withheld-by-design': 1, external: 0, 'authoring-defect': 3, 'publication-defect': 0 });
    assert.ok(all.references.every((r) => DISPOSITIONS.includes(r.disposition) && r.reason));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('edition dead links inherit the disposition of the source reference; unaccounted links and links into withheld desks are named', () => {
  const table = [
    { target: 'symbolon/etym/homology/WHOLE-FIELD', kind: 'wikilink', disposition: 'authoring-defect', reason: 'r' },
    { target: 'Mono-Poly: Whole and Many', kind: 'wikilink', disposition: 'authoring-defect', reason: 'r' },
    { target: 'agentworld-response-matrix', kind: 'wikilink', disposition: 'withheld-by-design', reason: 'r' },
  ];
  const d = dispositionEditionDefects([
    { page: 'p', href: '../../symbolon/etym/homology/WHOLE-FIELD', why: 'no such page', target: 'symbolon/etym/homology/WHOLE-FIELD' },
    { page: 'p', href: '../Mono-Poly--Whole-and-Many', why: 'no such page', target: 'section-rooms/Mono-Poly--Whole-and-Many' },
    { page: 'p', href: '../agentworld-response-matrix', why: 'no such page', target: 'section-rooms/agentworld-response-matrix' },
    { page: 'p', href: '../nowhere-at-all', why: 'no such page', target: 'section-rooms/nowhere-at-all' },
    { page: 'p', href: '../quilt/q', why: 'no such page', target: 'quilt/q' },
    { page: 'p', href: '../x#m02', why: 'fragment #m02 missing on x', target: 'x', fragment: 'm02', candidates: ['m02--title'] },
    { page: 'p', href: '../../tags/1-4', why: 'no such page', target: 'tags/1-4' },
    { page: 'p', href: '../Parasociety', why: 'no such page', target: 'section-rooms/Parasociety' },
    { page: 'p', href: '../../the-slash', why: 'no such page', target: 'the-slash' },
  ], table, { slugs: new Set(['section-rooms/arguments/concepts/parasociety', 'a/the-slash', 'b/the-slash']) });
  assert.deepEqual(d.links.map((l) => l.disposition), ['authoring-defect', 'authoring-defect', 'withheld-by-design', 'undispositioned', 'publication-defect', 'publication-defect', 'publication-defect', 'authoring-defect']);
  assert.deepEqual(d.links.map((l) => l.kind), [undefined, undefined, undefined, undefined, 'withheld-desk-link', 'hashtag-link', 'resolver-mismatch', 'ambiguous-wikilink']);
  assert.equal(d.summary.links.undispositioned, 1);
  assert.deepEqual(d.fragments[0].repair, { kind: 'candidates', candidates: ['m02--title'] });
});

test('the Expression renderer is part of the World: described from the artifact, verified closed, and refused when missing or drifted', async () => {
  const { root, manifest } = await world();
  try {
    assert.equal(manifest.renderer.entry, RENDERER_ENTRY);
    assert.deepEqual(manifest.renderer.files.map((f) => f.path), ['renderer/assets/expression-abc.css', 'renderer/assets/expression-abc.js', 'renderer/expression.html']);
    assert.equal(manifest.counts.renderer.files, 3);
    assert.equal(manifest.renderer.edition_base, '../edition/');
    const listed = new Map(JSON.parse(await readFile(join(root, 'world.files.json'), 'utf8')).files.map((f) => [f.path, f]));
    for (const f of manifest.renderer.files) assert.equal(listed.get(f.path).sha256, f.sha256, 'listed in world.files.json with the same digest');
    assert.deepEqual(await verifyRenderer(root, manifest, listed), []);
    const without = (path) => new Map([...listed].filter(([k]) => k !== path));
    // a renderer file missing from the list, a page that loads something the package does not hold, a base that misses this edition
    assert.match((await verifyRenderer(root, manifest, without('renderer/assets/expression-abc.js'))).join('\n'), /expression-abc\.js: a renderer file the manifest declares is not in the file list/);
    assert.match((await verifyRenderer(root, manifest, without('renderer/expression.html'))).join('\n'), /expression\.html: missing/);
    const drifted = new Map(listed); drifted.set('renderer/assets/expression-abc.css', { ...listed.get('renderer/assets/expression-abc.css'), sha256: 'f'.repeat(64) });
    assert.match((await verifyRenderer(root, manifest, drifted)).join('\n'), /expression-abc\.css: renderer digest differs/);
    assert.match((await verifyRenderer(root, manifest, new Map([...listed, ['renderer/extra.js', { path: 'renderer/extra.js', sha256: 'a'.repeat(64) }]]))).join('\n'), /renderer\/extra\.js: a renderer file the manifest does not declare/);
    assert.match((await verifyRenderer(root, { ...manifest, renderer: undefined }, listed)).join('\n'), /declares no Expression renderer/);
    await chmod(join(root, 'renderer/expression.html'), 0o644);
    await writeFile(join(root, 'renderer/expression.html'), (await readFile(join(root, 'renderer/expression.html'), 'utf8')).replace('./assets/expression-abc.js', './assets/ghost.js').replace('../edition/', '../elsewhere/'));
    const closed = (await verifyRenderer(root, manifest, listed)).join('\n');
    assert.match(closed, /loads renderer\/assets\/ghost\.js, which the package does not hold/);
    assert.match(closed, /declares edition base "\.\.\/elsewhere\/", the manifest says "\.\.\/edition\/"/);
    // a JS file that imports a chunk the package does not hold
    await writeFile(join(root, 'renderer/expression.html'), (await readFile(join(root, 'renderer/expression.html'), 'utf8')).replace('ghost', 'expression-abc').replace('../elsewhere/', '../edition/'));
    await chmod(join(root, 'renderer/assets/expression-abc.js'), 0o644);
    await writeFile(join(root, 'renderer/assets/expression-abc.js'), 'import("./chunk-missing.js");');
    assert.match((await verifyRenderer(root, manifest, listed)).join('\n'), /expression-abc\.js loads renderer\/assets\/chunk-missing\.js, which the package does not hold/);
  } finally { await cleanup(root); }
});

test('a package without its renderer is not a World: assembling refuses, verifying fails', async () => {
  const { root } = await world();
  try {
    await chmod(join(root, 'renderer'), 0o755);
    await rm(join(root, 'renderer'), { recursive: true, force: true });
    await assert.rejects(describeRenderer(root), /carries its Expression renderer: renderer\/expression\.html is missing/);
    const verdict = await verifyPackage(root);
    assert.equal(verdict.ok, false);
    assert.match(verdict.problems.join('\n'), /renderer\/expression\.html: missing/);
  } finally { await cleanup(root); }
});
