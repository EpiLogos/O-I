import {useCallback, useEffect, useRef, useState} from 'react'
import {useKernel} from '../../../../../desktop/cradle/src/kernel/KernelProvider'
import {openBinding} from '../../../../../desktop/cradle/src/surface/engine'
import {createKnowledgeBinding, sameKnowledgeDestination, validateKnowledgeOpen, type KnowledgeOpenInput} from '../native/knowledgeOpen'
import {useContinuity} from '../continuity'
import {useWorkspace} from '../shell/workspace'
import {registerPanel} from '../shell/panels'
import './knowledge.css'

export interface CandidateKnowledgePresentation {workspaceId: string; bindingId: string}
/** Native Graph/source admission uses the existing workspace book. The
 * Workbench owns presentation of its retained native body and Return family. */
export function KnowledgePanel() {
  const kernel = useKernel()
  const continuity = useContinuity()
  const workspace = useWorkspace()
  const latest = useRef({kernel, continuity, workspace})
  latest.current = {kernel, continuity, workspace}
  const generation = useRef(0)
  const alive = useRef(true)
  const [fault, setFault] = useState<string | null>(null)
  const open = useCallback(async (raw: unknown, graphOrigin?: string) => {
    const input = validateKnowledgeOpen(raw)
    const origin = latest.current
    const workspaceId = origin.continuity.current.id
    const epoch = origin.workspace.accessEpoch
    if (!origin.workspace.accessReady || !origin.workspace.nativeScope || !origin.workspace.nativeAccessCurrent(epoch)) throw Error('Native Knowledge requires the current owner access')
    const token = ++generation.current
    const target = createKnowledgeBinding(input, crypto.randomUUID())
    if (graphOrigin) target.view.graphOrigin = graphOrigin
    const held = Object.values(origin.continuity.current.layout.surfaces).find(value => sameKnowledgeDestination(value, target))
    if (held) target.id = held.id
    const current = () => alive.current && generation.current === token && latest.current.continuity.current.id === workspaceId && latest.current.continuity.mode === origin.continuity.mode && latest.current.workspace.nativeAccessCurrent(epoch)
    const outcome = await origin.kernel.apply({op: 'surface_open', surface_id: target.id, kind: 'knowledge', title: target.title})
    if (!outcome || outcome.result !== 'surface_opened') throw Error(origin.kernel.lastOpError() ?? 'The native owner refused this Knowledge surface')
    if (!current()) {
      if (!held && latest.current.workspace.nativeAccessCurrent(epoch)) await origin.kernel.apply({op: 'surface_close', surface_id: target.id})
      throw Error('The native Knowledge open belongs to a retired workspace, access or intent')
    }
    origin.continuity.setLayout(currentLayout => openBinding(currentLayout, target))
    setFault(null)
    window.dispatchEvent(new CustomEvent<CandidateKnowledgePresentation>('oi:candidate-knowledge-present', {detail: {workspaceId, bindingId: target.id}}))
  }, [])
  useEffect(() => {
    alive.current = true
    const receive = (event: Event) => {
      const raw = (event as CustomEvent<KnowledgeOpenInput>).detail
      const graphOrigin = (raw as KnowledgeOpenInput & {graphOrigin?: unknown})?.graphOrigin
      void open(raw, typeof graphOrigin === 'string' ? graphOrigin : undefined).then(() => raw?.complete?.()).catch(error => {
        const reason = error instanceof Error ? error.message : String(error)
        if (alive.current) setFault(reason)
        if (typeof raw?.complete === 'function') raw.complete(reason)
      })
    }
    window.addEventListener('oi:epi-open-knowledge', receive)
    return () => {alive.current = false; ++generation.current; window.removeEventListener('oi:epi-open-knowledge', receive)}
  }, [open])
  // This receiver admits native opens into the shared book. The Workbench
  // presents the sole native body, including its Canvas Return relation.
  return fault ? <span hidden role="alert">{fault}</span> : null
}
registerPanel({id: 'world.knowledge', title: 'Graph and source', slot: 'center', component: KnowledgePanel,
  navigation: false, order: 20, note: 'The native Knowledge surface opened from a disclosed source or subject'})
