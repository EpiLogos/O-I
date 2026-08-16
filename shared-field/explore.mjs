export const EXPLORE_ENTRY_SCHEMA = 'oi.explore-entry/v1';
export const EXPLORE_RELATION_VIEW_SCHEMA = 'oi.explore-relation-view/v1';
export const EXPLORE_RESULT_SCHEMA = 'oi.explore-result/v1';

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
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function requireInteger(value, name, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new TypeError(`${name} must be an integer >= ${minimum}`);
  return value;
}

function normalize(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function validateProvenance(provenance, name) {
  if (!Array.isArray(provenance) || provenance.length === 0) throw new TypeError(`${name} must be a non-empty array`);
  return provenance.map((entry, index) => {
    requireRecord(entry, `${name}[${index}]`);
    requireString(entry.kind, `${name}[${index}].kind`);
    requireString(entry.ref, `${name}[${index}].ref`);
    requireString(entry.source_system, `${name}[${index}].source_system`);
    if (entry.revision !== undefined) requireString(entry.revision, `${name}[${index}].revision`);
    return clone(entry);
  });
}

function validateLocator(locator, name) {
  requireRecord(locator, name);
  requireString(locator.surface, `${name}.surface`);
  requireString(locator.locator, `${name}.locator`);
  return clone(locator);
}

export function createExploreEntry(input) {
  requireRecord(input, 'explore entry');
  requireString(input.ref, 'explore entry.ref');
  requireString(input.kind, 'explore entry.kind');
  requireString(input.world_ref, 'explore entry.world_ref');
  requireString(input.label, 'explore entry.label');
  if (input.revision !== undefined) requireString(input.revision, 'explore entry.revision');
  if (input.summary !== undefined) requireString(input.summary, 'explore entry.summary');
  if (input.aliases !== undefined && !Array.isArray(input.aliases)) throw new TypeError('explore entry.aliases must be an array');
  if (input.locators !== undefined && !Array.isArray(input.locators)) throw new TypeError('explore entry.locators must be an array');

  return {
    schema: EXPLORE_ENTRY_SCHEMA,
    ref: input.ref,
    kind: input.kind,
    world_ref: input.world_ref,
    label: input.label,
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.revision ? { revision: input.revision } : {}),
    aliases: (input.aliases ?? []).map((alias, index) => requireString(alias, `explore entry.aliases[${index}]`)),
    provenance: validateProvenance(input.provenance, 'explore entry.provenance'),
    locators: (input.locators ?? []).map((locator, index) => validateLocator(locator, `explore entry.locators[${index}]`)),
    ...(input.projection_ref ? { projection_ref: requireString(input.projection_ref, 'explore entry.projection_ref') } : {}),
    ...(input.meta ? { meta: clone(requireRecord(input.meta, 'explore entry.meta')) } : {}),
  };
}

function validateRelation(input, index) {
  requireRecord(input, `relation[${index}]`);
  requireString(input.from, `relation[${index}].from`);
  requireString(input.to, `relation[${index}].to`);
  requireString(input.relation, `relation[${index}].relation`);
  requireString(input.origin, `relation[${index}].origin`);
  return {
    from: input.from,
    to: input.to,
    relation: input.relation,
    origin: input.origin,
    ...(input.direction ? { direction: requireString(input.direction, `relation[${index}].direction`) } : {}),
    provenance: validateProvenance(input.provenance, `relation[${index}].provenance`),
  };
}

function subsequenceScore(query, candidate) {
  if (!query) return 0;
  let qi = 0;
  for (let ci = 0; ci < candidate.length && qi < query.length; ci += 1) {
    if (candidate[ci] === query[qi]) qi += 1;
  }
  return qi === query.length ? Math.max(1, 30 - Math.max(0, candidate.length - query.length)) : 0;
}

function scoreCandidate(query, entry) {
  const q = normalize(query);
  if (!q) return 1;
  const fields = [entry.ref, entry.label, ...entry.aliases].map(normalize);
  let score = 0;
  for (const [index, field] of fields.entries()) {
    if (field === q) score = Math.max(score, index === 0 ? 130 : 120);
    else if (field.startsWith(q)) score = Math.max(score, index === 0 ? 105 : 100);
    else if (field.includes(q)) score = Math.max(score, index === 0 ? 85 : 80);
    else score = Math.max(score, subsequenceScore(q, field));
  }
  if (entry.summary) {
    const summary = normalize(entry.summary);
    if (summary.includes(q)) score = Math.max(score, 50);
  }
  return score;
}

export function createExploreApplication(seed = {}) {
  const entries = new Map();
  const relationEdges = (seed.relations ?? []).map(validateRelation);

  for (const rawEntry of seed.entries ?? []) {
    const entry = createExploreEntry(rawEntry);
    if (entries.has(entry.ref)) throw new TypeError(`Duplicate Explore ref: ${entry.ref}`);
    entries.set(entry.ref, entry);
  }

  for (const relation of relationEdges) {
    if (!entries.has(relation.from)) throw new TypeError(`Unknown relation source: ${relation.from}`);
    if (!entries.has(relation.to)) throw new TypeError(`Unknown relation target: ${relation.to}`);
  }

  function resolve(ref) {
    requireString(ref, 'ref');
    return clone(entries.get(ref));
  }

  function resolveLocator(locator, options = {}) {
    requireString(locator, 'locator');
    if (options.surface !== undefined) requireString(options.surface, 'locator surface');
    for (const entry of entries.values()) {
      const matched = entry.locators.find((candidate) =>
        candidate.locator === locator && (!options.surface || candidate.surface === options.surface));
      if (matched) return clone(entry);
    }
    return undefined;
  }

  function search(query = '', options = {}) {
    const limit = requireInteger(options.limit ?? 20, 'search limit', 1);
    const allowedKinds = options.kinds ? new Set(options.kinds) : undefined;
    const results = [...entries.values()]
      .filter((entry) => !options.world_ref || entry.world_ref === options.world_ref)
      .filter((entry) => !allowedKinds || allowedKinds.has(entry.kind))
      .map((entry) => ({ entry, score: scoreCandidate(query, entry) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label) || a.entry.ref.localeCompare(b.entry.ref))
      .slice(0, limit)
      .map(({ entry, score }) => ({
        schema: EXPLORE_RESULT_SCHEMA,
        ref: entry.ref,
        kind: entry.kind,
        world_ref: entry.world_ref,
        label: entry.label,
        ...(entry.summary ? { summary: entry.summary } : {}),
        ...(entry.revision ? { revision: entry.revision } : {}),
        provenance: clone(entry.provenance),
        locators: clone(entry.locators),
        score,
      }));
    return results;
  }

  function relationsFor(ref) {
    requireString(ref, 'ref');
    return relationEdges.filter((edge) => edge.from === ref || edge.to === ref).map(clone);
  }

  function localWhole(focusRef, options = {}) {
    requireString(focusRef, 'focus ref');
    const depth = requireInteger(options.depth ?? 1, 'relation depth', 0);
    const budget = requireInteger(options.budget ?? 24, 'relation budget', 1);
    if (!entries.has(focusRef)) return undefined;

    const selected = new Set([focusRef]);
    const selectedEdges = [];
    let frontier = [focusRef];
    let truncated = false;

    for (let currentDepth = 0; currentDepth < depth && frontier.length; currentDepth += 1) {
      const next = [];
      for (const ref of frontier) {
        for (const edge of relationEdges) {
          if (edge.from !== ref && edge.to !== ref) continue;
          const neighbour = edge.from === ref ? edge.to : edge.from;
          if (!selectedEdges.some((existing) => existing.from === edge.from && existing.to === edge.to && existing.relation === edge.relation)) {
            selectedEdges.push(clone(edge));
          }
          if (!selected.has(neighbour)) {
            if (selected.size < budget) {
              selected.add(neighbour);
              next.push(neighbour);
            } else {
              truncated = true;
            }
          }
        }
      }
      frontier = next;
    }

    return {
      schema: EXPLORE_RELATION_VIEW_SCHEMA,
      focus: focusRef,
      depth,
      budget,
      nodes: [...selected].map((ref) => clone(entries.get(ref))),
      edges: selectedEdges.filter((edge) => selected.has(edge.from) && selected.has(edge.to)),
      truncated,
    };
  }

  function sources(ref) {
    const resource = resolve(ref);
    if (!resource) return undefined;
    return {
      ref: resource.ref,
      ...(resource.revision ? { revision: resource.revision } : {}),
      provenance: clone(resource.provenance),
    };
  }

  function explain(ref) {
    const resource = resolve(ref);
    if (!resource) return undefined;
    return {
      ref: resource.ref,
      kind: resource.kind,
      world_ref: resource.world_ref,
      ...(resource.revision ? { revision: resource.revision } : {}),
      semantic_identity: {
        ref: resource.ref,
        kind: resource.kind,
        world_ref: resource.world_ref,
      },
      provenance: clone(resource.provenance),
      transport_locators: clone(resource.locators),
      ...(resource.projection_ref ? { projection_ref: resource.projection_ref } : {}),
    };
  }

  function open(ref, options = {}) {
    const resource = resolve(ref);
    if (!resource) return undefined;
    return {
      resource,
      relations: localWhole(ref, options),
      actions: ['open', 'inspect', 'traverse'],
    };
  }

  function surface(surfaceName, ref, options = {}) {
    requireString(surfaceName, 'surface name');
    const readModel = open(ref, options);
    if (!readModel) return undefined;
    return { surface: surfaceName, read_model: readModel };
  }

  return Object.freeze({
    resolve,
    resolveLocator,
    search,
    read: resolve,
    relations: localWhole,
    relationsFor,
    localWhole,
    sources,
    explain,
    open,
    surface,
  });
}
