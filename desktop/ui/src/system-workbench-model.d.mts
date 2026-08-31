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
export type SystemConstitutionPosition = {
  system_product_id: string;
  product_id: string;
  position: number;
  present: boolean;
  state: string;
  native_owner: string;
  native_location: string | null;
  version: string | null;
};
export type SystemConstitution = {
  schema: string;
  available: boolean;
  reading: 'cf5' | null;
  maximal: boolean;
  present_positions: number[];
  positions: SystemConstitutionPosition[];
  personal_ground: string | null;
  current_machine: { role: string; central_source?: string; workcell_ref?: string; health?: string } | null;
};
export type SystemProduct = {
  id: string;
  label: string;
  owners: string[];
  authority: string;
  purpose: string;
  constitution: SystemConstitutionPosition;
  states: Record<SystemStateAxis, SystemStateCell>;
  actions: SystemAction[];
  resources: SystemResource[];
  contracts: Array<{ contribution_ref: string; target_contract: string | null; availability: string; detail: string | null }>;
};
export type SystemWorkbenchModel = {
  schema: 'oi.system-workbench/v1';
  state_axes: SystemStateAxis[];
  condition: 'unavailable' | 'partial' | 'cf5';
  constitution: SystemConstitution;
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
  currentWorld?: unknown;
  warnings?: string[];
}): SystemWorkbenchModel;
