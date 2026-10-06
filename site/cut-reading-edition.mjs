/** Cut a published-reading edition: the essay's public reading inputs, byte-bound, from a committed state of the vault.
 *
 *   node cut-reading-edition.mjs --vault <Antykathera-Essay-Work checkout> [--date YYYY-MM-DD] [--basis origin/main] [--push] [--scratch <dir>]
 *
 * The site (.github/workflows/site.yml) builds the essay from `published-reading/<date>/` on a `publication/reading-<date>`
 * branch of the vault, not from whatever main holds, so a deployment is always an edition somebody chose. This is the
 * "choose": it reads `submission-package/essay` as it stands at the basis commit (default: the vault's fetched origin/main —
 * never the working tree, so an author's uncommitted work is untouched and never read), keeps exactly the files the site's
 * own publisher admits (`readEssayInputs`: published markdown, the figures and the `images/` folders beside their records),
 * and commits them under `published-reading/<date>/` on a new commit whose parent is the basis. Nothing but that prefix
 * differs from the basis (checked). `PUBLICATION-INPUTS.json` records every file's sha256 and the input digest.
 *
 * The work is done in a scratch clone, so the vault checkout's branches, index and files are not changed. `--push` publishes
 * the branch to the vault's origin; without it the commit stays in the scratch clone (path printed). Afterwards move the
 * two pins in site.yml: the `essay-reading` checkout `ref` to the printed commit and `OI_ESSAY_BROWSER_REPO` to the new date.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { readEssayInputs } from './essay-source.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const vault = resolve(option('vault', ''));
if (!option('vault')) { console.error('usage: node cut-reading-edition.mjs --vault <checkout> [--date YYYY-MM-DD] [--basis origin/main] [--push]'); process.exit(2); }
const date = option('date', new Date().toISOString().slice(0, 10));
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date must be YYYY-MM-DD, got ${date}`);
const prefix = `published-reading/${date}`;
const branch = `publication/reading-${date}`;
const git = (cwd, gitArgs, opts = {}) => execFileSync('git', gitArgs, { cwd, maxBuffer: 1 << 28, ...opts }).toString().trim();

git(vault, ['fetch', 'origin', '--quiet']);
const basisName = option('basis', 'origin/main');
const basis = git(vault, ['rev-parse', `${basisName}^{commit}`]);
const origin = git(vault, ['remote', 'get-url', 'origin']);

const scratch = option('scratch') ? resolve(option('scratch')) : mkdtempSync(join(tmpdir(), 'reading-edition-'));
mkdirSync(scratch, { recursive: true });
const clone = join(scratch, 'vault');
git(scratch, ['clone', '--quiet', '--no-checkout', vault, clone]);
git(clone, ['remote', 'set-url', 'origin', origin]);
git(clone, ['fetch', '--quiet', vault, basis]);   // the basis may be a commit the clone's own ref list lacks

// the basis's reading inputs, extracted from the commit (not from the working tree)
const extracted = join(scratch, 'basis');
mkdirSync(extracted, { recursive: true });
execFileSync('sh', ['-c', `git -C "${clone}" archive ${basis} submission-package/essay | tar -x -C "${extracted}"`], { maxBuffer: 1 << 28 });
const inputs = await readEssayInputs(join(extracted, 'submission-package/essay'));

const index = join(scratch, 'edition.index');
const env = { ...process.env, GIT_INDEX_FILE: index };
git(clone, ['read-tree', basis], { env });
const updates = [];
for (const entry of inputs.entries) {
  const blob = git(clone, ['hash-object', '-w', '--stdin'], { input: entry.bytes });
  updates.push(`100644 ${blob}\t${prefix}/${entry.rel}\n`);
}
const receipt = {
  schema: 'essay.curated-reading-snapshot/v1',
  canonical_main: basis,
  input_sha256: inputs.inputSha256,
  foundation_slug: inputs.foundationSlug,
  files: inputs.files,
  standing: 'Reading projection of the essay vault as committed at canonical_main: the public reading inputs only (published markdown, figures and the images beside the records that cite them). Protected notes, working drafts and uncommitted authorial files are not read. Cut with site/cut-reading-edition.mjs.',
};
const receiptBlob = git(clone, ['hash-object', '-w', '--stdin'], { input: Buffer.from(JSON.stringify(receipt, null, 2) + '\n') });
updates.push(`100644 ${receiptBlob}\t${prefix}/PUBLICATION-INPUTS.json\n`);
git(clone, ['update-index', '--add', '--index-info'], { env, input: updates.join('') });
const tree = git(clone, ['write-tree'], { env });
const message = `Cut the essay reading edition ${date} from canonical main ${basis.slice(0, 8)}\n\nA byte-bound public projection (${inputs.files.length} files); canonical main, protected notes and authorial working drafts are preserved.\n`;
const commit = git(clone, ['commit-tree', tree, '-p', basis], { input: message });
git(clone, ['update-ref', `refs/heads/${branch}`, commit]);
const escaped = git(clone, ['diff', '--name-only', basis, commit]).split('\n').filter((p) => p && !p.startsWith(`${prefix}/`));
if (escaped.length) throw new Error(`The edition changed paths outside ${prefix}/: ${escaped.slice(0, 5).join(', ')}`);

if (args.includes('--push')) git(clone, ['push', 'origin', `${branch}:refs/heads/${branch}`]);
writeFileSync(join(scratch, 'EDITION.json'), JSON.stringify({ date, branch, commit, basis, files: inputs.files.length, input_sha256: inputs.inputSha256, pushed: args.includes('--push') }, null, 2) + '\n');
console.log(JSON.stringify({ date, branch, commit, basis, files: inputs.files.length, assets: inputs.files.filter((f) => f.kind === 'asset').length, input_sha256: inputs.inputSha256, pushed: args.includes('--push'), scratch }));
