import type {ExpressionDocument,Entity,ReadingRef,Relation,Scene,SubjectBinding} from "../../expression/types";
/** Factory Run-in-Expressions (O:I #220 / Factory #195 presentation lane).
 *
 * The adapter reads the run through the owner's own CLI surfaces —
 * `factory development run`, `factory development workflow-units` and
 * `factory attempt read` — and composes one `oi.expression/v1` document
 * whose subject is the Run itself. The kernel's composition law shapes the
 * document: expression-local refs (`<expression_ref>:entity:…`), at most
 * ten entities per scene, and only presentation parameters — so the run's
 * semantic facts ride where the law carries them: titles, subject
 * bindings (native owner + reading refs) and relations. Native node kinds,
 * states, verifications and the readable Return all survive verbatim as
 * readings on their entities; every open recomposes from fresh reads, so
 * this is presentation state only, never a second run store.
 *
 * The Run's presentation is the engine-backed Expression (spec §1, §5): the
 * cast — the attempts' disposition participants, each bound to its profile's
 * expressive character (`expression.character_ref` on the Agent card) — the
 * goal as an expressive object carrying the destination text, and the work
 * objects (units and returned artifacts) head the document in a "Live" Scene
 * that the Factory Live act performs into. */
import {developmentRead,attemptRead} from "./development";
import {castOf,type CastMember} from "./live/eventMap";

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
  legs:Record<string,unknown>;
}
export interface UnitListReading {contract:string;units:{workflowUnitRef:string;key:string;locator:string}[]}
/** One cast member with the character its profile carries (absent when the
 * profile names none, or the card could not be read — never guessed). */
export interface RunCastMember extends CastMember {character_ref?:string;card_state?:"read"|"unavailable"}

const readingRef=(ref:string,revision:string,availability:ReadingRef["availability"]="available"):ReadingRef=>({ref,revision,availability});

/** The kernel allows only expression-local ref suffixes of [A-Za-z0-9-_.];
 * native refs keep their colons for the subject bindings, which are free
 * text and must stay native (`expression:`-prefixed subjects are refused). */
function localSuffix(nativeRef:string):string {
  return nativeRef.replace(/[^A-Za-z0-9-_.]/g,"-");
}

const PRESENTATION_ROLE={run:"being",node:"thing",attempt:"thing"} as const;

function runSubjectBinding(run:RunReading,statePath:string,attempt?:AttemptReading):SubjectBinding {
  return {
    subject_ref:run.runRef,
    native_owner:"software-factory",
    presentation_role:PRESENTATION_ROLE.run,
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
 * Entity per RunMap node and per attempt; relation per RunMap edge. Every
 * edge kind survives verbatim — requires, branches_to (forks), returns_to,
 * nests, converges_to, realises, supersedes — and barrier structure needs
 * no separate leg: the owner's topology projects compiled barriers as Gate
 * nodes with requires edges. Nothing is invented: every entity's subject
 * names its native ref, every fact names the reading it came from. */
export function composeRunExpression(inputs:{run:RunReading;attempt?:AttemptReading;units:UnitListReading;statePath:string;cast?:RunCastMember[]},expressionRef:string):ExpressionDocument {
  const {run,attempt,units,statePath}=inputs;
  const cast:RunCastMember[]=inputs.cast??castOf({runRef:run.runRef,attempts:attempt});
  if(!expressionRef.startsWith("expression:")) throw new Error("The expression ref must be expression-local (expression:<slug>)");
  const eRef=(suffix:string)=>`${expressionRef}:entity:${suffix}`;
  const sRef=(suffix:string)=>`${expressionRef}:scene:${suffix}`;
  const rRef=(suffix:string)=>`${expressionRef}:relation:${suffix}`;

  const entities:Record<string,Entity>={};
  const relations:Record<string,Relation>={};
  const localOf=new Map<string,string>();
  const ent=(suffix:string,title:string,subject:SubjectBinding|null):Entity=>{
    const ref=eRef(suffix);
    localOf.set(suffix,ref);
    // Every entity is born with the document (kernel law: entity revision ≤
    // document revision).
    return {entity_ref:ref,revision:1,title:title.trim()||suffix,subject,parameters:{}};
  };

  // The run itself is the bound subject: a Being, not decoration.
  entities[eRef("run")]=ent("run",run.destination||run.runRef,runSubjectBinding(run,statePath,attempt));

  // Topology: every node, exactly as the owner's map declares it. Kind and
  // state ride as readings (`factory.run-node/<kind>`), the semanticRef as
  // its own native reading; the label is the entity's face.
  for(const node of Object.values(run.runMap.nodes)){
    entities[eRef(localSuffix(node.id))]=ent(localSuffix(node.id),node.label||node.id,{
      subject_ref:`${run.runRef}#${node.id}`,
      native_owner:"software-factory",
      presentation_role:PRESENTATION_ROLE.node,
      sources:[],
      readings:[
        readingRef(`factory.run-node/${node.kind}`,node.state??"unset"),
        ...(node.semanticRef?[readingRef(node.semanticRef,"native")]:[]),
      ],
      actions:[],
    });
  }

  // Executions: one entity per attempt, its verifications as readings. A
  // run whose attempt store is not attached presents its topology only —
  // the absence of attempts is disclosed, never invented.
  for(const a of attempt?.attempts??[]){
    entities[eRef(localSuffix(a.attemptRef))]=ent(localSuffix(a.attemptRef),a.taskRef||a.attemptRef,{
      subject_ref:a.attemptRef,
      native_owner:"software-factory",
      presentation_role:PRESENTATION_ROLE.attempt,
      sources:[],
      readings:[
        ...((a.verifications??[]).length
          ?(a.verifications??[]).map(v=>readingRef(`factory.verification/${v.outcome}`,v.verificationRef))
          :[readingRef("factory.verification/unverified",a.attemptRef)]),
      ],
      actions:[],
    });
  }

  // The cast: who is present. Each participant is a Being bound to its
  // native Agent, its profile and its expressive character as readings.
  const castRefs:string[]=[];
  for(const member of cast){
    const suffix=`cast-${localSuffix(member.agent_ref)}`;
    entities[eRef(suffix)]=ent(suffix,member.label,{
      subject_ref:member.agent_ref,
      native_owner:"central",
      presentation_role:"being",
      sources:[],
      readings:[
        readingRef(`oi.expression-cast/${member.role}`,member.attempt_refs.join(" ")||"present"),
        ...(member.profile_ref?[readingRef(member.profile_ref,"profile")]:[]),
        ...(member.position_ref?[readingRef(member.position_ref,"position")]:[]),
        ...(member.character_ref?[readingRef(member.character_ref,"expressive-character")]
          :[readingRef("oi.expression-character/none",member.card_state==="unavailable"?"card-unavailable":"profile-names-none","unavailable")]),
      ],
      actions:[],
    });
    castRefs.push(eRef(suffix));
    for(const attemptRef of member.attempt_refs){
      const binding=rRef(`carries-${localSuffix(member.agent_ref)}-${localSuffix(attemptRef)}`);
      const target=localOf.get(localSuffix(attemptRef));
      if(target)relations[binding]={binding_ref:binding,relation:readingRef("factory.attempt/participant",attempt?String(attempt.revision):"0"),
        from_entity_ref:eRef(suffix),to_entity_ref:target,provenance:attempt?[readingRef(attempt.contract,String(attempt.revision))]:[]};
    }
  }
  // The goal: the Run's destination node as an expressive object with its text.
  const destination=Object.values(run.runMap.nodes).find(node=>node.kind==="destination");
  const goalRef=destination?eRef(localSuffix(destination.id)):undefined;
  if(goalRef&&run.destination)entities[goalRef]={...entities[goalRef],title:run.destination};
  // Work objects: units in the map and the artifacts actually returned.
  const workRefs=Object.values(run.runMap.nodes).filter(node=>node.kind==="work").map(node=>eRef(localSuffix(node.id)));
  for(const a of attempt?.attempts??[]){
    for(const artifactRef of a.readableReturn?.artifactRefs??[]){
      const suffix=`artifact-${localSuffix(artifactRef)}`;
      if(entities[eRef(suffix)])continue;
      entities[eRef(suffix)]=ent(suffix,artifactRef.replace(/^.*[/:]/,""),{subject_ref:artifactRef,native_owner:"software-factory",presentation_role:"thing",sources:[],
        readings:[readingRef(a.readableReturn!.returnRef,"readable-return")],actions:[]});
      workRefs.push(eRef(suffix));
    }
  }

  // Every edge kind survives verbatim as a relation between local entities.
  for(const [i,edge] of run.runMap.edges.entries()){
    const from=localOf.get(localSuffix(edge.from));
    const to=localOf.get(localSuffix(edge.to));
    if(!from||!to) throw new Error(`Run edge names a node outside the map: ${edge.from} -> ${edge.to}`);
    const binding=rRef(`edge-${i}-${edge.relation}`);
    relations[binding]={binding_ref:binding,
      relation:readingRef(`factory.run-edge/${edge.relation}`,`topology:${run.runMap.topologyRevision}`),
      from_entity_ref:from,to_entity_ref:to,
      provenance:[readingRef(run.contract,String(run.revision))]};
  }

  // Scenes: the kernel allows at most ten entities per scene, so each lane
  // chunks. The run heads the first topology scene.
  const scenes:Scene[]=[];
  // The Live Scene the act performs into: cast, goal, work objects.
  const live=[...castRefs,...(goalRef?[goalRef]:[]),...workRefs].filter((ref,i,all)=>all.indexOf(ref)===i);
  if(live.length)scenes.push({scene_ref:sRef("live"),revision:1,title:"Live — cast, goal and work",entity_refs:live.slice(0,256)});
  const topology=[eRef("run"),...Object.values(run.runMap.nodes).map(n=>eRef(localSuffix(n.id)))];
  for(let i=0;i<topology.length;i+=10){
    scenes.push({scene_ref:sRef(`topology-${i/10+1}`),revision:1,
      title:i===0?"Run map — SSSF topology":`Run map — continued (${i/10+1})`,
      entity_refs:topology.slice(i,i+10)});
  }
  if(attempt?.attempts.length){
    const executions=attempt.attempts.map(a=>eRef(localSuffix(a.attemptRef)));
    for(let i=0;i<executions.length;i+=10){
      scenes.push({scene_ref:sRef(`executions-${i/10+1}`),revision:1,
        title:i===0?"Attempts — live and returned":"Attempts — continued",
        entity_refs:executions.slice(i,i+10)});
    }
  }
  const returned=attempt?.attempts.find(a=>a.readableReturn);
  if(returned) scenes.push({scene_ref:sRef("return"),revision:1,title:"Return",
    entity_refs:[eRef(localSuffix(returned.attemptRef))]});

  return {
    schema:"oi.expression/v1",
    expression_ref:expressionRef,
    revision:1,
    title:`Run ${run.runRef}`,
    scenes,
    entities,
    relations,
    selection:{scene_ref:scenes[0].scene_ref,entity_ref:castRefs[0]??goalRef??eRef("run")},
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

/** The Run's cast with each member's expressive character, read from the
 * Agent card (`oi agent card` → `expression.character_ref`, the profile's
 * `expressive_character_ref`). A card that cannot be read leaves the member
 * without a character and says so — the Scene keeps its placeholder. */
export async function resolveRunCast(cast:CastMember[],readCard:(agentRef:string)=>Promise<unknown>):Promise<RunCastMember[]> {
  return Promise.all(cast.map(async member=>{
    try{
      // The card carries the profile's character as `character.character_ref`
      // (oi.human-agent-card/v1; `expression.character_ref` in the contract
      // draft is read too).
      const card=await readCard(member.agent_ref) as {character?:{character_ref?:unknown}|null;expression?:{character_ref?:unknown};identity?:{profile_ref?:unknown;name?:unknown}}|undefined;
      const character=card?.character?.character_ref??card?.expression?.character_ref;
      const profile=card?.identity?.profile_ref;
      const name=card?.identity?.name;
      return {...member,
        ...(typeof profile==="string"&&!member.profile_ref?{profile_ref:profile}:{}),
        ...(typeof name==="string"&&name.trim()?{label:name}:{}),
        ...(typeof character==="string"&&character?{character_ref:character}:{}),card_state:"read" as const};
    }catch{return {...member,card_state:"unavailable" as const};}
  }));
}

/** Read the three owner surfaces and compose the document in one call. */
export async function readAndComposeRunExpression(transport:unknown,statePath:string,runRef:string,expressionRef:string,developmentReadFn?:typeof developmentRead,attemptReadFn?:typeof attemptRead,readCard?:(agentRef:string)=>Promise<unknown>):Promise<ExpressionDocument> {
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
  const cast=readCard?await resolveRunCast(castOf({runRef:run.runRef,attempts:attempt}),readCard):undefined;
  return composeRunExpression({run,attempt,units,statePath,...(cast?{cast}:{})},expressionRef);
}
