export type ParticipantTargetKind = 'human' | 'agent' | 'agent-set';
export type ParticipantTarget = { kind: ParticipantTargetKind; participant: string; address: string };
export type ParticipantAddress = { version: 'aikit.participant-address/v1'; to: ParticipantTarget[]; mentions: ParticipantTarget[] };
export type ParticipantComposerState = {
  open: boolean;
  query: string;
  highlighted: number;
  to: ParticipantTarget[];
  mentions: ParticipantTarget[];
};
export type ParticipantComposerEvent =
  | { type: 'open' | 'close' | 'arrow-down' | 'arrow-up' | 'backspace' | 'escape' }
  | { type: 'query'; value: string }
  | { type: 'select-highlighted'; channel?: 'to' | 'mention' }
  | { type: 'select'; target: ParticipantTarget; channel?: 'to' | 'mention' }
  | { type: 'remove'; target: ParticipantTarget };

export const PARTICIPANT_ADDRESS_VERSION: 'aikit.participant-address/v1';
export function initialParticipantComposerState(): ParticipantComposerState;
export function visibleParticipantCandidates(state: ParticipantComposerState, candidates: ParticipantTarget[]): ParticipantTarget[];
export function participantComposerTransition(state: ParticipantComposerState, event: ParticipantComposerEvent, candidates?: ParticipantTarget[]): ParticipantComposerState;
export function participantAddressFromComposer(state: ParticipantComposerState): ParticipantAddress;
