import { validateParticipant } from '../shared-field/index.mjs';
import { selfOtherReadModel, validateSharedField } from '../shared-field/social.mjs';

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

/**
 * Browser-only read adapter.
 * Canonical Participant/SharedField validation and Self/Other semantics stay in shared-field/.
 * React receives only the presentation fields it needs.
 */
export function selfOtherViewModel(input) {
  const value = requireRecord(input, 'self/other fixture');
  const field = validateSharedField(value.field);
  const self = validateParticipant(value.self);
  const other = validateParticipant(value.other);
  const relation = selfOtherReadModel({ self, others: [other], field });

  return {
    field: {
      ref: relation.field.ref,
      title: relation.field.title ?? relation.field.ref,
      kind: relation.field.kind,
    },
    self: positionView(relation.self),
    other: positionView(relation.others[0]),
  };
}
