/**
 * The Timeline projection's encounter → presentation mapping — the pure half
 * of the residence (`timelineResidence.tsx` renders it). One function, whole:
 * the audio cut presents through `tab`; the native cut presents through the
 * `native.session` / `native.arrangement` application-view identity; anything
 * else presents neither (both presentations stand concealed-retained).
 * Selection of a presentation never writes here — this reads the encounter,
 * it stores nothing.
 */
export const PROJECTION_TIMELINE_KIND = 'projection.timeline'

export type TimelinePresentation = 'session' | 'arrangement'

export function timelinePresentation(mode: string, tab: string, centerPanel: string): TimelinePresentation | null {
  if (mode === 'audio') return tab === 'session' ? 'session' : tab === 'arrangement' ? 'arrangement' : null
  return centerPanel === 'native.session' ? 'session' : centerPanel === 'native.arrangement' ? 'arrangement' : null
}
