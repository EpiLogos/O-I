// The shell's toast (world-shell-mockup.html .toast :437-438, toast() :1942): one line over the frame, 110px from the window's top
// and centred, that says an act landed ("Landed as claim · wiki r42") and fades after 2.6s. It takes no press (pointer-events none)
// and holds no act: what it says is what an owner answered, never a guess that something worked. A new toast replaces the one
// showing. Any part of the shell calls `showToast`; App.tsx mounts the one host. With no host, a toast is dropped (it is never the
// only record of an act: the owner's readback is).
import {useEffect, useState, useSyncExternalStore, type ReactNode} from 'react'

/** How long a toast stands (the mockup's 2600ms). */
export const TOAST_MS = 2600

interface Toast { readonly id: number; readonly content: ReactNode }

let shown: Toast | null = null
let next = 0
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const read = () => shown

/** Say an act landed. Bold the landing's name (<b>claim</b>), as the mockup does. */
export function showToast(content: ReactNode): void {
  shown = {id: ++next, content}
  for (const listener of listeners) listener()
}

/** The one host (App.tsx). */
export function ShellToastHost() {
  const toast = useSyncExternalStore(subscribe, read, read)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!toast) return
    setOn(true)
    const timer = setTimeout(() => setOn(false), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])
  return <ShellToastView on={on}>{toast?.content}</ShellToastView>
}

/** Presentation: the mockup's .toast, shown while `on`. */
export function ShellToastView({on, children}: {on: boolean; children?: ReactNode}) {
  return <div className={on ? 'shell-toast on' : 'shell-toast'} role="status" aria-live="polite" data-region="shell-toast">{children}</div>
}
