/**
 * Agency — receiving adapters for operations that have NO owner op yet
 * (COMMON-BRIEF: typed props/adapter interface + a named unavailable
 * state), plus the one real owner reading Agency renders directly:
 * `agency_read` (kernel/types.ts:209, result "agency_reading" at :284).
 *
 * Each adapter kind keeps exactly one registered source at a time (the
 * same single-slot registry shape as instrument/source.ts's
 * `registerFocusedInstrumentSource`, scaled down: Agency needs one active
 * search/inference/mint/guardian provider, not a multi-ref registry).
 * Nothing here is bound by default; an unregistered kind renders its own
 * named unavailable state in the component that needs it.
 */
import { kernelOp } from "../kernel/bridge";
import type { KernelTransportStatus } from "../kernel/types";
import type { AgencyReading, AgencySessionRow, AgentDraft, GuardianRecord, SetupProposalRecord } from "./agencyTypes";

// ---------------------------------------------------------------------------
// the real reading: agency_read

/** Read the project's SessionSpace agency exactly as EncounterList.tsx and
 * SettingsPage.tsx already cast it — one place, so a shape change is fixed
 * once. A reading that does not match the observed shape is skipped, never
 * fabricated into a row. */
export async function readAgency(transport: KernelTransportStatus, project: string): Promise<{ reading: AgencyReading } | { error: string }> {
  const result = await kernelOp(transport, { op: "agency_read", project });
  if (result.error || result.outcome?.result !== "agency_reading") {
    return { error: result.error ?? "AIKit SessionSpace reading unavailable" };
  }
  const outcome = result.outcome;
  const rows: AgencySessionRow[] = [];
  for (const raw of outcome.spaces) {
    const space = raw as { definition?: { id?: string }; label?: string; agent_sessions?: Record<string, { purpose?: string; agent_ref?: string }> };
    const spaceRef = space?.definition?.id;
    if (!spaceRef || !space.agent_sessions) continue;
    for (const [sessionRef, attachment] of Object.entries(space.agent_sessions)) {
      rows.push({ spaceRef, spaceLabel: space.label, sessionRef, purpose: attachment?.purpose, agentRef: typeof attachment?.agent_ref === "string" ? attachment.agent_ref : undefined, raw });
    }
  }
  return { reading: { projectRef: outcome.project_ref, harnessDisclosure: outcome.harness_disclosure, rows, observedAtUnixMs: outcome.observed_at_unix_ms } };
}

// ---------------------------------------------------------------------------
// receiving adapters — search

export interface SkillCandidate {
  ref: string;
  title: string;
  kind: "method" | "skill" | "skillset";
  revision: string;
  source: string;
  steward?: string;
  summary?: string;
  prerequisites: string[];
  targets: string[];
  fixture?: boolean;
}

export interface SkillSearchSource {
  search(
    query: { text: string; project?: string; scope?: string },
    signal: AbortSignal,
  ): Promise<{ candidates: SkillCandidate[]; coverage: "complete" | "partial" | "stale" | "unavailable"; reason?: string }>;
}

export interface SetupInferenceSource {
  propose(
    input: { intent: string; candidates: SkillCandidate[]; project?: string },
    signal: AbortSignal,
  ): Promise<SetupProposalRecord>;
}

export interface AgentMintSource {
  validate(draft: AgentDraft): Promise<{ ok: boolean; problems: string[] }>;
  create(draft: AgentDraft): Promise<{ agentRef: string }>;
}

export interface GuardianSource {
  list(project?: string): Promise<GuardianRecord[]>;
  subscribe?(listener: () => void): () => void;
}

/** One registration slot: a kind Agency needs at most one active provider
 * for. `register` replaces the standing source (last registration wins,
 * matching how a single build wires one adapter); the returned function
 * un-registers only if it is still the current holder. */
function createSlot<T>() {
  let current: T | undefined;
  const listeners = new Set<() => void>();
  const announce = () => { for (const listener of listeners) listener(); };
  return {
    register(source: T): () => void {
      current = source;
      announce();
      return () => { if (current === source) { current = undefined; announce(); } };
    },
    get(): T | undefined { return current; },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    clear(): void { current = undefined; announce(); },
  };
}

const skillSearchSlot = createSlot<SkillSearchSource>();
const setupInferenceSlot = createSlot<SetupInferenceSource>();
const agentMintSlot = createSlot<AgentMintSource>();
const guardianSlot = createSlot<GuardianSource>();

export const registerSkillSearchSource = skillSearchSlot.register;
export const getSkillSearchSource = skillSearchSlot.get;
export const subscribeSkillSearchSource = skillSearchSlot.subscribe;

export const registerSetupInferenceSource = setupInferenceSlot.register;
export const getSetupInferenceSource = setupInferenceSlot.get;
export const subscribeSetupInferenceSource = setupInferenceSlot.subscribe;

export const registerAgentMintSource = agentMintSlot.register;
export const getAgentMintSource = agentMintSlot.get;
export const subscribeAgentMintSource = agentMintSlot.subscribe;

export const registerGuardianSource = guardianSlot.register;
export const getGuardianSource = guardianSlot.get;
export const subscribeGuardianSource = guardianSlot.subscribe;

/** Reset every slot — test/story isolation only, mirroring
 * `resetFocusedInstrumentSources`. Not used by production code paths. */
export function resetAgencySources() {
  skillSearchSlot.clear();
  setupInferenceSlot.clear();
  agentMintSlot.clear();
  guardianSlot.clear();
}
