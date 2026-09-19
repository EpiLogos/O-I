import {useEffect,useRef,useState} from "react";
import {useExpressionStage,type StagePresentation} from "../stage/ExpressionStage";
import {expressionConfig} from "./engineProjection";
import {ExpressionVerso} from "./ExpressionVerso";
import {ShareProjection} from "../explore/ShareProjection";
import {EXPRESSION_EDITOR_ACTOR as ACTOR,exportExpressionCopy,useExpressionApplication} from "./useExpressionApplication";
import {ExpressionEntityInspector,ExpressionPedagogy,ExpressionRefinementReview,ExpressionReviewedDecisions} from "./parts";
import "./expression.css";

/** The Expression composer (Settings → Compose; the agent panel's Composition
 * plane). Its authoring state is `useExpressionApplication` and its bodies are
 * `./parts` — the same pieces the Expressions centre surface places in its
 * field-first layout. This composer keeps its own document-flow layout. */
export function ExpressionView({initialExpressionRef}:{initialExpressionRef?:string}={}){
 const stage=useExpressionStage();
 const app=useExpressionApplication(initialExpressionRef);
 const {document,list,error,setError,pending,file,setFile,result,inspect,run,edit,resolveFile,selected,sceneEntities}=app;
 const [title,setTitle]=useState("Untitled Expression");
 const [filePath,setFilePath]=useState("");
 const [presenting,setPresenting]=useState(false);const presentation=useRef<StagePresentation|null>(null);const stageHost=useRef<HTMLDivElement|null>(null);
 // ES2 front/verso: two presentations over ONE Expression identity. The flip
 // never releases, remints or re-opens the stage presentation — the front's
 // contained renderer suspends through the stage's own viewport law while the
 // verso reads, and returns to the same canvas, scene and selection.
 const [face,setFace]=useState<"front"|"verso">("front");
 useEffect(()=>{if(!presenting)setFace("front");},[presenting]);
 // Share / Project remains separate from Save, Export and Present.
 const [sharing,setSharing]=useState(false);
 useEffect(()=>{
  if(!presenting||!document)return;
  try{
   const config=expressionConfig(document);
   if(!presentation.current)presentation.current=stage.present({id:"expression-application",plane:"overlay",recipe:"",config,appearance:"host",sceneRef:document.selection.scene_ref});
   if(!presentation.current)throw new Error(stage.error??"Expression stage is off, occupied, or unavailable");
   presentation.current.setContainer(stageHost.current);
   presentation.current.updateConfig(config,document.selection.scene_ref,document.selection.entity_ref?[document.selection.entity_ref]:[]);
  }catch(e){setError(String(e));setPresenting(false);}
 },[presenting,document,stage]);
 useEffect(()=>{if(!presenting){presentation.current?.release();presentation.current=null;}},[presenting]);
 useEffect(()=>()=>{presentation.current?.release();},[]);
 return <section className="expression-editor" aria-label="Expression composition" data-expression-ref={document?.expression_ref} data-presenting={presenting} data-face={face}>
  {/* Head: what this composition is (title, revision, file identity) and the
      few primary tools — one row, no banner. The field itself is the body. */}
  <header className="expression-head oi-context-head">
   <div className="oi-context-head-title">
    <h3>{document?document.title:"Expressions"}</h3>
    {document?<small><span className="oi-ref">{document.expression_ref}</span> · revision {document.revision}{file?<> · <span className="oi-ref">{file.location.path??JSON.stringify(file.location)}</span></>:" · not yet a file"}</small>:<small>Compose a living field: scenes, Things and Beings, bound to native subjects.</small>}
   </div>
   {document&&<div className="oi-action-group">
    <button className="oi-action" aria-pressed={presenting} onClick={()=>setPresenting(!presenting)}>{presenting?"Close presentation":"Present on stage"}</button>
    {presenting&&<button className="oi-action expression-flip" aria-pressed={face==="verso"} onClick={()=>setFace(current=>current==="front"?"verso":"front")}>{face==="verso"?"Return to front":"Flip to verso"}</button>}
    <button className="oi-action expression-share" aria-pressed={sharing} onClick={()=>setSharing(!sharing)} title="Project this Expression for an audience: exact outward preview, omissions, audience, Projection, Open in Explore">{sharing?"Close share":"Share / Project"}</button>
   </div>}
  </header>
  {error&&<p role="alert">{error}</p>}
  {/* Identity row: open an existing Expression or begin a new one. */}
  <div className="expression-tools expression-identity">
   <label className="oi-field">Open Expression<select className="oi-input" aria-label="Open Expression" value={document?.expression_ref??""} onChange={e=>{setFile(undefined);void inspect(e.target.value).catch(error=>setError(String(error)));}}><option value="" disabled>Choose</option>{list.map(d=><option key={d.expression_ref} value={d.expression_ref}>{d.title} · r{d.revision}</option>)}</select></label>
   <label className="oi-field">New Expression title<input className="oi-input" aria-label="Expression title" value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <button className="oi-action" disabled={pending} onClick={()=>{setFile(undefined);void run({operation:"create",expression_ref:`expression:${crypto.randomUUID()}`,title,actor:ACTOR});}}>New Expression</button>
  </div>
   {document&&<>
   {/* The field: the stage artboard is the primary body while presenting;
       scenes and entities are its plane nav and its selection row. Flipping
       to the verso hides the artboard — the presentation stays mounted and
       the stage's viewport law suspends its clock until the return. */}
   <div ref={stageHost} className="expression-stage-host" aria-label="Expression artboard" hidden={!presenting||face==="verso"}/>
   {presenting&&face==="verso"&&<ExpressionVerso document={document}
     onInvokeAction={(entityRef,actionRef)=>void run({operation:"invoke",expression_ref:document.expression_ref,expected_revision:document.revision,entity_ref:entityRef,action_ref:actionRef,input:null,project:null})}
     onOpenRef={entityRef=>{void edit([{change:"focus",scene_ref:document.selection.scene_ref,entity_ref:entityRef}]);setFace("front");}}/>}
   <nav className="expression-scenes oi-plane-nav" aria-label="Expression scenes">{document.scenes.map(s=><button key={s.scene_ref} aria-pressed={s.scene_ref===document.selection.scene_ref} onClick={()=>void edit([{change:"focus",scene_ref:s.scene_ref,entity_ref:null}])}>{s.title}</button>)}<button className="oi-tool expression-add" aria-label="Add scene" title="Add scene" disabled={pending} onClick={()=>void edit([{change:"scene_create",scene_ref:`${document.expression_ref}:scene:${crypto.randomUUID()}`,title:`Scene ${document.scenes.length+1}`}])}>+</button></nav>
   <div className="expression-entities" role="group" aria-label="Expression entities">
    {sceneEntities.map(ref=>{const e=document.entities[ref];return <button key={ref} className="expression-entity" aria-pressed={selected?.entity_ref===ref} onClick={()=>void edit([{change:"focus",scene_ref:document.selection.scene_ref,entity_ref:ref}])}>{e.title}{e.subject?<span className="oi-state">{e.subject.presentation_role} · {e.subject.native_owner}</span>:null}</button>;})}
    <button className="oi-action expression-add" disabled={pending} onClick={()=>void edit([{change:"entity_add",scene_ref:document.selection.scene_ref,entity_ref:`${document.expression_ref}:entity:${crypto.randomUUID()}`,title:`Thing ${Object.keys(document.entities).length+1}`}])}>Add Thing</button>
    {sceneEntities.length===0&&<span className="oi-note">This scene holds nothing yet.</span>}
   </div>
   <ExpressionEntityInspector app={app}/>
   <ExpressionPedagogy app={app}/>
   <ExpressionRefinementReview app={app}/>
   <ExpressionReviewedDecisions app={app}/>
   {sharing&&<ShareProjection key={`${document.expression_ref}@${document.revision}`} document={document} onClose={()=>setSharing(false)}/>}
   <div className="expression-tools oi-action-group"><button className="oi-action" disabled={pending} onClick={()=>void exportExpressionCopy(app)}>Export local copy</button>
    {file&&<button className="oi-action oi-action-primary" disabled={pending} onClick={()=>void run({operation:"save",expression_ref:document.expression_ref,expected_revision:document.revision,location:file.location,expected_file_revision:file.revision,actor:ACTOR,actor_kind:"human"})}>Save Expression file</button>}
   </div>
   <details className="oi-disclosure"><summary>Subject, source and operation disclosure</summary><pre>{JSON.stringify({expression:document,last_result:result},null,2)}</pre></details>
  </>}
  <details className="expression-file oi-disclosure"><summary>Open an Expression file</summary>
   <div className="expression-tools"><label className="oi-field">Existing file relative to Central<input className="oi-input" aria-label="Expression file path" value={filePath} onChange={e=>setFilePath(e.target.value)}/></label><button className="oi-action" disabled={pending||!filePath.trim()} onClick={()=>void resolveFile(filePath).then(location=>run({operation:"open_file",location,actor:ACTOR})).catch(e=>setError(String(e)))}>Open file</button></div>
  </details>
 </section>;
}

