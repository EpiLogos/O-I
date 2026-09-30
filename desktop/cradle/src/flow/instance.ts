import templateHtml from "../../documents/ql-flow.html?raw";
import {appendContribution, defaultParticipants, isCurrentFormat, legacyParticipantKey, type PluralEntry, type PluralParticipant, type Relation} from "./plural";
/** The ratified flow carrier (PROPOSAL-FLOW-DAY-LOGICS-2026-09-13-2): a flow
 * file is one self-contained instance of the 0/1 form — `entries` (the
 * conversational thread), `journal` pages, `notes`, `packet`, `media` — with
 * its identity in `meta.documentId` / `created` / `revision`. Since the
 * owner's 2026-09-26 correction the form is `ql-flow.html` v0.2 (authored in
 * conversation): no paste-an-agent-return intake, no seeded empty entry —
 * the flow is written, and the desktop appends entries through the
 * template's own contract; it never rewrites the html of an entry the human
 * has written. The received v0.1 demo shell stays at `ql-dialogue-flow.html`
 * as the intake record. */
export interface QlDocEntry {
  id: string;
  /** The declared initial of the participant who authored this entry.
   *  v0.3: any declared participant, not only the received F/H pair. */
  author: string;
  at: string;
  html: string;
  replyTo: { entryId: string; anchor: string | null } | null;
  touched: boolean;
  fromJournal?: string;
}
export interface QlDocParticipant {
  initial: string;
  name?: string;
  kind: "person" | "agent";
  /** Where a live agent identity came from: the session ref that answered. */
  ref?: string;
  /** v0.4: stable document-local key, independent of initial and name. */
  key?: string;
}
export interface QlDoc {
  meta: {
    documentId: string | null;
    created: string | null;
    title: string;
    revision: number;
    view: "dialogue" | "flow" | "journal";
    current: string | null;
    journalCurrent: string | null;
    exported: string | null;
    template: string;
    /** Declared participants (v0.3): the identities entries are authored
     * between. Absent in earlier documents — those keep the received F/H
     * reading. */
    participants?: QlDocParticipant[];
  };
  entries: QlDocEntry[];
  notes: unknown[];
  packet: unknown[];
  media: unknown[];
  journal: { id: string; at: string; html: string }[];
}
/** The document's declared participant for an initial, or the received F/H
 * reading of it — the same fallback the form itself applies. */
export function participantOf(doc: QlDoc, initial: string): QlDocParticipant {
  const declared = doc.meta.participants?.find(p => p.initial === initial);
  if (declared) return declared;
  return initial === "F" ? {initial, kind: "person", name: "the person"} : {initial, kind: "agent", name: initial === "H" ? "the agent" : ""};
}
const QL_DOC = /<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;
export function parseInstance(html: string): QlDoc {
  const match = html.match(QL_DOC);
  if (!match) throw new Error("This file is not a 0/1 dialogue/flow document — its embedded document state is missing.");
  return JSON.parse(match[1].replace(/<\\\/script/gi, "</script").replace(/<\\!--/g, "<!--")) as QlDoc;
}
export function embedDocument(shell: string, doc: QlDoc): string {
  if (!QL_DOC.test(shell)) throw new Error("This file is not a 0/1 dialogue/flow document — its embedded document state is missing.");
  const json = JSON.stringify(doc).replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\u0021--");
  return shell.replace(QL_DOC, () => '<script type="application/json" id="ql-doc">' + json + "</script>");
}
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
/** Declared participants become v0.4 participants: each gets its stable
 * key (deterministic from the document identity), contributor role and an
 * honest binding — `declared` when a session ref came with it, else
 * `unknown`. Nothing here claims authentication. */
export function keyedParticipants(documentId: string | null, participants?: QlDocParticipant[]): PluralParticipant[] {
  if (!participants?.length) return defaultParticipants(documentId);
  return participants.map((participant, ordinal) => ({
    ...participant,
    key: participant.key ?? legacyParticipantKey(documentId, participant.initial, ordinal),
    role: "contributor" as const,
    binding: {owner: "document", ref: participant.ref ?? "", basis: participant.ref ? "declared" as const : "unknown" as const},
  }));
}

/** Mint a fresh instance from the pristine template: the typed writing
 * becomes the first F entry, verbatim in its paragraph form; the document
 * mints its own identity now rather than at first open. */
export function mintInstance(draft: string, participants?: QlDocParticipant[], now = new Date()): string {
  const doc = parseInstance(templateHtml);
  const at = now.toISOString();
  doc.meta.documentId = crypto.randomUUID();
  doc.meta.created = at;
  if (isCurrentFormat(doc)) doc.meta.participants = keyedParticipants(doc.meta.documentId, participants);
  else if (participants?.length) doc.meta.participants = participants;
  const writer = isCurrentFormat(doc) ? ((doc.meta.participants ?? []) as PluralParticipant[]).find(p => p.kind === "person") : undefined;
  const entry: PluralEntry = {
    id: crypto.randomUUID(),
    author: writer?.initial ?? "F",
    at,
    html: textToHtml(draft),
    replyTo: null,
    touched: false,
    ...(writer?.key ? {authorKey: writer.key, attribution: {basis: "declared" as const}} : {}),
  };
  // The placed draft's writing becomes the first F entry; v0.2 opens with
  // empty collections and no seeded entry, so this is the whole thread.
  doc.entries = [entry];
  doc.meta.current = entry.id;
  return embedDocument(templateHtml, doc);
}
/** Mint a blank instance from the form: EMPTY collections — the flow exists
 * before the first word, and the surface's own composer makes the first
 * entry (owner direction, 2026-09-22; the v0.2 form no longer seeds one on
 * open). This is the "start writing" mint. */
export function mintBlankInstance(participants?: QlDocParticipant[], now = new Date()): string {
  const doc = parseInstance(templateHtml);
  doc.meta.documentId = crypto.randomUUID();
  doc.meta.created = now.toISOString();
  if (isCurrentFormat(doc)) doc.meta.participants = keyedParticipants(doc.meta.documentId, participants);
  else if (participants?.length) doc.meta.participants = participants;
  return embedDocument(templateHtml, doc);
}
/** Append one entry to an existing instance through the template's own
 * `append-entry` contract. The document's revision advances by one; every
 * other byte of the document's state is preserved exactly. The entry is
 * authored by the person's identity unless a declared participant is given —
 * an answering agent's entry declares the live agent's own initial and the
 * session ref it answered from. */
export function appendEntry(instanceHtml: string, text: string, opts?: {participant?: QlDocParticipant; replyTo?: {entryId: string; anchor: string | null}; relations?: Relation[]; addressees?: string[]; operationRef?: string; html?: string; entryId?: string; basisRevision?: number}, now = new Date()): { html: string; documentId: string | null; entry: QlDocEntry } {
  const doc = parseInstance(instanceHtml);
  if (isCurrentFormat(doc)) return appendPlural(instanceHtml, doc, text, opts, now);
  const declared = opts?.participant;
  const initial = declared?.initial ?? doc.meta.participants?.find(p => p.kind === "person")?.initial ?? "F";
  if (declared && !(doc.meta.participants ?? []).some(p => p.initial === declared.initial)) {
    doc.meta.participants = [...(doc.meta.participants ?? []), declared];
  }
  const entry: QlDocEntry = {
    id: opts?.entryId ?? crypto.randomUUID(),
    author: initial,
    at: now.toISOString(),
    html: opts?.html ?? textToHtml(text),
    replyTo: opts?.replyTo ?? null,
    touched: false,
  };
  doc.entries.push(entry);
  doc.meta.revision = doc.meta.revision + 1;
  return { html: embedDocument(instanceHtml, doc), documentId: doc.meta.documentId, entry };
}
/** v0.4 documents append through the shared validated path. This process is
 * not a native owner, so the attribution it records is `declared`; native
 * owners call `appendContribution` with the caller they themselves verified.
 * The composing basis (`basisRevision`) belongs to the request: a caller that
 * wants replay safety passes it, and it is never guessed from the current
 * document, which moves. */
function appendPlural(instanceHtml: string, doc: QlDoc, text: string, opts: Parameters<typeof appendEntry>[2], now: Date): { html: string; documentId: string | null; entry: QlDocEntry } {
  let next = doc;
  // A v0.4 form copied from the template declares nobody yet; like the page
  // itself on open, materialise its keyed default participants.
  if (!next.meta.participants?.length) next = {...next, meta: {...next.meta, participants: defaultParticipants(next.meta.documentId)}};
  const declared = opts?.participant;
  let author: PluralParticipant | undefined;
  if (declared) {
    const list = (next.meta.participants ?? []) as PluralParticipant[];
    author = list.find(p => declared.key ? p.key === declared.key : declared.ref ? p.ref === declared.ref || p.binding?.ref === declared.ref : p.initial === declared.initial && list.filter(q => q.initial === declared.initial).length === 1);
    if (!author) {
      const keyed = keyedParticipants(next.meta.documentId, [declared])[0];
      keyed.key = legacyParticipantKey(next.meta.documentId, declared.initial, list.length);
      next = {...next, meta: {...next.meta, participants: [...list, keyed]}};
      author = keyed;
    }
  } else author = ((next.meta.participants ?? []) as PluralParticipant[]).find(p => p.kind === "person" && !p.left);
  if (!author?.key) throw new Error("This flow has no participant to author the entry as.");
  const relations: Relation[] = opts?.relations ?? (opts?.replyTo ? [{type: "reply", entryId: opts.replyTo.entryId, anchor: opts.replyTo.anchor, ...(opts.basisRevision !== undefined ? {revision: opts.basisRevision} : {})}] : []);
  const operationRef = opts?.operationRef ?? `ui:${crypto.randomUUID()}`;
  const result = appendContribution(next, {
    operationRef, authorKey: author.key, html: opts?.html ?? textToHtml(text), at: now.toISOString(), relations, addressees: opts?.addressees, basisRevision: opts?.basisRevision, entryId: opts?.entryId,
  }, {kind: "system"});
  return {html: embedDocument(instanceHtml, result.doc), documentId: result.doc.meta.documentId, entry: result.entry};
}

/** Flow instance file names are date and time stamped in local civil time;
 * a same-minute collision takes a numeric suffix, never a clock rewind. */
export function instanceFileName(stamp: string, suffix = 0): string {
  return suffix ? `flow-${stamp}-${suffix + 1}.html` : `flow-${stamp}.html`;
}
