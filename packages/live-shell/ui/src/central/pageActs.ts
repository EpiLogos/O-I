// A page's copy and its leaving (O-I #743; manual §10.9 "the acts on every object", §18.1 "Central: the Day, its worlds and their pages"):
// each the page owner's own operation, carried by the kernel.
// - a page's copy is the page owner's duplicate (kernel/src/page.rs `duplicate`): the page read and made again with an identity of its own
//   (flow/placement.ts stampCopy's rules; a Flow re-minted) through its world's door — a project's human ground through
//   projectcentral.source.create, your world's folder through Central's first-save door — in its own world, or in another world's folder,
//   tied to that world;
// - a page leaves its world through the page owner's trash (kernel/src/page.rs `trash`): Central's central.files.trash on the revision the
//   page was read at, the person's act; Central keeps it in its file history and central.files.restore brings it back (`recover`);
// A world's name is the Set's act now (central.world.name, run through the kernel's `act`: kernel mode_set.rs, O-I #1004). The Set composes
// neither of these yet, so nothing in the window sends them until it does (O-I #1005).
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {CentralLocation, KernelTransportStatus, PageRequest} from '../../../../../desktop/cradle/src/kernel/types'
import type {CentralWorld} from './centralWorlds'

/** The page owner's copy receipt (kernel/src/page.rs `duplicate`, oi.page-copy/v1). */
export interface PageCopy {
  readonly schema: 'oi.page-copy/v1'
  readonly from: CentralLocation
  readonly location: CentralLocation
  readonly form: string
  readonly title: string | null
  readonly revision: string
  readonly world: string | null
}

/** The page owner's trash receipt (kernel/src/page.rs `trash`, oi.page-trash/v1): Central's own, with the way back. */
export interface PageTrash {
  readonly schema: 'oi.page-trash/v1'
  readonly location: CentralLocation
  readonly form: string
  readonly title: string | null
  readonly revision: string
  readonly recover: {readonly action: string; readonly expected_revision: string; readonly revision: string} | null
}

async function pageAct<T>(transport: KernelTransportStatus, request: PageRequest): Promise<T> {
  const result = await kernelOp(transport, {op: 'page', request})
  if (result.error || result.outcome?.result !== 'page_reading') throw new Error(result.error ?? 'The page owner did not answer')
  return result.outcome.data as T
}

/** A page's copy: in its own world, or in `into` (another world's folder, tied to it). */
export function duplicatePage(transport: KernelTransportStatus, location: CentralLocation, into?: Pick<CentralWorld, 'folder' | 'ref'>): Promise<PageCopy> {
  return pageAct<PageCopy>(transport, into ? {operation: 'duplicate', location, into: {folder: into.folder, world: into.ref}} : {operation: 'duplicate', location})
}

/** A page leaving its world for Central's trash, on the revision it was read at. */
export function trashPage(transport: KernelTransportStatus, location: CentralLocation, expectedRevision: string): Promise<PageTrash> {
  return pageAct<PageTrash>(transport, {operation: 'trash', location, expected_revision: expectedRevision})
}
