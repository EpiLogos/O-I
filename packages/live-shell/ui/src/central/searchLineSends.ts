// The search line's sends to a person, a place and another document (DLW §18.4 What a tag sends; O-I #820), each through its own
// owner, the kernel carrying the request and the owner's answer, nothing more. Loaded with the line when it first sends
// (central/searchLine.tsx); a Flow's entry and an agent's turn are sent through their owners there.
//   - a person: the Shared Field client's `message` (shared-field/spacetimedb/field.ts) through the kernel's shared_field op
//     (desktop/cradle/kernel/src/shared_field.rs, which passes the request to the client and names its refusal): a Contact request from
//     your Participant in their field, the passage and where it came from in its requested scope. It waits until they accept it;
//   - a place: Central's `central.place.file-passage` through the kernel's invoke_action — the passage kept word for word in that
//     world's ground with the link back, a proposal that stays unrecognised until you recognise it;
//   - another document: the kernel's page op, `append_quote` (desktop/cradle/kernel/src/page.rs): the document read now and the quote
//     added at its end with the link back — a page's last section, a Markdown or text file's quoted block — written on that revision.
// Each refusal is the owner's words, thrown; nothing here retries or falls back.
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {listFiles} from '../../../../../desktop/cradle/src/files/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {LinePassage} from './searchLineDoor'

/** Central's act that files a passage on a place of your world. */
export const FILE_PASSAGE_ACTION = 'central.place.file-passage'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined)

/** The passage as each owner takes it: its words, where it came from, and the page it came from. */
const quoteOf = (passage: LinePassage) => ({text: passage.text, from: passage.from, ...(passage.path ? {path: passage.path} : {})})

/** What the Shared Field answered a message: the request it stands as, in whose field, and its state (pending until accepted). */
export interface MessageReceipt {readonly contactRef: string; readonly fieldRef: string; readonly state: string}

/** Send a person the passage and where it came from (the Shared Field's `message`). Throws the owner's refusal, or its absence. */
export async function messagePerson(transport: KernelTransportStatus, participantRef: string, passage: LinePassage): Promise<MessageReceipt> {
  const response = await kernelOp(transport, {op: 'shared_field', request: {kind: 'message', to_participant_ref: participantRef, passage: quoteOf(passage)}})
  if (response.error || response.outcome?.result !== 'shared_field_reading') throw new Error(response.error ?? 'The Shared Field gave no answer to the message.')
  const data = response.outcome.data
  if (isObj(data) && data.state === 'unavailable') throw new Error(`The Shared Field is unavailable: ${str(data.detail) ?? 'it gave no reason'}`)
  if (!isObj(data) || data.schema !== 'oi.shared-field.message-result/v1' || !str(data.contact_ref)) throw new Error('The Shared Field answered the message with no request it stands as.')
  return {contactRef: String(data.contact_ref), fieldRef: str(data.field_ref) ?? '', state: str(data.state) ?? 'pending'}
}

/** What Central answered a filing: filed, or unchanged when the same passage from the same page stood there already, and where. */
export interface FilingReceipt {readonly outcome: string; readonly path: string}

/** File the passage on a place of your world (`control:root` or `project:<Name>`). Throws Central's refusal in its words. */
export async function filePassage(transport: KernelTransportStatus, place: string, passage: LinePassage): Promise<FilingReceipt> {
  const input = {place, passage: passage.text.trim(), source: {title: passage.from, ...(passage.path ? {path: passage.path} : {})}}
  const response = await kernelOp(transport, {op: 'invoke_action', invocation: {action: FILE_PASSAGE_ACTION, target_ref: place, input}})
  if (response.outcome?.result !== 'action_dispatched') throw new Error(response.error ?? 'The kernel returned no dispatch outcome.')
  const dispatch = response.outcome.dispatch
  if (dispatch.state !== 'invoked') {
    const said = 'message' in dispatch ? dispatch.message : 'detail' in dispatch ? dispatch.detail : dispatch.state
    throw new Error(`Central did not file it: ${said}`)
  }
  const data = isObj(dispatch.data) ? dispatch.data : {}
  return {outcome: str(data.outcome) ?? 'filed', path: str(data.source_path) ?? ''}
}

/** What the page owner answered a quote: written (or unchanged), and the revision the document now stands on. */
export interface QuoteReceipt {readonly outcome: string; readonly revision: string}

/** Quote the passage at the end of the document at `path` (a Central path), through the page owner. The document is found in its
 * folder's listing, read fresh, as the line opens a page of a world (CentralDocumentPane.tsx openPageLink). */
export async function quoteAtEnd(transport: KernelTransportStatus, path: string, passage: LinePassage): Promise<QuoteReceipt> {
  const cut = path.lastIndexOf('/')
  const folder = path.slice(0, cut), name = path.slice(cut + 1)
  const listing = await listFiles(transport, folder, true)
  const entry = listing.entries.find(item => item.kind === 'file' && item.name === name)
  if (!entry) throw new Error(`The owner lists no ${name} in ${folder}.`)
  const response = await kernelOp(transport, {op: 'page', request: {operation: 'append_quote', location: entry.location, quote: quoteOf(passage)}})
  if (response.error || response.outcome?.result !== 'page_reading') throw new Error(response.error ?? 'The page owner gave no answer to the quote.')
  const data = isObj(response.outcome.data) ? response.outcome.data : {}
  return {outcome: str(data.outcome) ?? 'written', revision: str(data.revision) ?? ''}
}
