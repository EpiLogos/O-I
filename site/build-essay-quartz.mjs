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
import { resolveEssaySource, readEssayInputs, stageEssayInputs, essayInputReceipt } from './essay-source.mjs';

const exec = promisify(execFile);
const site = dirname(fileURLToPath(import.meta.url));
const quartzDir = resolve(site, 'vendor/quartz');
const contentDir = resolve(quartzDir, 'content');
const outDir = resolve(site, '.public-edition/essay');

const source = await resolveEssaySource({ siteDirectory: site });
const inputs = await readEssayInputs(source.essay);
const { staged, assets, frontmatterFixed } = await stageEssayInputs(inputs, contentDir);
const vaultCommit = source.commit;

await rm(outDir, { recursive: true, force: true });
const { stdout, stderr } = await exec(process.execPath, [resolve(quartzDir, 'quartz/bootstrap-cli.mjs'), 'build', '-d', 'content', '-o', outDir], {
  cwd: quartzDir,
  env: { ...process.env, OI_QUARTZ_STAGED_INPUTS: '1' },
});
if (stdout) process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);
if (!existsSync(resolve(outDir, 'index.html'))) throw new Error('Quartz build did not emit essay/index.html.');

const stamp = {
  schema: 'oi.essay-quartz-source/v1',
  ...essayInputReceipt(source, inputs),
  quartz_commit: 'd25a6eabf96751ffca56f8a8139272def7a65041',
  staged_files: staged,
  staged_assets: assets,
  frontmatter_deduped: frontmatterFixed,
  built_at_iso: new Date().toISOString(),
};
await writeFile(join(outDir, 'quartz-source.json'), JSON.stringify(stamp, null, 2) + '\n');
console.log(`Quartz essay publication: ${staged} published pages + ${assets} visual assets from ${source.remote}@${vaultCommit.slice(0, 9)} at .public-edition/essay. Frontmatter deduped in ${frontmatterFixed} files (Notion import duplicate source_id).`);
