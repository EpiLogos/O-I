import {useCallback, useContext, useEffect, useRef, useState} from 'react'

/** A Being's or a Thing's page in its own pane (T-WORLDS W2: "Beings and Things open as panes with a hosted face like DocumentFlowFace,
 * publishing Save state to documentDoor"; manual §18.1 "The clip").
 *
 * Over the existing paths, as the Flow's face (DocumentFlowFace.tsx) is:
 * - the page is read through Central's file route (`readFile`); it is its own file in its world's folder, never copied into a store;
 * - the body is the sandboxed frame carrying the page with the observation and document-host scripts; the only host↔frame traffic is
 *   the bounded island read (`useDocumentHostRead`) and the page's own link message (below);
 * - the page is drawn by the current template from its own island (personal/page.mjs readPage → renderPage), never by the script the
 *   file was copied with: a page made from an older template carries an older runtime, which never shows what the page owner writes
 *   into the island (r14: a title written from Clip view stood in the island while the page still drew its placeholder). Save splices
 *   only the island back over the file, so the file's other bytes stay as they are. A file that is no page is hosted as it is;
 * - Save is the document host's revision-checked save (`document/hostSave.ts saveDocumentPayload`): the island the frame holds, spliced
 *   over the saved source; a page in a project's human ground goes through the source owner's own CAS, any other through the file
 *   owner's. A basis that moved before the write is `stale`, a write the owner refuses keeps the draft and says why;
 * - a link the page opens ("In relation") is sent to its host, which opens it in the shell: a page of a world opens as its page, an
 *   http(s) address in a web pane. The sandbox grants the page no popups, so without its host a link does nothing.
 *
 * The page's own internal Save keeps its meaning (a portable HTML copy inside the sandbox); only the head's Save writes to the owner. */
import {readFile} from '../../../../../desktop/cradle/src/files/client'
import {saveDocumentPayload, type DocumentSaveOutcome} from '../../../../../desktop/cradle/src/document/hostSave'
import {documentScripts, useDocumentFrame, useDocumentHostRead, type FrameIsland} from '../../../../../desktop/cradle/src/document/frame'
import {readDocumentIdentity} from '../../../../../desktop/cradle/src/document/identity'
import {readPage, renderPage} from '../../../../../desktop/cradle/src/personal/page.mjs'
import type {CentralLocation, KernelTransportStatus, NativeFileReading} from '../../../../../desktop/cradle/src/kernel/types'
import {DocumentPaneContext, documentStateWords, publishDocument, reachedDocument, revisionShort, withdrawDocument, type DocumentInPane} from '../central/documents/documentDoor'
import {classifySaveFailure, savedOutcome, unchangedOutcome, type SaveRouterReading} from './documentDeviceModel'
import './inhabitantDevices.css'

/** The message a page sends its host when a link in it is followed (the page templates' runtime: oi-beings.html, oi-things.html, and
 * the Day's and the Flow's forms, ql-daily-die.html and ql-flow.html). */
export const PAGE_LINK_MESSAGE = 'oi:page-link'

/** Where a followed link opens in the shell: a page of a world, by its path, or an http(s) address, in the Web widget. */
export type PageLinkTarget = {kind: 'page'; path: string} | {kind: 'web'; url: string}

/** Where a followed link goes in the shell: a page of a world by its path, an http(s) address, or nowhere (said why). Pure. */
export function linkTarget(href: unknown): PageLinkTarget | {kind: 'none'; why: string} {
  if (typeof href !== 'string' || !href.trim()) return {kind: 'none', why: 'The link names no address.'}
  const value = href.trim()
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      if (url.username || url.password) return {kind: 'none', why: 'A link with credentials in it is not opened.'}
      return {kind: 'web', url: url.toString()}
    } catch { return {kind: 'none', why: `${value} is not an address the web pane opens.`} }
  }
  const path = value.replace(/^central:path:[^:]*:/, '').replace(/^\.?\//, '')
  if (/^(?:Control\/user\/flows\/[^/]+|Work\/[^/]+\/ProjectCentral\/user\/(?:[^/]+\/)*[^/]+)\.html$/i.test(path)) return {kind: 'page', path}
  return {kind: 'none', why: `${value} is neither a page of a world nor an http(s) address.`}
}

/** The page as the current template draws it from its own island; a file that does not read as a page is kept as it is. */
export function currentPage(html: string): string {
  try { return renderPage(readPage(html)) } catch { return html }
}

/** The hosted copy: the observation and document-host scripts, injected as the cradle's hosting surfaces do. */
function projectPage(html: string): string {
  return /<head>/i.test(html) ? html.replace(/<head>/i, `<head>${documentScripts}`) : `${documentScripts}${html}`
}

const outcomeReading = (outcome: DocumentSaveOutcome): SaveRouterReading => outcome.state === 'saved' ? savedOutcome(outcome.revision ? `revision ${outcome.revision}` : 'saved')
  : outcome.state === 'unchanged' ? unchangedOutcome() : classifySaveFailure(outcome.detail ?? outcome.state)

export interface DocumentPageFaceProps {
  readonly transport: KernelTransportStatus
  readonly location: CentralLocation
  readonly kind: 'being' | 'thing'
  /** Open a followed link in the shell (the pane host gives it: a page in a pane, an address in a web pane). */
  readonly openLink?: (target: PageLinkTarget) => void
}

export function PageFace({transport, location, kind, openLink}: DocumentPageFaceProps) {
  const [reading, setReading] = useState<NativeFileReading>()
  const [face, setFace] = useState<string>()
  const [failure, setFailure] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)
  const [save, setSave] = useState<SaveRouterReading>()
  const frame = useRef<HTMLIFrameElement>(null)
  const frameProps = useDocumentFrame(frame, face, transport)
  const readIsland = useDocumentHostRead(frame, true)
  const baseline = useRef<string>()
  const form = kind === 'being' ? 'Being' : 'Thing'

  const load = useCallback(async () => {
    setFailure(undefined)
    try {
      const read = await readFile(transport, location)
      setReading(read)
      setFace(projectPage(currentPage(read.content)))
    } catch (error) { setFailure(String(error)) }
  }, [location, transport])
  useEffect(() => { void load() }, [load])

  const island = useCallback(async (): Promise<string> => {
    const value: FrameIsland | null = await readIsland()
    if (!value || typeof value.text !== 'string') throw new Error('The page\'s island did not answer the bounded read; nothing was sent')
    return value.text
  }, [readIsland])

  const saveToOwner = useCallback(async () => {
    if (!reading) return
    const identity = readDocumentIdentity(reading.content)
    if (!identity) { setSave(classifySaveFailure('The page names no document identity, so the owner keeps no save of it here.')); return }
    setPending(true); setNotice(undefined)
    try {
      const text = await island()
      if (baseline.current !== undefined && text === baseline.current) { setSave(unchangedOutcome()); setDirty(false); return }
      const result = await saveDocumentPayload(transport, {location: reading.location ?? location, project: reading.project?.name ?? undefined, identity,
        basisFileRevision: reading.revision, frameIslandText: text})
      setSave(outcomeReading(result.outcome))
      if (result.outcome.state === 'saved' || result.outcome.state === 'unchanged') {
        setDirty(false); baseline.current = undefined; await load()
      } else if (result.outcome.state === 'stale' || result.outcome.state === 'conflict') {
        setNotice('The page moved behind this draft. Re-read to see it; your edits stay in the pane until you do — nothing was overwritten.')
      }
    } catch (error) {
      setSave(classifySaveFailure(error))
    } finally { setPending(false) }
  }, [island, load, location, reading, transport])

  const reread = useCallback(() => { baseline.current = undefined; setDirty(false); setSave(undefined); void load() }, [load])

  // The draft fact: the island as first read is the baseline; a later read that differs is a draft. Absence of an answer is not one.
  useEffect(() => {
    if (!face) return
    const timer = window.setInterval(() => {
      if (pending) return
      void island().then(text => {
        if (baseline.current === undefined) baseline.current = text
        else if (text !== baseline.current) setDirty(true)
      }, () => undefined)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [face, island, pending])

  // A link the page follows reaches its host as a message from this frame only; the host opens it in the shell, or says why not.
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || (event.data as {type?: unknown})?.type !== PAGE_LINK_MESSAGE) return
      const target = linkTarget((event.data as {href?: unknown}).href)
      if (target.kind === 'none') { setNotice(target.why); return }
      if (!openLink) { setNotice('No pane tree is mounted to open the link in.'); return }
      setNotice(undefined)
      openLink(target)
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [openLink])

  const title = (() => { try { return readDocumentIdentity(reading?.content)?.label } catch { return undefined } })() || location.path.split('/').pop()
  const key = useRef(`page:${Math.random().toString(36).slice(2)}`).current
  const paneId = useContext(DocumentPaneContext) ?? undefined
  const standing: DocumentInPane = {key, paneId, form, title: title ?? form, revision: reading?.revision,
    state: documentStateWords({pending, dirty, save}), save: face && !pending ? () => void saveToOwner() : undefined,
    reread: pending ? undefined : reread, rereadLabel: 'Re-read', location: reading?.location ?? location, dirty, ...(save ? {outcome: save.outcome} : {})}
  useEffect(() => { publishDocument(standing, !reachedDocument()) })
  useEffect(() => () => withdrawDocument(key), [key])

  return <div onPointerDownCapture={() => publishDocument(standing, true)} onFocusCapture={() => publishDocument(standing, true)}
    className="inhabitant-face-body inhabitant-document" data-document-device={`oi-${kind === 'being' ? 'beings' : 'things'}`}
    data-save-outcome={save?.outcome ?? ''} data-dirty={dirty ? 'true' : 'false'} data-basis-revision={reading?.revision ?? ''}>
    <div className="document-pane-head" data-document-head={kind}>
      <span className="document-pane-form">{form}</span>
      <span className="document-pane-state" role="status" aria-live="polite">{reading?.revision ? `r${revisionShort(reading.revision)} · ` : ''}{standing.state}</span>
      <span className="document-pane-acts">
        <button type="button" data-action="save" disabled={!standing.save} onClick={() => standing.save?.()}
          data-i={`Save to Central|The owner's revision-checked write of the ${form} as it stands in its pane.`}>Save</button>
        <button type="button" data-action="reread" disabled={!standing.reread} onClick={() => standing.reread?.()}
          data-i={`Re-read|Read the ${form} again from its owner; a draft not saved is set aside.`}>Re-read</button>
      </span>
    </div>
    {failure && <p className="inhabitant-device-fault" role="alert">{form} page unavailable: {failure}</p>}
    {notice && <p className="inhabitant-device-notice" role="status">{notice}</p>}
    {face === undefined || !frameProps
      ? <p role="status" className="inhabitant-quiet">Reading the {form} page…</p>
      : <iframe key={frameProps.key} ref={frame} className="inhabitant-document-frame" title={`${form} · ${title ?? ''}`} sandbox="allow-scripts allow-forms allow-downloads"
          referrerPolicy="no-referrer" src={frameProps.src} srcDoc={frameProps.srcDoc} />}
  </div>
}
