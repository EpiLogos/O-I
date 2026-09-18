import {selectFactoryMaterial, type FactoryMaterialSelection} from "./factory-material-reading";
import {isFactoryAttemptTaskReading, type FactoryAttemptTaskReading} from "./attempt-task";

/** Keep retained owner readings bounded just as the Git review Surface does. */
export const FACTORY_REVIEW_SNAPSHOT_MAX_BYTES = 64 * 1024;

export interface FactoryMaterialReviewSnapshot {
  statePath:string;
  runRef:string;
  subjectRef:string;
  revision:number;
  payload:unknown;
}

export interface FactoryHandoffReviewSnapshot {
  statePath:string;
  runRef:string;
  taskRef:string;
  revision:number;
  payload:unknown;
}

export interface FactoryReviewView {
  statePath:string;
  runRef:string;
  expectedRevision?:number;
  materialSnapshot?:FactoryMaterialReviewSnapshot;
  handoffSnapshot?:FactoryHandoffReviewSnapshot;
  snapshotUnavailable?:string;
}

type MaterialIdentity={statePath:string;runRef:string;subjectRef:string};
type HandoffIdentity={statePath:string;runRef:string};

export function createFactoryMaterialReviewSnapshot(payload:unknown, expected:MaterialIdentity):FactoryMaterialReviewSnapshot|undefined {
  const selection=selectFactoryMaterial(payload,expected.runRef,expected.subjectRef);
  if(selection.kind!=="selected") return undefined;
  const snapshot={...expected,revision:selection.reading.revision,payload};
  return factoryMaterialReviewSnapshotError(snapshot,expected)===undefined?snapshot:undefined;
}

export function factoryMaterialReviewSnapshotError(value:unknown, expected:MaterialIdentity):string|undefined {
  const snapshot=record(value);
  if(!snapshot||snapshot.statePath!==expected.statePath||snapshot.runRef!==expected.runRef||snapshot.subjectRef!==expected.subjectRef) return "material identity does not match this Surface";
  if(!integer(snapshot.revision)) return "material revision is malformed";
  const sizeError=snapshotSizeError(snapshot);if(sizeError) return sizeError;
  const selected=selectFactoryMaterial(snapshot.payload,expected.runRef,expected.subjectRef);
  if(selected.kind!=="selected") return `retained Factory material is invalid: ${selected.message}`;
  if(selected.reading.revision!==snapshot.revision) return "material revision does not match the retained Factory Build";
  return undefined;
}

export function exactFactoryMaterialReviewSnapshot(value:unknown, expected:MaterialIdentity):FactoryMaterialReviewSnapshot|undefined {
  return factoryMaterialReviewSnapshotError(value,expected)===undefined?value as FactoryMaterialReviewSnapshot:undefined;
}

export function factoryMaterialReview(snapshot:FactoryMaterialReviewSnapshot, expected:MaterialIdentity):Extract<FactoryMaterialSelection,{kind:"selected"}>|undefined {
  if(factoryMaterialReviewSnapshotError(snapshot,expected)!==undefined)return undefined;
  const selection=selectFactoryMaterial(snapshot.payload,expected.runRef,expected.subjectRef);
  return selection.kind==="selected"?selection:undefined;
}

export function createFactoryHandoffReviewSnapshot(payload:unknown, expected:HandoffIdentity):FactoryHandoffReviewSnapshot|undefined {
  const reading=payload as FactoryAttemptTaskReading;
  if(!reading||typeof reading.taskRef!=="string"||!isFactoryAttemptTaskReading(payload,expected.runRef,reading.taskRef)) return undefined;
  const snapshot={...expected,taskRef:reading.taskRef,revision:reading.revision,payload};
  return factoryHandoffReviewSnapshotError(snapshot,expected)===undefined?snapshot:undefined;
}

export function factoryHandoffReviewSnapshotError(value:unknown, expected:HandoffIdentity):string|undefined {
  const snapshot=record(value);
  if(!snapshot||snapshot.statePath!==expected.statePath||snapshot.runRef!==expected.runRef||typeof snapshot.taskRef!=="string"||!snapshot.taskRef) return "handoff identity does not match this Surface";
  if(!integer(snapshot.revision)) return "handoff revision is malformed";
  const sizeError=snapshotSizeError(snapshot);if(sizeError) return sizeError;
  if(!isFactoryAttemptTaskReading(snapshot.payload,expected.runRef,snapshot.taskRef)) return "retained Factory handoff is invalid";
  if((snapshot.payload as FactoryAttemptTaskReading).revision!==snapshot.revision) return "handoff revision does not match the retained Factory task";
  return undefined;
}

export function exactFactoryHandoffReviewSnapshot(value:unknown, expected:HandoffIdentity):FactoryHandoffReviewSnapshot|undefined {
  return factoryHandoffReviewSnapshotError(value,expected)===undefined?value as FactoryHandoffReviewSnapshot:undefined;
}

export function factoryHandoffReview(snapshot:FactoryHandoffReviewSnapshot, expected:HandoffIdentity):FactoryAttemptTaskReading|undefined {
  return factoryHandoffReviewSnapshotError(snapshot,expected)===undefined?snapshot.payload as FactoryAttemptTaskReading:undefined;
}

/** Decode only view material for this exact Factory Surface. Invalid retained
 * data may degrade into an explicit recovery notice; it never triggers a read. */
export function exactFactoryReviewView(value:unknown, expected:{kind:"factory-material"|"factory-handoff";statePath:string;runRef:string;subjectRef?:string}, recoverInvalid=false):FactoryReviewView|undefined {
  const view=record(value);
  if(!view||view.statePath!==expected.statePath||view.runRef!==expected.runRef) return undefined;
  const invalidExpectedRevision=view.expectedRevision!==undefined&&!integer(view.expectedRevision);
  const base:FactoryReviewView={statePath:expected.statePath,runRef:expected.runRef,...(!invalidExpectedRevision&&integer(view.expectedRevision)?{expectedRevision:view.expectedRevision}:{})};
  const suppliedNotice=typeof view.snapshotUnavailable==="string"&&view.snapshotUnavailable.trim()&&view.snapshotUnavailable.length<=1024?view.snapshotUnavailable:undefined;
  const malformedNotice=view.snapshotUnavailable!==undefined&&!suppliedNotice;
  const snapshot=expected.kind==="factory-material"?view.materialSnapshot:view.handoffSnapshot;
  const wrongKindSnapshot=expected.kind==="factory-material"?view.handoffSnapshot!==undefined:view.materialSnapshot!==undefined;
  const recover=(detail:string)=>recoverInvalid?{...base,snapshotUnavailable:`The retained Factory review cannot be restored: ${detail}. Refresh explicitly to read the current Factory state.`}:undefined;
  if(invalidExpectedRevision) return recover("expected revision is malformed");
  if(snapshot===undefined) {
    if(suppliedNotice) return {...base,snapshotUnavailable:suppliedNotice};
    if(malformedNotice) return recover("recovery notice is malformed");
    if(wrongKindSnapshot) return recover("snapshot kind does not match this Surface");
    return base;
  }
  if(wrongKindSnapshot) return recover("snapshot kind does not match this Surface");
  const error=expected.kind==="factory-material"
    ? factoryMaterialReviewSnapshotError(snapshot,{statePath:expected.statePath,runRef:expected.runRef,subjectRef:expected.subjectRef??""})
    : factoryHandoffReviewSnapshotError(snapshot,{statePath:expected.statePath,runRef:expected.runRef});
  const revision=record(snapshot)?.revision;
  const revisionMatches=error===undefined&&(base.expectedRevision===undefined||base.expectedRevision===revision);
  if(error===undefined&&revisionMatches) return expected.kind==="factory-material"?{...base,materialSnapshot:snapshot as FactoryMaterialReviewSnapshot}:{...base,handoffSnapshot:snapshot as FactoryHandoffReviewSnapshot};
  return recover(error??"retained revision does not match this Surface");
}

function snapshotSizeError(value:unknown):string|undefined {
  let encoded:string;
  try { encoded=JSON.stringify(value); } catch { return "cannot be serialized"; }
  return new TextEncoder().encode(encoded).byteLength>FACTORY_REVIEW_SNAPSHOT_MAX_BYTES?`exceeds the ${FACTORY_REVIEW_SNAPSHOT_MAX_BYTES}-byte presentation bound`:undefined;
}
function record(value:unknown):Record<string,unknown>|undefined { return typeof value==="object"&&value!==null&&!Array.isArray(value)?value as Record<string,unknown>:undefined; }
function integer(value:unknown):value is number { return typeof value==="number"&&Number.isSafeInteger(value)&&value>=0; }
