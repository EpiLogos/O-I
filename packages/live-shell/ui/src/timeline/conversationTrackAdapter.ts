// Conversation clips — transcripts as temporal material (WORLD-SHELL-DESIGN
// §5.3: "A conversation is also a clip in the Timeline projection (its
// transcript is temporal material)").
//
// Projection, over the kernel's ONE temporal read (nothing copied — the
// canonical conversation stays in its owner; only its receipts are placed):
// - columns: the civil days the receipts stood in;
// - tracks: one lane per conversation space (session-space subjects),
//   bounded to the eight most recent with honest overflow;
// - clips: the space's receipts as moments — a conversation's clip is its
//   receipt trail, labelled by the receipt summary. Standing stays as read.
//
// Pure TypeScript. No React, no second transcript store.

import type {WorldTrack, WorldTrackAdapter, WorldTrackClip, WorldTrackColumn, WorldTrackSet} from './worldTrackAdapter';
import {eventDayKey, eventStanding, type TemporalEventRow} from './timeSpine';

export const CONVERSATION_TRACK_ADAPTER_ID = 'conversation-clips';

const MAX_CONVERSATION_TRACKS = 8;

export function isConversationSubject(subjectRef: string): boolean {
  return subjectRef.startsWith('session-space/');
}

const spaceName = (subjectRef: string): string => {
  const tail = subjectRef.split('/').slice(1).join('/') || subjectRef;
  return tail.length > 36 ? `${tail.slice(0, 33)}…` : tail;
};

const shortSummary = (summary: string | undefined, ref: string): string => {
  const text = (summary ?? '').trim();
  if (!text) return ref.length > 36 ? `${ref.slice(0, 33)}…` : ref;
  return text.length > 56 ? `${text.slice(0, 53)}…` : text;
};

// Shared id builder for the projection and its clip→event index.
const conversationClipId = (event: TemporalEventRow): string =>
  `conversation-clip:${event.subject_ref}:${event.instant_unix_ms ?? 'unindexed'}`;

/** The clip→event index for the conversation projection: same iteration,
 * same ids (spaces ordered most-recent-first, bounded, day-dated only). */
export function conversationClipEventIndex(events: TemporalEventRow[]): Map<string, TemporalEventRow> {
  const bySpace = new Map<string, TemporalEventRow[]>();
  for (const event of events) {
    if (!isConversationSubject(event.subject_ref)) continue;
    const lane = bySpace.get(event.subject_ref) ?? [];
    lane.push(event);
    bySpace.set(event.subject_ref, lane);
  }
  const latest = (subject: string): number =>
    Math.max(0, ...(bySpace.get(subject) ?? []).map((event) => event.instant_unix_ms ?? 0));
  const spaces = [...bySpace.keys()].sort((a, b) => latest(b) - latest(a));
  const kept = new Set(spaces.slice(0, MAX_CONVERSATION_TRACKS));
  const index = new Map<string, TemporalEventRow>();
  for (const space of spaces) {
    if (!kept.has(space)) continue;
    for (const event of bySpace.get(space) ?? []) {
      const day = eventDayKey(event);
      if (!day) continue;
      index.set(conversationClipId(event), event);
    }
  }
  return index;
}

export function projectConversationTracks(events: TemporalEventRow[]): WorldTrackSet {
  const bySpace = new Map<string, TemporalEventRow[]>();
  for (const event of events) {
    if (!isConversationSubject(event.subject_ref)) continue;
    const lane = bySpace.get(event.subject_ref) ?? [];
    lane.push(event);
    bySpace.set(event.subject_ref, lane);
  }

  const spaces = [...bySpace.keys()].sort((a, b) => latestEvent(b) - latestEvent(a));
  const kept = spaces.slice(0, MAX_CONVERSATION_TRACKS);
  const overflow = spaces.length - kept.length;
  function latestEvent(subject: string): number {
    return Math.max(0, ...(bySpace.get(subject) ?? []).map((event) => event.instant_unix_ms ?? 0));
  }

  const dayKeys: string[] = [];
  for (const space of kept) {
    for (const event of bySpace.get(space) ?? []) {
      const day = eventDayKey(event);
      if (day && !dayKeys.includes(day)) dayKeys.push(day);
    }
  }
  dayKeys.sort((a, b) => a.localeCompare(b));
  const columns: WorldTrackColumn[] = dayKeys.map((day) => ({id: `day:${day}`, name: day}));

  const tracks: WorldTrack[] = kept.map((space) => ({
    id: `conversation:${space}`,
    name: spaceName(space),
    kind: 'conversation',
  }));
  if (overflow > 0) {
    tracks.push({id: 'conversation:overflow', name: `…${overflow} more conversations`, kind: 'conversation-overflow'});
  }

  const clips: WorldTrackClip[] = [];
  for (const space of kept) {
    for (const event of bySpace.get(space) ?? []) {
      const day = eventDayKey(event);
      if (!day) continue;
      clips.push({
        id: conversationClipId(event),
        trackId: `conversation:${space}`,
        columnId: `day:${day}`,
        label: shortSummary(event.summary, event.subject_ref),
        // A receipt is a moment; the read gives no honest span.
        state: eventStanding(event),
      });
    }
  }

  return {columns, tracks, clips};
}

export const conversationTrackAdapter: WorldTrackAdapter<TemporalEventRow[]> = {
  id: CONVERSATION_TRACK_ADAPTER_ID,
  project: projectConversationTracks,
};
