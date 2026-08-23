export const SYSTEM_STATE_AXES = [
  'authored',
  'effective',
  'active',
  'staged',
  'expected_effect',
  'observed',
  'provenance',
];

export const SYSTEM_PRODUCTS = [
  {
    id: 'central',
    label: 'Central',
    owners: ['central'],
    authority: 'EpiLogos/Central',
    purpose: 'Human/project authored Ground, machines and native Actions.',
  },
  {
    id: 'actuation',
    label: 'Actuation',
    owners: ['actuation'],
    authority: 'EpiLogos/Actuation',
    purpose: 'Agency, realised Actuation, authority, Determination and Return.',
  },
  {
    id: 'ai-kit',
    label: 'AIKit',
    owners: ['ai-kit'],
    authority: 'EpiLogos/ai-kit',
    purpose: 'ContextResolution, resources, models, providers, credentials refs and harness composition.',
  },
  {
    id: 'factory',
    label: 'Software Factory',
    owners: ['factory', 'software-factory'],
    authority: 'EpiLogos/agent-system-design',
    purpose: 'Factory-native Run/build configuration, read state, Actions and evidence.',
  },
  {
    id: 'workcell',
    label: 'Workcell',
    owners: ['workcell'],
    authority: 'EpiLogos/Workcell',
    purpose: 'Providers, offers, bindings, services, storage, artifacts and material lifecycle.',
  },
  {
    id: 'ql-mef',
    label: 'Quaternal Logic',
    owners: ['ql-mef', 'quaternal-logic'],
    authority: 'EpiLogos/QL-MEF',
    purpose: 'Optional formal provider capabilities, readings and readiness.',
  },
];

const CURRENT_WORLD_PRODUCT_IDS = {
  central: 'central',
  actuation: 'actuation',
  'ai-kit': 'ai-kit',
  factory: 'software-factory',
  workcell: 'workcell',
  'ql-mef': 'quaternal-logic',
};
const CF5_POSITIONS = [0, 1, 2, 3, 4, 5];

const STATUS = {
  available: 'available',
  degraded: 'degraded',
  unavailable: 'unavailable',
  not_disclosed: 'not_disclosed',
  none: 'none',
  unsupported: 'unsupported',
};

function cell(status, summary, refs = []) {
  return { status, summary, refs: refs.filter(Boolean) };
}

function refText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    for (const key of ['ref', 'id', 'value', 'name', 'project_ref', 'projectRef']) {
      if (key in value && value[key] != null) return refText(value[key]);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function contributionEntries(input, product) {
  return (input.contributions ?? []).filter((entry) => product.owners.includes(entry?.contribution?.native_owner));
}

function provenanceRefs(entries) {
  return entries.map((entry) => {
    const provenance = entry.contribution.provenance ?? {};
    const revision = provenance.revision ? `@${provenance.revision}` : '';
    return `${provenance.source ?? entry.contribution.contribution_ref}${revision}`;
  });
}

function contributionActions(entries) {
  return entries.flatMap((entry) => (entry.contribution.actions ?? []).map((action) => ({
    action_ref: action.action_ref,
    native_owner: action.native_owner,
    availability: action.availability,
    required_capability_ref: action.required_capability_ref ?? null,
    source: entry.contribution.contribution_ref,
    authority: `native:${action.native_owner}`,
  })));
}

function contributionResources(entries) {
  return entries.flatMap((entry) => {
    const reading = entry.contribution.read_model_ref;
    if (!reading) return [];
    return [{
      resource_ref: reading.ref,
      kind: reading.kind,
      native_owner: reading.native_owner,
      availability: entry.contribution.availability,
      source: entry.contribution.contribution_ref,
    }];
  });
}

function availabilityLabel(value) {
  if (value == null) return 'unresolved';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.state === 'string') return value.state;
    const keys = Object.keys(value);
    if (keys.length === 1) return keys[0];
  }
  return 'unresolved';
}

function aikitResource(resource, category) {
  const descriptor = resource?.resource?.descriptor ?? {};
  return {
    resource_ref: refText(descriptor.id) || 'unidentified-resource',
    kind: refText(descriptor.kind) || category,
    native_owner: 'ai-kit',
    availability: availabilityLabel(resource?.availability),
    source: `ContextResolution.${category}`,
  };
}

function aikitResources(context) {
  if (!context || typeof context !== 'object') return [];
  const categories = [
    ['capabilities', 'capability'],
    ['actions', 'action'],
    ['context_sources', 'context_source'],
    ['model_candidates', 'model'],
    ['harness_candidates', 'harness'],
    ['execution_offers', 'execution_offer'],
  ];
  return categories.flatMap(([field, category]) => Array.isArray(context[field])
    ? context[field].map((resource) => aikitResource(resource, category))
    : []);
}

function aikitActions(context) {
  if (!context || typeof context !== 'object' || !Array.isArray(context.actions)) return [];
  return context.actions.map((resource) => {
    const descriptor = resource?.resource?.descriptor ?? {};
    return {
      action_ref: refText(descriptor.id) || 'unidentified-action',
      native_owner: 'ai-kit',
      availability: availabilityLabel(resource?.availability),
      required_capability_ref: null,
      source: 'ContextResolution.actions',
      authority: 'native:ai-kit-or-downstream-owner',
    };
  });
}

function observedAvailability(resources) {
  const counts = new Map();
  for (const resource of resources) {
    const key = resource.availability ?? 'unresolved';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (!resources.length) return 'No AIKit resource/provider availability was disclosed.';
  return [...counts.entries()].map(([key, value]) => `${value} ${key}`).join(' · ');
}

function factoryResources(snapshot) {
  if (!snapshot?.view) return [];
  const resources = [
    { resource_ref: snapshot.view.project?.projectRef, kind: 'project' },
    { resource_ref: snapshot.view.run?.runRef, kind: 'run' },
    { resource_ref: snapshot.view.run?.runMapRef, kind: 'run_map' },
    { resource_ref: snapshot.view.frontier?.subjectRef, kind: 'frontier' },
  ];
  for (const candidate of snapshot.view.candidates ?? []) resources.push({ resource_ref: candidate.candidateRef, kind: 'candidate' });
  for (const request of snapshot.view.humanRequests ?? []) resources.push({ resource_ref: request.humanRequestRef, kind: 'human_request' });
  for (const execution of snapshot.view.executions ?? []) resources.push({ resource_ref: execution.executionRef, kind: 'execution', availability: execution.status });
  return resources.filter((resource) => resource.resource_ref).map((resource) => ({
    ...resource,
    native_owner: 'factory',
    availability: resource.availability ?? 'observed',
    source: snapshot.provenance?.source ?? 'FactoryBuildSnapshot',
  }));
}

function factoryActions(snapshot) {
  return (snapshot?.view?.actions ?? []).map((action) => ({
    action_ref: action.actionRef,
    native_owner: 'factory',
    availability: 'discoverable',
    required_capability_ref: action.requiredCapabilityRef ?? null,
    source: 'factory.build-view/v1',
    authority: 'native:factory',
  }));
}

function contractObservation(entries, ownerLabel) {
  if (!entries.length) return cell(STATUS.not_disclosed, `No ${ownerLabel} native contribution is currently disclosed to the host.`);
  const ready = entries.filter((entry) => entry.contribution.availability === 'ready').length;
  const pending = entries.length - ready;
  return cell(
    ready > 0 && pending === 0 ? STATUS.available : STATUS.degraded,
    `${entries.length} native contribution contract${entries.length === 1 ? '' : 's'} disclosed (${ready} ready, ${pending} degraded/pending). Contract availability is not runtime activation.`,
    entries.map((entry) => entry.contribution.contribution_ref),
  );
}

function baseProduct(product, entries) {
  return {
    ...product,
    states: Object.fromEntries(SYSTEM_STATE_AXES.map((axis) => [axis, cell(STATUS.not_disclosed, 'No native owner reading disclosed for this axis.')])),
    actions: contributionActions(entries),
    resources: contributionResources(entries),
    contracts: entries.map((entry) => ({
      contribution_ref: entry.contribution.contribution_ref,
      target_contract: entry.contribution.target_contract ?? null,
      availability: entry.contribution.availability,
      detail: entry.contribution.detail ?? null,
    })),
  };
}

function centralProduct(input, product) {
  const entries = contributionEntries(input, product);
  const result = baseProduct(product, entries);
  result.states.authored = cell(STATUS.not_disclosed, 'Central remains the durable human/project authored-source authority. System does not copy authored Ground into an O:I settings store.', result.resources.map((r) => r.resource_ref));
  result.states.effective = cell(STATUS.not_disclosed, 'No Central effective machine/account/configuration reading is disclosed in this composition.');
  result.states.active = cell(STATUS.not_disclosed, 'No Central machine/process/account runtime observation is bound to this System reading.');
  result.states.staged = cell(STATUS.none, result.actions.some((action) => action.action_ref.includes('propose'))
    ? 'Central-native proposal Actions are discoverable, but no staged proposal/preview is loaded here.'
    : 'No staged Central change is disclosed.');
  result.states.expected_effect = cell(STATUS.none, 'Expected effect must come from a Central-native plan/preview or proposal receipt; none is disclosed.');
  result.states.observed = contractObservation(entries, 'Central');
  result.states.provenance = cell(entries.length ? STATUS.available : STATUS.not_disclosed, 'Native owner/contract provenance; authored content remains Central-owned.', provenanceRefs(entries));
  return result;
}

function actuationProduct(input, product) {
  const entries = contributionEntries(input, product);
  const result = baseProduct(product, entries);
  result.states.authored = cell(STATUS.not_disclosed, 'Canonical Agent, Agency, WorldBinding, authority and Return identity remain Actuation-owned; System does not mint or persist them.');
  result.states.effective = entries.some((entry) => entry.contribution.read_model_ref)
    ? cell(STATUS.degraded, 'An Actuation-owned Agency reading contract is addressable, but this composition does not expose a separate effective-configuration document.', result.resources.map((r) => r.resource_ref))
    : cell(STATUS.not_disclosed, 'No Actuation effective reading is disclosed.');
  result.states.active = cell(STATUS.not_disclosed, 'No realised Actuation / execution-authority observation is bound to P5; a contract descriptor must not be promoted to active agency.');
  result.states.staged = cell(STATUS.none, 'No staged Actuation determination or authority mutation is disclosed.');
  result.states.expected_effect = cell(STATUS.none, 'No Actuation-native preview/determination receipt is disclosed.');
  result.states.observed = contractObservation(entries, 'Actuation');
  result.states.provenance = cell(entries.length ? STATUS.available : STATUS.not_disclosed, 'Actuation contract provenance remains attached to the owner reading.', provenanceRefs(entries));
  return result;
}

function aikitProduct(input, product) {
  const entries = contributionEntries(input, product);
  const result = baseProduct(product, entries);
  const context = input.aikitContext;
  const resources = aikitResources(context);
  result.resources.push(...resources);
  result.actions.push(...aikitActions(context));
  result.states.authored = cell(STATUS.not_disclosed, 'Profile/scope/resource declarations remain AIKit-owned. System receives the resolved application object, not a second authored configuration store.');
  if (context && typeof context === 'object') {
    const profiles = Array.isArray(context.profiles) ? context.profiles.map(refText) : [];
    const actions = Array.isArray(context.actions) ? context.actions.length : 0;
    const capabilities = Array.isArray(context.capabilities) ? context.capabilities.length : 0;
    const models = Array.isArray(context.model_candidates) ? context.model_candidates.length : 0;
    const harnesses = Array.isArray(context.harness_candidates) ? context.harness_candidates.length : 0;
    result.states.effective = cell(STATUS.available, `AIKit ContextResolution: ${capabilities} capabilities · ${actions} Actions · ${models} models · ${harnesses} harnesses.`, [context.version, ...profiles]);
    result.states.observed = cell(STATUS.available, observedAvailability(resources), resources.filter((resource) => resource.availability !== 'available').map((resource) => resource.resource_ref));
  } else {
    result.states.effective = cell(STATUS.not_disclosed, 'No AIKit ContextResolution was supplied by the native integration.');
    result.states.observed = contractObservation(entries, 'AIKit');
  }
  const runtime = entries.find((entry) => entry.contribution.contribution_ref === 'aikit.session-space/read-model');
  result.states.active = runtime?.contribution?.availability === 'ready'
    ? cell(STATUS.available, 'A target-owned SessionSpace observation is bound. Inspect the native AIKit reading for exact lifecycle/authority state.', [runtime.contribution.contribution_ref])
    : cell(STATUS.not_disclosed, 'No target-owned SessionSpace runtime observation is bound. Effective ContextResolution does not prove material activation.');
  result.states.staged = cell(STATUS.none, 'ContextResolution carries effective state, not an unconfirmed composition preview. No AIKit staged preview is disclosed here.');
  result.states.expected_effect = cell(STATUS.none, 'Expected effect requires an AIKit-native stage/preview/explain receipt. System does not derive one from effective state.');
  result.states.provenance = cell(entries.length || context ? STATUS.available : STATUS.not_disclosed, 'AIKit schema/resolution and contribution provenance remain owner-native.', [context?.version, ...provenanceRefs(entries)]);
  return result;
}

function factoryProduct(input, product) {
  const entries = contributionEntries(input, product);
  const result = baseProduct(product, entries);
  const snapshot = input.factoryBuild;
  result.resources.push(...factoryResources(snapshot));
  result.actions.push(...factoryActions(snapshot));
  result.states.authored = cell(STATUS.not_disclosed, 'Project/Run/RunMap canonical state remains Factory-owned; System only consumes the Factory read model.');
  if (snapshot?.view) {
    result.states.effective = cell(STATUS.available, `${snapshot.view.project.label} · ${snapshot.view.run.label} · frontier ${snapshot.view.frontier.mode}.`, [snapshot.view.project.projectRef, snapshot.view.run.runRef, snapshot.view.run.runMapRef]);
    const executions = snapshot.view.executions ?? [];
    result.states.active = executions.length
      ? cell(STATUS.available, `Factory reports ${executions.length} execution record${executions.length === 1 ? '' : 's'}: ${executions.map((execution) => `${execution.executionRef}=${execution.status}`).join(' · ')}`)
      : cell(STATUS.none, 'The Factory read model reports no execution records for this Run.');
    result.states.observed = cell(STATUS.available, `${snapshot.view.candidates?.length ?? 0} candidates · ${snapshot.view.humanRequests?.length ?? 0} human requests · ${executions.length} executions.`, [`factory revision ${snapshot.revision}`]);
    result.states.provenance = cell(STATUS.available, 'Factory-owned build-view provenance.', [snapshot.provenance?.source, `factory-state:${snapshot.provenance?.factoryStateRevision}`, `run:${snapshot.provenance?.runRevision}`, `run-map:${snapshot.provenance?.runMapRevision}`]);
  } else {
    result.states.effective = cell(STATUS.degraded, 'No live Factory Build provider is bound. The fallback contribution remains explicitly degraded.');
    result.states.active = cell(STATUS.not_disclosed, 'No Factory execution observation is available without a live Build provider.');
    result.states.observed = contractObservation(entries, 'Factory');
    result.states.provenance = cell(entries.length ? STATUS.available : STATUS.not_disclosed, 'Fallback contract provenance only; not a live Build snapshot.', provenanceRefs(entries));
  }
  result.states.staged = cell(STATUS.none, 'No Factory-native staged configuration preview is disclosed by the current Build read model.');
  result.states.expected_effect = cell(result.actions.length ? STATUS.degraded : STATUS.none, result.actions.length
    ? 'Factory Actions are discoverable, but expected effect remains owner-native until an Action-specific preview/receipt is available.'
    : 'No Factory expected-effect preview is disclosed.');
  return result;
}

function pendingProviderProduct(input, product, noun, optional = false) {
  const entries = contributionEntries(input, product);
  const result = baseProduct(product, entries);
  result.states.authored = cell(STATUS.not_disclosed, `${noun} declarations remain ${product.label}-owned; O:I does not copy them into a System settings database.`);
  result.states.effective = cell(STATUS.not_disclosed, `No ${product.label}-owned effective read model is bound to the desktop host.`);
  result.states.active = cell(STATUS.not_disclosed, `No ${product.label} live provider/material observation is bound.`);
  result.states.staged = cell(STATUS.none, `No ${product.label}-native staged change is disclosed.`);
  result.states.expected_effect = cell(STATUS.none, `No ${product.label}-native plan/preview result is disclosed.`);
  result.states.observed = entries.length
    ? cell(STATUS.degraded, `${product.label} contract/development provenance is known, but no live provider instance is observed.`, entries.map((entry) => entry.contribution.contribution_ref))
    : cell(optional ? STATUS.unsupported : STATUS.not_disclosed, optional
      ? `${product.label} is optional and no native provider adapter is present. Ordinary System operation remains available.`
      : `No ${product.label} provider reading is disclosed.`);
  result.states.provenance = cell(entries.length ? STATUS.available : STATUS.not_disclosed, `${product.label} native-owner provenance.`, provenanceRefs(entries));
  return result;
}

function constitutionFromCurrentWorld(currentWorld) {
  const available = Boolean(currentWorld && typeof currentWorld === 'object');
  const presentPositions = Array.isArray(currentWorld?.context_frame?.present_positions)
    ? [...currentWorld.context_frame.present_positions]
    : [];
  const positions = SYSTEM_PRODUCTS.map((product, canonicalPosition) => {
    const productId = CURRENT_WORLD_PRODUCT_IDS[product.id];
    const reading = Array.isArray(currentWorld?.positions)
      ? currentWorld.positions.find((entry) => entry?.product_id === productId)
      : undefined;
    return {
      system_product_id: product.id,
      product_id: productId,
      position: reading?.position ?? canonicalPosition,
      present: reading?.present === true,
      state: reading?.state ?? 'missing',
      native_owner: reading?.native_owner ?? product.authority,
      native_location: reading?.native_location ?? null,
      version: reading?.version ?? null,
    };
  });
  const exactMaximalPositions = presentPositions.length === CF5_POSITIONS.length
    && CF5_POSITIONS.every((position, index) => presentPositions[index] === position);
  const maximal = available
    && currentWorld?.context_frame?.maximal === true
    && currentWorld?.context_frame?.reading === 'cf5'
    && exactMaximalPositions
    && positions.every((position) => position.present);
  return {
    schema: currentWorld?.schema ?? 'oi.current-world/v1',
    available,
    reading: maximal ? 'cf5' : null,
    maximal,
    present_positions: presentPositions,
    positions,
    personal_ground: currentWorld?.personal_ground ?? null,
    current_machine: currentWorld?.current_machine ?? null,
  };
}

export function buildSystemWorkbench(input = {}) {
  const constitution = constitutionFromCurrentWorld(input.currentWorld);
  const products = SYSTEM_PRODUCTS.map((product) => {
    let result;
    switch (product.id) {
      case 'central': result = centralProduct(input, product); break;
      case 'actuation': result = actuationProduct(input, product); break;
      case 'ai-kit': result = aikitProduct(input, product); break;
      case 'factory': result = factoryProduct(input, product); break;
      case 'workcell': result = pendingProviderProduct(input, product, 'Provider/offer/binding/material-lifecycle'); break;
      case 'ql-mef': result = pendingProviderProduct(input, product, 'Formal provider/capability/readiness', true); break;
      default: throw new Error(`unknown System product ${product.id}`);
    }
    return {
      ...result,
      constitution: constitution.positions.find((position) => position.system_product_id === product.id),
    };
  });

  const gaps = products
    .filter((product) => ['not_disclosed', 'degraded', 'unsupported'].includes(product.states.observed.status))
    .map((product) => `${product.label}: ${product.states.observed.summary}`);
  const warnings = [...new Set([...(input.warnings ?? []), ...(input.currentWorld?.warnings ?? [])])];

  return {
    schema: 'oi.system-workbench/v1',
    state_axes: [...SYSTEM_STATE_AXES],
    condition: !constitution.available ? 'unavailable' : constitution.maximal ? 'cf5' : 'partial',
    constitution,
    ordinary_operation_blocked: false,
    products,
    warnings,
    gaps,
    invariants: [
      'CurrentWorld is the top-level six-product constitution reading.',
      'System is presentation/composition, never configuration authority.',
      'authored ≠ effective ≠ active ≠ staged ≠ expected effect ≠ observed.',
      'selected ≠ retrieved ≠ disclosed into Agent Context.',
      'Action discovery ≠ Action authority ≠ invocation.',
      'provider/material identity ≠ Project/Agent/Run identity.',
    ],
  };
}
