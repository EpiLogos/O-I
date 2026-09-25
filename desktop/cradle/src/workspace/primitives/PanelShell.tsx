import type {HTMLAttributes} from 'react';
import './primitives.css';
export function PanelShell({depth, overlay, className = '', ...props}: HTMLAttributes<HTMLElement> & {depth: string; overlay: boolean}) {
  return <aside {...props} className={`panel-shell desktop-side right depth-${depth} ${className}`} data-region="right" data-depth={depth} data-overlay={overlay} aria-hidden={depth === 'collapsed' || depth === 'strip'}/>;
}
