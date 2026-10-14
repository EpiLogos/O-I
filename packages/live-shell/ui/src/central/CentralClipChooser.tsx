import {useEffect, useState} from 'react'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {BaseDocumentDetail} from '../shell/ModeDetail'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import {ClipWaiting} from '../frame/detail/ClipView'
import {resolveCentralOccasion} from './centralVertical'
import {CentralClipDetail} from './CentralClipDetail'

/** The Base mode's clip side (the Document), one selection at a time. Exactly one selection stands: a browser subject (the
 * existing Days/Files rows) or the encounter's retained occasion (a Timeline clip, which clears the browser subject when it
 * is selected — see App.tsx's `centralWorld`). The occasion is the ONE spine's; the event it names is looked up in the reading
 * the World cut already holds. With neither, the side says what it waits for in one line (`waits`, the mode's own words). */
export function CentralClipChooser({transport, subject, world, waits, colour}: {
  transport: KernelTransportStatus
  subject: CentralSubjectSelection | null
  world: WorldTimelineView
  /** The one line the clip side shows while nothing of Central is selected (shell/modeDetails.tsx). */
  waits: string
  /** The selected clip's track colour, when the selection is a clip of the shown tracks. */
  colour?: string | null
}) {
  const [, setTick] = useState(0)
  const {spine} = world
  useEffect(() => spine.subscribe(() => setTick(value => value + 1)), [spine])

  if (subject) return <BaseDocumentDetail transport={transport} subject={subject} waits={waits} colour={colour} />
  const resolved = resolveCentralOccasion(spine.occasion(), world.source.events)
  if (resolved.state === 'absent') {
    return <ClipWaiting line={`The retained occasion ${resolved.ref} is no longer in the temporal reading. The spine keeps its basis; nothing opens for it here.`} />
  }
  if (resolved.state !== 'selected') return <BaseDocumentDetail transport={transport} subject={null} waits={waits} />
  const selection = resolved.selection
  return <CentralClipDetail key={`${selection.subjectRef}:${selection.instantUnixMs ?? 'undated'}`} transport={transport} selection={selection} colour={colour} />
}
