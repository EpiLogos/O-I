/**
 * Document identity for experiential HTML documents (DOCUMENT-SURFACE.md).
 *
 * One reading of the embedded payload islands a crafted document already
 * carries: the `ql-doc` data island shared by the personal page families
 * and the supplied Day/Flow forms, and the mockup provenance block of the
 * ui-mockup-authoring template. This is identity only — no authority, no
 * writes, no second store. An unparseable or absent island classifies as
 * `unknown`; nothing is fabricated from filenames.
 */

export type DocumentFamily =
  | "vision" | "goal" | "beings" | "things"
  | "flow" | "day"
  | "mockup"
  | "unknown";

export interface DocumentRelations {
  design_refs: string[];
  vision_refs: string[];
  capability_refs: string[];
}

export interface DocumentIdentity {
  family: DocumentFamily;
  label: string;
  /** Owner template lineage as the payload itself declares it. */
  templateRef?: string;
  /** The document's own identity: documentId / uuid / provenance uid. */
  documentId: string | null;
  /** The payload's own revision counter, when the family keeps one. */
  documentRevision: number | null;
  /** Which payload island the identity was read from. */
  payload: "ql-doc" | "mockup-provenance" | "none";
  /** Mockup provenance trace refs, when present. */
  relations?: DocumentRelations;
}

export const FAMILY_LABEL: Partial<Record<DocumentFamily, string>> = {
  vision: "Vision",
  goal: "Goal",
  beings: "Beings",
  things: "Things",
  flow: "Flow",
  day: "Day",
  mockup: "UI Mockup",
};

const QL_DOC = /<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/;
const MOCKUP_PROVENANCE = /<script type="application\/json" id="mockup-provenance">([\s\S]*?)<\/script>/;

function parseIsland(html: string, pattern: RegExp): unknown | undefined {
  const match = html.match(pattern);
  if (!match) return undefined;
  try { return JSON.parse(match[1]); } catch { return undefined; }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function refs(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === "string" && row.length > 0) : [];
}

const PAGE_FAMILIES: readonly DocumentFamily[] = ["vision", "goal", "beings", "things"];

function identityFromQlDoc(doc: Record<string, unknown>): DocumentIdentity {
  const meta = asRecord(doc.meta) ?? {};
  const profile = text(doc.profile);
  const template = text(meta.template);
  const declaredFamily = text(meta.family);
  let family: DocumentFamily = "unknown";
  if (profile === "oi.page/v1" && declaredFamily && PAGE_FAMILIES.includes(declaredFamily as DocumentFamily)) {
    family = declaredFamily as DocumentFamily;
  } else if (template?.startsWith("ql-dialogue-flow") || template?.startsWith("ql-template:dialogue-flow")) {
    family = "flow";
  } else if (meta.type === "daily" || template?.startsWith("ql-daily") || template?.startsWith("ql-template:daily-die")) {
    family = "day";
  }
  const revision = meta.revision;
  return {
    family,
    label: FAMILY_LABEL[family] ?? text(meta.title) ?? "Document",
    templateRef: template,
    documentId: text(meta.documentId) ?? text(meta.uuid) ?? null,
    documentRevision: typeof revision === "number" && Number.isSafeInteger(revision) ? revision : null,
    payload: "ql-doc",
  };
}

function identityFromMockup(doc: Record<string, unknown>): DocumentIdentity {
  return {
    family: "mockup",
    label: text(doc.title) ?? "UI Mockup",
    templateRef: text(doc.uid) ? `ui-mockup-authoring:${text(doc.uid)}` : undefined,
    documentId: text(doc.uid) ?? null,
    documentRevision: null,
    payload: "mockup-provenance",
    relations: {
      design_refs: refs(doc.design_refs),
      vision_refs: refs(doc.vision_refs),
      capability_refs: refs(doc.capability_refs),
    },
  };
}

/** Read one document's identity from its HTML source. `undefined` when the
 * source is not HTML at all — the caller shows format identity instead. */
export function readDocumentIdentity(html: string | undefined): DocumentIdentity | undefined {
  if (!html) return undefined;
  const qlDoc = asRecord(parseIsland(html, QL_DOC));
  if (qlDoc) return identityFromQlDoc(qlDoc);
  const provenance = asRecord(parseIsland(html, MOCKUP_PROVENANCE));
  if (provenance) return identityFromMockup(provenance);
  if (/\bdata-doc-role=["']?mockup\b/.test(html)) {
    return { family: "mockup", label: "UI Mockup", documentId: null, documentRevision: null, payload: "none" };
  }
  return undefined;
}

/** The exact payload island currently in a saved source, with its span —
 * the splice target a document save replaces. Absent islands never match. */
export interface IslandSpan { text: string; start: number; end: number }
export function islandSpan(source: string, payload: "ql-doc" | "mockup-provenance"): IslandSpan | undefined {
  const pattern = payload === "ql-doc" ? QL_DOC : MOCKUP_PROVENANCE;
  const match = pattern.exec(source);
  if (!match || match[1] === undefined || match.index < 0) return undefined;
  const innerStart = match.index + match[0].indexOf(match[1]);
  return { text: match[1], start: innerStart, end: innerStart + match[1].length };
}

/** The document's payload island text, serialised the way every ql-doc
 * family already writes it (the page's own serialiser law: `<` escaped,
 * LINE/PARAGRAPH separators escaped). Used when composing a save from a
 * frame that reported an edited payload as structured JSON. */
export function serialiseQlDoc(doc: unknown): string {
  return JSON.stringify(doc)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
