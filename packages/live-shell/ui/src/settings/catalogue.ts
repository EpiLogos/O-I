/** Descriptor census captured through `oi config list --json`, 7 October 2026.
 * This is a source inventory, never evidence that a product is admitted or a
 * value is effective in the receiving shell. Live reads replace it wholesale. */
import capture from './native-inventory.capture.json'
import type { ContributionMount, SettingSpec } from './adapter'

export const sourceSettings = capture.settings as SettingSpec[]
export function disconnectedCatalogue(reason: string): ContributionMount[] {
  const owners = [...new Set(sourceSettings.map(spec => spec.setting_ref.split(':')[0]))]
  return owners.map(owner_ref => {
    const specs = sourceSettings.filter(spec => spec.setting_ref.startsWith(`${owner_ref}:`))
    return { owner_ref, availability: { state: 'unavailable', reason }, error: null,
      document: { schema: 'oi.configuration-contribution/v1', contract_revision: 'source-census-2026-10-07',
        owner: { owner_ref, owner_kind: 'product', contribution_command: [] },
        sections: [...new Set(specs.map(spec => spec.section_ref))].map(id => ({ id, title: id, settings: specs.filter(spec => spec.section_ref === id) })),
        operations: { transport: 'unconnected-source-census', validate: { availability: 'unavailable' }, plan: { availability: 'unavailable' }, apply: { availability: 'unavailable' }, reset: { availability: 'unavailable' } },
        availability: { state: 'unavailable', reason } } }
  })
}
