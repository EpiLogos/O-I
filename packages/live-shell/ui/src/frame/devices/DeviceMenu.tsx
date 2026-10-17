// A device head's context menu (manual §16.4: "Right-click the head for Fold, Rename, Group, Save as preset, Hot-swap, Show
// automation and Map"). Ported from the workbench's context menu (desktop/cradle/src/surface/ContextMenu.tsx:66-160: the given
// entries only, a disabled entry shown disabled as an honest no, the first live entry focused, the menu held inside the window, ↑ ↓
// Home End move, Esc and leaving the window close it), with the device's name for its subject and each disabled entry's reason on the
// status bar's Info line (data-i), as the shell says every reason.
//
// Fold is the host's own (deviceHost.tsx keeps the fold per device, so every chain place folds together); it acts where the device
// stands on its chain. The other acts are its chain's owner's: the publisher hands each one it carries (deviceDoor.ts
// PublishedDevice.acts); one no owner carries stands disabled with the operation it waits for.
import {useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent} from 'react'
import type {HeadAct} from './deviceDoor'
import './devices.css'

export interface HeadMenuItem {
  readonly id: 'fold' | HeadAct
  readonly title: string
  readonly enabled: boolean
  /** Why the entry stands disabled, in the owner's terms. */
  readonly why?: string
}

const ACTS: readonly {id: HeadAct; title: string}[] = [
  {id: 'rename', title: 'Rename'}, {id: 'group', title: 'Group'}, {id: 'save-preset', title: 'Save as preset'},
  {id: 'hot-swap', title: 'Hot-swap'}, {id: 'show-automation', title: 'Show automation'}, {id: 'map', title: 'Map'},
]

/** The operation each act waits for, and whose it is, while no owner carries it (the lead's list to build: owner, op). */
export const MISSING_OPS: Readonly<Record<HeadAct, string>> = {
  rename: 'chain.device.rename (the chain\'s owner)',
  group: 'chain.devices.group (the chain\'s owner)',
  'save-preset': 'device.preset.save (the device\'s owner)',
  'hot-swap': 'chain.device.replace (the chain\'s owner), with the browser\'s hot-swap target (shell.browser.hotSwap)',
  'show-automation': 'shell.arrangement.showAutomation (the shell\'s automation lanes)',
  map: 'shell.map.device (the shell\'s key and MIDI map; Live\'s own stands in live/midiMap)',
}

/** The entries of a device head's menu: Fold (Unfold while folded) where the device stands on its chain, then its owner's acts —
 * live where its publisher carries one, else disabled with the operation it waits for. Pure. */
export function headMenu({onChain, folded, acts}: {readonly onChain: boolean; readonly folded: boolean; readonly acts?: Partial<Readonly<Record<HeadAct, unknown>>>}): HeadMenuItem[] {
  const fold: HeadMenuItem = onChain
    ? {id: 'fold', title: folded ? 'Unfold' : 'Fold', enabled: true}
    : {id: 'fold', title: 'Fold', enabled: false, why: 'A device folds where it stands on its chain.'}
  return [fold, ...ACTS.map(({id, title}): HeadMenuItem => (acts?.[id]
    ? {id, title, enabled: true}
    : {id, title, enabled: false, why: `No owner operation carries it yet — missing op: ${MISSING_OPS[id]}.`}))]
}

export interface DeviceMenuState {
  readonly x: number
  readonly y: number
  readonly subject: string
  readonly items: readonly HeadMenuItem[]
}

export function DeviceMenu({menu, onInvoke, onClose}: {menu: DeviceMenuState; onInvoke: (id: HeadMenuItem['id']) => void; onClose: () => void}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const first = element.querySelector<HTMLElement>('.device-menu-item:not([disabled])')
    if (first) first.focus(); else element.focus()
    const box = element.getBoundingClientRect()
    if (box.right > window.innerWidth) element.style.left = `${Math.max(0, window.innerWidth - box.width - 4)}px`
    if (box.bottom > window.innerHeight) element.style.top = `${Math.max(0, window.innerHeight - box.height - 4)}px`
  }, [menu.x, menu.y])
  useEffect(() => {
    // A press anywhere else, or leaving the window, ends the menu.
    const away = (event: Event) => { if (!ref.current?.contains(event.target as Node)) onClose() }
    window.addEventListener('pointerdown', away, true)
    window.addEventListener('blur', onClose)
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('blur', onClose) }
  }, [onClose])
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('.device-menu-item:not([disabled])') ?? [])
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!items.length) return
      const at = items.indexOf(document.activeElement as HTMLButtonElement)
      items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]!.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    } else if (event.key === 'Tab') {
      event.preventDefault()
    }
  }
  return <div ref={ref} className="device-menu" role="menu" aria-label={`${menu.subject}: device`} tabIndex={-1} style={{left: menu.x, top: menu.y}}
    onKeyDown={onKeyDown} onContextMenu={event => event.preventDefault()}>
    <small className="device-menu-subject">{menu.subject}</small>
    {/* A disabled entry takes no pointer (devices.css), so pointing at it reaches its row, which says why on the Info line. */}
    {menu.items.map((item, index) => <div key={item.id} role="none" data-i={item.why ? `${item.title}|${item.why}` : undefined}>
      {index === 1 && <hr />}
      <button type="button" role="menuitem" className="device-menu-item" data-device-act={item.id} disabled={!item.enabled} aria-disabled={!item.enabled}
        title={item.why} onClick={() => { onClose(); onInvoke(item.id) }}>{item.title}</button>
    </div>)}
  </div>
}
