import {useEffect, useState} from 'react'
import {kernelRead} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {aikitReadOp} from './devices/ownerRoutes'

/** The harnesses the answer says are found on this machine (`aikit --json client status`, 16 Oct: clients[] {client, harness,
 * detection: 'detected' | 'not-installed', installed, …}), by the owner's own harness name; null when the answer carries no rows. */
export function foundHarnesses(data: unknown): string[] | null {
  const clients = (data as {clients?: unknown} | null)?.clients
  if (!Array.isArray(clients)) return null
  return clients.flatMap(row => {
    const client = row as {harness?: unknown; detection?: unknown}
    return client.detection === 'detected' && typeof client.harness === 'string' && client.harness ? [client.harness] : []
  })
}

const isObj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** The gateway binding the shell's harness controls address: the first conversation surface's `binding_ref` in AIKit's gateway ecology
 * (`aikit gateway ecology --json` data: {type: 'ecology', ecology: {agencies[].sessions[].surfaces[].binding_ref}}, the kernel's
 * aikit_read gateway-ecology). Client status names harnesses, never a binding: `aikit gateway agent --binding` takes the gateway's own
 * binding ref. Null where the gateway holds no conversation (or the reading is not its ecology). Pure. */
export function gatewayBindingOf(data: unknown): string | null {
  const ecology = isObj(data) && data.type === 'ecology' && isObj(data.ecology) ? data.ecology : null
  if (!ecology || !Array.isArray(ecology.agencies)) return null
  for (const agency of ecology.agencies) {
    for (const session of isObj(agency) && Array.isArray(agency.sessions) ? agency.sessions : []) {
      for (const surface of isObj(session) && Array.isArray(session.surfaces) ? session.surfaces : []) {
        if (isObj(surface) && typeof surface.binding_ref === 'string' && surface.binding_ref) return surface.binding_ref
      }
    }
  }
  return null
}

export function useHarnessBinding(transport: KernelTransportStatus) {
  const [binding, setBinding] = useState<string>('cursor')
  const [error, setError] = useState<string | null>(null)
  // Whether the owner has named the binding: until it has, 'cursor' is only the shell's default and nothing writes to it.
  const [resolved, setResolved] = useState(false)
  // The harnesses the same answer finds here (the Agent's Harness chooser, DLW §19.4 "The harnesses found on this machine").
  const [harnesses, setHarnesses] = useState<string[] | null>(null)

  useEffect(() => {
    let live = true
    setResolved(false)
    void (async () => {
      if (transport.kind === 'unavailable') {
        if (live) {
          setBinding('cursor')
          setError(transport.reason ?? 'Transport unavailable')
        }
        return
      }
      const [harness, ecology] = await Promise.all([
        kernelRead(transport, {op: 'harness_status'}),
        kernelRead(transport, aikitReadOp({kind: 'gateway-ecology'})),
      ])
      if (!live) return
      if (harness.error || harness.outcome?.result !== 'harness_status_reading') setError(harness.error ?? 'Harness status unavailable')
      else setHarnesses(foundHarnesses(harness.outcome.data))
      const named = !ecology.error && ecology.outcome?.result === 'owner_route_reading'
        ? gatewayBindingOf((ecology.outcome as {data?: unknown}).data) : null
      setBinding(named ?? 'cursor')
      setResolved(named !== null)
      if (!harness.error && harness.outcome?.result === 'harness_status_reading') {
        setError(named === null ? (ecology.error ?? 'AIKit\'s gateway names no conversation binding (`aikit gateway ecology`): no harness control has a binding to address.') : null)
      }
    })()
    return () => { live = false }
  }, [transport])

  return {binding, error, resolved, harnesses}
}
