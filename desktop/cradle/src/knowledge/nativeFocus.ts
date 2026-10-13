import type {GraphNode, GraphReading} from './graph';
import {isUnresolvedGraphNode} from './graphNavigation';
// @ts-ignore -- shared language-neutral admission, executed directly by the layout codec.
import {validateNativeKnowledgeContext as validate} from './nativeContext.mjs';

export type NativeKnowledgeJson = null | boolean | number | string | NativeKnowledgeJson[] | {[key: string]: NativeKnowledgeJson};
export interface NativeCanvasReturn {
  bindingId: string;
  expression_ref: string;
  scene_ref: string;
  mode: 'expressions' | 'techne';
  selection: string[];
  step_id: string | null;
  /** Only when captured from the actual Canvas owner. A retained host can
   * preserve this camera without serialising or remapping it. */
  camera?: {[key: string]: NativeKnowledgeJson};
}
export interface NativeKnowledgeContext {
  subject_ref?: string;
  native_owner?: string;
  register?: string;
  origin?: 'canvas';
  source_basis?: {expression_ref: string; revision: number; scene_ref: string; entity_ref?: string | null};
  returnTo?: NativeCanvasReturn;
}
export const validateNativeKnowledgeContext = (raw: unknown): NativeKnowledgeContext | null => validate(raw);
export type NativeGraphFocus = {state: 'found'; node: GraphNode} | {state: 'missing' | 'ambiguous'; detail: string};
/** Owner identity is opaque. A source link, label, unresolved marker or node
 * from another owner can never substitute for the requested native subject. */
export function resolveNativeGraphFocus(reading: Pick<GraphReading, 'nodes'>, context: NativeKnowledgeContext): NativeGraphFocus {
  if (!context.subject_ref || !context.native_owner) return {state: 'missing', detail: 'No exact native subject and owner were supplied.'};
  const matches = reading.nodes.filter(node => !isUnresolvedGraphNode(node) && node.native_owner === context.native_owner && (node.ref === context.subject_ref || node.subject_ref === context.subject_ref));
  if (matches.length === 1) return {state: 'found', node: matches[0]};
  if (matches.length) return {state: 'ambiguous', detail: 'The bounded native Graph reading discloses more than one matching subject. Choose its native occurrence explicitly.'};
  // The same ref under another owner is a named refusal: no owner is mapped.
  const otherOwner = reading.nodes.find(node => !isUnresolvedGraphNode(node) && (node.ref === context.subject_ref || node.subject_ref === context.subject_ref));
  if (otherOwner) return {state: 'missing', detail: `The Graph discloses this subject under owner "${otherOwner.native_owner}", not "${context.native_owner}". No owner is mapped, so it is not shown.`};
  return {state: 'missing', detail: 'This subject is not in this graph: the bounded Graph reading does not disclose it.'};
}

/** A summon-carried canvas subject, admitted before any graph focus is asked
 * for. Only a bounded reference and its exact native owner survive; the owner
 * is never inferred from the canvas's own expression owner. */
export type GraphSummon = {ok: true; subject_ref: string; native_owner: string; project?: string} | {ok: false; reason: string};
const boundedRef = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096 && !/[\u0000-\u001f]/.test(value);
export function graphSummonSubject(carried: unknown): GraphSummon {
  if (!carried || typeof carried !== 'object' || Array.isArray(carried)) return {ok: false, reason: 'The canvas sent no native subject to show in the graph.'};
  const {ref, nativeOwner, project} = carried as Record<string, unknown>;
  if (!boundedRef(ref)) return {ok: false, reason: 'The canvas subject has no subject reference, so the graph cannot be asked for it.'};
  if (!boundedRef(nativeOwner)) return {ok: false, reason: 'The canvas subject has no native owner, so the graph cannot be asked for it.'};
  return {ok: true, subject_ref: ref, native_owner: nativeOwner, ...(boundedRef(project) ? {project} : {})};
}
/** The knowledge focus context for an admitted graph summon. */
export function graphHopContext(summon: {subject_ref: string; native_owner: string}): NativeKnowledgeContext | null {
  return validate({subject_ref: summon.subject_ref, native_owner: summon.native_owner});
}
