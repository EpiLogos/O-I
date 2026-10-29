// The Graph and source pane (`world.knowledge`) and the door its receiver stands behind (O-I #820). The receiver — the one listener of
// `oi:epi-open-knowledge`, which admits a native Knowledge open into the shared book and the kernel's surface — stood only as this pane's
// body, so it heard nothing until the pane had been shown once (App.tsx draws a pane's body when first shown, WhenShown): an open from
// the search line, a page's place or the Constellation went unheard. It now stands with the frame: App.tsx mounts the door below from the
// first frame, the door holds each open (panels/knowledgeDoor.ts) and loads the receiver (panels/knowledgeReceiver.tsx) the first time
// one comes, never with the first frame. The pane keeps its id and its place among the panes; the Workbench presents the surface's body,
// as before, so the pane draws nothing of its own.
import {useEffect, useState, type ComponentType} from 'react'
import {registerPanel} from '../shell/panels'
import {knowledgeDoorReceiver} from './knowledgeDoor'
import './knowledge.css'

export interface CandidateKnowledgePresentation {workspaceId: string; bindingId: string}

/** Mounted once by the frame (App.tsx): it hears every open until the receiver listens itself, and loads the receiver for the first. */
export function KnowledgeReceiverDoor() {
  const [Receiver, setReceiver] = useState<ComponentType | null>(null)
  useEffect(() => {
    const receive = knowledgeDoorReceiver(() => import('./knowledgeReceiver').then(module => { setReceiver(() => module.KnowledgeReceiver) }))
    window.addEventListener('oi:epi-open-knowledge', receive)
    return () => window.removeEventListener('oi:epi-open-knowledge', receive)
  }, [])
  return Receiver ? <Receiver /> : null
}

/** The pane's body: the receiver is the frame's (above), and the Workbench draws the surface. */
function KnowledgePane() { return null }

registerPanel({id: 'world.knowledge', title: 'Graph and source', slot: 'center', component: KnowledgePane,
  navigation: false, order: 20, note: 'The native Knowledge surface opened from a disclosed source or subject'})
