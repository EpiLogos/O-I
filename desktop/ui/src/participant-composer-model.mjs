export const PARTICIPANT_ADDRESS_VERSION = 'aikit.participant-address/v1';

export function initialParticipantComposerState() {
  return Object.freeze({
    open: false,
    query: '',
    highlighted: 0,
    to: [],
    mentions: [],
  });
}

export function visibleParticipantCandidates(state, candidates) {
  const query = state.query.trim().toLowerCase().replace(/^@/, '');
  const selected = new Set([...state.to, ...state.mentions].map(targetKey));
  return candidates
    .filter((target) => !selected.has(targetKey(target)))
    .filter((target) => !query
      || target.address.toLowerCase().includes(query)
      || target.participant.toLowerCase().includes(query)
      || target.kind.toLowerCase().includes(query));
}

/**
 * Pure interaction transition for the inline To:/@ picker. Search/open/highlight
 * are presentation-local; only typed target arrays become address meaning.
 */
export function participantComposerTransition(state, event, candidates = []) {
  const next = copyState(state);
  switch (event.type) {
    case 'open':
      next.open = true;
      next.highlighted = clampHighlight(next, candidates, next.highlighted);
      break;
    case 'close':
      next.open = false;
      next.query = '';
      next.highlighted = 0;
      break;
    case 'query':
      next.query = String(event.value ?? '');
      next.open = true;
      next.highlighted = 0;
      break;
    case 'arrow-down': {
      const visible = visibleParticipantCandidates(next, candidates);
      if (visible.length) next.highlighted = (next.highlighted + 1) % visible.length;
      next.open = true;
      break;
    }
    case 'arrow-up': {
      const visible = visibleParticipantCandidates(next, candidates);
      if (visible.length) next.highlighted = (next.highlighted - 1 + visible.length) % visible.length;
      next.open = true;
      break;
    }
    case 'select-highlighted': {
      const visible = visibleParticipantCandidates(next, candidates);
      const selected = visible[next.highlighted];
      if (selected) addTarget(next, selected, event.channel ?? 'to');
      break;
    }
    case 'select':
      addTarget(next, event.target, event.channel ?? 'to');
      break;
    case 'remove':
      next.to = next.to.filter((target) => targetKey(target) !== targetKey(event.target));
      next.mentions = next.mentions.filter((target) => targetKey(target) !== targetKey(event.target));
      break;
    case 'backspace':
      if (next.query === '' && next.to.length) next.to = next.to.slice(0, -1);
      break;
    case 'escape':
      if (next.query) {
        next.query = '';
        next.highlighted = 0;
      } else {
        next.open = false;
      }
      break;
    default:
      throw new TypeError(`Unsupported participant composer event: ${event.type}`);
  }
  return Object.freeze(next);
}

export function participantAddressFromComposer(state) {
  return Object.freeze({
    version: PARTICIPANT_ADDRESS_VERSION,
    to: state.to.map(copyTarget),
    mentions: state.mentions.map(copyTarget),
  });
}

function addTarget(state, target, channel) {
  if (!target || !['human', 'agent', 'agent-set'].includes(target.kind)) {
    throw new TypeError('participant target must retain human, agent or agent-set kind');
  }
  if (typeof target.participant !== 'string' || !target.participant.trim()) {
    throw new TypeError('participant target requires stable participant ref');
  }
  if (typeof target.address !== 'string' || !target.address.startsWith('@')) {
    throw new TypeError('participant target requires @ address');
  }
  const key = targetKey(target);
  if ([...state.to, ...state.mentions].some((candidate) => targetKey(candidate) === key)) return;
  if (channel === 'mention') state.mentions.push(copyTarget(target));
  else state.to.push(copyTarget(target));
  state.query = '';
  state.highlighted = 0;
  state.open = true;
}

function clampHighlight(state, candidates, requested) {
  const visible = visibleParticipantCandidates(state, candidates);
  if (!visible.length) return 0;
  return Math.max(0, Math.min(requested, visible.length - 1));
}

function copyState(state) {
  return {
    open: Boolean(state.open),
    query: String(state.query ?? ''),
    highlighted: Number.isInteger(state.highlighted) ? state.highlighted : 0,
    to: Array.isArray(state.to) ? state.to.map(copyTarget) : [],
    mentions: Array.isArray(state.mentions) ? state.mentions.map(copyTarget) : [],
  };
}

function copyTarget(target) {
  return { kind: target.kind, participant: target.participant, address: target.address };
}

function targetKey(target) {
  return `${target.kind}\u0000${target.participant}\u0000${target.address}`;
}
