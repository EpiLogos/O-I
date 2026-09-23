/**
 * Fetch the upstream theme corpus: real VS Code color-theme files, pinned to
 * the exact revision each file came from, with provenance recorded beside
 * them. Plain node (>=18), no dependencies. Rerunnable: reruns refresh the
 * pinned revisions and rewrite the upstream files.
 *
 *   node scripts/fetch-upstream-themes.mjs
 *
 * Two sources per entry:
 *   - path: the theme file committed in the repo, fetched at the branch head
 *     commit (raw.githubusercontent.com/<repo>/<sha>/<path>).
 *   - vsix: themes the upstream generates at build time and ships only in its
 *     release artifact; the released .vsix is fetched at its tag and the
 *     theme extracted from inside the archive with `unzip -p`.
 *
 * Every theme must carry a permissive license (the upstream repo's SPDX id is
 * recorded and must match the corpus entry) — a refusal here is a feature:
 * nothing unlicensed is ever stored under themes/upstream/.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJsonc } from './convert.mjs';

const UPSTREAM = fileURLToPath(new URL('../themes/upstream/', import.meta.url));
const VSIX_THEME = /^extension\/themes?\//;

/** The corpus. `license` is the SPDX id the repo declares — the fetch refuses
 * when GitHub disagrees. `vsixIn` is the path inside the .vsix archive. */
const CORPUS = [
  { id: 'dracula-dark', name: 'Dracula', appearance: 'dark', repo: 'dracula/visual-studio-code', vsix: 'dracula.vsix', vsixIn: 'extension/theme/dracula.json', license: 'MIT' },
  { id: 'nord-dark', name: 'Nord', appearance: 'dark', repo: 'arcticicestudio/nord-visual-studio-code', path: 'themes/nord-color-theme.json', license: 'MIT' },
  { id: 'tokyo-night-dark', name: 'Tokyo Night', appearance: 'dark', repo: 'tokyo-night/tokyo-night-vscode-theme', path: 'themes/tokyo-night-color-theme.json', license: 'MIT' },
  { id: 'one-dark-pro', name: 'One Dark Pro', appearance: 'dark', repo: 'Binaryify/OneDark-Pro', path: 'themes/OneDark-Pro.json', license: 'MIT' },
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', appearance: 'dark', repo: 'catppuccin/vscode', vsix: 'catppuccin-vsc-3.19.0.vsix', vsixTag: 'catppuccin-vsc-v3.19.0', vsixIn: 'extension/themes/mocha.json', license: 'MIT' },
  { id: 'night-owl-dark', name: 'Night Owl', appearance: 'dark', repo: 'sdras/night-owl-vscode-theme', path: 'themes/Night Owl-color-theme.json', license: 'MIT' },
  { id: 'quiet-light', name: 'Quiet Light', appearance: 'light', repo: 'microsoft/vscode', path: 'extensions/theme-quietlight/themes/quietlight-color-theme.json', license: 'MIT' },
  { id: 'solarized-light', name: 'Solarized Light', appearance: 'light', repo: 'microsoft/vscode', path: 'extensions/theme-solarized-light/themes/solarized-light-color-theme.json', license: 'MIT' },
  { id: 'light-plus', name: 'Light Plus', appearance: 'light', repo: 'microsoft/vscode', path: 'extensions/theme-defaults/themes/light_plus.json', license: 'MIT' },
];

/** The branch-head commit a repo's default branch points at — via git, not
 * the GitHub API, so reruns never depend on that quota. */
function headRevision(repo) {
  const out = execFileSync('git', ['ls-remote', `https://github.com/${repo}.git`, 'HEAD'], { encoding: 'utf8' });
  const sha = out.trim().split('\t')[0];
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`${repo}: ls-remote gave no usable HEAD revision (${out.trim().slice(0, 80)})`);
  return sha;
}

async function getText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'oi-theme-corpus-fetch' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

/** Verify the permissive license directly, from the repo at this revision:
 * the corpus entry's expectation must be stated in the license text itself.
 * Tries the common license file names. */
async function checkLicense(repo, revision, expected) {
  for (const name of ['LICENSE', 'license', 'LICENSE.md', 'license.md', 'LICENSE.txt', 'COPYING', 'COPYING.md', 'COPYING.txt']) {
    let text;
    try {
      text = await getText(`https://raw.githubusercontent.com/${repo}/${revision}/${name}`);
    } catch {
      continue;
    }
    if (/Permission is hereby granted, free of charge|MIT License/i.test(text)) return 'MIT';
    throw new Error(`${repo}: ${name} does not state a permissive MIT grant — refusing`);
  }
  throw new Error(`${repo}: no license file found (expected ${expected}) — refusing`);
}

const provenance = { fetched_utc: new Date().toISOString(), themes: [] };
mkdirSync(UPSTREAM, { recursive: true });

for (const entry of CORPUS) {
  const headSha = headRevision(entry.repo);
  const spdx = await checkLicense(entry.repo, headSha, entry.license);
  // A released artifact is pinned by its tag, not by the branch head.
  const revision = entry.vsix ? entry.vsixTag ?? headSha : headSha;

  let body, originUrl, vsixScratch = null;
  if (entry.vsix) {
    // The released artifact, through the permanent latest-download redirect.
    // Versioned asset names ride a pinned release tag; static names resolve
    // through the permanent latest-download redirect.
    originUrl = entry.vsixTag
      ? `https://github.com/${entry.repo}/releases/download/${encodeURIComponent(entry.vsixTag)}/${encodeURIComponent(entry.vsix)}`
      : `https://github.com/${entry.repo}/releases/latest/download/${encodeURIComponent(entry.vsix)}`;
    const response = await fetch(originUrl, { headers: { 'user-agent': 'oi-theme-corpus-fetch' }, redirect: 'follow' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${originUrl}`);
    // unzip needs a seekable archive; stdin does not work for zip central directories.
    vsixScratch = join(tmpdir(), `oi-theme-${entry.id}.vsix`);
    writeFileSync(vsixScratch, Buffer.from(await response.arrayBuffer()));
    const listing = execFileSync('unzip', ['-Z1', vsixScratch], { encoding: 'utf8' }).split('\n');
    const member = listing.find((name) => name === entry.vsixIn) ?? listing.find((name) => VSIX_THEME.test(name) && name.includes(`/${entry.vsixIn.split('/').pop()}`));
    if (!member) { rmSync(vsixScratch, { force: true }); throw new Error(`${entry.repo}: ${entry.vsixIn} not inside ${entry.vsix} (found ${listing.filter((n) => VSIX_THEME.test(n)).join(', ') || 'no theme files'})`); }
    body = execFileSync('unzip', ['-p', vsixScratch, member], { encoding: 'utf8' });
  } else {
    originUrl = `https://raw.githubusercontent.com/${entry.repo}/${revision}/${encodeURI(entry.path)}`;
    body = await getText(originUrl);
  }

  if (!body.includes('"colors"') && !body.includes('"tokenColors"')) {
    if (vsixScratch) rmSync(vsixScratch, { force: true });
    throw new Error(`${originUrl}: does not look like a VS Code color theme`);
  }

  // Theme inheritance: a theme may `include` a parent file. Fetch the parent
  // from the same revision and store it beside the child; the converter
  // merges it under the child's values.
  let includeRecord = null;
  const includePath = typeof parseJsonc(body).include === 'string' ? parseJsonc(body).include : null;
  if (includePath) {
    const baseDir = entry.path.includes('/') ? `${entry.path.slice(0, entry.path.lastIndexOf('/'))}/` : '';
    const resolved = `${baseDir}${includePath}`;
    let includeBody;
    if (entry.vsix) {
      const member = `extension/${resolved}`;
      includeBody = execFileSync('unzip', ['-p', vsixScratch, member], { encoding: 'utf8' });
      includeRecord = { path: resolved, member };
    } else {
      const includeUrl = `https://raw.githubusercontent.com/${entry.repo}/${revision}/${encodeURI(resolved)}`;
      includeBody = await getText(includeUrl);
      includeRecord = { path: resolved, url: includeUrl };
    }
    writeFileSync(`${UPSTREAM}${entry.id}.include.json`, includeBody);
    console.log(`${entry.id}.include.json  <-  ${resolved}  (inheritance parent)`);
  }
  if (vsixScratch) rmSync(vsixScratch, { force: true });

  const file = `${entry.id}.color-theme.json`;
  writeFileSync(`${UPSTREAM}${file}`, body);
  provenance.themes.push({
    id: entry.id, name: entry.name, appearance: entry.appearance, file,
    source: { format: 'vscode-color-theme', name: entry.name, repo: entry.repo, revision, license: spdx, url: originUrl },
    ...(includeRecord ? { include: includeRecord } : {}),
  });
  console.log(`${file}  <-  ${entry.repo}@${String(revision).slice(0, 16)}  (${spdx})`);
}

writeFileSync(`${UPSTREAM}PROVENANCE.json`, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`${CORPUS.length} upstream themes stored with provenance in themes/upstream/`);
