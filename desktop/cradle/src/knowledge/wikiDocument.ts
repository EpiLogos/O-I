import type {KnowledgeAddress, KnowledgeReading} from '../kernel/types';

/** The native parser/resolver is authoritative. These are its optional read
 * facets; source bytes and identity remain in KnowledgeReading. */
export interface MarkdownNode {
  kind: string; start_byte: number; end_byte: number; text?: string;
  attributes?: Record<string, unknown>; children?: MarkdownNode[];
}
export interface WikiEvidence {
  source_ref: string; source_revision?: string; raw_token?: string; fragment?: string;
  anchor?: {start_byte?: number; end_byte?: number};
  resolution?: {state?: string; candidates?: string[]; [key: string]: unknown};
}
export interface WikiOccurrence {
  start_byte: number; end_byte: number; reference?: string;
  target?: KnowledgeAddress; evidence?: WikiEvidence;
  state: 'resolved' | 'unresolved' | 'ambiguous' | 'external';
}
export interface WikiIncoming {
  reference?: string; from: string; label: string; relation: string;
  address: KnowledgeAddress; evidence: WikiEvidence;
}
export interface WikiSelector {kind: string; keys: string[]; id: string; start_byte: number; end_byte: number}
export interface WikiDocument {
  schema: 'aikit.markdown-reading/v1'; source_ref: string; source_revision?: string;
  syntax: {version: 'aikit.markdown-document/v1'; byte_length: number; blocks: MarkdownNode[]; tags: string[]; headings: MarkdownNode[]; properties: Record<string, unknown>; warnings: string[]};
  selectors: WikiSelector[]; occurrences: WikiOccurrence[]; incoming: WikiIncoming[];
  relations_truncated: boolean; relations_available: boolean;
}
export interface WikiAnchor {fragment?: string; revision?: string; start_byte?: number; end_byte?: number}
export type WikiNavigate = (address: KnowledgeAddress, title: string, anchor?: WikiAnchor) => void;
const address = (value: unknown): value is KnowledgeAddress => !!value && typeof value === 'object'
  && ['wiki','source','project-map'].includes((value as KnowledgeAddress).kind) && typeof (value as KnowledgeAddress).value === 'string';
const natural = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const span = (value: {start_byte?: unknown; end_byte?: unknown}, length: number) => natural(value.start_byte) && natural(value.end_byte) && value.start_byte <= value.end_byte && value.end_byte <= length;

/** Fail closed on identity/revision/span mismatch. A malformed read facet is
 * not permission to interpret arbitrary HTML or silently infer another graph. */
export function wikiDocument(reading: KnowledgeReading): WikiDocument | undefined {
  const raw = reading.document as WikiDocument | undefined;
  if (!raw) return undefined;
  if (raw.schema !== 'aikit.markdown-reading/v1' || raw.source_ref !== reading.resource || (raw.source_revision ?? undefined) !== (reading.revision ?? undefined)) throw new Error('The Wiki document does not match this source and revision. Refresh the reading.');
  const syntax = raw.syntax, length = new TextEncoder().encode(reading.content ?? '').length;
  if (!syntax || syntax.version !== 'aikit.markdown-document/v1' || syntax.byte_length !== length || !Array.isArray(syntax.blocks)) throw new Error('The native Markdown reading has an unsupported or mismatched syntax basis.');
  if(!Array.isArray(syntax.tags)||!syntax.tags.every(tag=>typeof tag==='string')||!Array.isArray(syntax.warnings)||!syntax.warnings.every(warning=>typeof warning==='string')||!syntax.properties||typeof syntax.properties!=='object'||Array.isArray(syntax.properties))throw new Error('The native Markdown metadata is malformed.');
  let count = 0;
  const validate = (nodes: MarkdownNode[], depth: number): boolean => depth <= 128 && nodes.every(node => {
    if (++count > 200_000 || !node || typeof node.kind !== 'string' || !span(node,length) || (node.text !== undefined && typeof node.text !== 'string')) return false;
    return node.children === undefined || (Array.isArray(node.children) && validate(node.children,depth+1));
  });
  if (!validate(syntax.blocks,0) || !Array.isArray(raw.occurrences) || !raw.occurrences.every(item => item && span(item,length) && ['resolved','unresolved','ambiguous','external'].includes(item.state) && (item.target == null || address(item.target)))) throw new Error('The native Markdown reading contains invalid source spans or targets.');
  if (!Array.isArray(raw.selectors) || !raw.selectors.every(item => item && span(item,length) && typeof item.id === 'string' && Array.isArray(item.keys) && item.keys.every(key => typeof key === 'string'))) throw new Error('The native Markdown selectors are malformed.');
  if (!Array.isArray(raw.incoming) || !raw.incoming.every(item => item && typeof item.from === 'string' && typeof item.label === 'string' && address(item.address) && item.evidence && item.evidence.source_ref === item.from)) throw new Error('The native backlink reading is malformed.');
  return raw;
}
export function nodeText(node: MarkdownNode): string {return (node.text ?? '') + (node.children ?? []).map(nodeText).join('');}
export function safeExternalLink(value: string): string | undefined {
  // Do not resolve relative paths, schemeless URLs or native commands here.
  try {const url = new URL(value); return ['https:','http:','mailto:'].includes(url.protocol) ? url.href : undefined;} catch {return undefined;}
}
export function sourceSlice(content: string, start: number, end: number): string {
  const bytes = new TextEncoder().encode(content);
  if (!span({start_byte:start,end_byte:end},bytes.length)) throw new Error('The source selection is outside the current document.');
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(start,end));
}
export function resolveWikiAnchor(document: WikiDocument, anchor: WikiAnchor): {id?: string; issue?: string} {
  if (anchor.revision && anchor.revision !== document.source_revision) return {issue:'The source changed since this passage was linked. The current document is open; select the passage again.'};
  if(anchor.fragment === '')return {};
  if (anchor.fragment !== undefined) {
    const candidates = document.selectors.filter(selector => selector.keys.includes(anchor.fragment!));
    return candidates.length === 1 ? {id:candidates[0].id} : {issue:candidates.length ? 'This heading is ambiguous in the current document.' : 'This heading or block is not present in the current document.'};
  }
  if (anchor.start_byte !== undefined) return natural(anchor.start_byte)&&anchor.start_byte<document.syntax.byte_length?{id:`wiki-span-${anchor.start_byte}`}:{issue:'The recorded source span is outside this document.'};
  return {};
}
export function occurrenceFor(document: WikiDocument,node: MarkdownNode): WikiOccurrence | undefined {
  return document.occurrences.find(item => item.start_byte === node.start_byte && item.end_byte === node.end_byte);
}
