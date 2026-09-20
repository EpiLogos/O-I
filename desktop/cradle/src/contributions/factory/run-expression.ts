import type {ExpressionDocument, Entity, ReadingRef, Relation, Scene, SubjectBinding} from "../../expression/types";
import type {KernelTransportStatus} from "../../kernel/types";
import {developmentRead, attemptRead} from "./development";

/** A projection of the existing native Run, never a second Run store.
 * Field spellings follow Factory developmental_read.rs / attempt_runtime.rs.
 * The complete owner payload remains in the snapshot; only disclosed refs
 * become navigable. A reference is not proof that its target is available. */
export interface RunReading {
  contract:string; runRef:string; revision:number; projectRef:string;
  provenance?:{factoryStateRevision?:number; subjectRevision?:number; owner?:string};
  lifecycle:string; destination:string;
  owningJourneyRefs?:string[];
  runMap:{runRef:string;topologyRevision:number;nodes:Record<string,{id:string;kind:string;label:string;state:string|null;semanticRef:string|null}>;edges:{from:string;to:string;relation:string}[]};
  actions?:{actionRef:string;label:string;authorityOwner:string;requiredCapabilityRef?:string;subjectKinds?:string[]}[];
  agencies?:unknown[];executions?:unknown[];evidence?:unknown[];candidates?:unknown[];humanRequests?:unknown[];
}
export interface OwnerReceipt {
  ownerRef:string;contract:string;operationRef:string;receiptRef:string;
  sourceRevision:string;phase:string;evidenceRefs?:string[];partialEffectRefs?:string[];payload?:unknown;
}
export interface AttemptReading {
  contract:string;runRef:string;revision:number;runRevision:number;topologyRevision:number;
  workflowKey:string;workflowSourceRef:string;workflowSourceRevision:string;workflowSourceDigest:string;
  sourceCurrent?:boolean;
  attempts:{attemptRef:string;taskRef:string;workflowUnitRef:string;executionRef?:string|null;
    disposition?:{participant?:{agentRef:string;agencyRef:string;sourceRef:string;sourceRevision:string;worldBindingRef:string};
      body?:{agentSessionRef:string;sessionSpaceRef:string;harnessRef:string;modelRef:string;providerRef:string;routeRef:string;workcellRef?:string;materialWorldRef?:string};
      placement?:{nowRef:string;policyRef:string;policyRevision:string;authorityRef:string};contextRefs?:string[];praxisRefs?:string[];capabilityRefs?:string[]};
    dispatch?:OwnerReceipt|null;observations?:OwnerReceipt[];
    tracking?:{factRef:string;kind:string;ownerRef:string;subjectRef:string;sourceRevision:string;evidenceRefs?:string[]}[];
    reresolutions?:{resolutionRef:string;reason:string;sourceRevision:string;evidenceRefs?:string[]}[];
    verifications:{verificationRef:string;ownerRef:string;sourceRevision?:string;outcome:"passed"|"failed"|"unknown";evidenceRefs?:string[]}[];
    failureEvidenceRefs?:string[];
    readableReturn?:{returnRef:string;summary:string;artifactRefs?:string[];evidenceRefs?:string[];receivingRef?:string|null;receivingSourceRevision?:string;archiveRefs?:string[];regressionObservationRefs?:string[]}|null}[];
  legs:Record<string,unknown>;
}
export interface UnitListReading {
  contract:string;projectRef?:string;runRef?:string|null;
  provenance?:{factoryStateRevision?:number;buildStateRevision?:number};
  units:{workflowUnitRef:string;key:string;locator:unknown;[key:string]:unknown}[];
}
export interface RunExpressionInputs {run:RunReading;attempt?:AttemptReading;units:UnitListReading;statePath:string}
export interface RunExpressionSnapshot extends RunExpressionInputs {
  document:ExpressionDocument;
  attemptAvailability:"available"|"missing";
  attemptError?:string;
  readConflicts?:unknown[];
}
export class RunExpressionReadError extends Error {
  readonly code:string;
  readonly readings?:unknown;
  constructor(code:string, message:string, readings?:unknown) {
    super(`${code}: ${message}`); this.name="RunExpressionReadError";
    this.code=code; this.readings=readings;
  }
}
const fail=(code:string,message:string,readings?:unknown):never=>{throw new RunExpressionReadError(code,message,readings);};
const nonempty=(value:unknown):value is string=>typeof value==="string"&&value.trim().length>0;
const revision=(value:unknown):value is number=>typeof value==="number"&&Number.isSafeInteger(value)&&value>=0;
const rr=(ref:string,rev:string,availability:ReadingRef["availability"]="available"):ReadingRef=>({ref,revision:rev,availability});

/** Lossless UTF-16 encoding, not punctuation replacement or a hash.
 * Kind namespaces also separate a node called "run" from the root Being,
 * and separate attempts from nodes with the same native spelling. */
export function runExpressionEntityRef(expressionRef:string,kind:string,nativeRef:string):string {
  const encoded=Array.from({length:nativeRef.length},(_,i)=>nativeRef.charCodeAt(i).toString(16).padStart(4,"0")).join("");
  return `${expressionRef}:entity:${kind}-${encoded}`;
}

/** Refuse a mismatched read occasion, not a legitimately historical source.
 * sourceCurrent=false is retained and rendered; it is NOT permission to run
 * against a newly substituted source. Legacy missing provenance is unknown. */
export function validateRunExpressionInputs(inputs:RunExpressionInputs,expectedRunRef?:string):void {
  const {run,attempt,units}=inputs;
  if(!run||run.contract!=="factory.run-reading/v1"||!nonempty(run.runRef)||!revision(run.revision)||!run.runMap||!revision(run.runMap.topologyRevision)||!run.runMap.nodes||!Array.isArray(run.runMap.edges))
    fail("factory.expression.incompatible","Factory returned an incompatible Run reading",inputs);
  if((expectedRunRef&&run.runRef!==expectedRunRef)||run.runMap.runRef!==run.runRef)
    fail("factory.expression.wrong-run","Run reading does not identify the requested Run",inputs);
  if(!units||units.contract!=="factory.workflow-unit-list-reading/v1"||!Array.isArray(units.units))
    fail("factory.expression.incompatible","Factory returned an incompatible workflow-unit list",inputs);
  if((units.projectRef&&units.projectRef!==run.projectRef)||(units.runRef&&units.runRef!==run.runRef))
    fail("factory.expression.wrong-run","Workflow-unit list belongs to a different Project or Run",inputs);
  if(attempt&&(attempt.contract!=="factory.attempt-reading/v1"||!Array.isArray(attempt.attempts)||!revision(attempt.revision)))
    fail("factory.expression.incompatible","Factory returned an incompatible attempt reading",inputs);
  if(attempt&&attempt.runRef!==run.runRef)fail("factory.expression.wrong-run","Attempt reading belongs to another Run",inputs);
  if(attempt&&(attempt.runRevision!==run.revision||attempt.topologyRevision!==run.runMap.topologyRevision))
    fail("factory.expression.stale","Run and attempt topology were read at different revisions",inputs);
  const stateRevision=run.provenance?.factoryStateRevision;
  const unitRevision=units.provenance?.factoryStateRevision??units.provenance?.buildStateRevision;
  if(stateRevision!==undefined&&((attempt&&attempt.revision!==stateRevision)||(unitRevision!==undefined&&unitRevision!==stateRevision)))
    fail("factory.expression.stale","Owner state changed between the Run, unit and attempt reads",inputs);
  const ids=new Set<string>();
  for(const [key,node] of Object.entries(run.runMap.nodes)){
    if(!node||!nonempty(node.id)||key!==node.id||ids.has(node.id)||!nonempty(node.kind))
      fail("factory.expression.incompatible","RunMap contains an invalid or duplicate node identity",inputs);
    ids.add(node.id);
  }
  for(const edge of run.runMap.edges)if(!ids.has(edge.from)||!ids.has(edge.to)||!nonempty(edge.relation))
    fail("factory.expression.incompatible",`Run edge names a node outside the map: ${edge.from} -> ${edge.to}`,inputs);
  for(const [kind,refs] of [["unit",units.units.map(u=>u.workflowUnitRef)],["attempt",(attempt?.attempts??[]).map(a=>a.attemptRef)]] as const){
    if(refs.some(ref=>!nonempty(ref))||new Set(refs).size!==refs.length)
      fail("factory.expression.incompatible",`Duplicate or missing native ${kind} identity`,inputs);
  }
}

/** Compose semantic references and relations, not physical parameters.
 * The current shared kernel's per-scene budget is a presentation boundary,
 * not a limit on the native Run, source or number of preserved relations. */
export function composeRunExpression(inputs:RunExpressionInputs,expressionRef:string):ExpressionDocument {
  validateRunExpressionInputs(inputs);
  if(!/^expression:[A-Za-z0-9][A-Za-z0-9-_.]*$/.test(expressionRef))throw new Error("The expression ref must be expression-local (expression:<slug>)");
  const {run,attempt,units,statePath}=inputs;
  const entities:Record<string,Entity>={}; const relations:Record<string,Relation>={}; const scenes:Scene[]=[];
  const root=`${expressionRef}:entity:run`;
  const basis=[rr(run.contract,String(run.revision)),...(attempt?[rr(attempt.contract,String(attempt.revision))]:[])];
  const add=(kind:string,key:string,title:string,subject:SubjectBinding):string=>{
    const ref=runExpressionEntityRef(expressionRef,kind,key);
    entities[ref]={entity_ref:ref,revision:1,title,subject,parameters:{}};return ref;
  };
  const subject=(ref:string,owner="software-factory",readings:ReadingRef[]=[]):SubjectBinding=>({subject_ref:ref,native_owner:owner,presentation_role:"thing",sources:[],readings,actions:[]});
  const link=(from:string,to:string,relation:string,key:string)=>{
    const binding=`${expressionRef}:relation:${key}`;
    relations[binding]={binding_ref:binding,from_entity_ref:from,to_entity_ref:to,relation:rr(relation,String(run.runMap.topologyRevision)),provenance:basis};
  };
  let nextLink=0;
  // Each occurrence stays separate: two contrary/duplicate observations of
  // one native ref must not overwrite each other in a keyed object.
  const reference=(from:string,ref:string|undefined|null,role:string,owner:string,rev="unreported")=>{
    if(!nonempty(ref))return;
    const key=String(nextLink++);const to=add("reference",key,`${role}: ${ref}`,subject(ref,owner,[rr(ref,rev)]));
    link(from,to,`factory.correlation/${role}`,`correlation-${key}`);return to;
  };
  entities[root]={entity_ref:root,revision:1,title:run.destination||run.runRef,parameters:{},subject:{
    ...subject(run.runRef,"software-factory",basis),presentation_role:"being",
    sources:[rr(`file:${statePath}`,`run:${run.revision}`)],
    actions:(run.actions??[]).filter(a=>!a.subjectKinds||a.subjectKinds.includes("run")).map(a=>({action_ref:a.actionRef,target_ref:run.runRef,authority_requirement:`${a.authorityOwner}${a.requiredCapabilityRef?` ${a.requiredCapabilityRef}`:""} — native authority is required`})),
  }};
  const nodeRefs=new Map<string,string>();
  for(const node of Object.values(run.runMap.nodes))nodeRefs.set(node.id,add("node",node.id,node.label||node.id,subject(`${run.runRef}#${node.id}`,"software-factory",[
    rr(`factory.run-node/${node.kind}`,node.state??"unset"),...(node.semanticRef?[rr(node.semanticRef,"native")]:[]),
  ])));
  for(const [i,edge] of run.runMap.edges.entries())link(nodeRefs.get(edge.from)!,nodeRefs.get(edge.to)!,`factory.run-edge/${edge.relation}`,`edge-${i}`);
  const unitRefs=new Map<string,string>();
  for(const unit of units.units){
    const ref=add("unit",unit.workflowUnitRef,unit.key||unit.workflowUnitRef,subject(unit.workflowUnitRef,"software-factory",[rr(units.contract,String(unitRevisionOf(units)??"unreported"))]));
    unitRefs.set(unit.workflowUnitRef,ref);
    for(const node of Object.values(run.runMap.nodes))if(node.semanticRef===unit.workflowUnitRef)link(nodeRefs.get(node.id)!,ref,"factory.correlation/workflow-unit",`unit-${nextLink++}`);
    if(nonempty(unit.locator))reference(ref,unit.locator,"source-locator","software-factory");
  }
  for(const journey of run.owningJourneyRefs??[])reference(root,journey,"owning-journey","software-factory");
  const source=attempt?add("source",attempt.workflowSourceRef,attempt.workflowKey||attempt.workflowSourceRef,{
    ...subject(attempt.workflowSourceRef,"software-factory",[rr("factory.workflow-source/current",String(attempt.sourceCurrent??"unknown")),rr(attempt.workflowSourceRef,attempt.workflowSourceRevision),rr("factory.workflow-source/digest",attempt.workflowSourceDigest)]),
    sources:[rr(attempt.workflowSourceRef,attempt.workflowSourceRevision)],
  }):undefined;
  if(source)link(root,source,"factory.correlation/retained-workflow-source","retained-source");
  const attempts:string[]=[];const returns:string[]=[];
  for(const a of attempt?.attempts??[]){
    const ar=add("attempt",a.attemptRef,a.taskRef||a.attemptRef,subject(a.attemptRef,"software-factory",[
      ...((a.verifications??[]).length?a.verifications.map(v=>rr(`factory.verification/${v.outcome}`,v.verificationRef)):[rr("factory.verification/unverified",a.attemptRef)]),
    ]));attempts.push(ar);
    link(root,ar,"factory.correlation/attempt",`attempt-${nextLink++}`);
    // Old source units need not occur in today's compiled unit list. Keep
    // that exact historical ref; do not bind it to a replacement by label.
    const ur=unitRefs.get(a.workflowUnitRef)??add("historical-unit",a.workflowUnitRef,a.workflowUnitRef,subject(a.workflowUnitRef));
    if(source)link(source,ur,"factory.correlation/retained-unit",`source-unit-${nextLink++}`);
    link(ur,ar,"factory.correlation/attempt",`unit-attempt-${nextLink++}`);
    reference(ar,a.executionRef,"execution","software-factory");
    const d=a.disposition;const b=d?.body;const p=d?.participant;
    reference(ar,p?.agentRef,"agent","ai-kit");reference(ar,p?.agencyRef,"agency","actuation");
    reference(ar,p?.worldBindingRef,"world-binding","ai-kit");reference(ar,p?.sourceRef,"participant-source","central",p?.sourceRevision);
    for(const [role,ref,owner] of [["session",b?.agentSessionRef,"ai-kit"],["session-space",b?.sessionSpaceRef,"ai-kit"],["harness",b?.harnessRef,"ai-kit"],["model",b?.modelRef,"actuation"],["provider",b?.providerRef,"actuation"],["route",b?.routeRef,"actuation"],["workcell",b?.workcellRef,"workcell"],["material-world",b?.materialWorldRef,"workcell"],["now",d?.placement?.nowRef,"central"],["authority",d?.placement?.authorityRef,"actuation"]] as const)reference(ar,ref,role,owner);
    for(const ref of d?.contextRefs??[])reference(ar,ref,"context","ai-kit");
    const observations=[...(a.dispatch?[a.dispatch]:[]),...(a.observations??[])];
    for(const receipt of observations){
      const or=reference(ar,receipt.receiptRef,`owner-${receipt.phase}`,receipt.ownerRef,receipt.sourceRevision);
      if(or){reference(or,receipt.operationRef,"operation",receipt.ownerRef,receipt.sourceRevision);for(const ref of receipt.evidenceRefs??[])reference(or,ref,"evidence",receipt.ownerRef);for(const ref of receipt.partialEffectRefs??[])reference(or,ref,"partial-effect",receipt.ownerRef);}
    }
    for(const fact of a.tracking??[]){const fr=reference(ar,fact.factRef,`tracking-${fact.kind}`,fact.ownerRef,fact.sourceRevision);if(fr){reference(fr,fact.subjectRef,"tracked-subject",fact.ownerRef,fact.sourceRevision);for(const ref of fact.evidenceRefs??[])reference(fr,ref,"evidence",fact.ownerRef);}}
    for(const v of a.verifications??[]){const vr=reference(ar,v.verificationRef,`verification-${v.outcome}`,v.ownerRef,v.sourceRevision);if(vr)for(const ref of v.evidenceRefs??[])reference(vr,ref,"evidence",v.ownerRef);}
    for(const ref of a.failureEvidenceRefs??[])reference(ar,ref,"failure-evidence","software-factory");
    for(const resolution of a.reresolutions??[]){const re=reference(ar,resolution.resolutionRef,"reresolution","software-factory",resolution.sourceRevision);if(re)for(const ref of resolution.evidenceRefs??[])reference(re,ref,"evidence","software-factory");}
    const ret=a.readableReturn;
    if(ret){
      const re=add("return",a.attemptRef,ret.summary,subject(ret.returnRef));returns.push(re);link(ar,re,"factory.correlation/return",`return-${nextLink++}`);
      for(const ref of ret.artifactRefs??[])reference(re,ref,"artifact","software-factory");
      for(const ref of ret.evidenceRefs??[])reference(re,ref,"evidence","software-factory");
      reference(re,ret.receivingRef,"receiving","central",ret.receivingSourceRevision);
      for(const ref of ret.archiveRefs??[])reference(re,ref,"archive","central");
      for(const ref of ret.regressionObservationRefs??[])reference(re,ref,"regression","software-factory");
    }
  }
  const scenesFor=(refs:string[],key:string,title:string)=>{for(let i=0;i<refs.length;i+=10)scenes.push({scene_ref:`${expressionRef}:scene:${key}${i===0?"":`-${i/10+1}`}`,revision:1,title:i===0?title:`${title} — continued`,entity_refs:refs.slice(i,i+10)});};
  scenesFor([root,...nodeRefs.values()],"topology-1","Run map — SSSF topology");
  scenesFor(attempts,"executions-1","Attempts — live and returned");
  scenesFor(returns,"return","Returns");
  const placed=new Set(scenes.flatMap(s=>s.entity_refs));scenesFor(Object.keys(entities).filter(ref=>!placed.has(ref)),"sources-evidence","Source and native evidence");
  return {schema:"oi.expression/v1",expression_ref:expressionRef,revision:1,title:`Run ${run.runRef}`,scenes,entities,relations,
    selection:{scene_ref:scenes[0].scene_ref,entity_ref:root},provenance:[rr(`file:${statePath}`,`run:${run.revision}`),...basis,rr(units.contract,String(unitRevisionOf(units)??"unreported"))],representations:[],refinements:[]};
}
const unitRevisionOf=(units:UnitListReading)=>units.provenance?.factoryStateRevision??units.provenance?.buildStateRevision;

/** Bounded optimistic read fence. No mutation/dispatch on open; no retry of
 * effects. Retain rejected raw readings on the error for diagnosis. */
export async function readRunExpressionSnapshot(transport:KernelTransportStatus,statePath:string,runRef:string,expressionRef:string,dev=developmentRead,att=attemptRead):Promise<RunExpressionSnapshot> {
  const readConflicts:unknown[]=[];
  for(let pass=0;pass<2;pass++){
    const run=await dev<RunReading>(transport,statePath,"run",runRef);
    let attempt:AttemptReading|undefined;let attemptError:string|undefined;
    const [units]=await Promise.all([
      dev<UnitListReading>(transport,statePath,"workflow-units",runRef),
      att<AttemptReading>(transport,statePath,runRef).then(value=>{attempt=value;}).catch((error:unknown)=>{
        const message=error instanceof Error?error.message:String(error);
        // The current owner returns this specific absence, not a typed
        // not-found envelope. Do not convert denied/transport errors to empty.
        if(!message.includes("no native attempt field"))throw error;
        attemptError=message;
      }),
    ]);
    const inputs={run,attempt,units,statePath};
    if(!attempt&&!attemptError)fail("factory.expression.incompatible","Attempt handler returned no reading or explicit native absence",inputs);
    const after=await dev<RunReading>(transport,statePath,"run",runRef);
    try{
      validateRunExpressionInputs(inputs,runRef);
      validateRunExpressionInputs({run:after,attempt,units,statePath},runRef);
      if(JSON.stringify(run)!==JSON.stringify(after))fail("factory.expression.stale","Run changed while its related readings were in flight",{...inputs,after});
      return {...inputs,document:composeRunExpression(inputs,expressionRef),attemptAvailability:attempt?"available":"missing",...(attemptError?{attemptError}:{}),...(readConflicts.length?{readConflicts}:{})};
    }catch(error){if(error instanceof RunExpressionReadError&&error.code==="factory.expression.stale"){readConflicts.push(error.readings);if(pass===0)continue;throw new RunExpressionReadError(error.code,error.message,readConflicts);}throw error;}
  }
  throw new Error("Unreachable read fence");
}
export async function readAndComposeRunExpression(transport:unknown,statePath:string,runRef:string,expressionRef:string,dev?:typeof developmentRead,att?:typeof attemptRead):Promise<ExpressionDocument> {
  return (await readRunExpressionSnapshot(transport as KernelTransportStatus,statePath,runRef,expressionRef,dev,att)).document;
}
