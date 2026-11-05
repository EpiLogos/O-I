// The models the Agent's Model chooser offers (DLW §19.4 "The models the harness offers"): AIKit's resolved model catalogue through
// the kernel's own op (`model_catalogue` → `aikit model-catalogue show --json`, agency.rs:1373-1400). Read 16 Oct 2026 (scratch
// lane-bf2/shapes/model-catalogue.json): {catalogued: 346, shown: 346, standing: "catalogue identity only — a catalogued Model is not
// thereby available; see `aikit compose --json` for route availability", entries: [{model: "model:aion-2.0", name, source,
// declared_routes, book}]}. The chooser's choices are the entries' own ids; a model's availability is the owner's to say, and the
// Model write stays a reading (designBindings.ts REFUSE.reading). Read once per carrier, and only while the Agent's design draws it.
import {useEffect, useState} from 'react'
import {kernelRead} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {refusalWords} from './ownerRoutes'

/** The catalogue's model ids, in the owner's order; null when the answer carries no entries. */
export function catalogueModels(data: unknown): string[] | null {
  const entries = (data as {entries?: unknown} | null)?.entries
  if (!Array.isArray(entries)) return null
  return entries.flatMap(entry => {
    const model = (entry as {model?: unknown} | null)?.model
    return typeof model === 'string' && model ? [model] : []
  })
}

/** AIKit's model catalogue read once, at an act (Launch maps the model a session runs onto its catalogue entry, taskBindings.ts
 * catalogueModelOf): the reading's data, or the kernel's refusal thrown in its words. */
export async function catalogueRead(transport: KernelTransportStatus): Promise<unknown> {
  if (transport.kind === 'unavailable') throw Error(`The kernel carrier is unavailable, so AIKit's model catalogue cannot be read: ${transport.reason ?? 'no transport'}.`)
  const answer = await kernelRead(transport, {op: 'model_catalogue'})
  if (answer.error) throw Error(`AIKit's model catalogue was not read: ${refusalWords(answer.error)}`)
  const outcome = answer.outcome
  if (outcome?.result !== 'model_catalogue_reading') throw Error('AIKit answered without its model catalogue.')
  return outcome.data
}

export function useModelCatalogue(transport: KernelTransportStatus, enabled: boolean): string[] | null {
  const [models, setModels] = useState<string[] | null>(null)
  useEffect(() => {
    if (!enabled || transport.kind === 'unavailable') { setModels(null); return }
    let live = true
    void kernelRead(transport, {op: 'model_catalogue'}).then(answer => {
      if (live) setModels(!answer.error && answer.outcome?.result === 'model_catalogue_reading' ? catalogueModels(answer.outcome.data) : null)
    })
    return () => { live = false }
  }, [transport, enabled])
  return models
}
