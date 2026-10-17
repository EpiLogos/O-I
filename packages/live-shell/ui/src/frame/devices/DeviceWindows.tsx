// A device's own window (manual §16.3 Pop-out: "Its own window, which can fill the screen — The material with every control docked
// under it"; §16.4: "Any number of windows can stay open. A window follows its device: when the device leaves the chain, its window
// closes"; "A device's window: ↗ on its head, or the window's own close"). Live's plug-in window, drawn as a layer above the shell:
// each window a movable, sizable frame — the gallery's window (inhabitants/catalogue/main.tsx DesignedViews `popout`, catalogue.css
// `.cat-window`: three marks and the name in a 26 px bar, the room under it) — holding the device's Pop-out view on the same binding
// every other place reads (DeviceView.tsx PlacedDevice view="popout": the design's own, or Full over Whole, popout.tsx popoutOf).
//
// The native host's second window (desktop/cradle/src-tauri/src/windows.rs window_detach) is a separate page: it can draw a face its
// manifest stands alone (native/Detached.tsx DeviceFace), never a device whose binding and own Full live in this window's door. Until
// the door reaches that page, every device pops out here, in the browser and in the native candidate alike.
//
// The bar: close, roll up to the bar, fill the shell's window (and the native window can then fill the screen); drag it to move the
// window, double-click it to fill. The corner sizes it. A press anywhere brings it to the front.
import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react'
import {closeDeviceWindow, raiseDeviceWindow, setDeviceWindow, useDeviceDoor, useDeviceWindows, type DeviceWindowBox, type DeviceWindowState,
  type PublishedDevice} from './deviceDoor'
import {heldInView, movedWindowBox, openedWindowBox, sizedWindowBox, windowRoom, type WindowDrag} from './deviceWindow'
import {PlacedDevice, useShownBox} from './DeviceView'
import {RESIZE_STEP} from '../../shell/workspaceAreas'
import './devices.css'

/** The shell's window, as the windows are held inside it. */
function useViewport(): readonly [number, number] {
  const read = (): [number, number] => (typeof window === 'undefined' ? [1440, 900] : [window.innerWidth, window.innerHeight])
  const [viewport, setViewport] = useState(read)
  useEffect(() => {
    const onResize = () => setViewport(was => { const next = read(); return was[0] === next[0] && was[1] === next[1] ? was : next })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return viewport
}

/** The frame's window layer: every device window standing, the front one last. Mounted once, beside the expanded view's host. */
export function DeviceWindowLayer() {
  const open = useDeviceWindows()
  const door = useDeviceDoor()
  const viewport = useViewport()
  // A window keeps the box it opened at: placed once, by the order it opened in, so bringing another to the front never moves it.
  useEffect(() => {
    open.forEach((state, index) => { if (!state.box) setDeviceWindow(state.id, {box: openedWindowBox(index, viewport)}) })
  }, [open, viewport])
  if (!open.length) return null
  return <div className="device-window-layer" data-device-windows={open.length}>
    {open.map((state, index) => {
      const entry = door.device(state.id)
      // A device withdrawn a moment ago keeps its window for the grace (deviceDoor.ts WINDOW_GRACE_MS), drawing nothing meanwhile.
      return entry ? <DeviceWindowFrame key={state.id} state={state} entry={entry} front={index === open.length - 1}
        box={heldInView(state.box ?? openedWindowBox(index, viewport), viewport)} viewport={viewport} /> : null
    })}
  </div>
}

function DeviceWindowFrame({state, entry, front, box, viewport}: {state: DeviceWindowState; entry: PublishedDevice; front: boolean; box: DeviceWindowBox
  viewport: readonly [number, number]}) {
  const {id} = state
  const title = entry.device.face.title
  const roomRef = useRef<HTMLDivElement>(null)
  const measured = useShownBox(roomRef)
  const drag = useRef<{kind: 'move' | 'size'; drag: WindowDrag} | null>(null)
  const close = () => closeDeviceWindow(id)
  const take = (kind: 'move' | 'size') => (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (kind === 'move' && (event.target as Element).closest('button'))) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {kind, drag: {box, at: [event.clientX, event.clientY]}}
  }
  const follow = (event: PointerEvent<HTMLElement>) => {
    const held = drag.current
    if (!held || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const pointer: [number, number] = [event.clientX, event.clientY]
    setDeviceWindow(id, {box: held.kind === 'move' ? movedWindowBox(held.drag, pointer, viewport) : sizedWindowBox(held.drag, pointer, viewport)})
  }
  const letGo = () => { drag.current = null }
  // The corner by the keys: the arrows size the window a step at a time.
  const sizeByKey = (event: KeyboardEvent<HTMLElement>) => {
    const step = {ArrowRight: [RESIZE_STEP, 0], ArrowLeft: [-RESIZE_STEP, 0], ArrowDown: [0, RESIZE_STEP], ArrowUp: [0, -RESIZE_STEP]}[event.key]
    if (!step) return
    event.preventDefault()
    setDeviceWindow(id, {box: sizedWindowBox({box, at: [0, 0]}, [step[0]!, step[1]!], viewport)})
  }
  const room = measured ? {w: Math.round(measured.width), h: Math.round(measured.height)} : windowRoom(box)
  // A window, not a modal: the frame's keys still act while it holds the focus, as they do over Live's plug-in windows.
  return <section className="device-window" role="region" aria-roledescription="window" aria-label={`${title} — its own window`} data-device-window={id}
    data-front={front ? 'true' : undefined} data-filled={state.filled ? 'true' : undefined} data-shaded={state.shaded ? 'true' : undefined}
    style={state.filled ? undefined : {left: box.x, top: box.y, width: box.w, height: state.shaded ? undefined : box.h}}
    onPointerDownCapture={() => raiseDeviceWindow(id)}>
    <header className="device-window-bar" onPointerDown={take('move')} onPointerMove={follow} onPointerUp={letGo} onPointerCancel={letGo}
      onDoubleClick={event => { if (!(event.target as Element).closest('button')) setDeviceWindow(id, {filled: !state.filled, shaded: false}) }}
      data-i={`${title}|Its own window: drag the bar to move it, double-click it to fill the window. The device stays on its chain.`}>
      <button type="button" className="device-window-mark" data-act="close" aria-label={`Close ${title}'s window`}
        data-i={`Close|Close the device's window. The device stays on its chain.`} onClick={close} />
      <button type="button" className="device-window-mark" data-act="shade" aria-pressed={state.shaded ? 'true' : 'false'}
        aria-label={state.shaded ? `Unroll ${title}'s window` : `Roll ${title}'s window up to its bar`}
        data-i={state.shaded ? 'Unroll|Show the window\'s device again.' : 'Roll up|Roll the window up to its bar; the device keeps working.'}
        onClick={() => setDeviceWindow(id, {shaded: !state.shaded})} />
      <button type="button" className="device-window-mark" data-act="fill" aria-pressed={state.filled ? 'true' : 'false'}
        aria-label={state.filled ? `Return ${title}'s window to its size` : `Fill the window with ${title}`}
        data-i={state.filled ? 'Return|Return the window to the size it had.' : 'Fill|Fill the whole window with the device. The window itself can fill the screen.'}
        onClick={() => setDeviceWindow(id, {filled: !state.filled, shaded: false})} />
      <span className="device-window-title">{title}</span>
    </header>
    {!state.shaded && <div ref={roomRef} className="device-window-room">
      <PlacedDevice device={entry.device} view="popout" frame="window" room={room} picture={entry.picture} binding={entry.binding} onClose={close} />
    </div>}
    {!state.filled && !state.shaded && <div className="device-window-size" role="separator" aria-label={`Size ${title}'s window`} tabIndex={0}
      data-i={`Size|Drag the corner to size the window; the arrows size it by the keys.`}
      onPointerDown={take('size')} onPointerMove={follow} onPointerUp={letGo} onPointerCancel={letGo} onKeyDown={sizeByKey} />}
  </section>
}
