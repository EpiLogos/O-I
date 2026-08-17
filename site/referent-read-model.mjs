import { createReferentExploreApplication } from '../shared-field/referent.mjs';

/**
 * Browser/agent-neutral adapter. The current React front-door lives on a parallel
 * branch, so this file deliberately projects the same aggregate into a stable
 * presentation contract without taking ownership of that UI branch.
 */
export function createReferentBrowserReadModel(seed, referentRef, options = {}) {
  const app = createReferentExploreApplication(seed);
  const reading = app.open(referentRef, options);
  if (!reading?.common) return undefined;
  return {
    schema: 'oi.referent-browser-read-model/v1',
    ref: reading.common.referent_ref,
    heading: reading.common.display_heading,
    representative_ref: reading.common.representative_ref,
    summary: {
      holdings: reading.counts.visible_projected_holdings,
      worlds: reading.counts.visible_worlds,
      forms: reading.counts.visible_representation_forms,
    },
    sections: {
      COMMON: reading.common,
      FORMS: reading.forms,
      VERSIONS: reading.versions,
      PROJECTIONS: reading.projections,
      PROVENANCE: reading.provenance,
      RELATIONS: reading.relations,
      CONTRIBUTIONS: reading.contributions,
    },
    actions: reading.actions,
    privacy: reading.privacy,
  };
}
