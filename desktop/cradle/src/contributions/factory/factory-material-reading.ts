import type {CandidateView,ClaimView,EvidenceView} from "./types";

type RecordValue=Record<string,unknown>;
export interface FactoryMaterialBuildReading {
  contract:"factory.build-view/v1"; revision:number; factoryStateRevision:number; runRevision:number; runMapRevision:number; provenanceSource:string;
  project:{projectRef:string;label:string}; run:{runRef:string;runMapRef:string;label:string;status:string}; claims:ClaimView[]; evidence:EvidenceView[]; candidates:CandidateView[];
}
export type FactoryMaterial=
  | {kind:"candidate";candidate:CandidateView;claims:Array<{ref:string;claim?:ClaimView}>;evidence:Array<{ref:string;evidence?:EvidenceView}>}
  | {kind:"evidence";evidence:EvidenceView};
export type FactoryMaterialSelection=
  | {kind:"selected";reading:FactoryMaterialBuildReading;material:FactoryMaterial}
  | {kind:"refusal";message:string;reading?:FactoryMaterialBuildReading};

/** Validates the public Build fields this reader consumes. The Factory owner
 * remains authority for the complete owner record. */
export function readFactoryMaterialBuild(value:unknown,expectedRunRef:string):FactoryMaterialSelection {
  const reading=parseBuildReading(value);
  if(typeof reading==="string") return {kind:"refusal",message:reading};
  if(reading.run.runRef!==expectedRunRef) return {kind:"refusal",message:`Factory returned Build Run ${reading.run.runRef}, not requested Run ${expectedRunRef}.`,reading};
  return {kind:"refusal",message:"A Candidate or Evidence subject is required.",reading};
}
export function selectFactoryMaterial(value:unknown,expectedRunRef:string,subjectRef:string):FactoryMaterialSelection {
  const base=readFactoryMaterialBuild(value,expectedRunRef);
  if(!base.reading||base.reading.run.runRef!==expectedRunRef) return base;
  const candidate=base.reading.candidates.find(item=>item.candidateRef===subjectRef);
  if(candidate) return {kind:"selected",reading:base.reading,material:{kind:"candidate",candidate,claims:candidate.claimRefs.map(ref=>({ref,claim:base.reading?.claims.find(item=>item.claimRef===ref)})),evidence:linkedEvidence(base.reading,candidate)}};
  const evidence=base.reading.evidence.find(item=>item.evidenceRef===subjectRef);
  if(evidence) return {kind:"selected",reading:base.reading,material:{kind:"evidence",evidence}};
  return {kind:"refusal",reading:base.reading,message:`Factory Build for Run ${expectedRunRef} does not retain Candidate or Evidence ${subjectRef}.`};
}
function linkedEvidence(reading:FactoryMaterialBuildReading,candidate:CandidateView) {
  const refs=[...new Set([...candidate.evidenceRefs,...candidate.claimRefs.flatMap(ref=>reading.claims.find(item=>item.claimRef===ref)?.evidenceRefs??[])])];
  return refs.map(ref=>({ref,evidence:reading.evidence.find(item=>item.evidenceRef===ref)}));
}
function parseBuildReading(value:unknown):FactoryMaterialBuildReading|string {
  const root=record(value),provenance=root&&record(root.provenance),view=root&&record(root.view);
  if(!root||root.contract!=="factory.build-view/v1") return "Factory did not return a factory.build-view/v1 reading.";
  if(!provenance||!view) return "Factory Build provenance or view is unavailable.";
  const revision=integer(root.revision),factoryStateRevision=integer(provenance.factoryStateRevision),runRevision=integer(provenance.runRevision),runMapRevision=integer(provenance.runMapRevision),provenanceSource=string(provenance.source);
  if(revision===undefined||factoryStateRevision===undefined||runRevision===undefined||runMapRevision===undefined||!provenanceSource) return "Factory Build revision provenance is unavailable.";
  const project=parseProject(view.project),run=parseRun(view.run),claims=parseList(view.claims,parseClaim),evidence=parseList(view.evidence,parseEvidence),candidates=parseList(view.candidates,parseCandidate);
  if(typeof project==="string") return project;
  if(typeof run==="string") return run;
  if(typeof claims==="string") return claims;
  if(typeof evidence==="string") return evidence;
  if(typeof candidates==="string") return candidates;
  if(duplicateRef(claims,item=>item.claimRef)||duplicateRef(evidence,item=>item.evidenceRef)||duplicateRef(candidates,item=>item.candidateRef)) return "Factory Build contains duplicate canonical material references.";
  return {contract:"factory.build-view/v1",revision,factoryStateRevision,runRevision,runMapRevision,provenanceSource,project,run,claims,evidence,candidates};
}
function parseProject(value:unknown):FactoryMaterialBuildReading["project"]|string { const item=record(value),projectRef=item&&string(item.projectRef),label=item&&string(item.label); return projectRef&&label?{projectRef,label}:"Factory Build project is unavailable."; }
function parseRun(value:unknown):FactoryMaterialBuildReading["run"]|string { const item=record(value),runRef=item&&string(item.runRef),runMapRef=item&&string(item.runMapRef),label=item&&string(item.label),status=item&&string(item.status); return runRef&&runMapRef&&label&&status?{runRef,runMapRef,label,status}:"Factory Build Run is unavailable."; }
function parseClaim(value:unknown,index:number):ClaimView|string {
  const item=record(value),claimRef=item&&string(item.claimRef),statement=item&&string(item.statement),status=item&&string(item.status),evidenceRefs=item&&strings(item.evidenceRefs);
  if(!claimRef||!statement||!evidenceRefs) return `Factory claim ${index+1} is incomplete.`;
  if(status!=="standing"&&status!=="challenged"&&status!=="supported"&&status!=="superseded") return `Factory claim ${index+1} has an unsupported status.`;
  return {claimRef,statement,status,evidenceRefs};
}
function parseEvidence(value:unknown,index:number):EvidenceView|string {
  const item=record(value),evidenceRef=item&&string(item.evidenceRef),label=item&&string(item.label);
  if(!evidenceRef||!label) return `Factory evidence ${index+1} is incomplete.`;
  const assessment=optionalString(item.assessment),nativeRef=optionalString(item.nativeRef),producingExecutionRef=optionalString(item.producingExecutionRef);
  if(assessment===false||nativeRef===false||producingExecutionRef===false) return `Factory evidence ${index+1} has an invalid optional field.`;
  return {evidenceRef,label,...(assessment?{assessment}:{}),...(nativeRef?{nativeRef}:{}),...(producingExecutionRef?{producingExecutionRef}:{})};
}
function parseCandidate(value:unknown,index:number):CandidateView|string {
  const item=record(value),candidateRef=item&&string(item.candidateRef),revision=item&&integer(item.revision),label=item&&string(item.label),status=item&&string(item.status),producingExecutionRefs=item&&strings(item.producingExecutionRefs),claimRefs=item&&strings(item.claimRefs),evidenceRefs=item&&strings(item.evidenceRefs);
  if(!candidateRef||revision===undefined||!label||!producingExecutionRefs||!claimRefs||!evidenceRefs) return `Factory Candidate ${index+1} is incomplete.`;
  if(status!=="developing"&&status!=="ready"&&status!=="recognised"&&status!=="returned"&&status!=="rejected") return `Factory Candidate ${index+1} has an unsupported status.`;
  const artifactRefs=optionalStrings(item.artifactRefs),previewRef=optionalString(item.previewRef),tradeoffs=optionalStrings(item.tradeoffs);
  if(artifactRefs===false||previewRef===false||tradeoffs===false) return `Factory Candidate ${index+1} has an invalid optional field.`;
  return {candidateRef,revision,label,status,producingExecutionRefs,claimRefs,evidenceRefs,...(artifactRefs?{artifactRefs}:{}),...(previewRef?{previewRef}:{}),...(tradeoffs?{tradeoffs}:{})};
}
function parseList<T>(value:unknown,parse:(item:unknown,index:number)=>T|string):T[]|string { if(!Array.isArray(value)) return "Factory Build relation list is unavailable."; const parsed=value.map(parse); const invalid=parsed.find((item):item is string=>typeof item==="string"); return invalid??parsed as T[]; }
function duplicateRef<T>(items:T[],ref:(item:T)=>string) { return new Set(items.map(ref)).size!==items.length; }
function record(value:unknown):RecordValue|undefined { return typeof value==="object"&&value!==null&&!Array.isArray(value)?value as RecordValue:undefined; }
function string(value:unknown):string|undefined { return typeof value==="string"&&value.length>0?value:undefined; }
function integer(value:unknown):number|undefined { return typeof value==="number"&&Number.isSafeInteger(value)&&value>=0?value:undefined; }
function strings(value:unknown):string[]|undefined { return Array.isArray(value)&&value.every(item=>typeof item==="string"&&item.length>0)?value:undefined; }
function optionalString(value:unknown):string|undefined|false { return value===undefined?undefined:string(value)??false; }
function optionalStrings(value:unknown):string[]|undefined|false { return value===undefined?undefined:strings(value)??false; }
