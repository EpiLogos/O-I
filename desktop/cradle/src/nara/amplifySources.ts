/** Where Amplify looks (manual §24.2: "Nara lays beside it the places that image has stood before: in your own pages, in your knowledge and
 * in the works your worlds hold, each as a Source entry with where it comes from"; "Amplify from — Your pages · Your knowledge · The works of
 * your worlds: each On or Off — All On"). Two of the three are read here from their owners; the third, the works of your worlds, is the
 * atlas field's own (projections/atlas/practice/dreamsHost.ts placesOf, over the ported pure amplify):
 *   your pages       the kernel's `nara_lived_context` (kernel/src/nara_lived_context.rs): QL composes the passages of your practice pages
 *                    that use the image's name (its reason `concern-term`), each with its exact source, revision, entry and time;
 *   your knowledge   AIKit's knowledge search through the kernel's `knowledge` op (kernel/src/knowledge.rs; `aikit knowledge search`): its
 *                    hits, each with its address, its label and the provider that keeps it.
 * Each answer becomes an AmplifiedPlace (dreamJournal.ts) naming where it came from. Nothing here interprets: a place is where the image
 * stood, in the words of the page or the source it stood in. Pure apart from the two owner reads. */
import {knowledge} from "../knowledge/client";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import type {AmplifiedPlace} from "./dreamJournal";
import {composeLivedContext, type LivedContextResult, type LivedPageSelection} from "./livedContext";
import type {PracticeKind} from "./practiceWorld";

/** How many places one source lays at most. */
export const AMPLIFY_FROM_PAGES = 3;
export const AMPLIFY_FROM_KNOWLEDGE = 3;
/** How much of a passage or a source stands in its Source entry. */
const QUOTE_CHARS = 240;
/** The kernel's bound on the pages one composition reads (nara_lived_context.rs MAX_PAGES). */
const MAX_PAGES = 32;

export interface AmplifiedImage {readonly familyId: string; readonly name: string}

const quote = (text: string): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > QUOTE_CHARS ? `${flat.slice(0, QUOTE_CHARS - 1).trimEnd()}…` : flat;
};
const dayOf = (ms: number): string => new Date(ms).toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"});

/** The passages of your pages the image stands in, as places: the amplified dream itself left out (it is not its own parallel), each
 * named by its page and its day, its source the passage's own key (source, document, entry and revision). Pure. */
export function pagePlaces(result: LivedContextResult, input: {dreamId: string; titles: ReadonlyMap<string, string>; limit?: number}): AmplifiedPlace[] {
  return result.context.passages
    .filter(passage => passage.entry_id !== input.dreamId && passage.superseded_by === null && passage.text.trim())
    .slice(0, input.limit ?? AMPLIFY_FROM_PAGES)
    .map(passage => {
      const page = input.titles.get(passage.source_ref) ?? (passage.kind === "dream" ? "dream journal" : passage.kind === "journal" ? "journal" : "page");
      return {occurrenceId: `page:${passage.key}`, from: "pages" as const, title: `“${quote(passage.text)}”`, when: dayOf(passage.occurred_at_unix_ms), place: "",
        kind: passage.kind === "dream" ? "dream" : passage.kind === "journal" ? "journal entry" : "passage",
        sources: [{ref: passage.key, label: `your ${page}, ${dayOf(passage.occurred_at_unix_ms)}`}]};
    });
}

interface KnowledgeHit {address?: {kind?: unknown; value?: unknown}; label?: unknown; provider?: unknown; snippet?: unknown}
/** The sources of your knowledge the image stands in, as places: each hit that names itself, with the provider that keeps it. Pure. */
export function knowledgePlaces(reading: {hits?: unknown}, limit = AMPLIFY_FROM_KNOWLEDGE): AmplifiedPlace[] {
  const hits = Array.isArray(reading.hits) ? reading.hits as KnowledgeHit[] : [];
  return hits.flatMap(hit => {
    const label = typeof hit.label === "string" ? hit.label.trim() : "";
    const kind = typeof hit.address?.kind === "string" ? hit.address.kind : "";
    const value = typeof hit.address?.value === "string" ? hit.address.value : "";
    if (!label || !kind || !value) return [];
    const provider = typeof hit.provider === "string" && hit.provider.trim() ? hit.provider.trim() : null;
    const snippet = typeof hit.snippet === "string" ? quote(hit.snippet.replace(/^#.*$/m, "")) : "";
    return [{occurrenceId: `knowledge:${kind}:${value}`, from: "knowledge" as const, title: label, when: "", place: snippet ? `“${snippet}”` : "",
      kind: kind === "wiki" ? "page of your wiki" : "knowledge source",
      sources: [{ref: `aikit:knowledge:${kind}:${value}`, label: provider ? `${label} (${provider})` : label}]}];
  }).slice(0, limit);
}

/** A practice page Amplify reads: where it is, what it keeps, its title. */
export interface AmplifyPage {readonly location: CentralLocation; readonly practice: PracticeKind; readonly title: string | null}

const livedPractice = (practice: PracticeKind): LivedPageSelection["practice"] => practice === "journal" ? "journal" : practice === "dreams" ? "dreams" : "flow";

/** Your pages, read for the image: QL composes the passages that use its name, from the pages given (your practice pages). */
export async function readPagePlaces(transport: KernelTransportStatus, input: {subject_ref: string; image: AmplifiedImage; dreamId: string; pages: readonly AmplifyPage[]}): Promise<AmplifiedPlace[]> {
  const pages = input.pages.slice(0, MAX_PAGES);
  if (!pages.length) return [];
  const result = await composeLivedContext(transport, {operation: "compose", subject_ref: input.subject_ref,
    concern: {concern_ref: `amplify:${input.dreamId}:${input.image.familyId}`, title: input.image.name, terms: [input.image.name]},
    pages: pages.map(page => ({location: page.location, practice: livedPractice(page.practice)})),
    budget: {max_passages: AMPLIFY_FROM_PAGES + 1, max_chars: 4 * 1024}, disclosed_via_ref: `consent:amplify:${input.dreamId}`});
  return pagePlaces(result, {dreamId: input.dreamId, titles: new Map(pages.filter(page => page.title).map(page => [page.location.ref, page.title!]))});
}

/** Your knowledge, read for the image: AIKit's search for its name. */
export async function readKnowledgePlaces(transport: KernelTransportStatus, image: AmplifiedImage): Promise<AmplifiedPlace[]> {
  return knowledgePlaces(await knowledge<{hits?: unknown}>(transport, undefined, {action: "search", query: image.name}));
}
