import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// The Quartz sources import each other without extensions, which bare Node cannot follow; bundle them as Quartz does.
const dir = await mkdtemp(join(tmpdir(), 'essay-field-'));
const load = async (entry) => {
  const outfile = join(dir, entry.replace(/\W+/g, '_') + '.mjs');
  await build({ entryPoints: [new URL(entry, import.meta.url).pathname], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', nodePaths: [new URL('./vendor/quartz/node_modules', import.meta.url).pathname] });
  return import(pathToFileURL(outfile).href);
};
const { classify, fieldModel, treePath } = await load('./vendor/quartz/quartz/util/essayField.ts');
const { resolveRelativeSlug } = await load('./vendor/quartz/quartz/plugins/transformers/links.ts');
test.after(() => rm(dir, { recursive: true, force: true }));

const page = (slug, title, extra = {}) => ({ slug, frontmatter: { title, ...(extra.frontmatter ?? {}) }, text: extra.text ?? 'one two three', links: extra.links ?? [] });
const room = (n, sec, name) => page(`section-rooms/0${n}-${name}/ROOM-0${n}-${name}`, `${sec} Room — ${name} — a deck`, { frontmatter: { station: sec } });
const move = (n, r, name, sec, pos) => page(`section-rooms/0${r}-r${r}/movements/${String(n).padStart(2, '0')}-s1-p3-${name}`, `${sec} · ${pos} — The ${name}`, { frontmatter: { station: sec, position: pos }, links: [] });

const corpus = () => [
  page('index', 'Reading home'),
  page('THE-RETURN-OF-ZERO', 'The Return of Zero'),
  page('CONFRONTING-THE-LIMIT-S01', 'Confronting the Limit'),
  page('section-rooms/README', 'The rooms'),
  room(1, '§0', 'differentiating'), room(2, '§1', 'zero'),
  move(15, 2, 'empty-set', '§1', '#2'), move(16, 2, 'crossed-zero', '§1', '#3'),
  page('section-rooms/arguments/A10-Advent-of-Zero', 'A10 — Advent of Zero'),
  page('symbolon/README', 'Symbolon'), page('symbolon/0-1', '0-1'),
  page('symbolon/mytheme/README', 'Mytheme'),
  page('symbolon/mytheme/plates/crossed-zero-plate', 'Plate — The Crossed Zero', { frontmatter: { asset: './x.svg' } }),
  page('symbolon/mytheme/worlds/hellenic/ares/WHOLE', 'WHOLE'),
  page('symbolon/matheme/diagrams/dice', 'Diagram — Dice', { links: ['section-rooms/02-r2/movements/16-s1-p3-crossed-zero', 'THE-RETURN-OF-ZERO', '/'] }),
];

test('pages classify by where the corpus keeps them', () => {
  assert.deepEqual(classify('section-rooms/02-zero/movements/16-s1-p3-x'), { st: '#0', k: 'movement' });
  assert.deepEqual(classify('section-rooms/02-zero/ROOM-02-zero'), { st: '#0', k: 'room' });
  assert.deepEqual(classify('section-rooms/arguments/A10-x'), { st: '#0', k: 'argument' });
  assert.deepEqual(classify('symbolon/mytheme/worlds/x/WHOLE'), { st: '#3', k: 'record' });
  assert.deepEqual(classify('symbolon/matheme/README'), { st: '#2', k: 'register' });
  assert.deepEqual(classify('THE-RETURN-OF-ZERO'), { st: '#5', k: 'manuscript' });
});

test('the model joins movements to rooms, labels them for reading, and resolves links', () => {
  const model = fieldModel(corpus());
  const m16 = model.nodes.find((n) => n.m === 16);
  assert.equal(m16.lab, 'The crossed-zero'.replace('crossed-zero', 'crossed-zero'));
  assert.equal(m16.coord, 'M16');
  assert.equal(m16.room, 2);
  assert.equal(model.moves[16].room, 2);
  assert.equal(model.rooms[2].title, 'zero');
  const dice = model.nodes.find((n) => n.s.endsWith('diagrams/dice')), ms = model.nodes.find((n) => n.s === 'THE-RETURN-OF-ZERO'), home = model.nodes.find((n) => n.s === 'index');
  const to = model.links.filter(([a]) => a === dice.i).map(([, b]) => b).sort();
  assert.deepEqual(to, [m16.i, ms.i, home.i].sort(), 'simplified slugs and the root link all resolve');
  assert.equal(model.nodes.find((n) => n.s === 'symbolon/mytheme/README').hub, 1);
});

test('the explorer tree has no plates group and keeps the movements out of sight', () => {
  const { tree } = fieldModel(corpus());
  const names = [];
  (function walk(f) { names.push(f.label); f.children.forEach(walk); })(tree);
  assert.ok(!names.some((l) => /^plates/i.test(l)), 'plates live in their field folders, not a group of their own');
  const flat = []; (function walk(f) { flat.push(f); f.children.forEach(walk); })(tree);
  const movements = flat.filter((f) => f.label === 'Movements');
  assert.ok(movements.length && movements.every((f) => f.xhide === 1), 'the 48 movements have one menu: the contents list');
  const model = fieldModel(corpus());
  const m16 = model.nodes.find((n) => n.m === 16);
  assert.deepEqual(treePath(model, m16.i).map((f) => f.label), ['Essay', 'Section-rooms', 'zero', 'Movements', 'The crossed-zero']);
  const plate = model.nodes.find((n) => n.s.endsWith('crossed-zero-plate'));
  assert.ok(treePath(model, plate.i).map((f) => f.label).includes('Mytheme'), 'the plate sits in its field folder');
});

test('relative file links resolve against the linking page, not the vault root', () => {
  const slugs = new Set(['index', 'section-rooms/README', 'section-rooms/02-zero/ROOM-02-zero', 'section-rooms/02-zero/movements/15-a', 'section-rooms/02-zero/movements/16-b', 'THE-RETURN-OF-ZERO']);
  const from = 'section-rooms/02-zero/movements/16-b';
  assert.equal(resolveRelativeSlug(from, '../ROOM-02-zero.md', slugs), '../../../section-rooms/02-zero/ROOM-02-zero');
  assert.equal(resolveRelativeSlug(from, '15-a.md', slugs), '../../../section-rooms/02-zero/movements/15-a');
  assert.equal(resolveRelativeSlug(from, '../../../THE-RETURN-OF-ZERO.md#section-s1', slugs), '../../../THE-RETURN-OF-ZERO#section-s1');
  assert.equal(resolveRelativeSlug('section-rooms/02-zero/ROOM-02-zero', '../README.md', slugs), '../../section-rooms/README');
  assert.equal(resolveRelativeSlug(from, '../../../../README.md', slugs), null, 'above the vault root: left for the default resolver');
  assert.equal(resolveRelativeSlug(from, 'https://example.org/x.md', slugs), null);
  assert.equal(resolveRelativeSlug(from, 'missing.md', slugs), null);
});
