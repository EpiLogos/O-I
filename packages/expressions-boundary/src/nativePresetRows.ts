/** The built-in presets whose objects the browser's Objects category adds to the open Scene (O-I #747 round 894, add-built-in and
 * chakra-add): their ids, names and what each adds. Names only; the objects themselves are generated material that nativePresets.ts builds
 * in the frame's editor, so the shell loads none of them. Pure. */
export type FormationPreset = 'field-studies' | 'small-language' | 'seven-centres' | 'chakra-body';
export interface FormationPresetRow {readonly preset: FormationPreset; readonly name: string; readonly summary: string}
export const FORMATION_PRESET_ROWS: readonly FormationPresetRow[] = Object.freeze([
  {preset: 'field-studies', name: 'Field studies', summary: 'The objects of its first scene'},
  {preset: 'small-language', name: 'A small language', summary: 'The objects of its first scene'},
  {preset: 'seven-centres', name: 'Seven centres', summary: 'The seven centres of its first scene, without their meanings'},
  {preset: 'chakra-body', name: 'Semantic Chakra Body', summary: 'Seven yantra centres with their meanings. A starter diagram, not a live reading of a person'},
]);
