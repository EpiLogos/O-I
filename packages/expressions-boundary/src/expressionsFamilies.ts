/** The one Expressions family declaration: the 22 inhabitant families this product admits through the neutral gate.
 * The validator in nativeDeviceWidgets.ts knows none of these ids; loadExpressionsFamilies() admits them once at product load. */
import {admitFamily, type FamilyAdmission} from './familyAdmission';

export type ExpressionsFamilyScope = 'field' | 'entity' | 'scene';

export interface ExpressionsFamilyDeclaration {
  readonly id: string;
  readonly scope: ExpressionsFamilyScope;
  readonly faced: boolean;
  readonly repeatable: boolean;
}

export const EXPRESSIONS_FAMILIES: readonly ExpressionsFamilyDeclaration[] = [
  {id: 'glyph', scope: 'field', faced: false, repeatable: false},
  {id: 'physics', scope: 'field', faced: true, repeatable: false},
  {id: 'pointer', scope: 'field', faced: true, repeatable: false},
  {id: 'relational', scope: 'field', faced: true, repeatable: false},
  {id: 'medium', scope: 'field', faced: true, repeatable: false},
  {id: 'contacts', scope: 'field', faced: true, repeatable: false},
  {id: 'morph', scope: 'field', faced: true, repeatable: false},
  {id: 'focus', scope: 'field', faced: true, repeatable: false},
  {id: 'colour', scope: 'field', faced: true, repeatable: false},
  {id: 'ink', scope: 'field', faced: true, repeatable: false},
  {id: 'depth', scope: 'field', faced: true, repeatable: false},
  {id: 'resonance', scope: 'field', faced: true, repeatable: false},
  {id: 'automation', scope: 'scene', faced: true, repeatable: false},
  {id: 'formation', scope: 'entity', faced: true, repeatable: true},
  {id: 'force', scope: 'entity', faced: true, repeatable: true},
  {id: 'scene', scope: 'scene', faced: true, repeatable: false},
  {id: 'sound', scope: 'entity', faced: true, repeatable: false},
  {id: 'meaning', scope: 'entity', faced: true, repeatable: false},
  {id: 'text', scope: 'scene', faced: true, repeatable: false},
  {id: 'body', scope: 'scene', faced: true, repeatable: false},
  {id: 'blueprint', scope: 'scene', faced: true, repeatable: false},
  {id: 'arrange', scope: 'scene', faced: true, repeatable: false},
];

/** Admits every Expressions family once. Repeating the call returns the same admissions. */
export function loadExpressionsFamilies(): readonly FamilyAdmission[] {
  return EXPRESSIONS_FAMILIES.map(family => admitFamily({id: family.id, repeatable: family.repeatable}));
}
