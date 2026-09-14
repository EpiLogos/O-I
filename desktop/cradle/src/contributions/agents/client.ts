import { kernelOp } from "../../kernel/bridge";
import type { ActionDispatch, KernelTransportStatus } from "../../kernel/types";

export type AgentProfile = Record<string, unknown> & {
  profile_ref?: string;
  agent_ref?: string;
  revision?: string;
  purpose?: string;
};
export type AgentSet = Record<string, unknown> & {
  ref?: string;
  revision?: string;
  members?: string[];
  orchestrator_agent_ref?: string | null;
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
  if (
    !profiles.data ||
    typeof profiles.data !== "object" ||
    !Array.isArray((profiles.data as Record<string, unknown>).profiles)
  ) {
    throw new Error("Central returned an invalid AgentProfile list");
  }
  if (
    !sets.data ||
    typeof sets.data !== "object" ||
    !Array.isArray((sets.data as Record<string, unknown>).records)
  ) {
    throw new Error("Central returned an invalid AgentSet list");
  }
  return {
    profiles: (profiles.data as { profiles: AgentProfile[] }).profiles,
    sets: (sets.data as { records: AgentSet[] }).records,
    observed_at_unix_ms: Date.now(),
  };
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
): Promise<unknown> {
  const result = await call(transport, project, "agent-profile.express", projectRef, {
    scope: "project",
    project,
    ...input,
  });
  if (result.state !== "invoked") {
    throw new Error("Central did not accept the AgentProfile expression");
  }
  return result.data;
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
