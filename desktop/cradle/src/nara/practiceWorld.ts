/** The practice world (manual §24.1; T-WORLDS §6, W4): "a Central world of Kind Practice, fogged; its chain Packet → Nara → Scope;
 * Activator off by default; its clips a journal, a dream journal, sittings and journeys".
 *
 * Which register is the person's practice is read from Central's own disclosure of its worlds (central/centralWorlds.ts worldsOf), never
 * minted here. Central discloses a project register `personal` (`central:wiki:project:personal`, its ProjectCentral healthy, its human
 * ground `Work/personal/ProjectCentral/user`), and that project's own ground is the person's Nara space: `Work/personal/Nara-Personal`
 * names itself "journal, oracle, daily flow, and personal pratibimba continuity … Everything here is protected-local" (its AGENTS.md),
 * and QL's docs call it the "personal context surface" (QL docs/MEF-LENS-REGISTER.md:184). That register is the practice world. A
 * ground that discloses no such register keeps the practice in your own world, each practice page marked by its `meta.practice`.
 *
 * A practice page is a Flow in the world's folder, made through Central's own creation door (flow/createInPlace.ts: a project's human
 * ground through `projectcentral.source.create`, your world through `central.files.write`), and it says what it is for from its first
 * write: `meta.practice` (journal, dreams, sitting, journey). A journey's page carries its journey in `meta.journey` once it opens
 * (kernel/src/nara_journey.rs). Nara keeps no second journal: every practice is the person's own pages. */
import type {CreatedCopy} from "../flow/createInPlace";
import {listWorldPages, readPageOwned, type PageListing} from "../personal/pageOwner";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";

/** The register Central discloses as the person's practice (above). */
export const PRACTICE_PROJECT = "personal";
/** The practice world's chain (manual §24.1): the packet, Nara and Nara's scope. */
export const PRACTICE_CHAIN = ["Packet", "Nara", "Scope"] as const;

export type PracticeKind = "journal" | "dreams" | "sitting" | "journey";
export const PRACTICE_KINDS: readonly PracticeKind[] = ["journal", "dreams", "sitting", "journey"];
/** What each practice page is called when it is made. */
export const PRACTICE_TITLES: Readonly<Record<PracticeKind, string>> = {journal: "Journal", dreams: "Dream journal", sitting: "Sitting", journey: "Journey"};

/** A world as Central discloses it (central/centralWorlds.ts CentralWorld), structurally. */
export interface PracticeWorldLike {
  readonly ref: string;
  readonly name: string;
  readonly kind: "yours" | "project";
  readonly folder: string;
  readonly project: string | null;
}

/** The practice world and its standing on a track (manual §18.1 "The mixer row", §24.1 "Live's control"). */
export interface PracticeWorld<W extends PracticeWorldLike = PracticeWorldLike> {
  readonly world: W;
  /** The practice's own register, or your world holding the practice pages it marks. */
  readonly register: "practice" | "yours";
  readonly why: string;
  /** The track's Kind. */
  readonly kind: "Practice";
  readonly chain: typeof PRACTICE_CHAIN;
  /** Send to Day: off by default — the practice stays out of the Day. */
  readonly activator: false;
  /** Nara writes directly only when armed: off by default — every answer arrives as a proposal. */
  readonly arm: false;
  /** Fogged to everyone but you. */
  readonly fogged: true;
}

/** The practice world among the worlds Central discloses: the `personal` register, else your world with its practice pages marked.
 * Null when Central discloses no world at all. Pure. */
export function practiceWorldOf<W extends PracticeWorldLike>(worlds: readonly W[]): PracticeWorld<W> | null {
  const standing = {kind: "Practice" as const, chain: PRACTICE_CHAIN, activator: false as const, arm: false as const, fogged: true as const};
  const register = worlds.find(world => world.kind === "project" && world.project === PRACTICE_PROJECT);
  if (register) return {world: register, register: "practice", ...standing,
    why: `Central discloses the ${PRACTICE_PROJECT} register (${register.ref}): its ground is your Nara space, so your practice pages are kept in its folder (${register.folder}).`};
  const yours = worlds.find(world => world.kind === "yours");
  if (!yours) return null;
  return {world: yours, register: "yours", ...standing,
    why: `Central discloses no ${PRACTICE_PROJECT} register, so your practice is kept in your own world (${yours.folder}), each page marked by what it is for.`};
}

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null);

/** What a page is for, by its island: a journey's page by its journey (or its mark before it opens), any other practice by its mark;
 * none for a page made for no practice. Pure. */
export function practiceOfIsland(island: unknown): PracticeKind | null {
  const meta = record(record(island)?.meta);
  if (!meta) return null;
  if (record(meta.journey)) return "journey";
  return PRACTICE_KINDS.includes(meta.practice as PracticeKind) ? meta.practice as PracticeKind : null;
}

/** One practice page of the world, as its owner read it. */
export interface PracticePage {
  readonly location: CentralLocation;
  readonly practice: PracticeKind;
  readonly title: string | null;
  readonly revision: string;
  readonly name: string;
  readonly island: Record<string, unknown>;
}

/** The practice pages of a world: its Flows read through the page owner, each placed by what it is for; oldest first (by its file's
 * stamped name). A page that does not read is left out, as the listing leaves out a file that is no page. */
export async function practicePages(transport: KernelTransportStatus, world: Pick<PracticeWorldLike, "folder">, only?: PracticeKind,
  listed?: PageListing): Promise<PracticePage[]> {
  let listing: PageListing;
  try { listing = listed ?? await listWorldPages(transport, world.folder); }
  catch (cause) {
    if (/No such file or directory/i.test(String(cause instanceof Error ? cause.message : cause))) return [];
    throw cause;
  }
  const flows = listing.pages.filter(page => page.form === "flow").sort((a, b) => a.name.localeCompare(b.name));
  const pages: PracticePage[] = [];
  for (const page of flows) {
    let reading;
    try { reading = await readPageOwned(transport, page.location); } catch { continue; }
    const practice = practiceOfIsland(reading.island);
    if (!practice || (only && practice !== only)) continue;
    pages.push({location: reading.location, practice, title: reading.title, revision: reading.revision, name: page.name, island: reading.island});
  }
  return pages;
}

/** The world's page for one practice (its first, when it holds more than one), or null. */
export async function findPracticePage(transport: KernelTransportStatus, world: Pick<PracticeWorldLike, "folder">, practice: PracticeKind): Promise<PracticePage | null> {
  return (await practicePages(transport, world, practice))[0] ?? null;
}

/** Make one practice page in the practice world, through Central's own creation door: a Flow marked with what it is for from its first
 * write, tied to its world, titled, and carrying whatever else it is made with (a sitting's record). Refused in the owner's words. */
export async function makePracticePage(transport: KernelTransportStatus, world: PracticeWorldLike, practice: PracticeKind,
  options: {now?: Date; title?: string; meta?: Readonly<Record<string, unknown>>; projects?: readonly {name?: string; path?: string}[]} = {}): Promise<CreatedCopy> {
  // The creation door and the form roster are loaded when a page is made: the roster is the documents' own JSON, which a reader of the
  // practice world never needs.
  const [{createFormInPlace}, {DOCUMENT_FORMS}] = await Promise.all([import("../flow/createInPlace"), import("../flow/documentForms")]);
  const form = DOCUMENT_FORMS.find(entry => entry.kind === "document-01");
  if (!form) throw new Error("The form roster offers no Flow, so no practice page can be made.");
  return createFormInPlace(transport, form, {
    ...(world.project ? {project: world.project} : {}), worldRef: world.ref, ...(options.projects ? {projects: options.projects} : {}), ...(options.now ? {now: options.now} : {}),
    // A journal and a dream journal open in their Journal tab (manual §24.1 "Opens as: Journal").
    meta: {...(practice === "journal" || practice === "dreams" ? {view: "journal"} : {}), ...(options.meta ?? {}), practice, title: (options.title ?? PRACTICE_TITLES[practice]).slice(0, 160)},
  });
}
