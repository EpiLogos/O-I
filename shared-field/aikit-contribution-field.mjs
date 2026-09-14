import { normalizeContributionField } from './presentation-authoring.mjs';

/**
 * AIKit composition body → O:I authoring contribution field.
 *
 * AIKit owns the meaning of Component / Contract / Contribution / Surface and
 * resolves them into the scope-neutral `aikit.composition-body/v1`
 * (`crates/aikit-core/src/composition.rs`, ADR 0004). O:I authoring consumes
 * that resolved body; it does not re-resolve components, invent contributions,
 * or rewrite the exposed kind of anything AIKit exposed.
 *
 * Only contributions AIKit projected onto a Surface become bindable in a
 * WorldPresentation. An absence recorded by AIKit degrades the contribution it
 * names instead of silently dropping it. Action projections keep their
 * canonical Action ref as `action_refs`; the authoring Surface discloses them
 * and never supplies a handler.
 */
export const AIKIT_COMPOSITION_BODY_VERSION = 'aikit.composition-body/v1';

function record(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function validateCompositionBody(value) {
  const body = record(value, 'AIKit composition body');
  if (body.version !== AIKIT_COMPOSITION_BODY_VERSION) throw new TypeError(`Unsupported AIKit composition body version: ${body.version}`);
  if (!Array.isArray(body.contributions)) throw new TypeError('AIKit composition body.contributions must be an array');
  if (!Array.isArray(body.surfaces)) throw new TypeError('AIKit composition body.surfaces must be an array');
  if (!Array.isArray(body.projections)) throw new TypeError('AIKit composition body.projections must be an array');
  if (!Array.isArray(body.absences)) throw new TypeError('AIKit composition body.absences must be an array');
  text(body.fingerprint, 'AIKit composition body.fingerprint');
  return body;
}

/**
 * Map the resolved body into the contribution field `normalizeContributionField`
 * accepts. `options.surface_kinds` restricts to Surfaces of the given kinds
 * (e.g. ['web']); omit it to accept every projected Surface.
 */
export function contributionFieldFromCompositionBody(value, options = {}) {
  const body = validateCompositionBody(value);
  const surfaces = new Map(body.surfaces.map((surface) => [text(surface.resource, 'surface.resource'), surface]));
  const wantedKinds = Array.isArray(options.surface_kinds) ? new Set(options.surface_kinds) : null;
  const absencesByComponent = new Map();
  for (const absence of body.absences) {
    record(absence, 'composition absence');
    const component = text(absence.component, 'absence.component');
    if (!absencesByComponent.has(component)) absencesByComponent.set(component, []);
    absencesByComponent.get(component).push(absence);
  }
  const projectionsByContribution = new Map();
  for (const projection of body.projections) {
    record(projection, 'composition projection binding');
    const contribution = text(projection.contribution, 'projection.contribution');
    if (!projectionsByContribution.has(contribution)) projectionsByContribution.set(contribution, []);
    projectionsByContribution.get(contribution).push(projection);
  }

  const field = [];
  for (const contribution of body.contributions) {
    record(contribution, 'composition contribution');
    const id = text(contribution.id, 'contribution.id');
    const component = text(contribution.component, 'contribution.component');
    const projections = (projectionsByContribution.get(id) ?? []).filter((projection) => {
      if (!wantedKinds) return true;
      const surface = surfaces.get(projection.surface);
      return surface ? wantedKinds.has(surface.kind) : false;
    });
    if (projections.length === 0) continue;
    const absences = absencesByComponent.get(component) ?? [];
    const requiredAbsence = absences.find((absence) => absence.required === true);
    const optionalAbsence = absences.find((absence) => absence.required !== true);
    const isAction = contribution.kind === 'action-projection' || contribution.exposed_kind === 'action';
    for (const projection of projections) {
      field.push({
        contribution_ref: id,
        component_ref: component,
        surface_ref: text(projection.surface, 'projection.surface'),
        ...(contribution.target_contract ? { portable_renderer: contribution.target_contract } : {}),
        label: contribution.exposed_ref ?? id,
        available: !requiredAbsence && contribution.activation_mode !== 'next-session',
        degraded: Boolean(optionalAbsence) || contribution.activation_mode === 'procedure-mediated',
        ...(requiredAbsence ? { reason: requiredAbsence.reason } : optionalAbsence ? { reason: optionalAbsence.reason } : contribution.activation_mode === 'next-session' ? { reason: 'AIKit resolved this contribution for the next session; it is not live now.' } : {}),
        action_refs: isAction && contribution.exposed_ref ? [contribution.exposed_ref] : [],
        default_props: {},
        fallback: { title: contribution.exposed_ref ?? id },
        provenance: [
          { kind: 'aikit-composition-body', ref: body.fingerprint, source_system: 'aikit', revision: body.generation ?? body.target_revision ?? body.fingerprint },
          { kind: 'aikit-contribution', ref: id, source_system: 'aikit', ...(contribution.exposed_kind ? { exposed_kind: contribution.exposed_kind } : {}), ...(projection.canonical_ref ? { canonical_ref: projection.canonical_ref, canonical_kind: projection.canonical_kind } : {}) },
          ...(Array.isArray(contribution.provenance) ? contribution.provenance.map((entry) => ({ kind: 'aikit-provenance', ref: String(entry), source_system: 'aikit' })) : []),
        ],
      });
    }
  }
  return normalizeContributionField(clone(field));
}
