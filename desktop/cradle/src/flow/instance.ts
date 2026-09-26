import templateHtml from "../../documents/ql-flow.html?raw";
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
  author: "F" | "H";
  at: string;
  html: string;
  replyTo: { entryId: string; anchor: string | null } | null;
  touched: boolean;
  fromJournal?: string;
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
  };
  entries: QlDocEntry[];
  notes: unknown[];
  packet: unknown[];
  media: unknown[];
  journal: { id: string; at: string; html: string }[];
}
const QL_DOC = /<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;
export function parseInstance(html: string): QlDoc {
  const match = html.match(QL_DOC);
  if (!match) throw new Error("This file is not a 0/1 dialogue/flow document — its embedded document state is missing.");
  return JSON.parse(match[1].replace(/<\\\/script/gi, "</script")) as QlDoc;
}
export function embedDocument(shell: string, doc: QlDoc): string {
  if (!QL_DOC.test(shell)) throw new Error("This file is not a 0/1 dialogue/flow document — its embedded document state is missing.");
  const json = JSON.stringify(doc).replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
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
/** Mint a fresh instance from the pristine template: the typed writing
 * becomes the first F entry, verbatim in its paragraph form; the document
 * mints its own identity now rather than at first open. */
export function mintInstance(draft: string, now = new Date()): string {
  const doc = parseInstance(templateHtml);
  const at = now.toISOString();
  doc.meta.documentId = crypto.randomUUID();
  doc.meta.created = at;
  const entry: QlDocEntry = {
    id: crypto.randomUUID(),
    author: "F",
    at,
    html: textToHtml(draft),
    replyTo: null,
    touched: false,
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
export function mintBlankInstance(now = new Date()): string {
  const doc = parseInstance(templateHtml);
  doc.meta.documentId = crypto.randomUUID();
  doc.meta.created = now.toISOString();
  return embedDocument(templateHtml, doc);
}
/** Append one F entry to an existing instance — the template's own
 * `append-entry` contract. The document's revision advances by one; every
 * other byte of the document's state is preserved exactly. */
export function appendEntry(instanceHtml: string, text: string, now = new Date()): { html: string; documentId: string | null; entry: QlDocEntry } {
  const doc = parseInstance(instanceHtml);
  const entry: QlDocEntry = {
    id: crypto.randomUUID(),
    author: "F",
    at: now.toISOString(),
    html: textToHtml(text),
    replyTo: null,
    touched: false,
  };
  doc.entries.push(entry);
  doc.meta.revision = doc.meta.revision + 1;
  return { html: embedDocument(instanceHtml, doc), documentId: doc.meta.documentId, entry };
}
/** Flow instance file names are date and time stamped in local civil time;
 * a same-minute collision takes a numeric suffix, never a clock rewind. */
export function instanceFileName(stamp: string, suffix = 0): string {
  return suffix ? `flow-${stamp}-${suffix + 1}.html` : `flow-${stamp}.html`;
}
