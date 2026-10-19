// A Being page's identity and sky in Clip view (manual §24.6; §18.1 the Launch panel: "Sky opens the Sky at the page's placements. A
// being … with no placement in the sky says so beside that choice, and the choice stays closed"; T-WORLDS §6, W4). The page's Subject is
// a person's ref; their saved identity is read through nara_identity (desktop/cradle/src/nara/beingIdentity.ts) and its own natal chart
// is the page's placement in the sky. The values this adds to the clip's readings:
//   sky        present when the identity carries a birth sky: Launch as Sky opens on it (practiceLaunch.ts skyOfBeing);
//   identity   the identity's layers, each present with its source or absent with its reason (JSON list of lines).
// Absent, the design's own words stand. A reading: nothing is written, and nothing fills a missing layer.
import {useEffect, useState} from 'react'
import type {KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types'
import {beingSubject, layersInWords, readBeingIdentity} from '../../../../../../../desktop/cradle/src/nara/beingIdentity'
import type {Value} from '../../../frame/devices/designed'
import './practiceLaunch'

/** The identity readings a Being page adds to its clip, by its Subject; none for any other page. */
export function useBeingSky(transport: KernelTransportStatus, island: unknown): Readonly<Record<string, Value>> {
  const subject = island === undefined ? null : beingSubject(island)
  const person = subject && 'person_ref' in subject ? subject.person_ref : null
  const [held, setHeld] = useState<{person: string; values: Record<string, Value>} | null>(null)
  useEffect(() => {
    if (!person) return
    let alive = true
    readBeingIdentity(transport, island).then(read => {
      if (!alive) return
      if (!read.ok) { setHeld({person, values: {}}); return }
      const values: Record<string, Value> = {identity: JSON.stringify(layersInWords(read.identity.layers))}
      if (read.identity.natal) values.sky = `${read.identity.name ?? person}'s birth sky, from ${read.identity.source.source_ref} @ ${read.identity.source.revision}`
      setHeld({person, values})
    }, () => { if (alive) setHeld({person, values: {}}) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the Subject names the identity
  }, [transport, person])
  return person && held?.person === person ? held.values : {}
}
