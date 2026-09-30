/** Temporary placements use the same native Surface body as an ordinary tab.
 * The frame owns its one binding and lifecycle; this is no copied source view. */
import type {ComponentProps} from 'react';
import {SurfaceBody} from '../surface/Workbench';
import './scene-source-portal.css';
export function SceneSourcePortal({placement,onClose,...surface}:ComponentProps<typeof SurfaceBody>&{placement:'preview'|'overlay';onClose:()=>void}){
 return <section className={`scene-source-portal ${placement}`} role="region" aria-label={`${placement==='preview'?'Source preview':'Source overlay'}: ${surface.binding.title}`} data-surface-id={surface.binding.id} data-source-ref={surface.binding.ref}>
  <header><strong>{surface.binding.title}</strong><button type="button" onClick={onClose}>Return to scene</button></header>
  <div className="scene-source-portal-body"><SurfaceBody {...surface}/></div>
 </section>;
}
