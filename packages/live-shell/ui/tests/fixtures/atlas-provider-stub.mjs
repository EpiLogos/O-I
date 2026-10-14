// Stands in for projections/atlas/provider/archetypalEarthProvider.ts in the attach tests: the bundle is the atlas's own
// fixture corpus, so the panel reads a real field without the Archetypal-Earth bundle or the kernel.
import {fixtureCorpus} from '../../src/projections/atlas/provider/fixtureCorpus.ts'

export const ARCHETYPAL_EARTH_PROVIDER_ID = 'archetypal-earth'

export function archetypalEarthProvider() {
  return {
    id: ARCHETYPAL_EARTH_PROVIDER_ID,
    name: 'fixture corpus (test stub)',
    async load() {
      const {field, history, symbols} = fixtureCorpus()
      return {id: ARCHETYPAL_EARTH_PROVIDER_ID, name: 'fixture corpus (test stub)', field, images: {}, history, symbols}
    },
  }
}
