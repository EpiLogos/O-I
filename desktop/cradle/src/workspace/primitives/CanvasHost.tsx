import type {HTMLAttributes, ReactNode} from 'react';
import './primitives.css';
/** Children stay in their stable keyed slots; hiding a stage never parks or reparents its engine. */
export function CanvasHost({className = '', ...props}: HTMLAttributes<HTMLElement>) {
  return <main {...props} className={`canvas-host desktop-centre ${className}`} data-region="centre" aria-label="Workspace canvas"/>;
}
export function CanvasStage({className = '', ...props}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`canvas-stage mode-stage ${className}`} data-window-corner="true" data-window-corner-left="true"/>;
}
export function CanvasHUD({children, className = '', ...props}: HTMLAttributes<HTMLDivElement> & {children?: ReactNode}) {
  return <div {...props} className={`canvas-hud ${className}`}>{children}</div>;
}
