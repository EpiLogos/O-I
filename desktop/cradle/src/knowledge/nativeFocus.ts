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
  return matches.length ? {state: 'ambiguous', detail: 'The bounded native Graph reading discloses more than one matching subject. Choose its native occurrence explicitly.'} : {state: 'missing', detail: 'The requested native subject is absent from this bounded Graph reading.'};
}
