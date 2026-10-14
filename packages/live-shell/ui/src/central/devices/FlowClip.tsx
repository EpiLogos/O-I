// The Flow on the Clip side (DEVICE-SEMANTICS-LOCK §0.1 every designed element occupies a Live semantic and keeps its invariant;
// §5.3 a `clip` binds native material by ref + revision with a state; §9.4 Central, take lanes: revisions — draft · saved ·
// edited since save). The family declares the Flow a `clip` (inhabitants/worldShellFamilies.ts, `flow-document`), so it is not
// a device on the Device chain: it is the open document, with its material, its revision and its states as rows, and the
// hosted form (FlowFace, the same component under the same owner) as its body.
//
// The state is read, never defaulted: the owner's revision says the document exists; the hosted form says whether it holds
// edits the owner has not (its own `data-dirty` disclosure, observed — the face is the owner of that fact and this clip only
// reads it). With no owner revision there is no reading, so the row stays blank rather than say "saved".
//
// Mounting: the Clip side takes a Flow when the browser's Flows stream gives it a selection (shell/modeGrammar.ts marks the
// category waiting; the Clip chooser has no Flow subject yet), so nothing mounts this until then. It is exported whole.
import {useEffect, useRef, useState} from 'react'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {ReadingRow} from '../../inhabitants/sdk/controls'
import {FlowFace} from '../../inhabitants/DocumentFlowFace'
import type {DeviceWindowHost} from '../../inhabitants/inhabitantRack'
import {inhabitantManifest, type InhabitantFaceDeclaration, type InhabitantManifest} from '../../inhabitants/manifest'
import {KindMark, PopOut} from '../../inhabitants/sdk/marks'
import {CENTRAL_FAMILY, centralDevice, clipFaces} from './centralDeviceModel'
import {popOutOf} from './CentralDevices'
import {useFlowReading} from './useCentralReadings'
import './centralDevices.css'

/** The state the hosted form discloses, as one of the clip's declared states — or null where nothing is disclosed. Pure.
 * `revision` is the owner's; `dirty` is the form's own `data-dirty` (null while the form is not mounted). A name the family
 * did not declare is never invented: the declared list decides what can be said. */
export function flowStateOf(states: readonly string[] | undefined, revision: string | null, dirty: string | null): string | null {
  if (!states || !revision) return null
  const wanted = dirty === 'true' ? 'edited since save' : 'saved'
  return states.includes(wanted) ? wanted : null
}

/** The hosted form's own dirty disclosure, observed inside the body this hook is given. */
export function useHostedDirty(host: {readonly current: HTMLElement | null}): string | null {
  const [dirty, setDirty] = useState<string | null>(null)
  useEffect(() => {
    const body = host.current
    if (!body || typeof MutationObserver === 'undefined') return
    const read = () => setDirty(body.querySelector('[data-document-device="ql-flow"]')?.getAttribute('data-dirty') ?? null)
    read()
    const observer = new MutationObserver(read)
    observer.observe(body, {subtree: true, childList: true, attributes: true, attributeFilter: ['data-dirty']})
    return () => observer.disconnect()
  }, [host])
  return dirty
}

export interface CentralFlowClipProps {
  readonly transport: KernelTransportStatus
  /** The Flow the Clip side opened: its owner location. */
  readonly location: CentralLocation
  readonly deviceWindows?: DeviceWindowHost | null
  /** The family's manifest, when the host holds one (default: the door's). */
  readonly manifest?: InhabitantManifest
}

export function CentralFlowClip({transport, location, deviceWindows = null, manifest = inhabitantManifest(CENTRAL_FAMILY)}: CentralFlowClipProps) {
  const face: InhabitantFaceDeclaration | undefined = clipFaces(manifest?.faces ?? []).find(candidate => candidate.id === 'flow-document')
  const reading = useFlowReading(transport, location)
  const body = useRef<HTMLDivElement>(null)
  const dirty = useHostedDirty(body)
  if (!face) return <p className="inhabitant-device-notice" role="status" data-central-clip="flow-absent">The Central family declares no Flow clip, so none opens here.</p>
  const state = flowStateOf(face.invariant?.states, reading?.revision ?? null, dirty)
  const clip = centralDevice(face, {flow: reading ? {...reading, state} : null})
  const popOut = popOutOf(face, {manifest, deviceWindows, day: null, flow: {location}, conversation: null})
  return <section className="inhabitant-device" data-central-clip="flow" data-subject-ref={location.ref} data-flow-state={state ?? ''}>
    <header className="inhabitant-device-head">
      <span className="inhabitant-device-mark"><KindMark kind="doc" size={12} title="central flow" /></span>
      <strong>Central · flow</strong>
      <span className="inhabitant-device-sub">{location.path}</span>
      {popOut && (popOut.popped
        ? <button type="button" className="central-popout" data-action="redock" title="Redock — bring this flow back from its own window" aria-label="Redock flow" onClick={() => deviceWindows?.redock(popOut.identity)}><PopOut size={10} /></button>
        : <button type="button" className="central-popout" data-action="pop-out" disabled={!!popOut.fault} title={popOut.fault ?? 'Pop out into its own native window'} aria-label="Pop out flow" onClick={() => deviceWindows?.popOut(popOut.identity)}><PopOut size={10} /></button>)}
    </header>
    <div className="central-flow-clip-rows" data-flow-clip-rows>
      {clip.rows.map(row => <ReadingRow key={row.key} param={row} value={clip.values[row.key]} />)}
    </div>
    <div ref={body} className="central-flow-clip-body" data-flow-clip-body>
      {popOut?.popped
        ? <p className="inhabitant-device-notice" role="status">Popped out: this flow lives in its own native window. Redock returns it here.</p>
        : <FlowFace transport={transport} location={location} />}
    </div>
  </section>
}
