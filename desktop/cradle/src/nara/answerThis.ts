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
 * (readNativeAnswer, retainAnswerInFlow: the owner's CAS, the answer naming each passage it drew on and replying to the passage). */
import {encounter, type EncounterReading} from "../encounter/client";
import {htmlToText} from "../flow/instance";
import {readFlowInstance} from "../flow/instances";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import type {CurrentIdentity} from "./identity/current";
import {answerFromPages, lookupNativeDialogue, type NativeDialogue} from "./nativeDialogue";
import {readNativeAnswer, retainAnswerInFlow} from "./nativeReturn";
import {practiceOfFlow} from "./practice";

/** The project the Expressions frame's Nara channel binds its conversation under (expressions-boundary cradle.ts, panels/expressions.tsx
 * `project: 'O-I'`; the shell's M3 clock asks under the same, inhabitants/ql/devices/qlM3Clock.ts QL_M3_PROJECT). */
export const NARA_CHANNEL_PROJECT = "O-I";

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

/** Answer this: the passage asked of Nara from the person's pages, and the completed answer kept in the Flow with the passages it drew
 * on. Refuses, asking nothing, when no identity, Expression or bound conversation stands. */
export async function answerThis(input: AnswerThisInput, steps: Partial<AnswerThisSteps> = {}): Promise<{entryId: string; revision: string; already: boolean; passages: number}> {
  const s = {...STEPS, ...steps};
  if (!input.identity) throw new Error(ANSWER_NO_IDENTITY);
  if (!input.expressionRef) throw new Error(ANSWER_NO_EXPRESSION);
  const passage = passageOf(input.island, input.entryId);
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
  const answer = await s.read(input.transport, dialogue, block);
  const flow = await s.flow(input.transport, input.location);
  const kept = await s.retain(input.transport, flow, answer);
  return {entryId: kept.entryId, revision: kept.revision, already: kept.already, passages: lived.context.passages.length};
}
