/** Identity-only native Factory selection on the existing object-page registry.
 * Dock, restore and Pop out re-read the same source/Run/Expression/Scene/entity.
 * This consumer never starts another Factory producer or grants an action. */
import {useEffect,useRef,useState,type ReactNode} from "react";
import {registerObjectKind,openObject,type ObjectRef,type ObjectNavigation} from "../../../agent/objects/registry";
import {useKernel} from "../../../kernel/KernelProvider";
import type {KernelTransportStatus} from "../../../kernel/types";
import type {RunEntry} from "../desk/deskStore";
import type {RunPageHost} from "../desk/RunPage";
import {cardKey,deskCard,attemptsForRun,nativeAttemptsFor} from "../desk/runModel";
import {readRun,readJourney,inspectWorkflow} from "../desk/factoryReads";
import {factoryObject} from "../desk/factoryObjects";
import {useRunLive} from "../FactoryLive";
import {castOf} from "./eventMap";
import {actInspect,actList,type WorldAct} from "../../../expression/world";
import {continueActInMode} from "../../../expression/crossModeAct";
import {actRefFor,liveExpressionRefFor,type PerformedPassage} from "./producer";
import {addressAgent,communicationOf,exchangeOf,openEncounterSurface,inspectExpression,ownerActionWords,resolveLiveObject,type LiveObject} from "./liveObjects";
import "./live.css";

interface LiveSubject {statePath:string;projectRef:string;runRef:string;expressionRef:string;sceneRef:string;entityRef:string}
const parts=(identity:LiveSubject)=>[identity.statePath,identity.projectRef,identity.runRef,identity.expressionRef,identity.sceneRef,identity.entityRef];
export function liveSubjectObject(identity:LiveSubject,title:string,project?:string):ObjectRef {
 return {kind:"factory-live-subject",ref:parts(identity).map(encodeURIComponent).join("|"),title,...(project?{project}:{})};
}
function decode(object:ObjectRef):LiveSubject {
 const values=object.ref.split("|").map(decodeURIComponent);
 if(values.length!==6||values.some(value=>!value))throw Error("The selection has no complete native source and occurrence identity");
 const [statePath,projectRef,runRef,expressionRef,sceneRef,entityRef]=values;
 if(expressionRef!==liveExpressionRefFor(runRef))throw Error("The selected Expression belongs to a different Run");
 return {statePath,projectRef,runRef,expressionRef,sceneRef,entityRef};
}
interface Reading {entry:RunEntry;object:LiveObject;act?:WorldAct}
async function readSubject(transport:KernelTransportStatus,identity:LiveSubject,project?:string):Promise<Reading> {
 const {statePath,projectRef,runRef,expressionRef,sceneRef,entityRef}=identity;
 const run=await readRun(transport,statePath,runRef);
 if(run.runRef!==runRef||run.projectRef!==projectRef||(run.nativeAttempts&&run.nativeAttempts.runRef!==runRef))throw Error("Factory returned a different subject or participant basis");
 const whole=await inspectWorkflow(transport,statePath,runRef);
 if(whole.inspection.runRef&&whole.inspection.runRef!==runRef)throw Error("Factory returned another Run's work inspection");
 const journey=run.owningJourneyRefs?.[0]?await readJourney(transport,statePath,run.owningJourneyRefs[0]):undefined;
 const listed=await actList(transport,{expression_ref:expressionRef});
 if(listed.state!=="acts"||listed.store_errors.length)throw Error("The native act reading is unavailable");
 const base=actRefFor(runRef);
 const ordinal=(ref:string)=>ref===base?0:ref.startsWith(base+":")&&/^\d+$/.test(ref.slice(base.length+1))?Number(ref.slice(base.length+1)):-1;
 const latest=listed.acts.filter(act=>act.expression_ref===expressionRef&&act.subject_ref===runRef&&ordinal(act.act_ref)>=0).sort((a,b)=>ordinal(b.act_ref)-ordinal(a.act_ref))[0];
 const inspected=latest?await actInspect(transport,latest.act_ref):undefined;
 const act=inspected?.act;
 if(latest&&(!act||act.expression_ref!==expressionRef||act.subject_ref!==runRef||act.act_ref!==latest.act_ref))throw Error("The native act no longer names this undertaking");
 const document=await inspectExpression(transport,expressionRef);
 if(!document||document.expression_ref!==expressionRef)throw Error("The selected native Expression is unavailable");
 if(!document.provenance.some(source=>source.ref===`file:${statePath}`))throw Error("This Expression belongs to another Factory source");
 const scene=document.scenes.find(candidate=>candidate.scene_ref===sceneRef);
 const material=scene?.presentation?.scene as {entities?:{id:string}[]}|undefined;
 if(!scene||(!scene.entity_refs.includes(entityRef)&&!material?.entities?.some(entity=>entity.id===entityRef)))throw Error("This rendered occurrence is no longer in its selected native Scene");
 const object=resolveLiveObject({entityRef,document,sceneRef,act,performed:[],cast:castOf({runRef,attempts:run.nativeAttempts})});
 const source={statePath,projectRef,...(project?{project}:{})};
 return {entry:{run,journey,inspection:whole.inspection,inspectionPartial:whole.partial,card:deskCard(source,run,journey,whole.inspection)},object,act};
}
function LiveSubjectBody({identity,project,initial,navigation}:{identity:LiveSubject;project?:string;initial:Reading;navigation?:ObjectNavigation}) {
 const kernel=useKernel(),key=cardKey({statePath:identity.statePath,projectRef:identity.projectRef},identity.runRef),live=useRunLive(key);
 const [reading,setReading]=useState(initial),[error,setError]=useState<string>(),[refresh,setRefresh]=useState(0);
 const firstRead=useRef(true);
 useEffect(()=>{
  if(firstRead.current){firstRead.current=false;return;}
  let alive=true;
  void readSubject(kernel.transport,identity,project).then(next=>{if(alive){setReading(next);setError(undefined);}},reason=>{if(alive)setError(reason instanceof Error?reason.message:String(reason));});
  return()=>{alive=false;};
 },[kernel.transport,identity,project,live?.act?.revision,live?.performed.length,refresh]);
 if(error)return <div className="object-note" role="alert"><p>The selected subject changed or became unavailable: {error}</p><button type="button" className="oi-action" onClick={()=>setRefresh(value=>value+1)}>Read subject again</button></div>;
 const {entry}=reading;
 const attempts=attemptsForRun(entry.run,entry.inspection);
 const openConversation=async(sessionRef:string,candidate?:import("../../../encounter/AddressedComposer").AddressedCandidate)=>{
  const body=attempts.find(attempt=>attempt.body?.agentSessionRef===sessionRef)?.body;
  if(!body?.sessionSpaceRef)throw Error("This native attempt has no session-space identity to open");
  const row={ref:sessionRef,space:body.sessionSpaceRef,project:project??"",title:reading.object.label};
  if(candidate&&navigation?.onComposeAddressed)await navigation.onComposeAddressed(candidate,row);
   else {if(candidate)addressAgent(candidate.agentSession,candidate.sourceRef,candidate.text);
    if(navigation?.onOpenTask)await navigation.onOpenTask(row);else openEncounterSurface(row);}
 };
 const host:RunPageHost={
  onOpenConversation:sessionRef=>{void openConversation(sessionRef).catch(reason=>setError(String(reason)));},
  onOpenActivity:navigation?.onOpenActivity?(at=>{if(at?.sessionRef)void openConversation(at.sessionRef).then(()=>navigation.onOpenActivity?.()).catch(reason=>setError(String(reason)));else navigation.onOpenActivity?.();}):undefined,
  onOpenObject:object=>openObject(factoryObject(object,[{runKey:key,statePath:identity.statePath,runRef:identity.runRef,title:entry.card.title,project}]),{placement:"sidebar"}),
  onMessage:navigation?.onMessage,
 };
 // Live state is only a refresh signal. Actions and participants stay
 // on the freshly read native owner; an entity id is not a revision join.
 const object=reading.object;
 const performed=live&&live.act&&reading.act&&live.act.act_ref===reading.act.act_ref&&live.act.revision===reading.act.revision?live.performed:[];
 return <><button type="button" className="oi-action" onClick={()=>setRefresh(value=>value+1)}>Refresh subject</button><RunObjectActions object={object} entry={entry} runKey={key} host={host} performed={performed} currentAct={reading.act?.act_ref} onContinueAct={navigation?.onContinueAct} onAddress={(session,sourceRef,text)=>openConversation(session,{agentSession:session,sourceRef,text})}/></>;
}
registerObjectKind({kind:"factory-live-subject",label:"Selected subject",glyph:"inspect",read:async(object,{transport,navigation})=>{
 const identity=decode(object),reading=await readSubject(transport,identity,object.project);
 return {kindLabel:reading.object.kind,title:reading.object.label,fields:[{label:"Undertaking",value:reading.entry.card.title}],
  content:<LiveSubjectBody identity={identity} project={object.project} initial={reading} navigation={navigation}/>,
  raw:{identity,sourceRevision:reading.entry.run.revision,actRevision:reading.act?.revision}};
}});

function RunObjectActions({object, entry, runKey, host, performed, currentAct,onAddress,onContinueAct}: {object: LiveObject; entry: RunEntry; runKey: string; host: RunPageHost; performed: PerformedPassage[]; currentAct?: string; onAddress:(session:string,sourceRef:string,text:string)=>Promise<void>;onContinueAct?:ObjectNavigation["onContinueAct"]}) {
  const [selectedAttemptRef,setSelectedAttemptRef]=useState<string>();
  const kernel = useKernel();
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string>();
  const [confirming, setConfirming] = useState<string>();
  const attempts = attemptsForRun(entry.run, entry.inspection);
  const run = entry.run;
  // The chain's newest act (the Run's act rolls over at the passage cap).
  const actRef = currentAct ?? actRefFor(run.runRef);
  const liveRef = liveExpressionRefFor(run.runRef);
  // The Run's working constellation IS its Live Expression (who/what is
  // there); a unit that declares its own constellation (an `expression:`
  // subject) is developed there instead.
  const constellationOf = (unitRef?: string) => {
    const unit = (entry.inspection?.units ?? []).find(candidate => candidate.workflowUnitRef === unitRef) as {subjectRef?: string} | undefined;
    return unit?.subjectRef?.startsWith("expression:") ? unit.subjectRef : liveRef;
  };
  const carry = (to: "techne" | "expressions", expressionRef: string, instrumentRef?: string) => {
    const input={act_ref:actRef,to,expression_ref:expressionRef,instrument_ref:instrumentRef??run.runRef,runKey,
      summary:`${to === "techne" ? "Develop in Technè" : "Shape in Expressions"}: ${object.label}`};
    const continued=onContinueAct?onContinueAct(input):continueActInMode(kernel.transport,input);
    void continued.catch(error=>setNote(`The act could not continue: ${error instanceof Error?error.message:String(error)}`));
  };
  const crossMode = (unitRef?: string, instrumentRef?: string) => <>
    <button type="button" className="fdesk-link" onClick={() => carry("techne", constellationOf(unitRef), instrumentRef)}>Develop in Technè</button>
    <button type="button" className="fdesk-link" onClick={() => carry("expressions", liveRef, instrumentRef)}>Shape in Expressions</button>
  </>;

  let body: ReactNode = null;
  if (object.kind === "agent" && object.member) {
    const member = object.member;
    const currentAttempts = attempts.filter(attempt => attempt.currentAttempt === true
      && member.attempt_refs.includes(attempt.attemptRef) && attempt.participant?.agentRef === member.agent_ref);
    const current = currentAttempts.find(attempt => attempt.attemptRef === selectedAttemptRef)
      ?? (currentAttempts.length === 1 ? currentAttempts[0] : undefined);
    const session = current?.body?.agentSessionRef;
    const arrival = [...performed].reverse().find(passage => passage.op.basis.entry === "attempt.start" && passage.op.basis.event_ref === current?.attemptRef);
    const skills = (arrival?.op.basis.detail?.skills as string[] | undefined) ?? [];
    const capabilities = (arrival?.op.basis.detail?.capabilities as string[] | undefined) ?? [];
    const messages = communicationOf(performed, member.agent_ref);
    // Addressed turns (AIKit `send`): composed into the conversation's
    // addressed-request composer, where the sender and participation basis
    // are the person's explicit inputs; the shared draft is never touched.
    const address = (sourceRef: string, text: string) => {
      if (!session) { setNote("This agent has no conversation in this Run to address."); return; }
      void onAddress(session,sourceRef,text).then(()=>{
        setDraft("");setNote("Composed as an addressed request in the conversation — send it there.");
      },reason=>setNote(String(reason)));
    };
    body = <>
      {currentAttempts.length > 1 && <label className="flx-panel-line">Current work
        <select aria-label="Choose this agent’s current work" value={current?.attemptRef??""} onChange={event=>setSelectedAttemptRef(event.target.value||undefined)}>
          <option value="">Choose a native attempt</option>
          {currentAttempts.map(attempt=><option key={attempt.attemptRef} value={attempt.attemptRef}>{attempt.taskRef??attempt.workflowUnitRef}</option>)}
        </select>
      </label>}
      <p className="flx-panel-line">{current ? <>Working on <strong>{current.taskRef?.replace(/^.*[/:]/, "") ?? current.workflowUnitRef}</strong>{current.status ? ` · ${current.status.replace(/_/g, " ")}` : ""}</> : currentAttempts.length ? "Choose the current work whose conversation you want to open." : "No current attempt in this Run."}</p>
      {(skills.length > 0 || capabilities.length > 0) && <div className="flx-panel-block"><h5>Selected capabilities</h5><ul>
        {skills.map(skill => <li key={skill}><code>{skill}</code>{session && <button type="button" className="fdesk-link" onClick={() => address(skill, `Invoke ${skill} for ${current?.taskRef ?? "the current task"} (attempt ${current?.attemptRef ?? "none"}).`)}>Invoke</button>}</li>)}
        {capabilities.map(capability => <li key={capability}><code>{capability}</code></li>)}
      </ul></div>}
      {messages.length > 0 && <div className="flx-panel-block"><h5>Communication</h5><ul>{messages.map(passage => {
        const caption = passage.op.bindings.caption;
        return <li key={passage.key}>{caption?.kind === "text" ? caption.text : passage.op.basis.entry}</li>;
      })}</ul></div>}
      {session && <form className="flx-panel-message" onSubmit={event => { event.preventDefault(); if (draft.trim()) address(current?.attemptRef ?? member.agent_ref, draft.trim()); }}>
        <input value={draft} onChange={event => setDraft(event.target.value)} placeholder={`Message ${member.label}…`} aria-label={`Message ${member.label}`}/>
        <button type="submit" className="oi-action" disabled={!draft.trim()}>Compose</button>
      </form>}
      <div className="flx-panel-actions">
        {session && host.onOpenConversation && <button type="button" className="fdesk-link" onClick={() => host.onOpenConversation?.(session)}>Open conversation</button>}
        {session && host.onOpenActivity && <button type="button" className="fdesk-link" onClick={() => host.onOpenActivity?.({sessionRef: session})}>Open activity</button>}
        {current && <button type="button" className="fdesk-link" onClick={() => host.onOpenObject?.({kind: "attempt", runKey, attemptRef: current.attemptRef})}>Open working surface</button>}
        {current && crossMode(current.workflowUnitRef, current.attemptRef)}
        {!current && <button type="button" className="fdesk-link" onClick={() => host.onOpenObject?.({kind: "agent", ref: member.agent_ref, label: member.label})}>Open agent</button>}
      </div>
    </>;
  } else if (object.kind === "goal") {
    const native = nativeAttemptsFor(run);
    const total = native?.requiredUnits?.length;
    const returned = native?.currentReturnedUnits?.length;
    const progress = [...performed].reverse().find(passage => passage.op.operation === "act_text" && passage.op.role === "progressText");
    body = <>
      <p className="flx-panel-line">{entry.card.purpose ?? run.destination ?? entry.card.title}</p>
      <p className="flx-panel-line">{total !== undefined && returned !== undefined ? `${returned} of ${total} required units returned` : "A complete unit result is not available yet."}{progress?.op.operation === "act_text" ? ` · ${progress.op.text}` : ""}</p>
      {entry.inspectionPartial && <p className="flx-panel-note" role="status">{entry.inspectionPartial}</p>}
      <div className="flx-panel-actions">
        {host.onOpenInExpressions && <button type="button" className="fdesk-link" onClick={() => host.onOpenInExpressions?.(entry)}>Open in Expressions</button>}
        {crossMode()}
      </div>
    </>;
  } else if (object.kind === "exchange") {
    const message = exchangeOf(object, performed);
    body = <>
      <p className="flx-panel-meta" data-exchange-parties>{message?.sender ?? "?"} → {message?.recipient ?? "?"}{message?.state ? ` · ${message.state}` : ""}</p>
      <p className="flx-panel-line" data-exchange-body>{message?.body}</p>
      <p className="flx-panel-meta"><code data-exchange-ref>{message?.ref}</code></p>
    </>;
  } else {
    const subject = object.subjectRef;
    const associated = attempts.filter(candidate => candidate.attemptRef === subject
      ||candidate.return?.artifactRefs?.includes(subject??"")||candidate.workflowUnitRef===subject);
    const exact = associated.filter(candidate=>candidate.attemptRef===subject);
    const current = associated.filter(candidate=>candidate.currentAttempt===true);
    const attempt = exact.length===1?exact[0]:current.length===1?current[0]
      :object.kind==="artifact"&&associated.length===1?associated[0]:undefined;
    const actions = (run.actions ?? []).filter(action => action.currentlyApplicable && subject && action.applicableSubjectRefs?.includes(subject));
    // The Run page's owner-action flow: an explicit confirmation, then the
    // owner's request stated with its real capability ref. The desktop holds
    // no grant and never asserts one.
    const request = (action: {actionRef: string; label: string; requiredCapabilityRef?: string; authorityOwner?: string}) => {
      if (confirming !== action.actionRef) { setConfirming(action.actionRef); return; }
      setConfirming(undefined);
      const words = ownerActionWords(action, subject);
      host.onMessage?.(words);
      setNote(words);
    };
    body = <>
      {subject && <p className="flx-panel-meta"><code>{subject}</code></p>}
      {attempt?.return?.summary && <p className="flx-panel-line">{attempt.currentAttempt===false&&<strong>Historical Return · </strong>}{attempt.return.summary}</p>}
      {(attempt?.return?.evidenceRefs ?? []).length > 0 && <p className="flx-panel-meta">evidence {attempt!.return!.evidenceRefs!.length}</p>}
      <div className="flx-panel-actions">
        {subject?.startsWith("workflow-unit:") && <button type="button" className="fdesk-link" onClick={() => host.onOpenObject?.({kind: "work-unit", runKey, unitRef: subject})}>Open working surface</button>}
        {attempt && !subject?.startsWith("workflow-unit:") && <button type="button" className="fdesk-link" onClick={() => host.onOpenObject?.({kind: "attempt", runKey, attemptRef: attempt.attemptRef})}>Open attempt</button>}
        {crossMode(subject?.startsWith("workflow-unit:") ? subject : attempt?.workflowUnitRef, attempt?.attemptRef ?? subject)}
        {actions.map(action => <button key={action.actionRef} type="button" className="fdesk-link" data-confirming={confirming === action.actionRef || undefined} onClick={() => request(action)}>{confirming === action.actionRef ? `Confirm: ${action.label}` : action.label}</button>)}
      </div>
    </>;
  }
  return <section className="flx-object-actions" data-live-object={object.kind} aria-label={`${object.label} actions`}>
    {body}
    {note && <p className="flx-panel-note" role="status">{note}</p>}
  </section>;
}
