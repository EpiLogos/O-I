// The session a thread follows, as the thread pane resolves it (moved here from AgentThreadView.tsx so the Factory chain's Thread
// device reads the same session without importing the pane's conversation surface — lane BF2). Pure.
import {trackKey, type AgentSessionTrack} from './agentRunModel'

/**
 * The session a thread follows. The agent tab is the thread beside the Session · Arrangement pane (world-shell-mockup.html
 * `modes.factory`: `[sessions] | [thread]`), so it follows THE selection: the session selected there, or the session of the
 * task selected there (WorldContext.selection, through `selectedTrackId`). Only with nothing selected does the session a
 * `openThread` named, or the first session, stand in. A group is not a conversation: its thread is its lead's, the first member
 * with a named agent (else its first member), and a group with no member has none.
 */
export function threadTrackOf(tracks: readonly AgentSessionTrack[], selectedTrackId: string | null, openedTrackId: string | null): AgentSessionTrack | undefined {
  const keyed = (id: string | null) => id === null ? undefined : tracks.find(item => trackKey(item) === id)
  const named = keyed(selectedTrackId) ?? keyed(openedTrackId) ?? tracks.find(item => !item.group)
  if (!named?.group) return named
  const members = tracks.filter(item => !item.group && item.parentRef === named.spaceRef)
  return members.find(member => member.agentName) ?? members[0]
}
