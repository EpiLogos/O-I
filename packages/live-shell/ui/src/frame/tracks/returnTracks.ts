// Return tracks' names (manual §16.2, §19.23; Live's return tracks, shown and hidden by ⌥⌘R): in Factory each workcell of the machine's
// register stands as a return track, its chain the road in and out — Gateway, Remote carrier, Git / landing with its Seat — and every
// track an agent works on names it in its In/Out section as Works in. The return tracks and Works in are the kernel's Set's (mode_set.rs,
// from the World Model's workcells slice, O-I #1004); what stays here is a return track's id, `workcell:<name>`, the register's own name
// for it (env-1), which the devices read back. Pure.

export const WORKCELL_TRACK_PREFIX = 'workcell:'

/** The return track of a workcell, by the register's name for it. */
export const workcellTrackId = (name: string): string => `${WORKCELL_TRACK_PREFIX}${name}`

/** The workcell a track id names, or null for a track that is no workcell. */
export const workcellOfTrack = (id: string | null | undefined): string | null =>
  id && id.startsWith(WORKCELL_TRACK_PREFIX) && id.length > WORKCELL_TRACK_PREFIX.length ? id.slice(WORKCELL_TRACK_PREFIX.length) : null
