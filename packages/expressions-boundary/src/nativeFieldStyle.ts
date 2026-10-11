/** Field material and ink mode. The option lists are the authored unions, not invented values:
 * Material (model.ts `export type Material`, validated at model.ts validateJourney), the three material cards with
 * their labels (inspector.ts material-cards row), and EngineSettings.inkMode (model.ts; written by app.ts 'native-paper-*'
 * and nativeFeatures.ts applyBackground). nativeBridge.ts reads inkMode into the native compile. A drift test pins each list
 * to its source text. */
import type {FieldMaterialChange, InkModeChange} from './editor.ts';

export const FIELD_MATERIALS = ['ink', 'print', 'round'] as const;
export const INK_MODES = ['blackOnWhite', 'whiteOnBlack'] as const;
/** Card order and labels of the Ink device's Material row (inspector.ts: Ink, Print, Rounded). */
export const FIELD_MATERIAL_CARDS = [
  {value: 'ink', label: 'Ink'},
  {value: 'print', label: 'Print'},
  {value: 'round', label: 'Rounded'},
] as const;

/** Admitted Field material: one exact value of the authored union, with no scope or entity operand. */
export function validateNativeFieldMaterialChange(change: unknown): FieldMaterialChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose an admitted Field material.');
  const row = change as Record<string, unknown>;
  if (Object.keys(row).some(key => !['kind', 'value'].includes(key))) throw Error('A Field material belongs only to its Scene field; foreign operands were retained.');
  if (row.kind !== 'field-material' || !(FIELD_MATERIALS as readonly unknown[]).includes(row.value)) throw Error('Choose an admitted Field material.');
  return change as FieldMaterialChange;
}

/** Admitted ink mode: one exact value of the authored EngineSettings.inkMode union. */
export function validateNativeInkModeChange(change: unknown): InkModeChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose an admitted ink mode.');
  const row = change as Record<string, unknown>;
  if (Object.keys(row).some(key => !['kind', 'value'].includes(key))) throw Error('An ink mode belongs only to its Scene engine; foreign operands were retained.');
  if (row.kind !== 'ink-mode' || !(INK_MODES as readonly unknown[]).includes(row.value)) throw Error('Choose an admitted ink mode.');
  return change as InkModeChange;
}
