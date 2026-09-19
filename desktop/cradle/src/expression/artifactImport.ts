/**
 * Generated-artifact → `oi.expression/v1` import (generic path; ES2/EX-line
 * product work — NO corpus-specific runtime code lives in O:I). Artifacts
 * arrive from an external authoring sandbox (Point-Cloud-Demo) as either an
 * `oi.journey` authoring document or an exported native state configuration.
 * They enter through the engine's OWN import path — `nativeSnapshotToJourney`
 * / `importDocuments` migration + validation, `nativeExport` for the canonical
 * native config — and are re-addressed onto stable `oi.expression/v1` refs:
 *
 *   - document entity refs are `<expression_ref>:entity:<artifact entity id>`
 *     — the artifact's persistent IDs survive as the ref suffix;
 *   - the stage projection rewrites the SAME ids into the native config, so
 *     the engine's scene/entity identity IS the document's identity (EX1:
 *     the adapter uses these stable refs as its native scene/entity IDs);
 *   - the document carries the bounded material vocabulary (glyph, x, y, z,
 *     scale, share); the artifact's full material stays in the config the
 *     stage presents — never copied into a second store;
 *   - every refusal is explicit (unrecognised artifact, capacity, bounds,
 *     identity characters) — nothing is silently truncated or renamed.
 */
import type {ExpressionDocument, Parameter} from "./types";
import {nativeSnapshotToJourney, nativeExport, importDocuments, type NativeConfig, type StageScene} from "@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs";

const WORLD_SCALE = 400; // the instrument's stage unit (nativeParameters.ts)
/** The kernel's own parameter bounds (kernel/src/expression.rs); share
 * follows the engine's journey law (model.ts: finite(e.share, 0, 1000)) —
 * the accepted corpus legitimately composes share values above 1. */
const BOUNDS = {x: [-1600, 1600], y: [-1600, 1600], z: [-1600, 1600], scale: [0.05, 4], share: [0, 1000]} as const;

export interface ArtifactSceneProjection {
  sceneRef: string;
  sceneTitle: string;
  /** The artifact's complete native material at this scene, with the
   * document's entity refs as the engine's native entity IDs. */
  config: NativeConfig;
  entityRefs: string[];
}

export interface ArtifactImport {
  document: ExpressionDocument;
  /** Per-scene stage projections, in document scene order. */
  scenes: ArtifactSceneProjection[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Migrate + validate any recognised artifact body into a journey through
 * the engine's own import path. Throws with the engine's own refusal. */
function artifactJourney(artifact: unknown): {name: string; scenes: StageScene[]} {
  if (!isRecord(artifact)) throw new TypeError("An artifact must be an object");
  if (artifact.schema === "oi.journey") {
    const {journeys, errors} = importDocuments(artifact) as {journeys: {name: string; scenes: StageScene[]}[]; errors: {index: number; message: string}[]};
    if (errors.length || !journeys.length) throw new TypeError(`The engine refused this journey artifact: ${errors[0]?.message ?? "no scenes"}`);
    return journeys[0];
  }
  // Native state configuration (a snapshots-export entry, or a raw config).
  const raw = isRecord(artifact.config) ? artifact : {config: artifact};
  const journey = nativeSnapshotToJourney(raw) as {name: string; scenes: StageScene[]};
  if (!journey.scenes.length) throw new TypeError("The engine migrated this artifact to an empty journey");
  return journey;
}

const REF_SUFFIX = /^[A-Za-z0-9._-]+$/;

function entityRef(expressionRef: string, artifactEntityId: string): string {
  if (typeof artifactEntityId !== "string" || !REF_SUFFIX.test(artifactEntityId)) {
    throw new TypeError(`Artifact entity id ${JSON.stringify(artifactEntityId)} cannot serve as an Expression ref suffix (refused, not renamed)`);
  }
  return `${expressionRef}:entity:${artifactEntityId}`;
}

function materialParameters(entity: Record<string, unknown>): Record<string, Parameter> {
  const id = String(entity.id);
  const shape = typeof entity.shape === "string" ? entity.shape : "";
  const glyphSource = shape === "text" && typeof entity.text === "string" && entity.text.trim()
    ? entity.text.trim()
    : typeof entity.name === "string" && entity.name.trim() ? entity.name.trim() : "O";
  if (glyphSource.length > 128 || /[\u0000-\u001f]/.test(glyphSource)) {
    throw new TypeError(`Artifact entity ${id} carries a glyph outside the document vocabulary`);
  }
  const position = isRecord(entity.position) ? entity.position : {};
  const within = (key: string, value: number, [min, max]: readonly [number, number]): Parameter => {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new TypeError(`Artifact entity ${id} ${key}=${value} is outside the document vocabulary [${min}, ${max}]`);
    }
    return {value, automation: null};
  };
  // Journey positions are shell units; the document vocabulary is the
  // instrument's stage units. Pins present with share 0, exactly as the
  // engine's own import treats them.
  const parameters: Record<string, Parameter> = {
    glyph: {value: glyphSource, automation: null},
    x: within("x", ((typeof position.x === "number" ? position.x : 0) * WORLD_SCALE), BOUNDS.x),
    y: within("y", ((typeof position.y === "number" ? position.y : 0) * WORLD_SCALE), BOUNDS.y),
    z: within("z", ((typeof position.z === "number" ? position.z : 0) * WORLD_SCALE), BOUNDS.z),
    scale: within("scale", typeof entity.scale === "number" ? entity.scale : 1, BOUNDS.scale),
    share: within("share", entity.kind === "pin" ? 0 : typeof entity.share === "number" ? entity.share : 1, BOUNDS.share),
  };
  return parameters;
}

/** Import one generated artifact into an `oi.expression/v1` document plus its
 * per-scene stage projections through the existing engine import path. */
export function artifactToExpression(expressionRef: string, artifact: unknown, title?: string): ArtifactImport {
  if (typeof expressionRef !== "string" || !expressionRef.startsWith("expression:")) {
    throw new TypeError("artifactToExpression needs a native expression:<id> ref");
  }
  const journey = artifactJourney(artifact);
  if (journey.scenes.length > 64) throw new TypeError(`This artifact holds ${journey.scenes.length} scenes; the document contract bounds an Expression at 64`);
  const document: ExpressionDocument = {
    schema: "oi.expression/v1",
    expression_ref: expressionRef,
    revision: 1,
    title: title ?? journey.name ?? "Imported Expression",
    scenes: [],
    entities: {},
    relations: {},
    selection: {scene_ref: "", entity_ref: null},
    provenance: [],
    representations: [],
    refinements: [],
  };
  const projections: ArtifactSceneProjection[] = [];
  for (const [index, scene] of journey.scenes.entries()) {
    const sceneRef = `${expressionRef}:scene:${index + 1}`;
    const entities = Array.isArray(scene.entities) ? scene.entities as Record<string, unknown>[] : [];
    if (entities.length > 10) throw new TypeError(`Artifact scene ${String(scene.id)} holds ${entities.length} entities; a document scene bounds at 10`);
    const entityRefs: string[] = [];
    for (const entity of entities) {
      const ref = entityRef(expressionRef, String(entity.id));
      entityRefs.push(ref);
      document.entities[ref] = {
        entity_ref: ref,
        revision: 1,
        title: typeof entity.name === "string" && entity.name ? entity.name : String(entity.id),
        subject: null,
        parameters: materialParameters(entity),
      };
    }
    document.scenes.push({scene_ref: sceneRef, revision: 1, title: typeof scene.name === "string" && scene.name ? scene.name : `Scene ${index + 1}`, entity_refs: entityRefs});
    // The stage projection: the artifact's own complete native material with
    // the document's entity refs as the engine's native IDs. Identity is one;
    // the engine adapter maintains no independent scene graph.
    const config = structuredClone((nativeExport(scene).config)) as NativeConfig;
    if (Array.isArray(config.entities)) {
      config.entities = (config.entities as Record<string, unknown>[]).map((native) => {
        const ref = entityRef(expressionRef, String(native.id));
        return {...native, id: ref};
      });
    }
    projections.push({sceneRef, sceneTitle: document.scenes[index].title, config, entityRefs});
  }
  const first = document.scenes[0];
  document.selection = {scene_ref: first.scene_ref, entity_ref: first.entity_refs[0] ?? null};
  return {document, scenes: projections};
}
