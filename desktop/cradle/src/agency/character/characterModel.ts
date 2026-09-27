/**
 * Expressive character — the pure reading of a reusable character material
 * document (EXPRESSION-ACT-MATERIAL-V1 §1–§2). A character is an ordinary
 * `oi.expression/v1` document whose `reuse.kind` is `"character"`: one body
 * entity (role `self`) whose material (glyph/ASCII/image source, layers,
 * sequence, force, tint, sound…) differs per named state Scene, plus named
 * gestures and a `preview_state` for the Agent Card and creator.
 *
 * Nothing here reads or writes: it maps a document (or a `material_list`
 * row) to what the creator and card show. No imports, so it is testable in
 * plain Node and shared by the preview, the creator and the card.
 */

export interface CharacterReuse {
  schema?: string;
  kind: string;
  title?: string;
  entry_scene_ref?: string | null;
  states?: Record<string, string>;
  gestures?: Record<string, {scene_ref: string; role?: string}>;
  preview_state?: string | null;
  roles?: {role: string; accepts?: string; entity_ref?: string; text_id?: string}[];
}

/** The subset of an `oi.expression/v1` document a character preview reads. */
export interface CharacterDocument {
  schema: string;
  expression_ref?: string;
  title?: string;
  reuse?: CharacterReuse | null;
  scenes: {scene_ref: string; title?: string; presentation?: {schema?: string; scene?: {entities?: unknown[]}} | null}[];
}

/** One discoverable character (a `material_list {kind:"character"}` row). */
export interface CharacterListing {
  file_ref: string;
  revision: string;
  title: string;
  states: string[];
  gestures: string[];
  preview_state: string | null;
  /** The owner's location for the file (from `material_list`), when known. */
  location?: {schema: "central.path-ref/v1"; ref: string; root: string; path: string};
  expression_ref?: string;
}

export interface CharacterLayerPreview {id: string; text: string; ascii?: string; imageDataUrl?: string; scale: number; z: number}

/** What a preview draws: the `self` body in one state or gesture. */
export interface CharacterPreviewMaterial {
  title: string;
  /** The state or gesture shown, or null for the entry/first Scene. */
  showing: string | null;
  glyph: string;
  shape: string;
  tint: string | null;
  tintWeight: number;
  scale: number;
  ascii?: string;
  imageDataUrl?: string;
  layers: CharacterLayerPreview[];
  /** Authored sequence state names on the body (its morph repertoire). */
  steps: string[];
  force: string | null;
  forceStrength: number;
  forceSpin: number;
  sound: boolean;
  /** Degrees (the authoring Entity's unit). */
  rotation: number;
  yantraId?: string;
  templateFrequency?: number;
  /** The shown Scene's authored transition (seconds) — the switch duration. */
  transition: number;
  /** The body's entity sequence, as the live preview plays it. */
  sequence: CharacterSequence;
}

export interface CharacterSequenceStep {
  name?: string; text?: string; ascii?: string; imageDataUrl?: string;
  /** The step's form: "text" (glyph/source) or a primitive/yantra/cymatic shape. */
  shape?: string; yantraId?: string; templateFrequency?: number;
  hold?: number; transition?: number;
  tint?: string; tintWeight?: number; scale?: number; rotation?: number;
}
export interface CharacterSequence {
  enabled: boolean; hold: number; transition: number;
  easing?: "linear" | "smoothstep" | "kineticSnap" | "whip"; order?: "loop" | "pingpong" | "random";
  steps: CharacterSequenceStep[];
}

export type CharacterChoice = {state?: string | null; gesture?: string | null};

type Obj = Record<string, unknown>;
const obj = (value: unknown): value is Obj => !!value && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;
const num = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const names = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
  : obj(value) ? Object.keys(value) : [];

/** The reuse block when the document is a character; null otherwise. */
export function characterReuse(doc: unknown): CharacterReuse | null {
  if (!obj(doc) || doc.schema !== "oi.expression/v1" || !obj(doc.reuse)) return null;
  const reuse = doc.reuse as unknown as CharacterReuse;
  return reuse.kind === "character" ? reuse : null;
}

/** Accept a character document read from Central; refuse anything else by name. */
export function asCharacterDocument(value: unknown): CharacterDocument {
  if (!obj(value) || value.schema !== "oi.expression/v1" || !Array.isArray(value.scenes)) {
    throw new Error("The character material is not an oi.expression/v1 document.");
  }
  if (!characterReuse(value)) throw new Error("This material is not a reusable character (reuse.kind \"character\").");
  return value as unknown as CharacterDocument;
}

/** State and gesture names a character offers, from its reuse block. */
export function characterRepertoire(doc: CharacterDocument): {states: string[]; gestures: string[]; preview: string | null} {
  const reuse = characterReuse(doc);
  return {states: names(reuse?.states), gestures: names(reuse?.gestures), preview: reuse?.preview_state ?? null};
}

/** The Scene that shows a choice: the gesture's Scene, the state's Scene, the
 * preview state, the entry Scene, then the first Scene. */
export function characterSceneRef(doc: CharacterDocument, choice: CharacterChoice = {}): {scene_ref: string; showing: string | null; role: string} | null {
  const reuse = characterReuse(doc);
  if (!reuse) return null;
  if (choice.gesture && reuse.gestures?.[choice.gesture]) {
    const gesture = reuse.gestures[choice.gesture];
    return {scene_ref: gesture.scene_ref, showing: choice.gesture, role: gesture.role ?? "self"};
  }
  const state = choice.state && reuse.states?.[choice.state] ? choice.state
    : reuse.preview_state && reuse.states?.[reuse.preview_state] ? reuse.preview_state : null;
  if (state) return {scene_ref: reuse.states![state], showing: state, role: "self"};
  const entry = reuse.entry_scene_ref ?? doc.scenes[0]?.scene_ref;
  return entry ? {scene_ref: entry, showing: null, role: "self"} : null;
}

function sourceOf(value: unknown): {ascii?: string; imageDataUrl?: string} {
  if (!obj(value)) return {};
  if (value.kind === "ascii" && obj(value.ascii)) return {ascii: str(value.ascii.text)};
  if (value.kind === "image" && obj(value.image)) {
    const url = str(value.image.dataUrl);
    // Only embedded images are drawn; no ambient URL is ever fetched.
    return url && /^data:image\/(png|jpeg|webp);base64,/.test(url) ? {imageDataUrl: url} : {};
  }
  return {};
}

/** The body entity of a character Scene: the placeholder with the requested
 * role (default `self`), else the first formation. */
function bodyEntity(entities: unknown[], role: string): Obj | null {
  const all = entities.filter(obj);
  return all.find(entity => entity.role === role) ?? all.find(entity => entity.role === "self")
    ?? all.find(entity => entity.kind !== "pin") ?? null;
}

/** Map a character document and a state/gesture choice to what the preview
 * draws. Returns null when the Scene carries no body material. */
export function characterPreview(doc: CharacterDocument, choice: CharacterChoice = {}): CharacterPreviewMaterial | null {
  const target = characterSceneRef(doc, choice);
  if (!target) return null;
  const scene = doc.scenes.find(candidate => candidate.scene_ref === target.scene_ref);
  const entities = scene?.presentation?.scene?.entities;
  if (!Array.isArray(entities)) return null;
  const body = bodyEntity(entities, target.role);
  if (!body) return null;
  const tint = str(body.tint) ?? null;
  const layers = Array.isArray(body.layers) ? body.layers.filter(obj).map((layer, index) => ({
    id: str(layer.id) ?? `layer-${index}`, text: typeof layer.text === "string" ? layer.text : "",
    scale: num(layer.scale, 1), z: num(layer.z, 0), ...sourceOf(layer.source),
  })).sort((a, b) => a.z - b.z) : [];
  const sequence = obj(body.sequence) ? body.sequence : {};
  const rawSteps = Array.isArray(sequence.steps) ? sequence.steps.filter(obj) : [];
  const steps = rawSteps.map(step => str(step.name) ?? str(step.text) ?? "").filter(Boolean);
  const force = obj(body.force) && typeof body.force.kind === "string" && body.force.kind !== "none" ? body.force.kind : null;
  const easing = ["linear", "smoothstep", "kineticSnap", "whip"].includes(sequence.easing as string) ? sequence.easing as CharacterSequence["easing"] : undefined;
  const order = ["loop", "pingpong", "random"].includes(sequence.order as string) ? sequence.order as CharacterSequence["order"] : undefined;
  const playable: CharacterSequence = {
    enabled: sequence.enabled === true, hold: num(sequence.hold, 1), transition: num(sequence.transition, 1), easing, order,
    steps: rawSteps.map(step => {
      const state = obj(step.objectState) ? step.objectState : undefined;
      return {
        name: str(step.name), text: typeof step.text === "string" ? step.text : undefined,
        shape: str(step.shape), yantraId: str(step.yantraId), templateFrequency: typeof step.templateFrequency === "number" ? step.templateFrequency : undefined,
        hold: typeof step.hold === "number" ? step.hold : undefined, transition: typeof step.transition === "number" ? step.transition : undefined,
        ...sourceOf(step.source),
        ...(state ? {tint: str(state.tint), tintWeight: typeof state.tintWeight === "number" ? state.tintWeight : undefined,
          scale: typeof state.scale === "number" ? state.scale : undefined, rotation: typeof state.rotation === "number" ? state.rotation : undefined} : {}),
      };
    }),
  };
  const sceneMaterial = scene?.presentation?.scene as {transition?: unknown} | undefined;
  return {
    title: characterReuse(doc)?.title ?? doc.title ?? str(body.name) ?? "Character",
    showing: target.showing,
    glyph: typeof body.text === "string" ? body.text : "",
    shape: str(body.shape) ?? "text",
    tint, tintWeight: tint ? Math.min(1, Math.max(0, num(body.tintWeight, 1))) : 0,
    scale: Math.min(4, Math.max(.05, num(body.scale, 1))),
    ...sourceOf(body.source),
    layers, steps, force,
    forceStrength: obj(body.force) ? num(body.force.strength, 0) : 0,
    forceSpin: obj(body.force) ? num(body.force.spin, 0) : 0,
    sound: obj(body.sound) && body.sound.enabled === true,
    rotation: num(body.rotation, 0),
    yantraId: str(body.yantraId), templateFrequency: typeof body.templateFrequency === "number" ? body.templateFrequency : undefined,
    transition: Math.max(0, Math.min(30, num(sceneMaterial?.transition, 1))),
    sequence: playable,
  };
}
