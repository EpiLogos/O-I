// The owner's day surface (Control/user/day): one folder per civil date, holding that Day's `day.md` — 29 days through
// 13 Oct on the owner's ground, each answering `day_read`. The browser's Days and the Central Day track read it; until 15 Oct
// they read the legacy agent records (`Control/agents/now/day/<date>.md`), which stop at 12 Sep (lane L found it on the dev
// bridge). Both shapes read as the same day entries here, so every reader downstream — the rows, the Day track, the openers,
// the path parsers — takes one shape: a file entry named `<date>.md` whose location is the day's document.
import type {CentralLocation, NativeFileEntry} from '../../../../../desktop/cradle/src/kernel/types'

export const CENTRAL_DAYS_PATH = 'Control/user/day'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_FILE = /^\d{4}-\d{2}-\d{2}\.md$/
const DAY_PATH = /(?:\/now\/day\/(\d{4}-\d{2}-\d{2})\.md|(?:^|\/)user\/day\/(\d{4}-\d{2}-\d{2})\/day\.md)$/

/** The civil date a day's path names: the owner's `…/user/day/<date>/day.md`, or a legacy record's `…/now/day/<date>.md`. */
export function dateOfDayPath(path: string): string | null {
  const match = DAY_PATH.exec(path)
  return match ? match[1] ?? match[2] ?? null : null
}

/** A child's location under a listed folder, in the owner's own ref grammar (`central:path:<root>:<path>`). */
function childLocation(location: CentralLocation, name: string): CentralLocation {
  const path = `${location.path}/${name}`
  return {...location, path, ref: `central:path:${location.root}:${path}`}
}

/** A day listing's entries as day entries: a date folder becomes its `day.md` (named `<date>.md`; its size is unread, 0), a legacy
 * `<date>.md` record stays as it is; anything else is not a day. */
export function dayEntriesOf(entries: readonly NativeFileEntry[]): NativeFileEntry[] {
  return entries.flatMap((entry): NativeFileEntry[] => {
    if (entry.kind === 'directory' && DATE.test(entry.name)) {
      return [{...entry, kind: 'file', name: `${entry.name}.md`, location: childLocation(entry.location, 'day.md'), byte_len: 0}]
    }
    return entry.kind !== 'directory' && DAY_FILE.test(entry.name) ? [entry] : []
  })
}
