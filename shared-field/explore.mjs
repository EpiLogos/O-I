export const EXPLORE_ENTRY_SCHEMA = 'oi.explore-entry/v1';
export const EXPLORE_RELATION_VIEW_SCHEMA = 'oi.explore-relation-view/v1';
export const EXPLORE_RESULT_SCHEMA = 'oi.explore-result/v1';
export const EXPLORE_MEMBERSHIP_SCHEMA = 'oi.explore-membership/v1';

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
    ...(input.relation_ref !== undefined ? {relation_ref:requireString(input.relation_ref, `relation[${index}].relation_ref`)} : {}),
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

function validateMembership(input) {
  if (input === undefined || input === null) return undefined;
  requireRecord(input, 'membership');
  const map = (value, name) => {
    requireRecord(value, name);
    const result = {};
    for (const [key, field] of Object.entries(value)) {
      requireString(key, `${name} key`);
      requireString(field, `${name}[${key}]`);
      result[key] = field;
    }
    return result;
  };
  const entry_fields = map(input.entry_fields ?? {}, 'membership.entry_fields');
  const relation_fields = map(input.relation_fields ?? {}, 'membership.relation_fields');
  return {
    schema: EXPLORE_MEMBERSHIP_SCHEMA,
    entry_fields,
    relation_fields,
  };
}

export function createExploreApplication(seed = {}) {
  const entries = new Map();
  const relationEdges = (seed.relations ?? []).map(validateRelation);
  const membership = validateMembership(seed.membership);

  for (const rawEntry of seed.entries ?? []) {
    const entry = createExploreEntry(rawEntry);
    if (entries.has(entry.ref)) throw new TypeError(`Duplicate Explore ref: ${entry.ref}`);
    entries.set(entry.ref, entry);
  }

  for (const relation of relationEdges) {
    if (!entries.has(relation.from)) throw new TypeError(`Unknown relation source: ${relation.from}`);
    if (!entries.has(relation.to)) throw new TypeError(`Unknown relation target: ${relation.to}`);
  }

  // Typed relation adjacency, derived once at index build: ref -> touching
  // edges, direction preserved. The index is derived and fully rebuildable;
  // the edges themselves stay the only relation state.
  const outgoing = new Map();
  const incoming = new Map();
  for (const edge of relationEdges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    outgoing.get(edge.from).push(edge);
    incoming.get(edge.to).push(edge);
  }

  // Alias -> ref resolution, derived from the entries' own admitted aliases.
  // Aliases are discovery aids, never a second identity: resolution returns
  // the canonical entry.
  const aliasIndex = new Map();
  for (const entry of entries.values()) {
    for (const alias of entry.aliases) {
      const key = normalize(alias);
      if (key && !aliasIndex.has(key)) aliasIndex.set(key, entry.ref);
    }
  }

  function resolve(ref) {
    requireString(ref, 'ref');
    return clone(entries.get(ref));
  }

  function resolveRefOrAlias(refOrAlias) {
    requireString(refOrAlias, 'ref');
    const direct = entries.get(refOrAlias);
    if (direct) return clone(direct);
    const alias = aliasIndex.get(normalize(refOrAlias));
    return alias ? clone(entries.get(alias)) : undefined;
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

  function fieldsFor(ref) {
    if (!membership) return [];
    const field = membership.entry_fields[ref];
    return field ? [field] : [];
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
        ...(entry.projection_ref ? { projection_ref: entry.projection_ref } : {}),
        ...(membership && membership.entry_fields[entry.ref] ? { field_refs: [membership.entry_fields[entry.ref]] } : {}),
        score,
      }));
    return results;
  }

  function relationsFor(ref) {
    requireString(ref, 'ref');
    const touching = [...(outgoing.get(ref) ?? []), ...(incoming.get(ref) ?? [])];
    return touching.map(clone);
  }

  function localWhole(focusRef, options = {}) {
    requireString(focusRef, 'focus ref');
    const depth = requireInteger(options.depth ?? 1, 'relation depth', 0);
    const budget = requireInteger(options.budget ?? 24, 'relation budget', 1);
    if (!entries.has(focusRef)) return undefined;

    const selected = new Set([focusRef]);
    const selectedEdges = [];
    const seenEdges = new Set();
    let frontier = [focusRef];
    let truncated = false;

    for (let currentDepth = 0; currentDepth < depth && frontier.length; currentDepth += 1) {
      const next = [];
      for (const ref of frontier) {
        for (const edge of [...(outgoing.get(ref) ?? []), ...(incoming.get(ref) ?? [])]) {
          const neighbour = edge.from === ref ? edge.to : edge.from;
          const edgeKey = `${edge.from}\u0000${edge.to}\u0000${edge.relation}`;
          if (!seenEdges.has(edgeKey)) {
            seenEdges.add(edgeKey);
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
    // The Projection an entry names rides `meta.projection_ref` for
    // publication-carried entries; surface it as Projection identity either way.
    const projectionRef = resource.projection_ref ?? resource.meta?.projection_ref;
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
      ...(projectionRef ? { projection_ref: projectionRef } : {}),
    };
  }

  function open(ref, options = {}) {
    const resource = resolve(ref);
    if (!resource) return undefined;
    return {
      resource,
      relations: localWhole(ref, options),
      ...(membership && membership.entry_fields[ref] ? { field_refs: [membership.entry_fields[ref]] } : {}),
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
    resolveRefOrAlias,
    resolveLocator,
    search,
    read: resolve,
    relations: localWhole,
    relationsFor,
    localWhole,
    fieldsFor,
    sources,
    explain,
    open,
    surface,
  });
}
