import type {GraphNode} from './graph';

/** Named display preferences, never semantic tags, edges or QL classification.
 * Criteria use the same literal name/kind/tag matching as the graph controls;
 * no second native-query parser is introduced. First matching enabled group wins.
 */
export interface EmphasisGroup {
  id: string;
  label: string;
  color: string;
  text: string;
  kinds: string[];
  tags: string[];
  enabled: boolean;
}
export const MAX_EMPHASIS_GROUPS = 12;
const values = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 256))].slice(0,64) : [];
export function restoreEmphasisGroups(value: unknown): EmphasisGroup[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const groups: EmphasisGroup[] = [];
  for (const row of value) {
    if (!row || typeof row.id !== 'string' || !row.id.trim() || row.id.length > 128 || seen.has(row.id)) continue;
    if (typeof row.label !== 'string' || !row.label.trim() || typeof row.color !== 'string' || !/^#[\da-f]{6}$/i.test(row.color)) continue;
    seen.add(row.id);
    groups.push({id:row.id, label:row.label.trim().slice(0,80), color:row.color.toLowerCase(),
      text:typeof row.text==='string'?row.text.slice(0,1024):'', kinds:values(row.kinds), tags:values(row.tags), enabled:row.enabled!==false});
    if (groups.length === MAX_EMPHASIS_GROUPS) break;
  }
  return groups;
}
export function emphasizeGraph(nodes: readonly GraphNode[], groups: readonly EmphasisGroup[] = []): Map<string,{label:string;color:string}> {
  const rules = groups.filter(group=>group.enabled).map(group=>({...group, needle:group.text.trim().toLocaleLowerCase()}));
  const result = new Map<string,{label:string;color:string}>();
  for (const node of nodes) {
    const match = rules.find(group => (!group.kinds.length || group.kinds.includes(node.kind))
      && group.tags.every(tag=>node.tags?.includes(tag))
      && (!group.needle || [node.label,node.ref,...(node.aliases??[])].some(value=>value.toLocaleLowerCase().includes(group.needle))));
    if (match) result.set(node.ref,{label:match.label,color:match.color});
  }
  return result;
}
