import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { nodesFor, planEssayExpressions, stagedSlugs, writeEssayExpressions } from './essay-expressions.mjs';

const journey = (id, scenes = 2) => ({ schema: 'oi.journey', version: 1, id, name: `Return of Zero — ${id}`, description: `About ${id}.`, scenes: Array.from({ length: scenes }, (_, k) => ({ id: `${id}-s${k}`, name: `Scene ${k}`, character: 'c' })) });
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'essay-expressions-'));
  const repo = join(dir, 'repo');
  const col = join(repo, 'desktop/cradle/expressions-app/collections/return-of-zero');
  const app = join(repo, 'desktop/cradle/expressions-app');
  await mkdir(join(col, 'mytheme'), { recursive: true }); await mkdir(join(col, 'rooms'), { recursive: true });
  const files = { 'mytheme/roz-mytheme-job.journey.json': journey('roz-mytheme-job'), 'rooms/roz-room-00-x.journey.json': journey('roz-room-00-x', 3) };
  for (const [f, j] of Object.entries(files)) await writeFile(join(col, f), JSON.stringify(j));
  await writeFile(join(app, 'collections/return-of-zero/corpus.manifest.json'), JSON.stringify({ featured: [{ id: 'roz-mytheme-job', name: 'Job', group: 'Mytheme wholes', file: 'mytheme/roz-mytheme-job.journey.json' }] }));
  await writeFile(join(app, 'collections/return-of-zero/rooms.manifest.json'), JSON.stringify({ featured: [{ id: 'roz-room-00-x', name: 'Room', file: 'rooms/roz-room-00-x.journey.json' }] }));
  await writeFile(join(app, 'collections/return-of-zero/products.manifest.json'), JSON.stringify({ featured: [{ file: 'central/sp-c.journey.json', group: 'S0 Central' }] }));
  await writeFile(join(col, 'PUBLICATION-CURATED.json'), JSON.stringify({ schema: 'oi.collection-publication/v1', title: 'T', standing: 's', exported_at: 'x', source_revision: { repo: 'r', commit: 'c' }, corpus: { production_revision: { commit: 'p' } }, product_corpus: { production_revision: { repo: 'r', commit: 'abcdef1234' } }, expected_members: 3,
    manifests: ['corpus', 'rooms', 'products'].map((m) => ({ manifest: `collections/return-of-zero/${m}.manifest.json` })) }));
  const content = join(dir, 'content');
  for (const p of ['symbolon/mytheme/worlds/biblical/job/WHOLE.md', 'symbolon/mytheme/worlds/biblical/job/NOTE.md', 'section-rooms/00-x/ROOM-00-x.md', 'section-rooms/00-x/movements/01-a.md', 'index.md']) { await mkdir(join(content, p, '..'), { recursive: true }); await writeFile(join(content, p), '# x\n'); }
  const map = join(dir, 'map.json');
  await writeFile(map, JSON.stringify({ members: { 'roz-mytheme-job': { nodes: [{ match: '^symbolon/mytheme/worlds/[^/]+/job/' }] }, 'roz-room-00-x': { nodes: [{ match: '^section-rooms/00-x/' }] } } }));
  return { dir, repo, content, map };
}

test('the curated collection is read as it stands and laid over the staged pages', async () => {
  const f = await fixture();
  try {
    const plan = await planEssayExpressions({ repo: f.repo, contentDir: f.content, mapPath: f.map, productsRoot: join(f.dir, 'no-products-here') });
    const ids = plan.index.entries.map((e) => e.id);
    assert.deepEqual(ids, ['roz-room-00-x', 'roz-mytheme-job'], 'rooms before mythemes; the absent product checkout is not invented');
    assert.equal(plan.index.absent.length, 1);
    assert.match(plan.index.absent[0].reason, /product journey checkout/);
    const job = plan.index.entries.find((e) => e.id === 'roz-mytheme-job');
    assert.deepEqual(job.nodes, ['symbolon/mytheme/worlds/biblical/job/NOTE', 'symbolon/mytheme/worlds/biblical/job/WHOLE']);
    assert.equal(job.collection, 'mytheme');
    assert.equal(job.scenes.length, 2);
    assert.match(job.digest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(plan.index.entries.find((e) => e.id === 'roz-room-00-x').nodes.length, 2, 'a room is about its room page and its movements');
    assert.equal(plan.index.sources.products.pinned, null, 'no checkout, no claim about the pin');
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('the bodies written are the journeys byte for byte, and the index names exactly what was written', async () => {
  const f = await fixture();
  try {
    const plan = await planEssayExpressions({ repo: f.repo, contentDir: f.content, mapPath: f.map, productsRoot: join(f.dir, 'none') });
    const out = join(f.dir, 'out');
    assert.equal(await writeEssayExpressions(plan, out), 2);
    const index = JSON.parse(await readFile(join(out, 'index.json'), 'utf8'));
    const { createHash } = await import('node:crypto');
    for (const e of index.entries) {
      const bytes = await readFile(join(out, e.journey));
      assert.equal('sha256:' + createHash('sha256').update(bytes).digest('hex'), e.digest, 'the digest is of the shipped bytes');
      assert.equal(JSON.parse(bytes).id, e.id);
    }
    assert.equal(index.schema, 'oi.essay-expressions/v1');
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('patterns and ranges pick pages; a member with no rule is about no page', () => {
  const slugs = ['section-rooms/arguments/concepts/C05-x', 'section-rooms/arguments/concepts/C40-y', 'section-rooms/arguments/A01-z'];
  const map = { members: { a: { nodes: [{ match: '^section-rooms/arguments/concepts/C\\d+-', range: [1, 32] }] } } };
  assert.deepEqual(nodesFor('a', map, slugs), ['section-rooms/arguments/concepts/C05-x']);
  assert.deepEqual(nodesFor('b', map, slugs), []);
});

test('the real map covers every curated essay member and every pattern finds pages', async () => {
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const site = dirname(fileURLToPath(import.meta.url));
  const content = resolve(site, 'vendor/quartz/content');
  const { existsSync } = await import('node:fs');
  if (!existsSync(content)) return;   // the staged corpus is a build product
  const plan = await planEssayExpressions({ repo: resolve(site, '..'), contentDir: content, productsRoot: '/nonexistent' });
  const loose = plan.index.entries.filter((e) => e.collection !== 'products' && !e.nodes.length).map((e) => e.id);
  assert.deepEqual(loose, [], 'every non-product member is about at least one essay page');
  assert.ok((await stagedSlugs(content)).length > 800);
});
