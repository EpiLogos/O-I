/**
 * Reusable-team formation over the EXISTING Central native Actions
 * (`central.agent-set.propose` / `central.agent-set.save` /
 * `central.agent-set.resolve`). The kernel's `invoke_action` op is the one
 * dispatch seam; this module builds the owner-typed input and reads the
 * owner-typed outcome — it holds no second registry and mints nothing.
 *
 * Standing carried verbatim from the owner: a proposal is
 * generated-proposal/unrecognised source awaiting HUMAN recognition — it is
 * never an Agent, never authority, and never a durable team by itself.
 */
import type {ActionDispatch} from "../kernel/types";
import type {AgentDraft} from "./agencyTypes";

export const AGENT_SET_PROPOSE = "central.agent-set.propose";
export const AGENT_SET_RESOLVE = "central.agent-set.resolve";

/** One typed member entry, exactly the owner grammar:
 * `{kind: "agent", agent_ref}` or `{kind: "agent-set", agent_set_ref}`. */
export type AgentSetMember = {kind: "agent"; agent_ref: string} | {kind: "agent-set"; agent_set_ref: string};

export interface TeamProposalInput {
  action: string;
  target_ref: string;
  input:
    | {scope: "root" | "project"; project?: string; ref: string; revision: string; members: AgentSetMember[]; orchestrator_agent_ref?: string; reason?: string}
    | {scope: "root" | "project"; project?: string; ref: string; available_agents?: string[]};
}

/** A team ref is one plain name in Central's agent-set grammar (no colons,
 * no path parts); Central remains the authority and refuses with its own
 * words — this check only avoids a doomed dispatch. */
export function isWellFormedTeamRef(ref: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(ref);
}

export function teamProposalBuild(input: {
  draft: Pick<AgentDraft, "intentExpression">;
  project?: string;
  ref: string;
  revision: string;
  memberRefs: string[];
  orchestrator?: string;
}): TeamProposalInput {
  return {
    action: AGENT_SET_PROPOSE,
    target_ref: input.ref,
    input: {
      scope: input.project ? "project" : "root",
      ...(input.project ? {project: input.project} : {}),
      ref: input.ref,
      revision: input.revision,
      members: input.memberRefs.map(agent_ref => ({kind: "agent" as const, agent_ref})),
      ...(input.orchestrator ? {orchestrator_agent_ref: input.orchestrator} : {}),
      ...(input.draft.intentExpression.trim() ? {reason: input.draft.intentExpression.trim()} : {}),
    },
  };
}

export function teamResolveBuild(input: {project?: string; ref: string; availableAgents: string[]}): TeamProposalInput {
  return {
    action: AGENT_SET_RESOLVE,
    target_ref: input.ref,
    input: {
      scope: input.project ? "project" : "root",
      ...(input.project ? {project: input.project} : {}),
      ref: input.ref,
      ...(input.availableAgents.length > 0 ? {available_agents: input.availableAgents} : {}),
    },
  };
}

export interface TeamOutcomeRow {kind: "ok" | "refused" | "unavailable" | "unsupported"; text: string}

/** The owner's own answer, classified for display — never rewritten into a
 * success. A proposal reply carries authorship/recognition standing and the
 * read path back to the stored record. */
export function teamOutcomeRows(dispatch: ActionDispatch): TeamOutcomeRow[] {
  switch (dispatch.state) {
    case "invoked": {
      const data = dispatch.data as {
        authorship?: string; recognition?: string; human_recognised?: boolean;
        receipt?: {created?: boolean; source_path?: string};
        authored_agents?: string[]; resolved_agents?: string[]; unavailable_agents?: string[];
      };
      if (Array.isArray(data.resolved_agents)) {
        return [
          {kind: "ok", text: `Resolved ${data.resolved_agents.length} of ${data.authored_agents?.length ?? 0} authored members against declared availability.`},
          ...(data.unavailable_agents?.length ? [{kind: "refused" as const, text: `Unavailable here: ${data.unavailable_agents.join(", ")} — the authored record still carries them.`}] : []),
        ];
      }
      return [
        {kind: "ok", text: `Proposed composition stored${data.receipt?.source_path ? ` at ${data.receipt.source_path}` : ""}.`},
        {kind: "refused", text: `Standing: ${data.authorship ?? "generated-proposal"} / ${data.recognition ?? "unrecognised"} — human recognition has NOT been given. This composition is not an Agent and grants nothing; adopt or correct it through Central's authored source operations.`},
      ];
    }
    case "owner_refused":
      return [{kind: "refused", text: `${dispatch.owner_operation} refused: ${dispatch.message}`}];
    case "owner_unavailable":
      return [{kind: "unavailable", text: `${dispatch.owner_operation} is unreachable: ${dispatch.detail}`}];
    case "unsupported_action":
      return [{kind: "unsupported", text: `The native target does not support this operation through this surface (${dispatch.owner}): ${dispatch.detail}`}];
    case "malformed_ref":
      return [{kind: "refused", text: dispatch.detail}];
    case "unknown_owner":
      return [{kind: "unsupported", text: `No native owner answers to ${dispatch.action}`}];
  }
}
