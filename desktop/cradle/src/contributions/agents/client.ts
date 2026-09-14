import { kernelOp } from "../../kernel/bridge";
import type { ActionDispatch, KernelTransportStatus } from "../../kernel/types";

export type AgentProfile = {
  schema: string;
  profile_ref: string;
  revision: string;
  agent_ref: string;
  scope: string;
  world_ref: string;
  role?: string | null;
  purpose?: string | null;
  governance_refs: string[];
  skill_refs: string[];
  skill_set_refs: string[];
  method_refs: string[];
  routine_refs: string[];
  ratified_world_refs: string[];
  knowledge_source_refs: string[];
  computer_access_intent_refs: string[];
  placement_intent_refs: string[];
  provenance_refs: string[];
  intent_provenance?: {
    schema: string;
    intent_expression: string;
    origin_action: string;
    authorship: string;
    recognition: string;
  } | null;
  source_path: string;
};
export type AgentSetMember =
  | { kind: "agent"; agent_ref: string }
  | { kind: "agent-set"; agent_set_ref: string };
export type AgentSet = {
  schema: string;
  ref: string;
  revision: string;
  members: AgentSetMember[];
  orchestrator_agent_ref?: string | null;
  correction?: unknown;
  source_path: string;
};
export type AgentProposal = {
  profile: Record<string, unknown>;
  intent_expression: string;
  authorship: string;
  recognition: string;
  human_recognised: boolean;
  read_path: Record<string, unknown>;
  receipt: Record<string, unknown>;
};

export type AgentRoster = {
  profiles: AgentProfile[];
  sets: AgentSet[];
  observed_at_unix_ms: number;
};
export type AgentWorld = {
  ref: string;
  revision?: string;
  parent?: string | null;
};

async function call(
  transport: KernelTransportStatus,
  project: string,
  action: string,
  targetRef: string,
  input: Record<string, unknown>,
): Promise<ActionDispatch> {
  const result = await kernelOp(transport, {
    op: "invoke_action",
    project,
    invocation: { action, target_ref: targetRef, input },
  });
  if (result.error) throw new Error(result.error);
  if (result.outcome?.result !== "action_dispatched") {
    throw new Error("Central returned no Action dispatch result");
  }
  return result.outcome.dispatch;
}

export async function readAgentRoster(
  transport: KernelTransportStatus,
  project: string,
  projectRef: string,
): Promise<AgentRoster> {
  const [profiles, sets] = await Promise.all([
    call(transport, project, "agent-profile.list", projectRef, {
      scope: "project",
      project,
    }),
    call(transport, project, "central.agent-set.list", projectRef, {
      scope: "project",
      project,
    }),
  ]);
  if (profiles.state !== "invoked") throw new Error("AgentProfile listing unavailable");
  if (sets.state !== "invoked") throw new Error("AgentSet listing unavailable");
  const profileRows = profiles.data && typeof profiles.data === "object"
    ? (profiles.data as { profiles?: unknown }).profiles
    : undefined;
  const setRows = sets.data && typeof sets.data === "object"
    ? (sets.data as { records?: unknown }).records
    : undefined;
  if (!Array.isArray(profileRows)) throw new Error("Central returned an invalid AgentProfile list");
  if (!Array.isArray(setRows)) throw new Error("Central returned an invalid AgentSet list");
  const decodedProfiles = profileRows.map((reading) => {
    if (!reading || typeof reading !== "object") throw new Error("Central returned an invalid AgentProfile reading");
    const row = reading as { profile?: unknown; source_path?: unknown };
    if (!row.profile || typeof row.profile !== "object" || typeof row.source_path !== "string") {
      throw new Error("Central returned an incomplete AgentProfile reading");
    }
    const profile = row.profile as Record<string, unknown>;
    const refLists = [
      "governance_refs", "skill_refs", "skill_set_refs", "method_refs",
      "routine_refs", "ratified_world_refs", "knowledge_source_refs",
      "computer_access_intent_refs", "placement_intent_refs", "provenance_refs",
    ];
    if (profile.schema !== "central.agent-profile/v1" ||
        typeof profile.ref !== "string" || typeof profile.revision !== "string" ||
        typeof profile.agent_ref !== "string" || typeof profile.world_ref !== "string" ||
        refLists.some((key) => !Array.isArray(profile[key]) ||
          !(profile[key] as unknown[]).every((value) => typeof value === "string"))) {
      throw new Error("Central returned an invalid AgentProfile record");
    }
    return { ...profile, profile_ref: profile.ref, source_path: row.source_path } as AgentProfile;
  });
  const decodedSets = setRows.map((reading) => {
    if (!reading || typeof reading !== "object") throw new Error("Central returned an invalid AgentSet reading");
    const row = reading as { ref?: unknown; revision?: unknown; source_path?: unknown; record?: unknown };
    if (typeof row.ref !== "string" || typeof row.revision !== "string" ||
        typeof row.source_path !== "string" || !row.record || typeof row.record !== "object") {
      throw new Error("Central returned an incomplete AgentSet reading");
    }
    const record = row.record as Record<string, unknown>;
    if (record.schema !== "central.agent-set/v1" || record.ref !== row.ref ||
        record.revision !== row.revision || !Array.isArray(record.members) ||
        !(record.members as unknown[]).every((member) => {
          if (!member || typeof member !== "object") return false;
          const value = member as { kind?: unknown; agent_ref?: unknown; agent_set_ref?: unknown };
          return value.kind === "agent"
            ? typeof value.agent_ref === "string" && value.agent_ref.trim() !== ""
            : value.kind === "agent-set" &&
              typeof value.agent_set_ref === "string" && value.agent_set_ref.trim() !== "";
        })) {
      throw new Error("Central returned an invalid AgentSet record");
    }
    return { ...record, ref: row.ref, revision: row.revision, source_path: row.source_path } as AgentSet;
  });
  return { profiles: decodedProfiles, sets: decodedSets, observed_at_unix_ms: Date.now() };
}

export async function readAgentWorlds(
  transport: KernelTransportStatus,
  project: string,
  projectRef: string,
): Promise<AgentWorld[]> {
  // World relations are the owner-persisted inventory. Read both registers:
  // project records overlay root records by their stable WorldRef.
  const [root, projectScope] = await Promise.all([
    call(transport, project, "central.world-relations.list", projectRef, {
      scope: "root",
    }),
    call(transport, project, "central.world-relations.list", projectRef, {
      scope: "project",
      project,
    }),
  ]);

  const decode = (result: ActionDispatch, scope: string): AgentWorld[] => {
    if (result.state !== "invoked") {
      throw new Error("Central World relation listing unavailable at " + scope + " scope");
    }
    const data = result.data;
    if (!data || typeof data !== "object" || !Array.isArray((data as { records?: unknown }).records)) {
      throw new Error("Central returned an invalid World relation list at " + scope + " scope");
    }
    return (data as { records: unknown[] }).records.map((reading) => {
      if (!reading || typeof reading !== "object") {
        throw new Error("Central returned an invalid World relation reading at " + scope + " scope");
      }
      const value = reading as {
        ref?: unknown;
        revision?: unknown;
        record?: unknown;
      };
      if (
        typeof value.ref !== "string" ||
        value.ref.trim() === "" ||
        typeof value.revision !== "string" ||
        value.revision.trim() === "" ||
        !value.record ||
        typeof value.record !== "object" ||
        Array.isArray(value.record)
      ) {
        throw new Error("Central returned an incomplete World relation reading at " + scope + " scope");
      }
      const record = value.record as {
        schema?: unknown;
        ref?: unknown;
        revision?: unknown;
        parent?: unknown;
      };
      if (
        record.schema !== "central.world-relations/v1" ||
        record.ref !== value.ref ||
        record.revision !== value.revision ||
        (record.parent !== null && typeof record.parent !== "string")
      ) {
        throw new Error("Central returned an inconsistent World relation reading at " + scope + " scope");
      }
      return {
        ref: value.ref,
        revision: value.revision,
        parent: record.parent as string | null | undefined,
      };
    });
  };

  const merged = new Map<string, AgentWorld>();
  for (const world of decode(root, "root")) merged.set(world.ref, world);
  for (const world of decode(projectScope, "project")) merged.set(world.ref, world);
  return [...merged.values()].sort((left, right) => left.ref.localeCompare(right.ref));
}

export interface AgentProfileExpression {
  world_ref: string;
  ratified_world_refs: string[];
  intent_expression: string;
  role?: string;
  purpose?: string;
}

export async function expressAgentProfile(
  transport: KernelTransportStatus,
  project: string,
  projectRef: string,
  input: AgentProfileExpression,
): Promise<AgentProposal> {
  const result = await call(transport, project, "agent-profile.express", projectRef, {
    scope: "project",
    project,
    ...input,
  });
  if (result.state !== "invoked" || !result.data || typeof result.data !== "object") {
    throw new Error("Central did not accept the AgentProfile expression");
  }
  const value = result.data as Record<string, unknown>;
  if (
    !value.profile || typeof value.profile !== "object" ||
    typeof value.intent_expression !== "string" ||
    typeof value.authorship !== "string" ||
    typeof value.recognition !== "string" ||
    typeof value.human_recognised !== "boolean" ||
    !value.read_path || typeof value.read_path !== "object" ||
    !value.receipt || typeof value.receipt !== "object"
  ) {
    throw new Error("Central returned an invalid AgentProfile proposal");
  }
  return value as unknown as AgentProposal;
}

export type SessionSpaceRequest =
  | { action: "discover"; project: string }
  | { action: "project_context" }
  | { action: "create"; id: string; label?: string }
  | { action: "stage"; space?: string; intent: unknown }
  | { action: "apply"; preview: unknown }
  | { action: "open"; space: string }
  | { action: "resolve_working"; space: string; agent_session: string; surface?: string };

export async function sessionSpace(
  transport: KernelTransportStatus,
  project: string,
  request: SessionSpaceRequest,
): Promise<unknown> {
  const result = await kernelOp(transport, { op: "session_space", project, request });
  if (result.error) throw new Error(result.error);
  if (result.outcome?.result !== "session_space_reading") {
    throw new Error("AIKit did not return a SessionSpace reading");
  }
  return result.outcome.data;
}
