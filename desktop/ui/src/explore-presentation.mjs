import {
  authoringDisclosure,
  bindingAvailability,
  normalizeContributionField,
} from '../../../shared-field/presentation-authoring.mjs';

export const DESKTOP_EXPLORE_PRESENTATION_CONTRACT = 'oi.world-presentation/v1';
export const DESKTOP_EXPLORE_AUTHORING_CONTRACT = 'oi.presentation-authoring/v1';

/**
 * Desktop consumption of the same structured authoring model used by web Explore.
 * This is deliberately a Surface adapter: it neither defines Component identity
 * nor owns Projection state or AIKit contribution resolution.
 */
export function createDesktopExplorePresentationReading(input = {}) {
  if (!input.presentation) {
    return {
      contract: DESKTOP_EXPLORE_PRESENTATION_CONTRACT,
      authoring_contract: DESKTOP_EXPLORE_AUTHORING_CONTRACT,
      availability: 'degraded',
      reason: 'No live WorldPresentation instance is bound to the desktop Explore Surface.',
      presentation_ref: null,
      selected: null,
      contributions: normalizeContributionField(input.contributions ?? []),
      bindings: [],
    };
  }

  const contributions = normalizeContributionField(input.contributions ?? []);
  const disclosure = authoringDisclosure({
    presentation: input.presentation,
    projection_ref: input.projection_ref ?? null,
    source_ref: input.source_ref ?? null,
    source_revision: input.source_revision ?? null,
    selected_binding_ref: input.selected_binding_ref ?? null,
    selected_region_ref: input.selected_region_ref ?? null,
    contributions,
    mode: input.mode ?? 'read',
    dirty: input.dirty === true,
  });

  return {
    contract: DESKTOP_EXPLORE_PRESENTATION_CONTRACT,
    authoring_contract: DESKTOP_EXPLORE_AUTHORING_CONTRACT,
    availability: 'ready',
    presentation_ref: disclosure.presentation_ref,
    world_ref: disclosure.world_ref,
    projection_ref: disclosure.projection_ref,
    source_ref: disclosure.source_ref,
    source_revision: disclosure.source_revision,
    selected: disclosure.selected,
    operations: disclosure.operations,
    contributions: disclosure.contributions,
    bindings: bindingAvailability(input.presentation, contributions, input.renderer_registry ?? {}),
  };
}
