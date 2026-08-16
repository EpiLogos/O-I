import { validateParticipant } from '../shared-field/index.mjs';
import { selfOtherReadModel, validateSharedField } from '../shared-field/social.mjs';
import { projectionViewModel } from './projection-renderer.mjs';

function requireRecord(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function positionView(participant) {
  const source = participant.provenance ?? {};
  return {
    name: participant.presentation?.chosen_name ?? participant.identity.ref,
    kind: participant.identity.kind,
    identity_ref: participant.identity.ref,
    participant_ref: participant.participant_ref,
    source_system: source.source_system,
    source_revision: source.source_revision,
  };
}

function publicRootView(projection, participant) {
  const view = projectionViewModel(projection);
  if (view.subject_kind !== 'central.participant-root') {
    throw new TypeError('Self public root must be a Central Participant Root Projection');
  }
  if (view.publisher_participant_ref !== participant.participant_ref) {
    throw new TypeError('Self public root must be published by the selected Self Participant');
  }
  if (view.source_revision !== participant.provenance.source_revision) {
    throw new TypeError('Self public root revision must match the selected Self provenance');
  }

  return {
    projection_ref: view.projection_ref,
    title: view.title,
    description: view.description,
    source: `${view.source_system} · ${view.source_revision}`,
    groups: view.groups.map((group) => ({
      label: group.label ?? 'Selection',
      items: (group.items ?? []).map((item) => ({
        label: item.label ?? item.ref,
        ref: item.ref,
      })),
    })),
  };
}

/**
 * Browser-only read adapter.
 * Canonical Participant/SharedField/Projection validation and Self/Other semantics stay in shared-field/.
 * React receives only the presentation fields it needs.
 */
export function selfOtherViewModel(input) {
  const value = requireRecord(input, 'self/other fixture');
  const field = validateSharedField(value.field);
  const self = validateParticipant(value.self);
  const other = validateParticipant(value.other);
  const relation = selfOtherReadModel({ self, others: [other], field });
  const selfPublicRoot = publicRootView(value.self_root_projection, self);

  return {
    field: {
      ref: relation.field.ref,
      title: relation.field.title ?? relation.field.ref,
      kind: relation.field.kind,
    },
    self: positionView(relation.self),
    self_public_root: selfPublicRoot,
    other: positionView(relation.others[0]),
  };
}
