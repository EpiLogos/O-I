// Central's track and clip names, as the kernel's Set gives them (kernel mode_set.rs, O-I #1004). Central's Set — your world and the
// worlds today's set holds as tracks, their pages as clips, the Day as the Main track — is the kernel's, built from the World Model's
// worlds, day and workcells slices, and drawn through frame/tracks/kernelSet.ts. What stays here are the names the window's other readers
// share with that Set:
// - the Day's track id (the Main track) and a world's track id, `central:world:<ref>`;
// - the drag type a world carries from the browser onto the empty track;
// - a clip's ground subject: a page's clip id is its Central-relative path, so selecting it opens the page (a day record's path opens as
//   a day);
// - the pages that play now, from NOW listings (the Day's close reads them).
// Pure TypeScript. No React, no transport.
import {dateOfDayPath} from '../central/daySurface'
import type {NowListing} from '../../../../../desktop/cradle/src/receiving/now'

/** The Day, the Main track: its id (the kernel's Set names it so). */
export const CENTRAL_DAY_TRACK_ID = 'central:day'
/** A world's track id: its register's wiki space ref. */
export const centralWorldTrackId = (worldRef: string): string => `central:world:${worldRef}`
/** The drag type a world carries from the browser to the empty track (manual §18.1: "drag it from the browser onto an empty track"). */
export const CENTRAL_WORLD_DRAG = 'application/x-oi-central-world'

/** A page that plays now: its NOW clearing, by the page's file ref (kernel/src/page.rs `page_task`). */
export interface CentralPlaying {
  readonly pageRef: string
  readonly nowRef: string
  readonly project: string | null
  /** When the clearing was made (its owner's created time), unix ms. */
  readonly sinceMs: number | null
}

/** The task a page's clearing carries (kernel/src/page.rs `page_task`). */
const PAGE_TASK = 'oi:page:'

/** The pages that play now, from NOW listings: each active clearing whose task is a page's. Pure. */
export function playingOf(listings: readonly {project: string | null; listing: NowListing}[]): CentralPlaying[] {
  return listings.flatMap(({project, listing}) => listing.records
    .filter(row => row.lifecycle === 'active' && row.task_ref.startsWith(PAGE_TASK))
    .map(row => ({pageRef: row.task_ref.slice(PAGE_TASK.length), nowRef: row.now_ref, project,
      sinceMs: Number.isFinite(row.created_at_unix_seconds) ? row.created_at_unix_seconds * 1000 : null})))
}

/** A page's path: your world's folder, or a project's human ground. */
const PAGE_PATH = /(?:^|\/)(?:Control\/user\/flows\/[^/]+|Work\/[^/]+\/ProjectCentral\/user\/(?:[^/]+\/)*[^/]+)\.html$/i

/** The Central ground subject a clip id names: a day record's path opens as a day, a page's path as the page it is (the browser's
 * rows select the same). Anything else — an entry's id, an occasion — is no ground subject: null. */
export function centralSubjectOfClip(ref: string): {kind: 'day' | 'note'; path: string} | null {
  if (dateOfDayPath(ref)) return {kind: 'day', path: ref}
  return PAGE_PATH.test(ref) ? {kind: 'note', path: ref} : null
}
