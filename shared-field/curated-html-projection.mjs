/**
 * Curated HTML artifact → audience-scoped Projection (Lane C step 4).
 *
 *   authored artifact            a Flow instance (ql-doc carrier, Control/user/flows/*.html)
 *                                or a Central document (central.document-reading/v1)
 *         ↓ explicit selection   oi.curated-artifact-selection/v1 — which entries, which meta, audience
 *   WorldPresentation            oi.world-presentation/v1 rendering ONLY the selected entries
 *         ↓
 *   Projection                   oi.projection/v1 (oi.artifact-publication/v1 bundle)
 *         ├─ hosted edition      a REBUILT filtered document — never the original file with CSS hiding
 *         └─ Explore entry       kind curated-artifact, related to its Wiki node through node-source
 *
 * Journal pages, packet items, notes and media are withheld unless the owner's
 * selection names them explicitly; private meta (current/journalCurrent/
 * exported/view) never travels. The embedded `ql-doc` state of the source is
 * never copied: the edition embeds only the Projection. The artifact is
 * related to a Wiki node; it does not become a Wiki page.
 */
import { createHash } from 'node:crypto';
import {subjectLabel} from './presentation-text.mjs';
import { createProjection, validateProjection, createParticipant, reviseProjection } from './index.mjs';
import { createSharedField } from './social.mjs';
import { createExploreEntry, createExploreApplication } from './explore.mjs';
import { createWorldPresentation } from './presentation.mjs';
import { createWorldPresentationProjection, refineWorldPresentationProjection, worldPresentationFromProjection } from './presentation-projection.mjs';
import { projectionStorageKey, relationStorageRef } from './spacetimedb.mjs';
import { sourceStanding, publicationSentinelLeaks } from './central-wiki-projection.mjs';

export const CURATED_ARTIFACT_SCHEMA = 'oi.curated-artifact/v1';
export const ARTIFACT_SELECTION_SCHEMA = 'oi.curated-artifact-selection/v1';
export const ARTIFACT_PUBLICATION_SCHEMA = 'oi.artifact-publication/v1';
export const ARTIFACT_EDITION_MANIFEST_SCHEMA = 'oi.artifact-edition-manifest/v1';
/** Meta fields a selection may disclose. Everything else in `meta` is private state of the carrier. */
export const DISCLOSABLE_META = Object.freeze(['document_id', 'title', 'created', 'template', 'revision']);
/** Collections withheld unless the selection names them. */
export const WITHHELD_COLLECTIONS = Object.freeze(['journal', 'packet', 'notes', 'media']);

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const record = (value, name) => { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`); return value; };
const text = (value, name) => { if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} must be a non-empty string`); return value; };
const slug = (value) => String(value).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();

// ---------------------------------------------------------------------------
// HTML: escape, sanitise (allowlist), and reduce to plain text
// ---------------------------------------------------------------------------

export {escapeHtml,sanitiseEntryHtml,htmlToText} from './html-material.mjs';
import {escapeHtml,sanitiseEntryHtml,htmlToText} from './html-material.mjs';

// ---------------------------------------------------------------------------
// Artifact readers — the two carriers, one normalised artifact
// ---------------------------------------------------------------------------

const QL_DOC = /<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;

/** Read a Flow instance (the ratified ql-doc carrier). `source` is the
 * owner's identity for the file (`central.files.read` location ref + revision). */
export function curatedArtifactFromFlowInstance(html, source) {
  const match = String(html).match(QL_DOC);
  if (!match) throw new TypeError('not a Flow instance: the embedded ql-doc state is missing');
  const doc = JSON.parse(match[1].replace(/<\\\/script/gi, '</script'));
  record(doc.meta, 'ql-doc meta');
  record(source, 'artifact source');
  text(source.ref, 'artifact source.ref');
  text(source.revision, 'artifact source.revision');
  const entries = (Array.isArray(doc.entries) ? doc.entries : []).map((entry) => ({
    id: text(entry.id, 'entry.id'), author: String(entry.author ?? ''), at: String(entry.at ?? ''),
    html: String(entry.html ?? ''), reply_to: entry.replyTo?.entryId ?? null,
  }));
  return {
    schema: CURATED_ARTIFACT_SCHEMA,
    carrier: 'ql-doc',
    document_id: text(doc.meta.documentId ?? '', 'ql-doc meta.documentId'),
    title: String(doc.meta.title ?? ''),
    created: doc.meta.created ?? null,
    template: doc.meta.template ?? null,
    revision: Number.isInteger(doc.meta.revision) ? doc.meta.revision : 0,
    source: { system: 'central', ref: source.ref, revision: source.revision, ...(source.path ? { path: source.path } : {}) },
    entries,
    withheld: {
      journal: Array.isArray(doc.journal) ? doc.journal.length : 0,
      packet: Array.isArray(doc.packet) ? doc.packet.length : 0,
      notes: Array.isArray(doc.notes) ? doc.notes.length : 0,
      media: Array.isArray(doc.media) ? doc.media.length : 0,
      meta_fields: Object.keys(doc.meta).filter((key) => !DISCLOSABLE_META.includes(key === 'documentId' ? 'document_id' : key)),
    },
    // Retained only for explicit opt-in through the selection; never copied by default.
    collections: { journal: clone(doc.journal ?? []), packet: clone(doc.packet ?? []), notes: clone(doc.notes ?? []), media: clone(doc.media ?? []) },
  };
}

/** Read a Central document (`central.document-reading/v1`): fields become
 * entries of kind `field`, entries stay entries. Selected contribution bodies use the exact native
 * export; unselected bodies and the operation journal remain withheld. */
/** Take the exact owner's rendered fragments. The retained JSON in the export
 * is private carrier state, never publication material. Parsing only these
 * bounded fragments avoids inventing a second contribution compositor. */
function nativeDocumentBodies(reading, exported) {
  record(exported, 'native document export');
  if (exported.schema !== 'central.document-export/v1'
      || exported.snapshot?.source_ref !== reading.source?.ref
      || exported.snapshot?.revision?.revision !== reading.revision?.revision
      || exported.snapshot?.document?.document_id !== reading.document?.document_id) {
    throw new TypeError('Native export must have the same document, source and revision basis as its reading');
  }
  const html = text(exported.html, 'native export.html');
  if (Buffer.byteLength(html, 'utf8') > 4 * 1024 * 1024) throw new TypeError('Native export exceeds the bounded publication size');
  const expected = new Map();
  for (const entry of reading.document.entries ?? []) expected.set('entry:' + escapeHtml(entry.id), 'entry:' + entry.id);
  for (const field of reading.document.fields ?? []) expected.set('field:' + escapeHtml(field.id), 'field:' + field.id);
  const bodies = new Map();
  let index = 0, active;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open < 0) break;
    if (html.startsWith('<!--', open)) {
      const end = html.indexOf('-->', open + 4);
      if (end < 0) throw new TypeError('Unclosed comment in native document export');
      index = end + 3; continue;
    }
    let quote, close = open + 1;
    for (; close < html.length; close += 1) {
      const char = html[close];
      if (quote) { if (char === quote) quote = undefined; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (close === html.length) throw new TypeError('Unclosed tag in native document export');
    const tag = html.slice(open + 1, close);
    const match = /^\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tag);
    index = close + 1;
    if (!match) continue;
    const closing = match[1] === '/', name = match[2].toLowerCase();
    if (!closing && (name === 'script' || name === 'style')) {
      if (active) throw new TypeError('Executable carrier state inside a native publication body');
      const end = new RegExp('</' + name + '\\s*>', 'i').exec(html.slice(index));
      if (!end) throw new TypeError('Unclosed raw carrier state in native document export');
      index += end.index + end[0].length; continue;
    }
    const attribute = !closing && /\sdata-(entry|field)-id="([^"]*)"/.exec(tag);
    if (attribute) {
      const key = expected.get(attribute[1] + ':' + attribute[2]);
      if (!key || active || bodies.has(key)) throw new TypeError('Unknown, nested or duplicate native publication body');
      active = { key, name, start: index, depth: 1 };
      continue;
    }
    if (active && name === active.name) {
      if (closing) active.depth -= 1;
      else if (!/\/\s*$/.test(tag)) active.depth += 1;
      if (active.depth === 0) {
        bodies.set(active.key, html.slice(active.start, open)); active = undefined;
      }
    }
  }
  if (active || bodies.size !== expected.size) throw new TypeError('Missing or unclosed native publication body');
  return bodies;
}

export function curatedArtifactFromCentralDocument(reading, nativeExport) {
  record(reading, 'central document reading');
  if (reading.schema !== 'central.document-reading/v1') throw new TypeError(`unsupported document reading schema: ${reading.schema}`);
  const document = record(reading.document, 'document');
  const nativeBodies = nativeExport ? nativeDocumentBodies(reading, nativeExport) : undefined;
  if (!nativeBodies && (document.contributions ?? []).some((body) => !body.removed && (body.entry_id || body.field_id))) {
    throw new TypeError('Native contribution material requires the source owner export at the same revision');
  }
  const payload = document.template_payload ?? {};
  const pointer = (path) => String(path ?? '').split('/').filter(Boolean).reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), payload);
  const entries = [
    ...(document.fields ?? []).map((field) => ({ id: `field:${field.id}`, author: 'H', at: '', kind: 'field', label: field.label ?? field.id, html: nativeBodies?.get('field:' + field.id) ?? `<p>${escapeHtml(String(pointer(field.template_pointer) ?? ''))}</p>` })),
    ...(document.entries ?? []).map((entry) => ({ id: text(entry.id, 'entry.id'), author: entry.actor_kind === 'human' ? 'H' : 'A', at: entry.occurred_at_unix_seconds ? new Date(entry.occurred_at_unix_seconds * 1000).toISOString() : '', html: nativeBodies?.get('entry:' + entry.id) ?? String(entry.html ?? ''), reply_to: entry.reply_to ?? null })),
  ];
  return {
    schema: CURATED_ARTIFACT_SCHEMA,
    carrier: 'central.document',
    document_id: text(document.document_id, 'document_id'),
    title: String(document.title ?? ''),
    created: document.created_at_unix_seconds ? new Date(document.created_at_unix_seconds * 1000).toISOString() : null,
    template: document.kind ?? null,
    revision: 0,
    source: { system: 'central', ref: text(reading.source?.ref, 'source.ref'), revision: text(reading.revision?.revision, 'revision'), ...(reading.source?.path ? { path: reading.source.path } : {}) },
    entries,
    withheld: { contributions: (document.contributions ?? []).length, operations: (document.operations ?? []).length, meta_fields: ['lifecycle', 'creation_digest', 'day_ref'] },
    collections: {},
  };
}

/** Markdown prose as escaped, script-free HTML: headings, paragraphs and
 * list items only; every character of text is escaped. */
function markdownProseHtml(markdown) {
  const blocks = [];
  let paragraph = [];
  const flush = () => { if (paragraph.length) { blocks.push(`<p>${escapeHtml(paragraph.join(' '))}</p>`); paragraph = []; } };
  for (const line of String(markdown).split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (heading) { flush(); blocks.push(`<h${Math.min(6, heading[1].length + 1)}>${escapeHtml(heading[2])}</h${Math.min(6, heading[1].length + 1)}>`); }
    else if (item) { flush(); blocks.push(`<p>• ${escapeHtml(item[1])}</p>`); }
    else if (!line.trim()) flush();
    else paragraph.push(line.trim());
  }
  flush();
  return blocks.join('');
}

/** Read one cited corpus source from a wiki's own source bank
 * (`central.wiki-source-reading/v1`, `projectcentral.wiki.source.read`):
 * the frontmatter stays home except the disclosable meta; the body's
 * `##` sections become selectable entries (the text before the first one is
 * the `opening`). Authorship is the owner's authored source. */
export function curatedArtifactFromWikiSource(reading) {
  record(reading, 'wiki source reading');
  if (reading.schema !== 'central.wiki-source-reading/v1') throw new TypeError(`unsupported wiki source reading schema: ${reading.schema}`);
  const body = String(text(reading.body, 'body'));
  const withoutFrontmatter = body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const sections = [];
  let current = { id: 'opening', label: 'Opening', lines: [] };
  for (const line of withoutFrontmatter.split(/\r?\n/)) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      if (current.lines.join('').trim()) sections.push(current);
      current = { id: `section:${slug(heading[1]) || sections.length + 1}`, label: heading[1].trim(), lines: [] };
    } else current.lines.push(line);
  }
  if (current.lines.join('').trim()) sections.push(current);
  return {
    schema: CURATED_ARTIFACT_SCHEMA,
    carrier: 'central.wiki-source',
    document_id: text(reading.source_ref, 'source_ref'),
    title: String(reading.title ?? reading.source_ref),
    created: null,
    template: reading.media_type ?? null,
    revision: text(reading.revision, 'revision'),
    source: { system: 'central', ref: text(reading.source_ref, 'source_ref'), revision: text(reading.revision, 'revision') },
    entries: sections.map((section) => ({ id: section.id, author: 'H', at: '', kind: 'field', label: section.label, html: markdownProseHtml(section.lines.join('\n')) })),
    withheld: { contributions: 0, operations: 0, meta_fields: ['frontmatter', 'locator', 'owners', 'tags'] },
    collections: {},
  };
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export function validateArtifactSelection(value) {
  record(value, 'artifact selection');
  if (value.schema !== ARTIFACT_SELECTION_SCHEMA) throw new TypeError(`Unsupported artifact selection schema: ${value.schema}`);
  for (const key of ['artifact_ref', 'world_ref', 'field_ref', 'projection_ref', 'presentation_ref']) text(value[key], `selection.${key}`);
  record(value.audience, 'selection.audience');
  text(value.audience.visibility, 'selection.audience.visibility');
  record(value.publisher, 'selection.publisher');
  text(value.publisher.participant_ref, 'selection.publisher.participant_ref');
  text(value.publisher.identity_ref, 'selection.publisher.identity_ref');
  if (!Array.isArray(value.entry_ids)) throw new TypeError('selection.entry_ids must list the entries to publish (an explicit array, possibly empty)');
  const include = record(value.include ?? {}, 'selection.include');
  for (const key of Object.keys(include)) if (!WITHHELD_COLLECTIONS.includes(key)) throw new TypeError(`selection.include.${key} is not a withholdable collection`);
  const meta = Array.isArray(value.meta_fields) ? value.meta_fields : ['title', 'created', 'template', 'revision'];
  for (const field of meta) if (!DISCLOSABLE_META.includes(field)) throw new TypeError(`selection.meta_fields may not disclose "${field}"`);
  if (value.relate_to_node !== undefined) { record(value.relate_to_node, 'selection.relate_to_node'); text(value.relate_to_node.node_ref, 'selection.relate_to_node.node_ref'); }
  const replies = Array.isArray(value.replies) ? value.replies : [];
  replies.forEach((reply, index) => { record(reply, `selection.replies[${index}]`); text(reply.contribution_ref, `selection.replies[${index}].contribution_ref`); text(reply.contributor_participant_ref, `selection.replies[${index}].contributor_participant_ref`); });
  return { ...value, include, meta_fields: meta, replies };
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * Project one curated artifact. Only entries named in `selection.entry_ids`
 * enter the WorldPresentation; withheld collections enter only when the
 * selection names them under `include`; meta is reduced to the disclosable
 * fields the selection names. An optional wiki reading attests the
 * node-source relation (origin `wiki`); without attestation the relation is
 * the owner's declared publication decision (origin `projection`).
 */
export function projectCuratedArtifact(input) {
  record(input, 'artifact projection input');
  const artifact = record(input.artifact, 'artifact');
  if (artifact.schema !== CURATED_ARTIFACT_SCHEMA) throw new TypeError(`Unsupported artifact schema: ${artifact.schema}`);
  const selection = validateArtifactSelection(input.selection);
  const publishedAt = text(input.published_at ?? new Date().toISOString(), 'published_at');
  const projectionRevision = Number.isInteger(input.projection_revision) && input.projection_revision > 0 ? input.projection_revision : 1;
  const sourceRevision = artifact.source.revision;
  const worldRef = selection.world_ref;
  const hostedArtifactRef = `${worldRef}/${selection.artifact_ref}`;

  const byId = new Map(artifact.entries.map((entry) => [entry.id, entry]));
  const selected = [];
  for (const id of selection.entry_ids) {
    const entry = byId.get(id);
    if (!entry) throw new TypeError(`selected entry is not in the artifact: ${id}`);
    selected.push(entry);
  }
  const included = {};
  for (const [collection, wanted] of Object.entries(selection.include)) {
    if (wanted === true) included[collection] = clone(artifact.collections?.[collection] ?? []);
  }
  const meta = {};
  for (const field of selection.meta_fields) if (artifact[field] !== undefined && artifact[field] !== null) meta[field] = artifact[field];
  const title = subjectLabel(selection,subjectLabel(artifact,"Untitled shared document"));
  const standing = artifact.source.path ? sourceStanding(artifact.source.path) : 'human-authored';
  const provenance = [{ kind: 'curated-artifact-source', ref: artifact.source.ref, source_system: 'central', revision: sourceRevision }];
  const bindingProvenance = (ref) => [{ kind: 'curated-artifact-entry', ref, source_system: 'central', revision: sourceRevision }];

  const entryBindings = selected.map((entry) => ({
    schema: 'oi.presentation-binding/v1',
    binding_ref: `entry:${slug(entry.id)}`,
    component_ref: 'oi.presentation/prose/v1',
    portable_renderer: 'oi.presentation/prose/v1',
    subject_ref: `${hostedArtifactRef}#${entry.id}`,
    props: {
      title: entry.kind === 'field' ? String(entry.label ?? entry.id) : [entry.author, entry.at].filter(Boolean).join(' · '),
      text: htmlToText(entry.html),
      html: sanitiseEntryHtml(entry.html),
      ...(entry.reply_to ? { reply_to: `${hostedArtifactRef}#${entry.reply_to}` } : {}),
    },
    fallback: { title: entry.kind === 'field' ? String(entry.label ?? entry.id) : entry.author || 'entry', text: htmlToText(entry.html) },
    provenance: bindingProvenance(entry.id),
  }));
  const includedBindings = Object.entries(included).flatMap(([collection, items]) => items.map((item, index) => ({
    schema: 'oi.presentation-binding/v1',
    binding_ref: `${collection}:${slug(item.id ?? index)}`,
    component_ref: 'oi.presentation/prose/v1',
    portable_renderer: 'oi.presentation/prose/v1',
    subject_ref: `${hostedArtifactRef}#${collection}:${item.id ?? index}`,
    props: { title: `${collection}${item.at ? ` · ${item.at}` : ''}`, text: htmlToText(item.html ?? ''), html: sanitiseEntryHtml(item.html ?? '') },
    fallback: { title: collection, text: htmlToText(item.html ?? '') },
    provenance: bindingProvenance(`${collection}:${item.id ?? index}`),
  })));
  const metaText = Object.entries(meta).map(([key, value]) => `${key}: ${value}`).join(' · ');
  const regions = [
    { region_ref: 'lede', role: 'lede', bindings: [{ schema: 'oi.presentation-binding/v1', binding_ref: 'lede', component_ref: 'oi.presentation/lede/v1', portable_renderer: 'oi.presentation/lede/v1', subject_ref: hostedArtifactRef, props: { title, ...(selection.summary ? { text: selection.summary } : {}) }, fallback: { title }, provenance }] },
    { region_ref: 'entries', role: 'reading', label: `Selected entries · ${selected.length} of ${artifact.entries.length}`, bindings: entryBindings },
    ...(includedBindings.length ? [{ region_ref: 'included', role: 'reading', label: 'Explicitly included collections', bindings: includedBindings }] : []),
    ...(selection.replies.length ? [{ region_ref: 'replies', role: 'relation', label: 'Replies from other worlds (admitted)', bindings: selection.replies.map((reply) => ({ schema: 'oi.presentation-binding/v1', binding_ref: `reply:${slug(reply.contribution_ref)}`, component_ref: 'oi.presentation/reference-card/v1', portable_renderer: 'oi.presentation/reference-card/v1', subject_ref: reply.contribution_ref, props: { title: reply.label ?? 'Admitted reply', text: reply.summary ?? '', refs: [reply.contribution_ref] }, fallback: { title: reply.label ?? 'Admitted reply' }, provenance: [{ kind: 'admitted-contribution', ref: reply.contribution_ref, source_system: 'o-i', ...(reply.source_revision ? { revision: reply.source_revision } : {}) }] })) }] : []),
    ...(metaText ? [{ region_ref: 'meta', role: 'relation', label: 'Artifact', bindings: [{ schema: 'oi.presentation-binding/v1', binding_ref: 'meta', component_ref: 'oi.presentation/reference-card/v1', portable_renderer: 'oi.presentation/reference-card/v1', subject_ref: hostedArtifactRef, props: { title: 'Source details', text: metaText, ...(selection.disclose_source_refs ? { refs: [artifact.source.ref] } : {}) }, fallback: { title: 'Source details' }, provenance }] }] : []),
  ].filter((region) => region.bindings.length > 0);

  const presentation = createWorldPresentation({
    schema: 'oi.world-presentation/v1',
    presentation_ref: selection.presentation_ref,
    world_ref: hostedArtifactRef,
    revision: projectionRevision,
    title,
    ...(selection.summary ? { summary: selection.summary } : {}),
    theme: { tokens: {} },
    regions,
    provenance,
  });
  const projection = createWorldPresentationProjection({
    presentation,
    projection: {
      projection_ref: selection.projection_ref,
      projection_revision: projectionRevision,
      state: 'published',
      subject: { kind: 'curated-artifact', ref: hostedArtifactRef },
      source: { system: 'central', world_ref: worldRef, ref: artifact.source.ref, revision: sourceRevision },
      publisher_participant_ref: selection.publisher.participant_ref,
      published_at: publishedAt,
      audience: clone(selection.audience),
      provenance: [{ kind: 'human-publication', ref: selection.publisher.participant_ref, source_system: 'central', revision: sourceRevision }],
    },
  });

  const locators = [{ surface: 'web', locator: `/explore.html?ref=${encodeURIComponent(hostedArtifactRef)}` }];
  if (input.edition_base) locators.push({ surface: 'edition', locator: `${input.edition_base}/index.html` }, { surface: 'edition-manifest', locator: `${input.edition_base}/manifest.json` });
    const entry = createExploreEntry({
    ref: hostedArtifactRef,
    kind: 'curated-artifact',
    world_ref: worldRef,
    label: title,
    aliases: [selection.artifact_ref],
    summary: selection.summary ?? htmlToText(selected[0]?.html??'').replace(/\s+/g,' ').trim().slice(0,240),
    revision: sourceRevision,
    provenance: [...provenance, { kind: standing === 'human-authored' ? 'human-authored-source' : 'agent-maintained-source', ref: artifact.source.ref, source_system: 'central', revision: sourceRevision }],
    locators,
    meta: { standing, carrier: artifact.carrier, projection_ref: selection.projection_ref, local_ref: selection.artifact_ref,
      ...(artifact.carrier === 'central.document' && meta.document_id ? { document_id: meta.document_id } : {}),
      ...(selection.disclose_source_refs ? { source_ref: artifact.source.ref } : {}) },
  });

  const relations = [];
  const worldRelationRef = `${worldRef}#oi.world/artifact#${hostedArtifactRef}`;
  relations.push({ relation_ref: worldRelationRef, from: worldRef, to: hostedArtifactRef, relation: 'oi.world/artifact', origin: 'projection', direction: 'forward', provenance: [{ kind: 'projection-relation', ref: worldRelationRef, source_system: 'o-i', revision: `${selection.projection_ref}@${projectionRevision}` }] });
  let nodeRelation = null;
  if (selection.relate_to_node) {
    const nodeRef = selection.relate_to_node.node_ref;
    const hostedNode = `${worldRef}/${nodeRef}`;
    const reading = input.wiki_reading;
    const node = reading?.nodes?.find((candidate) => candidate.ref === nodeRef);
    const attested = Boolean(node && artifact.source.path && (node.source_refs ?? []).includes(artifact.source.path));
    const relationRef = `${hostedNode}#node-source#${hostedArtifactRef}`;
    nodeRelation = {
      relation_ref: relationRef, from: hostedNode, to: hostedArtifactRef, relation: 'node-source', origin: attested ? 'wiki' : 'projection', direction: 'forward',
      provenance: attested
        ? [{ kind: 'wiki-relation', ref: relationRef, source_system: 'central', revision: reading.source.revision }]
        : [{ kind: 'declared-relation', ref: relationRef, source_system: 'o-i', revision: `${selection.projection_ref}@${projectionRevision}` }],
    };
    relations.push(nodeRelation);
  }
  createExploreApplication({ entries: [entry], relations: [] });

  const field = createSharedField({ field_ref: selection.field_ref, kind: 'explore', visibility: selection.audience.visibility, title: selection.field_title ?? title, provenance: [{ kind: 'human-publication', ref: selection.publisher.participant_ref, source_system: 'central', revision: sourceRevision }] });
  const participant = createParticipant({ participant_ref: selection.publisher.participant_ref, field_ref: selection.field_ref, identity: { kind: 'human', ref: selection.publisher.identity_ref }, presentation: { world_ref: worldRef, ...(selection.publisher.chosen_name ? { chosen_name: selection.publisher.chosen_name } : {}) }, provenance: { source_system: 'central', source_revision: sourceRevision, source_ref: artifact.source.ref } });

  return {
    schema: ARTIFACT_PUBLICATION_SCHEMA,
    artifact_ref: selection.artifact_ref,
    hosted_ref: hostedArtifactRef,
    world_ref: worldRef,
    carrier: artifact.carrier,
    source: clone(projection.source),
    field, participant, projection, presentation,
    entries: [entry],
    relations,
    selected: { entries: selected.map((entry) => entry.id), included: Object.keys(included), meta_fields: Object.keys(meta) },
    // Counts only: the names of withheld meta fields are the carrier's private keys and stay home.
    withheld: { ...Object.fromEntries(Object.entries(artifact.withheld ?? {}).filter(([key]) => key !== 'meta_fields').map(([key, value]) => [key, included[key] ? 0 : Number(value)])), meta_fields: (artifact.withheld?.meta_fields ?? []).length, entries: artifact.entries.length - selected.length },
    node_relation: nodeRelation ? { node_ref: selection.relate_to_node.node_ref, attested: nodeRelation.origin === 'wiki' } : null,
  };
}

export function reprojectCuratedArtifact(previousBundle, input) {
  let previous = validateProjection(record(previousBundle, 'previous publication').projection);
  const next = projectCuratedArtifact({ ...input, projection_revision: previous.projection_revision + 1 });
  if (next.projection.projection_ref !== previous.projection_ref) throw new TypeError('re-projection must keep the Projection ref');
  // Qualify a retained local alias only from its recorded owning World and
  // canonical hosted address. Old editions remain immutable; the next edition
  // records the correction instead of silently retargeting another artifact.
  if (previous.subject.ref === input.selection.artifact_ref &&
      previous.source.world_ref === input.selection.world_ref &&
      previousBundle.hosted_ref === next.projection.subject.ref) {
    previous = validateProjection({ ...previous,
      subject: { ...previous.subject, ref: next.projection.subject.ref },
      representation: { ...previous.representation, payload: { ...previous.representation.payload, world_ref: next.projection.subject.ref } },
      provenance: [...previous.provenance, { kind: 'qualified-artifact-address', ref: next.projection.subject.ref, source_system: 'o-i', revision: previous.source.revision }],
    });
  }
  if (next.projection.subject.ref !== previous.subject.ref) throw new TypeError('re-projection must keep the subject artifact');
  const sourceMoved = next.projection.source.revision !== previous.source.revision;
  const projection = sourceMoved
    ? reviseProjection(previous, { source_revision: next.projection.source.revision, published_at: next.projection.published_at, representation: { kind: 'oi.world-presentation/v1', payload: next.presentation }, provenance: [...previous.provenance, ...next.projection.provenance] })
    : refineWorldPresentationProjection(previous, next.presentation, { publisher_participant_ref: next.projection.publisher_participant_ref, published_at: next.projection.published_at, provenance: input.editor_provenance ?? [{ kind: 'human-refinement', ref: next.projection.publisher_participant_ref, source_system: 'central', revision: next.projection.source.revision }] });
  return { ...next, projection, presentation: worldPresentationFromProjection(projection), source_moved: sourceMoved };
}

// ---------------------------------------------------------------------------
// Hosted arguments, Explore seed, the rebuilt edition
// ---------------------------------------------------------------------------

export function hostedArtifactArgs(bundle) {
  const value = record(bundle, 'artifact publication bundle');
  if (value.schema !== ARTIFACT_PUBLICATION_SCHEMA) throw new TypeError(`Unsupported artifact publication schema: ${value.schema}`);
  const { field, participant, projection, entries, relations } = value;
  return {
    putSharedField: { fieldRef: field.field_ref, kind: field.kind, visibility: field.visibility, contractJson: JSON.stringify(field) },
    putParticipant: { participantRef: participant.participant_ref, fieldRef: participant.field_ref, identityKind: participant.identity.kind, identityRef: participant.identity.ref, sourceSystem: participant.provenance.source_system, sourceRevision: participant.provenance.source_revision, contractJson: JSON.stringify(participant) },
    putProjection: { projectionKey: projectionStorageKey(projection.projection_ref, projection.projection_revision), fieldRef: field.field_ref, projectionRef: projection.projection_ref, projectionRevision: projection.projection_revision, sourceRevision: projection.source.revision, publisherParticipantRef: projection.publisher_participant_ref, state: projection.state, contractJson: JSON.stringify(projection) },
    putExploreEntries: entries.map((entry) => ({ semanticRef: entry.ref, fieldRef: field.field_ref, worldRef: entry.world_ref, kind: entry.kind, label: entry.label, revision: entry.revision ?? '', entryJson: JSON.stringify(entry) })),
    putExploreRelations: relations.map((relation) => ({ relationRef: relationStorageRef(relation), fieldRef: field.field_ref, fromRef: relation.from, toRef: relation.to, relation: relation.relation, origin: relation.origin, relationJson: JSON.stringify(relation) })),
  };
}

export function artifactExploreSeed(bundle) {
  const value = record(bundle, 'artifact publication bundle');
  return { schema: 'oi.explore-browser-seed/v1', entries: clone(value.entries), relations: clone(value.relations), presentations: [], presentation_projections: [clone(value.projection)] };
}

/**
 * The hosted edition: a document REBUILT from the Projection alone. No byte
 * of the source file is copied; the source's embedded state never travels;
 * the page carries a CSP that forbids scripts, and it embeds only the
 * Projection JSON. Hosted HTML has no desktop, filesystem, session or Action
 * authority — it is a static representation.
 */
export function renderArtifactEdition(projectionValue, options = {}) {
  const projection = validateProjection(projectionValue);
  const presentation = worldPresentationFromProjection(projection);
  const exploreBase = typeof options.explore_base === 'string' ? options.explore_base : '/explore.html';
  const refLink = (ref) => `<a class="ref" href="${escapeHtml(`${exploreBase}?ref=${encodeURIComponent(ref)}`)}">${escapeHtml(ref)}</a>`;
  const binding = (item) => {
    const title = item.props.title ?? item.fallback.title ?? item.component_ref;
    const body = typeof item.props.html === 'string' ? sanitiseEntryHtml(item.props.html) : (item.props.text ? `<p>${escapeHtml(item.props.text)}</p>` : '');
    const refs = Array.isArray(item.props.refs) ? item.props.refs : [];
    return `<article class="entry" data-binding="${escapeHtml(item.binding_ref)}" data-renderer="${escapeHtml(item.portable_renderer ?? item.component_ref)}"><h3>${escapeHtml(title)}</h3>${body}${item.props.reply_to ? `<p class="reply">replies to ${refLink(item.props.reply_to)}</p>` : ''}${refs.length ? `<ul class="refs">${refs.map((ref) => `<li>${escapeHtml(ref)}</li>`).join('')}</ul>` : ''}</article>`;
  };
  const regions = presentation.regions.map((region) => `<section class="region" data-region="${escapeHtml(region.region_ref)}" data-role="${escapeHtml(region.role)}">${region.label ? `<h2>${escapeHtml(region.label)}</h2>` : ''}${region.bindings.map(binding).join('')}</section>`).join('');
  const embedded = JSON.stringify(projection).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(presentation.title)}</title>
<meta name="oi:projection-ref" content="${escapeHtml(projection.projection_ref)}">
<meta name="oi:projection-revision" content="${projection.projection_revision}">
<meta name="oi:subject-ref" content="${escapeHtml(projection.subject.ref)}">
<meta name="oi:source-revision" content="${escapeHtml(projection.source.revision)}">
<style>
:root{color-scheme:light dark;--ink:#1c1b1a;--paper:#f7f5f1;--line:#d9d4cc;--accent:#2f5f8f;--mid:#6e6e6a}
@media(prefers-color-scheme:dark){:root{--ink:#e8e4dd;--paper:#151412;--line:#3a3733;--accent:#8fb6dd;--mid:#a3a39e}}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.55 Charter,"Iowan Old Style",Georgia,serif}
main{max-width:46rem;margin:0 auto;padding:2rem 1.25rem}
header.edition{border-bottom:1px solid var(--line);padding-bottom:1rem;margin-bottom:1.5rem}
header.edition small{display:block;color:var(--mid);font-family:ui-monospace,monospace;font-size:.8rem;word-break:break-all}
.region{margin:1.5rem 0}.entry{border-top:1px solid var(--line);padding:1rem 0}.entry h3{margin:0 0 .5rem;font:600 .8rem/1.2 system-ui,sans-serif;color:var(--mid);letter-spacing:.04em}
a.ref{color:var(--accent);font-family:ui-monospace,monospace;font-size:.85rem;word-break:break-all}.reply{color:var(--mid);font-size:.85rem}
footer{color:var(--mid);font:.8rem/1.4 system-ui,sans-serif;border-top:1px solid var(--line);padding-top:1rem;margin-top:2rem}
</style>
</head>
<body>
<main>
<header class="edition">
<div class="mark">{O:I}</div>
<h1>${escapeHtml(presentation.title)}</h1>
${presentation.summary ? `<p>${escapeHtml(presentation.summary)}</p>` : ''}
<small>${escapeHtml(projection.projection_ref)} · revision ${projection.projection_revision} · source ${escapeHtml(projection.source.system)} ${escapeHtml(projection.source.revision)}</small>
<small>${refLink(presentation.world_ref)}</small>
</header>
${regions}
<footer>Projection edition rebuilt from the selected entries only. The authored artifact remains canonical on its owner's machine; withheld collections and private document state are not in this page.</footer>
</main>
<script type="application/json" id="oi-projection">${embedded}</script>
</body>
</html>
`;
}

export function artifactEditionManifest(projectionValue, html, options = {}) {
  const projection = validateProjection(projectionValue);
  const presentation = worldPresentationFromProjection(projection);
  return {
    schema: ARTIFACT_EDITION_MANIFEST_SCHEMA,
    projection_ref: projection.projection_ref,
    projection_revision: projection.projection_revision,
    subject_ref: projection.subject.ref,
    presentation_ref: presentation.presentation_ref,
    presentation_revision: presentation.revision,
    source: { ...projection.source },
    audience: { ...projection.audience },
    published_at: projection.published_at,
    page: options.page ?? 'index.html',
    projection_file: options.projection_file ?? 'projection.json',
    rebuilt: true,
    digest: { algorithm: 'sha256', value: createHash('sha256').update(html).digest('hex'), identifies: 'bytes', is_not: ['authorship', 'permission', 'confidentiality'] },
  };
}

/** Every outward payload of an artifact publication, for the sentinel scan. */
export function artifactPublicationPayloads(bundle, options = {}) {
  const html = renderArtifactEdition(bundle.projection, options);
  const manifest = artifactEditionManifest(bundle.projection, html);
  const args = hostedArtifactArgs(bundle);
  const seed = artifactExploreSeed(bundle);
  const application = createExploreApplication({ entries: bundle.entries, relations: [] });
  const index = { search: application.search(bundle.entries[0]?.label ?? '', { limit: 50 }), resolved: bundle.entries.map((entry) => application.resolve(entry.ref)) };
  return { bundle, projection: bundle.projection, args, seed, html, manifest, index };
}

export { publicationSentinelLeaks };
