import {useEffect, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

export function useHarnessBinding(transport: KernelTransportStatus) {
  const [binding, setBinding] = useState<string>('cursor')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      if (transport.kind === 'unavailable') {
        if (live) {
          setBinding('cursor')
          setError(transport.reason ?? 'Transport unavailable')
        }
        return
      }
      const harness = await kernelOp(transport, {op: 'harness_status'})
      if (!live) return
      if (harness.error || harness.outcome?.result !== 'harness_status_reading') {
        setError(harness.error ?? 'Harness status unavailable')
        return
      }
      const rows = (harness.outcome.data as {harnesses?: Array<{id?: string; binding?: string}>})?.harnesses
      const next = rows?.find(row => row.binding)?.binding ?? rows?.[0]?.id ?? 'cursor'
      setBinding(next)
      setError(null)
    })()
    return () => { live = false }
  }, [transport])

  return {binding, error}
}
