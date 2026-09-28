/**
 * World constituents beyond the wiki and Positions — Workcells, an Agent's
 * published repertoire (Skills / Methods), and current activity — read from
 * their native owners and projected through the same selection, bundle and
 * Projection lineage as `central-wiki-projection.mjs`. This module holds the
 * reading recognition, validation and the allow-listed entry/relation
 * builders; `projectCentralWikiWorld` composes them.
 *
 *   ctrl --json action run machine.declaration {"role":"current"}   central.machine (inside data.declaration)
 *   workcell --json --workcell-ref <ref> discover                    the Workcell's offers (no schema field; recognised by shape)
 *   oi agent participation --agent <ref> --world <W> --json          oi.agent-world-participation/v1
 *   factory development run <state> <run-ref> --json                 factory.run-reading/v1 (in `contract`)
 *   aikit system source show <source> --json → active snapshot capsule oi.practice-offer-body/v1 (offered practices only; proved
 *                                                                     against the disclosed AIKit capsule revision)
 *
 * Published ≠ offered ≠ granted. A Workcell or practice selected for
 * `address` / inspection is addressable and nothing more; an offer travels
 * only when the selection names it under `offers`; a publication never grants
 * anything to a visitor. Nothing that is not selected contributes to entries,
 * meta, relations or counts.
 */
import { createHash } from 'node:crypto';

export const AGENT_PARTICIPATION_SCHEMA = 'oi.agent-world-participation/v1';
export const FACTORY_RUN_READING_CONTRACT = 'factory.run-reading/v1';
export const CENTRAL_MACHINE_SCHEMA = 'central.machine';
/** Label for `workcell discover --json`, which carries no schema of its own. */
export const WORKCELL_DISCOVERY_KIND = 'workcell.discover';
export const PRACTICE_KINDS = Object.freeze(['skill', 'method', 'skillset']);
/**
 * The body of an offered practice, read from AIKit's active content-addressed
 * snapshot and proved against the revision the Agent's participation
 * discloses (see `practiceOfferBody`). Only an offered practice carries one.
 */
export const PRACTICE_OFFER_BODY_SCHEMA = 'oi.practice-offer-body/v1';
/** AIKit's capsule content revision (`aikit_store::registry::compute_revision`). */
export const AIKIT_CAPSULE_REVISION_BASIS = 'aikit-capsule-revision-v2';
export const PRACTICE_BODY_MEDIA_TYPE = 'text/markdown';
export const PRACTICE_BODY_MAX_BYTES = 256 * 1024;

function record(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function strings(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value.map((entry, index) => text(entry, `${name}[${index}]`));
}

/** FNV-1a 64 over UTF-8, hex. Identifies a set of source revisions; it is not a secret. */
export function fnv1a64(input) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

/** A short lowercase vocabulary token (`occupied`, `seeded`, …) or undefined. */
export function token(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(value) ? value : undefined;
}

/** `workcell:<label>` — a name, never a host or address. */
export function workcellRef(value) {
  return typeof value === 'string' && /^workcell:[A-Za-z0-9._-]{1,64}$/.test(value) ? value : null;
}

/**
 * The owner schema a reading carries: `schema`, Factory's `contract`, the
 * Central machine declaration inside `declaration`, or the Workcell
 * discovery shape. Undefined when unrecognised.
 */
export function readingKind(reading) {
  if (typeof reading.schema === 'string') return reading.schema;
  if (typeof reading.contract === 'string') return reading.contract;
  if (reading.declaration && reading.declaration.schema === CENTRAL_MACHINE_SCHEMA) return CENTRAL_MACHINE_SCHEMA;
  if (typeof reading.workcell_ref === 'string' && Array.isArray(reading.offers)) return WORKCELL_DISCOVERY_KIND;
  return undefined;
}

// ── AIKit capsule revision (BLAKE3) ─────────────────────────────────────
// AIKit's Skill revision is BLAKE3 over the capsule directory: a domain line,
// the manifest (length, bytes, mode) and then every other regular file sorted
// by relative path (path length, path, mode, content length, content). The
// hash is recomputed here so an offered body is proved to be the exact
// revision the Agent discloses, not merely found beside it.
const B3_IV = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
const B3_PERMUTATION = [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8];
const B3_CHUNK_START = 1;
const B3_CHUNK_END = 2;
const B3_PARENT = 4;
const B3_ROOT = 8;
const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;

function b3g(s, a, b, c, d, x, y) {
  s[a] = (s[a] + s[b] + x) >>> 0; s[d] = rotr(s[d] ^ s[a], 16);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotr(s[b] ^ s[c], 12);
  s[a] = (s[a] + s[b] + y) >>> 0; s[d] = rotr(s[d] ^ s[a], 8);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotr(s[b] ^ s[c], 7);
}

function b3compress(cv, block, counter, length, flags) {
  const s = new Uint32Array(16);
  s.set(cv);
  s.set(B3_IV.subarray(0, 4), 8);
  s[12] = counter >>> 0;
  s[13] = Math.floor(counter / 0x100000000) >>> 0;
  s[14] = length;
  s[15] = flags;
  let m = Uint32Array.from(block);
  for (let round = 0; round < 7; round += 1) {
    b3g(s, 0, 4, 8, 12, m[0], m[1]); b3g(s, 1, 5, 9, 13, m[2], m[3]); b3g(s, 2, 6, 10, 14, m[4], m[5]); b3g(s, 3, 7, 11, 15, m[6], m[7]);
    b3g(s, 0, 5, 10, 15, m[8], m[9]); b3g(s, 1, 6, 11, 12, m[10], m[11]); b3g(s, 2, 7, 8, 13, m[12], m[13]); b3g(s, 3, 4, 9, 14, m[14], m[15]);
    const held = m;
    m = Uint32Array.from(B3_PERMUTATION, (index) => held[index]);
  }
  const out = new Uint32Array(8);
  for (let index = 0; index < 8; index += 1) out[index] = (s[index] ^ s[index + 8]) >>> 0;
  return out;
}

function b3block(bytes, offset, length) {
  const block = new Uint8Array(64);
  block.set(bytes.subarray(offset, offset + length));
  const words = new Uint32Array(16);
  for (let index = 0; index < 16; index += 1) words[index] = (block[index * 4] | (block[index * 4 + 1] << 8) | (block[index * 4 + 2] << 16) | (block[index * 4 + 3] << 24)) >>> 0;
  return words;
}

function b3chunk(bytes, chunk, root) {
  const start = chunk * 1024;
  const end = Math.min(bytes.length, start + 1024);
  const blocks = Math.max(1, Math.ceil((end - start) / 64));
  let cv = B3_IV;
  for (let index = 0; index < blocks; index += 1) {
    const offset = start + index * 64;
    const length = Math.max(0, Math.min(64, end - offset));
    let flags = index === 0 ? B3_CHUNK_START : 0;
    if (index === blocks - 1) flags |= B3_CHUNK_END | (root ? B3_ROOT : 0);
    cv = b3compress(cv, b3block(bytes, offset, length), chunk, length, flags);
  }
  return cv;
}

function b3subtree(bytes, first, count, root) {
  if (count === 1) return b3chunk(bytes, first, root);
  let left = 1;
  while (left * 2 < count) left *= 2;
  const block = new Uint32Array(16);
  block.set(b3subtree(bytes, first, left, false));
  block.set(b3subtree(bytes, first + left, count - left, false), 8);
  return b3compress(B3_IV, block, 0, 64, B3_PARENT | (root ? B3_ROOT : 0));
}

/** BLAKE3-256 of bytes (or UTF-8 text), lowercase hex. */
export function blake3Hex(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  if (!(bytes instanceof Uint8Array)) throw new TypeError('blake3Hex takes bytes or text');
  const cv = b3subtree(bytes, 0, Math.max(1, Math.ceil(bytes.length / 1024)), true);
  const out = new Uint8Array(32);
  for (let index = 0; index < 8; index += 1) for (let byte = 0; byte < 4; byte += 1) out[index * 4 + byte] = (cv[index] >>> (8 * byte)) & 0xff;
  return [...out].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function le64(value) { const out = new Uint8Array(8); new DataView(out.buffer).setBigUint64(0, BigInt(value), true); return out; }
function le32(value) { const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, value >>> 0, true); return out; }
const utf8 = (value) => new TextEncoder().encode(value);
function byteOrder(left, right) {
  const a = utf8(left); const b = utf8(right);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return a.length - b.length;
}

/**
 * AIKit's capsule revision over one capsule directory's contents:
 * `{manifest: {bytes, mode}, files: [{path, mode, bytes}]}` where `path` is
 * relative to the capsule directory (`/`-separated) and `mode` is the
 * permission bits. `files` excludes the top-level manifest and symlinks.
 */
export function aikitCapsuleRevision(capsule) {
  const { manifest, files } = record(capsule, 'capsule');
  record(manifest, 'capsule.manifest');
  if (!Array.isArray(files)) throw new TypeError('capsule.files must be an array');
  const parts = [utf8(`${AIKIT_CAPSULE_REVISION_BASIS}\n`), le64(manifest.bytes.length), manifest.bytes, le32(manifest.mode & 0o7777)];
  for (const file of [...files].sort((left, right) => byteOrder(left.path, right.path))) {
    const path = utf8(file.path);
    parts.push(le64(path.length), path, le32(file.mode & 0o7777), le64(file.bytes.length), file.bytes);
  }
  const total = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { total.set(part, offset); offset += part.length; }
  return blake3Hex(total);
}

export function sha256Digest(text) {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

/**
 * A practice body is carried as Markdown text data, never as markup to run:
 * anything script-capable or embedding-capable refuses the offer.
 */
const SCRIPT_CAPABLE = [
  { name: 'script-element', pattern: /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|base|form|frame|frameset|applet|svg|math|template)\b/i },
  { name: 'event-handler', pattern: /<[^>]*\son[a-z]+\s*=/i },
  { name: 'script-url', pattern: /(javascript|vbscript)\s*:|data\s*:\s*text\/html/i },
];

export function practiceBodyRefusals(text) {
  const refusals = [];
  if (typeof text !== 'string') return ['not-text'];
  if (new TextEncoder().encode(text).length > PRACTICE_BODY_MAX_BYTES) refusals.push('too-large');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) refusals.push('control-characters');
  for (const { name, pattern } of SCRIPT_CAPABLE) if (pattern.test(text)) refusals.push(name);
  return refusals;
}

function manifestSkillRoot(bytes) {
  const textValue = new TextDecoder().decode(bytes);
  const section = textValue.split(/^\[skill\]\s*$/m)[1];
  const match = section?.split(/^\[/m)[0].match(/^\s*root\s*=\s*"([^"]+)"\s*$/m);
  return match ? match[1] : 'payload';
}

/**
 * Build the offered body reading from one capsule as AIKit's active snapshot
 * holds it. The capsule's recomputed AIKit revision must equal the revision
 * the Agent's participation discloses for the practice; otherwise nothing is
 * read. Only the Skill's `SKILL.md` travels; other payload files are named
 * (relative to the capsule) so a reader knows what the text alone lacks.
 */
export function practiceOfferBody({ practice_ref: practiceRef, source_revision: sourceRevision, source_id: sourceId, snapshot, capsule }) {
  text(practiceRef, 'practice_ref');
  text(sourceRevision, 'source_revision');
  const revision = aikitCapsuleRevision(capsule);
  if (revision !== sourceRevision) throw new TypeError(`practice ${practiceRef}: AIKit's active snapshot holds revision ${revision.slice(0, 12)}, not the disclosed ${sourceRevision.slice(0, 12)}; refusing to publish its body`);
  const root = manifestSkillRoot(capsule.manifest.bytes);
  const skillPath = `${root}/SKILL.md`;
  const skill = capsule.files.find((file) => file.path === skillPath);
  if (!skill) throw new TypeError(`practice ${practiceRef}: the capsule carries no ${skillPath}`);
  let body;
  try { body = new TextDecoder('utf-8', { fatal: true }).decode(skill.bytes); } catch { throw new TypeError(`practice ${practiceRef}: SKILL.md is not UTF-8 text`); }
  const refusals = practiceBodyRefusals(body);
  if (refusals.length) throw new TypeError(`practice ${practiceRef}: the body is not curated text data (${refusals.join(', ')})`);
  return {
    schema: PRACTICE_OFFER_BODY_SCHEMA,
    practice_ref: practiceRef,
    source_revision: sourceRevision,
    revision_basis: AIKIT_CAPSULE_REVISION_BASIS,
    ...(sourceId ? { aikit_source: sourceId } : {}),
    ...(snapshot ? { aikit_snapshot: snapshot } : {}),
    media_type: PRACTICE_BODY_MEDIA_TYPE,
    text: body,
    body_digest: sha256Digest(body),
    body_bytes: skill.bytes.length,
    payload_files_not_carried: capsule.files.map((file) => file.path).filter((path) => path !== skillPath).sort(byteOrder),
  };
}

export function validatePracticeOfferBody(value) {
  const reading = record(value, 'practice offer body');
  if (reading.schema !== PRACTICE_OFFER_BODY_SCHEMA) throw new TypeError(`Unsupported practice offer body schema: ${reading.schema}`);
  text(reading.practice_ref, 'practice offer body.practice_ref');
  text(reading.source_revision, 'practice offer body.source_revision');
  if (reading.revision_basis !== AIKIT_CAPSULE_REVISION_BASIS) throw new TypeError(`practice offer body ${reading.practice_ref} is not proved against ${AIKIT_CAPSULE_REVISION_BASIS}`);
  if (reading.media_type !== PRACTICE_BODY_MEDIA_TYPE) throw new TypeError(`practice offer body ${reading.practice_ref} must be ${PRACTICE_BODY_MEDIA_TYPE}`);
  if (typeof reading.text !== 'string') throw new TypeError(`practice offer body ${reading.practice_ref}.text must be a string`);
  if (sha256Digest(reading.text) !== reading.body_digest) throw new TypeError(`practice offer body ${reading.practice_ref}: body_digest does not match its text`);
  if (new TextEncoder().encode(reading.text).length !== reading.body_bytes) throw new TypeError(`practice offer body ${reading.practice_ref}: body_bytes does not match its text`);
  const refusals = practiceBodyRefusals(reading.text);
  if (refusals.length) throw new TypeError(`practice offer body ${reading.practice_ref} is not curated text data (${refusals.join(', ')})`);
  strings(reading.payload_files_not_carried ?? [], `practice offer body ${reading.practice_ref}.payload_files_not_carried`);
  return reading;
}

export function validateMachineDeclaration(value) {
  const reading = record(value, 'machine declaration reading');
  const declaration = record(reading.declaration, 'machine declaration');
  text(declaration.role, 'machine declaration.role');
  if (!Array.isArray(declaration.bindings)) throw new TypeError('machine declaration.bindings must be an array');
  return reading;
}

export function validateWorkcellDiscovery(value) {
  const reading = record(value, 'workcell discovery');
  if (!workcellRef(reading.workcell_ref)) throw new TypeError(`workcell discovery.workcell_ref is not a Workcell name: ${reading.workcell_ref}`);
  for (const [index, offer] of reading.offers.entries()) {
    record(offer, `workcell discovery.offers[${index}]`);
    text(offer.offer_ref, `workcell discovery.offers[${index}].offer_ref`);
  }
  return reading;
}

export function validateAgentParticipation(value) {
  const reading = record(value, 'agent participation');
  if (reading.schema !== AGENT_PARTICIPATION_SCHEMA) throw new TypeError(`Unsupported agent participation schema: ${reading.schema}`);
  text(reading.agent_ref, 'agent participation.agent_ref');
  text(reading.world_ref, 'agent participation.world_ref');
  const repertoire = record(reading.repertoire, 'agent participation.repertoire');
  if (!Array.isArray(repertoire.praxis)) throw new TypeError('agent participation.repertoire.praxis must be an array');
  for (const [index, praxis] of repertoire.praxis.entries()) {
    record(praxis, `agent participation.repertoire.praxis[${index}]`);
    text(praxis.id, `agent participation.repertoire.praxis[${index}].id`);
    text(praxis.form, `agent participation.repertoire.praxis[${index}].form`);
    text(praxis.revision, `agent participation.repertoire.praxis[${index}].revision`);
  }
  return reading;
}

export function validateFactoryRunReading(value) {
  const reading = record(value, 'factory run reading');
  if (reading.contract !== FACTORY_RUN_READING_CONTRACT) throw new TypeError(`Unsupported factory run contract: ${reading.contract}`);
  text(reading.runRef, 'factory run reading.runRef');
  if (!Number.isSafeInteger(reading.revision) || reading.revision < 1) throw new TypeError('factory run reading.revision must be an integer >= 1');
  if (reading.agencies !== undefined && !Array.isArray(reading.agencies)) throw new TypeError('factory run reading.agencies must be an array');
  return reading;
}

/** Normalise a `mode` or `{mode, label}` selection value. */
function modeOf(value, allowed, name) {
  const mode = typeof value === 'string' ? value : value?.mode;
  if (!allowed.includes(mode)) throw new TypeError(`${name} must be ${allowed.join(' or ')}`);
  return mode;
}

/** Validate the selection keys this module owns; called from the wiki selection validator. */
export function validateConstituentSelection(selection) {
  const workcells = record(selection.workcells ?? {}, 'central wiki selection.workcells');
  for (const [ref, value] of Object.entries(workcells)) {
    if (!workcellRef(ref)) throw new TypeError(`central wiki selection.workcells key is not a Workcell name: ${ref}`);
    modeOf(value, ['address', 'offer'], `central wiki selection.workcells[${ref}]`);
    if (typeof value === 'object' && value.label !== undefined) text(value.label, `central wiki selection.workcells[${ref}].label`);
  }
  const practices = record(selection.practices ?? {}, 'central wiki selection.practices');
  for (const [positionRef, value] of Object.entries(practices)) {
    const refs = Array.isArray(value) ? value : record(value, `central wiki selection.practices[${positionRef}]`).refs;
    strings(refs, `central wiki selection.practices[${positionRef}]`);
    if (!Array.isArray(value) && value.agent_ref !== undefined) text(value.agent_ref, `central wiki selection.practices[${positionRef}].agent_ref`);
    const mode = selection.positions?.[positionRef];
    if (!['occupancy', 'repertoire'].includes(mode)) throw new TypeError(`central wiki selection.practices[${positionRef}] needs the Position selected in "occupancy" or "repertoire" mode`);
  }
  const offers = record(selection.offers ?? {}, 'central wiki selection.offers');
  for (const [subject, refs] of Object.entries(offers)) {
    strings(refs, `central wiki selection.offers[${subject}]`);
    if (workcellRef(subject)) {
      if (workcells[subject] === undefined || modeOf(workcells[subject], ['address', 'offer'], subject) !== 'offer') throw new TypeError(`central wiki selection.offers[${subject}] needs the Workcell selected in "offer" mode`);
    } else {
      const listed = practiceRefsOf(practices[subject]);
      for (const ref of refs) if (!listed.includes(ref)) throw new TypeError(`central wiki selection.offers[${subject}] offers ${ref}, which is not a selected practice of that Position`);
    }
  }
  const activity = record(selection.activity ?? {}, 'central wiki selection.activity');
  for (const [ref, value] of Object.entries(activity)) {
    if (!/^(run:|factory:custody:)/.test(ref)) throw new TypeError(`central wiki selection.activity key must be a Factory run or custody ref: ${ref}`);
    const liveness = typeof value === 'string' ? value : value?.liveness;
    if (!['live', 'static'].includes(liveness)) throw new TypeError(`central wiki selection.activity[${ref}] must be live or static`);
    if (typeof value === 'object' && value.purpose_summary !== undefined) {
      text(value.purpose_summary, `central wiki selection.activity[${ref}].purpose_summary`);
      if (value.purpose_summary.length > 280) throw new TypeError(`central wiki selection.activity[${ref}].purpose_summary is longer than 280 characters`);
    }
  }
}

function practiceRefsOf(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : value.refs ?? [];
}

/**
 * Build the Workcell, practice and activity constituents. Returns the
 * entries, relations, sources and presentation regions to add, plus the
 * per-Position meta additions (the practising Agent). Everything here is
 * allow-listed; nothing unselected is counted.
 */
export function buildConstituents(context) {
  const { selection, sorted, hosted, locator, projectionRelationProvenance, positionModes, occupancyByRef, workTargets } = context;
  const worldRef = selection.world_ref;
  const out = { entries: [], relations: [], sources: [], regions: [], positionMeta: new Map() };

  // ── Workcells ──────────────────────────────────────────────────────────
  const workcellSelection = selection.workcells ?? {};
  const discoveryByRef = new Map(sorted.workcells.map((reading) => [reading.workcell_ref, reading]));
  const workcellCards = [];
  for (const [ref, value] of Object.entries(workcellSelection)) {
    const mode = modeOf(value, ['address', 'offer'], ref);
    // Identity is attested by Central's machine declaration binding it, or by
    // AIKit's population reading naming it as local or reachable remote. The
    // Workcell product's own discovery is described under the ref its caller
    // supplies, so it describes a Workcell but never attests which one.
    const declaration = sorted.machines.map((reading) => reading.declaration).find((declaration) => declaration.bindings.some((binding) => binding.kind === 'workcell' && binding.reference === ref));
    const remote = (sorted.population?.remotes ?? []).some((row) => row.workcell_ref === ref);
    const local = sorted.population?.local_workcell_ref === ref;
    const materialRole = declaration ? `machine:${token(declaration.role) ?? 'declared'}` : remote ? 'remote' : local ? 'local' : null;
    if (!materialRole) throw new TypeError(`selected Workcell ${ref} is attested by no machine declaration (ctrl machine.declaration) or population reading (aikit gateway who)`);
    const discovery = discoveryByRef.get(ref);
    const offered = [];
    if (mode === 'offer') {
      if (!discovery) throw new TypeError(`Workcell ${ref} is selected with mode "offer" but no Workcell discovery reading (workcell --json --workcell-ref ${ref} discover) was supplied`);
      if (!declaration) throw new TypeError(`Workcell ${ref} is selected with mode "offer" but no machine declaration binds it to this machine`);
      for (const offerRef of selection.offers?.[ref] ?? []) {
        const offer = discovery.offers.find((candidate) => candidate.offer_ref === offerRef);
        if (!offer) throw new TypeError(`Workcell ${ref} offers ${offerRef}, which its discovery does not carry`);
        if (offer.availability !== 'available') throw new TypeError(`Workcell ${ref} offer ${offerRef} is not available`);
        offered.push({
          offer_ref: offer.offer_ref,
          port: token(offer.port) ?? null,
          affordances: (Array.isArray(offer.affordances) ? offer.affordances : []).filter((affordance) => typeof affordance === 'string' && /^[a-z][a-z0-9-]*(:[a-z0-9-]+)*$/.test(affordance)),
        });
      }
    }
    const label = (typeof value === 'object' && value.label) || `Workcell ${ref.slice('workcell:'.length)}`;
    const revision = `workcell:${fnv1a64(JSON.stringify([ref, label, materialRole, mode, offered]))}`;
    out.sources.push({ kind: 'workcell', ref, source_system: 'workcell', revision });
    const offerText = mode === 'offer' ? ` · ${offered.length} offered` : '';
    out.entries.push({
      ref: hosted(ref),
      kind: 'workcell',
      world_ref: worldRef,
      label,
      aliases: [ref],
      summary: `Workcell · ${materialRole}${offerText}`,
      revision,
      provenance: [{ kind: 'workcell', ref, source_system: 'workcell', revision }],
      locators: locator(hosted(ref)),
      meta: { standing: 'workcell', presentation: 'thing', disclosure: mode, local_ref: ref, label, material_role: materialRole, ...(mode === 'offer' ? { offers: offered } : {}) },
    });
    const worldRelation = `${worldRef}#oi.world/workcell#${hosted(ref)}`;
    out.relations.push({ relation_ref: worldRelation, from: worldRef, to: hosted(ref), relation: 'oi.world/workcell', origin: 'projection', provenance: projectionRelationProvenance(worldRelation) });
    for (const [positionRef, occupancy] of occupancyByRef) {
      if (occupancy.occupancy.workcell_ref !== ref) continue;
      const relationRef = `${hosted(positionRef)}#oi.world/carried-by#${hosted(ref)}`;
      out.relations.push({ relation_ref: relationRef, from: hosted(positionRef), to: hosted(ref), relation: 'oi.world/carried-by', origin: 'projection', provenance: projectionRelationProvenance(relationRef) });
    }
    workcellCards.push({ ref, label, text: `Workcell · ${materialRole}${offerText}`, refs: offered.map((offer) => offer.offer_ref), revision });
  }
  if (workcellCards.length) {
    out.regions.push({
      region_ref: 'workcells', role: 'relation', label: 'Workcells',
      bindings: workcellCards.map((card) => ({
        schema: 'oi.presentation-binding/v1',
        provenance: [{ kind: 'workcell', ref: card.ref, source_system: 'workcell', revision: card.revision }],
        binding_ref: `workcell:${card.ref.slice('workcell:'.length).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        component_ref: 'oi.presentation/reference-card/v1',
        portable_renderer: 'oi.presentation/reference-card/v1',
        subject_ref: hosted(card.ref),
        props: { title: card.label, text: card.text, refs: card.refs },
        fallback: { title: card.label, text: card.text },
      })),
    });
  }

  // ── Agent repertoire: practices ────────────────────────────────────────
  const practiceEntries = new Map();
  const practiceCards = [];
  for (const [positionRef, value] of Object.entries(selection.practices ?? {})) {
    const refs = [...new Set(practiceRefsOf(value))];
    const occupant = sorted.population?.positions.find((row) => row.position_ref === positionRef)?.occupancy?.agent_ref;
    const agentRef = (!Array.isArray(value) && value.agent_ref) || undefined;
    const claims = sorted.participations.filter((reading) => {
      const eligible = (reading.roles?.eligible ?? []).some((row) => row.position_ref === positionRef);
      const occupied = (reading.residence?.occupied_position_refs ?? []).includes(positionRef);
      return (eligible || occupied) && (!agentRef || reading.agent_ref === agentRef);
    });
    let participation = claims.length === 1 ? claims[0] : claims.find((reading) => reading.agent_ref === occupant);
    if (!participation) throw new TypeError(`Position ${positionRef} has practices selected but ${claims.length === 0 ? 'no agent participation reading (oi agent participation --agent <ref> --json) names it' : 'more than one Agent participation names it; name agent_ref in the selection'}`);
    if (sorted.positions && participation.world_ref !== sorted.positions.world_ref) throw new TypeError(`the agent participation for ${positionRef} reads ${participation.world_ref}, not the Position listing's world ${sorted.positions.world_ref}`);
    const offeredRefs = new Set(selection.offers?.[positionRef] ?? []);
    const basis = [];
    for (const practiceRef of refs) {
      const praxis = participation.repertoire.praxis.find((candidate) => candidate.id === practiceRef);
      if (!praxis) throw new TypeError(`practice ${practiceRef} is not in ${participation.agent_ref}'s repertoire as its participation discloses it`);
      const practiceKind = PRACTICE_KINDS.includes(praxis.form) ? praxis.form : null;
      if (!practiceKind) throw new TypeError(`practice ${practiceRef} has form ${praxis.form}; only ${PRACTICE_KINDS.join(', ')} publish`);
      const offered = offeredRefs.has(practiceRef);
      if (offered && praxis.available !== true) throw new TypeError(`practice ${practiceRef} is offered but its Agent does not have it available (${praxis.withheld_reason ? 'withheld' : 'unavailable'})`);
      const availability = offered ? 'offered' : 'inspectable';
      // An offer carries the practice's own body, proved against this
      // revision; an inspectable practice never carries one.
      let offer;
      if (offered) {
        const body = (sorted.practiceBodies ?? []).find((reading) => reading.practice_ref === practiceRef);
        if (!body) throw new TypeError(`practice ${practiceRef} is offered but no ${PRACTICE_OFFER_BODY_SCHEMA} reading carries its body (read from AIKit's active snapshot by publish-world.mjs)`);
        if (body.source_revision !== praxis.revision) throw new TypeError(`practice ${practiceRef} is offered at revision ${praxis.revision.slice(0, 12)} but its body was read at ${body.source_revision.slice(0, 12)}`);
        offer = {
          body_digest: body.body_digest,
          media_type: body.media_type,
          body_bytes: body.body_bytes,
          revision_basis: body.revision_basis,
          payload_files_not_carried: [...(body.payload_files_not_carried ?? [])],
          text: body.text,
        };
      }
      basis.push([practiceRef, practiceKind, praxis.revision, availability, ...(offer ? [offer.body_digest] : [])]);
      const held = practiceEntries.get(practiceRef);
      if (held && held.meta.source_revision !== praxis.revision) throw new TypeError(`practice ${practiceRef} is disclosed at two revisions by the selected Positions' Agents`);
      if (held) { if (offered) { held.meta.availability = 'offered'; held.meta.offer = offer; } }
      else {
        practiceEntries.set(practiceRef, {
          ref: hosted(practiceRef),
          kind: 'practice',
          world_ref: worldRef,
          label: typeof praxis.name === 'string' && praxis.name ? praxis.name : practiceRef,
          aliases: [practiceRef],
          summary: `${practiceKind} · source revision ${praxis.revision.slice(0, 12)}`,
          revision: praxis.revision,
          provenance: [{ kind: 'aikit-praxis', ref: practiceRef, source_system: 'ai-kit', revision: praxis.revision }],
          locators: locator(hosted(practiceRef)),
          meta: { standing: 'practice', presentation: 'thing', native_owner: 'ai-kit', local_ref: practiceRef, practice_kind: practiceKind, source_ref: practiceRef, source_revision: praxis.revision, availability, grant: 'none', ...(offer ? { offer } : {}) },
        });
      }
      const relationRef = `${hosted(positionRef)}#oi.world/practises#${hosted(practiceRef)}`;
      out.relations.push({
        relation_ref: relationRef,
        from: hosted(positionRef),
        to: hosted(practiceRef),
        relation: 'oi.world/practises',
        origin: 'projection',
        availability,
        provenance: [{ kind: 'agent-participation', ref: participation.agent_ref, source_system: 'o-i', revision: praxis.revision }, ...projectionRelationProvenance(relationRef)],
      });
    }
    basis.sort((left, right) => left[0].localeCompare(right[0]));
    out.sources.push({ kind: 'aikit-agent-repertoire', ref: `${participation.agent_ref}@${positionRef}`, source_system: 'ai-kit', revision: `repertoire:${fnv1a64(JSON.stringify(basis))}` });
    out.positionMeta.set(positionRef, { agent_ref: participation.agent_ref, practices: basis.length });
  }
  for (const entry of practiceEntries.values()) {
    entry.summary = `${entry.meta.practice_kind} · ${entry.meta.availability} · source revision ${entry.meta.source_revision.slice(0, 12)}`;
    out.entries.push(entry);
    practiceCards.push(entry);
  }
  if (practiceCards.length) {
    out.regions.push({
      region_ref: 'practices', role: 'relation', label: 'Practices',
      bindings: practiceCards.map((entry) => ({
        schema: 'oi.presentation-binding/v1',
        provenance: entry.provenance,
        binding_ref: `practice:${entry.meta.local_ref.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        component_ref: 'oi.presentation/reference-card/v1',
        portable_renderer: 'oi.presentation/reference-card/v1',
        subject_ref: entry.ref,
        props: { title: entry.label, text: entry.summary, refs: [] },
        fallback: { title: entry.label, text: entry.summary },
      })),
    });
  }

  // ── Activity ───────────────────────────────────────────────────────────
  const runByRef = new Map(sorted.runs.map((reading) => [reading.runRef, reading]));
  const activityCards = [];
  for (const [ref, value] of Object.entries(selection.activity ?? {})) {
    const liveness = typeof value === 'string' ? value : value.liveness;
    const purpose = typeof value === 'object' ? value.purpose_summary : undefined;
    let runRef = ref;
    let custodyRef = null;
    if (ref.startsWith('factory:custody:')) {
      const row = (sorted.population?.positions ?? []).find((candidate) => candidate.current_work?.custody_ref === ref);
      if (!row || typeof row.current_work.run_ref !== 'string') throw new TypeError(`activity ${ref} is a custody the population reading does not attest with a run`);
      runRef = row.current_work.run_ref;
      custodyRef = ref;
    }
    const run = runByRef.get(runRef);
    if (!run) throw new TypeError(`activity ${ref} needs a factory.run-reading/v1 for ${runRef} (factory development run <state> ${runRef} --json)`);
    const agencies = new Set((run.agencies ?? []).map((agency) => agency?.agencyRef).filter((agencyRef) => typeof agencyRef === 'string'));
    // A participant is a Position this publication discloses occupancy for,
    // attested by the population (its current work names this run or custody)
    // or by the run itself (its Agency is bound to the run).
    const participants = [];
    const worksOn = [];
    for (const [positionRef] of occupancyByRef) {
      const row = sorted.population.positions.find((candidate) => candidate.position_ref === positionRef);
      const work = row?.current_work ?? {};
      const byWork = work.run_ref === runRef || (custodyRef && work.custody_ref === custodyRef);
      const byAgency = typeof row?.occupancy?.agency_ref === 'string' && agencies.has(row.occupancy.agency_ref);
      if (!byWork && !byAgency) continue;
      participants.push(positionRef);
      if (byWork && work.outcome === 'one' && typeof work.work_ref === 'string' && workTargets.has(work.work_ref) && !worksOn.includes(work.work_ref)) worksOn.push(work.work_ref);
    }
    participants.sort();
    worksOn.sort();
    const state = token(run.lifecycle) ?? 'unavailable';
    const revision = String(run.revision);
    out.sources.push({ kind: 'factory-run', ref, source_system: 'factory', revision: `activity:${fnv1a64(JSON.stringify([runRef, run.revision, state, participants, worksOn, liveness, purpose ?? null]))}` });
    const label = purpose ? purpose : `Factory run ${runRef.slice('run:'.length, 'run:'.length + 10)}`;
    const summary = `activity · ${state} · ${liveness} · ${participants.length} participant${participants.length === 1 ? '' : 's'}`;
    out.entries.push({
      ref: hosted(ref),
      kind: 'activity',
      world_ref: worldRef,
      label,
      aliases: [ref, ...(custodyRef ? [runRef] : [])],
      summary,
      revision,
      provenance: [{ kind: 'factory-run', ref: runRef, source_system: 'factory', revision }],
      locators: locator(hosted(ref)),
      meta: {
        standing: 'activity', local_ref: ref, state, run_ref: runRef, ...(custodyRef ? { custody_ref: custodyRef } : {}),
        ...(purpose ? { purpose_summary: purpose } : {}),
        participants: participants.map(hosted), liveness,
      },
    });
    const worldRelation = `${worldRef}#oi.world/activity#${hosted(ref)}`;
    out.relations.push({ relation_ref: worldRelation, from: worldRef, to: hosted(ref), relation: 'oi.world/activity', origin: 'projection', provenance: projectionRelationProvenance(worldRelation) });
    for (const positionRef of participants) {
      const relationRef = `${hosted(ref)}#oi.activity/participant#${hosted(positionRef)}`;
      out.relations.push({ relation_ref: relationRef, from: hosted(ref), to: hosted(positionRef), relation: 'oi.activity/participant', origin: 'projection', provenance: [{ kind: 'factory-run', ref: runRef, source_system: 'factory', revision }, ...projectionRelationProvenance(relationRef)] });
    }
    for (const target of worksOn) {
      const relationRef = `${hosted(ref)}#oi.activity/works-on#${hosted(target)}`;
      out.relations.push({ relation_ref: relationRef, from: hosted(ref), to: hosted(target), relation: 'oi.activity/works-on', origin: 'projection', provenance: [{ kind: 'factory-run', ref: runRef, source_system: 'factory', revision }, ...projectionRelationProvenance(relationRef)] });
    }
    activityCards.push({ ref, label, summary, refs: [...participants, ...worksOn].map(hosted), revision, runRef });
  }
  if (activityCards.length) {
    out.regions.push({
      region_ref: 'activity', role: 'relation', label: 'Activity',
      bindings: activityCards.map((card) => ({
        schema: 'oi.presentation-binding/v1',
        provenance: [{ kind: 'factory-run', ref: card.runRef, source_system: 'factory', revision: card.revision }],
        binding_ref: `activity:${card.ref.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        component_ref: 'oi.presentation/reference-card/v1',
        portable_renderer: 'oi.presentation/reference-card/v1',
        subject_ref: hosted(card.ref),
        props: { title: card.label, text: card.summary, refs: card.refs },
        fallback: { title: card.label, text: card.summary },
      })),
    });
  }
  return out;
}
