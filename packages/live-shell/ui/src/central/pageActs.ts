// A page's copy and its leaving, and a world's name (O-I #743; manual §10.9 "the acts on every object", §18.1 "Central: the Day, its worlds
// and their pages"): each the owner's own operation, carried by the kernel.
// - a page's copy is the page owner's duplicate (kernel/src/page.rs `duplicate`): the page read and made again with an identity of its own
//   (flow/placement.ts stampCopy's rules; a Flow re-minted) through its world's door — a project's human ground through
//   projectcentral.source.create, your world's folder through Central's first-save door — in its own world, or in another world's folder,
//   tied to that world;
// - a page leaves its world through the page owner's trash (kernel/src/page.rs `trash`): Central's central.files.trash on the revision the
//   page was read at, the person's act; Central keeps it in its file history and central.files.restore brings it back (`recover`);
// - a world's name is Central's (central.world.name, the person's act): kept in the world's ProjectCentral manifest and disclosed by the world
//   browse (`world_name`), so the browser's row and today's track both read it.
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {CentralLocation, KernelTransportStatus, PageRequest} from '../../../../../desktop/cradle/src/kernel/types'
import {actionAnswerOf, centralActionOp} from './devices/centralActions'
import {windowReadingsChanged} from '../owners/readingsChanged'
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

const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)

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

/** Central's receipt for a world's name (central.world.name). */
export interface WorldNamed {
  readonly schema: 'central.world-name/v1'
  readonly outcome: 'named' | 'unchanged' | 'conflict'
  readonly project: string
  readonly name: string
  readonly previous_name: string | null
  readonly revision: string
}

/** A project's world named by Central, against the manifest revision its disclosure named (`manifest_revision`). A world moved since it
 * was read is refused in Central's words; once named, the world browse is asked afresh, so every reader of the worlds reads the name. */
export async function nameWorld(transport: KernelTransportStatus, world: Pick<CentralWorld, 'project' | 'name' | 'revision'>, name: string): Promise<WorldNamed> {
  if (!world.project) throw new Error(`${world.name} is no project's world: Central names a project's world.`)
  if (!world.revision) throw new Error(`Central's disclosure of ${world.name} names no manifest revision, so its name cannot be written against one: read the worlds again.`)
  const call = await kernelOp(transport, centralActionOp('central.world.name', {project: world.project, name, expected_revision: world.revision}, world.project))
  const answer = actionAnswerOf({status: call.error ? 'refused' : 'answered', value: call.outcome?.result === 'action_dispatched' ? call.outcome : null, error: call.error ?? null}, 'central.world.name')
  if (answer.status === 'refused') throw new Error(answer.error)
  if (answer.status !== 'answered') throw new Error('Central did not answer the world\'s name.')
  const named = answer.value as WorldNamed
  if (named?.schema !== 'central.world-name/v1') throw new Error('Central answered something other than the world\'s name.')
  if (named.outcome === 'conflict') throw new Error(`${world.name} moved since it was read: Central keeps another manifest now. Read the worlds again and name it on that.`)
  // The kernel holds the world browse a few seconds (kernel/src/read_cache.rs WORLD_TTL): a fresh browse reads the named world, and every
  // held reading is then retired so each view reads the name (the write's own notice may have arrived before the browse was fresh).
  const browsed = await kernelOp(transport, {op: 'world_browse', fresh: true})
  if (browsed.error) console.error('The worlds were not read again after a name:', text(browsed.error))
  windowReadingsChanged.now()
  return named
}
