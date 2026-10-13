// The founding corpus provider — Archetypal-Earth's published bundle, read through Central's file owner
// [DEVICE-SEMANTICS-LOCK §8.4; C2 §1.2; T-ATLAS-PROVIDER].
//
// Named source: Archetypal-Earth's published bundle at `Work/Archetypal-Earth/public/data/` (AE @ 5fe5117). The provider
// reads it only through the files client: the bundle root and `corpus/` are listed once, and each file is read at the
// location its own listing returned. The found loaders (loadField, loadHistory, loadSymbols) keep their own validation:
// each takes a URL, so the bytes read through Central are handed to them as a blob: URL and their checks run unchanged.
// Images are out of scope (T-ATLAS-IMAGES): ImageRefs ride the field inline and pass through unresolved.

import {listFiles, readFile} from '../../../../../../../desktop/cradle/src/files/client';
import type {CentralLocation, KernelTransportStatus, NativeDirectory, NativeFileReading} from '../../../../../../../desktop/cradle/src/kernel/types';
import {loadField} from '../src/data/load';
import {loadHistory} from '../src/aion/model';
import {loadSymbols} from '../src/data/symbols';
import {setPublishedSource, type PublishedSource} from '../src/data/published';
import type {Cite, Field, FieldMeta, Occurrence, TieBasisDecl} from '../src/types/field';
import type {History} from '../src/types/history';
import type {CorpusIndex} from '../src/types/corpus';
import type {Symbols} from '../src/types/symbols';
import type {CorpusBundle, CorpusProvider} from './corpusProvider';

export const ARCHETYPAL_EARTH_PROVIDER_ID = 'archetypal-earth';
/** The provider's display name: the only place the corpus is named (C2 §1.2, C2-b8). */
const ARCHETYPAL_EARTH_NAME = 'Jung archetypal field';
/** The published bundle, as a Central-root-relative folder. */
export const ARCHETYPAL_EARTH_DATA = 'Work/Archetypal-Earth/public/data';
/** The founding triple, strongest first, labelled the way the provider words it (C2-b2). */
const FOUNDING_TIE_BASES: TieBasisDecl[] = [
  {id: 'jung', label: 'Jung'},
  {id: 'inferred', label: 'Inferred'},
  {id: 'site', label: 'Read here'},
];
/** A published name is a file (`redbook`) or one folder down (`corpus/cw01`) — never a path that climbs out of the bundle. */
const PUBLISHED_NAME = /^[\w-]+(\/[\w-]+)?$/;

/** The read surface the provider uses: Central's files client by default, a fake in tests. */
export interface BundleReader {
  list(path: string): Promise<NativeDirectory>;
  read(location: CentralLocation): Promise<NativeFileReading>;
}

export function centralReader(transport: KernelTransportStatus): BundleReader {
  return {list: path => listFiles(transport, path), read: location => readFile(transport, location)};
}

/** AE's field.json predates the C2 contract. Its vault descriptor becomes the provider descriptor, its tie bases are the
 * founding triple, each occurrence's `jung` cites are renamed `cites` (C2-b7) and the vault's `subject` word is dropped
 * (C2 §1.3). Everything else is carried verbatim. */
export function adaptFoundingField(raw: unknown): Field {
  const {meta, occurrences, ...rest} = raw as Omit<Field, 'meta' | 'occurrences'> & {
    meta: Omit<FieldMeta, 'provider' | 'freshness' | 'ties'> & {vaultPath?: string; vaultLedgerLine?: string};
    occurrences: (Omit<Occurrence, 'cites'> & {jung?: Cite[]; subject?: unknown})[];
  };
  const {vaultPath, vaultLedgerLine, ...verbatimMeta} = meta;
  return {
    ...rest,
    meta: {
      ...verbatimMeta,
      provider: {id: ARCHETYPAL_EARTH_PROVIDER_ID, name: ARCHETYPAL_EARTH_NAME, home: vaultPath},
      freshness: vaultLedgerLine,
      ties: {bases: FOUNDING_TIE_BASES},
    },
    occurrences: occurrences.map(({jung, subject: _subject, ...occurrence}) => ({...occurrence, cites: jung ?? []})),
  } as Field;
}

/** The corpus index names its provider by data, not by a vault path (C2-a3). */
export function adaptFoundingCorpusIndex(raw: unknown): CorpusIndex {
  const {vaultPath, ...index} = raw as Omit<CorpusIndex, 'provider'> & {vaultPath?: string};
  if (!Array.isArray(index.works)) throw new Error('The corpus index lists no works.');
  return {...index, provider: {id: ARCHETYPAL_EARTH_PROVIDER_ID, name: ARCHETYPAL_EARTH_NAME, home: vaultPath}};
}

/** The found loaders take a URL and own their validation. The bytes read through Central are handed to them as a blob: URL,
 * so their own checks run unchanged; the URL is released once the loader has read it. */
async function throughLoader<T>(text: string, load: (url: string) => Promise<T>): Promise<T> {
  const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
  try {
    return await load(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** An optional part of the bundle: absence is silent (the found law), a part that is present but invalid is named and dropped. */
async function optional<T>(read: () => Promise<T | undefined>): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    console.warn(error);
    return undefined;
  }
}

export function archetypalEarthProvider(
  transport: KernelTransportStatus,
  root: string = ARCHETYPAL_EARTH_DATA,
  reader: BundleReader = centralReader(transport),
): CorpusProvider {
  // Each folder is listed once; a failed listing is forgotten so a later read may try it again.
  const listings = new Map<string, Promise<NativeDirectory>>();
  const listing = (folder: string): Promise<NativeDirectory> => {
    let pending = listings.get(folder);
    if (!pending) {
      pending = reader.list(folder);
      listings.set(folder, pending);
      pending.catch(() => listings.delete(folder));
    }
    return pending;
  };
  /** The text of a published file, read at the location its folder's listing returned; null when the bundle does not carry it,
   * Central withholds its retrieval, or its folder cannot be listed (a folder that is not there holds nothing published). */
  async function publishedText(name: string): Promise<string | null> {
    if (!PUBLISHED_NAME.test(name)) return null;
    const slash = name.lastIndexOf('/');
    const folder = slash < 0 ? root : `${root}/${name.slice(0, slash)}`;
    const file = `${name.slice(slash + 1)}.json`;
    const rows = await listing(folder).then(directory => directory.entries, () => []);
    const entry = rows.find(row => row.kind === 'file' && row.retrieval_allowed && row.name === file);
    return entry ? (await reader.read(entry.location)).content : null;
  }
  const published: PublishedSource = async name => {
    try {
      const text = await publishedText(name);
      return text === null ? null : new Response(text, {status: 200, headers: {'content-type': 'application/json'}});
    } catch {
      return null;
    }
  };
  return {
    id: ARCHETYPAL_EARTH_PROVIDER_ID,
    name: ARCHETYPAL_EARTH_NAME,
    async load(): Promise<CorpusBundle> {
      // The field is the one required part: a bundle without it is unavailable, never invented (the found law).
      let field: Field;
      try {
        const text = await publishedText('field');
        if (text === null) throw new Error('field.json is not in the bundle');
        field = adaptFoundingField((await throughLoader(text, loadField)).field);
      } catch (cause) {
        throw new Error('The atlas data is unavailable.', {cause});
      }
      // The history's loader reads Aion's book through the published door (aion/model.ts loadHistory → fetchPublished
      // 'aionbook'), so the door is this provider's before the history loads — else the book is silently absent at boot.
      // mount.ts binds the same source again from the bundle (idempotent).
      setPublishedSource(published);
      const [history, symbols, corpus] = await Promise.all([
        optional<History>(async () => {
          const text = await publishedText('history');
          return text === null ? undefined : throughLoader(text, loadHistory);
        }),
        optional<Symbols>(async () => {
          const text = await publishedText('symbols');
          return text === null ? undefined : throughLoader(text, loadSymbols);
        }),
        optional<CorpusIndex>(async () => {
          const text = await publishedText('corpus/index');
          return text === null ? undefined : adaptFoundingCorpusIndex(JSON.parse(text));
        }),
      ]);
      return {id: ARCHETYPAL_EARTH_PROVIDER_ID, name: ARCHETYPAL_EARTH_NAME, field, images: {}, history, symbols, corpus, published};
    },
  };
}
