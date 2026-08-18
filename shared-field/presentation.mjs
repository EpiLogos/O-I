export const WORLD_PRESENTATION_SCHEMA = 'oi.world-presentation/v1';
export const PRESENTATION_BINDING_SCHEMA = 'oi.presentation-binding/v1';

const WORLD_THEME_TOKENS = new Set([
  'surface',
  'foreground',
  'muted',
  'rule',
  'relation',
  'focus',
  'projection',
  'human',
  'agent',
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, name) {
  if (!isRecord(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function requireInteger(value, name, minimum = 1) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new TypeError(`${name} must be an integer >= ${minimum}`);
  }
  return value;
}

function assertAllowedKeys(value, allowed, name) {
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw new TypeError(`${name} contains unsupported keys: ${unexpected.join(', ')}`);
  }
}

function validateProvenance(provenance, name) {
  if (!Array.isArray(provenance) || provenance.length === 0) {
    throw new TypeError(`${name} must be a non-empty array`);
  }
  return provenance.map((entry, index) => {
    requireRecord(entry, `${name}[${index}]`);
    requireString(entry.kind, `${name}[${index}].kind`);
    requireString(entry.ref, `${name}[${index}].ref`);
    requireString(entry.source_system, `${name}[${index}].source_system`);
    if (entry.revision !== undefined) requireString(entry.revision, `${name}[${index}].revision`);
    return clone(entry);
  });
}

function validateTheme(theme = {}) {
  requireRecord(theme, 'world presentation.theme');
  const tokens = requireRecord(theme.tokens ?? {}, 'world presentation.theme.tokens');
  const validatedTokens = {};
  for (const [token, value] of Object.entries(tokens)) {
    if (!WORLD_THEME_TOKENS.has(token)) {
      throw new TypeError(`world presentation.theme.tokens cannot override shared-system token: ${token}`);
    }
    validatedTokens[token] = requireString(value, `world presentation.theme.tokens.${token}`);
  }

  return {
    tokens: validatedTokens,
    ...(theme.name ? { name: requireString(theme.name, 'world presentation.theme.name') } : {}),
  };
}

function validateBinding(input, regionRef, index) {
  requireRecord(input, `world presentation region ${regionRef} binding[${index}]`);
  const allowed = new Set([
    'schema',
    'binding_ref',
    'component_ref',
    'contribution_ref',
    'surface_ref',
    'projection_ref',
    'subject_ref',
    'portable_renderer',
    'props',
    'fallback',
    'provenance',
  ]);
  assertAllowedKeys(input, allowed, `world presentation region ${regionRef} binding[${index}]`);

  if (input.schema !== undefined && input.schema !== PRESENTATION_BINDING_SCHEMA) {
    throw new TypeError(`Unsupported presentation binding schema: ${input.schema}`);
  }

  const binding = {
    schema: PRESENTATION_BINDING_SCHEMA,
    binding_ref: requireString(input.binding_ref, `binding[${index}].binding_ref`),
    component_ref: requireString(input.component_ref, `binding[${index}].component_ref`),
    ...(input.contribution_ref
      ? { contribution_ref: requireString(input.contribution_ref, `binding[${index}].contribution_ref`) }
      : {}),
    ...(input.surface_ref ? { surface_ref: requireString(input.surface_ref, `binding[${index}].surface_ref`) } : {}),
    ...(input.projection_ref
      ? { projection_ref: requireString(input.projection_ref, `binding[${index}].projection_ref`) }
      : {}),
    ...(input.subject_ref ? { subject_ref: requireString(input.subject_ref, `binding[${index}].subject_ref`) } : {}),
    ...(input.portable_renderer
      ? { portable_renderer: requireString(input.portable_renderer, `binding[${index}].portable_renderer`) }
      : {}),
    props: clone(requireRecord(input.props ?? {}, `binding[${index}].props`)),
    fallback: clone(requireRecord(input.fallback ?? {}, `binding[${index}].fallback`)),
    provenance: validateProvenance(input.provenance, `binding[${index}].provenance`),
  };

  return binding;
}

function validateRegion(input, index) {
  requireRecord(input, `world presentation.regions[${index}]`);
  const allowed = new Set(['region_ref', 'role', 'label', 'bindings']);
  assertAllowedKeys(input, allowed, `world presentation.regions[${index}]`);

  const regionRef = requireString(input.region_ref, `world presentation.regions[${index}].region_ref`);
  const bindings = input.bindings ?? [];
  if (!Array.isArray(bindings)) throw new TypeError(`world presentation region ${regionRef}.bindings must be an array`);

  return {
    region_ref: regionRef,
    role: requireString(input.role, `world presentation region ${regionRef}.role`),
    ...(input.label ? { label: requireString(input.label, `world presentation region ${regionRef}.label`) } : {}),
    bindings: bindings.map((binding, bindingIndex) => validateBinding(binding, regionRef, bindingIndex)),
  };
}

/**
 * Portable presentation of one projected O:I world.
 *
 * This is deliberately a composition manifest, not a browser plugin runtime. It
 * references native Component / ComponentContribution / Surface identities and
 * carries only declarative renderer hints plus data. A client decides which
 * component implementations it accepts and falls back when one is unavailable.
 * Shared-system provenance/navigation tokens such as the sparse gold meta-layer
 * are intentionally not world-overridable here.
 */
export function createWorldPresentation(input) {
  requireRecord(input, 'world presentation');
  if (input.schema !== undefined && input.schema !== WORLD_PRESENTATION_SCHEMA) {
    throw new TypeError(`Unsupported world presentation schema: ${input.schema}`);
  }

  const allowed = new Set([
    'schema',
    'presentation_ref',
    'world_ref',
    'revision',
    'title',
    'summary',
    'theme',
    'regions',
    'provenance',
  ]);
  assertAllowedKeys(input, allowed, 'world presentation');

  const regions = input.regions ?? [];
  if (!Array.isArray(regions)) throw new TypeError('world presentation.regions must be an array');

  const presentation = {
    schema: WORLD_PRESENTATION_SCHEMA,
    presentation_ref: requireString(input.presentation_ref, 'world presentation.presentation_ref'),
    world_ref: requireString(input.world_ref, 'world presentation.world_ref'),
    revision: requireInteger(input.revision ?? 1, 'world presentation.revision'),
    title: requireString(input.title, 'world presentation.title'),
    ...(input.summary ? { summary: requireString(input.summary, 'world presentation.summary') } : {}),
    theme: validateTheme(input.theme ?? {}),
    regions: regions.map(validateRegion),
    provenance: validateProvenance(input.provenance, 'world presentation.provenance'),
  };

  const regionRefs = new Set();
  const bindingRefs = new Set();
  for (const region of presentation.regions) {
    if (regionRefs.has(region.region_ref)) throw new TypeError(`Duplicate presentation region ref: ${region.region_ref}`);
    regionRefs.add(region.region_ref);
    for (const binding of region.bindings) {
      if (bindingRefs.has(binding.binding_ref)) throw new TypeError(`Duplicate presentation binding ref: ${binding.binding_ref}`);
      bindingRefs.add(binding.binding_ref);
    }
  }

  return presentation;
}

export function validateWorldPresentation(value) {
  requireRecord(value, 'world presentation');
  if (value.schema !== WORLD_PRESENTATION_SCHEMA) {
    throw new TypeError(`Unsupported world presentation schema: ${value.schema}`);
  }
  return createWorldPresentation(value);
}

export function presentationBindings(value) {
  const presentation = validateWorldPresentation(value);
  return presentation.regions.flatMap((region) =>
    region.bindings.map((binding) => ({
      region_ref: region.region_ref,
      region_role: region.role,
      ...clone(binding),
    })),
  );
}

/**
 * Resolve only against an explicitly supplied local renderer registry.
 * No component URL/module is loaded from the presentation manifest.
 */
export function resolvePresentationBindings(value, rendererRegistry = {}) {
  const presentation = validateWorldPresentation(value);
  requireRecord(rendererRegistry, 'renderer registry');

  const regions = presentation.regions.map((region) => ({
    ...clone(region),
    bindings: region.bindings.map((binding) => {
      const key = binding.portable_renderer ?? binding.component_ref;
      const available = Object.prototype.hasOwnProperty.call(rendererRegistry, key);
      return {
        ...clone(binding),
        renderer_key: key,
        renderer_available: available,
      };
    }),
  }));

  return { ...clone(presentation), regions };
}

export function worldThemeCssVariables(value) {
  const presentation = validateWorldPresentation(value);
  const variables = {};
  for (const [token, tokenValue] of Object.entries(presentation.theme.tokens)) {
    variables[`--oi-world-${token}`] = tokenValue;
  }
  return variables;
}
