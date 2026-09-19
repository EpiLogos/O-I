// Export the app's current collection content as data into
// legacy-collections/ (owner direction 2026-09-19): the featured
// expressions and every starter, as ordinary oi.journey JSON — the staging
// ground for refitting the collections/library page to integrate at Central
// and ProjectCentral levels.
//
// Retained as NON-legacy (excluded here, live in the app):
//   - oi-mark — the current default expression, the light/dark O:I theme
//   - source-twelve-faces — the Epii face, Instrument 0's entry expression
//
// Run after `npm run build:journeys` (this reads the compiled journey
// modules): `npm run export:legacy-collections`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {featuredExpressions, startingPoints} from '../field-studies-journeys/build/expressions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', 'legacy-collections');
const RETAINED = new Set(['oi-mark', 'source-twelve-faces']);

// The provenance envelope (manifest gap D1, the collections/library refit):
// where this export was READ from — the register and root it lives under,
// the Central-relative paths it was written to, the ground the content was
// read from, the exported-at civil date, and the generator with its own
// revision. Additive by law: validators accept manifests without the
// envelope (old exports keep importing) and envelopes they do not know.
const GENERATOR = {name: 'scripts/export-legacy-collections.mjs', revision: 'rev 2 — provenance envelope (oi.collection-provenance/v1)'};
const exportedAt = new Date().toISOString();

fs.rmSync(out, {recursive: true, force: true});
const manifest = {
  schema: 'oi.legacy-collections/v1',
  exported_at: exportedAt,
  source: 'the Expressions application\'s collection content, as of the vendoring into the O:I cradle',
  provenance: {
    schema: 'oi.collection-provenance/v1',
    register: 'project',
    root: 'Work/O-I',
    paths: ['Work/O-I/desktop/cradle/expressions-app/legacy-collections'],
    ground: 'the Expressions application\'s own modules (field-studies-journeys), read from the O:I cradle working tree',
    exported_at: exportedAt,
    generator: GENERATOR,
  },
  retained_non_legacy: [
    {id: 'oi-mark', reason: 'the current default expression — the light/dark O:I theme (owner direction 2026-09-19)'},
    {id: 'source-twelve-faces', reason: 'the Epii face — Instrument 0\'s entry expression (owner direction 2026-09-19)'},
  ],
  browser_saves: 'User expressions saved in a browser remain browser-local (localStorage); they are not repo content and are not exported.',
  featured: [],
  starters: [],
};

const featured = featuredExpressions().filter(j => !RETAINED.has(j.id));
for (const journey of featured) {
  const file = `featured/${journey.id}.journey.json`;
  fs.mkdirSync(path.join(out, 'featured'), {recursive: true});
  fs.writeFileSync(path.join(out, file), JSON.stringify(journey, null, 2) + '\n');
  manifest.featured.push({id: journey.id, name: journey.name, file});
}

const starters = startingPoints().filter(p => !RETAINED.has(p.expression.id) && !RETAINED.has(p.id));
for (const point of starters) {
  const group = point.group.toLowerCase().replace(/\s+/g, '-');
  const file = `starters/${group}/${point.id}.journey.json`;
  fs.mkdirSync(path.join(out, 'starters', group), {recursive: true});
  fs.writeFileSync(path.join(out, file), JSON.stringify(point.expression, null, 2) + '\n');
  manifest.starters.push({id: point.id, group: point.group, name: point.expression.name, file});
}

fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`legacy-collections: ${manifest.featured.length} featured, ${manifest.starters.length} starters -> ${path.relative(process.cwd(), out)}`);
