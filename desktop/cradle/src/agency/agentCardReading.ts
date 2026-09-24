/**
 * The human Agent card (`oi.human-agent-card/v1`) as the desktop receives it
 * from `oi agent card` through the kernel's `agent_card` op. The card is a
 * derived reading of AgentWorldParticipation — never identity authority,
 * never edited, never kept here. A change to intent, SkillSets,
 * participation or public disclosure re-derives it at the owners.
 */
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";

export type CitizenshipState = "established" | "partial" | "absent" | "unavailable";

export const CITIZENSHIP_DIMENSIONS = [
  "residence", "role", "repertoire", "reach", "authority", "relation",
  "contribution", "reciprocity", "reliability", "recognition", "continuity",
] as const;

export interface CardField {
  text?: string | null;
  refs?: string[];
  items?: string[];
  /** Present when the owner behind this field could not be read. */
  state?: "unavailable";
  command?: string | null;
  standing?: string;
}

export interface CitizenshipDimension {
  state: CitizenshipState;
  reading?: string | null;
  basis?: string[] | null;
  command?: string | null;
}

export interface HumanAgentCard {
  schema: "oi.human-agent-card/v1";
  identity: {name: string; agent_ref: string; profile_ref: string; revision: string; refs: string[]};
  why_im_here: CardField & {intent_expression?: string | null; role?: string | null};
  what_i_can_do: CardField;
  how_i_work: CardField;
  how_i_orient: CardField | null;
  what_i_carry: CardField & {skill_sets?: {ref: string; resolved: boolean | null; members?: number; withheld?: number}[]};
  where_i_participate: CardField & {world_ref: string; home_world_ref?: string | null; other_worlds?: string[]};
  citizenship: {summary: string; dimensions: Partial<Record<(typeof CITIZENSHIP_DIMENSIONS)[number], CitizenshipDimension>>; refs: string[]};
  currently: CardField;
  public?: {capabilities: {id: string; name: string; description?: string}[]; basis: string; refs: string[]};
}

export function isHumanAgentCard(value: unknown): value is HumanAgentCard {
  const card = value as HumanAgentCard | null;
  return !!card && card.schema === "oi.human-agent-card/v1" && typeof card.identity?.agent_ref === "string";
}

/** Every dimension in declared order; an absent entry is shown as
 * unavailable rather than dropped, so a missing owner stays visible. */
export function citizenshipRows(card: HumanAgentCard): {name: string; dimension: CitizenshipDimension}[] {
  return CITIZENSHIP_DIMENSIONS.map((name) => ({
    name,
    dimension: card.citizenship.dimensions[name] ?? {state: "unavailable", reading: "Not present in the reading.", basis: []},
  }));
}

export async function readAgentCard(transport: KernelTransportStatus, agentRef: string, worldRef?: string | null): Promise<HumanAgentCard> {
  const result = await kernelOp(transport, {op: "agent_card", agent_ref: agentRef, world_ref: worldRef ?? null});
  if (result.error || result.outcome?.result !== "agent_card_reading") throw new Error(result.error ?? "O:I returned no Agent card");
  if (!isHumanAgentCard(result.outcome.data)) throw new Error("O:I answered without an oi.human-agent-card/v1 reading");
  return result.outcome.data;
}
