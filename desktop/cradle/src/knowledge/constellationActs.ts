// One constellation you made, act by act (O-I #742, the construction chain; manual §17.4 Canvas, §10.3 the browser, §10.9 acts and
// menus). Each act is the Wiki owner's: AIKit's `aikit.constellation.apply` through the kernel's invoke_action, on the register's file at
// the revision it was read at (construction.ts saveConstruction), its request built by the same draft law the detached construction
// panel used (constructionDraft.ts fromNative · draftRequest), so a stale revision is refused and nothing is written behind your back.
//
// The acts and where they stand now that the panel is retired:
//   - New constellation, Rename, Edit question: the browser's menu on a constellation (frame/browser/ConstellationRows.tsx);
//   - a passage gathered with its span: the reader's "Add to constellation" (KnowledgeSurface.tsx), into the constellation in focus;
//   - a member removed, a member's time and place, a connection's meaning, direction and standing, or its retraction: the browser's
//     menu on the member or the connection, under the constellation it belongs to;
//   - the saved Expression returned to the constellation: the menu of the Expressions clip made of it.
// A constellation is named by its whole's ref, as the browser names it; the frame that gathers round that whole is found in the register.
import type {CentralLocation, KernelTransportStatus} from '../kernel/types';
import type {TechnePlaceFacet, TechneTemporalFacet} from '../techne/contract';
import {listFiles, readFile} from '../files/client';
import {CONSTRUCTION, PARTICIPATION, RELATION, newConstruction, newRef, readRegister, saveConstruction,
  type ConstructionRequest, type NativeConstruction, type NativeRelation, type SavedConstruction, type WikiRegister} from './construction';
import {draftRequest, fromNative, withoutMember, type ConstructionDraft, type DraftMember} from './constructionDraft';
import {attachCompositionReturn, compositionAttached, inspectCompositionFile, reopenComposition, type ArtifactReturn} from './constructionProjection';
import {performArtifactSave, prepareArtifactSave} from './artifactRecovery';
import {passageProvenance, type WikiPassage} from './selection';
import type {WikiAnchor} from './wikiDocument';
import type {ExpressionDocument} from '../expression/types';

/** A member of a constellation you made: one participation of a source, with the passage it was gathered by. */
export interface ConstructionMember {
  readonly participation_ref: string;
  readonly subject_ref: string;
  /** The passage's words, else the source's ref. */
  readonly label: string;
  /** The exact span of the source the member was gathered from, at the revision it was read. */
  readonly anchor?: WikiAnchor;
  readonly role_ref: string | null;
  readonly temporal: readonly TechneTemporalFacet[];
  readonly places: readonly TechnePlaceFacet[];
}
/** A connection between two members, as the owner holds it. */
export interface ConstructionConnection {
  readonly ref: string;
  readonly revision: number;
  readonly from: string;
  readonly to: string;
  readonly relation: string;
  readonly direction: string;
  readonly standing: string;
}
/** What a constellation you made holds, as the register gives it at one revision. */
export interface ConstructionReading {
  readonly whole: string;
  readonly frame_ref: string;
  readonly revision: number;
  readonly title: string;
  readonly question: string;
  readonly members: readonly ConstructionMember[];
  readonly connections: readonly ConstructionConnection[];
  readonly compositions: readonly {readonly reference: string; readonly revision: string; readonly kind: string; readonly source: Record<string, unknown>}[];
}

/** A connection's directions and standings, as the owner keeps them (constructionDraft.ts draftRequest relation_put). */
export const DIRECTIONS = [{value: 'directed', label: 'From → to'}, {value: 'undirected', label: 'Undirected'}, {value: 'bidirectional', label: 'Both directions'}] as const;
export const STANDINGS = ['proposed', 'asserted', 'contested', 'uncertain'] as const;

/** The frame that gathers round `whole` in the register: a constellation you made (`aikit.constellation/v1`). Null for a whole the register
 * holds only as a space, or as a form it declares. Pure. */
export function constructionRound(register: Pick<WikiRegister, 'frames'>, whole: string): NativeConstruction | null {
  return register.frames.find(frame => frame.constellations[0]?.anchor_ref === whole) ?? null;
}

const anchorOf = (member: DraftMember): WikiAnchor | undefined => {
  for (const source of member.sources) {
    if (source.source_ref !== member.subject_ref || typeof source.source_revision !== 'string') continue;
    const facet = source['aikit.techne-facet/v1'] as {selector?: {unit?: unknown; kind?: unknown; value?: unknown}} | undefined;
    if (facet?.selector?.unit !== 'other' || facet.selector.kind !== 'markdown-utf8-span' || typeof facet.selector.value !== 'string') continue;
    try {
      const span = JSON.parse(facet.selector.value) as {start_byte?: unknown; end_byte?: unknown};
      if (Number.isSafeInteger(span.start_byte) && Number.isSafeInteger(span.end_byte) && (span.start_byte as number) >= 0 && (span.end_byte as number) > (span.start_byte as number))
        return {revision: source.source_revision, start_byte: span.start_byte as number, end_byte: span.end_byte as number};
    } catch { /* A malformed native selector opens the source at its top, never at a guessed span. */ }
  }
  return undefined;
};

/** The reading of one constellation you made. Pure. */
export function constructionReadingOf(register: Pick<WikiRegister, 'frames' | 'relations'>, frame: NativeConstruction): ConstructionReading {
  const draft = fromNative(frame, register.relations);
  return {whole: draft.anchor_ref, frame_ref: frame.ref, revision: frame.revision, title: draft.title, question: draft.question,
    members: draft.members.map(member => ({participation_ref: member.participation_ref, subject_ref: member.subject_ref, label: member.label,
      ...(anchorOf(member) ? {anchor: anchorOf(member)} : {}), role_ref: member.role_ref, temporal: member.temporal ?? [], places: member.places ?? []})),
    connections: draft.relations.map(edge => ({ref: edge.ref, revision: edge.revision ?? 1, from: edge.from, to: edge.to, relation: edge.relation,
      direction: edge.direction, standing: edge.standing})),
    compositions: frame[CONSTRUCTION].compositions ?? []};
}

/** The whole a frame of the register gathers round (any frame: one you made, or a form your wiki declares), or null. Pure. */
export function wholeOfFrame(register: Pick<WikiRegister, 'file'>, frame_ref: string): string | null {
  try {
    const raw: unknown = JSON.parse(register.file.content);
    const rows = Array.isArray(raw) ? raw : (raw as {objects?: unknown})?.objects;
    const frame = Array.isArray(rows) ? rows.find(row => (row as {object?: unknown; ref?: unknown})?.object === 'frame' && (row as {ref?: unknown}).ref === frame_ref) as {constellations?: {anchor_ref?: unknown}[]} | undefined : undefined;
    const anchor = frame?.constellations?.[0]?.anchor_ref;
    return typeof anchor === 'string' ? anchor : null;
  } catch { return null; }
}

/** Why a whole takes no construction act: it is not a constellation you made. */
export function notMade(title: string): string {
  return `${title} is not a constellation you made: its members are its space's own, or the roles a form declares. Choose New constellation in the browser's menu on a space, and gather into that.`;
}

// ---------------------------------------------------------------------------------------------------------------- the requests (pure)

const draftOf = (register: Pick<WikiRegister, 'relations'>, frame: NativeConstruction): ConstructionDraft => fromNative(frame, register.relations);

/** A new constellation in a space of your wiki, with its title and its question, gathering nothing yet. */
export function createRequest(title: string, question: string, space_ref: string): ConstructionRequest {
  return newConstruction(title, question, space_ref);
}
/** The constellation's title or its question changed. */
export function inquiryRequest(register: Pick<WikiRegister, 'relations'>, frame: NativeConstruction, change: {title?: string; question?: string}): ConstructionRequest {
  const draft = draftOf(register, frame);
  return draftRequest({...draft, title: change.title ?? draft.title, question: change.question ?? draft.question});
}
/** A passage gathered as a new member, with its exact span. A passage already gathered is refused. */
export function passageRequest(register: Pick<WikiRegister, 'relations'>, frame: NativeConstruction, passage: WikiPassage): ConstructionRequest {
  const draft = draftOf(register, frame), provenance = passageProvenance(passage);
  // The same source at the same revision, the same span and the same words, however the owner orders the keys it keeps them in.
  const same = (source: Record<string, unknown>) => {
    if (source.source_ref !== passage.source_ref || source.source_revision !== passage.source_revision) return false;
    const value = (source['aikit.techne-facet/v1'] as {selector?: {kind?: unknown; value?: unknown}} | undefined)?.selector;
    if (value?.kind !== 'markdown-utf8-span' || typeof value.value !== 'string') return false;
    try { const span = JSON.parse(value.value) as {start_byte?: unknown; end_byte?: unknown; quote?: unknown};
      return span.start_byte === passage.selector.start_byte && span.end_byte === passage.selector.end_byte && span.quote === passage.text; } catch { return false; }
  };
  if (draft.members.some(member => member.subject_ref === passage.source_ref && member.sources.some(same)))
    throw new Error(`This passage is already gathered in ${draft.title}.`);
  if (draft.members.length >= 96) throw new Error(`${draft.title} gathers 96 members, as many as one constellation holds. Make another constellation for this passage.`);
  return draftRequest({...draft, members: [...draft.members, {subject_ref: passage.source_ref, participation_ref: newRef('participation:wiki'), role_ref: null,
    label: passage.text, sources: [provenance], passage}]});
}
/** A member removed, with every connection it makes; the source it came from stays as it is. */
export function removeRequest(register: Pick<WikiRegister, 'relations'>, frame: NativeConstruction, participation_ref: string): ConstructionRequest {
  const draft = draftOf(register, frame);
  if (!draft.members.some(member => member.participation_ref === participation_ref)) throw new Error(`That member is no longer in ${draft.title}.`);
  return draftRequest(withoutMember(draft, participation_ref));
}
/** A connection's meaning, direction or standing changed, or (null) the connection retracted. */
export function connectionRequest(register: Pick<WikiRegister, 'relations'>, frame: NativeConstruction, relation_ref: string,
  change: {relation?: string; direction?: string; standing?: string} | null): ConstructionRequest {
  const draft = draftOf(register, frame);
  if (!draft.relations.some(edge => edge.ref === relation_ref)) throw new Error(`That connection is no longer in ${draft.title}.`);
  if (change?.direction !== undefined && !DIRECTIONS.some(row => row.value === change.direction)) throw new Error('A connection runs from → to, both ways, or neither.');
  if (change?.standing !== undefined && !(STANDINGS as readonly string[]).includes(change.standing)) throw new Error(`A connection stands ${STANDINGS.join(', ')}.`);
  return draftRequest({...draft, relations: change === null ? draft.relations.filter(edge => edge.ref !== relation_ref)
    : draft.relations.map(edge => (edge.ref === relation_ref ? {...edge, ...change} : edge))});
}
/** A member's time and place in this constellation, each fact with the evidence file it was read from. */
export function factsRequest(register: Pick<WikiRegister, 'relations'>, frame: NativeConstruction, participation_ref: string,
  facts: {temporal: TechneTemporalFacet[]; places: TechnePlaceFacet[]; facet_sources: NonNullable<DraftMember['facet_sources']>}): ConstructionRequest {
  const draft = draftOf(register, frame);
  if (!draft.members.some(member => member.participation_ref === participation_ref)) throw new Error(`That member is no longer in ${draft.title}.`);
  return draftRequest({...draft, members: draft.members.map(member => (member.participation_ref === participation_ref
    ? {...member, temporal: facts.temporal, places: facts.places, facet_sources: facts.facet_sources} : member))});
}

// ---------------------------------------------------------------------------------------------------------------- the acts

/** The register read, and the constellation you made round `whole` in it, or why there is none. */
export async function readConstruction(transport: KernelTransportStatus, project: string | undefined, whole: string): Promise<{register: WikiRegister; reading: ConstructionReading} | null> {
  const register = await readRegister(transport, project);
  const frame = constructionRound(register, whole);
  return frame ? {register, reading: constructionReadingOf(register, frame)} : null;
}

/** One act on the constellation round `whole`: the register read at its revision, the request built on it, saved through the owner. */
export async function actOn(transport: KernelTransportStatus, project: string | undefined, whole: string, title: string,
  build: (register: WikiRegister, frame: NativeConstruction) => {request: ConstructionRequest; passages?: WikiPassage[]; files?: {source_ref: string; revision: string; location: CentralLocation}[]}): Promise<SavedConstruction> {
  const register = await readRegister(transport, project);
  const frame = constructionRound(register, whole);
  if (!frame) throw new Error(notMade(title));
  const {request, passages = [], files = []} = build(register, frame);
  return saveConstruction(transport, project, register, request, passages, undefined, files);
}

/** New constellation: written in the space, read back; its whole is the ref the browser then selects. */
export async function createConstellation(transport: KernelTransportStatus, project: string | undefined, space_ref: string, title: string, question: string): Promise<{whole: string; saved: SavedConstruction}> {
  const register = await readRegister(transport, project);
  if (!register.spaces.some(space => space.ref === space_ref)) throw new Error('That space is not in this wiki\'s register now: read the browser again.');
  const request = createRequest(title, question, space_ref);
  const saved = await saveConstruction(transport, project, register, request, []);
  return {whole: saved.reading.frame.constellations[0]!.anchor_ref, saved};
}

/** Return: the Expression made of the constellation saved as a file beside its wiki (or at the file a Return already wrote), then
 * attached to the constellation, which links to it from then on. */
export async function returnExpression(transport: KernelTransportStatus, project: string | undefined, whole: string, title: string, expression_ref: string): Promise<{artifact: ArtifactReturn; saved: SavedConstruction | null}> {
  const register = await readRegister(transport, project);
  const frame = constructionRound(register, whole);
  if (!frame) throw new Error(notMade(title));
  const held = (frame[CONSTRUCTION].compositions ?? []).find(item => item.reference === expression_ref && item.kind === 'expression');
  const heldAt = (held?.source['oi.expression-file/v1'] as {location?: CentralLocation} | undefined)?.location;
  let destination: Parameters<typeof prepareArtifactSave>[2];
  if (heldAt) {
    const slash = heldAt.path.lastIndexOf('/');
    const entry = (await listFiles(transport, slash < 0 ? '' : heldAt.path.slice(0, slash), true)).entries.find(row => row.name === heldAt.path.slice(slash + 1) && row.kind === 'file');
    if (!entry) throw new Error(`The Expression ${title} returned before is no longer at ${heldAt.path}.`);
    destination = {location: entry.location, revision: (await readFile(transport, entry.location, true)).revision};
  } else {
    const path = register.file.location.path, marker = '/ProjectCentral/';
    const folder = path.includes(marker) ? path.slice(0, path.indexOf(marker)) : 'Work';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'constellation';
    const listing = await listFiles(transport, folder, true);
    // A file of the name that already holds this Expression is its own (a Return whose answer was lost writes there again, never a second
    // file); one that holds another is another's, and the new file takes the next free name, never its place.
    let found: typeof destination | undefined;
    for (const name of Array.from({length: 99}, (_, i) => `${slug}${i ? `-${i + 1}` : ''}.expression.json`)) {
      const entry = listing.entries.find(row => row.name === name);
      if (!entry) { found = {parent: listing.location, name, operation_ref: newRef('operation:expression')}; break; }
      if (entry.kind !== 'file' || !entry.retrieval_allowed) continue;
      const file = await readFile(transport, entry.location, true);
      const held = await inspectCompositionFile(transport, file).catch(() => null);
      if (held?.document.expression_ref === expression_ref) { found = {location: file.location, revision: file.revision}; break; }
    }
    if (!found) throw new Error(`${folder} holds every name this Expression could take; return it once a ${slug}.expression.json is moved.`);
    destination = found;
  }
  const artifact = await performArtifactSave(transport, await prepareArtifactSave(transport, expression_ref, destination));
  if (compositionAttached(frame, artifact)) return {artifact, saved: null};
  return {artifact, saved: await attachCompositionReturn(transport, project, register, frame, artifact)};
}

/** Reopen a returned Expression from its file, as the working composition. */
export function reopenReturned(transport: KernelTransportStatus, item: ConstructionReading['compositions'][number]): Promise<ExpressionDocument> {
  return reopenComposition(transport, item);
}

/** The participation's facts as a member of the reading names them (for the time-and-place editor). Pure. */
export function memberOf(reading: ConstructionReading, participation_ref: string): ConstructionMember | null {
  return reading.members.find(member => member.participation_ref === participation_ref) ?? null;
}
export {PARTICIPATION, RELATION, type NativeRelation};
