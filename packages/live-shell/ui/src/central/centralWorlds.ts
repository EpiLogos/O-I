// The worlds Central's tracks can hold (manual §18.1 "The track": "A track is a world: your own, Earth, the world of a project or a
// book you are writing … Its clips are that world's pages"; T-WORLDS §4 W2), from Central's own disclosure of its registers — one
// wiki per register (the wiki field law): your world is the root register, each project with its ProjectCentral is its own. A world's
// ref is its register's wiki space as Central names it; nothing here mints one. A world's pages are the files of its folder, each read
// and placed by its island through the page owner (kernel/src/page.rs `list`): your world's folder is Control/user/flows (Central's
// one creation door in Control ground), a project's its human ground (ProjectCentral/user, whose door is projectcentral.source.create).
// A file that is no page is named by the listing, never shown as a clip.
import {kernelRead} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus, RootWorld} from '../../../../../desktop/cradle/src/kernel/types'
import {listWorldPages, type PageListing} from '../../../../../desktop/cradle/src/personal/pageOwner'

/** Your world's folder: the root register's one creation door (Central's ordinary_policy admits files only under Control/user/flows). */
export const YOUR_WORLD_FOLDER = 'Control/user/flows'

export interface CentralWorld {
  /** The register's wiki space ref, as Central discloses it. */
  readonly ref: string
  readonly name: string
  readonly kind: 'yours' | 'project'
  /** Where its pages are kept, Central-relative. */
  readonly folder: string
  /** The project it is, for a project's world. */
  readonly project: string | null
  /** The revision of its ProjectCentral manifest, which keeps its name (Central's world browse `manifest_revision`): a rename is written
   * against it. Absent for your world, and where Central names none. */
  readonly revision?: string
}

export type CentralWorldsReading =
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly reason: string}
  | {readonly state: 'read'; readonly worlds: readonly CentralWorld[]}

/** The worlds in Central's disclosure of its root: yours first, then each project whose ProjectCentral keeps a human ground and a
 * wiki, in the disclosure's order. A project without them is no world yet, and is left out. Pure. */
export function worldsOf(root: RootWorld): CentralWorld[] {
  const yours: CentralWorld = {ref: root.control.agent_wiki.wiki.space_ref ?? 'central:wiki:root', name: 'Your world', kind: 'yours', folder: YOUR_WORLD_FOLDER, project: null}
  const projects = root.work.projects.flatMap((project): CentralWorld[] => {
    const ground = project.projectcentral
    const ref = ground?.agent_wiki?.wiki?.space_ref
    if (!ref || !ground.user?.exists || !ground.user.path) return []
    // Its name is its own where Central keeps one (central.world.name, O-I #743), else its project's folder name.
    return [{ref, name: project.world_name?.trim() || project.name, kind: 'project', folder: ground.user.path, project: project.name,
      ...(project.manifest_revision ? {revision: project.manifest_revision} : {})}]
  })
  return [yours, ...projects]
}

/** How often, and how far apart, the world browse is asked again while its first browse has not yet disclosed a root. */
export const ROOT_SETTLE = {tries: 6, apartMs: 400} as const

/** Central's root disclosure through the kernel's world browse, as its worlds. A refusal is the reading, named. The kernel answers
 * before its first browse has finished (a snapshot with no navigator root and no error): that is asked again, a few times apart,
 * and only then read as the absence it is (r13: the browser's Worlds rows read the first answer and kept it). */
/** `fresh` asks the kernel again for the first browse too (a read that precedes a write). */
export async function readWorlds(transport: KernelTransportStatus | undefined, settle: {readonly tries: number; readonly apartMs: number} = ROOT_SETTLE, fresh = false): Promise<CentralWorldsReading> {
  const root = await readRoot(transport, settle, fresh)
  return root.state === 'read' ? {state: 'read', worlds: worldsOf(root.root)} : root
}

/** How the window holds Central's root disclosure (owners/ownerCall.ts useHeldRead): the browser's Places and the projects a new
 * Live set can be kept in share the one answer. */
export const centralRootHeld = (transport: KernelTransportStatus): readonly unknown[] => ['central-root', transport]

/** Central's root disclosure, or Central's words for why there is none, thrown. */
export async function centralRoot(transport: KernelTransportStatus): Promise<RootWorld> {
  const root = await readRoot(transport)
  if (root.state !== 'read') throw new Error(root.reason)
  return root.root
}

/** Central's root disclosure itself (your world, and every project of its Work), read as readWorlds reads it: the browser's Places
 * read your world and your Work from it (frame/browser/places.ts). */
export async function readRoot(transport: KernelTransportStatus | undefined, settle: {readonly tries: number; readonly apartMs: number} = ROOT_SETTLE, fresh = false): Promise<
  {readonly state: 'read'; readonly root: RootWorld} | {readonly state: 'unavailable'; readonly reason: string}> {
  if (!transport) return {state: 'unavailable', reason: 'the shell published no kernel carrier to this pane'}
  if (transport.kind === 'unavailable') return {state: 'unavailable', reason: transport.reason}
  for (let attempt = 1; ; attempt++) {
    const answer = await kernelRead(transport, {op: 'world_browse'}, {fresh: fresh || attempt > 1})
    if (answer.error || answer.outcome?.result !== 'world_read') return {state: 'unavailable', reason: answer.error ?? 'Central did not disclose its worlds'}
    const navigator = answer.outcome.snapshot.navigator
    if (navigator?.root) return {state: 'read', root: navigator.root}
    if (navigator?.error || attempt >= settle.tries) return {state: 'unavailable', reason: navigator?.error ?? 'Central returned no root disclosure'}
    await new Promise(resolve => setTimeout(resolve, settle.apartMs))
  }
}

export type WorldPagesReading =
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly reason: string}
  | {readonly state: 'read'; readonly listing: PageListing}

/** One world's pages through the page owner's listing. A folder the owner says does not exist holds no pages yet; any other refusal
 * is the reading, named. */
export async function readWorldPages(transport: KernelTransportStatus | undefined, world: Pick<CentralWorld, 'folder'>): Promise<WorldPagesReading> {
  if (!transport) return {state: 'unavailable', reason: 'the shell published no kernel carrier to this pane'}
  if (transport.kind === 'unavailable') return {state: 'unavailable', reason: transport.reason}
  try {
    return {state: 'read', listing: await listWorldPages(transport, world.folder)}
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    if (/No such file or directory/i.test(reason)) return {state: 'read', listing: {schema: 'oi.page-list/v1', path: world.folder, pages: [], not_pages: [], more: false}}
    return {state: 'unavailable', reason}
  }
}
