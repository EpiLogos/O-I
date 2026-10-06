/** The Expression corpus as a layer of the essay field.
 *
 * The curated native collection (desktop/cradle/expressions-app/collections/return-of-zero,
 * PUBLICATION-CURATED.json: the authored E0 corpus, the sovereign essay reading, the eight
 * section rooms and — when its checkout is present — the S0–S5 product field) is read as it
 * stands and laid over the essay's pages: every member that is *about* some pages says so
 * (essay-expression-map.json), and every member ships as an exact, digest-checked `oi.journey`
 * body plus a small cover. The essay field (vendor/quartz) shows them on those pages, as
 * markers on the graph and the explorer, and as a gallery; the shell's expression.html renders
 * a body in full. This replaces the separate Library publication shelf as the way in.
 *
 * Nothing is invented here: titles, scenes and prose are the journeys' own; a member with no
 * mapped page still ships (it lives in the gallery only); a missing source degrades to a named
 * absence in the index rather than a placeholder.
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export const EXPRESSION_INDEX_SCHEMA = 'oi.essay-expressions/v1';
export const COLLECTION_LABELS = {
  essay: 'The essay',
  rooms: 'Section-rooms',
  episteme: 'Episteme',
  matheme: 'Matheme',
  symbolon: 'Symbolon',
  mytheme: 'Mytheme wholes',
  arguments: 'Arguments',
  products: 'The products',
};
const COLLECTION_ORDER = ['essay', 'rooms', 'symbolon', 'arguments', 'matheme', 'mytheme', 'episteme', 'products'];

/** Every markdown page the essay stages, as full slugs (what the reader and Quartz call them). */
export async function stagedSlugs(contentDir) {
  const out = [];
  async function walk(dir, prefix) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(dir, entry.name), rel);
      else if (entry.name.endsWith('.md')) out.push(rel.replace(/\.md$/, ''));
    }
  }
  await walk(contentDir, '');
  return out.sort();
}

function collectionOf(id, manifest, group) {
  if (manifest === 'essay') return 'essay';
  if (manifest === 'rooms') return 'rooms';
  if (manifest === 'products') return 'products';
  if (/^roz-a-/.test(id)) return 'arguments';
  if (group === 'Matheme') return 'matheme';
  if (group === 'Symbolon') return 'symbolon';
  if (group === 'Mytheme wholes') return 'mytheme';
  return 'episteme';
}

/** The pages a member is about: the map's patterns against the staged slugs. */
export function nodesFor(id, map, slugs) {
  const rules = map.members?.[id];
  if (!rules) return [];
  const found = new Set();
  for (const rule of rules.nodes ?? []) {
    const re = new RegExp(rule.match);
    for (const slug of slugs) {
      if (!re.test(slug)) continue;
      if (rule.range) {
        const n = Number((slug.split('/').pop().match(/^[A-Z]+(\d+)/) ?? [])[1]);
        if (!(n >= rule.range[0] && n <= rule.range[1])) continue;
      }
      found.add(slug);
    }
  }
  return [...found].sort();
}

async function gitHead(dir) {
  try { return (await exec('git', ['-C', dir, 'rev-parse', 'HEAD'])).stdout.trim(); } catch { return null; }
}

/** Read the curated collection and say what the essay field will carry. Pure reads; writes nothing. */
export async function planEssayExpressions({ repo, contentDir, mapPath, productsRoot, envelopePath } = {}) {
  const collections = resolve(repo, 'desktop/cradle/expressions-app/collections/return-of-zero');
  envelopePath ??= join(collections, 'PUBLICATION-CURATED.json');
  mapPath ??= resolve(repo, 'site/essay-expression-map.json');
  productsRoot ??= process.env.OI_PCD_S_PRODUCTS_ROOT || resolve(repo, '..', 'Point-Cloud-Demo/production/s-products');
  const envelope = JSON.parse(await readFile(envelopePath, 'utf8'));
  if (envelope.schema !== 'oi.collection-publication/v1') throw new Error(`Unexpected collection envelope schema: ${envelope.schema}`);
  const map = JSON.parse(await readFile(mapPath, 'utf8'));
  const slugs = contentDir ? await stagedSlugs(contentDir) : [];
  const entries = [], absent = [];
  for (const manifestRef of envelope.manifests) {
    const name = manifestRef.manifest.split('/').pop().replace(/\.manifest\.json$/, '');   // corpus | essay | rooms | products
    const manifest = JSON.parse(await readFile(resolve(repo, 'desktop/cradle/expressions-app', manifestRef.manifest), 'utf8'));
    const root = name === 'products' ? productsRoot : collections;
    for (const member of manifest.featured) {
      const file = join(root, member.file);
      if (!existsSync(file)) { absent.push({ file: member.file, manifest: name, reason: name === 'products' ? 'the product journey checkout is not present' : 'journey missing' }); continue; }
      const bytes = await readFile(file);
      const journey = JSON.parse(bytes.toString('utf8'));
      if (journey.schema !== 'oi.journey') throw new Error(`${member.file} is not an oi.journey`);
      const id = member.id ?? journey.id;
      const collection = collectionOf(id, name, member.group);
      entries.push({
        id,
        title: journey.name ?? member.name,
        summary: journey.description ?? '',
        collection,
        group: member.group ?? COLLECTION_LABELS[collection],
        scenes: journey.scenes.map((s) => ({ id: s.id, name: s.name, character: s.character ?? '' })),
        nodes: nodesFor(id, map, slugs),
        digest: `sha256:${sha256(bytes)}`,
        bytes: bytes.length,
        journey: `x/${id}.journey.json`,
        cover: `x/${id}.cover.webp`,
        _journey: file,
        _cover: file.replace(/\.journey\.json$/, '.cover.png'),
      });
    }
  }
  entries.sort((a, b) => (COLLECTION_ORDER.indexOf(a.collection) - COLLECTION_ORDER.indexOf(b.collection)) || a.title.localeCompare(b.title, undefined, { numeric: true }));
  const products = await gitHead(productsRoot);
  const index = {
    schema: EXPRESSION_INDEX_SCHEMA,
    title: envelope.title,
    standing: envelope.standing,
    exported_at: envelope.exported_at,
    sources: {
      essay: envelope.source_revision,
      corpus: envelope.corpus?.production_revision ?? null,
      products: envelope.product_corpus ? { ...envelope.product_corpus.production_revision, checkout: products, pinned: products ? products.startsWith(envelope.product_corpus.production_revision.commit.slice(0, 7)) : null } : null,
    },
    collections: COLLECTION_ORDER.filter((c) => entries.some((e) => e.collection === c)).map((id) => ({ id, label: COLLECTION_LABELS[id], count: entries.filter((e) => e.collection === id).length })),
    absent,
    entries: entries.map(({ _journey, _cover, ...rest }) => rest),
  };
  return { index, files: entries.map((e) => ({ id: e.id, journey: e._journey, cover: e._cover })), expected: envelope.expected_members, absent };
}

/** Write the index, the exact journey bodies and small covers. `sharp` is optional: without it covers ship as the originals. */
export async function writeEssayExpressions(plan, dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, 'x'), { recursive: true });
  // sharp is a dependency of the vendored Quartz (its install is a build prerequisite); without it covers ship as the originals
  let sharp = null;
  try { sharp = (await import(pathToFileURL(createRequire(import.meta.url).resolve('sharp', { paths: [resolve(dirname(fileURLToPath(import.meta.url)), 'vendor/quartz')] })).href)).default; } catch { /* originals */ }
  for (const f of plan.files) {
    await writeFile(join(dir, 'x', `${f.id}.journey.json`), await readFile(f.journey));
    if (!existsSync(f.cover)) continue;
    if (sharp) await sharp(f.cover).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 72 }).toFile(join(dir, 'x', `${f.id}.cover.webp`));
    else { await writeFile(join(dir, 'x', `${f.id}.cover.png`), await readFile(f.cover)); plan.index.entries.find((e) => e.id === f.id).cover = `x/${f.id}.cover.png`; }
  }
  await writeFile(join(dir, 'index.json'), JSON.stringify(plan.index) + '\n');
  return plan.index.entries.length;
}

export async function writeExpressionIndexFor(plan, file) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(plan.index) + '\n');
}
