#!/usr/bin/env node
/**
 * Local publication step: native wiki readings + explicit owner selection
 *   → publication bundle (oi.world-publication/v1)
 *   → standalone edition (index.html + projection.json + manifest.json)
 *   → hosted reducer arguments (hosted-args.json)
 *
 * Readings come either from files (`--reading <path>`) or from Central's own
 * Actions (`--from-ctrl`, which runs `ctrl --json action run central.wiki.read`
 * and `projectcentral.wiki.read` for the project the selection names). This
 * step performs no network publication; `shared-field/spacetimedb/publish-world.ts`
 * pushes the bundle to a SharedField afterwards.
 *
 *   node shared-field/scripts/publish-world.mjs --selection sel.json --from-ctrl --out out/
 *   node shared-field/scripts/publish-world.mjs --selection sel.json --reading root.json --reading o-i.json --out out/
 *   ... --previous out/bundle.json      # re-project an existing lineage (P n+1)
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { projectCentralWikiWorld, reprojectCentralWikiWorld, hostedPublicationArgs, exploreSeedFromPublication, publicationSentinelLeaks } from '../central-wiki-projection.mjs';
import { renderWorldEdition, worldEditionManifest } from '../world-edition.mjs';

function parseArgs(argv) {
  const args = { readings: [], sentinels: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case '--selection': args.selection = value; index += 1; break;
      case '--reading': args.readings.push(value); index += 1; break;
      case '--from-ctrl': args.fromCtrl = true; break;
      case '--central': args.central = value; index += 1; break;
      case '--out': args.out = value; index += 1; break;
      case '--previous': args.previous = value; index += 1; break;
      case '--explore-base': args.exploreBase = value; index += 1; break;
      case '--sentinel': args.sentinels.push(value); index += 1; break;
      case '--published-at': args.publishedAt = value; index += 1; break;
      default: throw new Error(`Unknown argument: ${flag}`);
    }
  }
  if (!args.selection) throw new Error('--selection is required');
  if (!args.out) throw new Error('--out is required');
  if (args.readings.length === 0 && !args.fromCtrl) throw new Error('supply --reading files or --from-ctrl');
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ctrlAction(action, input, cwd) {
  const result = spawnSync('ctrl', ['--json', 'action', 'run', action, JSON.stringify(input)], { cwd, encoding: 'utf8' });
  if (result.error) throw new Error(`ctrl could not run: ${result.error.message}`);
  let envelope;
  try { envelope = JSON.parse(result.stdout); } catch { throw new Error(`ctrl ${action} returned non-JSON: ${result.stdout.slice(0, 200)} ${result.stderr.slice(0, 200)}`); }
  if (!envelope.ok) throw new Error(`ctrl ${action} refused: ${JSON.stringify(envelope).slice(0, 400)}`);
  return envelope.data;
}

const args = parseArgs(process.argv.slice(2));
const selection = readJson(args.selection);
const readings = args.readings.map(readJson);
if (args.fromCtrl) {
  const cwd = args.central ?? process.env.CENTRAL_HOME ?? process.cwd();
  readings.push(ctrlAction('central.wiki.read', {}, cwd));
  if (selection.project) readings.push(ctrlAction('projectcentral.wiki.read', { project: selection.project }, cwd));
}

const publishedAt = args.publishedAt ?? new Date().toISOString();
const bundle = args.previous
  ? reprojectCentralWikiWorld(readJson(args.previous), { readings, selection, published_at: publishedAt })
  : projectCentralWikiWorld({ readings, selection, published_at: publishedAt });

const html = renderWorldEdition(bundle.projection, { explore_base: args.exploreBase ?? '/explore.html' });
const manifest = worldEditionManifest(bundle.projection, html);
const hostedArgs = hostedPublicationArgs(bundle);
const seed = exploreSeedFromPublication(bundle);

const leaks = args.sentinels.length
  ? publicationSentinelLeaks({ bundle, hosted_args: hostedArgs, explore_seed: seed, edition_html: html, edition_manifest: manifest }, args.sentinels)
  : [];
if (leaks.length) {
  console.error(JSON.stringify({ ok: false, error: 'publication would leak sentinel material', leaks }));
  process.exit(2);
}

const out = resolve(args.out);
mkdirSync(join(out, 'edition'), { recursive: true });
writeFileSync(join(out, 'bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
writeFileSync(join(out, 'hosted-args.json'), `${JSON.stringify(hostedArgs, null, 2)}\n`);
writeFileSync(join(out, 'explore-seed.json'), `${JSON.stringify(seed, null, 2)}\n`);
writeFileSync(join(out, 'edition', 'index.html'), html);
writeFileSync(join(out, 'edition', 'projection.json'), `${JSON.stringify(bundle.projection, null, 2)}\n`);
writeFileSync(join(out, 'edition', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  out,
  world_ref: bundle.world_ref,
  projection_ref: bundle.projection.projection_ref,
  projection_revision: bundle.projection.projection_revision,
  source: bundle.source,
  source_moved: bundle.source_moved ?? null,
  entries: bundle.entries.length,
  relations: bundle.relations.length,
  excluded: bundle.excluded,
  edition_digest: manifest.digest.value,
  sentinels_checked: args.sentinels.length,
}, null, 2));
