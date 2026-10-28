/**
 * Pure placement and identity-stamping for documents created IN PLACE in a
 * scope's human ground (10-SIDEBARS §3.7; flow/createInPlace.ts). No
 * transport, no roster — only the law: where a copy may live, and what a
 * copy keeps. The flows-area placements stay with createInPlace's own
 * first-save-door logic.
 */
import {spliceIsland} from "./plural";

/** Local civil time only — never a UTC or scheduler stamp. */
export function localStamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";

/** Where an in-place form's copy lives, relative to the human ground.
 * `attempt` resolves a same-minute collision with a numeric suffix. */
export function inPlacePlacementFor(form: Pick<{kind: string; label: string}, "kind" | "label">, ground: {project?: string; telos?: boolean}, stamp: string, attempt = 0): string {
  const suffix = attempt ? `-${attempt + 1}` : "";
  switch (form.kind) {
    case "document-goal": return `${ground.telos ? "telos/" : ""}goal-${stamp}${suffix}.html`;
    case "document-mockup": return `mockup-${slug(form.label)}-${stamp}${suffix}.html`;
    case "document-vision":
      if (!ground.project) throw new Error("A vision page belongs to a project — choose a project scope first.");
      return `${ground.project.toLowerCase().replace(/[^a-z0-9]/g, "")}.html`;
    default:
      throw new Error(`${form.kind} does not create in place in a human ground`);
  }
}

const QL_DOC = /(<script type="application\/json" id="ql-doc">)([\s\S]*?)(<\/script>)/;
/** The island as every Flow reader reads it (flow/instance.ts parseInstance, plural.ts readIsland): the legacy `<\/script`
 * and `<\!--` escapes read back as written content, the letters after `<\/` as written. */
const readIsland = (text: string): unknown => JSON.parse(text.replace(/<\\\/(script)/gi, "</$1").replace(/<\\(!--)/g, "<$1"));

/** A fresh identity for the copy; every other byte stays the template's. The identity is written through the host's splice
 * (plural.ts spliceIsland, as createInPlace's tieWorld and withFlowMeta write, #798): only the values of `documentId`,
 * `uuid`, `created` and a daily's `date` move, and the island's key order, spacing, number spellings (`3.0`, `1e2`,
 * integers past 2^53) and escapes stay as the template writes them (#803). */
export function stampCopy(template: string, now = new Date(), identity: () => string = () => crypto.randomUUID()): string {
  const match = template.match(QL_DOC);
  if (!match) return template;
  let doc: {meta?: Record<string, unknown>};
  try { doc = readIsland(match[2]) as typeof doc; } catch { return template; }
  const meta = doc?.meta;
  if (!meta || typeof meta !== "object") return template;
  const id = identity();
  if ("documentId" in meta) meta.documentId = id;
  if ("uuid" in meta) meta.uuid = id;
  if ("created" in meta) meta.created = now.toISOString();
  if (meta.type === "daily" && "date" in meta) meta.date = localStamp(now).slice(0, 10);
  return template.replace(QL_DOC, (_all, open: string, island: string, close: string) => open + spliceIsland(island, doc) + close);
}
