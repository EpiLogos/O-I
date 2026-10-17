// Stands in for the corpus provider the panel loads, in the attach tests: the bundle is the atlas's own fixture corpus, so the
// panel reads a real field without any owner or the kernel. The panel loads `suiteProvider` (projections/atlas/provider/
// suiteProvider.ts, T-N3-ATLAS-SUITE-PROVIDER); the founding provider's name (archetypalEarthProvider, retired as a source) is
// kept so a suite that still names it keeps its stand-in.
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

/** The suite provider's stand-in: the same fixture corpus under the suite's own id and name. */
export function suiteProvider() {
  return {
    id: 'suite',
    name: 'fixture corpus (test stub)',
    async load() {
      const {field, history, symbols} = fixtureCorpus()
      return {id: 'suite', name: 'fixture corpus (test stub)', field, images: {}, history, symbols}
    },
  }
}
