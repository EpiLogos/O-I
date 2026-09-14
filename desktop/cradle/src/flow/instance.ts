import templateHtml from "../../documents/ql-dialogue-flow.html?raw";
/** The ratified flow carrier (PROPOSAL-FLOW-DAY-LOGICS-2026-09-13-2): a flow
 * file is one self-contained instance of the supplied 0/1 template —
 * `entries` (the conversational thread), `journal` pages, `notes`, `packet`,
 * `media` — with its identity in `meta.documentId` / `created` / `revision`.
 * The desktop mints the instance at the human's explicit Save (identity from
 * birth, the typed writing as the first F entry) and later appends entries
 * through the template's own contract; it never rewrites the html of an
 * entry the human has written. */
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
  // The pristine template ships with EMPTY collections — its in-browser init
  // creates the first entry on open. The desktop mints at Save, so the first
  // F entry is created here; the document's init keeps working as authored.
  doc.entries = [entry];
  doc.meta.current = entry.id;
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
