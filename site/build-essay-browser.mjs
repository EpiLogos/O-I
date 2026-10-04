/** Build the Plate B publication from submission-package/essay.
 * Writes site/public/essay-shell/. Does not copy quilt, NOTES, reference-notes, or JSON.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ESSAY_REF, MANUSCRIPT_ID, publishVault } from './essay-browser.mjs';
import { resolveEssaySource, readEssayInputs, essayInputReceipt } from './essay-source.mjs';

const exec = promisify(execFile);
const site = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(site, 'public/essay-shell');

const source = await resolveEssaySource({ siteDirectory: site });
const inputs = await readEssayInputs(source.essay);
const commit = source.commit;
const files = inputs.entries.filter(entry => entry.kind === 'markdown').map(entry => ({ rel: entry.rel, text: entry.bytes.toString('utf8') }));
const { catalog, pages } = publishVault(files, {
  repo: 'EpiLogos/Antykathera-Essay-Work',
  ref: ESSAY_REF,
  commit,
  path: 'submission-package/essay',
  ...essayInputReceipt(source, inputs),
});
if (!pages.some((page) => page.id === MANUSCRIPT_ID)) {
  throw new Error('Manuscript folder was not published. THE-RETURN-OF-ZERO.md is missing from the essay vault.');
}
const manuscript = pages.find((page) => page.id === MANUSCRIPT_ID);
if (!manuscript || manuscript.html.length < 500 || /http-equiv\s*=\s*["']refresh/i.test(manuscript.html)) {
  throw new Error('Manuscript publication is empty or still a refresh stub.');
}
await rm(outDir, { recursive: true, force: true });
await mkdir(resolve(outDir, 'pages'), { recursive: true });
await writeFile(resolve(outDir, 'catalog.json'), JSON.stringify(catalog));
for (const page of pages) {
  if (page.id.includes('..')) throw new Error(`Refusing to publish unsafe id ${page.id}`);
  const target = resolve(outDir, 'pages', `${page.id}.json`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify({ id: page.id, title: page.title, meta: page.meta, html: page.html }));
}
const counts = Object.fromEntries(catalog.offices.map((office) => [office.label, catalog.files.filter((file) => file.office === office.id).length]));
console.log(`Essay browser: ${pages.length} pages from ${commit.slice(0, 12)} → public/essay-shell`);
console.log(counts);
