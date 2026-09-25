/** Build the Plate B publication from submission-package/essay.
 * Writes site/public/essay-shell/. Does not copy quilt, NOTES, reference-notes, or JSON.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ESSAY_REF, ESSAY_REMOTE, MANUSCRIPT_ID, isPublishedMarkdown, publishVault } from './essay-browser.mjs';

const exec = promisify(execFile);
const site = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(site, 'public/essay-shell');

function candidates() {
  const repo = resolve(site, '..');
  return [
    process.env.OI_ESSAY_BROWSER_REPO,
    process.env.OI_ESSAY_REPO,
    resolve(repo, 'Antykathera-Essay-Work'),
    resolve(repo, '..', 'Antykathera-Essay-Work'),
    resolve(repo, '..', '..', 'Antykathera-Essay-Work'),
  ].filter(Boolean);
}

function essayDir(root) {
  const nested = resolve(root, 'submission-package/essay');
  if (existsSync(resolve(nested, 'README.md'))) return nested;
  if (existsSync(resolve(root, 'README.md')) && existsSync(resolve(root, 'section-rooms'))) return root;
  return null;
}

async function ensureSource() {
  for (const candidate of candidates()) {
    const found = essayDir(candidate);
    if (found) return { root: dirname(dirname(found)) === candidate || existsSync(resolve(candidate, '.git')) ? candidate : found, essay: found };
  }
  const dest = resolve(site, '.essay-source');
  if (!existsSync(resolve(dest, '.git'))) {
    await exec('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', ESSAY_REF, ESSAY_REMOTE, dest]);
    await exec('git', ['-C', dest, 'sparse-checkout', 'set', 'submission-package/essay']);
  }
  const essay = essayDir(dest);
  if (!essay) throw new Error(`Cloned ${ESSAY_REF} but submission-package/essay was not there.`);
  return { root: dest, essay };
}

async function gitCommit(root) {
  try {
    const { stdout } = await exec('git', ['-C', root, 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    return 'unpinned';
  }
}

async function walk(dir, prefix = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'quilt' || entry.name === 'reference-notes' || entry.name === '.obsidian') continue;
      files.push(...await walk(abs, rel));
    } else if (entry.isFile() && isPublishedMarkdown(rel)) {
      files.push({ rel, text: await readFile(abs, 'utf8') });
    }
  }
  return files;
}

const { root, essay } = await ensureSource();
const commit = await gitCommit(root);
const files = await walk(essay);
const { catalog, pages } = publishVault(files, {
  repo: 'EpiLogos/Antykathera-Essay-Work',
  ref: ESSAY_REF,
  commit,
  path: 'submission-package/essay',
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
