// The window's attention — whether the person can see the shell, and the moment they come back to it. The owners' readers
// use it two ways: a floor read never runs while the window is hidden (nobody sees what it would refresh), and coming back
// to the window is a notice that anything outside the shell may have moved while they were away.
//
// The signals are the two the candidate already reads its owners again on (central/useCentralDayStanding.ts:16-19,
// central/devices/useCentralReadings.ts:40-44): `document.visibilityState` (WKWebView reports `hidden` for a minimised or
// fully occluded native window; a browser for a background tab) and the window's `focus` (the native window becoming key, or
// the tab being returned to). One installation serves every reader; the two events that arrive together on a return are one
// notice.
//
// Pure TypeScript: no view, no store.

type Listener = () => void

const listeners = new Set<Listener>()
let installed = false
let lastNotice = 0

/** A return delivers both `visibilitychange` and `focus`; within this span they are the one return. */
export const ATTENTION_COALESCE_MS = 500

/** True unless the document says it cannot be seen. Outside a document (a test, a worker) the shell counts as seen. */
export function windowVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

function notice() {
  if (!windowVisible()) return
  const at = Date.now()
  if (at - lastNotice < ATTENTION_COALESCE_MS) return
  lastNotice = at
  for (const listener of [...listeners]) listener()
}

function install() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return
  if (typeof window.addEventListener !== 'function' || typeof document.addEventListener !== 'function') return
  installed = true
  window.addEventListener('focus', notice)
  document.addEventListener('visibilitychange', notice)
}

/** Call `listener` each time the person comes back to the window (it regains focus, or becomes visible). */
export function onAttentionRegained(listener: Listener): () => void {
  install()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
