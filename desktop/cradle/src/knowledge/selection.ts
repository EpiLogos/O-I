import type {KnowledgeAddress, KnowledgeReading, KernelTransportStatus} from '../kernel/types';
import {knowledge} from './client';
import {sourceSlice, wikiDocument, type WikiAnchor} from './wikiDocument';

/** Pending author input, not a new source or semantic object. The enclosing
 * native UTF-8 span and the rendered quotation are deliberately separate. */
export interface WikiPassage {
  schema: 'oi.wiki-passage/v1';
  address: KnowledgeAddress;
  source_ref: string;
  source_revision: string;
  selector: {start_byte: number; end_byte: number};
  source_text: string;
  text: string;
  title: string;
  provider: string;
}
export const PASSAGE_BYTES = 64 * 1024;
export const PASSAGE_COUNT = 64;

export function selectedPassage(reading: KnowledgeReading, anchor: WikiAnchor, text: string, title: string): WikiPassage {
  const document = wikiDocument(reading);
  if (!document || !reading.revision || reading.revision !== anchor.revision) throw new Error('Read the current source revision before selecting a passage.');
  const {start_byte: start, end_byte: end} = anchor;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start! < 0 || end! <= start! || end! - start! > PASSAGE_BYTES) throw new Error('Choose a non-empty passage of at most 64 KiB.');
  const raw = sourceSlice(reading.content ?? '', start!, end!);
  if (!raw.trim() || !text.trim() || text.length > 12000) throw new Error('The selected passage is empty or too large.');
  return {schema: 'oi.wiki-passage/v1', address: {kind: 'source', value: reading.resource}, source_ref: reading.resource,
    source_revision: reading.revision, selector: {start_byte: start!, end_byte: end!}, source_text: raw,
    text: text.trim(), title: title.slice(0, 512), provider: reading.provider};
}

export function passageKey(passage: WikiPassage): string {
  return JSON.stringify([passage.source_ref, passage.source_revision, passage.selector.start_byte, passage.selector.end_byte]);
}
export function appendPassage(passages: WikiPassage[], passage: WikiPassage): WikiPassage[] {
  if (passages.some(item => passageKey(item) === passageKey(passage))) return passages;
  if (passages.length >= PASSAGE_COUNT) throw new Error('This pending selection holds 64 passages. Save it before gathering more.');
  return [...passages, passage];
}

/** A restored or supplied draft is untrusted input until the native source is
 * freshly read. A version change is never silently rebased onto similar prose. */
export async function revalidatePassage(transport: KernelTransportStatus, project: string | undefined, passage: WikiPassage, signal?: AbortSignal): Promise<KnowledgeReading> {
  if (passage.schema !== 'oi.wiki-passage/v1' || passage.address.kind !== 'source' || passage.address.value !== passage.source_ref) throw new Error('The selected passage has inconsistent source identity.');
  const reading = await knowledge<KnowledgeReading>(transport, project, {action: 'read', address: passage.address}, {fresh: true, signal});
  if (reading.resource !== passage.source_ref || reading.revision !== passage.source_revision) throw new Error(`Source changed: ${passage.title}. Reselect the passage; the draft has been retained.`);
  const checked = selectedPassage(reading, {revision: passage.source_revision, ...passage.selector}, passage.text, passage.title);
  if (checked.source_text !== passage.source_text) throw new Error(`The recorded bytes changed: ${passage.title}. Reselect the passage.`);
  return reading;
}

/** Reuse the native extensible selector. text_span means characters, not bytes. */
export function passageProvenance(passage: WikiPassage): Record<string, unknown> {
  return {source_ref: passage.source_ref, source_revision: passage.source_revision,
    'aikit.techne-facet/v1': {contract: 'aikit.techne-facet/v1', selector: {unit: 'other', kind: 'markdown-utf8-span',
      value: JSON.stringify({...passage.selector, quote: passage.text})}}};
}
