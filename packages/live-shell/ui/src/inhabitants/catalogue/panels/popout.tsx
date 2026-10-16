// The views a host composes from a design's own (manual §16.3). Pop-out: the device in its own window, which can fill the
// screen. Most devices need no pop-out of their own: the window shows Full, the material, with Whole docked under it, its
// bands side by side as Live lays a plug-in's controls under its editor. A device whose controls belong beside the material
// writes `popout` itself. Whole expanded above the chain stands in the same wide frame: bands side by side, the display
// growing into the room while the controls keep their size.
import type {ReactNode} from 'react'
import {BODY, HEAD} from '../../sdk/panel'
import type {DesignedDevice, Room, ViewProps} from './design'

/** The height of Whole when its bands stand side by side: the head and one band. */
export const WIDE_WHOLE_H = HEAD + BODY + 2

/** Whole expanded above the chain (Live's expanded view): the same view, in the wide frame. */
export function flippedOf(design: DesignedDevice, p: ViewProps, room: Room): ReactNode {
  return <div className="dp-wide dp-flip">{design.whole({...p, frame: 'flip', room})}</div>
}

/** The device in its own window: the design's own pop-out, or Full over Whole. */
export function popoutOf(design: DesignedDevice, p: ViewProps, room: Room): ReactNode {
  if (design.popout) return <div className="dp-window-body">{design.popout({...p, frame: 'window', room})}</div>
  const controls = Math.min(WIDE_WHOLE_H, Math.round(room.h / 2))
  return <div className="dp-window-body">
    <div className="dp-window-material" style={{height: room.h - controls}}>{design.full({...p, frame: 'window', room: {w: room.w, h: room.h - controls}})}</div>
    <div className="dp-wide dp-window-controls">{design.whole({...p, frame: 'window', room: {w: room.w, h: controls}})}</div>
  </div>
}
