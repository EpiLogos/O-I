import {useEffect, useState} from 'react'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {BaseDocumentDetail} from '../shell/ModeDetail'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import {resolveCentralOccasion} from './centralVertical'
import {CentralClipDetail} from './CentralClipDetail'

/** The Base mode's clip side (the Document detail row), one selection at a
 * time. Exactly one selection stands: a browser subject (the existing
 * Days/Files rows) or the encounter's retained occasion (a Timeline clip,
 * which clears the browser subject when it is selected — see App.tsx's
 * `centralWorld`). The occasion is the ONE spine's; the event it names is
 * looked up in the reading the World cut already holds. */
export function CentralClipChooser({transport, subject, world}: {
  transport: KernelTransportStatus
  subject: CentralSubjectSelection | null
  world: WorldTimelineView
}) {
  const [, setTick] = useState(0)
  const {spine} = world
  useEffect(() => spine.subscribe(() => setTick(value => value + 1)), [spine])

  if (subject) return <BaseDocumentDetail transport={transport} subject={subject}/>
  const occasion = spine.occasion()

  const resolved = resolveCentralOccasion(occasion, world.source.events)
  if (resolved.state === 'absent') {
    return (
      <div className="mode-detail" data-mode-detail="base-document" data-central-occasion="absent">
        <section className="inhabitant-device" data-central-clip-absent={resolved.ref}>
          <p className="inhabitant-device-notice" role="status">The retained occasion {resolved.ref} is no longer in the temporal reading. The spine keeps its basis; no Central device opens for it.</p>
        </section>
      </div>
    )
  }
  if (resolved.state !== 'selected') return <BaseDocumentDetail transport={transport} subject={null}/>
  const selection = resolved.selection
  return (
    <div className="mode-detail" data-mode-detail="base-document" data-central-occasion={selection.kind}>
      <CentralClipDetail key={`${selection.subjectRef}:${selection.instantUnixMs ?? 'undated'}`} transport={transport} selection={selection}/>
    </div>
  )
}
