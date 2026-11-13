// The worlds Central's tracks can hold (manual §18.1 "The track": "A track is a world: your own, Earth, the world of a project or a
// book you are writing … Its clips are that world's pages"; T-WORLDS §4 W2), from Central's own disclosure of its registers — one
// wiki per register (the wiki field law): your world is the root register, each project with its ProjectCentral is its own. A world's
// ref is its register's wiki space as Central names it; nothing here mints one. A world's pages are the files of its folder, each read
// and placed by its island through the page owner (kernel/src/page.rs `list`): your world's folder is Control/user/flows (Central's
// one creation door in Control ground), a project's its human ground (ProjectCentral/user, whose door is projectcentral.source.create).
// A file that is no page is named by the listing, never shown as a clip.
import type {KernelTransportStatus, RootWorld} from '../../../../../desktop/cradle/src/kernel/types'
import type {PageListing} from '../../../../../desktop/cradle/src/personal/pageOwner'
import {modelSlice, sliceValue} from '../owners/model'

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

/** How a read of the worlds is asked: `fresh` reads them from Central first, past every held reading (the read before a write). */
export interface WorldsRead {readonly fresh?: boolean}

/** The worlds of Central's root, from the World Model's worlds slice (kernel world_model.rs `worlds_of`): yours first, then each project
 * whose ProjectCentral keeps a human ground and a wiki, in Central's disclosure's order. A refusal is the reading, named. */
export async function readWorlds(transport: KernelTransportStatus | undefined, read: WorldsRead = {}): Promise<CentralWorldsReading> {
  const slice = await worldsSlice(transport, read)
  return slice.ok ? {state: 'read', worlds: slice.value.worlds} : {state: 'unavailable', reason: slice.reason}
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

/** Central's root disclosure itself (your world, and every project of its Work), from the World Model's worlds slice: the browser's
 * Places read your world and your Work from it (frame/browser/places.ts). */
export async function readRoot(transport: KernelTransportStatus | undefined, read: WorldsRead = {}): Promise<
  {readonly state: 'read'; readonly root: RootWorld} | {readonly state: 'unavailable'; readonly reason: string}> {
  const slice = await worldsSlice(transport, read)
  return slice.ok ? {state: 'read', root: slice.value.root} : {state: 'unavailable', reason: slice.reason}
}

/** What the World Model's worlds slice holds (kernel world_model.rs `worlds`). */
interface WorldsValue {
  readonly root: RootWorld
  readonly worlds: readonly CentralWorld[]
  readonly pages: readonly ({readonly folder: string; readonly state: 'read'; readonly listing: PageListing} | {readonly folder: string; readonly state: 'refused'; readonly why: string})[]
}

async function worldsSlice(transport: KernelTransportStatus | undefined, read: WorldsRead): Promise<{ok: true; value: WorldsValue} | {ok: false; reason: string}> {
  if (!transport) return {ok: false, reason: 'the shell published no kernel carrier to this pane'}
  if (transport.kind === 'unavailable') return {ok: false, reason: transport.reason}
  return sliceValue<WorldsValue>(await modelSlice(transport, 'worlds', read))
}

export type WorldPagesReading =
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly reason: string}
  | {readonly state: 'read'; readonly listing: PageListing}

/** One world's pages, from the World Model's worlds slice: each world Central discloses is held with its pages (a folder the owner says
 * does not exist holds none yet). A folder that is no world's, or whose listing the owner refused, is the reading, named. */
export async function readWorldPages(transport: KernelTransportStatus | undefined, world: Pick<CentralWorld, 'folder'>, read: WorldsRead = {}): Promise<WorldPagesReading> {
  const slice = await worldsSlice(transport, read)
  if (!slice.ok) return {state: 'unavailable', reason: slice.reason}
  const held = slice.value.pages.find(entry => entry.folder === world.folder)
  if (!held) return {state: 'unavailable', reason: `${world.folder} is no world's folder Central discloses.`}
  return held.state === 'read' ? {state: 'read', listing: held.listing} : {state: 'unavailable', reason: held.why}
}
