// The search line's host (DLW §18.4; O-I #820), mounted once by the frame (App.tsx). It draws nothing until the line is asked for; then
// the line itself (central/searchLine.tsx), whose code loads the first time it opens — never with the first frame
// (tests/first-load-budget.test.mjs LOADS_LATER). While it is mounted the frame's ⌘K reaches the line (frame/keys/FrameKeys.tsx,
// searchLineDoor.ts registerSearchLineHost), and an @ typed in a composer that declares it (`data-at-search`: the agent's composer,
// desktop/cradle/src/agent/chat/ChatComposer.tsx) opens the line at the caret. A Flow's entry asks through its own host
// (inhabitants/DocumentFlowFace.tsx), its form being in a frame of its own. Once the line has closed, an owner's answer that came
// after it (a send's receipt, an open AIKit did not count) is said on one line, as the window's keys say theirs (FrameKeys.tsx).
import {useEffect, useSyncExternalStore} from 'react'
import {loadWhenDrawn} from '../shell/loadWhenDrawn'
import {KeyReceiptLine} from '../frame/keys/FrameKeys'
import {atKeyOf, captureFocus, lineReceipt, openSearchLine, registerSearchLineHost, searchLineNow, searchLineVersion, showLineReceipt, subscribeSearchLine} from './searchLineDoor'

const SearchLine = loadWhenDrawn('The search line', () => import('./searchLine').then(module => module.SearchLine))

/** A composer's @: the line opens at the caret once the @ has landed in the field (or, with a passage selected, without it). Heard as the
 * press bubbles to the document, after the composer's own handlers: a composer that refuses the key (the agent layer's receiver guard,
 * desktop/cradle/src/agent/AgentLayer.tsx `guard`, while its conversation is not current) has stopped it, and the line does not open. */
function useComposerAt(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onKey = (event: KeyboardEvent) => {
      const field = event.target
      if (event.defaultPrevented || !(field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement)) return
      const asked = atKeyOf(event, field)
      if (!asked) return
      if (asked.hold) event.preventDefault()
      // After this press has done what it does (the @ typed, or held), so the caret the line puts back is the one after it.
      window.setTimeout(() => {
        const box = field.getBoundingClientRect()
        openSearchLine({...asked.request, at: {x: box.left, y: box.top}, restore: captureFocus()})
      }, 0)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}

export function SearchLineHost() {
  useSyncExternalStore(subscribeSearchLine, searchLineVersion, searchLineVersion)
  useEffect(() => registerSearchLineHost(), [])
  useComposerAt()
  const request = searchLineNow()
  const receipt = lineReceipt()
  if (request) return <SearchLine request={request} />
  return receipt ? <div className="search-line-receipt"><KeyReceiptLine receipt={receipt} onDismiss={() => showLineReceipt(null)} /></div> : null
}
