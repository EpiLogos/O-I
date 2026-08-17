import { resolveA2aParticipation } from './a2a.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

/**
 * Traverse the intended vertical slice from Explore search results into semantic A2A
 * participation. Search yields canonical Agent refs; A2A metadata cannot manufacture them.
 */
export function searchA2aParticipation({ explore, query, participants, bindings, presence, limit = 20 }) {
  if (!explore || typeof explore.search !== 'function') throw new TypeError('Explore application with search() is required');
  requireString(query, 'A2A Explore query');
  const hits = explore.search(query, { limit });
  return hits
    .map((hit) => {
      const participation = resolveA2aParticipation({
        agent_ref: hit.ref,
        participants,
        bindings,
        presence,
      });
      if (!participation?.participant || participation.participant.identity.kind !== 'agent') return undefined;
      return { explore: hit, participation };
    })
    .filter(Boolean);
}

export function resolveExploreAgentA2a({ explore, agent_ref, participants, bindings, presence }) {
  if (!explore || typeof explore.read !== 'function') throw new TypeError('Explore application with read() is required');
  requireString(agent_ref, 'Agent semantic ref');
  const entry = explore.read(agent_ref);
  if (!entry || entry.kind !== 'agent') return undefined;
  const participation = resolveA2aParticipation({ agent_ref, participants, bindings, presence });
  return participation ? { explore: entry, participation } : undefined;
}
