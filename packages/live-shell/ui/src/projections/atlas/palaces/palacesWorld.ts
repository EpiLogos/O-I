// The palaces of the world, as a hook (T-PALACES-ONTO-ATLAS): the Technē registers' Expressions (palacesModel.ts palaceRows) over the one
// wiki projection state (desktop/cradle/src/techne/wikiProjectionStore.ts — the state the subject door reads), re-read on its own notices.
// The registers are read when a palace list first stands (`readPalaces`, the M5 plate and M4's Locations under the kind `palace`), through the
// owner's own load (native/wikiSubjectStanding.ts
// liveWikiStandingSource.loadRegisters — the World's projects published as the registers, each register's reading ensured once per
// owner access). A refused load is said in the owner's words, never filled.

import {useMemo, useSyncExternalStore} from 'react'
import {getWikiProjectionState, subscribeWikiProjection} from '../../../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import {liveWikiStandingSource} from '../../../native/wikiSubjectStanding'
import {palaceRows, type PalaceRow} from './palacesModel'

export type PalacesLoad = {readonly phase: 'idle' | 'reading' | 'read'} | {readonly phase: 'refused'; readonly reason: string}

let load: PalacesLoad = {phase: 'idle'}
const listeners = new Set<() => void>()

function setLoad(next: PalacesLoad): void {
  load = next
  for (const listener of [...listeners]) listener()
}

export function palacesLoad(): PalacesLoad {
  return load
}

/** Read the world's registers (once; a refused read may be asked again). */
export function readPalaces(source: {loadRegisters(): Promise<void>} = liveWikiStandingSource): void {
  if (load.phase === 'reading' || load.phase === 'read') return
  setLoad({phase: 'reading'})
  source.loadRegisters().then(() => setLoad({phase: 'read'}), error => setLoad({phase: 'refused', reason: error instanceof Error ? error.message : String(error)}))
}

/** For the tests. */
export function resetPalacesLoad(): void {
  setLoad({phase: 'idle'})
}

/** The world's palaces and how their reading stands, re-read when the projection state or the load moves. */
export function usePalaces(): {rows: readonly PalaceRow[]; load: PalacesLoad} {
  const projection = useSyncExternalStore(subscribeWikiProjection, getWikiProjectionState, getWikiProjectionState)
  const loaded = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, palacesLoad, palacesLoad)
  const rows = useMemo(() => palaceRows(projection), [projection])
  return {rows, load: loaded}
}

/** The words a list of palaces says while it has none. */
export function palacesWaiting(load: PalacesLoad, count: number): string | null {
  if (count) return null
  if (load.phase === 'refused') return `The palaces were not read: ${load.reason}`
  if (load.phase === 'reading') return 'Reading the palaces of your world…'
  if (load.phase === 'read') return 'No register of your world holds a palace yet.'
  return 'The palaces of your world are not read yet.'
}
