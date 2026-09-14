/**
 * Native HTML document forms (Wayfinder §2; Personal Web #279).
 *
 * A choice points to a real file; the roster owns no source or person identity.
 * Resolving one lists the documents directory through Central's own file route and
 * hands back the entry's owner location verbatim. Nothing here mints ids,
 * copies bytes or dispatches an Agent. Journal remains inside the 0/1 file.
 * The roster also retains planned Card/Cube scope without advertising absent files.
 */
import { listFiles } from "../files/client";
import type { CentralLocation, KernelTransportStatus } from "../kernel/types";

import roster from "../../documents/forms.json";
import {availableForms} from "../personal/page.mjs";

export type DocumentFormKind = `document-${string}`;

export interface DocumentForm {
  kind: DocumentFormKind;
  label: string;
  hint: string;
  file: string;
}

export const DOCUMENT_FORMS: readonly DocumentForm[] = availableForms(roster) as DocumentForm[];

/** Where the supplied forms live inside the O-I ground. */
export const DOCUMENT_FORM_DIR = "desktop/cradle/documents";

/** The O-I project is the cradle's own ground (Central's `o-i`). */
function oiProjectPath(projects: readonly { name?: string; path?: string }[] | undefined): string | undefined {
  return projects?.find(p => /^o-?i$/i.test(p.name ?? "") || /\/O-I$/i.test(p.path ?? ""))?.path;
}

/** Resolve a form's real location through the owner's file route. Every
 *  failure names the exact path tried — a missing form is a precise
 *  unavailable state, never a fabricated payload or silent fallback. */
export async function resolveDocumentForm(
  transport: KernelTransportStatus,
  form: DocumentForm,
  projects: readonly { name?: string; path?: string }[] | undefined,
): Promise<CentralLocation> {
  const dir = `${oiProjectPath(projects) ?? "Work/O-I"}/${DOCUMENT_FORM_DIR}`;
  let directory;
  try {
    directory = await listFiles(transport, dir);
  } catch (reason) {
    throw new Error(`The ${form.label} document form could not be opened: ${dir} is not readable now (${String(reason)})`);
  }
  const entry = directory.entries.find(e => e.kind === "file" && e.name === form.file);
  if (!entry) throw new Error(`The ${form.label} document form is not where this desktop expects it: no ${form.file} in ${dir} (${directory.entries.length} entr${directory.entries.length === 1 ? "y" : "ies"} there)`);
  if (entry.retrieval_allowed === false) throw new Error(`The ${form.label} document form at ${dir}/${form.file} is withheld by its owner (retrieval not allowed)`);
  return entry.location;
}
