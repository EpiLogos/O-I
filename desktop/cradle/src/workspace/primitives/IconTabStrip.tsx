import type {ButtonHTMLAttributes, HTMLAttributes, ReactNode} from 'react';
import {Glyph, type GlyphName} from '../Glyph';
import './primitives.css';

export interface IconTabItem {id: string; label: string; icon: GlyphName; mark?: 'dot' | 'attention'; disabled?: boolean; description?: string}
export function IconTab({label, icon, selected, mark, children, className = '', choice = false, ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {label: string; icon: GlyphName; selected: boolean; mark?: 'dot' | 'attention'; choice?: boolean}) {
  return <button {...props} type="button" role={choice ? "radio" : "tab"} aria-selected={choice ? undefined : selected} aria-checked={choice ? selected : undefined} aria-label={label} title={props.title ?? `${label}${mark === 'attention' ? ' — needs you' : mark === 'dot' ? ' — new activity' : ''}`} tabIndex={props.tabIndex ?? (selected ? 0 : -1)} className={`icon-tab ${className}`}>
    <Glyph name={icon} size={14}/>{children}{mark && <span className="icon-tab-mark" data-mark={mark} aria-hidden="true">{mark === 'attention' ? '!' : ''}</span>}
  </button>;
}
/** All strips share focus, tooltip, attention and active-state behaviour. Rich surface tabs supply children for native drag/close operations. */
export function IconTabStrip({items, current, onSelect, children, orientation = 'horizontal', className = '', choice = false, showLabels = false, ...props}: Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> & {items?: readonly IconTabItem[]; current?: string; onSelect?: (id: string) => void; children?: ReactNode; orientation?: 'horizontal' | 'vertical'; choice?: boolean; showLabels?: boolean}) {
  return <div {...props} className={`icon-tab-strip oi-scroll ${className}`} role={choice ? "radiogroup" : "tablist"} aria-orientation={orientation} onKeyDown={event => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled),[role="radio"]:not(:disabled)')];
    const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const next = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const previous = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    const target = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : (event.key === next || (choice && event.key === 'ArrowDown')) ? tabs[(index + 1) % tabs.length] : (event.key === previous || (choice && event.key === 'ArrowUp')) ? tabs[(index - 1 + tabs.length) % tabs.length] : undefined;
    if (target) {event.preventDefault(); target.focus(); target.click();}
  }}>{items?.map((item,index) => <IconTab key={item.id} label={item.label} icon={item.icon} selected={item.id === current} mark={item.mark} disabled={item.disabled} choice={choice} title={item.description} tabIndex={item.id === current || (!items.some(option => option.id === current) && index === items.findIndex(option => !option.disabled)) ? 0 : -1} data-tab-id={item.id} onClick={() => onSelect?.(item.id)}>{showLabels && <span>{item.label}</span>}</IconTab>)}{children}</div>;
}

/** Mutually exclusive setting values share chrome and keyboard movement with tabs, while retaining radio semantics. */
export function IconChoiceStrip(props: Parameters<typeof IconTabStrip>[0]) {
  return <IconTabStrip {...props} choice showLabels={props.showLabels ?? true}/>;
}
