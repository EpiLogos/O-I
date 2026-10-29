/** Descriptor census captured through `oi config list --json`, 7 October 2026.
 * This is a source inventory, never evidence that a product is admitted or a
 * value is effective in the receiving shell. Live reads replace it wholesale.
 * The capture loads when the Settings window first reads its registry with no
 * native contribution connected (development builds only), never with the
 * shell's first frame (O-I #740). */
import type { ContributionMount, SettingSpec } from './adapter'

let capture: Promise<SettingSpec[]> | null = null
/** The census's settings, fetched once on first need. */
export const loadSourceSettings = (): Promise<SettingSpec[]> =>
  capture ??= import('./native-inventory.capture.json').then(module => module.default.settings as SettingSpec[])

export async function disconnectedCatalogue(reason: string): Promise<ContributionMount[]> {
  const sourceSettings = await loadSourceSettings()
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
