import type {ButtonHTMLAttributes, HTMLAttributes, ReactNode} from 'react';
import {Glyph, type GlyphName} from '../Glyph';
import './primitives.css';

export interface IconTabItem {id: string; label: string; icon: GlyphName; mark?: 'dot' | 'attention'; disabled?: boolean}
export function IconTab({label, icon, selected, mark, children, className = '', ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {label: string; icon: GlyphName; selected: boolean; mark?: 'dot' | 'attention'}) {
  return <button {...props} type="button" role="tab" aria-selected={selected} aria-label={label} title={props.title ?? `${label}${mark === 'attention' ? ' — needs you' : mark === 'dot' ? ' — new activity' : ''}`} tabIndex={selected ? 0 : -1} className={`icon-tab ${className}`}>
    <Glyph name={icon} size={14}/>{children}{mark && <span className="icon-tab-mark" data-mark={mark} aria-hidden="true">{mark === 'attention' ? '!' : ''}</span>}
  </button>;
}
/** All strips share focus, tooltip, attention and active-state behaviour. Rich surface tabs supply children for native drag/close operations. */
export function IconTabStrip({items, current, onSelect, children, orientation = 'horizontal', className = '', ...props}: Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> & {items?: readonly IconTabItem[]; current?: string; onSelect?: (id: string) => void; children?: ReactNode; orientation?: 'horizontal' | 'vertical'}) {
  return <div {...props} className={`icon-tab-strip oi-scroll ${className}`} role="tablist" aria-orientation={orientation} onKeyDown={event => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')];
    const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const next = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const previous = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    const target = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : event.key === next ? tabs[(index + 1) % tabs.length] : event.key === previous ? tabs[(index - 1 + tabs.length) % tabs.length] : undefined;
    if (target) {event.preventDefault(); target.focus(); target.click();}
  }}>{items?.map(item => <IconTab key={item.id} label={item.label} icon={item.icon} selected={item.id === current} mark={item.mark} disabled={item.disabled} data-tab-id={item.id} onClick={() => onSelect?.(item.id)}/>)}{children}</div>;
}
