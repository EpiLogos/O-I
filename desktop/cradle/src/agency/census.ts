/**
 * The agents on this machine, as the window reads them: the census (kernel census.rs, the World Model's agents slice; O-I #1003).
 * One row per agent harness Actuation detects, with whether it starts here (its version) and whether a person can talk to it (it starts
 * and AIKit opens a conversation with it), or why not. AIKit adds detail to a row, never a row: a conversation's route choices are the
 * census's agents a person can talk to, each carrying the owner's provider facts when AIKit has them.
 */
import {useModelSlice,type ModelSliceReading} from "../../../../packages/live-shell/ui/src/owners/model";
import type {KernelTransportStatus} from "../kernel/types";
import type {ConnectionFacts} from "../agent/chat/harness";
import {harnessName} from "../agent/chat/harness";

/** One census row: an agent harness, whether it starts and whether a person can talk to it, and AIKit's detail on it when AIKit has
 * some. */
export interface CensusAgent {
  slug: string;
  harnessRef: string;
  executable: string | null;
  starts: boolean;
  /** It starts and AIKit opens a conversation with it (census.rs `talks`). */
  talks: boolean;
  /** What the agent answered when started: its version. */
  version?: string;
  /** Why a person cannot talk to it — it does not start, or AIKit opens no conversation with it — in words. */
  why?: string;
  /** AIKit's client row for it (installed, its folder), when AIKit lists one. */
  aikit: Record<string, unknown> | null;
}

export type CensusReading = {state: "reading"} | {state: "unavailable"; why: string} | {state: "read"; agents: CensusAgent[]};

const text = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value : undefined);

/** The census in the agents slice as the window holds it. Pure. */
export function censusOf(reading: ModelSliceReading): CensusReading {
  if (reading.state === "reading") return {state: "reading"};
  if (reading.state === "unavailable") return {state: "unavailable", why: reading.reason};
  const answer = reading.answer;
  if (answer.state !== "read" && answer.state !== "stale") return {state: "unavailable", why: answer.error ?? "The agents on this machine have not been read."};
  const rows = (answer.value as {agents?: unknown} | null)?.agents;
  if (!Array.isArray(rows)) return {state: "unavailable", why: "The agents reading names no agents."};
  const agents: CensusAgent[] = [];
  for (const raw of rows) {
    const row = (raw ?? {}) as Record<string, unknown>;
    const slug = text(row.slug);
    if (!slug) continue;
    const aikit = row.aikit && typeof row.aikit === "object" && !Array.isArray(row.aikit) ? row.aikit as Record<string, unknown> : null;
    agents.push({slug, harnessRef: text(row.harness_ref) ?? `harness/${slug}`, executable: text(row.executable) ?? null, starts: row.starts === true, talks: row.talks === true,
      ...(text(row.version) ? {version: text(row.version)} : {}), ...(text(row.why) ? {why: text(row.why)} : {}), aikit});
  }
  return {state: "read", agents};
}

/** The census, kept current by the World Model's `model_changed`. */
export function useCensus(transport: KernelTransportStatus | null | undefined): CensusReading {
  return censusOf(useModelSlice(transport, "agents"));
}

/** An agent's name as a person reads it. */
export function agentName(agent: CensusAgent): string {
  return harnessName({id: agent.slug, label: agent.slug, command: agent.slug}) ?? agent.slug;
}

/** The census's agents a person can talk to. */
export function talkingAgents(census: CensusReading): CensusAgent[] {
  return census.state === "read" ? census.agents.filter(agent => agent.talks) : [];
}

/** A conversation's route choices: the agents a person can talk to, each with the owner's facts for it when AIKit's providers name it. The
 * provider id is the census slug (the kernel opens a census agent by its slug). Pure. */
export function censusConnections(census: CensusReading, providers: readonly ConnectionFacts[]): ConnectionFacts[] {
  return talkingAgents(census).map(agent => ({...providers.find(provider => provider.id === agent.slug), id: agent.slug, label: agentName(agent)}));
}
