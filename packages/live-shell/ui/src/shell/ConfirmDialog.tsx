// The shell's confirm dialog (world-shell-mockup.html .scrim/.dlg, :432-436, dialog() :1943): before an act that cannot be taken back,
// one window over the frame says what the act does and what it does not, with Cancel and the act's own word. The window is the
// mockup's: 460px, a 28px head on the raised ground, the body in 11.5px dim words with the thing named in bold, Cancel and the
// primary at its foot. One stands at a time; a second ask waits for the first to be answered. Escape or a press on the scrim
// cancels; the focus starts on Cancel, so a stray Enter takes nothing.
//
// Any part of the shell asks with `askConfirm` and acts on the answer; App.tsx mounts the one host. Where no host stands (a
// detached window, a test), the ask falls back to the platform's confirm with the same words, so an act is never taken unasked.
import {useEffect, useRef, useSyncExternalStore, type ReactNode} from 'react'

export interface ConfirmAsk {
  /** The head: what is about to happen ("Reset the field"). */
  readonly title: string
  /** What crosses and what does not; bold the thing acted on. */
  readonly body: ReactNode
  /** The primary's word ("Reset field"): the act, never "OK". */
  readonly ok: string
  /** The body as plain words, for the platform's confirm where no host stands. Defaults to the title. */
  readonly plain?: string
}

interface Pending extends ConfirmAsk { readonly answer: (yes: boolean) => void }

let queue: readonly Pending[] = []
let hosts = 0
const listeners = new Set<() => void>()
const publish = (next: readonly Pending[]) => { queue = next; for (const listener of listeners) listener() }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const current = () => queue[0] ?? null

/** Ask before an act that cannot be taken back: resolves true when the person presses the act's word, false on Cancel. */
export function askConfirm(ask: ConfirmAsk): Promise<boolean> {
  if (hosts === 0) {
    const words = ask.plain ? `${ask.title}\n\n${ask.plain}` : ask.title
    return Promise.resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(words) : false)
  }
  return new Promise(resolve => {
    const pending: Pending = {...ask, answer: yes => { publish(queue.filter(item => item !== pending)); resolve(yes) }}
    publish([...queue, pending])
  })
}

/** The one host (App.tsx): draws the ask at the head of the queue. */
export function ConfirmDialogHost() {
  useEffect(() => { hosts += 1; return () => { hosts -= 1 } }, [])
  const ask = useSyncExternalStore(subscribe, current, current)
  return ask ? <ConfirmDialogView key={ask.title + ask.ok} ask={ask} onAnswer={ask.answer} /> : null
}

/** Presentation: the scrim and the window, as the mockup draws them. */
export function ConfirmDialogView({ask, onAnswer}: {ask: ConfirmAsk; onAnswer: (yes: boolean) => void}) {
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    cancel.current?.focus()
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onAnswer(false) } }
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('keydown', key, true); before?.focus?.() }
  }, [onAnswer])
  return <div className="shell-scrim" data-region="confirm-dialog" onMouseDown={event => { if (event.target === event.currentTarget) onAnswer(false) }}>
    <div className="shell-dlg" role="alertdialog" aria-modal="true" aria-labelledby="shell-dlg-head" aria-describedby="shell-dlg-body">
      <div className="shell-dlg-head" id="shell-dlg-head">{ask.title}</div>
      <div className="shell-dlg-body" id="shell-dlg-body">{ask.body}</div>
      <div className="shell-dlg-foot">
        <button type="button" ref={cancel} className="shell-bt" data-dlg="no" onClick={() => onAnswer(false)}>Cancel</button>
        <button type="button" className="shell-bt shell-bt-pri" data-dlg="ok" onClick={() => onAnswer(true)}>{ask.ok}</button>
      </div>
    </div>
  </div>
}
