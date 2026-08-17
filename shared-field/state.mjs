import { validateParticipant } from './index.mjs';
import {
  CONTRIBUTION_SCHEMA,
  validateContribution,
  validateEncounter,
  validateSharedField,
  validateSharedFieldNesting,
} from './social.mjs';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function targetKey(target) {
  return `${target.kind}:${target.ref}`;
}

/**
 * A transport-free local read/write index over the portable O:I shared-field contracts.
 *
 * This is not a hosted service and it is not canonical storage. It supplies the common
 * business logic needed by file-backed demos, browser adapters, tests, and future hosted
 * adapters without giving any carrier ownership of the underlying identities or subjects.
 */
export function createSharedFieldState(seed = {}) {
  const fields = new Map();
  const participants = new Map();
  const contributions = new Map();
  const encounters = new Map();

  function addField(input) {
    const field = validateSharedField(input);
    if (fields.has(field.field_ref)) throw new TypeError(`Duplicate SharedField ref: ${field.field_ref}`);
    validateSharedFieldNesting([...fields.values(), field]);
    fields.set(field.field_ref, clone(field));
    return clone(field);
  }

  function addParticipant(input) {
    const participant = validateParticipant(input);
    if (participants.has(participant.participant_ref)) {
      throw new TypeError(`Duplicate Participant ref: ${participant.participant_ref}`);
    }
    if (!fields.has(participant.field_ref)) {
      throw new TypeError(`Unknown SharedField for Participant: ${participant.field_ref}`);
    }
    participants.set(participant.participant_ref, clone(participant));
    return clone(participant);
  }

  function wouldCreateContributionCycle(contribution) {
    if (contribution.target.kind !== CONTRIBUTION_SCHEMA.replace('/v1', '')) return false;
    if (contribution.target.ref === contribution.contribution_ref) return true;

    const seen = new Set([contribution.contribution_ref]);
    let ref = contribution.target.ref;
    while (ref) {
      if (seen.has(ref)) return true;
      seen.add(ref);
      const target = contributions.get(ref);
      if (!target || target.target.kind !== CONTRIBUTION_SCHEMA.replace('/v1', '')) return false;
      ref = target.target.ref;
    }
    return false;
  }

  function addContribution(input) {
    const contribution = validateContribution(input);
    if (contributions.has(contribution.contribution_ref)) {
      throw new TypeError(`Duplicate Contribution ref: ${contribution.contribution_ref}`);
    }
    if (!fields.has(contribution.field_ref)) {
      throw new TypeError(`Unknown SharedField for Contribution: ${contribution.field_ref}`);
    }
    const participant = participants.get(contribution.contributor_participant_ref);
    if (!participant) {
      throw new TypeError(`Unknown contributor Participant: ${contribution.contributor_participant_ref}`);
    }
    if (participant.field_ref !== contribution.field_ref) {
      throw new TypeError('Contribution field must match contributor Participant field');
    }
    if (wouldCreateContributionCycle(contribution)) {
      throw new TypeError(`Contribution target cycle detected at ${contribution.contribution_ref}`);
    }
    contributions.set(contribution.contribution_ref, clone(contribution));
    return clone(contribution);
  }

  function addEncounter(input) {
    const encounter = validateEncounter(input);
    if (encounters.has(encounter.encounter_ref)) {
      throw new TypeError(`Duplicate Encounter ref: ${encounter.encounter_ref}`);
    }
    if (!fields.has(encounter.field_ref)) {
      throw new TypeError(`Unknown SharedField for Encounter: ${encounter.field_ref}`);
    }
    const participant = participants.get(encounter.participant_ref);
    if (!participant) throw new TypeError(`Unknown Encounter Participant: ${encounter.participant_ref}`);
    if (participant.field_ref !== encounter.field_ref) {
      throw new TypeError('Encounter field must match Participant field');
    }
    encounters.set(encounter.encounter_ref, clone(encounter));
    return clone(encounter);
  }

  function getField(fieldRef) {
    return clone(fields.get(fieldRef));
  }

  function getParticipant(participantRef) {
    return clone(participants.get(participantRef));
  }

  function getContribution(contributionRef) {
    return clone(contributions.get(contributionRef));
  }

  function getEncounter(encounterRef) {
    return clone(encounters.get(encounterRef));
  }

  function childFields(fieldRef) {
    return [...fields.values()]
      .filter((field) => field.parent_field_ref === fieldRef)
      .map(clone);
  }

  function descendantFields(fieldRef) {
    const result = [];
    const queue = childFields(fieldRef);
    while (queue.length) {
      const field = queue.shift();
      result.push(field);
      queue.push(...childFields(field.field_ref));
    }
    return result;
  }

  function fieldPath(fieldRef) {
    const path = [];
    const seen = new Set();
    let field = fields.get(fieldRef);
    while (field) {
      if (seen.has(field.field_ref)) throw new TypeError(`SharedField containment cycle detected at ${field.field_ref}`);
      seen.add(field.field_ref);
      path.unshift(clone(field));
      field = field.parent_field_ref ? fields.get(field.parent_field_ref) : undefined;
    }
    return path;
  }

  function participantsInField(fieldRef, { recursive = false } = {}) {
    const fieldRefs = new Set([fieldRef]);
    if (recursive) {
      for (const field of descendantFields(fieldRef)) fieldRefs.add(field.field_ref);
    }
    return [...participants.values()]
      .filter((participant) => fieldRefs.has(participant.field_ref))
      .map(clone);
  }

  function contributionsInField(fieldRef, { recursive = false } = {}) {
    const fieldRefs = new Set([fieldRef]);
    if (recursive) {
      for (const field of descendantFields(fieldRef)) fieldRefs.add(field.field_ref);
    }
    return [...contributions.values()]
      .filter((contribution) => fieldRefs.has(contribution.field_ref))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(clone);
  }

  function contributionsForTarget(target) {
    const key = targetKey(target);
    return [...contributions.values()]
      .filter((contribution) => targetKey(contribution.target) === key)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(clone);
  }

  function contributionThread(rootContributionRef) {
    const root = contributions.get(rootContributionRef);
    if (!root) return undefined;

    const build = (contribution, seen) => {
      if (seen.has(contribution.contribution_ref)) {
        throw new TypeError(`Contribution target cycle detected at ${contribution.contribution_ref}`);
      }
      const nextSeen = new Set(seen);
      nextSeen.add(contribution.contribution_ref);
      const children = contributionsForTarget({
        kind: CONTRIBUTION_SCHEMA.replace('/v1', ''),
        ref: contribution.contribution_ref,
      });
      return {
        contribution: clone(contribution),
        contributions: children.map((child) => build(child, nextSeen)),
      };
    };

    return build(root, new Set());
  }

  function encountersForParticipant(participantRef, { field_ref } = {}) {
    return [...encounters.values()]
      .filter((encounter) => encounter.participant_ref === participantRef)
      .filter((encounter) => !field_ref || encounter.field_ref === field_ref)
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
      .map(clone);
  }

  function snapshot() {
    return {
      fields: [...fields.values()].map(clone),
      participants: [...participants.values()].map(clone),
      contributions: [...contributions.values()].map(clone),
      encounters: [...encounters.values()].map(clone),
    };
  }

  for (const field of seed.fields ?? []) addField(field);
  for (const participant of seed.participants ?? []) addParticipant(participant);
  for (const contribution of seed.contributions ?? []) addContribution(contribution);
  for (const encounter of seed.encounters ?? []) addEncounter(encounter);

  return Object.freeze({
    addField,
    addParticipant,
    addContribution,
    addEncounter,
    getField,
    getParticipant,
    getContribution,
    getEncounter,
    childFields,
    descendantFields,
    fieldPath,
    participantsInField,
    contributionsInField,
    contributionsForTarget,
    contributionThread,
    encountersForParticipant,
    snapshot,
  });
}
