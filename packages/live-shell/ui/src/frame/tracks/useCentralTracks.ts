// Central's tracks for the shared Session and Arrangement (T-TRACKS-CENTRAL; lock §9.1 Central row): the mode's hook over the
// reading the frame publishes. Central's owner is read here, never copied into a second store:
// - the day records: `files_list` at the root register's day surface (shell/ModeBrowser.tsx DaysRows, ported at lines 186–202:
//   the same listFiles route the Document detail reads through), re-read each time the World cut's civil read lands so the two
//   stay in step without a second timer;
// - the day's entries: the World cut's one temporal read, which the frame already publishes as `reading.world` — the hook
//   calls no `useWorldTemporalReading` of its own (one poller per frame).
// It returns the five streams always — a read that has not landed, or was refused, is named in the Day track's `kind` text, and the
// four streams without an owner read stand as named, empty tracks (timeline/centralTrackAdapter.ts). Registered as
// `base: worldCut(useCentralTracks)` in modeTracks.ts.
import {useEffect, useMemo, useState} from 'react'
import {listFiles} from '../../../../../../desktop/cradle/src/files/client'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {
  CENTRAL_DAY_RECORDS_PATH,
  civilReadingOf,
  dayRecordsOf,
  projectCentralTracks,
  type CentralDayRecordsReading,
} from '../../timeline/centralTrackAdapter'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {TracksReading} from './modeTracks'

/** The day records through the owner's listing route. A refusal is the reading, named — never an empty list. */
export async function readDayRecords(transport: KernelTransportStatus | undefined): Promise<CentralDayRecordsReading> {
  if (!transport) return {state: 'unavailable', reason: 'the shell published no kernel carrier to this pane'}
  if (transport.kind === 'unavailable') return {state: 'unavailable', reason: transport.reason}
  try {
    return {state: 'read', records: dayRecordsOf(await listFiles(transport, CENTRAL_DAY_RECORDS_PATH))}
  } catch (cause) {
    return {state: 'unavailable', reason: cause instanceof Error ? cause.message : String(cause)}
  }
}

export function useCentralTracks(reading: TracksReading): WorldTrackSet {
  const transport = reading.transport
  const source = reading.world?.source
  const readAt = source?.readAtUnixMs ?? null
  const [records, setRecords] = useState<CentralDayRecordsReading>({state: 'reading'})
  useEffect(() => {
    let live = true
    void readDayRecords(transport).then(next => { if (live) setRecords(next) })
    return () => { live = false }
  }, [transport, readAt])
  const civil = useMemo(() => civilReadingOf(source), [source])
  return useMemo(() => projectCentralTracks({records, civil}), [records, civil])
}
