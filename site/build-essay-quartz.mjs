/** Build the Quartz essay publication into the public edition.
 *
 * Stages the published scope of the essay vault (the same curation as
 * essay-browser.mjs: no quilt, NOTES, reference-notes, or JSON) into
 * vendor/quartz/content, runs the Quartz build, and emits the result at
 * .public-edition/essay — the address /essay serves in production.
 * See ESSAY-QUARTZ-HARD-BRIEF-2026-09-25.md.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ESSAY_REF, ESSAY_REMOTE, isPublishedMarkdown } from './essay-browser.mjs';

const exec = promisify(execFile);
const site = dirname(fileURLToPath(import.meta.url));
const quartzDir = resolve(site, 'vendor/quartz');
const contentDir = resolve(quartzDir, 'content');
const outDir = resolve(site, '.public-edition/essay');

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
    if (found) return found;
  }
  const dest = resolve(site, '.essay-source');
  if (!existsSync(resolve(dest, '.git'))) {
    await exec('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', ESSAY_REF, ESSAY_REMOTE, dest]);
    await exec('git', ['-C', dest, 'sparse-checkout', 'set', 'submission-package/essay']);
  }
  const essay = essayDir(dest);
  if (!essay) throw new Error(`Cloned ${ESSAY_REF} but submission-package/essay was not there.`);
  return essay;
}

async function gitCommitAt(dir) {
  try {
    const { stdout } = await exec('git', ['-C', dir, 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    return 'unpinned';
  }
}

/** Quartz's frontmatter parser rejects duplicate YAML keys. The vault's
 * Notion imports wrote source_id twice (uuid, then slug); first wins. */
function dedupeFrontmatter(text) {
  if (!text.startsWith('---\n')) return { text, changed: false };
  const end = text.indexOf('\n---', 3);
  if (end < 0) return { text, changed: false };
  const head = text.slice(0, end);
  const rest = text.slice(end);
  const lines = head.split('\n');
  const seen = new Set();
  let changed = false;
  const kept = lines.filter((line) => {
    const match = line.match(/^([A-Za-z0-9_]+):/);
    if (!match) return true;
    if (seen.has(match[1])) { changed = true; return false; }
    seen.add(match[1]);
    return true;
  });
  return { text: changed ? kept.join('\n') + rest : text, changed };
}

async function stageContent(essay) {
  await rm(contentDir, { recursive: true, force: true });
  await mkdir(contentDir, { recursive: true });
  let staged = 0;
  let frontmatterFixed = 0;
  const walk = async (dir, prefix = '') => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(resolve(dir, entry.name), rel);
      } else if (entry.isFile() && isPublishedMarkdown(rel)) {
        // The vault's root README is the reading root; Quartz serves index.md there.
        const destRel = prefix === '' && entry.name === 'README.md' ? 'index.md' : rel;
        const dest = resolve(contentDir, destRel);
        await mkdir(dirname(dest), { recursive: true });
        const raw = await readFile(resolve(dir, entry.name), 'utf8');
        const { text, changed } = dedupeFrontmatter(raw);
        if (changed) frontmatterFixed += 1;
        await writeFile(dest, text);
        staged += 1;
      }
    }
  };
  await walk(essay);
  if (staged === 0) throw new Error('No published essay markdown found to stage.');
  return { staged, frontmatterFixed };
}

const essay = await ensureSource();
const { staged, frontmatterFixed } = await stageContent(essay);
const vaultCommit = await gitCommitAt(essay);

await rm(outDir, { recursive: true, force: true });
await exec('npx', ['quartz', 'build', '-d', 'content', '-o', outDir], { cwd: quartzDir });
if (!existsSync(resolve(outDir, 'index.html'))) throw new Error('Quartz build did not emit essay/index.html.');

const stamp = {
  schema: 'oi.essay-quartz-source/v1',
  vault_remote: ESSAY_REMOTE,
  vault_ref: ESSAY_REF,
  vault_commit: vaultCommit,
  quartz_commit: 'd25a6eabf96751ffca56f8a8139272def7a65041',
  staged_files: staged,
  frontmatter_deduped: frontmatterFixed,
  built_at_iso: new Date().toISOString(),
};
await writeFile(join(outDir, 'quartz-source.json'), JSON.stringify(stamp, null, 2) + '\n');
console.log(`Quartz essay publication: ${staged} published files from ${ESSAY_REMOTE}@${vaultCommit.slice(0, 9)} at .public-edition/essay. Frontmatter deduped in ${frontmatterFixed} files (Notion import duplicate source_id).`);
