/**
 * Practice adoption — the reader's side of an offered Skill or Method.
 *
 * A World publication may offer a practice: its entry carries the practice's
 * native identity (`meta.source_ref`, `meta.source_revision`) and its body
 * (`meta.offer`), proved against that revision when it was published. An
 * offer is not trust and not execution. Adoption is the reader's deliberate
 * act: inspect the offered body, materialise it verbatim as a local Skill
 * directory with its provenance beside it, and register it through the
 * reader's own AIKit (`system source add-directory → sync → promote`) so it
 * becomes an ordinary, reviewable capability of the reader's world. An
 * intentional adaptation is an AIKit Skill Usage Overlay over the adopted
 * Skill — the verbatim body is never edited — and is recorded as a local
 * difference.
 *
 * The original identity and version are never overwritten: each source
 * revision adopts into its own directory and AIKit source
 * (`<slug>@<short-revision>`, `adopted-<slug>-<short-revision>`), so a new
 * revision stands beside the old one, and re-adopting the same revision is
 * idempotent.
 *
 * Two paths, chosen by what the reader's AIKit can do:
 *
 *   capsule    the offer carries the whole capsule (`meta.offer.capsule`, an
 *              `aikit.practice-capsule/v1` archive as data) and the reader's
 *              AIKit has `system source add-capsule` (AIKit ≥ #455): the
 *              archive is written beside a provenance file and registered with
 *              `source add-capsule <archive> --world-ref --upstream-ref
 *              --provenance @file` → sync → promote. The practice keeps its
 *              ORIGINAL id and revision; provenance lives in AIKit's
 *              registration, never inside the capsule. If another source in
 *              this AIKit home already has that id active, promotion is
 *              refused and the result is `identity-already-active`, naming it.
 *   body-only  the declared fallback (an older AIKit, or an offer without a
 *              capsule): the verbatim SKILL.md and ADOPTED.json in a
 *              directory registered as `adopted-<slug>-<short-revision>`.
 *
 * This module holds no I/O of its own: `adoptPractice` takes injected file and
 * AIKit effects; `scripts/adopt-practice.mjs` supplies the real ones.
 */
import { join } from 'node:path';
import { PRACTICE_BODY_MEDIA_TYPE, practiceBodyRefusals, sha256Digest, validateOfferedCapsule } from './world-constituents.mjs';

export const ADOPTED_PRACTICE_SCHEMA = 'oi.adopted-practice/v1';
export const PRACTICE_ADOPTION_RESULT_SCHEMA = 'oi.practice-adoption-result/v1';
export const SHARED_FIELD_READING_SCHEMA = 'oi.shared-field.reading/v1';
const WORLD_PUBLICATION_SCHEMA = 'oi.world-publication/v1';
const SHORT_REVISION = 12;

function record(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function latestProjection(projections, worldRef) {
  const candidates = (projections ?? []).filter((projection) => projection?.subject?.ref === worldRef && Number.isSafeInteger(projection.projection_revision));
  return candidates.sort((left, right) => right.projection_revision - left.projection_revision)[0];
}

/**
 * The offered practice as a reader holds it: from a hosted reading of the
 * practice ref (`field.sh read`, `oi.shared-field.reading/v1`, bare or in its
 * `{ok, data}` envelope), or from a publication bundle and the practice ref.
 * Refuses anything that is not an offered practice whose body matches its
 * published digest.
 */
export function offeredPractice(input, ref) {
  let value = record(input, 'offered practice input');
  if (typeof value.ok === 'boolean') {
    if (value.ok !== true) throw new TypeError(`the reading is a refusal: ${value.error?.kind ?? value.error?.code ?? 'unknown'}`);
    value = record(value.data, 'reading.data');
  }
  let entry;
  let fieldRef;
  let projection;
  if (value.schema === SHARED_FIELD_READING_SCHEMA) {
    if (value.state !== 'hosted') throw new TypeError(`${value.ref} is ${value.state} in this field; there is nothing to adopt`);
    entry = record(value.entry, 'reading.entry');
    fieldRef = value.field_ref;
    projection = latestProjection(value.projections, entry.world_ref);
  } else if (value.schema === WORLD_PUBLICATION_SCHEMA) {
    text(ref, 'practice ref');
    entry = (value.entries ?? []).find((candidate) => candidate.ref === ref || (candidate.aliases ?? []).includes(ref));
    if (!entry) throw new TypeError(`the publication carries no entry ${ref}`);
    fieldRef = value.field?.field_ref;
    projection = value.projection;
  } else {
    throw new TypeError(`Unsupported adoption input: ${value.schema}; pass a hosted reading (${SHARED_FIELD_READING_SCHEMA}) or a publication bundle`);
  }
  if (entry.kind !== 'practice') throw new TypeError(`${entry.ref} is a ${entry.kind}, not a practice`);
  const meta = record(entry.meta, `${entry.ref}.meta`);
  if (meta.availability !== 'offered') throw new TypeError(`${entry.ref} is ${meta.availability ?? 'not offered'}: publication alone is not an offer, and only an offered practice may be adopted`);
  const offer = meta.offer;
  if (!offer || typeof offer.text !== 'string') throw new TypeError(`${entry.ref} is offered but carries no body`);
  if (offer.media_type !== PRACTICE_BODY_MEDIA_TYPE) throw new TypeError(`${entry.ref} offers a ${offer.media_type} body; only ${PRACTICE_BODY_MEDIA_TYPE} is adoptable`);
  if (sha256Digest(offer.text) !== offer.body_digest) throw new TypeError(`${entry.ref}: the offered body does not match its published digest; refusing to adopt`);
  if (new TextEncoder().encode(offer.text).length !== offer.body_bytes) throw new TypeError(`${entry.ref}: the offered body does not match its published length; refusing to adopt`);
  const refusals = practiceBodyRefusals(offer.text);
  if (refusals.length) throw new TypeError(`${entry.ref}: the offered body is not curated text data (${refusals.join(', ')})`);
  if (!projection) throw new TypeError(`${entry.ref}: the reading carries no Projection of ${entry.world_ref} to cite as the adoption's source`);
  const capsule = offer.capsule === undefined ? null : validateOfferedCapsule(offer.capsule, { practice_ref: meta.source_ref, source_revision: meta.source_revision, text: offer.text });
  return {
    world_ref: text(entry.world_ref, 'entry.world_ref'),
    entry_ref: entry.ref,
    field_ref: text(fieldRef, 'field_ref'),
    projection_ref: text(projection.projection_ref, 'projection_ref'),
    projection_revision: projection.projection_revision,
    source_ref: text(meta.source_ref, `${entry.ref}.meta.source_ref`),
    source_revision: text(meta.source_revision, `${entry.ref}.meta.source_revision`),
    practice_kind: meta.practice_kind ?? null,
    label: entry.label,
    body: { text: offer.text, media_type: offer.media_type, body_digest: offer.body_digest, body_bytes: offer.body_bytes, payload_files_not_carried: [...(offer.payload_files_not_carried ?? [])] },
    capsule,
  };
}

function slugOf(sourceRef) {
  const slug = sourceRef.split('/').at(-1).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) throw new TypeError(`cannot name a local Skill after ${sourceRef}`);
  return slug;
}

/** The Skill's own name as its frontmatter declares it (AIKit names the capsule by it). */
function skillName(body, fallback) {
  const frontmatter = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const name = frontmatter?.[1].match(/^name:\s*["']?([A-Za-z0-9._-]+)["']?\s*$/m)?.[1];
  return name ?? fallback;
}

/**
 * Where and as what the offered practice is adopted. Pure: names the
 * directory, the AIKit source and capability, and the local differences.
 */
export function adoptionPlan(offered, options) {
  record(options, 'adoption options');
  text(options.root, 'root');
  text(options.adopter_participant_ref, 'adopter_participant_ref');
  const slug = slugOf(offered.source_ref);
  const short = offered.source_revision.replace(/^[a-z0-9-]+:/, '').slice(0, SHORT_REVISION);
  if (!/^[A-Za-z0-9]+$/.test(short)) throw new TypeError(`source revision ${offered.source_revision} cannot name a local directory`);
  const sourceId = `adopted-${slug}-${short.toLowerCase()}`;
  const capabilityRef = `skill/${sourceId}/${skillName(offered.body.text, slug)}`;
  const scope = options.scope ?? 'global';
  const adaptation = options.adaptation === undefined || options.adaptation === null ? null : text(options.adaptation, 'adaptation');
  return {
    dir: join(options.root, `${slug}@${short}`),
    source_id: sourceId,
    capability_ref: capabilityRef,
    scope,
    difference: adaptation === null ? null : {
      kind: 'aikit-skill-overlay',
      overlay_ref: `aikit:skill-overlay:${scope}:${capabilityRef}`,
      capability_ref: capabilityRef,
      scope,
      guidance: adaptation,
      guidance_digest: sha256Digest(adaptation),
      adapts: { source_ref: offered.source_ref, source_revision: offered.source_revision },
      note: 'additive guidance applied through AIKit; the adopted SKILL.md stays the verbatim offered body',
    },
  };
}

function adoptedFrom(offered) {
  return {
    world_ref: offered.world_ref,
    entry_ref: offered.entry_ref,
    field_ref: offered.field_ref,
    projection_ref: offered.projection_ref,
    projection_revision: offered.projection_revision,
    source_ref: offered.source_ref,
    source_revision: offered.source_revision,
    body_digest: offered.body.body_digest,
  };
}

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/** The ADOPTED.json document, keeping an earlier adoption's time and differences when re-adopting. */
export function adoptedRecord(offered, plan, options, existing) {
  const from = adoptedFrom(offered);
  if (existing) {
    if (existing.schema !== ADOPTED_PRACTICE_SCHEMA || !same(existing.adopted_from, from)) throw new TypeError(`${plan.dir} already holds a different adoption; the original is never overwritten`);
  }
  let differences = [...(existing?.local_differences ?? [])];
  if (plan.difference) differences = [...differences.filter((difference) => difference.overlay_ref !== plan.difference.overlay_ref), plan.difference];
  return {
    schema: ADOPTED_PRACTICE_SCHEMA,
    adopted_from: from,
    adopted_at: existing?.adopted_at ?? text(options.adopted_at ?? new Date().toISOString(), 'adopted_at'),
    adopter_participant_ref: existing?.adopter_participant_ref ?? options.adopter_participant_ref,
    practice_kind: offered.practice_kind,
    label: offered.label,
    aikit: { source_id: plan.source_id, capability_ref: plan.capability_ref },
    payload_files_not_carried: offered.body.payload_files_not_carried,
    local_differences: differences,
  };
}

function aikitStep(result, what) {
  if (result?.refused) throw new TypeError(`aikit ${what} refused: ${result.refused.code ?? ''} ${result.refused.message ?? ''}`.trim());
  return result.data;
}

/** Where the capsule path keeps its archive and provenance: outside any capsule. */
export function capsuleAdoptionPlan(offered, options) {
  record(options, 'adoption options');
  text(options.root, 'root');
  text(options.adopter_participant_ref, 'adopter_participant_ref');
  const slug = slugOf(offered.source_ref);
  const short = offered.source_revision.replace(/^[a-z0-9-]+:/, '').slice(0, SHORT_REVISION);
  if (!/^[A-Za-z0-9]+$/.test(short)) throw new TypeError(`source revision ${offered.source_revision} cannot name a local directory`);
  const dir = join(options.root, 'capsules', `${slug}@${short}`);
  const capabilityRef = offered.source_ref;
  const scope = options.scope ?? 'global';
  const adaptation = options.adaptation === undefined || options.adaptation === null ? null : text(options.adaptation, 'adaptation');
  return {
    dir,
    archive: join(dir, 'capsule.json'),
    provenance: join(dir, 'provenance.json'),
    capability_ref: capabilityRef,
    scope,
    difference: adaptation === null ? null : {
      kind: 'aikit-skill-overlay',
      overlay_ref: `aikit:skill-overlay:${scope}:${capabilityRef}`,
      capability_ref: capabilityRef,
      scope,
      guidance: adaptation,
      guidance_digest: sha256Digest(adaptation),
      adapts: { source_ref: offered.source_ref, source_revision: offered.source_revision },
      note: 'additive guidance applied through AIKit; the adopted capsule stays the verbatim offered archive',
    },
  };
}

/**
 * Adopt an offered practice. `effects`:
 *   fs.read(path) → string | undefined, fs.write(path, text), fs.mkdir(path)
 *   aikit(words) → {data} | {refused: {code, message, details}}   (words exclude `--json`)
 *   supports(words) → boolean   whether this AIKit answers `words --help`
 *                               (absent: treated as an older AIKit)
 */
export function adoptPractice(input, options, effects) {
  const offered = offeredPractice(input, options.ref);
  const canAddCapsule = typeof effects.supports === 'function' && effects.supports(['source', 'add-capsule']);
  if (offered.capsule && canAddCapsule) return adoptCapsule(offered, options, effects);
  const fallback = offered.capsule
    ? 'this AIKit has no `source add-capsule`; only SKILL.md is adopted, the other capsule files are not'
    : 'the offer carries SKILL.md only (published by an AIKit without `praxis read`)';
  // What the body-only path leaves behind is named, never silently dropped.
  const notCarried = offered.capsule
    ? offered.capsule.files.map((file) => file.path).filter((path) => path !== 'manifest.toml' && !path.endsWith('/SKILL.md')).sort()
    : offered.body.payload_files_not_carried;
  const bodyOnly = { ...offered, body: { ...offered.body, payload_files_not_carried: notCarried } };
  return { ...adoptBody(bodyOnly, options, effects), path: 'body-only', fallback_reason: fallback };
}

function adoptCapsule(offered, options, effects) {
  const plan = capsuleAdoptionPlan(offered, options);
  const { fs, aikit } = effects;
  const archiveText = `${JSON.stringify(offered.capsule, null, 2)}\n`;
  const provenance = { world_ref: offered.world_ref, entry_ref: offered.entry_ref, practice_id: offered.source_ref, revision: offered.source_revision };
  const provenanceText = `${JSON.stringify(provenance, null, 2)}\n`;
  const heldArchive = fs.read(plan.archive);
  const heldProvenance = fs.read(plan.provenance);
  if (heldArchive !== undefined && heldArchive !== archiveText) throw new TypeError(`${plan.archive} holds a different archive; the adopted original is never overwritten`);
  if (heldProvenance !== undefined && heldProvenance !== provenanceText) throw new TypeError(`${plan.provenance} holds a different provenance; the adopted original is never overwritten`);
  const wrote = [];
  fs.mkdir(plan.dir);
  if (heldArchive === undefined) { fs.write(plan.archive, archiveText); wrote.push('capsule.json'); }
  if (heldProvenance === undefined) { fs.write(plan.provenance, provenanceText); wrote.push('provenance.json'); }

  // AIKit verifies the archive (paths, modes, sha256, revision) and records
  // the upstream provenance in the registration. Re-adding is idempotent.
  const add = aikitStep(aikit(['source', 'add-capsule', plan.archive, '--world-ref', offered.world_ref, '--upstream-ref', offered.entry_ref, '--provenance', `@${plan.provenance}`]), 'source add-capsule');
  const sourceId = text(add.id, 'add-capsule id');
  if (add.capsule?.id !== offered.source_ref || add.capsule?.revision !== offered.source_revision) throw new TypeError(`AIKit registered ${add.capsule?.id}@${add.capsule?.revision}, not the offered ${offered.source_ref}@${offered.source_revision}`);
  const shown = aikitStep(aikit(['source', 'show', sourceId]), 'source show');
  const before = shown.active_snapshot ?? null;
  const sync = aikitStep(aikit(['source', 'sync', sourceId]), 'source sync');
  let promote = null;
  if (!(sync.candidate_snapshot && sync.candidate_snapshot === before)) {
    const promoted = aikit(['source', 'promote', sourceId]);
    if (promoted.refused?.code === 'source.capsule_identity_active') {
      const details = promoted.refused.details ?? {};
      return {
        schema: PRACTICE_ADOPTION_RESULT_SCHEMA,
        path: 'capsule',
        state: 'identity-already-active',
        adopted_dir: plan.dir,
        wrote,
        original: { source_ref: offered.source_ref, source_revision: offered.source_revision, body_digest: offered.body.body_digest },
        active_source: details.active_source ?? null,
        capability_ref: details.capability ?? plan.capability_ref,
        aikit: { source_id: sourceId, capability_ref: plan.capability_ref, snapshot: sync.candidate_snapshot ?? null, promoted: false, upstream: add.upstream ?? null, steps: { add, sync, promote: { refused: promoted.refused } } },
        message: `${plan.capability_ref} is already active in this AIKit home through source ${details.active_source ?? '(unnamed)'}; the adopted capsule is registered as ${sourceId} but not promoted. Nothing was overwritten — roll back or remove that source first if this revision should speak for the id.`,
      };
    }
    promote = aikitStep(promoted, 'source promote');
  }
  const explained = aikitStep(aikit(['explain', plan.capability_ref]), 'explain');
  if (explained.id !== plan.capability_ref || explained.revision !== offered.source_revision) throw new TypeError(`AIKit does not catalogue ${plan.capability_ref} at the offered revision after promotion (it holds ${explained.revision ?? 'none'})`);

  let overlay = null;
  if (plan.difference) {
    const current = aikit(['skill', 'overlay', 'show', plan.capability_ref]);
    const applied = !current.refused && (current.data.overlays ?? []).some((row) => row.scope === plan.scope && row.guidance === plan.difference.guidance && row.reviewed_against === explained.revision);
    overlay = applied
      ? { state: 'unchanged' }
      : { state: 'set', result: aikitStep(aikit(['skill', 'overlay', 'set', plan.capability_ref, '--scope', plan.scope, '--guidance', plan.difference.guidance, '--reviewed-against', explained.revision]), 'skill overlay set') };
  }

  const already = wrote.length === 0 && add.already_registered === true && !promote && (!overlay || overlay.state === 'unchanged');
  return {
    schema: PRACTICE_ADOPTION_RESULT_SCHEMA,
    path: 'capsule',
    state: already ? 'already-adopted' : 'adopted',
    adopted_dir: plan.dir,
    wrote,
    adopted: {
      adopted_from: { ...adoptedFrom(offered), files: offered.capsule.files.length },
      adopted_at: text(options.adopted_at ?? new Date().toISOString(), 'adopted_at'),
      adopter_participant_ref: options.adopter_participant_ref,
      practice_kind: offered.practice_kind,
      label: offered.label,
      local_differences: plan.difference ? [plan.difference] : [],
    },
    original: { source_ref: offered.source_ref, source_revision: offered.source_revision, body_digest: offered.body.body_digest },
    aikit: {
      source_id: sourceId,
      capability_ref: plan.capability_ref,
      snapshot: sync.candidate_snapshot ?? null,
      adopted_revision: explained.revision,
      upstream: add.upstream ?? null,
      steps: { add, sync, promote, overlay },
    },
    invoke: {
      capability_ref: plan.capability_ref,
      enable: `aikit enable ${plan.capability_ref} --scope ${plan.scope} --apply`,
      read: `aikit praxis read ${plan.capability_ref} --json`,
      note: 'adopted and promoted under its original id, not yet enabled: enabling it in a scope is the reader\'s next deliberate act',
    },
  };
}

function adoptBody(offered, options, effects) {
  const plan = adoptionPlan(offered, options);
  const { fs, aikit } = effects;

  const skillPath = join(plan.dir, 'SKILL.md');
  const adoptedPath = join(plan.dir, 'ADOPTED.json');
  const heldSkill = fs.read(skillPath);
  const heldAdopted = fs.read(adoptedPath);
  if (heldSkill !== undefined && heldSkill !== offered.body.text) throw new TypeError(`${skillPath} no longer holds the verbatim offered body; the adopted original is never overwritten — adapt through an overlay instead`);
  const existing = heldAdopted === undefined ? undefined : JSON.parse(heldAdopted);
  const adopted = adoptedRecord(offered, plan, options, existing);
  const adoptedText = `${JSON.stringify(adopted, null, 2)}\n`;
  const wrote = [];
  fs.mkdir(plan.dir);
  if (heldSkill === undefined) { fs.write(skillPath, offered.body.text); wrote.push('SKILL.md'); }
  if (heldAdopted !== adoptedText) { fs.write(adoptedPath, adoptedText); wrote.push('ADOPTED.json'); }
  if (sha256Digest(fs.read(skillPath)) !== offered.body.body_digest) throw new TypeError(`${skillPath} does not read back as the offered body`);

  // Register through the reader's own AIKit: a machine-local directory source,
  // an immutable candidate snapshot, then promotion.
  const shown = aikit(['source', 'show', plan.source_id]);
  const add = shown.refused ? aikitStep(aikit(['source', 'add-directory', plan.source_id, plan.dir]), 'source add-directory') : null;
  const before = shown.refused ? null : shown.data.active_snapshot ?? null;
  const sync = aikitStep(aikit(['source', 'sync', plan.source_id]), 'source sync');
  const promote = sync.candidate_snapshot && sync.candidate_snapshot === before ? null : aikitStep(aikit(['source', 'promote', plan.source_id]), 'source promote');
  const explained = aikitStep(aikit(['explain', plan.capability_ref]), 'explain');
  if (explained.id !== plan.capability_ref || typeof explained.revision !== 'string') throw new TypeError(`AIKit does not catalogue ${plan.capability_ref} after promotion`);

  // The intentional adaptation, if any: an additive overlay reviewed against
  // the adopted capsule's own revision. The body stays verbatim.
  let overlay = null;
  if (plan.difference) {
    const current = aikit(['skill', 'overlay', 'show', plan.capability_ref]);
    const applied = !current.refused && (current.data.overlays ?? []).some((row) => row.scope === plan.scope && row.guidance === plan.difference.guidance && row.reviewed_against === explained.revision);
    overlay = applied
      ? { state: 'unchanged' }
      : { state: 'set', result: aikitStep(aikit(['skill', 'overlay', 'set', plan.capability_ref, '--scope', plan.scope, '--guidance', plan.difference.guidance, '--reviewed-against', explained.revision]), 'skill overlay set') };
  }

  const already = heldSkill !== undefined && wrote.length === 0 && !add && !promote && (!overlay || overlay.state === 'unchanged');
  return {
    schema: PRACTICE_ADOPTION_RESULT_SCHEMA,
    state: already ? 'already-adopted' : 'adopted',
    adopted_dir: plan.dir,
    wrote,
    adopted,
    original: { source_ref: offered.source_ref, source_revision: offered.source_revision, body_digest: offered.body.body_digest },
    aikit: {
      source_id: plan.source_id,
      capability_ref: plan.capability_ref,
      snapshot: sync.candidate_snapshot ?? null,
      adopted_revision: explained.revision,
      steps: { add, sync, promote, overlay },
    },
    invoke: {
      capability_ref: plan.capability_ref,
      enable: `aikit enable ${plan.capability_ref} --scope ${plan.scope} --apply`,
      read: `aikit capabilities read ${plan.capability_ref} --json`,
      note: 'adopted and promoted, not yet enabled: enabling it in a scope is the reader\'s next deliberate act',
    },
  };
}
