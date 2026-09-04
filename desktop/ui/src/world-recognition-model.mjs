// World-recognition presentation model.
//
// The reconciled World account (`oi.world-recognition-account/v1`) is the same
// structured actuality the CLI and the Agent JSON surface expose. This module
// builds a render-only model from it so the desktop can disclose the World
// without inventing desktop-local semantics. It is pure: same account in,
// deterministic model out, no native bridge, no authority, no state.

export const WORLD_RECOGNITION_SCHEMA = 'oi.world-recognition-account/v1';

const KNOWN_KINDS = {
  harness: 'harness',
  'model-provider': 'model-provider',
  'working-environment': 'working-environment',
  'material-executor': 'material-executor',
  tool: 'tool',
};

function text(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  return fallback;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function systemKindLabel(kind) {
  return KNOWN_KINDS[kind] ?? kind ?? 'system';
}

function systemSummary(system) {
  const version = system.version ? ` · ${system.version}` : '';
  const locator = system.locator ? ` · ${system.locator}` : '';
  return `${systemKindLabel(system.kind)}${version}${locator}`;
}

function ownerBindingSummary(bindings) {
  return list(bindings).map((binding) => ({
    owner: text(binding.owner),
    contract: text(binding.contract),
    state: text(binding.state),
    canonical_ref: binding.canonical_ref ?? null,
  }));
}

function degradedFacts(observation) {
  const facts = observation.facts ?? {};
  const degraded = facts.degraded === true;
  const extra = Object.entries(facts)
    .filter(([key]) => key !== 'degraded')
    .map(([key, value]) => ({ key, value }));
  return { degraded, extra };
}

function ownerFor(observation) {
  const bindings = list(observation.owner_bindings);
  if (bindings.length === 0) return null;
  return bindings.map((binding) => text(binding.owner)).filter(Boolean).join(', ');
}

/**
 * @param {unknown} account the serialized `oi.world-recognition-account/v1`
 * @returns a render-only model, or null when the account is not a World account.
 */
export function buildWorldRecognitionModel(account) {
  if (!account || typeof account !== 'object') return null;
  if (text(account.schema) !== WORLD_RECOGNITION_SCHEMA) return null;

  const observations = list(account.observations).map((observation) => {
    const system = observation.native_system ?? {};
    const { degraded, extra } = degradedFacts(observation);
    const owners = ownerFor(observation);
    return {
      observation_ref: text(observation.observation_ref),
      system_ref: text(system.system_ref),
      kind: text(system.kind),
      kind_label: systemKindLabel(system.kind),
      name: text(system.name),
      version: system.version ?? null,
      locator: system.locator ?? null,
      summary: systemSummary(system),
      support: text(observation.support),
      degraded,
      facts: extra,
      owners,
      owner_bindings: ownerBindingSummary(observation.owner_bindings),
      evidence: list(observation.evidence).map((entry) => ({
        kind: text(entry.kind),
        source: text(entry.source),
        detail: text(entry.detail),
      })),
    };
  });

  const participations = list(account.owner_participations).map((participation) => {
    const system = participation.native_system ?? {};
    return {
      owner: text(participation.owner),
      contract: text(participation.contract),
      state: text(participation.state),
      system: text(system.name),
      system_ref: text(system.system_ref),
      canonical_ref: participation.canonical_ref ?? null,
    };
  });

  const contracts = list(account.owner_contracts).map((contract) => ({
    owner: text(contract.owner),
    contract: text(contract.contract),
    field: text(contract.field),
  }));

  const capacities = list(account.owner_capacities).map((capacity) => ({
    owner: text(capacity.owner),
    capacity_ref: text(capacity.capacity_ref),
    ports: list(capacity.ports).map(text),
    state: text(capacity.state),
    health: list((capacity.facts ?? {}).health).map(text),
    offers_count: (capacity.facts ?? {}).offers_count ?? null,
  }));

  const frontier = list(account.extension_requests).map((request) => ({
    request_ref: text(request.request_ref),
    native_system_ref: text(request.native_system_ref),
    owner: text(request.owner),
    sdk: text(request.sdk),
    reason: text(request.reason),
  }));

  const providers = list(account.providers).map((provider) => ({
    provider_ref: text(provider.provider_ref),
    status: text(provider.status),
    detail: text(provider.detail),
  }));

  const degradedCount = observations.filter((observation) => observation.degraded).length;
  const boundCount = observations.filter((observation) => observation.owners).length;
  const unboundCount = observations.length - boundCount;

  return {
    schema: text(account.schema),
    target: text(account.target),
    observations,
    participations,
    contracts,
    capacities,
    frontier,
    providers,
    provider_errors: list(account.provider_errors).map(text),
    summary: {
      systems: observations.length,
      degraded: degradedCount,
      bound: boundCount,
      unbound: unboundCount,
      owners_participating: new Set(participations.map((participation) => participation.owner)).size,
      capacities: capacities.length,
      extension_gaps: frontier.length,
    },
  };
}
