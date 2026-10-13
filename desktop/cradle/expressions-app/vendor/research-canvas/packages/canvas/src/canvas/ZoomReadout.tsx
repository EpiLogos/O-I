import {useEffect,useState} from 'react';
import {zoomPercent} from './navigationGeometry';

/** How long the readout holds after the last zoom change before it fades. */
export const ZOOM_READOUT_HOLD_MS=900;
/** The fade's duration; under reduced motion the readout simply disappears. */
export const ZOOM_READOUT_FADE_MS=320;

/** A6 — the zoom percentage, shown on zoom and faded out after it settles.
 * `token` changes with every zoom change, so a running zoom keeps the readout
 * up until the zoom stops. The fade is owned here, beside the state it fades,
 * and drops to none under prefers-reduced-motion. */
export function ZoomReadout({zoom,token}:{zoom:number;token:number}){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  if(!token)return;
  setVisible(true);
  const timer=setTimeout(()=>setVisible(false),ZOOM_READOUT_HOLD_MS);
  return()=>clearTimeout(timer);
 },[token]);
 const reduced=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 return <output className="canvas-zoom-readout" data-visible={visible?'true':'false'} aria-hidden="true" style={{opacity:visible?1:0,transition:reduced?'none':`opacity ${ZOOM_READOUT_FADE_MS}ms ease`}}>{zoomPercent(zoom)}</output>;
}
