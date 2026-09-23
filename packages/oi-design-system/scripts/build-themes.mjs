/**
 * Build the theme library from the upstream corpus:
 *
 *   node scripts/build-themes.mjs
 *
 * reads themes/upstream/*.color-theme.json (+ <id>.include.json inheritance
 * parents, + PROVENANCE.json for identity/appearance/source) and writes
 *
 *   themes/oi/<id>.json   normalized oi.theme/v1 documents
 *   themes/themes.css     one [data-oi-theme] variable block per theme
 *   themes/index.mjs      the THEMES index Settings → Visuals renders
 *
 * Plain node, no dependencies. Conversion rules live in convert.mjs.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { convertTheme, emitCss, emitIndexModule, mergeInclude, parseJsonc } from './convert.mjs';

const HERE = fileURLToPath(new URL('../', import.meta.url));
const UPSTREAM = `${HERE}themes/upstream/`;
const OUT = `${HERE}themes/`;

const provenance = JSON.parse(readFileSync(`${UPSTREAM}PROVENANCE.json`, 'utf8'));
const byId = new Map(provenance.themes.map((entry) => [entry.id, entry]));

const files = readdirSync(UPSTREAM).filter((name) => name.endsWith('.color-theme.json'));
if (!files.length) throw new Error('no upstream themes — run scripts/fetch-upstream-themes.mjs first');

const docs = [];
for (const file of files) {
  const id = file.replace('.color-theme.json', '');
  const entry = byId.get(id);
  if (!entry) throw new Error(`${file}: no provenance entry — rerun scripts/fetch-upstream-themes.mjs`);
  let theme = parseJsonc(readFileSync(`${UPSTREAM}${file}`, 'utf8'));
  const includeFile = `${UPSTREAM}${id}.include.json`;
  let includeSource;
  try {
    includeSource = parseJsonc(readFileSync(includeFile, 'utf8'));
  } catch {
    includeSource = null; // no inheritance parent stored for this theme
  }
  if (includeSource) theme = mergeInclude(theme, includeSource);
  docs.push(convertTheme(theme, { id: entry.id, name: entry.name, appearance: entry.appearance, source: entry.source }));
  console.log(`converted ${id} (${entry.appearance}, ${Object.keys(theme.colors ?? {}).length} workbench colours)`);
}

docs.sort((a, b) => (a.appearance === b.appearance ? a.name.localeCompare(b.name) : a.appearance === 'dark' ? -1 : 1));

mkdirSync(`${OUT}oi`, { recursive: true });
for (const doc of docs) writeFileSync(`${OUT}oi/${doc.id}.json`, `${JSON.stringify(doc, null, 2)}\n`);
writeFileSync(`${OUT}themes.css`, emitCss(docs));
writeFileSync(`${OUT}index.mjs`, emitIndexModule(docs));
console.log(`${docs.length} themes -> themes/oi/, themes/themes.css, themes/index.mjs`);
