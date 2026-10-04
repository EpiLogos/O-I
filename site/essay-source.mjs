/** Resolve and fingerprint the actual curated essay inputs for both publishers. */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, posix } from 'node:path';
import { promisify } from 'node:util';
import { ESSAY_REF, ESSAY_REMOTE, isPublishedMarkdown } from './essay-browser.mjs';

const exec = promisify(execFile);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const visualDomains = ['symbolon/matheme/diagrams/', 'symbolon/mytheme/plates/', 'symbolon/mytheme/media/', 'symbolon/episteme/figures/'];
const assetExtensions = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.pdf', '.mp4', '.webm', '.mp3', '.wav', '.ogg']);

function essayDir(root) {
  const nested = resolve(root, 'submission-package/essay');
  if (existsSync(join(nested, 'README.md'))) return nested;
  if (existsSync(join(root, 'README.md')) && existsSync(join(root, 'section-rooms'))) return root;
  return null;
}

export async function resolveEssaySource({ siteDirectory, candidates, remote = ESSAY_REMOTE, ref = ESSAY_REF }) {
  const parent = resolve(siteDirectory, '..');
  const choices = candidates ?? [process.env.OI_ESSAY_BROWSER_REPO, process.env.OI_ESSAY_REPO,
    join(parent, 'Antykathera-Essay-Work'), resolve(parent, '../Antykathera-Essay-Work'), resolve(parent, '../../Antykathera-Essay-Work')].filter(Boolean);
  let root, essay, managed = false;
  for (const candidate of choices) {
    const found = essayDir(candidate);
    if (found) { root = candidate; essay = found; break; }
  }
  if (!essay) {
    managed = true;
    root = resolve(siteDirectory, '.essay-source');
    if (!existsSync(join(root, '.git'))) {
      await exec('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', ref, remote, root]);
      await exec('git', ['-C', root, 'sparse-checkout', 'set', 'submission-package/essay']);
    } else {
      const { stdout } = await exec('git', ['-C', root, 'status', '--porcelain', '--untracked-files=all']);
      if (stdout.trim()) throw new Error('The managed essay-source cache has local edits; preserve them before refreshing it.');
      await exec('git', ['-C', root, 'fetch', '--depth', '1', remote, ref]);
      await exec('git', ['-C', root, 'checkout', '--detach', 'FETCH_HEAD']);
    }
    essay = essayDir(root);
    if (!essay) throw new Error(`The selected essay source ${remote}@${ref} has no publication body.`);
  }
  const { stdout: commit } = await exec('git', ['-C', essay, 'rev-parse', 'HEAD']);
  const { stdout: status } = await exec('git', ['-C', essay, 'status', '--porcelain', '--untracked-files=all', '--', '.']);
  const { stdout: branch } = await exec('git', ['-C', essay, 'branch', '--show-current']);
  return { root, essay, commit: commit.trim(), ref: managed ? ref : (branch.trim() || commit.trim()),
    remote, workingTreeDirty: Boolean(status.trim()) };
}

export async function readEssayInputs(essay) {
  const entries = [];
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['quilt', 'reference-notes', 'private', 'templates'].includes(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(dir, entry.name), rel);
      else if (entry.isFile() && (isPublishedMarkdown(rel) ||
        (visualDomains.some(domain => rel.startsWith(domain)) && assetExtensions.has(extname(rel).toLowerCase())))) {
        const bytes = await readFile(join(dir, entry.name));
        entries.push({ rel, bytes, sha256: sha256(bytes), kind: rel.endsWith('.md') ? 'markdown' : 'asset' });
      }
    }
  }
  await walk(essay);
  entries.sort((a,b) => a.rel.localeCompare(b.rel));
  const markdown = entries.filter(entry => entry.kind === 'markdown');
  if (!markdown.some(entry => entry.rel === 'README.md')) throw new Error('The essay reading root is missing.');
  const foundation = markdown.find(entry => /^section-rooms\/00-integral-threshold\/ROOM(?:-00-integral-threshold)?\.md$/.test(entry.rel));
  if (!foundation) throw new Error('The §0/1 section-room anchor is missing.');
  const files = entries.map(({ rel, sha256, kind }) => ({ path: rel, sha256, kind }));
  return { entries, files, inputSha256: sha256(JSON.stringify(files)), foundationSlug: foundation.rel.slice(0,-3) };
}

/** Native ingest binds the last explicit key; retain that choice in Quartz. */
export function dedupeFrontmatter(text) {
  if (!text.startsWith('---\n')) return { text, changed: false };
  const end = text.indexOf('\n---', 3);
  if (end < 0) return { text, changed: false };
  const lines = text.slice(0,end).split('\n');
  const last = new Map();
  for (let i=0;i<lines.length;i++) {
    const key = lines[i].match(/^([A-Za-z0-9_]+):/);
    if (key) last.set(key[1],i);
  }
  let changed = false;
  const kept = lines.filter((line,i) => {
    const key = line.match(/^([A-Za-z0-9_]+):/);
    if (key && last.get(key[1]) !== i) { changed = true; return false; }
    return true;
  });
  return { text: changed ? kept.join('\n') + text.slice(end) : text, changed };
}

export async function stageEssayInputs(inputs, contentDir) {
  await rm(contentDir,{ recursive:true,force:true });
  await mkdir(contentDir,{ recursive:true });
  let frontmatterFixed=0;
  for (const entry of inputs.entries) {
    const path=entry.rel==='README.md' ? 'index.md' : entry.rel;
    const dest=join(contentDir,path); await mkdir(dirname(dest),{ recursive:true });
    if (entry.kind==='markdown') {
      const normalized=dedupeFrontmatter(entry.bytes.toString('utf8'));
      if (normalized.changed) frontmatterFixed++;
      // Consumer links into the private working desk remain native source relations,
      // but they cannot be clickable routes in the curated public reading edition.
      const publicText = normalized.text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (link,label,target) => {
        if (/^(?:https?:|mailto:|#)/.test(target)) return link;
        const path = posix.normalize(posix.join(posix.dirname(entry.rel),target.split('#')[0]));
        return /^\.\.\/(?:\.\.\/)*working\//.test(path) ? label : link;
      });
      await writeFile(dest,publicText);
    } else await writeFile(dest,entry.bytes);
  }
  return { staged:inputs.entries.filter(entry=>entry.kind==='markdown').length,
    assets:inputs.entries.filter(entry=>entry.kind==='asset').length,frontmatterFixed };
}

export function essayInputReceipt(source,inputs) {
  return { vault_remote:source.remote,vault_ref:source.ref,vault_commit:source.commit,
    working_tree_dirty:source.workingTreeDirty,input_sha256:inputs.inputSha256,
    foundation_slug:inputs.foundationSlug,files:inputs.files };
}
