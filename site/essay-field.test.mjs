import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
const { SourceNotes } = await load('./vendor/quartz/quartz/plugins/transformers/sourceNotes.ts');
test.after(() => rm(dir, { recursive: true, force: true }));

const treeNode = (root, label) => {
  for (const f of root.children) {
    if (f.label === label) return f;
    const found = treeNode(f, label);
    if (found) return found;
  }
  return null;
};

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

test('the manuscript reads by its title, and the sections keep their own folder', () => {
  const model = fieldModel(corpus());
  const ms = model.nodes.find((n) => n.s === 'THE-RETURN-OF-ZERO'), s01 = model.nodes.find((n) => n.s === 'CONFRONTING-THE-LIMIT-S01');
  assert.equal(ms.lab, 'Confronting the Limit');
  assert.equal(ms.coord, 'M01–M48');
  assert.equal(s01.lab, '§0/1 — The Integral Threshold');
  const msFolder = treeNode(model.tree, 'The manuscript');
  assert.deepEqual(msFolder.children.map((f) => f.label), ['Confronting the Limit', 'Sections', 'Reading home']);
  const sections = msFolder.children.find((f) => f.label === 'Sections');
  assert.deepEqual(sections.children.map((f) => f.label), ['§0/1 — The Integral Threshold']);
  assert.equal(sections.children[0].coord, '§0/1');
});

test('the arguments folder carries A and A′ as one field under the A/C root', () => {
  const pages = corpus();
  pages.push(page('section-rooms/arguments/conjugate/AC', 'AC — the dual-form root of the suite'));
  pages.push(page('section-rooms/arguments/conjugate/A01-prime-Faithful-Definition-of-the-Agent', 'A01′ — Faithful Definition of the Agent'));
  pages.push(page('section-rooms/arguments/conjugate/README', 'The conjugate field'));
  pages.push(page('section-rooms/arguments/concepts/README', 'The concepts field'));
  pages.push(page('section-rooms/arguments/concepts/C01-Apoha', 'C01 — Apoha'));
  const model = fieldModel(pages);
  const a01p = model.nodes.find((n) => n.s.endsWith('A01-prime-Faithful-Definition-of-the-Agent'));
  assert.equal(a01p.coord, 'A01′', 'a conjugate face reads as its argument with the prime');
  assert.equal(a01p.lab, 'Faithful Definition of the Agent');
  const args = treeNode(model.tree, 'Arguments');
  const labels = args.children.filter((f) => f.kind === 'leaf').map((f) => f.label);
  assert.ok(labels.includes('Faithful Definition of the Agent'), 'the conjugate face stands among the arguments');
  assert.ok(!labels.includes('Prime faithful definition of the agent'));
  assert.equal(args.ni, model.nodes.find((n) => n.s.endsWith('/AC')).i, 'the A/C root is the suite page');
  assert.ok(!args.children.some((f) => f.label === 'Conjugate'), 'no side folder: A′ are arguments');
  const concepts = args.children.find((f) => f.label === 'Concepts');
  assert.ok(concepts, 'the concepts ring keeps its folder');
});

test('a manuscript page carries its own movement anchors', async () => {
  const file = join(dir, 'manuscript-fixtures.md');
  await writeFile(file, '# t\n\n<a id="M01"></a>\n\n<a id="M07"></a>\n', 'utf8');
  const pages = corpus();
  pages.find((p) => p.slug === 'THE-RETURN-OF-ZERO').filePath = file;
  const ms = fieldModel(pages).nodes.find((n) => n.s === 'THE-RETURN-OF-ZERO');
  assert.deepEqual(ms.mvs, [1, 7]);
  const s01 = fieldModel(corpus()).nodes.find((n) => n.s === 'CONFRONTING-THE-LIMIT-S01');
  assert.equal(s01.mvs, undefined, 'without a readable source file the anchors simply ride along later');
});

test('source notes read down into their source houses, and stay prose when there is no house', async () => {
  const root = join(dir, 'srcnotes-vault');
  const houseDir = join(root, 'symbolon/episteme/sources/philosophy/kripke/kripke-1980-naming-and-necessity');
  await mkdir(houseDir, { recursive: true });
  await writeFile(join(houseDir, 'kripke-1980-naming-and-necessity.md'), [
    '---',
    'title: "Kripke — Naming and Necessity (1980)"',
    'title_full: "Naming and Necessity"',
    'author:',
    '  - Saul A. Kripke',
    'year: 1980',
    '---',
    '',
    'House body.',
  ].join('\n'), 'utf8');
  const fregeDir = join(root, 'symbolon/episteme/sources/analytic-philosophy/frege/frege-1892-ueber-sinn-und-bedeutung');
  await mkdir(fregeDir, { recursive: true });
  await writeFile(join(fregeDir, 'frege-1892-ueber-sinn-und-bedeutung.md'), [
    '---',
    'title: "Frege — Über Sinn und Bedeutung (1892)"',
    'title_full: "Über Sinn und Bedeutung"',
    'author:',
    '  - Gottlob Frege',
    'year: 1892',
    '---',
    '',
    'House body.',
  ].join('\n'), 'utf8');
  const em = (t) => ({ type: 'element', tagName: 'em', properties: {}, children: [{ type: 'text', value: t }] });
  const li = (...children) => ({ type: 'element', tagName: 'li', properties: { id: 'user-content-fn-1' }, children });
  const noteTree = (slug) => ({
    type: 'root',
    children: [
      { type: 'element', tagName: 'section', properties: { dataFootnotes: '' }, children: [
        { type: 'element', tagName: 'ol', properties: {}, children: [
          li({ type: 'text', value: 'Saul A. Kripke, ' }, em('Naming and Necessity'), { type: 'text', value: ', 16–18 and n. 17.' }),
          li({ type: 'text', value: 'Ludwig Wittgenstein, ' }, em('Tractatus Logico-Philosophicus'), { type: 'text', value: ', prop. 7.' }),
          li({ type: 'text', value: 'The difference in informativeness between ' }, em('Bedeutung'), { type: 'text', value: ' and different ' }, em('Sinn'), { type: 'text', value: ', follow on 27. Frege’s terms.' }),
        ] },
      ] },
    ],
  });
  const instance = SourceNotes();
  const run = instance.htmlPlugins({ argv: { directory: root } })[0]();
  const tree = noteTree('THE-RETURN-OF-ZERO');
  await run(tree, { data: { slug: 'THE-RETURN-OF-ZERO' } });
  const [noteA, noteB] = tree.children[0].children[0].children;
  const anchor = noteA.children.find((c) => c.type === 'element' && c.tagName === 'a');
  assert.ok(anchor, 'the title of a housed source becomes a link');
  assert.equal(anchor.properties.href, './symbolon/episteme/sources/philosophy/kripke/kripke-1980-naming-and-necessity/kripke-1980-naming-and-necessity');
  assert.equal(anchor.children[0].tagName, 'em', 'the citation text itself is kept');
  assert.ok(!noteB.children.some((c) => c.type === 'element' && c.tagName === 'a'), 'a source with no house stays prose');
  const noteC = tree.children[0].children[0].children[2];
  assert.ok(!noteC.children.some((c) => c.type === 'element' && c.tagName === 'a'), 'a term from inside a title is prose, not a citation');
  // a page that is not the manuscript is left alone
  const other = noteTree('section-rooms/00-x/ROOM-00-x');
  await run(other, { data: { slug: 'section-rooms/00-x/ROOM-00-x' } });
  assert.ok(!other.children[0].children[0].children[0].children.some((c) => c.type === 'element' && c.tagName === 'a'));
});
