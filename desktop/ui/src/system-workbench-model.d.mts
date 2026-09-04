export type SystemStateStatus = 'available' | 'degraded' | 'unavailable' | 'not_disclosed' | 'none' | 'unsupported';
export type SystemStateAxis = 'authored' | 'effective' | 'active' | 'staged' | 'expected_effect' | 'observed' | 'provenance';
export type SystemStateCell = { status: SystemStateStatus; summary: string; refs: string[] };
export type SystemAction = {
  action_ref: string;
  native_owner: string;
  availability: string;
  required_capability_ref: string | null;
  source: string;
  authority: string;
};
export type SystemResource = {
  resource_ref: string;
  kind: string;
  native_owner: string;
  availability: string;
  source: string;
};
/** One owner's presence as the live composition reading observed it. */
export type SystemPresence = {
  /** `present | degraded | absent` as observed, or `not_disclosed`. */
  state: 'present' | 'degraded' | 'absent' | 'not_disclosed';
  state_word: string;
  provider_class: string;
  /** Capability descriptors — never read as presence. */
  capabilities: string[];
  detail: string | null;
  observed: boolean;
};
export type SystemComposition = {
  schema: 'oi.composition-reading/v1' | null;
  condition: string | null;
  constituents: Array<{ native_owner?: unknown; state?: unknown; provider_class?: unknown; capabilities?: unknown; detail?: unknown }>;
  counts: { present: number; degraded: number; absent: number };
  undisclosed: string[];
};
export type SystemProduct = {
  id: string;
  label: string;
  owners: string[];
  authority: string;
  purpose: string;
  presence: SystemPresence;
  states: Record<SystemStateAxis, SystemStateCell>;
  actions: SystemAction[];
  resources: SystemResource[];
  contracts: Array<{ contribution_ref: string; target_contract: string | null; availability: string; detail: string | null }>;
};
export type SystemWorkbenchModel = {
  schema: 'oi.system-workbench/v1';
  state_axes: SystemStateAxis[];
  condition: 'unavailable' | 'empty' | 'partial' | 'broken' | 'full';
  composition: SystemComposition;
  ordinary_operation_blocked: false;
  products: SystemProduct[];
  warnings: string[];
  gaps: string[];
  invariants: string[];
};
export const SYSTEM_STATE_AXES: SystemStateAxis[];
export const SYSTEM_PRODUCTS: Array<{ id: string; label: string; owners: string[]; authority: string; purpose: string }>;
export function buildSystemWorkbench(input?: {
  surfaces?: unknown[];
  contributions?: unknown[];
  aikitContext?: unknown;
  factoryBuild?: unknown;
  composition?: unknown;
  warnings?: string[];
}): SystemWorkbenchModel;
