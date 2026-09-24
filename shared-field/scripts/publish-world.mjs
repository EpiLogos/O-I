#!/usr/bin/env node
/**
 * Local publication step: native readings + explicit owner selection
 *   → publication bundle (oi.world-publication/v1)
 *   → standalone edition (index.html + projection.json + manifest.json)
 *   → hosted reducer arguments (hosted-args.json)
 *
 * Readings come either from files (`--reading <path>`, each recognised by the
 * schema it carries, bare or in its owner's `--json` envelope) or from the
 * owners themselves (`--from-ctrl`):
 *
 *   central.wiki.read / projectcentral.wiki.read     central.wiki-reading/v1
 *   central.position.list {project}                  central.position-listing/v1   (when the selection names Positions)
 *   aikit gateway who --project-world P --json       aikit.population-reading/v1   (when a Position is selected in "occupancy" mode)
 *   aikit wiki-construct inspect --file W <ref>      aikit.constellation/v1        (per selected constellation; W is each wiki
 *                                                                                  register central.world.here discloses)
 *
 * AIKit is the joiner of Actuation and Factory; this step never reads them
 * directly. It performs no network publication; `shared-field/spacetimedb/publish-world.ts`
 * pushes the bundle to a SharedField afterwards.
 *
 *   node shared-field/scripts/publish-world.mjs --selection sel.json --from-ctrl --out out/
 *   node shared-field/scripts/publish-world.mjs --selection sel.json --reading root.json --reading o-i.json --out out/
 *   ... --previous out/bundle.json      # re-project an existing lineage (P n+1)
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { projectCentralWikiWorld, reprojectCentralWikiWorld, hostedPublicationArgs, exploreSeedFromPublication, worldPublicationLeaks } from '../central-wiki-projection.mjs';
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

/** One AIKit read through its `--json` envelope; a refusal comes back as `{refused}` in AIKit's own words. */
function aikitRead(words, cwd) {
  const program = process.env.OI_AIKIT_BIN ?? 'aikit';
  const result = spawnSync(program, [...words, '--json'], { cwd, encoding: 'utf8' });
  if (result.error) throw new Error(`${program} could not run (${result.error.message}); the Position, occupancy and constellation reads come from AIKit — put aikit on PATH or name it with OI_AIKIT_BIN`);
  let envelope;
  try { envelope = JSON.parse(result.stdout); } catch { throw new Error(`aikit ${words.slice(0, 2).join(' ')} returned non-JSON: ${result.stdout.slice(0, 200)} ${result.stderr.slice(0, 200)}`); }
  if (envelope.ok !== true) return { refused: envelope.error ?? { message: 'refused without an error body' } };
  return { data: envelope.data };
}

const args = parseArgs(process.argv.slice(2));
const selection = readJson(args.selection);
const readings = args.readings.map(readJson);
if (args.fromCtrl) {
  const cwd = args.central ?? process.env.CENTRAL_HOME ?? process.cwd();
  const scope = selection.project ? { project: selection.project } : {};
  readings.push(ctrlAction('central.wiki.read', {}, cwd));
  if (selection.project) readings.push(ctrlAction('projectcentral.wiki.read', { project: selection.project }, cwd));
  const modes = Object.values(selection.positions ?? {});
  if (modes.length) readings.push(ctrlAction('central.position.list', scope, cwd));
  if (modes.includes('occupancy')) {
    const who = aikitRead(['gateway', 'who', ...(selection.project ? ['--project-world', `project:${selection.project}`] : [])], cwd);
    if (who.refused) throw new Error(`aikit gateway who refused: ${who.refused.code ?? ''} ${who.refused.message ?? ''}`.trim());
    readings.push(who.data);
  }
  if ((selection.constellations ?? []).length) {
    // Central discloses where each register's wiki lives; AIKit reads the
    // constellation from it. The frame lives in exactly one register.
    const here = ctrlAction('central.world.here', scope, cwd);
    const root = here.local_world?.root;
    const registers = [here.project_world?.roots?.wiki, here.local_world?.roots?.wiki].filter((path) => typeof path === 'string' && path);
    if (!root || registers.length === 0) throw new Error('central.world.here disclosed no wiki register to read constellations from');
    for (const ref of selection.constellations) {
      const refusals = [];
      let found;
      for (const path of registers) {
        const file = isAbsolute(path) ? path : join(root, path);
        const read = aikitRead(['wiki-construct', 'inspect', '--file', file, ref], cwd);
        if (read.data) { found = read.data; break; }
        refusals.push(`${path}: ${read.refused.message ?? read.refused.code}`);
      }
      if (!found) throw new Error(`constellation ${ref} is not readable from any disclosed wiki register (${refusals.join('; ')})`);
      readings.push(found);
    }
  }
}

const publishedAt = args.publishedAt ?? new Date().toISOString();
const bundle = args.previous
  ? reprojectCentralWikiWorld(readJson(args.previous), { readings, selection, published_at: publishedAt })
  : projectCentralWikiWorld({ readings, selection, published_at: publishedAt });

const html = renderWorldEdition(bundle.projection, { explore_base: args.exploreBase ?? '/explore.html' });
const manifest = worldEditionManifest(bundle.projection, html);
const hostedArgs = hostedPublicationArgs(bundle);
const seed = exploreSeedFromPublication(bundle);

// The publisher's own sentinels plus the protected inhabitation material the
// readings carry (session and SessionSpace refs, gateway addresses and tokens,
// attention, Communique bodies, protected purpose refs) — always checked.
const leaks = worldPublicationLeaks({ bundle, hosted_args: hostedArgs, explore_seed: seed, edition_html: html, edition_manifest: manifest }, readings, args.sentinels);
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
  moved_sources: bundle.moved_sources ?? null,
  sources: bundle.sources,
  entries: bundle.entries.length,
  entry_kinds: bundle.entries.reduce((counts, entry) => ({ ...counts, [entry.kind]: (counts[entry.kind] ?? 0) + 1 }), {}),
  relations: bundle.relations.length,
  excluded: bundle.excluded,
  edition_digest: manifest.digest.value,
  sentinels_checked: args.sentinels.length,
}, null, 2));
