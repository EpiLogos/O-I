/** Answer this, from Clip view (manual §18.1 "Answer this: Sends the packet and the passage to the agent on the world's chain. The answer
 * arrives as a new entry, with its sources"; §24.1 "Select a passage and choose Answer this, and Nara answers into the page from what you
 * wrote, naming each passage it used"; T-WORLDS §6, W4).
 *
 * Nara answers within a bound conversation, and a conversation is bound to an open Expression (nara_dialogue's binding: the person's
 * saved identity, the Expression, the role). The binding is found the way the Central chain finds it (central/devices/
 * useCentralReadings.ts useNaraReading: `lookupNativeDialogue`, never resolving a new one behind the person's back), under the project
 * the Expressions frame's Nara channel asks in. Where none can be bound, the act is refused in words that name what is missing.
 *
 * The selected entry's words are the passage. The page's practice places the turn in Nara's map (practice.ts practiceOfFlow: a journal,
 * a dream journal, a journey, a container, else an open conversation), and the kernel composes the lived context from the page
 * (nativeDialogue.ts answerFromPages). When Nara's turn has completed, the answer is kept in the Flow through nativeReturn.ts
 * (readNativeAnswer, retainAnswerInFlow: the owner's CAS, the answer naming each passage it drew on and replying to the passage).
 *
 * Arm decides how the answer arrives (manual §24.1 "Arm — Lets Nara write into your practice pages directly, each write with a receipt.
 * Off by default: every answer arrives as a proposal"; §19.4 "With Arm off, each change arrives as a proposal card; with Arm on, it lands
 * directly with a receipt"). The track's Arm is the shell's one write arm (frame/tracks/useCentralTracks.ts).
 *   Arm off   Nara answers in her conversation, and the completed answer is read back from it (readNativeAnswer: the turn completed, its
 *             basis this page's passage); nothing is written in the page. The answer waits on its page as a proposal (answerProposals).
 *   Arm on    the answer is written into the Flow on the revision read, and the write's receipt is read back from Central (the Flow read
 *             again holds exactly the entry kept). A proposal already waiting on the entry is the answer kept: Nara is not asked again. */
import {encounter, type EncounterReading} from "../encounter/client";
import {htmlToText} from "../flow/instance";
import {readFlowInstance} from "../flow/instances";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import type {CurrentIdentity} from "./identity/current";
import {answerFromPages, lookupNativeDialogue, type NativeDialogue} from "./nativeDialogue";
import {readNativeAnswer, retainAnswerInFlow} from "./nativeReturn";
import {practiceOfFlow} from "./practice";

/** The register the Expressions frame's Nara channel binds its conversation under: the world's own root register, the empty label every
 * agent op reads as the root (kernel/src/agent_prepared.rs `location`) — Nara answers for the world, never for one named project. The
 * shell's channel and M3 clock ask under the same (packages/live-shell/ui/src/agent/worldScope.ts NARA_CHANNEL_REGISTER; panels/expressions.tsx,
 * inhabitants/ql/devices/qlM3Clock.ts QL_M3_PROJECT). */
export const NARA_CHANNEL_PROJECT = "";

export const ANSWER_NO_IDENTITY = "Nara answers the person a saved identity names, and none is chosen: choose your identity in the Nara instrument, then Answer this again.";
export const ANSWER_NO_EXPRESSION = "Nara's conversation is bound to an open Expression, and none is open: open an Expression and bind Nara in its Nara instrument, then Answer this again.";
export const ANSWER_UNBOUND = "Nara has no conversation bound to this Expression yet: bind it in the Expression's Nara instrument, then Answer this again.";
export const ANSWER_NO_ENTRY = "Select an entry of the Flow first: Nara answers its words.";

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null);

/** The selected entry's words, from the page's island. Pure. */
export function passageOf(island: unknown, entryId: string): string {
  const entries = Array.isArray(record(island)?.entries) ? record(island)!.entries as unknown[] : [];
  const entry = entries.map(record).find(item => item?.id === entryId);
  const words = typeof entry?.html === "string" ? htmlToText(entry.html) : "";
  if (!words.trim()) throw new Error(ANSWER_NO_ENTRY);
  return words.trim();
}

/** The journey a passage is answered within, when the page is a journey's (nara/journey.ts; kernel/src/nara_journey.rs `meta.journey`). */
function journeyOf(location: CentralLocation, island: unknown): {location: CentralLocation; concern_ref: string; title: string} | undefined {
  const journey = record(record(record(island)?.meta)?.journey);
  const concern = record(journey?.concern);
  return concern && typeof concern.concern_ref === "string" && typeof concern.title === "string" ? {location, concern_ref: concern.concern_ref, title: concern.title} : undefined;
}

export interface AnswerThisInput {
  readonly transport: KernelTransportStatus;
  readonly identity: CurrentIdentity | null;
  readonly expressionRef: string | null;
  readonly location: CentralLocation;
  readonly island: unknown;
  readonly entryId: string;
  /** The project the conversation is bound under; the Nara channel's by default. */
  readonly project?: string;
  /** The track's Arm (the shell's write arm): on, the answer is written with a receipt; off (the default), it arrives as a proposal. */
  readonly arm?: boolean;
}

/** An answer that waits for you: Nara's completed answer in her conversation, read back from it, not yet written in its page. */
export interface AnswerProposal {
  readonly page: string;
  readonly location: CentralLocation;
  /** The entry it answers. */
  readonly entryId: string;
  readonly dialogue: NativeDialogue;
  readonly blockId: number;
  readonly agentSession: string;
  readonly answer: string;
  /** How many of your passages the answer was asked from. */
  readonly passages: number;
}

/** The receipt of an answer written in its page, as Central read it back. */
export interface AnswerReceipt {
  readonly page: string;
  readonly entryId: string;
  readonly revision: string;
  readonly already: boolean;
  readonly agent: "Nara" | "Epii";
  readonly agentSession: string;
  /** The entry it answers. */
  readonly answering: string;
  readonly passages: number;
}

export type AnswerOutcome = {readonly kind: "proposed"; readonly proposal: AnswerProposal} | {readonly kind: "written"; readonly receipt: AnswerReceipt};

/** The proposals that wait, by page. Held for the window: the answer itself stays in Nara's conversation, where it can be kept from the Nara
 * instrument as well. */
const waiting = new Map<string, AnswerProposal[]>();

/** The answers that wait on a page, oldest first. */
export function answerProposals(page: string): AnswerProposal[] {
  return [...(waiting.get(page) ?? [])];
}

function propose(proposal: AnswerProposal): void {
  const held = (waiting.get(proposal.page) ?? []).filter(p => p.blockId !== proposal.blockId || p.agentSession !== proposal.agentSession);
  waiting.set(proposal.page, [...held, proposal]);
}

function answered(page: string, entryId: string): void {
  const held = (waiting.get(page) ?? []).filter(p => p.entryId !== entryId);
  if (held.length) waiting.set(page, held); else waiting.delete(page);
}

/** What an Answer this came to, in words. Pure. */
export function answerWords(outcome: AnswerOutcome): string {
  if (outcome.kind === "proposed") return `${outcome.proposal.dialogue.role === "epii" ? "Epii" : "Nara"}'s answer is a proposal and waits for you: Arm is off, so nothing was written in the page. Arm the track and Answer this again to keep it, or keep it from the Nara instrument.`;
  const r = outcome.receipt;
  return `${r.agent} wrote ${r.agent === "Nara" ? "her" : "its"} answer into the page as entry ${r.entryId} at revision ${r.revision}, naming ${r.passages} of your passages: its receipt.${r.already ? " It was already kept." : ""}`;
}

export interface AnswerThisSteps {
  readonly lookup: typeof lookupNativeDialogue;
  readonly ask: typeof answerFromPages;
  readonly view: (transport: KernelTransportStatus, dialogue: NativeDialogue) => Promise<EncounterReading>;
  readonly read: typeof readNativeAnswer;
  readonly flow: typeof readFlowInstance;
  readonly retain: typeof retainAnswerInFlow;
  readonly sleep: (ms: number) => Promise<void>;
  /** How long Nara is waited for, and how often she is looked at. */
  readonly waitMs: number;
  readonly everyMs: number;
}

const STEPS: AnswerThisSteps = {
  lookup: lookupNativeDialogue, ask: answerFromPages,
  view: (transport, dialogue) => encounter<EncounterReading>(transport, dialogue.project, {action: "view", agent_session: dialogue.provisioning.agent_session}),
  read: readNativeAnswer, flow: readFlowInstance, retain: retainAnswerInFlow,
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)), waitMs: 5 * 60_000, everyMs: 1500,
};

const TERMINAL = new Set(["completed", "cancelled", "error"]);

/** The assistant block that answers the first question asked after `after`, once its turn has ended; null while it runs. Throws in words
 * when the turn ended without an answer. Pure. */
export function answeredBlock(blocks: readonly {id: number; kind: string; text: string}[], after: number): number | null {
  const asked = blocks.findIndex(block => block.id > after && block.kind === "user");
  if (asked < 0) return null;
  let answer: number | null = null;
  for (const block of blocks.slice(asked + 1)) {
    if (block.kind === "user") break;
    if (block.kind === "assistant" && answer === null && block.text.trim()) answer = block.id;
    if (TERMINAL.has(block.kind)) {
      if (block.kind !== "completed") throw new Error(`Nara's turn ended ${block.kind === "error" ? "in an error" : "cancelled"}: nothing was kept in the page. The question stays in the conversation.`);
      if (answer === null) throw new Error("Nara's turn completed with no answer: nothing was kept in the page.");
      return answer;
    }
  }
  return null;
}

/** Write an answer read back from Nara into its Flow, and read the receipt back from Central. */
async function keep(input: AnswerThisInput, s: AnswerThisSteps, dialogue: NativeDialogue, block: number, passages: number): Promise<AnswerOutcome> {
  const answer = await s.read(input.transport, dialogue, block);
  const flow = await s.flow(input.transport, input.location);
  const kept = await s.retain(input.transport, flow, answer);
  answered(input.location.ref, input.entryId);
  return {kind: "written", receipt: {page: input.location.ref, entryId: kept.entryId, revision: kept.revision, already: kept.already,
    agent: dialogue.role === "epii" ? "Epii" : "Nara", agentSession: dialogue.provisioning.agent_session, answering: input.entryId, passages}};
}

/** Answer this: the passage asked of Nara from the person's pages; with Arm on, the completed answer written in the Flow with the passages
 * it drew on and its receipt; with Arm off, the answer read back from Nara's conversation and left as a proposal. Refuses, asking nothing,
 * when no identity, Expression or bound conversation stands. */
export async function answerThis(input: AnswerThisInput, steps: Partial<AnswerThisSteps> = {}): Promise<AnswerOutcome> {
  const s = {...STEPS, ...steps};
  if (!input.identity) throw new Error(ANSWER_NO_IDENTITY);
  if (!input.expressionRef) throw new Error(ANSWER_NO_EXPRESSION);
  const passage = passageOf(input.island, input.entryId);
  // Armed, an answer already waiting on this entry is the one kept: Nara is not asked again.
  const proposal = input.arm ? answerProposals(input.location.ref).filter(p => p.entryId === input.entryId).at(-1) : undefined;
  if (proposal) return keep(input, s, proposal.dialogue, proposal.blockId, proposal.passages);
  const dialogue = await s.lookup(input.transport, input.project ?? NARA_CHANNEL_PROJECT, input.identity, input.expressionRef, "nara");
  if (!dialogue) throw new Error(ANSWER_UNBOUND);
  const before = await s.view(input.transport, dialogue);
  const after = before.blocks.reduce((last, block) => Math.max(last, block.id), -1);
  const meta = record(record(input.island)?.meta) ?? {};
  const journey = journeyOf(input.location, input.island);
  const {lived} = await s.ask(input.transport, {dialogue, identity: input.identity, expression_ref: input.expressionRef,
    answering: {location: input.location, entryId: input.entryId, passage}, practice: practiceOfFlow(meta), ...(journey ? {journey} : {})});
  let block: number | null = null;
  for (let waited = 0; block === null; waited += s.everyMs) {
    if (waited > s.waitMs) throw new Error("Nara has not finished answering yet: the question stands in the conversation, and its answer can be kept from the Nara instrument when it arrives. Nothing was written in the page.");
    await s.sleep(s.everyMs);
    block = answeredBlock((await s.view(input.transport, dialogue)).blocks, after);
  }
  const passages = lived.context.passages.length;
  if (input.arm) return keep(input, s, dialogue, block, passages);
  // Arm off: the answer is read back from Nara's conversation (its turn completed, its basis this passage) and waits on its page.
  const answer = await s.read(input.transport, dialogue, block);
  const proposed: AnswerProposal = {page: input.location.ref, location: input.location, entryId: input.entryId, dialogue, blockId: answer.blockId,
    agentSession: dialogue.provisioning.agent_session, answer: answer.answer, passages};
  propose(proposed);
  return {kind: "proposed", proposal: proposed};
}
