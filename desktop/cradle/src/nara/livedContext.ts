/** Nara answers from your pages (manual §24.1 "Select a passage and choose Answer this, and Nara answers into the page from what
 * you wrote, naming each passage it used"; T-WORLDS §6, W4).
 *
 * The kernel's `nara_lived_context` (desktop/cradle/kernel/src/nara_lived_context.rs) reads the chosen pages and the Day from their
 * owners and has QL compose them (`nara.lived-context.compose`, `ql.nara-lived-context/v1`): each passage with its exact source,
 * revision, writer, time and why it was chosen. This module asks for it, carries it into Nara's turn, and adds each passage to the
 * turn's disclosure — the passages Nara reads are disclosed with the person's consent, and only those. The answer returns into the
 * Flow through nativeReturn.ts (retainAnswerInFlow, with the owner's CAS), naming each passage it drew on. Nara keeps no second
 * journal: nothing here is stored anywhere but the person's own pages. */
import {kernelOp} from "../kernel/bridge";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import type {DisclosedRef, NaraDialogueContext} from "./dialogueContext";
import {MAX_DISCLOSED_REFS} from "./dialogueContext";
import type {Practice} from "./practice";
import type {Relation} from "../flow/plural";

export type LivedPractice = "flow" | "journal" | "dreams";
export interface LivedPageSelection {location: CentralLocation; practice?: LivedPractice; entries?: string[]}
export interface LivedConcern {concern_ref: string; title: string; terms?: string[]}
export interface LivedContextRequest {
  operation: "compose";
  subject_ref: string;
  concern: LivedConcern;
  pages?: LivedPageSelection[];
  day?: {day_ref?: string};
  journey?: CentralLocation;
  budget?: {max_passages: number; max_chars: number};
  disclosed_via_ref: string;
}
export interface LivedReason {reason: string; [detail: string]: unknown}
export interface LivedPassage {
  key: string; source_ref: string; revision: string; document_id: string | null; entry_id: string | null;
  contribution_id: string | null; selector: string | null; kind: string; actor: "human" | "agent" | "operational";
  author_ref: string; mode: string; standing: string; day_ref: string | null; occurred_at_unix_ms: number;
  received_at_unix_ms: number; late_receipt: boolean; unreviewed_revision: boolean; superseded_by: string | null;
  reasons: LivedReason[]; text: string;
}
export interface LivedContext {
  schema: "ql.nara-lived-context/v1"; context_revision: string; subject_ref: string; concern: LivedConcern;
  occasion: unknown; passages: LivedPassage[]; journey: unknown; disclosed: DisclosedRef[];
  attribution: {human: number; agent: number; operational: number}; candidates: number;
  omitted: {key: string; reason: string}[]; composed_at_unix_ms: number;
}
export interface LivedContextResult {
  schema: "oi.nara-lived-context/v1"; context: LivedContext; sources: unknown[];
  unread: {day_ref?: string | null; why: string}[]; skipped: {key: string; why: string}[];
}

/** The passage a person chose Answer this on: its page, its entry and its words. */
export interface Answering {location: CentralLocation; entryId: string; passage: string}

/** The lived context as Nara's turn carries it (`lived_context` of `oi.nara-dialogue-input/v1`). */
export interface LivedTurn {
  context_revision: string;
  concern: LivedConcern;
  answering: {page_ref: string; entry_id: string; passage: string} | null;
  passages: Pick<LivedPassage, "key" | "kind" | "actor" | "author_ref" | "standing" | "reasons" | "superseded_by" | "occurred_at_unix_ms" | "text">[];
  journey: unknown;
  omitted: {key: string; reason: string}[];
}

/** Ask the kernel to compose; a refusal comes back in its owner's words. */
export async function composeLivedContext(transport: KernelTransportStatus, request: LivedContextRequest): Promise<LivedContextResult> {
  const response = await kernelOp(transport, {op: "nara_lived_context", request});
  if (response.error || response.outcome?.result !== "nara_lived_context") throw new Error(response.error ?? "Nara's lived context did not answer.");
  const data = response.outcome.data;
  if (data.schema !== "oi.nara-lived-context/v1" || data.context?.schema !== "ql.nara-lived-context/v1"
    || data.context.subject_ref !== request.subject_ref || !Array.isArray(data.context.passages)) throw new Error("The lived context belongs to another person, or carries no passages.");
  return data;
}

/** Words too common to say what a passage is about. */
const COMMON = new Set(["that", "this", "with", "from", "have", "what", "when", "where", "which", "there", "their", "they", "them", "then",
  "than", "been", "were", "will", "would", "could", "should", "about", "into", "your", "just", "like", "some", "more", "very", "also",
  "only", "over", "such", "each", "does", "done", "here", "these", "those", "because", "while", "after", "before", "again", "still"]);

/** The words a passage asks about, as QL's concern takes them ("the words the person uses"): the passage itself, so the entry it
 * stands in is chosen, then its own words of four letters or more, once each, leaving the commonest out. At most 12. */
export function answerTerms(passage: string): string[] {
  const whole = passage.trim().replace(/\s+/g, " ").slice(0, 240);
  if (!whole) throw new Error("Choose the words Nara answers.");
  const words = [...new Set((whole.toLowerCase().match(/\p{L}[\p{L}'’-]*\p{L}/gu) ?? []).filter(word => word.length >= 4 && !COMMON.has(word)))];
  return [whole, ...words.filter(word => word !== whole.toLowerCase())].slice(0, 12);
}

/** The concern an Answer this asks: the chosen passage, in the person's own words, named by where it stands. */
export function answeringConcern(at: Answering): LivedConcern {
  return {concern_ref: `concern:answer:${at.location.ref}#${at.entryId}`, title: at.passage.trim().slice(0, 240), terms: answerTerms(at.passage)};
}

/** The material kind a page's passages are, by its practice. */
export function livedPracticeOf(practice: Practice): LivedPractice {
  return practice.kind === "journal" ? "journal" : practice.kind === "dreams" ? "dreams" : "flow";
}

/** The turn's copy of the composition: each passage by its key, with who wrote it, why it was chosen and its words. */
export function livedTurn(result: LivedContextResult, answering?: Answering): LivedTurn {
  const context = result.context;
  return {
    context_revision: context.context_revision,
    concern: context.concern,
    answering: answering ? {page_ref: answering.location.ref, entry_id: answering.entryId, passage: answering.passage} : null,
    passages: context.passages.map(({key, kind, actor, author_ref, standing, reasons, superseded_by, occurred_at_unix_ms, text}) =>
      ({key, kind, actor, author_ref, standing, reasons, superseded_by, occurred_at_unix_ms, text})),
    journey: context.journey ?? null,
    omitted: context.omitted,
  };
}

/** The turn's context with each passage QL disclosed added to what Nara may read, by the person's consent (QL's own disclosed refs). */
export function withLivedDisclosure(context: NaraDialogueContext, lived: LivedContext): NaraDialogueContext {
  const held = new Set(context.disclosed.map(entry => entry.ref_id));
  const added = lived.disclosed.filter(entry => !held.has(entry.ref_id));
  if (context.disclosed.length + added.length > MAX_DISCLOSED_REFS) throw new Error(`Nara reads at most ${MAX_DISCLOSED_REFS} disclosed sources in one turn: choose fewer passages.`);
  return {...context, disclosed: [...context.disclosed, ...added]};
}

/** The passages a retained answer names: read back from the turn Nara answered (nativeReturn.ts nativeAnswer). Refuses a turn whose
 * lived context is malformed rather than naming passages it cannot attest. */
export function livedOfInput(value: unknown): {context_revision: string; answering: LivedTurn["answering"]; passages: {key: string; kind: string; actor: string}[]} | null {
  if (value === undefined || value === null) return null;
  const lived = value as Partial<LivedTurn>;
  if (typeof lived.context_revision !== "string" || !Array.isArray(lived.passages)
    || lived.passages.some(passage => !passage || typeof passage.key !== "string" || !passage.key)) throw new Error("The recorded question carries a lived context with no passage identity.");
  return {context_revision: lived.context_revision, answering: lived.answering ?? null,
    passages: lived.passages.map(passage => ({key: passage.key, kind: String(passage.kind), actor: String(passage.actor)}))};
}

/** The passages a retained answer names (nativeAnswer's `basis.lived`). */
export type RetainedLived = NonNullable<ReturnType<typeof livedOfInput>>;

/** The answer's passages as the retained entry names them: each by its key (its page, entry and revision), its kind and who wrote it
 * (manual §24.1, "naming each passage it used"). Empty when Nara was not asked from the person's pages. */
export function drawnFromHtml(lived: RetainedLived | null | undefined, escape: (text: string) => string): string {
  const passages = lived?.passages ?? [];
  if (!passages.length) return "";
  return `<p><strong>Drawn from your pages</strong></p><ol>${passages.map(passage =>
    `<li><code>${escape(passage.key)}</code> · ${escape(passage.kind)} · ${escape(passage.actor)}</li>`).join("")}</ol>`;
}

/** How a retained answer stands among a Flow's entries (flow/plural.ts relations): a reply to the passage it answers when that passage
 * stands in this Flow, at the revision read, and a source relation to each passage it was drawn from. */
export function livedRelations(flow: {location: {ref: string}; doc: {entries: {id: string}[]; meta: {revision: number}}},
  lived: RetainedLived | null | undefined): {relations: Relation[]; replyTo?: {entryId: string; anchor: string | null}} {
  if (!lived) return {relations: []};
  const relations: Relation[] = [];
  const at = lived.answering;
  const reply = at && at.page_ref === flow.location.ref && flow.doc.entries.some(entry => entry.id === at.entry_id)
    ? {entryId: at.entry_id, anchor: at.passage.slice(0, 240) || null} : undefined;
  if (reply) relations.push({type: "reply", entryId: reply.entryId, anchor: reply.anchor, revision: flow.doc.meta.revision});
  for (const passage of lived.passages) relations.push({type: "source", ref: passage.key});
  return {relations, ...(reply ? {replyTo: reply} : {})};
}
