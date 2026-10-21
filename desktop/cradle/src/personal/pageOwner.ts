// The page owner on the kernel's seam (kernel/src/page.rs; T-WORLDS §4, W2): a Being, a Thing or a Flow read, a world's pages
// listed, and one field written on the revision it was read at. A write that finds the page moved is refused by the owner and
// overwrites nothing; the caller reads again and writes on that revision.
import {kernelOp, kernelRead} from "../kernel/bridge";
import type {CentralLocation, KernelTransportStatus, PageField, PageRequest} from "../kernel/types";

export type PageForm = "being" | "thing" | "page" | "flow";
export interface PageReading {schema: "oi.page-reading/v1"; location: CentralLocation; revision: string; form: PageForm; title: string | null; island: Record<string, unknown>}
export interface PageListing {
  schema: "oi.page-list/v1"; path: string; more: boolean
  pages: {location: CentralLocation; name: string; form: PageForm; title: string | null; revision: string; world: string | null
    /** A Flow's browser-row words, from the island the listing read (kernel page.rs list_pages): the keys rowWords.ts `flowReadingOf` reads. */
    flow?: {title: unknown; revision: unknown; participants: {kind: unknown; name: unknown; initial: unknown}[]}}[]
  not_pages: {name: string; why: string}[]
}
export interface PageMutation {
  schema: "oi.page-mutation/v1"; location: CentralLocation; field: PageField; value: unknown
  before_revision: string; revision: string; outcome: "created" | "written" | "unchanged"; receipt: unknown
}

/** `held` is for the operations that only read: the window's held answer stands until the kernel says the ground moved (`fresh`
 * asks the owner again). A mutation is always the owner's. */
async function page<T>(transport: KernelTransportStatus, request: PageRequest, held?: {fresh: boolean}): Promise<T> {
  const result = held ? await kernelRead(transport, {op: "page", request}, held) : await kernelOp(transport, {op: "page", request});
  if (result.error || result.outcome?.result !== "page_reading") throw new Error(result.error ?? "The page owner did not answer");
  return result.outcome.data as T;
}

export const readPageOwned = (transport: KernelTransportStatus, location: CentralLocation, fresh = false) =>
  page<PageReading>(transport, {operation: "read", location}, {fresh});
export const listWorldPages = (transport: KernelTransportStatus, path: string, limit?: number, fresh = false) =>
  page<PageListing>(transport, limit === undefined ? {operation: "list", path} : {operation: "list", path, limit}, {fresh});
export const writePageField = (transport: KernelTransportStatus, location: CentralLocation, expectedRevision: string, field: PageField, value: unknown) =>
  page<PageMutation>(transport, {operation: "mutate_field", location, expected_revision: expectedRevision, field, value});

/** A page launched: the NOW clearing tied to it (one per page; launching again rejoins it). */
export interface PageLaunch {schema: "oi.page-launch/v1"; location: CentralLocation; form: PageForm; title: string | null; now_ref: string; allocated: unknown; reopened: unknown}
export interface PageStop {schema: "oi.page-stop/v1"; now_ref: string; outcome: "closed" | "unchanged"; receipt?: unknown}
/** The task a page's clearing is allocated under (kernel/src/page.rs `page_task`): how a NOW is known as a page's moment. */
export const pageTask = (location: Pick<CentralLocation, "ref">): string => `oi:page:${location.ref}`;
/** What answers a page's Launch once its owner has opened its moment: a journey's page opens its Deck journey, a Being launched as Sky
 * gives the Sky its natal source (T-WORLDS W4). Each is told after the owner answered, and none can undo the Launch. */
export type PageLaunchListener = (launched: PageLaunch, transport: KernelTransportStatus) => void | Promise<void>;
const launchListeners = new Set<PageLaunchListener>();
export function onPageLaunched(listener: PageLaunchListener): () => void {
  launchListeners.add(listener);
  return () => { launchListeners.delete(listener); };
}
export const launchPage = async (transport: KernelTransportStatus, location: CentralLocation): Promise<PageLaunch> => {
  const launched = await page<PageLaunch>(transport, {operation: "launch", location});
  for (const listener of [...launchListeners]) {
    try { void Promise.resolve(listener(launched, transport)).catch(cause => console.error("A page's launch was not answered:", cause)); }
    catch (cause) { console.error("A page's launch was not answered:", cause); }
  }
  return launched;
};
export const stopPage = (transport: KernelTransportStatus, nowRef: string, project?: string | null) =>
  page<PageStop>(transport, project === undefined ? {operation: "stop", now_ref: nowRef} : {operation: "stop", now_ref: nowRef, project});
