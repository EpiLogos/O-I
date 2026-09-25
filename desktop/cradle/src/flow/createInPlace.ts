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
import {instanceFileName, mintBlankInstance} from "./instance";
import {inPlacePlacementFor, localStamp, stampCopy} from "./placement";

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
export async function createFormInPlace(transport: KernelTransportStatus, form: DocumentForm, options: {project?: string; projects?: readonly {name?: string; path?: string}[]; now?: Date}): Promise<CreatedCopy> {
  const now = options.now ?? new Date();
  // Goal, Vision and Mockup are asked for in the scope's own human ground —
  // through the owner's authored creation door. Every other form lands at
  // Central's first-save door (Control/user/flows).
  const inPlace = form.kind === "document-goal" || form.kind === "document-vision" || form.kind === "document-mockup";
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
  if (form.kind === "document-01") template = mintBlankInstance(now);
  else template = (await readFile(transport, await resolveDocumentForm(transport, form, options.projects))).content;
  const stamp = localStamp(now);
  let lastError: unknown;
  if (inPlace) {
    const html = stampCopy(template, now);
    // The door names paths relative to the project root; the ground's own
    // listing is the truth of where the human ground sits inside it.
    const groundScope = ground.basePath.replace(/^Work\/[^/]+\//, "");
    for (let attempt = 0; attempt < 8; attempt++) {
      const relative = inPlacePlacementFor(form, {...ground, telos}, stamp, attempt);
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
    const html = form.kind === "document-01" ? template : stampCopy(template, now);
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
