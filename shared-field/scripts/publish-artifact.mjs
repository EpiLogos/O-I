#!/usr/bin/env node
/**
 * Local publication step for one curated HTML artifact (Lane C step 4):
 *   a Flow instance read through Central's own `central.files.read`, or a
 *   Central document read through `central.document.read`,
 *   + the owner's explicit selection (oi.curated-artifact-selection/v1)
 *   → publication bundle (oi.artifact-publication/v1)
 *   → REBUILT edition (index.html + projection.json + manifest.json)
 *   → hosted reducer arguments (hosted-args.json) for spacetimedb/field.sh `publish`
 *
 *   node shared-field/scripts/publish-artifact.mjs --selection sel.json --flow Control/user/flows/flow-….html --central ~/Central --out out/
 *   node shared-field/scripts/publish-artifact.mjs --selection sel.json --document <source_ref> --document-id <id> --central ~/Central --out out/
 *   … --wiki-reading project.json   # attests the node-source relation when the node lists the artifact as a source
 *   … --previous out/bundle.json    # re-project an existing lineage (P n+1)
 *   … --sentinel <text>             # refuse to write a publication in which the text appears
 *
 * No network here; the hosted push is `printf '{"kind":"publish","args":…}' | spacetimedb/field.sh`.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  curatedArtifactFromFlowInstance, curatedArtifactFromCentralDocument, projectCuratedArtifact, reprojectCuratedArtifact,
  hostedArtifactArgs, artifactExploreSeed, renderArtifactEdition, artifactEditionManifest, artifactPublicationPayloads, publicationSentinelLeaks,
} from '../curated-html-projection.mjs';

function parseArgs(argv) {
  const args = { sentinels: [], readings: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case '--selection': args.selection = value; index += 1; break;
      case '--flow': args.flow = value; index += 1; break;
      case '--document': args.document = value; index += 1; break;
      case '--document-id': args.documentId = value; index += 1; break;
      case '--project': args.project = value; index += 1; break;
      case '--central': args.central = value; index += 1; break;
      case '--wiki-reading': args.wikiReading = value; index += 1; break;
      case '--out': args.out = value; index += 1; break;
      case '--previous': args.previous = value; index += 1; break;
      case '--explore-base': args.exploreBase = value; index += 1; break;
      case '--edition-base': args.editionBase = value; index += 1; break;
      case '--sentinel': args.sentinels.push(value); index += 1; break;
      case '--published-at': args.publishedAt = value; index += 1; break;
      default: throw new Error(`Unknown argument: ${flag}`);
    }
  }
  if (!args.selection) throw new Error('--selection is required');
  if (!args.out) throw new Error('--out is required');
  if (!args.flow && !(args.document && args.documentId)) throw new Error('supply --flow <Central-relative path> or --document <source_ref> --document-id <id>');
  return args;
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function ctrlAction(action, input, cwd) {
  const result = spawnSync('ctrl', ['--json', 'action', 'run', action, JSON.stringify(input)], { cwd, encoding: 'utf8' });
  if (result.error) throw new Error(`ctrl could not run: ${result.error.message}`);
  let envelope;
  try { envelope = JSON.parse(result.stdout); } catch { throw new Error(`ctrl ${action} returned non-JSON: ${result.stdout.slice(0, 200)} ${result.stderr.slice(0, 200)}`); }
  if (!envelope.ok) throw new Error(`ctrl ${action} refused: ${JSON.stringify(envelope.error ?? envelope).slice(0, 400)}`);
  return envelope.data;
}

const args = parseArgs(process.argv.slice(2));
const cwd = args.central ?? process.env.CENTRAL_HOME ?? process.cwd();
const selection = readJson(args.selection);
const wikiReading = args.wikiReading ? readJson(args.wikiReading) : undefined;

let artifact;
if (args.flow) {
  const root = resolve(cwd);
  const location = { schema: 'central.path-ref/v1', ref: `central:path:${root}:${args.flow}`, root, path: args.flow };
  const reading = ctrlAction('central.files.read', { location }, cwd);
  artifact = curatedArtifactFromFlowInstance(reading.content, { ref: reading.location?.ref ?? location.ref, path: args.flow, revision: reading.revision });
} else {
  const reading = ctrlAction('central.document.read', { ...(args.project ? { project: args.project } : {}), source_ref: args.document, document_id: args.documentId }, cwd);
  artifact = curatedArtifactFromCentralDocument(reading);
}

const publishedAt = args.publishedAt ?? new Date().toISOString();
const input = { artifact, selection, wiki_reading: wikiReading, published_at: publishedAt, edition_base: args.editionBase };
const bundle = args.previous ? reprojectCuratedArtifact(readJson(args.previous), input) : projectCuratedArtifact(input);

const html = renderArtifactEdition(bundle.projection, { explore_base: args.exploreBase ?? '/explore.html' });
const manifest = artifactEditionManifest(bundle.projection, html);
const hostedArgs = hostedArtifactArgs(bundle);
const seed = artifactExploreSeed(bundle);
const payloads = artifactPublicationPayloads(bundle, { explore_base: args.exploreBase ?? '/explore.html' });
const leaks = args.sentinels.length ? publicationSentinelLeaks(payloads, args.sentinels) : [];
if (leaks.length) {
  console.error(`refusing to write: sentinel material present in ${leaks.join(', ')}`);
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
  artifact_ref: bundle.artifact_ref,
  hosted_ref: bundle.hosted_ref,
  carrier: bundle.carrier,
  projection_ref: bundle.projection.projection_ref,
  projection_revision: bundle.projection.projection_revision,
  source: bundle.source,
  source_moved: bundle.source_moved ?? null,
  selected: bundle.selected,
  withheld: bundle.withheld,
  node_relation: bundle.node_relation,
  edition_digest: manifest.digest.value,
  sentinels_checked: args.sentinels.length,
  out,
}, null, 2));
