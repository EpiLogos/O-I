// Adapted from interior.dev (github.com/ddoemonn/interior), Copyright (c) 2026 ozzy, MIT License.
//
// The object menu as drawn (manual §10.9): the object's name at its head, its acts with their keys at the right, Live's palette as a
// row of colours where the object takes a colour. A disabled entry is drawn faint and says why on the Info line (data-i); a
// destructive one is drawn in the record colour, so an act that takes something away never looks like one that cannot run.
import {createPortal} from 'react-dom'
import type {useObjectMenu} from './useObjectMenu'
import './objectMenu.css'

type Menu = ReturnType<typeof useObjectMenu>

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
      return <button key={item.id} type="button" role="menuitem" {...getItemProps(index)} className="object-menu-item"
        data-act={item.id} data-tone={item.tone === 'destructive' ? 'destructive' : undefined} data-active={active === index || undefined}
        aria-disabled={item.disabled || undefined} disabled={item.disabled}
        data-i={item.disabled && item.why ? `${item.label}|${item.why}` : undefined} title={item.disabled ? item.why : undefined}>
        <span className="object-menu-label">{item.label}</span>
        {item.shortcut && <kbd aria-hidden="true">{item.shortcut}</kbd>}
      </button>
    })}
  </div>, document.body)
}
