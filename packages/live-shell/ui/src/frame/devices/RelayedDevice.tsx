// The second window's side of the relay (frame/devices/deviceRelay.ts): the popped-out device drawn in its own Pop-out view on the
// binding the main window relays — readings and standing as they stand there, every change sent back to the owner through it and
// answered in the owner's words. While no relay answers (a face popped out from elsewhere, a main window that relays none), the page
// draws what it drew before.
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {PlacedDevice} from './DeviceView'
import type {DeviceInstance} from './deviceRuntime'
import {RELAY_EVENTS, relayedBinding, type RelayAct, type RelayedSnapshot} from './deviceRelay'

/** How long the page waits for the main window's relay before drawing the standalone face. */
export const RELAY_WAIT_MS = 1500

export function useRelayedSnapshot(bindingId: string): {snapshot: RelayedSnapshot | null; waited: boolean; send: (act: RelayAct) => Promise<void>} {
  const [snapshot, setSnapshot] = useState<RelayedSnapshot | null>(null)
  const [waited, setWaited] = useState(false)
  const pending = useRef(new Map<string, {resolve: () => void; reject: (cause: Error) => void}>())
  const emitRef = useRef<((event: string, payload: unknown) => Promise<void>) | null>(null)
  useEffect(() => {
    let live = true
    const offs: (() => void)[] = []
    const timer = setTimeout(() => { if (live) setWaited(true) }, RELAY_WAIT_MS)
    void import('@tauri-apps/api/event').then(async ({emit, listen}) => {
      if (!live) return
      emitRef.current = (event, payload) => emit(event, payload)
      offs.push(await listen<RelayedSnapshot>(RELAY_EVENTS.publish, event => { if (live && event.payload.bindingId === bindingId) setSnapshot(event.payload) }))
      offs.push(await listen<{requestId: string; error?: string}>(RELAY_EVENTS.ack, event => {
        const waiting = pending.current.get(event.payload.requestId)
        if (!waiting) return
        pending.current.delete(event.payload.requestId)
        if (event.payload.error) waiting.reject(new Error(event.payload.error)); else waiting.resolve()
      }))
      await emit(RELAY_EVENTS.hello, {bindingId})
    })
    return () => {
      live = false
      clearTimeout(timer)
      offs.forEach(off => off())
      void emitRef.current?.(RELAY_EVENTS.bye, {bindingId})
    }
  }, [bindingId])
  const send = useMemo(() => (act: RelayAct) => new Promise<void>((resolve, reject) => {
    const emit = emitRef.current
    if (!emit) { reject(new Error('The relay to the main window is not open yet.')); return }
    const requestId = `${bindingId}:${Date.now()}:${Math.random().toString(36).slice(2)}`
    pending.current.set(requestId, {resolve, reject})
    void emit(RELAY_EVENTS.act, {bindingId, requestId, act})
  }), [bindingId])
  return {snapshot, waited, send}
}

/** The device's Pop-out on the relayed binding, or `fallback` once no relay answered. */
export function RelayedDevice({bindingId, fallback, onClose}: {bindingId: string; fallback: () => ReactNode; onClose?: () => void}) {
  // Off the host there is no event bus to relay on: the page draws what it drew before, at once.
  if (!onHost()) return <>{fallback()}</>
  return <Relayed bindingId={bindingId} fallback={fallback} onClose={onClose} />
}

const onHost = () => typeof window !== 'undefined' && !!(window as unknown as {__TAURI_INTERNALS__?: unknown}).__TAURI_INTERNALS__

function Relayed({bindingId, fallback, onClose}: {bindingId: string; fallback: () => ReactNode; onClose?: () => void}) {
  const {snapshot, waited, send} = useRelayedSnapshot(bindingId)
  const binding = useMemo(() => (snapshot?.binding ? relayedBinding(snapshot.binding, send) : undefined), [snapshot, send])
  if (!snapshot) return waited ? <>{fallback()}</> : <p role="status" data-device-relay="waiting">Reaching the device in the main window…</p>
  const device = snapshot.device as unknown as DeviceInstance
  return <div className="device-relayed" data-device-relay="relayed" data-device-relay-of={snapshot.deviceId}>
    <PlacedDevice device={device} view="popout" binding={binding} onClose={onClose} relayed />
  </div>
}
