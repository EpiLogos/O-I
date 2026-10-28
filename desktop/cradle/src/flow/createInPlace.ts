/**
 * CREATE IN PLACE — one step for every document form (10-SIDEBARS §3.7,
 * regression 6.1.6). Choosing a form never opens the template itself; it
 * creates a COPY and hands back that copy's location, which the caller opens
 * as an ordinary file. This generalises Flow's mint (instance.ts
 * mintBlankInstance + the frame's openMintedFlow): the same Central file
 * write — `central.files.write` with an empty expected revision, which
 * creates and never overwrites — for every form.
 *
 * Where a copy may be created is Central's law, not the desktop's.
 * Two owner doors exist:
 *
 *   Project human ground (goal, vision, mockup)
 *             `projectcentral.source.create` — the owner's authored door for
 *             absent documents in Work/<project>/ProjectCentral/user (the
 *             door admits; every later revision goes through the source CAS)
 *   Flows     central.files.write with an empty expected revision, which
 *             creates and never overwrites — the one ordinary door
 *             (Control/user/flows/)
 *
 *   Flow, Day, Beings, Things, Epi-Card
 *             Control/user/flows/<form>-<stamp>.html — the owner's dated,
 *             self-contained documents, filed into their day when it closes
 *   A world's page (Flow, Beings, Things) in a project's scope
 *             Work/<project>/ProjectCentral/user/<form>-<stamp>.html — the
 *             project's world keeps its pages in its own folder (T-WORLDS
 *             W2; manual §18.1 "A world's pages stay in its folder"), through
 *             the same source door; the page's island names its world
 *   Goal      <human ground>/telos/goal-<stamp>.html (without a telos
 *             folder, <human ground>/goal-<stamp>.html)
 *   Vision    Work/<project>/ProjectCentral/user/<project>.html — refused
 *             where the project already has a vision page
 *   Mockup    Work/<project>/ProjectCentral/user/mockup-<slug>-<stamp>.html
 *
 * The template bytes are read through Central's own file route from the
 * O-I documents directory (resolveDocumentForm) — never written back. The
 * copy keeps every byte of the template except its embedded identity (the
 * `ql-doc` JSON's documentId / uuid and created, and a Day's date). A form
 * without an embedded identity is copied verbatim.
 */
import {fileOperation, listFiles, readFile, type FileMutation} from "../files/client";
import {kernelOp} from "../kernel/bridge";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import {resolveDocumentForm, type DocumentForm} from "./documentForms";
import {instanceFileName, mintBlankInstance, parseInstance} from "./instance";
import {inPlacePlacementFor, localStamp, stampCopy} from "./placement";
import {spliceIsland} from "./plural";

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


/** Where a flows-area copy lives. The in-place placements (goal, vision,
 * mockup) belong to the shared pure module — placement.ts. */
function placementFor(form: Pick<DocumentForm, "kind" | "label">, stamp: string, attempt = 0): string {
  const suffix = attempt ? `-${attempt + 1}` : "";
  if (form.kind === "document-01") return `flows/${instanceFileName(stamp, attempt)}`;
  return `flows/${slug(form.label)}-${stamp}${suffix}.html`;
}
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";

export interface CreatedCopy {location: CentralLocation; html: string; form: DocumentForm; ground: HumanGround}

/** The owner's authored creation door for a project's human ground
 * (`projectcentral.source.create`, Central). Refusal carries the owner's
 * own words; a name collision is a retryable outcome, everything else is
 * not. */
async function createThroughSourceDoor(transport: KernelTransportStatus, project: string, path: string, content: string): Promise<{ok: true} | {ok: false; message: string; collided: boolean}> {
  const response = await kernelOp(transport, {op: "invoke_action", invocation: {action: "projectcentral.source.create", target_ref: path, input: {project, path, content, actor: "oi-desktop-user", actor_kind: "human"}}}) as {
    error?: string;
    outcome?: {result: string; dispatch?: {state: string; message?: string; detail?: string}};
  };
  if (response.outcome?.result !== "action_dispatched") throw new Error(response.error ?? "the kernel returned no dispatch outcome");
  const dispatch = response.outcome.dispatch;
  if (dispatch?.state === "invoked") return {ok: true};
  const message = dispatch?.message ?? dispatch?.detail ?? "the owner did not create the document";
  return {ok: false, message, collided: /already exists|never overwrites/i.test(message)};
}

/** Create one copy of `form` in place and return its location. */
/** The forms that are a world's pages (manual §18.1 "A clip is a page: a Being, a Thing, a Flow"). */
const WORLD_PAGE_FORMS: ReadonlySet<string> = new Set(["document-01", "document-beings", "document-things"]);

const QL_DOC = /(<script type="application\/json" id="ql-doc">)([\s\S]*?)(<\/script>)/;
interface IslandDoc {profile?: string; meta?: Record<string, unknown>; bindings?: Record<string, unknown>; entries?: unknown}
/** The page with `doc` written into its island as the host's save writes it (instance.ts embedDocument, plural.ts spliceIsland):
 * only what `doc` changed is written, and every other byte stays as written: key order, a number as spelt (`"revision": 3.0`),
 * the letters after an escaped `<\/` (#798). The island is read as every Flow reader reads it (instance.ts parseInstance). */
const spliced = (html: string, doc: IslandDoc): string =>
  html.replace(QL_DOC, (_all, open: string, island: string, close: string) => open + spliceIsland(island, doc) + close);

/** A page's island tied to its world: a Being's or Thing's `bindings.worldRef`, a Flow's `meta.world` (kernel/src/page.rs reads
 * the same keys). Every other byte stays as it was; a page with no island is returned as it is. */
export function tieWorld(html: string, worldRef: string): string {
  let doc: IslandDoc;
  try { doc = parseInstance(html); } catch { return html; }
  if (doc.profile === "oi.page/v1") doc.bindings = {...(doc.bindings ?? {}), worldRef};
  else if (doc.meta && Array.isArray(doc.entries)) doc.meta = {...doc.meta, world: worldRef};
  else return html;
  return spliced(html, doc);
}

/** The keys of a Flow's meta that are its mint's own: what it is made for never names them. */
const MINTED_META: ReadonlySet<string> = new Set(["documentId", "created", "revision", "participants", "format", "upgrade"]);

/** A Flow page with `meta` merged into its island's meta (the same island read and write as tieWorld). A key of the mint's own is
 * refused, so a page's identity is never set this way. Pure. */
export function withFlowMeta(html: string, meta: Readonly<Record<string, unknown>>): string {
  const own = Object.keys(meta).filter(key => MINTED_META.has(key));
  if (own.length) throw new Error(`A new Flow's ${own.join(", ")} ${own.length > 1 ? "are" : "is"} its own: nothing sets ${own.length > 1 ? "them" : "it"} at creation.`);
  if (!QL_DOC.test(html)) throw new Error("The Flow carries no ql-doc island, so nothing is kept in its meta.");
  const doc: IslandDoc = parseInstance(html);
  if (!doc.meta || !Array.isArray(doc.entries)) throw new Error("This page is no Flow, so it keeps no Flow meta.");
  doc.meta = {...doc.meta, ...meta};
  return spliced(html, doc);
}

export async function createFormInPlace(transport: KernelTransportStatus, form: DocumentForm, options: {project?: string; projects?: readonly {name?: string; path?: string}[]; now?: Date;
  /** The world the page belongs to (its register's wiki space ref): a page form's island is tied to it. */
  worldRef?: string;
  /** What a Flow page is made for, kept in its meta from its first write (T-WORLDS W4: a practice page's `meta.practice`, a sitting's
   * record): merged into a Flow's meta. Its identity (documentId, created, revision, participants, format) is the mint's, never this. */
  meta?: Readonly<Record<string, unknown>>}): Promise<CreatedCopy> {
  const now = options.now ?? new Date();
  // Goal, Vision and Mockup are asked for in the scope's own human ground —
  // through the owner's authored creation door; so is a world's page in a
  // project's scope (the project's world keeps its pages in its own folder).
  // Every other form lands at Central's first-save door (Control/user/flows).
  const worldPage = WORLD_PAGE_FORMS.has(form.kind);
  const tied = (html: string) => worldPage && options.worldRef ? tieWorld(html, options.worldRef) : html;
  const tie = (html: string) => options.meta && form.kind === "document-01" ? withFlowMeta(tied(html), options.meta) : tied(html);
  const inPlace = form.kind === "document-goal" || form.kind === "document-vision" || form.kind === "document-mockup" || (worldPage && !!options.project);
  if (inPlace && (form.kind !== "document-goal") && !options.project) {
    throw new Error(`A ${form.label} belongs to a project — choose a project scope first.`);
  }
  const ground = await humanGround(transport, inPlace ? options.project : undefined);
  // The Flow keeps its ratified mint (the bundled 0/1 carrier's blank
  // instance); every other form's template is read through Central's file
  // route, exactly as the owner holds it.
  const top = inPlace ? (await listFiles(transport, ground.basePath, true)).entries : [];
  const telos = top.some(entry => entry.kind === "directory" && entry.name === "telos");
  if (form.kind === "document-vision") {
    // One vision page per project, whatever its file name (ql.html, aikit.html…).
    const existing = top.find(entry => entry.kind === "file" && /\.html$/i.test(entry.name) && !/^mockup-/i.test(entry.name) && !/^[a-z0-9-]+-\d{4}-\d{2}-\d{2}-\d{4}/i.test(entry.name));
    if (existing) throw new Error(`${ground.project} already has a vision page at ${existing.location.path}; open it instead.`);
  }
  let template: string;
  if (form.kind === "document-01") template = mintBlankInstance(undefined, now);
  else template = (await readFile(transport, await resolveDocumentForm(transport, form, options.projects))).content;
  const stamp = localStamp(now);
  let lastError: unknown;
  if (inPlace) {
    const html = tie(form.kind === "document-01" ? template : stampCopy(template, now));
    // The door names paths relative to the project root; the ground's own
    // listing is the truth of where the human ground sits inside it.
    const groundScope = ground.basePath.replace(/^Work\/[^/]+\//, "");
    for (let attempt = 0; attempt < 8; attempt++) {
      const relative = worldPage ? `${form.kind === "document-01" ? "flow" : slug(form.label)}-${stamp}${attempt ? `-${attempt + 1}` : ""}.html` : inPlacePlacementFor(form, {...ground, telos}, stamp, attempt);
      const projectRelative = `${groundScope}/${relative}`;
      const created = await createThroughSourceDoor(transport, ground.project!, projectRelative, html);
      if (created.ok) {
        // Resolve the copy's location through the owner's own listing —
        // never a hand-built identity.
        const directory = await listFiles(transport, ground.basePath, true);
        const name = relative.split("/").pop()!;
        const entry = directory.entries.find(candidate => candidate.kind === "file" && candidate.name === name);
        if (!entry) throw new Error(`Central created the ${form.label}, but it is not visible at ${ground.basePath}/${relative}; nothing was assumed.`);
        return {location: entry.location, html, form, ground};
      }
      lastError = new Error(created.message);
      if (!created.collided) throw new Error(`Central refused this ${form.label}: ${created.message} Nothing was written.`);
    }
    throw new Error(`Central would not accept a new ${form.label} this minute: ${String(lastError)}`);
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const relative = placementFor(form, stamp, attempt);
    const location: CentralLocation = {schema: "central.path-ref/v1", ref: `${ground.baseRef}/${relative}`, root: ground.root, path: `${ground.basePath}/${relative}`};
    const html = tie(form.kind === "document-01" ? template : stampCopy(template, now));
    try {
      const result = await fileOperation<FileMutation>(transport, location, {action: "write", expected_revision: "", content: html});
      if (result.outcome !== "created") throw new Error(`Central did not create the ${form.label} (${result.outcome}).`);
      return {location, html, form, ground};
    } catch (reason) {
      lastError = reason;
      const collided = /already exists|conflict/i.test(String(reason instanceof Error ? reason.message : reason));
      if (!collided) throw reason;
    }
  }
  throw new Error(`Central would not accept a new ${form.label} this minute: ${String(lastError)}`);
}
