/**
 * A field-local menubar menu: a quiet trigger and an `.oi-menu` popover of
 * items, check-marked toggles and right-aligned hints. One menu of a bar is
 * open at a time (the bar owns which). Keyboard: Enter/Space/ArrowDown opens,
 * arrows move, Home/End jump, Escape closes and returns focus to the trigger.
 * No motion: the popover appears and disappears.
 */
import {useEffect, useRef, type KeyboardEvent, type ReactNode} from "react";
import {Glyph, type GlyphName} from "../workspace/Glyph";
import {ICON} from "./icons";

export function FieldMenu({id, label, open, onOpenChange, children, width}: {
  id: string; label: string; open: boolean; onOpenChange(open: boolean): void; children: ReactNode; width?: number;
}) {
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onOpenChange(false); };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, [open, onOpenChange]);
  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? []);
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onOpenChange(false); trigger.current?.focus(); return; }
    // Text fields inside a menu keep their own arrow/Home/End behaviour.
    if ((event.target as HTMLElement).matches("input, textarea, select")) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const list = items(); if (!list.length) return;
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? list.length - 1 : (at + (event.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
    list[next]?.focus();
  };
  return <div className="xp-menu" ref={root}>
    <button ref={trigger} type="button" className="xp-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => onOpenChange(!open)}
      onKeyDown={event => { if (event.key === "ArrowDown" && !open) { event.preventDefault(); onOpenChange(true); requestAnimationFrame(() => items()[0]?.focus()); } }}>
      <span>{label}</span><Glyph name={ICON.menu} size={11}/>
    </button>
    {open && <div ref={menu} id={id} role="menu" aria-label={label} className="oi-menu xp-menu-popover oi-scroll" style={width ? {inlineSize: width} : undefined} onKeyDown={onMenuKey}>{children}</div>}
  </div>;
}

/** A plain menu command: an optional 14px leading glyph, the 11px label and
 * an optional 9px muted caption stacked under it, and — only where a real
 * keyboard shortcut exists — a right-aligned mono `shortcut`. `hint` is kept
 * as an alias for `caption` (the row's situating state, not a shortcut). */
export function FieldMenuItem({label, hint, caption = hint, shortcut, icon, disabled, onSelect, title}: {
  label: string; hint?: string; caption?: string; shortcut?: string; icon?: GlyphName; disabled?: boolean; onSelect(): void; title?: string;
}) {
  return <button type="button" role="menuitem" className="oi-menu-item" disabled={disabled} title={title} onClick={onSelect}>
    {icon && <Glyph name={icon} size={14}/>}
    <span className="xp-menu-body">
      <span className="xp-menu-label">{label}</span>
      {caption && <span className="xp-menu-caption">{caption}</span>}
    </span>
    {shortcut && <kbd>{shortcut}</kbd>}
  </button>;
}

/** A check-marked toggle or a one-of choice. The shared menu grammar draws the
 * check from `aria-checked`; `hint`/`caption` names the state in words under
 * the label, never as a keyboard shortcut. */
export function FieldMenuCheck({label, hint, caption = hint, icon, checked, disabled, onSelect, radio}: {
  label: string; hint?: string; caption?: string; icon?: GlyphName; checked: boolean; disabled?: boolean; onSelect(): void; radio?: boolean;
}) {
  return <button type="button" role={radio ? "menuitemradio" : "menuitemcheckbox"} aria-checked={checked} className="oi-menu-item" disabled={disabled} onClick={onSelect}>
    {icon && <Glyph name={icon} size={14}/>}
    <span className="xp-menu-body">
      <span className="xp-menu-label">{label}</span>
      {caption && <span className="xp-menu-caption">{caption}</span>}
    </span>
  </button>;
}
