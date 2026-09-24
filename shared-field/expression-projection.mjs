/**
 * Expression → audience-filtered Projection (SF1 carrier, O:I #18 / #306 EX6).
 *
 * One ordinary local Expression (`oi.expression/v1`, the document the native
 * application exports) becomes a WorldPresentation whose living body is an
 * `oi.presentation/expression/v1` binding, wrapped in an ordinary
 * `oi.projection/v1` envelope. Filtering happens HERE, before serialization:
 * the outward composition carries only the declared material vocabulary and
 * explicitly admitted refs. CSS hiding is not privacy; local export is not a
 * Projection.
 *
 * What travels (the `oi.expression-composition/v1` inside the binding props):
 *   expression ref + revision + title; the SELECTED scenes and the entities
 *   they compose; each entity's material parameters (glyph, x, y, z, scale,
 *   share, with their automation); safe subject bindings (subject ref, native
 *   owner, presentation role, and only the source refs the selection admits);
 *   presentation relations between surviving entities; the selection focus;
 *   non-private representations (image/video/html/projection).
 *
 * What never travels, and is counted as an omission the publisher can see:
 *   readings (the owner's incoming private reading refs), Action disclosures
 *   (authority is per caller, never published), unselected scenes and the
 *   entities only they compose, parameters outside the material vocabulary,
 *   `live`/`embed` representations (renderer-local), sources whose
 *   availability is not `available`, and sources/provenance whose ref names
 *   protected ground (`PROTECTED_REF_PATTERNS`) unless the selection admits
 *   that exact ref through `include_source_refs`.
 *
 * World relations (`oi.world/authored-by`, `oi.world/expresses`): when the
 * publisher names the Position the Expression was authored for and/or the
 * constellation it expresses (`input.authoring`), and the target SharedField
 * already hosts that Position / constellation as a World entry
 * (`input.field_entries`, from the field's own snapshot), the publication
 * relates the Expression to them. An authoring ref the field does not host —
 * or hosts ambiguously, or hosts in another field — yields no relation and
 * is named to the publisher as an omission; the local ref never travels.
 *
 * The receiving client renders the live Expression from the composition when
 * it admits the named live renderer; otherwise it renders the explicit
 * fallback representation the publication carries (a frozen HTML reading of
 * the composition, plus an optional captured image). The Projection revision
 * stays distinct from the Expression revision and the presentation revision.
 */
import { createParticipant, createProjection } from './index.mjs';
import { createSharedField } from './social.mjs';
import { createExploreEntry } from './explore.mjs';
import { createWorldPresentation } from './presentation.mjs';
import { createWorldPresentationProjection } from './presentation-projection.mjs';
import { projectionStorageKey } from './spacetimedb.mjs';
import { EXPRESSION_PRESENTATION_RENDERER, EXPRESSION_PRESENTATION_SCHEMA, validateExpressionPresentation } from './expression-presentation.mjs';
import { publicationSentinelLeaks } from './central-wiki-projection.mjs';

export const EXPRESSION_PUBLICATION_SCHEMA = 'oi.expression-publication/v1';
export const EXPRESSION_COMPOSITION_SCHEMA = 'oi.expression-composition/v1';
export const EXPRESSION_DOCUMENT_SCHEMA = 'oi.expression/v1';
/** The one accepted live renderer the desktop and the browser can name. */
export const LIVE_RENDERER_REF = 'renderer:oi:expression-stage';
/** The declared material vocabulary (EX1): nothing else leaves the world. */
export const MATERIAL_PARAMETERS = Object.freeze(['glyph', 'x', 'y', 'z', 'scale', 'share']);
export const WAVEFORMS = Object.freeze(['sine', 'triangle', 'square', 'saw']);
/** Representation kinds a Projection may carry; `live` and `embed` are renderer-local. */
export const PORTABLE_REPRESENTATION_KINDS = Object.freeze(['image', 'video', 'html', 'projection']);
/** Refs naming protected ground: withheld unless the selection admits the exact ref. */
export const PROTECTED_REF_PATTERNS = Object.freeze([
  /Control\/user(\/|$)/,
  /Control\/relations(\/|$)/,
  /Control\/machines(\/|$)/,
  /Control\/agents\/expressions(\/|$)/,
  /Control\/agents\/machines(\/|$)/,
  /(^|[:/])agent-session[:/]/,
  /^nara:/,
  /^personal:/,
]);
const VISIBILITIES = new Set(['public', 'unlisted', 'restricted', 'private']);
const LIMITS = Object.freeze({ scenes: 64, entities: 256, relations: 256, glyph: 64, title: 512, html: 262_144 });

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const record = (value, name) => { if (!isRecord(value)) throw new TypeError(`${name} must be an object`); return value; };
const text = (value, name, max = LIMITS.title) => { if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new TypeError(`${name} must be non-empty text within ${max} characters`); return value; };
const finite = (value, name) => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`); return value; };
const revisionNumber = (value, name) => { if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be an integer >= 1`); return value; };
export const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function isProtectedRef(ref) {
  return typeof ref === 'string' && PROTECTED_REF_PATTERNS.some((pattern) => pattern.test(ref));
}

function readingRef(value, name) {
  record(value, name);
  return { ref: text(value.ref, `${name}.ref`), revision: text(value.revision, `${name}.revision`), availability: text(value.availability, `${name}.availability`) };
}

// ---------------------------------------------------------------------------
// The audience-filtered composition
// ---------------------------------------------------------------------------

/**
 * Filter one native Expression document into the composition that may
 * travel. Pure: the returned `omissions` name everything withheld so the
 * publisher's preview is exact; the returned `composition` contains none of
 * it.
 */
export function filterExpressionComposition(document, selection = {}) {
  record(document, 'expression document');
  if (document.schema !== EXPRESSION_DOCUMENT_SCHEMA) throw new TypeError(`Unsupported Expression schema: ${document.schema}`);
  const expressionRef = text(document.expression_ref, 'expression document.expression_ref');
  if (!expressionRef.startsWith('expression:')) throw new TypeError('expression document.expression_ref must be a native Expression ref');
  const revision = revisionNumber(document.revision, 'expression document.revision');
  const title = text(document.title, 'expression document.title');
  if (!Array.isArray(document.scenes) || document.scenes.length === 0) throw new TypeError('expression document.scenes must be a non-empty array');
  record(document.entities, 'expression document.entities');
  record(document.selection, 'expression document.selection');
  record(selection, 'expression selection');
  const discloseSources = selection.disclose_sources ?? 'available';
  if (!['available', 'none'].includes(discloseSources)) throw new TypeError('selection.disclose_sources must be "available" or "none"');
  const includeSourceRefs = new Set(Array.isArray(selection.include_source_refs) ? selection.include_source_refs.map((ref, index) => text(ref, `selection.include_source_refs[${index}]`)) : []);
  const allSceneRefs = document.scenes.map((scene, index) => text(record(scene, `expression document.scenes[${index}]`).scene_ref, `expression document.scenes[${index}].scene_ref`));
  let selectedSceneRefs = allSceneRefs;
  if (selection.scene_refs !== undefined) {
    if (!Array.isArray(selection.scene_refs) || selection.scene_refs.length === 0) throw new TypeError('selection.scene_refs must name at least one scene');
    for (const ref of selection.scene_refs) if (!allSceneRefs.includes(ref)) throw new TypeError(`selection.scene_refs names a scene the Expression does not hold: ${ref}`);
    selectedSceneRefs = allSceneRefs.filter((ref) => selection.scene_refs.includes(ref));
  }
  if (selectedSceneRefs.length > LIMITS.scenes) throw new TypeError(`composition exceeds ${LIMITS.scenes} scenes`);

  const omissions = {
    readings: 0,
    actions: 0,
    scenes: [],
    entities: [],
    parameters: [],
    representations: [],
    sources: { withheld: [], protected: [], unavailable: [] },
    provenance: [],
  };
  const sourceDecision = (reading, owner) => {
    if (reading.availability !== 'available') { (reading.availability === 'withheld' ? omissions.sources.withheld : omissions.sources.unavailable).push({ ref: reading.ref, availability: reading.availability, subject: owner }); return false; }
    if (discloseSources === 'none') { omissions.sources.withheld.push({ ref: reading.ref, availability: 'undisclosed', subject: owner }); return false; }
    if (isProtectedRef(reading.ref) && !includeSourceRefs.has(reading.ref)) { omissions.sources.protected.push({ ref: reading.ref, subject: owner }); return false; }
    return true;
  };

  const scenes = [];
  const keptEntityRefs = new Set();
  for (const scene of document.scenes) {
    if (!selectedSceneRefs.includes(scene.scene_ref)) { omissions.scenes.push({ scene_ref: scene.scene_ref, title: String(scene.title ?? '') }); continue; }
    if (!Array.isArray(scene.entity_refs)) throw new TypeError(`scene ${scene.scene_ref}.entity_refs must be an array`);
    for (const ref of scene.entity_refs) keptEntityRefs.add(text(ref, `scene ${scene.scene_ref}.entity_refs[]`));
    scenes.push({ scene_ref: scene.scene_ref, revision: revisionNumber(scene.revision, `scene ${scene.scene_ref}.revision`), title: text(scene.title, `scene ${scene.scene_ref}.title`), entity_refs: [...scene.entity_refs] });
  }
  if (keptEntityRefs.size > LIMITS.entities) throw new TypeError(`composition exceeds ${LIMITS.entities} entities`);

  const entities = {};
  const subjects = new Map();
  for (const [ref, entity] of Object.entries(document.entities)) {
    record(entity, `entity ${ref}`);
    if (!keptEntityRefs.has(ref)) { omissions.entities.push({ entity_ref: ref, title: String(entity.title ?? '') }); continue; }
    const parameters = {};
    for (const [name, parameter] of Object.entries(record(entity.parameters ?? {}, `entity ${ref}.parameters`))) {
      if (!MATERIAL_PARAMETERS.includes(name)) { omissions.parameters.push({ entity_ref: ref, parameter: name }); continue; }
      record(parameter, `entity ${ref}.parameters.${name}`);
      const value = name === 'glyph' ? text(String(parameter.value ?? 'O'), `entity ${ref}.parameters.glyph.value`, LIMITS.glyph) : finite(Number(parameter.value ?? 0), `entity ${ref}.parameters.${name}.value`);
      let automation = null;
      if (parameter.automation) {
        const a = record(parameter.automation, `entity ${ref}.parameters.${name}.automation`);
        if (!WAVEFORMS.includes(a.waveform)) throw new TypeError(`entity ${ref}.parameters.${name}.automation.waveform is unsupported`);
        automation = { min: finite(a.min, 'automation.min'), max: finite(a.max, 'automation.max'), rate_hz: finite(a.rate_hz, 'automation.rate_hz'), waveform: a.waveform };
      }
      parameters[name] = { value, automation };
    }
    let subject = null;
    if (entity.subject) {
      const binding = record(entity.subject, `entity ${ref}.subject`);
      const subjectRef = text(binding.subject_ref, `entity ${ref}.subject.subject_ref`);
      omissions.readings += Array.isArray(binding.readings) ? binding.readings.length : 0;
      omissions.actions += Array.isArray(binding.actions) ? binding.actions.length : 0;
      const sources = (Array.isArray(binding.sources) ? binding.sources : []).map((reading, index) => readingRef(reading, `entity ${ref}.subject.sources[${index}]`)).filter((reading) => sourceDecision(reading, subjectRef));
      subject = { subject_ref: subjectRef, native_owner: text(binding.native_owner, `entity ${ref}.subject.native_owner`), presentation_role: binding.presentation_role === 'being' ? 'being' : 'thing', sources };
      const existing = subjects.get(subjectRef);
      if (existing) { for (const source of sources) if (!existing.sources.some((held) => held.ref === source.ref && held.revision === source.revision)) existing.sources.push(source); }
      else subjects.set(subjectRef, { ref: subjectRef, revision: String(revision), availability: 'available', sources: sources.map(clone) });
    }
    entities[ref] = { entity_ref: text(entity.entity_ref ?? ref, `entity ${ref}.entity_ref`), revision: revisionNumber(entity.revision, `entity ${ref}.revision`), title: text(entity.title, `entity ${ref}.title`), subject, parameters };
  }
  for (const scene of scenes) for (const ref of scene.entity_refs) if (!entities[ref]) throw new TypeError(`scene ${scene.scene_ref} composes an entity the Expression does not hold: ${ref}`);

  const relations = {};
  for (const [bindingRef, relation] of Object.entries(record(document.relations ?? {}, 'expression document.relations'))) {
    record(relation, `relation ${bindingRef}`);
    if (!entities[relation.from_entity_ref] || !entities[relation.to_entity_ref]) continue;
    const provenance = (Array.isArray(relation.provenance) ? relation.provenance : []).map((reading, index) => readingRef(reading, `relation ${bindingRef}.provenance[${index}]`)).filter((reading) => { if (isProtectedRef(reading.ref) && !includeSourceRefs.has(reading.ref)) { omissions.provenance.push({ ref: reading.ref, of: bindingRef }); return false; } return true; });
    relations[bindingRef] = { binding_ref: bindingRef, relation: readingRef(relation.relation, `relation ${bindingRef}.relation`), from_entity_ref: relation.from_entity_ref, to_entity_ref: relation.to_entity_ref, provenance };
  }
  if (Object.keys(relations).length > LIMITS.relations) throw new TypeError(`composition exceeds ${LIMITS.relations} relations`);

  const focusScene = selectedSceneRefs.includes(document.selection.scene_ref) ? document.selection.scene_ref : selectedSceneRefs[0];
  const focusEntity = document.selection.entity_ref && entities[document.selection.entity_ref] && scenes.find((scene) => scene.scene_ref === focusScene)?.entity_refs.includes(document.selection.entity_ref) ? document.selection.entity_ref : null;

  const representations = [];
  for (const [index, representation] of (Array.isArray(document.representations) ? document.representations : []).entries()) {
    record(representation, `representation[${index}]`);
    if (!PORTABLE_REPRESENTATION_KINDS.includes(representation.kind)) { omissions.representations.push({ kind: String(representation.kind), ref: representation.representation?.ref }); continue; }
    representations.push({ kind: representation.kind, representation: readingRef(representation.representation, `representation[${index}].representation`), provenance: (Array.isArray(representation.provenance) ? representation.provenance : []).map((reading, i) => readingRef(reading, `representation[${index}].provenance[${i}]`)) });
  }
  const provenance = (Array.isArray(document.provenance) ? document.provenance : []).map((reading, index) => readingRef(reading, `expression document.provenance[${index}]`)).filter((reading) => { if (isProtectedRef(reading.ref) && !includeSourceRefs.has(reading.ref)) { omissions.provenance.push({ ref: reading.ref, of: expressionRef }); return false; } return true; });

  const composition = { schema: EXPRESSION_COMPOSITION_SCHEMA, expression_ref: expressionRef, revision, title, scenes, entities, relations, selection: { scene_ref: focusScene, entity_ref: focusEntity }, provenance, representations };
  return { composition: validateExpressionComposition(composition), subjects: [...subjects.values()], omissions };
}

/** The receiving side's admission: a composition is bounded, material-only, and self-consistent before it reaches any engine. */
export function validateExpressionComposition(value) {
  record(value, 'expression composition');
  if (value.schema !== EXPRESSION_COMPOSITION_SCHEMA) throw new TypeError(`Unsupported Expression composition schema: ${value.schema}`);
  const expressionRef = text(value.expression_ref, 'expression composition.expression_ref');
  if (!expressionRef.startsWith('expression:')) throw new TypeError('expression composition.expression_ref must be a native Expression ref');
  const revision = revisionNumber(value.revision, 'expression composition.revision');
  const title = text(value.title, 'expression composition.title');
  if (!Array.isArray(value.scenes) || value.scenes.length === 0 || value.scenes.length > LIMITS.scenes) throw new TypeError(`expression composition.scenes must hold 1..${LIMITS.scenes} scenes`);
  const entities = {};
  const entityEntries = Object.entries(record(value.entities, 'expression composition.entities'));
  if (entityEntries.length > LIMITS.entities) throw new TypeError(`expression composition exceeds ${LIMITS.entities} entities`);
  for (const [ref, entity] of entityEntries) {
    record(entity, `entity ${ref}`);
    if (entity.entity_ref !== ref) throw new TypeError(`entity ${ref} names a different entity_ref`);
    const parameters = {};
    for (const [name, parameter] of Object.entries(record(entity.parameters, `entity ${ref}.parameters`))) {
      if (!MATERIAL_PARAMETERS.includes(name)) throw new TypeError(`entity ${ref} carries a parameter outside the material vocabulary: ${name}`);
      record(parameter, `entity ${ref}.parameters.${name}`);
      const allowed = new Set(['value', 'automation']);
      for (const key of Object.keys(parameter)) if (!allowed.has(key)) throw new TypeError(`entity ${ref}.parameters.${name} contains unsupported keys: ${key}`);
      const paramValue = name === 'glyph' ? text(parameter.value, `entity ${ref}.parameters.glyph.value`, LIMITS.glyph) : finite(parameter.value, `entity ${ref}.parameters.${name}.value`);
      let automation = null;
      if (parameter.automation !== null && parameter.automation !== undefined) {
        const a = record(parameter.automation, `entity ${ref}.parameters.${name}.automation`);
        if (!WAVEFORMS.includes(a.waveform)) throw new TypeError(`entity ${ref}.parameters.${name}.automation.waveform is unsupported`);
        automation = { min: finite(a.min, 'automation.min'), max: finite(a.max, 'automation.max'), rate_hz: finite(a.rate_hz, 'automation.rate_hz'), waveform: a.waveform };
      }
      parameters[name] = { value: paramValue, automation };
    }
    let subject = null;
    if (entity.subject !== null && entity.subject !== undefined) {
      const binding = record(entity.subject, `entity ${ref}.subject`);
      const allowed = new Set(['subject_ref', 'native_owner', 'presentation_role', 'sources']);
      for (const key of Object.keys(binding)) if (!allowed.has(key)) throw new TypeError(`entity ${ref}.subject contains unsupported keys: ${key}`);
      if (!['being', 'thing'].includes(binding.presentation_role)) throw new TypeError(`entity ${ref}.subject.presentation_role must be being or thing`);
      if (!Array.isArray(binding.sources)) throw new TypeError(`entity ${ref}.subject.sources must be an array`);
      subject = { subject_ref: text(binding.subject_ref, `entity ${ref}.subject.subject_ref`), native_owner: text(binding.native_owner, `entity ${ref}.subject.native_owner`), presentation_role: binding.presentation_role, sources: binding.sources.map((reading, index) => readingRef(reading, `entity ${ref}.subject.sources[${index}]`)) };
    }
    entities[ref] = { entity_ref: ref, revision: revisionNumber(entity.revision, `entity ${ref}.revision`), title: text(entity.title, `entity ${ref}.title`), subject, parameters };
  }
  const scenes = value.scenes.map((scene, index) => {
    record(scene, `scene[${index}]`);
    if (!Array.isArray(scene.entity_refs)) throw new TypeError(`scene[${index}].entity_refs must be an array`);
    for (const ref of scene.entity_refs) if (!entities[ref]) throw new TypeError(`scene[${index}] composes an unknown entity: ${ref}`);
    return { scene_ref: text(scene.scene_ref, `scene[${index}].scene_ref`), revision: revisionNumber(scene.revision, `scene[${index}].revision`), title: text(scene.title, `scene[${index}].title`), entity_refs: [...scene.entity_refs] };
  });
  const selection = record(value.selection, 'expression composition.selection');
  if (!scenes.some((scene) => scene.scene_ref === selection.scene_ref)) throw new TypeError('expression composition.selection.scene_ref must name a carried scene');
  if (selection.entity_ref !== null && selection.entity_ref !== undefined && !entities[selection.entity_ref]) throw new TypeError('expression composition.selection.entity_ref must name a carried entity');
  const relations = {};
  for (const [bindingRef, relation] of Object.entries(record(value.relations ?? {}, 'expression composition.relations'))) {
    record(relation, `relation ${bindingRef}`);
    if (!entities[relation.from_entity_ref] || !entities[relation.to_entity_ref]) throw new TypeError(`relation ${bindingRef} joins an entity the composition does not carry`);
    relations[bindingRef] = { binding_ref: bindingRef, relation: readingRef(relation.relation, `relation ${bindingRef}.relation`), from_entity_ref: relation.from_entity_ref, to_entity_ref: relation.to_entity_ref, provenance: (Array.isArray(relation.provenance) ? relation.provenance : []).map((reading, i) => readingRef(reading, `relation ${bindingRef}.provenance[${i}]`)) };
  }
  const representations = (Array.isArray(value.representations) ? value.representations : []).map((representation, index) => {
    record(representation, `representation[${index}]`);
    if (!PORTABLE_REPRESENTATION_KINDS.includes(representation.kind)) throw new TypeError(`representation[${index}].kind is not portable: ${representation.kind}`);
    return { kind: representation.kind, representation: readingRef(representation.representation, `representation[${index}].representation`), provenance: (Array.isArray(representation.provenance) ? representation.provenance : []).map((reading, i) => readingRef(reading, `representation[${index}].provenance[${i}]`)) };
  });
  const provenance = (Array.isArray(value.provenance) ? value.provenance : []).map((reading, index) => readingRef(reading, `expression composition.provenance[${index}]`));
  return { schema: EXPRESSION_COMPOSITION_SCHEMA, expression_ref: expressionRef, revision, title, scenes, entities, relations, selection: { scene_ref: selection.scene_ref, entity_ref: selection.entity_ref ?? null }, provenance, representations };
}

// ---------------------------------------------------------------------------
// The explicit safe fallback: a frozen HTML reading of the composition
// ---------------------------------------------------------------------------

export function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * A script-free, style-inline HTML document rendering the composition as
 * placed glyphs per scene. It is a representation of the SAME revision, not a
 * second document: title, refs and revisions are named in it verbatim.
 */
export function frozenExpressionHtml(compositionValue) {
  const composition = validateExpressionComposition(compositionValue);
  const scenes = composition.scenes.map((scene) => {
    const glyphs = scene.entity_refs.map((ref) => {
      const entity = composition.entities[ref];
      const at = (name, fallback) => entity.parameters[name]?.value ?? fallback;
      const scale = Number(at('scale', 1));
      const left = 50 + Number(at('x', 0)) * 10;
      const top = 50 - Number(at('y', 0)) * 10;
      const subject = entity.subject ? ` data-subject-ref="${escapeHtml(entity.subject.subject_ref)}" data-presentation-role="${escapeHtml(entity.subject.presentation_role)}"` : '';
      return `<span class="entity" data-entity-ref="${escapeHtml(ref)}"${subject} style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;font-size:${(Math.max(0.2, Math.min(4, scale)) * 3).toFixed(2)}rem;opacity:${Math.max(0.15, Math.min(1, Number(at('share', 1)))).toFixed(2)}" title="${escapeHtml(entity.title)}">${escapeHtml(String(at('glyph', 'O')))}</span>`;
    }).join('');
    return `<section class="scene" data-scene-ref="${escapeHtml(scene.scene_ref)}" aria-label="${escapeHtml(scene.title)}"><h2>${escapeHtml(scene.title)}</h2><div class="field">${glyphs}</div></section>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escapeHtml(composition.title)}</title><style>html,body{margin:0;background:#0e0f12;color:#e6e2d8;font-family:ui-sans-serif,system-ui,sans-serif}main{padding:1rem}h1{font-weight:500;font-size:1rem;margin:0 0 .25rem}p{margin:0 0 1rem;font-size:.75rem;color:#8f8a80}.scene{margin-bottom:1rem}.scene h2{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;font-weight:500;color:#8f8a80;margin:0 0 .5rem}.field{position:relative;aspect-ratio:16/9;border:1px solid #2a2c33;border-radius:12px;overflow:hidden;background:radial-gradient(circle at 50% 50%,#191b21,#0e0f12)}.entity{position:absolute;transform:translate(-50%,-50%);line-height:1;color:#d8b25a;text-shadow:0 0 18px rgba(216,178,90,.35)}</style></head><body><main data-expression-ref="${escapeHtml(composition.expression_ref)}" data-expression-revision="${composition.revision}"><h1>${escapeHtml(composition.title)}</h1><p>Frozen reading of ${escapeHtml(composition.expression_ref)} at revision ${composition.revision}. The live Expression renders where the renderer is admitted.</p>${scenes}</main></body></html>`;
}

// ---------------------------------------------------------------------------
// Publication: composition → presentation → Projection → hosted arguments
// ---------------------------------------------------------------------------

function validateAudience(audience) {
  record(audience, 'audience');
  if (!VISIBILITIES.has(audience.visibility)) throw new TypeError(`audience.visibility must be one of ${[...VISIBILITIES].join(', ')}`);
  const refs = Array.isArray(audience.refs) ? audience.refs.map((ref, index) => text(ref, `audience.refs[${index}]`)) : [];
  if ((audience.visibility === 'restricted' || audience.visibility === 'private') && refs.length === 0) throw new TypeError(`a ${audience.visibility} audience names its participants explicitly`);
  return { visibility: audience.visibility, ...(refs.length ? { refs } : {}) };
}

/**
 * Project one ordinary Expression for an audience. Returns the exact
 * outward material (projection, presentation, entry, field, participant,
 * hosted arguments) beside the omissions the publisher must see. The
 * omissions are local: none of them appears in the outward material, and
 * `expressionPublicationLeaks` proves it against planted sentinels.
 */
export function projectExpression(input) {
  record(input, 'expression projection input');
  const filtered = filterExpressionComposition(input.document, input.selection ?? {});
  const { composition, subjects, omissions } = filtered;
  const publisher = record(input.publisher, 'publisher');
  const audience = validateAudience(input.audience);
  const worldRef = text(input.world_ref ?? `world:desktop:${slug(composition.expression_ref)}`, 'world_ref');
  const fieldRef = text(input.field_ref ?? `oi:field:desktop:${slug(composition.expression_ref)}`, 'field_ref');
  // A Participant is a relation inside ONE SharedField (the hosted field
  // refuses to move a participant between fields). The human identity is
  // therefore carried as the identity; the participant ref is field-scoped,
  // derived from the field and the identity unless the publisher names one.
  const identityRef = text(publisher.identity_ref ?? publisher.participant_ref, 'publisher.identity_ref');
  const publisherRef = publisher.participant_ref ? text(publisher.participant_ref, 'publisher.participant_ref') : `participant:${slug(fieldRef)}:${slug(identityRef)}`;
  const projectionRef = text(input.projection_ref, 'projection_ref');
  const presentationRef = text(input.presentation_ref ?? `presentation:${slug(composition.expression_ref)}`, 'presentation_ref');
  const projectionRevision = input.projection_revision === undefined ? 1 : revisionNumber(input.projection_revision, 'projection_revision');
  const publishedAt = text(input.published_at ?? new Date().toISOString(), 'published_at');
  const liveRendererRef = text(input.live_renderer_ref ?? LIVE_RENDERER_REF, 'live_renderer_ref');
  const sourceRevision = String(composition.revision);
  const title = text(input.selection?.title ?? composition.title, 'title');
  const summary = input.selection?.summary ? text(input.selection.summary, 'selection.summary', 2048) : undefined;

  const expressionReading = { ref: composition.expression_ref, revision: sourceRevision, availability: 'available' };
  const representations = [];
  const html = input.fallback?.html === false ? undefined : frozenExpressionHtml(composition);
  if (html) {
    if (html.length > LIMITS.html) throw new TypeError(`the frozen HTML fallback exceeds ${LIMITS.html} characters`);
    representations.push({ kind: 'html', representation: { ref: `${composition.expression_ref}:frozen:${composition.revision}`, revision: sourceRevision, availability: 'available' }, provenance: [expressionReading], media_type: 'text/html', html });
  }
  if (input.fallback?.image) {
    const image = record(input.fallback.image, 'fallback.image');
    const href = text(image.href, 'fallback.image.href', LIMITS.html);
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(href) && !/^https?:\/\//.test(href)) throw new TypeError('fallback.image.href must be an image data URL or an http(s) URL');
    representations.push({ kind: 'image', representation: { ref: image.ref ?? `${composition.expression_ref}:capture:${composition.revision}`, revision: image.revision ?? sourceRevision, availability: 'available' }, provenance: [expressionReading], media_type: image.media_type ?? 'image/png', href });
  }
  const expression = validateExpressionPresentation({
    schema: EXPRESSION_PRESENTATION_SCHEMA,
    expression_ref: composition.expression_ref,
    expression_revision: composition.revision,
    scene_ref: composition.selection.scene_ref,
    live_renderer_ref: liveRendererRef,
    live_availability: 'available',
    subjects,
    representations,
  });
  const primarySubject = composition.selection.entity_ref && composition.entities[composition.selection.entity_ref]?.subject?.subject_ref
    ? composition.entities[composition.selection.entity_ref].subject.subject_ref
    : subjects[0]?.ref;

  const provenance = [{ kind: 'expression', ref: composition.expression_ref, source_system: 'o-i', revision: sourceRevision }];
  const bodyBinding = {
    schema: 'oi.presentation-binding/v1',
    binding_ref: 'expression',
    component_ref: EXPRESSION_PRESENTATION_RENDERER,
    portable_renderer: EXPRESSION_PRESENTATION_RENDERER,
    ...(primarySubject ? { subject_ref: primarySubject } : {}),
    props: { expression, composition, title },
    fallback: { title, text: `${composition.title}: a living Expression at revision ${composition.revision}. Where the live renderer is not admitted, the frozen reading of the same revision renders instead.` },
    provenance,
  };
  const subjectBindings = subjects.map((subject) => ({
    schema: 'oi.presentation-binding/v1',
    binding_ref: `subject:${slug(subject.ref)}`,
    component_ref: 'oi.presentation/reference-card/v1',
    portable_renderer: 'oi.presentation/reference-card/v1',
    subject_ref: subject.ref,
    props: { title: subject.ref, text: `${Object.values(composition.entities).find((entity) => entity.subject?.subject_ref === subject.ref)?.subject?.presentation_role ?? 'thing'} · ${Object.values(composition.entities).find((entity) => entity.subject?.subject_ref === subject.ref)?.subject?.native_owner ?? 'native owner'}`, refs: subject.sources.map((source) => source.ref) },
    fallback: { title: subject.ref },
    provenance,
  }));
  const presentation = createWorldPresentation({
    schema: 'oi.world-presentation/v1',
    presentation_ref: presentationRef,
    world_ref: composition.expression_ref,
    revision: projectionRevision,
    title,
    ...(summary ? { summary } : {}),
    theme: { tokens: {} },
    regions: [
      { region_ref: 'lede', role: 'lede', bindings: [{ schema: 'oi.presentation-binding/v1', binding_ref: 'lede', component_ref: 'oi.presentation/lede/v1', portable_renderer: 'oi.presentation/lede/v1', subject_ref: composition.expression_ref, props: { title, ...(summary ? { text: summary } : {}) }, fallback: { title }, provenance }] },
      { region_ref: 'body', role: 'body', bindings: [bodyBinding] },
      ...(subjectBindings.length ? [{ region_ref: 'subjects', role: 'relation', label: `Bound subjects · ${subjectBindings.length}`, bindings: subjectBindings }] : []),
    ],
    provenance,
  });
  const projection = createWorldPresentationProjection({
    presentation,
    projection: {
      projection_ref: projectionRef,
      projection_revision: projectionRevision,
      state: 'published',
      subject: { kind: 'expression', ref: composition.expression_ref },
      source: { system: 'o-i', ref: composition.expression_ref, revision: sourceRevision },
      publisher_participant_ref: publisherRef,
      published_at: publishedAt,
      audience,
      provenance: [{ kind: 'human-publication', ref: publisherRef, source_system: 'o-i', revision: sourceRevision }],
    },
  });
  const entry = createExploreEntry({
    ref: composition.expression_ref,
    kind: 'expression',
    world_ref: worldRef,
    label: title,
    ...(summary ? { summary } : { summary: `a living Expression · ${composition.scenes.length} scene${composition.scenes.length === 1 ? '' : 's'} · ${Object.keys(composition.entities).length} entit${Object.keys(composition.entities).length === 1 ? 'y' : 'ies'}` }),
    revision: sourceRevision,
    aliases: [projectionRef],
    provenance,
    locators: [{ surface: 'web', locator: `/explore.html?ref=${encodeURIComponent(composition.expression_ref)}` }],
    meta: { projection_ref: projectionRef, standing: 'projection', presentation_ref: presentationRef, expression_revision: composition.revision, live_renderer_ref: liveRendererRef },
  });
  // Publishing into a field that already exists keeps that field's own
  // contract byte-for-byte; the Expression never retitles a World's field.
  const hostedField = input.field === undefined ? undefined : record(input.field, 'field');
  if (hostedField && hostedField.field_ref !== fieldRef) throw new TypeError('field must be the hosted contract of field_ref');
  const field = hostedField
    ? createSharedField(hostedField)
    : createSharedField({ field_ref: fieldRef, kind: 'explore', visibility: audience.visibility, title, provenance: [{ kind: 'human-publication', ref: publisherRef, source_system: 'o-i', revision: sourceRevision }] });
  const { relations, omitted } = worldRelations({ authoring: input.authoring, entries: input.field_entries, fieldRef, expressionRef: composition.expression_ref, sourceRevision });
  omissions.world_relations = omitted;
  const participant = createParticipant({ participant_ref: publisherRef, field_ref: fieldRef, identity: { kind: 'human', ref: identityRef }, presentation: { world_ref: worldRef, ...(publisher.chosen_name ? { chosen_name: publisher.chosen_name } : {}) }, provenance: { source_system: 'o-i', source_revision: sourceRevision, source_ref: composition.expression_ref } });

  return {
    schema: EXPRESSION_PUBLICATION_SCHEMA,
    expression_ref: composition.expression_ref,
    expression_revision: composition.revision,
    world_ref: worldRef,
    field_ref: fieldRef,
    composition,
    expression,
    presentation,
    projection,
    entry,
    field,
    participant,
    relations,
    live: { renderer_ref: liveRendererRef, fallback_kinds: representations.map((representation) => representation.kind) },
    omissions,
  };
}

const WORLD_RELATIONS = Object.freeze([
  { key: 'position_ref', kind: 'world-position', relation: 'oi.world/authored-by', provenance: 'authoring-position', source_system: 'central' },
  { key: 'constellation_ref', kind: 'constellation', relation: 'oi.world/expresses', provenance: 'source-constellation', source_system: 'ai-kit' },
]);

/**
 * The Expression's World relations: one per authoring ref the target field
 * hosts exactly once as an entry of the matching kind (matched on the
 * entry's `meta.local_ref`, its semantic ref, or an alias). Everything else
 * becomes a local omission with its reason.
 */
function worldRelations({ authoring, entries, fieldRef, expressionRef, sourceRevision }) {
  const relations = [];
  const omitted = [];
  if (authoring === undefined || authoring === null) return { relations, omitted };
  record(authoring, 'authoring');
  const hostedEntries = entries === undefined ? [] : entries;
  if (!Array.isArray(hostedEntries)) throw new TypeError('field_entries must be an array of hosted entries');
  for (const spec of WORLD_RELATIONS) {
    const value = authoring[spec.key];
    if (value === undefined || value === null) continue;
    const ref = text(value, `authoring.${spec.key}`);
    const names = (entry) => entry.meta?.local_ref === ref || entry.ref === ref || (Array.isArray(entry.aliases) && entry.aliases.includes(ref));
    const candidates = hostedEntries.filter((entry) => isRecord(entry) && entry.kind === spec.kind && names(entry));
    const here = candidates.filter((entry) => entry.field_ref === fieldRef);
    if (here.length !== 1) {
      const reason = here.length > 1 ? 'hosted more than once in this field' : candidates.length ? 'hosted in another SharedField; relations never cross a field boundary' : 'not hosted in the SharedField';
      omitted.push({ relation: spec.relation, ref, reason });
      continue;
    }
    const target = text(here[0].ref, `hosted ${spec.kind}.ref`);
    const relationRef = `${expressionRef}#${spec.relation}#${target}`;
    relations.push({
      relation_ref: relationRef,
      from: expressionRef,
      to: target,
      relation: spec.relation,
      origin: 'projection',
      direction: 'forward',
      provenance: [{ kind: spec.provenance, ref, source_system: spec.source_system, revision: sourceRevision }],
    });
  }
  return { relations, omitted };
}

/** The hosted reducer arguments the O:I-owned field client's `publish` expects. */
export function hostedExpressionArgs(bundle) {
  record(bundle, 'expression publication');
  if (bundle.schema !== EXPRESSION_PUBLICATION_SCHEMA) throw new TypeError(`Unsupported expression publication schema: ${bundle.schema}`);
  const { field, participant, projection, entry } = bundle;
  return {
    putSharedField: { fieldRef: field.field_ref, kind: field.kind, visibility: field.visibility, contractJson: JSON.stringify(field) },
    putParticipant: { participantRef: participant.participant_ref, fieldRef: participant.field_ref, identityKind: participant.identity.kind, identityRef: participant.identity.ref, sourceSystem: participant.provenance.source_system, sourceRevision: participant.provenance.source_revision, contractJson: JSON.stringify(participant) },
    putProjection: { projectionKey: projectionStorageKey(projection.projection_ref, projection.projection_revision), fieldRef: field.field_ref, projectionRef: projection.projection_ref, projectionRevision: projection.projection_revision, sourceRevision: projection.source.revision, publisherParticipantRef: projection.publisher_participant_ref, state: projection.state, contractJson: JSON.stringify(projection) },
    putExploreEntries: [{ semanticRef: entry.ref, fieldRef: field.field_ref, worldRef: entry.world_ref, kind: entry.kind, label: entry.label, revision: entry.revision ?? '', entryJson: JSON.stringify(entry) }],
    putExploreRelations: (bundle.relations ?? []).map((relation) => ({ relationRef: relation.relation_ref, fieldRef: field.field_ref, fromRef: relation.from, toRef: relation.to, relation: relation.relation, origin: relation.origin, relationJson: JSON.stringify(relation) })),
  };
}

/** Every outward payload of a publication, serialised — the surface a sentinel must be absent from. */
export function expressionPublicationPayloads(bundle) {
  record(bundle, 'expression publication');
  const args = hostedExpressionArgs(bundle);
  return { projection: bundle.projection, presentation: bundle.presentation, expression: bundle.expression, composition: bundle.composition, entry: bundle.entry, field: bundle.field, participant: bundle.participant, relations: bundle.relations ?? [], hosted_args: args, fallback_html: bundle.expression.representations.filter((representation) => representation.kind === 'html').map((representation) => representation.html).join('\n') };
}

export function expressionPublicationLeaks(bundle, sentinels) {
  return publicationSentinelLeaks(expressionPublicationPayloads(bundle), sentinels);
}
