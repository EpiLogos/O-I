/**
 * The whole workflow inspection, not its first page (CROSSWALK §8: never a
 * capped display page). `factory workflow inspect` pages every collection
 * with the same offset (limit 1..100) and answers `nextCursor` until the
 * reading is exhausted. The desktop follows the cursor to completion, and
 * when it cannot — a later page refused (a stale cursor after the owner's
 * reading moved), or the page budget ran out — it says so as `partial`,
 * never presenting a first page as the whole run.
 *
 * Pure: the page reader is injected, so the loop is tested without a kernel.
 */
import type {WorkflowInspection} from "./runModel";

export interface InspectionPage extends WorkflowInspection { nextCursor?: unknown }
export interface WholeInspection { inspection: WorkflowInspection; pages: number; partial?: string }

const byKey = <T>(rows: T[], key: (row: T) => string | undefined): T[] => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = key(row);
    if (id !== undefined) { if (seen.has(id)) continue; seen.add(id); }
    out.push(row);
  }
  return out;
};

/** Merge the owner's pages into one inspection: rows concatenated in page
 * order (deduplicated by their own refs), legs merged by unit ref, the
 * totals and identity from the first page (they describe the whole). */
export function mergeInspectionPages(pages: InspectionPage[]): WorkflowInspection {
  if (!pages.length) return {};
  const [first] = pages;
  const {nextCursor: _cursor, ...head} = first;
  void _cursor;
  return {
    ...head,
    units: byKey(pages.flatMap(page => page.units ?? []), unit => unit.workflowUnitRef),
    legs: Object.assign({}, ...pages.map(page => page.legs ?? {})),
    barriers: byKey(pages.flatMap(page => page.barriers ?? []), barrier => barrier.key),
    attempts: byKey(pages.flatMap(page => page.attempts ?? []), attempt => attempt.attemptRef),
    telemetry: byKey(pages.flatMap(page => page.telemetry ?? []), row => row.telemetryRef),
  };
}

/** Follow `nextCursor` until the owner says there is no more, or the budget
 * is spent. The first page's refusal is the caller's error (as before); a
 * later refusal or an exhausted budget yields the pages read, marked partial
 * in words. A merged reading that still counts fewer attempts or units than
 * the owner's totals is partial too. */
export async function followInspection(readPage: (cursor?: unknown) => Promise<InspectionPage>, maxPages = 50): Promise<WholeInspection> {
  const pages: InspectionPage[] = [await readPage()];
  let partial: string | undefined;
  while (pages[pages.length - 1].nextCursor != null) {
    if (pages.length >= maxPages) { partial = `Read the first ${pages.length} pages of this run's inspection; the owner has more.`; break; }
    try { pages.push(await readPage(pages[pages.length - 1].nextCursor)); }
    catch (error) {
      const words = String(error instanceof Error ? error.message : error).replace(/^Error:\s*/, "").trim();
      partial = `Read ${pages.length} page${pages.length === 1 ? "" : "s"} of this run's inspection; the next page was refused — ${words}`;
      break;
    }
  }
  const inspection = mergeInspectionPages(pages);
  if (!partial) {
    const short: string[] = [];
    if (typeof inspection.totalAttempts === "number" && (inspection.attempts?.length ?? 0) < inspection.totalAttempts) short.push(`${inspection.attempts?.length ?? 0} of ${inspection.totalAttempts} attempts`);
    if (typeof inspection.totalUnits === "number" && (inspection.units?.length ?? 0) < inspection.totalUnits) short.push(`${inspection.units?.length ?? 0} of ${inspection.totalUnits} units`);
    if (short.length) partial = `The owner's reading counts more than it returned (${short.join(", ")}).`;
  }
  return {inspection, pages: pages.length, ...(partial ? {partial} : {})};
}
