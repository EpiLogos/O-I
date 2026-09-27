/** Deliberate typed knowledge relationship authored from an occurrence pair in
 * the live field. The constellation owner (AIKit, `aikit.constellation.apply`)
 * records the relation between the two exact participations; the same
 * constellation Expression is then re-projected in place so the relation
 * reaches the renderer under its existing identity. A presentation connection
 * never becomes evidence by being drawn; this is the separate native act. */
import type {KernelTransportStatus} from "../kernel/types";
import {PARTICIPATION, RELATION, editConstruction, newRef, readRegister, saveConstruction, type ApplyKernel, type NativeConstruction} from "../knowledge/construction";
import {projectConstruction} from "../knowledge/constructionProjection";
import {knowledgeEntityRef} from "../knowledge/expressionProjection";
import {kernelOp} from "../kernel/bridge";
import type {ExpressionDocument} from "../expression/types";

export interface SceneRelationRequest {
  expression_ref: string; revision: number; scene_ref: string;
  from_entity_ref: string; to_entity_ref: string;
  relation: string; direction: "directed" | "undirected" | "bidirectional";
}
/** Owner receipts stay separate: the constellation save can succeed while the
 * Expression re-projection is refused. Neither is reported as the other. */
export interface SceneRelationReceipt {
  frame_ref: string; frame_revision: number; relation_ref: string; state: "saved" | "unchanged";
  expression: {state: "ready"; expression_ref: string; revision: number} | {state: "pending"; detail: string};
}

const DIRECTIONS = new Set(["directed", "undirected", "bidirectional"]);
const bounded = (value: unknown, label: string, limit = 2048): string => {
  if (typeof value !== "string" || !value.trim() || value.length > limit || value.includes("\0")) throw new Error(`A bounded ${label} is required.`);
  return value;
};

export function readSceneRelationRequest(input: unknown): SceneRelationRequest {
  const value = (input ?? {}) as Record<string, unknown>;
  if (!Number.isSafeInteger(value.revision)) throw new Error("The request carries no exact Expression revision.");
  const request: SceneRelationRequest = {
    expression_ref: bounded(value.expression_ref, "Expression reference"), revision: value.revision as number,
    scene_ref: bounded(value.scene_ref, "Scene reference"), from_entity_ref: bounded(value.from_entity_ref, "source occurrence"),
    to_entity_ref: bounded(value.to_entity_ref, "target occurrence"), relation: bounded(value.relation, "relationship meaning", 160).trim(),
    direction: value.direction as SceneRelationRequest["direction"],
  };
  if (!DIRECTIONS.has(request.direction)) throw new Error("Choose directed, undirected or bidirectional.");
  if (request.from_entity_ref === request.to_entity_ref) throw new Error("A relationship needs two different members.");
  return request;
}

/** The exact participation an occurrence presents: a participation reading it
 * discloses, else the managed identity the constellation projection minted for
 * that participation (`knowledgeEntityRef`), else the subject's only
 * participation. Repeated sources stay distinct; ambiguity is refused. */
export async function occurrenceParticipation(frame: NativeConstruction, occurrence: {expression_ref: string; entity_ref: string; subject: {subject_ref: string; readings: {ref: string; revision?: string; availability?: string}[]}}): Promise<string> {
  const {subject} = occurrence;
  const members = frame.constellations[0].members.filter(member => member.ref === subject.subject_ref);
  let candidates = members.filter(member => subject.readings.some(row => row.availability !== "unavailable" && row.ref === member[PARTICIPATION].participation_ref));
  if (!candidates.length) {
    const minted = await Promise.all(members.map(async member => [member, await knowledgeEntityRef(occurrence.expression_ref, member[PARTICIPATION].participation_ref)] as const));
    candidates = minted.filter(([, ref]) => ref === occurrence.entity_ref).map(([member]) => member);
  }
  if (!candidates.length) candidates = members;
  if (candidates.length !== 1) throw new Error(candidates.length ? "This source takes several roles in the constellation; open it in its source editor to choose the exact participation." : "This occurrence is not a member of the constellation.");
  return candidates[0][PARTICIPATION].participation_ref;
}

/** `Work/<Project>/ProjectCentral/agents/wiki/wiki.json` names its Project;
 * the root register (`Control/agents/wiki/wiki.json`) has none. */
export function registerProject(path: string): string | undefined {
  const match = /^Work\/([^/]+)\/ProjectCentral\/agents\/wiki\/wiki\.json$/.exec(path);
  if (match) return match[1];
  if (path === "Control/agents/wiki/wiki.json") return undefined;
  throw new Error("The occurrences name a register outside Central's Wiki registers.");
}

/** The Expression as the owner holds it now. A newer revision is accepted —
 * selection focus edits advance it constantly — because the relationship's
 * basis is the exact occurrences (checked below) and the constellation
 * register revision, not the Expression's presentation revision. */
async function currentScene(transport: KernelTransportStatus, request: SceneRelationRequest) {
  if (transport.kind === "unavailable") throw new Error(transport.reason);
  const inspected = await kernelOp(transport, {op: "expression", request: {operation: "inspect", expression_ref: request.expression_ref}});
  const document = inspected.outcome?.result === "expression" ? (inspected.outcome.data as {document?: ExpressionDocument}).document : undefined;
  if (inspected.error || !document || document.expression_ref !== request.expression_ref) throw new Error(inspected.error ?? "The native Expression could not be read");
  if (document.revision < request.revision) throw new Error("The native Expression is older than the field's view; reopen it before recording a relationship.");
  const scene = document.scenes.find(row => row.scene_ref === request.scene_ref);
  if (!scene) throw new Error("The requested Scene is absent from this native Expression");
  return {document, scene};
}

export async function relateSceneConstellation(transport: KernelTransportStatus, input: unknown, apply?: ApplyKernel): Promise<SceneRelationReceipt> {
  const request = readSceneRelationRequest(input);
  const {document, scene} = await currentScene(transport, request);
  const subjects = [request.from_entity_ref, request.to_entity_ref].map(ref => {
    const subject = document.entities[ref]?.subject;
    if (!scene.entity_refs.includes(ref) || !subject) throw new Error("Both occurrences must be source-bound members of this Scene.");
    return subject;
  });
  // The register is the one the occurrences themselves were read from: no
  // dependency on which Wiki a navigator happens to have published.
  const registerReadings = new Map<string, string>();
  for (const subject of subjects) for (const row of subject.readings) if (row.availability === "available" && row.ref.startsWith("wiki:") && row.ref.endsWith("/wiki.json")) registerReadings.set(row.ref, row.revision);
  if (registerReadings.size !== 1) throw new Error("These occurrences do not share one constellation register. Author the relationship in the source editor.");
  const [[registerRef, registerRevision]] = [...registerReadings];
  const path = registerRef.slice("wiki:".length), project = registerProject(path);
  const current = await readRegister(transport, project);
  if (current.file.location.path !== path) throw new Error("The occurrences' constellation register is not this Project's Wiki register.");
  if (current.file.revision !== registerRevision) throw new Error("The constellation changed since this composition was opened. Refresh the live composition, then record the relationship.");
  const register = {project};
  const bound = current.frames.filter(frame => subjects.every(subject => subject.readings.some(row => row.availability === "available" && row.ref === frame.ref && row.revision === String(frame.revision)) && frame.constellations[0].members.some(member => member.ref === subject.subject_ref)));
  if (bound.length !== 1) throw new Error("These occurrences have no single current constellation in common. Refresh the live composition or author the relationship in the source editor.");
  const frame = bound[0];
  const [from, to] = await Promise.all([request.from_entity_ref, request.to_entity_ref].map((entity_ref, index) => occurrenceParticipation(frame, {expression_ref: document.expression_ref, entity_ref, subject: subjects[index]})));
  const relation_ref = newRef("wiki:relation");
  const change = {change: "relation_put", relation: {relation_ref, expected_revision: null, from_participation_ref: from, to_participation_ref: to,
    relation: request.relation, direction: request.direction, standing: "proposed", evidence: []}};
  const saved = await saveConstruction(transport, register.project, current, editConstruction(frame, [change]), [], apply);
  const stored = saved.reading.relations.find(row => row.ref === relation_ref);
  if (!stored || stored[RELATION].from_participation_ref !== from || stored[RELATION].to_participation_ref !== to) throw new Error("The constellation owner acknowledged the save but did not return this relationship. Inspect the register before retrying.");
  const receipt = {frame_ref: saved.frame_ref, frame_revision: saved.revision, relation_ref, state: saved.state};
  try {
    const next = await readRegister(transport, register.project);
    const nextFrame = next.frames.find(row => row.ref === frame.ref);
    if (!nextFrame || nextFrame.revision !== saved.revision) throw new Error("The register changed again after this save.");
    const outcome = await projectConstruction(transport, register.project, nextFrame, next.relations, next);
    if (outcome.state !== "ready") return {...receipt, expression: {state: "pending", detail: "detail" in outcome ? String(outcome.detail) : `The live composition was not updated (${outcome.state}).`}};
    // Only the constellation's own composition is re-projected here. Another
    // Expression presenting the same members keeps its authored state and is
    // reconciled through its own source-change path, never silently rewritten.
    if (outcome.document.expression_ref !== request.expression_ref) return {...receipt, expression: {state: "pending", detail: "The relationship is saved in the constellation. This Scene presents another composition; reconcile its source bindings to show it here."}};
    return {...receipt, expression: {state: "ready", expression_ref: outcome.document.expression_ref, revision: outcome.document.revision}};
  } catch (error) {
    return {...receipt, expression: {state: "pending", detail: error instanceof Error ? error.message : String(error)}};
  }
}
