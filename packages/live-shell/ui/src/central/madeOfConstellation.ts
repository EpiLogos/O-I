// Central's clip of a constellation (manual §10.3: "Drag it onto a track and this mode makes its own clip of it, with the constellation as
// its source: a page in Central"; §3: "Central writes about it"; §18.1 The Clip panel: "Constellation — The one the page was made of — The
// page's source"): a constellation dropped on a world's track makes a Thing page of it in that world, and its source is read back from the
// page owner.
//
// The page is made through Central's own creation door, as the browser's New… makes a Thing (flow/createInPlace.ts createFormInPlace: a
// project's world through `projectcentral.source.create` in its human ground, your world through Central's first-save door), tied to its
// world and made of the constellation from its first write (createInPlace.ts tieWorld, tieMadeOf), so a refusal leaves nothing half-made.
// Then the page owner reads it (kernel/src/page.rs `read`, personal/pageOwner.ts readPageOwned) and the receipt says what it holds: the
// clip's source reads back from its owner, or the receipt says it does not. The creation door and the forms load with the first drop, as
// a practice page's do (desktop/cradle/src/nara/practiceWorld.ts), not with Central's tracks.
import {readPageOwned} from '../../../../../desktop/cradle/src/personal/pageOwner'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {WorldActionReceipt} from '../timeline/worldTrackAdapter'
import type {CentralWorld} from './centralWorlds'

/** The page a constellation makes in Central: a Thing (manual §18.1: "A Being or a Thing adds its ties"; a constellation is a whole and
 * the things gathered round it, §3), which Central writes about. */
export const MADE_PAGE_FORM = 'document-things'

const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)

/** Make a Thing page of `constellation` in `world` and read its source back from the page owner. Answers the receipt the Session shows
 * where the drop landed. */
export async function makePageOf(transport: KernelTransportStatus, world: Pick<CentralWorld, 'ref' | 'name' | 'project'>,
  constellation: {readonly ref: string; readonly title: string}): Promise<WorldActionReceipt> {
  const [{createFormInPlace}, {DOCUMENT_FORMS}] = await Promise.all([import('../../../../../desktop/cradle/src/flow/createInPlace'),
    import('../../../../../desktop/cradle/src/flow/documentForms')])
  const form = DOCUMENT_FORMS.find(item => item.kind === MADE_PAGE_FORM)
  if (!form) return {ok: false, error: `Central's document forms name no Thing (${MADE_PAGE_FORM}), so no page can be made here.`}
  let copy
  try {
    copy = await createFormInPlace(transport, form, {...(world.project ? {project: world.project} : {}), worldRef: world.ref, madeOf: constellation})
  } catch (cause) {
    return {ok: false, error: `${world.name} has no page of ${constellation.title}: ${text(cause)}`}
  }
  try {
    const page = await readPageOwned(transport, copy.location, true)
    const bindings = page.island.bindings as Record<string, unknown> | undefined
    const kept = bindings?.constellationRef
    if (kept !== constellation.ref) {
      return {ok: false, error: `Central made the page at ${copy.location.path}, but the page owner reads ${typeof kept === 'string' ? `its source as ${kept}` : 'no source on it'}, not ${constellation.ref}.`}
    }
    return {ok: true, note: `${world.name} has a new Thing page of ${constellation.title} (${copy.location.path}); the page owner reads its source as ${constellation.title}.`}
  } catch (cause) {
    return {ok: false, error: `Central made the page at ${copy.location.path}, but the page owner did not read it back: ${text(cause)}`}
  }
}
