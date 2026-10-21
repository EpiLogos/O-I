import {useEffect, useState} from 'react'
import {kernelRead} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

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
      const harness = await kernelRead(transport, {op: 'harness_status'})
      if (!live) return
      if (harness.error || harness.outcome?.result !== 'harness_status_reading') {
        setError(harness.error ?? 'Harness status unavailable')
        return
      }
      setHarnesses(foundHarnesses(harness.outcome.data))
      const rows = (harness.outcome.data as {harnesses?: Array<{id?: string; binding?: string}>})?.harnesses
      const disclosed = rows?.find(row => row.binding)?.binding ?? rows?.[0]?.id
      setBinding(disclosed ?? 'cursor')
      setResolved(disclosed !== undefined)
      setError(null)
    })()
    return () => { live = false }
  }, [transport])

  return {binding, error, resolved, harnesses}
}
