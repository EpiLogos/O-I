// Factory's clip identities. Factory's Set — its Agent sessions as tracks, Factory's tasks as clips on the session that executes them,
// their attempts as takes, the workcells as return tracks — is the kernel's, built from the World Model's sessions, factory and
// workcells slices (kernel mode_set.rs, O-I #1004), with each session's and task's acts as Factory's own Actions (a session's end, a
// task's run and stop, the seat an agent drop starts; O-I #1006), and drawn through frame/tracks/kernelSet.ts. What stays here is a
// task clip's id, `<track id>#task/<n>` (the n-th task on its track): THE selection's ref for it, which `parseFactoryTaskRef` gives back
// as the session it lies on.
//
// Pure TypeScript. No React.

const TASK_MARK = '#task/'

/** A task clip's id: its session's track id and its ordinal in that session. */
export const factoryTaskRef = (trackId: string, n: number): string => `${trackId}${TASK_MARK}${n}`

/** The session track id and ordinal a task clip id names; null for anything else. */
export function parseFactoryTaskRef(ref: string): {trackId: string; n: number} | null {
  const at = ref.lastIndexOf(TASK_MARK)
  if (at <= 0) return null
  const n = Number(ref.slice(at + TASK_MARK.length))
  return Number.isSafeInteger(n) && n >= 1 ? {trackId: ref.slice(0, at), n} : null
}
