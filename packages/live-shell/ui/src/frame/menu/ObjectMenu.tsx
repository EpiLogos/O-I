// Adapted from interior.dev (github.com/ddoemonn/interior), Copyright (c) 2026 ozzy, MIT License.
//
// The object menu as drawn (manual §10.9): the object's name at its head, its acts with their keys at the right, Live's palette as a
// row of colours where the object takes a colour. A disabled entry is drawn faint and says why on the Info line (data-i): it stays a
// control the pointer reaches (aria-disabled, never the disabled attribute — WebKit sends a disabled control no mouseover, so the Info
// line, which reads what the pointer enters, would never hear its reason), and choosing it does nothing (useObjectMenu.ts choose). A
// destructive one is drawn in the record colour, so an act that takes something away never looks like one that cannot run. One of a
// set of ways (Open in's) is a radio item, the way standing checked.
import {createPortal} from 'react-dom'
import type {ObjectMenuItem, useObjectMenu} from './useObjectMenu'
import './objectMenu.css'

type Menu = ReturnType<typeof useObjectMenu>
type Item = Extract<ObjectMenuItem, {label: string; colours?: never}>

/** An act's entry as the Info line reads it: its id, its tone, and — dimmed — `aria-disabled` with its reason in `data-i` and the
 * title. Never the `disabled` attribute (see above). Pure. */
export function objectMenuItemProps(item: Item): {'data-act': string; 'data-tone'?: 'destructive'; 'aria-disabled'?: true; 'data-i'?: string; title?: string} {
  return {'data-act': item.id, ...(item.tone === 'destructive' ? {'data-tone': 'destructive' as const} : {}),
    ...(item.disabled ? {'aria-disabled': true as const, ...(item.why ? {'data-i': `${item.label}|${item.why}`, title: item.why} : {})} : {})}
}

export function ObjectMenu({menu}: {menu: Menu}) {
  const {placement, items, subject, active, menuRef, menuProps, getItemProps} = menu
  if (!placement || typeof document === 'undefined') return null
  return createPortal(<div ref={menuRef} {...menuProps} className="object-menu" aria-label={`${subject}: actions`}
    style={{left: placement.left, top: placement.top, width: placement.width, maxHeight: placement.maxHeight}}>
    {subject && <small className="object-menu-subject">{subject}</small>}
    {items.map((item, index) => {
      if (item.type === 'separator') return <hr key={item.id} />
      if (item.type === 'swatches') return <div key={item.id} role="group" aria-label={item.label} className="object-menu-swatches"
        data-i={item.disabled && item.why ? `${item.label}|${item.why}` : `${item.label}|Choose a colour.`} aria-disabled={item.disabled || undefined}>
        {item.colours.map(colour => <button key={colour} type="button" tabIndex={-1} disabled={item.disabled} aria-label={colour}
          aria-pressed={item.current?.toUpperCase() === colour.toUpperCase()} style={{background: colour}}
          onClick={() => { menu.close(true); item.onPick?.(colour) }} />)}
      </div>
      return <button key={item.id} type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked}
        {...getItemProps(index)} className="object-menu-item" {...objectMenuItemProps(item)} data-active={active === index || undefined}>
        <span className="object-menu-label">{item.label}</span>
        {item.shortcut && <kbd aria-hidden="true">{item.shortcut}</kbd>}
      </button>
    })}
  </div>, document.body)
}
