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
  const result = await call(transport, project, "central.world.project", projectRef, {
    project,
  });
  if (result.state !== "invoked") throw new Error("Project World projection unavailable");
  const data = result.data;
  if (!data || typeof data !== "object") {
    throw new Error("Central returned an invalid Project World projection");
  }
  const projected = (data as { project?: unknown }).project;
  if (!projected || typeof projected !== "object" ||
      (projected as { name?: unknown }).name !== project) {
    throw new Error("Central returned a Project World projection for a different Project");
  }
  // central.world.project is a projection reading; it does not expose a
  // recognized WorldRef inventory. Do not turn projectRef or a directory name
  // into a WorldRef here.
  return [];
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
