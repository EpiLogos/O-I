// The fixture CorpusProvider — the Phase 2 acceptance corpus as one provider
// among others (C2 §1.2: "a corpus provider is anything that can publish the
// bundle"). Its bundle is built in memory: zero fetches, zero corpus bytes on
// disk, zero Jung data. Registering it alongside a second provider (e.g. the
// Jung vault's published bundle) without core change IS the §13 neutrality test.

import { registerCorpusProvider, type CorpusBundle, type CorpusProvider } from './corpusProvider';
import { fixtureCorpus } from './fixtureCorpus';

export const FIXTURE_PROVIDER_ID = 'fixture-northern-lights';

export const fixtureProvider: CorpusProvider = {
  id: FIXTURE_PROVIDER_ID,
  name: 'the northern lights-keeping fixture',
  async load(): Promise<CorpusBundle> {
    const { field, history, symbols } = fixtureCorpus();
    return {
      id: FIXTURE_PROVIDER_ID,
      name: fixtureProvider.name,
      field,
      images: {}, // images ride the field's inline ImageRefs (generated data URLs)
      history, // the epoch reading — the Aion pane's data
      // corpus: omitted on purpose [C2-a3, r2] — the slot is typed (CorpusIndex,
      // the landed c9732df modules) and the fixture's honest optional absence
      // exercises the degrade law: no cite is a link, nothing is invented.
      symbols, // exercises b8's source-title-from-data with a fixture source
      // ties: omitted on purpose — the optional bundle's honest absence (the
      // reveal's sky row shows nothing; the graph's sky anchors label unavailability)
    };
  },
};

let registered = false;
/** Register the fixture provider as the default (the host may override). */
export function registerFixtureProvider(asDefault = true): void {
  if (registered) return;
  registerCorpusProvider(fixtureProvider, { asDefault });
  registered = true;
}
