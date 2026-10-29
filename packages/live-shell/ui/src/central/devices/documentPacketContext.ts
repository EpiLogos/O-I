// The document's packet put into AIKit's prepared context before a Send (DLW §18.3 "The packet is exactly what the agent receives. You
// see it whole, and its size, before anything is sent"; §18.9 Rules, "the same items appear everywhere"; lane AA's proposal, O-I #745).
// While a document holds a packet (the Flow's island, what To packet put there — documentDoor.ts DocumentInPane.packet), the Packet
// device, the transport's Key and the Packet widget read that packet; the Agent conversation's Send carries AIKit's prepared context
// (encounter/session.ts send: prompt-context with the reviewed context). So before the Send reads it, the prepared context is brought to
// the document's packet through the owner's own edit (op encounter context edit: remove what the packet does not hold, add what it holds
// and the context does not), and the Send carries exactly what the Packet shows.
//
// It runs where the Send already asks for it: a context provider (desktop/cradle/src/context/nativeContext.ts registerContextProvider,
// "Contributors that bring the prepared context up to date just before a turn reads it … they never send"), registered while a Flow face
// stands in a pane (inhabitants/DocumentFlowFace.tsx). Each item it adds is the packet's own snapshot, which the person sees whole in the
// Packet before they send: it is approved as that captured snapshot (approveCapturedSnapshot), as the Context plane's "Use this exact
// captured snapshot" approves one, so the Send's review takes it.
import {announceContext, approveCapturedSnapshot, nativeContext, registerContextProvider, type ContextProvider, type PreparedContext, type SelectionSnapshot} from '../../../../../../desktop/cradle/src/context/nativeContext'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {reachedDocument, type DocumentInPane} from '../documents/documentDoor'
import type {PagePacketItem} from './pageReadings'

/** Who an item of the document's packet is from, as AIKit's prepared context names an item's owner. */
export const DOCUMENT_PACKET_OWNER = 'oi.document-packet'

/** The document a packet is read from, as its face publishes it. */
export type PacketDocument = Pick<DocumentInPane, 'form' | 'title' | 'revision' | 'dirty' | 'packet'> & {readonly location: CentralLocation}

const bounded = (text: string, most: number) => (text.length <= most ? text : text.slice(text.length - most))
const projectOf = (path: string): string | null => /^Work\/([^/]+)\//.exec(path)?.[1] ?? null

/** One item of the document's packet as the selection AIKit's prepared context keeps (aikit-store encounter_context.rs ContextSelection):
 * the document's own ref and revision, whether it is a working copy, the item's words, and where in the page's packet it stands — an
 * observation of the page's island (`packet[at]`), since the packet names no character range of the file. Pure. */
export function packetSelectionOf(document: PacketDocument, item: PagePacketItem, at: number, now: Date = new Date()): SelectionSnapshot {
  const {location} = document
  return {
    source_ref: location.ref, source_revision: document.revision ?? null, source_project: projectOf(location.path),
    title: item.label ? `${document.title || document.form} · ${item.label}` : document.title || document.form,
    owner: DOCUMENT_PACKET_OWNER, binding_id: location.ref, text: item.text, working_copy: document.dirty === true, captured_at: now.toISOString(),
    anchor: {kind: 'observation', document_id: bounded(location.path, 256), key: `packet:${at}`, selector: `#ql-doc packet[${at}]`, role: bounded(item.scope || 'item', 128),
      node_ref: location.path, url: null},
  }
}

/** Whether two selections are the same item, as AIKit tells one from another (encounter_context.rs ContextSelection::identity: the source,
 * its revision and project, the anchor, the words, the working copy) — its title and capture time aside. Pure. */
export function sameSelection(a: SelectionSnapshot, b: SelectionSnapshot): boolean {
  const identity = (s: SelectionSnapshot) => JSON.stringify([s.source_ref, s.source_revision ?? null, s.source_project ?? null, s.anchor, s.text, s.working_copy])
  return identity(a) === identity(b)
}

/** What the prepared context needs to hold the document's packet: the items to take out (by id) and the selections to add, in the
 * packet's order. An item with no words is no selection AIKit keeps, and is left out. Pure. */
export function packetEdits(context: Pick<PreparedContext, 'items'>, wanted: readonly SelectionSnapshot[]): {remove: string[]; add: SelectionSnapshot[]} {
  return {
    remove: context.items.filter(item => !wanted.some(selection => sameSelection(selection, item.selection))).map(item => item.id),
    add: wanted.filter(selection => !context.items.some(item => sameSelection(selection, item.selection))),
  }
}

/** Bring the prepared context of `project`/`session` to the document's packet through the owner's edits, each made at the revision the
 * owner last answered, and approve each item as the snapshot the Packet shows. Returns the context as the owner now holds it. Throws the
 * owner's refusal (a stale basis, a full packet) in its words. */
export async function prepareDocumentPacket(transport: KernelTransportStatus, project: string, session: string | undefined, document: PacketDocument,
  now: Date = new Date()): Promise<PreparedContext> {
  const wanted = (document.packet ?? []).flatMap((item, at) => (item.text.trim() ? [packetSelectionOf(document, item, at, now)] : []))
  let context = await nativeContext(transport, project, session, {operation: 'read'})
  const {remove, add} = packetEdits(context, wanted)
  for (const id of remove) context = await nativeContext(transport, project, session, {operation: 'edit', basis: context.revision, mutation: {operation: 'remove', id}})
  for (const selection of add) context = await nativeContext(transport, project, session, {operation: 'edit', basis: context.revision, mutation: {operation: 'add', selection}})
  for (const item of context.items) approveCapturedSnapshot(context, item)
  if (remove.length || add.length) announceContext(project, context)
  return context
}

/** The provider the Send runs before it reads the prepared context: while the document the hand reached holds a packet, the context is
 * brought to it. A hosted world's conversation (`sourceWorldRef`) is another world's, and is left as it is. */
export const documentPacketProvider: ContextProvider = async ({transport, project, session, sourceWorldRef}) => {
  if (sourceWorldRef) return
  const document = reachedDocument()
  if (!document?.packet || !document.location) return
  await prepareDocumentPacket(transport, project, session, {...document, location: document.location})
}

let followers = 0
let withdraw: (() => void) | null = null
/** A face that holds a packet stands: the provider is registered while one does. Returns its leaving. */
export function followDocumentPacket(): () => void {
  if (followers++ === 0) withdraw = registerContextProvider(documentPacketProvider)
  let left = false
  return () => {
    if (left) return
    left = true
    if (--followers === 0) { withdraw?.(); withdraw = null }
  }
}
