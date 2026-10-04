/** Retained Factory relation and a fresh bounded Central observation.
 * These are navigation/basis facts. They never create execution or success. */
import type {CentralLocation} from "../../../kernel/location";
import type {RunReading} from "./runModel";

export interface RunFlowAssociation {
  journeyRef: string;
  runRef: string;
  workflowSourceRef: string;
  workflowSourceRevision: string;
  workflowSourceDigest: string;
  flow: {location: CentralLocation; documentId: string; documentRevision: number; sourceRevision: string};
  basisRefs: string[];
}
export interface CurrentFlowBasis {
  location: CentralLocation;
  documentId: string;
  documentRevision: number;
  sourceRevision: string;
}
export interface RunFlowObservation {
  state: "matching" | "changed" | "replaced";
  current: CurrentFlowBasis;
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 4096 && !value.includes("\0");
const reference = (value: unknown): value is string => text(value) && !/\s/.test(value);
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
function location(value: unknown): value is CentralLocation {
  return record(value) && value.schema === "central.path-ref/v1" && reference(value.ref)
    && text(value.root) && value.root.startsWith("/") && text(value.path)
    && value.path.startsWith("Control/user/flows/")
    && value.path.split("/").every(part => !!part && part !== "." && part !== "..");
}
export const sameFlowLocation = (left: CentralLocation, right: CentralLocation): boolean =>
  left.schema === right.schema && left.ref === right.ref && left.root === right.root && left.path === right.path;
function association(value: unknown, run: Record<string, unknown>): value is RunFlowAssociation {
  if (!record(value) || !record(value.flow)) return false;
  const flow = value.flow;
  return value.runRef === run.runRef && reference(value.journeyRef)
    && Array.isArray(run.owningJourneyRefs) && run.owningJourneyRefs.includes(value.journeyRef)
    && reference(value.workflowSourceRef) && typeof value.workflowSourceRevision === "string" && value.workflowSourceRevision.trim().length > 0
    && typeof value.workflowSourceDigest === "string" && /^[0-9a-f]{64}$/.test(value.workflowSourceDigest)
    && location(flow.location) && reference(flow.documentId) && revision(flow.documentRevision)
    && reference(flow.sourceRevision) && Array.isArray(value.basisRefs)
    && value.basisRefs.length > 0 && value.basisRefs.length <= 128 && value.basisRefs.every(reference)
    && new Set(value.basisRefs).size === value.basisRefs.length;
}
/** Preserve the entire owner payload. An absent additive DTO remains valid;
 * a present malformed/foreign association is a named owner-read refusal. */
export function decodeRunFlowReading(value: unknown, expectedRunRef: string): RunReading {
  if (!record(value) || value.runRef !== expectedRunRef)
    throw new Error("Factory returned a different or malformed Run.");
  if (value.flowAssociations !== undefined) {
    if (!Array.isArray(value.flowAssociations) || value.flowAssociations.length > 128
      || !value.flowAssociations.every(item => association(item, value)))
      throw new Error("Factory returned a malformed Flow association for this Run.");
    const keys = value.flowAssociations.map(item => `${item.flow.location.ref}\0${item.flow.documentId}`);
    if (new Set(keys).size !== keys.length)
      throw new Error("Factory repeated the same Run Flow association.");
    if (value.flowAssociations.length && (value.contract !== "factory.run-reading/v1" || !record(value.provenance)
      || value.provenance.owner !== "factory" || !revision(value.provenance.factoryStateRevision)))
      throw new Error("Factory omitted the provider revision of this Run Flow association.");
  }
  return value as unknown as RunReading;
}
/** Provider revision changes can add a relation without changing Run topology.
 * Include its source path as well: different providers may reuse Run refs. */
export function runFlowObservationKey(run: RunReading, statePath: string, flow: RunFlowAssociation): string {
  return JSON.stringify([statePath, run.runRef, run.provenance?.factoryStateRevision ?? null,
    flow.journeyRef, flow.workflowSourceRef, flow.workflowSourceRevision, flow.workflowSourceDigest,
    flow.flow.location, flow.flow.documentId, flow.flow.documentRevision, flow.flow.sourceRevision, flow.basisRefs]);
}
/** Decode the actual bounded owner reading, without private collection data.
 * A lower or higher revision is simply changed; it never replaces history. */
export function observeRunFlow(retained: RunFlowAssociation, value: unknown): RunFlowObservation {
  if (!record(value) || value.schema !== "central.flow-reading/v1" || value.format_version !== 4
    || value.private_collections_included !== false || !location(value.location)
    || !sameFlowLocation(retained.flow.location, value.location) || !reference(value.document_id)
    || !revision(value.document_revision) || !reference(value.revision))
    throw new Error("Central did not return the bounded Flow basis at this Run's retained location.");
  const current: CurrentFlowBasis = {location: value.location, documentId: value.document_id,
    documentRevision: value.document_revision, sourceRevision: value.revision};
  const state = current.documentId !== retained.flow.documentId ? "replaced"
    : current.documentRevision !== retained.flow.documentRevision || current.sourceRevision !== retained.flow.sourceRevision
      ? "changed" : "matching";
  return {state, current};
}
export const runFlowName = (flow: RunFlowAssociation): string => flow.flow.location.path.split("/").pop() ?? "Flow";
