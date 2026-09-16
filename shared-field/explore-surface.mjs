import { createExploreApplication } from './explore.mjs';
import { validateProjection } from './index.mjs';
import { validateWorldPresentation, WORLD_PRESENTATION_SCHEMA } from './presentation.mjs';
import { worldPresentationFromProjection } from './presentation-projection.mjs';
import { EXPRESSION_PRESENTATION_RENDERER } from './expression-presentation.mjs';

export const EXPLORE_SURFACE_SEED_SCHEMA = 'oi.explore-browser-seed/v1';
export const SUBJECT_PRESENTATIONS_SCHEMA = 'oi.subject-presentations/v1';
export const EXPLORE_DISCOVERY_SCHEMA = 'oi.explore-discovery/v1';

const ROLE_VALUES = new Set(['being', 'thing']);
const AVAILABLE = 'available';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requireRecord(value, name) {
  if (!(value !== null && typeof value === 'object' && !Array.isArray(value))) throw new TypeError(`${name} must be an object`);
  return value;
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value;
}

function requireText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

/**
 * The structured presentation bindings one WorldPresentation discloses about
 * its subjects. Roles and availability are read only from the binding's own
 * structured composition/expression props — never inferred from labels,
 * kinds or DOM. A binding without a role claims none.
 */
function presentationSubjects(presentation) {
  const subjects = new Map();
  const add = (ref, role, availability) => {
    const text = requireText(ref, 'presentation subject ref');
    const existing = subjects.get(text) ?? { ref: text };
    if (!existing.role && role && ROLE_VALUES.has(role)) existing.role = role;
    if (existing.availability === undefined && availability) existing.availability = availability;
    subjects.set(text, existing);
  };
  let expression = null;
  for (const region of presentation.regions ?? []) {
    for (const binding of region.bindings ?? []) {
      const renderer = binding.portable_renderer ?? binding.component_ref;
      if (renderer === EXPRESSION_PRESENTATION_RENDERER) {
        const props = binding.props ?? {};
        const presentationExpression = props.expression ?? null;
        const composition = props.composition ?? null;
        if (presentationExpression) {
          expression = {
            expression_ref: presentationExpression.expression_ref,
            expression_revision: presentationExpression.expression_revision,
            live_renderer_ref: presentationExpression.live_renderer_ref ?? null,
            subjects_available: (presentationExpression.subjects ?? [])
              .every((subject) => subject.availability === AVAILABLE),
          };
          for (const subject of presentationExpression.subjects ?? []) {
            add(subject.ref, null, subject.availability);
          }
        }
        for (const entity of Object.values(composition?.entities ?? {})) {
          const bound = entity?.subject;
          if (bound?.subject_ref) add(bound.subject_ref, bound.presentation_role ?? null, null);
        }
        continue;
      }
      if (binding.subject_ref) add(binding.subject_ref, null, null);
    }
  }
  return { subjects: [...subjects.values()], expression };
}

/**
 * Surface-neutral Explore application/read-model composition.
 *
 * Search, semantic refs, relation expansion, Projection identity and
 * WorldPresentation validation remain outside any particular renderer. Web,
 * desktop and structured agent Surfaces can consume this same application seam.
 *
 * Search resolves a native subject and then reveals its eligible presentation
 * forms — Being/Thing roles, Expressions, WorldPresentations, Projections and
 * live SharedField occurrences — while subject, presentation, Projection and
 * occurrence stay distinct categories over stable refs. Nothing here mints a
 * synthetic aggregate identity.
 */
export function createExploreSurfaceModel(seed) {
  requireRecord(seed, 'Explore Surface seed');
  if (seed.schema !== EXPLORE_SURFACE_SEED_SCHEMA) {
    throw new TypeError(`Unsupported Explore Surface seed schema: ${seed.schema}`);
  }

  const entries = requireArray(seed.entries ?? [], 'Explore Surface seed.entries');
  const relations = requireArray(seed.relations ?? [], 'Explore Surface seed.relations');
  const app = createExploreApplication({
    entries,
    relations,
    ...(seed.entry_fields || seed.relation_fields
      ? {
          membership: {
            entry_fields: seed.entry_fields ?? {},
            relation_fields: seed.relation_fields ?? {},
          },
        }
      : {}),
  });

  const presentations = new Map();
  for (const rawPresentation of requireArray(seed.presentations ?? [], 'Explore Surface seed.presentations')) {
    const presentation = validateWorldPresentation(rawPresentation);
    if (presentations.has(presentation.world_ref)) {
      throw new TypeError(`Duplicate WorldPresentation for ${presentation.world_ref}`);
    }
    presentations.set(presentation.world_ref, presentation);
  }

  const presentationProjections = new Map();
  for (const rawProjection of requireArray(
    seed.presentation_projections ?? [],
    'Explore Surface seed.presentation_projections',
  )) {
    const projection = validateProjection(rawProjection);
    const presentation = worldPresentationFromProjection(projection);
    const previous = presentationProjections.get(presentation.world_ref);
    if (!previous || projection.projection_revision > previous.projection_revision) {
      presentationProjections.set(presentation.world_ref, projection);
      presentations.set(presentation.world_ref, presentation);
    }
  }

  // Presentation resolution index: presentation world_ref -> structured
  // subjects + the expression the presentation carries, derived once at model
  // build from the presentations' own bindings.
  const presentationIndex = new Map();
  for (const [worldRef, presentation] of presentations) {
    const projection = presentationProjections.get(worldRef) ?? null;
    const resolved = presentationSubjects(presentation);
    presentationIndex.set(worldRef, {
      presentation,
      projection,
      subjects: resolved.subjects,
      expression: resolved.expression,
    });
  }

  // subject ref -> [presentation world_refs], the subject-keyed reverse join.
  const subjectIndex = new Map();
  for (const [worldRef, record] of presentationIndex) {
    for (const subject of record.subjects) {
      if (!subjectIndex.has(subject.ref)) subjectIndex.set(subject.ref, []);
      subjectIndex.get(subject.ref).push(worldRef);
    }
  }

  function worlds() {
    const result = [];
    const seen = new Set();
    for (const entry of app.search('', { limit: Math.max(entries.length, 1) })) {
      if (entry.ref !== entry.world_ref || seen.has(entry.world_ref)) continue;
      seen.add(entry.world_ref);
      result.push({
        ...clone(entry),
        presentation: clone(presentations.get(entry.world_ref)),
        presentation_projection: clone(presentationProjections.get(entry.world_ref)),
      });
    }
    return result.sort((a, b) => a.label.localeCompare(b.label) || a.ref.localeCompare(b.ref));
  }

  /**
   * The eligible presentation forms of one native subject. Every category is
   * a distinct reading over stable refs: roles (Being/Thing presentation
   * roles), expressions, world_presentations, projections and the live
   * SharedField occurrences the projected entries are hosted in. Never an
   * aggregate: each category names its own kind of ref.
   */
  function presentationsFor(subjectRef) {
    const canonical = app.resolveRefOrAlias(subjectRef);
    const ref = canonical ? canonical.ref : requireText(subjectRef, 'subject ref');
    const worldRefs = subjectIndex.get(ref) ?? [];
    const roles = [];
    const expressions = [];
    const worldPresentationRefs = [];
    const projections = [];
    const seenProjections = new Set();
    for (const worldRef of worldRefs) {
      const record = presentationIndex.get(worldRef);
      const projection = record.projection;
      const published = projection?.state === 'published';
      if (published) {
        const key = `${projection.projection_ref}@${projection.projection_revision}`;
        if (!seenProjections.has(key)) {
          seenProjections.add(key);
          projections.push({
            projection_ref: projection.projection_ref,
            projection_revision: projection.projection_revision,
            state: projection.state,
            subject: clone(projection.subject),
            ...(projection.source?.revision ? { source_revision: projection.source.revision } : {}),
          });
        }
      }
      if (!worldPresentationRefs.includes(record.presentation.presentation_ref)) {
        worldPresentationRefs.push(record.presentation.presentation_ref);
      }
      if (record.expression) {
        const value = {
          expression_ref: record.expression.expression_ref,
          expression_revision: record.expression.expression_revision,
          presentation_ref: record.presentation.presentation_ref,
          ...(published
            ? {
                projection_ref: projection.projection_ref,
                projection_revision: projection.projection_revision,
              }
            : {}),
          live_renderer_ref: record.expression.live_renderer_ref,
          subjects_available: record.expression.subjects_available,
        };
        if (!expressions.some((existing) => existing.expression_ref === value.expression_ref
          && existing.projection_ref === value.projection_ref)) {
          expressions.push(value);
        }
      }
      for (const subject of record.subjects) {
        if (subject.ref !== ref || !subject.role) continue;
        // Eligibility is the presentation's own structured binding state:
        // a role is eligible when the bound subject is available (an
        // unstated availability counts as admitted). Projection publication
        // is a separate category below, never a gate on local reveal.
        const eligible = subject.availability === undefined || subject.availability === AVAILABLE;
        if (!eligible) continue;
        roles.push({
          role: subject.role,
          presentation_ref: record.presentation.presentation_ref,
          ...(record.expression ? { expression_ref: record.expression.expression_ref } : {}),
          ...(projection
            ? {
                projection_ref: projection.projection_ref,
                projection_revision: projection.projection_revision,
              }
            : {}),
        });
      }
    }
    const fieldRefs = app.fieldsFor(ref);
    return {
      schema: SUBJECT_PRESENTATIONS_SCHEMA,
      subject_ref: ref,
      roles,
      expressions,
      world_presentations: worldPresentationRefs,
      projections,
      field_occurrences: fieldRefs.map((field_ref) => ({ field_ref, via: 'entry' })),
    };
  }

  /** The compact per-result reveal: the same distinct categories, refs only. */
  function presentationSummary(subjectRef) {
    const reveal = presentationsFor(subjectRef);
    return {
      roles: reveal.roles.map((role) => ({ role: role.role, presentation_ref: role.presentation_ref })),
      expressions: reveal.expressions.map((expression) => expression.expression_ref),
      world_presentations: reveal.world_presentations,
      projections: reveal.projections.map((projection) => `${projection.projection_ref}@${projection.projection_revision}`),
      field_occurrences: reveal.field_occurrences.map((occurrence) => occurrence.field_ref),
    };
  }

  function search(query = '', options = {}) {
    return app.search(query, options).map((result) => ({
      ...clone(result),
      has_world_presentation: presentations.has(result.world_ref),
      ...(subjectIndex.has(result.ref) ? { presentations: presentationSummary(result.ref) } : {}),
    }));
  }

  function open(ref, options = {}) {
    const canonical = app.resolveRefOrAlias(ref);
    if (!canonical) return undefined;
    const opened = app.open(canonical.ref, options);
    if (!opened) return undefined;
    const worldRef = opened.resource.world_ref;
    // An Expression's own WorldPresentation is keyed by the Expression ref
    // (the presentation's world), not by the publication world.
    const presentationRef = presentations.has(opened.resource.ref)
      ? opened.resource.ref
      : worldRef;
    const reveal = subjectIndex.has(opened.resource.ref) ? presentationsFor(opened.resource.ref) : undefined;
    return {
      ...clone(opened),
      world: clone(app.resolve(worldRef)),
      world_presentation: clone(presentations.get(presentationRef)),
      world_presentation_projection: clone(presentationProjections.get(presentationRef)),
      sources: clone(app.sources(opened.resource.ref)),
      explain: clone(app.explain(opened.resource.ref)),
      ...(reveal ? { presentations: reveal } : {}),
    };
  }

  function presentation(worldRef) {
    return clone(presentations.get(worldRef));
  }

  function presentationProjection(worldRef) {
    return clone(presentationProjections.get(worldRef));
  }

  /**
   * The bounded discovery export of this read model: stable refs, aliases,
   * typed relations, structured presentation bindings, Projection identity
   * and SharedField membership — payloads excluded. One World can export it;
   * another World (or AIKit Search/Resolve) resolves the same semantic refs
   * from it. Derived and fully rebuildable from the owning seed/snapshot.
   */
  function discoverySeed() {
    const orderedEntries = [...entries]
      .map((raw) => clone(app.resolve(raw.ref)))
      .sort((a, b) => a.ref.localeCompare(b.ref));
    const orderedRelations = requireArray(seed.relations ?? [], 'Explore Surface seed.relations')
      .map(clone)
      .sort((a, b) => String(a.relation_ref ?? `${a.from}#${a.relation}#${a.to}`)
        .localeCompare(String(b.relation_ref ?? `${b.from}#${b.relation}#${b.to}`)));
    const orderedPresentations = [...presentationIndex.values()]
      .map((record) => ({
        presentation_ref: record.presentation.presentation_ref,
        ...(record.presentation.revision !== undefined
          ? { revision: record.presentation.revision }
          : {}),
        kind: record.expression ? 'expression' : WORLD_PRESENTATION_SCHEMA,
        world_ref: record.presentation.world_ref,
        ...(record.presentation.title ? { title: record.presentation.title } : {}),
        ...(record.projection
          ? {
              projection_ref: record.projection.projection_ref,
              projection_revision: record.projection.projection_revision,
              projection_state: record.projection.state,
            }
          : {}),
        subjects: record.subjects.map(clone),
      }))
      .sort((a, b) => a.presentation_ref.localeCompare(b.presentation_ref));
    return {
      schema: EXPLORE_DISCOVERY_SCHEMA,
      generated_from: EXPLORE_SURFACE_SEED_SCHEMA,
      revision: `explore-discovery/v1:${orderedEntries.length}:${orderedRelations.length}:${orderedPresentations.length}`,
      entries: orderedEntries,
      relations: orderedRelations,
      presentations: orderedPresentations,
      ...(seed.entry_fields || seed.relation_fields
        ? {
            membership: {
              entry_fields: clone(seed.entry_fields ?? {}),
              relation_fields: clone(seed.relation_fields ?? {}),
            },
          }
        : {}),
      ...(Array.isArray(seed.fields)
        ? {
            fields: clone(seed.fields)
              .filter((field) => field && typeof field === 'object' && typeof field.field_ref === 'string')
              .map((field) => ({
                field_ref: field.field_ref,
                ...(field.kind !== undefined ? { kind: field.kind } : {}),
                ...(field.visibility !== undefined ? { visibility: field.visibility } : {}),
                ...(field.title !== undefined ? { title: field.title } : {}),
              })),
          }
        : {}),
    };
  }

  return Object.freeze({
    worlds,
    search,
    open,
    read: app.read,
    relations: app.relations,
    relationsFor: app.relationsFor,
    sources: app.sources,
    explain: app.explain,
    presentationsFor,
    presentation,
    presentationProjection,
    discoverySeed,
  });
}
