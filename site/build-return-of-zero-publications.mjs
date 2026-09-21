/** Producer for the Return-of-Zero public corpus.
 *
 * Reads the deliberately published native collection envelope
 * (desktop/cradle/expressions-app/collections/return-of-zero/, generator
 * scripts/export-return-of-zero-publication.mjs @ track3-2026-09-19) and the
 * essay sources it pins (EpiLogos/Antykathera-Essay-Work @ dbf3b17), verifies
 * every pinned digest, and emits the audience-bound public outputs the site
 * receiver admits: one `oi.world-publication/v1` and one
 * `oi.expression-publication/v1` per collection member.
 *
 * Nothing is invented here: refs derive from the envelope's
 * `oi.legacy-collections/v1` member ids, reading bodies come from the pinned
 * section-room sources and the authored journey movements, Expression
 * compositions come from the journeys' own formations, and the publisher
 * identity is the envelope's declared `frank-sovereign` ownership. The build
 * is deterministic: `published_at` is pinned to the envelope's export time so
 * byte/set verification reproduces.
 *
 * Outputs land OUTSIDE public/ (site/publications/return-of-zero/); only
 * build-publications.mjs admits them into browser assets.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createWorldPresentation } from '../shared-field/presentation.mjs';
import { createWorldPresentationProjection } from '../shared-field/presentation-projection.mjs';
import { createExploreEntry } from '../shared-field/explore.mjs';
import { projectExpression } from '../shared-field/expression-projection.mjs';

const exec = promisify(execFile);
const site = dirname(fileURLToPath(import.meta.url));
const repo = resolve(site, '..');
const envelopeDir = resolve(repo, 'desktop/cradle/expressions-app/collections/return-of-zero');
const essayRepo = process.env.OI_ESSAY_REPO
  || [resolve(repo, 'Antykathera-Essay-Work'), resolve(repo, '..', '..', 'Antykathera-Essay-Work')].find((candidate) => existsSync(candidate))
  || resolve(repo, '..', '..', 'Antykathera-Essay-Work');
const outDir = resolve(site, 'publications/return-of-zero');
const sha = (value) => createHash('sha256').update(value).digest('hex');

const envelope = JSON.parse(await readFile(resolve(envelopeDir, 'PUBLICATION.json'), 'utf8'));
if (envelope.schema !== 'oi.collection-publication/v1') throw new Error(`Unexpected collection envelope schema: ${envelope.schema}`);
const publishedAt = envelope.exported_at;
const sourceCommit = envelope.source_revision.commit;

// ---------------------------------------------------------------------------
// 1. Basis reconciliation: every pinned digest must match the pinned commit
//    AND the current checkout, or the corpus is not publishable as-is.
// ---------------------------------------------------------------------------
const reconciliation = { source_commit: sourceCommit, essay_repo: essayRepo, bindings: [], assets: [] };
async function blobAt(commit, path) {
  try { const { stdout } = await exec('git', ['-C', essayRepo, 'show', `${commit}:${path}`], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }); return stdout; }
  catch { return null; }
}
for (const manifest of envelope.manifests) {
  for (const binding of manifest.source_bindings) {
    const pinned = await blobAt(sourceCommit, binding.path);
    const current = await blobAt('HEAD', binding.path);
    const entry = { path: binding.path, sha256: binding.sha256, at_pinned_commit: Boolean(pinned) && sha(pinned) === binding.sha256, at_current_checkout: Boolean(current) && sha(current) === binding.sha256 };
    reconciliation.bindings.push(entry);
    if (!entry.at_pinned_commit) throw new Error(`Source binding ${binding.path} does not match ${sourceCommit}; the corpus basis moved. Reconcile before publishing.`);
    if (!entry.at_current_checkout) throw new Error(`Source binding ${binding.path} differs from the current checkout; record the drift before publishing.`);
  }
}
for (const asset of envelope.required_assets) {
  const bytes = await readFile(resolve(envelopeDir, '..', '..', asset.asset)).catch(() => null);
  const ok = Boolean(bytes) && sha(bytes) === asset.sha256;
  reconciliation.assets.push({ asset: asset.asset, present_and_pinned: ok });
  if (!ok) throw new Error(`Required collection asset ${asset.asset} is missing or does not match its pinned digest.`);
}

// ---------------------------------------------------------------------------
// 2. Native identities, all derived from the envelope.
// ---------------------------------------------------------------------------
const WORLD = 'world:return-of-zero';
const FIELD = 'field:return-of-zero-public';
const EXPRESSION_FIELD = 'field:return-of-zero-expressions';
const COLLECTION_REF = 'world:return-of-zero/wiki:return-of-zero';
const MEMBER_REVISION = sourceCommit;
const publisherIdentity = 'human:frank-sovereign'; // the envelope's declared ownership
const provenance = [{ kind: 'collection-publication', ref: 'desktop/cradle/expressions-app/collections/return-of-zero', source_system: 'o-i', revision: 'track3-2026-09-19' }];

const members = [];
for (const manifest of envelope.manifests) {
  const manifestDoc = JSON.parse(await readFile(resolve(envelopeDir, manifest.manifest.split('return-of-zero/')[1]), 'utf8'));
  for (const featured of manifestDoc.featured) members.push({ ...featured, manifest: manifest.manifest });
}
if (members.length !== 9) throw new Error(`Expected the nine published members, found ${members.length}.`);

// ---------------------------------------------------------------------------
// 3. Reading bodies: the pinned section-room prose; the essay member carries
//    its authored reading-path movements. Markdown navigation chrome is
//    dropped; no prose is rewritten.
// ---------------------------------------------------------------------------
function plainMarkdown(markdown) {
  const withoutFrontMatter = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const lines = withoutFrontMatter.split('\n').filter((line) => !/^<a id=/.test(line.trim()));
  const text = [];
  for (const line of lines) {
    if (/^# /.test(line)) continue; // the binding carries the title
    if (/^\*\*(?:Write here|Where you are|Open beside it):/.test(line)) continue; // link-only navigation chrome
    text.push(line
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1'));
  }
  return text.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function essayReadingBody(journey) {
  return journey.scenes.map((scene) => {
    const editorial = (scene.text || []).find((t) => t.id === 'editorial');
    const route = (scene.text || []).find((t) => t.id === 'p1-route');
    if (!editorial) throw new Error(`Essay journey scene ${scene.id} carries no editorial text.`);
    return [`## ${editorial.title}${editorial.italic ? ` — ${editorial.italic}` : ''}`, editorial.kicker, editorial.body.trim(), route ? `Canonical route: ${route.body.trim()}` : ''].filter(Boolean).join('\n\n');
  }).join('\n\n');
}

const roomDir = (id) => id.replace(/^roz-room-/, '');
async function readingBody(member) {
  if (member.id === 'roz-essay-reading') {
    const journey = JSON.parse(await readFile(resolve(envelopeDir, member.file), 'utf8'));
    return { text: essayReadingBody(journey), sources: ['submission-package/essay/THE-RETURN-OF-ZERO.md'] };
  }
  const path = `submission-package/essay/section-rooms/${roomDir(member.id)}/ROOM.md`;
  const pinned = await blobAt(sourceCommit, path);
  if (!pinned) throw new Error(`The pinned room source for ${member.id} is absent: ${path}`);
  return { text: plainMarkdown(pinned.toString('utf8')), sources: [path] };
}

// ---------------------------------------------------------------------------
// 4. The world publication: one edition, the collection and its nine readings.
// ---------------------------------------------------------------------------
const glyphFor = (shape) => (shape === 'text' ? '§' : 'O');
const worldEntries = [];
const worldRelations = [];
const readingBindings = [];
const corpusReceipt = { members: [], envelope: { title: envelope.title, exported_at: publishedAt, source_revision: envelope.source_revision } };

for (const member of members) {
  const ref = `${WORLD}/wiki:${member.id}`;
  const memberRef = (suffix) => `expression:return-of-zero:${member.id}${suffix}`;
  const journey = JSON.parse(await readFile(resolve(envelopeDir, member.file), 'utf8'));
  const body = await readingBody(member);

  readingBindings.push({
    schema: 'oi.presentation-binding/v1',
    binding_ref: `reading:${member.id}`,
    component_ref: 'oi.presentation/lede/v1',
    portable_renderer: 'oi.presentation/lede/v1',
    subject_ref: ref,
    props: { title: member.name, text: body.text },
    fallback: { title: member.name },
    provenance,
  });

  worldEntries.push(createExploreEntry({
    ref, kind: 'wiki-node', world_ref: WORLD, label: member.name,
    revision: MEMBER_REVISION, aliases: [member.id], provenance, locators: [],
    meta: { collection_member: member.id, journey: member.file },
  }));
  worldRelations.push({ relation_ref: `wiki-contains:return-of-zero:${member.id}`, from: COLLECTION_REF, to: ref, relation: 'wiki.contains', origin: 'wiki', provenance });

  // The member's Expression publication: the journey's own formations.
  const expressionRef = memberRef('');
  const entityRefs = [];
  const entities = {};
  const scenes = journey.scenes.map((scene) => {
    const sceneRef = `${expressionRef}:scene:${scene.id}`;
    const refs = (scene.entities || []).map((entity) => {
      const entityRef = `${sceneRef}:${entity.id}`;
      entityRefs.push(entityRef);
      entities[entityRef] = {
        entity_ref: entityRef,
        revision: 1,
        title: entity.name || entity.id,
        subject: {
          subject_ref: ref,
          native_owner: 'return-of-zero',
          presentation_role: 'thing',
          sources: body.sources.map((source) => ({ ref: source, revision: sourceCommit, availability: 'available' })),
        },
        parameters: {
          glyph: { value: glyphFor(entity.shape), automation: null },
          x: { value: Number(entity.position?.x ?? 0), automation: null },
          y: { value: Number(entity.position?.y ?? 0), automation: null },
          z: { value: Number(entity.position?.z ?? 0), automation: null },
          scale: { value: Number(((Number(entity.size?.x ?? 1) + Number(entity.size?.y ?? 1)) / 2).toFixed(4)), automation: null },
          share: { value: Number(entity.share ?? 1), automation: null },
        },
      };
      return entityRef;
    });
    return { scene_ref: sceneRef, revision: 1, title: scene.name || scene.id, entity_refs: refs };
  });
  const document = {
    schema: 'oi.expression/v1',
    expression_ref: expressionRef,
    revision: 1,
    title: member.name,
    scenes,
    entities,
    relations: {},
    selection: { scene_ref: scenes[0].scene_ref, entity_ref: scenes[0].entity_refs[0] },
    provenance: [{ ref: member.file, revision: 'track3-2026-09-19', availability: 'available' }],
    representations: [],
  };
  const publication = projectExpression({
    document,
    world_ref: WORLD,
    field_ref: `${EXPRESSION_FIELD}:${member.id}`,
    projection_ref: `projection:return-of-zero:${member.id}:expression`,
    projection_revision: 1,
    audience: { visibility: 'public' },
    publisher: { identity_ref: publisherIdentity },
    published_at: publishedAt,
  });
  await writeFile(resolve(outDir, `expression-${member.id}.json`), JSON.stringify(publication, null, 1));
  corpusReceipt.members.push({
    id: member.id, ref, expression_ref: expressionRef,
    reading_paragraphs: body.text.split(/\n\s*\n/).filter(Boolean).length,
    reading_chars: body.text.length,
    expression_scenes: scenes.length, expression_entities: entityRefs.length,
    omissions: publication.omissions,
  });
}

const collectionBinding = {
  schema: 'oi.presentation-binding/v1',
  binding_ref: 'collection',
  component_ref: 'oi.presentation/wiki-reading/v1',
  portable_renderer: 'oi.presentation/wiki-reading/v1',
  subject_ref: COLLECTION_REF,
  props: {
    title: envelope.title,
    text: `The deliberately published Return-of-Zero collection: the sovereign reading path and its eight section rooms, each with its published Expression. Grounded in the sha-verified essay sources at ${sourceCommit}; the owner remains the recognition authority for anything beyond these surfaces.`,
    refs: worldEntries.map((entry) => entry.ref),
  },
  fallback: { title: envelope.title },
  provenance,
};
const presentation = createWorldPresentation({
  schema: 'oi.world-presentation/v1',
  presentation_ref: 'presentation:return-of-zero:published-reading',
  world_ref: WORLD,
  revision: 1,
  title: envelope.title,
  summary: 'Nine published subjects: the sovereign reading path and eight section rooms, each readable at full disclosed length with its native Expression.',
  theme: { tokens: {} },
  provenance,
  regions: [{ region_ref: 'reading', role: 'reading', bindings: [collectionBinding, ...readingBindings] }],
});
const projection = createWorldPresentationProjection({
  presentation,
  projection: {
    projection_ref: 'projection:return-of-zero:published-reading',
    projection_revision: 1,
    state: 'published',
    subject: { kind: 'world', ref: WORLD },
    source: { system: 'o-i', ref: 'production/return-of-zero', revision: sourceCommit },
    publisher_participant_ref: 'participant:return-of-zero:frank-sovereign',
    published_at: publishedAt,
    audience: { visibility: 'public' },
    provenance: [{ kind: 'human-publication', ref: 'participant:return-of-zero:frank-sovereign', source_system: 'o-i', revision: sourceCommit }],
  },
});
worldEntries.unshift(createExploreEntry({
  ref: COLLECTION_REF, kind: 'wiki-space', world_ref: WORLD, label: envelope.title,
  revision: MEMBER_REVISION, aliases: ['return-of-zero'], provenance, locators: [],
  meta: { collection: 'return-of-zero' },
}));
const world = {
  schema: 'oi.world-publication/v1',
  world_ref: WORLD,
  field_ref: FIELD,
  field: { field_ref: FIELD, kind: 'explore', visibility: 'public', title: envelope.title },
  projection,
  entries: worldEntries,
  relations: worldRelations,
};
await writeFile(resolve(outDir, 'world-publication.json'), JSON.stringify(world, null, 1));

const receipt = {
  schema: 'oi.return-of-zero-producer-receipt/v1',
  standing: 'produced-from-pinned-native-sources',
  owner_authority: 'Owner commission on 2026-09-20: publish the delivered Return-of-Zero collection through the site receiver; publisher identity is the envelope-declared frank-sovereign ownership.',
  deterministic: { published_at: publishedAt, source_commit: sourceCommit },
  reconciliation,
  corpus: corpusReceipt,
  outputs: ['world-publication.json', ...members.map((m) => `expression-${m.id}.json`)],
};
await writeFile(resolve(outDir, 'PRODUCER-RECEIPT.json'), JSON.stringify(receipt, null, 1));
console.log(`Return-of-Zero publications: ${members.length + 1} producer documents from pinned sources at ${sourceCommit}; ${reconciliation.bindings.length} source bindings and ${reconciliation.assets.length} assets verified.`);
