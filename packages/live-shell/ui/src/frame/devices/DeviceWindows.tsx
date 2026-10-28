// A device's own window (manual §16.3 Pop-out: "Its own window, which can fill the screen — The material with every control docked
// under it"; §16.4: "Any number of windows can stay open. A window follows its device: when the device leaves the chain, its window
// closes"; "A device's window: ↗ on its head, or the window's own close"). Live's plug-in window, drawn as a layer above the shell:
// each window a movable, sizable frame — the gallery's window (inhabitants/catalogue/main.tsx DesignedViews `popout`, catalogue.css
// `.cat-window`: three marks and the name in a 26 px bar, the room under it) — holding the device's Pop-out view on the same binding
// every other place reads (DeviceView.tsx PlacedDevice view="popout": the design's own, or Full over Whole, popout.tsx popoutOf).
//
// On the native host a Pop-out opens the host's own window (desktop/cradle/src-tauri/src/windows.rs window_detach), a separate page
// that draws the device's Pop-out on the binding this window relays to it (frame/devices/deviceRelay.ts): one door, one owner. In the
// browser, and wherever the host refuses, the device pops out here.
//
// The bar: close, roll up to the bar, fill the shell's window (and the native window can then fill the screen); drag it to move the
// window, double-click it to fill. The corner sizes it. A press anywhere brings it to the front.
//
// Under the device, the status bar's Info line (manual §16.9 "What a control does is said in the status bar when you point at it";
// §16.11 Disabled "The control at 40 % strength. The status bar says why"): a window stands apart from the shell's status bar — the
// host's own window has none, and a filled window covers it — so each window carries the line, reading what the pointer enters inside
// it by the shell's one info law (components/StatusBar.tsx infoOf), a dimmed control's reason and the host's refusals among it (#806).
import {useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent} from 'react'
import {INFO_IDLE, infoOf} from '../../components/StatusBar'
import type {DataIStatusInfo} from '../../agent/statusInfo'
import {closeDeviceWindow, openDeviceWindowHere, raiseDeviceWindow, setDeviceWindow, setPopOutRoute, useDeviceDoor, useDeviceWindows, type DeviceWindowBox,
  type DeviceWindowState, type PublishedDevice} from './deviceDoor'
import {nativeHostMain, popOutNative} from './deviceRelay'
import {useOptionalContinuity} from '../../continuity/workspace'
import {heldInView, movedWindowBox, openedWindowBox, sizedWindowBox, windowRoom, type WindowDrag} from './deviceWindow'
import {PlacedDevice, useShownBox} from './DeviceView'
import {RESIZE_STEP} from '../../shell/workspaceAreas'
import './devices.css'

/** What the Info line of a window says for what the pointer entered: the nearest `data-i` (else title) by the shell's one info law
 * (StatusBar.tsx infoOf), or null where the element says nothing (the line then keeps its last reading, as the status bar's does). Pure. */
export function windowInfoOf(target: unknown): DataIStatusInfo | null {
  const element = target as Element | null
  return element && typeof element.closest === 'function' ? infoOf(element) : null
}

/** A window's Info line reading: what the pointer last entered inside the window (its `mouseover`, which the host's refusals ride too:
 * deviceHost.tsx sayOnInfoLine). */
export function useWindowInfo(): {readonly info: DataIStatusInfo | null; readonly onMouseOver: (event: MouseEvent<HTMLElement>) => void} {
  const [info, setInfo] = useState<DataIStatusInfo | null>(null)
  const onMouseOver = useCallback((event: MouseEvent<HTMLElement>) => { const read = windowInfoOf(event.target); if (read) setInfo(read) }, [])
  return {info, onMouseOver}
}

/** What a window says of itself where the pointer is over none of its controls: the Info line's reading stops at the window, never
 * reading on to whatever stands behind it. */
export const WINDOW_SAYS = 'The device\'s own window. Point at a control: what it does, or why it stands dimmed, is said in the line under it.'

/** The window's Info line, docked under its device: the status bar's line, its words and its idle sentence (StatusBar.tsx INFO_IDLE). */
export function WindowInfoLine({info}: {readonly info: DataIStatusInfo | null}) {
  return <footer className="device-window-info" data-region="window-info" role="status" data-info={info ? 'reading' : 'idle'}>
    {info ? <><b>{info.label}</b>{info.fn}</> : <><b>Info</b>{INFO_IDLE}</>}</footer>
}

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

/** On the native host, a Pop-out opens the host's own window, its binding relayed there (deviceRelay.ts); where the host refuses,
 * the device pops out here instead and the refusal is logged in the host's words. */
function useNativePopOut() {
  const workspaceId = useOptionalContinuity()?.current.id ?? null
  useEffect(() => {
    if (!nativeHostMain() || !workspaceId) return
    setPopOutRoute(id => {
      void popOutNative(id, workspaceId).catch((cause: unknown) => {
        console.warn(`The host's own window refused the Pop-out; it opens here instead: ${cause instanceof Error ? cause.message : String(cause)}`)
        openDeviceWindowHere(id)
      })
      return true
    })
    return () => setPopOutRoute(null)
  }, [workspaceId])
}

/** The frame's window layer: every device window standing, the front one last. Mounted once, beside the expanded view's host. */
export function DeviceWindowLayer() {
  useNativePopOut()
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
  const info = useWindowInfo()
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
    onPointerDownCapture={() => raiseDeviceWindow(id)} onMouseOver={info.onMouseOver} data-i={`${title}|${WINDOW_SAYS}`}>
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
    {!state.shaded && <WindowInfoLine info={info.info} />}
    {!state.filled && !state.shaded && <div className="device-window-size" role="separator" aria-label={`Size ${title}'s window`} tabIndex={0}
      data-i={`Size|Drag the corner to size the window; the arrows size it by the keys.`}
      onPointerDown={take('size')} onPointerMove={follow} onPointerUp={letGo} onPointerCancel={letGo} onKeyDown={sizeByKey} />}
  </section>
}
