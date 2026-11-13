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

/** One law statement a floor carries (Central's floor reading, central.floor-reading/v1): its file under the governance folder, its
 * topic and its standing. */
export interface LawStatement {file: string; topic: string; standing: string}

/** What an agent carries (census.rs carries_of; O-I #1003): the model AIKit asks for when a chat opens with it, the skill set it gets
 * (the Skill Sets AIKit selects and the skills they give it), and the law its floor carries (Central's floor reading of the instruction
 * file AIKit names for it). A part its owner does not answer says why. */
export interface AgentCarries {
  model: {id: string; name?: string; provider?: string} | {own: true; why: string} | {why: string};
  skills: {sets: string[]; skills: string[]} | {why: string};
  law: {file: string; state: "rendered" | "foreign" | "absent"; renderer?: string; statements: LawStatement[]; why?: string} | {file?: string; why: string};
}

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
  /** What it carries: its model, its skill set and its floor's law. Only an agent the census started carries anything. */
  carries?: AgentCarries;
}

export type CensusReading = {state: "reading"} | {state: "unavailable"; why: string} | {state: "read"; agents: CensusAgent[]};

const text = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value : undefined);
const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.flatMap(item => (text(item) ? [item as string] : [])) : []);

/** What a census row carries, as the kernel wrote it (census.rs carries_of); undefined for a row that carries nothing. A part the
 * kernel names no reading for says why. Pure. */
export function carriesOf(raw: unknown): AgentCarries | undefined {
  const row = record(raw);
  if (!row) return undefined;
  const model = record(row.model) ?? {}, skills = record(row.skills) ?? {}, law = record(row.law) ?? {};
  const why = (part: Record<string, unknown>, what: string) => text(part.why) ?? `The census says nothing of ${what}.`;
  const id = text(model.model_id), name = text(model.model_name), provider = text(model.native_provider);
  const file = text(law.file), state = law.state === "rendered" || law.state === "foreign" || law.state === "absent" ? law.state : undefined;
  const statements = Array.isArray(law.statements) ? law.statements.flatMap((item): LawStatement[] => {
    const statement = record(item), path = text(statement?.file);
    return statement && path ? [{file: path, topic: text(statement.topic) ?? path, standing: text(statement.standing) ?? "unknown"}] : [];
  }) : [];
  return {
    model: id ? {id, ...(name ? {name} : {}), ...(provider ? {provider} : {})} : model.own === true ? {own: true, why: why(model, "its model")} : {why: why(model, "its model")},
    skills: Array.isArray(skills.sets) ? {sets: strings(skills.sets), skills: strings(skills.skills)} : {why: why(skills, "its skill set")},
    law: file && state ? {file, state, ...(text(law.renderer) ? {renderer: text(law.renderer)} : {}), statements, ...(text(law.why) ? {why: text(law.why)} : {})}
      : {...(file ? {file} : {}), why: why(law, "the law it carries")},
  };
}

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
    const aikit = record(row.aikit), carries = carriesOf(row.carries);
    agents.push({slug, harnessRef: text(row.harness_ref) ?? `harness/${slug}`, executable: text(row.executable) ?? null, starts: row.starts === true, talks: row.talks === true,
      ...(text(row.version) ? {version: text(row.version)} : {}), ...(text(row.why) ? {why: text(row.why)} : {}), aikit, ...(carries ? {carries} : {})});
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
