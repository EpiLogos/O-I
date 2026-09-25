import {installBlueprintHUD} from './blueprintHUD.js';
import {blueprintMember} from './blueprintGeometry.js';
import {installNativeField} from "./nativeField";
import {SESSION_KEY,SessionState,validateSession,writeDraft,readDraft,readDrafts,removeDraft} from './recovery';
import {foldObjectState} from './foldState';
import {imageSuiteHTML} from './imageSuite';
import {initialiseShared,effectiveScene,isShared,writeShared,toggleShared,useLocalPointer,POINTER_PATHS} from './sharedSettings';
import {initialiseSources,stateSource,stateLabel,setStateSource,transformObjectStates} from './sourceState';
import {refitStepForText,refitEntityForText,refitFormationForFont,refitFormationToGlyphs,capturedStepState,FontRef} from './stateSizing.js';
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
import {Journey,Scene,Entity,EntityLayer,TextLayer,Tool,Shape,Vec3,clone,uid,clamp,fieldStudies,oiMark,sevenCentres,smallLanguage,blankJourney,blankScene,entity,pin,chakraEntities,validateJourney,AutomationLane} from './model.js';
import {DocumentStore,readLibrary,readLibraryDetailed,saveToLibrary,removeFromLibrary} from './store.js';
import {defaultCamera,project,unproject,facePlane,stageScale,stageCentre,basis,Camera} from './camera.js';
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
import {OrbitControl} from './orbitControl.js';
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
import type {PalaceDocumentSnapshot} from '../../../src/techne/m0m5/palace/composition';
import {applyResearchMaterial,pruneResearchOccurrence,type ResearchMaterialAction} from './researchMaterial.js';
import {installTechneWorld} from './techneWorld.js';
import type {ConnectionBinding} from '../../../../../packages/oi-design-system/expressions-engine/oi/expressionBindings.mjs';
import type {KernelConversion,KernelSceneBody} from './kernelDocumentBridge.js';
import {installSceneBodies} from './sceneBodies.js';
mountShell();installPanelResize();installKernelExpressions();
const recovery=document.createElement('section');recovery.id='engine-recovery';recovery.hidden=true;recovery.className='engine-recovery';recovery.setAttribute('role','alert');recovery.innerHTML='<h3>GPU context interrupted</h3><p>The expression is intact. Recovering recreates lost particle state, not a runtime checkpoint.</p><button class="secondary" data-action="native-recover">Recover field</button>';document.body.append(recovery);

let recentIds:string[]=[];try{const raw=JSON.parse(localStorage.getItem('oi.recent-work.v1')??'[]');if(Array.isArray(raw))recentIds=raw.filter((v):v is string=>typeof v==='string');}catch{}
function rememberWork(id:string){recentIds=recordRecent(recentIds,id);try{localStorage.setItem('oi.recent-work.v1',JSON.stringify(recentIds));}catch{}}
let workspace=defaultWorkspace(),workspaceStorageError=false;
try{const saved=localStorage.getItem(WORKSPACE_KEY);if(saved)workspace=validateWorkspace(JSON.parse(saved));}catch{workspaceStorageError=true;}
const sceneNames=new Map<string,string>();
let monitoredLane='';let monitorMode:MonitorMode='cycle';let monitorDocked=false;let assignmentTarget='',assignmentGroup='';let beltPickerOpen=false;const pendingBelt=new Set<string>();let contextKind:''|'objects'|'text'|'pointer'='';
const startsInTechne=new URLSearchParams(location.search).get('mode')==='techne';
const startsWithNativeReference=!!new URLSearchParams(location.search).get('expression')?.startsWith('expression:');
let sequenceOpen=!startsInTechne;let studioSection="physics";
let customFontEdit=false;
let beltOpen=!startsInTechne&&innerWidth>1000,studioOpen=false;
let studioDocked=false,studioSizeMemo:{width:string;height:string}|null=null;let beltWasOpen=false;
// The instrument opens on the O:I mark — the light/dark theme expression
// that matches the base O:I image (owner direction 2026-09-19). A last-opened
// library expression still restores over it, exactly as before.
let initial:Journey=startsInTechne?{...blankJourney(),name:'Wiki'}:oiMark(),startupError='';
try{if(window.__JOURNEY__)initial=validateJourney(window.__JOURNEY__);else if(!startsWithNativeReference){try{const last=localStorage.getItem('oi.field-studies.last');const saved=readLibrary().find(j=>j.id===last);if(saved)initial=saved;}catch{/* An opaque or private origin must still open cleanly. */}}}catch(err){startupError=err instanceof Error?err.message:String(err);}
function initialiseBelts(j:Journey){initialiseShared(j);initialiseSources(j);for(const s of [...j.scenes,...Object.values(j.savedScenes??{})])if(!s.toolbelt)s.toolbelt=clone(workspace.entries).map(e=>e.scope==='named'&&!s.entities.some(v=>v.id===e.entityId)?{id:e.id,key:e.key,scope:'selected' as const}:e);return j;}
const store=new DocumentStore(initialiseSceneSaves(initialiseBelts(initial)));let engine:FieldEngineAdapter;
try{engine=window.OI_ENGINE_FACTORY?window.OI_ENGINE_FACTORY($<HTMLCanvasElement>('field-canvas')):new ProductionAdapter($<HTMLCanvasElement>('field-canvas'));(window as any).OI_DEBUG_ENGINE=engine;}catch(err){$('stage').innerHTML='<p style="padding:110px 40px">The native WebGL field could not start. '+esc(err instanceof Error?err.message:err)+'</p>';throw err;}
let sceneIndex=0;let selected:string[]=[];let textId:string|null=null;let tab:InspectorContext['tab']='field';let motionTab:InspectorContext['motionTab']='sequence';let stepIndex=0;let search='';let editing=false,inspectorOpen=false,timelineOpen=false,presenting=false,shapePickerOpen=false,tool:Tool='interact';let shapeChoice:Shape='text',glyphChoice='O';let camera=defaultCamera();let placementStep=false,keepPlacing=false,pinRepeat=false;
let propertyTake:null|{sceneId:string;armed:number;start:number;elapsed:number;tracks:PropertyTrack[];lastSample:number;limit?:number}=null;let appendTake=false,trackPreview=false;const takeWindows=new Map<string,{start:number;end:number}>();
let width=innerWidth,height=innerHeight;let simTime=0,sceneElapsed=0;let fieldPaused=matchMedia('(prefers-reduced-motion: reduce)').matches,scenePlaying=false,journeyPlaying=false;let lastTime=performance.now(),lastUI=0;let toastTimeout=0,saveTimeout=0,lastLibraryWrite=0;let transitionStart=0,transitionDuration=0;let transitionBackground='#f4f2eb',transitionSceneId='';let autosaveErrorShown=false;let captureSettings=defaultCapture();let recordPerformanceWarned=false;let currentVideo:{blob:Blob;mime:string;url:string;source:DesktopScene;settings:CaptureSettings}|null=null;let recordingSource:DesktopScene|null=null;let recordingSettings:CaptureSettings|null=null;const recorder=new LiveRecorder();
let pointer={active:false,world:{x:0,y:0,z:0}};let drag:null|{kind:'entity'|'radius'|'camera'|'text';id:string;startX:number;startY:number;startWorld:Vec3;positions:Map<string,Vec3>;initialRadius:number;cam:Camera;layer:TextLayer|null;pan:boolean}=null;
let guidesVisible=true;let sourceUploadEntityId:{sceneId:string;entityId:string;stepId?:string;layerId?:string}|null=null;let overlayDirty=true,needsFrame=true;const detailState=new Map<string,boolean>();
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
const orbitControl=new OrbitControl($('orbit-control'),()=>camera,()=>{overlayDirty=true;needsFrame=true;},()=>{pointer.active=false;});
const scene=()=>store.document.scenes[sceneIndex]??store.document.scenes[0];
const activeScene=()=>effectiveScene(store.document,journeyPlaying?store.document.savedScenes?.[scene().id]??scene():scene());
const selectedEntity=()=>scene().entities.find(e=>e.id===selected[0]);
const currentText=()=>scene().text.find(t=>t.id===textId)??scene().text[0];
function toast(message:string,duration=4200){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=window.setTimeout(()=>$('toast').hidden=true,duration);}
/** Fires the scene's chosen pointer click effect at a world position. */
function firePointerClick(p:Vec3){const s=effectiveScene(store.document,scene()),kind=s.engine.pointerClick??'pulse';if(kind==='off')return;try{engine.command?.({type:'pointer-effect',kind,strength:engine.telemetry?.()?.params?.pointerClickStrength??s.engine.pointerClickStrength??2.2,radius:(engine.telemetry?.()?.params?.pointerClickRadius??s.engine.pointerClickRadius??.45)*WORLD_SCALE,x:p.x*WORLD_SCALE,y:p.y*WORLD_SCALE,z:p.z*WORLD_SCALE});needsFrame=true;}catch(err){error(err);}}
function error(err:unknown){console.error(err);toast(err instanceof Error?err.message:String(err),6500);}
const deletedLibraryIds=new Set<string>();
function saveSession(){try{const session:SessionState={version:1,journeyId:store.document.id,sceneId:scene().id,selected,stepIndex,sceneElapsed,simTime,playing:scenePlaying,scenePlaying,journeyPlaying,fieldPaused,camera:{...camera},transport:engine.transportState?.()};localStorage.setItem(SESSION_KEY,JSON.stringify(session));localStorage.setItem('oi.field-studies.last',store.document.id);}catch{}}
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
function renderText(){const s=activeScene();$('text-layers').innerHTML=s.text.map(t=>{const l=textLayout(t,width,height);return `<article class="page-text ${t.id===textId?'selected':''}" data-text-id="${t.id}" ${t.visible?'':'hidden'} style="left:${t.x*100}%;top:${t.y*100}%;width:${l.width}px;text-align:${t.align};"><div class="kicker">${esc(t.kicker)}</div><h1 style="font-size:${l.size}px">${esc(t.title)}${t.italic?`<em>${esc(t.italic)}</em>`:''}</h1><p>${esc(t.body)}</p></article>`;}).join('');}
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
 // Edits address the occurrence this Studio was rendered for, even if another
 // instrument changes the selection before the edit commits.
 if(selected[0]&&scene().entities.some(e=>e.id===selected[0]))content.dataset.entityId=selected[0];else delete content.dataset.entityId;
 content.querySelectorAll('.motion-tabs').forEach(el=>el.remove());if(studioSection==='formations')content.querySelector('[data-detail="arrange"]')?.remove();if(studioSection==='scene')content.querySelector('[data-detail="page-text"]')?.remove();if(studioSection==='automation')content.insertAdjacentHTML('beforeend',`<details class="recorded-tracks" data-detail="recorded-takes"><summary>Recorded property takes · ${(scene().propertyTracks??[]).length}</summary><p class="control-note">Recorded base settings follow expression time. Enabled LFO and ramp layers still apply.</p><button class="secondary" data-action="preview-tracks">${trackPreview?'Stop preview':'Preview from scene start'}</button>${(scene().propertyTracks??[]).map(t=>`<div>${esc(t.bind)} · ${t.points.length} keys <button data-action="delete-property-track" data-id="${esc(t.id)}" aria-label="Remove recorded ${esc(t.bind)}">×</button></div>`).join('')||'<p>Record toolbelt properties to create a take here.</p>'}</details>`);if(!search){const groups:Record<string,string[]>={physics:['physics'],pointer:['pointer'],relational:['relational'],collision:['medium','collision','pairwise'],appearance:['palette','material'],volume:['volume'],resonance:['resonance'],layout:['arrange'],text:['page-text']};const ids=groups[studioSection];if(ids&&((tab==='field')||studioSection==='layout'||studioSection==='text')){const extras=studioSection==='appearance'?Array.from(content.querySelectorAll<HTMLElement>('.material-cards,[data-control="field.params.size"],[data-control="field.params.opacity"]')):[];const nodes=[...extras,...ids.flatMap(id=>Array.from(content.querySelectorAll<HTMLElement>('[data-detail="'+id+'"]')))];if(nodes.length)content.replaceChildren(...nodes);nodes.forEach(n=>(n as HTMLDetailsElement).open=true);}}content.querySelectorAll<HTMLDetailsElement>('details[data-detail]').forEach(d=>{if(detailState.has(d.dataset.detail!))d.open=detailState.get(d.dataset.detail!)!;});content.scrollTop=studioScroll;
// The Native field section mounts the live producer panel itself (owner
// addendum: re-parent, never re-render via innerHTML — it owns live
// listeners), replacing the generic detail-groups content above.
if(studioSection==='native'&&nativeField)content.replaceChildren(nativeField.panel);
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
function renderAll(){blueprintHUD?.refresh();renderResearchScenePicker();if(studioDocked&&studioOpen&&beltOpen){beltWasOpen=true;beltOpen=false;}if(!studioDocked&&beltWasOpen){beltWasOpen=false;beltOpen=true;}if((inspectorOpen||contextKind)&&(tool==='pin'||tool==='formation')){tool=cursorTool;railExpanded=false;}if(beltPickerOpen){inspectorOpen=false;contextKind='';timelineOpen=false;shapePickerOpen=false;modesOpen=false;captureOpen=false;}else if(inspectorOpen){contextKind='';timelineOpen=false;shapePickerOpen=false;modesOpen=false;captureOpen=false;}else if(contextKind){timelineOpen=false;shapePickerOpen=false;modesOpen=false;captureOpen=false;}else if(timelineOpen){shapePickerOpen=false;modesOpen=false;captureOpen=false;}sanitiseSelection();sceneBodies?.refresh();workspace.entries=clone(store.document.shared!.toolbelt);if(tab==='motion')studioSection=motionTab==='automation'?'automation':motionTab==='sequence'?'sequence':motionTab==='focus'?'focus':'motion';else if(tab==='objects'&&!['formations','layout'].includes(studioSection))studioSection='formations';else if(tab==='scene'&&!['scene','text'].includes(studioSection))studioSection='scene';else if(tab==='field'&&!['physics','pointer','relational','collision','appearance','volume','resonance','native'].includes(studioSection))studioSection='physics';studioOpen=inspectorOpen&&editing;if(railKey!=='objects'||tool!=='select')railKey=tool;if(transitionDuration&&transitionSceneId!==scene().id){transitionDuration=0;$('transition-canvas').hidden=true;}theme();document.body.classList.toggle('studio-open',studioOpen);$('inspector').classList.toggle('is-studio',studioOpen);$('inspector').classList.toggle('docked',studioDocked);const dockButton=$('dock-studio');if(dockButton){dockButton.setAttribute('aria-pressed',String(studioDocked));dockButton.title=studioDocked?'Return the studio to full size':'Dock the studio where the toolbelt sits';dockButton.innerHTML=icon(studioDocked?'expand':'collapse');}$<HTMLSelectElement>('workspace-appearance').value=workspace.appearance;document.querySelectorAll<HTMLElement>('[data-action="studio-section"]').forEach(b=>b.setAttribute('aria-current',b.dataset.value===studioSection?'page':'false'));document.body.classList.toggle('editing',editing);document.body.classList.toggle('presentation',presenting);document.body.classList.toggle('editing-text',editing&&tool==='text');
 if(!$('inspector').hidden)studioScroll=$('inspector-content').scrollTop;$('inspector').hidden=!inspectorOpen||!editing;$('tool-rail').hidden=presenting;$('view-controls').hidden=!editing||!(tool==='pin'||shapePickerOpen||placementStep)||!!contextKind||inspectorOpen;$('coordinates').hidden=presenting||libraryOpen;$('timeline-panel').hidden=!timelineOpen;$('shape-picker').hidden=!shapePickerOpen||!editing;$('present-return').hidden=!presenting;
 $('scene-number').textContent=String(sceneIndex+1).padStart(2,'0');$('scene-name').textContent=scene().name;
 $('scene-picker').setAttribute('aria-expanded',String(timelineOpen));$('scene-state').textContent=sceneSaveState(store.document,scene());
 document.querySelectorAll<HTMLButtonElement>('[data-rail]').forEach(b=>{const panel=contextKind==='pointer'?'pointer-options':contextKind||(sequenceOpen&&!studioOpen&&!timelineOpen&&!beltPickerOpen&&!modesOpen&&!captureOpen&&!shapePickerOpen&&tool!=='pin'?'formation':'');const active=railPressed(b.dataset.rail!,cursorTool,panel,tool==='pin');b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.querySelectorAll('[data-action="grid"]').forEach(b=>b.classList.toggle('active',camera.grid));document.querySelectorAll('[data-action="snap"]').forEach(b=>b.classList.toggle('active',camera.snap));document.querySelectorAll('[data-action="view-2d"]').forEach(b=>b.classList.toggle('active',camera.mode==='2d'));document.querySelectorAll('[data-action="view-3d"]').forEach(b=>b.classList.toggle('active',camera.mode==='3d'));$<HTMLSelectElement>('working-plane').value=camera.plane;$<HTMLInputElement>('working-depth').value=String(camera.depth);$('depth-axis').textContent=camera.plane==='XY'?'Z':camera.plane==='XZ'?'Y':'X';
 document.querySelectorAll<HTMLButtonElement>('[data-action="undo"]').forEach(b=>b.disabled=!store.undoStack.length);document.querySelectorAll<HTMLButtonElement>('[data-action="redo"]').forEach(b=>b.disabled=!store.redoStack.length);
 document.body.classList.toggle('library-open',libraryOpen);
 $('library-page').hidden=!libraryOpen;const researchActive=document.body.classList.contains('research-active');$('stage').inert=libraryOpen||researchActive;
 // The full object/state Studio and the toolbelt serve the selected occurrence
 // over an active research instrument; the field shows only on explicit preview.
 document.body.classList.toggle('research-studio',researchActive&&inspectorOpen&&editing);document.body.classList.toggle('research-preview',researchActive&&researchPreview);document.querySelectorAll('[data-action="research-preview"]').forEach(b=>{b.classList.toggle('active',researchPreview);b.setAttribute('aria-pressed',String(researchPreview));});
 const originalHeader=document.querySelector('#app > .masthead');
 document.querySelectorAll<HTMLElement>('.chrome,#inspector,#shape-picker').forEach(el=>el.inert=libraryOpen||(researchActive&&el===originalHeader));
 const researchWorkspace=document.getElementById('research-workspace');if(researchWorkspace)researchWorkspace.inert=libraryOpen;
 $('modes-panel').hidden=!modesOpen||libraryOpen;$('capture-panel').hidden=!captureOpen||libraryOpen;if(captureOpen)renderImageSuite();
 document.querySelector('[data-action="modes"]')?.setAttribute('aria-expanded',String(modesOpen));
 document.querySelector('[data-action="capture-options"]')?.setAttribute('aria-expanded',String(captureOpen));
 if(libraryOpen)renderLibrary();
 renderText();renderInspector();renderLive();renderTimeline();renderShapePicker();setHint();transportUI();orbitControl.render();overlayDirty=true;needsFrame=true;
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
function applySceneView(){const v=activeScene().view;if(v){camera.mode=v.mode;camera.yaw=v.yaw;camera.pitch=v.pitch;camera.zoom=v.zoom;camera.panX=v.panX*width;camera.panY=v.panY*height;if(v.nativeCamera){const c=v.nativeCamera;camera.yaw=-c.yaw;camera.pitch=c.pitch;camera.mode=c.yaw||c.pitch?'3d':'2d';camera.zoom=c.zoom*400/stageScale(width,height);const {a,b}=basis(camera),o=stageCentre(width,height);camera.panX=width/2-o.x-c.zoom*(a[0]*c.panX+a[1]*c.panY);camera.panY=height/2-o.y+c.zoom*(b[0]*c.panX+b[1]*c.panY);}}}
function setScene(index:number,automatic=false){if(propertyTake)finishPropertyTake();trackPreview=false;pointer.active=false;if(index<0)index=store.document.scenes.length-1;if(index>=store.document.scenes.length)index=0;if(index===sceneIndex&&!automatic)return;
 if(scenePlaying&&store.document.scenes[index].transition>0&&engine.capabilities.kind==='preview'){const c=$<HTMLCanvasElement>('transition-canvas');c.width=engine.canvas.width;c.height=engine.canvas.height;c.getContext('2d')!.drawImage(engine.canvas,0,0);transitionBackground=scene().field.background;c.style.background=transitionBackground;c.style.opacity='1';c.hidden=false;transitionStart=simTime;transitionDuration=store.document.scenes[index].transition;transitionSceneId=store.document.scenes[index].id;}else{transitionDuration=0;$('transition-canvas').hidden=true;}

 sceneIndex=index;if(!automatic)journeyPlaying=false;applySceneView();sceneElapsed=0;selected=[];textId=scene().text[0]?.id??null;saveSession();placementStep=false;shapePickerOpen=false;if(!automatic)journeyPlaying=false;renderAll();void researchInstruments?.refresh();}
function selectEntity(id:string,multi=false){cursorTool='select';pointer.active=false;railKey='select';railExpanded=true;if(multi){selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];}else selected=[id];editing=true;tool='select';shapePickerOpen=false;journeyPlaying=false;stepIndex=0;renderAll();}
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
 ensureCapacity(incoming);target.entities.push(...incoming);
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
 if(path==='step.text'&&subject){setStateSource(subject,stepIndex,undefined);if(scene().engine.autoFitSizes!==false)refitStepForText(subject,stepIndex,String(priorValue??''),value,{fontFamily:scene().engine.fontFamily,fontWeight:scene().engine.fontWeight});}
 if(path.startsWith('step.')&&subject)syncHeldState(subject,stepIndex);if(path==='step.hold')target.holdOverride=true;if(path==='step.transition')target.transitionOverride=true;
 if(path==='entity.text'&&subject&&scene().engine.autoFitSizes!==false)refitEntityForText(subject,String(priorValue??''),value,{fontFamily:scene().engine.fontFamily,fontWeight:scene().engine.fontWeight});
 if(path==='entity.text'){const e=subject;if(e&&e.sequence.steps.length===1&&!e.sequence.enabled)e.sequence.steps[0].text=value;}
 if((path==='engine.fontFamily'||path==='engine.fontWeight')&&scene().engine.autoFitSizes!==false){const next:FontRef={fontFamily:scene().engine.fontFamily,fontWeight:scene().engine.fontWeight},prev:FontRef={...next,...(path==='engine.fontFamily'?{fontFamily:String(priorValue??'')}:{fontWeight:priorValue})};refitFormationsForFont(prev,next);if(path==='engine.fontFamily')customFontEdit=false;}
 if(path==='composition.frequencyDriver'&&value!=='automation'){for(const l of scene().automation)if(l.target==='field.frequency')l.enabled=false;}
 if(continuous){store.touch();markSaved();overlayDirty=true;needsFrame=true;syncSiblings(path,Number(value),el,subject?.id);theme();}
 else{store.finish();markSaved();const numeric=el instanceof HTMLInputElement&&(el.type==='range'||el.type==='number');if(numeric){needsFrame=true;overlayDirty=true;if(path.startsWith('step.source.'))void refreshSourcePreviews($('capture-panel'));commitNumeric(el,path);}else renderAll();}
}

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
function ensureCapacity(additions:Entity[]){const all=[...scene().entities,...additions];if(all.filter(e=>e.kind==='formation').length>10||all.filter(e=>e.kind==='pin').length>8)throw new Error('The native field supports 10 formations and 8 force-only pins. Remove an object before adding this composition.');}
let nativeWorkspace:ReturnType<typeof installNativeWorkspace>|undefined;
let sceneBodies:ReturnType<typeof installSceneBodies>|undefined;
let blueprintHUD:ReturnType<typeof installBlueprintHUD>|undefined;
// A blank boot frame is not a new chosen work. Retain the host's native
// reference until recovery succeeds or the user explicitly opens a draft.
let awaitingNativeBoot=startsWithNativeReference;
let researchInstruments:ReturnType<typeof installResearchInstruments>|undefined;
// A deliberate peek at the live field while a research instrument stays mounted
// and active: the engine renders only while the person is looking at it.
let researchPreview=false;
let nativeConnectionRows:Record<string,ConnectionBinding[]>={},nativeSelectedRelation:string|null=null;
let journeyNavigation=0;
async function loadJourney(j:Journey){
 nativeWorkspace?.cancelOpen();
 if(propertyTake)finishPropertyTake();
 const generation=++journeyNavigation,version=store.revision,previous=clone(store.document);
 // A navigation may only replace the canvas after its actual departing work
 // has an acknowledged backup. A returning save never replaces newer edits.
 if(!deletedLibraryIds.has(previous.id))await writeDraft(previous);
 if(generation!==journeyNavigation||version!==store.revision)throw new Error('The open request was superseded by newer work. Your current Expression was retained.');
 applyJourney(j);
}
function applyJourney(j:Journey,native=false){journeyNavigation++;if(!native){awaitingNativeBoot=false;void nativeWorkspace?.changed(j);}if(propertyTake)finishPropertyTake();trackPreview=false;rememberWork(j.id);studioOpen=false;j.scenes.forEach(checkNativeLimits);sessionExpressions.set(store.document.id,clone(store.document));sessionExpressions.set(j.id,clone(j));try{if(!deletedLibraryIds.has(store.document.id))saveToLibrary(store.document);}catch{toast('The previous expression is retained in Undo; browser storage is unavailable. Export it before closing this page.',6500);}store.replace(initialiseSceneSaves(initialiseBelts(j)));store.document.updatedAt=j.updatedAt;sceneIndex=0;selected=[];camera=defaultCamera();applySceneView();transitionDuration=0;$('transition-canvas').hidden=true;sceneElapsed=0;journeyPlaying=false;editing=false;inspectorOpen=false;timelineOpen=false;cursorTool='interact';tool='interact';railKey='interact';railExpanded=false;shapePickerOpen=false;closeDialogs();libraryOpen=false;modesOpen=false;try{history.replaceState(null,'',location.pathname+location.search);}catch{}markSaved();renderAll();}
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
function duplicateEntity(){const list=scene().entities.filter(e=>selected.includes(e.id));if(!list.length)return;ensureCapacity(list);changed(()=>{selected=list.map(e=>{const n=clone(e);n.id=uid('entity');n.name+=' copy';n.position.x+=.12;n.position.y-=.12;n.locked=false;n.sequence.steps.forEach(k=>k.id=uid('step'));scene().entities.push(n);return n.id;});});}
function deleteEntities(){if(selected.some(id=>blueprintMember(scene(),id))){toast('Release the blueprint before removing one of its members.');return;}const ids=selected.filter(id=>!scene().entities.find(e=>e.id===id)?.locked);if(!ids.length){toast('Unlock a selected entity before removing it.');return;}let prunedLanes=false;changed(()=>{scene().entities=scene().entities.filter(e=>!ids.includes(e.id));selected=[];prunedLanes=pruneAutomation(scene());});toast('Removed. Undo restores the configuration.'+(prunedLanes?' Its automation lanes without a remaining target were removed with it.':''));}
function reorderScene(from:number,to:number){if(to<0||to>=store.document.scenes.length)return;const currentId=scene().id;changed(()=>{const [item]=store.document.scenes.splice(from,1);store.document.scenes.splice(to,0,item);sceneIndex=store.document.scenes.findIndex(s=>s.id===currentId);});}
async function action(name:string,el:HTMLElement,event?:Event){const s=scene(),subjectId=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,e=subjectId?s.entities.find(v=>v.id===subjectId):selectedEntity();if(e&&el.closest('.live-sequence'))selected=[e.id];switch(name){
 case 'record-properties':if(propertyTake){finishPropertyTake();break;}else{const tracks=recordableTracks();if(!tracks.length){toast('Add local numeric properties to the toolbelt. Shared overrides must be made local before recording.');break;}const previous=s.propertyTakeRange??takeWindows.get(s.id),start=appendTake?(previous?.end??sceneElapsed):(previous?.start??sceneElapsed);if(start>=3600){toast('This scene has reached its one-hour duration limit.');break;}journeyPlaying=false;trackPreview=false;fieldPaused=false;propertyTake={sceneId:s.id,armed:performance.now()+2000,start,elapsed:0,tracks,lastSample:-1,limit:!appendTake&&previous?previous.end-previous.start:undefined};renderAll();}break;
 case 'take-mode':appendTake=!appendTake;renderAll();break;
 case 'delete-property-track':changed(()=>{s.propertyTracks=s.propertyTracks?.filter(t=>t.id!==el.dataset.id);});break;
 case 'preview-tracks':trackPreview=!trackPreview;sceneElapsed=0;scenePlaying=trackPreview;if(trackPreview)fieldPaused=false;renderAll();break;
 case 'studio':contextKind='';beltPickerOpen=false;timelineOpen=false;modesOpen=false;captureOpen=false;setStudio(!studioOpen);break;
 case 'close-studio':setStudio(false);break;
 case 'dock-studio':{const insp=$('inspector'),mutate=()=>{studioDocked=!studioDocked;if(studioDocked){studioSizeMemo={width:insp.style.getPropertyValue('--panel-width'),height:insp.style.getPropertyValue('--panel-height')};insp.style.removeProperty('--panel-width');insp.style.removeProperty('--panel-height');}else if(studioSizeMemo){if(studioSizeMemo.width)insp.style.setProperty('--panel-width',studioSizeMemo.width);else insp.style.removeProperty('--panel-width');if(studioSizeMemo.height)insp.style.setProperty('--panel-height',studioSizeMemo.height);else insp.style.removeProperty('--panel-height');}renderAll();};if(matchMedia('(prefers-reduced-motion: reduce)').matches)mutate();else flipPanel(insp,mutate);break;}
 case 'automation-play':{const s2=scene();changed(()=>{for(const g of automationGroups(s2.automation))s2.automation.find(l=>l.id===g.leader.id)!.enabled=true;});fireAutomations();break;}
 case 'automation-pause':{const s2=scene();changed(()=>{for(const g of automationGroups(s2.automation))if(resolvedAutomation(s2.automation,g.leader).enabled)s2.automation.find(l=>l.id===g.leader.id)!.enabled=false;});automationPhase='idle';renderAll();toast('Automations paused — every group holds at its base. Play restarts them.');break;}
 case 'automation-loop':automationLoop=!automationLoop;if(automationLoop&&!fieldPaused&&!automationRunning())fireAutomations(true);renderAll();break;
 case 'studio-section':studioSection=el.dataset.value!;tab=['formations','layout'].includes(studioSection)?'objects':['sequence','motion','focus','automation'].includes(studioSection)?'motion':['scene','text'].includes(studioSection)?'scene':'field';motionTab=studioSection==='automation'?'automation':studioSection==='motion'?'morph':studioSection==='focus'?'focus':'sequence';search='';$<HTMLInputElement>('control-search').value='';renderAll();$('inspector-content').scrollTop=0;break;
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
 case 'place-formation':contextKind='';shapePickerOpen=true;tool='formation';editing=true;renderAll();break;
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
 case 'native-glyph':if(e)changed(()=>{setStateSource(e,el.dataset.prefix==='step'?stepIndex:0,undefined);applyGlyph(e,el.dataset.prefix==='step'?stepIndex:null,el.dataset.value!);if(el.dataset.prefix==='step')syncHeldState(e,stepIndex);});break;
 case 'native-chain':if(e)changed(()=>{applyChain(e,el.dataset.id!);stepIndex=0;});break;
 case 'native-kundalini-sequence':if(e)changed(()=>{applyKundaliniSequence(e);stepIndex=0;});break;
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
 case 'scene-body-image':{
  const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];
  if(!view||!binding){toast('Open this Scene as a native Expression before setting its body.');break;}
  const path=$<HTMLInputElement>('scene-body-image-path').value.trim();
  if(!path){toast('Name the native image file first.');break;}
  await nativeWorkspace?.edit([{change:'scene_body_set',scene_ref:binding.scene_ref,body:{carrier:'image_media',subject_ref:path,native_owner:'oi',reading:{ref:path,revision:'1',availability:'available'},provenance:[],actions:[],presentation:'inline',capability:{state:'renderable'},span:null,recursion:null}}]);
  toast('Scene body set to this image.');break;
 }
 case 'scene-body-text':{
  const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];
  if(!view||!binding){toast('Open this Scene as a native Expression before setting its body.');break;}
  const path=$<HTMLInputElement>('scene-body-text-path').value.trim();
  if(!path){toast('Name the native text file first.');break;}
  const start=Number($<HTMLInputElement>('scene-body-text-start').value)||0,end=Number($<HTMLInputElement>('scene-body-text-end').value)||0;
  const span=end>start?{start,end}:null;
  await nativeWorkspace?.edit([{change:'scene_body_set',scene_ref:binding.scene_ref,body:{carrier:'text_source',subject_ref:path,native_owner:'oi',reading:{ref:path,revision:'1',availability:'available'},provenance:[],actions:[],presentation:'inline',capability:{state:'renderable'},span,recursion:null}}]);
  toast('Scene body set to this text.');break;
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
 case 'previous':setScene(sceneIndex-1);break;case 'next':setScene(sceneIndex+1);break;
 case 'choose-scene':setScene(Number(el.dataset.index));break;
 case 'toggle-play':toggleScenePlay();break;
 case 'play-journey':if(!journeyPlaying&&!savedSceneIndices(store.document).length){timelineOpen=true;renderAll();toast('Save your first scene before playing the scene strip.');break;}journeyPlaying=!journeyPlaying;if(journeyPlaying){fieldPaused=false;scenePlaying=true;editing=false;inspectorOpen=false;timelineOpen=false;selected=[];cursorTool='interact';tool='interact';shapePickerOpen=false;placementStep=false;if(!store.document.savedScenes?.[scene().id])sceneIndex=savedSceneIndices(store.document)[0];sceneElapsed=0;fireAutomations(true);}applySceneView();renderAll();break;
 case 'present':presenting=true;selected=[];shapePickerOpen=false;renderAll();break;
 case 'exit-present':presenting=false;renderAll();break;
 case 'library':case 'preset-browser':case 'keep':openLibrary();break;
 case 'deep-verso':hostRequest({request:'summon',detail:{kind:'verso',subject:nativeWorkspace?.nativeSubject()??undefined}});break;
 case 'native-work':nativeWorkspace?.toggle();break;
 case 'blueprint':blueprintHUD?.open();break;
 case 'research-preview':if(!researchInstruments?.active())break;researchPreview=!researchPreview;lastTime=performance.now();needsFrame=true;overlayDirty=true;renderAll();break;
 case 'native-library':openLibrary('collection');break;
 case 'lens':lensStudio.select(el.dataset.lens as LensId);break;
 case 'lens-close':lensStudio.closeStudio();break;
 case 'lens-bar':lensStudio.toggleChooser();break;
 case 'lens-op':if(el.dataset.op==='commit'){await nativeWorkspace?.commit();lensStudio.refresh();}break;
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
 case 'add-built-in':{const added=clone(preset(el.dataset.value!).scenes[0].entities);ensureCapacity(added);for(const x of added)x.id=uid('entity');changed(()=>{s.entities.push(...added);selected=added.map(x=>x.id);});closeDialogs();edit(true,'objects');break;}
 case 'import-legacy':{const raw=localStorage.getItem('typographic_pointcloud_saved_states');if(raw){const result=importDocuments(JSON.parse(raw));collectImported(result.journeys);toast(`${result.journeys.length} previous native scenes imported. Original browser key unchanged. ${result.errors.map(e=>e.message).join(' · ')}`,9000);openLibrary();}break;}
 case 'load-saved':{const j=store.document.id===el.dataset.id?store.document:sessionExpressions.get(el.dataset.id!)??readLibrary().find(j=>j.id===el.dataset.id);if(j)await loadJourney(j);break;}
 case 'new-journey':await loadJourney(blankJourney());edit(true,'scene');closeEntryGate();break;
 case 'entry-new':await loadJourney(blankJourney());edit(true,'scene');closeEntryGate();toast('Blank Expression — place a glyph or formation to begin.');break;
 case 'entry-continue':closeEntryGate();toast(store.document.name?'Continued '+store.document.name:'Continued last work');break;
 case 'entry-open':closeEntryGate();openLibrary();break;
 case 'entry-open-native':closeEntryGate();nativeWorkspace?.toggle();break;
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
 case 'source-new':{const added=entity('Image / ASCII','O');ensureCapacity([added]);changed(()=>{s.entities.push(added);selected=[added.id];stepIndex=0;});break;}
 case 'source-add':if(e&&!e.locked&&e.sequence.steps.length<32)changed(()=>{const step=clone(e.sequence.steps[stepIndex]);step.id=uid('step');step.source=undefined;step.name=undefined;e.sequence.steps.push(step);stepIndex=e.sequence.steps.length-1;syncHeldState(e,stepIndex);});break;
 case 'source-image':if(e&&!e.locked){sourceUploadEntityId={sceneId:s.id,entityId:e.id,stepId:e.sequence.steps[stepIndex].id};$<HTMLInputElement>('source-file').click();}break;
 case 'layer-add':{const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),kind=el.dataset.kind;if(ent&&!ent.locked&&(ent.layers?.length??0)<6)changed(()=>{const n=ent.layers?.length??0;const z=((n%2===0?1:-1)*Math.ceil((n+1)/2))*.25;const layer:EntityLayer={id:uid('layer'),text:kind==='glyph'?(el.dataset.value||'O'):'O',z,source:kind==='ascii'?{kind:'ascii',ascii:{text:['########','#      #','#  ##  #','#      #','########'].join('\n'),fontFamily:'monospace'}}:undefined};ent.layers=[...(ent.layers??[]),layer];if(kind==='image'){sourceUploadEntityId={sceneId:s.id,entityId:ent.id,layerId:layer.id};$<HTMLInputElement>('source-file').click();}});break;}
 case 'layer-remove':{const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.index);if(ent&&!ent.locked&&(ent.layers?.length??0)>1)changed(()=>{ent.layers=ent.layers!.filter((_,i)=>i!==idx);});break;}
 case 'layer-move':{const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.index),dir=Number(el.dataset.dir);if(ent&&!ent.locked&&ent.layers){const j=idx+dir;if(j<0||j>=ent.layers.length)break;changed(()=>{const ls=[...ent.layers!];const t=ls[idx];ls[idx]=ls[j];ls[j]=t;ent.layers=ls;});}break;}
 case 'select-text':cursorTool='select';textId=el.dataset.id!;tool='text';renderAll();break;
 case 'move-text':cursorTool='select';tool='text';renderAll();break;
 case 'add-text':cursorTool='select';changed(()=>{const t:TextLayer={id:uid('text'),visible:true,kicker:'A MOMENT IN THE FIELD',title:'Your words,',italic:'in this space.',body:'',x:.07,y:.24,width:240,size:38,align:'left'};s.text.push(t);textId=t.id;tool='text';});break;
 case 'delete-text':if(currentText())changed(()=>{s.text=s.text.filter(t=>t.id!==currentText().id);textId=s.text[0]?.id??null;});break;
 case 'entity-sequence':if(e)selected=[e.id];editing=true;inspectorOpen=true;tab='motion';motionTab='sequence';stepIndex=0;renderAll();break;
 case 'motion-tab':motionTab=el.dataset.value as InspectorContext['motionTab'];renderAll();break;
 case 'select-step':if(e)selected=[e.id];stepIndex=Number(el.dataset.index);placementStep=false;renderAll();break;
 case 'add-step':if(e&&!e.locked&&e.sequence.steps.length<32)changed(()=>{e.sequence.steps.push({id:uid('step'),text:e.sequence.steps.length%2?'I':'O',shape:'text',hold:3,transition:1,position:null});stepIndex=e.sequence.steps.length-1;e.sequence.enabled=true;});break;
 case 'delete-step':if(e&&!e.locked){if(e.sequence.steps.length<=1){toast('Keep at least one sequence link.');break;}changed(()=>{e.sequence.steps.splice(stepIndex,1);stepIndex=Math.max(0,stepIndex-1);pruneAutomation(s);});}break;
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
 case 'monitor-add-glyph':{changed(()=>{const added=entity('New glyph','O');ensureCapacity([added]);scene().entities.push(added);selected=[added.id];});toast('Glyph added. Drag it on the canvas, or edit it under Objects.');break;}
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
 case 'step-earlier':case 'step-later':{const next=stepIndex+(name==='step-earlier'?-1:1);if(e&&next>=0&&next<e.sequence.steps.length&&!e.locked)changed(()=>{[e.sequence.steps[stepIndex],e.sequence.steps[next]]=[e.sequence.steps[next],e.sequence.steps[stepIndex]];stepIndex=next;});break;}
 case 'duplicate-step':if(e&&!e.locked&&e.sequence.steps.length<32)changed(()=>{const k=clone(e.sequence.steps[stepIndex]);k.id=uid('step');e.sequence.steps.splice(++stepIndex,0,k);});break;
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
document.addEventListener('input',ev=>{const el=ev.target as HTMLInputElement;if(el.id==='expression-playhead'){let value=Number(el.value),index=0;while(index<store.document.scenes.length-1&&value>=store.document.scenes[index].duration){value-=store.document.scenes[index].duration;index++;}if(index!==sceneIndex)setScene(index);sceneElapsed=value;trackPreview=true;scenePlaying=false;needsFrame=true;transportUI();return;}if(el.id==='belt-search'){document.querySelectorAll<HTMLElement>('[data-candidate-row]').forEach(row=>row.hidden=!row.dataset.search?.includes(el.value.toLowerCase()));return;}if(el.id==='scene-save-name'){sceneNames.set(scene().id,el.value);return;}if(el.id==='placement-glyph'){glyphChoice=el.value.trim()||'O';return;}if(el.id==='mode-search'||el.id==='library-search'){
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
 if(el.dataset.action==='source-step'){stepIndex=Number(el.value);renderAll();}
 if(el.dataset.action==='source-kind'){const e=selectedEntity();if(e&&!e.locked)changed(()=>{setStateSource(e,stepIndex,el.value==='ascii'?{kind:'ascii',ascii:{text:'O  :  I',fontFamily:'monospace',fontSize:32}}:el.value==='image'?{kind:'image',image:{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1}}:undefined);syncHeldState(e,stepIndex);});}
 if(el.id==='monitor-lane'){monitoredLane=el.value;renderAll();return;}if(el.id==='workspace-appearance'){workspace.appearance=el.value as typeof workspace.appearance;saveWorkspace();renderAll();}
 if(el.dataset.action==='sequence-mode'){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId;const entity=scene().entities.find(v=>v.id===id);if(entity&&!entity.locked)changed(()=>{entity.sequence.enabled=el.value==='play';entity.sequence.manual=el.value==='manual';if(el.value==='hold')syncHeldState(entity,stepIndex);if(el.value==='manual'){scene().engine.autoOscillate=false;scene().engine.morphEnabled=true;}});}
 // Layer editing: depth, glyph text and inline ASCII per layer of the laminated body.
 if(el.dataset.layerDepth!==undefined){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.layerIndex),depth=Number(el.value);if(ent&&!ent.locked&&ent.layers?.[idx]&&Number.isFinite(depth))changed(()=>{ent.layers![idx].z=clamp(depth,-100,100);});}
 if(el.dataset.layerText!==undefined){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.layerIndex);if(ent&&!ent.locked&&ent.layers?.[idx])changed(()=>{ent.layers![idx].text=el.value;});}
 if(el.dataset.layerAscii!==undefined){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.layerIndex);if(ent&&!ent.locked&&ent.layers?.[idx])changed(()=>{const l=ent.layers![idx];l.source=l.source?.kind==='ascii'?{kind:'ascii',ascii:{...l.source.ascii,text:el.value}}:{kind:'ascii',ascii:{text:el.value,fontFamily:'monospace'}};});}
 if(el.dataset.action==='sequence-entity'||el.dataset.action==='monitor-formation'){selected=[el.value];stepIndex=0;renderAll();}
 if(el.dataset.action==='font-family'){void action('font-family',el).catch(error);return;}
});
document.addEventListener('focusout',ev=>{const el=ev.target;if((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)&&el.isConnected&&el.dataset.bind&&el.type!=='range'&&el.type!=='checkbox'){if(el.dataset.cancelCommit){delete el.dataset.cancelCommit;return;}if(el instanceof HTMLTextAreaElement||el.value!==el.dataset.originalValue)applyBinding(el);}});
document.addEventListener('focusin',ev=>{const el=ev.target;if((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)&&el.dataset.bind){el.dataset.originalValue=el.value;delete el.dataset.liveEditValue;delete el.dataset.cancelCommit;}});
document.addEventListener('keydown',ev=>{if(ev.defaultPrevented)return;const el=ev.target as HTMLElement;const typing=el.closest('input,textarea,select,[contenteditable="true"]');if(researchInstruments?.active()){if(libraryOpen){if(ev.key==='Escape'&&!document.querySelector('dialog[open]')){ev.preventDefault();if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();}else closeLibrary();}return;}if(!typing&&!document.querySelector('dialog[open]')&&(ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='z'){ev.preventDefault();void action(ev.shiftKey?'redo':'undo',el);}return;}if(typing){if(ev.key==='Escape'){if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();return;}if(el instanceof HTMLInputElement&&el.dataset.originalValue!==undefined){el.value=el.dataset.originalValue;el.dataset.cancelCommit='true';}el.blur();return;}if(ev.key==='Enter'&&!(el instanceof HTMLTextAreaElement)){ev.preventDefault();if(el instanceof HTMLInputElement&&el.dataset.bind)applyBinding(el);else el.blur();}return;}if(document.querySelector('dialog[open]'))return;if(libraryOpen){if(ev.key==='Escape'){if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();return;}ev.preventDefault();closeLibrary();}return;}if(ev.key==='Escape'&&(modesOpen||captureOpen)){ev.preventDefault();readCapture();modesOpen=false;captureOpen=false;renderAll();return;}
 if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='z'){ev.preventDefault();void action(ev.shiftKey?'redo':'undo',el);return;}
 if(ev.metaKey||ev.ctrlKey||ev.altKey)return;
 if(ev.key==='Escape'){if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();return;}if(propertyTake){finishPropertyTake();return;}if(beltPickerOpen){beltPickerOpen=false;renderAll();return;}if(contextKind){contextKind='';renderAll();return;}if(studioOpen){setStudio(false);return;}if(presenting){presenting=false;renderAll();}else if(placementStep||shapePickerOpen){placementStep=false;shapePickerOpen=false;cursorTool='select';tool='select';renderAll();}else if(timelineOpen){timelineOpen=false;renderAll();}else if(inspectorOpen){inspectorOpen=false;railExpanded=false;renderAll();}else if(editing)edit(false);return;}
 if(ev.key===' '){ev.preventDefault();toggleScenePlay();needsFrame=true;return;}
 const shortcuts:Record<string,string>={e:'edit',p:'tool-pin',v:'tool-select',i:'tool-interact',a:'tool-formation',t:'tool-text',o:'tool-orbit',g:'grid',f:presenting?'exit-present':'present'};
 if(shortcuts[ev.key.toLowerCase()]){ev.preventDefault();void action(shortcuts[ev.key.toLowerCase()],el);return;}
 if(ev.key.startsWith('Arrow')){ev.preventDefault();if(editing&&selected.length){if(selected.some(id=>blueprintMember(scene(),id))){toast('Use Blueprint to move the whole shape.');return;}const amount=ev.shiftKey?.1:.01;changed(()=>scene().entities.filter(e=>selected.includes(e.id)&&!e.locked).forEach(e=>{if(ev.key==='ArrowLeft')e.position.x-=amount;if(ev.key==='ArrowRight')e.position.x+=amount;if(ev.key==='ArrowUp')e.position.y+=amount;if(ev.key==='ArrowDown')e.position.y-=amount;e.position.x=clamp(e.position.x,-50,50);e.position.y=clamp(e.position.y,-50,50);}));}else if(ev.key==='ArrowLeft')setScene(sceneIndex-1);else if(ev.key==='ArrowRight')setScene(sceneIndex+1);}
 if((ev.key==='Delete'||ev.key==='Backspace')&&editing&&selected.length){ev.preventDefault();deleteEntities();}
});
$<HTMLInputElement>('source-file').addEventListener('change',async ev=>{const input=ev.target as HTMLInputElement,file=input.files?.[0],id=sourceUploadEntityId;if(!file||!id)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8_000_000)throw new Error('Use a PNG, JPEG or WebP smaller than 8 MB.');const url=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Image file could not be read'));r.readAsDataURL(file);});const s=store.document.scenes.find(s=>s.id===id.sceneId),e=s?.entities.find(e=>e.id===id.entityId);if(!s||!e||e.locked)return;
  if(id.layerId){changed(()=>{e.layers=(e.layers??[]).map(l=>l.id===id.layerId?{...l,source:{kind:'image',image:{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1,dataUrl:url,name:file.name}}}:l);});toast('Layer sampled: '+file.name,5000);return;}
  const index=e.sequence.steps.findIndex(k=>k.id===id.stepId);if(index<0)return;
  // Pre-sample with the same normalization the engine will run, so the toast
  // reports the real cutout and the square extent preserves the subject aspect.
  const visual=await sourceVisual('image',url,{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1},{paper:s.field.background,ink:s.field.palette[0]});
  changed(()=>{setStateSource(e,index,{kind:'image',image:{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1,dataUrl:url,name:file.name}});syncHeldState(e,index);});
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
$('stage').addEventListener('pointerdown',ev=>{if((ev.target as HTMLElement).closest('button'))return;
 if(libraryOpen)return;
 if(ev.button===0&&cursorTool==='interact'&&tool==='interact'){if(inspectorOpen||studioOpen||contextKind||sequenceOpen||beltOpen||timelineOpen||modesOpen||captureOpen||beltPickerOpen||assignmentGroup||assignmentTarget||selected.length||editing||guidesVisible){inspectorOpen=false;studioOpen=false;contextKind='';sequenceOpen=false;beltOpen=false;timelineOpen=false;modesOpen=false;captureOpen=false;beltPickerOpen=false;assignmentGroup='';assignmentTarget='';selected=[];editing=false;guidesVisible=false;renderAll();}}
 if(ev.button!==0&&ev.button!==2)return;
 if(!presenting&&(ev.button===2||tool==='orbit')){pointer.active=false;drag={kind:'camera',id:'',startX:ev.clientX,startY:ev.clientY,startWorld:{x:0,y:0,z:0},positions:new Map(),initialRadius:0,cam:{...camera},layer:null,pan:ev.button===2||ev.shiftKey};$('stage').setPointerCapture(ev.pointerId);ev.preventDefault();return;}
 if(presenting||!editing){if(ev.button===0&&tool==='interact'){try{const w=positionAt(ev);pointer={active:true,world:w};firePointerClick(w);}catch{}}return;}
 try{
  if(placementStep){const e=selectedEntity();if(e&&!e.locked&&!blueprintMember(scene(),e.id)){const p=positionAt(ev);changed(()=>{e.sequence.steps[stepIndex].position={x:p.x-e.position.x,y:p.y-e.position.y,z:p.z-e.position.z};});placementStep=false;inspectorOpen=true;renderAll();}return;}
  if(tool==='interact'){const w=positionAt(ev);pointer={active:true,world:w};firePointerClick(w);return;}
  if(tool==='pin'||tool==='formation'){
   if(scene().entities.filter(e=>e.kind===(tool==='pin'?'pin':'formation')).length>=(tool==='pin'?8:10)){toast(tool==='pin'?'The native field supports eight force-only pins.':'The native field supports ten formations.');return;}
   const p=positionAt(ev),newEntity=tool==='pin'?pin(p):entity(glyphChoice==='O'?'New formation':glyphChoice,glyphChoice,p);if(tool==='formation'){newEntity.shape=shapeChoice;newEntity.sequence.steps[0].shape=shapeChoice;}
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
$('stage').addEventListener('wheel',ev=>{if(ev.ctrlKey||ev.metaKey||(!editing&&cursorTool!=='interact'))return;ev.preventDefault();pointer.active=false;camera.zoom=clamp(camera.zoom*Math.exp(-ev.deltaY*.001),.2,4);overlayDirty=true;needsFrame=true;},{passive:false});
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
function frameData(delta:number):EngineFrame{const base=activeScene();
 // Recorded takes override base values while the playhead moves; the revision
 // term follows the playhead so the engine rebuilds only when authored content
 // actually changes instead of hashing the whole document every frame.
 const tracksActive=(journeyPlaying||trackPreview)&&!propertyTake&&!!base.propertyTracks?.length;
 const current=effectiveScene(store.document,tracksActive?evaluateTracks(base,sceneElapsed):base);
 return {connections:nativeConnectionRows[base.id],selectedConnection:nativeSelectedRelation,scene:current,scaffold:editing&&!presenting&&guidesVisible?current.view.nativeScaffold??'off':'off',simTime,delta,params:(()=>{const p=engine.capabilities.kind==='production'?current.field.params:evaluateParameters(current,simTime);return physisParticleCap&&p.count>physisParticleCap?{...p,count:physisParticleCap}:p;})(),camera,pointer,selectedIds:editing&&!presenting&&guidesVisible?selected:[],authoringRevision:store.revision*1e7+(tracksActive?1+Math.floor(sceneElapsed*60):0)};}
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
 if(journeyPlaying&&scenePlaying&&!editing&&!libraryOpen){sceneElapsed+=Math.min(rawDelta,.25);if(sceneElapsed>=activeScene().duration){const indices=savedSceneIndices(store.document),next=indices.indexOf(sceneIndex)+1;if(next>=indices.length&&!store.document.loop){journeyPlaying=false;scenePlaying=false;sceneElapsed=0;applySceneView();renderAll();}else{setScene(indices[next%indices.length],true);fireAutomations(true);}}}
 if(transitionDuration>0){const f=clamp((simTime-transitionStart)/Math.max(.01,transitionDuration),0,1);$<HTMLCanvasElement>('transition-canvas').style.opacity=String(1-f);if(f>=1){transitionDuration=0;$('transition-canvas').hidden=true;}}
 orbitControl.render();if(overlayDirty&&!libraryOpen)drawGuides();if(recorder.active){const paperScene={...activeScene(),field:{...activeScene().field,background:native?.background??scene().field.background,palette:native?.palette??scene().field.palette,params:{...scene().field.params,...native?.params}}};const copy=()=>recorder.frame(engine.canvas,paperScene,width,height,captureTransition());try{if(engine.withCleanFrame)engine.withCleanFrame(copy);else copy();}catch(err){recorder.stop();error(err);}}frames++;
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
let livedRailHTML='';
// The DEEP cut tools — the same rail element, the deep working set (owner
// wayfinder §13: reuse the rail's grammar, change the working tools). The
// lens chooser joins when the lens island lands; only real tools ship.
const DEEP_TOOLS:[string,string,string,string?][]=[
  ['tool-interact','pointer','Interact / navigate','data-rail="interact" aria-pressed="false"'],
  ['tool-select','select','Select','data-rail="select" aria-pressed="false"'],
  ['lens-bar','modes','Show or hide instruments','aria-expanded="true" aria-controls="lens-chooser"'],
  ['deep-home','home','Epii home'],
  ['native-library','library','Library — My World / O:I Web'],
  ['native-work','save','Native composition — commit, save and reopen'],
  ['blueprint','grid','Scene blueprint'],
  ['deep-verso','wiki','Verso — the subject\u2019s account and sources'],
];
function renderRail(){
  const rail=document.getElementById('tool-rail');
  if(!rail)return;
  if(!livedRailHTML)livedRailHTML=rail.innerHTML;
  rail.innerHTML=hostMode==='techne'
    ?DEEP_TOOLS.map(([a,i,l,extra])=>ib(a,i,l,extra??'')).join('<span class="toolbar-divider" aria-hidden="true"></span>')
    :livedRailHTML;
}
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
 if(mode==='expressions'){researchInstruments?.close();techneWorld.hide();setInstrumentSurface(null);}else activateInstrument(lensStudio.active());
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
function openHostExpression(ref:string){
 if(typeof ref!=='string'||!ref.startsWith('expression:'))return;
 if(kernelExpressionsAvailable()){void nativeWorkspace?.open(ref);return;}
 // Buffer the LATEST ref and arm exactly one announce listener (not one per
 // pre-ready call), so repeated posts before the channel is up converge to a
 // single last-wins open and no message listeners accumulate.
 pendingHostOpen=ref;
 if(hostOpenArmed)return;
 hostOpenArmed=true;
 window.addEventListener('message',function ready(event){if(event.source===window.parent&&event.data?.v===1&&event.data?.kind==='oi-kernel-channel'){window.removeEventListener('message',ready);hostOpenArmed=false;const r=pendingHostOpen;pendingHostOpen=null;if(r)void nativeWorkspace?.open(r);}});
}
window.addEventListener('message',ev=>{if(ev.source!==window.parent)return;const d=ev.data as {type?:string;width?:number;height?:number;right?:number;coveredRight?:number;appearance?:unknown;v?:unknown;kind?:unknown;mode?:unknown;command?:unknown;ref?:unknown;req?:unknown;target?:unknown;source?:unknown}|null;
 if(d&&d.type==='oi-shell-cutout'&&typeof d.width==='number'&&typeof d.height==='number'){
  if(d.appearance==='dark'||d.appearance==='light'){hostedAppearance=d.appearance;theme();}
  document.documentElement.style.setProperty('--shell-cutout-w',Math.max(0,d.width)+'px');
  document.documentElement.style.setProperty('--shell-cutout-h',Math.max(24,d.height)+'px');
  document.documentElement.style.setProperty('--shell-cutout-r',Math.max(0,typeof d.right==='number'?d.right:0)+'px');
  document.documentElement.style.setProperty('--shell-covered-right',(Number.isFinite(d.coveredRight)?Math.max(0,d.coveredRight!):0)+'px');
  return;
 }
 if(d&&d.v===1&&d.kind==='host-mode'&&(d.mode==='expressions'||d.mode==='techne')){setHostMode(d.mode);announceHostState();return;}
 if(d&&d.v===1&&d.kind==='host-command'){
  if(d.command==='interact'||d.command==='select')activateRail(d.command);
  else if(d.command==='open-expression'&&typeof d.ref==='string')openHostExpression(d.ref);
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
const nativeField=installNativeField(engine,()=>{fieldPaused=false;needsFrame=true;renderAll();});
// Without a retaining engine there is no native producer to present; the
// Studio nav offers no dead "Native field" entry for it.
if(!nativeField)document.querySelector('[data-action="studio-section"][data-value="native"]')?.remove();
window.__FIELD_STUDIES__={getDocument:()=>clone(store.document),getState:()=>({studioOpen,beltOpen,needsFrame,libraryOpen,librarySection,modesOpen,captureOpen,railKey,railExpanded,sceneIndex,selected:[...selected],textId,editing,inspectorOpen,timelineOpen,tool,simTime,sceneElapsed,playing:scenePlaying,scenePlaying,fieldPaused,journeyPlaying,automationLoop,camera:{...camera},fps,recording:recorder.active,pointerActive:pointer.active,engine:engine.capabilities.name,hostMode,activeLens:lensStudio.active()}),project:(v:Vec3)=>project(v,camera,width,height),unproject:(x:number,y:number)=>unproject(x,y,camera,width,height),selectEntity:(id:string)=>selectEntity(id),setScene:(i:number)=>setScene(i),openEditor:(t:InspectorContext['tab'])=>edit(true,t),pause:()=>{fieldPaused=true;needsFrame=true;renderAll();},play:()=>{fieldPaused=false;needsFrame=true;renderAll();},native:()=>nativeField?.controller.reading,nativeTargets:()=>nativeField?.controller.inspectTargets(),dispose:()=>{researchInstruments?.destroy();techneWorld.destroy();nativeField?.dispose();cancelAnimationFrame(rafId);coverObserver?.disconnect();orbitControl.dispose();engine.dispose();},command:(cmd:any)=>{engine.command?.(cmd);needsFrame=true;},capabilities:engine.capabilities,inspect:(read=false)=>engine.inspect?.(read),telemetry:()=>engine.telemetry?.(),nativeProject:(v:Vec3)=>engine.projectNative?.(v),capture:(w:number,h:number)=>engine.capture?.(w,h)};
function applyNativeView(view:KernelConversion,preservePosition=false){
 awaitingNativeBoot=false;
 const oldScene=scene().id,oldCamera={...camera},oldTime=sceneElapsed,oldSelection=[...selected],oldPlaying=journeyPlaying;
 if(!preservePosition)applyJourney(view.journey,true);else {store.replace(initialiseSceneSaves(initialiseBelts(view.journey)));}
 const desired=preservePosition?oldScene:view.startSceneId;
 sceneIndex=Math.max(0,store.document.scenes.findIndex(s=>s.id===desired));
 if(preservePosition){camera=oldCamera;sceneElapsed=oldTime;selected=oldSelection.filter(id=>scene().entities.some(e=>e.id===id));journeyPlaying=oldPlaying;}
 else {applySceneView();const nativeRef=view.document.selection?.entity_ref;const occurrence=view.bindings[scene().id]?.occurrences.find(o=>o.entity_ref===nativeRef);selected=occurrence?[occurrence.view_entity_id]:[];}
 markSaved();renderAll();announceHostState();void researchInstruments?.refresh();
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
 const originalHeader=document.querySelector<HTMLElement>('#app > .masthead');
 // One header. The instrument HUD is itself a masthead; leaving the
 // expressions header standing under it is the doubled bar on M1, M2 and M4.
 if(originalHeader){originalHeader.inert=research;originalHeader.hidden=research;}
 const hud=document.getElementById('research-hud');if(hud)hud.hidden=!research;
 const inspector=document.getElementById('research-inspector');if(inspector)inspector.hidden=!research;
 if(research){
  if(nativeField&&!researchSuspension)researchSuspension=nativeField.controller.suspend(researchHoldReason);
 }else{
  const suspension=researchSuspension;researchSuspension=null;
  if(suspension&&nativeField)void nativeField.controller.releaseSuspension(suspension).catch(error);
  lastTime=performance.now();needsFrame=true;overlayDirty=true;
 }
 renderResearchScenePicker();
}
function renderResearchScenePicker(){
 const picker=document.getElementById('research-scene') as HTMLSelectElement|null;if(!picker)return;
 const options=store.document.scenes.map((s,i)=>`<option value="${i}">${esc(s.name)}</option>`).join('');
 if(picker.dataset.options!==options){picker.innerHTML=options;picker.dataset.options=options;}
 picker.value=String(sceneIndex);
}
function activateInstrument(lens:LensId){
 setInstrumentSurface(lens);
 pointer.active=false;
 if(drag){if(store.transactionOpen)store.finish();drag=null;markSaved();}
 placementStep=false;keepPlacing=false;pinRepeat=false;
 researchPreview=false;
 if(lens==='project')techneWorld.show();else techneWorld.hide();
 // M0/M3/M5 are operating modes of this same Expression and Scene engine.
 // Mature Research Canvas tools are mounted by the research instrument adapter.
 if(lens==='canvas'||lens==='timeline'||lens==='place'){if(propertyTake)finishPropertyTake();if(recorder.active){recorder.stop();toast('Recording stopped before opening the research instrument.');}void researchInstruments?.open(lens==='canvas'?'m1':lens==='timeline'?'m2':'m4');}
 else researchInstruments?.close();
 if(lens==='project'){sequenceOpen=false;timelineOpen=false;inspectorOpen=false;contextKind='';beltPickerOpen=false;}
 if(lens==='journey'){sequenceOpen=false;timelineOpen=true;inspectorOpen=false;contextKind='';beltPickerOpen=false;}
 if(lens==='palace'){if(propertyTake)finishPropertyTake();void palaceInstrument.open();}
 else palaceInstrument.close();
 renderAll();announceHostState();
}
const lensStudio=installLensStudio({subject:()=>nativeWorkspace?.nativeSubject()??null,construction:()=>nativeWorkspace?.construction()??null,activate:activateInstrument});
nativeWorkspace=installNativeWorkspace({shouldRetainDraft:()=>!awaitingNativeBoot||store.revision!==0,snapshot:()=>({journey:clone(store.document),sceneId:scene().id,entityId:selected[0]??null}),version:()=>store.revision,load:applyNativeView,toast,summon:(kind,subject)=>hostRequest({request:'summon',detail:{kind,subject}}),correspondence:(rows,selection)=>{nativeConnectionRows=rows;nativeSelectedRelation=selection;needsFrame=true;lensStudio.refresh();}});
// ES1A/ES1B (O:I #352): the active native Scene's own body and its
// declarative triggers, laid over the live field as real readable material.
sceneBodies=installSceneBodies({
 nativeView:()=>nativeWorkspace?.nativeView(),
 sceneId:()=>scene().id,
 open:ref=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];if(!view||!binding){toast('Open a native Scene before opening its source.');return;}hostRequest({request:'summon',detail:{kind:'source',ref,subject:{ref:view.document.expression_ref,kind:'expression',nativeOwner:'oi',revision:view.document.revision,title:view.document.title,sceneRef:binding.scene_ref,entityRef:null,relationRef:null}}});},
 jumpToScene:sceneRef=>{const view=nativeWorkspace?.nativeView();if(!view){toast('Open a native Scene before jumping to another one.');return;}const entry=Object.entries(view.bindings).find(([,b])=>b.scene_ref===sceneRef);if(!entry){toast('That native Scene is not currently loaded in this view.');return;}const index=store.document.scenes.findIndex(s=>s.id===entry[0]);if(index<0)return;setScene(index);},
});
blueprintHUD=installBlueprintHUD({container:$('native-work'),nativeView:()=>nativeWorkspace?.nativeView(),sceneId:()=>scene().id,apply:intent=>nativeWorkspace!.blueprint(intent)});
const techneWorld=installTechneWorld(ref=>nativeWorkspace!.open(ref));
const researchContainer=document.createElement('section');
researchContainer.id='research-workspace';researchContainer.setAttribute('aria-label','Research instrument workspace');
// Instrument keyboard handling remains with its actual research component.
// The physical application's document handler stands down while it is active.
document.body.append(researchContainer);
const researchHUD=document.createElement('header');researchHUD.id='research-hud';researchHUD.className='masthead chrome';researchHUD.hidden=true;
const researchTools=document.createElement('div');researchTools.id='research-tools';researchTools.setAttribute('role','toolbar');researchTools.setAttribute('aria-label','Active instrument tools');
const researchCommon=document.createElement('nav');researchCommon.className='research-common';researchCommon.setAttribute('aria-label','Native work');
researchCommon.innerHTML=`${ib('lens-bar','modes','Show or hide instruments','aria-expanded="true" aria-controls="lens-chooser"')}<select id="research-scene" aria-label="Active native Scene"></select>${ib('lens','sequence','Scenes and sequence','data-lens="journey"')}${ib('native-library','library','Native Library')}${ib('native-work','save','Save native composition')}${ib('research-preview','eye','Preview the live field','aria-pressed="false"')}${ib('blueprint','grid','Scene blueprint')}${ib('deep-verso','wiki','Sources for this work')}`;
researchCommon.addEventListener('change',event=>{if((event.target as HTMLElement).id==='research-scene')setScene(Number((event.target as HTMLSelectElement).value));});
researchHUD.append(researchTools,researchCommon);
const researchInspector=document.createElement('aside');researchInspector.id='research-inspector';researchInspector.setAttribute('aria-label','Instrument inspector');researchInspector.hidden=true;
document.body.append(researchHUD,researchInspector);
function researchScene(id:string){const value=store.document.scenes.find(item=>item.id===id);if(!value||value.id!==scene().id)throw new Error('The active Scene changed; return to that Scene before editing.');return value;}
async function commitResearch(){if(!await nativeWorkspace?.commit())throw new Error('The native owner did not acknowledge this edit. Your working draft is retained.');}
function ownResearchConnection(ref:string){const value=nativeWorkspace?.nativeView()?.document.relations?.[ref];if(!value||value.native_owner!=='oi')throw new Error('Source relations must be changed through their source owner.');return value;}
function connectionKind(kind:string){if(!kind.trim()||kind.length>120)throw new Error('Choose a connection type of 1–120 characters.');return encodeURIComponent(kind.trim());}
function assertConnectionMembers(sceneId:string,source:string,target:string){researchScene(sceneId);const members=nativeWorkspace?.nativeView()?.bindings[sceneId]?.member_refs;if(!members?.includes(source)||!members.includes(target))throw new Error('Both connection endpoints must belong to the current native Scene.');}
researchInstruments=installResearchInstruments({
 container:researchContainer,tools:researchTools,inspector:researchInspector,read:readTechneReading,
 sceneMaterial:id=>clone(researchScene(id)),
 material:async(id,action:ResearchMaterialAction)=>{const target=researchScene(id);changed(()=>applyResearchMaterial(target,action));await commitResearch();},
 inspectSubject:(ref,context)=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];if(!view||!binding){toast('Open a native Scene before opening its source.');return;}hostRequest({request:'summon',detail:{kind:'source',ref,context,subject:{ref:view.document.expression_ref,kind:'expression',nativeOwner:'oi',revision:view.document.revision,title:view.document.title,sceneRef:binding.scene_ref,entityRef:null,relationRef:null}}});},nativeView:()=>nativeWorkspace?.nativeView(),sceneId:()=>scene().id,
 select:(sceneId,entityId,bindingRef)=>{if(sceneId!==scene().id)return;selected=entityId?[entityId]:[];nativeSelectedRelation=bindingRef??null;void nativeWorkspace?.select(sceneId,entityId,bindingRef);overlayDirty=true;needsFrame=true;if(document.body.classList.contains('research-studio'))renderAll();},
 // A deliberate typed knowledge relationship between the two occurrences'
 // constellation participations. The presentation connection is unchanged.
 relateKnowledge:async(sceneId,input)=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[sceneId];if(sceneId!==scene().id||!view||!binding)throw new Error('Open the native Scene before recording a relationship.');const receipt=await techneConstellationRelate({operation:'relate',expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref,from_entity_ref:input.sourceEntityRef,to_entity_ref:input.targetEntityRef,relation:input.relation,direction:input.direction});if(receipt.expression.state==='ready'){if(!await nativeWorkspace?.open(receipt.expression.expression_ref))toast(`Relationship saved in the constellation (revision ${receipt.frame_revision}); reopen this composition to show it.`,8000);}else toast(`Relationship saved in the constellation (revision ${receipt.frame_revision}). ${receipt.expression.detail}`,9000);return {relation_ref:receipt.relation_ref,frame_ref:receipt.frame_ref,frame_revision:receipt.frame_revision};},
 // The existing full object/state Studio for this exact occurrence, over the
 // still-active instrument. No second editor or Canvas-only store.
 editObject:(sceneId,entityId)=>{if(sceneId!==scene().id){toast('The active Scene changed; return to that Scene before editing.');return;}if(!scene().entities.some(value=>value.id===entityId)){toast('This occurrence is no longer present.');return;}selected=[entityId];textId=null;stepIndex=0;researchPreview=false;editing=true;inspectorOpen=true;tab='objects';studioSection='formations';renderAll();},
 openSubject:ref=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];if(!view||!binding){toast('Open a native Scene before opening its source.');return;}hostRequest({request:'summon',detail:{kind:'source',ref,subject:{ref:view.document.expression_ref,kind:'expression',nativeOwner:'oi',revision:view.document.revision,title:view.document.title,sceneRef:binding.scene_ref,entityRef:null,relationRef:null}}});},
 move:async(sceneId,entityId,position)=>{if(blueprintMember(researchScene(sceneId),entityId))throw new Error('Use Blueprint to move the whole shape, or release it to edit individual positions.');const item=researchScene(sceneId).entities.find(value=>value.id===entityId);if(!item||item.locked)throw new Error('This occurrence is locked or no longer present.');if(!Number.isFinite(position.x)||!Number.isFinite(position.y))throw new Error('Position must be finite.');changed(()=>{item.position.x=clamp(position.x,-50,50);item.position.y=clamp(position.y,-50,50);});await commitResearch();},
 // A group gesture (multi-select move, align, distribute, nudge burst) is one
 // store change and one native commit.
 moveMany:async(sceneId,moves)=>{const target=researchScene(sceneId);for(const {entityId,position} of moves){if(blueprintMember(target,entityId))throw new Error('Use Blueprint to move the whole shape, or release it to edit individual positions.');const item=target.entities.find(value=>value.id===entityId);if(!item||item.locked)throw new Error('This occurrence is locked or no longer present.');if(!Number.isFinite(position.x)||!Number.isFinite(position.y))throw new Error('Position must be finite.');}changed(()=>{for(const {entityId,position} of moves){const item=target.entities.find(value=>value.id===entityId)!;item.position.x=clamp(position.x,-50,50);item.position.y=clamp(position.y,-50,50);}});await commitResearch();},
 createNote:async(sceneId,position)=>{const target=researchScene(sceneId),item=entity('New note','New note',{...position,z:0});ensureCapacity([item]);changed(()=>{target.entities.push(item);selected=[item.id];});await commitResearch();},
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
});
lensStudio.setMode(hostMode);
(document.querySelector('#workspace-menu') as HTMLElement)?.insertAdjacentHTML('beforeend',ib('native-work','save','Native composition — save and reopen'));
(document.querySelector('#workspace-menu') as HTMLElement)?.insertAdjacentHTML('beforeend',ib('native-library','library','Native Library — My World / O:I Web'));
Object.assign(window.__FIELD_STUDIES__,{nativeWorking:()=>nativeWorkspace?.inspect(),nativeConnections:()=>engine.inspectConnections?.(),openNative:(reference:string)=>nativeWorkspace?.open(reference),openNativeFile:(path:string)=>nativeWorkspace?.openFile(path)});
const qs=new URLSearchParams(location.search);
// A hosted deep link (the app's own ?journey/?scene idiom): open a named
// expression from the browser library, the featured set or the starters —
// the Technè M0 instrument opens onto the Epii face this way
// (?expression=source-twelve-faces, owner direction 2026-09-19).
const qsExpression=qs.get('expression');
if(qsExpression){const found=[...readLibrary(),...featuredExpressions(),...startingPoints().map(p=>p.expression)].find(j=>j.id===qsExpression);if(found)store.document=initialiseSceneSaves(initialiseBelts(found));}
if(qs.get('journey')==='seven')store.document=initialiseSceneSaves(initialiseBelts(nativeSeven()));if(qs.get('scene')){const index=store.document.scenes.findIndex(s=>s.name.toLowerCase()===qs.get('scene')!.toLowerCase());if(index>=0)sceneIndex=index;}if(qs.has('still'))fieldPaused=true;
if(window.__START_PRESENTATION__||qs.has('present')){presenting=true;fieldPaused=false;scenePlaying=true;journeyPlaying=store.document.scenes.length>1;}
async function startWorkspace(){
 let recovered:SessionState|undefined;
 let showEntry=false;
 if(!window.__JOURNEY__&&!qs.has('journey')&&!qsExpression){try{for(const draft of await readDrafts())sessionExpressions.set(draft.id,draft);const id=localStorage.getItem('oi.field-studies.last'),draft=id?await readDraft(id):undefined;if(draft&&(!initial.updatedAt||draft.id!==initial.id||draft.updatedAt>=initial.updatedAt)){store.document=initialiseSceneSaves(initialiseBelts(draft));store.touch();}recovered=validateSession(JSON.parse(localStorage.getItem(SESSION_KEY)??'null'),store.document);showEntry=!startsInTechne;}catch(e){console.warn('Draft recovery unavailable',e);showEntry=!startsInTechne;}}
 if(recovered&&!qs.has('scene')){sceneIndex=store.document.scenes.findIndex(s=>s.id===recovered!.sceneId);selected=recovered.selected;stepIndex=recovered.stepIndex;sceneElapsed=recovered.sceneElapsed;simTime=recovered.simTime;scenePlaying=recovered.scenePlaying??recovered.playing;journeyPlaying=recovered.journeyPlaying;if(recovered.fieldPaused!==undefined)fieldPaused=recovered.fieldPaused;if(qs.has('still'))fieldPaused=true;camera=recovered.camera;}else applySceneView();
 document.body.classList.toggle('oi-host-techne',hostMode==='techne');renderRail();
 if(!qsExpression?.startsWith('expression:'))await nativeWorkspace?.changed(store.document);
 resize();engine.render(frameData(0));if(recovered?.transport)engine.restoreTransport?.(recovered.transport);
 trackPreview=!!scene().propertyTracks?.length;resize();renderAll();if(location.hash.startsWith('#library'))openLibrary(location.hash.includes('about')?'about':'collection',false);rafId=requestAnimationFrame(tick);
if(startupError)toast(startupError,7000);else if(workspaceStorageError)toast('Saved toolbelt could not be read. Starter controls are available for this session.',7000);
if(fieldPaused&&!recovered&&!qs.has('still'))toast('A still field, following your reduced-motion preference. Play a scene, or lift “Pause physics” in the studio, to set it in motion.',6000);
if(qs.has('edit'))edit(true,(['scene','objects','field','motion'].includes(qs.get('edit')!)?qs.get('edit'):'scene')as InspectorContext['tab']);
if(showEntry)openEntryGate(!!recovered||!!localStorage.getItem('oi.field-studies.last'),store.document.name);

if(qsExpression?.startsWith('expression:')){const open=()=>void nativeWorkspace?.open(qsExpression);if(kernelExpressionsAvailable())open();else window.addEventListener('message',function ready(event){if(event.source===window.parent&&event.data?.v===1&&event.data?.kind==='oi-kernel-channel'){window.removeEventListener('message',ready);open();}});}
setInterval(()=>{saveSession();if(propertyTake&&propertyTake.elapsed>0)void flushDraft();},1000);}
function openEntryGate(hasContinue:boolean,continueLabel?:string){
 const gate=$('entry-gate');gate.hidden=false;gate.innerHTML=entryGateHTML({hasContinue,continueLabel:continueLabel?`Continue “${continueLabel}”`:undefined,hasNative:kernelExpressionsAvailable()});
}
function closeEntryGate(){const gate=$('entry-gate');gate.hidden=true;gate.innerHTML='';}
window.addEventListener('physis-quality',(ev=>{const s=(ev as CustomEvent).detail??{};if(Number(s.fps)>0)physisFpsCap=Number(s.fps);if(Number(s.pixelRatio)>0){physisPixelRatio=Number(s.pixelRatio);if(physisPixelRatio!==physisRatioApplied){physisRatioApplied=physisPixelRatio;resize();}}if(Number(s.particleLimit)>0)physisParticleCap=Number(s.particleLimit);needsFrame=true;}) as EventListener);
function desktopSource():DesktopScene{return {expression:clone(store.document),sceneIndex,camera:{...camera},viewport:{width,height},name:scene().name+' · '+store.document.name};}
installPhysis(desktopSource,async source=>{await loadJourney(validateJourney(source.expression));setScene(source.sceneIndex??0);camera={...defaultCamera(),...source.camera};if(source.viewport){camera.panX*=width/source.viewport.width;camera.panY*=height/source.viewport.height;}overlayDirty=true;needsFrame=true;renderAll();},toast);
void startWorkspace();
