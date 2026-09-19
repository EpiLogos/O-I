import type {ExpressionDocument,Entity,Parameter,ReadingRef,Relation,Scene,SubjectBinding} from "../../expression/types";
/** Factory Run-in-Expressions (O:I #220 / Factory #195 presentation lane).
 *
 * The adapter reads the run through the owner's own CLI surfaces —
 * `factory development run`, `factory development workflow-units` and
 * `factory attempt read` — and composes one `oi.expression/v1` document
 * whose subject is the Run itself. The document carries the run's SSSF
 * structure verbatim (nodes, edge kinds, barriers, attempts, verifications,
 * the readable Return) plus binding refs back to the native readings. It is
 * presentation state only: the canonical run stays in the owner's state
 * file, every open recomposes from fresh reads, and nothing here is a
 * second run store.
 */
import {developmentRead,attemptRead} from "./development";

/** The owner CLI serialises these readings camelCase; the desktop decodes
 * them as loose readings and never re-keys owner data. */
export interface RunReading {
  contract:string; runRef:string; revision:number; projectRef:string;
  lifecycle:string; destination:string;
  runMap:{runRef:string;topologyRevision:number;nodes:Record<string,{id:string;kind:string;label:string;state:string|null;semanticRef:string|null}>;edges:{from:string;to:string;relation:string}[]};
  actions?:{actionRef:string;label:string;authorityOwner:string;requiredCapabilityRef?:string;subjectKinds?:string[]}[];
  agencies?:unknown[];executions?:unknown[];evidence?:unknown[];candidates?:unknown[];humanRequests?:unknown[];
}
export interface AttemptReading {
  contract:string; runRef:string; revision:number; runRevision:number; topologyRevision:number;
  workflowKey:string; workflowSourceRef:string; workflowSourceRevision:string; workflowSourceDigest:string;
  attempts:{attemptRef:string;taskRef:string;workflowUnitRef:string;executionRef?:string|null;
    verifications:{verificationRef:string;ownerRef:string;sourceRevision?:string;outcome:"passed"|"failed"|"unknown";evidenceRefs?:string[]}[];
    observations?:unknown[];failureEvidenceRefs?:string[];
    readableReturn?:{returnRef:string;summary:string;artifactRefs?:string[];evidenceRefs?:string[];receivingRef?:string|null}|null}[];
  legs:Record<string,{delegation?:{parentJourneyRef?:string};state?:string}>;
}
export interface UnitListReading {contract:string;units:{workflowUnitRef:string;key:string;locator:string;developmentalConcern?:string;requiredDifference?:string;returnContract?:string;barriers?:{waitsFor:string[];releases?:string[]}[]}[]}

const readingRef=(ref:string,revision:string,availability:ReadingRef["availability"]="available"):ReadingRef=>({ref,revision,availability});

function param(value:string|number):Parameter{return {value,automation:null};}

function runSubjectBinding(run:RunReading,statePath:string,attempt?:AttemptReading):SubjectBinding {
  return {
    subject_ref:run.runRef,
    native_owner:"software-factory",
    presentation_role:"being",
    sources:[readingRef(`file:${statePath}`,`topology:${attempt?.topologyRevision??"unattached"}`)],
    readings:[
      readingRef(run.contract,String(run.revision)),
      ...(attempt?[readingRef(attempt.contract,String(attempt.revision))]:[]),
    ],
    actions:(run.actions??[]).map(action=>({
      action_ref:action.actionRef,
      target_ref:run.runRef,
      authority_requirement:`${action.authorityOwner}${action.requiredCapabilityRef?` ${action.requiredCapabilityRef}`:""} — the host may only carry this request; ${action.authorityOwner} retains the authority`,
    })),
  };
}

/** Compose the Run Expression document from the owner's own readings.
 * Entity per RunMap node and per attempt; relation per RunMap edge and per
 * declared barrier; scenes: Topology, Executions, Return. Nothing is
 * invented: every entity names its native node/attempt, every relation its
 * native edge/barrier. */
export function composeRunExpression(inputs:{run:RunReading;attempt?:AttemptReading;units:UnitListReading;statePath:string},expressionRef:string):ExpressionDocument {
  const {run,attempt,units,statePath}=inputs;
  const entities:Record<string,Entity>={};
  const relations:Record<string,Relation>={};
  let revision=1;
  const ent=(entity_ref:string,title:string,parameters:Record<string,Parameter>,subject:SubjectBinding|null=null):Entity=>({entity_ref,revision:revision++,title,subject,parameters});

  // The run itself is the bound subject: a Being, not decoration.
  entities[run.runRef]=ent(run.runRef,run.destination||run.runRef,{
    kind:param("run"),lifecycle:param(run.lifecycle),state_path:param(statePath),
    workflow_key:param(attempt?.workflowKey??"unattached"),
    source_digest:param(attempt?.workflowSourceDigest??"unattached"),
  },runSubjectBinding(run,statePath,attempt));

  // Topology: every node, exactly as the owner's map declares it.
  for(const node of Object.values(run.runMap.nodes)){
    entities[node.id]=ent(node.id,node.label||node.id,{
      kind:param(node.kind),node_state:param(node.state??"unset"),
      semantic_ref:param(node.semanticRef??"none"),
    });
  }
  // Every edge kind survives verbatim — requires, branches_to (forks),
  // returns_to, nests, converges_to, realises, supersedes. Flattening these
  // into motion would be the exact failure the Expression field law forbids.
  for(const [i,edge] of run.runMap.edges.entries()){
    relations[`edge-${i}-${edge.relation}`]={binding_ref:`edge-${i}-${edge.relation}`,
      relation:readingRef(`factory.run-edge/${edge.relation}`,`topology:${run.runMap.topologyRevision}`),
      from_entity_ref:edge.from,to_entity_ref:edge.to,
      provenance:[readingRef(run.contract,String(run.revision))]};
  }
  // Barriers need no separate leg: the owner's topology command projects
  // every compiled barrier as a Gate node with requires edges, so the
  // relations above already carry the gate structure exactly as Factory
  // declares it.

  // Executions: one entity per attempt with its actual verification state.
  // A run whose attempt store is not attached presents its topology only —
  // the absence of attempts is disclosed, never invented.
  for(const a of attempt?.attempts??[]){
    const outcomes=(a.verifications??[]).map(v=>v.outcome).join(",")||"unverified";
    entities[a.attemptRef]=ent(a.attemptRef,a.taskRef||a.attemptRef,{
      kind:param("attempt"),workflow_unit_ref:param(a.workflowUnitRef),
      execution_ref:param(a.executionRef??"unbound"),verification:param(outcomes),
      failure_evidence:param(String(a.failureEvidenceRefs?.length??0)),
    });
  }

  const scenes:Scene[]=[];
  scenes.push({scene_ref:"topology",revision:1,title:"Run map — SSSF topology",
    entity_refs:[run.runRef,...Object.values(run.runMap.nodes).map(n=>n.id)]});
  if(attempt?.attempts.length) scenes.push({scene_ref:"executions",revision:1,title:"Attempts — live and returned",
    entity_refs:attempt.attempts.map(a=>a.attemptRef)});
  const returned=attempt?.attempts.find(a=>a.readableReturn);
  if(returned?.readableReturn) scenes.push({scene_ref:"return",revision:1,title:"Return",
    entity_refs:[returned.attemptRef]});

  return {
    schema:"oi.expression/v1",
    expression_ref:expressionRef,
    revision:1,
    title:`Run ${run.runRef}`,
    scenes,
    entities,
    relations,
    selection:{scene_ref:"topology",entity_ref:run.runRef},
    provenance:[
      readingRef(`file:${statePath}`,`run:${run.revision}`),
      readingRef(run.contract,String(run.revision)),
      ...(attempt?[readingRef(attempt.contract,String(attempt.revision))]:[]),
      readingRef(units.contract,"1"),
    ],
    representations:[],
    refinements:[],
  };
}

/** Read the three owner surfaces and compose the document in one call. */
export async function readAndComposeRunExpression(transport:unknown,statePath:string,runRef:string,expressionRef:string,developmentReadFn?:typeof developmentRead,attemptReadFn?:typeof attemptRead):Promise<ExpressionDocument> {
  const dev=developmentReadFn??developmentRead;
  const att=attemptReadFn??attemptRead;
  const [run,attempt,units]=await Promise.all([
    dev<RunReading>(transport as never,statePath,"run",runRef),
    att<AttemptReading>(transport as never,statePath,runRef),
    dev<UnitListReading>(transport as never,statePath,"workflow-units",runRef),
  ]);
  if(run.contract!=="factory.run-reading/v1")throw new Error("Factory returned an incompatible run reading");
  if(attempt&&attempt.contract!=="factory.attempt-reading/v1")throw new Error("Factory returned an incompatible attempt reading");
  if(units.contract!=="factory.workflow-unit-list-reading/v1")throw new Error("Factory returned an incompatible workflow-unit list reading");
  return composeRunExpression({run,attempt,units,statePath},expressionRef);
}
