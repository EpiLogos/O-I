// Sections on the shared Session grid and Arrangement ruler (manual §8: "Ages nest inside ages, and the narrowest colours
// everything inside it"; worldTrackAdapter.ts WorldTrackSection: "a nested span on the time axis (a locator). The narrowest
// section containing a point supplies what plays inside it"). Ported from the World cut presentation the tracks pane replaced:
// git 09a573a1d:packages/live-shell/ui/src/projections/worldTimelinePresentation.tsx:391-431 — a section's depth by its parent
// links (:398-408), the order (:410-412: by start, the wider first, the shallower first), one lane per layer (:413-417) named
// by the layer (:409, :420, else "Sections"), each section in its atmosphere, else the line colour (:426).
//
// What the port adds is where they stand now that sections have a place on the ruler (techneTrackAdapter moves an epoch's span
// onto it): the Arrangement draws each layer's sections as nested bands at their spans; the Session nests its rows under the
// sections they stand in — a row stands where its clips stand on the ruler (the earliest `at` among them), in the layer of the
// track that clip sits on — a head row for each section a run of rows enters, the rows under it carrying a rail per section in
// that section's atmosphere, as a track under a group carries a rail per ancestor (SessionGrid.tsx). A set with no sections,
// or rows with no place, lays its rows exactly as before.
//
// Pure TypeScript. No React.
import type {WorldTrack, WorldTrackClip, WorldTrackColumn, WorldTrackSection, WorldTrackSet} from '../../timeline/worldTrackAdapter'

export interface SectionItem {
  section: WorldTrackSection
  /** How many sections it sits under, by its parent links. */
  depth: number
}

/** A section's depth: the parents walked until one the set does not hold, or a cycle (worldTimelinePresentation.tsx:398-408). */
export function sectionDepth(section: WorldTrackSection, byId: ReadonlyMap<string, WorldTrackSection>): number {
  let depth = 0
  const seen = new Set<string>([section.id])
  let parent = section.parentId ? byId.get(section.parentId) : undefined
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id)
    depth += 1
    parent = parent.parentId ? byId.get(parent.parentId) : undefined
  }
  return depth
}

/** The sections with their depths, by start, the wider first, then the shallower (:410-412). */
export function orderedSections(sections: readonly WorldTrackSection[]): SectionItem[] {
  const byId = new Map(sections.map(section => [section.id, section] as const))
  return sections
    .map(section => ({section, depth: sectionDepth(section, byId)}))
    .sort((a, b) => a.section.span.start - b.section.span.start || b.section.span.end - a.section.span.end || a.depth - b.depth)
}

export interface SectionLane {
  /** The layer the lane's sections belong to; undefined for sections of no layer. */
  layerId: string | undefined
  /** The layer's name, else "Sections" (:420). */
  name: string
  items: SectionItem[]
  /** The deepest nesting in the lane, plus one: the rows the lane needs. */
  levels: number
}

/** One lane per layer, in the order the sections first name their layers (:413-417). */
export function sectionLanes(set: Pick<WorldTrackSet, 'sections' | 'layers'>): SectionLane[] {
  const sections = set.sections ?? []
  if (!sections.length) return []
  const layerName = new Map((set.layers ?? []).map(layer => [layer.id, layer.name] as const))
  const lanes = new Map<string, SectionLane>()
  for (const item of orderedSections(sections)) {
    const key = item.section.layerId ?? ''
    let lane = lanes.get(key)
    if (!lane) {
      lane = {layerId: item.section.layerId, name: (item.section.layerId !== undefined ? layerName.get(item.section.layerId) : undefined) ?? 'Sections', items: [], levels: 0}
      lanes.set(key, lane)
    }
    lane.items.push(item)
    lane.levels = Math.max(lane.levels, item.depth + 1)
  }
  return [...lanes.values()]
}

/** The sections of a layer that hold a point, outermost first — the narrowest last. Spans are half-open. */
export function sectionChain(sections: readonly WorldTrackSection[], at: number, layerId: string | undefined): WorldTrackSection[] {
  if (!Number.isFinite(at)) return []
  const byId = new Map(sections.map(section => [section.id, section] as const))
  return sections
    .filter(section => section.layerId === layerId && section.span.start <= at && at < section.span.end)
    .map(section => ({section, depth: sectionDepth(section, byId)}))
    .sort((a, b) => a.depth - b.depth || (b.section.span.end - b.section.span.start) - (a.section.span.end - a.section.span.start))
    .map(item => item.section)
}

/** The narrowest section a clip stands in — the one whose atmosphere colours it — when it has a place and its track a layer the
 * sections share. */
export function narrowestSectionOf(set: Pick<WorldTrackSet, 'sections'>, clip: Pick<WorldTrackClip, 'at'>, track: Pick<WorldTrack, 'layerId'> | undefined): WorldTrackSection | undefined {
  if (!set.sections?.length || !clip.at) return undefined
  const chain = sectionChain(set.sections, clip.at.start, track?.layerId)
  return chain[chain.length - 1]
}

/** Where a row stands: the earliest place among its clips, and the layer of that clip's track. */
export function rowPlace(set: Pick<WorldTrackSet, 'clips' | 'tracks'>, columnId: string): {at: number; layerId: string | undefined} | undefined {
  let best: WorldTrackClip | undefined
  for (const clip of set.clips) if (clip.columnId === columnId && clip.at && (!best || clip.at.start < best.at!.start)) best = clip
  if (!best) return undefined
  return {at: best.at!.start, layerId: set.tracks.find(track => track.id === best!.trackId)?.layerId}
}

/** One item of the Session's row layout: a row (a stop), or the head of a section a run of rows enters. `chain` is the sections
 * the item stands under, outermost first; a head's chain ends with its own section. */
export type SessionRowItem =
  | {kind: 'row'; column: WorldTrackColumn; index: number; chain: WorldTrackSection[]}
  | {kind: 'head'; section: WorldTrackSection; depth: number; chain: WorldTrackSection[]; rows: number}

/** The fold key of a section head (the grid's fold record is keyed by track id; a section keeps to its own keys). */
export const sectionFoldKey = (id: string): string => `section:${id}`

/** The Session's rows, in the set's order, with a head wherever a run of rows enters a section (rows that leave and re-enter a
 * section get a second head: the rows keep their order, nothing is moved). A set with no sections is its rows unchanged. */
export function sessionRowLayout(set: Pick<WorldTrackSet, 'columns' | 'clips' | 'tracks' | 'sections'>): SessionRowItem[] {
  const sections = set.sections ?? []
  if (!sections.length) return set.columns.map((column, index) => ({kind: 'row', column, index, chain: []}))
  const items: SessionRowItem[] = []
  let previous: WorldTrackSection[] = []
  set.columns.forEach((column, index) => {
    const place = rowPlace(set, column.id)
    const chain = place ? sectionChain(sections, place.at, place.layerId) : []
    let same = 0
    while (same < chain.length && same < previous.length && chain[same].id === previous[same].id) same++
    for (let depth = same; depth < chain.length; depth++) items.push({kind: 'head', section: chain[depth], depth, chain: chain.slice(0, depth + 1), rows: 0})
    items.push({kind: 'row', column, index, chain})
    previous = chain
  })
  // How many rows each head holds: the run of rows after it that stand in its section.
  items.forEach((item, at) => {
    if (item.kind !== 'head') return
    for (let next = at + 1; next < items.length; next++) {
      const after = items[next]
      if (after.kind === 'head') { if (after.depth <= item.depth) break; continue }
      if (after.chain[item.depth]?.id !== item.section.id) break
      item.rows += 1
    }
  })
  return items
}

/** The layout with every row and head under a folded section left out (a head shows while its own section is folded, so it can
 * be unfolded). */
export function shownRowLayout(layout: readonly SessionRowItem[], folded: Readonly<Record<string, boolean>>): SessionRowItem[] {
  return layout.filter(item => {
    const above = item.kind === 'head' ? item.chain.slice(0, -1) : item.chain
    return !above.some(section => folded[sectionFoldKey(section.id)])
  })
}
