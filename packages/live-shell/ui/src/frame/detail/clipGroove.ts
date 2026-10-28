// A clip's groove from the pool, in every mode's Clip view (manual §16.5: "Groove, in the Clip panel, chooses a QL frame or an MEF lens
// from the pool … The clip is read through what you choose, and its source stays as it is (§16.7)"; decision #709 "chosen in the Clip
// panel, applied without changing the source").
//
// The one clip host lays the pool's keys (clips/design.ts GROOVE) over whatever binding a mode's owner gives its clip, so no mode's binding
// carries them: the choice and Hot-swap go to the pool (frame/browser/poolStore.ts), never to the clip's owner, and the reading is the
// constellation's through the chosen groove, read through its owner (owners/grooveOwners.ts readThrough). The clip's source is the
// constellation its owner names (clips/design.ts MADE_OF.ref); Clip view tells the pool which clip it holds, so the pool lights the groove
// it uses, and Hot-swap and Commit there act on it.
import {useEffect, useMemo, useState} from 'react'
import {GROOVE, MADE_OF} from '../../inhabitants/catalogue/clips/design'
import {constellationNamed, useConstellations} from '../../owners/constellations'
import {readThrough} from '../../owners/grooveOwners'
import {chooseGroove, nextGroove, publishPoolClip, usePool, type PoolState} from '../browser/poolStore'
import type {ClipBinding, Value, ValueChange, Values} from './clipBinding'

export const NO_GROOVE = 'none'

/** The clip's reading through its groove: being read, read in the owner's words, or refused with why. */
export interface GrooveReading {readonly state: 'reading' | 'read' | 'refused'; readonly words: string}

/** The pool's keys for one clip: the groove it uses, the pool's grooves to choose from, and its reading where there is one. Pure. */
export function grooveValues(pool: PoolState, clipId: string, reading: GrooveReading | null): Values {
  return {[GROOVE.choice]: pool.chosen[clipId] ?? NO_GROOVE,
    [GROOVE.options]: JSON.stringify(pool.grooves.map(groove => ({value: groove.id, label: groove.name, kind: groove.kind, from: groove.from.title}))),
    ...(reading ? {[GROOVE.reading]: reading.words} : {})}
}

const pooled = (key: string) => key === GROOVE.choice || key === GROOVE.swap

/** A clip's binding with the pool's keys laid over it: the choice and Hot-swap written into the pool, every other key to the clip's own
 * owner as before. Pure. */
export function withGroove(binding: ClipBinding, pool: PoolState, reading: GrooveReading | null): ClipBinding {
  const own = binding.writes ?? ((): boolean => !!binding.write)
  return {...binding,
    values: {...binding.values, ...grooveValues(pool, binding.id, reading)},
    writes: key => pooled(key) || own(key),
    write: async (changes: readonly ValueChange[]) => {
      const rest = changes.filter(change => !pooled(change.key))
      for (const {key, value} of changes) {
        if (key === GROOVE.choice) chooseGroove(binding.id, value === NO_GROOVE || value === undefined || value === null ? null : String(value))
        if (key === GROOVE.swap) chooseGroove(binding.id, nextGroove(binding.id))
      }
      if (rest.length) {
        if (!binding.write) throw new Error(`${rest[0]!.key}: a reading — the owner reports it, and nothing in Clip view changes it.`)
        await binding.write(rest)
      }
    }}
}

const text = (value: Value | undefined): string | null => (typeof value === 'string' && value ? value : null)

/** The hosted clip with its groove: tells the pool which clip Clip view holds, reads the clip's constellation through the groove it uses
 * (again when the groove, its sublens or the source changes), and lays the pool's keys over the binding. */
export function useClipGroove(binding: ClipBinding): ClipBinding {
  const pool = usePool()
  const {rows} = useConstellations()
  const sourceRef = text(binding.values[MADE_OF.ref])
  useEffect(() => { publishPoolClip({id: binding.id, mode: binding.mode, sourceRef}) }, [binding.id, binding.mode, sourceRef])
  useEffect(() => () => publishPoolClip(null), [])
  const groove = pool.grooves.find(item => item.id === pool.chosen[binding.id]) ?? null
  const sublens = groove ? pool.sublens[groove.id] ?? null : null
  const constellation = constellationNamed(rows, sourceRef)
  const [reading, setReading] = useState<GrooveReading | null>(null)
  useEffect(() => {
    if (!groove) { setReading(null); return }
    if (!sourceRef) { setReading({state: 'refused', words: 'The clip was made of no constellation, so there is nothing to read through the groove.'}); return }
    if (!constellation) { setReading({state: 'refused', words: `${sourceRef} is no constellation the wiki's reading holds now.`}); return }
    let alive = true
    setReading({state: 'reading', words: `Reading ${constellation.title} through ${groove.name}…`})
    void readThrough({constellation, groove, sublens}).then(answer => {
      if (alive) setReading(answer.ok ? {state: 'read', words: answer.words} : {state: 'refused', words: answer.error})
    })
    return () => { alive = false }
  }, [groove?.id, sublens, sourceRef, constellation])
  return useMemo(() => withGroove(binding, pool, reading), [binding, pool, reading])
}
