// The suite's corpus provider: the atlas reads Central's owners, never an old corpus [T-N3-ATLAS-SUITE-PROVIDER; FOUNDATION §3 N3;
// DEVICE-SEMANTICS-LOCK §8.4: material comes through the corpus provider seam (C2) and native owners with refs and revisions].
//
// What it reads, and only this:
//   - the kernel's `Graph` op, one owner input at a time (desktop/cradle/src/knowledge/graph.ts:21 readGraph; kernel
//     desktop/cradle/kernel/src/lib.rs:459, input selection desktop/cradle/kernel/src/graph.rs:63): `central_wiki`, then `shared_field`, then
//     `aikit_resolution`. Each is composed as it arrives (provider/suiteReading.ts), and the standing is published after each
//     (provider/suiteStanding.ts), so the pane can say what has arrived and what it waits on.
//   - Central's own wiki file through the files seam (desktop/cradle/src/techne/wikiExpression.ts:137 reads it the same way): the
//     node `type`, and the place and time each node declares, handed to the owners' own readers (techne/placeFacets.ts,
//     spatialFacets.ts, temporalFacets.ts), verbatim. The Graph op returns neither a place nor a time for any row.
//   - the open Technē reading's place facets, when the host passes one in (`openReading`).
//
// It is a CorpusProvider as the seam defines one (provider/corpusProvider.ts:70-92: id, name, load() → CorpusBundle) and is bound the way
// the host binds any provider: registered as the default by the atlas host (AtlasProjectionPanel.tsx).
//
// Retired as a source: provider/archetypalEarthProvider.ts. Archetypal-Earth's bundled corpus is no longer read by the shell.
//
// The atlas's refresh seam (src/data/occurrenceSeam.ts) replaces one occurrence of a mounted field, and refuses an occurrence whose
// family is tied to an archetype (tiedElsewhere, occurrenceSeam.ts:59; the refusal, :96). The suite's families are tied to their
// registers, so an input that arrives after the Earth has stood cannot be folded in place. `load()` therefore waits for the ground
// (Central's wiki) and the hosted field, gives AIKit's resolution a short grace, and composes what has settled; an input that settles
// after is named in the standing ("answered after the Earth stood") and joins the next reading.

import {readGraph, type GraphReading} from '../../../../../../../desktop/cradle/src/knowledge/graph';
import {listFiles, readFile} from '../../../../../../../desktop/cradle/src/files/client';
import type {CentralLocation, KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types';
import {parseWiki, wikiPathForProject} from '../../../../../../../desktop/cradle/src/techne/wikiReading';
import {placeFacetsFromReading} from '../../../../../../../desktop/cradle/src/techne/placeFacets';
import {readWikiSpatial} from '../../../../../../../desktop/cradle/src/techne/spatialFacets';
import {readWikiTemporal} from '../../../../../../../desktop/cradle/src/techne/temporalFacets';
import type {WikiRegisterReading} from '../../../../../../../desktop/cradle/src/techne/wikiExpression';
import type {CorpusBundle, CorpusProvider} from './corpusProvider';
import {
  NO_DECLARATIONS, composeSuite, declaredTimeOfFacets, inputOfReading, standingOf, unavailableInput, type DeclaredPlace, type DeclaredTime,
  type OpenTechneReading, type SuiteComposition, type SuiteDeclarations, type SuiteInput, type SuiteSources,
} from './suiteReading';
import {
  SUITE_INPUTS, SUITE_PROVIDER_ID, SUITE_PROVIDER_NAME, describeStanding, publishSuiteStanding, suiteStanding, type SuiteInputName, type SuiteStanding,
} from './suiteStanding';

export {SUITE_PROVIDER_ID, SUITE_PROVIDER_NAME};

/** The read surface the provider uses: the kernel's Graph op and Central's files client by default, a fake in the tests. */
export interface SuiteReaders {
  /** One owner input of the Graph op. Rejects with the transport's or the owner's own words. */
  graph(input: SuiteInputName): Promise<GraphReading>;
  /** What Central's wiki file declares. Never rejects: a file that cannot be read is an `unavailable` declaration, named. */
  declarations(): Promise<SuiteDeclarations>;
  /** The open Technē reading, when one is open. */
  openReading?: () => OpenTechneReading | null;
}

/** The bounds the shell's own graph surface reads with (desktop/cradle/src/knowledge/graphProgress.ts:38 progressiveGraph). */
const MAX_NODES = 4096;
const MAX_EDGES = 16384;

export const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The declarations Central's wiki file makes, read through the owners' own readers and handed over verbatim. */
export function declarationsFromWiki(content: string, basis: {path: string; revision: string; location: CentralLocation}): SuiteDeclarations {
  const wiki = parseWiki(content);
  if (wiki.state !== 'ready') return {state: 'unavailable', detail: 'the wiki file did not resolve to a reading', types: {}, places: [], times: {}};
  const types: Record<string, string> = {};
  for (const node of wiki.nodes) if (typeof node.type === 'string' && node.type) types[node.ref] = node.type;
  const reading: WikiRegisterReading = {
    state: 'ready', register: {key: 'central', title: 'Central'}, wiki, wikiBasis: basis,
    relations: {state: 'unavailable', focusRef: '', reason: 'the typed relations are not read here'},
  };
  // a wiki node's own `place` declaration, through the owner's producer (placeFacets.ts): the node is the place
  const places: DeclaredPlace[] = placeFacetsFromReading(reading).map(facet => ({subject_ref: facet.place_ref, facet, origin: 'node.place'}));
  const problems: string[] = [];
  // the native declarations: the subject a row declares a place for is the row's own ref
  const spatial = readWikiSpatial(content);
  if (spatial.state === 'available') {
    for (const source of spatial.sources) for (const facet of source.facets) places.push({subject_ref: source.ref, facet, origin: 'aikit.techne-facet/v1'});
  } else problems.push(`place declarations: ${spatial.reason}`);
  const times: Record<string, DeclaredTime> = {};
  const temporal = readWikiTemporal(content);
  if (temporal.state === 'available') {
    for (const source of temporal.sources) {
      const time = declaredTimeOfFacets(source.facets);
      if (time && !(source.ref in times)) times[source.ref] = time;
    }
  } else problems.push(`time declarations: ${temporal.reason}`);
  return problems.length
    ? {state: 'unavailable', detail: `${basis.path} was read, but its ${problems.join('; ')}`, types, places, times}
    : {state: 'available', detail: basis.path, types, places, times};
}

/** Central's wiki file, read through the files seam: the listing says where it is, and the read is made at the location the
 * listing returned. */
export async function readDeclarations(transport: KernelTransportStatus): Promise<SuiteDeclarations> {
  const path = wikiPathForProject(undefined);
  try {
    const directory = await listFiles(transport, path.replace(/\/[^/]+$/, ''));
    const entry = directory.entries.find(row => row.kind === 'file' && row.name === 'wiki.json');
    if (!entry) return {...NO_DECLARATIONS, state: 'absent', detail: `${path} is not in Central’s listing`};
    if (!entry.retrieval_allowed) return {...NO_DECLARATIONS, state: 'absent', detail: `Central withholds the retrieval of ${path}`};
    const file = await readFile(transport, entry.location);
    return declarationsFromWiki(file.content, {path, revision: file.revision, location: file.location});
  } catch (error) {
    return {state: 'unavailable', detail: messageOf(error), types: {}, places: [], times: {}};
  }
}

export function centralReaders(transport: KernelTransportStatus, openReading?: () => OpenTechneReading | null): SuiteReaders {
  return {
    graph: input => readGraph(transport, undefined, '', {input, max_nodes: MAX_NODES, max_edges: MAX_EDGES}),
    declarations: () => readDeclarations(transport),
    ...(openReading ? {openReading} : {}),
  };
}

export interface SuiteReadOptions {
  /** How long the load waits for AIKit's resolution once the ground and the hosted field are in (its own owner deadline is 20 s). */
  aikitWaitMs?: number;
  now?: () => Date;
  /** The timer, for the tests. */
  wait?: (ms: number) => Promise<void>;
  /** Where the standing is published; the shared store by default. */
  publish?: (standing: SuiteStanding) => void;
}

export interface SuiteReading {
  composition: SuiteComposition;
  sources: SuiteSources;
  standing: SuiteStanding;
}

export const AIKIT_WAIT_MS = 3000;

/** Read the owners and compose the Field. Reads the ground first, then Central's wiki file, then the hosted field, then AIKit's
 * resolution (the slow one, last, so it never holds the others); composes and publishes after each. An input that does not answer
 * is named with its owner's own detail; a reading that composes no subject at all rejects, naming every input. */
export async function readSuite(readers: SuiteReaders, options: SuiteReadOptions = {}): Promise<SuiteReading> {
  const publish = options.publish ?? publishSuiteStanding;
  const readAt = (options.now ?? (() => new Date()))();
  const inputs: Partial<Record<SuiteInputName, SuiteInput>> = {};
  let declarations: SuiteDeclarations | undefined;
  const pending = new Set<SuiteInputName>(SUITE_INPUTS);
  const sourcesNow = (): SuiteSources => ({inputs: {...inputs}, ...(declarations ? {declarations} : {}), techne: readers.openReading?.() ?? null, readAt});
  let closed = false;
  let last: SuiteStanding | null = null;

  const tell = (final = false): SuiteReading => {
    const sources = sourcesNow();
    const composition = composeSuite(sources);
    const phase: SuiteStanding['phase'] = !final ? 'reading' : composition.field.occurrences.length === 0 ? 'unavailable' : 'ready';
    const standing = standingOf(phase, sources, composition, [...pending]);
    last = standing;
    publish(standing);
    return {composition, sources, standing};
  };
  /** An input that settles after the Earth has stood: its state and detail are published, and the composition is left as it was. */
  const tellLate = (name: SuiteInputName): void => {
    if (!last) return;
    const input = inputs[name]!;
    const rows = input.reading?.nodes?.length ?? 0;
    const detail = input.state === 'available' ? `${rows} ${rows === 1 ? 'row' : 'rows'} answered after the Earth stood; they join the next reading` : input.detail;
    last = {...last, inputs: {...last.inputs, [name]: {...last.inputs[name], state: input.state, owner_operation: input.owner_operation, detail, rows}}};
    publish(last);
  };

  const take = async (name: SuiteInputName): Promise<void> => {
    try {
      inputs[name] = inputOfReading(name, await readers.graph(name));
    } catch (error) {
      inputs[name] = unavailableInput(name, messageOf(error));
    }
    pending.delete(name);
    if (closed) tellLate(name); else tell();
  };

  tell();
  await take('central_wiki');
  declarations = await readers.declarations();
  tell();
  await take('shared_field');
  const aikit = take('aikit_resolution');
  const grace = options.aikitWaitMs ?? AIKIT_WAIT_MS;
  let cancelGrace = (): void => {};
  const elapsed = options.wait
    ? options.wait(grace)
    : new Promise<void>(resolve => {
        const timer = setTimeout(resolve, grace);
        cancelGrace = () => clearTimeout(timer);
      });
  await Promise.race([aikit, elapsed]);
  cancelGrace();
  closed = true;

  const reading = tell(true);
  if (reading.standing.phase === 'unavailable') throw new Error(`The atlas data is unavailable. ${describeStanding(reading.standing) || 'No owner returned a subject.'}`);
  return reading;
}

// One read at a time per transport: the atlas's mount and the Places browser asking together share it.
const inFlight = new Map<string, Promise<SuiteReading>>();
const transportKey = (transport: KernelTransportStatus): string => (transport.kind === 'bridge' ? `bridge:${transport.url}` : transport.kind === 'tauri' ? 'tauri' : `unavailable:${transport.reason}`);

function readShared(transport: KernelTransportStatus, read: () => Promise<SuiteReading>): Promise<SuiteReading> {
  const key = transportKey(transport);
  const standing = inFlight.get(key);
  if (standing) return standing;
  const started = read().finally(() => {
    if (inFlight.get(key) === started) inFlight.delete(key);
  });
  inFlight.set(key, started);
  return started;
}

export interface SuiteProviderOptions {
  readers?: SuiteReaders;
  read?: SuiteReadOptions;
  /** The open Technē reading, when one is open (its place facets are admitted verbatim). */
  openReading?: () => OpenTechneReading | null;
}

/** The suite as one corpus provider: id `suite`, "Your world". Each `load()` reads the owners afresh (sharing a read already in
 * flight) and composes a new Field, so the atlas never holds a field another mount mutated. */
export function suiteProvider(transport: KernelTransportStatus, options: SuiteProviderOptions = {}): CorpusProvider {
  const readers = options.readers ?? centralReaders(transport, options.openReading);
  return {
    id: SUITE_PROVIDER_ID,
    name: SUITE_PROVIDER_NAME,
    async load(): Promise<CorpusBundle> {
      const {sources} = await readShared(transport, () => readSuite(readers, options.read));
      // The field is composed from the owners' readings for each caller (the composition is pure and cheap), so two loads that
      // shared one read never share one Field, which the atlas's seam changes in place.
      // images: the owners publish no plate for a subject, so the bundle's image store is empty and no occurrence carries one.
      return {id: SUITE_PROVIDER_ID, name: SUITE_PROVIDER_NAME, field: composeSuite(sources).field, images: {}};
    },
  };
}

/** Make sure the suite has been read this session: the Places browser asks this before the Earth is ever opened. Resolves to the
 * latest standing, whose Places are the project spaces and the places owners declare; a failed read is a standing, not a throw. */
export async function ensureSuiteStanding(transport: KernelTransportStatus, options: SuiteProviderOptions = {}): Promise<SuiteStanding> {
  if (suiteStanding().phase === 'idle') {
    try {
      await suiteProvider(transport, options).load();
    } catch {
      /* the failure is the published standing */
    }
  }
  return suiteStanding();
}
