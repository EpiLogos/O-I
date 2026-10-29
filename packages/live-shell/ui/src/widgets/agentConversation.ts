// Which conversation the agent widget holds (manual §10.6 "The agent you are talking to is one"; FOUNDATION F8) — pure.
//
// The conversation is a session in the agency reading, never one the widget invents:
//   1. the session THE selection names — a Factory session track, or the session of a selected task (as
//      agent/AgentShellContext.tsx `sessionOfSelection` reads it); a group stands for its lead, the first member with a
//      named agent (agent/AgentThreadView.tsx `threadTrackOf`);
//   2. else the companion's own session: the first one the agency reading lists whose agent is the companion of the mode in
//      front of you (Fizz, Anima, Epii — shell/ModeContextDock.tsx COMPANIONS);
//   3. else none, and the widget says why in the owner's words.
import {trackKey, type AgentSessionTrack} from '../agent/agentRunModel'
import {parseFactoryTaskRef} from '../timeline/factoryTrackAdapter'
import type {EncounterReading} from '../../../../../desktop/cradle/src/encounter/client'
import type {WidgetGlance} from '../frame/widgets/widgets'

/** Where the agency reading and the conversations stand, in words: the world's own registers (agent/worldScope.ts) — its root register
 * and each project Central discloses — each conversation in its session's own register (AgentThreadView.tsx). */
export const CONVERSATION_PLACE = 'your world (its root register and each project Central discloses)'

export interface AgentConversation {
  readonly track: AgentSessionTrack | null
  /** Why this session: THE selection names it, or it is the companion's own. Null with none. */
  readonly by: 'selection' | 'companion' | null
}

const leadOf = (tracks: readonly AgentSessionTrack[], track: AgentSessionTrack): AgentSessionTrack | null => {
  if (!track.group) return track
  const members = tracks.filter(item => !item.group && item.parentRef === track.spaceRef)
  return members.find(member => member.agentName) ?? members[0] ?? null
}

export function conversationOf(tracks: readonly AgentSessionTrack[], companion: string, subject: string | null): AgentConversation {
  if (subject) {
    const key = parseFactoryTaskRef(subject)?.trackId ?? subject
    const named = tracks.find(track => trackKey(track) === key)
    const lead = named ? leadOf(tracks, named) : null
    if (lead) return {track: lead, by: 'selection'}
  }
  const wanted = companion.trim().toLocaleLowerCase()
  const own = tracks.find(track => !track.group && track.agentName?.trim().toLocaleLowerCase() === wanted)
  return own ? {track: own, by: 'companion'} : {track: null, by: null}
}

/** Why no conversation stands, in the owners' words: the carrier, the agency reading, or the companion's absence from it. */
export function conversationAbsence(companion: string, agency: {transport: {kind: string; reason?: string}; error: string | null; loading: boolean}): string {
  if (agency.transport.kind === 'unavailable') return `The carrier is unavailable, so the agency reading waits: ${agency.transport.reason ?? 'no reason given'}.`
  if (agency.error) return `The agency reading refused: ${agency.error}`
  if (agency.loading) return 'Reading the agency…'
  return `No ${companion} conversation stands in the agency reading.`
}

/** The conversation's last turns as the launcher's miniature: the owner's own blocks, the person's and the agent's only. */
export function conversationGlance(reading: Pick<EncounterReading, 'blocks'> | undefined, companion: string): WidgetGlance | null {
  const turns = (reading?.blocks ?? []).filter(block => block.kind === 'user' || block.kind === 'assistant')
  if (!turns.length) return null
  return {lines: turns.slice(-4).map(block => ({lead: block.kind === 'user' ? 'you' : companion, text: block.text.replace(/\s+/g, ' ').trim().slice(0, 90)}))}
}

/** The session a search line's tag starts an agent on (DLW §18.4 What a tag sends: "Agent — Starts the agent on the passage"; O-I #820):
 * the agency reading's own session of that agent, by its ref — a single session, never a group's — or none. The line sends through that
 * session's encounter, as Central's Agent sends a turn (central/devices/CentralDevices.tsx answerSend: change, then send). Pure. */
export function sessionOfAgent(tracks: readonly AgentSessionTrack[], agentRef: string): AgentSessionTrack | null {
  return tracks.find(track => !track.group && track.agentRef === agentRef) ?? null
}
