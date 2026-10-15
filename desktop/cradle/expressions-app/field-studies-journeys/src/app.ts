import {installBlueprintHUD} from './blueprintHUD.js';
import {blueprintMember} from './blueprintGeometry.js';
import {installNativeField} from "./nativeField";
import {announceInstrument} from "./native-field/ql/instrumentAnnouncement.mjs";
import "./native-field/liveCut.css";
import {SESSION_KEY,SessionState,validateSession,writeDraft,readDraft,readDrafts,removeDraft,applyRecoveryPlan,quarantineView,restoreQuarantinedDraft,listOwnerQuarantine,removeOwnerKeptDraft,restoreOwnerKeptDraft} from './recovery';
import {ownerQuarantineRows} from './draftStorage';
import type {OwnerQuarantineSection} from './expressions';
// lane-3 E17-E19: one draft scheduler, the draft/saved offer and the session mark.
import {DraftSchedule,draftStatusLine} from './draftSchedule';
import {recoveryOffer,supersededDraft,recoveryDiffLines,planRecoveryChoice,mergeTakeIntoDraft,readUncleanExit,markSessionOpen,markSessionClosed,offerClock,recordBootExit,quarantineNotice,type RecoveryChoice,type RecoveryDiff} from './draftStorage';
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
import {PropertyTrack,sampleTrack,evaluateTracks,readTrackValue,mergeTake,expressionTiming,channelRange,validateCurveEdit,touchesOfKey,type CurveTouch,type ChannelRange,type Interpolation} from './propertyTracks';
import {curveHit,laneFrame,fromPixel,insertKey,removeKey,moveKey,moveHandle,setSegmentType,channelName,channelStateFor,channelPanelHTML,previewScene,type ChannelView,type HandleEnd,type LaneFrame,type Points} from './curveLane';
import {transitionKindOf,transitionSpecFor,transitionLabel,dipWeights,wipeHoldRect,seamGlyphHTML,seamChooserHTML,writeSeamTransition,curveProgress,curveOf,edgeEditRefusal,pendingSwitchStillWaits,curvePointsOf,transitionCurveHandleEdit,curveGestureWrite,TRANSITION_LANE,type TransitionKind,type TransitionParams,type TransitionSpec,type TransitionCurve,type WipeDirection,type SwitchMode,type CurveType} from './transitions';
import {journeyTimelineLayout} from './journeyTimelineLayout';
import {MARKER_COLOURS,MARKER_LIMIT,MARKER_NAME_MAX,sceneBoundaries,sceneAtJourneyTime,markerNamed,markerAdd,markerRename,markerMove,markerRemove,nextMarkerTime,prevMarkerTime,setLoopEdge,dragLoopEdge,moveLoopRegion,playDurations,toPlayClock,loopPlayNotice,type LoopEdge,type LoopRegion} from './journeyMarkers';
import {snapCandidates,snapTime,closestSnap,nextSnapPoint,prevSnapPoint,type SnapPoint} from './snapModel';
import {parseDeepLink,formatDeepLink,resolveSceneRef,resolveMarker,clampJourneyTime,markerAtTime,type DeepLinkAddress,shortenRef} from './deepLinks';
import {createWikiStandingClient,disclosedOwnerOf,type WikiStandingBasis,type WikiStandingState} from './libraryStanding';
import {NOT_FOCUSED,beginFocus,endFocus,focusedLayout,releaseStageFullscreen,requestStageFullscreenOn,type FocusLayout,type FocusSession,type FullscreenHold} from './focusMode';
import {shuttle,pauseTransport,beginScrub,endScrub,stepFrame,transportRate,transportPlaying,transportReadout,STOPPED_TRANSPORT,type WorkingTransport} from './transport';
import {durationFromEdgeDrag,sceneAtTime,secondsFromDrag,slipOffsetFromDrag,insertBeforeFor,dragPreviewStep,overlapFromDrag,SCENE_DURATION_MIN,SCENE_DURATION_MAX,type TimelineLayout} from './journeyTimelineLayout';
import {seamStates,seamCaption,seamBlendHTML,blendLimit,blendLimitMessage,planEdgeEdit,applyEdgeWrite,type EdgeEdit} from './journeyPath';
import {entityTargets} from './nativeParameters';
import {recordRecent,recentJourneys} from './recentWork';
import {installPanelResize} from './panelResize';
import {initialiseSceneSaves,sceneSaveState,saveScene,nextSceneFrom,moveScene,retimeScene,removeScene,splitScene,applyTimelineMove,restoreScene,savedSceneIndices,sceneParameterChanges,insertScene,overwriteScene,stillScene,rollSceneSeam,seamRollRange,slipScene} from './sceneWorkflow';
import {advanceSceneTransport,nativeSceneTransportMaterial,switchHoldsForEnd,switchLanding} from './sceneTransport';
import {liveWorkspaceHTML} from './liveWorkspace';
import {defaultWorkspace,validateWorkspace,WORKSPACE_KEY,moveBeltEntry,syncHeldState} from './workspacePreferences';
import {physisHost,installPhysis,saveDesktopCapture,type DesktopScene} from './physis';
import {applyPalette,applyBackground,invertPalette,applyChain,applyGlyph,applyKundaliniSequence,NATIVE_LAYOUTS} from './nativeFeatures';
import {COLOR_PALETTES,hexToRgb,isLightHex} from '../../src/engine/colorPalettes';
import {CHAKRA_PROFILE_ID} from '../../src/engine/semantics/chakraProfile';
import type {SemanticBinding,SemanticColorCoupling,SemanticFieldConfig} from '../../src/engine/semantics/semanticTypes';
import {Journey,Scene,Entity,EntityLayer,TextLayer,Tool,Shape,Vec3,clone,uid,clamp,fieldStudies,oiMark,rethemeMark,sevenCentres,smallLanguage,blankJourney,blankScene,entity,pin,chakraEntities,validateJourney,AutomationLane,SCENE_TRANSITION_MIN,SCENE_TRANSITION_MAX,type MarkThemeReading} from './model.js';
import {DocumentStore,readLibrary,readLibraryWithOrigins,saveToLibrary,removeFromLibrary,recordLibraryAdoption,adoptedLocalOrigin,libraryOpenPlan,type LibraryOrigin} from './store.js';
import {decorateLibraryCard,libraryCardStanding,kernelCopyRefusalMessage,localCopyIdFor} from './libraryCards.js';
import {bindingEditLabel,connectActLabel,historyTitle,historyToast,historyWaitReason,KERNEL_UPDATE_LABEL,OUTSIDE_UPDATE_REASON,researchMaterialLabel} from './undoLabels.js';
import {defaultCamera,cameraForSceneView,project,unproject,facePlane,stageScale,stageCentre,basis,Camera} from './camera.js';
import {FieldEngineAdapter,EngineFrame} from './engine.js';
import {readPath} from '../../src/engine/automation';
import {paintPaper} from './paper';
import {ProductionAdapter} from './production.js';
import {importDocuments,nativeExport,nativeChakras,checkNativeLimits} from './nativeBridge.js';
import {baseValue,NATIVE_BINDINGS,nativeBinding,automationTarget,automationTargets,bindValue,pruneAutomation,WORLD_SCALE} from './nativeParameters.js';
import {inspectorHTML,InspectorContext} from './inspector.js';
import {sourceVisual,describeAnalysis} from './sourcePreview.js';
import {isStudioSection,studioPlacement,type StudioSection} from './studioSections.js';
import {LiveOverrides} from './liveOverrides.js';
import {STAGE_COMMANDS,readStageRequest,stageReplyMessage,stageRefusal,type StageCommand,type StageCaptureSettings} from './stageCommands.js';
import {DEFAULT_SOURCE_THRESHOLD} from '../../src/engine/sourceSampling';
import {PARAMETERS,parameter} from './registry.js';
import {evaluateParameters,phases,sequenceAt,focusAt,arrange,reorderFocus} from './timeline.js';
import {icon,esc} from './icons.js';
import {defaultCapture,CaptureSettings,CaptureTransition,download,slug,createOutput,paintCapture,paintNativeCapture,png,LiveRecorder,textLayout} from './capture.js';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
import {mountShell,iconButton as ib} from './shell.js';
import {RailItem,railPressed} from './rail.js';
import {featuredExpressions,startingPoints,nativeSeven,forkExpression,libraryHTML,modesHTML,compositionCover,collectionBinsOf,collectionsWith,parseCollectionFilter,type CollectionBins,type CollectionFilter,type LibraryStanding} from './expressions.js';
import {installKernelExpressions,kernelExpressionsAvailable,readTechneReading,techneConstellationRelate,listKernelExpressions,readKernelExpression,nativeExpressionRequest,invertEdit} from './kernelExpressions.js';
import {hostedRecovery} from './nativeRecovery.js';
import {entryGateHTML} from './entryGate.js';
import {AUTHORED_CHAKRA_STARTER,STANDING_LABEL} from './centreStanding.js';
import {installNativeWorkspace,type NativeActRecord,type NativeAdoption,type NativeSubject} from './nativeWorkspace.js';
import {createRetainedNativeEditor,installNativeEditorReceiver,NativeSceneEditRefusal} from './hostEditor.js';
import {createSourceEditorSelection} from './sourceEditorSelection.js';
import {readLayerDisclosure,restoreLayerDisclosure} from './layerDisclosure.js';
import {formationFromSpec,formationStateNudge} from './formationPlacement.js';
import {createNativeSceneEditHandler} from '../../../../../packages/expressions-boundary/src/sceneEdits';
import {prepareNativeSceneMaterialEdit, sceneMaterialReadRequirement} from '../../../../../packages/expressions-boundary/src/sceneMaterialEdits';
import {nativeAdoptionHistory} from './nativeAdoption.js';
import {sameEditorBasis} from '../../../../../packages/expressions-boundary/src/editor';
import {createNativeMaterialController} from '../../../../../packages/expressions-boundary/src/nativeMaterials';
import {requestNativeMaterialEditor} from '../../../../../packages/expressions-boundary/src/materialEditor';
import {worldRequest} from './worldChannel';
import {installLensStudio,type LensId} from './lensStudio.js';
import {installResearchInstruments} from './researchInstruments.js';
import {installPalaceInstrument} from './palaceInstrument.js';
import {palaceInstrumentOpenRequest} from './palaceWhole.js';
import {installJourneyInstrument} from './journeyInstrument.js';
import {writeJourneyCrossing,writeJourneyReturn} from './sharedTimeWindow.js';
import {composeSceneRequest} from './journeyBeats.js';
import {readJourneyInstrument} from './journeyInstrumentModel.js';
import {installNaraInstrument} from './naraInstrument.js';
import {naraFormGeometry} from './naraFormField.js';
import type {NativeM3Reading} from '../../../src/nara/nativeM3';
import {createEvidenceField,type PrivateEvidenceField} from './naraEvidenceField.js';
import type {PalaceDocumentSnapshot} from '../../../src/techne/m0m5/palace/composition';
import {applyResearchMaterial,applyConnectorRecord,pruneResearchOccurrence,runCanvasImport,type CanvasImportHost,type ResearchMaterialAction} from './researchMaterial.js';
import type {ConnectionBinding} from '../../../../../packages/oi-design-system/expressions-engine/oi/expressionBindings.mjs';
import type {KernelConversion,KernelSceneBody} from './kernelDocumentBridge.js';
import {installSceneBodies} from './sceneBodies.js';
import {prepareNativeSceneBody} from './nativeSceneBody.js';
import {nestedBodyFor,placeNestedChange,setNestingDepthChange,removeNestedChange,nextNestedDepth,nestedEvaluation,nestedWindowVerdict,nestedControlsHTML,nestedSceneClass,nestedFrameAt,nestedNotice,isNestedBody,nestedSeamAt,nestedSeamMode,nestedBoundaryKey,latestNestedSeam,type NestedSeam,openNestedPicker,NESTED_DEFAULT_DEPTH,type NestedBinding} from './nestedOccurrence.js';
import {kernelDocumentToJourney,occurrencesOfSubject,withNestedVerdicts} from './kernelDocumentBridge.js';
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
 transitionKind='crossfade';transitionSnapshot=null;transitionStart=simTime;transitionDuration=seconds;transitionSceneId=scene().id;
 transitionCurveNow=null; // T5: an act passage eases by its own chain easing; a seam's curve applies only to seams.
 transitionEasing=(['smoothstep','linear','kineticSnap','whip'] as const).includes(easing as ChainEasing)?easing as ChainEasing:'smoothstep';
 needsFrame=true;
}
import {mountSoundControls} from './soundControls.js';
// E05 trim state, declared before any top-level code can render the timeline.
let sceneTrim:null|{sceneId:string;startX:number;trackPx:number;base:TimelineLayout;from:number;duration:number;clamped:'min'|'max'|null;moved:boolean;frame:number}=null;
let trimClickGuardUntil=0;
// Lane-5 T6: the seam blend drag in flight. Declared with the trim and roll state, before any startup render can read it.
let seamBlend:{sceneId:string;startX:number;trackPx:number;layout:TimelineLayout;from:number;limit:number;seconds:number;clamped:'min'|'max'|null;moved:boolean;frame:number}|null=null;
// E06 roll state: a Shift-drag on a clip's edge moves the seam with the next scene. Declared here, with the trim state, for the same reason.
let sceneRoll:null|{leftId:string;rightId:string;startX:number;trackPx:number;total:number;left:number;right:number;seconds:number;clamped:'min'|'max'|null;moved:boolean;frame:number}=null;
/** The Scene ref being dragged; a move addresses the scene by ref, never by the index the clip stood at. */
let sceneDragId='';
// E04/E06 body gesture state: one drag on a clip body; Alt+Shift overwrites, Alt slips, plain inserts or slides.
let sceneBody:null|{sceneId:string;clip:HTMLElement;startX:number;trackPx:number;total:number;duration:number;from:number;mode:'insert'|'overwrite'|'slip';targetId:string;rightHalf:boolean;offset:number;moved:boolean}=null;
// E09/E10 channel lane: the selected channel and keyframe, the live drag, and the working channel views (solo, mute,
// show). Declared with the other gesture state, before any top-level code can render the timeline. None of it is saved.
let curveSel:null|{sceneId:string;trackId:string;index:number|null}=null;
/** Lane-5 T5: a bezier handle of a seam's curve, held by the drag on the chooser's lane (see beginSeamCurveDrag). */
let seamCurveDrag:null|{sceneId:string;base:TransitionCurve;index:0|1;end:HandleEnd;frame:LaneFrame;left:number;top:number;preview:TransitionCurve|null;message:string;moved:boolean;refused:boolean;raf:number}=null;
let curveDrag:null|{sceneId:string;trackId:string;kind:'key'|'handle';index:number;end:HandleEnd;left:number;top:number;frame:LaneFrame;base:Points;range:ChannelRange|undefined;label:string;preview:Points|null;message:string;moved:boolean;raf:number;dragSeq:number}=null;
/** E09c: the drag revision a curve preview carries to the engine. Serial across drags, so no two previews share one. */
let curveDragSerial=0;
/** E09c: above every track revision (a take is at most 3600 s at 60 steps a second), so drag and track revisions never meet. */
const CURVE_DRAG_REVISION_BASE=1e6;
// E11: the seam transition in flight, and the seam whose chooser is open. 'crossfade' is the overlay the app always had; a
// painted kind (dip to colour, wipe) keeps a snapshot of the outgoing frame and paints its blend each frame.
let transitionKind:TransitionKind='crossfade';let transitionSpecNow:TransitionSpec|undefined;let transitionSnapshot:HTMLCanvasElement|null=null;let seamSceneId:string|null=null;
/** T5: the curve of the seam in flight (null for an act passage, which eases by its chain easing), and a jump held to the
 * outgoing Scene's natural end by an at-end switch. */
let transitionCurveNow:TransitionCurve|null=null;let pendingAtEnd:string|null=null;
// E14: the nested frame and seam last driven, so an overlay starts once per nested boundary crossing.
let nestedFrameKey:string|null=null,nestedSeamKey:string|null=null;
const channelViews=new Map<string,ChannelView>();
mountShell();installPanelResize();installKernelExpressions();
const recovery=document.createElement('section');recovery.id='engine-recovery';recovery.hidden=true;recovery.className='engine-recovery';recovery.setAttribute('role','alert');recovery.innerHTML='<h3>GPU context interrupted</h3><p>The expression is intact. Recovering recreates lost particle state, not a runtime checkpoint.</p><button class="secondary" data-action="native-recover">Recover field</button>';document.body.append(recovery);

let recentIds:string[]=[];try{const raw=JSON.parse(localStorage.getItem('oi.recent-work.v1')??'[]');if(Array.isArray(raw))recentIds=raw.filter((v):v is string=>typeof v==='string');}catch{}
function rememberWork(id:string){recentIds=recordRecent(recentIds,id);try{localStorage.setItem('oi.recent-work.v1',JSON.stringify(recentIds));}catch{}}
let workspace=defaultWorkspace(),workspaceStorageError=false;
let nativeEditorEndpoint:ReturnType<typeof installNativeEditorReceiver>|undefined;
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
// §9: Technē opens on the approved Epii entry face with no preselected Wiki
// subject; the host may then open a default Wiki over it (TechneCentre
// treats this face as replaceable). A blank placeholder is not the home.
let initial:Journey=startsInTechne?(startingPoints().find(p=>p.expression.id==='source-twelve-faces')?.expression??{...blankJourney(),name:'Wiki'}):oiMark(),startupError='';
// T22: a kernel-bound library entry is opened from the kernel once the native channel is up (the boot below). Until then, and when the kernel
// cannot be reached, the browser copy stands as explicitly local scratch beneath it.
let bootKernelRef:string|null=null;
/** The status line of a kernel document this page opened from its browser copy with no kernel channel (standalone). */
const KERNEL_SCRATCH_LINE="Kernel document — opened from this browser's copy; the kernel is not reachable here";
/** The document id whose browser copy stands in for a kernel document this page could not reach; null otherwise. */
let kernelScratchId:string|null=null;
try{if(window.__JOURNEY__)initial=validateJourney(window.__JOURNEY__);else if(!startsWithNativeReference){try{const last=localStorage.getItem('oi.field-studies.last');const {read,origins}=readLibraryWithOrigins();const saved=read.journeys.find(j=>j.id===last);if(saved){initial=saved;const origin=last?origins.get(last):undefined;if(origin?.kind==='kernel-ref')bootKernelRef=origin.ref;}}catch{/* An opaque or private origin must still open cleanly. */}}}catch(err){startupError=err instanceof Error?err.message:String(err);}
function initialiseBelts(j:Journey){initialiseShared(j);initialiseSources(j);for(const s of [...j.scenes,...Object.values(j.savedScenes??{})])if(!s.toolbelt)s.toolbelt=clone(workspace.entries).map(e=>e.scope==='named'&&!s.entities.some(v=>v.id===e.entityId)?{id:e.id,key:e.key,scope:'selected' as const}:e);return j;}
const store=new DocumentStore(initialiseSceneSaves(initialiseBelts(initial)));let engine:FieldEngineAdapter;
try{engine=window.OI_ENGINE_FACTORY?window.OI_ENGINE_FACTORY($<HTMLCanvasElement>('field-canvas')):new ProductionAdapter($<HTMLCanvasElement>('field-canvas'));(window as any).OI_DEBUG_ENGINE=engine;}catch(err){$('stage').innerHTML='<p style="padding:110px 40px">The native WebGL field could not start. '+esc(err instanceof Error?err.message:err)+'</p>';throw err;}
let timelineTrack=true;let sceneIndex=0;let selected:string[]=[];let textId:string|null=null;let tab:InspectorContext['tab']='field';let motionTab:InspectorContext['motionTab']='sequence';let stepIndex=0;let search='';let editing=false,inspectorOpen=false,timelineOpen=false,presenting=false,shapePickerOpen=false,tool:Tool='interact';let shapeChoice:Shape='text',glyphChoice='O';let camera=defaultCamera();let placementStep=false,keepPlacing=false,pinRepeat=false;
let propertyTake:null|{sceneId:string;armed:number;start:number;elapsed:number;tracks:PropertyTrack[];lastSample:number;limit?:number}=null;let appendTake=false,trackPreview=false;const takeWindows=new Map<string,{start:number;end:number}>();
let width=innerWidth,height=innerHeight;let simTime=0,sceneElapsed=0;let fieldPaused=matchMedia('(prefers-reduced-motion: reduce)').matches,scenePlaying=false,journeyPlaying=false;let lastTime=performance.now(),lastUI=0;let toastTimeout=0,lastLibraryWrite=0;let transitionStart=0,transitionDuration=0;let transitionBackground='#f4f2eb',transitionSceneId='';let transitionEasing:ChainEasing='linear';let autosaveErrorShown=false;let captureSettings=defaultCapture();let recordPerformanceWarned=false;let currentVideo:{blob:Blob;mime:string;url:string;source:DesktopScene;settings:CaptureSettings}|null=null;let recordingSource:DesktopScene|null=null;let recordingSettings:CaptureSettings|null=null;const recorder=new LiveRecorder();
let pointer={active:false,world:{x:0,y:0,z:0}};let drag:null|{kind:'entity'|'radius'|'camera'|'text';id:string;startX:number;startY:number;startWorld:Vec3;positions:Map<string,Vec3>;initialRadius:number;cam:Camera;layer:TextLayer|null;pan:boolean}=null;
let guidesVisible=true;let sourceUploadEntityId:{sceneId:string;entityId:string;stepId?:string;layerId?:string;append?:boolean}|null=null;let overlayDirty=true,needsFrame=true;
// lane-3 E24/E25: the working-view transport (transport.ts), the J/K-held state, the timeline's snap toggle and the snap indicator's screen x.
let workingTransport:WorkingTransport=STOPPED_TRANSPORT,transportKeyHeld=false,timelineSnap=true,snapGuideX:number|null=null;const detailState=new Map<string,boolean>();
// The studio remembers where you were: content scroll survives close/reopen, and
// the automation transport keeps its own run state, independent of the physics clock.
interface LocatorDrag {kind:'marker'|'loop';id:string;name:string;edge:LoopEdge|'body';base:number;region:LoopRegion|null;startX:number;secondsPerPx:number;boundaries:number[];total:number;moved:boolean}
let studioScroll=0,automationLoop=false;let selectedMarkerId:string|null=null;let locatorDrag:LocatorDrag|null=null,previewMarker:{id:string;time:number}|null=null,previewRegion:LoopRegion|null=null,renamingMarkerId:string|null=null,rulerMenuX:number|null=null,locatorFrame=0;let automationPhase:'idle'|'waiting'|'running'='idle';let automationWaitDeadline=0;
// Physis hosted mode: the service's quality state throttles this studio too,
// so the level you pick is the level you feel while authoring.
let physisFpsCap=0,physisPixelRatio:null|number=null,physisParticleCap=0,physisRatioApplied=0,lastStudioRender=0;
let libraryOpen=false,librarySection:'collection'|'about'='collection',modesOpen=false,captureOpen=false,sourceEditorEpoch=0;
let railKey:RailItem='interact',railExpanded=false;let cursorTool:'interact'|'select'='interact';
// lane-3 E22/E23: the address the page opened at (held until it settles, so no write
// overtakes the link), whether a standalone link named an Expression, the focus snapshot, and the fullscreen grant.
// The link is read here, before any render can write the address, and it is held until the Expression settles.
const bootLink=parseDeepLink(location.search);
let deepLinkPending:{address:DeepLinkAddress;notes:string[]}|null={address:bootLink.address,notes:[...bootLink.refused]},addressKeepsExpression=false;
// review-5 #6: declared with the link state above, because syncDeepLinkAddress can run while the module is still evaluating.
// Scrubbing calls the address sync on every pointer move. One write per interval reads the state as it stands when it lands, so the
// address is never written faster than WKWebView's replaceState throttle allows, and the last position is always written.
const DEEP_LINK_WRITE_MS=400;
let deepLinkWriteTimer=0;
// E22 (ticket P, G3): the address last announced to the host, so a changed address is announced once.
let announcedAddress='';
let focusSession:FocusSession=NOT_FOCUSED,focusHold:FullscreenHold|null=null,focusExitedAt=Number.NEGATIVE_INFINITY;
const featured=featuredExpressions(),starters=startingPoints();
const covers=new Map<string,string>();
const sessionExpressions=new Map<string,Journey>();
// Camera controls stay off the HUD: the field is zoomed by scroll/pinch and
// each instrument carries its own view tools. The orbit widget is not mounted.
let sceneEditHeld:Scene|null=null;
const scene=()=>sceneEditHeld??store.document.scenes[sceneIndex]??store.document.scenes[0];
const activeScene=()=>effectiveScene(store.document,journeyPlaying?store.document.savedScenes?.[scene().id]??scene():scene());
const selectedEntity=()=>scene().entities.find(e=>e.id===selected[0]);
const currentText=()=>scene().text.find(t=>t.id===textId)??scene().text[0];
function toast(message:string,duration=4200){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=window.setTimeout(()=>$('toast').hidden=true,duration);}
/** Fires the scene's chosen pointer click effect at a world position. */
function firePointerClick(p:Vec3){const s=effectiveScene(store.document,scene()),kind=s.engine.pointerClick??'pulse';if(kind==='off')return;try{engine.command?.({type:'pointer-effect',kind,strength:engine.telemetry?.()?.params?.pointerClickStrength??s.engine.pointerClickStrength??2.2,radius:(engine.telemetry?.()?.params?.pointerClickRadius??s.engine.pointerClickRadius??.45)*WORLD_SCALE,x:p.x*WORLD_SCALE,y:p.y*WORLD_SCALE,z:p.z*WORLD_SCALE});needsFrame=true;}catch(err){error(err);}}
function error(err:unknown){console.error(err);toast(err instanceof Error?err.message:String(err),6500);}
const deletedLibraryIds=new Set<string>();
function saveSession(){try{const session:SessionState={version:1,journeyId:store.document.id,sceneId:scene().id,selected,stepIndex,sceneElapsed,simTime,playing:scenePlaying,scenePlaying,journeyPlaying,fieldPaused,camera:{...camera},transport:engine.transportState?.(),workingTransport};localStorage.setItem(SESSION_KEY,JSON.stringify(session));localStorage.setItem('oi.field-studies.last',store.document.id);}catch{}}
let draftBackupBusy=false;
// lane-3 E19 (T-REVIEW-6): true from the boot's recovery dialog until its choice is kept. The draft is held: no backup and no clean mark.
let recoveryOfferOpen=false;
// The Library's quarantine section (T-REVIEW-6): read when the Library opens and after each restore.
let quarantineState:{rows:{id:string;key:string;name:string;reason:string;when:string;raw:string}[];unreadable:string[];message?:string}={rows:[],unreadable:[]};
/** lane-3 E17: the one schedule for draft backups. Edits coalesce on a 350 ms timer; context switches and quit flush at once; nothing flushes inside an open gesture or a held recovery choice. */
const draftSchedule=new DraftSchedule({flush:()=>flushDraft(),gestureOpen:()=>store.transactionOpen,held:()=>recoveryOfferOpen});
/** E19: every draft write goes through the hosted frame's basis rule (nativeWorkspace.persistDraft); the browser writes as before. */
const persistDraft=(journey:Journey)=>nativeWorkspace?nativeWorkspace.persistDraft(journey):writeDraft(journey);
async function flushDraft(){
 if(awaitingNativeBoot){if(store.revision===0)return;awaitingNativeBoot=false;nativeWorkspace?.cancelOpen();} // Retain an actual edit; an untouched opening canvas is not recovery material.
 // Coalesce changes while a gesture or native disk write is in flight. A
 // slow owner must not accumulate full-document backups in a renderer queue.
 if(store.transactionOpen||draftBackupBusy){draftSchedule.request();return;}
 saveSession();if(deletedLibraryIds.has(store.document.id))return;
 const draft=clone(store.document),backupVersion=store.revision;
 // E19: the take's samples are new content, so mergeTakeIntoDraft advances the draft's time with them.
 if(propertyTake&&propertyTake.elapsed>0)mergeTakeIntoDraft(draft,propertyTake,new Date());
 draftBackupBusy=true;
 try{
  await persistDraft(draft);
  if(deletedLibraryIds.has(draft.id)){await removeDraft(draft.id);return;}
  sessionExpressions.set(draft.id,draft);if(store.document.id!==draft.id)return;
  autosaveErrorShown=false;
  $('save-status').textContent=kernelScratchShows()?KERNEL_SCRATCH_LINE:store.revision!==backupVersion?draftStatusLine('waiting',new Date(),hostedRecovery()?'native':'browser'):draftStatusLine('backed-up',new Date(),hostedRecovery()?'native':'browser');
  const now=Date.now();
  if(now-lastLibraryWrite>5000){lastLibraryWrite=now;try{saveToLibrary(draft,kernelOriginFor(draft));}catch{/* The acknowledged copy remains with its recovery owner. */}}
 }catch(cause){
  if(hostedRecovery()){
   $('save-status').textContent=draftStatusLine('refused',new Date(),'native');
   if(!autosaveErrorShown){toast(cause instanceof Error?cause.message:'Native recovery is unavailable. Keep this work open or save a file.',7000);autosaveErrorShown=true;}
   return false; // T-REVIEW-6: a backup that did not land keeps its edits pending for the next context switch.
  }
  try{saveToLibrary(draft,kernelOriginFor(draft));$('save-status').textContent=draftStatusLine('library-copy',new Date(),'browser');}
  catch{$('save-status').textContent=draftStatusLine('unavailable',new Date(),'browser');if(!autosaveErrorShown){toast('Browser storage is unavailable or full. Export the expression to preserve your work.',7000);autosaveErrorShown=true;}}
  return false; // The draft record did not land (a Library copy may have): the edits stay pending and are retried.
 }finally{draftBackupBusy=false;}
}

let sessionSaveTimeout=0;
function markSaved(){clearTimeout(sessionSaveTimeout);sessionSaveTimeout=window.setTimeout(saveSession,150);if(deletedLibraryIds.has(store.document.id)){$('save-status').textContent='Saved copy removed · use Save to keep again';return;}$('save-status').textContent=kernelScratchShows()?KERNEL_SCRATCH_LINE:hostedRecovery()?'Backing up working copy…':'Saving in this browser…';draftSchedule.request();}
// Every edit names itself: the label is what Undo, Redo and their toast report.
function changed(fn:()=>void,render:boolean,label:string){trackPreview=false;if(journeyPlaying){journeyPlaying=false;applySceneView();}store.change(label,fn);awaitingNativeBoot=false;nativeWorkspace?.cancelOpen();markSaved();overlayDirty=true;needsFrame=true;if(render)renderAll();}
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
 mountSoundControls(content,{entity:()=>scene().entities.find(e=>e.id===selected[0]),change:fn=>changed(fn,true,'Set sound')});
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
// lane-3 E12/E13: journey locators (markers) and the loop brace. The rules live in journeyMarkers.ts; this block is the ruler, its gestures and its keys.
const pctOf=(t:number,total:number)=>total>0?clamp(t/total*100,0,100):0;
const secs=(t:number)=>`${t.toFixed(1)} s`;
const journeyDurations=(doc:Journey)=>doc.scenes.map(s=>s.duration);
/** E13b: the clock the running playback reads: saved durations during saved-sequence play, else the working clock (the ruler's). */
const playClockDurations=(saved:boolean)=>playDurations(store.document.scenes,store.document.savedScenes,saved);
const playheadPlayTime=(saved:boolean)=>expressionTiming(store.document,sceneIndex,sceneElapsed,saved).time;
/** Presentation-only edits: the store labels the step; playback keeps running. */
function changedPresentation(label:string,fn:(doc:Journey)=>void){
 store.change(label,fn);awaitingNativeBoot=false;nativeWorkspace?.cancelOpen();markSaved();overlayDirty=true;needsFrame=true;renderTimeline();
}
function addMarkerAtPlayhead(){
 const doc=store.document,timing=expressionTiming(doc,sceneIndex,sceneElapsed),markers=doc.markers??[];
 if(markers.length>=MARKER_LIMIT){toast(`A journey holds at most ${MARKER_LIMIT} markers.`);return;}
 const id=uid('marker'),name=`Marker ${markers.length+1}`,colour=MARKER_COLOURS[markers.length%MARKER_COLOURS.length],time=clamp(timing.time,0,timing.total);
 try{changedPresentation(`Add marker ${name}`,d=>{d.markers=markerAdd(d.markers??[],{id,name,time,colour});});selectedMarkerId=id;}catch(err){error(err);}
}
function renameMarker(id:string,value:string){
 renamingMarkerId=null;
 const current=markerNamed(store.document.markers??[],id),name=value.trim();
 if(!current||name===current.name){renderTimeline();return;}
 if(!name){toast('A marker needs a name.');renderTimeline();return;}
 try{changedPresentation(`Rename marker ${name}`,d=>{d.markers=markerRename(d.markers??[],id,name);});}catch(err){error(err);renderTimeline();}
}
function deleteSelectedMarker(){
 const id=selectedMarkerId;selectedMarkerId=null;if(!id)return;
 const current=markerNamed(store.document.markers??[],id);if(!current){renderTimeline();return;}
 try{changedPresentation(`Delete marker ${current.name}`,d=>{d.markers=markerRemove(d.markers??[],id);});}catch(err){error(err);}
}
/** A working-clock journey time (where markers and the loop are stored, and the ruler draws) to its place on the clock playback runs. */
function jumpToJourneyTime(t:number){
 const doc=store.document,total=expressionTiming(doc,0,0).total;
 jumpToPlayTime(toPlayClock(journeyDurations(doc),playClockDurations(journeyPlaying),clamp(t,0,total)));
}
/** E13b: a time on the clock playback runs, to its scene and local seek. Paused, it seeks as the playhead does; playing, the
 * playback keeps running and changes Scene through the native owner, as saved playback does. */
function jumpToPlayTime(t:number){
 const playing=journeyPlaying,play=playClockDurations(playing);
 const {sceneIndex:index,local}=sceneAtJourneyTime(play,clamp(t,0,play.reduce((n,d)=>n+d,0)));
 if(playing){
  if(index!==sceneIndex)void advanceSavedScene(index,local);else sceneElapsed=local;
  needsFrame=true;renderTimeline();return;
 }
 if(index!==sceneIndex)setSceneRef(store.document.scenes[index].id,false);
 seekWorkingScene(local);
}
function jumpMarker(direction:1|-1){
 const doc=store.document,playing=journeyPlaying,play=playClockDurations(playing);
 // Markers are stored on the working clock; the next or previous one is found on the clock playback runs.
 const markers=(doc.markers??[]).map(m=>({...m,time:toPlayClock(journeyDurations(doc),play,m.time)})),t=playheadPlayTime(playing);
 const target=direction>0?nextMarkerTime(markers,t):prevMarkerTime(markers,t);
 if(target===null){toast(direction>0?'No marker after the playhead.':'No marker before the playhead.');return;}
 selectedMarkerId=markers.find(m=>Math.abs(m.time-target)<.005)?.id??null;
 jumpToPlayTime(target);renderTimeline();
}
function setLoopAtPlayhead(edge:LoopEdge){
 const doc=store.document,timing=expressionTiming(doc,sceneIndex,sceneElapsed),result=setLoopEdge(doc.loopRegion,edge,timing.time,timing.total);
 if('refusal' in result){toast(result.refusal);renderTimeline();return;}
 const region=result.region;
 changedPresentation(edge==='from'?'Set loop in':'Set loop out',d=>{d.loopRegion=region;});
}
function clearLoopRegion(){if(store.document.loopRegion)changedPresentation('Clear loop region',d=>{delete d.loopRegion;});else renderTimeline();}
function locatorsHTML(doc:Journey,total:number){
 const pct=(t:number)=>pctOf(t,total),region=previewRegion??doc.loopRegion;
 const brace=region?`<div class="journey-loop-brace" data-loop-body role="group" aria-label="Loop region, ${secs(region.from)} to ${secs(region.to)}" style="left:${pct(region.from)}%;width:${Math.max(0,pct(region.to)-pct(region.from))}%"><span class="journey-loop-edge" data-loop-edge="from" title="Loop in"></span><span class="journey-loop-edge" data-loop-edge="to" title="Loop out"></span></div>`:'';
 const flags=(doc.markers??[]).map(m=>{const time=previewMarker&&previewMarker.id===m.id?previewMarker.time:m.time,on=selectedMarkerId===m.id;
  const name=renamingMarkerId===m.id?`<input data-marker-rename="${esc(m.id)}" value="${esc(m.name)}" maxlength="${MARKER_NAME_MAX}" aria-label="Marker name">`:esc(m.name);
  return `<div class="journey-marker ${m.colour}${on?' selected':''}" data-marker-id="${esc(m.id)}" style="left:${pct(time)}%" role="button" tabindex="0" aria-pressed="${on}" aria-label="Marker ${esc(m.name)} at ${secs(time)}" title="${esc(m.name)} · ${secs(time)}"><span class="journey-marker-flag"></span><span class="journey-marker-name">${name}</span></div>`;}).join('');
 const menu=rulerMenuX===null?'':`<div class="journey-ruler-menu" role="menu" style="left:${rulerMenuX}px"><button role="menuitem" data-ruler-action="marker">Add marker at playhead</button><button role="menuitem" data-ruler-action="in">Set loop in at playhead</button><button role="menuitem" data-ruler-action="out">Set loop out at playhead</button><button role="menuitem" data-ruler-action="clear" ${region?'':'disabled'}>Clear loop region</button></div>`;
 return `<div class="journey-locators" data-ruler aria-label="Journey locators">${brace}${flags}${menu}</div>`;
}
function loopWashHTML(doc:Journey,total:number){
 const region=previewRegion??doc.loopRegion;if(!region)return '';
 return `<div class="journey-loop-wash" aria-hidden="true" style="left:${pctOf(region.from,total)}%;width:${Math.max(0,pctOf(region.to,total)-pctOf(region.from,total))}%"></div>`;
}
function beginLocatorDrag(ev:PointerEvent,kind:'marker'|'loop',el:HTMLElement){
 const doc=store.document,total=expressionTiming(doc,0,0).total,width=el.closest<HTMLElement>('.journey-locators')?.getBoundingClientRect().width??0;
 if(!(width>0)||!(total>0))return;
 const base={startX:ev.clientX,secondsPerPx:total/width,boundaries:sceneBoundaries(journeyDurations(doc)),total,moved:false};
 if(kind==='marker'){const id=el.dataset.markerId??'',m=markerNamed(doc.markers??[],id);if(!m)return;locatorDrag={...base,kind,id,name:m.name,edge:'body',base:m.time,region:null};}
 else{const region=doc.loopRegion;if(!region)return;locatorDrag={...base,kind,id:'',name:'',edge:(el.dataset.loopEdge as LoopEdge|undefined)??'body',base:0,region};}
 ev.preventDefault();
}
function moveLocatorDrag(ev:PointerEvent){
 const d=locatorDrag;if(!d)return;
 const dx=ev.clientX-d.startX;if(!d.moved&&Math.abs(dx)<3)return;d.moved=true;
 const delta=dx*d.secondsPerPx;
 // lane-3 E25: markers and loop edges snap to the snap model's points. The drag's own point is excluded; Alt bypasses.
 const snapping=timelineSnap&&!ev.altKey,points=snapping?snapPoints(store.document):[];
 const pick=(raw:number,exclude:string[])=>{const hit=snapping?closestSnap(points,raw,d.secondsPerPx,{exclude}):null;setSnapGuide(hit?hit.time:null,d.total);return hit?hit.time:raw;};
 if(d.kind==='marker')previewMarker={id:d.id,time:clamp(pick(d.base+delta,[`marker:${d.id}`]),0,d.total)};
 else if(d.edge==='body'){
  // The body moves as a whole. Whichever of its two edges lands nearer a point sets the snap.
  const region=d.region!,exclude=['loop:from','loop:to'];
  const a=snapping?closestSnap(points,region.from+delta,d.secondsPerPx,{exclude}):null,b=snapping?closestSnap(points,region.to+delta,d.secondsPerPx,{exclude}):null;
  const useA=!!a&&(!b||Math.abs(a.time-(region.from+delta))<=Math.abs(b.time-(region.to+delta)));
  const hit=useA?a:b;setSnapGuide(hit?hit.time:null,d.total);
  previewRegion=moveLoopRegion(region,hit?(useA?a!.time-region.from:b!.time-region.to):delta,d.total);
 }
 else{const edge=d.edge as LoopEdge,raw=(edge==='from'?d.region!.from:d.region!.to)+delta;previewRegion=dragLoopEdge(d.region!,edge,pick(raw,[`loop:${edge}`]),d.total);}
 if(!locatorFrame)locatorFrame=requestAnimationFrame(()=>{locatorFrame=0;renderTimeline();});
}
/** Marks the selected locator in place. The DOM is not rebuilt, so the second click of a double-click still reaches its rename. */
function paintLocatorSelection(){document.querySelectorAll<HTMLElement>('[data-marker-id]').forEach(el=>{const on=el.dataset.markerId===selectedMarkerId;el.classList.toggle('selected',on);el.setAttribute('aria-pressed',String(on));});}
function endLocatorDrag(commit:boolean){
 const d=locatorDrag,pm=previewMarker,pr=previewRegion;
 locatorDrag=null;previewMarker=null;previewRegion=null;setSnapGuide(null,0);
 if(!d)return;
 if(!commit||!d.moved){
  if(d.kind==='marker'&&!d.moved&&commit){selectedMarkerId=d.id;paintLocatorSelection();const m=markerNamed(store.document.markers??[],d.id);if(m)jumpToJourneyTime(m.time);return;}
  renderTimeline();return;
 }
 try{
  if(d.kind==='marker'&&pm){const id=pm.id,time=pm.time,total=d.total;changedPresentation(`Move marker ${d.name}`,doc=>{doc.markers=markerMove(doc.markers??[],id,time,total);});}
  else if(d.kind==='loop'&&pr){const region=pr;changedPresentation(d.edge==='body'?'Move loop region':d.edge==='from'?'Set loop in':'Set loop out',doc=>{doc.loopRegion=region;});}
  else renderTimeline();
 }catch(err){error(err);renderTimeline();}
}
function renderTimeline(){if(!timelineOpen)return;const s=scene(),doc=timelineDocument(),timing=expressionTiming(doc,sceneIndex,sceneElapsed),scenes=doc.scenes,track=timelineTrack;
 // E01: clip extents come only from expressionTiming, via journeyTimelineLayout; widths are percent of the track so it stays fluid.
 // E05: during a trim drag `doc` is the previewed document, so the same clock lays out the preview.
 const layout=journeyTimelineLayout(scenes,(index,local)=>expressionTiming(doc,index,local),100);
 // T7: each seam's live state on the same clock as the clips.
 const seams=seamStates(scenes,(index,local)=>expressionTiming(doc,index,local),timing.time);
 const sceneButton=(v:(typeof scenes)[number],i:number,placement:string)=>`<button class="scene-image ${i===sceneIndex?'active':''}${track?' scene-clip':''}${nestedSceneClass(nestedBodyOf(v.id))}"${placement} data-action="choose-scene" data-index="${i}" data-scene-id="${esc(v.id)}" aria-label="Open scene ${i+1}: ${esc(v.name)}" title="${esc(v.name)} · ${sceneSaveState(store.document,v)}"><img src="${compositionCover(v)}" alt="${esc(v.name)}"><small>${i+1}</small>${track?trimEdgeHTML(v):''}<span class="scene-save-dot" data-status="${sceneSaveState(store.document,v)}"></span></button>`;
 const playhead=`id="expression-playhead" aria-label="Expression playhead" type="range" min="0" max="${timing.total}" step="0.05" value="${timing.time}"`;
 const body=track
  ?`<div class="scene-track" aria-label="Expression track"><div class="scene-track-ruler">${[0,.25,.5,.75,1].map(f=>`<span style="left:${f*100}%">${(f*layout.total).toFixed(f===1?1:0)}s</span>`).join('')}</div>${locatorsHTML(doc,timing.total)}<div class="scene-track-lane">${loopWashHTML(doc,timing.total)}${scenes.map((v,i)=>sceneButton(v,i,` style="left:${layout.clips[i].x}%;width:${layout.clips[i].w}%"`)).join('')}${scenes.slice(1).map((v,k)=>seamGlyphHTML(v,layout.clips[k+1].x)+seamBlendHTML(scenes[k],v,layout.clips[k+1].x,layout.total?Math.min(v.transition,v.duration)/layout.total*100:0,seams[k+1].fraction)).join('')}<input class="scene-track-playhead" type="range" ${playhead}></div></div>`
  :`<div class="scene-strip">${scenes.map((v,i)=>sceneButton(v,i,'')).join('')}<button class="scene-image scene-add" data-action="save-next" aria-label="Save and add next scene">${icon('plus')}</button>${nestedControlsHTML(nestedBodyOf(scene().id),nestedBindingOf(scene().id))}</div><label class="expression-scrub"><span>Expression time</span><input type="range" ${playhead}></label>`;
 const toggle=`<button data-action="timeline-track" aria-pressed="${track}" title="${track?'Show the scenes as a compact strip':'Show the scenes on the time track'}">${track?'Collapse to strip':'Show track'}</button>`;
 // E09/E10: the channel rows and the selected channel's curve lane, under the clips in track mode only.
 const curveHTML=track?channelPanelHTML({scene:doc.scenes.find(v=>v.id===s.id)??s,selected:curveSel?.sceneId===s.id?{trackId:curveSel.trackId,index:curveSel.index}:null,views:viewsFor(s.id)}):'';
 const seamScene=track&&seamSceneId?scenes.find(v=>v.id===seamSceneId):undefined;const seamHTML=seamScene?seamChooserHTML(seamScene,{min:SCENE_TRANSITION_MIN,max:SCENE_TRANSITION_MAX},seamCurveDrag?.sceneId===seamScene.id?seamCurveDrag.preview??undefined:undefined):'';
 $('timeline-panel').innerHTML=`${transportBarHTML()}${pendingSwitchCueHTML()}${body}${curveHTML}${seamHTML}<div class="scene-save-row"><label>Scene name<input id="scene-save-name" value="${esc(sceneNames.get(s.id)??s.name)}" maxlength="160"></label><label>Hold · seconds<input type="number" data-bind="duration" value="${sceneTrim?.moved&&sceneTrim.sceneId===s.id?sceneTrim.duration:s.duration}" min="${SCENE_DURATION_MIN}" max="${SCENE_DURATION_MAX}" step=".1"></label><label>Transition<input type="number" aria-label="Transition seconds" data-bind="transition" value="${s.transition}" min="0" max="30" step=".1"></label><button class="primary" data-action="save-scene">Save scene</button><button data-action="save-next">Save & next</button><button data-action="restore-scene" ${!store.document.savedScenes?.[s.id]?'disabled':''}>Restore</button><button data-action="split-scene" title="Cut this scene in two at the playhead · S">Split</button><button data-action="still-scene" title="Add a still scene after this one: a held frame for a timed void, with no motion">Still scene</button>${ib('move-scene-left','arrowLeft','Move scene earlier',`data-scene-id="${esc(s.id)}"`)}${ib('move-scene-right','arrowRight','Move scene later',`data-scene-id="${esc(s.id)}"`)}${ib('delete-scene','trash','Delete scene',`data-scene-id="${esc(s.id)}"`)}${toggle}${ib('close-timeline','chevronDown','Collapse scenes')}</div><p class="scene-caption">${sceneSaveState(store.document,s)} · ${s.propertyTracks?.length??0} recorded properties · Scrubbing evaluates settings; particle motion continues from its current state.</p>${track?'<p class="scene-gesture-hint">Edge: trim · Shift+edge: roll the seam · Drag a clip: slide or insert (Alt+Shift: overwrite) · Alt+drag a clip: slip</p>':''}`;}
// E05 · trim: a clip's right edge changes that scene's duration. The drag previews
// on the timeline only: timelineDocument() reads a shallow copy with the one new
// duration, so the layout still runs on the single Expression clock. Pointer-up
// makes ONE labelled store.change ("Trim scene <name>") through changed(), so Undo
// gets one entry. The save then rides the existing kernel path: the duration is part
// of the scene material that the save emits as scene_material_set.
function trimEdgeHTML(v:Scene){return `<span class="scene-trim-edge" data-scene-id="${esc(v.id)}" title="${esc(`${v.duration.toFixed(1)} s · drag to trim · double-click or Alt-click for exact seconds`)}" aria-hidden="true"></span>`;}
/** E09: a curve drag previews on the lane through this document, laid over the trim and roll previews on the same clock. */
function timelineDocument():Journey{const base=seamPreviewDocument(timelineTrimDocument()),c=curveDrag;if(!c?.preview)return base;const preview=c.preview;return {...base,scenes:base.scenes.map(v=>v.id===c.sceneId?{...v,propertyTracks:v.propertyTracks?.map(t=>t.id===c.trackId?{...t,points:preview}:t)}:v)};}
function timelineTrimDocument():Journey{const t=sceneTrim,r=sceneRoll;
 // E06: a roll previews on the same clock: the left lasts +seconds, the right −seconds.
 if(r?.moved)return {...store.document,scenes:store.document.scenes.map(v=>v.id===r.leftId?{...v,duration:v.duration+r.seconds}:v.id===r.rightId?{...v,duration:v.duration-r.seconds}:v)};
 if(!t?.moved)return store.document;return {...store.document,scenes:store.document.scenes.map(v=>v.id===t.sceneId?{...v,duration:t.duration}:v)};}
function trimLimitToast(limit:'min'|'max'){toast(limit==='min'?`Scene duration stops at ${SCENE_DURATION_MIN} second, the shortest a scene can hold.`:`Scene duration stops at ${SCENE_DURATION_MAX} seconds, one hour, the longest a scene can hold.`);}
/** Exact entry: select the scene, then focus its Hold · seconds input, the numeric the timeline already commits. */
function openExactDuration(sceneId:string){
 if(propertyTake){toast('Finish the property take before changing this scene\'s length.');return;}
 if(sceneId!==scene().id)setSceneRef(sceneId);
 setTimeout(()=>{const input=$('timeline-panel').querySelector<HTMLInputElement>('input[data-bind="duration"]');input?.focus();input?.select();},0);
}
function beginSceneTrim(ev:PointerEvent,handle:HTMLElement){
 const sceneId=handle.dataset.sceneId??'',lane=handle.closest<HTMLElement>('.scene-track-lane');
 if(!sceneId||!lane)return;
 if(sceneTrim)endSceneTrim(false);
 ev.preventDefault();
 if(ev.altKey){trimClickGuardUntil=performance.now()+400;openExactDuration(sceneId);return;}
 // E06: Shift on an edge rolls the seam with the next scene instead of trimming this one alone.
 if(ev.shiftKey){beginSceneRoll(ev,handle);return;}
 if(ev.detail>1)return;
 if(propertyTake){toast('Finish the property take before changing this scene\'s length.');return;}
 const trackPx=lane.getBoundingClientRect().width;
 const base=journeyTimelineLayout(store.document.scenes,(index,local)=>expressionTiming(store.document,index,local),100);
 const clip=base.clips.find(c=>c.sceneId===sceneId);
 if(!clip||!(trackPx>0))return;
 sceneTrim={sceneId,startX:ev.clientX,trackPx,base,from:clip.duration,duration:clip.duration,clamped:null,moved:false,frame:0};
 document.body.classList.add('trimming-scene');
 document.addEventListener('pointermove',moveSceneTrim);
 document.addEventListener('pointerup',upSceneTrim);
 document.addEventListener('pointercancel',cancelSceneTrim);
}
function moveSceneTrim(ev:PointerEvent){
 const t=sceneTrim;if(!t)return;
 let next:ReturnType<typeof durationFromEdgeDrag>;
 try{next=durationFromEdgeDrag(t.base,t.sceneId,ev.clientX-t.startX,t.trackPx);}catch(err){endSceneTrim(false);error(err);return;}
 // lane-3 E25: the trimmed end snaps to points this trim does not move: the scene starts up to this scene, markers, the loop and the playhead.
 // Later scene starts shift with the ripple, so they are not candidates. Alt bypasses.
 let snapped=next,hitTime:number|null=null;
 const index=store.document.scenes.findIndex(v=>v.id===t.sceneId),clip=t.base.clips.find(c=>c.sceneId===t.sceneId);
 if(index>=0&&clip&&timelineSnap&&!ev.altKey){
  const hit=closestSnap(snapPoints(store.document,{boundaries:sceneBoundaries(journeyDurations(store.document)).slice(0,index+1)}),clip.start+next.duration,t.base.total/t.trackPx,{exclude:[`scene:${index}`]});
  if(hit){const want=hit.time-clip.start;hitTime=hit.time;snapped={duration:clamp(want,SCENE_DURATION_MIN,SCENE_DURATION_MAX),clamped:want<SCENE_DURATION_MIN?'min':want>SCENE_DURATION_MAX?'max':null};}
 }
 setSnapGuide(hitTime,t.base.total+(snapped.duration-(clip?.duration??snapped.duration)));
 if(snapped.clamped&&snapped.clamped!==t.clamped)trimLimitToast(snapped.clamped);
 t.clamped=snapped.clamped;t.duration=snapped.duration;t.moved=snapped.duration!==t.from;
 if(!t.frame)t.frame=requestAnimationFrame(()=>{t.frame=0;renderTimeline();});
}
function endSceneTrim(commit:boolean){
 const t=sceneTrim;if(!t)return;
 sceneTrim=null;if(t.frame)cancelAnimationFrame(t.frame);setSnapGuide(null,0);
 document.removeEventListener('pointermove',moveSceneTrim);document.removeEventListener('pointerup',upSceneTrim);document.removeEventListener('pointercancel',cancelSceneTrim);
 document.body.classList.remove('trimming-scene');
 const target=store.document.scenes.find(v=>v.id===t.sceneId);
 if(!commit||!t.moved||!target||target.duration===t.duration){renderTimeline();return;}
 trimClickGuardUntil=performance.now()+400;
 try{
  if(target===scene()&&sceneElapsed>t.duration)sceneElapsed=t.duration;
  changed(()=>{retimeScene(store.document,t.sceneId,{duration:t.duration});},true,`Trim scene ${target.name}`);
 }catch(err){error(err);}
}
function upSceneTrim(){endSceneTrim(true);}
function cancelSceneTrim(){endSceneTrim(false);}
// E09/E10 · channel lane. The lane hit-tests with curveHit (curveLane.ts); a drag previews on the lane through
// timelineDocument(); pointer-up makes ONE labelled edit ("Edit curve <channel>") so Undo gets one entry. A position the
// law refuses is named in a toast and the curve holds where it was. Solo, mute and show never reach the document.
function viewsFor(sceneId:string){return (trackId:string)=>channelViews.get(`${sceneId}/${trackId}`);}
function channelViewOf(sceneId:string,trackId:string):ChannelView{return channelViews.get(`${sceneId}/${trackId}`)??{solo:false,mute:false,shown:true};}
function toggleChannelView(flag:'solo'|'mute'|'shown',trackId:string){const sceneId=scene().id,view=channelViewOf(sceneId,trackId),next={...view};next[flag]=!view[flag];channelViews.set(`${sceneId}/${trackId}`,next);needsFrame=true;renderTimeline();}
function trackInStore(sceneId:string,trackId:string){return store.document.scenes.find(v=>v.id===sceneId)?.propertyTracks?.find(t=>t.id===trackId);}
/** The selected channel of the active scene, with its selected keyframe; null when no channel of this scene is selected. */
function selectedCurve(){const s=scene(),sel=curveSel;if(!sel||sel.sceneId!==s.id)return null;const track=s.propertyTracks?.find(t=>t.id===sel.trackId);return track?{s,track,index:sel.index}:null;}
/** The lane under a pointer: its channel, frame and the hit on it, in lane pixels. */
function curveLaneAt(ev:MouseEvent,lane:HTMLElement){
 const s=scene(),track=s.propertyTracks?.find(t=>t.id===lane.dataset.trackId);
 if(!track||lane.dataset.sceneId!==s.id)return null;
 const rect=lane.getBoundingClientRect(),range=channelRange(s,track),frame=laneFrame(track.points,s.duration,range,rect.width,rect.height);
 const x=ev.clientX-rect.left,y=ev.clientY-rect.top,sel=curveSel;
 const selected=sel&&sel.sceneId===s.id&&sel.trackId===track.id?sel.index:null;
 return {s,track,range,rect,frame,x,y,hit:curveHit(track.points,frame,selected,x,y)};
}
function beginCurveDrag(ev:PointerEvent,lane:HTMLElement){
 const at=curveLaneAt(ev,lane);if(!at?.hit)return;
 ev.preventDefault();
 const hit=at.hit,trackId=at.track.id;
 curveSel={sceneId:at.s.id,trackId,index:hit.index};
 curveDrag={sceneId:at.s.id,trackId,kind:hit.kind,index:hit.index,end:hit.kind==='handle'?hit.end:'out',left:at.rect.left,top:at.rect.top,frame:at.frame,base:at.track.points,range:at.range,label:channelName(at.s,at.track),preview:null,message:'',moved:false,raf:0,dragSeq:0};
 document.addEventListener('pointermove',moveCurveDrag);document.addEventListener('pointerup',upCurveDrag);document.addEventListener('pointercancel',cancelCurveDrag);
 renderTimeline();
}
function moveCurveDrag(ev:PointerEvent){
 const d=curveDrag;if(!d)return;
 const p=fromPixel(d.frame,ev.clientX-d.left,ev.clientY-d.top);let time=Math.min(3600,Math.max(0,p.time));
 d.moved=true;
 // lane-3 E25: a keyframe's time snaps to the timeline's points, its own keyframe excluded; handles do not snap. Alt bypasses.
 if(d.kind==='key'){
  const s=store.document.scenes.findIndex(v=>v.id===d.sceneId),trackPx=document.querySelector<HTMLElement>('.scene-track-lane')?.getBoundingClientRect().width??0,total=expressionTiming(store.document,0,0).total;
  const start=s>=0?(sceneBoundaries(journeyDurations(store.document))[s]??0):0;
  const keyframes=s>=0?(store.document.scenes[s].propertyTracks??[]).flatMap(tr=>tr.points.map((pt,i)=>({id:`key:${tr.id}:${i}`,time:start+pt.time}))):[];
  const hit=timelineSnap&&!ev.altKey&&s>=0&&trackPx>0?closestSnap(snapPoints(store.document,{keyframes}),start+time,total/trackPx,{exclude:[`key:${d.trackId}:${d.index}`]}):null;
  setSnapGuide(hit?hit.time:null,total);
  if(hit)time=clamp(hit.time-start,0,3600);
 }
 let next:Points|null=null,message='';
 try{const candidate=d.kind==='key'?moveKey(d.base,d.index,time,p.value):moveHandle(d.base,d.index,d.end,time,p.value);validateCurveEdit(candidate,d.range,curveTouches(candidate,d));next=candidate;}
 catch(err){message=err instanceof Error?err.message:String(err);}
 // E09c: a refused position keeps the last valid preview on the field, so the drag does not snap back. The drag revision
 // moves only when the preview itself changes, so the engine rebuilds once per change, not on every pointer tick.
 const step=dragPreviewStep(d.preview,next,(a,b)=>JSON.stringify(a)===JSON.stringify(b));
 if(step.changed)d.dragSeq=++curveDragSerial;
 d.preview=step.preview;needsFrame=true;
 if(message&&message!==d.message)toast(message);
 d.message=message;
 if(!d.raf)d.raf=requestAnimationFrame(()=>{d.raf=0;renderTimeline();});
}
function endCurveDrag(commit:boolean){
 const d=curveDrag;if(!d)return;
 curveDrag=null;if(d.raf)cancelAnimationFrame(d.raf);setSnapGuide(null,0);
 document.removeEventListener('pointermove',moveCurveDrag);document.removeEventListener('pointerup',upCurveDrag);document.removeEventListener('pointercancel',cancelCurveDrag);
 const next=d.preview;
 // A release over a refused position commits nothing, as before: the kept preview is not the pointer's position.
 if(!commit||!d.moved||d.message||!next||JSON.stringify(next)===JSON.stringify(d.base)){renderTimeline();return;}
 const range=d.range;
 try{commitCurve(d.sceneId,d.trackId,next,curveTouches(next,d),`Edit curve ${d.label}`,range);}
 catch(err){error(err);renderTimeline();}
}
function upCurveDrag(){endCurveDrag(true);}
function cancelCurveDrag(){endCurveDrag(false);}
/** E09b: the touches of a curve drag. A keyframe carries its own value and the handles that move with it; a handle is itself. */
function curveTouches(points:Points,d:{kind:'key'|'handle';index:number;end:HandleEnd}):CurveTouch[]{return d.kind==='key'?touchesOfKey(points,d.index):[{handle:d.index,end:d.end}];}
/** The handles a segment's interpolation can shape: the out of its start keyframe and the in of its end keyframe. */
function segmentTouches(index:number):CurveTouch[]{return [{handle:index,end:'out'},{handle:index+1,end:'in'}];}
/** E09b: one curve edit is one labelled change. The field then keeps the curve it shows, as a finished take does, so the
 * pointer-up does not snap it back to the static parameters. */
function commitCurve(sceneId:string,trackId:string,points:Points,touched:readonly CurveTouch[],label:string,range:ChannelRange|undefined){
 changed(()=>{const t=trackInStore(sceneId,trackId);if(!t)throw new Error('That channel is no longer in this scene.');validateCurveEdit(points,range,touched);t.points=points;},true,label);
 trackPreview=true;
}
// E11 · seams. The boundary between two clips carries the transition of the scene it enters: its kind and parameters ride on
// that Scene beside its duration (the number `transition`). A change to the seam is one labelled edit.
function toggleSeam(sceneId:string){seamSceneId=seamSceneId===sceneId?null:sceneId;renderTimeline();}
function setSeamTransition(sceneId:string,kind:TransitionKind,params:TransitionParams={},seconds?:number){
 const target=store.document.scenes.find(v=>v.id===sceneId);if(!target){toast('That scene is no longer in this expression.');return;}
 const nextSeconds=seconds??target.transition;
 if(!(nextSeconds>=SCENE_TRANSITION_MIN&&nextSeconds<=SCENE_TRANSITION_MAX)){toast(`A transition lasts ${SCENE_TRANSITION_MIN}–${SCENE_TRANSITION_MAX} seconds.`);renderTimeline();return;}
 try{
  const spec=transitionSpecFor(kind,params);
  if(JSON.stringify(spec)===JSON.stringify(target.transitionSpec)&&nextSeconds===target.transition)return;
  changed(()=>{applyTimelineMove(store.document,scenes=>writeSeamTransition(scenes,sceneId,spec,nextSeconds));},true,transitionLabel(kind));
 }catch(err){error(err);renderTimeline();}
}
/** Choosing a kind keeps only the parameters that kind takes. */
function setSeamKind(sceneId:string,kind:TransitionKind){
 const prior=store.document.scenes.find(v=>v.id===sceneId)?.transitionSpec;
 setSeamTransition(sceneId,kind,kind==='wipe'?{direction:prior?.direction}:kind==='dip-to-colour'?{at:prior?.at}:{});
}
// Lane-5 T5 · the seam chooser's edge facts. A switch or curve preset is one planned edge write (planEdgeEdit), applied inside one
// labelled change (applyEdgeWrite). On the native owner's journey the path panel's own edit takes it, as one native edit.
function editSeamEdge(edit:EdgeEdit){
 const refusal=edit.kind!=='loop'?edgeEditRefusal(store.document.scenes.find(v=>v.id===edit.enterSceneId)?.transitionSpec,edit):undefined;
 if(refusal){toast(refusal);renderTimeline();return;}
 if(journeyInstrument?.editEdge(edit,text=>toast(text)))return;
 const plan=planEdgeEdit(store.document,edit);
 if(!plan.ok){toast(plan.reason);renderTimeline();return;}
 const write=plan.write,label=plan.label;
 // An edit the edge already has is named, not written: nothing reaches the owner or the undo stack.
 const probe=JSON.parse(JSON.stringify(store.document.scenes)) as Scene[];
 applyEdgeWrite(probe,write);
 if(JSON.stringify(probe.find(v=>v.id===write.sceneId)?.transitionSpec??null)===JSON.stringify(store.document.scenes.find(v=>v.id===write.sceneId)?.transitionSpec??null)){toast(`${label} changed nothing: this edge already has it.`);renderTimeline();return;}
 try{changed(()=>applyTimelineMove(store.document,scenes=>applyEdgeWrite(scenes,write)),true,label);}catch(err){error(err);renderTimeline();}
}
// Lane-5 T5 / E09 · a bezier handle of a seam's curve. The drag is the E09 lane's own maths (curveHit, fromPixel, E08's moveHandle and
// validateCurveEdit, through transitionCurveHandleEdit). The preview is drawn on the chooser's lane; pointer-up makes ONE labelled edit.
function beginSeamCurveDrag(ev:PointerEvent,lane:HTMLElement){
 const scene=store.document.scenes.find(v=>v.id===lane.dataset.sceneId),curve=scene?.transitionSpec?.curve;
 if(!scene||!curve||curve.type!=='bezier')return;
 const rect=lane.getBoundingClientRect(),points=curvePointsOf(curve),frame=laneFrame(points,TRANSITION_LANE.duration,TRANSITION_LANE.range,rect.width,rect.height);
 const hit=curveHit(points,frame,0,ev.clientX-rect.left,ev.clientY-rect.top);
 if(hit?.kind!=='handle')return;
 ev.preventDefault();
 seamCurveDrag={sceneId:scene.id,base:curve,index:hit.index as 0|1,end:hit.end,frame,left:rect.left,top:rect.top,preview:null,message:'',moved:false,refused:false,raf:0};
 document.addEventListener('pointermove',moveSeamCurveDrag);document.addEventListener('pointerup',upSeamCurveDrag);document.addEventListener('pointercancel',cancelSeamCurveDrag);
}
function moveSeamCurveDrag(ev:PointerEvent){
 const d=seamCurveDrag;if(!d)return;
 const p=fromPixel(d.frame,ev.clientX-d.left,ev.clientY-d.top);
 d.moved=true;
 const next=transitionCurveHandleEdit(d.base,d.index,d.end,p.time,p.value);
 // A refused position keeps the last valid preview on the lane, so the drag does not snap back. The refusal is named once.
 const message=next.ok?'':next.reason;
 if(next.ok)d.preview=next.curve;
 d.refused=!next.ok;
 if(message&&message!==d.message)toast(message);
 d.message=message;
 if(!d.raf)d.raf=requestAnimationFrame(()=>{d.raf=0;renderTimeline();});
}
function endSeamCurveDrag(commit:boolean){
 const d=seamCurveDrag;if(!d)return;
 seamCurveDrag=null;if(d.raf)cancelAnimationFrame(d.raf);
 document.removeEventListener('pointermove',moveSeamCurveDrag);document.removeEventListener('pointerup',upSeamCurveDrag);document.removeEventListener('pointercancel',cancelSeamCurveDrag);
 const curve=curveGestureWrite(d.base,d.preview,{commit,moved:d.moved,refused:d.refused});
 if(!curve){renderTimeline();return;}
 // Lane-5 T5 / E09 · the release is the chooser's one edge edit, the same path a preset takes (editSeamEdge): the hosted owner
 // takes the whole curve, handles included, as one native edit; a local release is one labelled change. The lane re-renders
 // after, so a hosted release shows the stored curve until the owner's reply, not the held preview.
 editSeamEdge({kind:'curve',enterSceneId:d.sceneId,type:'bezier',out:curve.out,in:curve.in});
 renderTimeline();
}
function upSeamCurveDrag(){endSeamCurveDrag(true);}
function cancelSeamCurveDrag(){endSeamCurveDrag(false);}
// Lane-5 T6 · overlap-to-blend: drag a seam's glyph right to lengthen the blend it authors, left to a cut. The blend is the
// incoming scene's head, the span the engine plays, so the overlap is that span and the expression clock does not move.
// Pointer-up is ONE labelled edit through applyTimelineMove and writeSeamTransition. A cut seam that gains time becomes the
// document's default blend; a dip or a wipe keeps its kind.
function seamPreviewDocument(doc:Journey):Journey{const b=seamBlend;if(!b?.moved)return doc;return {...doc,scenes:doc.scenes.map(v=>v.id===b.sceneId?{...v,transition:b.seconds}:v)};}
function beginSeamBlend(ev:PointerEvent,glyph:HTMLElement){
 const sceneId=glyph.dataset.sceneId??'',lane=glyph.closest<HTMLElement>('.scene-track-lane');
 const i=store.document.scenes.findIndex(v=>v.id===sceneId);
 if(!lane||i<1)return;
 if(sceneTrim||sceneRoll||sceneBody||seamBlend)return;
 if(propertyTake){toast('Finish the property take before changing a seam.');return;}
 const trackPx=lane.getBoundingClientRect().width;
 if(!(trackPx>0))return;
 ev.preventDefault();
 const doc=store.document,v=doc.scenes[i];
 seamBlend={sceneId,startX:ev.clientX,trackPx,layout:journeyTimelineLayout(doc.scenes,(index,local)=>expressionTiming(doc,index,local),100),from:v.transition,limit:blendLimit(v.duration),seconds:v.transition,clamped:null,moved:false,frame:0};
 document.body.classList.add('trimming-scene');
 document.addEventListener('pointermove',moveSeamBlend);document.addEventListener('pointerup',upSeamBlend);document.addEventListener('pointercancel',cancelSeamBlend);
}
function moveSeamBlend(ev:PointerEvent){
 const b=seamBlend;if(!b)return;
 let next:ReturnType<typeof overlapFromDrag>;
 try{next=overlapFromDrag(b.from,b.limit,b.layout,ev.clientX-b.startX,b.trackPx);}catch(err){endSeamBlend(false);error(err);return;}
 if(next.clamped&&next.clamped!==b.clamped)toast(next.clamped==='max'?blendLimitMessage(b.limit):'A blend stops at a cut: no seconds.');
 b.clamped=next.clamped;b.seconds=next.seconds;b.moved=b.seconds!==b.from;
 if(!b.frame)b.frame=requestAnimationFrame(()=>{b.frame=0;renderTimeline();});
}
function endSeamBlend(commit:boolean){
 const b=seamBlend;if(!b)return;
 seamBlend=null;if(b.frame)cancelAnimationFrame(b.frame);
 document.removeEventListener('pointermove',moveSeamBlend);document.removeEventListener('pointerup',upSeamBlend);document.removeEventListener('pointercancel',cancelSeamBlend);
 document.body.classList.remove('trimming-scene');
 const target=store.document.scenes.find(v=>v.id===b.sceneId);
 if(!commit||!b.moved||!target||target.transition===b.seconds){renderTimeline();return;}
 trimClickGuardUntil=performance.now()+400;
 const spec=transitionKindOf(target.transitionSpec)==='cut'&&b.seconds>0?undefined:target.transitionSpec;
 try{changed(()=>{applyTimelineMove(store.document,scenes=>writeSeamTransition(scenes,b.sceneId,spec,b.seconds));},true,`Set blend into ${target.name}`);}
 catch(err){error(err);renderTimeline();}
}
function upSeamBlend(){endSeamBlend(true);}
function cancelSeamBlend(){endSeamBlend(false);}
// Lane-5 T7 · the live edge: each blend's fill and caption follow the expression clock, while playing and while scrubbing.
// review-5 #2: the seam starts and the playhead are read on one clock, chosen by the caller: the saved clock while a saved sequence plays.
function paintSeamBlends(saved:boolean){
 const lane=document.querySelector<HTMLElement>('.scene-track-lane');if(!lane)return;
 const doc=store.document,timing=(index:number,local:number)=>expressionTiming(doc,index,local,saved),time=timing(sceneIndex,sceneElapsed).time;
 for(const seam of seamStates(doc.scenes,timing,time)){
  const scene=doc.scenes[seam.index],id=CSS.escape(seam.sceneId);
  const band=lane.querySelector<HTMLElement>(`[data-seam-band][data-scene-id="${id}"]`);
  if(band){band.style.setProperty('--blend-progress',(seam.fraction??0).toFixed(4));band.dataset.blending=String(seam.fraction!==null);}
  const caption=lane.querySelector<HTMLElement>(`[data-seam-caption][data-scene-id="${id}"]`);
  if(caption){const text=seamCaption(doc.scenes[seam.index-1]?.name,scene,seam.fraction);if(caption.textContent!==text)caption.textContent=text;caption.dataset.blending=String(seam.fraction!==null);}
 }
}
/** E11: paints the transition in flight at fraction f. The crossfade keeps its overlay opacity exactly. A painted kind
 * composes its blend on the transition canvas over the live field: dip to colour fades the outgoing frame into the incoming
 * scene's own background and out again; a wipe holds the outgoing frame only where the mask has not reached. */
/** T5: a seam's blend progress through its curve. A seam without a curve is linear, the identity, exactly the easing it always used. */
const LINEAR_SEAM_CURVE:TransitionCurve={type:'linear'};
function blendProgress(f:number){return transitionCurveNow?curveProgress(transitionCurveNow,f):applyEasing(f,transitionEasing);}
function paintTransition(f:number){
 const c=$<HTMLCanvasElement>('transition-canvas'),snapshot=transitionSnapshot;
 if(transitionKind==='crossfade'||!snapshot){c.style.opacity=String(1-blendProgress(f));return;}
 const ctx=c.getContext('2d')!,e=blendProgress(f),w=c.width,h=c.height;
 ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.clearRect(0,0,w,h);
 if(transitionKind==='dip-to-colour'){
  const d=dipWeights(e,transitionSpecNow?.at);
  if(d.outgoing>0){ctx.fillStyle=transitionBackground;ctx.fillRect(0,0,w,h);ctx.globalAlpha=d.outgoing;ctx.drawImage(snapshot,0,0,w,h);}
  else if(d.colour>0){ctx.fillStyle=transitionBackground;ctx.globalAlpha=d.colour;ctx.fillRect(0,0,w,h);}
 }else{
  const r=wipeHoldRect(transitionSpecNow?.direction??'left',e,w,h);
  if(r.width>0&&r.height>0)ctx.drawImage(snapshot,r.x,r.y,r.width,r.height,r.x,r.y,r.width,r.height);
 }
 ctx.globalAlpha=1;
}
/** E11: the crossfade seam. The outgoing frame is held on the transition canvas and fades over the incoming Scene; the same
 * statements the Scene change always ran, extracted so a nested occurrence's crossing uses this exact path. */
function startCrossfadeSeam(target:{id:string;transition:number;transitionSpec?:TransitionSpec},outgoingBackground:string){
 const c=$<HTMLCanvasElement>('transition-canvas');c.width=engine.canvas.width;c.height=engine.canvas.height;c.getContext('2d')!.drawImage(engine.canvas,0,0);transitionBackground=outgoingBackground;c.style.background=transitionBackground;c.style.opacity='1';c.hidden=false;transitionStart=simTime;transitionDuration=target.transition;transitionEasing='linear';transitionCurveNow=curveOf(target.transitionSpec)??LINEAR_SEAM_CURVE;transitionKind='crossfade';transitionSnapshot=null;transitionSceneId=target.id;
}
/** E11: a painted seam (dip to colour, wipe) keeps a snapshot of the outgoing frame and paints its blend each frame. */
function startPaintedSeam(target:Scene){
 const snapshot=document.createElement('canvas');snapshot.width=engine.canvas.width;snapshot.height=engine.canvas.height;snapshot.getContext('2d')!.drawImage(engine.canvas,0,0);
 const c=$<HTMLCanvasElement>('transition-canvas');c.width=engine.canvas.width;c.height=engine.canvas.height;
 transitionKind=transitionKindOf(target.transitionSpec);transitionSpecNow=target.transitionSpec;transitionSnapshot=snapshot;
 transitionBackground=target.field.background;c.style.background='none';c.style.opacity='1';c.hidden=false;
 transitionStart=simTime;transitionDuration=target.transition;transitionEasing='linear';transitionCurveNow=curveOf(target.transitionSpec)??LINEAR_SEAM_CURVE;transitionSceneId=target.id;
 needsFrame=true;paintTransition(0);
}
/** Double-click on empty lane: a keyframe at that time, holding the curve's own value there. */
function curveDoubleClick(ev:MouseEvent,lane:HTMLElement){
 const at=curveLaneAt(ev,lane);if(!at||at.hit)return;
 ev.preventDefault();
 const time=Math.min(3600,Math.max(0,Math.round(fromPixel(at.frame,at.x,at.y).time*1000)/1000));
 const {s,track,range}=at,sceneId=s.id,trackId=track.id,label=channelName(s,track);
 try{
  const next=insertKey(track.points,time),added=next.findIndex(p=>p.time===time);validateCurveEdit(next,range,touchesOfKey(next,added));
  curveSel={sceneId,trackId,index:added};
  commitCurve(sceneId,trackId,next,touchesOfKey(next,added),`Add keyframe ${label}`,range);
 }catch(err){error(err);}
}
/** Delete removes the selected keyframe; a channel keeps at least two. */
function deleteCurveKey(){
 const c=selectedCurve();if(!c||c.index===null)return;
 const {s,track}=c,index=c.index,range=channelRange(s,track),sceneId=s.id,trackId=track.id,label=channelName(s,track);
 try{
  const next=removeKey(track.points,index);validateCurveEdit(next,range,[]);
  curveSel={sceneId,trackId,index:Math.min(index,next.length-1)};
  commitCurve(sceneId,trackId,next,[],`Delete keyframe ${label}`,range);
 }catch(err){error(err);}
}
/** The interpolation of the segment that starts at a keyframe. */
function setCurveSegment(trackId:string,index:number,type:Interpolation){
 const s=scene(),track=s.propertyTracks?.find(t=>t.id===trackId);if(!track)return;
 const sceneId=s.id,label=channelName(s,track),range=channelRange(s,track);
 try{
  const next=setSegmentType(track.points,index,type);
  if(JSON.stringify(next)===JSON.stringify(track.points))return;
  validateCurveEdit(next,range,segmentTouches(index));
  curveSel={sceneId,trackId,index};
  commitCurve(sceneId,trackId,next,segmentTouches(index),`Edit curve ${label}`,range);
 }catch(err){error(err);}
}
// E06 · roll: Shift-drag on a clip's edge. The seam moves with the next scene: the left lasts +d, the right −d,
// Σ is conserved, and each side keeps the timing bounds. Pointer-up makes ONE labelled composite (one undo entry).
function sceneNameOf(sceneId:string){return store.document.scenes.find(s=>s.id===sceneId)?.name??'scene';}
/** A move can change a scene's index; the playhead stays on the same scene, by ref. */
function refocusScene(sceneId:string){sceneIndex=Math.max(0,store.document.scenes.findIndex(s=>s.id===sceneId));}
function beginSceneRoll(ev:PointerEvent,handle:HTMLElement){
 const leftId=handle.dataset.sceneId??'',lane=handle.closest<HTMLElement>('.scene-track-lane');
 const scenes=store.document.scenes,i=scenes.findIndex(v=>v.id===leftId);
 if(!lane||i<0)return;
 if(i>=scenes.length-1){toast('There is no scene after this one to roll the seam into.');return;}
 if(propertyTake){toast('Finish the property take before rolling a seam.');return;}
 const trackPx=lane.getBoundingClientRect().width;
 if(!(trackPx>0))return;
 const total=journeyTimelineLayout(scenes,(index,local)=>expressionTiming(store.document,index,local),100).total;
 sceneRoll={leftId,rightId:scenes[i+1].id,startX:ev.clientX,trackPx,total,left:scenes[i].duration,right:scenes[i+1].duration,seconds:0,clamped:null,moved:false,frame:0};
 document.body.classList.add('trimming-scene');
 document.addEventListener('pointermove',moveSceneRoll);document.addEventListener('pointerup',upSceneRoll);document.addEventListener('pointercancel',cancelSceneRoll);
}
function moveSceneRoll(ev:PointerEvent){
 const r=sceneRoll;if(!r)return;
 const range=seamRollRange(r.left,r.right);let want=secondsFromDrag(ev.clientX-r.startX,r.trackPx,r.total);
 // lane-3 E25: the seam snaps to points a roll does not move: every scene start but its own, markers, the loop and the playhead.
 // A roll conserves the journey's length, so no other scene start moves. Alt bypasses; a still pointer never snaps.
 const index=store.document.scenes.findIndex(v=>v.id===r.leftId),bounds=sceneBoundaries(journeyDurations(store.document));
 const seam=bounds[index+1]??r.total;let hitTime:number|null=null;
 if(index>=0&&want!==0&&timelineSnap&&!ev.altKey){const hit=closestSnap(snapPoints(store.document,{boundaries:bounds}),seam+want,r.total/r.trackPx,{exclude:[`scene:${index+1}`]});if(hit){want=hit.time-seam;hitTime=hit.time;}}
 setSnapGuide(hitTime,r.total);
 const seconds=Math.min(range.max,Math.max(range.min,want)),clamped=want<range.min?'min':want>range.max?'max':null;
 if(clamped&&clamped!==r.clamped)toast(`The seam stops at its limit: a scene lasts ${SCENE_DURATION_MIN} to ${SCENE_DURATION_MAX} seconds.`);
 r.clamped=clamped;r.seconds=seconds;r.moved=seconds!==0;
 if(!r.frame)r.frame=requestAnimationFrame(()=>{r.frame=0;renderTimeline();});
}
function endSceneRoll(commit:boolean){
 const r=sceneRoll;if(!r)return;
 sceneRoll=null;if(r.frame)cancelAnimationFrame(r.frame);setSnapGuide(null,0);
 document.removeEventListener('pointermove',moveSceneRoll);document.removeEventListener('pointerup',upSceneRoll);document.removeEventListener('pointercancel',cancelSceneRoll);
 document.body.classList.remove('trimming-scene');
 if(!commit||!r.moved){renderTimeline();return;}
 trimClickGuardUntil=performance.now()+400;
 try{changedComposite(`Roll seam after ${sceneNameOf(r.leftId)}`,d=>{rollSceneSeam(d,r.leftId,r.seconds);});if(sceneElapsed>scene().duration)sceneElapsed=scene().duration;}catch(err){error(err);renderTimeline();}
}
function upSceneRoll(){endSceneRoll(true);}
function cancelSceneRoll(){endSceneRoll(false);}
// E04/E06 · body: one drag on a clip body. The modifiers set its meaning, read live: plain = slide/insert (the
// scene moves before the clip whose near half the pointer is over, a line shows the edge); Alt+Shift = overwrite
// (that clip is replaced by this one, the clip is highlighted); Alt = slip (the scene starts earlier or later in
// its own evolution, the clip reads its new start). Pointer-up is ONE labelled composite (one undo entry).
function beginSceneBody(ev:PointerEvent,clip:HTMLElement){
 const sceneId=clip.dataset.sceneId??'',lane=clip.closest<HTMLElement>('.scene-track-lane');
 const v=store.document.scenes.find(s=>s.id===sceneId);
 if(!v||!lane||sceneTrim||sceneRoll)return;
 if(propertyTake){toast('Finish the property take before moving a scene.');return;}
 const trackPx=lane.getBoundingClientRect().width;
 if(!(trackPx>0))return;
 ev.preventDefault();
 const total=journeyTimelineLayout(store.document.scenes,(index,local)=>expressionTiming(store.document,index,local),100).total;
 sceneBody={sceneId,clip,startX:ev.clientX,trackPx,total,duration:v.duration,from:v.entryOffset??0,mode:'insert',targetId:sceneId,rightHalf:false,offset:v.entryOffset??0,moved:false};sceneDragId=sceneId;
 document.body.classList.add('moving-scene');
 document.addEventListener('pointermove',moveSceneBody);document.addEventListener('pointerup',upSceneBody);document.addEventListener('pointercancel',cancelSceneBody);
}
function moveSceneBody(ev:PointerEvent){
 const b=sceneBody;if(!b)return;
 const dx=ev.clientX-b.startX;
 if(!b.moved&&Math.abs(dx)<4)return;
 b.moved=true;
 b.mode=ev.altKey&&ev.shiftKey?'overwrite':ev.altKey?'slip':'insert';
 if(b.mode==='slip'){b.offset=slipOffsetFromDrag(b.from,dx,b.trackPx,b.total,b.duration);}
 else{
  const lane=b.clip.closest<HTMLElement>('.scene-track-lane'),rect=lane?.getBoundingClientRect();
  if(rect&&rect.width>0){
   const seconds=Math.min(Math.max((ev.clientX-rect.left)/rect.width,0),1)*b.total;
   const hit=sceneAtTime(journeyTimelineLayout(store.document.scenes,(index,local)=>expressionTiming(store.document,index,local),100),seconds);
   if(hit){const target=store.document.scenes.find(s=>s.id===hit.sceneId);b.targetId=hit.sceneId;b.rightHalf=!!target&&hit.local>target.duration/2;}
  }
 }
 paintSceneBody();
}
function paintSceneBody(){
 const b=sceneBody;if(!b)return;
 const lane=b.clip.closest<HTMLElement>('.scene-track-lane');if(!lane)return;
 lane.querySelectorAll<HTMLElement>('[data-drop]').forEach(el=>el.removeAttribute('data-drop'));
 const line=lane.querySelector<HTMLElement>('.scene-insert-line');
 b.clip.dataset.drag=b.mode;
 if(b.mode==='slip'){b.clip.dataset.readout=`starts at ${b.offset.toFixed(1)} s`;if(line)line.hidden=true;return;}
 delete b.clip.dataset.readout;
 const target=b.targetId===b.sceneId?null:lane.querySelector<HTMLElement>(`[data-scene-id="${CSS.escape(b.targetId)}"]`);
 if(b.mode==='overwrite'){target?.setAttribute('data-drop','overwrite');if(line)line.hidden=true;return;}
 if(!target){if(line)line.hidden=true;return;}
 const insertLine=line??lane.appendChild(Object.assign(document.createElement('div'),{className:'scene-insert-line'}));
 const laneRect=lane.getBoundingClientRect(),tr=target.getBoundingClientRect();
 insertLine.hidden=false;insertLine.style.left=`${(b.rightHalf?tr.right:tr.left)-laneRect.left}px`;
}
function endSceneBody(commit:boolean){
 const b=sceneBody;if(!b)return;
 sceneBody=null;sceneDragId='';
 document.removeEventListener('pointermove',moveSceneBody);document.removeEventListener('pointerup',upSceneBody);document.removeEventListener('pointercancel',cancelSceneBody);
 document.body.classList.remove('moving-scene');
 renderTimeline();
 if(!b.moved)return;
 // A moved body never reads as a click, whether or not the move commits (a drag back to its start, a cancel).
 trimClickGuardUntil=performance.now()+400;
 if(!commit)return;
 const current=scene().id;
 try{
  if(b.mode==='slip'){
   if(b.offset===b.from)return;
   const offset=b.offset;
   changedComposite(`Slip scene ${sceneNameOf(b.sceneId)}`,d=>{slipScene(d,b.sceneId,offset);},()=>refocusScene(current));
   return;
  }
  if(b.targetId===b.sceneId)return;
  if(b.mode==='overwrite'){
   const replaced=b.targetId;
   changedComposite(`Overwrite scene ${sceneNameOf(replaced)} with ${sceneNameOf(b.sceneId)}`,d=>{overwriteScene(d,b.sceneId,replaced);},()=>refocusScene(current===replaced?b.sceneId:current));
   return;
  }
  const before=insertBeforeFor(store.document.scenes,b.targetId,b.rightHalf);
  changedComposite(`Insert scene ${sceneNameOf(b.sceneId)}`,d=>{insertScene(d,b.sceneId,before);},()=>refocusScene(current));
 }catch(err){error(err);}
}
function upSceneBody(){endSceneBody(true);}
function cancelSceneBody(){endSceneBody(false);}
/** E04 starter: a still scene after the current one, as one labelled edit. */
function addStillScene(){
 if(propertyTake){toast('Finish the property take before adding a scene.');return;}
 if(store.document.scenes.length>=64){toast('An expression can contain up to 64 scenes.');return;}
 const fresh=stillScene();
 changed(()=>{applyTimelineMove(store.document,scenes=>{scenes.splice(sceneIndex+1,0,fresh);});sceneIndex++;selected=[];textId=scene().text[0]?.id??null;sceneElapsed=0;journeyPlaying=false;},true,'Add still scene');
 edit(true,'scene');timelineOpen=true;renderAll();
}
// E07 · split: the scene under the playhead is cut in two at the playhead's global time.
// One labelled composite (E16) is one undo entry and one kernel edit; a refusal throws
// before anything is written and is named in the toast.
function changedComposite(label:string,fn:(doc:Journey)=>void,after?:()=>void){
 store.composite(label,fn);
 after?.();
 trackPreview=false;if(journeyPlaying){journeyPlaying=false;applySceneView();}
 awaitingNativeBoot=false;nativeWorkspace?.cancelOpen();markSaved();overlayDirty=true;needsFrame=true;renderAll();
}
function splitSceneAtPlayhead(){
 if(propertyTake){toast('Finish the property take before splitting a scene.');return;}
 const doc=store.document,timing=expressionTiming(doc,sceneIndex,sceneElapsed);
 const hit=sceneAtTime(journeyTimelineLayout(doc.scenes,(index,local)=>expressionTiming(doc,index,local),100),timing.time);
 const source=hit?doc.scenes.find(v=>v.id===hit.sceneId):undefined;
 if(!hit||!source)return;
 const local=hit.local,sceneId=hit.sceneId;
 try{changedComposite(`Split scene ${source.name}`,d=>{splitScene(d,sceneId,local,uid('scene'));});}catch(err){error(err);}
}
function renderShapePicker(){if(!shapePickerOpen)return;$('shape-picker').innerHTML=`<h3>Choose a form</h3><div class="shape-choices">${[['text','O','Glyph'],['ring','◯','Ring'],['disc','●','Disc'],['triangle','△','Triangle'],['square','□','Plane'],['text','&','Character']].map(([s,g,l])=>`<button data-action="choose-shape" data-value="${s}" data-glyph="${esc(g)}" class="${shapeChoice===s&&((s==='text'&&glyphChoice===g)||s!=='text')?'active':''}">${esc(g)}<small>${l}</small></button>`).join('')}</div>${shapeChoice==='text'?`<label class="control"><span>Your glyph or word</span><input id="placement-glyph" value="${esc(glyphChoice)}" maxlength="120" aria-label="Formation to place"></label>`:''}<p>Pick a point and set the form anchor. The working plane keeps your depth consistent.</p><label class="toggle-row" style="margin-top:15px;margin-bottom:0"><span>Keep placing</span><input id="keep-placing" type="checkbox" ${keepPlacing?'checked':''}><i></i></label>`;}
function setHint(){let h='';if(placementStep)h=`Place link ${stepIndex+1} on the working plane.<button data-action="cancel-placement">Cancel</button>`;else if(tool==='pin')h=`Click to place one attractor.<button data-action="repeat-pins" aria-pressed="${pinRepeat}">${pinRepeat?'✓ Keep placing':'Keep placing'}</button>`;else if(tool==='formation')h='Choose a form, then click where it belongs.';else if(tool==='text')h='Drag text blocks and adjust wording in Scene settings.';
 $('tool-hint').innerHTML=h;$('tool-hint').hidden=!h||!editing||!railExpanded;$('stage').style.cursor=tool==='select'?'default':tool==='orbit'?'grab':'crosshair';}
function saveWorkspace(){store.change('Update toolbelt',()=>{store.document.shared!.toolbelt=clone(workspace.entries);});markSaved();try{localStorage.setItem(WORKSPACE_KEY,JSON.stringify(workspace));workspaceStorageError=false;}catch{workspaceStorageError=true;}}
function liveContext():InspectorContext{return {scene:effectiveScene(store.document,scene()),journey:store.document,selected,textId,tab,motionTab,stepIndex,preview:false,search:'',supported:[...engine.capabilities.parameters],pinned:workspace.entries.filter(v=>v.scope==='field').map(v=>v.key)};}
function renderContext(){const host=$('context-panel');host.hidden=!contextKind||presenting||libraryOpen;if(!contextKind)return;const title=contextKind==='objects'?'Objects in this scene':contextKind==='text'?'Page text':'Pointer';const ctx={...liveContext(),tab:contextKind==='objects'?'objects':contextKind==='text'?'scene':'field'} as InspectorContext;const content=document.createElement('div');content.innerHTML=inspectorHTML(ctx);if(contextKind==='objects')content.querySelector('[data-detail="arrange"]')?.remove();if(contextKind==='text'||contextKind==='pointer'){const group=content.querySelector('[data-detail="'+(contextKind==='text'?'page-text':'pointer')+'"]');if(group){(group as HTMLDetailsElement).open=true;content.replaceChildren(group);}}host.innerHTML='<header><h2>'+title+'</h2><button data-action="close-context" aria-label="Close local controls">×</button></header><div class="context-content">'+content.innerHTML+(contextKind==='objects'?revealHTML():'')+'</div>';}
function renderLive(){const parts=liveWorkspaceHTML(liveContext(),workspace);const secondary=tool==='pin'||studioOpen||timelineOpen||modesOpen||captureOpen||beltPickerOpen||!!contextKind||shapePickerOpen;$('live-workspace').hidden=!sequenceOpen||secondary||presenting||libraryOpen;$('toolbelt-panel').hidden=!beltOpen||presenting||libraryOpen;$('toolbelt-button').setAttribute('aria-expanded',String(!$('toolbelt-panel').hidden));for(const [id,html] of [['live-content',parts.sequence],['belt-content',parts.controls]]){const host=$(id),scroll=host.scrollTop,openGlyphs=Array.from(host.querySelectorAll<HTMLDetailsElement>('[data-glyph-category][open]')).map(d=>d.dataset.glyphCategory),libraryExpanded=host.querySelector<HTMLDetailsElement>('.glyph-tree')?.open,layerDisclosure=readLayerDisclosure(host.querySelector<HTMLDetailsElement>('.live-layers'));host.innerHTML=html;restoreLayerDisclosure(host.querySelector<HTMLDetailsElement>('.live-layers'),layerDisclosure);if(libraryExpanded){const tree=host.querySelector<HTMLDetailsElement>('.glyph-tree');if(tree)tree.open=true;}host.querySelectorAll<HTMLDetailsElement>('[data-glyph-category]').forEach(d=>d.open=openGlyphs.includes(d.dataset.glyphCategory));host.scrollTop=scroll;}$('belt-picker').hidden=!beltPickerOpen||libraryOpen;if(beltPickerOpen)$('belt-picker').innerHTML=pickerHTML(scene(),workspace.entries,pendingBelt);const evaluated=engine.telemetry?.();updateToolbeltValues($('belt-content'),scene(),evaluated?.params??scene().field.params,evaluated?.config);renderContext();if(!$('context-panel').hidden)void refreshSourcePreviews($('context-panel'));if(!$('live-workspace').hidden)void refreshSourcePreviews($('live-content'));const chooser=$('automation-assignment');chooser.hidden=!assignmentTarget&&!assignmentGroup;if(!chooser.hidden)chooser.innerHTML=assignmentHTML(scene(),assignmentTarget,assignmentGroup);const monitor=$('automation-monitor');monitor.hidden=!scene().automation.length||!beltOpen||presenting||libraryOpen;document.documentElement.style.setProperty('--automation-height',monitor.hidden?'0px':'160px');if(!monitor.hidden){if(!scene().automation.some(l=>l.id===monitoredLane))monitoredLane=scene().automation[0].id;const belt=$('toolbelt-panel');if(monitorDocked){if(monitor.parentElement!==belt)belt.appendChild(monitor);monitor.classList.add('docked');}else{if(monitor.parentElement!==document.body)document.body.appendChild(monitor);monitor.classList.remove('docked');}monitor.innerHTML=monitorHTML(scene(),monitoredLane,monitorMode);}document.querySelector('.instrument')?.classList.toggle('expanded',timelineOpen);}
// Docking swaps the studio's anchor side, so a width/height transition would teleport it: invert the layout change, then play the transform back.
function flipPanel(el:HTMLElement,mutate:()=>void){el.style.transition='none';el.style.transform='';const a=el.getBoundingClientRect();mutate();const b=el.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top,sx=b.width?a.width/b.width:1,sy=b.height?a.height/b.height:1;if(!b.width||!b.height||(!dx&&!dy&&Math.abs(sx-1)<.002&&Math.abs(sy-1)<.002)){el.style.transition='';return;}const done=(ev:TransitionEvent)=>{if(ev.target!==el||ev.propertyName!=='transform')return;el.removeEventListener('transitionend',done);el.style.transition='';el.style.transformOrigin='';};el.addEventListener('transitionend',done);el.style.transformOrigin='top left';el.style.transform=`translate(${dx}px,${dy}px) scale(${sx},${sy})`;void el.offsetWidth;el.style.transition='transform .25s cubic-bezier(.2,.8,.2,1)';el.style.transform='';}
function setStudio(open:boolean){if(!open)draftSchedule.flushNow('studio');pointer.active=false;if(open)journeyPlaying=false;studioOpen=open;inspectorOpen=open;editing=open||cursorTool==='select';renderAll();}
function renderAll(){syncDeepLinkAddress();blueprintHUD?.refresh();if(studioDocked&&studioOpen&&beltOpen){beltWasOpen=true;beltOpen=false;}if(!studioDocked&&beltWasOpen){beltWasOpen=false;beltOpen=true;}if((inspectorOpen||contextKind)&&(tool==='pin'||tool==='formation')){tool=cursorTool;railExpanded=false;}if(beltPickerOpen){inspectorOpen=false;contextKind='';timelineOpen=false;shapePickerOpen=false;modesOpen=false;captureOpen=false;}else if(inspectorOpen){contextKind='';timelineOpen=false;shapePickerOpen=false;modesOpen=false;captureOpen=false;}else if(contextKind){timelineOpen=false;shapePickerOpen=false;modesOpen=false;captureOpen=false;}else if(timelineOpen){shapePickerOpen=false;modesOpen=false;captureOpen=false;}sanitiseSelection();sceneBodies?.refresh();workspace.entries=clone(store.document.shared!.toolbelt);if(tab==='motion')studioSection=motionTab==='automation'?'automation':motionTab==='sequence'?'sequence':motionTab==='focus'?'focus':'motion';else if(tab==='objects'&&!['formations','layout'].includes(studioSection))studioSection='formations';else if(tab==='scene'&&!['scene','text'].includes(studioSection))studioSection='scene';else if(tab==='field'&&!['physics','pointer','relational','collision','appearance','volume','resonance','native','blueprint','palace','places','canvas'].includes(studioSection))studioSection='physics';studioOpen=inspectorOpen&&editing;if(railKey!=='objects'||tool!=='select')railKey=tool;if(transitionDuration&&transitionSceneId!==scene().id){transitionDuration=0;$('transition-canvas').hidden=true;}theme();document.body.classList.toggle('studio-open',studioOpen);$('inspector').classList.toggle('is-studio',studioOpen);$('inspector').classList.toggle('docked',studioDocked);const dockButton=$('dock-studio');if(dockButton){dockButton.setAttribute('aria-pressed',String(studioDocked));dockButton.title=studioDocked?'Return the studio to full size':'Dock the studio where the toolbelt sits';dockButton.innerHTML=icon(studioDocked?'expand':'collapse');}$<HTMLSelectElement>('workspace-appearance').value=workspace.appearance;document.querySelectorAll<HTMLElement>('[data-action="studio-section"]').forEach(b=>b.setAttribute('aria-current',b.dataset.value===studioSection?'page':'false'));document.body.classList.toggle('editing',editing);document.body.classList.toggle('presentation',presenting);document.body.classList.toggle('editing-text',editing&&tool==='text');
 if(!$('inspector').hidden)studioScroll=$('inspector-content').scrollTop;$('inspector').hidden=!inspectorOpen||!editing;$('tool-rail').hidden=presenting;$('view-controls').hidden=!editing||!(tool==='pin'||shapePickerOpen||placementStep)||!!contextKind||inspectorOpen;$('coordinates').hidden=presenting||libraryOpen;$('timeline-panel').hidden=!timelineOpen;$('shape-picker').hidden=!shapePickerOpen||!editing;$('present-return').hidden=!presenting;
 $('scene-number').textContent=String(sceneIndex+1).padStart(2,'0');$('scene-name').textContent=scene().name;
 $('scene-picker').setAttribute('aria-expanded',String(timelineOpen));$('scene-state').textContent=sceneSaveState(store.document,scene());
 document.querySelectorAll<HTMLButtonElement>('[data-rail]').forEach(b=>{const panel=contextKind==='pointer'?'pointer-options':contextKind||(sequenceOpen&&!studioOpen&&!timelineOpen&&!beltPickerOpen&&!modesOpen&&!captureOpen&&!shapePickerOpen&&tool!=='pin'?'formation':'');const active=railPressed(b.dataset.rail!,cursorTool,panel,tool==='pin');b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.querySelectorAll('[data-action="grid"]').forEach(b=>b.classList.toggle('active',camera.grid));document.querySelectorAll('[data-action="snap"]').forEach(b=>b.classList.toggle('active',camera.snap));document.querySelectorAll('[data-action="view-2d"]').forEach(b=>b.classList.toggle('active',camera.mode==='2d'));document.querySelectorAll('[data-action="view-3d"]').forEach(b=>b.classList.toggle('active',camera.mode==='3d'));$<HTMLSelectElement>('working-plane').value=camera.plane;$<HTMLInputElement>('working-depth').value=String(camera.depth);$('depth-axis').textContent=camera.plane==='XY'?'Z':camera.plane==='XZ'?'Y':'X';
 document.querySelectorAll<HTMLButtonElement>('[data-action="undo"]').forEach(b=>{b.disabled=!store.undoStack.length||store.spanningLabel!==null;const name=historyTitle('undo',store.undoLabel());b.title=name;b.setAttribute('aria-label',name);});document.querySelectorAll<HTMLButtonElement>('[data-action="redo"]').forEach(b=>{b.disabled=!store.redoStack.length||store.spanningLabel!==null;const name=historyTitle('redo',store.redoLabel());b.title=name;b.setAttribute('aria-label',name);});
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
let sceneIntentEpoch=0,sceneAdvancePending=false,sceneTransportAlive=true;
function toggleScenePlay(){sceneIntentEpoch++;if(scenePlaying){scenePlaying=false;transportUI();return;}
 fieldPaused=false;
 const s=scene();if(journeyPlaying){journeyPlaying=false;applySceneView();}
 const fromTop=sceneElapsed<=.001||sceneElapsed>=s.duration-.001;
 if(sceneElapsed>=s.duration-.001)sceneElapsed=0;
 if(s.propertyTracks?.length)trackPreview=true;
 // Starting from the top plays ALL of the scene's automations; resuming mid-scene holds what has run.
 if(fromTop)fireAutomations(true);
 scenePlaying=true;needsFrame=true;transportUI();}
// lane-3 E24 · transport. The working-view transport (transport.ts) says how the playhead moves; scenePlaying and journeyPlaying remain
// the flags the existing playback reads, and syncWorkingTransport keeps the two in step on every frame.
function syncWorkingTransport(){
 if(workingTransport.mode==='scrub')return;
 if(scenePlaying){if(!transportPlaying(workingTransport))workingTransport={mode:'play',rate:1,resume:'play'};}
 else if(transportPlaying(workingTransport))workingTransport=STOPPED_TRANSPORT;
}
/** J or L. From a held playhead, forward starts playback as Space does; reverse holds the Scene's own clock and runs it back. */
function transportShuttle(direction:1|-1){
 sceneIntentEpoch++;
 if(!scenePlaying){
  if(direction>0)toggleScenePlay();
  else{fieldPaused=false;if(journeyPlaying){journeyPlaying=false;applySceneView();}if(scene().propertyTracks?.length)trackPreview=true;scenePlaying=true;}
 }
 workingTransport=shuttle(workingTransport,direction);
 needsFrame=true;transportUI();
}
/** K: ends a shuttle and returns to the state it began from; otherwise it pauses. */
function transportPause(){
 sceneIntentEpoch++;
 workingTransport=pauseTransport(workingTransport);
 if(transportPlaying(workingTransport))scenePlaying=true;
 else{scenePlaying=false;if(journeyPlaying){journeyPlaying=false;applySceneView();}}
 needsFrame=true;transportUI();
}
/** K held with J or L: the playhead seeks exactly one frame and the transport holds. The seek evaluates the tracks once. */
function transportFrame(direction:1|-1){
 const step=stepFrame(workingTransport,direction);
 sceneIntentEpoch++;workingTransport=step.transport;scenePlaying=false;
 if(journeyPlaying){journeyPlaying=false;applySceneView();}
 const doc=store.document,total=expressionTiming(doc,0,0).total,now=expressionTiming(doc,sceneIndex,sceneElapsed).time;
 jumpToJourneyTime(clamp(now+step.seconds,0,total));
 needsFrame=true;transportUI();
}
/** ',' and '.': the playhead jumps to the previous or next snap point (a scene start, a marker or a loop edge). */
function jumpSnap(direction:1|-1){
 const doc=store.document,now=expressionTiming(doc,sceneIndex,sceneElapsed).time;
 const points=snapCandidates({boundaries:sceneBoundaries(journeyDurations(doc)),markers:doc.markers??[],loop:doc.loopRegion});
 const target=direction>0?nextSnapPoint(points,now):prevSnapPoint(points,now);
 if(!target){toast(direction>0?'No snap point after the playhead.':'No snap point before the playhead.');return;}
 jumpToJourneyTime(target.time);renderTimeline();
}
// lane-3 E25 · the snap model. Candidates come from the document as it stands; each drag excludes the point(s) it moves.
function toggleTimelineSnap(){
 timelineSnap=!timelineSnap;if(!timelineSnap)setSnapGuide(null,0);
 toast(timelineSnap?'Timeline snapping on · Alt drags freely':'Timeline snapping off',1800);renderTimeline();
}
function snapPoints(doc:Journey,parts:{boundaries?:number[];keyframes?:{id:string;time:number}[]}={}):SnapPoint[]{
 return snapCandidates({boundaries:parts.boundaries??sceneBoundaries(journeyDurations(doc)),markers:doc.markers??[],
  playhead:expressionTiming(doc,sceneIndex,sceneElapsed).time,loop:doc.loopRegion,keyframes:parts.keyframes});
}
/** The snap indicator: a line at the snapped time on the timeline's own scale, drawn in the guides layer (drawGuides). */
function setSnapGuide(time:number|null,total:number){
 const rect=document.querySelector<HTMLElement>('.scene-track-lane')?.getBoundingClientRect();
 const x=time===null||!rect||!(rect.width>0)||!(total>0)?null:rect.left+time/total*rect.width;
 if(x===snapGuideX)return;snapGuideX=x;overlayDirty=true;needsFrame=true;
}
/** The timeline's transport and snap controls. The keys J, K, L, ',' and '.' do the same; Cmd/Ctrl+4 toggles snapping. */
/** T5: the cue for a jump held until the playing Scene ends. Nothing shows when no jump is held. */
function pendingSwitchCueHTML(){
 if(pendingAtEnd===null)return '';
 const name=store.document.scenes.find(v=>v.id===pendingAtEnd)?.name??'the next scene';
 return `<p class="pending-switch" role="status">Switch to ${esc(name)} when this scene ends.</p>`;
}
function transportBarHTML(){
 const magnet=`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 3v8a7 7 0 0 0 14 0V3h-4v8a3 3 0 0 1-6 0V3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M5 7h4M15 7h4" stroke="currentColor" stroke-width="2"/></svg>`;
 return `<div class="timeline-toolbar" role="toolbar" aria-label="Transport and snapping">`
  +`<button type="button" data-action="transport-frame-back" aria-label="Step back one frame" title="Step back one frame · K+J">◂ frame</button>`
  +`<button type="button" data-action="transport-shuttle-back" aria-label="Shuttle back" title="Shuttle back: ×1, ×2, ×4 · J">J</button>`
  +`<button type="button" data-action="transport-pause" aria-label="Pause, or return from shuttle" title="Pause, or return from shuttle · K">K</button>`
  +`<button type="button" data-action="transport-shuttle-forward" aria-label="Shuttle forward" title="Shuttle forward: ×1, ×2, ×4 · L">L</button>`
  +`<button type="button" data-action="transport-frame-forward" aria-label="Step forward one frame" title="Step forward one frame · K+L">frame ▸</button>`
  +`<span class="transport-readout" data-transport-readout>${transportReadout(workingTransport)}</span>`
  +`<button type="button" class="snap-toggle" data-action="timeline-snap" aria-pressed="${timelineSnap}" aria-label="Snap to points" title="Snap to scenes, markers, the playhead, loop and keys · Cmd/Ctrl+4. Hold Alt to drag freely.">${magnet}<span>Snap</span></button>`
  +`</div>`;
}
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
// E03 (T-E03): a Scene is addressed by its own id (bound to the native
// scene_ref through SceneBinding); sceneIndex is only the derived view. sceneRefAt
// is the one index→ref seam: it wraps an index exactly as the old setScene did,
// so previous/next, the arrow keys and transport frames keep wrap-around.
function sceneRefAt(index:number){const n=store.document.scenes.length;if(index<0)index=n-1;if(index>=n)index=0;return store.document.scenes[index].id;}
function sceneIndexOf(sceneId:string){const index=store.document.scenes.findIndex(s=>s.id===sceneId);if(index<0)throw Error('The Scene is no longer present in this Expression');return index;}
function setSceneRef(sceneId:string,automatic=false){const index=sceneIndexOf(sceneId);const outgoingLocal=sceneElapsed;if(index!==sceneIndex&&switchHoldsForEnd(store.document.scenes[index].transitionSpec,automatic,scenePlaying)){pendingAtEnd=sceneId;renderAll();return;}if(!automatic)pendingAtEnd=null;draftSchedule.flushNow('scene');if(!automatic)sceneIntentEpoch++;if(propertyTake)finishPropertyTake();trackPreview=false;pointer.active=false;if(index===sceneIndex&&!automatic)return;
 if(scenePlaying&&store.document.scenes[index].transition>0&&engine.capabilities.kind==='preview'&&transitionKindOf(store.document.scenes[index].transitionSpec)==='crossfade'){startCrossfadeSeam(store.document.scenes[index],scene().field.background);}else if(scenePlaying&&store.document.scenes[index].transition>0&&engine.capabilities.kind==='preview'&&transitionKindOf(store.document.scenes[index].transitionSpec)!=='cut'){startPaintedSeam(store.document.scenes[index]);}else{transitionDuration=0;transitionSnapshot=null;$('transition-canvas').hidden=true;}

 sceneIndex=index;journeyInstrument?.recordPosition(sceneId); // T9: the strip's Scene is the author's presence, through the presence owner.
 if(!automatic)journeyPlaying=false;applySceneView();sceneElapsed=automatic?0:switchLanding(store.document.scenes[index].transitionSpec,outgoingLocal,store.document.scenes[index].duration);selected=[];textId=scene().text[0]?.id??null;saveSession();placementStep=false;shapePickerOpen=false;if(!automatic)journeyPlaying=false;renderAll();void researchInstruments?.refresh();}
/** Saved playback uses the existing frame playhead; native location changes
 * wait for its exact owner acknowledgement before the next Scene is rendered. */
async function advanceSavedScene(index:number,local=0){if(sceneAdvancePending||!sceneTransportAlive)return;const view=nativeWorkspace?.nativeView(),target=store.document.scenes[index],targetRef=target&&view?.bindings[target.id]?.scene_ref;
 if(!view){setSceneRef(sceneRefAt(index),true);sceneElapsed=local;fireAutomations(true);return;}
 if(!targetRef){scenePlaying=false;journeyPlaying=false;toast('The next saved Scene has no native occurrence basis.');renderAll();return;}
 const originalId=scene().id,version=store.revision,intent=sceneIntentEpoch;sceneAdvancePending=true;scenePlaying=false;
 try{if(await nativeWorkspace!.select(target.id,null)!=='applied')throw Error('Saved Scene transition was superseded or refused by the native owner');
  const next=nativeWorkspace?.nativeView();if(!sceneTransportAlive||!next||store.transactionOpen||scene().id!==originalId||store.revision!==version||sceneIntentEpoch!==intent||!journeyPlaying
   ||next.document.expression_ref!==view.document.expression_ref||next.document.revision<view.document.revision||next.document.revision>view.document.revision+1
   ||next.document.selection?.scene_ref!==targetRef||next.document.selection.entity_ref!==null)throw Error('New work arrived during the saved Scene transition; its current target was retained');
  sceneIntentEpoch++;scenePlaying=true;setSceneRef(target.id,true);sceneElapsed=local;fireAutomations(true);
 }catch(cause){if(!sceneTransportAlive)return;if(sceneIntentEpoch===intent&&scene().id===originalId){scenePlaying=false;journeyPlaying=false;applySceneView();}toast(cause instanceof Error?cause.message:String(cause));renderAll();}
 finally{sceneAdvancePending=false;}
}
function setSavedScenePlay(playing:boolean){sceneIntentEpoch++;journeyPlaying=playing;if(journeyPlaying){fieldPaused=false;scenePlaying=true;editing=false;inspectorOpen=false;timelineOpen=false;selected=[];cursorTool='interact';tool='interact';shapePickerOpen=false;placementStep=false;if(!store.document.savedScenes?.[scene().id])sceneIndex=savedSceneIndices(store.document)[0];sceneElapsed=0;fireAutomations(true);
  // E13b: say, once at the start, when the brace does not play as drawn in saved scenes.
  const doc=store.document,notice=loopPlayNotice(journeyDurations(doc),playClockDurations(true),doc.loopRegion);if(notice)toast(notice,6500);}
 applySceneView();renderAll();}
function seekWorkingScene(seconds:number){sceneIntentEpoch++;sceneElapsed=seconds;trackPreview=true;scenePlaying=false;journeyPlaying=false;applySceneView();needsFrame=true;transportUI();syncDeepLinkAddress();}
function snapshotScene(input:{action:'save-snapshot';name:string;next:boolean}|{action:'restore-snapshot'}){const s=scene();sceneIntentEpoch++;if(input.action==='restore-snapshot'){sceneNames.delete(s.id);changed(()=>{if(!restoreScene(store.document,s.id))throw Error('This Scene has no saved snapshot');},true,'Restore scene snapshot');return;}
 changed(()=>{s.view={...s.view,mode:camera.mode,yaw:camera.yaw,pitch:camera.pitch,zoom:camera.zoom,panX:camera.panX/width,panY:camera.panY/height};delete s.view.nativeCamera;saveScene(store.document,s,input.name);sceneNames.delete(s.id);if(input.next){const next=nextSceneFrom(store.document,s);sceneIndex=store.document.scenes.indexOf(next);selected=[];stepIndex=0;sceneElapsed=0;}},true,'Save scene snapshot');}
// ——— E21 (SC-6) scene → source → subject, with back-references. Source and subject reveal through the two summons the
// research host already sends (inspectSubject, showInGraph); the back-reference reads this Expression's own bindings
// (occurrencesOfSubject). No second index. ———
// lane-2 T19b: the evidence a Timeline event carries to its source, reduced to the bounded shape the shell reads. The shell proves a
// passage again against the file's revision; a shape this cannot carry returns undefined and is named by the caller.
function sourceEvidenceCarry(value:unknown):Record<string,unknown>|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
 const row=value as Record<string,unknown>;
 const text=(item:unknown,max:number):string|undefined=>typeof item==='string'&&item.length>0&&item.length<=max&&!/[\u0000-\u001f\u007f]/.test(item)?item:undefined;
 const integer=(item:unknown):boolean=>Number.isSafeInteger(item)&&(item as number)>=0;
 const finite=(item:unknown):boolean=>typeof item==='number'&&Number.isFinite(item);
 if(row.state==='top'||row.state==='absent'){const reason=text(row.reason,512);return reason?{state:row.state as string,reason}:undefined;}
 if(row.state!=='passage')return undefined;
 const source=text(row.source_ref,2048),sel=row.selector;
 if(!source||!sel||typeof sel!=='object'||Array.isArray(sel))return undefined;
 const s=sel as Record<string,unknown>;
 if(s.unit==='text_span'&&integer(s.start)&&integer(s.end)&&(s.start as number)<=(s.end as number))return {state:'passage',source_ref:source,selector:{unit:'text_span',start:s.start,end:s.end}};
 if(s.unit==='timestamp_range'){const from=text(s.from,64),to=text(s.to,64);return from&&to?{state:'passage',source_ref:source,selector:{unit:'timestamp_range',from,to}}:undefined;}
 if(s.unit==='image_region'&&finite(s.x)&&finite(s.y)&&finite(s.width)&&finite(s.height))return {state:'passage',source_ref:source,selector:{unit:'image_region',x:s.x,y:s.y,width:s.width,height:s.height}};
 return undefined;
}
function summonSource(ref:string,context?:{node?:unknown;relationField?:unknown;anchor?:unknown}){const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];if(!view||!binding){toast('Open a native Scene before opening its source.');return;}
 // The passage an event discloses is carried only in the shape above; a malformed one is named here and the source opens at its top.
 const evidence=context?.anchor===undefined?undefined:sourceEvidenceCarry(context.anchor);
 if(context?.anchor!==undefined&&!evidence)toast('The passage this event discloses is malformed; its source opens at its top.');
 const carried=context?{node:context.node,relationField:context.relationField,...(evidence?{anchor:evidence}:{})}:undefined;
 hostRequest({request:'summon',detail:{kind:'source',ref,context:carried,subject:{ref:view.document.expression_ref,kind:'expression',nativeOwner:'oi',revision:view.document.revision,title:view.document.title,sceneRef:binding.scene_ref,entityRef:null,relationRef:null}}});}
function summonGraph(subjectRef:string,nativeOwner:string){const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];if(!view||!binding){toast('Open a native Scene before showing its subject in the graph.');return;}hostRequest({request:'summon',detail:{kind:'graph',subject:{ref:subjectRef,nativeOwner,kind:'subject',revision:view.document.revision,title:view.document.title,sceneRef:binding.scene_ref,entityRef:null,relationRef:null} as unknown as NativeSubject}});}
/** The selected occurrence, when exactly one bound entity is selected in the open Scene. */
function selectedOccurrence(){const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];if(!view||!binding||selected.length!==1)return null;const occurrence=binding.occurrences.find(o=>o.view_entity_id===selected[0]);return occurrence?{view,occurrence}:null;}
/** Where the selected occurrence's subject stands in the open Expression: its occurrences, scene by scene. */
/** E21 projection side: the basis a selected occurrence stands on (its subject, and the open Expression at its revision). */
function standingBasisOf(found:NonNullable<ReturnType<typeof selectedOccurrence>>):WikiStandingBasis|null{
 const subject=found.occurrence.subject?.subject_ref;if(!subject)return null;
 return {subject_ref:subject,expression_ref:found.view.document.expression_ref,revision:found.view.document.revision};
}
/** E21: the wiki standing of the selected subject is the owner's reading, asked through one typed host request (libraryStanding.ts).
 * A reply for another Expression, revision or subject is dropped; a refusal is named once, in the toast, for the basis that stands. */
const wikiStanding=createWikiStandingClient({
 post:message=>{if(window.parent===window)return false;try{window.parent.postMessage(message,'*');return true;}catch{return false;}},
 current:()=>{const found=selectedOccurrence();return found?standingBasisOf(found):null;},
 settle:({basis,state})=>{
  const found=selectedOccurrence(),now=found?standingBasisOf(found):null;
  if(state.state==='refused'&&now&&now.subject_ref===basis.subject_ref&&now.expression_ref===basis.expression_ref&&now.revision===basis.revision)toast(`Where it stands: ${state.reason}`,7000);
  if(libraryOpen)renderLibrary();
 },
});
window.addEventListener('message',event=>{if(event.source===window.parent)wikiStanding.receive(event.data);});
/** Where the selected occurrence's subject stands: its occurrences in this Expression (read here), and its wiki standing (read by the owner). */
function subjectStandingFor():LibraryStanding|undefined{
 const found=selectedOccurrence(),subject=found?.occurrence.subject?.subject_ref;if(!found||!subject)return undefined;
 const native:LibraryStanding['rows']=occurrencesOfSubject(found.view,subject).map(o=>({kind:'scene' as const,title:`${o.entity_title} · ${o.scene_title}`,detail:o.scene_ref,scene_ref:o.scene_ref,entity_ref:o.entity_ref,view_entity_id:o.view_entity_id,subject_ref:subject}));
 const basis=standingBasisOf(found),projected:WikiStandingState|undefined=basis?wikiStanding.ensure(basis):undefined;
 if(projected?.state==='read')return {subject,projection:'read',rows:[...native,...projected.rows]};
 return {subject,projection:'unread',rows:native};
}
/** The reveal family for one selected occurrence: source, subject and where it stands share one menu and one grammar. */
/** The native owner a subject is disclosed under in the selected occurrence. Refused by name when none is disclosed; never 'wiki' by default. */
function disclosedOwnerOrRefuse(subjectRef:string):string{const verdict=disclosedOwnerOf(selectedOccurrence()?.occurrence.subject,subjectRef);if('refused' in verdict)throw Error(verdict.refused);return verdict.owner;}
function revealHTML():string{const found=selectedOccurrence(),subject=found?.occurrence.subject;if(!found||!subject)return '';const ref=esc(subject.subject_ref);return `<section class="reveal-group" data-scope="reveal" aria-label="Reveal this occurrence"><button type="button" data-action="reveal-source" data-subject="${ref}">${icon('arrowRight')}<span>Source</span></button><button type="button" data-action="reveal-subject" data-subject="${ref}" data-owner="${esc(subject.native_owner)}">${icon('arrowRight')}<span>Subject</span></button><button type="button" data-action="reveal-stands" data-subject="${ref}">${icon('search')}<span>Where it stands</span></button></section>`;}
/** A back-reference row jumps: a native occurrence through the kernel focus and the binding selection; a wiki
 * projection through the graph summon that opens its owning register. */
async function jumpToStanding(el:HTMLElement){
 if(el.dataset.kind==='projection'){const subject=el.dataset.subject??'';summonGraph(subject,disclosedOwnerOrRefuse(subject));return;}
 const sceneRef=el.dataset.scene??'',viewId=el.dataset.viewEntity??'',view=nativeWorkspace?.nativeView();
 const sceneId=view?Object.entries(view.bindings).find(([,binding])=>binding.scene_ref===sceneRef)?.[0]:undefined;
 if(!sceneId)throw Error('That Scene is no longer in the open Expression.');
 await focusNativeSceneRef(sceneRef);
 await nativeWorkspace?.select(sceneId,viewId);
 closeLibrary();
 if(scene().id!==sceneId)toast('Scene focused. Select the occurrence on the stage.');
}
// ——— E26 collections as bins: the kernel's own index is the one reading; assignment is the existing collections_set
// change through the one save path, labelled for undo. ———
// undefined = not yet read (nothing stated); null = the read failed or was malformed (stated in the Library).
let collectionBins:CollectionBins|null|undefined=undefined;
/** E26: the bin choice on the Library page. A view state only: the data is re-read, never stored. */
let libraryCollectionFilter:CollectionFilter={kind:'all'};
/** The kernel's collections, read live; the Library redraws when the reading lands. */
function refreshCollections(){void nativeExpressionRequest({operation:'index'}).then(index=>{collectionBins=collectionBinsOf(index,nativeWorkspace?.nativeView()?.document.expression_ref);}).catch(()=>{collectionBins=null;}).finally(()=>{if(libraryOpen)renderLibrary();});}
async function assignCollections(el:HTMLElement){
 const picker=el.closest<HTMLElement>('[data-scope="collection-picker"]'),view=nativeWorkspace?.nativeView();
 if(!picker||!view)throw Error('Open the native Expression before assigning its collections.');
 if(picker.dataset.expression!==view.document.expression_ref)throw Error('The open Expression changed; reopen the Library to assign.');
 const chosen=[...picker.querySelectorAll<HTMLInputElement>('input[name="collection"]:checked')].map(input=>input.value);
 const next=collectionsWith(chosen,picker.querySelector<HTMLInputElement>('input[name="new-collection"]')?.value??'');
 if(JSON.stringify(next)===JSON.stringify(collectionsWith(view.document.collections??[],'')))return toast('Collections are unchanged.');
 await nativeWorkspace!.edit(()=>[{change:'collections_set',collections:next}],'Set collections');
 refreshCollections();
 toast(next.length?`Collections: ${next.join(', ')}`:'Removed from every collection.');
}
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
/** The Hold and Transition inputs of the timeline panel set the scene's own timeline facts; they are named as such in Undo. */
function sceneTimingLabel(path:string):string|undefined{return path==='duration'?'Hold':path==='transition'?'Transition':undefined;}
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
 if(path.startsWith('lane.')&&key==='syncWith'){changed(()=>linkAutomation(scene().automation,root.id,String(value)),true,'Link automation');return;}store.begin(bindingEditLabel(sceneTimingLabel(path)??PARAMETERS.find(p=>p.bind===path)?.label));store.touch();const fieldBinding=NATIVE_BINDINGS.find(b=>b.bind===path);const automationPath=fieldBinding?'field.'+fieldBinding.key:path.startsWith('field.params.')?'field.'+path.slice(13):path.startsWith('entity.')?entityTargets(scene()).find(t=>t.entityId===subject?.id&&t.bind===path)?.target:undefined;const evaluated=engine.telemetry?.();const previous=Number(el.dataset.liveEditValue??liveValue(scene(),path,subject?.id,evaluated?.params??scene().field.params,evaluated?.config)??el.dataset.originalValue);const shifted=!isShared(store.document,scene(),path)&&automationPath&&Number.isFinite(previous)&&offsetAutomatedTarget(scene().automation,automationPath,Number(value)-previous);if(shifted)el.dataset.liveEditValue=String(value);else if(path==='duration'||path==='transition')retimeScene(store.document,scene().id,path==='duration'?{duration:value}:{transition:value});else if(!writeShared(store.document,scene(),path,value))target[key]=value;if(subject&&path.startsWith('entity.')&&!shifted)transformObjectStates(subject,path,priorValue,value);el.dataset.originalValue=el.value;if(path==='field.params.native_composition__orchestration__focusTintWeight'&&Number(value)>0)scene().composition.carryTint=true;
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
/** T-REVIEW-6: reads the quarantined drafts for the Library section. The section fills when the read lands; a message names the last restore's outcome. */
function refreshQuarantine(message?:string){void quarantineView().then(view=>{quarantineState={rows:view.rows,unreadable:view.unreadable,message};if(libraryOpen)renderLibrary();}).catch(()=>undefined);}
// E19: the native owner's kept drafts for the open Expression, listed beside the browser quarantine. A listing carries the address it was read
// from, so Restore and Remove always act on the listing the person saw.
type OwnerListing={address:{expressionRef:string;scope:'expressions'|'techne'};rows:ReturnType<typeof ownerQuarantineRows>;message?:string;error?:string};
let ownerListing:OwnerListing|null=null;
let ownerListingPending=false;
function refreshOwnerQuarantine(message?:string){
 const address=nativeWorkspace?.ownerQuarantineAddress()??null;
 if(!address){ownerListing=null;if(libraryOpen)renderLibrary();return;}
 ownerListingPending=true;
 void listOwnerQuarantine(address.expressionRef,address.scope)
  .then(reading=>{ownerListing={address,rows:ownerQuarantineRows(reading.entries),message,...(reading.unreadable!==undefined?{error:`The native owner cannot read the kept drafts of this Expression, so none are listed and none were removed or overwritten. ${reading.unreadable}`}:{})};})
  .catch(cause=>{ownerListing={address,rows:[],error:`The native owner could not read the kept drafts of this Expression. ${cause instanceof Error?cause.message:String(cause)}`};})
  .finally(()=>{ownerListingPending=false;if(libraryOpen)renderLibrary();});
}
/** The owner section for the Library, or nothing when no native Expression is open. A listing for another Expression is read again first, never shown. */
function ownerQuarantineView():OwnerQuarantineSection|undefined{
 const address=nativeWorkspace?.ownerQuarantineAddress()??null;
 if(!address)return undefined;
 if(!ownerListing||ownerListing.address.expressionRef!==address.expressionRef||ownerListing.address.scope!==address.scope){if(!ownerListingPending)refreshOwnerQuarantine();return undefined;}
 return {rows:ownerListing.rows,message:ownerListing.message,error:ownerListing.error};
}
function renderLibrary(){coverObserver?.disconnect();const {read:library,origins}=readLibraryWithOrigins(),scroll=$('library-page').scrollTop;const saved=Array.from(new Map([...library.journeys,...sessionExpressions.values()].map(j=>[j.id,j])).values());
 $('library-page').innerHTML=libraryHTML({current:store.document,saved,featured,starters,section:librarySection,errors:library.blocked?['Browser storage is unavailable here. Export an expression to keep a portable copy.']:library.errors,legacy:hasLegacyLibrary(),quarantine:quarantineState,ownerQuarantine:ownerQuarantineView(),standing:subjectStandingFor(),bins:collectionBins,collectionFilter:libraryCollectionFilter,cover:j=>covers.get(j.id)});$('library-page').scrollTop=scroll;
 // T22: each saved card names its origin: a kernel copy by its ref, browser work in the draft wording the save status already uses.
 for(const button of $('library-page').querySelectorAll<HTMLButtonElement>('button[data-action="load-saved"][data-id]')){
  const id=button.dataset.id!;
  const origin=origins.get(id),bound=id===store.document.id?kernelOriginFor(store.document):undefined;
  decorateLibraryCard(button,id,libraryCardStanding(origin,bound));
 }
 const documents=new Map([...featured,...saved,store.document,...starters.map(p=>p.expression)].map(j=>[j.id,j]));
 const paint=(image:HTMLImageElement)=>{const j=documents.get(image.dataset.previewId!);if(j){image.src=compositionCover(j.scenes[0]);image.removeAttribute('data-preview-id');}};
 const images=$('library-page').querySelectorAll<HTMLImageElement>('img[data-preview-id]');
 if(typeof IntersectionObserver==='undefined')images.forEach(paint);
 else{coverObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){paint(entry.target as HTMLImageElement);coverObserver?.unobserve(entry.target);}},{root:$('library-page'),rootMargin:'160px'});images.forEach(image=>coverObserver!.observe(image));}
}
function openLibrary(section:'collection'|'about'='collection',navigate=true){if(propertyTake)finishPropertyTake();
 wikiStanding.begin(); // E21: a refusal is not kept across opens; each subject is asked once more in this open.
 if(!libraryOpen)rememberCover();
 pointer.active=false;modesOpen=false;captureOpen=false;librarySection=section;libraryOpen=true;refreshQuarantine();refreshOwnerQuarantine();refreshCollections();
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
let privateFormReading:NativeM3Reading|null=null;
let sceneBodies:ReturnType<typeof installSceneBodies>|undefined;
let blueprintHUD:ReturnType<typeof installBlueprintHUD>|undefined;
// Studio-owned homes for instrument controls (re-parented, never re-rendered).
const blueprintHome=document.createElement('div');blueprintHome.className='blueprint-home';
const palaceHome=document.createElement('div');palaceHome.className='palace-home';
const journeyHome=document.createElement('div');journeyHome.className='journey-reading-home';journeyHome.hidden=true;$('app').append(journeyHome);
const placesHome=document.createElement('div');placesHome.className='places-home';
const canvasHome=document.createElement('div');canvasHome.className='canvas-home';
// A blank boot frame is not a new chosen work. Retain the host's native
// reference until recovery succeeds or the user explicitly opens a draft.
let awaitingNativeBoot=startsWithNativeReference;
let researchInstruments:ReturnType<typeof installResearchInstruments>|undefined;
let journeyInstrument:ReturnType<typeof installJourneyInstrument>|undefined;
let journeyPositionRestored=false; // T9: the saved journey Scene is reopened once per page, from the first native load that can read it.
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
 if(!deletedLibraryIds.has(previous.id)&&!recoveryOfferOpen)await persistDraft(previous);
 if(generation!==journeyNavigation||version!==store.revision)throw new Error('The open request was superseded by newer work. Your current Expression was retained.');
 applyJourney(j);
 // A successful explicit open is the person's entry into the instrument.
 // Keep the gate and departing work intact if backup or navigation fails.
 closeEntryGate();
}
/** T22: the origin a document records when the native workspace holds it as its own journey (the same id): its kernel ref. Undefined for
 * browser-local work, so a Library write that names no origin keeps the origin the entry already records. */
function kernelOriginFor(journey:Journey):LibraryOrigin|undefined{
 const view=nativeWorkspace?.nativeView();
 if(!view||view.journey.id!==journey.id||!view.document.expression_ref.startsWith('expression:'))return undefined;
 return {kind:'kernel-ref',ref:view.document.expression_ref};
}
/** Opens a kernel copy through the boot's own follow path. A refusal is named, and `fallback` (the browser copy) then opens. */
function openKernelCopy(ref:string,fallback?:()=>void,recovery?:unknown){
 const refused=()=>{toast(kernelCopyRefusalMessage(!!fallback),7000);fallback?.();};
 void Promise.resolve(nativeWorkspace?.follow(ref,recovery)).then(applied=>{if(applied!==true)refused();},refused);
}
/** The browser copy a kernel ref falls back to when the kernel refuses it: the Library entry that holds the ref (libraryCards.localCopyIdFor). */
function localCopyFallbackFor(ref:string):(()=>void)|undefined{
 const {read,origins}=readLibraryWithOrigins(),id=localCopyIdFor(ref,origins),copy=id===undefined?undefined:read.journeys.find(j=>j.id===id);
 return copy?()=>{void loadJourney(copy)}:undefined;
}
/** Opens a browser-local document by its id: the in-frame Library's open, and the host command `open-local-draft`. */
async function openBrowserDraft(id:string){
 const j=store.document.id===id?store.document:sessionExpressions.get(id)??readLibrary().find(j=>j.id===id);
 if(j)await loadJourney(j);
}
function kernelScratchShows(){return kernelScratchId!==null&&kernelScratchId===store.document.id;}
/** T22: the first kernel save of a browser-local document. The kernel document it created has its own id, so the local entry is not
 * flipped; its Library entry records the kernel document beside its local origin. A save of an already-bound document records nothing. */
function recordAdoptionAfterSave(localId:string,wasBound:boolean){
 if(wasBound)return;
 const view=nativeWorkspace?.nativeView();
 if(!view||view.journey.id===localId||!view.document.expression_ref.startsWith('expression:'))return;
 const adoption={ref:view.document.expression_ref,title:view.document.title,at:new Date().toISOString()};
 try{if(!recordLibraryAdoption(localId,adoption)&&store.document.id===localId)saveToLibrary(store.document,adoptedLocalOrigin(adoption));}catch{/* The link is recorded again by the next save. */}
}
function applyJourney(j:Journey,native=false,adoptionHistory:'record'|'acknowledge'='record',acknowledgement:'preserve'|'retire'='preserve'){journeyNavigation++;if(native)kernelScratchId=null;if(!native){awaitingNativeBoot=false;void nativeWorkspace?.changed(j);}if(propertyTake)finishPropertyTake();trackPreview=false;rememberWork(j.id);studioOpen=false;j.scenes.forEach(checkNativeLimits);sessionExpressions.set(store.document.id,clone(store.document));sessionExpressions.set(j.id,clone(j));try{if(!deletedLibraryIds.has(store.document.id))saveToLibrary(store.document,kernelOriginFor(store.document));}catch{toast('The previous expression is retained in Undo; browser storage is unavailable. Export it before closing this page.',6500);}if(native&&adoptionHistory==='acknowledge'&&store.document.id===j.id)store.acknowledge(initialiseSceneSaves(initialiseBelts(j)),acknowledgement);else store.change('Open expression',()=>{store.document=clone(initialiseSceneSaves(initialiseBelts(j)));});store.document.updatedAt=j.updatedAt;sceneIndex=0;selected=[];camera=defaultCamera();applySceneView();transitionDuration=0;$('transition-canvas').hidden=true;sceneElapsed=0;journeyPlaying=false;editing=false;inspectorOpen=false;timelineOpen=false;cursorTool='interact';tool='interact';railKey='interact';railExpanded=false;shapePickerOpen=false;closeDialogs();libraryOpen=false;modesOpen=false;try{history.replaceState(null,'',location.pathname+location.search);}catch{}markSaved();renderAll();}
function openKeep(){captureOpen=!captureOpen;modesOpen=false;pointer.active=false;
 if(captureOpen){inspectorOpen=false;contextKind='';timelineOpen=false;beltPickerOpen=false;shapePickerOpen=false;}renderAll();}
function renderImageSuite(){sourceEditorEpoch++;readCapture();if(!selectedEntity()){const e=scene().entities.find(e=>e.kind==='formation');if(e)selected=[e.id];} $('capture-panel').innerHTML=`<header><h3>Image suite</h3>${ib('capture-options','close','Close image suite')}</header>${imageSuiteHTML(scene(),selected[0],stepIndex)}<details class="image-output"><summary>Capture output settings</summary><div class="two-col"><label class="control"><span>Output size</span><select id="capture-width"><option value="1280">1280</option><option value="1440">1440</option><option value="1920">1920</option><option value="3840">3840 · PNG</option></select></label><label class="control"><span>Frame</span><select id="capture-aspect"><option value="stage">Current stage</option><option value="16:9">16:9</option><option value="1:1">1:1</option><option value="9:16">9:16</option></select></label></div><label class="toggle-row"><span>Include page text</span><input id="capture-text" type="checkbox" ${captureSettings.includeText?'checked':''}><i></i></label><label class="toggle-row"><span>Transparent PNG</span><input id="capture-transparent" type="checkbox" ${captureSettings.transparent?'checked':''}><i></i></label><p class="control-note">Clean artwork only. Aspect changes centre-crop the current view. Silent live video requests 30 fps; 2-minute / 128 MB limit.</p></details>`;
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
function captureTransition():CaptureTransition|undefined{if(engine.capabilities.kind==='production')return undefined;if(!(transitionDuration>0))return undefined;
 // E11: a painted seam already holds its whole blend on the transition canvas, so the recorder composites it at full alpha.
 if(transitionKind!=='crossfade')return {canvas:$<HTMLCanvasElement>('transition-canvas'),alpha:1,background:transitionBackground,painted:true};
 const progress=clamp((simTime-transitionStart)/Math.max(.01,transitionDuration),0,1);
 return {canvas:$<HTMLCanvasElement>('transition-canvas'),alpha:1-(transitionCurveNow?curveProgress(transitionCurveNow,progress):progress),background:transitionBackground};}
async function captureImage(){readCapture();engine.render(frameData(0));const out=createOutput(captureSettings,width,height);if(!engine.capture)throw new Error('This renderer does not support native-resolution capture.');const pixels=engine.capture(out.width,out.height);paintNativeCapture(out,pixels,{...scene(),field:{...scene().field,background:engine.telemetry?.()?.background??scene().field.background,palette:engine.telemetry?.()?.palette??scene().field.palette,params:{...scene().field.params,...engine.telemetry?.()?.params}}},captureSettings,width,height);const blob=await png(out),name=slug(scene().name)+'.png';if(await saveDesktopCapture(blob,name,desktopSource(),{...captureSettings,width:out.width,height:out.height}))toast('Image saved to the Physis library.');else{download(blob,name);toast(`Captured ${out.width} × ${out.height} native pixels, without resetting the field.`);}}
function startRecording(){if(recorder.active){recorder.stop();return;}recordingSource=desktopSource();readCapture();captureSettings.width=Math.min(captureSettings.width,engine.canvas.width,1920);recordingSettings={...captureSettings};recordPerformanceWarned=false;if(fieldPaused){fieldPaused=false;renderAll();}const start=()=>recorder.start(engine.canvas,scene(),captureSettings,width,height,captureTransition());if(engine.withCleanFrame)engine.withCleanFrame(start);else start();closeDialogs();captureOpen=false;renderAll();$('recording-badge').hidden=false;$('record-size').textContent=`${captureSettings.width}px · 30 fps target`;toast('Recording the clean scene. Perform, play the expression, then stop.',3300);}
recorder.onStop=(blob,mime)=>{transportUI();announceHostState();$('recording-badge').hidden=true;if(currentVideo)URL.revokeObjectURL(currentVideo.url);currentVideo={blob,mime,url:URL.createObjectURL(blob),source:recordingSource??desktopSource(),settings:recordingSettings??captureSettings};$('video-dialog').innerHTML=`${modalCloseButton()}<p class="eyebrow">A PERFORMANCE, KEPT</p><h2>Let it play<br><em>once more.</em></h2><video id="recording-review" preload="auto" controls playsinline style="width:100%;border-radius:8px" src="${currentVideo.url}"></video><p class="capture-footnote">${mime.split(';')[0]} · ${(blob.size/1024/1024).toFixed(1)} MB · silent live capture</p><div class="button-row"><button class="primary" data-action="save-video">${icon('download')} Save recording</button><button class="secondary" data-action="close-dialog">Return to the field</button></div>`;$<HTMLDialogElement>('video-dialog').showModal();};recorder.onError=err=>{transportUI();announceHostState();$('recording-badge').hidden=true;error(err);};recorder.onLimit=m=>toast(m,6500);
function addLane(target='field.dispersion',syncWith?:string){if(!target.startsWith('field.')&&!target.startsWith('entity:'))target='field.'+target;const p=automationTarget(scene(),target);if(!p||!Number.isFinite(p.value))return;editing=true;inspectorOpen=true;tab='motion';motionTab='automation';if(scene().automation.some(l=>l.target===target)){renderAll();return;}
 const newId=uid('lane');detailState.set('automation-'+(syncWith??newId),true);const span=(p.max-p.min)*.1,low=clamp(p.value-span,p.hardMin,p.hardMax),high=clamp(p.value+span,p.hardMin,p.hardMax);
 changed(()=>{scene().automation.push({id:newId,...(syncWith?{syncWith}:{}),enabled:true,target,type:'lfo',wave:'sine',min:low,max:high,rate:.08,phase:0,blend:'replace',duration:4,delay:0,loop:'once',firedAt:null});if(target==='field.frequency')scene().composition.frequencyDriver='automation';},true,'Add automation lane');}
function duplicateEntity(){const list=scene().entities.filter(e=>selected.includes(e.id));if(!list.length)return;changed(()=>{selected=list.map(e=>{const n=clone(e);n.id=uid('entity');n.name+=' copy';n.position.x+=.12;n.position.y-=.12;n.locked=false;n.sequence.steps.forEach(k=>k.id=uid('step'));scene().entities.push(n);return n.id;});},true,'Duplicate objects');}
function deleteEntities(){if(selected.some(id=>blueprintMember(scene(),id))){toast('Release the blueprint before removing one of its members.');return;}const ids=selected.filter(id=>!scene().entities.find(e=>e.id===id)?.locked);if(!ids.length){toast('Unlock a selected entity before removing it.');return;}let prunedLanes=false;changed(()=>{scene().entities=scene().entities.filter(e=>!ids.includes(e.id));selected=[];for(const id of ids)pruneResearchOccurrence(scene(),id);prunedLanes=pruneAutomation(scene());},true,'Delete objects');toast('Removed. Undo restores the configuration.'+(prunedLanes?' Its automation lanes without a remaining target were removed with it.':''));}
/** E02b/E03: a scene is moved by its ref; the guarded model op refuses any move that would change a Scene's content. */
function reorderScene(sceneId:string,to:number){if(to<0||to>=store.document.scenes.length)return;const currentId=scene().id;changed(()=>{moveScene(store.document,sceneId,to);sceneIndex=store.document.scenes.findIndex(s=>s.id===currentId);},true,'Reorder scenes');}
// E14 nested expression occurrence (lane-3 TARGET-SET E14). The occurrence is the
// kernel's expression_ref Scene body; each write is one native edit. The nested
// documents are read through the workspace's kernel read (nativeWorkspace.readNested),
// the verdict comes from the bridge, and playback is the nested Expression's own
// Scenes at their own times through this same frame path. Nothing is stored beside
// the kernel.
function nestedBodyOf(sceneId:string):unknown{return nativeWorkspace?.nativeView()?.bindings[sceneId]?.body??null;}
function nestedBindingOf(sceneId:string):NestedBinding|null{return nativeWorkspace?.nativeView()?.bindings[sceneId]?.nested??null;}
/** The nested Expression converted exactly as it is converted when it is open on
 * its own. The conversion is memoised per document object; its verdicts are
 * derived from the workspace's current graph on each use. */
const nestedConversions=new WeakMap<object,KernelConversion|null>();
function nestedConversionOf(ref:string):KernelConversion|null{
 const doc=nativeWorkspace?.nestedDocument(ref);
 if(!doc)return null;
 let base=nestedConversions.get(doc);
 if(base===undefined){try{base=kernelDocumentToJourney(doc);}catch{base=null;}nestedConversions.set(doc,base);}
 return base?withNestedVerdicts(base,nativeWorkspace!.nestedGraph()):null;
}
/** A seam at one nesting level: the entering and leaving Scenes of that level, and the boundary it began at. */
interface NestedSeamAt {seam:NestedSeam;incoming:Scene;outgoing:Scene;boundary:string}
type NestedPlayback={kind:'scene';scene:Scene;local:number;revision:number;seams:NestedSeamAt[];key:string}|{kind:'paper';notice:string|null;seams:NestedSeamAt[];key:null};
/** Playback of an occurrence at host-local time `t`. The nested Expression plays at its own time through its own Scenes;
 * an occurrence nested inside it plays the same way, at the depth its own bound admits. Each level reports the seam in
 * flight in its own Scenes, by the app's own rule. */
function nestedPlayback(subjectRef:string,verdict:NestedBinding|null,hostDuration:number,t:number):NestedPlayback{
 const conversion=nestedConversionOf(subjectRef);
 const scenes=conversion?.journey.scenes??[];
 const frame=nestedFrameAt(t,hostDuration,scenes.map(s=>s.duration),conversion?verdict:{subject_ref:subjectRef,max_depth:0,state:'unread',reason:`Nested expression ${subjectRef} is not read yet.`});
 if(frame.kind!=='scene')return {kind:'paper',notice:nestedNotice(frame),seams:[],key:null};
 const scene=scenes[frame.sceneIndex],inner=conversion!.bindings[scene.id];
 const boundary=nestedBoundaryKey(subjectRef,frame.sceneIndex,t,frame.local);
 const seam=nestedSeamAt(scenes.map(s=>({duration:s.duration,transition:s.transition??0,kind:transitionKindOf(s.transitionSpec)})),frame.sceneIndex,frame.local);
 const own:NestedSeamAt[]=seam?[{seam,incoming:scene,outgoing:scenes[seam.outgoing],boundary}]:[];
 if(inner&&isNestedBody(inner.body)){
  const deeper=nestedPlayback(inner.body.subject_ref,inner.nested??null,scene.duration,frame.local);
  return {...deeper,seams:[...own,...deeper.seams]};
 }
 return {kind:'scene',scene,local:frame.local,revision:nativeWorkspace?.nestedDocument(subjectRef)?.revision??0,seams:own,key:boundary};
}
function setNestedNotice(text:string|null):void{
 let el=document.getElementById('nested-stage-notice');
 if(!el){el=document.createElement('p');el.id='nested-stage-notice';el.setAttribute('role','status');el.hidden=true;document.body.append(el);}
 if(el.hidden===!text&&el.textContent===(text??''))return;
 el.textContent=text??'';el.hidden=!text;
}
/** Start the seam an occurrence crossed, through the overlay the app always had: a crossfade holds the outgoing frame, a
 * painted kind composes its blend. The overlay's clock is set to the boundary, so its progress is the nested time. */
function startNestedSeam(at:NestedSeamAt):void{
 const mode=nestedSeamMode(at.seam.kind);
 if(mode==='none')return;
 if(mode==='crossfade')startCrossfadeSeam(at.incoming,at.outgoing.field.background);
 else startPaintedSeam(at.incoming);
 transitionStart=simTime-at.seam.elapsed;
}
function clearNestedOverlay():void{
 transitionDuration=0;transitionSnapshot=null;$('transition-canvas').hidden=true;
}
/** Drive the seam overlay from a nested frame. A seam starts once per boundary crossing, while playing, on the engine that
 * draws overlays. A crossing with no seam (a cut, or a Scene without an entering transition), or a paused crossing, clears
 * the overlay as setSceneRef does. A host-level transition into the occurrence is left alone: it is not a nested crossing. */
function driveNestedSeam(playback:{key:string;seams:NestedSeamAt[]}):void{
 const seam=latestNestedSeam(playback.seams,at=>at.seam.elapsed);
 const boundaryChanged=playback.key!==nestedFrameKey,wasNested=nestedFrameKey!==null;
 nestedFrameKey=playback.key;
 const seamKey=seam?seam.boundary:null,seamChanged=seamKey!==nestedSeamKey;
 nestedSeamKey=seamKey;
 if(seam&&seamChanged&&scenePlaying&&engine.capabilities.kind==='preview')startNestedSeam(seam);
 else if(boundaryChanged&&wasNested&&!(seam&&scenePlaying))clearNestedOverlay();
}
/** The frame for a host Scene whose body is a nested occurrence, or null for any other Scene. The engine renders the nested
 * Scene it is handed, exactly as it renders an open Expression; past the nested content the host's paper stands. */
function nestedFrameFor(base:Scene,delta:number):EngineFrame|null{
 const binding=nativeWorkspace?.nativeView()?.bindings[base.id];
 if(!binding||!isNestedBody(binding.body)){setNestedNotice(null);nestedFrameKey=null;nestedSeamKey=null;return null;}
 const playback=nestedPlayback(binding.body.subject_ref,binding.nested??null,base.duration,sceneElapsed);
 let scene:Scene,revision:number,params:Readonly<Record<string,number>>;
 if(playback.kind==='scene'){
  const tracked=playback.scene.propertyTracks?.length?evaluateTracks(playback.scene,playback.local):playback.scene;
  scene=tracked;params=evaluateParameters(tracked,playback.local);
  revision=playback.revision*1e7+(tracked!==playback.scene?1+Math.floor(playback.local*60):0);
  setNestedNotice(null);
  driveNestedSeam(playback);
 }else{
  scene={...base,entities:[]};params=base.field.params;revision=0;
  setNestedNotice(playback.notice);
  nestedFrameKey=null;nestedSeamKey=null;
 }
 return {scene,scaffold:'off',authoringRevision:revision,simTime,delta,params,camera,pointer,selectedIds:[]};
}
async function placeExpressionIntoScene():Promise<void>{
 const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];
 if(!view||!binding){toast('Open this Scene as a native Expression before placing an expression in it.');return;}
 const slot=nestedWindowVerdict(binding.loaded_refs.length);
 if(slot){toast(`Not placed: ${slot}`,8000);return;}
 const sceneId=scene().id,host=view.document.expression_ref,sceneRef=binding.scene_ref;
 let listed:Awaited<ReturnType<typeof listKernelExpressions>>;
 try{listed=await listKernelExpressions();}catch(cause){toast(`The Library could not list saved expressions: ${(cause as Error).message}`,8000);return;}
 openNestedPicker(listed.filter(entry=>entry.expression_ref!==host).map(entry=>({expression_ref:entry.expression_ref,title:entry.title,revision:entry.revision})),async pick=>{
  if(scene().id!==sceneId||nativeWorkspace?.nativeView()?.document.expression_ref!==host){toast('The Scene changed while you chose. Place the expression again.',8000);return;}
  try{
   const body=nestedBodyFor(host,{expression_ref:pick.expression_ref,revision:pick.revision,title:pick.title},NESTED_DEFAULT_DEPTH);
   await nativeWorkspace!.readNested(pick.expression_ref,pick.revision,NESTED_DEFAULT_DEPTH);
   const verdict=nestedEvaluation(host,body,nativeWorkspace!.nestedGraph());
   if(verdict.state!=='ready'){toast(`Not placed: ${verdict.reason}`,8000);return;}
   await nativeWorkspace!.edit([placeNestedChange(sceneRef,body)],'Nest expression');
   toast(`${pick.title||pick.expression_ref} is placed in this Scene at nesting depth ${NESTED_DEFAULT_DEPTH}, under its own expression ref.`,8000);
  }catch(cause){toast(`Not placed: ${(cause as Error).message}`,8000);}
 });
}
async function changeNestingDepth():Promise<void>{
 const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];
 if(!view||!binding||binding.body?.carrier!=='expression_ref'){toast('This Scene holds no nested expression, so it has no nesting depth.');return;}
 const depth=nextNestedDepth(binding.body.recursion?.max_depth??NESTED_DEFAULT_DEPTH);
 try{await nativeWorkspace!.edit([setNestingDepthChange(binding.scene_ref,binding.body,depth)],'Set nesting depth');toast(`Nesting depth is now ${depth}. Timing is still the Scene's own duration.`);}
 catch(cause){toast(`Nesting depth not changed: ${(cause as Error).message}`,8000);}
}
async function removeNestedOccurrence():Promise<void>{
 const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];
 if(!view||!binding||binding.body?.carrier!=='expression_ref'){toast('This Scene holds no nested expression to remove.');return;}
 try{await nativeWorkspace!.edit([removeNestedChange(binding.scene_ref)],'Remove nested expression');toast('Nested occurrence removed. This Scene is free of it, and its page slot is released.',8000);}
 catch(cause){toast(`Not removed: ${(cause as Error).message}`,8000);}
}
async function action(name:string,el:HTMLElement,event?:Event){const s=scene(),subjectId=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,e=subjectId?s.entities.find(v=>v.id===subjectId):selectedEntity();if(e&&el.closest('.live-sequence'))selected=[e.id];switch(name){
 case 'record-properties':if(propertyTake){finishPropertyTake();break;}else{const tracks=recordableTracks();if(!tracks.length){toast('Add local numeric properties to the toolbelt. Shared overrides must be made local before recording.');break;}const previous=s.propertyTakeRange??takeWindows.get(s.id),start=appendTake?(previous?.end??sceneElapsed):(previous?.start??sceneElapsed);if(start>=3600){toast('This scene has reached its one-hour duration limit.');break;}journeyPlaying=false;trackPreview=false;fieldPaused=false;propertyTake={sceneId:s.id,armed:performance.now()+2000,start,elapsed:0,tracks,lastSample:-1,limit:!appendTake&&previous?previous.end-previous.start:undefined};renderAll();}break;
 case 'take-mode':appendTake=!appendTake;renderAll();break;
 case 'curve-select':curveSel={sceneId:s.id,trackId:el.dataset.trackId??'',index:null};renderTimeline();break;
 case 'curve-solo':toggleChannelView('solo',el.dataset.trackId??'');break;
 case 'curve-mute':toggleChannelView('mute',el.dataset.trackId??'');break;
 case 'curve-show':toggleChannelView('shown',el.dataset.trackId??'');break;
 case 'curve-segment':setCurveSegment(el.dataset.trackId??'',Number(el.dataset.index),el.dataset.type as Interpolation);break;
 case 'curve-delete-key':deleteCurveKey();break;
  case 'seam-transition':toggleSeam(el.dataset.sceneId??'');break;
  case 'set-transition-kind':setSeamKind(el.dataset.sceneId??'',el.dataset.kind as TransitionKind);break;
  case 'set-transition-direction':setSeamTransition(el.dataset.sceneId??'','wipe',{direction:el.dataset.direction as WipeDirection});break;
 case 'delete-property-track':changed(()=>{s.propertyTracks=s.propertyTracks?.filter(t=>t.id!==el.dataset.id);},true,'Delete property track');break;
 case 'preview-tracks':trackPreview=!trackPreview;sceneElapsed=0;scenePlaying=trackPreview;if(trackPreview)fieldPaused=false;renderAll();break;
 case 'studio':contextKind='';beltPickerOpen=false;timelineOpen=false;modesOpen=false;captureOpen=false;if(!studioOpen&&worldLens==='epi-logos'&&nativeField&&!instrumentOffered){instrumentOffered=true;studioSection='native';tab='field';}setStudio(!studioOpen);break;
 case 'close-studio':setStudio(false);break;
 case 'dock-studio':{const insp=$('inspector'),mutate=()=>{studioDocked=!studioDocked;if(studioDocked){studioSizeMemo={width:insp.style.getPropertyValue('--panel-width'),height:insp.style.getPropertyValue('--panel-height')};insp.style.removeProperty('--panel-width');insp.style.removeProperty('--panel-height');}else if(studioSizeMemo){if(studioSizeMemo.width)insp.style.setProperty('--panel-width',studioSizeMemo.width);else insp.style.removeProperty('--panel-width');if(studioSizeMemo.height)insp.style.setProperty('--panel-height',studioSizeMemo.height);else insp.style.removeProperty('--panel-height');}renderAll();};if(matchMedia('(prefers-reduced-motion: reduce)').matches)mutate();else flipPanel(insp,mutate);break;}
 case 'automation-play':{const s2=scene();changed(()=>{for(const g of automationGroups(s2.automation))s2.automation.find(l=>l.id===g.leader.id)!.enabled=true;},true,'Play automations');fireAutomations();break;}
 case 'automation-pause':{const s2=scene();changed(()=>{for(const g of automationGroups(s2.automation))if(resolvedAutomation(s2.automation,g.leader).enabled)s2.automation.find(l=>l.id===g.leader.id)!.enabled=false;},true,'Pause automations');automationPhase='idle';renderAll();toast('Automations paused — every group holds at its base. Play restarts them.');break;}
 case 'automation-loop':automationLoop=!automationLoop;if(automationLoop&&!fieldPaused&&!automationRunning())fireAutomations(true);renderAll();break;
 case 'studio-section':studioSection=el.dataset.value!;instrumentOffered=true;tab=['formations','layout'].includes(studioSection)?'objects':['sequence','motion','focus','automation'].includes(studioSection)?'motion':['scene','text'].includes(studioSection)?'scene':'field';motionTab=studioSection==='automation'?'automation':studioSection==='motion'?'morph':studioSection==='focus'?'focus':'sequence';search='';$<HTMLInputElement>('control-search').value='';renderAll();$('inspector-content').scrollTop=0;break;
 case 'quick-guide':$<HTMLDialogElement>('guide-dialog').showModal();break;
 case 'sequence-panel':timelineOpen=false;beltPickerOpen=false;modesOpen=false;captureOpen=false;sequenceOpen=!sequenceOpen;if(sequenceOpen){inspectorOpen=false;contextKind='';}renderAll();break;
 case 'save-scene':case 'save-next':{if(propertyTake)finishPropertyTake();const name=$<HTMLInputElement>('scene-save-name').value;if(name.trim().length===0){toast('Give the scene a name first.');break;}if(el.dataset.action==='save-next'&&store.document.scenes.length>=64){toast('An expression can contain up to 64 scenes.');break;}snapshotScene({action:'save-snapshot',name,next:el.dataset.action==='save-next'});toast('Scene saved to your browser library'+(el.dataset.action==='save-next'?' · next draft ready.':'.'));break;}
 case 'restore-scene':snapshotScene({action:'restore-snapshot'});break;
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

 case 'native-palette':changed(()=>applyPalette(s,el.dataset.id!),true,'Apply palette');break;
 case 'native-paper-harmonize':changed(()=>{const [r,g,b]=hexToRgb(s.field.palette[0]);s.field.background='#'+[Math.max(3,Math.floor(r*.07)),Math.max(3,Math.floor(g*.07)),Math.max(8,Math.floor(b*.12))].map(n=>n.toString(16).padStart(2,'0')).join('');s.engine.backgroundMode='ambientGlow';s.engine.inkMode='whiteOnBlack';const binding=NATIVE_BINDINGS.find(b=>b.path==='backgroundGlowIntensity');if(binding)bindValue(s,binding.bind,.65);},true,'Harmonise paper');break;
 case 'native-paper-invert':changed(()=>{s.field.background=isLightHex(s.field.background)?'#09090b':'#fafaf9';s.engine.inkMode=isLightHex(s.field.background)?'blackOnWhite':'whiteOnBlack';},true,'Invert paper');break;
 case 'native-paper':changed(()=>applyBackground(s,el.dataset.id!),true,'Set paper');break;
 case 'native-palette-invert':changed(()=>invertPalette(s),true,'Invert palette');break;
 case 'native-palette-random':changed(()=>{applyPalette(s,COLOR_PALETTES[Math.floor(Math.random()*COLOR_PALETTES.length)].id);},true,'Randomise palette');break;
 case 'native-glyph':if(e)changed(()=>{const glyph=el.dataset.value!,base=el.dataset.prefix!=='step',font={fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight};
  useStateShape(e,base?0:stepIndex);if(base)e.layers=[];setStateSource(e,base?0:stepIndex,undefined);applyGlyph(e,base?null:stepIndex,glyph);
  if(s.engine.autoFitSizes!==false){if(base){refitEntityForGlyph(e,glyph,font);if(e.sequence.steps.length===1)refitStepForGlyph(e,0,glyph,font);}else refitStepForGlyph(e,stepIndex,glyph,font);}
  if(!base)syncHeldState(e,stepIndex);},true,'Set glyph');break;
 case 'native-chain':if(e)changed(()=>{applyChain(e,el.dataset.id!);stepIndex=0;if(s.engine.autoFitSizes!==false)refitFormationToGlyphs(e,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight});},true,'Apply chain');break;
 case 'native-kundalini-sequence':if(e)changed(()=>{applyKundaliniSequence(e);stepIndex=0;if(s.engine.autoFitSizes!==false)refitFormationToGlyphs(e,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight});},true,'Apply kundalini sequence');break;
 case 'native-layout':{const entities=s.entities.filter(v=>selected.includes(v.id)&&!v.locked&&v.kind==='formation'),layout=NATIVE_LAYOUTS[el.dataset.value!];if(layout)changed(()=>{const axes=s.composition.plane==='XZ'?['x','z']:s.composition.plane==='YZ'?['y','z']:['x','y'];layout(entities.length).forEach((pos,i)=>{entities[i].position[axes[0] as keyof Vec3]=pos.x/400;entities[i].position[axes[1] as keyof Vec3]=pos.y/400;});s.composition.layout='native-'+el.dataset.value;},true,'Arrange objects');break;}
 case 'native-disperse':engine.command?.({type:'disperse',strength:3});needsFrame=true;break;
 case 'native-reset-phases':engine.command?.({type:'reset-phases'});needsFrame=true;break;
 case 'native-reset':confirmChange('Reset the particle field?','This deliberately reseeds particle positions and resets morph phases. The expression and its settings are preserved.',()=>{engine.command?.({type:'reset-field'});needsFrame=true;});break;
 case 'native-recover':engine.command?.({type:'recover-context'});recovery.hidden=true;needsFrame=true;break;
 case 'export-quarantine':{const row=quarantineState.rows.find(r=>r.id===el.dataset.id);if(row){download(new Blob([row.raw],{type:'application/json'}),slug(row.name)+'.quarantined.json');toast('Quarantined draft exported exactly as it was kept.');}break;}
 case 'restore-quarantine':{const id=el.dataset.id!;void restoreQuarantinedDraft(id).then(copy=>{refreshQuarantine(`Restored as a Library copy: ${copy.name}`);toast('Restored as a Library copy.');}).catch(cause=>refreshQuarantine(cause instanceof Error?cause.message:String(cause)));break;}
 // E19: the owner's kept draft becomes a Library copy by the same path as the browser quarantine; the kept draft stays where it is.
 case 'restore-owner-kept':{const id=el.dataset.id!,address=ownerListing?.address;if(!address)break;void restoreOwnerKeptDraft(address.expressionRef,address.scope,id).then(copy=>{refreshOwnerQuarantine(`Restored as a Library copy: ${copy.name}`);refreshQuarantine();toast('Restored as a Library copy.');}).catch(cause=>refreshOwnerQuarantine(cause instanceof Error?cause.message:String(cause)));break;}
 // E19: removing a kept draft is an explicit, confirmed request. Nothing else calls the owner's remove.
 case 'remove-owner-kept':{const id=el.dataset.id!,row=ownerListing?.rows.find(r=>r.id===id),address=ownerListing?.address;if(!row||!address)break;confirmChange('Remove this kept draft?',`The kept copy "${row.name}" (${row.reason}) is removed from this Expression's quarantine in the native owner. Nothing else is removed: the saved copy and the open Expression stay as they are.`,()=>{void removeOwnerKeptDraft(address.expressionRef,address.scope,row.id).then(remaining=>refreshOwnerQuarantine(`Removed. ${remaining} kept ${remaining===1?'draft remains':'drafts remain'}.`)).catch(cause=>refreshOwnerQuarantine(cause instanceof Error?cause.message:String(cause)));});break;}
 case 'delete-saved':{const id=el.dataset.id!;confirmChange('Remove this saved copy?','Only this understood saved expression is removed. Other saved and unreadable entries are retained. The active expression remains open.',()=>{removeFromLibrary(id);deletedLibraryIds.add(id);void removeDraft(id).catch(error);if(store.document.id===id)draftSchedule.cancel();sessionExpressions.delete(id);covers.delete(id);renderLibrary();});break;}

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
 case 'timeline-snap':toggleTimelineSnap();break;
 case 'transport-shuttle-back':transportShuttle(-1);break;
 case 'transport-pause':transportPause();break;
 case 'transport-shuttle-forward':transportShuttle(1);break;
 case 'transport-frame-back':transportFrame(-1);break;
 case 'transport-frame-forward':transportFrame(1);break;
 case 'face-plane':facePlane(camera);renderAll();break;
 case 'keep-view':changed(()=>{scene().view={...scene().view,mode:camera.mode,yaw:camera.yaw,pitch:camera.pitch,zoom:camera.zoom,panX:camera.panX/width,panY:camera.panY/height};},true,'Keep camera view');toast('This camera framing is now part of the scene.');break;
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
  await nativeWorkspace!.edit([{change:'scene_body_set',scene_ref:binding.scene_ref,body}],'Set scene body');
  toast(`Scene body set to the current native ${image?'image':'text'}.`);break;
 }
 case 'scene-body-clear':{
  const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];
  if(!view||!binding){toast('Open this Scene as a native Expression first.');break;}
  await nativeWorkspace?.edit([{change:'scene_body_clear',scene_ref:binding.scene_ref}],'Clear scene body');
  toast('Scene body cleared.');break;
 }
 case 'place-expression':void placeExpressionIntoScene();break;
 case 'nesting-depth':void changeNestingDepth();break;
 case 'remove-nested':void removeNestedOccurrence();break;
 case 'scene-trigger-add':{
  const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];
  if(!view||!binding){toast('Open this Scene as a native Expression first.');break;}
  const targetRef=$<HTMLSelectElement>('scene-trigger-target').value,occasion=$<HTMLSelectElement>('scene-trigger-occasion').value;
  if(!targetRef){toast('Choose a Scene to jump to.');break;}
  const triggerRef=`${view.document.expression_ref}:trigger:jump-${crypto.randomUUID()}`;
  await nativeWorkspace?.edit([{change:'scene_trigger_attach',scene_ref:binding.scene_ref,trigger:{trigger_ref:triggerRef,occasion,target:{kind:'navigate',scene_ref:targetRef}}}],'Attach trigger');
  toast('Jump trigger added.');break;
 }
 case 'scene-trigger-remove':{
  const ref=el.dataset.triggerRef;
  if(!ref)break;
  await nativeWorkspace?.edit([{change:'scene_trigger_detach',trigger_ref:ref}],'Detach trigger');
  toast('Trigger removed.');break;
 }
 case 'fit-view':{const {plane,depth,grid,snap}=camera;camera=defaultCamera();Object.assign(camera,{plane,depth,grid,snap});facePlane(camera);renderAll();break;}
 case 'timeline':timelineOpen=!timelineOpen;if(timelineOpen){inspectorOpen=false;contextKind='';beltPickerOpen=false;modesOpen=false;captureOpen=false;}renderAll();break;
 case 'open-timeline':journeyPlaying=false;timelineOpen=true;inspectorOpen=false;contextKind='';beltPickerOpen=false;modesOpen=false;captureOpen=false;renderAll();break;
 case 'close-timeline':timelineOpen=false;renderAll();break;
case 'timeline-track':timelineTrack=!timelineTrack;renderAll();break;
 case 'previous':setSceneRef(sceneRefAt(sceneIndex-1));break;case 'next':setSceneRef(sceneRefAt(sceneIndex+1));break;
 case 'choose-scene':setSceneRef(el.dataset.sceneId??'');break;
 case 'toggle-play':toggleScenePlay();break;
 case 'play-journey':if(!journeyPlaying&&!savedSceneIndices(store.document).length){timelineOpen=true;renderAll();toast('Save your first scene before playing the scene strip.');break;}setSavedScenePlay(!journeyPlaying);break;
 case 'present':startFocusMode();break;
 case 'exit-present':stopFocusMode();break;
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
 case 'jump-standing':void jumpToStanding(el).catch(cause=>toast(cause instanceof Error?cause.message:String(cause)));break;
 case 'reveal-source':summonSource(el.dataset.subject??'');break;
 case 'reveal-subject':{const subject=el.dataset.subject??'';try{summonGraph(subject,disclosedOwnerOrRefuse(subject));}catch(cause){toast(cause instanceof Error?cause.message:String(cause));}break;}
 case 'reveal-stands':openLibrary('collection');break;
 case 'set-collections':void assignCollections(el).catch(cause=>toast(cause instanceof Error?cause.message:String(cause)));break;
 case 'library-section':librarySection=el.dataset.section as 'collection'|'about';renderLibrary();$('library-page').scrollTop=0;break;
 case 'collection-filter':libraryCollectionFilter=parseCollectionFilter(el.dataset.filter??'');renderLibrary();break;
 case 'modes':modesOpen=!modesOpen;if(modesOpen){inspectorOpen=false;contextKind='';beltPickerOpen=false;timelineOpen=false;}captureOpen=false;pointer.active=false;if(modesOpen)$('modes-panel').innerHTML=modesHTML(starters,recentJourneys(Array.from(new Map([...readLibrary(),...sessionExpressions.values(),store.document].map(j=>[j.id,j])).values()),recentIds));renderAll();break;
 case 'start-mode':{const item=starters.find(p=>p.id===el.dataset.id);if(item)await loadJourney(forkExpression(item.expression));break;}
 case 'open-featured':{const item=featured.find(j=>j.id===el.dataset.id);if(item)await loadJourney(forkExpression(item));break;}
 case 'fork-saved':{const item=store.document.id===el.dataset.id?store.document:sessionExpressions.get(el.dataset.id!)??readLibrary().find(j=>j.id===el.dataset.id);if(item){const copy=forkExpression(item);copy.name+=' / variation';await loadJourney(copy);}break;}
 case 'close-dialog':el.closest('dialog')?.close();break;
 case 'confirm':$('confirm-dialog').closest('dialog')?.close();confirmCallback?.();confirmCallback=null;break;
 case 'load-built-in':{const j=preset(el.dataset.value!);j.id=uid('journey');await loadJourney(j);break;}
 case 'add-built-in':{const added=clone(preset(el.dataset.value!).scenes[0].entities);for(const x of added)x.id=uid('entity');changed(()=>{s.entities.push(...added);selected=added.map(x=>x.id);},true,'Add objects');closeDialogs();edit(true,'objects');break;}
 case 'import-legacy':{const raw=localStorage.getItem('typographic_pointcloud_saved_states');if(raw){const result=importDocuments(JSON.parse(raw));collectImported(result.journeys);toast(`${result.journeys.length} previous native scenes imported. Original browser key unchanged. ${result.errors.map(e=>e.message).join(' · ')}`,9000);openLibrary();}break;}
 case 'load-saved':{const id=el.dataset.id!,j=store.document.id===id?store.document:sessionExpressions.get(id)??readLibrary().find(j=>j.id===id);
   // T22: a local entry that its first kernel save adopted offers the kernel copy first; its browser draft stays openable beneath.
   const plan=libraryOpenPlan(readLibraryWithOrigins().origins.get(id),kernelExpressionsAvailable());
   if(plan.kind==='kernel-first'){openKernelCopy(plan.ref,j?()=>{void loadJourney(j)}:undefined);break;}
   if(j)await loadJourney(j);break;}
 case 'open-local-draft':await openBrowserDraft(el.dataset.id!);break;
 case 'new-journey':await loadJourney(blankJourney());edit(true,'scene');closeEntryGate();break;
 case 'entry-new':await loadJourney(blankJourney());edit(true,'scene');closeEntryGate();toast('Blank Expression — place a glyph or formation to begin.');break;
 case 'entry-continue':closeEntryGate();toast(store.document.name?'Continued '+store.document.name:'Continued last work');break;
 case 'entry-open':closeEntryGate();openLibrary();break;
 case 'entry-open-native':closeEntryGate();openLibrary('collection');break;
 case 'entry-starter-mark':await loadJourney(forkExpression(oiMark()));edit(true,'scene');closeEntryGate();break;
 case 'entry-dismiss':closeEntryGate();break;
 case 'new-scene':changed(()=>{const fresh=blankScene();applyTimelineMove(store.document,scenes=>{scenes.splice(sceneIndex+1,0,fresh);});sceneIndex++;selected=[];textId=scene().text[0]?.id??null;sceneElapsed=0;journeyPlaying=false;},true,'Add scene');edit(true,'scene');timelineOpen=true;renderAll();break;
 case 'duplicate-scene':{const id=el.dataset.sceneId??scene().id;changed(()=>{const source=store.document.scenes[sceneIndexOf(id)];const next=nextSceneFrom(store.document,source);next.name=(source.name+' / variation').slice(0,160);sceneIndex=store.document.scenes.indexOf(next);sceneElapsed=0;journeyPlaying=false;},true,'Duplicate scene');break;}
 case 'split-scene':splitSceneAtPlayhead();break;
 case 'still-scene':addStillScene();break;
 case 'delete-scene':{const id=el.dataset.sceneId??'';if(store.document.scenes.length===1){toast('Keep at least one scene in the expression.');break;}const name=store.document.scenes[sceneIndexOf(id)].name;confirmChange('Remove this scene?',`“${name}” will be removed from this expression. Undo can restore it.`,()=>changed(()=>{const at=sceneIndexOf(id);removeScene(store.document,id);if(sceneIndex>=at)sceneIndex=Math.max(0,sceneIndex-1);sceneElapsed=0;},true,'Delete scene'));break;}
 case 'move-scene-left':{const id=el.dataset.sceneId??'';reorderScene(id,sceneIndexOf(id)-1);break;}
 case 'move-scene-right':{const id=el.dataset.sceneId??'';reorderScene(id,sceneIndexOf(id)+1);break;}
 case 'journey-settings':openLibrary();break;
 case 'material':changed(()=>{s.field.material=el.dataset.value as Scene['field']['material'];},true,'Set scene material');break;
 case 'select-entity':selectEntity(el.dataset.id!,event instanceof MouseEvent&&event.shiftKey);break;
 case 'select-all':selected=s.entities.filter(e=>!e.locked).map(e=>e.id);renderAll();break;
 case 'repeat-pins':pinRepeat=!pinRepeat;setHint();break;
 case 'choose-shape':shapeChoice=el.dataset.value as Shape;glyphChoice=el.dataset.glyph??glyphChoice;renderShapePicker();break;
 case 'set-glyph':if(e&&!e.locked)changed(()=>{e.shape='text';e.text=el.dataset.value!;if(!e.sequence.enabled&&e.sequence.steps.length===1)e.sequence.steps[0].text=e.text;},true,'Set glyph');break;
 case 'force-kind':if(e&&!e.locked)changed(()=>{e.force.kind=el.dataset.value as Entity['force']['kind'];if(e.kind==='pin')e.name=e.force.kind==='attract'?'Attractor':e.force.kind==='repel'?'Repeller':e.force.kind==='vortex'?'Vortex':'Pin';},true,'Set force type');break;
 case 'semantic-add-modulation':{const entityId=el.dataset.entityId,binding=entityId?semanticBindingFor(s,entityId):undefined;if(binding)changed(()=>{(binding.modulations??=[]).push({source:{kind:'resonanceAffinity'},target:'color.gain',amount:1,offset:0});},true,'Add modulation');break;}
 case 'semantic-remove-modulation':{const entityId=el.dataset.entityId,binding=entityId?semanticBindingFor(s,entityId):undefined,index=Number(el.dataset.index);if(binding&&Number.isInteger(index))changed(()=>{binding.modulations?.splice(index,1);},true,'Remove modulation');break;}
 case 'duplicate-entity':duplicateEntity();break;case 'delete-entity':deleteEntities();break;
 case 'arrange':{if(selected.some(id=>blueprintMember(s,id))){toast('Release the blueprint before changing its internal arrangement.');break;}const targets=s.entities.filter(e=>!e.locked&&selected.includes(e.id));if(!targets.length){toast('Select at least one unlocked centre.');break;}changed(()=>{arrange(targets,el.dataset.value!,s.composition.plane);s.composition.layout=el.dataset.value!;},true,'Arrange objects');break;}
 case 'chakra-add':{const source=starters.find(p=>p.id==='composition-chakra_body')?.expression.scenes[0];if(!source)throw new Error('Semantic Chakra Body starter is unavailable.');let added:Entity[]=[];changed(()=>{added=mergeSemanticStarter(s,source);selected=added.map(e=>e.id);},true,'Add chakra starter');toast(STANDING_LABEL[AUTHORED_CHAKRA_STARTER]+'. No hidden chakra mode was enabled.');break;}
 case 'add-palette':if(s.field.palette.length<8)changed(()=>{s.engine.paletteSource='custom';s.field.palette.push('#a4876c');},true,'Add palette colour');break;
 case 'remove-palette':if(s.field.palette.length>2)changed(()=>{s.engine.paletteSource='custom';s.field.palette.pop();},true,'Remove palette colour');break;
 case 'fold-state':{if(!e)break;const destinations=store.document.scenes.slice(0,sceneIndex).flatMap(sc=>sc.entities.filter(v=>v.kind==='formation'&&!v.locked&&v.sequence.steps.length<32).map(v=>({scene:sc,entity:v})));if(!destinations.length){toast('An earlier scene needs an unlocked formation with room for another state.');break;}$('confirm-dialog').innerHTML=`${modalCloseButton()}<h2>Add object state</h2><p class="intro">Copy ${esc(e.name)} into an earlier formation’s sequence. Its source, shape, position, size, colour and force become one state. Scene physics and automation stay in their scenes.</p><label class="control"><span>Destination scene / formation</span><select id="fold-target">${destinations.map(d=>`<option value="${esc(d.scene.id)}|${esc(d.entity.id)}">${esc(d.scene.name)} / ${esc(d.entity.name)}</option>`).join('')}</select></label><label class="control"><span>Play these states with</span><select id="fold-mode"><option value="seconds">Seconds · hold and transition</option><option value="morph">Morph cycles</option><option value="manual">Manual blend</option></select></label><label class="toggle-row"><span>Remove this working scene after adding<small>Undo restores it. The earlier scene’s named snapshot stays intact.</small></span><input type="checkbox" id="fold-remove"><i></i></label><button class="primary" data-action="confirm-fold">Add to sequence</button>`;$('confirm-dialog').dataset.sourceEntity=e.id;$('confirm-dialog').dataset.sourceScene=s.id;$('confirm-dialog').dataset.sourceStep=String(stepIndex);$<HTMLDialogElement>('confirm-dialog').showModal();break;}
 case 'confirm-fold':{const dialog=$('confirm-dialog'),[to,target]=$<HTMLSelectElement>('fold-target').value.split('|'),mode=$<HTMLSelectElement>('fold-mode').value as 'seconds'|'morph'|'manual';changed(()=>{const result=foldObjectState(store.document,dialog.dataset.sourceScene!,dialog.dataset.sourceEntity!,Number(dialog.dataset.sourceStep),to,target,mode,$<HTMLInputElement>('fold-remove').checked);sceneIndex=store.document.scenes.findIndex(s=>s.id===result.sceneId);selected=[result.entityId];stepIndex=result.stepIndex;sceneElapsed=0;journeyPlaying=false;applySceneView();},true,'Fold object states');closeDialogs();inspectorOpen=false;contextKind='';captureOpen=false;sequenceOpen=true;renderAll();toast('Object state added to the earlier sequence · draft backed up. Save the scene when ready.');break;}
 case 'image-suite':captureOpen=false;openKeep();break;
 case 'source-sequence':captureOpen=false;sequenceOpen=true;renderAll();break;
 case 'source-new':{if(s.entities.length>=32){toast('A scene holds up to 32 formations and pins.');break;}const added=entity('Image / ASCII','O');changed(()=>{if(s.engine.autoFitSizes!==false)refitEntityForGlyph(added,'O',{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight});s.entities.push(added);selected=[added.id];stepIndex=0;},true,'Add image source');break;}
 case 'source-add':if(e&&!e.locked&&e.sequence.steps.length<32)changed(()=>{stepIndex=appendFormationState(e,'O',undefined,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight},s.engine.autoFitSizes!==false);syncHeldState(e,stepIndex);},true,'Add source state');break;
 case 'source-image':if(e&&!e.locked){sourceUploadEntityId={sceneId:s.id,entityId:e.id,stepId:e.sequence.steps[stepIndex].id};$<HTMLInputElement>('source-file').click();}break;
 case 'layer-add':{const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),kind=el.dataset.kind;if(ent&&!ent.locked&&((ent.sequence.steps[stepIndex]?.layers??ent.layers)?.length??0)<6)changed(()=>editStateLayers(ent,stepIndex,()=>{const n=(ent.sequence.steps[stepIndex]?.layers??ent.layers)?.length??0;const z=((n%2===0?1:-1)*Math.ceil((n+1)/2))*.25;const layer:EntityLayer={id:uid('layer'),text:kind==='glyph'?(el.dataset.value||'O'):'O',z,source:kind==='ascii'?{kind:'ascii',ascii:{text:['########','#      #','#  ##  #','#      #','########'].join('\n'),fontFamily:'monospace'}}:undefined};ent.layers=[...(ent.layers??[]),layer];if(kind==='image'){sourceUploadEntityId={sceneId:s.id,entityId:ent.id,stepId:ent.sequence.steps[stepIndex]?.id,layerId:layer.id};$<HTMLInputElement>('source-file').click();}}),true,'Add layer');break;}
 case 'layer-remove':{const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.index);if(ent&&!ent.locked&&((ent.sequence.steps[stepIndex]?.layers??ent.layers)?.length??0)>1)changed(()=>editStateLayers(ent,stepIndex,()=>{ent.layers=ent.layers!.filter((_,i)=>i!==idx);}),true,'Remove layer');break;}
 case 'layer-move':{const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.index),dir=Number(el.dataset.dir);if(ent&&!ent.locked&&(ent.sequence.steps[stepIndex]?.layers??ent.layers)){const j=idx+dir;if(j<0||j>=(ent.sequence.steps[stepIndex]?.layers??ent.layers??[]).length)break;changed(()=>editStateLayers(ent,stepIndex,()=>{const ls=[...ent.layers!];const t=ls[idx];ls[idx]=ls[j];ls[j]=t;ent.layers=ls;}),true,'Move layer');}break;}
 case 'select-text':cursorTool='select';textId=el.dataset.id!;tool='text';renderAll();break;
 case 'move-text':cursorTool='select';tool='text';renderAll();break;
 case 'add-text':cursorTool='select';changed(()=>{const t:TextLayer={id:uid('text'),visible:true,kicker:'A MOMENT IN THE FIELD',title:'Your words,',italic:'in this space.',body:'',x:.07,y:.24,width:240,size:38,align:'left'};s.text.push(t);textId=t.id;tool='text';},true,'Add text');break;
 case 'delete-text':if(currentText())changed(()=>{s.text=s.text.filter(t=>t.id!==currentText().id);textId=s.text[0]?.id??null;},true,'Delete text');break;
 case 'entity-sequence':if(e)selected=[e.id];editing=true;inspectorOpen=true;tab='motion';motionTab='sequence';stepIndex=0;renderAll();break;
 case 'motion-tab':motionTab=el.dataset.value as InspectorContext['motionTab'];renderAll();break;
 case 'select-step':if(e){selected=[e.id];stepIndex=Number(el.dataset.index);placementStep=false;if(!e.sequence.enabled&&!e.sequence.manual)changed(()=>syncHeldState(e,stepIndex),true,'Select link');else renderAll();}break;
 case 'add-step':if(e&&!e.locked&&e.sequence.steps.length<32)changed(()=>{stepIndex=appendFormationState(e,e.sequence.steps.length%2?'I':'O',undefined,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight},s.engine.autoFitSizes!==false);e.sequence.enabled=true;},true,'Add link');break;
 case 'add-ascii-step':if(e&&!e.locked&&e.sequence.steps.length<32)changed(()=>{stepIndex=appendFormationState(e,'',{kind:'ascii',ascii:{text:'',fontFamily:'monospace',fontSize:32}},{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight},s.engine.autoFitSizes!==false);selected=[e.id];syncHeldState(e,stepIndex);},true,'Add ASCII link');break;
 case 'add-image-step':if(e&&!e.locked&&e.sequence.steps.length<32){sourceUploadEntityId={sceneId:s.id,entityId:e.id,append:true};$<HTMLInputElement>('source-file').click();}break;
 case 'delete-step':if(e&&!e.locked){if(e.sequence.steps.length<=1){toast('Keep at least one sequence link.');break;}changed(()=>{e.sequence.steps.splice(stepIndex,1);stepIndex=Math.max(0,stepIndex-1);syncHeldState(e,stepIndex);pruneAutomation(s);},true,'Delete link');}break;
 case 'capture-step-state':if(e&&!e.locked)changed(()=>{const k=e.sequence.steps[stepIndex];if(k&&!k.objectState)k.objectState=capturedStepState(e,stepIndex);},true,'Capture link state');break;
 case 'release-step-state':if(e&&!e.locked)changed(()=>{delete e.sequence.steps[stepIndex]?.objectState;},true,'Release link state');break;
 case 'refit-sequence':if(e&&!e.locked)changed(()=>refitFormationToGlyphs(e,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight}),true,'Refit sequence');break;
 case 'font-family':{if(!(el instanceof HTMLSelectElement))break;const value=el.value;
  if(value===CUSTOM_SENTINEL){customFontEdit=true;renderAll();$('inspector-content').querySelector<HTMLInputElement>('input[data-bind="engine.fontFamily"]')?.focus();break;}
  const prior=s.engine.fontFamily;customFontEdit=false;
  const stack=FONT_OPTIONS.find(o=>o.id===value)?.stack??value;
  changed(()=>{s.engine.fontFamily=stack;refitFormationsForFont({fontFamily:prior??''},{fontFamily:stack,fontWeight:s.engine.fontWeight});},true,'Set font');
  break;}
 case 'place-keyframe':if(e&&blueprintMember(s,e.id)){toast('Release the blueprint before adding positional keyframes.');break;}if(e&&!e.locked){placementStep=true;cursorTool='select';tool='select';inspectorOpen=false;camera.grid=true;renderAll();}break;
 case 'clear-keyframe':if(e&&!e.locked&&e.sequence.steps[stepIndex])changed(()=>{e.sequence.steps[stepIndex].position=null;},true,'Clear keyframe');break;
 case 'cancel-placement':placementStep=false;shapePickerOpen=false;cursorTool='select';tool='select';inspectorOpen=true;renderAll();break;
 case 'route-up':case 'route-down':changed(()=>{reorderFocus(s.entities,el.dataset.id!,name==='route-up'?-1:1);},true,'Reorder objects');break;
 case 'show-monitor':monitoredLane=el.dataset.id!;beltOpen=true;inspectorOpen=false;renderAll();break;
 case 'monitor-mode':monitorMode=el.dataset.value==='live'?'live':'cycle';renderLive();break;
 case 'monitor-dock':{monitorDocked=!monitorDocked;const m=$('automation-monitor');if(monitorDocked)$('toolbelt-panel').appendChild(m);else document.body.appendChild(m);renderAll();break;}
 case 'monitor-add-glyph':{changed(()=>{const added=entity('New glyph','O');scene().entities.push(added);selected=[added.id];},true,'Add glyph');toast('Glyph added. Drag it on the canvas, or edit it under Objects.');break;}
 case 'edit-monitored':monitoredLane=el.dataset.id!;editing=true;inspectorOpen=true;tab='motion';motionTab='automation';detailState.set('automation-'+monitoredLane,true);renderAll();break;
 case 'toggle-monitored':changed(()=>{const lane=s.automation.find(l=>l.id===el.dataset.id);if(lane)lane.enabled=!lane.enabled;},true,'Toggle lane');break;
 case 'choose-group-target':assignmentGroup=el.dataset.id!;assignmentTarget='';renderAll();break;
 case 'close-assignment':assignmentGroup='';assignmentTarget='';renderAll();break;
 case 'confirm-group-target':{const target=$<HTMLSelectElement>('assignment-target').value,group=assignmentGroup;assignmentGroup='';if(target)addLane(target,group==='new'?undefined:group);else renderAll();break;}
 case 'assign-automation':{const target=assignmentTarget;assignmentTarget='';addLane(target,el.dataset.id||undefined);break;}
 case 'delete-group':changed(()=>{const ids=new Set(automationGroups(s.automation).find(g=>g.leader.id===el.dataset.id)?.targets.map(l=>l.id));s.automation=s.automation.filter(l=>!ids.has(l.id));},true,'Delete automation group');break;
 case 'remove-group-target':changed(()=>{s.automation=removeGroupTarget(s.automation,el.dataset.id!);},true,'Remove automation target');break;
 case 'detach-target':changed(()=>linkAutomation(s.automation,el.dataset.id!,''),true,'Detach automation target');break;
 case 'edit-morph':studioSection='motion';tab='motion';motionTab='morph';renderAll();break;
 case 'automate':{const target=el.dataset.target??'field.'+el.dataset.key,existing=s.automation.find(l=>l.target===target);if(existing){monitoredLane=automationLeader(s.automation,existing).id;editing=true;inspectorOpen=true;tab='motion';motionTab='automation';detailState.set('automation-'+monitoredLane,true);}else{assignmentTarget=target;assignmentGroup='';}renderAll();break;}case 'add-lane':assignmentGroup='new';assignmentTarget='';renderAll();break;
 case 'delete-lane':changed(()=>{s.automation=removeAutomation(s.automation,el.dataset.id!);},true,'Delete automation lane');break;
 case 'fire-lane':{const requested=s.automation.find(a=>a.id===el.dataset.id),lane=requested?automationLeader(s.automation,requested):undefined;if(lane)changed(()=>{lane.firedAt=(lane.firedAt??0)+1;},true,'Fire automation lane');if(fieldPaused)toast('Ramp armed. Lift “Pause physics” in the studio to let it run.');break;}
 case 'reveal-param':{editing=true;inspectorOpen=true;const p=parameter(el.dataset.key!);if(p){search='';$<HTMLInputElement>('control-search').value='';tab=p.group==='morph'||p.group==='composition'?'motion':'field';motionTab=p.group==='composition'?'focus':'morph';renderAll();const control=Array.from($('inspector-content').querySelectorAll<HTMLElement>('[data-bind]')).find(e=>e.dataset.bind===p.bind);let parent=control?.parentElement;while(parent&&parent!==$('inspector-content')){if(parent instanceof HTMLDetailsElement){parent.open=true;if(parent.dataset.detail)detailState.set(parent.dataset.detail,true);}parent=parent.parentElement;}control?.scrollIntoView({block:'center'});}break;}
 case 'toggle-global':changed(()=>toggleShared(store.document,s,el.dataset.path!),true,'Toggle shared setting');break;
 case 'favourite':{const key=el.dataset.key!;const exists=workspace.entries.some(v=>v.scope==='field'&&v.key===key);workspace.entries=exists?workspace.entries.filter(v=>v.scope!=='field'||v.key!==key):[...workspace.entries,{id:uid('belt'),key,scope:'field'}];saveWorkspace();renderAll();break;}
 case 'take-manual':{const target=el.dataset.target!,binding=automationTarget(s,target),evaluated=engine.telemetry?.(),value=binding?liveValue(s,binding.bind,binding.entityId,evaluated?.params??s.field.params,evaluated?.config):undefined;changed(()=>{if(binding&&value!==undefined){const location=binding.entityId?{root:s.entities.find(e=>e.id===binding.entityId),keys:binding.bind.slice(7).split('.')}:pathTarget(binding.bind);let object:any=location.root;for(const key of location.keys.slice(0,-1))object=object[key];object[location.keys.at(-1)!]=value;}for(const lane of s.automation.filter(l=>l.target===target))s.automation=removeGroupTarget(s.automation,lane.id);if(target==='field.frequency'){s.composition.frequencyDriver='manual';s.engine.autoSweep=false;}},true,'Take manual control');break;}
 case 'tune-station':{const station=engine.stations?.().find(x=>x.index===Number(el.dataset.index));if(station)changed(()=>{s.field.params.frequency=station.frequencyHz;s.composition.frequencyDriver='manual';s.engine.autoSweep=false;s.automation.filter(l=>l.target==='field.frequency').forEach(l=>l.enabled=false);},true,'Tune frequency');break;}
 case 'lane-up':case 'lane-down':{const index=s.automation.findIndex(l=>l.id===el.dataset.id),next=index+(name==='lane-up'?-1:1);if(index>=0&&next>=0&&next<s.automation.length)changed(()=>{[s.automation[index],s.automation[next]]=[s.automation[next],s.automation[index]];},true,'Reorder automation lanes');break;}
 case 'step-earlier':case 'step-later':{const next=stepIndex+(name==='step-earlier'?-1:1);if(e&&next>=0&&next<e.sequence.steps.length&&!e.locked)changed(()=>{[e.sequence.steps[stepIndex],e.sequence.steps[next]]=[e.sequence.steps[next],e.sequence.steps[stepIndex]];stepIndex=next;syncHeldState(e,stepIndex);},true,'Reorder links');break;}
 case 'duplicate-step':if(e&&!e.locked&&e.sequence.steps.length<32)changed(()=>{const k=clone(e.sequence.steps[stepIndex]);k.id=uid('step');if(k.layers)k.layers=k.layers.map(l=>({...l,id:uid('layer')}));e.sequence.steps.splice(++stepIndex,0,k);syncHeldState(e,stepIndex);},true,'Duplicate link');break;
 case 'undo':{await stepHistory('undo');break;}
 case 'redo':{await stepHistory('redo');break;}
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
document.addEventListener('click',ev=>{if(performance.now()<trimClickGuardUntil&&(ev.target as Element).closest('.scene-track'))return;const target=(ev.target as Element).closest<HTMLElement>('[data-action]');if(!target||target instanceof HTMLSelectElement||target instanceof HTMLButtonElement&&target.disabled)return;const name=target.dataset.action!;void action(name,target,ev).catch(error);});
document.addEventListener('pointerover',ev=>{if(!(ev.target as Element).closest('#stage'))pointer.active=false;});
document.addEventListener('pointerdown',ev=>{const target=ev.target as Element;if((assignmentTarget||assignmentGroup)&&!target.closest('#automation-assignment,[data-action="automate"],[data-action="choose-group-target"],[data-action="add-lane"]')){assignmentTarget='';assignmentGroup='';$('automation-assignment').hidden=true;}if(modesOpen&&!target.closest('#modes-panel,[data-action="modes"]')){modesOpen=false;$('modes-panel').hidden=true;document.querySelector('[data-action="modes"]')?.setAttribute('aria-expanded','false');}if(captureOpen&&!target.closest('#capture-panel,[data-action="capture-options"]')){readCapture();captureOpen=false;$('capture-panel').hidden=true;document.querySelector('[data-action="capture-options"]')?.setAttribute('aria-expanded','false');}const el=ev.target as HTMLInputElement;if(!el.closest('#stage'))pointer.active=false;if(el instanceof HTMLInputElement&&el.type==='range'&&el.dataset.bind)store.begin(bindingEditLabel(PARAMETERS.find(p=>p.bind===el.dataset.bind)?.label));});
// Release any gesture baseline even when the input never fires a change event.
document.addEventListener('pointerup',()=>store.finish());
document.addEventListener('input',ev=>{const el=ev.target as HTMLInputElement;if(el.id==='expression-playhead'){let value=Number(el.value),index=0;while(index<store.document.scenes.length-1&&value>=store.document.scenes[index].duration){value-=store.document.scenes[index].duration;index++;}if(index!==sceneIndex)setSceneRef(store.document.scenes[index].id);seekWorkingScene(value);return;}if(el.id==='belt-search'){document.querySelectorAll<HTMLElement>('[data-candidate-row]').forEach(row=>row.hidden=!row.dataset.search?.includes(el.value.toLowerCase()));return;}if(el.id==='scene-save-name'){sceneNames.set(scene().id,el.value);return;}if(el.id==='placement-glyph'){glyphChoice=el.value.trim()||'O';return;}if(el.id==='mode-search'||el.id==='library-search'){
 const query=el.value.trim().toLowerCase(),selector=el.id==='mode-search'?'[data-mode-choice]':'[data-starting-card]';let count=0;
 document.querySelectorAll<HTMLElement>(selector).forEach(item=>{item.hidden=!item.dataset.search?.includes(query);if(!item.hidden)count++;});
 if(el.id==='library-search')$('library-empty').hidden=count>0;return;
 }if(el.id==='control-search'){search=el.value;renderInspector();return;}if((el instanceof HTMLInputElement&&el.type==='range'||el instanceof HTMLTextAreaElement)&&el.dataset.bind)applyBinding(el,true);});
document.addEventListener('change',ev=>{const el=ev.target as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;if(el.dataset.beltChoice){if((el as HTMLInputElement).checked)pendingBelt.add(el.dataset.beltChoice);else pendingBelt.delete(el.dataset.beltChoice);$('belt-selection-count').textContent=pendingBelt.size+' selected';return;}if(el.id==='pointer-scope'){changed(()=>useLocalPointer(store.document,scene(),el.value==='local'),true,'Set pointer scope');return;}
 if(el.id==='pause-physics'){fieldPaused=(el as HTMLInputElement).checked;needsFrame=true;transportUI();return;}
 if(el.dataset.semanticNode!==undefined){const entityId=el.dataset.entityId;if(entityId)changed(()=>assignSemanticNode(scene(),entityId,el.value==='none'?null:el.value),true,'Assign semantic node');return;}
 if(el.dataset.semanticModField){const entityId=el.dataset.entityId,binding=entityId?semanticBindingFor(scene(),entityId):undefined,index=Number(el.dataset.semanticModIndex),mod=binding?.modulations?.[index];if(mod){let value:any=el.value;if(el instanceof HTMLInputElement&&el.type==='number'){value=Number(el.value);if(!Number.isFinite(value)){toast('Enter a finite modulation value; the previous value is unchanged.');renderAll();return;}value=clamp(value,el.min!==''?Number(el.min):-100,el.max!==''?Number(el.max):100);}changed(()=>{const field=el.dataset.semanticModField!;if(field==='source.kind')mod.source={kind:String(value) as typeof mod.source.kind};else if(field==='target')mod.target=String(value) as typeof mod.target;else if(field==='amount')mod.amount=Number(value);else if(field==='offset')mod.offset=Number(value);},true,'Edit modulation');}return;}
 if(el.dataset.semanticBind){const entityId=el.dataset.entityId;if(entityId){let value:any=el instanceof HTMLInputElement&&el.type==='checkbox'?el.checked:el.value;if(el instanceof HTMLInputElement&&el.type==='number'){value=Number(el.value);if(!Number.isFinite(value)){toast('Enter a finite semantic value; the previous value is unchanged.');renderAll();return;}value=clamp(value,el.min!==''?Number(el.min):-1e8,el.max!==''?Number(el.max):1e8);}changed(()=>setSemanticBindingValue(scene(),entityId,el.dataset.semanticBind!,value),true,'Set semantic value');}return;}
 if(el.dataset.semanticGlobal){let value:any=el instanceof HTMLInputElement&&el.type==='checkbox'?el.checked:Number(el.value);if(el.dataset.semanticGlobal==='globalColorGain'&&!Number.isFinite(value)){toast('Enter a finite colour gain; the previous value is unchanged.');renderAll();return;}changed(()=>{const field=ensureSemanticField(scene());if(el.dataset.semanticGlobal==='enabled')field.enabled=!!value;else if(el.dataset.semanticGlobal==='globalColorGain')field.globalColorGain=clamp(Number(value),0,100);},true,'Set colour gain');return;}
 if(el.dataset.bind){if(el instanceof HTMLInputElement&&(el.type==='checkbox'||el.type==='radio')||el.value!==el.dataset.originalValue)applyBinding(el);return;}if(el.id.startsWith('capture-'))readCapture();
 if(el.dataset.palette){const i=Number(el.dataset.palette);changed(()=>{scene().engine.paletteSource='custom';scene().field.palette[i]=el.value;},true,'Set palette colour');}
 if(el.id==='placement-glyph')glyphChoice=el.value.trim()||'O';
 if(el.id==='keep-placing')keepPlacing=(el as HTMLInputElement).checked;
 if(el.id==='working-depth'){const v=Number(el.value);if(Number.isFinite(v))camera.depth=clamp(v,-10,10);renderAll();}
 if(el.id==='working-plane'){camera.plane=el.value as Camera['plane'];if(camera.mode==='2d')facePlane(camera);renderAll();}
 if(el.dataset.action==='source-entity'||el.dataset.action==='source-step')void selectSourceState(el as HTMLSelectElement);
 if(el.dataset.action==='source-kind'){const e=selectedEntity();if(e&&!e.locked)changed(()=>{useStateShape(e,stepIndex);setStateSource(e,stepIndex,el.value==='ascii'?{kind:'ascii',ascii:{text:'O  :  I',fontFamily:'monospace',fontSize:32}}:el.value==='image'?{kind:'image',image:{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1}}:undefined);if(scene().engine.autoFitSizes!==false){if(e.sequence.steps[stepIndex]?.source)refitStepForSource(e,stepIndex);else refitStepForGlyph(e,stepIndex,e.sequence.steps[stepIndex].text,{fontFamily:scene().engine.fontFamily,fontWeight:scene().engine.fontWeight});}syncHeldState(e,stepIndex);},true,'Set source kind');}
 if(el.id==='monitor-lane'){monitoredLane=el.value;renderAll();return;}if(el.id==='workspace-appearance'){workspace.appearance=el.value as typeof workspace.appearance;saveWorkspace();renderAll();}
 if(el.dataset.action==='sequence-mode'){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId;const entity=scene().entities.find(v=>v.id===id);if(entity&&!entity.locked)changed(()=>{entity.sequence.enabled=el.value==='play';entity.sequence.manual=el.value==='manual';if(el.value==='hold')syncHeldState(entity,stepIndex);if(el.value==='manual'){scene().engine.autoOscillate=false;scene().engine.morphEnabled=true;}},true,'Set sequence mode');}
 // Layer editing: depth, glyph text and inline ASCII per layer of the laminated body.
 if(el.dataset.layerDepth!==undefined){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.layerIndex),depth=Number(el.value);if(ent&&!ent.locked&&(ent.sequence.steps[stepIndex]?.layers??ent.layers)?.[idx]&&Number.isFinite(depth))changed(()=>editStateLayers(ent,stepIndex,()=>{ent.layers![idx].z=clamp(depth,-100,100);}),true,'Set layer depth');}
 if(el.dataset.layerText!==undefined){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.layerIndex);if(ent&&!ent.locked&&(ent.sequence.steps[stepIndex]?.layers??ent.layers)?.[idx])changed(()=>editStateLayers(ent,stepIndex,()=>{ent.layers![idx].text=el.value;}),true,'Set layer text');}
 if(el.dataset.layerAscii!==undefined){const id=el.closest<HTMLElement>('[data-entity-id]')?.dataset.entityId,ent=scene().entities.find(v=>v.id===id),idx=Number(el.dataset.layerIndex);if(ent&&!ent.locked&&(ent.sequence.steps[stepIndex]?.layers??ent.layers)?.[idx])changed(()=>editStateLayers(ent,stepIndex,()=>{const l=ent.layers![idx];l.source=l.source?.kind==='ascii'?{kind:'ascii',ascii:{...l.source.ascii,text:el.value}}:{kind:'ascii',ascii:{text:el.value,fontFamily:'monospace'}};}),true,'Set layer source');}
 if(el.dataset.action==='sequence-entity'||el.dataset.action==='monitor-formation'){selected=[el.value];stepIndex=0;renderAll();}
 if(el.dataset.action==='font-family'){void action('font-family',el).catch(error);return;}
});
document.addEventListener('focusout',ev=>{const el=ev.target;if((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)&&el.isConnected&&el.dataset.bind&&el.type!=='range'&&el.type!=='checkbox'){if(el.dataset.cancelCommit){delete el.dataset.cancelCommit;return;}if(el instanceof HTMLTextAreaElement||el.value!==el.dataset.originalValue)applyBinding(el);}});
document.addEventListener('focusin',ev=>{const el=ev.target;if((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)&&el.dataset.bind){el.dataset.originalValue=el.value;delete el.dataset.liveEditValue;delete el.dataset.cancelCommit;}});
document.addEventListener('keydown',ev=>{if(ev.defaultPrevented)return;const el=ev.target as HTMLElement;const typing=el.closest('input,textarea,select,[contenteditable="true"]');if(researchInstruments?.active()){if(libraryOpen){if(ev.key==='Escape'&&!document.querySelector('dialog[open]')){ev.preventDefault();if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();}else closeLibrary();}return;}if(!typing&&!document.querySelector('dialog[open]')&&(ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='z'){ev.preventDefault();void action(ev.shiftKey?'redo':'undo',el);}return;}if(typing){if(ev.key==='Escape'){if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();return;}if(el instanceof HTMLInputElement&&el.dataset.originalValue!==undefined){el.value=el.dataset.originalValue;el.dataset.cancelCommit='true';}el.blur();return;}if(ev.key==='Enter'&&!(el instanceof HTMLTextAreaElement)){ev.preventDefault();if(el instanceof HTMLInputElement&&el.dataset.bind)applyBinding(el);else el.blur();}return;}if(document.querySelector('dialog[open]'))return;if(libraryOpen){if(ev.key==='Escape'){if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();return;}ev.preventDefault();closeLibrary();}return;}if(ev.key==='Escape'&&(modesOpen||captureOpen)){ev.preventDefault();readCapture();modesOpen=false;captureOpen=false;renderAll();return;}
 if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='z'){ev.preventDefault();void action(ev.shiftKey?'redo':'undo',el);return;}
 // lane-3 E25: Cmd/Ctrl+4 toggles timeline snapping, as Live's snap toggle does. It answers before the modifier early return below.
 if((ev.metaKey||ev.ctrlKey)&&ev.key==='4'&&!presenting){ev.preventDefault();toggleTimelineSnap();return;}
 if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='s'){ev.preventDefault();void action('native-save',el);return;}
 if(ev.metaKey||ev.ctrlKey||ev.altKey)return;
 // E23: the Escape that leaves a browser fullscreen has already ended focus; it must not also close the editor beneath.
 if(ev.key==='Escape'&&performance.now()-focusExitedAt<400){ev.preventDefault();return;}
 if(ev.key==='Escape'){if(assignmentTarget||assignmentGroup){assignmentTarget='';assignmentGroup='';renderAll();return;}if(propertyTake){finishPropertyTake();return;}if(beltPickerOpen){beltPickerOpen=false;renderAll();return;}if(contextKind){contextKind='';renderAll();return;}if(studioOpen){setStudio(false);return;}if(presenting){stopFocusMode();}else if(placementStep||shapePickerOpen){placementStep=false;shapePickerOpen=false;cursorTool='select';tool='select';renderAll();}else if(timelineOpen){timelineOpen=false;renderAll();}else if(inspectorOpen){inspectorOpen=false;railExpanded=false;renderAll();}else if(editing)edit(false);return;}
 if(ev.key===' '){ev.preventDefault();toggleScenePlay();needsFrame=true;return;}
 if(ev.key.toLowerCase()==='s'&&!typing&&timelineOpen&&!presenting){ev.preventDefault();void action('split-scene',el);return;}
 // E12/E13: locators and the loop brace answer while the timeline is open; the tool keys (I, O) take over only when it is closed.
 if(!typing&&timelineOpen&&!presenting){const k=ev.key.toLowerCase();if(ev.repeat&&(k==='m'||k==='i'||k==='o')){ev.preventDefault();return;}if(k==='m'){ev.preventDefault();addMarkerAtPlayhead();return;}if(k==='['||k===']'){ev.preventDefault();jumpMarker(k===']'?1:-1);return;}if(k==='i'||k==='o'){ev.preventDefault();setLoopAtPlayhead(k==='i'?'from':'to');return;}if(ev.key==='\\'){ev.preventDefault();clearLoopRegion();return;}}
 // lane-3 E24/E25: J and L shuttle back and forward, K pauses (and returns from a shuttle); K held with J or L steps one frame.
 // ',' and '.' jump to the previous and next snap point from the playhead. None of these keys has another binding.
 if(!presenting){const k=ev.key.toLowerCase();
  if(k==='k'){ev.preventDefault();if(!ev.repeat){transportKeyHeld=true;transportPause();}return;}
  if(k==='j'||k==='l'){ev.preventDefault();const direction:1|-1=k==='l'?1:-1;if(transportKeyHeld)transportFrame(direction);else if(!ev.repeat)transportShuttle(direction);return;}
  if(k===','||k==='.'){ev.preventDefault();jumpSnap(k==='.'?1:-1);return;}
 }
 const shortcuts:Record<string,string>={e:'edit',p:'tool-pin',v:'tool-select',i:'tool-interact',a:'tool-formation',t:'tool-text',o:'tool-orbit',g:'grid',f:presenting?'exit-present':'present'};
 if(shortcuts[ev.key.toLowerCase()]){ev.preventDefault();void action(shortcuts[ev.key.toLowerCase()],el);return;}
 if(ev.key.startsWith('Arrow')){ev.preventDefault();if(editing&&selected.length){if(selected.some(id=>blueprintMember(scene(),id))){toast('Use Blueprint to move the whole shape.');return;}const amount=ev.shiftKey?.1:.01;if(placementStep){const entity=selectedEntity(),step=entity?.sequence.steps[stepIndex];if(!entity||!step||entity.locked)return;const view=nativeWorkspace?.nativeView(),occurrence=view?.bindings[scene().id]?.occurrences.find(row=>row.view_entity_id===entity.id);if(view&&!occurrence){toast('The selected formation has no current native occurrence');return;}if(occurrence&&(view!.document.entities[occurrence.entity_ref] as {pinned?:boolean})?.pinned){toast('Unpin the native occurrence before moving it');return;}const position=formationStateNudge(entity,step.id,ev.key,amount);if(position)changed(()=>{const current=scene().entities.find(row=>row.id===entity.id)?.sequence.steps.find(row=>row.id===step.id);if(current)current.position=position;},true,'Move keyframe');return;}changed(()=>scene().entities.filter(e=>selected.includes(e.id)&&!e.locked).forEach(e=>{if(ev.key==='ArrowLeft')e.position.x-=amount;if(ev.key==='ArrowRight')e.position.x+=amount;if(ev.key==='ArrowUp')e.position.y+=amount;if(ev.key==='ArrowDown')e.position.y-=amount;e.position.x=clamp(e.position.x,-50,50);e.position.y=clamp(e.position.y,-50,50);}),true,'Move objects');}else if(ev.key==='ArrowLeft')setSceneRef(sceneRefAt(sceneIndex-1));else if(ev.key==='ArrowRight')setSceneRef(sceneRefAt(sceneIndex+1));}
 // E09: with a keyframe selected in the channel lane, Delete removes that keyframe before any entity is touched.
 if((ev.key==='Delete'||ev.key==='Backspace')&&!typing&&timelineOpen&&selectedCurve()?.index!=null){ev.preventDefault();deleteCurveKey();return;}
 // A selected marker takes Delete only while it still exists and no stage object is selected: a stage selection made after
 // jumping to a marker is what Delete removes.
 if(selectedMarkerId&&!markerNamed(store.document.markers??[],selectedMarkerId))selectedMarkerId=null;
 if((ev.key==='Delete'||ev.key==='Backspace')&&!typing&&timelineOpen&&selectedMarkerId&&!(editing&&selected.length)){ev.preventDefault();deleteSelectedMarker();return;}
 if((ev.key==='Delete'||ev.key==='Backspace')&&editing&&selected.length){ev.preventDefault();deleteEntities();}
});
// lane-3 E24: a pointer held on the timeline playhead is a scrub until it lets go. The playhead's own seek already evaluates
// the tracks at the pointer and stops playback, so the scrub adds nothing to the physics clock. K-held state is released on keyup.
$('timeline-panel').addEventListener('pointerdown',ev=>{if(ev.button!==0)return;if((ev.target as Element).closest('#expression-playhead,.scene-track-playhead'))workingTransport=beginScrub(workingTransport);});
document.addEventListener('pointerup',()=>{workingTransport=endScrub(workingTransport);});
// T-REVIEW-4 #5: a scrubbed playhead gives its focus back, so the typing guard does not swallow J, K, L, comma, full stop and Space after a
// scrub. Arrow keys still step a focused playhead; only the pointer's release returns focus to the transport.
document.addEventListener('pointerup',()=>{const playhead=document.getElementById('expression-playhead');if(playhead&&document.activeElement===playhead)playhead.blur();});
document.addEventListener('pointercancel',()=>{workingTransport=endScrub(workingTransport);});
document.addEventListener('keyup',ev=>{if(ev.key.toLowerCase()==='k')transportKeyHeld=false;});
window.addEventListener('blur',()=>{transportKeyHeld=false;});
$<HTMLInputElement>('source-file').addEventListener('change',async ev=>{const input=ev.target as HTMLInputElement,file=input.files?.[0],id=sourceUploadEntityId;if(!file||!id)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8_000_000)throw new Error('Use a PNG, JPEG or WebP smaller than 8 MB.');const url=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Image file could not be read'));r.readAsDataURL(file);});const s=store.document.scenes.find(s=>s.id===id.sceneId),e=s?.entities.find(e=>e.id===id.entityId);if(!s||!e||e.locked)return;
  if(id.layerId){const layerIndex=e.sequence.steps.findIndex(k=>k.id===id.stepId);if(layerIndex<0||!(e.sequence.steps[layerIndex].layers??e.layers)?.some(l=>l.id===id.layerId))return;changed(()=>editStateLayers(e,layerIndex,()=>{e.layers=(e.layers??[]).map(l=>l.id===id.layerId?{...l,source:{kind:'image',image:{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1,dataUrl:url,name:file.name}}}:l);}),true,'Set layer image');toast('Layer sampled: '+file.name,5000);return;}
  let index=id.append?e.sequence.steps.length:e.sequence.steps.findIndex(k=>k.id===id.stepId);if(index<0||id.append&&index>=32)return;
  // Pre-sample with the same normalization the engine will run, so the toast
  // reports the real cutout and the square extent preserves the subject aspect.
  const visual=await sourceVisual('image',url,{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1},{paper:s.field.background,ink:s.field.palette[0]});
  if(store.document.scenes.find(sc=>sc.id===s.id)?.entities.find(ent=>ent.id===e.id)!==e||e.locked)return;
  if(!id.append){index=e.sequence.steps.findIndex(k=>k.id===id.stepId);if(index<0)return;}
  changed(()=>{const source:Entity['source']={kind:'image',image:{mode:'luminance',threshold:DEFAULT_SOURCE_THRESHOLD,invert:false,scale:1,dataUrl:url,name:file.name}};if(id.append)index=appendFormationState(e,'',source,{fontFamily:s.engine.fontFamily,fontWeight:s.engine.fontWeight},s.engine.autoFitSizes!==false);else{useStateShape(e,index);setStateSource(e,index,source);if(s.engine.autoFitSizes!==false)refitStepForSource(e,index);}if(scene().id===s.id){selected=[e.id];stepIndex=index;}syncHeldState(e,index);},true,'Set image source');
  toast('Sampled: '+describeAnalysis(visual.analysis,'image'),6500);
 }catch(err){error(err);}finally{input.value='';sourceUploadEntityId=null;}});
$<HTMLInputElement>('import-file').addEventListener('change',async ev=>{const input=ev.target as HTMLInputElement,file=input.files?.[0];if(!file)return;try{if(file.size>32_000_000)throw new Error('Choose a configuration smaller than 32 MB.');const result=importDocuments(JSON.parse(await file.text()));collectImported(result.journeys);if(!libraryOpen)openLibrary();else renderLibrary();toast(`${result.journeys.length} document(s) imported. ${result.errors.length?result.errors.map(e=>`Entry ${e.index+1}: ${e.message}`).join(' · '):'All accepted; original input is unchanged.'}`,10000);}catch(err){error(err);}finally{input.value='';}});
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d=>d.addEventListener('click',ev=>{if(ev.target!==d)return;const r=d.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)d.close();}));
// E04/E05/E06: the gestures are delegated on the panel, which survives the re-renders a drag causes. The clip
// body and the trim edge share one pointerdown: an edge is a trim (or a roll, with Shift); a body is a move.
$('timeline-panel').addEventListener('pointerdown',ev=>{if(ev.button!==0)return;const glyph=(ev.target as Element).closest<HTMLElement>('.seam-glyph');if(glyph){beginSeamBlend(ev,glyph);return;}});
$('timeline-panel').addEventListener('pointerdown',ev=>{if(ev.button!==0)return;const handle=(ev.target as Element).closest<HTMLElement>('.scene-trim-edge');if(handle){beginSceneTrim(ev,handle);return;}const clip=(ev.target as Element).closest<HTMLElement>('.scene-track .scene-clip');if(clip&&editing)beginSceneBody(ev,clip);});
$('timeline-panel').addEventListener('dblclick',ev=>{const handle=(ev.target as Element).closest<HTMLElement>('.scene-trim-edge');if(handle){ev.preventDefault();openExactDuration(handle.dataset.sceneId??'');}});
// E09: the channel lane's gestures are delegated on the panel too; its keyframes and handles are drawn, not hit.
$('timeline-panel').addEventListener('pointerdown',ev=>{if(ev.button!==0)return;const lane=(ev.target as Element).closest<HTMLElement>('.curve-lane');if(lane)beginCurveDrag(ev,lane);});
// Lane-5 T5 · a seam's bezier handles, on the chooser's own lane (timeline or inspector).
document.addEventListener('pointerdown',ev=>{if(ev.button!==0)return;const lane=(ev.target as Element).closest?.<HTMLElement>('.seam-curve');if(lane)beginSeamCurveDrag(ev,lane);});
$('timeline-panel').addEventListener('dblclick',ev=>{const lane=(ev.target as Element).closest<HTMLElement>('.curve-lane');if(lane)curveDoubleClick(ev,lane);});
// lane-3 E12/E13: locator and loop-brace gestures, rename, and the ruler menu (delegated on the timeline panel).
$('timeline-panel').addEventListener('pointerdown',ev=>{if(ev.button!==0)return;const target=ev.target as Element;if(target.closest('[data-marker-rename]'))return;const brace=target.closest<HTMLElement>('[data-loop-body],[data-loop-edge]');if(brace){beginLocatorDrag(ev,'loop',brace);return;}const marker=target.closest<HTMLElement>('[data-marker-id]');if(marker)beginLocatorDrag(ev,'marker',marker);});
$('timeline-panel').addEventListener('dblclick',ev=>{const target=ev.target as Element;if(target.closest('[data-marker-rename]'))return;const marker=target.closest<HTMLElement>('[data-marker-id]');if(!marker)return;ev.preventDefault();renamingMarkerId=marker.dataset.markerId??null;renderTimeline();setTimeout(()=>{const input=$('timeline-panel').querySelector<HTMLInputElement>('[data-marker-rename]');input?.focus();input?.select();},0);});
$('timeline-panel').addEventListener('keydown',ev=>{const input=ev.target instanceof HTMLInputElement&&ev.target.dataset.markerRename?ev.target:null;if(!input)return;if(ev.key==='Enter'){ev.preventDefault();renameMarker(input.dataset.markerRename??'',input.value);}else if(ev.key==='Escape'){ev.preventDefault();renamingMarkerId=null;renderTimeline();}});
$('timeline-panel').addEventListener('focusout',ev=>{const input=ev.target instanceof HTMLInputElement&&ev.target.dataset.markerRename?ev.target:null;if(input&&renamingMarkerId===input.dataset.markerRename)renameMarker(input.dataset.markerRename,input.value);});
$('timeline-panel').addEventListener('contextmenu',ev=>{const ruler=(ev.target as Element).closest<HTMLElement>('.journey-locators');if(!ruler)return;ev.preventDefault();const box=ruler.getBoundingClientRect();rulerMenuX=clamp(ev.clientX-box.left,0,Math.max(0,box.width-190));renderTimeline();});
$('timeline-panel').addEventListener('click',ev=>{const item=(ev.target as Element).closest<HTMLElement>('[data-ruler-action]');if(!item)return;ev.preventDefault();const action=item.dataset.rulerAction;rulerMenuX=null;if(action==='marker')addMarkerAtPlayhead();else if(action==='in')setLoopAtPlayhead('from');else if(action==='out')setLoopAtPlayhead('to');else if(action==='clear')clearLoopRegion();else renderTimeline();});
document.addEventListener('pointerdown',ev=>{if(rulerMenuX===null)return;if((ev.target as Element).closest?.('.journey-ruler-menu'))return;rulerMenuX=null;renderTimeline();});
document.addEventListener('pointermove',ev=>{if(locatorDrag)moveLocatorDrag(ev);});
document.addEventListener('pointerup',()=>{if(locatorDrag)endLocatorDrag(true);});
document.addEventListener('pointercancel',()=>{if(locatorDrag)endLocatorDrag(false);});
// E11 · the seam chooser's controls commit on change (one labelled edit per release), never on every drag tick.
// Lane-5 T5 · the seam chooser's switch and curve selects: one edge preset each, through editSeamEdge.
document.addEventListener('change',ev=>{const el=ev.target as HTMLElement;if(!(el instanceof HTMLSelectElement))return;const id=el.dataset.sceneId??'';
 if(el.hasAttribute('data-edge-switch'))editSeamEdge({kind:'switch',enterSceneId:id,mode:el.value as SwitchMode});
 else if(el.hasAttribute('data-edge-curve'))editSeamEdge({kind:'curve',enterSceneId:id,type:el.value as CurveType});
});
document.addEventListener('change',ev=>{const el=ev.target as HTMLElement;if(!(el instanceof HTMLInputElement))return;const id=el.dataset.sceneId??'';
 if(el.hasAttribute('data-transition-at')){setSeamTransition(id,'dip-to-colour',{at:Number(el.value)});return;}
 if(el.hasAttribute('data-transition-seconds')){if(el.value.trim()===''||!Number.isFinite(Number(el.value))){toast('Enter a finite number; the previous value is unchanged.');renderTimeline();return;}const spec=store.document.scenes.find(v=>v.id===id)?.transitionSpec;setSeamTransition(id,transitionKindOf(spec),{at:spec?.at,direction:spec?.direction},Number(el.value));}});
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
  if(placementStep){const e=selectedEntity();if(e&&!e.locked&&!blueprintMember(scene(),e.id)){const p=positionAt(ev);changed(()=>{e.sequence.steps[stepIndex].position={x:p.x-e.position.x,y:p.y-e.position.y,z:p.z-e.position.z};},true,'Place keyframe');placementStep=false;inspectorOpen=true;renderAll();}return;}
  if(tool==='interact'){const w=positionAt(ev);pointer={active:true,world:w};firePointerClick(w);return;}
  if(tool==='pin'||tool==='formation'){
   if(scene().entities.length>=32){toast('A scene holds up to 32 formations and pins.');return;}
   const p=positionAt(ev),newEntity=tool==='pin'?pin(p):tool==='formation'?formationFromSpec({title:glyphChoice==='O'?'New formation':glyphChoice,shape:shapeChoice,text:glyphChoice,position:p},scene().engine):entity(glyphChoice==='O'?'New formation':glyphChoice,glyphChoice,p);
   changed(()=>{scene().entities.push(newEntity);selected=[newEntity.id];},false,'Place object');if(!(tool==='pin'?pinRepeat:keepPlacing)){cursorTool='select';tool='select';shapePickerOpen=false;inspectorOpen=true;tab='objects';}renderAll();showCoordinates(p);return;
  }
  if(tool==='text'||contextKind==='text'&&tool==='select'){const layerEl=(ev.target as HTMLElement).closest<HTMLElement>('[data-text-id]');const t=scene().text.find(t=>t.id===layerEl?.dataset.textId);if(t){textId=t.id;contextKind='text';store.begin('Move text');drag={kind:'text',id:t.id,startX:ev.clientX,startY:ev.clientY,startWorld:{x:0,y:0,z:0},positions:new Map(),initialRadius:0,cam:{...camera},layer:clone(t),pan:false};$('stage').setPointerCapture(ev.pointerId);renderInspector();ev.preventDefault();}return;}
  const e=selectedEntity();if(e&&!e.locked&&(e.kind==='pin'||e.force.strength>0)){const handle=project({x:e.position.x+e.force.radius,y:e.position.y,z:e.position.z},camera,width,height);if(Math.hypot(handle.x-ev.clientX,handle.y-ev.clientY)<12){store.begin('Set force radius');drag={kind:'radius',id:e.id,startX:ev.clientX,startY:ev.clientY,startWorld:positionAt(ev,'XY',e.position.z),positions:new Map(),initialRadius:e.force.radius,cam:{...camera},layer:null,pan:false};$('stage').setPointerCapture(ev.pointerId);ev.preventDefault();return;}}
  const hit=hitEntity(ev.clientX,ev.clientY);
  const connection=!hit?engine.hitConnection?.(ev.clientX,ev.clientY):null;
  if(connection){selected=[];nativeSelectedRelation=connection.binding_ref;overlayDirty=true;needsFrame=true;void nativeWorkspace?.select(scene().id,null,connection.binding_ref);ev.preventDefault();return;}
  if(hit){
  if(nativeConnectionRows[scene().id])void nativeWorkspace?.select(scene().id,hit.id);if(!selected.includes(hit.id)||ev.shiftKey)selectEntity(hit.id,ev.shiftKey);if(blueprintMember(scene(),hit.id)){toast('Use Blueprint to move the whole shape, or release it to edit individual positions.');return;}if(hit.locked){toast('This centre is locked. Its sequence is still running.');return;}store.begin('Move object');drag={kind:'entity',id:hit.id,startX:ev.clientX,startY:ev.clientY,startWorld:positionAt(ev,'XY',hit.position.z),positions:new Map(scene().entities.filter(e=>selected.includes(e.id)&&!e.locked&&!blueprintMember(scene(),e.id)).map(e=>[e.id,{...e.position}])),initialRadius:0,cam:{...camera},layer:null,pan:false};$('stage').setPointerCapture(ev.pointerId);ev.preventDefault();}
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
function drawGuides(){const svg=$('guides');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
 // lane-3 E25: the snap indicator shows during a timeline drag, so it draws whether or not the stage guides are on.
 const snapLine=snapGuideX!==null&&!presenting?`<line class="snap-guide" x1="${snapGuideX}" x2="${snapGuideX}" y1="0" y2="${height}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2 3"/>`:'';
 if(!editing||presenting||!guidesVisible){svg.innerHTML=snapLine;return;}let markup='';
 if(camera.grid){for(let i=-15;i<=15;i++){const v=i/10;const mk=(a:number,b:number):Vec3=>camera.plane==='XY'?{x:a,y:b,z:camera.depth}:camera.plane==='XZ'?{x:a,y:camera.depth,z:b}:{x:camera.depth,y:a,z:b};const a=project(mk(v,-1.5),camera,width,height),b=project(mk(v,1.5),camera,width,height),c=project(mk(-1.5,v),camera,width,height),d=project(mk(1.5,v),camera,width,height);markup+=`<path d="M${a.x},${a.y}L${b.x},${b.y}M${c.x},${c.y}L${d.x},${d.y}" fill="none" stroke="var(--ink)" opacity="${i===0?.25:.075}" stroke-width="${i===0?1:.6}"/>`;}}
 const forms=scene().entities.filter(e=>e.kind==='formation');if(tab==='motion'&&motionTab==='focus'&&scene().composition.focus==='travelling'){const ps=forms.map(e=>project(e.position,camera,width,height));markup+=`<polyline points="${poly(ps)}" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 5" opacity=".6"/>`;}
 for(const e of scene().entities){const p=project(e.position,camera,width,height),isSelected=selected.includes(e.id),r=e.kind==='pin'?7:5,color=isSelected?'var(--accent)':'var(--muted)';
 if(isSelected&&(e.kind==='pin'||e.force.strength>0)){const points=Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return project({x:e.position.x+Math.cos(a)*e.force.radius,y:e.position.y+Math.sin(a)*e.force.radius,z:e.position.z},camera,width,height);});const handle=points[0];markup+=`<polyline points="${poly(points)}" fill="none" stroke="var(--accent)" stroke-width=".8" stroke-dasharray="3 5" opacity=".65"/><circle cx="${handle.x}" cy="${handle.y}" r="4" fill="var(--paper)" stroke="var(--accent)"/><text x="${handle.x+9}" y="${handle.y-7}" fill="var(--muted)" font-family="Arial" font-size="8">falloff</text>`;}
 if(isSelected&&e.kind==='formation'){const co=Math.cos(e.rotation*Math.PI/180),si=Math.sin(e.rotation*Math.PI/180);const corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5],[-.5,-.5]].map(([x,y])=>{const a=x*e.size.x,b=y*e.size.y;return project({x:e.position.x+a*co-b*si,y:e.position.y+a*si+b*co,z:e.position.z},camera,width,height);});markup+=`<polyline points="${poly(corners)}" fill="none" stroke="var(--accent)" stroke-width=".65" opacity=".3" stroke-dasharray="2 4"/>`;}
 if(isSelected&&e.sequence.enabled){const path=e.sequence.steps.map(k=>k.position?project({x:e.position.x+k.position.x,y:e.position.y+k.position.y,z:e.position.z+k.position.z},camera,width,height):p);markup+=`<polyline points="${poly(path)}" fill="none" stroke="var(--accent)" stroke-dasharray="2 6" stroke-width=".8"/>`;path.forEach((pt,i)=>{if(e.sequence.steps[i].position)markup+=`<rect x="${pt.x-3}" y="${pt.y-3}" width="6" height="6" fill="var(--paper)" stroke="var(--accent)"/><text x="${pt.x+7}" y="${pt.y-6}" fill="var(--accent)" font-size="8" font-family="Arial">${i+1}</text>`;});}
 markup+=`<g data-world-marker="${e.id}" data-screen-x="${p.x.toFixed(2)}" data-screen-y="${p.y.toFixed(2)}" transform="translate(${p.x},${p.y})"><circle r="${r+5}" fill="var(--paper)" opacity=".75"/><path d="M-12 0H-5M5 0H12M0-12V-5M0 5V12" fill="none" stroke="${color}" stroke-width=".9"/><circle r="${r}" fill="none" stroke="${color}" stroke-width=".9"/>${e.kind==='pin'?`<text y="3" text-anchor="middle" font-size="9" fill="${color}">${e.force.kind==='repel'?'+':e.force.kind==='vortex'?'↻':'−'}</text>`:''}${isSelected?`<text x="17" y="-13" fill="${color}" font-size="9" font-family="Arial">${esc(e.name)}${e.locked?' · locked':''}</text>`:''}</g>`;
 }
 svg.innerHTML=markup+snapLine;overlayDirty=false;
}
function resize(){width=innerWidth;height=innerHeight;engine.resize(width,height,physisPixelRatio??(devicePixelRatio||1));renderText();renderLive();overlayDirty=true;needsFrame=true;}
// Live parameter channel (stageCommands.ts 'live'): transient drag values and automation holds, runtime only. A Scene change ends both.
const liveOverrides=new LiveOverrides();let liveSceneId='';
function syncLiveScene(id:string){if(liveSceneId===id)return;liveSceneId=id;const held=liveOverrides.resume();const dragged=liveOverrides.releaseDrags();if(held||dragged)queueMicrotask(announceHostState);}
function frameData(delta:number):EngineFrame{const base=activeScene();syncLiveScene(base.id);const nestedFrame=nestedFrameFor(base,delta);if(nestedFrame)return nestedFrame;
 // Recorded takes override base values while the playhead moves; the revision
 // term follows the playhead so the engine rebuilds only when authored content
 // actually changes instead of hashing the whole document every frame.
 // E09b: a curve drag previews on the field through the same evaluator, so the field moves with the lane while the document is untouched.
 const dragging=!!curveDrag?.preview&&curveDrag.sceneId===base.id;
 const tracksActive=(journeyPlaying||trackPreview||dragging)&&!propertyTake&&!!base.propertyTracks?.length;
 const previewed=previewScene(base,curveDrag);
 const current=liveOverrides.apply(effectiveScene(store.document,tracksActive?evaluateTracks(previewed,sceneElapsed,channelStateFor(previewed,viewsFor(base.id))):base));
 const evidenceProjection=privateEvidenceField?.project(nativeWorkspace?.nativeView(),base.id)??null;
 let formationGeometryProjection:import('../../src/engine/formationGeometryProjection').FormationGeometryProjection|null=null;
 if(privateFormReading){try{formationGeometryProjection=naraFormGeometry(privateFormReading,nativeWorkspace?.nativeView(),base.id);}catch{privateFormReading=null;}}
 return {formationGeometryProjection,localizedResonanceProjection:evidenceProjection?privateEvidenceField?.resonance:null,forceEmitterProjection:evidenceProjection,entitySoundProjection:evidenceProjection?privateEvidenceField?.sound:undefined,connections:nativeConnectionRows[base.id],selectedConnection:nativeSelectedRelation,scene:current,scaffold:editing&&!presenting&&guidesVisible?current.view.nativeScaffold??'off':'off',simTime,delta,params:(()=>{const p=engine.capabilities.kind==='production'?current.field.params:evaluateParameters(current,simTime);return physisParticleCap&&p.count>physisParticleCap?{...p,count:physisParticleCap}:p;})(),camera,pointer,selectedIds:editing&&!presenting&&guidesVisible?selected:[],authoringRevision:store.revision*1e7+(dragging?CURVE_DRAG_REVISION_BASE+(curveDrag?.dragSeq??0):tracksActive?1+Math.floor(sceneElapsed*60):0),liveRevision:liveOverrides.version};}
function recordableTracks(){return workspace.entries.flatMap(entry=>{const subject=entry.scope==='selected'?(selectedEntity()??scene().entities.find(e=>e.kind==='formation')):scene().entities.find(e=>e.id===entry.entityId);const bind=entry.scope==='field'?PARAMETERS.find(p=>p.key===entry.key)?.bind:subject?entityTargets(scene()).find(t=>t.entityId===subject.id&&t.key===entry.key)?.bind:undefined;if(!bind)return [];const track:PropertyTrack={id:uid('track'),bind,entityId:entry.scope==='field'?undefined:subject?.id,points:[]};return isShared(store.document,scene(),bind)||readTrackValue(scene(),track)===undefined?[]:[track];});}
function finishPropertyTake(){if(!propertyTake)return;const take=propertyTake;propertyTake=null;if(take.elapsed>0){const end=Math.min(3600,take.start+take.elapsed);for(const t of take.tracks){const value=liveOverrides.valueForBind(t.bind)??readTrackValue(scene(),t);if(value!==undefined&&t.points.at(-1)?.time!==end)t.points.push({time:end,value});}changed(()=>{scene().propertyTakeRange={start:take.start,end};scene().propertyTracks=mergeTake(scene().propertyTracks??[],take.tracks,take.start,end);scene().duration=Math.max(scene().duration,end);},true,'Record property take');takeWindows.set(scene().id,{start:take.start,end});sceneElapsed=take.start;trackPreview=true;scenePlaying=false;toast('Property take recorded · save the scene to keep this version.');}renderAll();announceHostState();}
function updatePropertyTake(now:number){const t=propertyTake;if(!t)return;if(t.sceneId!==scene().id){finishPropertyTake();return;}const remaining=Math.max(0,Math.ceil((t.armed-now)/1000));$('take-status').hidden=false;$('take-status').textContent=remaining?'Recording in '+remaining+'…':'Recording '+t.elapsed.toFixed(1)+'s · click record to stop';if(remaining)return;const elapsed=Math.min((now-t.armed)/1000,3600-t.start,t.limit??Infinity);t.elapsed=elapsed;sceneElapsed=t.start+elapsed;scenePlaying=true;if(elapsed-t.lastSample>=.05||t.lastSample<0){for(const track of t.tracks){const value=liveOverrides.valueForBind(track.bind)??readTrackValue(scene(),track);if(value===undefined)continue;sampleTrack(track,t.start+elapsed,value,t.start+Math.max(0,t.lastSample));}t.lastSample=elapsed;}if(t.start+elapsed>=3600||t.limit!==undefined&&elapsed>=t.limit)finishPropertyTake();}
let frames=0,lastFpsTime=performance.now(),fps=0,rafId=0;
function tick(now:number){if(sceneEditHeld||researchInstruments?.active()&&!researchPreview){nativeField?.controller.frame(0,true);lastTime=now;rafId=requestAnimationFrame(tick);return;}updatePropertyTake(now);const rawDelta=Math.max(0,Math.min((now-lastTime)/1000,.25));lastTime=now;let delta=!fieldPaused&&!document.hidden&&!libraryOpen?Math.min(rawDelta,.05):0;delta=nativeField?.controller.frame(delta,fieldPaused||document.hidden||libraryOpen)??delta;const previousTime=simTime;if(engine.capabilities.kind!=='production'){delta*=liveOverrides.valueForBind('field.params.timeScale')??scene().field.params.timeScale;simTime+=delta;}
 if(recovery.hidden&&!libraryOpen&&(!fieldPaused||needsFrame||engine.needsRender?.()||pointer.active||recorder.active||transitionDuration>0)&&now-lastStudioRender>=(physisFpsCap?1000/physisFpsCap:0)){try{engine.render(frameData(delta));needsFrame=false;lastStudioRender=now;}catch(err){nativeField?.controller.hold('native surface render failed: '+String(err));needsFrame=false;if(String(err).toLowerCase().includes('context'))recovery.hidden=false;else error(err);transportUI();}}
 const native=engine.telemetry?.();if(native){simTime=native.simTime;delta=simTime-previousTime;document.documentElement.style.setProperty('--paper',native.background);document.documentElement.style.setProperty('--ink',native.palette[0]);$('text-layers').style.opacity=String(.25+.75*native.transition);}
 // A finished property preview holds its recorded end values; the field itself
 // keeps breathing. The playhead runs only while the scene plays, and reaching
 // the scene's end stops it — the transport returns to Play.
 // lane-3 E24: the auto-advance clock runs at the working transport's rate (play 1, shuttle its signed ×1/×2/×4). Scrubbing and stop are rate 0.
 syncWorkingTransport();const rate=transportRate(workingTransport),reverse=rate<0;
 const transportState={playing:scenePlaying,savedSequence:journeyPlaying,hidden:document.hidden,libraryOpen,propertyRecording:!!propertyTake,editing,authoredSceneIds:nativeSceneTransportMaterial(nativeWorkspace?.nativeView()),loopRegion:store.document.loopRegion};
 let transportFrame=advanceSceneTransport(store.document,sceneIndex,sceneElapsed,reverse?0:rawDelta*Math.max(0,rate),transportState);
 // T-REVIEW-4 #4: a reverse shuttle answers to the same holds a forward frame does (library, property recording, a saved sequence
 // being edited, a hidden page, native pacing not disclosed). The forward rule is asked about the reverse step: a hold leaves the
 // playhead where it is, a refusal stops with its reason, and reaching the Scene's start stops the transport rather than running on.
 if(reverse&&scenePlaying){
  const back=Math.min(rawDelta,.25)*Math.abs(rate);
  const probe=advanceSceneTransport(store.document,sceneIndex,sceneElapsed,back,transportState);
  const held=probe.scene_playing&&!probe.completed&&probe.advance_to_scene_index===null&&probe.elapsed_seconds===sceneElapsed;
  if(probe.unavailable_reason||held)transportFrame=probe;
  else{
   const next=sceneElapsed-back;
   transportFrame=next>0
    ?{...probe,elapsed_seconds:next,scene_playing:true,completed:false,advance_to_scene_index:null,seek_local_seconds:null}
    :{...probe,elapsed_seconds:0,scene_playing:false,saved_sequence_playing:false,completed:true,advance_to_scene_index:null,seek_local_seconds:null};
  }
 }
 sceneElapsed=transportFrame.elapsed_seconds;scenePlaying=transportFrame.scene_playing;
 // T5: a jump held for a Scene's end is dropped by a pause or a stop, so it cannot fire at a later natural end on its own.
 if(pendingAtEnd!==null&&!pendingSwitchStillWaits(transportFrame)){pendingAtEnd=null;renderAll();}
 const wasSequence=journeyPlaying;journeyPlaying=transportFrame.saved_sequence_playing;
 // T5 at-end: a jump held to this Scene's natural end lands now, in place of the sequence's next Scene or the stop. The landing
 // is the seam's own (at its start); playback continues as it was.
 if(pendingAtEnd!==null&&!transportFrame.unavailable_reason&&(transportFrame.completed||transportFrame.advance_to_scene_index!==null)){
  const landing=pendingAtEnd;pendingAtEnd=null;transportFrame.advance_to_scene_index=null;transportFrame.completed=false;transportFrame.seek_local_seconds=null;
  scenePlaying=true;journeyPlaying=wasSequence;
  try{if(wasSequence)void advanceSavedScene(sceneIndexOf(landing),0);else{const target=store.document.scenes[sceneIndexOf(landing)];setSceneRef(target.id,true);sceneElapsed=0;}}
  catch(cause){scenePlaying=false;journeyPlaying=false;toast(cause instanceof Error?cause.message:String(cause));renderAll();}
 }
 else if(transportFrame.advance_to_scene_index!==null)void advanceSavedScene(transportFrame.advance_to_scene_index,transportFrame.seek_local_seconds??0);
 else if(transportFrame.unavailable_reason){if(wasSequence)applySceneView();toast(transportFrame.unavailable_reason);renderAll();}
 else if(transportFrame.completed){if(wasSequence){applySceneView();renderAll();}else transportUI();}
 if(transitionDuration>0){const f=clamp((simTime-transitionStart)/Math.max(.01,transitionDuration),0,1);paintTransition(f);if(f>=1){transitionDuration=0;transitionSnapshot=null;$('transition-canvas').hidden=true;}}
 if(overlayDirty&&!libraryOpen)drawGuides();if(recorder.active){const paperScene={...activeScene(),field:{...activeScene().field,background:native?.background??scene().field.background,palette:native?.palette??scene().field.palette,params:{...scene().field.params,...native?.params}}};const copy=()=>recorder.frame(engine.canvas,paperScene,width,height,captureTransition());try{if(engine.withCleanFrame)engine.withCleanFrame(copy);else copy();}catch(err){recorder.stop();error(err);}}frames++;
 if(now-lastFpsTime>1000){fps=Math.round(frames*1000/(now-lastFpsTime));frames=0;lastFpsTime=now;}
 if(now-lastUI>33){paintSeamBlends(journeyPlaying);document.querySelectorAll<HTMLElement>('[data-transport-readout]').forEach(el=>{el.textContent=transportReadout(workingTransport);});const s=activeScene(),timing=expressionTiming(store.document,sceneIndex,sceneElapsed,journeyPlaying),fraction=clamp(timing.time/timing.total,0,1);$('global-time').textContent=timing.time.toFixed(1)+' / '+timing.total.toFixed(1)+'s';const playhead=$<HTMLInputElement>('expression-playhead');if(playhead&&document.activeElement!==playhead)playhead.value=String(timing.time);$('journey-progress').style.width=fraction*100+'%';document.querySelectorAll<HTMLElement>('[data-scene-progress]').forEach(e=>e.style.width=(Number(e.dataset.sceneProgress)===sceneIndex?fraction*100:0)+'%');
 const nd=engine.telemetry?.()?.drive;const ph=nd?{theta:nd.theta,phi:nd.phi,drive:nd.progress}:phases(s,simTime);document.querySelectorAll<SVGLineElement>('[data-phase]').forEach(e=>e.setAttribute('transform',`rotate(${(e.dataset.phase==='theta'?ph.theta:ph.phi)*180/Math.PI} 50 50)`));if($('drive-value'))$('drive-value').style.width=ph.drive*100+'%';
 const telemetry=engine.telemetry?.();updateAutomationRuntime(telemetry);document.querySelectorAll<HTMLElement>('[data-formation-live]').forEach(el=>{const entity=s.entities.find(v=>v.id===el.dataset.formationLive),state=telemetry?.sequences?.find((v:any)=>v.entityId===entity?.id);if(!entity||!state)return;const a=entity.sequence.steps[state.linkIndex],b=entity.sequence.steps[state.nextIndex];el.textContent=state.linkCount>1?`${a?stateLabel({...a,source:stateSource(entity,state.linkIndex)}):'State'} → ${b?stateLabel({...b,source:stateSource(entity,state.nextIndex)}):'State'} · ${Math.round(state.progress*100)}%`:'Single target';});const effectivePaper={...s,field:{...s.field,background:telemetry?.background??s.field.background,palette:telemetry?.palette??s.field.palette,params:{...s.field.params,...telemetry?.params}}};paintLivePaper(effectivePaper);const params=telemetry?.params??evaluateParameters(s,simTime);for(const panel of [$('belt-content'),$('inspector-content'),$('automation-monitor'),$('context-panel').querySelector<HTMLElement>('.context-content')??$('context-panel')])updateToolbeltValues(panel,s,params,telemetry?.config);const monitored=s.automation.find(l=>l.id===monitoredLane),live=monitored?telemetry?.live?.find((v:any)=>v.id===(monitored.nativeId??monitored.id)):undefined;if(monitored){const monitor=$('automation-monitor'),target=automationTarget(s,monitored!.target),value=target?(target.target.startsWith('field.')?params[target.key]:Number(readPath(telemetry?.config,target.path))/target.factor):live?.value;monitor.querySelector('[data-cycle-hand]')?.setAttribute('transform',`rotate(${(live?.phase??0)*360} 32 32)`);monitor.querySelector('.cycle-progress')?.setAttribute('stroke-dasharray',`${(live?.phase??0)*100} 100`);const label=monitor.querySelector('[data-cycle-value]');if(label)label.textContent=Number(value).toFixed(3);const phase=monitor.querySelector('[data-cycle-phase]');if(phase)phase.textContent=!live?'Paused':live.done?'Done':Math.round(live.phase*100)+'%';}document.querySelectorAll<HTMLElement>('[data-source-status]').forEach(el=>el.textContent=telemetry?.sourceStatus?.[el.dataset.sourceStatus!]??'');const contribution=document.querySelector<HTMLElement>('[data-focus-contribution]');if(contribution){const col=telemetry?.config?.composition;contribution.textContent=`Palette → stored entity tint (${Math.round((selectedEntity()?.tintWeight??0)*(col?.entityTintWeight??1)*100)}%) → ${telemetry?.focus?'travelling focus ('+Math.round((col?.orchestration?.focusTintWeight??0)*100)+'%)':'no focus tint'}. Selection does not retune the field.`;}document.querySelectorAll<HTMLElement>('[data-live-target]').forEach(el=>{const target=automationTarget(s,el.dataset.liveTarget!);if(!target)return;const value=target.target.startsWith('field.')?params[target.key]:readPath(telemetry?.config,target.path);el.textContent=typeof value==='number'?(target.target.startsWith('field.')?value:value/target.factor).toFixed(3):target.value.toFixed(3);});document.querySelectorAll<HTMLElement>('[data-live-param]').forEach(e=>e.textContent=(params[e.dataset.liveParam!]??0).toFixed(2));const ent=selectedEntity();if(ent){const nt=engine.telemetry?.()?.sequences.find((v:any)=>v.entityId===ent.id);const seq=nt?{from:nt.linkIndex}:sequenceAt(ent,s,simTime);document.querySelectorAll<HTMLElement>('[data-step-live]').forEach(e=>e.classList.toggle('is-playing',ent.sequence.enabled&&Number(e.dataset.stepLive)===seq.from));}
 const nf=engine.telemetry?.()?.focus;const focus=nf?{entity:{id:nf.entityId}}:engine.capabilities.kind==='production'?null:focusAt(s,simTime);document.querySelectorAll<HTMLElement>('[data-focus-entity]').forEach(e=>e.classList.toggle('is-playing',e.dataset.focusEntity===focus?.entity.id));if(recorder.active){const t=Math.floor(recorder.elapsed);$('record-time').textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');$('record-size').textContent=`${captureSettings.width}px · ${fps} render fps`;if(t>=4&&fps>0&&fps<20&&!recordPerformanceWarned){recordPerformanceWarned=true;toast('Recording is below its 30 fps target. Reduce particle allocation or output size for this device.',7000);}}nativeEditorEndpoint?.publish();lastUI=now;
 }
 rafId=requestAnimationFrame(tick);
}
window.addEventListener('resize',()=>{if(recorder.active){recorder.stop();toast('Recording stopped to preserve its established frame after a window resize.');}resize();});document.addEventListener('visibilitychange',()=>{lastTime=performance.now();if(document.hidden)draftSchedule.flushNow('hidden');if(document.hidden&&propertyTake)finishPropertyTake();if(document.hidden&&recorder.active){recorder.stop();toast('Recording stopped because this tab became hidden.');}});
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
// T11: the in-frame return from a journey crossing. `crossingStands` is true while the Expression reading stands on a beat the journey entered.
let crossingStands=false;
let crossingReturnEl:HTMLElement|undefined;
let hostMode:'expressions'|'techne'|'live'=new URLSearchParams(location.search).get('mode')==='techne'?'techne':new URLSearchParams(location.search).get('mode')==='live'?'live':'expressions';
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
  // The Technē lens the frame stands in (the masthead chooser). Read here, not in the literal: a call before the chooser exists omits it rather than throwing out of the announcement.
  let lens:LensId|undefined;try{lens=lensStudio.active();}catch{lens=undefined;}
  const instrument=announcedInstrument();
  // E22 (ticket P, G3): where the frame stands, as its own link names it; absent until the opening link has settled.
  const address=hostAddress();announcedAddress=JSON.stringify(address??null);
  const state={...(lens?{lens}:{}),...(instrument?{instrument}:{}),...(address?{address}:{}),nativeScene:view&&binding?{expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref}:undefined,document:awaitingNativeBoot&&!nativeWorkspace?.nativeView()?undefined:{id:nativeWorkspace?.nativeView()?.document.expression_ref??store.document.id,name:store.document.name},sceneIndex,sceneCount:store.document.scenes.length,sceneName:s.name,sceneState:sceneSaveState(store.document,s),
   selection:selected.map(id=>{const e=scene().entities.find(v=>v.id===id);return {id,name:e?e.name:undefined};}),tool,playing:scenePlaying,journeyPlaying,fieldPaused,libraryOpen,hostMode,presentsInstrument:hostMode==='live',recording:recorder.active,presenting,automationLoop,propertyRecording:!!propertyTake,propertyPreview:trackPreview,automationHeld:liveOverrides.heldCount(),takeMode:appendTake?'append':'replace',stage:{mode:camera.mode,grid:camera.grid,snap:camera.snap,guides:guidesVisible,tool,repeatPins:pinRepeat,videoTake:!!currentVideo}};
  window.parent.postMessage({v:1,kind:'oi-app-state',state},'*');
  nativeEditorEndpoint?.publish();
 }catch{/* nothing is announced rather than a wrong position */}
}
/** The native instrument as the frame announces it (ticket T-LIVE-TORUS-INSTRUMENT). Read here, never from a stale copy; absent while no session is open, and never a throw out of the announcement. */
function announcedInstrument(){
 try{return nativeField?announceInstrument(nativeField.controller.reading):undefined;}catch{return undefined;}
}
// The Live cut (mode 'live'): the native M1 body presented full-stage, through the same NativeFieldController the Studio's Live instrument runs.
// Chrome that belongs to the Expressions and Technē cuts is concealed by the body class; the Studio opens on the native section.
/** T11: the in-frame return control, built once. It is the Return-to-scene header of SceneSourcePortal, placed as a source is. */
function crossingReturnNode():HTMLElement{
 if(crossingReturnEl)return crossingReturnEl;
 const node=document.createElement('section');
 node.className='scene-source-portal crossing-return';node.setAttribute('role','region');node.setAttribute('aria-label','Journey crossing');node.hidden=true;
 node.style.left='24px';node.style.bottom='42px';node.style.width='min(360px,calc(100vw - 48px))';
 node.innerHTML='<header><strong></strong><button type="button">Return to journey</button></header>';
 node.querySelector('button')!.addEventListener('click',returnToJourney);
 document.body.append(node);crossingReturnEl=node;return node;
}
/** T11: shows the control while the Expression reading stands on a crossed beat; hidden otherwise. */
function syncCrossingReturn(){
 const node=crossingReturnNode();
 node.hidden=!(crossingStands&&hostMode==='expressions');
 const title=node.querySelector('strong');if(title)title.textContent=scene().name||'Scene';
}
/** T11: the one return from a crossing. It takes the route a lens press takes: Technē mode activates the active lens, and the journey lens
 * runs its return (activateInstrument('journey') → returnFromCrossing → writeJourneyReturn). Nothing else returns from a crossing. */
function returnToJourney(){
 if(!crossingStands)return;
 crossingStands=false;syncCrossingReturn();
 setHostMode('techne');
 if(lensStudio.active()!=='journey')lensStudio.select('journey');
}
function setHostMode(mode:'expressions'|'techne'|'live'){
 if(hostMode===mode)return;
 hostMode=mode;
 if(mode!=='expressions'&&crossingStands){crossingStands=false;syncCrossingReturn();}
 document.body.classList.toggle('oi-host-techne',mode==='techne');
 document.body.classList.toggle('oi-host-live',mode==='live');
 renderRail();
 lensStudio.setMode(mode==='techne'?'techne':'expressions');
 if(mode!=='techne'){researchInstruments?.close();palaceInstrument.close();journeyInstrument?.close();journeyHome.hidden=true;setInstrumentSurface(null);}else activateInstrument(lensStudio.active());
 if(mode==='live'&&nativeField){studioSection='native';tab='field';setStudio(true);nativeField.openLive();}
 if(mode!=='live')nativeField?.leaveLive();
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
let pendingHostOpen:{ref:string;recovery?:unknown}|null=null,hostOpenArmed=false;
let hostThemeReadingKey='';
function openHostExpression(ref:string,recovery?:unknown){
 if(typeof ref!=='string'||!ref.startsWith('expression:'))return;
 if(kernelExpressionsAvailable()){openKernelCopy(ref,localCopyFallbackFor(ref),recovery);return;}
 // Buffer the LATEST ref and arm exactly one announce listener (not one per
 // pre-ready call), so repeated posts before the channel is up converge to a
 // single last-wins open and no message listeners accumulate.
 pendingHostOpen={ref,recovery};
 if(hostOpenArmed)return;
 hostOpenArmed=true;
 window.addEventListener('message',function ready(event){if(event.source===window.parent&&event.data?.v===1&&event.data?.kind==='oi-kernel-channel'){window.removeEventListener('message',ready);hostOpenArmed=false;const r=pendingHostOpen;pendingHostOpen=null;if(r)openKernelCopy(r.ref,localCopyFallbackFor(r.ref),r.recovery);}});
}
// Stage controls the shell drives (stageCommands.ts). Each runs the application's
// own action body; the file download or picker stays here, in the frame's gesture.
function stageCaptureSettings(settings?:StageCaptureSettings){
 if(!settings)return;
 if(settings.width!==undefined)captureSettings.width=settings.width;
 if(settings.aspect!==undefined)captureSettings.aspect=settings.aspect;
 if(settings.includeText!==undefined)captureSettings.includeText=settings.includeText;
 if(settings.transparent!==undefined)captureSettings.transparent=settings.transparent;
 // readCapture() copies the Image suite's controls back over captureSettings, so the controls follow the request.
 const width=document.getElementById('capture-width') as HTMLSelectElement|null,aspect=document.getElementById('capture-aspect') as HTMLSelectElement|null;
 const text=document.getElementById('capture-text') as HTMLInputElement|null,transparent=document.getElementById('capture-transparent') as HTMLInputElement|null;
 if(width&&settings.width!==undefined)width.value=String(settings.width);
 if(aspect&&settings.aspect!==undefined)aspect.value=settings.aspect;
 if(text&&settings.includeText!==undefined)text.checked=settings.includeText;
 if(transparent&&settings.transparent!==undefined)transparent.checked=settings.transparent;
}
async function runStageCommand(command:StageCommand){
 const body=document.body;
 switch(command.command){
  case 'view':await action(command.action,body);break;
  case 'present':await action(command.on?'present':'exit-present',body);break;
  case 'export':await action({json:'export-json',native:'export-native',html:'export-artifact'}[command.format],body);break;
  case 'import':await action('import',body);break;
  case 'janko':
   // A Jankó chord: the owner's own played voices, struck through the native owner (nativeField.ts playJanko). Never synthesised.
   if(!nativeField)throw new Error('This application has no native instrument.');
   await nativeField.playJanko(command.pitch_classes,command.amplitude);
   break;
  case 'instrument':
   // The Live instrument's edits run the native field's own controller operations (nativeField.ts command): the same path as the Studio's controls.
   if(!nativeField)throw new Error('This application has no native instrument.');
   await nativeField.command(command.edit);
   break;
  case 'live':
   // The streamed set returns before the announce below: it writes no document and must not trigger a shell read at 20 Hz.
   if(command.action==='set'){liveOverrides.setDrag(command.target,command.value);needsFrame=true;return;}
   if(command.action==='release'){if(liveOverrides.releaseDrags())needsFrame=true;break;}
   if(!scene().automation.some(lane=>lane.target===command.target&&lane.enabled))throw new Error('No enabled automation drives this parameter, so there is nothing to hold.');
   liveOverrides.hold(command.target,command.value);needsFrame=true;break;
  case 'automation':
   // Resume hands every manually held parameter back to its automation (runtime only; no document change).
   if(command.action==='resume'){if(!liveOverrides.resume())throw new Error('No parameter is held off its automation.');needsFrame=true;break;}
   // Play runs the one-shot ramps that are enabled now (the app's fireAutomations); loop sets the runtime loop flag, which is not a document value.
   if(command.action==='play'){if(!oneShotGroups(scene()).length)throw new Error('This scene has no enabled one-shot automation to play. Enable a one-shot group first.');fireAutomations();break;}
   automationLoop=command.on;if(automationLoop&&!fieldPaused&&!automationRunning())fireAutomations(true);renderAll();break;
  case 'capture':
   if(command.mediaKind==='png'){stageCaptureSettings(command.settings);await action('capture-image',body);break;}
   // record-video toggles, so a start while recording and a stop while idle are refused here, not flipped.
   if(command.action==='stop'){if(!recorder.active)throw new Error('No recording is running.');await action('stop-record',body);break;}
   // The take is saved by the application's own save-video body. Without Physis that body downloads, and a download needs a click inside this frame: the take opens for review there instead.
   if(command.action==='save'){
    if(!currentVideo)throw new Error('No recording take to save.');
    if(!physisHost()){$<HTMLDialogElement>('video-dialog').showModal();throw new Error('The take is open for review. Choose Save recording there: a download needs a click inside the application.');}
    await action('save-video',body);break;
   }
   if(recorder.active)throw new Error('A recording is already running.');
   stageCaptureSettings(command.settings);await action('record-video',body);break;
  case 'tool':
   // Rail tools toggle, so choosing the active pin tool keeps it; a repeat change must never switch placement off.
   if(!(command.tool==='pin'&&tool==='pin'))activateRail(command.tool);
   if(command.repeat!==undefined){if(tool!=='pin')throw new Error('Repeat applies to the Pin tool only.');pinRepeat=command.repeat;setHint();}
   break;
  case 'engine': {
   const refusal=stageRefusal(command);if(refusal)throw new Error(refusal);
   if(!engine.command)throw new Error('This field takes no runtime commands in this application.');
   // Reset runs the engine body directly: the shell's two-step confirmation is the gesture, so the application's own confirm dialog is not opened.
   if(command.action==='reset'){engine.command({type:'reset-field'});needsFrame=true;break;}
   await action({disperse:'native-disperse','reset-phases':'native-reset-phases',recover:'native-recover'}[command.action],body);break;
  }
  case 'take': {
   // record-properties toggles, so start and stop are each checked here and never flipped. Refusals reuse the application's own messages.
   if(command.action==='stop'){if(!propertyTake)throw new Error('No property take is recording.');await action('record-properties',body);break;}
   if(propertyTake)throw new Error('A property take is already recording.');
   if(recorder.active)throw new Error('Stop the video recording before a property take.');
   if(sceneEditHeld||researchInstruments?.active())throw new Error('Finish the open Scene edit or research instrument before a property take.');
   if(!recordableTracks().length)throw new Error('Add local numeric properties to the toolbelt. Shared overrides must be made local before recording.');
   if(appendTake!==(command.mode==='append'))await action('take-mode',body);
   await action('record-properties',body);
   if(!propertyTake)throw new Error('This scene has reached its one-hour duration limit.');
   break;
  }
  case 'tracks':
   // take-mode and preview-tracks toggle, so each command sets the state it names and never flips it.
   if(command.action==='preview'){
    if(propertyTake)throw new Error('Finish the property take before previewing its tracks.');
    if(!scene().propertyTracks?.length)throw new Error('This scene has no recorded property tracks.');
    if(!trackPreview)await action('preview-tracks',body);
   }else if(trackPreview)await action('preview-tracks',body);
   break;
 }
 announceHostState();
}
async function answerStageCommand(raw:Record<string,unknown>){
 const parsed=readStageRequest(raw);
 if(!parsed){if(Number.isSafeInteger(raw.req)&&Number(raw.req)>0)window.parent.postMessage(stageReplyMessage(Number(raw.req),{ok:false,error:'This stage command is outside the shell vocabulary'}),'*');return;}
 const {req,command}=parsed;
 try{await runStageCommand(command);window.parent.postMessage(stageReplyMessage(req,{ok:true},command),'*');}
 catch(error){window.parent.postMessage(stageReplyMessage(req,{ok:false,error:error instanceof Error?error.message:String(error)},command),'*');}
}
// The host's open-studio command opens a section with the nav button's own
// placement (studioPlacement) and state; the Inspector opens only when closed.
function openStudioSection(section:StudioSection){
 const placed=studioPlacement(section);
 if(!inspectorOpen||!editing)edit(true,placed.tab);
 studioSection=section;instrumentOffered=true;tab=placed.tab;motionTab=placed.motionTab;search='';$<HTMLInputElement>('control-search').value='';renderAll();$('inspector-content').scrollTop=0;
}
window.addEventListener('message',ev=>{if(ev.source!==window.parent)return;const d=ev.data as {type?:string;width?:number;height?:number;right?:number;coveredRight?:number;appearance?:unknown;theme?:unknown;v?:unknown;kind?:unknown;mode?:unknown;command?:unknown;ref?:unknown;recovery?:unknown;req?:unknown;target?:unknown;source?:unknown}|null;
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
 if(d&&d.v===1&&d.kind==='host-mode'&&(d.mode==='expressions'||d.mode==='techne'||d.mode==='live')){const world=(d as {world?:unknown}).world;if(typeof world==='string'&&world.length<=64)worldLens=world;setHostMode(d.mode);announceHostState();return;}
 if(d&&d.v===1&&d.kind==='host-command'){
  if(d.command==='interact'||d.command==='select')activateRail(d.command);
  else if(d.command==='open-expression'&&typeof d.ref==='string'){if((d as {refresh?:unknown}).refresh===true&&kernelExpressionsAvailable())void nativeWorkspace?.refreshReference(d.ref,d.recovery);else openHostExpression(d.ref,d.recovery);}
  else if(d.command==='open-local-draft'&&typeof (d as {id?:unknown}).id==='string')void openBrowserDraft((d as {id:string}).id);
  else if(d.command==='lens'&&typeof (d as {lens?:unknown}).lens==='string'&&['project','canvas','timeline','journey','place','palace'].includes((d as {lens:string}).lens)){
   const lens=(d as {lens:LensId}).lens,ref=(d as {ref?:unknown}).ref;
   if(hostMode!=='techne')setHostMode('techne');
   // Seam B: a lens press that carries an object ref focuses that object in the instrument it opens. A press with no ref is unchanged.
   if(typeof ref==='string'&&ref.length>0&&ref.length<=512){
    if(lens==='project')toast(`${ref} is not carried into the Project lens yet.`,8000);
    carriedFocus={lens,ref};
    try{lensStudio.select(lens);}finally{carriedFocus=null;}
   }else lensStudio.select(lens);
  }
  else if(d.command==='refresh-expression'&&typeof d.ref==='string')void nativeWorkspace?.refreshReference(d.ref,d.recovery);
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
  else if(d.command==='open-studio'){
   const section=(d as {section?:unknown}).section;
   const offered=isStudioSection(section)&&!!document.querySelector(`[data-action="studio-section"][data-value="${section}"]`);
   if(isStudioSection(section)&&offered){openStudioSection(section);announceHostState();window.parent.postMessage({v:1,kind:'host-command-result',command:'open-studio',ok:true,section},'*');}
   else window.parent.postMessage({v:1,kind:'host-command-result',command:'open-studio',ok:false,error:isStudioSection(section)?'This Studio section is not offered in this application cut':'Unknown Expressions Studio section'},'*');
  }
  else if(typeof d.command==='string'&&(STAGE_COMMANDS as readonly string[]).includes(d.command))void answerStageCommand(d as Record<string,unknown>);
  else console.warn('[oi] refused host command: '+String(d.command));
  return;
 }
});
// lane-3 E17/E19: quit flushes the draft (with its Library copy) and, once nothing is pending, marks the session closed cleanly.
// beforeunload can be cancelled by the page's own prompt, so only pagehide (the page is going away) may mark the exit clean.
function quitDraft(markClean:boolean){
 lastLibraryWrite=0;
 // T-REVIEW-6: while the boot's recovery choice is open the draft is held. Nothing is written and the exit stays unclean, so the offer returns on the next start.
 if(recoveryOfferOpen)return;
 // Nothing pending and no gesture open: the draft already holds the document, so the clean mark is written in this handler. An unload can cut an asynchronous flush short, which would leave a clean exit reported as unclean.
 if(markClean&&draftSchedule.pending()===0&&!store.transactionOpen){try{markSessionClosed(localStorage,new Date());}catch{/* An unavailable store leaves the mark open: the next start treats it as unclean. */}}
 // Otherwise the flush is written, and the mark follows only if it lands with nothing pending. A flush the unload cuts short leaves the mark open, which is honest.
 void draftSchedule.flushNow('quit').then(()=>{if(markClean&&!recoveryOfferOpen&&draftSchedule.pending()===0&&!store.transactionOpen){try{markSessionClosed(localStorage,new Date());}catch{/* An unavailable store leaves the mark open: the next start treats it as unclean. */}}}).catch(()=>undefined);
}
window.addEventListener('pagehide',()=>{if(propertyTake)finishPropertyTake();recorder.stop();quitDraft(true);});
window.addEventListener('beforeunload',()=>quitDraft(false));
// A page restored from the back-forward cache is running again: it is open until its next pagehide.
window.addEventListener('pageshow',ev=>{if(ev.persisted){try{markSessionOpen(localStorage,new Date());}catch{/* unavailable storage: see readUncleanExit */}}});
// A rail switch is a context switch: the departing draft is written before the rail changes.
document.addEventListener('click',ev=>{if((ev.target as Element|null)?.closest?.('[data-rail]'))draftSchedule.flushNow('rail');},true);
const nativeField=installNativeField(engine,()=>{fieldPaused=false;needsFrame=true;renderAll();});
// Without a retaining engine there is no native producer to present; the
// Studio nav offers no dead "Live instrument" entry for it.
if(!nativeField)document.querySelector('[data-action="studio-section"][data-value="native"]')?.remove();
window.__FIELD_STUDIES__={getDocument:()=>clone(store.document),draftPending:()=>draftSchedule.pending(),getState:()=>({studioOpen,beltOpen,needsFrame,libraryOpen,librarySection,modesOpen,captureOpen,railKey,railExpanded,sceneIndex,selected:[...selected],textId,editing,inspectorOpen,timelineOpen,tool,simTime,sceneElapsed,playing:scenePlaying,scenePlaying,fieldPaused,journeyPlaying,automationLoop,camera:{...camera},fps,recording:recorder.active,pointerActive:pointer.active,engine:engine.capabilities.name,hostMode,activeLens:lensStudio.active()}),project:(v:Vec3)=>project(v,camera,width,height),unproject:(x:number,y:number)=>unproject(x,y,camera,width,height),selectEntity:(id:string)=>selectEntity(id),setScene:(reference:string|number)=>{if(typeof reference==='string')return focusNativeSceneRef(reference);toast('Index-based Scene navigation is a compatibility call; native navigation accepts a Scene reference.');setSceneRef(sceneRefAt(reference));},openEditor:(t:InspectorContext['tab'])=>edit(true,t),pause:()=>{fieldPaused=true;needsFrame=true;renderAll();},play:()=>{fieldPaused=false;needsFrame=true;renderAll();},native:()=>nativeField?.controller.reading,nativeTargets:()=>nativeField?.controller.inspectTargets(),
 // Acceptance probe: advance resident particle mechanics by fixed steps against
 // the targets already presented. No native request, clock or target write.
 probeSteps:(frames:number,dt:number)=>{if(!Number.isInteger(frames)||frames<1||frames>2000||!(dt>0&&dt<=.1))throw new Error('probe steps: 1–2000 frames of (0, 0.1] s');for(let i=0;i<frames;i++)engine.render(frameData(dt));needsFrame=true;return frames;},dispose:()=>{sceneTransportAlive=false;sceneIntentEpoch++;researchInstruments?.destroy();nativeEditorEndpoint?.dispose();nativeField?.dispose();cancelAnimationFrame(rafId);coverObserver?.disconnect();engine.dispose();},command:(cmd:any)=>{engine.command?.(cmd);needsFrame=true;},capabilities:engine.capabilities,inspect:(read=false)=>engine.inspect?.(read),telemetry:()=>engine.telemetry?.(),nativeProject:(v:Vec3)=>engine.projectNative?.(v),capture:(w:number,h:number)=>engine.capture?.(w,h)};
/** E15/E16: an owner adoption names its history. 'act' is the app's own native act: one labelled step carrying
 * the kernel edit it produced. 'outside' is an adoption from outside this editor, labelled for what it is. */
function applyNativeView(view:KernelConversion,preservePosition=false,adoptionHistory:NativeAdoption='record',act?:NativeActRecord){
 // E19: a native load may have kept or opened drafts, so the owner's kept-drafts listing is read again the next time the Library shows it.
 ownerListing=null;
 if(!journeyPositionRestored&&journeyInstrument)void journeyInstrument.restorePosition().then(settled=>{if(settled)journeyPositionRestored=true;});
 awaitingNativeBoot=false;
 // An opened native Expression is what the frame stands on: the entry gate
 // closes and (unless the caller keeps its position) the engine presents the
 // document's current Scene.
 const presented=presentAdoption(view);closeEntryGate();
 const oldScene=scene().id,oldCamera={...camera},oldTime=sceneElapsed,oldSelection=[...selected],oldPlaying=journeyPlaying;
 const acknowledgement=adoptionHistory==='acknowledge'?nativeAdoptionHistory(view,store.document):'preserve';
 if(!preservePosition)applyJourney(view.journey,true,adoptionHistory==='acknowledge'?'acknowledge':'record',acknowledgement);
 else {
  const incoming=initialiseSceneSaves(initialiseBelts(view.journey));
  if(adoptionHistory==='acknowledge')store.acknowledge(incoming,acknowledgement);
  else if(adoptionHistory==='act'&&act)store.recordNativeAct(act.label,incoming,act.record);
  else store.recordOutsideUpdate(KERNEL_UPDATE_LABEL,incoming,OUTSIDE_UPDATE_REASON);
 }
 const desired=preservePosition?oldScene:presented.sceneId;
 sceneIndex=Math.max(0,store.document.scenes.findIndex(s=>s.id===desired));
 if(preservePosition){camera=oldCamera;sceneElapsed=oldTime;selected=oldSelection.filter(id=>scene().entities.some(e=>e.id===id));journeyPlaying=oldPlaying;}
 else {applySceneView();const nativeRef=view.document.selection?.entity_ref;const occurrence=view.bindings[scene().id]?.occurrences.find(o=>o.entity_ref===nativeRef);selected=occurrence?[occurrence.view_entity_id]:[];}
 markSaved();renderAll();announceHostState();void researchInstruments?.refresh();void journeyInstrument?.refresh();void palaceInstrument.refresh();
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
// Seam B: the object ref a lens press carries, for the one press that is selecting its lens (set and cleared around lensStudio.select).
let carriedFocus:{lens:LensId;ref:string}|null=null;
function activateInstrument(lens:LensId){
 const carried=carriedFocus?.lens===lens?carriedFocus.ref:undefined;
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
 if(lens==='canvas'||lens==='timeline'||lens==='place'){if(propertyTake)finishPropertyTake();if(recorder.active){recorder.stop();toast('Recording stopped before opening the research instrument.');}void researchInstruments?.open(lens==='canvas'?'m1':lens==='timeline'?'m2':'m4',carried);}
 else researchInstruments?.close();
 if(lens==='project'){sequenceOpen=false;timelineOpen=false;inspectorOpen=false;contextKind='';beltPickerOpen=false;}
 if(lens==='journey'){sequenceOpen=false;timelineOpen=true;inspectorOpen=false;contextKind='';beltPickerOpen=false;}
 journeyHome.hidden=lens!=='journey';
 if(lens==='journey')void journeyInstrument?.open().then(()=>journeyInstrument?.returnFromCrossing()).then(()=>carried===undefined?undefined:journeyInstrument?.focusBeat(carried)); // T11: a crossed beat returns by ref, through the owner.
 else journeyInstrument?.close();
 if(lens==='place'){editing=true;inspectorOpen=true;contextKind='';tab='field';studioSection='places';}
 if(lens==='palace'){if(propertyTake)finishPropertyTake();editing=true;inspectorOpen=true;contextKind='';tab='field';studioSection='palace';void palaceInstrument.open(carried);}
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
// The owner-write hold while a .canvas import is open: nativeWorkspace refuses every other owner write by name. The import's own
// act and rollback pass it (asCanvasImportOwnerCall), as they are the only owner calls its gesture makes.
let canvasImportOwnerCall=false;
function ownerWriteRefusal():string|null{const label=store.spanningLabel;if(label===null||canvasImportOwnerCall)return null;return `${label} is in progress: this change waits until its native owner acknowledges it.`;}
function asCanvasImportOwnerCall<T>(call:()=>T):T{canvasImportOwnerCall=true;try{return call();}finally{canvasImportOwnerCall=false;}}
nativeWorkspace=installNativeWorkspace({shouldRetainDraft:()=>!awaitingNativeBoot||store.revision!==0,anchor:()=>store.kernelSaveAnchor(),recordSave:(anchor,checkpoint)=>{if(!store.attachKernelCheckpoint(anchor,checkpoint))toast('Saved. Undo cannot reverse this Save on the native owner, because the step it began from has moved.',7000);},snapshot:()=>({journey:clone(store.document),sceneId:scene().id,entityId:selected[0]??null}),version:()=>store.revision,load:applyNativeView,toast,gate:ownerWriteRefusal,refresh:()=>{needsFrame=true;renderAll();},summon:(kind,subject)=>hostRequest({request:'summon',detail:{kind,subject}}),correspondence:(rows,selection)=>{nativeConnectionRows=rows;nativeSelectedRelation=selection;needsFrame=true;},status:showNativeStatus,chooseRecovery:request=>askRecoveryChoice(request.draft,{...request.offer,revision:request.revision}),followed:(_ref,readThrough)=>{const panels=followedPanels(readThrough);if(panels.sequence!==null)sequenceOpen=panels.sequence;if(panels.inspector!==null)inspectorOpen=panels.inspector;renderAll();}});
const retainedEditor=createRetainedNativeEditor({
 store,sceneId:()=>scene().id,nativeView:()=>nativeWorkspace?.nativeView(),
 selection:()=>({entity_ids:[...selected],step_id:scene().entities.find(e=>e.id===selected[0])?.sequence.steps[stepIndex]?.id??null}),
 nativeSelect:async(sceneId,entityId)=>await nativeWorkspace!.select(sceneId,entityId),
 commit:async()=>await commitNativeRecorded(),change:(label,mutate)=>changed(mutate,true,label),
 afterHistory:()=>{applySceneView();markSaved();overlayDirty=true;needsFrame=true;renderAll();},
 selectLocal:(entityId,index)=>{selected=entityId===null?[]:[entityId];stepIndex=index;overlayDirty=true;needsFrame=true;renderAll();},
 openEditor:(editor,entityId,index)=>{
  selected=[entityId];stepIndex=index;pointer.active=false;editing=true;
  libraryOpen=false;dropFocusMode();contextKind='';beltPickerOpen=false;timelineOpen=false;shapePickerOpen=false;modesOpen=false;inspectorOpen=false;studioOpen=false;placementStep=false;cursorTool='select';tool='select';
  if(editor==='placement'){captureOpen=false;sequenceOpen=false;placementStep=true;cursorTool='select';tool='select';camera.grid=true;renderAll();}
  else if(editor==='source'){sequenceOpen=false;captureOpen=true;renderAll();}
  else{captureOpen=false;sequenceOpen=true;renderAll();const layers=$('live-content').querySelector<HTMLDetailsElement>('.live-layers');if(layers){layers.open=true;layers.scrollIntoView({block:'nearest'});}}
 },
 standing:()=>({busy:nativeState?.busy??false,notice:nativeState?.text??null}),
 telemetry:()=>engine.telemetry?.(),fieldPaused:()=>fieldPaused,
 editScenes:async(request,isCurrent)=>{
  if(sceneEditHeld)throw Error('A native Scene edit is already awaiting acknowledgement');
  if(recorder.active)throw Error('Finish the active capture before changing Scene structure');
  const presented=scene(),intent=sceneIntentEpoch;
  sceneEditHeld=clone(presented);
  const handler=createNativeSceneEditHandler({store,sceneId:()=>scene().id,intentEpoch:()=>sceneIntentEpoch,lifetime:()=>sceneTransportAlive,
   afterSuccess:({scene_id,entity_id,selection_changed})=>{
    sceneEditHeld=null;sceneIndex=store.document.scenes.findIndex(value=>value.id===scene_id);
    if(sceneIndex<0)throw Error('The acknowledged Scene is absent from its native view');
    selected=entity_id?[entity_id]:[];
    if(selection_changed){sceneIntentEpoch++;journeyPlaying=false;scenePlaying=false;sceneElapsed=0;stepIndex=0;applySceneView();}
    else if(sceneElapsed>scene().duration){sceneElapsed=scene().duration;scenePlaying=false;}
    awaitingNativeBoot=false;markSaved();overlayDirty=true;needsFrame=true;renderAll();announceHostState();
   }});
  try{
   const result=await nativeWorkspace!.editScenes((working,current)=>handler.edit(request,{working,isCurrent:()=>current()&&isCurrent()&&sceneTransportAlive}));
   if(result.state==='native-acknowledged')throw new NativeSceneEditRefusal(result.error,result.native_outcome);
  }finally{
   sceneEditHeld=null;lastTime=performance.now();
   if(sceneIntentEpoch===intent){const index=store.document.scenes.findIndex(value=>value.id===presented.id);if(index>=0)sceneIndex=index;}
   markSaved();renderAll();announceHostState();
  }
 },
 // Scene body and jump-trigger receiver (O:I #352): one gesture, one native edit. A body the host can resolve is read first (text or
 // image, as the inspector reads it); the planner then runs inside nativeWorkspace.edit against the flushed view, whose revision is the CAS.
 editSceneMaterial:async(request,isCurrent)=>{
  if(recorder.active)throw Error('Finish the active capture before changing Scene material');
  const requirement=sceneMaterialReadRequirement(request.intent);
  if(requirement.kind==='refuse')throw Error(requirement.problem);
  if(!nativeWorkspace?.nativeView())throw Error('Open this Scene as a native Expression first.');
  const resolved=requirement.kind==='read'?await prepareNativeSceneBody(requirement.carrier,requirement.subject_ref,requirement.span):undefined;
  if(!isCurrent())throw Error('The Scene changed while its material was read. Review the current Scene and choose again.');
  let label='';
  await nativeWorkspace!.edit(current=>{
   if(!isCurrent())throw Error('The Scene changed before its material was written. Nothing was written.');
   const plan=prepareNativeSceneMaterialEdit(current,request.basis,request.intent,resolved);
   label=plan.label;
   return plan.changes;
  },()=>label);
  toast(`${label}.`);
 },
 // Blueprint receiver (O:I #352): the host already validated and preflighted one fully resolved BlueprintIntent; the same
 // nativeWorkspace.blueprint call the blueprint HUD uses submits it, so the captured revision CAS and adoption law are unchanged.
 editBlueprint:async(intent,isCurrent)=>{
  if(recorder.active)throw Error('Finish the active capture before changing the blueprint');
  if(!nativeWorkspace?.nativeView())throw Error('Open this Scene as a native Expression first.');
  if(!isCurrent())throw Error('The Scene changed before its blueprint was written. Nothing was written.');
  await nativeWorkspace!.blueprint(intent);
  toast('Blueprint updated.');
 },
 sceneControls:{
  read:()=>({scene_ref:nativeWorkspace?.nativeView()?.bindings[scene().id]?.scene_ref??'',scene_elapsed_seconds:sceneElapsed,expression_time_seconds:expressionTiming(store.document,sceneIndex,sceneElapsed,journeyPlaying).time,scene_playing:scenePlaying,saved_sequence_playing:journeyPlaying,field_paused:fieldPaused,track_preview:trackPreview,intent_epoch:sceneIntentEpoch}),
  recording:()=>!!propertyTake,transitionPending:()=>sceneAdvancePending,
  focus:sceneId=>{const index=store.document.scenes.findIndex(s=>s.id===sceneId);if(index<0)throw Error('The acknowledged Scene is no longer present');if(index===sceneIndex){sceneIntentEpoch++;selected=[];stepIndex=0;renderAll();}else setSceneRef(sceneId);},
  transport:action=>{if(action==='play-saved'||action==='stop-saved')setSavedScenePlay(action==='play-saved');else if(action==='pause'){sceneIntentEpoch++;scenePlaying=false;transportUI();}else{if(journeyPlaying){journeyPlaying=false;applySceneView();scenePlaying=false;}if(!scenePlaying)toggleScenePlay();else sceneIntentEpoch++;}},
  seek:seekWorkingScene,snapshot:snapshotScene,
 },
});
const sourceSelection=createSourceEditorSelection({
 context:()=>({owner:retainedEditor,nativeOwner:nativeWorkspace??null,navigation:journeyNavigation,sourceEpoch:sourceEditorEpoch,
  visible:sceneTransportAlive&&!document.hidden&&!presenting&&!libraryOpen
   &&!window.frameElement?.closest('[hidden],[inert]')
   &&(captureOpen&&!$('capture-panel').hidden||sequenceOpen&&!$('live-workspace').hidden),reading:retainedEditor.read()}),
 select:(request,isCurrent)=>retainedEditor.select(request,isCurrent),
});
async function selectSourceState(el:HTMLSelectElement){
 const source=el.closest('#capture-panel,#live-content');if(!source||source.closest('[hidden],[inert]'))return;
 const entity=el.dataset.action==='source-entity'?scene().entities.find(row=>row.id===el.value&&row.kind==='formation'):selectedEntity();
 const index=el.dataset.action==='source-step'?Number(el.value):0,step=Number.isInteger(index)&&index>=0?entity?.sequence.steps[index]:undefined;
 const epoch=sourceEditorEpoch,previous=el.dataset.action==='source-entity'?selected[0]??'':String(stepIndex);
 try{if(!entity||!step)throw Error('This stable source state is no longer present');await sourceSelection.select(entity.id,step.id);}
 catch(cause){if(sceneTransportAlive&&sourceEditorEpoch===epoch&&el.isConnected&&!source.closest('[hidden],[inert]')){el.value=previous;toast(cause instanceof Error?cause.message:String(cause));}}
}
const materialEditor=createNativeMaterialController({
 reading:retainedEditor.read,journey:()=>store.document,nativeView:()=>nativeWorkspace?.nativeView(),
 flush:async()=>{if(!await commitNativeRecorded())throw Error(nativeState?.text??'The native material destination could not be committed');},
 expressionRequest:nativeExpressionRequest,worldRequest:request=>worldRequest({...request}),
 advance:basis=>{
  if(!sameEditorBasis(retainedEditor.read().basis,basis))return Promise.resolve(false);
  return nativeWorkspace?.advance(()=>{const current=retainedEditor.read().basis;return current.expression_ref===basis.expression_ref&&current.scene_ref===basis.scene_ref&&current.authored_revision===basis.authored_revision;})??Promise.resolve(false);
 },
 transition:actTransition,
});
nativeEditorEndpoint=installNativeEditorReceiver({...retainedEditor,material:request=>requestNativeMaterialEditor(materialEditor,request,()=>retainedEditor.read().basis)});
async function focusNativeSceneRef(scene_ref:string){
 const reading=retainedEditor.read();
 if(!reading.playback)throw Error('The native Scene transport is unavailable');
 await retainedEditor.scene({operation:'scene',basis:reading.basis,intent_epoch:reading.playback.intent_epoch,action:'focus',scene_ref},()=>sceneTransportAlive);
 return retainedEditor.read();
}
// Acts & reusable material (EXPRESSION-ACT-MATERIAL-V1): roles on this Scene's
// objects/text, save-as-reusable, the material register and act playback,
// beside the saved-scene playback.
installActPanel({journey:()=>store.document,scene,selected:()=>selected,changed:fn=>changed(fn,true,'Set role'),
 nativeView:()=>nativeWorkspace?.nativeView(),
 nativeEdit:async changes=>{if(!nativeWorkspace?.nativeView())throw new Error('Save this Expression to a Central file first: its native Expression is not open.');await nativeWorkspace.edit(changes,'Edit expression');},
 expressionRequest:nativeExpressionRequest,advance:async()=>await nativeWorkspace?.advance()??false,transition:actTransition,toast});
// ES1A/ES1B (O:I #352): the active native Scene's own body and its
// declarative triggers, laid over the live field as real readable material.
sceneBodies=installSceneBodies({
 nativeView:()=>nativeWorkspace?.nativeView(),
 sceneId:()=>scene().id,
 portal:(trigger,basis)=>openScenePortal(trigger.trigger_ref,basis),
 report:message=>toast(message),
 open:ref=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];if(!view||!binding){toast('Open a native Scene before opening its source.');return;}hostRequest({request:'summon',detail:{kind:'source',ref,subject:{ref:view.document.expression_ref,kind:'expression',nativeOwner:'oi',revision:view.document.revision,title:view.document.title,sceneRef:binding.scene_ref,entityRef:null,relationRef:null}}});},
 jumpToScene:sceneRef=>{void focusNativeSceneRef(sceneRef).catch(cause=>toast(cause instanceof Error?cause.message:String(cause)));},
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
async function commitResearch(){if(!await commitNativeRecorded())throw new Error('The native owner did not acknowledge this edit. Your working draft is retained.');}
// B2/E15/E16 — the host a .canvas import runs through (researchMaterial.runCanvasImport). The local store is the one document;
// the owner is reached through ONE native act (its flush saves the cards, its relations and sides follow, one recorded step).
function canvasImportHost(sceneId:string):CanvasImportHost{
 return {
  store,
  relationKind:kind=>connectionKind(kind),
  bindingRef:()=>`${nativeWorkspace!.nativeView()!.document.expression_ref}:relation:connection-${crypto.randomUUID()}`,
  kernelDocument:()=>nativeWorkspace?.nativeView()?.document??null,
  saveCards:async()=>!!await commitNativeRecorded(),
  act:(label,relate,sides)=>asCanvasImportOwnerCall(()=>nativeWorkspace!.edit(view=>{const binding=view.bindings[sceneId];return relate(viewId=>binding?.occurrences.find(row=>row.view_entity_id===viewId)?.entity_ref);},label,sides)),
  rollback:async before=>{
   const now=nativeWorkspace?.nativeView()?.document;
   if(!now||before===null||(before as {revision?:number}).revision===now.revision)return;
   const compensation=invertEdit(before,now);
   if(!('changes' in compensation))throw new Error(compensation.reason);
   await asCanvasImportOwnerCall(()=>nativeWorkspace!.replayCheckpoint(compensation.changes,before));
  },
 };
}
function ownResearchConnection(ref:string){const value=nativeWorkspace?.nativeView()?.document.relations?.[ref];if(!value||value.native_owner!=='oi')throw new Error('Source relations must be changed through their source owner.');return value;}
function connectionKind(kind:string){if(!kind.trim()||kind.length>120)throw new Error('Choose a connection type of 1–120 characters.');return encodeURIComponent(kind.trim());}
function assertConnectionMembers(sceneId:string,source:string,target:string){researchScene(sceneId);const members=nativeWorkspace?.nativeView()?.bindings[sceneId]?.member_refs;if(!members?.includes(source)||!members.includes(target))throw new Error('Both connection endpoints must belong to the current native Scene.');}
researchInstruments=installResearchInstruments({
 container:researchContainer,tools:researchTools,inspector:researchInspector,placesHome,canvasHome,pageMembers:delta=>nativeWorkspace?nativeWorkspace.page(delta):Promise.resolve(false),read:readTechneReading,
 // Lane-4 T23: Places' "Open in Timeline" records the Timeline instrument here, so the instrument state matches the lens it loads.
 activateInstrument:lens=>activateInstrument(lens),
 sceneMaterial:id=>clone(researchScene(id)),
 material:async(id,action:ResearchMaterialAction)=>{const target=researchScene(id);changed(()=>applyResearchMaterial(target,action),true,researchMaterialLabel(action));await commitResearch();},
 // lane-1 A3/A4: a connection's line kind, label and bound sides — presentation keyed by the native edge id; the relation itself is untouched.
 connector:async(id,edgeId,value)=>{const target=researchScene(id);changed(()=>applyConnectorRecord(target,edgeId,value),true,'Connection line');await commitResearch();},
 inspectSubject:(ref,context)=>summonSource(ref,context),showInGraph:(subjectRef,nativeOwner)=>summonGraph(subjectRef,nativeOwner),nativeView:()=>nativeWorkspace?.nativeView(),sceneId:()=>scene().id,
 select:(sceneId,entityId,bindingRef)=>{if(sceneId!==scene().id)return;selected=entityId?[entityId]:[];nativeSelectedRelation=bindingRef??null;void nativeWorkspace?.select(sceneId,entityId,bindingRef);overlayDirty=true;needsFrame=true;if(document.body.classList.contains('research-studio'))renderAll();},
 // A deliberate typed knowledge relationship between the two occurrences'
 // constellation participations. The presentation connection is unchanged.
 relateKnowledge:async(sceneId,input)=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[sceneId];if(sceneId!==scene().id||!view||!binding)throw new Error('Open the native Scene before recording a relationship.');const receipt=await techneConstellationRelate({operation:'relate',expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref,from_entity_ref:input.sourceEntityRef,to_entity_ref:input.targetEntityRef,relation:input.relation,direction:input.direction});if(receipt.expression.state==='ready'){if(!await nativeWorkspace?.advance())toast(`Relationship saved in the constellation (revision ${receipt.frame_revision}). Commit or reconcile your unsaved draft to show it here.`,8000);}else toast(`Relationship saved in the constellation (revision ${receipt.frame_revision}). ${receipt.expression.detail}`,9000);return {relation_ref:receipt.relation_ref,frame_ref:receipt.frame_ref,frame_revision:receipt.frame_revision};},
 // The existing full object/state Studio for this exact occurrence, over the
 // still-active instrument. No second editor or Canvas-only store.
 editObject:(sceneId,entityId)=>{if(sceneId!==scene().id){toast('The active Scene changed; return to that Scene before editing.');return;}if(!scene().entities.some(value=>value.id===entityId)){toast('This occurrence is no longer present.');return;}selected=[entityId];textId=null;stepIndex=0;researchPreview=false;editing=true;inspectorOpen=true;tab='objects';studioSection='formations';renderAll();},
 openSubject:ref=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[scene().id];if(!view||!binding){toast('Open a native Scene before opening its source.');return;}hostRequest({request:'summon',detail:{kind:'source',ref,subject:{ref:view.document.expression_ref,kind:'expression',nativeOwner:'oi',revision:view.document.revision,title:view.document.title,sceneRef:binding.scene_ref,entityRef:null,relationRef:null}}});},
 move:async(sceneId,entityId,position)=>{if(pinnedOccurrence(sceneId,entityId))throw new Error('This occurrence is pinned in place. Unpin it to move it.');if(blueprintMember(researchScene(sceneId),entityId))throw new Error('Use Blueprint to move the whole shape, or release it to edit individual positions.');const item=researchScene(sceneId).entities.find(value=>value.id===entityId);if(!item||item.locked)throw new Error('This occurrence is locked or no longer present.');if(!Number.isFinite(position.x)||!Number.isFinite(position.y))throw new Error('Position must be finite.');changed(()=>{item.position.x=clamp(position.x,-50,50);item.position.y=clamp(position.y,-50,50);},true,'Move object');await commitResearch();},
 // A group gesture (multi-select move, align, distribute, nudge burst) is one
 // store change and one native commit.
 moveMany:async(sceneId,moves)=>{const target=researchScene(sceneId);for(const {entityId,position} of moves){if(pinnedOccurrence(sceneId,entityId))throw new Error('A pinned occurrence is in this selection. Unpin it to move the group.');if(blueprintMember(target,entityId))throw new Error('Use Blueprint to move the whole shape, or release it to edit individual positions.');const item=target.entities.find(value=>value.id===entityId);if(!item||item.locked)throw new Error('This occurrence is locked or no longer present.');if(!Number.isFinite(position.x)||!Number.isFinite(position.y))throw new Error('Position must be finite.');}changed(()=>{for(const {entityId,position} of moves){const item=target.entities.find(value=>value.id===entityId)!;item.position.x=clamp(position.x,-50,50);item.position.y=clamp(position.y,-50,50);}},true,'Move objects');await commitResearch();},
 // Whole-shape Blueprint acts from Canvas: one native edit each; release and
 // pin are separate, explicit acts.
 transformBlueprint:async(sceneId,transform)=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[sceneId];if(sceneId!==scene().id||!view||!binding)throw new Error('Open the native Scene before changing its blueprint.');await nativeWorkspace!.blueprint({expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref,operation:'transform',transform},'Transform blueprint');},
 releaseBlueprint:async sceneId=>{const view=nativeWorkspace?.nativeView(),binding=view?.bindings[sceneId];if(sceneId!==scene().id||!view||!binding)throw new Error('Open the native Scene before releasing its blueprint.');await nativeWorkspace!.blueprint({expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref,operation:'release'},'Release blueprint');},
 pinEntity:async(sceneId,entityRef,pinned)=>{researchScene(sceneId);if(!nativeWorkspace?.nativeView()?.document.entities[entityRef])throw new Error('This occurrence has no native identity to pin.');await nativeWorkspace.edit([{change:'entity_pin',entity_ref:entityRef,pinned}],pinned?'Pin object':'Unpin object');},
 // An empty Canvas starts construction through the navigator's Project-scoped
 // creation (native constellation create), then opens the result here.
 createScene:async()=>{if(window.parent===window)throw new Error('Constellation creation needs the desktop host.');hostRequest({request:'new-constellation'});},
 createNote:async(sceneId,position)=>{const target=researchScene(sceneId),item=entity('New note','New note',{...position,z:0});changed(()=>{target.entities.push(item);selected=[item.id];},true,'Add note');await commitResearch();},
 duplicateOccurrence:async(sceneId,entityId)=>{researchScene(sceneId);if(!nativeWorkspace)throw new Error('Open a native Scene first.');await nativeWorkspace.duplicateOccurrence(sceneId,entityId);},
 deleteOccurrence:async(sceneId,entityId)=>{if(blueprintMember(researchScene(sceneId),entityId))throw new Error('Release the blueprint before removing a member.');const target=researchScene(sceneId),item=target.entities.find(value=>value.id===entityId);if(!item||item.locked)throw new Error('This occurrence is locked or no longer present.');changed(()=>{target.entities=target.entities.filter(value=>value.id!==entityId);selected=selected.filter(id=>id!==entityId);pruneResearchOccurrence(target,entityId);pruneAutomation(target);},true,'Remove object');await commitResearch();},
 updateContent:async(sceneId,entityId,text)=>{const item=researchScene(sceneId).entities.find(value=>value.id===entityId);if(!item||item.locked)throw new Error('This occurrence is locked or no longer present.');changed(()=>{item.text=text;item.name=text.split('\n')[0].slice(0,160)||'Note';},true,'Edit note');await commitResearch();},
 // B2 — several connections in ONE owner edit (Import .canvas). Every end is checked before anything is written: a refusal connects
 // nothing and names the end. The refs are minted here, in input order, and returned. Connector sides are presentation kept in the
 // Scene's research material, so they are one labelled change after the relations land, then one composition save.
 connectMany:async(sceneId,inputs)=>{
  researchScene(sceneId);
  const view=nativeWorkspace?.nativeView(),binding=view?.bindings[sceneId];
  if(!view||!binding)throw new Error('Open the native Scene before connecting its cards.');
  if(!inputs.length)return [];
  const members=new Set(binding.member_refs);
  inputs.forEach((input,index)=>{
   // A drag-made connection carries no label: it refuses exactly as the single connect act does.
   if(!input.label?.trim()){assertConnectionMembers(sceneId,input.sourceEntityRef,input.targetEntityRef);}
   const label=input.label?.trim()||`connection ${index+1}`;
   if(!members.has(input.sourceEntityRef))throw new Error(`Import refused: the source of ${label} has no native occurrence in this Scene. Nothing was connected.`);
   if(!members.has(input.targetEntityRef))throw new Error(`Import refused: the target of ${label} has no native occurrence in this Scene. Nothing was connected.`);
   if(input.directionality&&!['directed','forward'].includes(input.directionality))throw new Error('Expression connections are directed. Choose a directed connection.');
   connectionKind(input.relationKind);
  });
  const expression=view.document.expression_ref;
  const refs=inputs.map(()=>`${expression}:relation:connection-${crypto.randomUUID()}`);
  const changes=inputs.map((input,index)=>({change:'relation_bind',binding:{binding_ref:refs[index],native_owner:'oi',relation:{ref:`${refs[index]}:${connectionKind(input.relationKind)}`,revision:'1',availability:'available'},from_entity_ref:input.sourceEntityRef,to_entity_ref:input.targetEntityRef,provenance:[]}}));
  const lines=inputs.flatMap((input,index)=>input.connector?[{ref:refs[index],record:input.connector}]:[]);
  // The connector sides are the same act as the relations: saved with them, one undo step.
  await nativeWorkspace!.edit(changes,connectActLabel(inputs.length),lines.length?journey=>{const target=journey.scenes.find(item=>item.id===sceneId);if(!target)throw new Error('The active Scene changed; nothing was connected.');for(const {ref,record} of lines)applyConnectorRecord(target,ref,record);}:undefined);
  return refs;
 },
 // B2/E15/E16 — a .canvas import: its cards, frames and connections are one labelled undo step (see canvasImportHost).
 importCanvas:(sceneId,label,actions,links)=>{researchScene(sceneId);const work=runCanvasImport(canvasImportHost(sceneId),{sceneId,label,actions,links});renderAll();return work.finally(renderAll);},
 connect:async(sceneId,input)=>{assertConnectionMembers(sceneId,input.sourceEntityRef,input.targetEntityRef);if(input.directionality&&!['directed','forward'].includes(input.directionality))throw new Error('Expression connections are directed. Choose a directed connection.');const id=`${nativeWorkspace!.nativeView()!.document.expression_ref}:relation:connection-${crypto.randomUUID()}`;await nativeWorkspace?.edit([{change:'relation_bind',binding:{binding_ref:id,native_owner:'oi',relation:{ref:`${id}:${connectionKind(input.relationKind)}`,revision:'1',availability:'available'},from_entity_ref:input.sourceEntityRef,to_entity_ref:input.targetEntityRef,provenance:[]}}],connectActLabel(1));},
 reconnect:async(sceneId,ref,input)=>{assertConnectionMembers(sceneId,input.sourceEntityRef,input.targetEntityRef);const binding=ownResearchConnection(ref);await nativeWorkspace?.edit([{change:'relation_bind',binding:{...binding,from_entity_ref:input.sourceEntityRef,to_entity_ref:input.targetEntityRef}}],'Reconnect');},
 // Expression connections are directed: reversing swaps the exact endpoints;
 // undirected/bidirectional have no presentation representation and refuse.
 updateConnectionDirectionality:async(sceneId,ref,directionality)=>{researchScene(sceneId);const binding=ownResearchConnection(ref);if(directionality==='forward')return;if(directionality!=='backward')throw new Error('Expression connections are directed. Reverse it, or record an undirected constellation relationship.');assertConnectionMembers(sceneId,binding.to_entity_ref,binding.from_entity_ref);await nativeWorkspace?.edit([{change:'relation_bind',binding:{...binding,from_entity_ref:binding.to_entity_ref,to_entity_ref:binding.from_entity_ref}}],'Reverse connection');},
 deleteConnection:async(sceneId,ref)=>{const target=researchScene(sceneId);ownResearchConnection(ref);await nativeWorkspace?.edit([{change:'relation_remove',binding_ref:ref}],'Delete connection',target.research?.connectors?.[ref]?journey=>{const scene=journey.scenes.find(item=>item.id===sceneId);if(!scene)throw new Error('The active Scene changed; nothing was removed.');applyConnectorRecord(scene,ref,null);}:undefined);
  // the removed relation's line record goes with it (A3/A4), so no orphan presentation outlives its edge
  },
 updateConnectionKind:async(sceneId,ref,kind)=>{researchScene(sceneId);const binding=ownResearchConnection(ref);await nativeWorkspace?.edit([{change:'relation_bind',binding:{...binding,relation:{...binding.relation,ref:`${ref}:${connectionKind(kind)}`,revision:String(Number(binding.relation.revision)+1)}}}],'Set connection type');},
});
// M5′ Palace: regions are Scenes of the Palace Expression, each disclosing one
// contained Expression as its body with a portal; the guided path is Scene
// order. Everything goes through the kernel Expression owner with CAS.
const palaceSnapshot=(raw:unknown):PalaceDocumentSnapshot&{title:string}=>{const doc=raw as {expression_ref:string;revision:number;title?:string;scenes?:{scene_ref:string;title?:string;body?:{carrier?:string;subject_ref?:string}|null;triggers?:{trigger_ref:string;target?:{kind?:string;subject_ref?:string}}[]}[]};return {expression_ref:doc.expression_ref,revision:doc.revision,title:doc.title??doc.expression_ref,scenes:(doc.scenes??[]).map(scene=>({scene_ref:scene.scene_ref,title:scene.title??'',body:scene.body?{carrier:scene.body.carrier,subject_ref:scene.body.subject_ref}:null,triggers:(scene.triggers??[]).map(trigger=>({trigger_ref:trigger.trigger_ref,target:trigger.target?{kind:trigger.target.kind,subject_ref:trigger.target.subject_ref}:undefined}))}))};};
const palaceInstrument=installPalaceInstrument({
 nativeView:()=>nativeWorkspace?.nativeView(),sceneId:()=>scene().id,
 authoredRevision:()=>store.revision,
 canCompose:()=>{const reading=retainedEditor.read();return !store.transactionOpen&&!reading.standing.pending&&!reading.standing.dirty;},
 listExpressions:()=>listKernelExpressions(),
 readExpression:async ref=>palaceSnapshot(await readKernelExpression(ref)),
 composeExpression:async({expression_ref,expected_revision,changes})=>{const data=await nativeExpressionRequest({operation:'edit',expression_ref,expected_revision,actor:'human:techne-palace',changes}) as {state?:string;current_revision?:number;document?:unknown}|null;if(data?.state==='revision_conflict')return {ok:false,reason:`This Palace changed elsewhere (now revision ${data.current_revision}). Nothing was saved; reopen it and try again.`};if(!data?.document||data.state!=='ready')return {ok:false,reason:`The Expression owner did not accept the composition (${String(data?.state)}).`};return {ok:true,document:palaceSnapshot(data.document)};},
 openExpression:ref=>{void nativeWorkspace?.open(ref);},
 // Lane-5 seam B: a non-Expression palace entry asks for its instrument through the frame's existing host-request summon.
 openInstrument:(instrument,ref)=>{hostRequest(palaceInstrumentOpenRequest(instrument,ref));},
},palaceHome);
/** lane-5 T8: the journey as the expression clock runs it: a saved sequence runs on its saved durations, otherwise the working ones. */
function playbackJourney():Journey{
 const working=store.document;
 if(!journeyPlaying)return working;
 return {...working,scenes:working.scenes.map(scene=>({...scene,duration:working.savedScenes?.[scene.id]?.duration??0}))};
}
journeyInstrument=installJourneyInstrument({nativeView:()=>nativeWorkspace?.nativeView(),sceneId:()=>scene().id,portal:(trigger,basis)=>openScenePortal(trigger.trigger_ref,basis), // T12: the beat's own source portal is the scene-body portal path.
 read:(basis,scope)=>readTechneReading({expression_ref:basis.expression_ref,revision:basis.revision,scene_ref:basis.scene_ref,...(scope?{scope}:{})}),
 // T10/T11: the crossing and its return are the owner's compare-and-set (the one session history); the Expression reading is the host's own mode.
 crossing:(basis,scene,sceneRef)=>writeJourneyCrossing(basis,scene,sceneRef),
 returning:(basis,scene,crossed)=>writeJourneyReturn(basis,scene,crossed),
 entered:()=>{crossingStands=true;setHostMode('expressions');syncCrossingReturn();}, // T11: the crossing stands until its return.
 focusScene:async input=>{
  const view=nativeWorkspace?.nativeView(),reading=retainedEditor.read();
  if(!view||view.document.expression_ref!==input.expression_ref||view.document.revision!==input.revision
   ||view.bindings[scene().id]?.scene_ref!==input.scene_ref||store.transactionOpen||reading.standing.pending||reading.standing.dirty)
   throw Error('The native Journey source changed or has unacknowledged authored work.');
  return await focusNativeSceneRef(input.target_scene_ref);
 },
 // lane-5 T8: the playback-path panel. The clock is the journey as the expression clock runs it, and seek takes the same clock's seconds.
 playback:()=>{const journey=playbackJourney();return {journey,time:expressionTiming(store.document,sceneIndex,sceneElapsed,journeyPlaying).time};},
 seek:seconds=>{
  // review-5 #7: the saved clock places the seek. The Scene it lands in is the last one that starts at or before it; a Scene with
  // no saved entry has no span on this clock, so a seek landing on it is at its working start. The local time is clamped to that
  // working Scene's own duration, which can be shorter than its saved span.
  const journey=playbackJourney(),total=expressionTiming(journey,0,0).total,t=clamp(seconds,0,total);
  let index=-1;journey.scenes.forEach((_,i)=>{if(expressionTiming(journey,i,0).time<=t)index=i;});
  if(index<0)return;
  const local=clamp(t-expressionTiming(journey,index,0).time,0,store.document.scenes[index].duration);
  // The same path as the playhead's scrub: the Scene is adopted, then the playhead seeks to its local time and holds.
  if(index!==sceneIndex)setSceneRef(store.document.scenes[index].id);
  seekWorkingScene(local);
 },
 editExpression:async request=>{
  // T-REVIEW-4 #1: a reorder carries the same guard compose and focus carry: unsaved or pending work is never reordered over.
  const reading=retainedEditor.read();
  if(store.transactionOpen||reading.standing.pending||reading.standing.dirty)throw Error('Save the open work before reordering this Journey.');
  const reply=await nativeExpressionRequest(request);
  // The owner's new revision is read through refreshReference; open returns early for work that is already open.
  if((reply as {state?:string}|null)?.state==='ready')await nativeWorkspace?.refreshReference(request.expression_ref);
  return reply;
 },
 // lane-5 T3 · the pace draft's save. Each beat's own duration is retimed through the timeline's retime (the E05 trim path) as ONE
 // labelled step (E16), and the Save path then acknowledges it on the owner (E15d). Only a clean working copy is retimed, so the
 // save carries the pace and nothing else. A refusal resolves false and leaves the step in the working copy to undo.
 commitPace:async(edits,label)=>{
  const reading=retainedEditor.read();
  if(store.transactionOpen||reading.standing.pending||reading.standing.dirty)throw Error("Save the open work before changing this Journey's pace.");
  changed(()=>{for(const edit of edits)retimeScene(store.document,edit.sceneId,{duration:edit.seconds});},true,label);
  return await commitNativeRecorded()===true;
 },
},journeyHome);
// lane-5 T2 · compose a scene from the journey lens. The floor (journeyBeats.ts) mints the
// scene ref and refuses collisions; the kernel receives exactly one scene_create on the revision
// the reading disclosed. Nothing persists in the page; a refusal is a toast.
const journeyComposeForm=document.createElement('form');
journeyComposeForm.className='journey-compose';journeyComposeForm.setAttribute('aria-label','Compose a scene in this Journey');
journeyComposeForm.innerHTML='<label>New scene<input name="title" maxlength="160" autocomplete="off" required></label><button type="submit">Compose scene</button>';
journeyHome.append(journeyComposeForm);
let journeyComposing=false;
journeyComposeForm.addEventListener('submit',ev=>{
 ev.preventDefault();if(journeyComposing)return;
 const title=(journeyComposeForm.elements.namedItem('title') as HTMLInputElement|null)?.value??'';
 journeyComposing=true;void composeJourneyScene(title).finally(()=>{journeyComposing=false;});
});
async function composeJourneyScene(title:string):Promise<void>{
 const view=nativeWorkspace?.nativeView();
 const basis=view&&view.bindings[scene().id];
 if(!view||!basis){toast('Open a native Scene before composing a scene into this Journey.');return;}
 const reading=retainedEditor.read();
 if(store.transactionOpen||reading.standing.pending||reading.standing.dirty){toast('Save the open work before composing a scene into this Journey.');return;}
 let disclosed:ReturnType<typeof readJourneyInstrument>['reading'];
 try{
  const raw=await readTechneReading({expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:basis.scene_ref});
  disclosed=readJourneyInstrument(raw,view,scene().id).reading;
 }catch(cause){toast(cause instanceof Error?cause.message:String(cause));return;}
 const routed=composeSceneRequest({reading:disclosed,doc:view.document,focus_refs:[basis.scene_ref],title});
 if(!routed.ok){toast(routed.reason);return;}
 const reply=await nativeExpressionRequest(routed.request) as {state?:string;current_revision?:number;document?:{revision?:number}}|null;
 if(reply?.state==='revision_conflict'){toast(`This Expression changed elsewhere (now revision ${reply.current_revision}). Nothing was composed; reopen it and try again.`);return;}
 if(reply?.state!=='ready'){toast(`The Expression owner did not accept the composition (${String(reply?.state)}).`);return;}
 toast(`Composed “${title.trim()}” into ${routed.request.expression_ref} at revision ${reply.document?.revision ?? routed.request.expected_revision+1}.`);
 // T-REVIEW-4 #1: the owner's new revision is adopted through refreshReference (open returns early for work already open); the
 // Journey re-reads once that revision stands.
 await nativeWorkspace?.refreshReference(routed.request.expression_ref);
 void journeyInstrument?.refresh();
}
lensStudio.setMode(hostMode==='techne'?'techne':'expressions');
(document.querySelector('#workspace-menu') as HTMLElement)?.insertAdjacentHTML('beforeend',ib('deep-home','home','Epii home','data-techne-only')+ib('deep-verso','wiki','Verso — the subject\u2019s account and sources','data-techne-only'));
// Save is the primary act: it stays in the masthead at every width, outside
// the history/capture overflow menu.
(document.querySelector('#app .header-actions') as HTMLElement)?.insertAdjacentHTML('afterbegin',ib('native-save','save','Save (⌘S)','id="native-save"'));
Object.assign(window.__FIELD_STUDIES__,{nativeWorking:()=>nativeWorkspace?.inspect(),nativeConnections:()=>engine.inspectConnections?.(),openNative:(reference:string)=>nativeWorkspace?.open(reference),openNativeFile:(path:string)=>nativeWorkspace?.openFile(path)});
const qs=new URLSearchParams(location.search);
const naraInstrument=installNaraInstrument({nativeView:()=>nativeWorkspace?.nativeView(),sceneId:()=>scene().id,
 presentForm:reading=>{if(reading)naraFormGeometry(reading,nativeWorkspace?.nativeView(),scene().id);privateFormReading=reading;needsFrame=true;},
 presentEvidence:input=>{privateEvidenceField=input?createEvidenceField(input,nativeWorkspace?.nativeView(),scene().id):null;needsFrame=true;},
 acceptNativeDocument:async(document:unknown)=>{
  const native=document as {expression_ref?:unknown;revision?:unknown};
  const showing=nativeWorkspace?.nativeView()?.document;
  if(typeof native.expression_ref!=='string'||typeof native.revision!=='number'||showing?.expression_ref!==native.expression_ref)throw Error('The coordinate was adopted natively; reopen its Expression to view it. Your current work was retained.');
  await nativeWorkspace?.refreshReference(native.expression_ref);
  const applied=nativeWorkspace?.nativeView()?.document;
  if(applied?.expression_ref!==native.expression_ref||applied.revision!==native.revision)throw Error('The coordinate was adopted natively; resolve the retained local draft before displaying the new revision.');
 }});
if(qs.get('nara')==='1')naraInstrument.open();
const disposeFieldStudies=window.__FIELD_STUDIES__.dispose;
window.__FIELD_STUDIES__.dispose=()=>{naraInstrument.destroy();journeyInstrument?.destroy();palaceInstrument.destroy();wikiStanding.dispose();disposeFieldStudies();};
// A hosted deep link (the app's own ?journey/?scene idiom): open a named
// expression from the browser library, the featured set or the starters —
// the Technè M0 instrument opens onto the Epii face this way
// (?expression=source-twelve-faces, owner direction 2026-09-19).
const qsExpression=qs.get('expression');
// E22: the address (scene, time, marker) is applied once the Expression has settled; its refusals are named then.
const bootNotes=deepLinkPending?.notes;
if(qsExpression){const found=[...readLibrary(),...featuredExpressions(),...startingPoints().map(p=>p.expression)].find(j=>j.id===qsExpression);if(found){store.document=initialiseSceneSaves(initialiseBelts(found));addressKeepsExpression=!qsExpression.startsWith('expression:');}else if(!qsExpression.startsWith('expression:'))bootNotes?.push(`No Expression "${shortenRef(qsExpression)}" is in this browser; it opened the current work.`);}
if(qs.get('journey')==='seven')store.document=initialiseSceneSaves(initialiseBelts(nativeSeven()));if(qs.has('still'))fieldPaused=true;
if(window.__START_PRESENTATION__||qs.has('present')){focusSession=beginFocus(focusSession,readFocusLayout());presenting=true;fieldPaused=false;scenePlaying=true;journeyPlaying=store.document.scenes.length>1;}
// Save is the app's own act: in a hosted native work it commits the working
// composition to its native Expression (the same owner operation the former
// native panel used); otherwise it keeps the draft in this browser.
async function saveNative(){
 if(kernelExpressionsAvailable()&&nativeWorkspace){
  if(propertyTake)finishPropertyTake();
  // The Save is recorded on the undo step it began from. That step is read in the
  // same breath as the snapshot the workspace submits, so both describe one document.
  const localId=store.document.id,wasBound=!!kernelOriginFor(store.document);
  const anchor=store.kernelSaveAnchor(),saved=await nativeWorkspace.commitRecorded();
  if(saved){
   const recorded=store.attachKernelCheckpoint(anchor,saved.checkpoint);
   recordAdoptionAfterSave(localId,wasBound);
   // T22: the Library copy of a document the kernel now holds records its kernel origin at this save.
   try{saveToLibrary(store.document,kernelOriginFor(store.document));}catch{/* The Library mirror is retried by the next backup. */}
   closeEntryGate();
   toast(recorded?'Saved.':'Saved. Undo cannot reverse this Save on the native owner, because the step it began from has moved.',recorded?undefined:7000);
  }
  return;
 }
 deletedLibraryIds.delete(store.document.id);saveToLibrary(store.document);if(libraryOpen)renderLibrary();toast('Saved in this browser.');
}
/** E15d: a host commit, flush or research commit is a Save too. It records its checkpoint on the step it began from, as saveNative does. */
async function commitNativeRecorded():Promise<boolean|undefined>{
 if(!nativeWorkspace)return undefined;
 const localId=store.document.id,wasBound=!!kernelOriginFor(store.document);
 const anchor=store.kernelSaveAnchor(),saved=await nativeWorkspace.commitRecorded();
 if(saved){store.attachKernelCheckpoint(anchor,saved.checkpoint);recordAdoptionAfterSave(localId,wasBound);try{saveToLibrary(store.document,kernelOriginFor(store.document));}catch{/* T22: the Library mirror is retried by the next backup. */}}
 return !!saved;
}
/** One Undo or Redo step. A step that crosses a recorded Save replays that Save's
 * kernel edit through its native owner first, and the local step follows only when
 * the owner acknowledges it. A refusal is named by the workspace; the history stays
 * as it was. Steps the kernel never held are undone locally, as before. */
let historyStepping=false;
async function stepHistory(direction:'undo'|'redo'):Promise<void>{
 if(historyStepping)return;
 // A .canvas import is open: Undo and Redo wait and say why, through the toast; they never throw.
 const openImport=store.spanningLabel;
 if(openImport!==null){toast(historyWaitReason(direction,openImport),4200);return;}
 if(store.transactionOpen)store.finish();
 const plan=direction==='undo'?store.undoPlan():store.redoPlan();
 if(!plan)return;
 const label=plan.label,kernel=plan.kernel,entry=direction==='undo'?store.undoStack.at(-1):store.redoStack.at(-1);
 if(kernel&&'refused' in kernel){toast(`Cannot ${direction} ${label}: ${kernel.reason} Nothing was changed.`,7000);return;}
 let stepped:boolean;
 if(kernel&&'changes' in kernel&&kernel.changes.length){
  const expected=store.checkpointAt(direction);
  if(!expected||!nativeWorkspace){toast(`Cannot ${direction} ${label}: its recorded native state is not held. Nothing was changed.`,7000);return;}
  historyStepping=true;
  try{
   if(!await nativeWorkspace.replayCheckpoint(kernel.changes,direction==='undo'?expected.before:expected.after))return;
   if((direction==='undo'?store.undoStack.at(-1):store.redoStack.at(-1))!==entry){toast('The history changed while the native owner answered. The saved edit was reversed there; save to reconcile this draft.',7000);return;}
   stepped=direction==='undo'?store.undoAccepted():store.redo({compensated:true});
  }finally{historyStepping=false;}
 }else{
  stepped=direction==='undo'?(kernel?store.undoAccepted():store.undo()):store.redo(kernel?{compensated:true}:undefined);
 }
 if(!stepped)return;
 markSaved();renderAll();
 if(researchInstruments?.active()){await commitResearch();await researchInstruments.refresh();}
 toast(direction==='undo'?`${historyToast('undo',label)} Simulation time has not been rewound.`:historyToast('redo',label),2200);
}
let nativeState:import('./nativeWorkspace.js').NativeStatus|null=null;
function showNativeStatus(state:import('./nativeWorkspace.js').NativeStatus){
 nativeState=state;
 // Saving can advance the acknowledged native basis without replacing the
 // authored DocumentStore (and its useful Undo). Publish that same actual
 // work through the existing host channel before another editor gesture.
 const acknowledged=nativeWorkspace?.nativeView()?.document;
 if(state.identity&&acknowledged?.expression_ref===state.identity.ref&&acknowledged.revision===state.identity.revision)announceHostState();
 // An unsuccessful hosted opening is still a native failure. Hiding it
 // behind an unqualified Save control would make a local preview look owned.
 const failed=state.failed;
 const save=document.getElementById('native-save');
 if(save){const label=state.busy?'Saving…':failed?`Not saved — ${state.text}`:state.identity?`Save (⌘S) · ${state.identity.title} · revision ${state.identity.revision}`:'Save (⌘S)';save.title=label;save.setAttribute('aria-label',label);save.classList.toggle('attention',failed||!!state.pending);save.toggleAttribute('disabled',state.busy);}
 const line=document.getElementById('native-status');if(!line)return;
 const actions=[state.pending?`<button type="button" class="link-button" data-action="native-resolve">Resolve interrupted save</button>`:'',state.pending==='file'?`<button type="button" class="link-button" data-action="native-retry-file">Retry file save</button>`:'',state.retryOpen&&state.failed?`<button type="button" class="link-button" data-action="native-retry-open">Retry opening</button>`:'',state.page&&state.page.count>1?`<span class="native-page">Members ${state.page.page+1}/${state.page.count}</span><button type="button" class="link-button" data-action="native-page" data-delta="-1" ${state.page.page<=0?'disabled':''}>Previous</button><button type="button" class="link-button" data-action="native-page" data-delta="1" ${state.page.page>=state.page.count-1?'disabled':''}>Next</button>`:''].join('');
 const text=failed?state.text:state.identity?`${state.identity.title} · saved revision ${state.identity.revision}`:'';
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
/** lane-3 E19: the boot choice between the draft and the saved copy. Both timestamps and the revision are named. Dismissing it (Escape) keeps both, so nothing is lost. */
function askRecoveryChoice(draft:Journey,offer:{draftAt:string;savedAt:string;revision?:number;diff?:RecoveryDiff}):Promise<RecoveryChoice>{
 return new Promise<RecoveryChoice>(resolve=>{
  const dialog=document.createElement('dialog');
  dialog.className='confirm-dialog recovery-dialog';dialog.setAttribute('aria-labelledby','recovery-title');
  const now=new Date(),basis=offer.revision===undefined?'Browser copy (no kernel revision)':`Kernel revision ${offer.revision}`;
  dialog.innerHTML=`<p class="eyebrow">THE LAST SESSION DID NOT CLOSE CLEANLY</p><h2 id="recovery-title">Unsaved edits in “${esc(draft.name)}”</h2><p class="intro">The draft has changes that the saved copy does not have. Whichever you choose, both versions are kept.</p><dl class="recovery-basis"><dt>Draft</dt><dd>${esc(offerClock(offer.draftAt,now))}</dd><dt>Saved copy</dt><dd>${offer.revision===undefined?esc(offerClock(offer.savedAt,now)):'Owner save time not recorded'}</dd><dt>Revision</dt><dd>${esc(basis)}</dd></dl>${offer.diff?`<ul class="recovery-diff" aria-label="What the draft changes">${recoveryDiffLines(offer.diff).map(line=>`<li>${esc(line)}</li>`).join('')}</ul>`:''}<div class="recovery-choices"><button class="secondary" data-choice="keep-saved">Keep saved version</button><button class="secondary" data-choice="keep-both">Keep both</button><button class="primary" data-choice="restore-draft">Restore draft</button></div>`;
  dialog.addEventListener('click',ev=>{const button=(ev.target as Element).closest<HTMLButtonElement>('button[data-choice]');if(button)dialog.close(button.dataset.choice);});
  dialog.addEventListener('cancel',()=>{dialog.returnValue='keep-both';});
  dialog.addEventListener('close',()=>{const choice=dialog.returnValue as RecoveryChoice;dialog.remove();resolve(choice==='restore-draft'||choice==='keep-saved'||choice==='keep-both'?choice:'keep-both');});
  document.body.append(dialog);dialog.showModal();
 });
}
async function startWorkspace(){
 let recovered:SessionState|undefined;
 let showEntry=false;
 // lane-3 E19 and E19b: one reading of this tab's session mark, taken before this page marks itself open. A hosted boot takes it too.
 let uncleanExit=false;try{uncleanExit=readUncleanExit(localStorage);markSessionOpen(localStorage,new Date());}catch{/* Unavailable storage: no mark, so no prompt can be compared. */}
 recordBootExit(uncleanExit);
 if(!window.__JOURNEY__&&!qs.has('journey')&&!qsExpression){try{for(const draft of await readDrafts())sessionExpressions.set(draft.id,draft);const id=localStorage.getItem('oi.field-studies.last'),draft=id?await readDraft(id):undefined;
 // lane-3 E19: after an unclean exit, a draft that differs from its saved copy is offered as a choice; a clean exit adopts nothing silently either way.
 // Browser mode only, with no kernel: the saved side is the Library record, a throttled mirror of the autosave (flushDraft). It is not the
 // product's store of record. The hosted path is, and compares against the kernel checkpoint in nativeWorkspace.settleRecovery.
 const saved=draft?readLibrary().find(j=>j.id===draft.id):undefined;
 const offer=draft&&saved&&!hostedRecovery()?recoveryOffer({draft,saved,uncleanExit}):{offer:false as const,reason:''};
 if(draft&&saved&&offer.offer){
 // T-REVIEW-6: the draft is held from the dialog until its choice is kept. Writing now would replace the draft with the saved copy under the same id.
 recoveryOfferOpen=true;
 const choice=await askRecoveryChoice(draft,offer);const plan=planRecoveryChoice(choice,draft,saved,new Date());
 try{await applyRecoveryPlan(plan,draft);}catch(error){toast('The recovery choice could not be kept. The draft stays held for the next start; export a file to keep this work.',9000);throw error;}
 recoveryOfferOpen=false;
 if(plan.quarantineDraft)toast(quarantineNotice('chosen',false),9000);
 if(plan.removeDraft)sessionExpressions.delete(draft.id);if(plan.copy)sessionExpressions.set(plan.copy.id,plan.copy);store.document=initialiseSceneSaves(initialiseBelts(plan.open));store.touch();
 // E19: a restored draft is the working copy, and it differs from the saved copy until it is saved: the status says so.
 if(choice==='restore-draft')$('save-status').textContent=`Restored draft, not yet saved: ${recoveryDiffLines(offer.diff).join('; ')}`;}
 else if(draft&&saved&&!hostedRecovery()&&supersededDraft({draft,saved})){
 // E19: the draft is not newer than the saved copy. The saved copy opens; the draft is kept verbatim in quarantine, never adopted silently or overwritten.
 recoveryOfferOpen=true;
 try{await applyRecoveryPlan({open:saved,quarantineDraft:true,removeDraft:true,quarantineReason:'Not newer than the saved copy, so the saved copy was opened. The draft is kept here verbatim.'},draft);}catch(error){toast('The draft could not be kept in quarantine, so it stays held for the next start. Export a file to keep this work.',9000);throw error;}
 recoveryOfferOpen=false;
 toast(quarantineNotice('superseded',false),9000);
 sessionExpressions.delete(draft.id);sessionExpressions.set(saved.id,clone(saved));store.document=initialiseSceneSaves(initialiseBelts(clone(saved)));store.touch();}
 else if(draft&&(!initial.updatedAt||draft.id!==initial.id||draft.updatedAt>=initial.updatedAt)){store.document=initialiseSceneSaves(initialiseBelts(draft));store.touch();}recovered=validateSession(JSON.parse(localStorage.getItem(SESSION_KEY)??'null'),store.document);showEntry=!startsInTechne;}catch(e){console.warn('Draft recovery unavailable',e);showEntry=!startsInTechne;}}
 const linkedScene=deepLinkPending?.address.scene;
 if(recovered&&(linkedScene===undefined||linkedScene===recovered.sceneId)){sceneIndex=store.document.scenes.findIndex(s=>s.id===recovered!.sceneId);selected=recovered.selected;stepIndex=recovered.stepIndex;sceneElapsed=recovered.sceneElapsed;simTime=recovered.simTime;scenePlaying=recovered.scenePlaying??recovered.playing;workingTransport=recovered.workingTransport??STOPPED_TRANSPORT;journeyPlaying=recovered.journeyPlaying;if(recovered.fieldPaused!==undefined)fieldPaused=recovered.fieldPaused;if(qs.has('still'))fieldPaused=true;camera=recovered.camera;}else applySceneView();
 document.body.classList.toggle('oi-host-techne',hostMode==='techne');document.body.classList.toggle('oi-host-live',hostMode==='live');if(hostMode==='live'&&nativeField){studioSection='native';tab='field';setStudio(true);nativeField.openLive();}renderRail();
 if(!qsExpression?.startsWith('expression:'))await nativeWorkspace?.changed(store.document);
 resize();engine.render(frameData(0));if(recovered?.transport)engine.restoreTransport?.(recovered.transport);
 trackPreview=!!scene().propertyTracks?.length;resize();renderAll();if(location.hash.startsWith('#library'))openLibrary(location.hash.includes('about')?'about':'collection',false);rafId=requestAnimationFrame(tick);
if(!qsExpression?.startsWith('expression:'))settleDeepLink(true);
if(startupError)toast(startupError,7000);else if(workspaceStorageError)toast('Saved toolbelt could not be read. Starter controls are available for this session.',7000);
if(fieldPaused&&!recovered&&!qs.has('still'))toast('A still field, following your reduced-motion preference. Play a scene, or lift “Pause physics” in the studio, to set it in motion.',6000);
if(qs.has('edit'))edit(true,(['scene','objects','field','motion'].includes(qs.get('edit')!)?qs.get('edit'):'scene')as InspectorContext['tab']);
if(showEntry)openEntryGate(!!recovered||!!localStorage.getItem('oi.field-studies.last'),store.document.name);

if(qsExpression?.startsWith('expression:')){
 // review-5 #6: a refused or missing open still settles the link, so the address is written again instead of staying pending.
 const open=()=>void Promise.resolve(nativeWorkspace?.follow(qsExpression)).then(applied=>settleDeepLink(applied===true),()=>settleDeepLink(false));if(kernelExpressionsAvailable())open();else window.addEventListener('message',function ready(event){if(event.source===window.parent&&event.data?.v===1&&event.data?.kind==='oi-kernel-channel'){window.removeEventListener('message',ready);open();}});}
else if(bootKernelRef&&!qsExpression){
 // T22: the library entry this page opened is kernel-bound, so the kernel copy is the document. The browser copy stands as local scratch
 // until the kernel adopts it; a refusal or an unreachable kernel is named, and the scratch copy stays open.
 const ref=bootKernelRef;
 // OPEN 3: a standalone page has no host frame and so no kernel channel. Its kernel-bound entry is named as the scratch it is.
 if(!kernelExpressionsAvailable()&&window.parent===window){kernelScratchId=store.document.id;$('save-status').textContent=KERNEL_SCRATCH_LINE;}
 const open=()=>{kernelScratchId=null;openKernelCopy(ref);};
 if(kernelExpressionsAvailable())open();else window.addEventListener('message',function ready(event){if(event.source===window.parent&&event.data?.v===1&&event.data?.kind==='oi-kernel-channel'){window.removeEventListener('message',ready);open();}});
}
setInterval(()=>{saveSession();if(propertyTake&&propertyTake.elapsed>0)draftSchedule.request();},1000);}
/** E22: the Scene's native ref, when the Expression is hosted natively; the address prefers it because the kernel is the owner. */
function nativeSceneRef(sceneId:string):string|undefined{return nativeWorkspace?.nativeView()?.bindings[sceneId]?.scene_ref;}
/** E22: once the Expression has settled (local, or the followed native Expression), apply the link's address and name each refusal. */
function settleDeepLink(applied:boolean){
 const link=deepLinkPending;if(!link)return;deepLinkPending=null;
 const carried=Object.keys(link.address).length>0||link.notes.length>0;
 const notes=applied?[...link.notes,...applyDeepLinkAddress(link.address)]:link.notes;
 if(notes.length)toast(notes.join(' '),8000);
 // A plain load keeps its address as it is; a link that was carried is corrected to the place it actually opened.
 if(carried)syncDeepLinkAddress();
}
/** E22: the most precise part of an address wins: a marker, then a time, then a Scene. A refusal does not stop the parts after it. */
function applyDeepLinkAddress(address:DeepLinkAddress):string[]{
 const doc=store.document,notes:string[]=[];
 if(address.marker!==undefined){
  const found=resolveMarker(doc.markers??[],address.marker);
  if('marker' in found){selectedMarkerId=found.marker.id;jumpToJourneyTime(found.marker.time);return notes;}
  notes.push(found.refused);
 }
 if(address.t!==undefined){
  const placed=clampJourneyTime(address.t,expressionTiming(doc,0,0).total);
  if(placed.clamped)notes.push(`t=${address.t} is past the end of this Expression; it opened at its end.`);
  jumpToJourneyTime(placed.time);return notes;
 }
 if(address.scene!==undefined){
  const found=resolveSceneRef(doc.scenes.map(s=>({id:s.id,name:s.name,ref:nativeSceneRef(s.id)})),address.scene);
  if('refused' in found){notes.push(found.refused);return notes;}
  const sceneId=found.id;setSceneRef(sceneId);
  if(found.via==='name')notes.push(`Matched Scene "${shortenRef(address.scene)}" by name; links carry the Scene's ref.`);
  // E22: an old positional link is converted once; the address is then written back with the Scene's ref.
  if(found.via==='index')notes.push(`Converted the old scene index ${shortenRef(address.scene,16)} to Scene "${shortenRef(doc.scenes[found.index].name,60)}"; the link now carries its ref.`);
 }
 return notes;
}
/** E22: where the frame stands, in its link's terms: the Scene always; the time and marker while the transport stands still.
 * The URL write and the host's announcement read this one place. */
function deepLinkAddressNow():{expression?:string;scene:string;t?:number;marker?:string}{
 const view=nativeWorkspace?.nativeView(),doc=store.document;
 const timing=expressionTiming(doc,sceneIndex,sceneElapsed),still=!journeyPlaying&&!scenePlaying;
 const expression=view?.document.expression_ref??(addressKeepsExpression?doc.id:undefined);
 const marker=still?markerAtTime(doc.markers??[],timing.time):undefined;
 return {...(expression!==undefined?{expression}:{}),scene:nativeSceneRef(scene().id)??scene().id,...(still?{t:timing.time}:{}),...(marker!==undefined?{marker}:{})};
}
/** E22 (ticket P, G3): the address the host is told with the frame's state, once the opening link has settled and the work it
 * names stands; the marker's name rides beside its ref for the host's words. Absent otherwise: the host keeps what it held. */
function hostAddress():{scene:string;t?:number;marker?:string;markerName?:string}|undefined{
 try{
 if(deepLinkPending||awaitingNativeBoot&&!nativeWorkspace?.nativeView())return undefined;
 const now=deepLinkAddressNow();
 const name=now.marker!==undefined?markerNamed(store.document.markers??[],now.marker)?.name:undefined;
 return {scene:now.scene,...(now.t!==undefined?{t:now.t}:{}),...(now.marker!==undefined?{marker:now.marker}:{}),...(name!==undefined?{markerName:name}:{})};
 }catch{return undefined;/* a frame still starting names no address rather than a wrong one */}
}
/** E22: the address follows the person. Only replaceState, so Back and history stay as they were. A changed address is also
 * announced to the host (G3), at the same throttled pace. */
function syncDeepLinkAddress(){
 if(deepLinkPending)return;
 if(deepLinkWriteTimer)return;
 deepLinkWriteTimer=window.setTimeout(()=>{
  deepLinkWriteTimer=0;
  if(deepLinkPending)return;
  try{
  const address=deepLinkAddressNow();
  const next=formatDeepLink(location.search,{...(address.expression!==undefined?{expression:address.expression}:{}),scene:address.scene,t:address.t,marker:address.marker});
  if(next!==location.search)history.replaceState(history.state,'',location.pathname+next+location.hash);
  }catch{/* a refused history write leaves the address as it was; the page keeps working */}
  const announced=JSON.stringify(hostAddress()??null);
  if(announced!==announcedAddress){announcedAddress=announced;announceHostState();}
 },DEEP_LINK_WRITE_MS);
}
/** E23: the layout focus hides and restores. Read and written as one record; the pure model is focusMode.ts. */
function readFocusLayout():FocusLayout{return {sequenceOpen,beltOpen,timelineOpen,inspectorOpen,editing,contextKind,beltPickerOpen,shapePickerOpen,modesOpen,captureOpen,tool,cursorTool,selected:[...selected]};}
function writeFocusLayout(layout:FocusLayout){sequenceOpen=layout.sequenceOpen;beltOpen=layout.beltOpen;timelineOpen=layout.timelineOpen;inspectorOpen=layout.inspectorOpen;editing=layout.editing;contextKind=layout.contextKind as typeof contextKind;beltPickerOpen=layout.beltPickerOpen;shapePickerOpen=layout.shapePickerOpen;modesOpen=layout.modesOpen;captureOpen=layout.captureOpen;tool=layout.tool as Tool;cursorTool=layout.cursorTool as typeof cursorTool;selected=[...layout.selected];}
/** E23: the presenting mode, extended. It hides the chrome (the .presentation rules), closes the working panels, and asks for real fullscreen on the stage. A refusal keeps focus in place. */
function startFocusMode(){
 if(presenting)return;
 focusSession=beginFocus(focusSession,readFocusLayout());
 writeFocusLayout(focusedLayout(readFocusLayout()));
 presenting=true;requestStageFullscreen();renderAll();
}
/** E23: leaving focus restores the exact layout it began from. */
function stopFocusMode(){
 if(!presenting)return;
 const ended=endFocus(focusSession);focusSession=ended.session;presenting=false;
 if(ended.restore)writeFocusLayout(ended.restore);
 leaveFullscreen();focusExitedAt=performance.now();renderAll();
}
/** E23: a path that replaces the layout itself (opening the editor) ends focus without restoring over what it just set. */
function dropFocusMode(){focusSession=NOT_FOCUSED;presenting=false;leaveFullscreen();}
function requestStageFullscreen(){
 const stage=document.getElementById('stage');if(!stage)return;
 // The focus is its own hold: the shared path (focusMode.ts) ends it on the browser's exit and when another mode takes the fullscreen over. A refusal keeps focus in place.
 const hold:FullscreenHold={lost:()=>stopFocusMode()};
 focusHold=hold;
 void requestStageFullscreenOn(stage,{navigationUI:'hide'},hold);
}
function leaveFullscreen(){const hold=focusHold;focusHold=null;if(hold)releaseStageFullscreen(hold);}
function openEntryGate(hasContinue:boolean,continueLabel?:string){
 if(nativeWorkspace?.nativeView())return; // the host already opened a native Expression: the frame stands on it
 const gate=$('entry-gate');gate.hidden=false;gate.innerHTML=entryGateHTML({hasContinue,continueLabel:continueLabel?`Continue “${continueLabel}”`:undefined,hasNative:kernelExpressionsAvailable()});
}
function closeEntryGate(){const gate=$('entry-gate');gate.hidden=true;gate.innerHTML='';}
window.addEventListener('physis-quality',(ev=>{const s=(ev as CustomEvent).detail??{};if(Number(s.fps)>0)physisFpsCap=Number(s.fps);if(Number(s.pixelRatio)>0){physisPixelRatio=Number(s.pixelRatio);if(physisPixelRatio!==physisRatioApplied){physisRatioApplied=physisPixelRatio;resize();}}if(Number(s.particleLimit)>0)physisParticleCap=Number(s.particleLimit);needsFrame=true;}) as EventListener);
function desktopSource():DesktopScene{return {expression:clone(store.document),sceneIndex,camera:{...camera},viewport:{width,height},name:scene().name+' · '+store.document.name};}
installPhysis(desktopSource,async source=>{await loadJourney(validateJourney(source.expression));setSceneRef(sceneRefAt(source.sceneIndex??0));camera={...defaultCamera(),...source.camera};if(source.viewport){camera.panX*=width/source.viewport.width;camera.panY*=height/source.viewport.height;}overlayDirty=true;needsFrame=true;renderAll();},toast);
void startWorkspace();
