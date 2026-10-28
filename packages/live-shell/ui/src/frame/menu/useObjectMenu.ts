// Adapted from interior.dev (github.com/ddoemonn/interior), Copyright (c) 2026 ozzy, MIT License.
//
// The object menu's behaviour (manual §10.9): opened by the right button, by the keyboard's menu key or ⇧F10 on a focused object,
// or by a long press on touch; held inside the window (it flips where it would run past an edge); ↑ ↓ Home End move, a letter
// moves to the next entry it begins (600 ms to type a word), Esc closes and gives the focus back to the object, Tab closes; a press
// outside, a scroll outside, a resize or leaving the window closes it. Ported from interior.dev's `useContextMenu` (its hook only:
// the skin is the shell's own CSS, frame/menu/objectMenu.css), with the shell's additions: a disabled entry keeps its reason (the
// Info line says it), and an entry may be a row of colours (Live's palette, inline in its clip and track menus).
import {useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent} from 'react'

/** One entry of an object's menu. */
export type ObjectMenuItem =
  | {readonly id: string; readonly type: 'separator'}
  | {readonly id: string; readonly type: 'swatches'; readonly label: string; readonly colours: readonly string[]; readonly current?: string | null
      readonly disabled?: boolean; readonly why?: string; readonly onPick?: (colour: string) => void}
  | {readonly id: string; readonly type?: 'item'; readonly label: string; readonly shortcut?: string
      /** Destructive: the entry takes something away (drawn apart from an unavailable one). */
      readonly tone?: 'neutral' | 'destructive'
      readonly disabled?: boolean
      /** Why it stands disabled, in its owner's words (or the operation it waits for). */
      readonly why?: string
      /** One of a set of ways, the one standing checked (drawn as a radio item: Open in's ways). Absent: a plain act. */
      readonly checked?: boolean
      readonly onSelect?: (id: string) => void}

export interface ObjectMenuPlacement {readonly left: number; readonly top: number; readonly width: number; readonly maxHeight: number}

const ITEM_H = 24
const SEP_H = 7
const SWATCH_H = 46
const PAD = 4

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

/** The menu's height as drawn, before it is drawn: its entries' heights. Pure. */
export function menuHeight(items: readonly ObjectMenuItem[]): number {
  let height = PAD * 2 + 2
  for (const item of items) height += item.type === 'separator' ? SEP_H : item.type === 'swatches' ? SWATCH_H : ITEM_H
  return height
}

/** Where the menu stands for a point: beside it where it fits, else flipped to the other side; never past the window's edge. Pure. */
export function placeMenu(x: number, y: number, size: {readonly width: number; readonly height: number}, view: {readonly width: number; readonly height: number},
  margin = 6): ObjectMenuPlacement {
  const width = Math.min(size.width, Math.max(140, view.width - margin * 2))
  const cap = Math.max(ITEM_H + PAD * 2, view.height - margin * 2)
  const height = Math.min(size.height, cap)
  return {
    left: clamp(x + width + margin <= view.width ? x : x - width, margin, view.width - width - margin),
    top: clamp(y + height + margin <= view.height ? y : y - height, margin, view.height - height - margin),
    width, maxHeight: cap,
  }
}

const label = (item: ObjectMenuItem) => item.type === 'separator' ? '' : item.label

/** The entries the keys step through: every entry that can be chosen. Pure. */
export function steppable(items: readonly ObjectMenuItem[]): number[] {
  return items.reduce<number[]>((at, item, index) => { if (item.type !== 'separator' && !item.disabled) at.push(index); return at }, [])
}

/** The next entry a typed word begins, after the one standing (wrapping); -1 when none does. Pure. */
export function typeaheadIndex(items: readonly ObjectMenuItem[], word: string, active: number): number {
  const order = steppable(items)
  const from = order.indexOf(active) + 1
  for (let k = 0; k < order.length; k += 1) {
    const index = order[(from + k) % order.length]!
    if (label(items[index]!).toLowerCase().startsWith(word)) return index
  }
  return -1
}

export function useObjectMenu({width = 216}: {width?: number} = {}) {
  const [items, setItems] = useState<readonly ObjectMenuItem[]>([])
  const [placement, setPlacement] = useState<ObjectMenuPlacement | null>(null)
  const [active, setActive] = useState(-1)
  const [subject, setSubject] = useState('')
  const triggerRef = useRef<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const opened = useRef(false)
  const activeRef = useRef(-1)
  activeRef.current = active
  const list = useRef(items)
  list.current = items
  const query = useRef('')
  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const steps = useMemo(() => steppable(items), [items])
  const stepsRef = useRef(steps)
  stepsRef.current = steps

  const close = useCallback((restoreFocus = false) => {
    if (!opened.current) return
    opened.current = false
    setPlacement(null)
    setActive(-1)
    if (restoreFocus) triggerRef.current?.focus({preventScroll: true})
  }, [])

  /** Open the menu at a point for an object: its entries, the words naming the object, and the element the focus returns to. */
  const openAt = useCallback((x: number, y: number, entries: readonly ObjectMenuItem[], named: string, trigger: HTMLElement | null,
    source: 'pointer' | 'keyboard' = 'pointer') => {
    if (!entries.length) return
    triggerRef.current = trigger
    const view = {width: document.documentElement.clientWidth, height: document.documentElement.clientHeight}
    opened.current = true
    setItems(entries)
    setSubject(named)
    setPlacement(placeMenu(x, y, {width, height: menuHeight(entries)}, view))
    setActive(source === 'keyboard' ? (steppable(entries)[0] ?? -1) : -1)
  }, [width])

  /** The entries read again while the menu stands (the clip's Clip view read it after the menu opened): its place and its focus stay. */
  const refresh = useCallback((entries: readonly ObjectMenuItem[]) => {
    if (opened.current && entries.length) setItems(entries)
  }, [])

  const choose = useCallback((index: number) => {
    const item = list.current[index]
    if (!item || item.type === 'separator' || item.type === 'swatches' || item.disabled) return
    close(true)
    item.onSelect?.(item.id)
  }, [close])

  const step = useCallback((dir: 1 | -1) => {
    const order = stepsRef.current
    if (!order.length) return
    const at = order.indexOf(activeRef.current)
    setActive(at === -1 ? (dir === 1 ? order[0]! : order[order.length - 1]!) : order[(at + dir + order.length) % order.length]!)
  }, [])

  const isOpen = placement !== null

  useEffect(() => {
    if (!isOpen) return
    const node = activeRef.current >= 0 ? itemRefs.current[activeRef.current] : menuRef.current
    node?.focus({preventScroll: true})
    if (activeRef.current >= 0) node?.scrollIntoView({block: 'nearest'})
  }, [isOpen, active])

  useEffect(() => {
    if (!isOpen) return
    const inside = (target: EventTarget | null) => menuRef.current?.contains(target as Node) ?? false
    const onDown = (event: PointerEvent) => { if (!inside(event.target)) close(false) }
    const onScroll = (event: Event) => { if (!inside(event.target)) close(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key !== 'Escape') return; event.preventDefault(); event.stopPropagation(); close(true) }
    const bail = () => close(false)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('scroll', onScroll, {capture: true, passive: true})
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', bail)
    window.addEventListener('blur', bail)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('scroll', onScroll, {capture: true})
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', bail)
      window.removeEventListener('blur', bail)
    }
  }, [isOpen, close])

  useEffect(() => () => { if (queryTimer.current !== null) clearTimeout(queryTimer.current) }, [])

  const menuProps = {
    role: 'menu' as const,
    tabIndex: -1,
    'aria-orientation': 'vertical' as const,
    onContextMenu: (event: ReactMouseEvent) => event.preventDefault(),
    onKeyDown: (event: ReactKeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); step(event.key === 'ArrowDown' ? 1 : -1); return }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        const order = stepsRef.current
        if (order.length) setActive(event.key === 'Home' ? order[0]! : order[order.length - 1]!)
        return
      }
      if (event.key === 'Tab') { event.preventDefault(); close(true); return }
      if (event.key === 'Enter' || event.key === ' ') {
        const item = list.current[activeRef.current]
        if (item && item.type !== 'swatches') { event.preventDefault(); choose(activeRef.current) }
        return
      }
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        query.current += event.key.toLowerCase()
        if (queryTimer.current !== null) clearTimeout(queryTimer.current)
        queryTimer.current = setTimeout(() => { query.current = '' }, 600)
        const found = typeaheadIndex(list.current, query.current, activeRef.current)
        if (found >= 0) setActive(found)
      }
    },
  }

  const getItemProps = (index: number) => ({
    ref: (node: HTMLElement | null) => { itemRefs.current[index] = node },
    tabIndex: -1,
    onPointerMove: () => {
      const item = list.current[index]
      if (activeRef.current === index || !item || item.type === 'separator' || item.disabled) return
      setActive(index)
    },
    onClick: () => choose(index),
  })

  return {isOpen, active, items, subject, placement, openAt, refresh, close, menuRef, menuProps, getItemProps}
}

/** The menu key, or ⇧F10, on a focused object: open its menu from the keyboard. Pure. */
export const opensMenu = (event: {readonly key: string; readonly shiftKey: boolean}): boolean =>
  event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')
