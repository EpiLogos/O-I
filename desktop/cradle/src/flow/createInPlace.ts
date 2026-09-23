/**
 * CREATE IN PLACE — one step for every document form (10-SIDEBARS §3.7,
 * regression 6.1.6). Choosing a form never opens the template itself; it
 * creates a COPY and hands back that copy's location, which the caller opens
 * as an ordinary file. This generalises Flow's mint (instance.ts
 * mintBlankInstance + the frame's openMintedFlow): the same Central file
 * write — `central.files.write` with an empty expected revision, which
 * creates and never overwrites — for every form.
 *
 * Where a copy may be created is Central's law, not the desktop's
 * (Work/Central ctrl/src/file_mutation.rs, ordinary_policy): Control and
 * every ProjectCentral are protected ground, and the ONE door that admits a
 * first save is Central's user-section flows area, Control/user/flows/. So:
 *
 *   Flow, Day, Beings, Things, Epi-Card
 *             Control/user/flows/<form>-<stamp>.html — the owner's dated,
 *             self-contained documents, filed into their day when it closes
 *   Goal      <human ground>/telos/goal-<stamp>.html (without a telos
 *             folder, <human ground>/goal-<stamp>.html)
 *   Vision    Work/<project>/ProjectCentral/user/<project>.html — refused
 *             where the project already has a vision page
 *
 * Goal and Vision are asked for IN PLACE, in the scope's human ground
 * (Control/user or Work/<project>/ProjectCentral/user) — and Central refuses
 * that today: its protected ground has no native authored operation for a
 * new document, and no Action creates a folder (so a goal cannot yet be a
 * telos/<goal>/ folder of its own). The refusal is surfaced in plain words
 * with the owner's own reason; nothing is written elsewhere instead.
 *
 * The template bytes are read through Central's own file route from the
 * O-I documents directory (resolveDocumentForm) — never written back. The
 * copy keeps every byte of the template except its embedded identity (the
 * `ql-doc` JSON's documentId / uuid and created, and a Day's date). A form
 * without an embedded identity is copied verbatim.
 */
import {fileOperation, listFiles, readFile, type FileMutation} from "../files/client";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import {resolveDocumentForm, type DocumentForm} from "./documentForms";
import {instanceFileName, mintBlankInstance} from "./instance";

export interface HumanGround {root: string; baseRef: string; basePath: string; project?: string}

/** The scope's human ground, from the owner's own listing (its location
 * never lies about the root it serves). */
export async function humanGround(transport: KernelTransportStatus, project?: string): Promise<HumanGround> {
  const path = project ? `Work/${project}/ProjectCentral/user` : "Control/user";
  let directory;
  try { directory = await listFiles(transport, path, true); }
  catch (reason) { throw new Error(`${project ?? "Central"}'s human ground (${path}) is not readable now: ${String(reason instanceof Error ? reason.message : reason)}`); }
  return {root: directory.location.root, baseRef: directory.location.ref, basePath: directory.location.path, project};
}

/** Local civil time only — never a UTC or scheduler stamp. */
export function localStamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
const localDate = (now: Date) => localStamp(now).slice(0, 10);
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";

/** Where a form's copy lives, relative to the human ground. `attempt`
 * resolves a same-minute collision with a numeric suffix. */
export function placementFor(form: Pick<DocumentForm, "kind" | "label">, ground: Pick<HumanGround, "project"> & {telos?: boolean}, stamp: string, attempt = 0): string {
  const suffix = attempt ? `-${attempt + 1}` : "";
  switch (form.kind) {
    case "document-01": return `flows/${instanceFileName(stamp, attempt)}`;
    case "document-goal": return `${ground.telos ? "telos/" : ""}goal-${stamp}${suffix}.html`;
    // Everything else rides Central's one first-save door (the flows area).
    case "document-vision":
      if (!ground.project) throw new Error("A vision page belongs to a project — choose a project scope first.");
      return `${ground.project.toLowerCase().replace(/[^a-z0-9]/g, "")}.html`;
    default: return `flows/${slug(form.label)}-${stamp}${suffix}.html`;
  }
}

const QL_DOC = /(<script type="application\/json" id="ql-doc">)([\s\S]*?)(<\/script>)/;

/** A fresh identity for the copy; every other byte stays the template's. */
export function stampCopy(template: string, now = new Date(), identity: () => string = () => crypto.randomUUID()): string {
  const match = template.match(QL_DOC);
  if (!match) return template;
  let doc: {meta?: Record<string, unknown>};
  try { doc = JSON.parse(match[2]); } catch { return template; }
  const meta = doc.meta;
  if (!meta || typeof meta !== "object") return template;
  const id = identity();
  if ("documentId" in meta) meta.documentId = id;
  if ("uuid" in meta) meta.uuid = id;
  if ("created" in meta) meta.created = now.toISOString();
  if (meta.type === "daily" && "date" in meta) meta.date = localDate(now);
  // U+003C is escaped so no text can close the script (the page template's
  // own jsonText law); JSON.parse reads it back unchanged.
  const json = JSON.stringify(doc).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return template.replace(QL_DOC, (_all, open: string, _body: string, close: string) => open + json + close);
}

export interface CreatedCopy {location: CentralLocation; html: string; form: DocumentForm; ground: HumanGround}

/** Create one copy of `form` in place and return its location. */
export async function createFormInPlace(transport: KernelTransportStatus, form: DocumentForm, options: {project?: string; projects?: readonly {name?: string; path?: string}[]; now?: Date}): Promise<CreatedCopy> {
  const now = options.now ?? new Date();
  // Only Goal and Vision are asked for in the scope's own human ground; every
  // other form lands at Central's first-save door (Control/user/flows).
  const inPlace = form.kind === "document-goal" || form.kind === "document-vision";
  const ground = await humanGround(transport, inPlace ? options.project : undefined);
  // The Flow keeps its ratified mint (the bundled 0/1 carrier's blank
  // instance); every other form's template is read through Central's file
  // route, exactly as the owner holds it.
  const top = inPlace ? (await listFiles(transport, ground.basePath, true)).entries : [];
  const telos = top.some(entry => entry.kind === "directory" && entry.name === "telos");
  if (form.kind === "document-vision") {
    // One vision page per project, whatever its file name (ql.html, aikit.html…).
    const existing = top.find(entry => entry.kind === "file" && /\.html$/i.test(entry.name) && !/^[a-z0-9-]+-\d{4}-\d{2}-\d{2}-\d{4}/i.test(entry.name));
    if (existing) throw new Error(`${ground.project} already has a vision page at ${existing.location.path}; open it instead.`);
  }
  let template: string;
  if (form.kind === "document-01") template = mintBlankInstance(now);
  else template = (await readFile(transport, await resolveDocumentForm(transport, form, options.projects))).content;
  const stamp = localStamp(now);
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    const relative = placementFor(form, {...ground, telos}, stamp, attempt);
    const location: CentralLocation = {schema: "central.path-ref/v1", ref: `${ground.baseRef}/${relative}`, root: ground.root, path: `${ground.basePath}/${relative}`};
    const html = form.kind === "document-01" ? template : stampCopy(template, now);
    try {
      const result = await fileOperation<FileMutation>(transport, location, {action: "write", expected_revision: "", content: html});
      if (result.outcome !== "created") throw new Error(`Central did not create the ${form.label} (${result.outcome}).`);
      return {location, html, form, ground};
    } catch (reason) {
      lastError = reason;
      const words = String(reason instanceof Error ? reason.message : reason);
      if (inPlace && /Protected ground|native authored operation|No such file or directory/i.test(words)) {
        throw new Error(`Central doesn't yet let the desktop create a ${form.label} in ${ground.project ?? "Central"}'s human ground (${location.path}) — it is protected ground with no native operation for a new document. Nothing was written. (Central: ${words})`);
      }
      const collided = /already exists|conflict/i.test(words);
      if (form.kind === "document-vision" && collided) throw new Error(`${ground.project} already has a vision page at ${location.path}; open it instead.`);
      if (!collided) throw reason;
    }
  }
  throw new Error(`Central would not accept a new ${form.label} this minute: ${String(lastError)}`);
}
