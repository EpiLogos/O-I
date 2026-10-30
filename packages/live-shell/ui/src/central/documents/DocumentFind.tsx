// The find line of a document in a pane (DLW §18.4 "The line anywhere": ⌘F "in a pane … finds in the instrument in front, as VS Code's
// ⌘F finds in the file in front"). It stands over the page where VS Code's find widget stands over the editor, at the top right of the
// pane, and only while it is open: ⌘F opens it (the window's key, frame/keys/planKey.ts, through the pane's finder, frame/paneFind.ts;
// or ⌘F typed inside the page, which the page hands its host), Escape closes it and gives the page its focus back.
//
// The finding is the page's own (desktop/cradle/src/context/document-find.js, carried by every hosted document frame): this line asks
// it, by message to the pane's own frame only, and says what it answered. It reads no owner and writes nothing: the document, its
// draft and its selection stay as they are. Its words and keys are VS Code's find widget's (documentFindModel.ts).
import {useCallback, useEffect, useRef, useState, type RefObject} from 'react'
import {registerPaneFinder} from '../../frame/paneFind'
import {findKeyOf, findWords, pageFindMessage, type FindAnswer} from './documentFindModel'
import './documentFind.css'

/** The pane's document frame: the one hosted page this pane presents. */
const frameIn = (host: HTMLElement | null) => host?.querySelector<HTMLIFrameElement>('iframe.inhabitant-document-frame') ?? null

export function DocumentFind({paneId, host}: {paneId?: string; host: RefObject<HTMLElement | null>}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<FindAnswer | null>(null)
  /** No page is drawn in the pane yet to find in (it is still being read, or the owner refused it). */
  const [absent, setAbsent] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const asked = useRef(0)
  const now = useRef({open, query})
  now.current = {open, query}

  const ask = useCallback((op: 'open' | 'find' | 'next' | 'previous' | 'close', words?: string): boolean => {
    const target = frameIn(host.current)?.contentWindow
    setAbsent(!target)
    if (!target) return false
    target.postMessage({type: 'oi:document-find', request: `${op}:${++asked.current}`, op, ...(words === undefined ? {} : {query: words})}, '*')
    return true
  }, [host])

  /** Stand the line open on words: the page's one-line selection, else the words it last found (VS Code keeps the last search). */
  const show = useCallback((seed: string) => {
    const words = seed || now.current.query
    setOpen(true)
    setQuery(words)
    setAnswer(null)
    ask('find', words)
    requestAnimationFrame(() => { input.current?.focus(); input.current?.select() })
  }, [ask])

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    setAnswer(null)
    ask('close')
    if (refocus) frameIn(host.current)?.focus()
  }, [ask, host])

  // The window's ⌘F: the page is asked for its selection first, and answers with it (the `open` answer carries the seed).
  const openFromWindow = useCallback(() => {
    if (!ask('open')) { setOpen(true); requestAnimationFrame(() => input.current?.focus()) }
  }, [ask])
  const opener = useRef(openFromWindow)
  opener.current = openFromWindow
  useEffect(() => (paneId ? registerPaneFinder(paneId, {open: () => opener.current()}) : undefined), [paneId])

  // The page's answers, and the keys typed inside it — from this pane's own frame only.
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const frame = frameIn(host.current)
      if (!frame || event.source !== frame.contentWindow) return
      const message = pageFindMessage(event.data)
      if (!message) return
      // A new page stands in the frame (a Re-read replaced the old one) while the line is open: ask it the line's words again, so its
      // matches are marked and counted as they were on the page it replaced.
      if (message.kind === 'ready') { if (now.current.open && now.current.query) { setAnswer(null); ask('find', now.current.query) } return }
      if (message.kind === 'key') { if (message.key === 'open') show(message.seed); else if (now.current.open) close(false); return }
      if (message.seed !== undefined) { show(message.seed); return }
      if (now.current.open) setAnswer(message.answer)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [host, show, close, ask])

  if (!open) return null
  const count = absent ? 'No page to find in yet' : findWords(query, answer)
  // Over the page, as VS Code's widget stands over the text: below the document's own head (its state, Save and Re-read stay in reach).
  const frame = frameIn(host.current), box = host.current?.getBoundingClientRect()
  const top = frame && box ? Math.max(6, Math.round(frame.getBoundingClientRect().top - box.top + 6)) : 6
  return <div className="document-find" role="search" aria-label="Find in the page" data-document-find data-claims-keys="escape" style={{top}}
    data-unmarked={answer && answer.marked === false ? 'true' : undefined}>
    <input ref={input} type="text" value={query} placeholder="Find" aria-label="Find" spellCheck={false} autoComplete="off"
      data-i="Find|Finds the words in the page in front as you type: Enter goes to the next, ⇧Enter to the previous, Escape closes."
      onChange={event => { setQuery(event.target.value); setAnswer(null); ask('find', event.target.value) }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        const key = findKeyOf(event)
        if (!key) return
        event.preventDefault(); event.stopPropagation()
        if (key === 'next' || key === 'previous') ask(key)
        else if (key === 'select') input.current?.select()
        else close(true)
      }} />
    <span className="document-find-count" role="status" aria-live="polite" data-find-count>{count}</span>
    <button type="button" aria-label="Previous Match (⇧Enter)" title="Previous Match (⇧Enter)" disabled={!answer?.count} onClick={() => ask('previous')}
      data-i="Previous Match|Goes to the match before the one in front (⇧Enter, ⇧⌘G).">↑</button>
    <button type="button" aria-label="Next Match (Enter)" title="Next Match (Enter)" disabled={!answer?.count} onClick={() => ask('next')}
      data-i="Next Match|Goes to the match after the one in front (Enter, ⌘G).">↓</button>
    <button type="button" aria-label="Close (Escape)" title="Close (Escape)" onClick={() => close(true)}
      data-i="Close|Closes the find and gives the page its focus back (Escape).">×</button>
  </div>
}
