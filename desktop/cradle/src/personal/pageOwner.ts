// The page owner on the kernel's seam (kernel/src/page.rs; T-WORLDS §4, W2): a Being, a Thing or a Flow read, a world's pages
// listed, and one field written on the revision it was read at. A write that finds the page moved is refused by the owner and
// overwrites nothing; the caller reads again and writes on that revision.
import {kernelOp} from "../kernel/bridge";
import type {CentralLocation, KernelTransportStatus, PageField, PageRequest} from "../kernel/types";

export type PageForm = "being" | "thing" | "page" | "flow";
export interface PageReading {schema: "oi.page-reading/v1"; location: CentralLocation; revision: string; form: PageForm; title: string | null; island: Record<string, unknown>}
export interface PageListing {
  schema: "oi.page-list/v1"; path: string; more: boolean
  pages: {location: CentralLocation; name: string; form: PageForm; title: string | null; revision: string; world: string | null}[]
  not_pages: {name: string; why: string}[]
}
export interface PageMutation {
  schema: "oi.page-mutation/v1"; location: CentralLocation; field: PageField; value: unknown
  before_revision: string; revision: string; outcome: "created" | "written" | "unchanged"; receipt: unknown
}

async function page<T>(transport: KernelTransportStatus, request: PageRequest): Promise<T> {
  const result = await kernelOp(transport, {op: "page", request});
  if (result.error || result.outcome?.result !== "page_reading") throw new Error(result.error ?? "The page owner did not answer");
  return result.outcome.data as T;
}

export const readPageOwned = (transport: KernelTransportStatus, location: CentralLocation) =>
  page<PageReading>(transport, {operation: "read", location});
export const listWorldPages = (transport: KernelTransportStatus, path: string, limit?: number) =>
  page<PageListing>(transport, limit === undefined ? {operation: "list", path} : {operation: "list", path, limit});
export const writePageField = (transport: KernelTransportStatus, location: CentralLocation, expectedRevision: string, field: PageField, value: unknown) =>
  page<PageMutation>(transport, {operation: "mutate_field", location, expected_revision: expectedRevision, field, value});
