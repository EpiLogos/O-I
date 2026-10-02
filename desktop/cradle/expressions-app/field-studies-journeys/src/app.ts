import {nativeAxisRequest,nativeSceneAxes} from './native-field/axis';
import {installBlueprintHUD} from './blueprintHUD.js';
import {blueprintMember} from './blueprintGeometry.js';
import {installNativeField} from "./nativeField";
import {installSessionPresence} from './sessionPresence';
import {SESSION_KEY,SessionState,validateSession,writeDraft,readDraft,readDrafts,removeDraft} from './recovery';
import {foldObjectState} from './foldState';
import {imageSuiteHTML} from './imageSuite';
import {initialiseShared,effectiveScene,isShared,writeShared,toggleShared,useLocalPointer,POINTER_PATHS} from './sharedSettings';
import {initialiseSources,stateSource,stateLabel,setStateSource,transformObjectStates,useStateShape,preserveLayerStates} from './sourceState';
import {refitStepForText,refitEntityForText,refitFormationForFont,refitFormationToGlyphs,refitStepForGlyph,refitEntityForGlyph,refitStepForSource,capturedStepState,FontRef} from './stateSizing.js';
import {appendFormationState} from './formationAuthoring';
import {CUSTOM_SENTINEL,FONT_OPTIONS} from './fontCatalog.js';
import {assignmentHTML} from './automationEditor';
import {automationLeader,automationGroups,linkAutomation,removeAutomation,removeGroupTarget,offsetAutomatedTarget,resolvedAutomation} from './automationLinks';
import {monitorHTML,MonitorMode} from './automationMonitor';
import {updateToolbeltValues,liveValue} from './liveValues';
import {beltCandidates,pickerHTML} from './beltPicker';
import {PropertyTrack,sampleTrack,evaluateTracks,readTrackValue,mergeTake,expressionTiming} from './propertyTracks';
import {entityTargets} from './nativeParameters';
import {recordRecent,recentJourneys} from './recentWork';
import {installPanelResize} from './panelResize';
import {initialiseSceneSaves,sceneSaveState,saveScene,nextSceneFrom,restoreScene,savedSceneIndices,sceneParameterChanges} from './sceneWorkflow';
import {liveWorkspaceHTML} from './liveWorkspace';
import {defaultWorkspace,validateWorkspace,WORKSPACE_KEY,moveBeltEntry,syncHeldState} from './workspacePreferences';
import {physisHost,installPhysis,saveDesktopCapture,type DesktopScene} from './physis';
import {applyPalette,applyBackground,invertPalette,applyChain,applyGlyph,applyKundaliniSequence,NATIVE_LAYOUTS} from './nativeFeatures';
import {COLOR_PALETTES,hexToRgb,isLightHex} from '../../src/engine/colorPalettes';
import {CHAKRA_PROFILE_ID} from '../../src/engine/semantics/chakraProfile';
import type {SemanticBinding,SemanticColorCoupling,SemanticFieldConfig} from '../../src/engine/semantics/semanticTypes';
import {Journey,Scene,Entity,EntityLayer,TextLayer,Tool,Shape,Vec3,clone,uid,clamp,fieldStudies,oiMark,rethemeMark,sevenCentres,smallLanguage,blankJourney,blankScene,entity,pin,chakraEntities,validateJourney,AutomationLane,type MarkThemeReading} from './model.js';
import {DocumentStore,readLibrary,readLibraryDetailed,saveToLibrary,removeFromLibrary} from './store.js';
import {defaultCamera,cameraForSceneView,project,unproject,facePlane,stageScale,stageCentre,basis,Camera} from './camera.js';
import {FieldEngineAdapter,EngineFrame} from './engine.js';
import {readPath} from '../../src/engine/automation';
import {paintPaper} from './paper';
import {ProductionAdapter} from './production.js';
import {importDocuments,nativeExport,nativeChakras,checkNativeLimits} from './nativeBridge.js';
import {baseValue,NATIVE_BINDINGS,nativeBinding,automationTarget,automationTargets,bindValue,pruneAutomation,WORLD_SCALE} from './nativeParameters.js';
import {inspectorHTML,InspectorContext} from './inspector.js';
import {sourceVisual,describeAnalysis} from './sourcePreview.js';
import {DEFAULT_SOURCE_THRESHOLD} from '../../src/engine/sourceSampling';
import {PARAMETERS,parameter} from './registry.js';
import {evaluateParameters,phases,sequenceAt,focusAt,arrange,reorderFocus} from './timeline.js';
import {icon,esc} from './icons.js';
import {defaultCapture,CaptureSettings,CaptureTransition,download,slug,createOutput,paintCapture,paintNativeCapture,png,LiveRecorder,textLayout} from './capture.js';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
import {mountShell,iconButton as ib} from './shell.js';
import {RailItem,railPressed} from './rail.js';
import {featuredExpressions,startingPoints,nativeSeven,forkExpression,libraryHTML,modesHTML,compositionCover} from './expressions.js';
import {installKernelExpressions,kernelExpressionsAvailable,readTechneReading,techneConstellationRelate,listKernelExpressions,readKernelExpression,nativeExpressionRequest} from './kernelExpressions.js';
import {hostedRecovery} from './nativeRecovery.js';
import {entryGateHTML} from './entryGate.js';
import {AUTHORED_CHAKRA_STARTER,STANDING_LABEL} from './centreStanding.js';
import {installNativeWorkspace,type NativeSubject} from './nativeWorkspace.js';
import {installLensStudio,type LensId} from './lensStudio.js';
import {installResearchInstruments} from './researchInstruments.js';
import {installPalaceInstrument} from './palaceInstrument.js';
import {installNaraInstrument} from './naraInstrument.js';
import {epiMaterialContinuation,epiOpeningMaterial,createEpiWorldProduction,readEpiWorldRecord,requireEpiNativeReadback,epiTorusTargetMap,epiSceneReception,epiStationaryReception,epiAuthoredSceneSnapshot,type EpiWorldRecord} from './epiWorldProduction.js';
import {installEpiWorldEncounter} from './epiWorldEncounter.js';
import {naraInstrumentRequest} from './kernelExpressions.js';
import type {InstrumentIdentity} from '../../../src/nara/instrumentProtocol';
import type {ExpressionDocument,ExpressionResult} from '../../../src/expression/types';
import type {NativeCurrentReading} from '../../../src/nara/nativeCurrent';
import {naraFormGeometry} from './naraFormField.js';
import type {NativeM3Reading} from '../../../src/nara/nativeM3';
import {createEvidenceField,qualifyPersonalContext,type PersonalCurrentAdmission,type EvidencePresentation,type PrivateEvidenceField} from './naraEvidenceField.js';
import type {PalaceDocumentSnapshot} from '../../../src/techne/m0m5/palace/composition';
import {applyResearchMaterial,pruneResearchOccurrence,type ResearchMaterialAction} from './researchMaterial.js';
import type {ConnectionBinding} from '../../../../../packages/oi-design-system/expressions-engine/oi/expressionBindings.mjs';
import type {KernelConversion,KernelSceneBody} from './kernelDocumentBridge.js';
import {installSceneBodies} from './sceneBodies.js';
import {prepareNativeSceneBody} from './nativeSceneBody.js';
import {openScenePortal} from './scenePortal.js';
import {installActPanel} from './actPanel.js';
import {presentAdoption,followedPanels} from './nativeFollow.js';
import {applyEasing} from '../../src/engine/fieldModel';
import type {ChainEasing} from '../../src/engine/types';
/** An act passage's authored transition, in the frame: hold the current
 * image and fade it over the performed state with the passage's duration
 * and the engine's own easing curve. */
function actTransition(seconds:number,easing?:string){
 if(!(seconds>0)||engine.capabilities.kind!=='preview'){return;}
 const c=$<HTMLCanvasElement>('transition-canvas');c.width=engine.canvas.width;c.height=engine.canvas.height;c.getContext('2d')!.drawImage(engine.canvas,0,0);
 transitionBackground=scene().field.background;c.style.background=transitionBackground;c.style.opacity='1';c.hidden=false;
 transitionStart=simTime;transitionDuration=seconds;transitionSceneId=scene().id;
 transitionEasing=(['smoothstep','linear','kineticSnap','whip'] as const).includes(easing as ChainEasing)?easing as ChainEasing:'smoothstep';
 needsFrame=true;
}
import {mountSoundControls} from './soundControls.js';
let epiEncounter:ReturnType<typeof installEpiWorldEncounter>|null=null,epiWorld:EpiWorldRecord|null=null;
let epiIdentity:InstrumentIdentity|null=null,epiCurrent:NativeCurrentReading|null=null,epiReceiving=false;
let epiReleasedPersonalBasis:string|null=null,epiPersonalAdmissionGeneration=0;
let epiPersonalIntentGeneration=0,epiPersonalAdmissionIntent:number|null=null,epiNaraSelectPending=0;
function requireEpiPersonalAdmission(){
 if(epiPersonalAdmissionIntent!==null&&epiPersonalAdmissionIntent!==epiPersonalIntentGeneration)
  throw Error('The personal admission changed while your identity edit was pending.');
}
async function epiAdmissionNaraRequest(request:Parameters<typeof naraInstrumentRequest>[0]){
 requireEpiPersonalAdmission();const selecting=request.operation==='select_identity';
 if(selecting)epiNaraSelectPending++;
 try{const result=await naraInstrumentRequest(request);requireEpiPersonalAdmission();return result;}
 finally{if(selecting)epiNaraSelectPending--;}
}
let epiPersonalCurrentAdmission:PersonalCurrentAdmission|null=null;
const epiPersonalBasisKey=(record:EpiWorldRecord)=>JSON.stringify([record.world.instance_ref,record.person_ref,record.nara_ref,
 record.identity_source.source_ref,record.identity_source.revision,record.identity_input_revision,record.world.event_ref]);
let epiNativeRevision='',epiReceptionRevision=0,epiPersonalKey='',epiConstructing=false;
mountShell();installPanelResize();installKernelExpressions();
const recovery=document.createElement('section');recovery.id='engine-recovery';recovery.hidden=true;recovery.className='engine-recovery';recovery.setAttribute('role','alert');recovery.innerHTML='<h3>GPU context interrupted</h3><p>The expression is intact. Recovering recreates lost particle state, not a runtime checkpoint.</p><button class="secondary" data-action="native-recover">Recover field</button>';document.body.append(recovery);

let recentIds:string[]=[];try{const raw=JSON.parse(localStorage.getItem('oi.recent-work.v1')??'[]');if(Array.isArray(raw))recentIds=raw.filter((v):v is string=>typeof v==='string');}catch{}
function rememberWork(id:string){recentIds=recordRecent(recentIds,id);try{localStorage.setItem('oi.recent-work.v1',JSON.stringify(recentIds));}catch{}}
let workspace=defaultWorkspace(),workspaceStorageError=false;
try{const saved=localStorage.getItem(WORKSPACE_KEY);if(saved)workspace=validateWorkspace(JSON.parse(saved));}catch{workspaceStorageError=true;}
const sceneNames=new Map<string,string>();
let monitoredLane='';let monitorMode:MonitorMode='cycle';let monitorDocked=false;let assignmentTarget='',assignmentGroup='';let beltPickerOpen=false;const pendingBelt=new Set<string>();let contextKind:''|'objects'|'text'|'pointer'='';
const startsInTechne=new URLSearchParams(location.search).get('mode')==='techne';
const startsInEpi=new URLSearchParams(location.search).get('world')==='epi-logos';
const startsWithNativeReference=!!new URLSearchParams(location.search).get('expression')?.startsWith('expression:');
let sequenceOpen=!startsInTechne&&!startsInEpi;let studioSection="physics";
let customFontEdit=false;
let beltOpen=!startsInTechne&&!startsInEpi&&innerWidth>1000,studioOpen=false;
let studioDocked=false,studioSizeMemo:{width:string;height:string}|null=null;let beltWasOpen=false;
// The instrument opens on the O:I mark — the light/dark theme expression
// that matches the base O:I image (owner direction 2026-09-19). A last-opened
// library expression still restores over it, exactly as before.
// §9: Technē opens on the approved Epii entry face with no preselected Wiki
// subject; the host may then open a default Wiki over it (TechneCentre
// treats this face as replaceable). A blank placeholder is not the home.
let initial:Journey=startsInTechne?(startingPoints().find(p=>p.expression.id==='source-twelve-faces')?.expression??{...blankJourney(),name:'Wiki'}):oiMark(),startupError='';
try{if(window.__JOURNEY__)initial=validateJourney(window.__JOURNEY__);else if(!startsWithNativeReference){try{const last=localStorage.getItem('oi.field-studies.last');const saved=readLibrary().find(j=>j.id===last);if(saved)initial=saved;}catch{/* An opaque or private origin must still open cleanly. */}}}catch(err){startupError=err instanceof Error?err.message:String(err);}
function initialiseBelts(j:Journey){initialiseShared(j);initialiseSources(j);for(const s of [...j.scenes,...Object.values(j.savedScenes??{})])if(!s.toolbelt)s.toolbelt=clone(workspace.entries).map(e=>e.scope==='named'&&!s.entities.some(v=>v.id===e.entityId)?{id:e.id,key:e.key,scope:'selected' as const}:e);return j;}
const store=new DocumentStore(initialiseSceneSaves(initialiseBelts(initial)));let engine:FieldEngineAdapter;
try{engine=window.OI_ENGINE_FACTORY?window.OI_ENGINE_FACTORY($<HTMLCanvasElement>('field-canvas')):new ProductionAdapter($<HTMLCanvasElement>('field-canvas'));(window as any).OI_DEBUG_ENGINE=engine;}catch(err){$('stage').innerHTML='<p style="padding:110px 40px">The native WebGL field could not start. '+esc(err instanceof Error?err.message:err)+'</p>';throw err;}
let sceneIndex=0;let selected:string[]=[];let textId:string|null=null;let tab:InspectorContext['tab']='field';let motionTab:InspectorContext['motionTab']='sequence';let stepIndex=0;let search='';let editing=false,inspectorOpen=false,timelineOpen=false,presenting=false,shapePickerOpen=false,tool:Tool='interact';let shapeChoice:Shape='text',glyphChoice='O';let camera=defaultCamera();let placementStep=false,keepPlacing=false,pinRepeat=false;
let propertyTake:null|{sceneId:string;armed:number;start:number;elapsed:number;tracks:PropertyTrack[];lastSample:number;limit?:number}=null;let appendTake=false,trackPreview=false;const takeWindows=new Map<string,{start:number;end:number}>();
let width=innerWidth,height=innerHeight;let simTime=0,sceneElapsed=0;let fieldPaused=matchMedia('(prefers-reduced-motion: reduce)').matches,scenePlaying=false,journeyPlaying=false;let lastTime=performance.now(),lastUI=0;let toastTimeout=0,saveTimeout=0,lastLibraryWrite=0;let transitionStart=0,transitionDuration=0;let transitionBackground='#f4f2eb',transitionSceneId='';let transitionEasing:ChainEasing='linear';let autosaveErrorShown=false;let captureSettings=defaultCapture();let recordPerformanceWarned=false;let currentVideo:{blob:Blob;mime:string;url:string;source:DesktopScene;settings:CaptureSettings}|null=null;let recordingSource:DesktopScene|null=null;let recordingSettings:CaptureSettings|null=null;const recorder=new LiveRecorder();
let pointer={active:false,world:{x:0,y:0,z:0}};let drag:null|{kind:'entity'|'radius'|'camera'|'text';id:string;startX:number;startY:number;startWorld:Vec3;positions:Map<string,Vec3>;initialRadius:number;cam:Camera;layer:TextLayer|null;pan:boolean}=null;
let guidesVisible=true;let sourceUploadEntityId:{sceneId:string;entityId:string;stepId?:string;layerId?:string;append?:boolean}|null=null;let overlayDirty=true,needsFrame=true;const detailState=new Map<string,boolean>();
// The studio remembers where you were: content scroll survives close/reopen, and
// the automation transport keeps its own run state, independent of the physics clock.
let studioScroll=0,automationLoop=false;let automationPhase:'idle'|'waiting'|'running'='idle';let automationWaitDeadline=0;
// Physis hosted mode: the service's quality state throttles this studio too,
// so the level you pick is the level you feel while authoring.
let physisFpsCap=0,physisPixelRatio:null|number=null,physisParticleCap=0,physisRatioApplied=0,lastStudioRender=0;
let libraryOpen=false,librarySection:'collection'|'about'='collection',modesOpen=false,captureOpen=false;
let railKey:RailItem='interact',railExpanded=false;let cursorTool:'interact'|'select'='interact';
const featured=featuredExpressions(),starters=startingPoints();
const covers=new Map<string,string>();
const sessionExpressions=new Map<string,Journey>();
// Camera controls stay off the HUD: the field is zoomed by scroll/pinch and
// each instrument carries its own view tools. The orbit widget is not mounted.
const scene=()=>store.document.scenes[sceneIndex]??store.document.scenes[0];
const activeScene=()=>effectiveScene(store.document,journeyPlaying?store.document.savedScenes?.[scene().id]??scene():scene());
const selectedEntity=()=>scene().entities.find(e=>e.id===selected[0]);
const currentText=()=>scene().text.find(t=>t.id===textId)??scene().text[0];
function toast(message:string,duration=4200){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=window.setTimeout(()=>$('toast').hidden=true,duration);}
/** Fires the scene's chosen pointer click effect at a world position. */
function firePointerClick(p:Vec3){const s=effectiveScene(store.document,scene()),kind=s.engine.pointerClick??'pulse';if(kind==='off')return;try{engine.command?.({type:'pointer-effect',kind,strength:engine.telemetry?.()?.params?.pointerClickStrength??s.engine.pointerClickStrength??2.2,radius:(engine.telemetry?.()?.params?.pointerClickRadius??s.engine.pointerClickRadius??.45)*WORLD_SCALE,x:p.x*WORLD_SCALE,y:p.y*WORLD_SCALE,z:p.z*WORLD_SCALE});needsFrame=true;}catch(err){error(err);}}
function error(err:unknown){console.error(err);toast(err instanceof Error?err.message:String(err),6500);}
const deletedLibraryIds=new Set<string>();
const sessionPresence=installSessionPresence();
function saveSession(origin:'ordinary'|'interval'='ordinary'){if((startupRecoveryPending&&store.revision===0&&journeyNavigation===0)||awaitingNativeBoot||!sessionPresence.isVisible()){sessionPresence.recordSuppressed(origin==='interval');return;}try{const session:SessionState={version:1,journeyId:store.document.id,sceneId:scene().id,selected,stepIndex,sceneElapsed,simTime,playing:scenePlaying,scenePlaying,journeyPlaying,fieldPaused,camera:{...camera},transport:engine.transportState?.()};localStorage.setItem(SESSION_KEY,JSON.stringify(session));localStorage.setItem('oi.field-studies.last',store.document.id);sessionPresence.recordWrite(origin==='interval');}catch{}}
let draftBackupBusy=false;
async function flushDraft(){
 clearTimeout(saveTimeout);saveTimeout=0;
 if(awaitingNativeBoot){if(store.revision===0)return;awaitingNativeBoot=false;nativeWorkspace?.cancelOpen();} // Retain an actual edit; an untouched opening canvas is not recovery material.
 // Coalesce changes while a gesture or native disk write is in flight. A
 // slow owner must not accumulate full-document backups in a renderer queue.
 if(store.transactionOpen||draftBackupBusy){saveTimeout=window.setTimeout(()=>void flushDraft(),350);return;}
 saveSession();if(deletedLibraryIds.has(store.document.id))return;
 const draft=clone(store.document),backupVersion=store.revision;
 if(propertyTake&&propertyTake.elapsed>0){
  const take=propertyTake,s=draft.scenes.find(s=>s.id===take.sceneId),end=Math.min(3600,take.start+take.elapsed);
  if(s){s.propertyTracks=mergeTake(s.propertyTracks??[],take.tracks,take.start,end);s.propertyTakeRange={start:take.start,end};s.duration=Math.max(s.duration,end);}
 }
 draftBackupBusy=true;
 try{
  await writeDraft(draft);
  if(deletedLibraryIds.has(draft.id)){await removeDraft(draft.id);return;}
  sessionExpressions.set(draft.id,draft);if(store.document.id!==draft.id)return;
  autosaveErrorShown=false;
  $('save-status').textContent=store.revision!==backupVersion?'Newer edits are waiting for backup':hostedRecovery()?'Working copy backed up on this device':'Draft backed up in this browser';
  const now=Date.now();
  if(now-lastLibraryWrite>5000){lastLibraryWrite=now;try{saveToLibrary(draft);}catch{/* The acknowledged copy remains with its recovery owner. */}}
 }catch(cause){
  if(hostedRecovery()){
   $('save-status').textContent='Working copy not backed up';
   if(!autosaveErrorShown){toast(cause instanceof Error?cause.message:'Native recovery is unavailable. Keep this work open or save a file.',7000);autosaveErrorShown=true;}
   return;
  }
  try{saveToLibrary(draft);$('save-status').textContent='Draft backed up in this browser';}
  catch{$('save-status').textContent='Not saved · export a file';if(!autosaveErrorShown){toast('Browser storage is unavailable or full. Export the expression to preserve your work.',7000);autosaveErrorShown=true;}}
 }finally{draftBackupBusy=false;}
}

let sessionSaveTimeout=0;
function markSaved(){clearTimeout(sessionSaveTimeout);sessionSaveTimeout=window.setTimeout(saveSession,150);if(deletedLibraryIds.has(store.document.id)){$('save-status').textContent='Saved copy removed · use Save to keep again';return;}$('save-status').textContent=hostedRecovery()?'Backing up working copy…':'Saving in this browser…';if(!saveTimeout)saveTimeout=window.setTimeout(()=>void flushDraft(),350);}
function changed(fn:()=>void,render=true){trackPreview=false;if(journeyPlaying){journeyPlaying=false;applySceneView();}store.change(fn);awaitingNativeBoot=false;nativeWorkspace?.cancelOpen();markSaved();overlayDirty=true;needsFrame=true;if(render)renderAll();}
function sanitiseSelection(){sceneIndex=clamp(sceneIndex,0,store.document.scenes.length-1);selected=selected.filter(id=>scene().entities.some(e=>e.id===id));if(!scene().text.some(t=>t.id===textId))textId=scene().text[0]?.id??null;const e=selectedEntity();stepIndex=clamp(stepIndex,0,Math.max(0,(e?.sequence.steps.length??1)-1));}
let paperSignature='';
let hostedAppearance:'dark'|'light'|undefined;
function paintLivePaper(s:Scene){const signature=JSON.stringify([width,height,s.field.background,s.field.palette,s.engine.backgroundMode,s.field.params.grain,s.field.params.native_backgroundGlowIntensity]);if(signature===paperSignature)return;paperSignature=signature;const canvas=$<HTMLCanvasElement>('paper-canvas');canvas.width=width;canvas.height=height;paintPaper(canvas.getContext('2d')!,s,width,height);}
function theme(){const appearance=hostedAppearance??workspace.appearance,s=activeScene(),hex=s.field.background;document.documentElement.style.setProperty('--paper',hex);document.documentElement.style.setProperty('--ink',s.field.palette[0]);const vals=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));document.body.classList.toggle('night',appearance==='dark'||appearance==='scene'&&(vals[0]*.2126+vals[1]*.7152+vals[2]*.0722)<100);$('grain').style.opacity='0';paintLivePaper(s);document.body.classList.toggle('hud-contrast',appearance==='dark'&&(vals[0]*.2126+vals[1]*.7152+vals[2]*.0722)>=100||appearance==='light'&&(vals[0]*.2126+vals[1]*.7152+vals[2]*.0722)<100);document.title=`${physisHost()?'Physis · ':''}${s.name} — ${store.document.name} · O:I Expressions`;}
import './naraKeptAnswer.css';
import {worldRequest} from './worldChannel.js';
import {readKeptAnswers,verifyStoredAnswerEdition,keptAnswerCarrier,sameAnswerValue} from '../../../src/nara/nativeKeptAnswer.js';
let nativeKeptReadings:import('../../../src/nara/nativeKeptAnswer').KeptAnswerReading[]=[];
function renderText(){const s=activeScene(),binding=nativeWorkspace?.nativeView()?.bindings[s.id],view=nativeWorkspace?.nativeView();
 const reading=binding?nativeKeptReadings.find(r=>r.record.parts.some(p=>p.scene_ref===binding.scene_ref)):undefined;
 if(reading&&view){const parts=reading.record.parts.filter(p=>p.scene_ref===binding!.scene_ref),layers=new Map(s.text.map(t=>[t.id,t]));
  const group=(kind:'primary'|'source')=>parts.filter(p=>p.kind===kind).flatMap(p=>p.layer_ids).map(id=>layers.get(id)?.body??'').join('');
  const primary=group('primary'),source=group('source'),title=s.name;
  $('text-layers').innerHTML=`<article class="page-text nara-kept-answer" tabindex="0" aria-label="Attributed native answer" data-native-answer-ref="${esc(reading.record.answer_ref)}" data-native-scene-ref="${esc(binding!.scene_ref)}" style="left:4%;top:8%;width:${Math.min(width-32,textLayout(s.text[0],width,height).width)}px;max-height:${Math.max(140,height-150)}px;overflow:auto;pointer-events:auto;user-select:text;padding:16px;background:color-mix(in srgb,${s.field.background} 92%,transparent);"><div class="kicker">${reading.record.role==='epii'?'Epii':'Nara'} · historical native quotation</div><h1 style="font-size:24px">${esc(title)}</h1>${primary?`<p data-native-answer-primary style="font-size:18px;max-width:none;white-space:pre-wrap;">${esc(primary)}</p>`:''}${source?`<details ${primary?'':'open'}><summary>Source Inspect · original native answer</summary><p data-native-answer-source style="font-size:18px;max-width:none;white-space:pre-wrap;">${esc(source)}</p></details>`:''}<details><summary>Original question and source</summary><p>${esc(reading.record.question)}</p><pre style="white-space:pre-wrap;">${esc(JSON.stringify(reading.record,null,2))}</pre></details></article>`;return;
 }
 $('text-layers').innerHTML=s.text.map(t=>{const l=textLayout(t,width,height);return `<article class="page-text ${t.id===textId?'selected':''}" data-text-id="${t.id}" ${t.visible?'':'hidden'} style="left:${t.x*100}%;top:${t.y*100}%;width:${l.width}px;text-align:${t.align};"><div class="kicker">${esc(t.kicker)}</div><h1 style="font-size:${l.size}px">${esc(t.title)}${t.italic?`<em>${esc(t.italic)}</em>`:''}</h1><p${typeof t.bodySize==='number'&&Number.isFinite(t.bodySize)&&t.bodySize>=8&&t.bodySize<=72?` style="font-size:${l.body}px;max-width:none;width:100%;white-space:pre-wrap;overflow-wrap:anywhere"`:''}>${esc(t.body)}</p></article>`;}).join('');}
const previewTokens=new WeakMap<HTMLElement,number>();
/** Fills every source preview card with the normalized cutout the engine will sample. */
async function refreshSourcePreviews(host:HTMLElement){
 const s=scene(),token=(previewTokens.get(host)??0)+1;previewTokens.set(host,token);
 for(const img of Array.from(host.querySelectorAll<HTMLImageElement>('img[data-source-preview]'))){
  const id=img.dataset.sourcePreview!,e=s.entities.find(v=>v.id===id);
  const source=e?stateSource(e,Number(img.dataset.sourceStep??0)):undefined;if(!source)continue;
  const kind=source.kind==='image'?'image':'ascii' as const;
  const payload=source.kind==='image'?source.image.dataUrl??'':source.ascii.text;
  if(!payload){img.hidden=true;const note=host.querySelector<HTMLElement>(`[data-source-analysis="${id}"]`);if(note)note.textContent=source.kind==='ascii'?'Type or paste a drawing to create this state.':'Choose an image to create this state.';continue;}
  const opts=source.kind==='image'?{mode:source.image.mode,threshold:source.image.threshold,invert:source.image.invert,scale:source.image.scale}:{fontFamily:source.ascii.fontFamily,fontSize:source.ascii.fontSize,invert:source.ascii.invert};
  const note=host.querySelector<HTMLElement>(`[data-source-analysis="${id}"]`);
  try{const visual=await sourceVisual(kind,payload,opts,{paper:s.field.background,ink:s.field.palette[0]});
   if(token!==previewTokens.get(host)||!img.isConnected)continue;
   img.src=visual.previewDataUrl;if(note)note.textContent=describeAnalysis(visual.analysis,kind);
  }catch(err){if(token!==previewTokens.get(host))continue;if(note)note.textContent=err instanceof Error?err.message:'Preview failed.';}
 }
}
function renderInspector(){const content=$('inspector-content');if(!inspectorOpen){content.replaceChildren();return;}content.querySelectorAll<HTMLDetailsElement>('details[data-detail]').forEach(d=>detailState.set(d.dataset.detail!,d.open));
 const nativeSceneView=nativeWorkspace?.nativeView(),nativeSceneBinding=nativeSceneView?.bindings[scene().id];
 const ctx:InspectorContext={scene:effectiveScene(store.document,scene()),journey:store.document,selected,textId,tab,motionTab,stepIndex,preview:engine.capabilities.kind==='preview',search,customFont:customFontEdit,supported:[...engine.capabilities.parameters],pinned:workspace.entries.filter(v=>v.scope==='field').map(v=>v.key),stations:engine.stations?.(),automationLoop,fieldPaused,
  nativeBody:nativeSceneBinding?nativeSceneBinding.body:undefined,nativeTriggers:nativeSceneBinding?nativeSceneBinding.triggers:undefined,nativeSceneRef:nativeSceneBinding?.scene_ref??null,nativeSceneChoices:nativeSceneView?nativeSceneView.document.scenes.map(sc=>({scene_ref:sc.scene_ref,title:sc.title})):undefined};
 $('inspector').classList.toggle('is-motion',tab==='motion');content.innerHTML=inspectorHTML(ctx);
 mountSoundControls(content,{entity:()=>scene().entities.find(e=>e.id===selected[0]),change:fn=>changed(fn)});
 // Edits address the occurrence this Studio was rendered for, even if another
 // instrument changes the selection before the edit commits.
 if(selected[0]&&scene().entities.some(e=>e.id===selected[0]))content.dataset.entityId=selected[0];else delete content.dataset.entityId;
 content.querySelectorAll('.motion-tabs').forEach(el=>el.remove());if(studioSection==='formations')content.querySelector('[data-detail="arrange"]')?.remove();if(studioSection==='scene')content.querySelector('[data-detail="page-text"]')?.remove();if(studioSection==='automation')content.insertAdjacentHTML('beforeend',`<details class="recorded-tracks" data-detail="recorded-takes"><summary>Recorded property takes · ${(scene().propertyTracks??[]).length}</summary><p class="control-note">Recorded base settings follow expression time. Enabled LFO and ramp layers still apply.</p><button class="secondary" data-action="preview-tracks">${trackPreview?'Stop preview':'Preview from scene start'}</button>${(scene().propertyTracks??[]).map(t=>`<div>${esc(t.bind)} · ${t.points.length} keys <button data-action="delete-property-track" data-id="${esc(t.id)}" aria-label="Remove recorded ${esc(t.bind)}">×</button></div>`).join('')||'<p>Record toolbelt properties to create a take here.</p>'}</details>`);if(!search){const groups:Record<string,string[]>={physics:['physics'],pointer:['pointer'],relational:['relational'],collision:['medium','collision','pairwise'],appearance:['palette','material'],volume:['volume'],resonance:['resonance'],layout:['arrange'],text:['page-text']};const ids=groups[studioSection];if(ids&&((tab==='field')||studioSection==='layout'||studioSection==='text')){const extras=studioSection==='appearance'?Array.from(content.querySelectorAll<HTMLElement>('.material-cards,[data-control="field.params.size"],[data-control="field.params.opacity"]')):[];const nodes=[...extras,...ids.flatMap(id=>Array.from(content.querySelectorAll<HTMLElement>('[data-detail="'+id+'"]')))];if(nodes.length)content.replaceChildren(...nodes);nodes.forEach(n=>(n as HTMLDetailsElement).open=true);}}content.querySelectorAll<HTMLDetailsElement>('details[data-detail]').forEach(d=>{if(detailState.has(d.dataset.detail!))d.open=detailState.get(d.dataset.detail!)!;});content.scrollTop=studioScroll;
// The Live instrument section mounts the live producer panel itself (owner
// addendum: re-parent, never re-render via innerHTML — it owns live
// listeners), replacing the generic detail-groups content above.
if(studioSection==='native'&&nativeField)content.replaceChildren(nativeField.panel);
if(studioSection==='blueprint'&&!search)content.replaceChildren(blueprintHome);
if(studioSection==='palace'&&!search)content.replaceChildren(palaceHome);
if(studioSection==='places'&&!search)content.replaceChildren(placesHome);
if(studioSection==='canvas'&&!search)content.replaceChildren(canvasHome);
$('inspector-title').textContent=document.querySelector<HTMLElement>('[data-action="studio-section"][aria-current="page"]')?.textContent??'Studio';
 document.querySelectorAll<HTMLButtonElement>('[data-action="tab"]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.value===tab)));
 $('control-search').setAttribute('value',search);
 void refreshSourcePreviews(content);
}
function renderTimeline(){if(!timelineOpen)return;const s=scene(),timing=expressionTiming(store.document,sceneIndex,sceneElapsed);$('timeline-panel').innerHTML=`<div class="scene-strip">${store.document.scenes.map((v,i)=>`<button class="scene-image ${i===sceneIndex?'active':''}" data-action="choose-scene" data-index="${i}" aria-label="Open scene ${i+1}: ${esc(v.name)}" title="${esc(v.name)} · ${sceneSaveState(store.document,v)}"><img src="${compositionCover(v)}" alt="${esc(v.name)}"><small>${i+1}</small><span class="scene-save-dot" data-status="${sceneSaveState(store.document,v)}"></span></button>`).join('')}<button class="scene-image scene-add" data-action="save-next" aria-label="Save and add next scene">${icon('plus')}</button></div><label class="expression-scrub"><span>Expression time</span><input id="expression-playhead" aria-label="Expression playhead" type="range" min="0" max="${timing.total}" step="0.05" value="${timing.time}"></label><div class="scene-save-row"><label>Scene name<input id="scene-save-name" value="${esc(sceneNames.get(s.id)??s.name)}" maxlength="160"></label><label>Hold · seconds<input type="number" data-bind="duration" value="${s.duration}" min="1" max="3600" step=".1"></label><label>Transition<input type="number" aria-label="Transition seconds" data-bind="transition" value="${s.transition}" min="0" max="30" step=".1"></label><button class="primary" data-action="save-scene">Save scene</button><button data-action="save-next">Save & next</button><button data-action="restore-scene" ${!store.document.savedScenes?.[s.id]?'disabled':''}>Restore</button>${ib('move-scene-left','arrowLeft','Move scene earlier',`data-index="${sceneIndex}"`)}${ib('move-scene-right','arrowRight','Move scene later',`data-index="${sceneIndex}"`)}${ib('delete-scene','trash','Delete scene',`data-index="${sceneIndex}"`)}${ib('close-timeline','chevronDown','Collapse scenes')}</div><p class="scene-caption">${sceneSaveState(store.document,s)} · ${s.propertyTracks?.length??0} recorded properties · Scrubbing evaluates settings; particle motion continues from its current state.</p>`;}
function renderShapePicker(){if(!shapePickerOpen)return;$('shape-picker').innerHTML=`<h3>Choose a form</h3><div class="shape-choices">${[['text','O','Glyph'],['ring','◯','Ring'],['disc','●','Disc'],['triangle','△','Triangle'],['square','□','Plane'],['text','&','Character']].map(([s,g,l])=>`<button data-action="choose-shape" data-value="${s}" data-glyph="${esc(g)}" class="${shapeChoice===s&&((s==='text'&&glyphChoice===g)||s!=='text')?'active':''}">${esc(g)}<small>${l}</small></button>`).join('')}</div>${shapeChoice==='text'?`<label class="control"><span>Your glyph or word</span><input id="placement-glyph" value="${esc(glyphChoice)}" maxlength="120" aria-label="Formation to place"></label>`:''}<p>Pick a point and set the form anchor. The working plane keeps your depth consistent.</p><label class="toggle-row" style="margin-top:15px;margin-bottom:0"><span>Keep placing</span><input id="keep-placing" type="checkbox" ${keepPlacing?'checked':''}><i></i></label>`;}
function setHint(){let h='';if(placementStep)h=`Place link ${stepIndex+1} on the working plane.<button data-action="cancel-placement">Cancel</button>`;else if(tool==='pin')h=`Click to place one attractor.<button data-action="repeat-pins" aria-pressed="${pinRepeat}">${pinRepeat?'✓ Keep placing':'Keep placing'}</button>`;else if(tool==='formation')h='Choose a form, then click where it belongs.';else if(tool==='text')h='Drag text blocks and adjust wording in Scene settings.';
 $('tool-hint').innerHTML=h;$('tool-hint').hidden=!h||!editing||!railExpanded;$('stage').style.cursor=tool==='select'?'default':tool==='orbit'?'grab':'crosshair';}
function saveWorkspace(){store.change(()=>{store.document.shared!.toolbelt=clone(workspace.entries);});markSaved();try{localStorage.setItem(WORKSPACE_KEY,JSON.stringify(workspace));workspaceStorageError=false;}catch{workspaceStorageError=true;}}
function liveContext():InspectorContext{return {scene:effectiveScene(store.document,scene()),journey:store.document,selected,textId,tab,motionTab,stepIndex,preview:false,search:'',supported:[...engine.capabilities.parameters],pinned:workspace.entries.filter(v=>v.scope==='field').map(v=>v.key)};}
function renderContext(){const host=$('context-panel');host.hidden=!contextKind||presenting||libraryOpen;if(!contextKind)return;const title=contextKind==='objects'?'Objects in this scene':contextKind==='text'?'Page text':'Pointer';const ctx={...liveContext(),tab:contextKind==='objects'?'objects':contextKind==='text'?'scene':'field'} as InspectorContext;const content=document.createElement('div');content.innerHTML=inspectorHTML(ctx);if(contextKind==='objects')content.querySelector('[data-detail="arrange"]')?.remove();if(contextKind==='text'||contextKind==='pointer'){const group=content.querySelector('[data-detail="'+(contextKind==='text'?'page-text':'pointer')+'"]');if(group){(group as HTMLDetailsElement).open=true;content.replaceChildren(group);}}host.innerHTML='<header><h2>'+title+'</h2><button data-action="close-context" aria-label="Close local controls">×</button></header><div class="context-content">'+content.innerHTML+'</div>';}
function renderLive(){const parts=liveWorkspaceHTML(liveContext(),workspace);const secondary=tool==='pin'||studioOpen||timelineOpen||modesOpen||captureOpen||beltPickerOpen||!!contextKind||shapePickerOpen;$('live-workspace').hidden=!sequenceOpen||secondary||presenting||libraryOpen;$('toolbelt-panel').hidden=!beltOpen||presenting||libraryOpen;$('toolbelt-button').setAttribute('aria-expanded',String(!$('toolbelt-panel').hidden));for(const [id,html] of [['live-content',parts.sequence],['belt-content',parts.controls]]){const host=$(id),scroll=host.scrollTop,openGlyphs=Array.from(host.querySelectorAll<HTMLDetailsElement>('[data-glyph-category][open]')).map(d=>d.dataset.glyphCategory),libraryExpanded=host.querySelector<HTMLDetailsElement>('.glyph-tree')?.open;host.innerHTML=html;if(libraryExpanded){const tree=host.querySelector<HTMLDetailsElement>('.glyph-tree');if(tree)tree.open=true;}host.querySelectorAll<HTMLDetailsElement>('[data-glyph-category]').forEach(d=>d.open=openGlyphs.includes(d.dataset.glyphCategory));host.scrollTop=scroll;}$('belt-picker').hidden=!beltPickerOpen||libraryOpen;if(beltPickerOpen)$('belt-picker').innerHTML=pickerHTML(scene(),workspace.entries,pendingBelt);const evaluated=engine.telemetry?.();updateToolbeltValues($('belt-content'),scene(),evaluated?.params??scene().field.params,evaluated?.config);renderContext();if(!$('context-panel').hidden)void refreshSourcePreviews($('context-panel'));if(!$('live-workspace').hidden)void refreshSourcePreviews($('live-content'));const chooser=$('automation-assignment');chooser.hidden=!assignmentTarget&&!assignmentGroup;if(!chooser.hidden)chooser.innerHTML=assignmentHTML(scene(),assignmentTarget,assignmentGroup);const monitor=$('automation-monitor');monitor.hidden=!scene().automation.length||!beltOpen||presenting||libraryOpen;document.documentElement.style.setProperty('--automation-height',monitor.hidden?'0px':'160px');if(!monitor.hidden){if(!scene().automation.some(l=>l.id===monitoredLane))monitoredLane=scene().automation[0].id;const belt=$('toolbelt-panel');if(monitorDocked){if(monitor.parentElement!==belt)belt.appendChild(monitor);monitor.classList.add('docked');}else{if(monitor.parentElement!==document.body)document.body.appendChild(monitor);monitor.classList.remove('docked');}monitor.innerHTML=monitorHTML(scene(),monitoredLane,monitorMode);}document.querySelector('.instrument')?.classList.toggle('expanded',timelineOpen);}
// Docking swaps the studio's anchor side, so a width/height transition would teleport it: invert the layout change, then play the transform back.
function flipPanel(el:HTMLElement,mutate:()=>void){el.style.transition='none';el.style.transform='';const a=el.getBoundingClientRect();mutate();const b=el.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top,sx=b.width?a.width/b.width:1,sy=b.height?a.height/b.height:1;if(!b.width||!b.height||(!dx&&!dy&&Math.abs(sx-1)<.002&&Math.abs(sy-1)<.002)){el.style.transition='';return;}const done=(ev:TransitionEvent)=>{if(ev.target!==el||ev.propertyName!=='transform')return;el.removeEventListener('transitionend',done);el.style.transition='';el.style.transformOrigin='';};el.addEventListener('transitionend',done);el.style.transformOrigin='top left';el.style.transform=`translate(${dx}px,${dy}px) scale(${sx},${sy})`;void el.offsetWidth;el.style.transition='transform .25s cubic-bezier(.2,.8,.2,1)';el.style.transform='';}
function setStudio(open:boolean){pointer.active=false;if(open)journeyPlaying=false;studioOpen=open;inspectorOpen=open;editing=open||cursorTool==='select';renderAll();}
function renderAll(){epiEncounter?.refresh();blueprintHUD?.refresh();if(studioDocked&&studioOpen&&beltOpen){beltWasOpen=true;beltOpen=false;}if(!studioDocked&&beltWasOpen){beltWasOpen=false;beltOpen=true;}if((inspectorOpen||contextKind)&&(tool==='pin'||tool==='formation')){tool=cursorTool;railExpanded=false;}if(beltPickerOpen){inspectorOpen=false;contextKind='';timelineOpen=false;shapePickerOpen=false;modesOpen=false;captureOpen=false;}else if(inspectorOpen){contextKind='';timelineOpen=false;shapePickerOpen=false;modesOpen=false;captureOpen=false;}else if(contextKind){timelineOpen=false;shapePickerOpen=false;modesOpen=false;captureOpen=false;}else if(timelineOpen){shapePickerOpen=false;modesOpen=false;captureOpen=false;}sanitiseSelection();sceneBodies?.refresh();workspace.entries=clone(store.document.shared!.toolbelt);if(tab==='motion')studioSection=motionTab==='automation'?'automation':motionTab==='sequence'?'sequence':motionTab==='focus'?'focus':'motion';else if(tab==='objects'&&!['formations','layout'].includes(studioSection))studioSection='formations';else if(tab==='scene'&&!['scene','text'].includes(studioSection))studioSection='scene';else if(tab==='field'&&!['physics','pointer','relational','collision','appearance','volume','resonance','native','blueprint','palace','places','canvas'].includes(studioSection))studioSection='physics';studioOpen=inspectorOpen&&editing;if(railKey!=='objects'||tool!=='select')railKey=tool;if(transitionDuration&&transitionSceneId!==scene().id){transitionDuration=0;$('transition-canvas').hidden=true;}theme();document.body.classList.toggle('studio-open',studioOpen);$('inspector').classList.toggle('is-studio',studioOpen);$('inspector').classList.toggle('docked',studioDocked);const dockButton=$('dock-studio');if(dockButton){dockButton.setAttribute('aria-pressed',String(studioDocked));dockButton.title=studioDocked?'Return the studio to full size':'Dock the studio where the toolbelt sits';dockButton.innerHTML=icon(studioDocked?'expand':'collapse');}$<HTMLSelectElement>('workspace-appearance').value=workspace.appearance;document.querySelectorAll<HTMLElement>('[data-action="studio-section"]').forEach(b=>b.setAttribute('aria-current',b.dataset.value===studioSection?'page':'false'));document.body.classList.toggle('editing',editing);document.body.classList.toggle('presentation',presenting);document.body.classList.toggle('editing-text',editing&&tool==='text');
 if(!$('inspector').hidden)studioScroll=$('inspector-content').scrollTop;$('inspector').hidden=!inspectorOpen||!editing;$('tool-rail').hidden=presenting;$('view-controls').hidden=!editing||!(tool==='pin'||shapePickerOpen||placementStep)||!!contextKind||inspectorOpen;$('coordinates').hidden=presenting||libraryOpen;$('timeline-panel').hidden=!timelineOpen;$('shape-picker').hidden=!shapePickerOpen||!editing;$('present-return').hidden=!presenting;
 $('scene-number').textContent=String(sceneIndex+1).padStart(2,'0');$('scene-name').textContent=scene().name;
 $('scene-picker').setAttribute('aria-expanded',String(timelineOpen));
 $('scene-state').textContent=store.document.scenes.some(s=>s.epiWorld)?epiFileStatus():sceneSaveState(store.document,scene());
 document.querySelectorAll<HTMLButtonElement>('[data-rail]').forEach(b=>{const panel=contextKind==='pointer'?'pointer-options':contextKind||(sequenceOpen&&!studioOpen&&!timelineOpen&&!beltPickerOpen&&!modesOpen&&!captureOpen&&!shapePickerOpen&&tool!=='pin'?'formation':'');const active=railPressed(b.dataset.rail!,cursorTool,panel,tool==='pin');b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.querySelectorAll('[data-action="grid"]').forEach(b=>b.classList.toggle('active',camera.grid));document.querySelectorAll('[data-action="snap"]').forEach(b=>b.classList.toggle('active',camera.snap));document.querySelectorAll('[data-action="view-2d"]').forEach(b=>b.classList.toggle('active',camera.mode==='2d'));document.querySelectorAll('[data-action="view-3d"]').forEach(b=>b.classList.toggle('active',camera.mode==='3d'));$<HTMLSelectElement>('working-plane').value=camera.plane;$<HTMLInputElement>('working-depth').value=String(camera.depth);$('depth-axis').textContent=camera.plane==='XY'?'Z':camera.plane==='XZ'?'Y':'X';
 document.querySelectorAll<HTMLButtonElement>('[data-action="undo"]').forEach(b=>b.disabled=!store.undoStack.length);document.querySelectorAll<HTMLButtonElement>('[data-action="redo"]').forEach(b=>b.disabled=!store.redoStack.length);
 document.body.classList.toggle('library-open',libraryOpen);
 $('library-page').hidden=!libraryOpen;const researchActive=document.body.classList.contains('research-active');$('stage').inert=libraryOpen||researchActive;
 // The full object/state Studio and the toolbelt serve the selected occurrence
 // over an active research instrument; the field shows only on explicit preview.
 document.body.classList.toggle('research-studio',researchActive&&inspectorOpen&&editing);document.body.classList.toggle('research-preview',researchActive&&researchPreview);document.querySelectorAll('[data-action="research-preview"]').forEach(b=>{b.classList.toggle('active',researchPreview);b.setAttribute('aria-pressed',String(researchPreview));});
 document.querySelectorAll<HTMLElement>('.chrome,#inspector,#shape-picker').forEach(el=>el.inert=libraryOpen);
 const researchWorkspace=document.getElementById('research-workspace');if(researchWorkspace)researchWorkspace.inert=libraryOpen;
 $('modes-panel').hidden=!modesOpen||libraryOpen;$('capture-panel').hidden=!captureOpen||libraryOpen;if(captureOpen)renderImageSuite();
 document.querySelector('[data-action="modes"]')?.setAttribute('aria-expanded',String(modesOpen));
 document.querySelector('[data-action="capture-options"]')?.setAttribute('aria-expanded',String(captureOpen));
 if(libraryOpen)renderLibrary();
 renderText();renderInspector();renderLive();renderTimeline();renderShapePicker();setHint();transportUI();overlayDirty=true;needsFrame=true;
 announceHostState();
}
/** The scene's automation layers. One-shots fire on the engine runtime clock
 *  (addressed by cycle clock, so linked groups arm correctly); cycles ride the
 *  field clock. Pausing automations reuses the per-group enable law. */
function oneShotGroups(s:Scene){return automationGroups(s.automation).filter(g=>g.leader.type==='ramp'&&resolvedAutomation(s.automation,g.leader).enabled);}
/** The engine keys a lane's runtime by its cycle clock, so a fire must address that key. */
const automationFireKey=(l:AutomationLane)=>l.clockId||l.nativeId||l.id;
function automationRunning(telemetry:any=engine.telemetry?.()){const s=scene();return oneShotGroups(s).some(g=>{const lane=s.automation.find(l=>l.id===g.leader.id),v=telemetry?.live?.find((x:any)=>x.id===(lane?.nativeId??g.leader.id));return v?!v.done:false;});}
function fireAutomations(quiet=false){const s=scene(),leaders=oneShotGroups(s).map(g=>g.leader);if(!leaders.length){if(!quiet)toast('This scene has no one-shot automations yet. Choose a parameter’s wave icon, then pick “One-shot / repeating ramp”.');return;}
 for(const leader of leaders)try{engine.command?.({type:'fire-automation',id:automationFireKey(leader)});}catch{/* The engine has not rendered yet; the lanes simply stay idle until it does. */}
 needsFrame=true;automationPhase='waiting';automationWaitDeadline=performance.now()+700;
 if(fieldPaused&&!quiet)toast('Automation armed. Lift “Pause physics” in the studio to let it run.');}
/** Loop watch: once every armed one-shot has actually run to its end, arm them again —
 *  only while the field's clock runs. Lanes that never reach the engine time out to idle instead. */
function updateAutomationRuntime(telemetry:any){const running=automationRunning(telemetry);
 if(running)automationPhase='running';
 else if(automationPhase==='running'){if(automationLoop&&!fieldPaused&&oneShotGroups(scene()).length){fireAutomations(true);return;}automationPhase='idle';}
 else if(automationPhase==='waiting'&&performance.now()>automationWaitDeadline)automationPhase='idle';}
/** Scene transport: play runs this scene's playhead through its duration and fires
 *  every one-shot automation it carries; pause holds the playhead. The field's own
 *  motion — physics and morph — is never touched from here. */
function toggleScenePlay(){if(scenePlaying){scenePlaying=false;transportUI();return;}
 fieldPaused=false;
 const s=scene();if(journeyPlaying){journeyPlaying=false;applySceneView();}
 const fromTop=sceneElapsed<=.001||sceneElapsed>=s.duration-.001;
 if(sceneElapsed>=s.duration-.001)sceneElapsed=0;
 if(s.propertyTracks?.length)trackPreview=true;
 // Starting from the top plays ALL of the scene's automations; resuming mid-scene holds what has run.
 if(fromTop)fireAutomations(true);
 scenePlaying=true;needsFrame=true;transportUI();}
function transportUI(){$('property-record').setAttribute('aria-pressed',String(!!propertyTake));$('property-record').setAttribute('aria-label',propertyTake?'Stop property recording':'Record property keyframes');$('take-mode').setAttribute('aria-label','Recording mode: '+(appendTake?'next section':'replace last take'));$('take-mode').setAttribute('title',appendTake?'Next section':'Replace last take');if(!propertyTake)$('take-status').hidden=true;
 const b=$('play-button');b.innerHTML=icon(scenePlaying?'pause':'play');b.setAttribute('aria-label',scenePlaying?'Pause scene (Space)':'Play scene (Space)');b.title=scenePlaying?'Pause scene (Space) · the field keeps breathing':'Play scene (Space) · runs this scene and fires every automation it carries';
 $('journey-play').classList.toggle('active',journeyPlaying);$('journey-play').setAttribute('aria-pressed',String(journeyPlaying));$('journey-play').title=journeyPlaying?'Stop saved scenes':'Play saved scenes';$('journey-play').setAttribute('aria-label',$('journey-play').title);
 $('record-button').classList.toggle('recording',recorder.active);$('record-button').setAttribute('aria-pressed',String(recorder.active));$('record-button').title=recorder.active?'Stop recording':'Record video';$('record-button').setAttribute('aria-label',$('record-button').title);
}
function edit(open=true,newTab:InspectorContext['tab']=tab){pointer.active=false;editing=open;inspectorOpen=open;tab=newTab;studioSection=newTab==='objects'?'formations':newTab==='field'?'physics':newTab==='motion'?'sequence':'scene';railExpanded=open;
 if(open){journeyPlaying=false;cursorTool='select';if(tool==='interact')tool='select';railKey=tool;}
 else{cursorTool='interact';tool='interact';railKey='interact';shapePickerOpen=false;placementStep=false;selected=[];}renderAll();}
function toolTo(next:Tool){if(next!=='orbit'){activateRail(next);return;}tool='orbit';editing=true;renderAll();}
function activateRail(next:RailItem){
 pointer.active=false;journeyPlaying=false;
 if(next==='interact'||next==='select'){guidesVisible=next==='select';cursorTool=next;tool=next;editing=next==='select'||inspectorOpen||!!contextKind;shapePickerOpen=false;placementStep=false;railExpanded=false;renderAll();return;}
 const open=next==='text'?contextKind==='text':next==='formation'?!$('live-workspace').hidden:next==='pin'?tool==='pin':contextKind==='objects';
 contextKind='';inspectorOpen=false;beltPickerOpen=false;timelineOpen=false;modesOpen=false;captureOpen=false;shapePickerOpen=false;placementStep=false;tool=cursorTool;railExpanded=false;
 if(next==='formation')sequenceOpen=!open;
 else if(!open){editing=true;if(next==='text'){contextKind='text';textId=currentText()?.id??null;}else if(next==='pin'){tool='pin';railExpanded=true;pinRepeat=false;}else contextKind='objects';}
 renderAll();
}
function applySceneView(){const v=activeScene().view;if(v)Object.assign(camera,cameraForSceneView(v,width,height,camera));}
let sceneNavigationEpoch=0,epiDeparture:Promise<void>|null=null;
/** Scene membership cannot change beneath a retained native partition. Hold
 * and read the actual acknowledged cursor before closing this application's
 * lease; a held owner still owns its partition, and admission may be pending. */
async function leaveEpiNativeScene(){
 if(epiDeparture)return epiDeparture;
 const controller=nativeField?.controller;
 if(!epiWorld||!controller||(!controller.reading.lease&&controller.reading.status!=='opening'&&!controller.inspectTargets()))return;
 const departure=(async()=>{
  if(controller.reading.lease&&controller.reading.instrument){
   controller.hold('leaving the cosmic scene');
   await controller.influence();
   await retainEpiNativeReading(false);
   // Retention closes its lease too. Inspect that exact close outcome before
   // release() can clear the notice while changing to manual presentation.
   if(controller.reading.reason?.startsWith('native release acknowledgement unknown:'))throw Error(controller.reading.reason);
  }
  await controller.release();
  if(controller.reading.reason?.startsWith('native release acknowledgement unknown:'))throw Error(controller.reading.reason);
  const lifetime=controller.reading.lifetime;
  if(controller.reading.lease||controller.reading.domain||controller.inspectTargets()||lifetime.admission_pending||lifetime.close_pending||lifetime.operation_pending||lifetime.close_error)throw Error('The cosmic native owner has not acknowledged its complete release.');
 })();
 epiDeparture=departure;
 try{await departure;}finally{if(epiDeparture===departure)epiDeparture=null;}
}
async function setScene(index:number,automatic=false){
 const navigation=++sceneNavigationEpoch,documentId=store.document.id,instance=epiWorld?.world.instance_ref;
 if(index<0)index=store.document.scenes.length-1;if(index>=store.document.scenes.length)index=0;if(index===sceneIndex&&!automatic)return false;
 if(epiWorld){await leaveEpiNativeScene();if(navigation!==sceneNavigationEpoch||store.document.id!==documentId||epiWorld?.world.instance_ref!==instance)return false;}
 if(propertyTake)finishPropertyTake();trackPreview=false;pointer.active=false;
 if(scenePlaying&&store.document.scenes[index].transition>0&&engine.capabilities.kind==='preview'){const c=$<HTMLCanvasElement>('transition-canvas');c.width=engine.canvas.width;c.height=engine.canvas.height;c.getContext('2d')!.drawImage(engine.canvas,0,0);transitionBackground=scene().field.background;c.style.background=transitionBackground;c.style.opacity='1';c.hidden=false;transitionStart=simTime;transitionDuration=store.document.scenes[index].transition;transitionEasing='linear';transitionSceneId=store.document.scenes[index].id;}else{transitionDuration=0;$('transition-canvas').hidden=true;}

 engine?.releasePrivateSound?.();sceneIndex=index;if(!automatic)journeyPlaying=false;applySceneView();sceneElapsed=0;selected=[];textId=scene().text[0]?.id??null;saveSession();placementStep=false;shapePickerOpen=false;if(!automatic)journeyPlaying=false;
 if(epiWorld)await receiveEpiPersonal();renderAll();void researchInstruments?.refresh();return true;}
function selectEntity(id:string,multi=false){cursorTool='select';pointer.active=false;railKey='select';railExpanded=true;if(multi){selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];}else selected=[id];editing=true;inspectorOpen=false;contextKind='objects';tab='objects';studioSection='formations';tool='select';shapePickerOpen=false;journeyPlaying=false;stepIndex=0;renderAll();}
function semanticBindingFor(s:Scene,entityId:string):SemanticBinding|undefined{return s.semanticField?.bindings.find(b=>b.carriers.some(c=>c.kind==='entity'&&c.id===entityId));}
function defaultSemanticColor():SemanticColorCoupling{return{enabled:true,colorSource:'canonical',gain:1,radius:{source:'force'},falloff:'gaussian',metric:'compositionPlane',blend:'weighted',activation:'constant'};}
function ensureSemanticField(s:Scene):SemanticFieldConfig{return s.semanticField??=( {enabled:true,profile:{kind:'chakra',profileId:CHAKRA_PROFILE_ID},affinity:{method:'modalProjection',bandwidth:.14},globalColorGain:1,bindings:[]} );}
function assignSemanticNode(s:Scene,entityId:string,nodeId:string|null){
 const field=ensureSemanticField(s),existing=semanticBindingFor(s,entityId);field.bindings=field.bindings.filter(b=>!b.carriers.some(c=>c.kind==='entity'&&c.id===entityId));
 if(nodeId){field.enabled=true;field.bindings.push({id:existing?.id??uid('semantic'),semanticNodeId:nodeId,enabled:true,resonance:{gain:existing?.resonance?.gain??1},carriers:[{kind:'entity',id:entityId}],color:clone(existing?.color??defaultSemanticColor()),modulations:clone(existing?.modulations??[])});}
 if(!field.bindings.length)field.enabled=false;
}
function setSemanticBindingValue(s:Scene,entityId:string,path:string,value:unknown){
 const binding=semanticBindingFor(s,entityId);if(!binding)return;
 if(!binding.color)binding.color=defaultSemanticColor();
 const allowed=new Set(['color.enabled','color.colorSource','color.overrideColor','color.activation','color.gain','color.radius.source','color.radius.value','color.falloff','color.metric','color.blend','resonance.gain']);
 if(!allowed.has(path))throw new Error('Unsupported semantic binding edit');
 if(path.startsWith('resonance.')&&!binding.resonance)binding.resonance={gain:1};
 const keys=path.split('.');let target:any=binding;for(const key of keys.slice(0,-1))target=target[key]??(target[key]={});target[keys.at(-1)!]=value;
}
function mergeSemanticStarter(target:Scene,source:Scene){
 const incoming=clone(source.entities),idMap=new Map<string,string>();for(const e of incoming){const old=e.id,eid=uid('entity');idMap.set(old,eid);e.id=eid;e.sequence.steps.forEach(k=>k.id=uid('step'));}
 target.entities.push(...incoming);
 if(source.semanticField?.bindings.length){const field=ensureSemanticField(target);field.enabled=true;field.profile=clone(source.semanticField.profile);field.affinity=clone(source.semanticField.affinity);field.globalColorGain=source.semanticField.globalColorGain;
  for(const raw of source.semanticField.bindings){const b=clone(raw);b.id=uid('semantic');b.carriers=b.carriers.map(c=>c.kind==='entity'?{...c,id:idMap.get(c.id)??c.id}:c);field.bindings.push(b);}}
 return incoming;
}
function pathTarget(path:string):{root:any;keys:string[]} {const s=scene();if(path.startsWith('journey.'))return{root:store.document,keys:path.slice(8).split('.')};if(path.startsWith('entity.'))return{root:selectedEntity(),keys:path.slice(7).split('.')};if(path.startsWith('text.'))return{root:currentText(),keys:path.slice(5).split('.')};if(path.startsWith('step.'))return{root:selectedEntity()?.sequence.steps[stepIndex],keys:path.slice(5).split('.')};if(path.startsWith('lane.')){const lane=s.automation.find(l=>path.startsWith('lane.'+l.id+'.'));return{root:lane,keys:lane?path.slice(lane.id.length+6).split('.'):[]};}return{root:s,keys:path.split('.')};}
/** The shared font-refit path for engine.fontFamily / engine.fontWeight changes: every unlocked
 *  formation's text boxes re-derive from the new glyph metrics at constant area. Gated by the
 *  scene's auto-fit setting; locked centres keep their authored geometry. */
function refitFormationsForFont(prev:FontRef,next:FontRef){
 const s=scene();if(s.engine.autoFitSizes===false)return;
 for(const fe of s.entities)if(fe.kind==='formation'&&!fe.locked)refitFormationForFont(fe,prev,next);
}
function applyBinding(el:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement,continuous=false){
 if(el.dataset.cancelCommit)return;trackPreview=false;if(journeyPlaying){journeyPlaying=false;applySceneView();}const path=el.dataset.bind;if(!path)return;const subjectId=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId;const subject=subjectId?scene().entities.find(e=>e.id===subjectId):selectedEntity();if(subjectId&&path.startsWith('step.'))selected=[subjectId];const {root,keys}=path.startsWith('entity.')?{root:subject,keys:path.slice(7).split('.')}:path.startsWith('step.')?{root:subject?.sequence.steps[stepIndex],keys:path.slice(5).split('.')}:pathTarget(path);if(!root||keys.some(k=>['__proto__','constructor','prototype'].includes(k)))return;
 if(subject&&blueprintMember(scene(),subject.id)&&(path.startsWith('entity.position')||path.startsWith('step.position'))){toast('Use Blueprint to move the whole shape, or release it to edit individual positions.');renderInspector();return;}
 if((path.startsWith('entity.')||path.startsWith('step.'))&&subject?.locked&&path!=='entity.locked'){toast('Unlock this entity to edit it. Its sequence is still running.');renderInspector();return;}
 let target=root;for(const key of keys.slice(0,-1))target=target[key]??(target[key]={});const key=keys.at(-1)!,priorValue=target[key];
 let value:any=el instanceof HTMLInputElement&&el.type==='checkbox'?el.checked:el.value;
 if(el instanceof HTMLInputElement&&(el.type==='number'||el.type==='range')){
  value=Number(el.value);if(el.value.trim()===''||!Number.isFinite(value)){toast('Enter a finite number; the previous value is unchanged.');renderAll();return;}
  if(el.type==='range'&&el.dataset.logMin){const a=Number(el.dataset.logMin),b=Number(el.dataset.logMax);value=a*Math.pow(b/a,value);const step=Number(el.dataset.valueStep)||.0001;value=Math.round(value/step)*step;}
  else value=clamp(value,el.min!==''?Number(el.min):-1e8,el.max!==''?Number(el.max):1e8);
 }
 if(path.endsWith('.templateGeometry')||path.endsWith('.templateDimension'))value=value||undefined;
 if(path==='entity.station')value=value==='none'?null:Number(value);
 if(path==='entity.text'||path==='step.text')value=value.trim()||'O';
 if(el instanceof HTMLInputElement&&el.type==='color'&&!/^#[\da-f]{6}$/i.test(String(value)))return;
 if(path.startsWith('lane.')&&key==='syncWith'){changed(()=>linkAutomation(scene().automation,root.id,String(value)));return;}store.begin();store.touch();const fieldBinding=NATIVE_BINDINGS.find(b=>b.bind===path);const automationPath=fieldBinding?'field.'+fieldBinding.key:path.startsWith('field.params.')?'field.'+path.slice(13):path.startsWith('entity.')?entityTargets(scene()).find(t=>t.entityId===subject?.id&&t.bind===path)?.target:undefined;const evaluated=engine.telemetry?.();const previous=Number(el.dataset.liveEditValue??liveValue(scene(),path,subject?.id,evaluated?.params??scene().field.params,evaluated?.config)??el.dataset.originalValue);const shifted=!isShared(store.document,scene(),path)&&automationPath&&Number.isFinite(previous)&&offsetAutomatedTarget(scene().automation,automationPath,Number(value)-previous);if(shifted)el.dataset.liveEditValue=String(value);else if(!writeShared(store.document,scene(),path,value))target[key]=value;if(subject&&path.startsWith('entity.')&&!shifted)transformObjectStates(subject,path,priorValue,value);el.dataset.originalValue=el.value;if(path==='field.params.native_composition__orchestration__focusTintWeight'&&Number(value)>0)scene().composition.carryTint=true;
 // Text inputs commit once per editing session (change/Enter/focusout), so the pre-write value is the session-start snapshot the refit measures against.
 if((path==='step.shape'||path==='step.text')&&subject)useStateShape(subject,stepIndex);
 if(path==='step.text'&&subject){setStateSource(subject,stepIndex,undefined);if(scene().engine.autoFitSizes!==false)refitStepForText(subject,stepIndex,String(priorValue??''),value,{fontFamily:scene().engine.fontFamily,fontWeight:scene().engine.fontWeight});}
 if(path.startsWith('step.')&&subject)syncHeldState(subject,stepIndex);if(path==='step.hold')target.holdOverride=true;if(path==='step.transition')target.transitionOverride=true;
 if(path==='entity.text'&&subject&&scene().engine.autoFitSizes!==false)refitEntityForText(subject,String(priorValue??''),value,{fontFamily:scene().engine.fontFamily,fontWeight:scene().engine.fontWeight});
 if(path==='entity.text'){const e=subject;if(e&&e.sequence.steps.length===1&&!e.sequence.enabled)e.sequence.steps[0].text=value;}
 if((path==='engine.fontFamily'||path==='engine.fontWeight')&&scene().engine.autoFitSizes!==false){const next:FontRef={fontFamily:scene().engine.fontFamily,fontWeight:scene().engine.fontWeight},prev:FontRef={...next,...(path==='engine.fontFamily'?{fontFamily:String(priorValue??'')}:{fontWeight:priorValue})};refitFormationsForFont(prev,next);if(path==='engine.fontFamily')customFontEdit=false;}
 if(path==='composition.frequencyDriver'&&value!=='automation'){for(const l of scene().automation)if(l.target==='field.frequency')l.enabled=false;}
 if(continuous){store.touch();markSaved();overlayDirty=true;needsFrame=true;syncSiblings(path,Number(value),el,subject?.id);theme();}
 else{store.finish();markSaved();const numeric=el instanceof HTMLInputElement&&(el.type==='range'||el.type==='number');if(numeric){needsFrame=true;overlayDirty=true;if(path.startsWith('step.source.'))void refreshSourcePreviews($('capture-panel'));commitNumeric(el,path);}else renderAll();}
}

function editStateLayers(e:Entity,index:number,edit:()=>void){preserveLayerStates(e);e.layers=clone(e.sequence.steps[index]?.layers??e.layers??[]);edit();if(e.sequence.steps[index])e.sequence.steps[index].layers=clone(e.layers);syncHeldState(e,index);}
function modalCloseButton(){return `<button class="icon-button dialog-close" data-action="close-dialog" aria-label="Close dialog">${icon('close')}</button>`;}
/** Mirror one committed value into every other control bound to the same path. */
function syncSiblings(path:string,value:number,skip?:HTMLElement,subjectId?:string){document.querySelectorAll<HTMLInputElement>('[data-bind]').forEach(other=>{if(other.dataset.bind!==path||other===skip||other===document.activeElement)return;if(path.startsWith('entity.')||path.startsWith('step.')){const otherId=other.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId??selectedEntity()?.id;if(otherId!==subjectId)return;}if(other.type==='number'||other.type==='text')other.value=String(value);if(other.type==='range'){const a=Number(other.dataset.logMin),b=Number(other.dataset.logMax);const v=a&&b?Math.log(Number(value)/a)/Math.log(b/a):Number(value);other.value=String(v);other.style.setProperty('--fill',`${clamp((v-Number(other.min))/(Number(other.max)-Number(other.min)),0,1)*100}%`);}});}
/** Numeric commits stay in place: no panel rebuild, so focus and scroll survive. */
function commitNumeric(el:HTMLInputElement,path:string){
 const evaluated=engine.telemetry?.();const sc=scene(),params=evaluated?.params??sc.field.params;
 syncSiblings(path,Number(el.value),el);
 const host=$('context-panel').querySelector<HTMLElement>('.context-content')??$('context-panel');
 for(const panel of [$('belt-content'),$('inspector-content'),host])updateToolbeltValues(panel,sc,params,evaluated?.config);
 if(path.startsWith('text.'))renderText();
 if(path.startsWith('entity.sequence')||path.startsWith('step.hold')||path.startsWith('step.transition'))renderLive();
 theme();
}
function preset(value:string){return value==='seven-centres'?nativeSeven():value==='small-language'?smallLanguage():fieldStudies();}
function hasLegacyLibrary(){try{return !!localStorage.getItem('typographic_pointcloud_saved_states');}catch{return false;}}
function rememberCover(){try{engine.render(frameData(0));if(!engine.capture)return;const out=document.createElement('canvas');out.width=560;out.height=350;paintNativeCapture(out,engine.capture(560,350),scene(),{...captureSettings,transparent:false,includeText:true},width,height);covers.set(store.document.id,out.toDataURL('image/webp',.8));}catch{/* Gallery fallback is a static composition preview, not a substitute engine. */}}
let coverObserver:IntersectionObserver|null=null;
function renderLibrary(){coverObserver?.disconnect();const library=readLibraryDetailed(),scroll=$('library-page').scrollTop;const saved=Array.from(new Map([...library.journeys,...sessionExpressions.values()].map(j=>[j.id,j])).values());
 $('library-page').innerHTML=libraryHTML({current:store.document,saved,featured,starters,section:librarySection,errors:library.blocked?['Browser storage is unavailable here. Export an expression to keep a portable copy.']:library.errors,legacy:hasLegacyLibrary(),cover:j=>covers.get(j.id)});$('library-page').scrollTop=scroll;
 const documents=new Map([...featured,...saved,store.document,...starters.map(p=>p.expression)].map(j=>[j.id,j]));
 const paint=(image:HTMLImageElement)=>{const j=documents.get(image.dataset.previewId!);if(j){image.src=compositionCover(j.scenes[0]);image.removeAttribute('data-preview-id');}};
 const images=$('library-page').querySelectorAll<HTMLImageElement>('img[data-preview-id]');
 if(typeof IntersectionObserver==='undefined')images.forEach(paint);
 else{coverObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){paint(entry.target as HTMLImageElement);coverObserver?.unobserve(entry.target);}},{root:$('library-page'),rootMargin:'160px'});images.forEach(image=>coverObserver!.observe(image));}
}
function openLibrary(section:'collection'|'about'='collection',navigate=true){if(propertyTake)finishPropertyTake();
 if(!libraryOpen)rememberCover();
 pointer.active=false;modesOpen=false;captureOpen=false;librarySection=section;libraryOpen=true;
 if(recorder.active){recorder.stop();toast('Recording stopped before opening the library.');}
 if(navigate)try{history.pushState({oiLibrary:true},'', '#library'+(section==='about'?'/about':''));}catch{}
 renderAll();$('library-page').focus({preventScroll:true});
}
function closeLibrary(navigate=true){coverObserver?.disconnect();libraryOpen=false;pointer.active=false;lastTime=performance.now();
 if(navigate)try{history.replaceState(null,'',location.pathname+location.search);}catch{}
 renderAll();$('stage').focus({preventScroll:true});
}
window.addEventListener('popstate',()=>{if(location.hash.startsWith('#library'))openLibrary(location.hash.includes('about')?'about':'collection',false);else closeLibrary(false);});
/** Import is additive. A different version with the same ID becomes a variation. */
function collectImported(documents:Journey[]){
 const existing=new Map([...readLibrary(),...sessionExpressions.values(),store.document].map(j=>[j.id,j]));
 const content=(j:Journey)=>JSON.stringify({...j,updatedAt:''});
 for(const original of documents){let j=clone(original);const prior=existing.get(j.id);
  if(prior&&content(prior)!==content(j)){j=forkExpression(j);j.name+=' / imported';}
  sessionExpressions.set(j.id,j);existing.set(j.id,j);
  try{saveToLibrary(j);}catch{/* Retain the imported document in-session without changing its source. */}
 }
}
let nativeWorkspace:ReturnType<typeof installNativeWorkspace>|undefined;
let privateEvidenceField:PrivateEvidenceField|null=null;
// Private live presentation stays in this host closure; it is never exported,
// persisted, or substituted for the native person/occasion basis.
let privateEvidencePresentation:EvidencePresentation|null=null;
function clearPrivateEvidence(){engine?.releasePrivateSound?.();privateEvidencePresentation=null;privateEvidenceField=null;}
let privateFormReading:NativeM3Reading|null=null;
let sceneBodies:ReturnType<typeof installSceneBodies>|undefined;
let blueprintHUD:ReturnType<typeof installBlueprintHUD>|undefined;
// Studio-owned homes for instrument controls (re-parented, never re-rendered).
const blueprintHome=document.createElement('div');blueprintHome.className='blueprint-home';
const palaceHome=document.createElement('div');palaceHome.className='palace-home';
const placesHome=document.createElement('div');placesHome.className='places-home';
const canvasHome=document.createElement('div');canvasHome.className='canvas-home';
// A blank boot frame is not a new chosen work. Retain the host's native
// reference until recovery succeeds or the user explicitly opens a draft.
let awaitingNativeBoot=startsWithNativeReference;
// An untouched startup canvas is unsubmitted until qualified recovery or
// native adoption. Superseding boot alone does not author that canvas.
const startupQuery=new URLSearchParams(location.search);
let startupRecoveryPending=!window.__JOURNEY__&&!startupQuery.has('journey')&&!startupQuery.get('expression');
let researchInstruments:ReturnType<typeof installResearchInstruments>|undefined;
// A deliberate peek at the live field while a research instrument stays mounted
// and active: the engine renders only while the person is looking at it.
let researchPreview=false;
let nativeConnectionRows:Record<string,ConnectionBinding[]>={},nativeSelectedRelation:string|null=null;
let journeyNavigation=0;
async function loadJourney(j:Journey){
 nativeWorkspace?.cancelOpen();
 if(propertyTake)finishPropertyTake();
 const retainPrevious=!startupRecoveryPending||store.revision!==0||journeyNavigation!==0;
 const switchBasis=nativeWorkspace?.beginSwitch(); // Invalidate the chosen switch before its departing backup awaits.
 const generation=++journeyNavigation,version=store.revision,previous=clone(store.document);
 // A navigation may only replace the canvas after its actual departing work
 // has an acknowledged backup. A returning save never replaces newer edits.
 if(retainPrevious&&!deletedLibraryIds.has(previous.id))await writeDraft(previous);
 if(generation!==journeyNavigation||version!==store.revision||switchBasis&&nativeWorkspace?.intentGeneration()!==switchBasis.intent)throw new Error('The open request was superseded by newer work. Your current Expression was retained.');
 applyJourney(j,false,switchBasis);
 // A successful explicit open is the person's entry into the instrument.
 // Keep the gate and departing work intact if backup or navigation fails.
 closeEntryGate();
}
function applyJourney(j:Journey,native=false,switchBasis?:{generation:number;intent:number}){const preparedSwitch=native?undefined:switchBasis??nativeWorkspace?.beginSwitch();engine?.releasePrivateSound?.();journeyNavigation++;if(!native)awaitingNativeBoot=false;if(propertyTake)finishPropertyTake();trackPreview=false;rememberWork(j.id);studioOpen=false;j.scenes.forEach(checkNativeLimits);sessionExpressions.set(store.document.id,clone(store.document));sessionExpressions.set(j.id,clone(j));try{if(!deletedLibraryIds.has(store.document.id))saveToLibrary(store.document);}catch{toast('The previous expression is retained in Undo; browser storage is unavailable. Export it before closing this page.',6500);}store.replace(initialiseSceneSaves(initialiseBelts(j)));store.document.updatedAt=j.updatedAt;sceneIndex=0;selected=[];camera=defaultCamera();applySceneView();transitionDuration=0;$('transition-canvas').hidden=true;sceneElapsed=0;journeyPlaying=false;editing=false;inspectorOpen=false;timelineOpen=false;cursorTool='interact';tool='interact';railKey='interact';railExpanded=false;shapePickerOpen=false;closeDialogs();libraryOpen=false;modesOpen=false;try{history.replaceState(null,'',location.pathname+location.search);}catch{}markSaved();renderAll();if(!native)void nativeWorkspace?.changed(store.document,undefined,preparedSwitch);}
function openKeep(){captureOpen=!captureOpen;modesOpen=false;pointer.active=false;
 if(captureOpen){inspectorOpen=false;contextKind='';timelineOpen=false;beltPickerOpen=false;shapePickerOpen=false;}renderAll();}
function renderImageSuite(){readCapture();if(!selectedEntity()){const e=scene().entities.find(e=>e.kind==='formation');if(e)selected=[e.id];} $('capture-panel').innerHTML=`<header><h3>Image suite</h3>${ib('capture-options','close','Close image suite')}</header>${imageSuiteHTML(scene(),selected[0],stepIndex)}<details class="image-output"><summary>Capture output settings</summary><div class="two-col"><label class="control"><span>Output size</span><select id="capture-width"><option value="1280">1280</option><option value="1440">1440</option><option value="1920">1920</option><option value="3840">3840 · PNG</option></select></label><label class="control"><span>Frame</span><select id="capture-aspect"><option value="stage">Current stage</option><option value="16:9">16:9</option><option value="1:1">1:1</option><option value="9:16">9:16</option></select></label></div><label class="toggle-row"><span>Include page text</span><input id="capture-text" type="checkbox" ${captureSettings.includeText?'checked':''}><i></i></label><label class="toggle-row"><span>Transparent PNG</span><input id="capture-transparent" type="checkbox" ${captureSettings.transparent?'checked':''}><i></i></label><p class="control-note">Clean artwork only. Aspect changes centre-crop the current view. Silent live video requests 30 fps; 2-minute / 128 MB limit.</p></details>`;
 $<HTMLSelectElement>('capture-width').value=String(captureSettings.width);$<HTMLSelectElement>('capture-aspect').value=captureSettings.aspect;void refreshSourcePreviews($('capture-panel'));}
function readCapture(){if(!$('capture-width'))return;captureSettings.width=Number($<HTMLSelectElement>('capture-width').value);captureSettings.aspect=$<HTMLSelectElement>('capture-aspect').value as CaptureSettings['aspect'];captureSettings.includeText=$<HTMLInputElement>('capture-text').checked;captureSettings.transparent=$<HTMLInputElement>('capture-transparent').checked;}
function openAbout(){openLibrary('about');}
function closeDialogs(){document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());}
let confirmCallback:(()=>void)|null=null;
function confirmChange(title:string,body:string,callback:()=>void){confirmCallback=callback;$('confirm-dialog').innerHTML=`${modalCloseButton()}<p class="eyebrow">A DELIBERATE CHANGE</p><h2>${esc(title)}</h2><p class="intro">${esc(body)}</p><div class="confirm-row"><button class="secondary" data-action="close-dialog">Cancel</button><button class="primary" data-action="confirm">Continue</button></div>`;$<HTMLDialogElement>('confirm-dialog').showModal();}
async function exportArtifact(){let style=document.getElementById('shell-style')?.textContent,bundle=document.getElementById('app-bundle')?.textContent;
 if(!style||!bundle){const response=await fetch(new URL('./field-studies.html',location.href));if(!response.ok)throw new Error('The portable engine bundle is missing. Build the application before exporting a living artifact.');const source=new DOMParser().parseFromString(await response.text(),'text/html');style=source.getElementById('shell-style')?.textContent;bundle=source.getElementById('app-bundle')?.textContent;}
 if(!style||!bundle)throw new Error('The portable engine bundle was invalid; no incomplete artifact was exported.');
 const j=JSON.stringify(store.document).replace(/</g,'\\u003c');const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="A living, editable O:I expression."><title>${esc(store.document.name)} · O:I Expressions</title><style id="shell-style">${style}</style></head><body><div id="app"></div><script>window.__JOURNEY__=${j};window.__START_PRESENTATION__=true;<\/script><script id="app-bundle">${bundle.replace(/<\/script/gi,'<\\/script')}<\/script></body></html>`;
 download(new Blob([html],{type:'text/html'}),slug(store.document.name)+'.html');toast('A self-contained expression: open the HTML file in a browser.');}
function captureTransition():CaptureTransition|undefined{if(engine.capabilities.kind==='production')return undefined;return transitionDuration>0?{canvas:$<HTMLCanvasElement>('transition-canvas'),alpha:1-clamp((simTime-transitionStart)/Math.max(.01,transitionDuration),0,1),background:transitionBackground}:undefined;}
async function captureImage(){readCapture();engine.render(frameData(0));const out=createOutput(captureSettings,width,height);if(!engine.capture)throw new Error('This renderer does not support native-resolution capture.');const pixels=engine.capture(out.width,out.height);paintNativeCapture(out,pixels,{...scene(),field:{...scene().field,background:engine.telemetry?.()?.background??scene().field.background,palette:engine.telemetry?.()?.palette??scene().field.palette,params:{...scene().field.params,...engine.telemetry?.()?.params}}},captureSettings,width,height);const blob=await png(out),name=slug(scene().name)+'.png';if(await saveDesktopCapture(blob,name,desktopSource(),{...captureSettings,width:out.width,height:out.height}))toast('Image saved to the Physis library.');else{download(blob,name);toast(`Captured ${out.width} × ${out.height} native pixels, without resetting the field.`);}}
function startRecording(){if(recorder.active){recorder.stop();return;}recordingSource=desktopSource();readCapture();captureSettings.width=Math.min(captureSettings.width,engine.canvas.width,1920);recordingSettings={...captureSettings};recordPerformanceWarned=false;if(fieldPaused){fieldPaused=false;renderAll();}const start=()=>recorder.start(engine.canvas,scene(),captureSettings,width,height,captureTransition());if(engine.withCleanFrame)engine.withCleanFrame(start);else start();closeDialogs();captureOpen=false;renderAll();$('recording-badge').hidden=false;$('record-size').textContent=`${captureSettings.width}px · 30 fps target`;toast('Recording the clean scene. Perform, play the expression, then stop.',3300);}
recorder.onStop=(blob,mime)=>{transportUI();$('recording-badge').hidden=true;if(currentVideo)URL.revokeObjectURL(currentVideo.url);currentVideo={blob,mime,url:URL.createObjectURL(blob),source:recordingSource??desktopSource(),settings:recordingSettings??captureSettings};$('video-dialog').innerHTML=`${modalCloseButton()}<p class="eyebrow">A PERFORMANCE, KEPT</p><h2>Let it play<br><em>once more.</em></h2><video id="recording-review" preload="auto" controls playsinline style="width:100%;border-radius:8px" src="${currentVideo.url}"></video><p class="capture-footnote">${mime.split(';')[0]} · ${(blob.size/1024/1024).toFixed(1)} MB · silent live capture</p><div class="button-row"><button class="primary" data-action="save-video">${icon('download')} Save recording</button><button class="secondary" data-action="close-dialog">Return to the field</button></div>`;$<HTMLDialogElement>('video-dialog').showModal();};recorder.onError=err=>{transportUI();$('recording-badge').hidden=true;error(err);};recorder.onLimit=m=>toast(m,6500);
function addLane(target='field.dispersion',syncWith?:string){if(!target.startsWith('field.')&&!target.startsWith('entity:'))target='field.'+target;const p=automationTarget(scene(),target);if(!p||!Number.isFinite(p.value))return;editing=true;inspectorOpen=true;tab='motion';motionTab='automation';if(scene().automation.some(l=>l.target===target)){renderAll();return;}
 const newId=uid('lane');detailState.set('automation-'+(syncWith??newId),true);const span=(p.max-p.min)*.1,low=clamp(p.value-span,p.hardMin,p.hardMax),high=clamp(p.value+span,p.hardMin,p.hardMax);
 changed(()=>{scene().automation.push({id:newId,...(syncWith?{syncWith}:{}),enabled:true,target,type:'lfo',wave:'sine',min:low,max:high,rate:.08,phase:0,blend:'replace',duration:4,delay:0,loop:'once',firedAt:null});if(target==='field.frequency')scene().composition.frequencyDriver='automation';});}
function duplicateEntity(){const list=scene().entities.filter(e=>selected.includes(e.id));if(!list.length)return;changed(()=>{selected=list.map(e=>{const n=clone(e);n.id=uid('entity');n.name+=' copy';n.position.x+=.12;n.position.y-=.12;n.locked=false;n.sequence.steps.forEach(k=>k.id=uid('step'));scene().entities.push(n);return n.id;});});}
function deleteEntities(){if(selected.some(id=>blueprintMember(scene(),id))){toast('Release the blueprint before removing one of its members.');return;}const ids=selected.filter(id=>!scene().entities.find(e=>e.id===id)?.locked);if(!ids.length){toast('Unlock a selected entity before removing it.');return;}let prunedLanes=false;changed(()=>{scene().entities=scene().entities.filter(e=>!ids.includes(e.id));selected=[];prunedLanes=pruneAutomation(scene());});toast('Removed. Undo restores the configuration.'+(prunedLanes?' Its automation lanes without a remaining target were removed with it.':''));}
function reorderScene(from:number,to:number){if(to<0||to>=store.document.scenes.length)return;const currentId=scene().id;changed(()=>{const [item]=store.document.scenes.splice(from,1);store.document.scenes.splice(to,0,item);sceneIndex=store.document.scenes.findIndex(s=>s.id===currentId);});}
async function action(name:string,el:HTMLElement,event?:Event){const s=scene(),subjectId=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,e=subjectId?s.entities.find(v=>v.id===subjectId):selectedEntity();if(e&&el.closest('.live-sequence'))selected=[e.id];switch(name){
 case 'record-properties':if(propertyTake){finishPropertyTake();break;}else{const tracks=recordableTracks();if(!tracks.length){toast('Add local numeric properties to the toolbelt. Shared overrides must be made local before recording.');break;}const previous=s.propertyTakeRange??takeWindows.get(s.id),start=appendTake?(previous?.end??sceneElapsed):(previous?.start??sceneElapsed);if(start>=3600){toast('This scene has reached its one-hour duration limit.');break;}journeyPlaying=false;trackPreview=false;fieldPaused=false;propertyTake={sceneId:s.id,armed:performance.now()+2000,start,elapsed:0,tracks,lastSample:-1,limit:!appendTake&&previous?previous.end-previous.start:undefined};renderAll();}break;
 case 'take-mode':appendTake=!appendTake;renderAll();break;
 case 'delete-property-track':changed(()=>{s.propertyTracks=s.propertyTracks?.filter(t=>t.id!==el.dataset.id);});break;
 case 'preview-tracks':trackPreview=!trackPreview;sceneElapsed=0;scenePlaying=trackPreview;if(trackPreview)fieldPaused=false;renderAll();break;
 case 'studio':contextKind='';beltPickerOpen=false;timelineOpen=false;modesOpen=false;captureOpen=false;if(!studioOpen&&worldLens==='epi-logos'&&nativeField&&!instrumentOffered){instrumentOffered=true;studioSection='native';tab='field';}setStudio(!studioOpen);break;
 case 'close-studio':setStudio(false);break;
 case 'dock-studio':{const insp=$('inspector'),mutate=()=>{studioDocked=!studioDocked;if(studioDocked){studioSizeMemo={width:insp.style.getPropertyValue('--panel-width'),height:insp.style.getPropertyValue('--panel-height')};insp.style.removeProperty('--panel-width');insp.style.removeProperty('--panel-height');}else if(studioSizeMemo){if(studioSizeMemo.width)insp.style.setProperty('--panel-width',studioSizeMemo.width);else insp.style.removeProperty('--panel-width');if(studioSizeMemo.height)insp.style.setProperty('--panel-height',studioSizeMemo.height);else insp.style.removeProperty('--panel-height');}renderAll();};if(matchMedia('(prefers-reduced-motion: reduce)').matches)mutate();else flipPanel(insp,mutate);break;}
 case 'automation-play':{const s2=scene();changed(()=>{for(const g of automationGroups(s2.automation))s2.automation.find(l=>l.id===g.leader.id)!.enabled=true;});fireAutomations();break;}
 case 'automation-pause':{const s2=scene();changed(()=>{for(const g of automationGroups(s2.automation))if(resolvedAutomation(s2.automation,g.leader).enabled)s2.automation.find(l=>l.id===g.leader.id)!.enabled=false;});automationPhase='idle';renderAll();toast('Automations paused — every group holds at its base. Play restarts them.');break;}
 case 'automation-loop':automationLoop=!automationLoop;if(automationLoop&&!fieldPaused&&!automationRunning())fireAutomations(true);renderAll();break;
 case 'studio-section':studioSection=el.dataset.value!;instrumentOffered=true;tab=['formations','layout'].includes(studioSection)?'objects':['sequence','motion','focus','automation'].includes(studioSection)?'motion':['scene','text'].includes(studioSection)?'scene':'field';motionTab=studioSection==='automation'?'automation':studioSection==='motion'?'morph':studioSection==='focus'?'focus':'sequence';search='';$<HTMLInputElement>('control-search').value='';renderAll();$('inspector-content').scrollTop=0;break;
 case 'quick-guide':$<HTMLDialogElement>('guide-dialog').showModal();break;
 case 'sequence-panel':timelineOpen=false;beltPickerOpen=false;modesOpen=false;captureOpen=false;sequenceOpen=!sequenceOpen;if(sequenceOpen){inspectorOpen=false;contextKind='';}renderAll();break;
 case 'save-scene':case 'save-next':{if(propertyTake)finishPropertyTake();const name=$<HTMLInputElement>('scene-save-name').value;if(name.trim().length===0){toast('Give the scene a name first.');break;}if(el.dataset.action==='save-next'&&store.document.scenes.length>=64){toast('An expression can contain up to 64 scenes.');break;}changed(()=>{s.view={...s.view,mode:camera.mode,yaw:camera.yaw,pitch:camera.pitch,zoom:camera.zoom,panX:camera.panX/width,panY:camera.panY/height};delete s.view.nativeCamera;saveScene(store.document,s,name);sceneNames.delete(s.id);if(el.dataset.action==='save-next'){const next=nextSceneFrom(store.document,s);sceneIndex=store.document.scenes.indexOf(next);}});toast('Scene saved to your browser library'+(el.dataset.action==='save-next'?' · next draft ready.':'.'));break;}
 case 'restore-scene':sceneNames.delete(s.id);changed(()=>{restoreScene(store.document,s.id);});break;
 case 'toolbelt':if(propertyTake)finishPropertyTake();beltOpen=!beltOpen;if(beltOpen){studioOpen=false;inspectorOpen=false;}renderAll();break;
 case 'browse-controls':pendingBelt.clear();beltPickerOpen=true;inspectorOpen=false;contextKind='';timelineOpen=false;modesOpen=false;captureOpen=false;renderAll();$('belt-search').focus();break;
 case 'close-belt-picker':beltPickerOpen=false;pendingBelt.clear();renderAll();break;
 case 'confirm-belt-add':{const additions=beltCandidates(s).filter(c=>pendingBelt.has(c.id));workspace.entries.push(...additions.map(c=>({id:uid('belt'),...c.entry})));saveWorkspace();beltPickerOpen=false;pendingBelt.clear();beltOpen=true;renderAll();toast(`${additions.length} properties added to this expression’s toolbelt.`);break;}
 case 'pointer-options':tool=cursorTool;railExpanded=false;timelineOpen=false;beltPickerOpen=false;modesOpen=false;captureOpen=false;shapePickerOpen=false;contextKind=contextKind==='pointer'?'':'pointer';inspectorOpen=false;renderAll();break;
 case 'close-context':contextKind='';renderAll();break;
 case 'place-formation':contextKind='';inspectorOpen=false;studioOpen=false;captureOpen=false;timelineOpen=false;beltPickerOpen=false;modesOpen=false;placementStep=false;shapePickerOpen=true;tool='formation';editing=true;renderAll();break;
 case 'choose-sequence-entity':selected=[el.dataset.id!];stepIndex=0;renderAll();break;
 case 'pin-entity':{const subject=e??s.entities.find(v=>v.kind==='formation');if(!subject)break;const key=el.dataset.key!;if(!workspace.entries.some(v=>v.scope==='selected'&&v.key===key))workspace.entries.push({id:uid('belt'),key,scope:'selected'});saveWorkspace();renderAll();toast('Added to toolbelt · follows the selected formation.');break;}
 case 'belt-remove':workspace.entries=workspace.entries.filter(v=>v.id!==el.dataset.id);saveWorkspace();renderAll();break;
 case 'belt-up':case 'belt-down':moveBeltEntry(workspace.entries,el.dataset.id!,name==='belt-up'?-1:1);saveWorkspace();renderAll();Array.from(document.querySelectorAll<HTMLElement>('[data-belt-id]')).find(v=>v.dataset.beltId===el.dataset.id)?.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)?.focus();break;
 case 'belt-scope':{const entry=workspace.entries.find(v=>v.id===el.dataset.id),subject=e??s.entities.find(v=>v.kind==='formation');if(entry){if(entry.scope==='named'){entry.scope='selected';delete entry.entityId;delete entry.sceneId;delete entry.journeyId;}else if(subject){entry.scope='named';entry.entityId=subject.id;entry.sceneId=s.id;entry.journeyId=store.document.id;}saveWorkspace();renderAll();}break;}
 case 'import-favourites':for(const key of s.favourites??[])if(!workspace.entries.some(v=>v.scope==='field'&&v.key===key))workspace.entries.push({id:uid('belt'),key,scope:'field'});saveWorkspace();renderAll();break;

 case 'native-palette':changed(()=>applyPalette(s,el.dataset.id!));break;
 case 'native-paper-harmonize':changed(()=>{const [r,g,b]=hexToRgb(s.field.palette[0]);s.field.background='#'+[Math.max(3,Math.floor(r*.07)),Math.max(3,Math.floor(g*.07)),Math.max(8,Math.floor(b*.12))].map(n=>n.toString(16).padStart(2,'0')).join('');s.engine.backgroundMode='ambientGlow';s.engine.inkMode='whiteOnBlack';const binding=NATIVE_BINDINGS.find(b=>b.path==='backgroundGlowIntensity');if(binding)bindValue(s,binding.bind,.65);});break;
 case 'native-paper-invert':changed(()=>{s.field.background=isLightHex(s.field.background)?'#09090b':'#fafaf9';s.engine.inkMode=isLightHex(s.field.background)?'blackOnWhite':'whiteOnBlack';});break;
 case 'native-paper':changed(()=>applyBackground(s,el.dataset.id!));break;
 case 'native-palette-invert':changed(()=>invertPalette(s));break;
 case 'native-palette-random':changed(()=>{applyPalette(s,COLOR_PALETTES[Math.floor(Math.random()*COLOR_PALETTES.length)].id);});break;
 case 'native-glyph':if(e)changed(()=>{const glyph=el.dataset.value!,base=el.dataset.prefix!=='step',font={fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight};
  useStateShape(e,base?0:stepIndex);if(base)e.layers=[];setStateSource(e,base?0:stepIndex,undefined);applyGlyph(e,base?null:stepIndex,glyph);
  if(s.engine.autoFitSizes!==false){if(base){refitEntityForGlyph(e,glyph,font);if(e.sequence.steps.length===1)refitStepForGlyph(e,0,glyph,font);}else refitStepForGlyph(e,stepIndex,glyph,font);}
  if(!base)syncHeldState(e,stepIndex);});break;
 case 'native-chain':if(e)changed(()=>{applyChain(e,el.dataset.id!);stepIndex=0;if(s.engine.autoFitSizes!==false)refitFormationToGlyphs(e,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight});});break;
 case 'native-kundalini-sequence':if(e)changed(()=>{applyKundaliniSequence(e);stepIndex=0;if(s.engine.autoFitSizes!==false)refitFormationToGlyphs(e,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight});});break;
 case 'native-layout':{const entities=s.entities.filter(v=>selected.includes(v.id)&&!v.locked&&v.kind==='formation'),layout=NATIVE_LAYOUTS[el.dataset.value!];if(layout)changed(()=>{const axes=s.composition.plane==='XZ'?['x','z']:s.composition.plane==='YZ'?['y','z']:['x','y'];layout(entities.length).forEach((pos,i)=>{entities[i].position[axes[0] as keyof Vec3]=pos.x/400;entities[i].position[axes[1] as keyof Vec3]=pos.y/400;});s.composition.layout='native-'+el.dataset.value;});break;}
 case 'native-disperse':engine.command?.({type:'disperse',strength:3});needsFrame=true;break;
 case 'native-reset-phases':engine.command?.({type:'reset-phases'});needsFrame=true;break;
 case 'native-reset':confirmChange('Reset the particle field?','This deliberately reseeds particle positions and resets morph phases. The expression and its settings are preserved.',()=>{engine.command?.({type:'reset-field'});needsFrame=true;});break;
 case 'native-recover':engine.command?.({type:'recover-context'});recovery.hidden=true;needsFrame=true;break;
 case 'delete-saved':{const id=el.dataset.id!;confirmChange('Remove this saved copy?','Only this understood saved expression is removed. Other saved and unreadable entries are retained. The active expression remains open.',()=>{removeFromLibrary(id);deletedLibraryIds.add(id);void removeDraft(id).catch(error);clearTimeout(saveTimeout);saveTimeout=0;sessionExpressions.delete(id);covers.delete(id);renderLibrary();});break;}

 case 'edit':edit(!inspectorOpen,selectedEntity()?'objects':'field');break;
 case 'close-inspector':if(studioOpen){setStudio(false);break;}inspectorOpen=false;railExpanded=false;renderAll();break;
 case 'tab':tab=el.dataset.value as InspectorContext['tab'];search='';$<HTMLInputElement>('control-search').value='';renderAll();$('inspector-content').scrollTop=0;break;
 case 'objects':activateRail('objects');break;
 case 'tool-select':case 'tool-interact':case 'tool-pin':case 'tool-formation':case 'tool-text':case 'tool-orbit':activateRail(name.slice(5) as Tool);break;
 case 'view-2d':camera.mode='2d';facePlane(camera);renderAll();break;
 case 'view-3d':camera.mode='3d';camera.yaw=-.42;camera.pitch=.25;renderAll();break;
 case 'guides':guidesVisible=!guidesVisible;renderAll();break;
 case 'grid':camera.grid=!camera.grid;renderAll();break;
 case 'snap':camera.snap=!camera.snap;renderAll();break;
 case 'face-plane':facePlane(camera);renderAll();break;
 case 'keep-view':changed(()=>{scene().view={...scene().view,mode:camera.mode,yaw:camera.yaw,pitch:camera.pitch,zoom:camera.zoom,panX:camera.panX/width,panY:camera.panY/height};});toast('This camera framing is now part of the scene.');break;
 case 'restore-view':applySceneView();renderAll();break;
 // ES1A/ES1B (O:I #352): scene-body/trigger authoring. Every write is the
 // Rust-exact kernel Change grammar, sent through the app's existing native
 // edit path (nativeWorkspace.edit → the kernel's own `edit` operation);
 // there is no second, presentation-only copy of a body or trigger.
 case 'scene-body-image':case 'scene-body-text':{
  const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];
  if(!view||!binding){toast('Open this Scene as a native Expression before setting its body.');break;}
  const image=name==='scene-body-image',path=$<HTMLInputElement>(image?'scene-body-image-path':'scene-body-text-path').value.trim();
  if(!path){toast(`Name the native ${image?'image':'text'} file first.`);break;}
  const revision=store.revision,sceneId=scene().id;
  const start=image?0:Number($<HTMLInputElement>('scene-body-text-start').value),end=image?0:Number($<HTMLInputElement>('scene-body-text-end').value);
  const body=await prepareNativeSceneBody(image?'image_media':'text_source',path,start===0&&end===0?null:{start,end});
  const current=nativeWorkspace?.nativeView();
  if(store.revision!==revision||scene().id!==sceneId||current?.document.expression_ref!==view.document.expression_ref||current.document.revision!==view.document.revision)throw Error('The Scene changed while its source was read. Review the current Scene and choose the body again.');
  await nativeWorkspace!.edit([{change:'scene_body_set',scene_ref:binding.scene_ref,body}]);
  toast(`Scene body set to the current native ${image?'image':'text'}.`);break;
 }
 case 'scene-body-clear':{
  const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];
  if(!view||!binding){toast('Open this Scene as a native Expression first.');break;}
  await nativeWorkspace?.edit([{change:'scene_body_clear',scene_ref:binding.scene_ref}]);
  toast('Scene body cleared.');break;
 }
 case 'scene-trigger-add':{
  const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];
  if(!view||!binding){toast('Open this Scene as a native Expression first.');break;}
  const targetRef=$<HTMLSelectElement>('scene-trigger-target').value,occasion=$<HTMLSelectElement>('scene-trigger-occasion').value;
  if(!targetRef){toast('Choose a Scene to jump to.');break;}
  const triggerRef=`${view.document.expression_ref}:trigger:jump-${crypto.randomUUID()}`;
  await nativeWorkspace?.edit([{change:'scene_trigger_attach',scene_ref:binding.scene_ref,trigger:{trigger_ref:triggerRef,occasion,target:{kind:'navigate',scene_ref:targetRef}}}]);
  toast('Jump trigger added.');break;
 }
 case 'scene-trigger-remove':{
  const ref=el.dataset.triggerRef;
  if(!ref)break;
  await nativeWorkspace?.edit([{change:'scene_trigger_detach',trigger_ref:ref}]);
  toast('Trigger removed.');break;
 }
 case 'fit-view':{const {plane,depth,grid,snap}=camera;camera=defaultCamera();Object.assign(camera,{plane,depth,grid,snap});facePlane(camera);renderAll();break;}
 case 'timeline':timelineOpen=!timelineOpen;if(timelineOpen){inspectorOpen=false;contextKind='';beltPickerOpen=false;modesOpen=false;captureOpen=false;}renderAll();break;
 case 'open-timeline':journeyPlaying=false;timelineOpen=true;inspectorOpen=false;contextKind='';beltPickerOpen=false;modesOpen=false;captureOpen=false;renderAll();break;
 case 'close-timeline':timelineOpen=false;renderAll();break;
 case 'previous':await setScene(sceneIndex-1);break;case 'next':await setScene(sceneIndex+1);break;
 case 'choose-scene':await setScene(Number(el.dataset.index));break;
 case 'toggle-play':toggleScenePlay();break;
 case 'play-journey':if(!journeyPlaying&&!savedSceneIndices(store.document).length){timelineOpen=true;renderAll();toast('Save your first scene before playing the scene strip.');break;}journeyPlaying=!journeyPlaying;if(journeyPlaying){fieldPaused=false;scenePlaying=true;editing=false;inspectorOpen=false;timelineOpen=false;selected=[];cursorTool='interact';tool='interact';shapePickerOpen=false;placementStep=false;if(!store.document.savedScenes?.[scene().id])sceneIndex=savedSceneIndices(store.document)[0];sceneElapsed=0;fireAutomations(true);}applySceneView();renderAll();break;
 case 'present':presenting=true;selected=[];shapePickerOpen=false;renderAll();break;
 case 'exit-present':presenting=false;renderAll();break;
 case 'library':case 'preset-browser':case 'keep':openLibrary();break;
 case 'deep-verso':hostRequest({request:'summon',detail:{kind:'verso',subject:nativeWorkspace?.nativeSubject()??undefined}});break;
 case 'blueprint':inspectorOpen=true;editing=true;contextKind='';studioSection='blueprint';tab='field';renderAll();blueprintHUD?.open();break;
 case 'native-save':await saveNative();break;
 case 'native-resolve':void nativeWorkspace?.resolvePending();break;
 case 'native-retry-open':void nativeWorkspace?.retryOpen();break;
 case 'native-retry-file':void nativeWorkspace?.retryFile();break;
 case 'native-page':void nativeWorkspace?.page(Number(el.dataset.delta));break;
 case 'native-save-file':openNativeFileDialog();break;
 case 'native-open-file':openCentralFileDialog();break;
 case 'research-preview':if(!researchInstruments?.active())break;researchPreview=!researchPreview;lastTime=performance.now();needsFrame=true;overlayDirty=true;renderAll();break;
 case 'native-library':openLibrary('collection');break;
 case 'lens':lensStudio.select(el.dataset.lens as LensId);break;
 case 'deep-home':{const home=starters.find(p=>p.expression.id==='source-twelve-faces')?.expression;if(home){sequenceOpen=false;beltOpen=false;guidesVisible=false;await loadJourney(clone(home));}else toast('The authored Epii entrance is unavailable in this build. Your work was retained.',6000);break;}
 case 'deep-lived':hostRequest({request:'workspace-mode',mode:'expressions'});break;
 case 'capture-options':inspectorOpen=false;contextKind='';beltPickerOpen=false;timelineOpen=false;modesOpen=false;readCapture();openKeep();break;case 'about':closeDialogs();openAbout();break;
 case 'close-library':closeLibrary();break;
 case 'library-section':librarySection=el.dataset.section as 'collection'|'about';renderLibrary();$('library-page').scrollTop=0;break;
 case 'modes':modesOpen=!modesOpen;if(modesOpen){inspectorOpen=false;contextKind='';beltPickerOpen=false;timelineOpen=false;}captureOpen=false;pointer.active=false;if(modesOpen)$('modes-panel').innerHTML=modesHTML(starters,recentJourneys(Array.from(new Map([...readLibrary(),...sessionExpressions.values(),store.document].map(j=>[j.id,j])).values()),recentIds));renderAll();break;
 case 'start-mode':{const item=starters.find(p=>p.id===el.dataset.id);if(item)await loadJourney(forkExpression(item.expression));break;}
 case 'open-featured':{const item=featured.find(j=>j.id===el.dataset.id);if(item)await loadJourney(forkExpression(item));break;}
 case 'fork-saved':{const item=store.document.id===el.dataset.id?store.document:sessionExpressions.get(el.dataset.id!)??readLibrary().find(j=>j.id===el.dataset.id);if(item){const copy=forkExpression(item);copy.name+=' / variation';await loadJourney(copy);}break;}
 case 'close-dialog':el.closest('dialog')?.close();break;
 case 'confirm':$('confirm-dialog').closest('dialog')?.close();confirmCallback?.();confirmCallback=null;break;
 case 'load-built-in':{const j=preset(el.dataset.value!);j.id=uid('journey');await loadJourney(j);break;}
 case 'add-built-in':{const added=clone(preset(el.dataset.value!).scenes[0].entities);for(const x of added)x.id=uid('entity');changed(()=>{s.entities.push(...added);selected=added.map(x=>x.id);});closeDialogs();edit(true,'objects');break;}
 case 'import-legacy':{const raw=localStorage.getItem('typographic_pointcloud_saved_states');if(raw){const result=importDocuments(JSON.parse(raw));collectImported(result.journeys);toast(`${result.journeys.length} previous native scenes imported. Original browser key unchanged. ${result.errors.map(e=>e.message).join(' · ')}`,9000);openLibrary();}break;}
 case 'load-saved':{const j=store.document.id===el.dataset.id?store.document:sessionExpressions.get(el.dataset.id!)??readLibrary().find(j=>j.id===el.dataset.id);if(j)await loadJourney(j);break;}
 case 'new-journey':await loadJourney(blankJourney());edit(true,'scene');closeEntryGate();break;
 case 'entry-new':await loadJourney(blankJourney());edit(true,'scene');closeEntryGate();toast('Blank Expression — place a glyph or formation to begin.');break;
 case 'entry-continue':closeEntryGate();toast(store.document.name?'Continued '+store.document.name:'Continued last work');break;
 case 'entry-open':closeEntryGate();openLibrary();break;
 case 'entry-open-native':closeEntryGate();openLibrary('collection');break;
 case 'entry-starter-mark':await loadJourney(forkExpression(oiMark()));edit(true,'scene');closeEntryGate();break;
 case 'entry-dismiss':closeEntryGate();break;
 case 'new-scene':changed(()=>{store.document.scenes.splice(sceneIndex+1,0,blankScene());sceneIndex++;selected=[];textId=scene().text[0]?.id??null;sceneElapsed=0;journeyPlaying=false;});edit(true,'scene');timelineOpen=true;renderAll();break;
 case 'duplicate-scene':{const idx=Number(el.dataset.index??sceneIndex);changed(()=>{const n=clone(store.document.scenes[idx]);n.id=uid('scene');n.name+=' / variation';store.document.scenes.splice(idx+1,0,n);sceneIndex=idx+1;sceneElapsed=0;journeyPlaying=false;});break;}
 case 'delete-scene':{if(store.document.scenes.length===1){toast('Keep at least one scene in the expression.');break;}const idx=Number(el.dataset.index);confirmChange('Remove this scene?',`“${store.document.scenes[idx].name}” will be removed from this expression. Undo can restore it.`,()=>changed(()=>{delete store.document.savedScenes?.[store.document.scenes[idx].id];store.document.scenes.splice(idx,1);if(sceneIndex>=idx)sceneIndex=Math.max(0,sceneIndex-1);sceneElapsed=0;}));break;}
 case 'move-scene-left':reorderScene(Number(el.dataset.index),Number(el.dataset.index)-1);break;
 case 'move-scene-right':reorderScene(Number(el.dataset.index),Number(el.dataset.index)+1);break;
 case 'journey-settings':openLibrary();break;
 case 'material':changed(()=>{s.field.material=el.dataset.value as Scene['field']['material'];});break;
 case 'select-entity':selectEntity(el.dataset.id!,event instanceof MouseEvent&&event.shiftKey);break;
 case 'select-all':selected=s.entities.filter(e=>!e.locked).map(e=>e.id);renderAll();break;
 case 'repeat-pins':pinRepeat=!pinRepeat;setHint();break;
 case 'choose-shape':shapeChoice=el.dataset.value as Shape;glyphChoice=el.dataset.glyph??glyphChoice;renderShapePicker();break;
 case 'set-glyph':if(e&&!e.locked)changed(()=>{e.shape='text';e.text=el.dataset.value!;if(!e.sequence.enabled&&e.sequence.steps.length===1)e.sequence.steps[0].text=e.text;});break;
 case 'force-kind':if(e&&!e.locked)changed(()=>{e.force.kind=el.dataset.value as Entity['force']['kind'];if(e.kind==='pin')e.name=e.force.kind==='attract'?'Attractor':e.force.kind==='repel'?'Repeller':e.force.kind==='vortex'?'Vortex':'Pin';});break;
 case 'semantic-add-modulation':{const entityId=el.dataset.entityId,binding=entityId?semanticBindingFor(s,entityId):undefined;if(binding)changed(()=>{(binding.modulations??=[]).push({source:{kind:'resonanceAffinity'},target:'color.gain',amount:1,offset:0});});break;}
 case 'semantic-remove-modulation':{const entityId=el.dataset.entityId,binding=entityId?semanticBindingFor(s,entityId):undefined,index=Number(el.dataset.index);if(binding&&Number.isInteger(index))changed(()=>{binding.modulations?.splice(index,1);});break;}
 case 'duplicate-entity':duplicateEntity();break;case 'delete-entity':deleteEntities();break;
 case 'arrange':{if(selected.some(id=>blueprintMember(s,id))){toast('Release the blueprint before changing its internal arrangement.');break;}const targets=s.entities.filter(e=>!e.locked&&selected.includes(e.id));if(!targets.length){toast('Select at least one unlocked centre.');break;}changed(()=>{arrange(targets,el.dataset.value!,s.composition.plane);s.composition.layout=el.dataset.value!;});break;}
 case 'chakra-add':{const source=starters.find(p=>p.id==='composition-chakra_body')?.expression.scenes[0];if(!source)throw new Error('Semantic Chakra Body starter is unavailable.');let added:Entity[]=[];changed(()=>{added=mergeSemanticStarter(s,source);selected=added.map(e=>e.id);});toast(STANDING_LABEL[AUTHORED_CHAKRA_STARTER]+'. No hidden chakra mode was enabled.');break;}
 case 'add-palette':if(s.field.palette.length<8)changed(()=>{s.engine.paletteSource='custom';s.field.palette.push('#a4876c');});break;
 case 'remove-palette':if(s.field.palette.length>2)changed(()=>{s.engine.paletteSource='custom';s.field.palette.pop();});break;
 case 'fold-state':{if(!e)break;const destinations=store.document.scenes.slice(0,sceneIndex).flatMap(sc=>sc.entities.filter(v=>v.kind==='formation'&&!v.locked&&v.sequence.steps.length<32).map(v=>({scene:sc,entity:v})));if(!destinations.length){toast('An earlier scene needs an unlocked formation with room for another state.');break;}$('confirm-dialog').innerHTML=`${modalCloseButton()}<h2>Add object state</h2><p class="intro">Copy ${esc(e.name)} into an earlier formation’s sequence. Its source, shape, position, size, colour and force become one state. Scene physics and automation stay in their scenes.</p><label class="control"><span>Destination scene / formation</span><select id="fold-target">${destinations.map(d=>`<option value="${esc(d.scene.id)}|${esc(d.entity.id)}">${esc(d.scene.name)} / ${esc(d.entity.name)}</option>`).join('')}</select></label><label class="control"><span>Play these states with</span><select id="fold-mode"><option value="seconds">Seconds · hold and transition</option><option value="morph">Morph cycles</option><option value="manual">Manual blend</option></select></label><label class="toggle-row"><span>Remove this working scene after adding<small>Undo restores it. The earlier scene’s named snapshot stays intact.</small></span><input type="checkbox" id="fold-remove"><i></i></label><button class="primary" data-action="confirm-fold">Add to sequence</button>`;$('confirm-dialog').dataset.sourceEntity=e.id;$('confirm-dialog').dataset.sourceScene=s.id;$('confirm-dialog').dataset.sourceStep=String(stepIndex);$<HTMLDialogElement>('confirm-dialog').showModal();break;}
 case 'confirm-fold':{const dialog=$('confirm-dialog'),[to,target]=$<HTMLSelectElement>('fold-target').value.split('|'),mode=$<HTMLSelectElement>('fold-mode').value as 'seconds'|'morph'|'manual';changed(()=>{const result=foldObjectState(store.document,dialog.dataset.sourceScene!,dialog.dataset.sourceEntity!,Number(dialog.dataset.sourceStep),to,target,mode,$<HTMLInputElement>('fold-remove').checked);sceneIndex=store.document.scenes.findIndex(s=>s.id===result.sceneId);selected=[result.entityId];stepIndex=result.stepIndex;sceneElapsed=0;journeyPlaying=false;applySceneView();});closeDialogs();inspectorOpen=false;contextKind='';captureOpen=false;sequenceOpen=true;renderAll();toast('Object state added to the earlier sequence · draft backed up. Save the scene when ready.');break;}
 case 'image-suite':captureOpen=false;openKeep();break;
 case 'source-sequence':captureOpen=false;sequenceOpen=true;renderAll();break;
 case 'source-new':{if(s.entities.length>=32){toast('A scene holds up to 32 formations and pins.');break;}const added=entity('Image / ASCII','O');changed(()=>{if(s.engine.autoFitSizes!==false)refitEntityForGlyph(added,'O',{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight});s.entities.push(added);selected=[added.id];stepIndex=0;});break;}
 case 'source-add':if(e&&!e.locked&&e.sequence.steps.length<32)changed(()=>{stepIndex=appendFormationState(e,'O',undefined,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight},s.engine.autoFitSizes!==false);syncHeldState(e,stepIndex);});break;
 case 'source-image':if(e&&!e.locked){sourceUploadEntityId={sceneId:s.id,entityId:e.id,stepId:e.sequence.steps[stepIndex].id};$<HTMLInputElement>('source-file').click();}break;
 case 'layer-add':{const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),kind=el.dataset.kind;if(ent&&!ent.locked&&((ent.sequence.steps[stepIndex]?.layers??ent.layers)?.length??0)<6)changed(()=>editStateLayers(ent,stepIndex,()=>{const n=(ent.sequence.steps[stepIndex]?.layers??ent.layers)?.length??0;const z=((n%2===0?1:-1)*Math.ceil((n+1)/2))*.25;const layer:EntityLayer={id:uid('layer'),text:kind==='glyph'?(el.dataset.value||'O'):'O',z,source:kind==='ascii'?{kind:'ascii',ascii:{text:['########','#      #','#  ##  #','#      #','########'].join('\n'),fontFamily:'monospace'}}:undefined};ent.layers=[...(ent.layers??[]),layer];if(kind==='image'){sourceUploadEntityId={sceneId:s.id,entityId:ent.id,stepId:ent.sequence.steps[stepIndex]?.id,layerId:layer.id};$<HTMLInputElement>('source-file').click();}}));break;}
 case 'layer-remove':{const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.index);if(ent&&!ent.locked&&((ent.sequence.steps[stepIndex]?.layers??ent.layers)?.length??0)>1)changed(()=>editStateLayers(ent,stepIndex,()=>{ent.layers=ent.layers!.filter((_,i)=>i!==idx);}));break;}
 case 'layer-move':{const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.index),dir=Number(el.dataset.dir);if(ent&&!ent.locked&&(ent.sequence.steps[stepIndex]?.layers??ent.layers)){const j=idx+dir;if(j<0||j>=(ent.sequence.steps[stepIndex]?.layers??ent.layers??[]).length)break;changed(()=>editStateLayers(ent,stepIndex,()=>{const ls=[...ent.layers!];const t=ls[idx];ls[idx]=ls[j];ls[j]=t;ent.layers=ls;}));}break;}
 case 'select-text':cursorTool='select';textId=el.dataset.id!;tool='text';renderAll();break;
 case 'move-text':cursorTool='select';tool='text';renderAll();break;
 case 'add-text':cursorTool='select';changed(()=>{const t:TextLayer={id:uid('text'),visible:true,kicker:'A MOMENT IN THE FIELD',title:'Your words,',italic:'in this space.',body:'',x:.07,y:.24,width:240,size:38,align:'left'};s.text.push(t);textId=t.id;tool='text';});break;
 case 'delete-text':if(currentText())changed(()=>{s.text=s.text.filter(t=>t.id!==currentText().id);textId=s.text[0]?.id??null;});break;
 case 'entity-sequence':if(e)selected=[e.id];editing=true;inspectorOpen=true;tab='motion';motionTab='sequence';stepIndex=0;renderAll();break;
 case 'motion-tab':motionTab=el.dataset.value as InspectorContext['motionTab'];renderAll();break;
 case 'select-step':if(e){selected=[e.id];stepIndex=Number(el.dataset.index);placementStep=false;if(!e.sequence.enabled&&!e.sequence.manual)changed(()=>syncHeldState(e,stepIndex));else renderAll();}break;
 case 'add-step':if(e&&!e.locked&&e.sequence.steps.length<32)changed(()=>{stepIndex=appendFormationState(e,e.sequence.steps.length%2?'I':'O',undefined,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight},s.engine.autoFitSizes!==false);e.sequence.enabled=true;});break;
 case 'add-ascii-step':if(e&&!e.locked&&e.sequence.steps.length<32)changed(()=>{stepIndex=appendFormationState(e,'',{kind:'ascii',ascii:{text:'',fontFamily:'monospace',fontSize:32}},{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight},s.engine.autoFitSizes!==false);selected=[e.id];syncHeldState(e,stepIndex);});break;
 case 'add-image-step':if(e&&!e.locked&&e.sequence.steps.length<32){sourceUploadEntityId={sceneId:s.id,entityId:e.id,append:true};$<HTMLInputElement>('source-file').click();}break;
 case 'delete-step':if(e&&!e.locked){if(e.sequence.steps.length<=1){toast('Keep at least one sequence link.');break;}changed(()=>{e.sequence.steps.splice(stepIndex,1);stepIndex=Math.max(0,stepIndex-1);syncHeldState(e,stepIndex);pruneAutomation(s);});}break;
 case 'capture-step-state':if(e&&!e.locked)changed(()=>{const k=e.sequence.steps[stepIndex];if(k&&!k.objectState)k.objectState=capturedStepState(e,stepIndex);});break;
 case 'release-step-state':if(e&&!e.locked)changed(()=>{delete e.sequence.steps[stepIndex]?.objectState;});break;
 case 'refit-sequence':if(e&&!e.locked)changed(()=>refitFormationToGlyphs(e,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight}));break;
 case 'font-family':{if(!(el instanceof HTMLSelectElement))break;const value=el.value;
  if(value===CUSTOM_SENTINEL){customFontEdit=true;renderAll();$('inspector-content').querySelector<HTMLInputElement>('input[data-bind="engine.fontFamily"]')?.focus();break;}
  const prior=s.engine.fontFamily;customFontEdit=false;
  const stack=FONT_OPTIONS.find(o=>o.id===value)?.stack??value;
  changed(()=>{s.engine.fontFamily=stack;refitFormationsForFont({fontFamily:prior??''},{fontFamily:stack,fontWeight:s.engine.fontWeight});});
  break;}
 case 'place-keyframe':if(e&&blueprintMember(s,e.id)){toast('Release the blueprint before adding positional keyframes.');break;}if(e&&!e.locked){placementStep=true;cursorTool='select';tool='select';inspectorOpen=false;camera.grid=true;renderAll();}break;
 case 'clear-keyframe':if(e&&!e.locked&&e.sequence.steps[stepIndex])changed(()=>{e.sequence.steps[stepIndex].position=null;});break;
 case 'cancel-placement':placementStep=false;shapePickerOpen=false;cursorTool='select';tool='select';inspectorOpen=true;renderAll();break;
 case 'route-up':case 'route-down':changed(()=>{reorderFocus(s.entities,el.dataset.id!,name==='route-up'?-1:1);});break;
 case 'show-monitor':monitoredLane=el.dataset.id!;beltOpen=true;inspectorOpen=false;renderAll();break;
 case 'monitor-mode':monitorMode=el.dataset.value==='live'?'live':'cycle';renderLive();break;
 case 'monitor-dock':{monitorDocked=!monitorDocked;const m=$('automation-monitor');if(monitorDocked)$('toolbelt-panel').appendChild(m);else document.body.appendChild(m);renderAll();break;}
 case 'monitor-add-glyph':{changed(()=>{const added=entity('New glyph','O');scene().entities.push(added);selected=[added.id];});toast('Glyph added. Drag it on the canvas, or edit it under Objects.');break;}
 case 'edit-monitored':monitoredLane=el.dataset.id!;editing=true;inspectorOpen=true;tab='motion';motionTab='automation';detailState.set('automation-'+monitoredLane,true);renderAll();break;
 case 'toggle-monitored':changed(()=>{const lane=s.automation.find(l=>l.id===el.dataset.id);if(lane)lane.enabled=!lane.enabled;});break;
 case 'choose-group-target':assignmentGroup=el.dataset.id!;assignmentTarget='';renderAll();break;
 case 'close-assignment':assignmentGroup='';assignmentTarget='';renderAll();break;
 case 'confirm-group-target':{const target=$<HTMLSelectElement>('assignment-target').value,group=assignmentGroup;assignmentGroup='';if(target)addLane(target,group==='new'?undefined:group);else renderAll();break;}
 case 'assign-automation':{const target=assignmentTarget;assignmentTarget='';addLane(target,el.dataset.id||undefined);break;}
 case 'delete-group':changed(()=>{const ids=new Set(automationGroups(s.automation).find(g=>g.leader.id===el.dataset.id)?.targets.map(l=>l.id));s.automation=s.automation.filter(l=>!ids.has(l.id));});break;
 case 'remove-group-target':changed(()=>{s.automation=removeGroupTarget(s.automation,el.dataset.id!);});break;
 case 'detach-target':changed(()=>linkAutomation(s.automation,el.dataset.id!,''));break;
 case 'edit-morph':studioSection='motion';tab='motion';motionTab='morph';renderAll();break;
 case 'automate':{const target=el.dataset.target??'field.'+el.dataset.key,existing=s.automation.find(l=>l.target===target);if(existing){monitoredLane=automationLeader(s.automation,existing).id;editing=true;inspectorOpen=true;tab='motion';motionTab='automation';detailState.set('automation-'+monitoredLane,true);}else{assignmentTarget=target;assignmentGroup='';}renderAll();break;}case 'add-lane':assignmentGroup='new';assignmentTarget='';renderAll();break;
 case 'delete-lane':changed(()=>{s.automation=removeAutomation(s.automation,el.dataset.id!);});break;
 case 'fire-lane':{const requested=s.automation.find(a=>a.id===el.dataset.id),lane=requested?automationLeader(s.automation,requested):undefined;if(lane)changed(()=>{lane.firedAt=(lane.firedAt??0)+1;});if(fieldPaused)toast('Ramp armed. Lift “Pause physics” in the studio to let it run.');break;}
 case 'reveal-param':{editing=true;inspectorOpen=true;const p=parameter(el.dataset.key!);if(p){search='';$<HTMLInputElement>('control-search').value='';tab=p.group==='morph'||p.group==='composition'?'motion':'field';motionTab=p.group==='composition'?'focus':'morph';renderAll();const control=Array.from($('inspector-content').querySelectorAll<HTMLElement>('[data-bind]')).find(e=>e.dataset.bind===p.bind);let parent=control?.parentElement;while(parent&&parent!==$('inspector-content')){if(parent instanceof HTMLDetailsElement){parent.open=true;if(parent.dataset.detail)detailState.set(parent.dataset.detail,true);}parent=parent.parentElement;}control?.scrollIntoView({block:'center'});}break;}
 case 'toggle-global':changed(()=>toggleShared(store.document,s,el.dataset.path!));break;
 case 'favourite':{const key=el.dataset.key!;const exists=workspace.entries.some(v=>v.scope==='field'&&v.key===key);workspace.entries=exists?workspace.entries.filter(v=>v.scope!=='field'||v.key!==key):[...workspace.entries,{id:uid('belt'),key,scope:'field'}];saveWorkspace();renderAll();break;}
 case 'take-manual':{const target=el.dataset.target!,binding=automationTarget(s,target),evaluated=engine.telemetry?.(),value=binding?liveValue(s,binding.bind,binding.entityId,evaluated?.params??s.field.params,evaluated?.config):undefined;changed(()=>{if(binding&&value!==undefined){const location=binding.entityId?{root:s.entities.find(e=>e.id===binding.entityId),keys:binding.bind.slice(7).split('.')}:pathTarget(binding.bind);let object:any=location.root;for(const key of location.keys.slice(0,-1))object=object[key];object[location.keys.at(-1)!]=value;}for(const lane of s.automation.filter(l=>l.target===target))s.automation=removeGroupTarget(s.automation,lane.id);if(target==='field.frequency'){s.composition.frequencyDriver='manual';s.engine.autoSweep=false;}});break;}
 case 'tune-station':{const station=engine.stations?.().find(x=>x.index===Number(el.dataset.index));if(station)changed(()=>{s.field.params.frequency=station.frequencyHz;s.composition.frequencyDriver='manual';s.engine.autoSweep=false;s.automation.filter(l=>l.target==='field.frequency').forEach(l=>l.enabled=false);});break;}
 case 'lane-up':case 'lane-down':{const index=s.automation.findIndex(l=>l.id===el.dataset.id),next=index+(name==='lane-up'?-1:1);if(index>=0&&next>=0&&next<s.automation.length)changed(()=>{[s.automation[index],s.automation[next]]=[s.automation[next],s.automation[index]];});break;}
 case 'step-earlier':case 'step-later':{const next=stepIndex+(name==='step-earlier'?-1:1);if(e&&next>=0&&next<e.sequence.steps.length&&!e.locked)changed(()=>{[e.sequence.steps[stepIndex],e.sequence.steps[next]]=[e.sequence.steps[next],e.sequence.steps[stepIndex]];stepIndex=next;syncHeldState(e,stepIndex);});break;}
 case 'duplicate-step':if(e&&!e.locked&&e.sequence.steps.length<32)changed(()=>{const k=clone(e.sequence.steps[stepIndex]);k.id=uid('step');if(k.layers)k.layers=k.layers.map(l=>({...l,id:uid('layer')}));e.sequence.steps.splice(++stepIndex,0,k);syncHeldState(e,stepIndex);});break;
 case 'undo':if(store.undo()){markSaved();renderAll();if(researchInstruments?.active()){await commitResearch();await researchInstruments.refresh();}toast('Edit undone. Simulation time has not been rewound.',2200);}break;
 case 'redo':if(store.redo()){markSaved();renderAll();if(researchInstruments?.active()){await commitResearch();await researchInstruments.refresh();}}break;
 case 'save-browser':deletedLibraryIds.delete(store.document.id);saveToLibrary(store.document);if(libraryOpen)renderLibrary();toast('Saved in this browser.');break;
 case 'export-json':download(new Blob([JSON.stringify(store.document,null,2)],{type:'application/json'}),slug(store.document.name)+'.expression.json');toast('Expression configuration exported.');break;
 case 'export-native':download(new Blob([JSON.stringify(nativeExport(s),null,2)],{type:'application/json'}),slug(s.name)+'.native-scene.json');break;
 case 'export-artifact':await exportArtifact();break;
 case 'import':$<HTMLInputElement>('import-file').click();break;
 case 'capture-image':await captureImage();break;
 case 'record-video':startRecording();break;
 case 'stop-record':recorder.stop();break;
 case 'save-video':if(currentVideo){const video=currentVideo,name=slug(video.source.expression.name)+'-performance.'+(video.mime.includes('mp4')?'mp4':'webm');if(await saveDesktopCapture(video.blob,name,video.source,video.settings))toast('Video saved to the Physis library.');else download(video.blob,name);}break;
 }}
document.addEventListener('click',ev=>{const target=(ev.target as Element).closest<HTMLElement>('[data-action]');if(!target||target instanceof HTMLSelectElement||target instanceof HTMLButtonElement&&target.disabled)return;const name=target.dataset.action!;void action(name,target,ev).catch(error);});
document.addEventListener('pointerover',ev=>{if(!(ev.target as Element).closest('#stage'))pointer.active=false;});
document.addEventListener('pointerdown',ev=>{const target=ev.target as Element;if((assignmentTarget||assignmentGroup)&&!target.closest('#automation-assignment,[data-action="automate"],[data-action="choose-group-target"],[data-action="add-lane"]')){assignmentTarget='';assignmentGroup='';$('automation-assignment').hidden=true;}if(modesOpen&&!target.closest('#modes-panel,[data-action="modes"]')){modesOpen=false;$('modes-panel').hidden=true;document.querySelector('[data-action="modes"]')?.setAttribute('aria-expanded','false');}if(captureOpen&&!target.closest('#capture-panel,[data-action="capture-options"]')){readCapture();captureOpen=false;$('capture-panel').hidden=true;document.querySelector('[data-action="capture-options"]')?.setAttribute('aria-expanded','false');}const el=ev.target as HTMLInputElement;if(!el.closest('#stage'))pointer.active=false;if(el instanceof HTMLInputElement&&el.type==='range'&&el.dataset.bind)store.begin();});
// Release any gesture baseline even when the input never fires a change event.
document.addEventListener('pointerup',()=>store.finish());
document.addEventListener('input',ev=>{const el=ev.target as HTMLInputElement;if(el.id==='expression-playhead'){let value=Number(el.value),index=0;while(index<store.document.scenes.length-1&&value>=store.document.scenes[index].duration){value-=store.document.scenes[index].duration;index++;}void (async()=>{if(index!==sceneIndex&&!await setScene(index))return;sceneElapsed=value;trackPreview=true;scenePlaying=false;needsFrame=true;transportUI();})().catch(error);return;}if(el.id==='belt-search'){document.querySelectorAll<HTMLElement>('[data-candidate-row]').forEach(row=>row.hidden=!row.dataset.search?.includes(el.value.toLowerCase()));return;}if(el.id==='scene-save-name'){sceneNames.set(scene().id,el.value);return;}if(el.id==='placement-glyph'){glyphChoice=el.value.trim()||'O';return;}if(el.id==='mode-search'||el.id==='library-search'){
 const query=el.value.trim().toLowerCase(),selector=el.id==='mode-search'?'[data-mode-choice]':'[data-starting-card]';let count=0;
 document.querySelectorAll<HTMLElement>(selector).forEach(item=>{item.hidden=!item.dataset.search?.includes(query);if(!item.hidden)count++;});
 if(el.id==='library-search')$('library-empty').hidden=count>0;return;
 }if(el.id==='control-search'){search=el.value;renderInspector();return;}if((el instanceof HTMLInputElement&&el.type==='range'||el instanceof HTMLTextAreaElement)&&el.dataset.bind)applyBinding(el,true);});
document.addEventListener('change',ev=>{const el=ev.target as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;if(el.dataset.beltChoice){if((el as HTMLInputElement).checked)pendingBelt.add(el.dataset.beltChoice);else pendingBelt.delete(el.dataset.beltChoice);$('belt-selection-count').textContent=pendingBelt.size+' selected';return;}if(el.id==='pointer-scope'){changed(()=>useLocalPointer(store.document,scene(),el.value==='local'));return;}
 if(el.id==='pause-physics'){fieldPaused=(el as HTMLInputElement).checked;needsFrame=true;transportUI();return;}
 if(el.dataset.semanticNode!==undefined){const entityId=el.dataset.entityId;if(entityId)changed(()=>assignSemanticNode(scene(),entityId,el.value==='none'?null:el.value));return;}
 if(el.dataset.semanticModField){const entityId=el.dataset.entityId,binding=entityId?semanticBindingFor(scene(),entityId):undefined,index=Number(el.dataset.semanticModIndex),mod=binding?.modulations?.[index];if(mod){let value:any=el.value;if(el instanceof HTMLInputElement&&el.type==='number'){value=Number(el.value);if(!Number.isFinite(value)){toast('Enter a finite modulation value; the previous value is unchanged.');renderAll();return;}value=clamp(value,el.min!==''?Number(el.min):-100,el.max!==''?Number(el.max):100);}changed(()=>{const field=el.dataset.semanticModField!;if(field==='source.kind')mod.source={kind:String(value) as typeof mod.source.kind};else if(field==='target')mod.target=String(value) as typeof mod.target;else if(field==='amount')mod.amount=Number(value);else if(field==='offset')mod.offset=Number(value);});}return;}
 if(el.dataset.semanticBind){const entityId=el.dataset.entityId;if(entityId){let value:any=el instanceof HTMLInputElement&&el.type==='checkbox'?el.checked:el.value;if(el instanceof HTMLInputElement&&el.type==='number'){value=Number(el.value);if(!Number.isFinite(value)){toast('Enter a finite semantic value; the previous value is unchanged.');renderAll();return;}value=clamp(value,el.min!==''?Number(el.min):-1e8,el.max!==''?Number(el.max):1e8);}changed(()=>setSemanticBindingValue(scene(),entityId,el.dataset.semanticBind!,value));}return;}
 if(el.dataset.semanticGlobal){let value:any=el instanceof HTMLInputElement&&el.type==='checkbox'?el.checked:Number(el.value);if(el.dataset.semanticGlobal==='globalColorGain'&&!Number.isFinite(value)){toast('Enter a finite colour gain; the previous value is unchanged.');renderAll();return;}changed(()=>{const field=ensureSemanticField(scene());if(el.dataset.semanticGlobal==='enabled')field.enabled=!!value;else if(el.dataset.semanticGlobal==='globalColorGain')field.globalColorGain=clamp(Number(value),0,100);});return;}
 if(el.dataset.bind){if(el instanceof HTMLInputElement&&(el.type==='checkbox'||el.type==='radio')||el.value!==el.dataset.originalValue)applyBinding(el);return;}if(el.id.startsWith('capture-'))readCapture();
 if(el.dataset.palette){const i=Number(el.dataset.palette);changed(()=>{scene().engine.paletteSource='custom';scene().field.palette[i]=el.value;});}
 if(el.id==='placement-glyph')glyphChoice=el.value.trim()||'O';
 if(el.id==='keep-placing')keepPlacing=(el as HTMLInputElement).checked;
 if(el.id==='working-depth'){const v=Number(el.value);if(Number.isFinite(v))camera.depth=clamp(v,-10,10);renderAll();}
 if(el.id==='working-plane'){camera.plane=el.value as Camera['plane'];if(camera.mode==='2d')facePlane(camera);renderAll();}
 if(el.dataset.action==='source-entity'){selected=[el.value];stepIndex=0;renderAll();}
 if(el.dataset.action==='source-step'){stepIndex=Number(el.value);const e=selectedEntity();if(e&&!e.sequence.enabled&&!e.sequence.manual)changed(()=>syncHeldState(e,stepIndex));else renderAll();}
 if(el.dataset.action==='source-kind'){const e=selectedEntity();if(e&&!e.locked)changed(()=>{useStateShape(e,stepIndex);setStateSource(e,stepIndex,el.value==='ascii'?{kind:'ascii',ascii:{text:'O  :  I',fontFamily:'monospace',fontSize:32}}:el.value==='image'?{kind:'image',image:{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1}}:undefined);if(scene().engine.autoFitSizes!==false){if(e.sequence.steps[stepIndex]?.source)refitStepForSource(e,stepIndex);else refitStepForGlyph(e,stepIndex,e.sequence.steps[stepIndex].text,{fontFamily:scene().engine.fontFamily,fontWeight:scene().engine.fontWeight});}syncHeldState(e,stepIndex);});}
 if(el.id==='monitor-lane'){monitoredLane=el.value;renderAll();return;}if(el.id==='workspace-appearance'){workspace.appearance=el.value as typeof workspace.appearance;saveWorkspace();renderAll();}
 if(el.dataset.action==='sequence-mode'){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId;const entity=scene().entities.find(v=>v.id===id);if(entity&&!entity.locked)changed(()=>{entity.sequence.enabled=el.value==='play';entity.sequence.manual=el.value==='manual';if(el.value==='hold')syncHeldState(entity,stepIndex);if(el.value==='manual'){scene().engine.autoOscillate=false;scene().engine.morphEnabled=true;}});}
 // Layer editing: depth, glyph text and inline ASCII per layer of the laminated body.
 if(el.dataset.layerDepth!==undefined){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.layerIndex),depth=Number(el.value);if(ent&&!ent.locked&&(ent.sequence.steps[stepIndex]?.layers??ent.layers)?.[idx]&&Number.isFinite(depth))changed(()=>editStateLayers(ent,stepIndex,()=>{ent.layers![idx].z=clamp(depth,-100,100);}));}
 if(el.dataset.layerText!==undefined){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.layerIndex);if(ent&&!ent.locked&&(ent.sequence.steps[stepIndex]?.layers??ent.layers)?.[idx])changed(()=>editStateLayers(ent,stepIndex,()=>{ent.layers![idx].text=el.value;}));}
 if(el.dataset.layerAscii!==undefined){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.layerIndex);if(ent&&!ent.locked&&(ent.sequence.steps[stepIndex]?.layers??ent.layers)?.[idx])changed(()=>editStateLayers(ent,stepIndex,()=>{const l=ent.layers![idx];l.source=l.source?.kind==='ascii'?{kind:'ascii',ascii:{...l.source.ascii,text:el.value}}:{kind:'ascii',ascii:{text:el.value,fontFamily:'monospace'}};}));}
 if(el.dataset.action==='sequence-entity'||el.dataset.action==='monitor-formation'){selected=[el.value];stepIndex=0;renderAll();}
 if(el.dataset.action==='font-family'){void action('font-family',el).catch(error);return;}
});
document.addEventListener('focusout',ev=>{const el=ev.target;if((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)&&el.isConnected&&el.dataset.bind&&el.type!=='range'&&el.type!=='checkbox'){if(el.dataset.cancelCommit){delete el.dataset.cancelCommit;return;}if(el instanceof HTMLTextAreaElement||el.value!==el.dataset.originalValue)applyBinding(el);}});
document.addEventListener('focusin',ev=>{const el=ev.target;if((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)&&el.dataset.bind){el.dataset.originalValue=el.value;delete el.dataset.liveEditValue;delete el.dataset.cancelCommit;}});
document.addEventListener('keydown',ev=>{if(ev.defaultPrevented)return;const el=ev.target as HTMLElement;const typing=el.closest('input,textarea,select,[contenteditable="true"]');if(researchInstruments?.active()){if(libraryOpen){if(ev.key==='Escape'&&!document.querySelector('dialog[open]')){ev.preventDefault();if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();}else closeLibrary();}return;}if(!typing&&!document.querySelector('dialog[open]')&&(ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='z'){ev.preventDefault();void action(ev.shiftKey?'redo':'undo',el);}return;}if(typing){if(ev.key==='Escape'){if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();return;}if(el instanceof HTMLInputElement&&el.dataset.originalValue!==undefined){el.value=el.dataset.originalValue;el.dataset.cancelCommit='true';}el.blur();return;}if(ev.key==='Enter'&&!(el instanceof HTMLTextAreaElement)){ev.preventDefault();if(el instanceof HTMLInputElement&&el.dataset.bind)applyBinding(el);else el.blur();}return;}if(document.querySelector('dialog[open]'))return;if(libraryOpen){if(ev.key==='Escape'){if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();return;}ev.preventDefault();closeLibrary();}return;}if(ev.key==='Escape'&&(modesOpen||captureOpen)){ev.preventDefault();readCapture();modesOpen=false;captureOpen=false;renderAll();return;}
 if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='z'){ev.preventDefault();void action(ev.shiftKey?'redo':'undo',el);return;}
 if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='s'){ev.preventDefault();void action('native-save',el);return;}
 if(ev.metaKey||ev.ctrlKey||ev.altKey)return;
 if(ev.key==='Escape'){if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();return;}if(propertyTake){finishPropertyTake();return;}if(beltPickerOpen){beltPickerOpen=false;renderAll();return;}if(contextKind){contextKind='';renderAll();return;}if(studioOpen){setStudio(false);return;}if(presenting){presenting=false;renderAll();}else if(placementStep||shapePickerOpen){placementStep=false;shapePickerOpen=false;cursorTool='select';tool='select';renderAll();}else if(timelineOpen){timelineOpen=false;renderAll();}else if(inspectorOpen){inspectorOpen=false;railExpanded=false;renderAll();}else if(editing)edit(false);return;}
 if((ev.target as Element|null)?.closest('.nara-kept-answer')&&['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(ev.key))return;
 if(ev.key===' '){ev.preventDefault();toggleScenePlay();needsFrame=true;return;}
 const shortcuts:Record<string,string>={e:'edit',p:'tool-pin',v:'tool-select',i:'tool-interact',a:'tool-formation',t:'tool-text',o:'tool-orbit',g:'grid',f:presenting?'exit-present':'present'};
 if(shortcuts[ev.key.toLowerCase()]){ev.preventDefault();void action(shortcuts[ev.key.toLowerCase()],el);return;}
 if((ev.target as Element|null)?.closest('.nara-kept-answer')&&['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(ev.key))return;
 if(ev.key.startsWith('Arrow')){ev.preventDefault();if(editing&&selected.length){if(selected.some(id=>blueprintMember(scene(),id))){toast('Use Blueprint to move the whole shape.');return;}const amount=ev.shiftKey?.1:.01;changed(()=>scene().entities.filter(e=>selected.includes(e.id)&&!e.locked).forEach(e=>{if(ev.key==='ArrowLeft')e.position.x-=amount;if(ev.key==='ArrowRight')e.position.x+=amount;if(ev.key==='ArrowUp')e.position.y+=amount;if(ev.key==='ArrowDown')e.position.y-=amount;e.position.x=clamp(e.position.x,-50,50);e.position.y=clamp(e.position.y,-50,50);}));}else if(ev.key==='ArrowLeft')void setScene(sceneIndex-1).catch(error);else if(ev.key==='ArrowRight')void setScene(sceneIndex+1).catch(error);}
 if((ev.key==='Delete'||ev.key==='Backspace')&&editing&&selected.length){ev.preventDefault();deleteEntities();}
});
$<HTMLInputElement>('source-file').addEventListener('change',async ev=>{const input=ev.target as HTMLInputElement,file=input.files?.[0],id=sourceUploadEntityId;if(!file||!id)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8_000_000)throw new Error('Use a PNG, JPEG or WebP smaller than 8 MB.');const url=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Image file could not be read'));r.readAsDataURL(file);});const s=store.document.scenes.find(s=>s.id===id.sceneId),e=s?.entities.find(e=>e.id===id.entityId);if(!s||!e||e.locked)return;
  if(id.layerId){const layerIndex=e.sequence.steps.findIndex(k=>k.id===id.stepId);if(layerIndex<0||!(e.sequence.steps[layerIndex].layers??e.layers)?.some(l=>l.id===id.layerId))return;changed(()=>editStateLayers(e,layerIndex,()=>{e.layers=(e.layers??[]).map(l=>l.id===id.layerId?{...l,source:{kind:'image',image:{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1,dataUrl:url,name:file.name}}}:l);}));toast('Layer sampled: '+file.name,5000);return;}
  let index=id.append?e.sequence.steps.length:e.sequence.steps.findIndex(k=>k.id===id.stepId);if(index<0||id.append&&index>=32)return;
  // Pre-sample with the same normalization the engine will run, so the toast
  // reports the real cutout and the square extent preserves the subject aspect.
  const visual=await sourceVisual('image',url,{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1},{paper:s.field.background,ink:s.field.palette[0]});
  if(store.document.scenes.find(sc=>sc.id===s.id)?.entities.find(ent=>ent.id===e.id)!==e||e.locked)return;
  if(!id.append){index=e.sequence.steps.findIndex(k=>k.id===id.stepId);if(index<0)return;}
  changed(()=>{const source:Entity['source']={kind:'image',image:{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1,dataUrl:url,name:file.name}};if(id.append)index=appendFormationState(e,'',source,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight},s.engine.autoFitSizes!==false);else{useStateShape(e,index);setStateSource(e,index,source);if(s.engine.autoFitSizes!==false)refitStepForSource(e,index);}if(scene().id===s.id){selected=[e.id];stepIndex=index;}syncHeldState(e,index);});
  toast('Sampled: '+describeAnalysis(visual.analysis,'image'),6500);
 }catch(err){error(err);}finally{input.value='';sourceUploadEntityId=null;}});
$<HTMLInputElement>('import-file').addEventListener('change',async ev=>{const input=ev.target as HTMLInputElement,file=input.files?.[0];if(!file)return;try{if(file.size>32_000_000)throw new Error('Choose a configuration smaller than 32 MB.');const result=importDocuments(JSON.parse(await file.text()));collectImported(result.journeys);if(!libraryOpen)openLibrary();else renderLibrary();toast(`${result.journeys.length} document(s) imported. ${result.errors.length?result.errors.map(e=>`Entry ${e.index+1}: ${e.message}`).join(' · '):'All accepted; original input is unchanged.'}`,10000);}catch(err){error(err);}finally{input.value='';}});
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d=>d.addEventListener('click',ev=>{if(ev.target!==d)return;const r=d.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)d.close();}));
let sceneDragIndex=-1;
$('timeline-panel').addEventListener('dragstart',ev=>{const card=(ev.target as Element).closest<HTMLElement>('[data-scene-index]');if(!editing||!card)return;sceneDragIndex=Number(card.dataset.sceneIndex);ev.dataTransfer?.setData('text/plain',String(sceneDragIndex));if(ev.dataTransfer)ev.dataTransfer.effectAllowed='move';});
$('timeline-panel').addEventListener('dragover',ev=>{if(editing&&(ev.target as Element).closest('[data-scene-index]'))ev.preventDefault();});
$('timeline-panel').addEventListener('drop',ev=>{const card=(ev.target as Element).closest<HTMLElement>('[data-scene-index]');if(card&&sceneDragIndex>=0){ev.preventDefault();reorderScene(sceneDragIndex,Number(card.dataset.sceneIndex));sceneDragIndex=-1;}});
function hitEntity(x:number,y:number){if(engine.hitEntity){const id=engine.hitEntity(x,y);return scene().entities.find(e=>e.id===id);}let winner:Entity|undefined,best=25;for(const e of [...scene().entities].reverse()){const p=project(e.position,camera,width,height),d=Math.hypot(x-p.x,y-p.y);if(d<best){best=d;winner=e;}}return winner;}
function positionAt(ev:PointerEvent,plane=camera.plane,depth=camera.depth){return unproject(ev.clientX,ev.clientY,camera,width,height,plane,depth);}
function showCoordinates(v:Vec3){const number=(n:number)=>(Math.abs(n)<.0005?0:n).toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3,signDisplay:'always',useGrouping:false});
 $('coordinates').innerHTML=`<span>X <b>${number(v.x)}</b></span><span>Y <b>${number(v.y)}</b></span><span>Z <b>${number(v.z)}</b></span>`;
}
$('stage').addEventListener('pointerdown',ev=>{if((ev.target as HTMLElement).closest('button,.nara-kept-answer'))return;
 if(libraryOpen)return;
 if(ev.button===0&&cursorTool==='interact'&&tool==='interact'){if(inspectorOpen||studioOpen||contextKind||sequenceOpen||beltOpen||timelineOpen||modesOpen||captureOpen||beltPickerOpen||assignmentGroup||assignmentTarget||selected.length||editing||guidesVisible){inspectorOpen=false;studioOpen=false;contextKind='';sequenceOpen=false;beltOpen=false;timelineOpen=false;modesOpen=false;captureOpen=false;beltPickerOpen=false;assignmentGroup='';assignmentTarget='';selected=[];editing=false;guidesVisible=false;renderAll();}}
 if(ev.button!==0&&ev.button!==2)return;
 if(!presenting&&(ev.button===2||tool==='orbit')){pointer.active=false;drag={kind:'camera',id:'',startX:ev.clientX,startY:ev.clientY,startWorld:{x:0,y:0,z:0},positions:new Map(),initialRadius:0,cam:{...camera},layer:null,pan:ev.button===2||ev.shiftKey};$('stage').setPointerCapture(ev.pointerId);ev.preventDefault();return;}
 if(epiWorld&&!editing&&ev.button===0&&tool==='select'){
  try{
   const body=hitEntity(ev.clientX,ev.clientY),relation=body?null:engine.hitConnection?.(ev.clientX,ev.clientY);
   selected=body?[body.id]:[];nativeSelectedRelation=relation?.binding_ref??null;pointer.active=false;
   void nativeWorkspace?.select(scene().id,body?.id??null,relation?.binding_ref).catch(error=>toast(error instanceof Error?error.message:String(error)));
   overlayDirty=true;needsFrame=true;epiEncounter?.refresh();renderAll();ev.preventDefault();
  }catch(error){toast(error instanceof Error?error.message:String(error));}
  return;
 }
 if(presenting||!editing){if(ev.button===0&&tool==='interact'){try{const w=positionAt(ev);pointer={active:true,world:w};firePointerClick(w);}catch{}}return;}
 try{
  if(placementStep){const e=selectedEntity();if(e&&!e.locked&&!blueprintMember(scene(),e.id)){const p=positionAt(ev);changed(()=>{e.sequence.steps[stepIndex].position={x:p.x-e.position.x,y:p.y-e.position.y,z:p.z-e.position.z};});placementStep=false;inspectorOpen=true;renderAll();}return;}
  if(tool==='interact'){const w=positionAt(ev);pointer={active:true,world:w};firePointerClick(w);return;}
  if(tool==='pin'||tool==='formation'){
   if(scene().entities.length>=32){toast('A scene holds up to 32 formations and pins.');return;}
   const p=positionAt(ev),newEntity=tool==='pin'?pin(p):entity(glyphChoice==='O'?'New formation':glyphChoice,glyphChoice,p);if(tool==='formation'){newEntity.shape=shapeChoice;newEntity.sequence.steps[0].shape=shapeChoice;if(shapeChoice==='text'&&scene().engine.autoFitSizes!==false){const font={fontFamily:scene().engine.fontFamily,fontWeight:scene().engine.fontWeight};refitEntityForGlyph(newEntity,glyphChoice,font);refitStepForGlyph(newEntity,0,glyphChoice,font);}}
   changed(()=>{scene().entities.push(newEntity);selected=[newEntity.id];},false);if(!(tool==='pin'?pinRepeat:keepPlacing)){cursorTool='select';tool='select';shapePickerOpen=false;inspectorOpen=true;tab='objects';}renderAll();showCoordinates(p);return;
  }
  if(tool==='text'||contextKind==='text'&&tool==='select'){const layerEl=(ev.target as HTMLElement).closest<HTMLElement>('[data-text-id]');const t=scene().text.find(t=>t.id===layerEl?.dataset.textId);if(t){textId=t.id;contextKind='text';store.begin();drag={kind:'text',id:t.id,startX:ev.clientX,startY:ev.clientY,startWorld:{x:0,y:0,z:0},positions:new Map(),initialRadius:0,cam:{...camera},layer:clone(t),pan:false};$('stage').setPointerCapture(ev.pointerId);renderInspector();ev.preventDefault();}return;}
  const e=selectedEntity();if(e&&!e.locked&&(e.kind==='pin'||e.force.strength>0)){const handle=project({x:e.position.x+e.force.radius,y:e.position.y,z:e.position.z},camera,width,height);if(Math.hypot(handle.x-ev.clientX,handle.y-ev.clientY)<12){store.begin();drag={kind:'radius',id:e.id,startX:ev.clientX,startY:ev.clientY,startWorld:positionAt(ev,'XY',e.position.z),positions:new Map(),initialRadius:e.force.radius,cam:{...camera},layer:null,pan:false};$('stage').setPointerCapture(ev.pointerId);ev.preventDefault();return;}}
  const hit=hitEntity(ev.clientX,ev.clientY);
  const connection=!hit?engine.hitConnection?.(ev.clientX,ev.clientY):null;
  if(connection){selected=[];nativeSelectedRelation=connection.binding_ref;overlayDirty=true;needsFrame=true;void nativeWorkspace?.select(scene().id,null,connection.binding_ref);ev.preventDefault();return;}
  if(hit){
  if(nativeConnectionRows[scene().id])void nativeWorkspace?.select(scene().id,hit.id);if(!selected.includes(hit.id)||ev.shiftKey)selectEntity(hit.id,ev.shiftKey);if(blueprintMember(scene(),hit.id)){toast('Use Blueprint to move the whole shape, or release it to edit individual positions.');return;}if(hit.locked){toast('This centre is locked. Its sequence is still running.');return;}store.begin();drag={kind:'entity',id:hit.id,startX:ev.clientX,startY:ev.clientY,startWorld:positionAt(ev,'XY',hit.position.z),positions:new Map(scene().entities.filter(e=>selected.includes(e.id)&&!e.locked&&!blueprintMember(scene(),e.id)).map(e=>[e.id,{...e.position}])),initialRadius:0,cam:{...camera},layer:null,pan:false};$('stage').setPointerCapture(ev.pointerId);ev.preventDefault();}
  else{selected=[];overlayDirty=true;needsFrame=true;renderInspector();}
 }catch(err){toast(err instanceof Error?err.message:String(err));}
});
$('stage').addEventListener('pointermove',ev=>{
 try{if(drag){if(drag.kind==='camera'){const dx=ev.clientX-drag.startX,dy=ev.clientY-drag.startY;if(drag.pan){camera.panX=drag.cam.panX+dx;camera.panY=drag.cam.panY+dy;}else{camera.mode='3d';camera.yaw=drag.cam.yaw+dx*.006;camera.pitch=clamp(drag.cam.pitch+dy*.006,-1.5,1.5);}overlayDirty=true;needsFrame=true;return;}
 if(drag.kind==='text'){const t=scene().text.find(t=>t.id===drag!.id);if(t&&drag.layer){t.x=clamp(drag.layer.x+(ev.clientX-drag.startX)/width,-.1,.95);t.y=clamp(drag.layer.y+(ev.clientY-drag.startY)/height,-.1,.95);store.touch();const article=$('text-layers').querySelector<HTMLElement>(`[data-text-id="${t.id}"]`);if(article){article.style.left=t.x*100+'%';article.style.top=t.y*100+'%';}}return;}
 const e=scene().entities.find(e=>e.id===drag!.id);if(!e)return;const p=positionAt(ev,'XY',e.position.z);showCoordinates(p);if(drag.kind==='radius')e.force.radius=clamp(Math.hypot(p.x-e.position.x,p.y-e.position.y),.0125,50);else for(const [id,initial]of drag.positions){const item=scene().entities.find(e=>e.id===id);if(item){item.position.x=clamp(initial.x+p.x-drag.startWorld.x,-50,50);item.position.y=clamp(initial.y+p.y-drag.startWorld.y,-50,50);}}store.touch();overlayDirty=true;needsFrame=true;return;
 }
 const p=positionAt(ev);pointer={active:tool==='interact',world:p};showCoordinates(p);if(tool==='interact')needsFrame=true;
 }catch{pointer.active=false;$('coordinates').textContent='X — · Y — · Z — · plane edge-on';}
});
function endDrag(ev:PointerEvent){if(drag){if(drag.kind!=='camera'){store.finish();markSaved();}drag=null;if($('stage').hasPointerCapture(ev.pointerId))$('stage').releasePointerCapture(ev.pointerId);renderAll();}}
$('stage').addEventListener('pointerup',endDrag);$('stage').addEventListener('pointercancel',endDrag);$('stage').addEventListener('pointerleave',()=>{if(!drag){pointer.active=false;needsFrame=true;}});$('stage').addEventListener('contextmenu',ev=>{if(!presenting)ev.preventDefault();});
$('stage').addEventListener('wheel',ev=>{if((ev.target as Element).closest('.nara-kept-answer'))return;if(ev.ctrlKey||ev.metaKey||(!editing&&cursorTool!=='interact'))return;ev.preventDefault();pointer.active=false;camera.zoom=clamp(camera.zoom*Math.exp(-ev.deltaY*.001),.2,4);overlayDirty=true;needsFrame=true;},{passive:false});
function poly(points:{x:number;y:number}[]){return points.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');}
function drawGuides(){const svg=$('guides');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);if(!editing||presenting||!guidesVisible){svg.innerHTML='';return;}let markup='';
 if(camera.grid){for(let i=-15;i<=15;i++){const v=i/10;const mk=(a:number,b:number):Vec3=>camera.plane==='XY'?{x:a,y:b,z:camera.depth}:camera.plane==='XZ'?{x:a,y:camera.depth,z:b}:{x:camera.depth,y:a,z:b};const a=project(mk(v,-1.5),camera,width,height),b=project(mk(v,1.5),camera,width,height),c=project(mk(-1.5,v),camera,width,height),d=project(mk(1.5,v),camera,width,height);markup+=`<path d="M${a.x},${a.y}L${b.x},${b.y}M${c.x},${c.y}L${d.x},${d.y}" fill="none" stroke="var(--ink)" opacity="${i===0?.25:.075}" stroke-width="${i===0?1:.6}"/>`;}}
 const forms=scene().entities.filter(e=>e.kind==='formation');if(tab==='motion'&&motionTab==='focus'&&scene().composition.focus==='travelling'){const ps=forms.map(e=>project(e.position,camera,width,height));markup+=`<polyline points="${poly(ps)}" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 5" opacity=".6"/>`;}
 for(const e of scene().entities){const p=project(e.position,camera,width,height),isSelected=selected.includes(e.id),r=e.kind==='pin'?7:5,color=isSelected?'var(--accent)':'var(--muted)';
 if(isSelected&&(e.kind==='pin'||e.force.strength>0)){const points=Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return project({x:e.position.x+Math.cos(a)*e.force.radius,y:e.position.y+Math.sin(a)*e.force.radius,z:e.position.z},camera,width,height);});const handle=points[0];markup+=`<polyline points="${poly(points)}" fill="none" stroke="var(--accent)" stroke-width=".8" stroke-dasharray="3 5" opacity=".65"/><circle cx="${handle.x}" cy="${handle.y}" r="4" fill="var(--paper)" stroke="var(--accent)"/><text x="${handle.x+9}" y="${handle.y-7}" fill="var(--muted)" font-family="Arial" font-size="8">falloff</text>`;}
 if(isSelected&&e.kind==='formation'){const co=Math.cos(e.rotation*Math.PI/180),si=Math.sin(e.rotation*Math.PI/180);const corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5],[-.5,-.5]].map(([x,y])=>{const a=x*e.size.x,b=y*e.size.y;return project({x:e.position.x+a*co-b*si,y:e.position.y+a*si+b*co,z:e.position.z},camera,width,height);});markup+=`<polyline points="${poly(corners)}" fill="none" stroke="var(--accent)" stroke-width=".65" opacity=".3" stroke-dasharray="2 4"/>`;}
 if(isSelected&&e.sequence.enabled){const path=e.sequence.steps.map(k=>k.position?project({x:e.position.x+k.position.x,y:e.position.y+k.position.y,z:e.position.z+k.position.z},camera,width,height):p);markup+=`<polyline points="${poly(path)}" fill="none" stroke="var(--accent)" stroke-dasharray="2 6" stroke-width=".8"/>`;path.forEach((pt,i)=>{if(e.sequence.steps[i].position)markup+=`<rect x="${pt.x-3}" y="${pt.y-3}" width="6" height="6" fill="var(--paper)" stroke="var(--accent)"/><text x="${pt.x+7}" y="${pt.y-6}" fill="var(--accent)" font-size="8" font-family="Arial">${i+1}</text>`;});}
 markup+=`<g data-world-marker="${e.id}" data-screen-x="${p.x.toFixed(2)}" data-screen-y="${p.y.toFixed(2)}" transform="translate(${p.x},${p.y})"><circle r="${r+5}" fill="var(--paper)" opacity=".75"/><path d="M-12 0H-5M5 0H12M0-12V-5M0 5V12" fill="none" stroke="${color}" stroke-width=".9"/><circle r="${r}" fill="none" stroke="${color}" stroke-width=".9"/>${e.kind==='pin'?`<text y="3" text-anchor="middle" font-size="9" fill="${color}">${e.force.kind==='repel'?'+':e.force.kind==='vortex'?'↻':'−'}</text>`:''}${isSelected?`<text x="17" y="-13" fill="${color}" font-size="9" font-family="Arial">${esc(e.name)}${e.locked?' · locked':''}</text>`:''}</g>`;
 }
 svg.innerHTML=markup;overlayDirty=false;
}
function resize(){width=innerWidth;height=innerHeight;engine.resize(width,height,physisPixelRatio??(devicePixelRatio||1));renderText();renderLive();overlayDirty=true;needsFrame=true;}
function privateFormGeometry(reading:NativeM3Reading,view:KernelConversion|undefined,sceneId:string){
 const work=nativeWorkspace?.inspect();if(work?.pending||work?.failed)throw Error('Wait for this native Expression and selection to be acknowledged before presenting a private form.');
 if(epiWorld&&(reading.person_ref!==epiWorld.person_ref||reading.nara_ref!==epiWorld.nara_ref
  ||reading.identity_source_ref!==epiWorld.identity_source.source_ref||reading.identity_revision!==epiWorld.identity_source.revision
  ||reading.event_ref!==epiWorld.world.event_ref||!readEpiPersonalContext(view,sceneId)))
  throw Error('Read this saved person and occasion before presenting a private form in this world.');
 return naraFormGeometry(reading,view,sceneId,epiWorld?`${epiWorld.world.instance_ref}:entity:world-current-form-hinge`:undefined);
}
function frameData(delta:number):EngineFrame{const base=activeScene();
 // Recorded takes override base values while the playhead moves; the revision
 // term follows the playhead so the engine rebuilds only when authored content
 // actually changes instead of hashing the whole document every frame.
 const tracksActive=(journeyPlaying||trackPreview)&&!propertyTake&&!!base.propertyTracks?.length;
 let current=effectiveScene(store.document,tracksActive?evaluateTracks(base,sceneElapsed):base);
 const nativeReading=nativeField?.controller.reading.instrument?.influence?.native_readback;
 const nativeWorld=(nativeField?.controller.reading.source as {world?:{instance_ref?:string}}|null|undefined)?.world;
 const admittedReading=epiWorld&&nativeWorld?.instance_ref===epiWorld.world.instance_ref&&(nativeReading as {event_ref?:string;subject_ref?:string}|undefined)?.subject_ref===epiWorld.person_ref&&(nativeReading as {event_ref?:string}|undefined)?.event_ref===epiWorld.world.event_ref?nativeReading:undefined;
 const epi=epiWorld?epiSceneReception(current,epiWorld,admittedReading):null;
 if(epi)current=epi.scene;
 const evidenceView=nativeWorkspace?.nativeView();
 const evidenceAllowed=!epiWorld||!!readEpiPersonalContext(evidenceView,base.id);
 const evidenceProjection=evidenceAllowed?privateEvidenceField?.project(evidenceView,base.id)??null:null;
 let formationGeometryProjection:import('../../src/engine/formationGeometryProjection').FormationGeometryProjection|null=null;
 if(privateFormReading){try{formationGeometryProjection=privateFormGeometry(privateFormReading,nativeWorkspace?.nativeView(),base.id);}catch{privateFormReading=null;naraInstrument.refresh();}}
 formationGeometryProjection=epi?.geometry??formationGeometryProjection;
 return {stationaryFormationAdmission:epiWorld?epiStationaryReception(current,epiWorld,admittedReading,nativeWorkspace?.nativeView()?.document as unknown as import('../../../src/expression/types').ExpressionDocument|undefined):undefined,formationGeometryProjection,localizedResonanceProjection:evidenceProjection?privateEvidenceField?.resonance:null,forceEmitterProjection:evidenceProjection,entitySoundPlan:evidenceProjection?privateEvidenceField?.sound:undefined,connections:nativeConnectionRows[base.id],selectedConnection:nativeSelectedRelation,connectionFocusIds:epiWorld?selected:undefined,sourceBodyPicking:!!epiWorld,connectionRestOpacity:epiWorld?.receiving.scene_ref===base.id?0.12:1,scene:current,scaffold:editing&&!presenting&&guidesVisible?current.view.nativeScaffold??'off':'off',simTime,delta,params:(()=>{const p=engine.capabilities.kind==='production'?current.field.params:evaluateParameters(current,simTime);return physisParticleCap&&p.count>physisParticleCap?{...p,count:physisParticleCap}:p;})(),camera,pointer,selectedIds:(editing&&!presenting&&guidesVisible)||!!epiWorld?selected:[],authoringRevision:store.revision*1e7+epiReceptionRevision*1e3+(tracksActive?1+Math.floor(sceneElapsed*60):0)};}
function recordableTracks(){return workspace.entries.flatMap(entry=>{const subject=entry.scope==='selected'?(selectedEntity()??scene().entities.find(e=>e.kind==='formation')):scene().entities.find(e=>e.id===entry.entityId);const bind=entry.scope==='field'?PARAMETERS.find(p=>p.key===entry.key)?.bind:subject?entityTargets(scene()).find(t=>t.entityId===subject.id&&t.key===entry.key)?.bind:undefined;if(!bind)return [];const track:PropertyTrack={id:uid('track'),bind,entityId:entry.scope==='field'?undefined:subject?.id,points:[]};return isShared(store.document,scene(),bind)||readTrackValue(scene(),track)===undefined?[]:[track];});}
function finishPropertyTake(){if(!propertyTake)return;const take=propertyTake;propertyTake=null;if(take.elapsed>0){const end=Math.min(3600,take.start+take.elapsed);for(const t of take.tracks){const value=readTrackValue(scene(),t);if(value!==undefined&&t.points.at(-1)?.time!==end)t.points.push({time:end,value});}changed(()=>{scene().propertyTakeRange={start:take.start,end};scene().propertyTracks=mergeTake(scene().propertyTracks??[],take.tracks,take.start,end);scene().duration=Math.max(scene().duration,end);});takeWindows.set(scene().id,{start:take.start,end});sceneElapsed=take.start;trackPreview=true;scenePlaying=false;toast('Property take recorded · save the scene to keep this version.');}renderAll();}
function updatePropertyTake(now:number){const t=propertyTake;if(!t)return;if(t.sceneId!==scene().id){finishPropertyTake();return;}const remaining=Math.max(0,Math.ceil((t.armed-now)/1000));$('take-status').hidden=false;$('take-status').textContent=remaining?'Recording in '+remaining+'…':'Recording '+t.elapsed.toFixed(1)+'s · click record to stop';if(remaining)return;const elapsed=Math.min((now-t.armed)/1000,3600-t.start,t.limit??Infinity);t.elapsed=elapsed;sceneElapsed=t.start+elapsed;scenePlaying=true;if(elapsed-t.lastSample>=.05||t.lastSample<0){for(const track of t.tracks){const value=readTrackValue(scene(),track);if(value===undefined)continue;sampleTrack(track,t.start+elapsed,value,t.start+Math.max(0,t.lastSample));}t.lastSample=elapsed;}if(t.start+elapsed>=3600||t.limit!==undefined&&elapsed>=t.limit)finishPropertyTake();}
let frames=0,lastFpsTime=performance.now(),fps=0,rafId=0;
function tick(now:number){if(researchInstruments?.active()&&!researchPreview){nativeField?.controller.frame(0,true);lastTime=now;rafId=requestAnimationFrame(tick);return;}updatePropertyTake(now);const rawDelta=Math.max(0,Math.min((now-lastTime)/1000,.25));lastTime=now;let delta=!fieldPaused&&!document.hidden&&!libraryOpen?Math.min(rawDelta,.05):0;delta=nativeField?.controller.frame(delta,fieldPaused||document.hidden||libraryOpen)??delta;const previousTime=simTime;if(engine.capabilities.kind!=='production'){delta*=scene().field.params.timeScale;simTime+=delta;}
 if(recovery.hidden&&!libraryOpen&&(!fieldPaused||needsFrame||engine.needsRender?.()||pointer.active||recorder.active||transitionDuration>0)&&now-lastStudioRender>=(physisFpsCap?1000/physisFpsCap:0)){try{engine.render(frameData(delta));needsFrame=false;lastStudioRender=now;}catch(err){nativeField?.controller.hold('native surface render failed: '+String(err));needsFrame=false;if(String(err).toLowerCase().includes('context'))recovery.hidden=false;else error(err);transportUI();}}
 const native=engine.telemetry?.();if(native){simTime=native.simTime;delta=simTime-previousTime;document.documentElement.style.setProperty('--paper',native.background);document.documentElement.style.setProperty('--ink',native.palette[0]);$('text-layers').style.opacity=String(.25+.75*native.transition);}
 // A finished property preview holds its recorded end values; the field itself
 // keeps breathing. The playhead runs only while the scene plays, and reaching
 // the scene's end stops it — the transport returns to Play.
 if(scenePlaying&&!propertyTake&&delta>0&&!libraryOpen){sceneElapsed=Math.min(scene().duration,sceneElapsed+Math.min(rawDelta,.25));
  if(sceneElapsed>=scene().duration-.001&&!journeyPlaying){scenePlaying=false;transportUI();}}
 if(journeyPlaying&&scenePlaying&&!editing&&!libraryOpen&&!epiDeparture){sceneElapsed+=Math.min(rawDelta,.25);if(sceneElapsed>=activeScene().duration){const indices=savedSceneIndices(store.document),next=indices.indexOf(sceneIndex)+1;if(next>=indices.length&&!store.document.loop){journeyPlaying=false;scenePlaying=false;sceneElapsed=0;applySceneView();renderAll();}else{void setScene(indices[next%indices.length],true).then(changed=>{if(changed)fireAutomations(true);}).catch(error);}}}
 if(transitionDuration>0){const f=clamp((simTime-transitionStart)/Math.max(.01,transitionDuration),0,1);$<HTMLCanvasElement>('transition-canvas').style.opacity=String(1-applyEasing(f,transitionEasing));if(f>=1){transitionDuration=0;$('transition-canvas').hidden=true;}}
 if(overlayDirty&&!libraryOpen)drawGuides();if(recorder.active){const paperScene={...activeScene(),field:{...activeScene().field,background:native?.background??scene().field.background,palette:native?.palette??scene().field.palette,params:{...scene().field.params,...native?.params}}};const copy=()=>recorder.frame(engine.canvas,paperScene,width,height,captureTransition());try{if(engine.withCleanFrame)engine.withCleanFrame(copy);else copy();}catch(err){recorder.stop();error(err);}}frames++;
 if(now-lastFpsTime>1000){fps=Math.round(frames*1000/(now-lastFpsTime));frames=0;lastFpsTime=now;}
 if(now-lastUI>33){const s=activeScene(),timing=expressionTiming(store.document,sceneIndex,sceneElapsed,journeyPlaying),fraction=clamp(timing.time/timing.total,0,1);$('global-time').textContent=timing.time.toFixed(1)+' / '+timing.total.toFixed(1)+'s';const playhead=$<HTMLInputElement>('expression-playhead');if(playhead&&document.activeElement!==playhead)playhead.value=String(timing.time);$('journey-progress').style.width=fraction*100+'%';document.querySelectorAll<HTMLElement>('[data-scene-progress]').forEach(e=>e.style.width=(Number(e.dataset.sceneProgress)===sceneIndex?fraction*100:0)+'%');
 const nd=engine.telemetry?.()?.drive;const ph=nd?{theta:nd.theta,phi:nd.phi,drive:nd.progress}:phases(s,simTime);document.querySelectorAll<SVGLineElement>('[data-phase]').forEach(e=>e.setAttribute('transform',`rotate(${(e.dataset.phase==='theta'?ph.theta:ph.phi)*180/Math.PI} 50 50)`));if($('drive-value'))$('drive-value').style.width=ph.drive*100+'%';
 const telemetry=engine.telemetry?.();updateAutomationRuntime(telemetry);document.querySelectorAll<HTMLElement>('[data-formation-live]').forEach(el=>{const entity=s.entities.find(v=>v.id===el.dataset.formationLive),state=telemetry?.sequences?.find((v:any)=>v.entityId===entity?.id);if(!entity||!state)return;const a=entity.sequence.steps[state.linkIndex],b=entity.sequence.steps[state.nextIndex];el.textContent=state.linkCount>1?`${a?stateLabel({...a,source:stateSource(entity,state.linkIndex)}):'State'} → ${b?stateLabel({...b,source:stateSource(entity,state.nextIndex)}):'State'} · ${Math.round(state.progress*100)}%`:'Single target';});const effectivePaper={...s,field:{...s.field,background:telemetry?.background??s.field.background,palette:telemetry?.palette??s.field.palette,params:{...s.field.params,...telemetry?.params}}};paintLivePaper(effectivePaper);const params=telemetry?.params??evaluateParameters(s,simTime);for(const panel of [$('belt-content'),$('inspector-content'),$('automation-monitor'),$('context-panel').querySelector<HTMLElement>('.context-content')??$('context-panel')])updateToolbeltValues(panel,s,params,telemetry?.config);const monitored=s.automation.find(l=>l.id===monitoredLane),live=monitored?telemetry?.live?.find((v:any)=>v.id===(monitored.nativeId??monitored.id)):undefined;if(monitored){const monitor=$('automation-monitor'),target=automationTarget(s,monitored!.target),value=target?(target.target.startsWith('field.')?params[target.key]:Number(readPath(telemetry?.config,target.path))/target.factor):live?.value;monitor.querySelector('[data-cycle-hand]')?.setAttribute('transform',`rotate(${(live?.phase??0)*360} 32 32)`);monitor.querySelector('.cycle-progress')?.setAttribute('stroke-dasharray',`${(live?.phase??0)*100} 100`);const label=monitor.querySelector('[data-cycle-value]');if(label)label.textContent=Number(value).toFixed(3);const phase=monitor.querySelector('[data-cycle-phase]');if(phase)phase.textContent=!live?'Paused':live.done?'Done':Math.round(live.phase*100)+'%';}document.querySelectorAll<HTMLElement>('[data-source-status]').forEach(el=>el.textContent=telemetry?.sourceStatus?.[el.dataset.sourceStatus!]??'');const contribution=document.querySelector<HTMLElement>('[data-focus-contribution]');if(contribution){const col=telemetry?.config?.composition;contribution.textContent=`Palette → stored entity tint (${Math.round((selectedEntity()?.tintWeight??0)*(col?.entityTintWeight??1)*100)}%) → ${telemetry?.focus?'travelling focus ('+Math.round((col?.orchestration?.focusTintWeight??0)*100)+'%)':'no focus tint'}. Selection does not retune the field.`;}document.querySelectorAll<HTMLElement>('[data-live-target]').forEach(el=>{const target=automationTarget(s,el.dataset.liveTarget!);if(!target)return;const value=target.target.startsWith('field.')?params[target.key]:readPath(telemetry?.config,target.path);el.textContent=typeof value==='number'?(target.target.startsWith('field.')?value:value/target.factor).toFixed(3):target.value.toFixed(3);});document.querySelectorAll<HTMLElement>('[data-live-param]').forEach(e=>e.textContent=(params[e.dataset.liveParam!]??0).toFixed(2));const ent=selectedEntity();if(ent){const nt=engine.telemetry?.()?.sequences.find((v:any)=>v.entityId===ent.id);const seq=nt?{from:nt.linkIndex}:sequenceAt(ent,s,simTime);document.querySelectorAll<HTMLElement>('[data-step-live]').forEach(e=>e.classList.toggle('is-playing',ent.sequence.enabled&&Number(e.dataset.stepLive)===seq.from));}
 const nf=engine.telemetry?.()?.focus;const focus=nf?{entity:{id:nf.entityId}}:engine.capabilities.kind==='production'?null:focusAt(s,simTime);document.querySelectorAll<HTMLElement>('[data-focus-entity]').forEach(e=>e.classList.toggle('is-playing',e.dataset.focusEntity===focus?.entity.id));if(recorder.active){const t=Math.floor(recorder.elapsed);$('record-time').textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');$('record-size').textContent=`${captureSettings.width}px · ${fps} render fps`;if(t>=4&&fps>0&&fps<20&&!recordPerformanceWarned){recordPerformanceWarned=true;toast('Recording is below its 30 fps target. Reduce particle allocation or output size for this device.',7000);}}lastUI=now;
 }
 rafId=requestAnimationFrame(tick);
}
window.addEventListener('resize',()=>{if(recorder.active){recorder.stop();toast('Recording stopped to preserve its established frame after a window resize.');}resize();});document.addEventListener('visibilitychange',()=>{lastTime=performance.now();if(document.hidden)void flushDraft();if(document.hidden&&propertyTake)finishPropertyTake();if(document.hidden&&recorder.active){recorder.stop();toast('Recording stopped because this tab became hidden.');}});
// The desktop shell's window-corner cutout geometry, when hosted (owner
// addendum 2026-09-19): the host posts the live cutout width/height so the
// masthead aligns with the shell's traffic-lights corner cutout. Standalone,
// the CSS defaults hold.
//
// The host↔frame MODE channel (owner wayfinder 2026-09-19, PR #387 §11–13):
// One Expressions system, two operating cuts. The active Technè instrument
// chooses its body and controls together; the underlying document is retained.
// Research bodies suspend the physical producer and its input, while native
// particle modes keep the scene controls. Expressions restores its full HUD. The host also
// drives the rail's primary direct modes through {v:1,kind:'host-command'}.
// Every host-mode message is answered with a fresh oi-app-state announcement
// (hostedApp.trackHostedAppState), which is also the race-free initial read.
let hostMode:'expressions'|'techne'=new URLSearchParams(location.search).get('mode')==='techne'?'techne':'expressions';
// The world lens the host stands in (workspace.current.context.world). Read
// from ?world= or an optional host-mode `world`; the Epi-Logos world opens the
// Studio on the live instrument the first time, never overriding a choice.
let worldLens:string|null=new URLSearchParams(location.search).get('world');let instrumentOffered=false;
let livedRailHTML='';
// One rail in both modes: Technē keeps the Expressions tools; the active
// instrument's own tools sit beside them in #instrument-tools.
function renderRail(){}
function hostRequest(payload:{request:string;mode?:string;detail?:{kind:string;lens?:string;ref?:string;subject?:NativeSubject;context?:{node?:unknown;relationField?:unknown}}}){
 if(window.parent===window)return;
 try{window.parent.postMessage({v:1,kind:'host-request',...payload},'*');}catch{/* nothing sent rather than a wrong-channel throw */}
}
function announceHostState(){
 if(window.parent===window)return;
 try{
  const s=scene(),view=nativeWorkspace?.nativeView(),binding=view?.bindings[s.id];
  const state={nativeScene:view&&binding?{expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref}:undefined,document:awaitingNativeBoot&&!nativeWorkspace?.nativeView()?undefined:{id:nativeWorkspace?.nativeView()?.document.expression_ref??store.document.id,name:store.document.name},sceneIndex,sceneCount:store.document.scenes.length,sceneName:s.name,sceneState:sceneSaveState(store.document,s),
   selection:selected.map(id=>{const e=scene().entities.find(v=>v.id===id);return {id,name:e?e.name:undefined};}),tool,playing:scenePlaying,journeyPlaying,fieldPaused,libraryOpen,hostMode};
  window.parent.postMessage({v:1,kind:'oi-app-state',state},'*');
 }catch{/* nothing is announced rather than a wrong position */}
}
function setHostMode(mode:'expressions'|'techne'){
 if(hostMode===mode)return;
 hostMode=mode;
 document.body.classList.toggle('oi-host-techne',mode==='techne');
 renderRail();
 lensStudio.setMode(mode);
 if(mode==='expressions'){researchInstruments?.close();palaceInstrument.close();setInstrumentSurface(null);}else activateInstrument(lensStudio.active());
 renderAll();
}
// Open an existing native Expression the host asked for at runtime — a
// constellation just constructed in the Wiki, a Library subject, a returned
// composition. It opens in place through the native workspace (kernel inspect,
// no iframe reload). This is a subject change (§28): the field then stands on
// the opened work's own scene, camera and selection, it does not preserve the
// previous field. If the kernel channel has not been announced yet it opens on
// that announce, exactly as the boot ?expression= deep link does. Refs only —
// the kernel document is the store, and a bad ref is refused by the owner.
let pendingHostOpen:string|null=null,hostOpenArmed=false;
let hostThemeReadingKey='';
function openHostExpression(ref:string){
 if(typeof ref!=='string'||!ref.startsWith('expression:'))return;
 if(kernelExpressionsAvailable()){void nativeWorkspace?.follow(ref);return;}
 // Buffer the LATEST ref and arm exactly one announce listener (not one per
 // pre-ready call), so repeated posts before the channel is up converge to a
 // single last-wins open and no message listeners accumulate.
 pendingHostOpen=ref;
 if(hostOpenArmed)return;
 hostOpenArmed=true;
 window.addEventListener('message',function ready(event){if(event.source===window.parent&&event.data?.v===1&&event.data?.kind==='oi-kernel-channel'){window.removeEventListener('message',ready);hostOpenArmed=false;const r=pendingHostOpen;pendingHostOpen=null;if(r)void nativeWorkspace?.follow(r);}});
}
window.addEventListener('message',ev=>{if(ev.source!==window.parent)return;const d=ev.data as {type?:string;width?:number;height?:number;right?:number;coveredRight?:number;appearance?:unknown;theme?:unknown;v?:unknown;kind?:unknown;mode?:unknown;command?:unknown;ref?:unknown;req?:unknown;target?:unknown;source?:unknown}|null;
 if(d&&d.type==='oi-shell-cutout'&&typeof d.width==='number'&&typeof d.height==='number'){
  if(d.appearance==='dark'||d.appearance==='light'){hostedAppearance=d.appearance;theme();}
  // The host's resolved theme reading re-derives the default expression's
  // colours (background and particle palette) — the theme→expression
  // relation. Presentation derivation: never persisted as authored change.
  // A reading unchanged since the last post (geometry-only updates) applies
  // nothing: the recolour follows the theme, not the shell's movement.
  if(d.theme){const reading=JSON.stringify(d.theme);if(reading!==hostThemeReadingKey){hostThemeReadingKey=reading;if(rethemeMark(store.document,d.theme as MarkThemeReading))renderAll();}}
  document.documentElement.style.setProperty('--shell-cutout-w',Math.max(0,d.width)+'px');
  document.documentElement.style.setProperty('--shell-cutout-h',Math.max(24,d.height)+'px');
  document.documentElement.style.setProperty('--shell-cutout-r',Math.max(0,typeof d.right==='number'?d.right:0)+'px');
  document.documentElement.style.setProperty('--shell-covered-right',(Number.isFinite(d.coveredRight)?Math.max(0,d.coveredRight!):0)+'px');
  return;
 }
 if(d&&d.v===1&&d.kind==='host-mode'&&(d.mode==='expressions'||d.mode==='techne')){const world=(d as {world?:unknown}).world;if(typeof world==='string'&&world.length<=64)worldLens=world;if(worldLens==='epi-logos')closeEntryGate();setHostMode(d.mode);announceHostState();return;}
 if(d&&d.v===1&&d.kind==='host-command'){
  if(d.command==='interact'||d.command==='select')activateRail(d.command);
  else if(d.command==='open-expression'&&typeof d.ref==='string'){if((d as {refresh?:unknown}).refresh===true&&kernelExpressionsAvailable())void nativeWorkspace?.refreshReference(d.ref);else openHostExpression(d.ref);}
  else if(d.command==='lens'&&typeof (d as {lens?:unknown}).lens==='string'&&['project','canvas','timeline','journey','place','palace'].includes((d as {lens:string}).lens)){if(hostMode!=='techne')setHostMode('techne');lensStudio.select((d as {lens:LensId}).lens);}
  else if(d.command==='refresh-expression'&&typeof d.ref==='string')void nativeWorkspace?.refreshReference(d.ref);
  else if(d.command==='insert-source'&&typeof d.req==='string'){
   const req=d.req,target=d.target as {expression_ref?:unknown;revision?:unknown;scene_ref?:unknown}|undefined,source=d.source as {title?:unknown;binding?:unknown}|undefined;
   void (async()=>{
    try{
     const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];
     if(!nativeWorkspace||!view||!binding||target?.expression_ref!==view.document.expression_ref||target.revision!==view.document.revision||target.scene_ref!==binding.scene_ref)throw new Error('The current Scene changed while the source was being read. Insert it again from this Scene.');
     if(typeof source?.title!=='string'||!source.binding||typeof source.binding!=='object')throw new Error('The native source reading is incomplete.');
     await nativeWorkspace.insertSource({expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref,title:source.title,binding:source.binding as import('./kernelDocumentBridge.js').KernelSubject});
     announceHostState();window.parent.postMessage({v:1,kind:'host-insertion-result',req,ok:true},'*');
    }catch(error){window.parent.postMessage({v:1,kind:'host-insertion-result',req,ok:false,error:error instanceof Error?error.message:String(error)},'*');}
   })();
  }
  else console.warn('[oi] refused host command: '+String(d.command));
  return;
 }
});
window.addEventListener('pagehide',()=>{if(propertyTake)finishPropertyTake();recorder.stop();lastLibraryWrite=0;void flushDraft();});
const nativeField=installNativeField(engine,()=>{fieldPaused=false;needsFrame=true;renderAll();},()=>{needsFrame=true;});
// Without a retaining engine there is no native producer to present; the
// Studio nav offers no dead "Live instrument" entry for it.
if(!nativeField)document.querySelector('[data-action="studio-section"][data-value="native"]')?.remove();
window.__FIELD_STUDIES__={getDocument:()=>clone(store.document),getState:()=>({studioOpen,beltOpen,needsFrame,libraryOpen,librarySection,modesOpen,captureOpen,railKey,railExpanded,sceneIndex,selected:[...selected],textId,editing,inspectorOpen,timelineOpen,tool,simTime,sceneElapsed,playing:scenePlaying,scenePlaying,fieldPaused,journeyPlaying,automationLoop,camera:{...camera},fps,recording:recorder.active,pointerActive:pointer.active,engine:engine.capabilities.name,hostMode,activeLens:lensStudio.active()}),project:(v:Vec3)=>project(v,camera,width,height),unproject:(x:number,y:number)=>unproject(x,y,camera,width,height),selectEntity:(id:string)=>selectEntity(id),setScene:(i:number)=>setScene(i),openEditor:(t:InspectorContext['tab'])=>edit(true,t),pause:()=>{fieldPaused=true;needsFrame=true;renderAll();},play:()=>{fieldPaused=false;needsFrame=true;renderAll();},sessionPresence:()=>sessionPresence.inspect(),native:()=>nativeField?.controller.reading,nativeTargets:()=>nativeField?.controller.inspectTargets(),
 // Acceptance probe: advance resident particle mechanics by fixed steps against
 // the targets already presented. No native request, clock or target write.
 probeSteps:(frames:number,dt:number)=>{if(!Number.isInteger(frames)||frames<1||frames>2000||!(dt>0&&dt<=.1))throw new Error('probe steps: 1–2000 frames of (0, 0.1] s');for(let i=0;i<frames;i++)engine.render(frameData(dt));needsFrame=true;return frames;},dispose:()=>{sessionPresence.dispose();researchInstruments?.destroy();nativeField?.dispose();cancelAnimationFrame(rafId);coverObserver?.disconnect();engine.dispose();},command:(cmd:any)=>{engine.command?.(cmd);needsFrame=true;},capabilities:engine.capabilities,inspect:(read=false)=>engine.inspect?.(read),telemetry:()=>engine.telemetry?.(),nativeProject:(v:Vec3)=>engine.projectNative?.(v),capture:(w:number,h:number)=>engine.capture?.(w,h)};
function applyNativeView(view:KernelConversion,preservePosition=false){
 nativeKeptReadings=[];
 const nativeAnswerDocument=view.document as unknown as ExpressionDocument;
 if(readEpiWorldRecord(nativeAnswerDocument))void readKeptAnswers(nativeAnswerDocument).then(async readings=>{
  for(const reading of readings){
   if(nativeWorkspace?.nativeView()?.document!==view.document)return;
   const retained=await worldRequest({operation:'act_inspect',act_ref:reading.record.act_ref});
   if(nativeWorkspace?.nativeView()?.document!==view.document)return;
   await verifyStoredAnswerEdition(nativeAnswerDocument,reading,retained);
  }
  if(nativeWorkspace?.nativeView()?.document===view.document){nativeKeptReadings=readings;renderText();}
 }).catch(failure=>{if(nativeWorkspace?.nativeView()?.document===view.document)toast('Attributed answer material could not be qualified: '+String(failure),7000);});
 awaitingNativeBoot=false;startupRecoveryPending=false;
 epiWorld=readEpiWorldRecord(view.document as unknown as ExpressionDocument);
 // An opened native Expression is what the frame stands on: the entry gate
 // closes and (unless the caller keeps its position) the engine presents the
 // document's current Scene.
 const presented=presentAdoption(view);closeEntryGate();
 const oldScene=scene().id,oldCamera={...camera},oldTime=sceneElapsed,oldSelection=[...selected],oldPlaying=journeyPlaying;
 if(!preservePosition)applyJourney(view.journey,true);else {store.replace(initialiseSceneSaves(initialiseBelts(view.journey)));store.document.updatedAt=view.journey.updatedAt;}
 const desired=preservePosition?oldScene:presented.sceneId;
 sceneIndex=Math.max(0,store.document.scenes.findIndex(s=>s.id===desired));
 if(preservePosition){camera=oldCamera;sceneElapsed=oldTime;selected=oldSelection.filter(id=>scene().entities.some(e=>e.id===id));journeyPlaying=oldPlaying;}
 else {applySceneView();const nativeRef=view.document.selection?.entity_ref;const occurrence=view.bindings[scene().id]?.occurrences.find(o=>o.entity_ref===nativeRef);selected=occurrence?[occurrence.view_entity_id]:[];}
 markSaved();renderAll();announceHostState();void researchInstruments?.refresh();
 if(epiWorld&&!epiConstructing)void receiveEpiWorld(!preservePosition);
}
// The M0′–M5′ Lens Studio stands on the SAME native construction the native
// workspace holds; refreshing it when the construction changes keeps the
// Studio's basis exact without touching the field.
const researchHoldReason='The physical instrument is inactive';
let researchSuspension:symbol|null=null;
function setInstrumentSurface(lens:LensId|null){
 const research=lens==='canvas'||lens==='timeline'||lens==='place';
 document.body.classList.toggle('research-active',research);
 document.body.classList.toggle('palace-active',lens==='palace');
 document.body.dataset.activeInstrument=lens??'expression';
 $('stage').inert=research;
 $('stage').setAttribute('aria-hidden',String(research));
 if(research){
  if(nativeField&&!researchSuspension)researchSuspension=nativeField.controller.suspend(researchHoldReason);
 }else{
  const suspension=researchSuspension;researchSuspension=null;
  if(suspension&&nativeField)void nativeField.controller.releaseSuspension(suspension).catch(error);
  lastTime=performance.now();needsFrame=true;overlayDirty=true;
 }
}
function activateInstrument(lens:LensId){
 // A Studio section that belongs to the instrument being left does not stay
 // open, empty, over the next one.
 const owned:Record<string,LensId>={places:'place',palace:'palace',canvas:'canvas'};
 if(owned[studioSection]&&owned[studioSection]!==lens){inspectorOpen=false;studioSection='formations';tab='objects';}
 setInstrumentSurface(lens);
 pointer.active=false;
 if(drag){if(store.transactionOpen)store.finish();drag=null;markSaved();}
 placementStep=false;keepPlacing=false;pinRepeat=false;
 researchPreview=false;
 // M0/M3/M5 are operating modes of this same Expression and Scene engine.
 // Mature Research Canvas tools are mounted by the research instrument adapter.
 if(lens==='canvas'||lens==='timeline'||lens==='place'){if(propertyTake)finishPropertyTake();if(recorder.active){recorder.stop();toast('Recording stopped before opening the research instrument.');}void researchInstruments?.open(lens==='canvas'?'m1':lens==='timeline'?'m2':'m4');}
 else researchInstruments?.close();
 if(lens==='project'){sequenceOpen=false;timelineOpen=false;inspectorOpen=false;contextKind='';beltPickerOpen=false;}
 if(lens==='journey'){sequenceOpen=false;timelineOpen=true;inspectorOpen=false;contextKind='';beltPickerOpen=false;}
 if(lens==='place'){editing=true;inspectorOpen=true;contextKind='';tab='field';studioSection='places';}
 if(lens==='palace'){if(propertyTake)finishPropertyTake();editing=true;inspectorOpen=true;contextKind='';tab='field';studioSection='palace';void palaceInstrument.open();}
 else palaceInstrument.close();
 renderAll();announceHostState();
}
const masthead=document.querySelector<HTMLElement>('#app > .masthead')!;
// The active instrument's tools live in their own compact floating panel:
// instruments carry different tool counts, so a fixed slot inside the rail
// misaligned the masthead. The dock wraps and scrolls on its own and is
// only present while a 2D instrument is open.
const researchToolsDock=document.createElement('div');researchToolsDock.id='instrument-tools-dock';
const researchTools=document.createElement('div');researchTools.id='instrument-tools';researchTools.className='instrument-tools';researchTools.setAttribute('role','toolbar');researchTools.setAttribute('aria-label','Active instrument tools');
researchToolsDock.append(researchTools);document.body.append(researchToolsDock);
// Canvas/Relations/Places keep the live field one click away: preview it
// without leaving the instrument (the instrument stays mounted beneath).
masthead.querySelector('#tool-rail')!.insertAdjacentHTML('beforeend',ib('research-preview','eye','Preview the live field','aria-pressed="false" data-research-only'));
// The masthead keeps its three cells: rail · centre · actions. The instrument
// chooser joins the centre cell beside the workspace menu.
const mastheadCentre=document.createElement('div');mastheadCentre.className='masthead-centre';
const workspaceCluster=masthead.querySelector('.workspace-cluster')!;workspaceCluster.replaceWith(mastheadCentre);
const lensStudio=installLensStudio({activate:activateInstrument},mastheadCentre);
mastheadCentre.append(workspaceCluster);
nativeWorkspace=installNativeWorkspace({shouldRetainDraft:()=>!(startupRecoveryPending&&store.revision===0&&journeyNavigation===0)&&(!awaitingNativeBoot||store.revision!==0),snapshot:()=>({journey:clone(store.document),sceneId:scene().id,entityId:selected[0]??null}),version:()=>store.revision,load:applyNativeView,toast,summon:(kind,subject)=>hostRequest({request:'summon',detail:{kind,subject}}),correspondence:(rows,selection)=>{nativeConnectionRows=rows;nativeSelectedRelation=selection;needsFrame=true;},status:showNativeStatus,followed:(_ref,readThrough)=>{const panels=followedPanels(readThrough);if(panels.sequence!==null)sequenceOpen=panels.sequence;if(panels.inspector!==null)inspectorOpen=panels.inspector;renderAll();}});
// Acts & reusable material (EXPRESSION-ACT-MATERIAL-V1): roles on this Scene's
// objects/text, save-as-reusable, the material register and act playback,
// beside the saved-scene playback.
installActPanel({journey:()=>store.document,scene,selected:()=>selected,changed:fn=>changed(fn),
 nativeView:()=>nativeWorkspace?.nativeView(),
 nativeEdit:async changes=>{if(!nativeWorkspace?.nativeView())throw new Error('Save this Expression to a Central file first: its native Expression is not open.');await nativeWorkspace.edit(changes);},
 expressionRequest:nativeExpressionRequest,advance:async()=>await nativeWorkspace?.advance()??false,transition:actTransition,toast});
// ES1A/ES1B (O:I #352): the active native Scene's own body and its
// declarative triggers, laid over the live field as real readable material.
sceneBodies=installSceneBodies({
 nativeView:()=>nativeWorkspace?.nativeView(),
 sceneId:()=>scene().id,
 portal:(trigger,basis)=>openScenePortal(trigger.trigger_ref,basis),
 report:message=>toast(message),
 open:ref=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];if(!view||!binding){toast('Open a native Scene before opening its source.');return;}hostRequest({request:'summon',detail:{kind:'source',ref,subject:{ref:view.document.expression_ref,kind:'expression',nativeOwner:'oi',revision:view.document.revision,title:view.document.title,sceneRef:binding.scene_ref,entityRef:null,relationRef:null}}});},
 jumpToScene:sceneRef=>{const view=nativeWorkspace?.nativeView();if(!view){toast('Open a native Scene before jumping to another one.');return;}const entry=Object.entries(view.bindings).find(([,b])=>b.scene_ref===sceneRef);if(!entry){toast('That native Scene is not currently loaded in this view.');return;}const index=store.document.scenes.findIndex(s=>s.id===entry[0]);if(index<0)return;void setScene(index).catch(error);},
});
blueprintHUD=installBlueprintHUD({container:blueprintHome,nativeView:()=>nativeWorkspace?.nativeView(),sceneId:()=>scene().id,apply:intent=>nativeWorkspace!.blueprint(intent)});
const researchContainer=document.createElement('section');
researchContainer.id='research-workspace';researchContainer.setAttribute('aria-label','Research instrument workspace');
// Instrument keyboard handling remains with its actual research component.
// The physical application's document handler stands down while it is active.
document.body.append(researchContainer);
// Node and connection information: a compact card in the Expressions HUD
// language, opened by selecting an anchor or a connection.
const researchInspector=document.createElement('aside');researchInspector.id='research-inspector';researchInspector.className='hud-panel instrument-card';researchInspector.setAttribute('aria-label','Selected node or connection');researchInspector.hidden=true;
document.body.append(researchInspector);
/** Native world-position pin for a view occurrence (read from the native document). */
function pinnedOccurrence(sceneId:string,viewEntityId:string):boolean{const view=nativeWorkspace?.nativeView(),occurrence=view?.bindings[sceneId]?.occurrences.find(o=>o.view_entity_id===viewEntityId);return !!(occurrence&&(view!.document.entities[occurrence.entity_ref] as {pinned?:boolean}|undefined)?.pinned);}
function researchScene(id:string){const value=store.document.scenes.find(item=>item.id===id);if(!value||value.id!==scene().id)throw new Error('The active Scene changed; return to that Scene before editing.');return value;}
async function commitResearch(){if(!await nativeWorkspace?.commit())throw new Error('The native owner did not acknowledge this edit. Your working draft is retained.');}
function ownResearchConnection(ref:string){const value=nativeWorkspace?.nativeView()?.document.relations?.[ref];if(!value||value.native_owner!=='oi')throw new Error('Source relations must be changed through their source owner.');return value;}
function connectionKind(kind:string){if(!kind.trim()||kind.length>120)throw new Error('Choose a connection type of 1–120 characters.');return encodeURIComponent(kind.trim());}
function assertConnectionMembers(sceneId:string,source:string,target:string){researchScene(sceneId);const members=nativeWorkspace?.nativeView()?.bindings[sceneId]?.member_refs;if(!members?.includes(source)||!members.includes(target))throw new Error('Both connection endpoints must belong to the current native Scene.');}
researchInstruments=installResearchInstruments({
 container:researchContainer,tools:researchTools,inspector:researchInspector,placesHome,canvasHome,pageMembers:delta=>nativeWorkspace?nativeWorkspace.page(delta):Promise.resolve(false),read:readTechneReading,
 sceneMaterial:id=>clone(researchScene(id)),
 material:async(id,action:ResearchMaterialAction)=>{const target=researchScene(id);changed(()=>applyResearchMaterial(target,action));await commitResearch();},
 inspectSubject:(ref,context)=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];if(!view||!binding){toast('Open a native Scene before opening its source.');return;}hostRequest({request:'summon',detail:{kind:'source',ref,context,subject:{ref:view.document.expression_ref,kind:'expression',nativeOwner:'oi',revision:view.document.revision,title:view.document.title,sceneRef:binding.scene_ref,entityRef:null,relationRef:null}}});},nativeView:()=>nativeWorkspace?.nativeView(),sceneId:()=>scene().id,
 select:(sceneId,entityId,bindingRef)=>{if(sceneId!==scene().id)return;selected=entityId?[entityId]:[];nativeSelectedRelation=bindingRef??null;void nativeWorkspace?.select(sceneId,entityId,bindingRef);overlayDirty=true;needsFrame=true;if(document.body.classList.contains('research-studio'))renderAll();},
 // A deliberate typed knowledge relationship between the two occurrences'
 // constellation participations. The presentation connection is unchanged.
 relateKnowledge:async(sceneId,input)=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[sceneId];if(sceneId!==scene().id||!view||!binding)throw new Error('Open the native Scene before recording a relationship.');const receipt=await techneConstellationRelate({operation:'relate',expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref,from_entity_ref:input.sourceEntityRef,to_entity_ref:input.targetEntityRef,relation:input.relation,direction:input.direction});if(receipt.expression.state==='ready'){if(!await nativeWorkspace?.advance())toast(`Relationship saved in the constellation (revision ${receipt.frame_revision}). Commit or reconcile your unsaved draft to show it here.`,8000);}else toast(`Relationship saved in the constellation (revision ${receipt.frame_revision}). ${receipt.expression.detail}`,9000);return {relation_ref:receipt.relation_ref,frame_ref:receipt.frame_ref,frame_revision:receipt.frame_revision};},
 // The existing full object/state Studio for this exact occurrence, over the
 // still-active instrument. No second editor or Canvas-only store.
 editObject:(sceneId,entityId)=>{if(sceneId!==scene().id){toast('The active Scene changed; return to that Scene before editing.');return;}if(!scene().entities.some(value=>value.id===entityId)){toast('This occurrence is no longer present.');return;}selected=[entityId];textId=null;stepIndex=0;researchPreview=false;editing=true;inspectorOpen=true;tab='objects';studioSection='formations';renderAll();},
 openSubject:ref=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];if(!view||!binding){toast('Open a native Scene before opening its source.');return;}hostRequest({request:'summon',detail:{kind:'source',ref,subject:{ref:view.document.expression_ref,kind:'expression',nativeOwner:'oi',revision:view.document.revision,title:view.document.title,sceneRef:binding.scene_ref,entityRef:null,relationRef:null}}});},
 move:async(sceneId,entityId,position)=>{if(pinnedOccurrence(sceneId,entityId))throw new Error('This occurrence is pinned in place. Unpin it to move it.');if(blueprintMember(researchScene(sceneId),entityId))throw new Error('Use Blueprint to move the whole shape, or release it to edit individual positions.');const item=researchScene(sceneId).entities.find(value=>value.id===entityId);if(!item||item.locked)throw new Error('This occurrence is locked or no longer present.');if(!Number.isFinite(position.x)||!Number.isFinite(position.y))throw new Error('Position must be finite.');changed(()=>{item.position.x=clamp(position.x,-50,50);item.position.y=clamp(position.y,-50,50);});await commitResearch();},
 // A group gesture (multi-select move, align, distribute, nudge burst) is one
 // store change and one native commit.
 moveMany:async(sceneId,moves)=>{const target=researchScene(sceneId);for(const {entityId,position} of moves){if(pinnedOccurrence(sceneId,entityId))throw new Error('A pinned occurrence is in this selection. Unpin it to move the group.');if(blueprintMember(target,entityId))throw new Error('Use Blueprint to move the whole shape, or release it to edit individual positions.');const item=target.entities.find(value=>value.id===entityId);if(!item||item.locked)throw new Error('This occurrence is locked or no longer present.');if(!Number.isFinite(position.x)||!Number.isFinite(position.y))throw new Error('Position must be finite.');}changed(()=>{for(const {entityId,position} of moves){const item=target.entities.find(value=>value.id===entityId)!;item.position.x=clamp(position.x,-50,50);item.position.y=clamp(position.y,-50,50);}});await commitResearch();},
 // Whole-shape Blueprint acts from Canvas: one native edit each; release and
 // pin are separate, explicit acts.
 transformBlueprint:async(sceneId,transform)=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[sceneId];if(sceneId!==scene().id||!view||!binding)throw new Error('Open the native Scene before changing its blueprint.');await nativeWorkspace!.blueprint({expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref,operation:'transform',transform});},
 releaseBlueprint:async sceneId=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[sceneId];if(sceneId!==scene().id||!view||!binding)throw new Error('Open the native Scene before releasing its blueprint.');await nativeWorkspace!.blueprint({expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref,operation:'release'});},
 pinEntity:async(sceneId,entityRef,pinned)=>{researchScene(sceneId);if(!nativeWorkspace?.nativeView()?.document.entities[entityRef])throw new Error('This occurrence has no native identity to pin.');await nativeWorkspace.edit([{change:'entity_pin',entity_ref:entityRef,pinned}]);},
 // An empty Canvas starts construction through the navigator's Project-scoped
 // creation (native constellation create), then opens the result here.
 createScene:async()=>{if(window.parent===window)throw new Error('Constellation creation needs the desktop host.');hostRequest({request:'new-constellation'});},
 createNote:async(sceneId,position)=>{const target=researchScene(sceneId),item=entity('New note','New note',{...position,z:0});changed(()=>{target.entities.push(item);selected=[item.id];});await commitResearch();},
 duplicateOccurrence:async(sceneId,entityId)=>{researchScene(sceneId);if(!nativeWorkspace)throw new Error('Open a native Scene first.');await nativeWorkspace.duplicateOccurrence(sceneId,entityId);},
 deleteOccurrence:async(sceneId,entityId)=>{if(blueprintMember(researchScene(sceneId),entityId))throw new Error('Release the blueprint before removing a member.');const target=researchScene(sceneId),item=target.entities.find(value=>value.id===entityId);if(!item||item.locked)throw new Error('This occurrence is locked or no longer present.');changed(()=>{target.entities=target.entities.filter(value=>value.id!==entityId);selected=selected.filter(id=>id!==entityId);pruneResearchOccurrence(target,entityId);pruneAutomation(target);});await commitResearch();},
 updateContent:async(sceneId,entityId,text)=>{const item=researchScene(sceneId).entities.find(value=>value.id===entityId);if(!item||item.locked)throw new Error('This occurrence is locked or no longer present.');changed(()=>{item.text=text;item.name=text.split('\n')[0].slice(0,160)||'Note';});await commitResearch();},
 connect:async(sceneId,input)=>{assertConnectionMembers(sceneId,input.sourceEntityRef,input.targetEntityRef);if(input.directionality&&!['directed','forward'].includes(input.directionality))throw new Error('Expression connections are directed. Choose a directed connection.');const id=`${nativeWorkspace!.nativeView()!.document.expression_ref}:relation:connection-${crypto.randomUUID()}`;await nativeWorkspace?.edit([{change:'relation_bind',binding:{binding_ref:id,native_owner:'oi',relation:{ref:`${id}:${connectionKind(input.relationKind)}`,revision:'1',availability:'available'},from_entity_ref:input.sourceEntityRef,to_entity_ref:input.targetEntityRef,provenance:[]}}]);},
 reconnect:async(sceneId,ref,input)=>{assertConnectionMembers(sceneId,input.sourceEntityRef,input.targetEntityRef);const binding=ownResearchConnection(ref);await nativeWorkspace?.edit([{change:'relation_bind',binding:{...binding,from_entity_ref:input.sourceEntityRef,to_entity_ref:input.targetEntityRef}}]);},
 // Expression connections are directed: reversing swaps the exact endpoints;
 // undirected/bidirectional have no presentation representation and refuse.
 updateConnectionDirectionality:async(sceneId,ref,directionality)=>{researchScene(sceneId);const binding=ownResearchConnection(ref);if(directionality==='forward')return;if(directionality!=='backward')throw new Error('Expression connections are directed. Reverse it, or record an undirected constellation relationship.');assertConnectionMembers(sceneId,binding.to_entity_ref,binding.from_entity_ref);await nativeWorkspace?.edit([{change:'relation_bind',binding:{...binding,from_entity_ref:binding.to_entity_ref,to_entity_ref:binding.from_entity_ref}}]);},
 deleteConnection:async(sceneId,ref)=>{researchScene(sceneId);ownResearchConnection(ref);await nativeWorkspace?.edit([{change:'relation_remove',binding_ref:ref}]);},
 updateConnectionKind:async(sceneId,ref,kind)=>{researchScene(sceneId);const binding=ownResearchConnection(ref);await nativeWorkspace?.edit([{change:'relation_bind',binding:{...binding,relation:{...binding.relation,ref:`${ref}:${connectionKind(kind)}`,revision:String(Number(binding.relation.revision)+1)}}}]);},
});
// M5′ Palace: regions are Scenes of the Palace Expression, each disclosing one
// contained Expression as its body with a portal; the guided path is Scene
// order. Everything goes through the kernel Expression owner with CAS.
const palaceSnapshot=(raw:unknown):PalaceDocumentSnapshot&{title:string}=>{const doc=raw as {expression_ref:string;revision:number;title?:string;scenes?:{scene_ref:string;title?:string;body?:{carrier?:string;subject_ref?:string}|null;triggers?:{trigger_ref:string;target?:{kind?:string;subject_ref?:string}}[]}[]};return {expression_ref:doc.expression_ref,revision:doc.revision,title:doc.title??doc.expression_ref,scenes:(doc.scenes??[]).map(scene=>({scene_ref:scene.scene_ref,title:scene.title??'',body:scene.body?{carrier:scene.body.carrier,subject_ref:scene.body.subject_ref}:null,triggers:(scene.triggers??[]).map(trigger=>({trigger_ref:trigger.trigger_ref,target:trigger.target?{kind:trigger.target.kind,subject_ref:trigger.target.subject_ref}:undefined}))}))};};
const palaceInstrument=installPalaceInstrument({
 nativeView:()=>nativeWorkspace?.nativeView(),sceneId:()=>scene().id,
 listExpressions:()=>listKernelExpressions(),
 readExpression:async ref=>palaceSnapshot(await readKernelExpression(ref)),
 composeExpression:async({expression_ref,expected_revision,changes})=>{const data=await nativeExpressionRequest({operation:'edit',expression_ref,expected_revision,actor:'human:techne-palace',changes}) as {state?:string;current_revision?:number;document?:unknown}|null;if(data?.state==='revision_conflict')return {ok:false,reason:`This Palace changed elsewhere (now revision ${data.current_revision}). Nothing was saved; reopen it and try again.`};if(!data?.document||data.state!=='ready')return {ok:false,reason:`The Expression owner did not accept the composition (${String(data?.state)}).`};return {ok:true,document:palaceSnapshot(data.document)};},
 openExpression:ref=>{void nativeWorkspace?.open(ref);},
},palaceHome);
lensStudio.setMode(hostMode);
(document.querySelector('#workspace-menu') as HTMLElement)?.insertAdjacentHTML('beforeend',ib('deep-home','home','Epii home','data-techne-only')+ib('deep-verso','wiki','Verso — the subject\u2019s account and sources','data-techne-only'));
// Save is the primary act: it stays in the masthead at every width, outside
// the history/capture overflow menu.
(document.querySelector('#app .header-actions') as HTMLElement)?.insertAdjacentHTML('afterbegin',ib('native-save','save','Save (⌘S)','id="native-save"'));
Object.assign(window.__FIELD_STUDIES__,{nativeWorking:()=>nativeWorkspace?.inspect(),nativeConnections:()=>engine.inspectConnections?.(),openNative:(reference:string)=>nativeWorkspace?.open(reference),openNativeFile:(path:string,observed?:import('./nativeWorkspace.js').NativeFileOpenBasis)=>nativeWorkspace?.openFile(path,observed)});
const qs=new URLSearchParams(location.search);
const naraInstrument=installNaraInstrument({enterWorld:async identity=>{if(worldLens!=='epi-logos'&&!epiWorld)return;await enterEpiWorld(identity);naraInstrument.close();},nativeView:()=>nativeWorkspace?.nativeView(),sceneId:()=>scene().id,
 personalContext:()=>readEpiPersonalContext(),
 releasePersonalContext:(explicitIdentityIntent=false)=>{
  // Explicit identity edits invalidate the host admission synchronously, even
  // before React has a local selection or the native release has replied.
  if(explicitIdentityIntent)epiPersonalIntentGeneration++;
  // A still-current select_identity posts its predecessor release before its
  // acknowledged reply. A separately expressed identity intent is never
  // swallowed by that pending admission.
  else if(epiNaraSelectPending>0&&epiPersonalAdmissionIntent===epiPersonalIntentGeneration)return false;
  else epiPersonalIntentGeneration++;
  if(epiWorld)epiReleasedPersonalBasis=epiPersonalBasisKey(epiWorld);
  epiPersonalCurrentAdmission=null;clearPrivateEvidence();
  needsFrame=true;naraInstrument.refresh();return true;
 },
 acceptPersonalCurrent:current=>{
  const view=nativeWorkspace?.nativeView(),record=view?readEpiWorldRecord(view.document as unknown as ExpressionDocument):null;
  const previous=epiPersonalCurrentAdmission;
  if(!record||!previous||epiReceiving||epiConstructing||epiReleasedPersonalBasis===epiPersonalBasisKey(record))throw Error('The saved personal basis is not admitted.');
  const admission:PersonalCurrentAdmission={...previous,current};
  if(!qualifyPersonalContext(record,epiIdentity,current,null,null,view,scene().id,admission))throw Error('The native current does not match the admitted saved person and cosmic occasion.');
  const presentation=privateEvidencePresentation;
  clearPrivateEvidence();
  epiPersonalCurrentAdmission=admission;
  if(presentation){
   try{
    const input:EvidencePresentation={...presentation,current};
    const field=createEvidenceField(input,view,scene().id);
    if(!qualifyPersonalContext(record,input.identity,current,input,field,view,scene().id,admission))throw Error('The previous presentation no longer matches this admitted person and occasion.');
    privateEvidencePresentation=input;privateEvidenceField=field;
   }catch(error){epiEncounter?.fail('Current admitted; personal presentation unavailable: '+String(error));}
  }
  needsFrame=true;naraInstrument.refresh();
 },
 presentForm:reading=>{if(reading)privateFormGeometry(reading,nativeWorkspace?.nativeView(),scene().id);privateFormReading=reading;needsFrame=true;},
 formPresentationCurrent:reading=>{if(privateFormReading!==reading)return false;try{privateFormGeometry(reading,nativeWorkspace?.nativeView(),scene().id);return true;}catch{return false;}},
 presentEvidence:input=>{
  const view=nativeWorkspace?.nativeView(),field=input?createEvidenceField(input,view,scene().id):null;
  if(input&&epiWorld){
   const record=view?readEpiWorldRecord(view.document as unknown as ExpressionDocument):null;
   if(!record||epiReleasedPersonalBasis===epiPersonalBasisKey(record)||!epiPersonalCurrentAdmission
     ||!qualifyPersonalContext(record,input.identity,epiPersonalCurrentAdmission.current,input,field,view,scene().id,epiPersonalCurrentAdmission))
    throw Error('This personal presentation does not match the admitted saved person and cosmic occasion.');
  }
  engine?.releasePrivateSound?.();privateEvidencePresentation=input;privateEvidenceField=field;needsFrame=true;naraInstrument.refresh();
 },
 acceptKeptAnswer:async receipt=>{
  if(!nativeWorkspace||!await nativeWorkspace.receiveKeptAnswer(receipt))throw Error('The saved native answer remains in its file; current draft reception was not acknowledged.');
  needsFrame=true;naraInstrument.refresh();
 },
 readKeptAnswer:async answer=>{
  const view=nativeWorkspace?.nativeView();if(!view)throw Error('Open the saved personal Expression before reading its answer.');
  const fresh=(await readKeptAnswers(view.document as unknown as ExpressionDocument)).find(r=>r.record.answer_ref===answer.record.answer_ref);
  if(nativeWorkspace?.nativeView()!==view||!fresh||!sameAnswerValue(fresh,answer))throw Error('The selected native quotation changed. Read its current source again.');
  const retained=await worldRequest({operation:'act_inspect',act_ref:fresh.record.act_ref});
  if(nativeWorkspace?.nativeView()!==view)throw Error('The personal Expression changed while its immutable answer was read.');
  await verifyStoredAnswerEdition(view.document as unknown as ExpressionDocument,fresh,retained);
  if(nativeWorkspace?.nativeView()!==view)throw Error('The personal Expression changed before entering its answer.');
  const ref=fresh.record.parts[0].scene_ref,entry=Object.entries(view.bindings).find(([,b])=>b.scene_ref===ref),index=entry?store.document.scenes.findIndex(s=>s.id===entry[0]):-1;
  if(index<0)throw Error('The complete native answer Scene is not loaded.');
  if(index!==sceneIndex&&!await setScene(index))throw Error('The ordinary reading Scene was not admitted.');
  const live=nativeWorkspace?.nativeView();
  if(!live||live.document.expression_ref!==view.document.expression_ref||!sameAnswerValue(readEpiWorldRecord(live.document as unknown as ExpressionDocument)?.kept_answers,readEpiWorldRecord(view.document as unknown as ExpressionDocument)?.kept_answers))throw Error('The personal answer world changed during ordinary Scene admission.');
  const binding=live.bindings[scene().id],locus=live?String((keptAnswerCarrier(live.document as unknown as ExpressionDocument).world.receiving as {personal:{locus_entity_ref:string}}).personal.locus_entity_ref):'';
  const occurrence=binding?.occurrences.find(o=>o.entity_ref===locus);selected=occurrence?[occurrence.view_entity_id]:[];
  await nativeWorkspace?.select(scene().id,selected[0]??null);renderAll();
 },
 acceptNativeDocument:async(document:unknown)=>{
  const native=document as {expression_ref?:unknown;revision?:unknown};
  const showing=nativeWorkspace?.nativeView()?.document;
  if(typeof native.expression_ref!=='string'||typeof native.revision!=='number'||showing?.expression_ref!==native.expression_ref)throw Error('The coordinate was adopted natively; reopen its Expression to view it. Your current work was retained.');
  await nativeWorkspace?.refreshReference(native.expression_ref);
  const applied=nativeWorkspace?.nativeView()?.document;
  if(applied?.expression_ref!==native.expression_ref||applied.revision!==native.revision)throw Error('The coordinate was adopted natively; resolve the retained local draft before displaying the new revision.');
 }});
if(qs.get('nara')==='1')naraInstrument.open();
const epiProducer=createEpiWorldProduction({
 expression:async request=>{requireEpiPersonalAdmission();const result=await nativeExpressionRequest(request) as ExpressionResult;requireEpiPersonalAdmission();return result;},
 nara:epiAdmissionNaraRequest,
 prepare:async options=>{requireEpiPersonalAdmission();if(!nativeField)throw Error('The native production field is unavailable.');const result=await nativeField.controller.prepareWorld(options);requireEpiPersonalAdmission();return result;},
 canvas:()=>document.createElement('canvas'),
 load:async ref=>{requireEpiPersonalAdmission();const result=await nativeWorkspace!.open(ref);requireEpiPersonalAdmission();return result;},
 edit:async changes=>{requireEpiPersonalAdmission();await nativeWorkspace!.edit(view=>{requireEpiPersonalAdmission();return changes(view.document as unknown as ExpressionDocument);});requireEpiPersonalAdmission();},
 persist:async name=>{requireEpiPersonalAdmission();await nativeWorkspace!.idle();requireEpiPersonalAdmission();const saved=await nativeWorkspace!.saveFile('Work/O-I/desktop/cradle/material/expressive-material/expression',name);requireEpiPersonalAdmission();const state=nativeWorkspace!.inspect();if(!saved||!state.file)throw Error(state.notice||'The world was committed but its durable native file has not been acknowledged.');return state.file;},
 status:text=>epiEncounter?.status(text),presentationRest:()=>{const actual=engine.inspect?.() as {simTime?:number;steps?:number}|undefined;return fieldPaused&&simTime===0&&actual?.simTime===0&&actual.steps===0&&nativeField?.controller.reading.status==='manual';},
});
function readEpiPersonalContext(view=nativeWorkspace?.nativeView(),sceneId=scene().id){
 if(epiReceiving||epiConstructing)return undefined;
 if(!view)return null;
 try{
  const record=readEpiWorldRecord(view.document as unknown as ExpressionDocument);
  if(!record||epiReleasedPersonalBasis===epiPersonalBasisKey(record)||!epiPersonalCurrentAdmission)return null;
  return qualifyPersonalContext(record,epiIdentity,epiPersonalCurrentAdmission.current,
   privateEvidencePresentation,privateEvidenceField,view,sceneId,epiPersonalCurrentAdmission);
 }catch{return null;}
}
function admitEpiPersonalBasis(){
 requireEpiPersonalAdmission();const view=nativeWorkspace?.nativeView();
 if(!epiWorld||!epiIdentity||!epiCurrent||!view)throw Error('The native personal admission is incomplete.');
 const record=readEpiWorldRecord(view.document as unknown as ExpressionDocument);
 if(!record||!qualifyPersonalContext(record,epiIdentity,epiCurrent,null,null,view,scene().id))throw Error('The native personal admission does not match the loaded saved current receipt.');
 epiPersonalCurrentAdmission={generation:++epiPersonalAdmissionGeneration,savedCurrent:{...record.receiving.personal.current!},current:epiCurrent};
 // Only a completed actual selection/rebind calls this admission boundary.
 epiReleasedPersonalBasis=null;
}
async function enterEpiWorld(identity:InstrumentIdentity,retainedOpening?:import('./native-field/controller').NativeSkySnapshot){
 if(epiReceiving||epiConstructing)throw Error('The saved personal world is still receiving its native basis.');
 if(retainedOpening&&epiWorld)throw Error('A loaded personal world already has its admitted occasion. Return to an empty world before selecting another retained opening.');
 if(epiWorld?.person_ref===identity.reading.person_ref){
  epiReceiving=true;epiPersonalAdmissionIntent=epiPersonalIntentGeneration;
  try{await leaveEpiNativeScene();const rebound=await epiProducer.rebind(epiWorld,identity);epiIdentity=identity;epiWorld=rebound.record;epiCurrent=rebound.current;epiPersonalKey=[epiWorld.world.instance_ref,epiWorld.person_ref,epiWorld.identity_source.revision,epiWorld.world.snapshot_ref].join('|');admitEpiPersonalBasis();await receiveEpiPersonal();epiEncounter?.refresh();}
  finally{epiReceiving=false;epiPersonalAdmissionIntent=null;naraInstrument.refresh();}return;
 }
 const sky=retainedOpening??epiWorld?.world.sky as unknown as import('./native-field/controller').NativeSkySnapshot|undefined;
 epiConstructing=true;epiPersonalAdmissionIntent=epiPersonalIntentGeneration;
 try{
  await leaveEpiNativeScene();requireEpiPersonalAdmission();
  sequenceOpen=false;beltOpen=false;beltWasOpen=false;inspectorOpen=false;contextKind='';renderAll();
  const produced=await epiProducer.construct(identity,'now',sky);requireEpiPersonalAdmission();epiIdentity=identity;epiWorld=produced.record;
 }catch(error){epiEncounter?.fail(error instanceof Error?error.message:String(error));throw error;}
 finally{epiConstructing=false;epiPersonalAdmissionIntent=null;}
 await receiveEpiWorld(true);epiEncounter?.refresh();
}
async function receiveEpiPersonal(){
 if(!epiWorld||!epiIdentity||!epiCurrent)return;
 if(epiReleasedPersonalBasis===epiPersonalBasisKey(epiWorld)){
  clearPrivateEvidence();needsFrame=true;naraInstrument.refresh();return;
 }
 const currentView=nativeWorkspace?.nativeView(),currentScene=currentView?.journey.scenes.find(s=>s.id===scene().id);
 const centres=epiWorld.receiving.personal.centre_entity_refs;
 if(!currentScene||!centres.every(ref=>currentScene.entities.some(e=>e.id===ref))){clearPrivateEvidence();needsFrame=true;naraInstrument.refresh();return;}
 if(currentScene.id===`${epiWorld.world.instance_ref}:scene:personal`&&nativeField?.controller.reading.lease)throw Error('The cosmic owner must be retained and released before entering the personal scene.');
 // Reopening depth and repeated host reception keep the same live route and
 // resident modes. A changed native person or occasion requires admission.
 const admittedCurrent=epiPersonalCurrentAdmission?.current;
 if(!admittedCurrent||!qualifyPersonalContext(epiWorld,epiIdentity,admittedCurrent,null,null,currentView,scene().id,epiPersonalCurrentAdmission)){
  clearPrivateEvidence();needsFrame=true;naraInstrument.refresh();return;
 }
 if(privateEvidencePresentation&&qualifyPersonalContext(epiWorld,epiIdentity,
   admittedCurrent,privateEvidencePresentation,privateEvidenceField,currentView,scene().id,epiPersonalCurrentAdmission)){
  naraInstrument.refresh();return;
 }
 try{
  const input:EvidencePresentation={identity:epiIdentity,channel:'direct-planetary-resonance',current:admittedCurrent,waves:true};
  const field=createEvidenceField(input,currentView,scene().id);
  engine?.releasePrivateSound?.();privateEvidencePresentation=input;privateEvidenceField=field;needsFrame=true;naraInstrument.refresh();
 }
 catch(e){clearPrivateEvidence();epiEncounter?.fail('Personal reception: '+String(e));naraInstrument.refresh();}
}
async function receiveEpiWorld(explicitAdmission=false){
 if(epiReceiving||!epiWorld)return;
 if(epiReleasedPersonalBasis&&!explicitAdmission){naraInstrument.refresh();return;}
 const record=epiWorld,key=[record.world.instance_ref,record.person_ref,record.identity_source.revision,record.world.snapshot_ref].join('|');
 if(key===epiPersonalKey&&epiIdentity&&epiCurrent&&!epiReleasedPersonalBasis){await receiveEpiPersonal();return;}
 epiReceiving=true;epiPersonalAdmissionIntent=epiPersonalIntentGeneration;const intent=epiPersonalIntentGeneration;
 try{
  const selected=await epiAdmissionNaraRequest({operation:'select_identity',source:record.identity_source,input_revision:record.identity_input_revision});
  requireEpiPersonalAdmission();if(selected.schema!=='oi.nara-instrument-state/v1'||!selected.identity)throw Error('The saved world cannot recover its particular person.');
  const rebound=await epiProducer.rebind(record,selected.identity);requireEpiPersonalAdmission();epiIdentity=selected.identity;epiWorld=rebound.record;epiCurrent=rebound.current;epiPersonalKey=key;admitEpiPersonalBasis();
  await receiveEpiPersonal();
  // The authored field is visible at rest. Native play opens only on a human
  // act; quiet owner preparation and the protected personal pin need no audio.
  editing=false;inspectorOpen=false;contextKind='';timelineOpen=false;sequenceOpen=false;tool='select';cursorTool='select';railKey='select';renderAll();
 }catch(e){
  epiReleasedPersonalBasis=epiPersonalBasisKey(record);epiPersonalCurrentAdmission=null;clearPrivateEvidence();needsFrame=true;
  if(intent!==epiPersonalIntentGeneration)epiEncounter?.status('Your pending identity edit was retained.');else epiEncounter?.fail(String(e));
 }finally{epiReceiving=false;epiPersonalAdmissionIntent=null;naraInstrument.refresh();}
}
/** Native admission must see the complete actual authored scene partition.
 * An asynchronous image decode cannot be treated as an empty receiving body. */
async function receiveEpiCosmicPartition(record:EpiWorldRecord){
 const sceneId=scene().id,documentId=store.document.id,deadline=performance.now()+30000;
 for(;;){
  if(epiWorld?.world.instance_ref!==record.world.instance_ref||store.document.id!==documentId||scene().id!==sceneId)throw Error('The cosmic scene changed before its native receiving material was ready.');
  engine.render(frameData(0));
  const actual=engine.inspect?.() as {partitions?:{entityId:string;start:number;end:number}[]}|undefined;
  const sources=engine.telemetry?.()?.sourceStatus??{};
  const required=scene().entities.filter(e=>e.enabled!==false);
  if(required.every(e=>actual?.partitions?.some(p=>p.entityId===e.id&&p.end>p.start))&&required.filter(e=>e.source?.kind==='image').every(e=>Object.entries(sources).some(([key,status])=>{try{return JSON.parse(key)[0]===e.id&&typeof status==='string'&&status.includes('source active');}catch{return false;}})))return;
  if(performance.now()>deadline)throw Error('The complete cosmic body and source-image material have not reached the receiving scene.');
  await new Promise(resolve=>setTimeout(resolve,16));
 }
}
async function playEpiWorld(){
 const openingRecord=epiWorld;if(!openingRecord||!nativeField)throw Error('Open the saved Epi world first.');
 const controller=nativeField.controller;
 const view=nativeWorkspace?.nativeView(),cosmic=Object.entries(view?.bindings??{}).find(([,b])=>b.scene_ref===openingRecord.receiving.scene_ref);
 if(!cosmic)throw Error('The saved cosmic Scene is not loaded.');
 if(scene().id!==cosmic[0])await setScene(store.document.scenes.findIndex(s=>s.id===cosmic[0]));
 const record=epiWorld;if(!record||scene().id!==cosmic[0])throw Error('The cosmic scene navigation did not complete.');
 const source=controller.reading.source as {world?:{instance_ref?:string}}|null;
 if(source?.world?.instance_ref!==record.world.instance_ref||!['following','held'].includes(controller.reading.status)){
  // Build the actual scene partition before the sparse native map is admitted.
  await receiveEpiCosmicPartition(record);
  await controller.compose({world:{instance_ref:record.world.instance_ref,subject_ref:record.person_ref,...(record.continuation_start?{start:record.continuation_start}:{}),...(record.current_material_policy?{material:record.current_material_policy.material}:{})},snapshotPurpose:'retained-occasion',skySnapshot:record.world.sky as unknown as import('./native-field/controller').NativeSkySnapshot,
   entityTargetBindings:({world,partition})=>epiTorusTargetMap(record,world,partition)});
 }
 return controller;
}
epiEncounter=installEpiWorldEncounter({
 active:()=>worldLens==='epi-logos',document:()=>nativeWorkspace?.nativeView()?.document as unknown as ExpressionDocument??null,record:()=>epiWorld,
 participant:()=>{
  if(!epiWorld||!epiIdentity||epiIdentity.reading.person_ref!==epiWorld.person_ref||epiIdentity.source.revision!==epiWorld.identity_source.revision)return null;
  const request=epiWorld.world.sky.request as {epoch?:unknown;observer?:unknown;perspective?:unknown}|undefined;
  if(typeof request?.epoch!=='string'||request.observer!==null||request.perspective!=='Apparent Geocentric')return null;
  const natal=epiIdentity.reading.profile.birth.place?.label;
  return{name:epiIdentity.reading.profile.name,occasion_utc:request.epoch,observer_standing:'geocentric-location-independent' as const,...(epiCurrent?.reading?.sky_admission?.purpose==='retained-occasion'?{occasion_standing:'saved-occasion' as const}:{}),...(natal?{natal_place_label:natal}:{})};
 },
 scene:()=>nativeWorkspace?.nativeView()?.bindings[scene().id]?.scene_ref??scene().id,
 selected:()=>{const binding=nativeWorkspace?.nativeView()?.bindings[scene().id];return binding?.occurrences.find(o=>o.view_entity_id===selected[0])?.entity_ref??null;},
 identity:()=>{closeEntryGate();naraInstrument.open('identity');},
 ask:async()=>{await nativeWorkspace?.select(scene().id,selected[0]??null);naraInstrument.open('conversation');},
 navigate:async(ref,entityRef)=>{const view=nativeWorkspace?.nativeView(),binding=Object.entries(view?.bindings??{}).find(([,b])=>b.scene_ref===ref);if(!binding)throw Error('This Scene is not part of the open native world.');const index=store.document.scenes.findIndex(s=>s.id===binding[0]);if(index!==sceneIndex&&!await setScene(index))return;const occurrence=binding[1].occurrences.find(o=>o.entity_ref===entityRef);selected=occurrence?[occurrence.view_entity_id]:[];await nativeWorkspace?.select(scene().id,selected[0]??null);editing=false;contextKind='';inspectorOpen=false;renderAll();},
 axes:()=>{
  const record=epiWorld;if(!record)return null;
  const reading=nativeField?.controller.reading,world=(reading?.source as {world?:{instance_ref?:string}}|null|undefined)?.world;
  if(reading?.lease){if(!['following','held'].includes(reading.status)||world?.instance_ref!==record.world.instance_ref||reading.native?.event_ref!==record.world.event_ref||reading.native?.subject_ref!==record.person_ref||!reading.native?.available)return null;try{return nativeSceneAxes(reading.presented_clock);}catch{return null;}}
  try{const readback=requireEpiNativeReadback(record,record.native_readback??record.world.native_readback,record.native_readback!==undefined);return nativeSceneAxes(readback.continuous_clock);}catch{return null;}
 },
 setAxis:async(axis,phase)=>{const admitted=nativeAxisRequest(axis,phase);const controller=await playEpiWorld();await controller.setAxis(admitted.axis,admitted.phase);needsFrame=true;epiEncounter?.refresh();},
 form:()=>naraInstrument.open('form'),
 step:async()=>{await (await playEpiWorld()).m1Advance(1);await retainEpiNativeReading();},
 damping:()=>{const i=nativeField?.controller.reading.instrument?.influence,r=epiWorld;return r&&i?.instance_ref===r.world.instance_ref&&i.event_ref===r.world.event_ref&&i.subject_ref===r.person_ref?i.material.damping_per_second:r?.current_material_policy?.material.damping_per_second??(r?epiOpeningMaterial(r).damping_per_second:0);},
 // The native edit keeps this lease alive. Save/departure retain its policy
 // through the existing acknowledged continuation path, never an auto strike.
 setDamping:async(perSecond)=>{if(!Number.isFinite(perSecond)||perSecond<0||perSecond>1e6)throw Error('Damping must be finite and in 0..1000000 per second');await (await playEpiWorld()).setDamping(perSecond);epiEncounter?.refresh();},
 sound:enabled=>{if(!nativeField||nativeField.controller.reading.status!=='following')throw Error('Advance the field once to open its native voices.');nativeField.controller.setMuted(!enabled);},
 quiet:enabled=>{fieldPaused=enabled;needsFrame=true;renderAll();},
 save:async()=>{await retainEpiNativeReading(false);await nativeWorkspace!.idle();const saved=await nativeWorkspace!.saveFile('Work/O-I/desktop/cradle/material/expressive-material/expression',`epi-world-${epiWorld!.world.instance_ref.slice('expression:epi-'.length)}.expression.json`);const state=nativeWorkspace!.inspect();if(!saved||!state.file)throw Error(state.notice||'The native material file was not acknowledged.');epiEncounter?.status('Saved and read back through the native material owner.');},
 reset:async()=>{
  const record=epiWorld!;
  // Event replacement intentionally preserves the independent continuous
  // axes. Returning this whole world to its opening uses the original complete
  // constructor recipe, rather than the current lease's continuation opening.
  const original=(record.world.native_readback as Record<string,unknown>|undefined)?.continuation_start;
  if(!original||typeof original!=='object'||Array.isArray(original))throw Error('The original admitted world has no complete native opening recipe.');
  requireEpiNativeReadback(record,record.world.native_readback,false);
  if(JSON.stringify(record.world.native_readback)!==JSON.stringify(record.world.binding.native_readback))throw Error('The original admitted world and its native binding disagree.');
  const start=structuredClone(original) as Record<string,unknown>;
  const controller=await playEpiWorld();await controller.release(false);
  await receiveEpiCosmicPartition(record);
  await controller.compose({world:{instance_ref:record.world.instance_ref,subject_ref:record.person_ref,start,material:epiOpeningMaterial(record)},
   snapshotPurpose:'retained-occasion',skySnapshot:record.world.sky as unknown as import('./native-field/controller').NativeSkySnapshot,
   entityTargetBindings:({world,partition})=>epiTorusTargetMap(record,world,partition)});
  await retainEpiNativeReading();
 },
});
async function retainEpiNativeReading(resume=true){
 const record=epiWorld,native=nativeField?.controller.reading.instrument?.influence?.native_readback;
 if(!record||!native)return;
 const material=nativeField!.controller.reading.instrument!.influence.material;
 const key=JSON.stringify([native,material]);if(key===epiNativeRevision)return;
 // The process, current glyph and qualified reading advance together through
 // the existing native Expression CAS. Every other entity keeps its subject.
 const process=(native as Record<string,unknown>).form_process as {process_subject_ref?:string;current_reading?:import('../../../src/expression/types').ReadingRef;hexagram_glyph?:string;triplet?:string;source_refs?:import('../../../src/expression/types').ReadingRef[]}|undefined;
 if(process?.process_subject_ref!==record.world.current_form.process_subject_ref||!process.current_reading)throw Error('The native current form lost its process and exact changing source.');
 const view=nativeWorkspace?.nativeView();if(!view)return;
 const continuation=(native as Record<string,unknown>).continuation_start;if(!continuation||typeof continuation!=='object'||Array.isArray(continuation))throw Error('The native owner omitted the actual continuation recipe.');
 const held={...record,native_readback:structuredClone(native) as EpiWorldRecord['native_readback'],continuation_start:structuredClone(continuation) as Record<string,unknown>};
 delete held.current_material_policy;Object.assign(held,epiMaterialContinuation(record,material));
 const controller=nativeField!.controller;await controller.release(false);
 if(controller.reading.lifetime.close_error||controller.reading.reason?.startsWith('native release acknowledgement unknown:'))throw Error(controller.reading.reason??'The native close was not acknowledged.');
 const glyph=process.hexagram_glyph||process.triplet;if(!glyph)throw Error('The current native form has no actual symbolic material.');
 await nativeWorkspace!.edit(current=>{
  const changes:Record<string,unknown>[]=[];
  for(const suffix of ['current-form','current-form-hinge']){
   const ref=`${record.world.instance_ref}:entity:world-${suffix}`,entity=current.document.entities[ref];if(!entity?.subject)throw Error('The native form occurrence is absent.');
   const old=entity.subject as unknown as import('../../../src/expression/types').SubjectBinding,readings=[process.current_reading!,...(process.source_refs??[])];
   const subject={...old,readings:[...readings,...old.readings.filter(r=>!r.ref.startsWith('ql:m-coordinate:'))]};
   changes.push({change:'subject_bind',entity_ref:ref,binding:subject});
   if(suffix==='current-form')changes.push({change:'parameter_set',entity_ref:ref,parameter:'glyph',value:glyph});
  }
  const material=current.document.scenes.find(s=>s.scene_ref===record.receiving.scene_ref)?.presentation;
  if(!material?.scene)throw Error('The current cosmic scene material is absent.');
  const presentation=structuredClone(material),nativeScene={...presentation.scene,epiWorld:held};
  const formBody=(nativeScene.entities as Entity[]).find(e=>e.id===`${record.world.instance_ref}:entity:world-current-form`);
  if(!formBody)throw Error('The current form has no receiving scene material.');
  formBody.text=glyph;
  // The held sequence is also consumed by the actual renderer. Advancing a
  // scalar parameter alone must not leave its opening glyph in that carrier.
  for(const step of formBody.sequence.steps)step.text=glyph;
  changes.push({change:'scene_material_set',scene_ref:record.receiving.scene_ref,presentation:{...presentation,scene:nativeScene,saved:epiAuthoredSceneSnapshot(nativeScene)}});
  return changes;
 });
 epiWorld=held;epiNativeRevision=key;epiReceptionRevision++;needsFrame=true;epiEncounter?.refresh();if(resume)await playEpiWorld();
}
Object.assign(window.__FIELD_STUDIES__,{epiWorld:()=>epiWorld,epiCurrent:()=>epiCurrent,enterEpiWorld,epiSource:(ref?:string)=>epiEncounter?.source(ref)});

const disposeFieldStudies=window.__FIELD_STUDIES__.dispose;
window.__FIELD_STUDIES__.dispose=()=>{naraInstrument.destroy();disposeFieldStudies();};
// A hosted deep link (the app's own ?journey/?scene idiom): open a named
// expression from the browser library, the featured set or the starters —
// the Technè M0 instrument opens onto the Epii face this way
// (?expression=source-twelve-faces, owner direction 2026-09-19).
const qsExpression=qs.get('expression');
if(qsExpression){const found=[...readLibrary(),...featuredExpressions(),...startingPoints().map(p=>p.expression)].find(j=>j.id===qsExpression);if(found)store.document=initialiseSceneSaves(initialiseBelts(found));}
if(qs.get('journey')==='seven')store.document=initialiseSceneSaves(initialiseBelts(nativeSeven()));if(qs.get('scene')){const index=store.document.scenes.findIndex(s=>s.name.toLowerCase()===qs.get('scene')!.toLowerCase());if(index>=0)sceneIndex=index;}if(qs.has('still'))fieldPaused=true;
if(window.__START_PRESENTATION__||qs.has('present')){presenting=true;fieldPaused=false;scenePlaying=true;journeyPlaying=store.document.scenes.length>1;}
// Save is the app's own act: in a hosted native work it commits the working
// composition to its native Expression (the same owner operation the former
// native panel used); otherwise it keeps the draft in this browser.
async function saveNative(){
 if(kernelExpressionsAvailable()&&nativeWorkspace){if(propertyTake)finishPropertyTake();const ok=await nativeWorkspace.commit();if(ok){closeEntryGate();toast('Saved.');}return;}
 deletedLibraryIds.delete(store.document.id);saveToLibrary(store.document);if(libraryOpen)renderLibrary();toast('Saved in this browser.');
}
let nativeState:import('./nativeWorkspace.js').NativeStatus|null=null;
function epiFileStatus():string{return nativeState?.busy?'Working…':nativeState?.file?.document_revision===nativeState?.identity?.revision&&nativeState?.file?'File saved':nativeState?.file?'Changes to save':'File unsaved';}
function showNativeStatus(state:import('./nativeWorkspace.js').NativeStatus){
 const previous=nativeState?.identity;nativeState=state;
 // Owner-acknowledged background saves advance the same hosted subject.
 // Publish that revision before Nara captures its next exact scene basis.
 if(previous?.ref!==state.identity?.ref||previous?.revision!==state.identity?.revision)announceHostState();
 if(store.document.scenes.some(s=>s.epiWorld))$('scene-state').textContent=epiFileStatus();
 // A background read failing before any native work exists is not a failed
 // save: attention is only for work that has an identity or an open to retry.
 const failed=state.failed&&(!!state.identity||state.retryOpen||!!state.pending);
 const save=document.getElementById('native-save');
 if(save){const label=state.busy?'Saving…':failed?`Not saved — ${state.text}`:state.identity?`Save (⌘S) · ${state.identity.title} · revision ${state.identity.revision}`:'Save (⌘S)';save.title=label;save.setAttribute('aria-label',label);save.classList.toggle('attention',failed||!!state.pending);save.toggleAttribute('disabled',state.busy);}
 const line=document.getElementById('native-status');if(!line)return;
 const actions=[state.pending?`<button type="button" class="link-button" data-action="native-resolve">Resolve interrupted save</button>`:'',state.pending==='file'?`<button type="button" class="link-button" data-action="native-retry-file">Retry file save</button>`:'',state.retryOpen&&state.failed?`<button type="button" class="link-button" data-action="native-retry-open">Retry opening</button>`:'',state.page&&state.page.count>1?`<span class="native-page">Members ${state.page.page+1}/${state.page.count}</span><button type="button" class="link-button" data-action="native-page" data-delta="-1" ${state.page.page<=0?'disabled':''}>Previous</button><button type="button" class="link-button" data-action="native-page" data-delta="1" ${state.page.page>=state.page.count-1?'disabled':''}>Next</button>`:''].join('');
 const text=failed?state.text:state.identity?`${state.identity.title} · revision ${state.identity.revision}`:'';
 line.innerHTML=`${esc(text)}${actions}`;line.classList.toggle('failed',failed);
 if(state.failed&&state.retryOpen)toast(state.text,7000);
}
/** Re-enter an exact native Expression file (e.g. after a restart). */
function openCentralFileDialog(){
 const dialog=$<HTMLDialogElement>('confirm-dialog');
 dialog.innerHTML=`<form method="dialog" class="native-file-form"><h2>Open a Central file</h2><p>Opens a saved native Expression file under its own identity.</p><label>Central path<input name="path" placeholder="Project/folder/name.expression.json"></label><footer><button value="cancel">Cancel</button><button value="open" class="primary">Open</button></footer></form>`;
 dialog.onclose=()=>{if(dialog.returnValue!=='open')return;const path=(dialog.querySelector('form')!.elements.namedItem('path') as HTMLInputElement).value.trim();if(!path)return;if(libraryOpen)closeLibrary();void nativeWorkspace?.openFile(path).then(ok=>{if(ok)toast(nativeState?.text||'Opened.',5000);});};
 dialog.showModal();
}
/** Native file save in the app's own modal: a Central folder and filename. */
function openNativeFileDialog(){
 const dialog=$<HTMLDialogElement>('confirm-dialog');
 const current=nativeState?.file;
 dialog.innerHTML=`<form method="dialog" class="native-file-form"><h2>Save to a Central file</h2><p>${current?`Attached to ${esc(current.path)} · revision ${esc(String(current.revision))}`:'Writes this composition as a native Expression file and reads it back.'}</p><label>Folder<input name="folder" value="." ${current?'disabled':''}></label><label>Filename<input name="name" value="${esc(slug(store.document.name)||'expression')}.expression.json" ${current?'disabled':''}></label><footer><button value="cancel">Cancel</button><button value="save" class="primary">Save file</button></footer></form>`;
 dialog.onclose=()=>{if(dialog.returnValue!=='save')return;const form=dialog.querySelector('form')!;void nativeWorkspace?.saveFile((form.elements.namedItem('folder') as HTMLInputElement).value,(form.elements.namedItem('name') as HTMLInputElement).value).then(ok=>{if(ok)toast(nativeState?.text||'Saved to a Central file.',6000);});};
 dialog.showModal();
}
async function startWorkspace(){
 // Recovery is a boot offer, not a later navigation. Qualify the exact
 // showing draft, view position and explicit native intent across every await.
 const position=()=>JSON.stringify({sceneIndex,selected,stepIndex,sceneElapsed,simTime,scenePlaying,journeyPlaying,fieldPaused,camera});
 let version=store.revision,id=store.document.id,navigation=journeyNavigation,intent=nativeWorkspace?.intentGeneration()??0,viewPosition=position();
 const current=()=>store.revision===version&&store.document.id===id&&journeyNavigation===navigation&&(nativeWorkspace?.intentGeneration()??0)===intent&&position()===viewPosition;
 const recapture=()=>{version=store.revision;id=store.document.id;navigation=journeyNavigation;intent=nativeWorkspace?.intentGeneration()??0;viewPosition=position();};
 let recovered:SessionState|undefined;
 let showEntry=false;
 if(!window.__JOURNEY__&&!qs.has('journey')&&!qsExpression){
  try{
   const drafts=await readDrafts();
   if(current()){
    for(const draft of drafts)sessionExpressions.set(draft.id,draft);
    const last=localStorage.getItem('oi.field-studies.last'),draft=last?await readDraft(last):undefined;
    if(current()){
     if(draft&&(!initial.updatedAt||draft.id!==initial.id||draft.updatedAt>=initial.updatedAt)){store.document=initialiseSceneSaves(initialiseBelts(draft));store.touch();}
     recovered=validateSession(JSON.parse(localStorage.getItem(SESSION_KEY)??'null'),store.document);showEntry=!startsInTechne;
     recapture(); // Only this synchronous, qualified boot adoption advances its basis.
    }
   }
  }catch(e){console.warn('Draft recovery unavailable',e);if(current())showEntry=!startsInTechne;}
 }
 if(current())startupRecoveryPending=false; // A superseded read cannot author an untouched initial canvas.
 if(current()){
  if(recovered&&!qs.has('scene')){sceneIndex=store.document.scenes.findIndex(s=>s.id===recovered!.sceneId);selected=recovered.selected;stepIndex=recovered.stepIndex;sceneElapsed=recovered.sceneElapsed;simTime=recovered.simTime;scenePlaying=recovered.scenePlaying??recovered.playing;journeyPlaying=recovered.journeyPlaying;if(recovered.fieldPaused!==undefined)fieldPaused=recovered.fieldPaused;if(qs.has('still'))fieldPaused=true;camera=recovered.camera;}else applySceneView();
  recapture();
 }
 document.body.classList.toggle('oi-host-techne',hostMode==='techne');renderRail();
 if(current()&&!qsExpression?.startsWith('expression:')){
  const ownedVersion=await nativeWorkspace?.changed(store.document,current);
  // The initial checkpoint may replace the same draft through host.load.
  // Rebase only that acknowledged version, with intent/navigation/position
  // unchanged. An explicit opening or a newer local view always wins.
  if(ownedVersion!==undefined&&store.revision===ownedVersion&&store.document.id===id&&journeyNavigation===navigation&&(nativeWorkspace?.intentGeneration()??0)===intent&&position()===viewPosition)recapture();
 }
 resize();engine.render(frameData(0));if(current()&&recovered?.transport)engine.restoreTransport?.(recovered.transport);
 if(current())trackPreview=!!scene().propertyTracks?.length;
 resize();renderAll();if(location.hash.startsWith('#library'))openLibrary(location.hash.includes('about')?'about':'collection',false);rafId=requestAnimationFrame(tick);
 if(startupError)toast(startupError,7000);else if(workspaceStorageError)toast('Saved toolbelt could not be read. Starter controls are available for this session.',7000);
 if(current()){
  if(fieldPaused&&!recovered&&!qs.has('still'))toast('A still field, following your reduced-motion preference. Play a scene, or lift “Pause physics” in the studio, to set it in motion.',6000);
  if(qs.has('edit'))edit(true,(['scene','objects','field','motion'].includes(qs.get('edit')!)?qs.get('edit'):'scene')as InspectorContext['tab']);
  if(showEntry)openEntryGate(!!recovered||!!localStorage.getItem('oi.field-studies.last'),store.document.name);
  if(qsExpression?.startsWith('expression:')){const open=()=>{if(current())void nativeWorkspace?.follow(qsExpression);};if(kernelExpressionsAvailable())open();else window.addEventListener('message',function ready(event){if(event.source===window.parent&&event.data?.v===1&&event.data?.kind==='oi-kernel-channel'){window.removeEventListener('message',ready);open();}});}
 }
 setInterval(()=>{saveSession('interval');if(propertyTake&&propertyTake.elapsed>0)void flushDraft();},1000);
}
function openEntryGate(hasContinue:boolean,continueLabel?:string){
 if(worldLens==='epi-logos'||nativeWorkspace?.nativeView())return; // Epi entry is its personal-world entrance; an opened native Expression already supplies its subject.
 const gate=$('entry-gate');gate.hidden=false;gate.innerHTML=entryGateHTML({hasContinue,continueLabel:continueLabel?`Continue “${continueLabel}”`:undefined,hasNative:kernelExpressionsAvailable()});
}
function closeEntryGate(){const gate=$('entry-gate');gate.hidden=true;gate.innerHTML='';}
window.addEventListener('physis-quality',(ev=>{const s=(ev as CustomEvent).detail??{};if(Number(s.fps)>0)physisFpsCap=Number(s.fps);if(Number(s.pixelRatio)>0){physisPixelRatio=Number(s.pixelRatio);if(physisPixelRatio!==physisRatioApplied){physisRatioApplied=physisPixelRatio;resize();}}if(Number(s.particleLimit)>0)physisParticleCap=Number(s.particleLimit);needsFrame=true;}) as EventListener);
function desktopSource():DesktopScene{return {expression:clone(store.document),sceneIndex,camera:{...camera},viewport:{width,height},name:scene().name+' · '+store.document.name};}
installPhysis(desktopSource,async source=>{await loadJourney(validateJourney(source.expression));await setScene(source.sceneIndex??0);camera={...defaultCamera(),...source.camera};if(source.viewport){camera.panX*=width/source.viewport.width;camera.panY*=height/source.viewport.height;}overlayDirty=true;needsFrame=true;renderAll();},toast);
const workspaceStarted=startWorkspace();
// Read-only acceptance barrier over actual boot, not a delay or a native reply.
Object.assign(window.__FIELD_STUDIES__,{workspaceReady:()=>workspaceStarted});
void workspaceStarted;
