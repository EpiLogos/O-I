/** Pure image/ASCII state-source models for the Glyph sequence editor. Ranges mirror the Studio's
 * step.source controls (field-studies-journeys/src/imageSuite.ts) and sit inside the owner validator
 * (field-studies-journeys/src/model.ts validateSource). Every option commit is ONE step-source change. */
import type {Entity, NativeGlyphChange, SequenceStep} from '../../../../expressions-boundary/src/editor';
import {CHAKRA_DEFINITIONS} from '../../../../../desktop/cradle/expressions-app/src/engine/semantics/chakraSemantics.ts';

type Source = NonNullable<Entity['source']>;
export type GlyphSourceKind = 'none' | 'image' | 'ascii';
export type ImageSource = Extract<Source, {kind: 'image'}>['image'];
export type AsciiSource = Extract<Source, {kind: 'ascii'}>['ascii'];
export type SourceBuild = {ok: true; change: NativeGlyphChange} | {ok: false; message: string};
export type SourceCheck = {ok: true; value: number} | {ok: false; message: string};

/** Equals NATIVE_OPEN_STUDIO in src/native/openStudio.ts (drift-tested). */
export const GLYPH_OPEN_STUDIO_EVENT = 'oi:native-open-studio';
/** Equals DEFAULT_SOURCE_THRESHOLD in desktop/cradle/expressions-app/src/engine/sourceSampling.ts (drift-tested). */
export const DEFAULT_IMAGE_THRESHOLD = 0.24;
/** The app's ASCII source-kind default (app.ts source-kind handler). */
export const ASCII_DEFAULT = {text: 'O  :  I', fontFamily: 'monospace', fontSize: 32} as const;
/** Image read modes, labels as imageSuite.ts writes them. */
export const IMAGE_MODES = [['luminance', 'Ink luminance'], ['silhouette', 'Silhouette cutout'], ['edgeSobel', 'Sobel edges']] as const;
/** Inclusive ranges and steps from imageSuite.ts range() calls (drift-tested). */
export const SOURCE_RANGES = {
  threshold: {label: 'Ink threshold', min: 0, max: 1, step: 0.01},
  scale: {label: 'Source scale', min: 0.1, max: 3, step: 0.05},
  fontSize: {label: 'Font size ceiling', min: 8, max: 256, step: 1},
} as const;
export type SourceRangeKey = keyof typeof SOURCE_RANGES;
export const ASCII_TEXT_MAX = 50000;
export const ASCII_FONT_MAX = 200;
export const ASCII_FONT_LABEL = 'Monospace font';

const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const inRange = (key: SourceRangeKey, value: number) => Number.isFinite(value) && value >= SOURCE_RANGES[key].min && value <= SOURCE_RANGES[key].max;

export function sourceKindOf(source: Entity['source'] | undefined): GlyphSourceKind {
  return source?.kind ?? 'none';
}
/** The source a state takes when its build-from kind is chosen. An image starts without a file: the Studio supplies it. */
export function sourceDefault(kind: GlyphSourceKind): Source | undefined {
  if (kind === 'image') return {kind: 'image', image: {mode: 'luminance', threshold: DEFAULT_IMAGE_THRESHOLD, invert: false, scale: 1}};
  if (kind === 'ascii') return {kind: 'ascii', ascii: {...ASCII_DEFAULT}};
  return undefined;
}
/** Exact decimal text inside the inclusive range. The refusal names the bounds. */
export function checkSourceNumber(key: SourceRangeKey, text: string): SourceCheck {
  const range = SOURCE_RANGES[key], trimmed = text.trim(), value = Number(trimmed);
  if (!DECIMAL.test(trimmed) || !inRange(key, value)) return {ok: false, message: `${range.label} must be ${range.min} to ${range.max}`};
  return {ok: true, value};
}
export function checkAsciiFont(text: string): {ok: true; value: string} | {ok: false; message: string} {
  const trimmed = text.trim();
  return trimmed && trimmed.length <= ASCII_FONT_MAX ? {ok: true, value: trimmed} : {ok: false, message: `${ASCII_FONT_LABEL} needs 1 to ${ASCII_FONT_MAX} characters`};
}
export function checkAsciiText(text: string): {ok: true; value: string} | {ok: false; message: string} {
  return text.length <= ASCII_TEXT_MAX ? {ok: true, value: text} : {ok: false, message: `ASCII drawing holds at most ${ASCII_TEXT_MAX} characters`};
}
const stepSource = (entity: Entity, step: SequenceStep, source: Source | undefined): NativeGlyphChange =>
  ({kind: 'step-source', entity_id: entity.id, step_id: step.id, shape: step.shape, source});

/** Build-from change: the whole source of the state is replaced by the kind's default. */
export function sourceKindBuild(entity: Entity, step: SequenceStep, kind: GlyphSourceKind): SourceBuild {
  return {ok: true, change: stepSource(entity, step, sourceDefault(kind))};
}
/** One image option on a loaded image source. Refused without a dataUrl: the file is chosen in the Studio. */
export function imageOptionBuild(entity: Entity, step: SequenceStep, patch: Partial<Pick<ImageSource, 'mode' | 'threshold' | 'scale' | 'invert'>>): SourceBuild {
  if (step.source?.kind !== 'image') return {ok: false, message: 'This state is not an image source'};
  const image = step.source.image;
  if (!image.dataUrl) return {ok: false, message: 'Choose an image file in the Studio before editing its options'};
  if (patch.mode !== undefined && !IMAGE_MODES.some(([id]) => id === patch.mode)) return {ok: false, message: 'Choose a known read mode'};
  if (patch.threshold !== undefined && !inRange('threshold', patch.threshold)) return {ok: false, message: `${SOURCE_RANGES.threshold.label} must be ${SOURCE_RANGES.threshold.min} to ${SOURCE_RANGES.threshold.max}`};
  if (patch.scale !== undefined && !inRange('scale', patch.scale)) return {ok: false, message: `${SOURCE_RANGES.scale.label} must be ${SOURCE_RANGES.scale.min} to ${SOURCE_RANGES.scale.max}`};
  if (patch.invert !== undefined && typeof patch.invert !== 'boolean') return {ok: false, message: 'Force dark ink is on or off'};
  return {ok: true, change: stepSource(entity, step, {kind: 'image', image: {...image, ...patch}})};
}
/** One ASCII option on an ASCII source. The drawing text itself is written by the editor's retained draft field. */
export function asciiOptionBuild(entity: Entity, step: SequenceStep, patch: Partial<Pick<AsciiSource, 'text' | 'fontFamily' | 'fontSize' | 'invert'>>): SourceBuild {
  if (step.source?.kind !== 'ascii') return {ok: false, message: 'This state is not an ASCII source'};
  const next = {...patch};
  if (patch.text !== undefined) {const text = checkAsciiText(patch.text); if (!text.ok) return {ok: false, message: text.message};}
  if (patch.fontFamily !== undefined) {const font = checkAsciiFont(patch.fontFamily); if (!font.ok) return {ok: false, message: font.message}; next.fontFamily = font.value;}
  if (patch.fontSize !== undefined && !inRange('fontSize', patch.fontSize)) return {ok: false, message: `${SOURCE_RANGES.fontSize.label} must be ${SOURCE_RANGES.fontSize.min} to ${SOURCE_RANGES.fontSize.max}`};
  if (patch.invert !== undefined && typeof patch.invert !== 'boolean') return {ok: false, message: 'Sample negative space is on or off'};
  return {ok: true, change: stepSource(entity, step, {kind: 'ascii', ascii: {...step.source.ascii, ...next}})};
}

/** The yantras a yantra state chooses from, as the app's inspector lists them: CANONICAL_CHAKRAS (expressions-app/src/engine/chakraSystem.ts),
 * the chakra definitions Crown to Root (drift-tested), each [id, name]. A state with none recorded stands on the app's Anahata. */
export const YANTRAS: readonly (readonly [string, string])[] = [...CHAKRA_DEFINITIONS].reverse().map(chakra => [chakra.id, chakra.name] as const);
export const YANTRA_DEFAULT = 'anahata';
/** An authored cymatic template's frequency, as the app's inspector offers it (inspector.ts shapeFields: 1 to 100000, step 1, default 396). */
export const TEMPLATE_FREQUENCY = {label: 'Authored template frequency · Hz', min: 1, max: 100000, step: 1, def: 396} as const;

/** Exact decimal text inside the template frequency's range. The refusal names the bounds. */
export function checkTemplateFrequency(text: string): SourceCheck {
  const trimmed = text.trim(), value = Number(trimmed);
  if (!DECIMAL.test(trimmed) || !Number.isFinite(value) || value < TEMPLATE_FREQUENCY.min || value > TEMPLATE_FREQUENCY.max)
    return {ok: false, message: `${TEMPLATE_FREQUENCY.label} must be ${TEMPLATE_FREQUENCY.min} to ${TEMPLATE_FREQUENCY.max}`};
  return {ok: true, value};
}
/** The yantra a yantra state shows: one step-source, keeping the state's glyph and source. Refused on another shape. */
export function yantraBuild(entity: Entity, step: SequenceStep, yantraId: string): SourceBuild {
  if (step.shape !== 'yantra') return {ok: false, message: 'Only a yantra state names a yantra'};
  if (!YANTRAS.some(([id]) => id === yantraId)) return {ok: false, message: 'Choose one of the seven canonical yantras'};
  return {ok: true, change: {kind: 'step-source', entity_id: entity.id, step_id: step.id, shape: 'yantra', text: step.text, source: step.source, yantraId}};
}
/** The frequency an authored cymatic template state is sampled at: one step-source, keeping the state's glyph and source. */
export function templateFrequencyBuild(entity: Entity, step: SequenceStep, templateFrequency: number): SourceBuild {
  if (step.shape !== 'cymatic') return {ok: false, message: 'Only an authored cymatic template has a template frequency'};
  if (!Number.isFinite(templateFrequency) || templateFrequency < TEMPLATE_FREQUENCY.min || templateFrequency > TEMPLATE_FREQUENCY.max)
    return {ok: false, message: `${TEMPLATE_FREQUENCY.label} must be ${TEMPLATE_FREQUENCY.min} to ${TEMPLATE_FREQUENCY.max}`};
  return {ok: true, change: {kind: 'step-source', entity_id: entity.id, step_id: step.id, shape: 'cymatic', text: step.text, source: step.source, templateFrequency}};
}

/** One layer moved one place up (delta -1) or down (+1) in the state's spatial order. The whole new order is one step-layers change, because the
 * boundary replaces the list rather than moving an entry. Null when the layer is absent or already at that edge: nothing is sent. */
export function reorderLayers<T extends {id: string}>(layers: readonly T[], id: string, delta: -1 | 1): T[] | null {
  const from = layers.findIndex(layer => layer.id === id), to = from + delta
  if (from < 0 || to < 0 || to >= layers.length) return null
  const next = layers.slice(); [next[from], next[to]] = [next[to], next[from]]
  return next
}
