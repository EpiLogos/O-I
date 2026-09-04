export type WorldRecognitionObservation = {
  observation_ref: string;
  system_ref: string;
  kind: string;
  kind_label: string;
  name: string;
  version: string | null;
  locator: string | null;
  summary: string;
  support: string;
  degraded: boolean;
  facts: Array<{ key: string; value: unknown }>;
  owners: string | null;
  owner_bindings: Array<{ owner: string; contract: string; state: string; canonical_ref: string | null }>;
  evidence: Array<{ kind: string; source: string; detail: string }>;
};

export type WorldRecognitionParticipation = {
  owner: string;
  contract: string;
  state: string;
  system: string;
  system_ref: string;
  canonical_ref: string | null;
};

export type WorldRecognitionContract = { owner: string; contract: string; field: string };

export type WorldRecognitionCapacity = {
  owner: string;
  capacity_ref: string;
  ports: string[];
  state: string;
  health: string[];
  offers_count: number | null;
};

export type WorldRecognitionFrontier = {
  request_ref: string;
  native_system_ref: string;
  owner: string;
  sdk: string;
  reason: string;
};

export type WorldRecognitionProvider = { provider_ref: string; status: string; detail: string };

export type WorldRecognitionModel = {
  schema: string;
  target: string;
  observations: WorldRecognitionObservation[];
  participations: WorldRecognitionParticipation[];
  contracts: WorldRecognitionContract[];
  capacities: WorldRecognitionCapacity[];
  frontier: WorldRecognitionFrontier[];
  providers: WorldRecognitionProvider[];
  provider_errors: string[];
  summary: {
    systems: number;
    degraded: number;
    bound: number;
    unbound: number;
    owners_participating: number;
    capacities: number;
    extension_gaps: number;
  };
};

export const WORLD_RECOGNITION_SCHEMA: 'oi.world-recognition-account/v1';
export function buildWorldRecognitionModel(account: unknown): WorldRecognitionModel | null;
