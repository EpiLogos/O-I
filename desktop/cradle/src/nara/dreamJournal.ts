/** The dream journal (manual §24.2; T-WORLDS §6, W4): "a flow whose entries are dreams", kept in the dream journal's page in your ground —
 * "nothing is kept in the window alone". Pure: the dream journal's Flow read as the dreams the atlas's Dreams lens records
 * (projections/atlas/src/lenses/dreams.ts DreamEntry: date, title, text, context, answer), and each change the lens makes written as the
 * Flow's own kind of entry, so nothing earlier is rewritten:
 *   a new dream          the person's entry, its id the dream's: the dream, its date, its title and "your life at the time";
 *   a changed dream      a Correct entry on it (manual §18.1 "The earlier entry stays"): the dream as it now reads;
 *   what the dream adds  the person's reply to it: the latest reply stands as the answer, and the earlier ones stay;
 *   a removed dream      refused: a dream in your journal is kept, and corrected rather than erased;
 *   an amplification     Source entries on the dream (manual §24.2 "each as a Source entry with where it comes from"): each place the
 *                        image has stood before in the works your worlds hold, named with its source; it says what the image has
 *                        meant to others and leaves the meaning to you.
 * The shapes below are the ones this module writes; an entry the person wrote in the Flow itself, with no relation, reads as a dream of
 * its own words, dated by when it was written. */
import {appendEntry, htmlToText, parseInstance, textToHtml, type QlDoc} from "../flow/instance";
import type {Relation} from "../flow/plural";

/** A dream as the Dreams lens keeps it (projections/atlas/src/lenses/dreams.ts DreamEntry; practice/store.ts PracticeRecord). */
export interface DreamRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly date: string;
  readonly title: string;
  readonly text: string;
  readonly context: string;
  readonly answer: string;
}
type DreamBody = Pick<DreamRecord, "date" | "title" | "text" | "context">;

const escape = (s: string) => s.replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"})[c] as string);
const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A dream's entry html: its date, its title, the dream, and the life at the time. Pure. */
export function dreamHtml(dream: DreamBody): string {
  if (!dream.text.trim()) throw new Error("A dream has words: write the dream down first.");
  if (!DATE.test(dream.date)) throw new Error("A dream has the date it was dreamt.");
  return `<p class="dream-head"><time datetime="${escape(dream.date)}">${escape(dream.date)}</time>${dream.title.trim() ? ` · <strong>${escape(dream.title.trim())}</strong>` : ""}</p>`
    + `<div class="dream-text">${textToHtml(dream.text.trim())}</div>`
    + (dream.context.trim() ? `<p class="dream-context"><em>Your life at the time:</em> ${escape(dream.context.trim())}</p>` : "");
}

/** A dream read back from its entry html, or null for html this module did not write. Pure. */
export function readDreamHtml(html: string): DreamBody | null {
  const head = /^<p class="dream-head"><time datetime="([^"]*)">[^<]*<\/time>(?: · <strong>([\s\S]*?)<\/strong>)?<\/p>/.exec(html);
  const body = /<div class="dream-text">([\s\S]*?)<\/div>/.exec(html);
  if (!head || !body) return null;
  const context = /<p class="dream-context"><em>Your life at the time:<\/em> ([\s\S]*?)<\/p>/.exec(html);
  return {date: unescape(head[1]!), title: head[2] ? unescape(head[2]) : "", text: htmlToText(body[1]!), context: context ? unescape(context[1]!) : ""};
}

const ANSWER_HEAD = "<p class=\"dream-answer\"><em>What the dream adds:</em></p>";
/** The answer's entry html: what the person says the dream adds to the waking attitude, or that they have none now. Pure. */
export function answerHtml(answer: string): string {
  return `${ANSWER_HEAD}${answer.trim() ? textToHtml(answer.trim()) : "<p class=\"dream-answer-none\">No answer now.</p>"}`;
}
/** An answer read back, or null for html that is no answer. Pure. */
export function readAnswerHtml(html: string): string | null {
  if (!html.startsWith(ANSWER_HEAD)) return null;
  const rest = html.slice(ANSWER_HEAD.length);
  return rest.startsWith("<p class=\"dream-answer-none\">") ? "" : htmlToText(rest);
}

type Entry = QlDoc["entries"][number] & {relations?: Relation[]; authorKey?: string};
const relationsOf = (entry: Entry): Relation[] => entry.relations ?? (entry.replyTo ? [{type: "reply", entryId: entry.replyTo.entryId}] : []);
const personInitials = (doc: QlDoc): Set<string> => new Set((doc.meta.participants ?? []).filter(p => p.kind === "person").map(p => p.initial));

/** The dreams a dream journal holds, oldest first: each with its latest correction and its latest answer. Pure. */
export function dreamsOfFlow(doc: QlDoc): DreamRecord[] {
  const people = personInitials(doc);
  const entries = doc.entries as Entry[];
  const out: {record: DreamRecord}[] = [];
  const byId = new Map<string, {record: DreamRecord}>();
  for (const entry of entries) {
    const relations = relationsOf(entry);
    if (relations.length) continue;
    if (people.size && !people.has(entry.author)) continue;
    const read = readDreamHtml(entry.html) ?? {date: entry.at.slice(0, 10), title: "", text: htmlToText(entry.html), context: ""};
    if (!read.text.trim()) continue;
    const held = {record: {id: entry.id, createdAt: entry.at, updatedAt: entry.at, ...read, answer: ""}};
    out.push(held);
    byId.set(entry.id, held);
  }
  for (const entry of entries) {
    for (const relation of relationsOf(entry)) {
      const held = relation.entryId ? byId.get(relation.entryId) : undefined;
      if (!held) continue;
      if (relation.type === "correct") {
        const read = readDreamHtml(entry.html);
        if (read) held.record = {...held.record, ...read, updatedAt: entry.at};
      } else if (relation.type === "reply") {
        const answer = readAnswerHtml(entry.html);
        if (answer !== null) held.record = {...held.record, answer, updatedAt: entry.at};
      }
    }
  }
  return out.map(held => held.record);
}

/** One change to the journal, as the next entry the Flow takes. */
export type DreamWrite =
  | {readonly op: "dream"; readonly id: string; readonly dream: DreamBody}
  | {readonly op: "correct"; readonly id: string; readonly dream: DreamBody}
  | {readonly op: "answer"; readonly id: string; readonly answer: string};

export const DREAM_KEPT = "A dream in your journal is kept: correct it rather than erase it. Nothing was removed.";

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** The entries that take the journal from the dreams it holds to the dreams the lens now keeps: a new dream, a correction, an answer.
 * A dream the lens drops is refused before anything is written. Pure. */
export function planDreamWrites(before: readonly DreamRecord[], after: readonly unknown[]): DreamWrite[] {
  const next = after.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && typeof (item as {id?: unknown}).id === "string");
  const ids = new Set(next.map(item => item.id as string));
  if (before.some(dream => !ids.has(dream.id))) throw new Error(DREAM_KEPT);
  const held = new Map(before.map(dream => [dream.id, dream]));
  const writes: DreamWrite[] = [];
  for (const item of next) {
    const id = item.id as string;
    const body: DreamBody = {date: text(item.date), title: text(item.title), text: text(item.text), context: text(item.context)};
    const was = held.get(id);
    if (!was) {
      writes.push({op: "dream", id, dream: body});
      if (text(item.answer).trim()) writes.push({op: "answer", id, answer: text(item.answer)});
      continue;
    }
    if (body.date !== was.date || body.title.trim() !== was.title.trim() || body.text.trim() !== was.text.trim() || body.context.trim() !== was.context.trim())
      writes.push({op: "correct", id, dream: body});
    if (text(item.answer).trim() !== was.answer.trim()) writes.push({op: "answer", id, answer: text(item.answer)});
  }
  return writes;
}

/** The journal's html with one change appended through the Flow's own contract (flow/instance.ts appendEntry), as the person. Pure. */
export function applyDreamWrite(html: string, write: DreamWrite, now: Date = new Date()): string {
  const doc = parseInstance(html);
  if (write.op === "dream") {
    if (doc.entries.some(entry => entry.id === write.id)) return html;
    return appendEntry(html, write.dream.text, {html: dreamHtml(write.dream), entryId: write.id, operationRef: `dream:${write.id}`}, now).html;
  }
  if (!doc.entries.some(entry => entry.id === write.id)) throw new Error("The dream this changes is no longer in your dream journal.");
  const relation: Relation = {type: write.op === "correct" ? "correct" : "reply", entryId: write.id, revision: doc.meta.revision};
  return write.op === "correct"
    ? appendEntry(html, write.dream.text, {html: dreamHtml(write.dream), relations: [relation]}, now).html
    : appendEntry(html, write.answer, {html: answerHtml(write.answer), relations: [relation]}, now).html;
}

/** One place an image has stood before (projections/atlas/src/practice/amplify.ts: a dated instance of its family, its dreams and
 * visions first), with where it comes from: the works and locators the field cites for it. */
export interface AmplifiedPlace {
  readonly occurrenceId: string;
  readonly title: string;
  readonly when: string;
  readonly place: string;
  readonly kind: string;
  readonly sources: readonly {readonly ref: string; readonly label: string}[];
}

/** The operation a Source entry is written under: one per dream, image and place, so amplifying the same image again lays nothing twice. */
export const amplifyOperation = (dreamId: string, familyId: string, occurrenceId: string): string => `amplify:${dreamId}:${familyId}:${occurrenceId}`;

/** A Source entry's html: the image, the place it has stood before, and its sources. It interprets nothing. Pure. */
export function amplificationHtml(image: string, at: AmplifiedPlace): string {
  const where = [at.when, at.place].filter(part => part.trim()).map(escape).join(", ");
  return `<p class="dream-source"><strong>${escape(image)}</strong> has stood here before: ${escape(at.title)}${where ? ` (${where})` : ""}, a ${escape(at.kind)}.</p>`
    + `<p class="dream-source-from">${at.sources.length ? `From ${at.sources.map(source => escape(source.label)).join("; ")}.` : "The field names no source for it."}</p>`;
}

/** The journal's html with the Source entries of one amplification on a dream: each place not laid before, with its sources as the
 * entry's source relations. Pure. */
export function applyAmplification(html: string, dreamId: string, image: {familyId: string; name: string}, places: readonly AmplifiedPlace[], now: Date = new Date()): {html: string; laid: number} {
  let next = html, laid = 0;
  const doc = parseInstance(html);
  if (!doc.entries.some(entry => entry.id === dreamId)) throw new Error("The dream amplified is no longer in your dream journal.");
  const held = new Set((doc.entries as (Entry & {request?: {ref: string}})[]).map(entry => entry.request?.ref).filter(Boolean));
  for (const place of places) {
    const operationRef = amplifyOperation(dreamId, image.familyId, place.occurrenceId);
    if (held.has(operationRef)) continue;
    const current = parseInstance(next);
    const relations: Relation[] = [{type: "source", entryId: dreamId, ref: `atlas:occurrence:${place.occurrenceId}`, revision: current.meta.revision},
      ...place.sources.map(source => ({type: "source" as const, ref: source.ref}))];
    next = appendEntry(next, `${image.name}: ${place.title}`, {html: amplificationHtml(image.name, place), relations, operationRef}, now).html;
    laid++;
  }
  return {html: next, laid};
}
