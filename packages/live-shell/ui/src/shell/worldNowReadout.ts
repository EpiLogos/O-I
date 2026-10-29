// The World cut's Now readout (moved here from shell/ModeDetail.tsx, O-I #740): the frame reads it for the transport on its first
// draw, and ModeDetail — Central's and Technē's chains — loads only when a chain first draws (shell/modeDetails.tsx).
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'

/** The World cut's honest status line — one reading, for the mode
 * transports (Base/Technē position slot): the civil Now the kernel's own
 * read derived, never the wall clock. */
export function worldNowReadout(world: WorldTimelineView | null): {value: string; title: string} {
  const source = world?.source
  if (!source || source.status === 'unavailable') {
    return {value: '—', title: source?.error ? `The civil field read refused: ${source.error}` : 'No civil-field reading stands — the Now slot stays empty rather than show the wall clock'}
  }
  if (source.status === 'reading') return {value: '…', title: 'Reading the civil field (the kernel\'s temporal read)'}
  const now = source.now
  const label = now ? new Date(now.instantUnixMs).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + (now.dayRef ? '' : '') : null
  return {
    value: label ?? '—',
    title: now ? `Now — derived from the kernel's own temporal read (${now.source}${now.dayRef ? ` · ${now.dayRef}` : ''})` : 'The reading stands but carries no civil instant',
  }
}
