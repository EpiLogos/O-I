import { validateProjection } from './index.mjs';
import { worldPresentationFromProjection } from './presentation-projection.mjs';

const ACCOUNT_RENDERERS = new Map([
  ['oi.presentation/lede/v1', 'lede'],
  ['oi.presentation/prose/v1', 'prose'],
  ['oi.presentation/distinction/v1', 'distinction'],
  ['oi.presentation/diagram/v1', 'diagram'],
  ['oi.presentation/source/v1', 'source'],
  ['oi.presentation/claim-evidence/v1', 'claim-evidence'],
  ['oi.presentation/timeline/v1', 'timeline'],
  ['oi.presentation/comparison/v1', 'comparison'],
  ['oi.presentation/code-schema/v1', 'code-schema'],
  ['oi.presentation/image/v1', 'image'],
  ['oi.presentation/mockup/v1', 'mockup'],
  ['oi.presentation/wiki-excerpt/v1', 'wiki-excerpt'],
  ['oi.presentation/reference-card/v1', 'reference-card'],
  ['oi.presentation/run-history/v1', 'run-history'],
  ['oi.presentation/action/v1', 'action'],
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sourceRefs(provenance) {
  return provenance.map((entry) => ({
    kind: entry.kind,
    ref: entry.ref,
    source_system: entry.source_system,
    ...(entry.revision ? { revision: entry.revision } : {}),
  }));
}

/**
 * Return the agent-readable form of a projected WorldPresentation.
 *
 * This is a reading of an existing Projection revision, not a new canonical
 * Account/Profile/Project object. Human renderers and agents therefore address
 * the same Projection ref/revision while consuming the representation in the
 * form appropriate to them.
 */
export function structuredProjectionReading(value) {
  const projection = validateProjection(value);
  const presentation = worldPresentationFromProjection(projection);

  return {
    projection_ref: projection.projection_ref,
    projection_revision: projection.projection_revision,
    projection_state: projection.state,
    source: clone(projection.source),
    subject: clone(projection.subject),
    presentation_ref: presentation.presentation_ref,
    presentation_revision: presentation.revision,
    world_ref: presentation.world_ref,
    title: presentation.title,
    ...(presentation.summary ? { summary: presentation.summary } : {}),
    provenance: sourceRefs(presentation.provenance),
    modules: presentation.regions.flatMap((region) =>
      region.bindings.map((binding) => {
        const renderer = binding.portable_renderer ?? binding.component_ref;
        return {
          region_ref: region.region_ref,
          region_role: region.role,
          ...(region.label ? { region_label: region.label } : {}),
          binding_ref: binding.binding_ref,
          component_ref: binding.component_ref,
          ...(binding.contribution_ref ? { contribution_ref: binding.contribution_ref } : {}),
          ...(binding.surface_ref ? { surface_ref: binding.surface_ref } : {}),
          ...(binding.projection_ref ? { nested_projection_ref: binding.projection_ref } : {}),
          ...(binding.subject_ref ? { subject_ref: binding.subject_ref } : {}),
          renderer,
          ...(ACCOUNT_RENDERERS.has(renderer) ? { account_module: ACCOUNT_RENDERERS.get(renderer) } : {}),
          props: clone(binding.props),
          fallback: clone(binding.fallback),
          provenance: sourceRefs(binding.provenance),
        };
      }),
    ),
  };
}

export function accountModuleKinds() {
  return [...new Set(ACCOUNT_RENDERERS.values())];
}
