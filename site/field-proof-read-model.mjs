import { projectionViewModel } from './projection-renderer.mjs';
import { isNestedContribution, validateContribution, validateEncounter } from '../shared-field/social.mjs';

function requireRecord(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function representationText(representation) {
  const payload = representation?.payload;
  if (typeof payload === 'string') return payload;
  if (payload === undefined) return '';
  return JSON.stringify(payload);
}

function contributionView(contribution) {
  return {
    ref: contribution.contribution_ref,
    mode: contribution.mode,
    relation: contribution.relation.kind,
    contributor: contribution.contributor_participant_ref,
    target_ref: contribution.target.ref,
    target_kind: contribution.target.kind,
    text: representationText(contribution.representation),
    source: contribution.provenance[0]
      ? `${contribution.provenance[0].source_system} · ${contribution.provenance[0].revision ?? contribution.provenance[0].ref}`
      : 'unknown',
  };
}

/**
 * Presentation adapter for the smallest object-centred shared-field proof.
 * Projection, Contribution and Encounter semantics remain canonical in shared-field/.
 */
export function fieldProofViewModel(input) {
  const value = requireRecord(input, 'field proof');
  if (!Array.isArray(value.contributions) || value.contributions.length !== 2) {
    throw new TypeError('field proof requires exactly two Contributions');
  }

  const projection = projectionViewModel(value.projection);
  const first = validateContribution(value.contributions[0]);
  const second = validateContribution(value.contributions[1]);
  const encounter = validateEncounter(value.encounter);

  if (first.target.ref !== projection.projection_ref) {
    throw new TypeError('first Contribution must target the selected Projection');
  }
  if (!isNestedContribution(second) || second.target.ref !== first.contribution_ref) {
    throw new TypeError('second Contribution must target the first Contribution');
  }
  if (!encounter.items.some((item) => item.ref === projection.projection_ref)) {
    throw new TypeError('Encounter must include the selected Projection');
  }

  return {
    projection: {
      ref: projection.projection_ref,
      revision: projection.projection_revision,
      subject_kind: projection.subject_kind,
      title: projection.title,
      description: projection.description,
      source: `${projection.source_system} · ${projection.source_revision}`,
    },
    encounter: {
      ref: encounter.encounter_ref,
      mediation: encounter.mediation.kind,
    },
    contributions: [contributionView(first), contributionView(second)],
  };
}
