import { validateWorldPresentation } from './presentation.mjs';

export const PRESENTATION_AUTHORING_SCHEMA = 'oi.presentation-authoring/v1';
export const PRESENTATION_OPERATION_SCHEMA = 'oi.presentation-authoring-operation/v1';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function nonEmpty(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function findRegion(presentation, regionRef) {
  const index = presentation.regions.findIndex((region) => region.region_ref === regionRef);
  if (index < 0) throw new TypeError(`Unknown presentation region: ${regionRef}`);
  return { region: presentation.regions[index], index };
}

function findBinding(presentation, bindingRef) {
  for (let regionIndex = 0; regionIndex < presentation.regions.length; regionIndex += 1) {
    const region = presentation.regions[regionIndex];
    const bindingIndex = region.bindings.findIndex((binding) => binding.binding_ref === bindingRef);
    if (bindingIndex >= 0) return { region, regionIndex, binding: region.bindings[bindingIndex], bindingIndex };
  }
  throw new TypeError(`Unknown presentation binding: ${bindingRef}`);
}

export function normalizeContributionField(input = []) {
  if (!Array.isArray(input)) throw new TypeError('contribution field must be an array');
  return input.map((raw, index) => {
    const item = record(raw, `contribution field[${index}]`);
    const available = item.available !== false;
    return {
      contribution_ref: nonEmpty(item.contribution_ref, `contribution field[${index}].contribution_ref`),
      component_ref: nonEmpty(item.component_ref, `contribution field[${index}].component_ref`),
      ...(item.surface_ref ? { surface_ref: nonEmpty(item.surface_ref, `contribution field[${index}].surface_ref`) } : {}),
      ...(item.portable_renderer ? { portable_renderer: nonEmpty(item.portable_renderer, `contribution field[${index}].portable_renderer`) } : {}),
      label: typeof item.label === 'string' && item.label.trim() ? item.label : item.component_ref,
      available,
      degraded: item.degraded === true,
      ...(item.reason ? { reason: String(item.reason) } : {}),
      action_refs: Array.isArray(item.action_refs) ? item.action_refs.filter((value) => typeof value === 'string') : [],
      default_props: clone(record(item.default_props ?? {}, `contribution field[${index}].default_props`)),
      fallback: clone(record(item.fallback ?? {}, `contribution field[${index}].fallback`)),
      provenance: Array.isArray(item.provenance) ? clone(item.provenance) : [],
    };
  });
}

function sourceReturnDisclosure(value) {
  if (!value) {
    return {
      available: false,
      owner: null,
      action_refs: [],
      reason: 'No native source-return operation is disclosed for this authored context.',
    };
  }
  const input = record(value, 'source return disclosure');
  return {
    available: input.available === true,
    owner: typeof input.owner === 'string' ? input.owner : null,
    action_refs: Array.isArray(input.action_refs) ? input.action_refs.filter((entry) => typeof entry === 'string') : [],
    ...(typeof input.target_ref === 'string' ? { target_ref: input.target_ref } : {}),
    ...(typeof input.reason === 'string' ? { reason: input.reason } : {}),
  };
}

export function authoringDisclosure(input) {
  record(input, 'presentation authoring disclosure');
  const presentation = validateWorldPresentation(input.presentation);
  const contributions = normalizeContributionField(input.contributions ?? []);
  const selectedRegionRef = input.selected_region_ref ?? null;
  const selectedBindingRef = input.selected_binding_ref ?? null;
  let selected = null;

  if (selectedBindingRef) {
    const found = findBinding(presentation, selectedBindingRef);
    const contribution = found.binding.contribution_ref
      ? contributions.find((item) => item.contribution_ref === found.binding.contribution_ref)
      : undefined;
    selected = {
      kind: 'binding',
      region_ref: found.region.region_ref,
      binding_ref: found.binding.binding_ref,
      component_ref: found.binding.component_ref,
      contribution_ref: found.binding.contribution_ref ?? null,
      surface_ref: found.binding.surface_ref ?? null,
      subject_ref: found.binding.subject_ref ?? null,
      projection_ref: found.binding.projection_ref ?? null,
      action_refs: contribution ? clone(contribution.action_refs) : [],
      contribution_available: contribution ? contribution.available : null,
      contribution_degraded: contribution ? contribution.degraded : false,
      contribution_reason: contribution?.reason ?? null,
      provenance: clone(found.binding.provenance),
    };
  } else if (selectedRegionRef) {
    const found = findRegion(presentation, selectedRegionRef);
    selected = {
      kind: 'region',
      region_ref: found.region.region_ref,
      role: found.region.role,
      provenance: clone(presentation.provenance),
    };
  }

  return {
    schema: PRESENTATION_AUTHORING_SCHEMA,
    world_ref: presentation.world_ref,
    presentation_ref: presentation.presentation_ref,
    presentation_revision: presentation.revision,
    projection_ref: input.projection_ref ?? null,
    source_ref: input.source_ref ?? null,
    source_revision: input.source_revision ?? null,
    source_return: sourceReturnDisclosure(input.source_return),
    mode: input.mode === 'author' ? 'author' : input.mode === 'preview' ? 'preview' : 'read',
    dirty: input.dirty === true,
    selected,
    contributions,
    operations: [
      'select',
      'edit-binding-props',
      'insert-contribution',
      'move-binding',
      'duplicate-binding',
      'remove-binding',
      'replace-contribution',
      'move-region',
      'edit-region',
      'edit-theme',
      'preview',
      'save-working-state',
      'refine-projection',
    ],
  };
}

function uniqueRef(presentation, preferred) {
  const used = new Set(presentation.regions.flatMap((region) => region.bindings.map((binding) => binding.binding_ref)));
  if (!used.has(preferred)) return preferred;
  let index = 2;
  while (used.has(`${preferred}:${index}`)) index += 1;
  return `${preferred}:${index}`;
}

export function applyPresentationAuthoringOperation(value, operation, contributionField = []) {
  const presentation = validateWorldPresentation(value);
  record(operation, 'presentation authoring operation');
  const type = nonEmpty(operation.type, 'presentation authoring operation.type');
  const next = clone(presentation);
  const contributions = normalizeContributionField(contributionField);

  if (type === 'edit-binding-props') {
    const found = findBinding(next, nonEmpty(operation.binding_ref, 'binding_ref'));
    found.region.bindings[found.bindingIndex] = {
      ...found.binding,
      props: { ...found.binding.props, ...clone(record(operation.patch ?? {}, 'patch')) },
    };
  } else if (type === 'insert-contribution') {
    const found = findRegion(next, nonEmpty(operation.region_ref, 'region_ref'));
    const contributionRef = nonEmpty(operation.contribution_ref, 'contribution_ref');
    const contribution = contributions.find((item) => item.contribution_ref === contributionRef);
    if (!contribution) throw new TypeError(`Unknown contribution: ${contributionRef}`);
    if (!contribution.available) throw new TypeError(`Contribution is unavailable: ${contributionRef}`);
    const bindingRef = uniqueRef(next, operation.binding_ref || `binding:${contributionRef}`);
    const binding = {
      binding_ref: bindingRef,
      component_ref: contribution.component_ref,
      contribution_ref: contribution.contribution_ref,
      ...(contribution.surface_ref ? { surface_ref: contribution.surface_ref } : {}),
      ...(contribution.portable_renderer ? { portable_renderer: contribution.portable_renderer } : {}),
      ...(operation.subject_ref ? { subject_ref: String(operation.subject_ref) } : {}),
      ...(operation.projection_ref ? { projection_ref: String(operation.projection_ref) } : {}),
      props: { ...clone(contribution.default_props), ...clone(record(operation.props ?? {}, 'props')) },
      fallback: clone(contribution.fallback),
      provenance: contribution.provenance.length ? clone(contribution.provenance) : clone(next.provenance),
    };
    const at = Number.isInteger(operation.index) ? Math.max(0, Math.min(operation.index, found.region.bindings.length)) : found.region.bindings.length;
    found.region.bindings.splice(at, 0, binding);
  } else if (type === 'move-binding') {
    const from = findBinding(next, nonEmpty(operation.binding_ref, 'binding_ref'));
    const [binding] = from.region.bindings.splice(from.bindingIndex, 1);
    const target = findRegion(next, nonEmpty(operation.to_region_ref ?? from.region.region_ref, 'to_region_ref'));
    const at = Number.isInteger(operation.index) ? Math.max(0, Math.min(operation.index, target.region.bindings.length)) : target.region.bindings.length;
    target.region.bindings.splice(at, 0, binding);
  } else if (type === 'duplicate-binding') {
    const found = findBinding(next, nonEmpty(operation.binding_ref, 'binding_ref'));
    const duplicate = clone(found.binding);
    duplicate.binding_ref = uniqueRef(next, operation.new_binding_ref || `${found.binding.binding_ref}:copy`);
    found.region.bindings.splice(found.bindingIndex + 1, 0, duplicate);
  } else if (type === 'remove-binding') {
    const found = findBinding(next, nonEmpty(operation.binding_ref, 'binding_ref'));
    found.region.bindings.splice(found.bindingIndex, 1);
  } else if (type === 'replace-contribution') {
    const found = findBinding(next, nonEmpty(operation.binding_ref, 'binding_ref'));
    const contributionRef = nonEmpty(operation.contribution_ref, 'contribution_ref');
    const contribution = contributions.find((item) => item.contribution_ref === contributionRef);
    if (!contribution || !contribution.available) throw new TypeError(`Contribution is unavailable: ${contributionRef}`);
    found.region.bindings[found.bindingIndex] = {
      ...found.binding,
      component_ref: contribution.component_ref,
      contribution_ref: contribution.contribution_ref,
      ...(contribution.surface_ref ? { surface_ref: contribution.surface_ref } : {}),
      ...(contribution.portable_renderer ? { portable_renderer: contribution.portable_renderer } : {}),
      props: { ...clone(contribution.default_props), ...clone(found.binding.props) },
      fallback: clone(contribution.fallback),
      provenance: contribution.provenance.length ? clone(contribution.provenance) : clone(found.binding.provenance),
    };
  } else if (type === 'move-region') {
    const found = findRegion(next, nonEmpty(operation.region_ref, 'region_ref'));
    const [region] = next.regions.splice(found.index, 1);
    const at = Number.isInteger(operation.index) ? Math.max(0, Math.min(operation.index, next.regions.length)) : next.regions.length;
    next.regions.splice(at, 0, region);
  } else if (type === 'edit-region') {
    const found = findRegion(next, nonEmpty(operation.region_ref, 'region_ref'));
    if (operation.label !== undefined) found.region.label = String(operation.label);
    if (operation.role !== undefined) found.region.role = nonEmpty(operation.role, 'role');
  } else if (type === 'edit-theme') {
    next.theme = { ...next.theme, tokens: { ...next.theme.tokens, ...clone(record(operation.tokens ?? {}, 'tokens')) } };
  } else {
    throw new TypeError(`Unsupported presentation authoring operation: ${type}`);
  }

  return validateWorldPresentation(next);
}

export function bindingAvailability(value, contributionField = [], rendererRegistry = {}) {
  const presentation = validateWorldPresentation(value);
  const contributions = normalizeContributionField(contributionField);
  return presentation.regions.flatMap((region) => region.bindings.map((binding) => {
    const contribution = binding.contribution_ref ? contributions.find((item) => item.contribution_ref === binding.contribution_ref) : undefined;
    const rendererKey = binding.portable_renderer ?? binding.component_ref;
    const rendererAvailable = Object.prototype.hasOwnProperty.call(rendererRegistry, rendererKey);
    return {
      region_ref: region.region_ref,
      binding_ref: binding.binding_ref,
      component_ref: binding.component_ref,
      contribution_ref: binding.contribution_ref ?? null,
      surface_ref: binding.surface_ref ?? null,
      renderer_key: rendererKey,
      renderer_available: rendererAvailable,
      contribution_available: contribution ? contribution.available : null,
      degraded: contribution ? contribution.degraded : false,
      reason: contribution?.reason ?? (!rendererAvailable ? 'renderer unavailable on this Surface' : null),
    };
  }));
}
