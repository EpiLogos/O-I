import {useEffect, useState} from 'react'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import {resolveCentralOccasion, type CentralClipSelection} from './centralVertical'

/** The Central selection the Base detail row shows: a browser subject stands
 * while it is set (the rack then keeps its own); otherwise the spine's retained
 * occasion, read from the reading the World cut holds. Re-renders on spine change. */
export function useCentralSelection(world: WorldTimelineView | null, subject: CentralSubjectSelection | null): CentralClipSelection | null {
  const [, setTick] = useState(0)
  const spine = world?.spine ?? null
  useEffect(() => spine?.subscribe(() => setTick(value => value + 1)), [spine])
  if (!world || subject) return null
  const resolved = resolveCentralOccasion(world.spine.occasion(), world.source.events)
  return resolved.state === 'selected' ? resolved.selection : null
}
