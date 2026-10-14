/** Mature Research Canvas instruments mounted inside the running engine. */
import React,{Component,useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {clone,uid,type Scene} from './model.js';
import {notePlainText,type CanvasImportLink,type CanvasImportOutcome,type PlaceViewRecord,type ResearchCard,type ResearchMaterialAction,type ResearchStroke,type TimelineViewRecord} from './researchMaterial.js';
import {canvasImportLabel} from './undoLabels.js';
import {exportObsidianCanvas,noteBlocksFromText,parseObsidianCanvas,planObsidianImport,type CanvasExportEdge,type CanvasExportFrame,type CanvasExportNode,type ImportPlan} from './obsidianCanvas.js';
import {frameBounds,renderFrameStage,type StageEdge} from './frameImage.js';
import {download} from './capture';
import {capturePlaceView,layersKey,layersRecordOf,placeViewNameProblem,restoreLayers,restorePlaceView,sameTimeWindow} from './placeViews.js';
import {appendTourStop,captureTourStop,placeTourNameProblem,removeTourStop,withStopBinding,type PlaceTourRecord} from './placeTours.js';
import {placeTourSessionOf} from './placeTourSession.js';
import {playPlaceTour,type PlaceTourPlayback} from './placeTourPlayback.js';
import {PlaceTourPanel} from './placeTourPanel.js';
import {beats as journeyBeatsOf} from '../../../src/techne/m0m5/journey/beats';
import type {PlaceViewState} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/placeNavigation';
import {createStageFocus,releaseStageFullscreen,requestStageFullscreenOn} from './focusMode';
import type {FullscreenHold} from './focusMode';
import {openTimelinePresentation,timelineRestoreNote,timelineStyleLoaded,timelineStyleOf,timelineViewNameProblem,timelineViewOf,timelineViewRestorePlan,type TimelinePresentation} from './timelineViews.js';
import type {TimelinePresentationHandle} from '../../vendor/research-canvas/packages/canvas/src/timeline/TimelineLens';
import {CONNECTOR_KINDS,connectorPresentation,connectorRecord,connectorWithSides,sideFromHandleId,type ConnectorKind,type ResearchConnector} from './canvasConnectors.js';
import {frameHeadings,FRAME_TITLE_HIT_HEIGHT,FRAME_TITLE_MAX,type FrameHeading} from './canvasFrames.js';
import {viewDrift,viewNotice,type ViewBasis} from './viewDrift.js';
import {EMBED_CARD_SIZE,EMBED_GLYPH,canvasEmbedNodes,cardOverlayBox,embedCardLabel,embedHost,embedUrlRecord,isEmbedCardType,mediaFileName,mediaSourceUrl,type CentralPathRef} from './canvasEmbeds.js';
import {createRoot,type Root} from 'react-dom/client';
import {CanvasView,TimelineSurface,PsychogeographicMap,StreetViewSurface,loadBundledGeographyPack,createLiveServicePolicy,type LiveServicePolicy,type TimelineViewState} from '../../vendor/research-canvas/components';
import {defaultPlaceView,placeRecordFromViewState,viewStateFromPlaceRecord} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/placeNavigation';
import type {PlaceViewRestoreTarget} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/PsychogeographicMap';
import {defaultBasemapStack,type BasemapStack} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/basemapLayers';
import type {KernelConversion} from './kernelDocumentBridge.js';
import {techneConstellationRequest,techneTimeWindowRequest,naraInstrumentRequest,openExternalLink,type TechneSceneReadingRequest,type TechneConstellationRequest} from './kernelExpressions.js';
import {daylightFromSky,skyRequestEpoch,type DaylightAnswer,type DaylightHost} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/terminator';
import type {NaraIdentityResult} from '../../../src/nara/identity/types';
import type {SkyRequest} from '../../../src/nara/identity/types';
import {ladderRungSummaries,referenceFrameLadder} from '../../../src/techne/m0m5/place/world';
import {evidenceAnchorOf} from '../../../src/techne/m0m5/timeline/navigationIdentity';
import {nativeInstrumentCanvas,nativeInstrumentTitles,nativeInstrumentPreviews,nativeInstrumentNodeTags,nativeInstrumentSourceRelations,readingInstruments,CANVAS_UNITS,assertInstrumentReadingScope,expressionTextFromNote,type InstrumentCanvas,type NativeRelationDirectionReading} from './researchInstrumentsData.js';
import {createGestureTransaction,withGesturePreviews,type GestureTransaction} from './canvasGesture.js';
import {
 positioned,nudge,translateSelection,align as alignPositions,distribute as distributePositions,snapToGrid,
 semanticZoomLevel,trackModifiers,type AlignMode,type RepertoireMove,
} from './canvasRepertoire.js';
import {RelationFieldView} from './relationFieldView.js';
import {PlaceFacetsPanel} from './placeFacetsPanel.js';
import {searchChoiceWrite,placeMountFocus} from './placeSearch.js';
import {PlaceSearch} from './placeSearchPanel.js';
import {OPEN_PLACE_FILTER,filteredPlacesRepository,subjectEntityRef,type PlaceFilterState} from './placeReading.js';
import type {TechneReading,TechnePlaceFacet} from '../../../src/techne/contract';
import {timelineOpenPlan,type PlaceOffer} from '../../../src/techne/m0m5/place/navigation';
import {readSharedTimeWindow,writeSharedTimeWindow,writeSharedTraversalHop,followSharedTimeNudges,trackOwnSharedTimeWrite,qualifyTimeWindowReply,SharedTimeWindowControls,type SharedTimeDraft} from './sharedTimeWindow.js';
import {sharedTimelinePresentation} from './sharedTimeProjection.js';
import {timeAxisProjection,relativeTimeAxisProjection} from '../../../src/techne/m0m5/timeline/timeAxis';
import {axisEventOf,currentHop,foldStanding,handoffDisclosure,handoffRefusal,openEndpoint,openRelation,relationRefOf,showOnGlobeOf,traversalHopOf,trailFromEvent,trailOfNavigation,type GlobeCarry,type TraversalFold} from '../../../src/techne/m0m5/timeline/navigationIdentity';
import type {DisclosureTraversalStep} from '../../../src/techne/contract';
import {sessionCrossingIdentity} from '../../../src/techne/session';
import {containmentPairs,projectionAvailability,relationEdges,participantSpansFromReading} from '../../../src/techne/m0m5/timeline/relations';
import {chronologyVoice,NO_DATES_SENTENCE} from '../../vendor/research-canvas/packages/canvas/src/timeline/availabilityVoice';
import type {NativeTimeWindowBasis,NativeTimeWindowReply,NativeTimeWindowRequest} from '../../../../../packages/expressions-boundary/src/timeWindow';
import {blueprintMember,type SceneBlueprint,type BlueprintTransform} from './blueprintGeometry.js';
import {icon} from './icons.js';
import {addRouteNotice,moveRouteNotice,placeDraftForAdd,placeDraftForMove,constellationResultNotice,type PlaceAuthoringHost,type PlaceDraft,type PlaceRouteResult} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/placeAuthoring';
import {extentOf,type PlaceTimeHost} from '../../vendor/research-canvas/packages/canvas/src/psychogeographic/placeTimeControl';
import './researchInstrumentStyles.css';
import './researchInstruments.css';
import {CanvasNavigationOverview} from './canvasNavigationOverview';
import {CanvasFindOverlay} from './canvasFindOverlay';
import {canvasFindTargets,resolveCanvasFindTarget,canvasFindCamera,type CanvasFindTarget} from './canvasFind';
import {presentFrames,presentStep,presentViewport,PRESENT_GLYPH,type PresentFrame} from './canvasPresent';
import type {NavigationMinimapController} from '../../../src/shared/NavigationMinimap';
import {fitViewport,zoomTo,keepGuidedAxes,snapDraggedBox,guideSegments,CANVAS_ZOOM_LIMITS,ZOOM_STEP,type Box,type GuideLine} from '../../vendor/research-canvas/packages/canvas/src/canvas/navigationGeometry';
import {CanvasGuides} from '../../vendor/research-canvas/packages/canvas/src/canvas/CanvasGuides';
import {ZoomReadout} from '../../vendor/research-canvas/packages/canvas/src/canvas/ZoomReadout';
import {CANVAS_TOOL_CHOICES,CANVAS_TOOL_GLYPHS,CANVAS_TOOL_SPEC,PALETTE_KEYS,PALETTE_LABEL,SHAPE_FILLS,STICKY_DEFAULT_PALETTE,canvasObjectNodes,isCanvasObjectKind,type CanvasObjectKind,type CanvasToolChoice,type PaletteKey,type ShapeFill} from './canvasShapes.js';

/** D3 — the canvas tool row is icon-led, in the app's existing 24×24
 * thin-stroke icon language (icons.ts), not text-led. Every button below
 * keeps its own aria-label and title carrying the exact prior visible text,
 * so nothing here changes for assistive tech or hover discovery — only the
 * always-visible label becomes a glyph. */
function ToolIcon({name}:{name:string}){return <span className="research-tool-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:icon(name)}}/>;}
/** B2/B3 — one download: the file is saved by the browser, nothing is uploaded or stored. */
function saveBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
/** A file name from the Canvas's title: letters, digits and dashes only. */
const fileStem=(title:string)=>title.replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'canvas';
/** lane-1 C3 — the native subject a canvas card can show in the graph. Only an entity
 * that carries its own subject ref and native owner qualifies; a resource file, an
 * unbound card or an owner-less subject yields nothing, so no affordance is offered. */
export function graphHopSubject(entity:{subject?:{subject_ref?:unknown;native_owner?:unknown}|null}|undefined):{subject_ref:string;native_owner:string}|undefined{
 const ref=entity?.subject?.subject_ref,owner=entity?.subject?.native_owner;
 return typeof ref==='string'&&ref.trim()&&typeof owner==='string'&&owner.trim()?{subject_ref:ref,native_owner:owner}:undefined;
}
/** lane-1 A9 — a frame's heading at its top edge. A titled frame shows its caption; an untitled frame, while the canvas is editable, offers only a hit strip so the owner can title it in place. Double-click edits; Enter or blur commits; Escape cancels; a blank title removes the heading. */
function FrameHeadings({headings,editable,onTitle}:{headings:FrameHeading[];editable:boolean;onTitle:(id:string,title:string)=>void}){
 const [editing,setEditing]=useState<string|null>(null);
 const shown=headings.filter(heading=>heading.title||editable);
 if(!shown.length)return null;
 return <div className="research-frame-headings">{shown.map(heading=>{
  if(editing===heading.id)return <input key={heading.id} className="research-frame-title-input" aria-label="Frame title" maxLength={FRAME_TITLE_MAX} autoFocus defaultValue={heading.title} style={{left:heading.left,top:heading.top}}
   onBlur={event=>{const next=event.currentTarget.value;setEditing(null);if(next.trim()!==heading.title)onTitle(heading.id,next);}}
   onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();if(event.key==='Escape'){event.currentTarget.value=heading.title;event.currentTarget.blur();}}}/>;
  const className=`research-frame-heading${heading.hit?' research-frame-heading--hit':''}${editable?' research-frame-heading--editable':''}`;
  return <div key={heading.id} className={className} data-frame={heading.id} style={heading.hit?{left:heading.left,top:heading.top,width:heading.width,height:FRAME_TITLE_HIT_HEIGHT}:{left:heading.left,top:heading.top}} onDoubleClick={editable?()=>setEditing(heading.id):undefined}>{heading.title}</div>;
 })}</div>;
}
/** lane-1 A10 — an embed or media card drawn over its occurrence's own box. The overlay passes pointer events through, so selection and drag stay with the card beneath; only the link is clickable. A link card shows its title, host and an "Open in browser" link: the native frame policy does not embed pages, so the card never frames one. */
type EmbedOverlay={id:string;kind:'embed'|'media';label:string;url?:string;media?:CentralPathRef;left:number;top:number;width:number;height:number};
function EmbedCardOverlays({items}:{items:EmbedOverlay[]}){
 if(!items.length)return null;
 return <div className="research-embed-layer">{items.map(item=>{
  const style={left:item.left,top:item.top,width:item.width,height:item.height};
  if(item.kind==='embed'&&item.url)return <div key={item.id} className="research-embed-card" data-kind="embed" style={style}>
   <span className="research-embed-title">{item.label}</span>
   {/* Lane-1 A10: an https link leaves the frame only through the host (the Tauri opener); a frame cannot open a browser tab itself. */}
   <a className="research-embed-link" href={item.url} rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={event=>{event.preventDefault();openExternalLink(item.url!);}}>{embedHost(item.url)} · Open in browser</a>
  </div>;
  if(item.kind==='media'&&item.media)return <div key={item.id} className="research-embed-card research-embed-card--media" data-kind="media" style={style}>
   <img src={mediaSourceUrl(item.media)} alt={mediaFileName(item.media)} draggable={false}/>
   <span className="research-embed-title">{item.label}</span>
  </div>;
  return null;
 })}</div>;
}
/** A2 — the same 24×24 stroke grammar as ToolIcon, for the object glyphs drawn in canvasShapes.ts. */
function GlyphIcon({glyph}:{glyph:string}){return <span className="research-tool-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${glyph}"/></svg>`}}/>;}
/** A2 — the one canvas object picker: a single icon button that opens the five
 * choices (sticky, rectangle, ellipse, diamond, text). Each choice is named by
 * its aria-label and title; the trigger shows the last choice made. */
function CanvasObjectPicker({choice,onPick}:{choice?:CanvasToolChoice;onPick:(choice:CanvasToolChoice)=>void}){
 const [open,setOpen]=useState(false);
 const shown=choice??'sticky';
 return <span className="research-object-picker" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);}}}>
  <button type="button" aria-label="Add sticky, shape or text" title="Add sticky, shape or text" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><GlyphIcon glyph={CANVAS_TOOL_GLYPHS[shown]}/></button>
  {open&&<span role="menu" className="research-object-picker__menu" aria-label="Sticky, shape or text">
   {CANVAS_TOOL_CHOICES.map(name=><button key={name} type="button" role="menuitem" aria-label={CANVAS_TOOL_SPEC[name].label} title={CANVAS_TOOL_SPEC[name].label} onClick={()=>{setOpen(false);onPick(name);}}><GlyphIcon glyph={CANVAS_TOOL_GLYPHS[name]}/></button>)}
  </span>}
 </span>;
}
/** A2 — palette keys as swatches. A swatch names its key; its fill is a token (CSS), never a colour value here. */
function ObjectSwatches({label,value,options,onPick}:{label:string;value:string;options:readonly string[];onPick:(key:string)=>void}){
 return <div className="research-object-swatches" role="group" aria-label={label}>
  {options.map(key=><button key={key} type="button" className="research-object-swatch" data-palette={key} aria-label={key==='none'?'No fill':PALETTE_LABEL[key as PaletteKey]} title={key==='none'?'No fill':PALETTE_LABEL[key as PaletteKey]} aria-pressed={value===key} onClick={()=>onPick(key)}/>)}
 </div>;
}
/** A2 — the inspector's controls for one canvas object: its label (the occurrence name) and its palette key or fill key. */
function CanvasObjectControls({kind,card,onLabel,onStyle}:{kind:CanvasObjectKind;card:ResearchCard;onLabel:(label:string)=>void;onStyle:(patch:Partial<Pick<ResearchCard,'palette'|'fill'>>)=>void}){
 const label=card.caption??'';
 return <>
  <label>Label<input key={label} defaultValue={label} maxLength={160} onBlur={event=>{const next=event.target.value.trim();if(next!==label)onLabel(next);}}/></label>
  {kind==='sticky'&&<ObjectSwatches label="Sticky colour" value={card.palette??STICKY_DEFAULT_PALETTE} options={PALETTE_KEYS} onPick={key=>onStyle({palette:key as PaletteKey})}/>}
  {kind==='shape'&&<ObjectSwatches label="Shape fill" value={card.fill??'none'} options={SHAPE_FILLS} onPick={key=>onStyle({fill:key as ShapeFill})}/>}
 </>;
}

/** Lane-4 T17b: the owner's constellation routes this instrument opened, by frame ref, each with the marker it may move. */
const placeRoutes=new Map<string,{graphNodeId?:string}>();
/** The live places host's answer handler; the latest reading of the Places instrument replaces it. */
let placeRouteHandler:((frameRef:string,outcome:{kind:'saved'}|{kind:'refused';reason?:string})=>void)|undefined;
let placeRouteListening=false;
/** Lane-4 T17c: the Places maps that asked for the owner's answers. Each receives every answer to a route this instrument opened. */
const placeRouteListeners=new Set<(result:PlaceRouteResult)=>void>();
/** The stable subscription a Places map is given. It returns the unsubscribe. */
function subscribePlaceRouteResults(listener:(result:PlaceRouteResult)=>void){placeRouteListeners.add(listener);return()=>{placeRouteListeners.delete(listener)};}
/** Listens once for the cradle's answer to a route this instrument opened. Only the parent host may answer. */
function listenForPlaceRouteResults(){
 if(placeRouteListening||typeof window==='undefined')return;placeRouteListening=true;
 window.addEventListener('message',event=>{
  const data=event.data as {v?:unknown;kind?:unknown;target?:{frame_ref?:unknown};result?:unknown;reason?:unknown}|null;
  if(event.source!==window.parent||!data||data.v!==1||data.kind!=='constellation-result')return;
  const frameRef=data.target?.frame_ref;
  if(typeof frameRef!=='string'||!placeRoutes.has(frameRef))return;
  if(data.result==='saved')placeRouteHandler?.(frameRef,{kind:'saved'});
  else if(data.result==='refused')placeRouteHandler?.(frameRef,{kind:'refused',reason:typeof data.reason==='string'?data.reason:undefined});
 });
}

/** Visibility comes from the current native frame binding, not a card title. */
function ConstellationAction({request,onError}:{request:Omit<TechneConstellationRequest,'operation'>;onError:(message:string)=>void}) {
 const [available,setAvailable]=useState(false),[busy,setBusy]=useState(false);
 const key=JSON.stringify(request);
 useEffect(()=>{let live=true;setAvailable(false);void techneConstellationRequest({...request,operation:'inspect'}).then(()=>{if(live)setAvailable(true);}).catch(()=>{});return()=>{live=false;};},[key]);
 if(!available)return null;
 return <button disabled={busy} onClick={()=>{setBusy(true);void techneConstellationRequest({...request,operation:'open'}).catch(error=>onError(error instanceof Error?error.message:String(error))).finally(()=>setBusy(false));}}>Edit constellation</button>;
}

/** lane-1 A3 — a connection's line kind (three quiet line glyphs in the tool
 * grammar, no words) and its owner-written midpoint label. Presentation only:
 * the relation keeps its own kind and direction. Emptying the label clears it. */
const CONNECTOR_GLYPHS:Record<ConnectorKind,string>={straight:'M4 20 L20 4',curved:'M4 20 C4 8 20 16 20 4',elbow:'M4 20 V12 H20 V4'};
function ConnectorControls({record,onChange}:{record:ResearchConnector|undefined;onChange:(next:ResearchConnector|null)=>void}){
 const kind:ConnectorKind=record?.kind??'curved';
 const [draft,setDraft]=useState(record?.label??'');
 useEffect(()=>setDraft(record?.label??''),[record?.label]);
 const keep={fromSide:record?.fromSide,toSide:record?.toSide};
 const commit=()=>{const next=draft.trim();if(next!==(record?.label??''))onChange(connectorRecord({kind,label:next,...keep}));};
 return <div className="research-connector-controls">
  <div className="research-connector-kinds" role="group" aria-label="Connection line">{CONNECTOR_KINDS.map(option=><button key={option} type="button" aria-label={option} aria-pressed={kind===option} title={option} className="research-connector-kind" onClick={()=>{if(option!==kind)onChange(connectorRecord({kind:option,label:record?.label,...keep}));}}>
   <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={CONNECTOR_GLYPHS[option]}/></svg></button>)}</div>
  <label className="research-connector-label">Label<input aria-label="Connection label" value={draft} maxLength={160} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>
 </div>;
}
/** Presentation connection ≠ evidence. This offers a deliberate act — record
 * the disclosed O:I connection as a typed knowledge relation through the
 * native constellation operation — never an automatic promotion. */
function RelateKnowledgeAction({sceneId,sourceRef,targetRef,defaultRelation,relate,onError,onResult}:{
 sceneId:string;sourceRef:string;targetRef:string;defaultRelation:string;
 relate:(sceneId:string,input:{sourceEntityRef:string;targetEntityRef:string;relation:string;direction:'directed'|'undirected'})=>Promise<{relation_ref:string;frame_ref:string;frame_revision:number}>;
 onError:(message:string)=>void;onResult:(message:string)=>void;
}){
 const [relation,setRelation]=useState(defaultRelation);
 const [direction,setDirection]=useState<'directed'|'undirected'>('directed');
 const [busy,setBusy]=useState(false);
 return <div className="research-relate-knowledge">
  <label>Relation<input value={relation} onChange={e=>setRelation(e.target.value)} maxLength={160}/></label>
  <label>Direction<select value={direction} onChange={e=>setDirection(e.target.value as 'directed'|'undirected')}><option value="directed">Directed</option><option value="undirected">Undirected</option></select></label>
  <button disabled={busy||!relation.trim()} onClick={()=>{
   setBusy(true);
   relate(sceneId,{sourceEntityRef:sourceRef,targetEntityRef:targetRef,relation:relation.trim(),direction})
    .then(result=>onResult(`Recorded as constellation relationship · ${result.relation_ref}`),error=>onError(error instanceof Error?error.message:String(error)))
    .finally(()=>setBusy(false));
  }}>Record as constellation relationship</button>
 </div>;
}

/** Compact Canvas control group over a bound blueprint whole (owner
 * commission, QL-MEF #214 geometry-closeout): Move/Rotate/Scale are ONE
 * transform act (one `transformBlueprint` call per press, mirroring the
 * native `scene_blueprint_transform` law — never a member-by-member edit);
 * Release and Pin/Unpin are their own distinct labelled acts, never folded
 * into the transform. Shown only while the current selection is an actual
 * blueprint member (`blueprintMember`), never guessed from shape or count. */
function BlueprintWholeControls({binding,pinned,busy,onTransform,onRelease,onPin}:{
 binding:SceneBlueprint;pinned:boolean;busy:boolean;
 onTransform:(transform:BlueprintTransform)=>void;onRelease:()=>void;onPin:(pinned:boolean)=>void;
}){
 const TRANSLATE_STEP=20,ROTATE_STEP=15*Math.PI/180,SCALE_FACTOR=1.1;
 const move=(dx:number,dy:number)=>onTransform({...binding.transform,translation:[binding.transform.translation[0]+dx,binding.transform.translation[1]+dy,binding.transform.translation[2]]});
 const rotate=(delta:number)=>onTransform({...binding.transform,rotation:[binding.transform.rotation[0],binding.transform.rotation[1],binding.transform.rotation[2]+delta]});
 const rescale=(factor:number)=>onTransform({...binding.transform,scale:binding.transform.scale*factor});
 return <div className="research-blueprint-controls" aria-label="Blueprint whole controls">
  <p>{binding.members.length} sixfold roles move together.</p>
  <div className="native-actions" role="group" aria-label="Move whole">
   <button type="button" disabled={busy} aria-label="Move whole left" onClick={()=>move(-TRANSLATE_STEP,0)}>←</button>
   <button type="button" disabled={busy} aria-label="Move whole right" onClick={()=>move(TRANSLATE_STEP,0)}>→</button>
   <button type="button" disabled={busy} aria-label="Move whole up" onClick={()=>move(0,-TRANSLATE_STEP)}>↑</button>
   <button type="button" disabled={busy} aria-label="Move whole down" onClick={()=>move(0,TRANSLATE_STEP)}>↓</button>
  </div>
  <div className="native-actions" role="group" aria-label="Rotate whole">
   <button type="button" disabled={busy} onClick={()=>rotate(-ROTATE_STEP)}>Rotate −</button>
   <button type="button" disabled={busy} onClick={()=>rotate(ROTATE_STEP)}>Rotate +</button>
  </div>
  <div className="native-actions" role="group" aria-label="Scale whole">
   <button type="button" disabled={busy} onClick={()=>rescale(1/SCALE_FACTOR)}>Scale −</button>
   <button type="button" disabled={busy} onClick={()=>rescale(SCALE_FACTOR)}>Scale +</button>
  </div>
  <div className="native-actions">
   <button type="button" disabled={busy} aria-pressed={pinned} onClick={()=>onPin(!pinned)}>{pinned?'Unpin world position':'Pin world position'}</button>
   <button type="button" disabled={busy} onClick={()=>{if(window.confirm('Release this blueprint? Its roles keep their current positions but stop moving as one whole.'))onRelease();}}>Release blueprint</button>
  </div>
 </div>;
}
/** lane-2 T21: a control that follows the chronology's selected event. It re-renders only itself, so a selection never re-reads
 * the timeline's repository or resets its filters. */
function SelectedEventControl({initial,listen,control}:{initial:string|null;listen:(listener:(eventRef:string|null)=>void)=>void;control:(eventRef:string|null)=>ReactNode}){
 const [selected,setSelected]=useState<string|null>(initial);
 useEffect(()=>{listen(setSelected);},[]);
 return <>{control(selected)}</>;
}
/** lane-2 T20: a control that follows the traversal trail, as SelectedEventControl follows the selected event. */
function TrailControl({initial,listen,control}:{initial:TraversalFold|null;listen:(listener:(trail:TraversalFold|null)=>void)=>void;control:(trail:TraversalFold|null)=>ReactNode}){
 const [trail,setTrail]=useState<TraversalFold|null>(initial);
 useEffect(()=>{listen(setTrail);},[]);
 return <>{control(trail)}</>;
}
export type ResearchInstrument='m1'|'m2'|'m4';
function ImageryPanel(props:React.ComponentProps<typeof StreetViewSurface>&{tools:HTMLElement}){
 const [open,setOpen]=useState(false),toggle=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null);
 useEffect(()=>{if(open)panel.current?.querySelector<HTMLButtonElement>('button')?.focus();},[open]);
 const close=()=>{setOpen(false);toggle.current?.focus();};
 return <>{createPortal(<div className="research-tool-actions"><button ref={toggle} aria-expanded={open} aria-controls="research-imagery" onClick={()=>setOpen(value=>!value)}>Images</button></div>,props.tools)}
  <aside ref={panel} id="research-imagery" className="research-street-view" aria-label="Scene imagery" hidden={!open} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
   <header><h3>Scene imagery</h3><button type="button" onClick={close} aria-label="Close scene imagery">Close</button></header>
   <StreetViewSurface {...props}/>
  </aside></>;
}
/** Lane-4 T27: the day/night reading, asked through the native instrument route the dated sky uses (NaraCurrentSky), in its
 * identity-free transit form. An open window asks for now (`current`); a bounded one asks for its instant (`historical`).
 * Nothing here computes the sun: the answer is the reading's own stated subsolar point, or the reading's own reason. */
async function readPlacesDaylight(instant:string|null):Promise<DaylightAnswer> {
 const request:SkyRequest={schema:'ql.sky-request/v1',epoch:skyRequestEpoch(instant)+'Z',timezone:'UTC',mode:instant===null?'current':'historical',perspective:'Apparent Geocentric',zodiac:'Tropical',ayanamsha:null,observer:null,max_age_seconds:300,backend_policy:'allow-moshier'};
 const reply=await naraInstrumentRequest({operation:'identity',request:{operation:'transit',request}}) as NaraIdentityResult;
 if(reply.error)return {status:'unavailable',reason:reply.error};
 if(!reply.transit)return {status:'unavailable',reason:'the native sky reading returned no transit reading'};
 if(!reply.transit.sky)return {status:'unavailable',reason:`the dated sky is unavailable (transit status: ${reply.transit.status})`};
 return daylightFromSky(reply.transit.sky);
}
const PLACES_DAYLIGHT:DaylightHost={read:readPlacesDaylight};
/** Lane-4 T23: the Places facet's place becomes the shared session's spatial focus through the owner's compare-and-set write
 * (null clears it). Same discipline as writeSharedTimeWindow: the acknowledged reply must still address this source and Scene. */
async function writeSharedSpatialFocus(basis:NativeTimeWindowBasis,reading:TechneReading,instrument:'timeline'|'place',acknowledged:NativeTimeWindowReply,placeRef:string|null):Promise<NativeTimeWindowReply> {
 // T-FRAME-TIME-PUSH: a spatial write is this frame's own write too, so its nudge echo costs nothing.
 return trackOwnSharedTimeWrite(writeSharedSpatialFocusNow(basis,reading,instrument,acknowledged,placeRef));
}
async function writeSharedSpatialFocusNow(basis:NativeTimeWindowBasis,reading:TechneReading,instrument:'timeline'|'place',acknowledged:NativeTimeWindowReply,placeRef:string|null):Promise<NativeTimeWindowReply> {
 if(acknowledged.basis.expression_ref!==basis.expression_ref||acknowledged.basis.scene_ref!==basis.scene_ref
  ||acknowledged.basis.revision!==basis.revision||acknowledged.reading_ref!==reading.reading_ref) {
  throw Error('This place belongs to an earlier native source or Scene; it was not changed');
 }
 const request:NativeTimeWindowRequest={...basis,operation:'spatial',reading_ref:reading.reading_ref,instrument,
  expected_session_ref:acknowledged.session.session_ref,expected_selection:acknowledged.session.selection,expected_window:acknowledged.axis.window,
  expected_spatial_focus_ref:acknowledged.session.spatial_focus_ref??null,spatial_focus_ref:placeRef};
 return qualifyTimeWindowReply(await techneTimeWindowRequest(request),basis,reading,instrument);
}

export interface ResearchInstrumentsHost {
 container:HTMLElement;
 tools:HTMLElement; inspector:HTMLElement;
 /** The Studio's Places section: M4′ place facets and filters render here. */
 placesHome?:HTMLElement;
 /** The Studio's Canvas section: source focus, frames and saved views. */
 canvasHome?:HTMLElement;
 /** Page the Scene's loaded members (the renderer window) through the native
  * working document; every member of a large constellation stays reachable. */
 pageMembers?:(delta:number)=>Promise<unknown>;
 sceneMaterial:(sceneId:string)=>Scene;
 material:(sceneId:string,action:ResearchMaterialAction)=>Promise<void>;
 /** lane-1 A3–A4 — sets or clears one connector's presentation record by native edge id (null clears). OPTIONAL: when the host does not supply it the connector kind, label and side are read but not editable. */
 connector?:(sceneId:string,edgeId:string,value:ResearchConnector|null)=>Promise<void>;
 inspectSubject:(ref:string,context?:{node?:unknown;relationField?:unknown;anchor?:unknown})=>void;
 /** lane-1 C3 — opens the field's wiki graph centred on a native subject, by its exact ref and owner. OPTIONAL: undeclared hosts offer no "Show in graph". */
 showInGraph?:(subjectRef:string,nativeOwner:string)=>void;
 read:(request:TechneSceneReadingRequest)=>Promise<unknown>;
 nativeView:()=>KernelConversion|undefined;
 sceneId:()=>string;
 select:(sceneId:string,entityId:string|null,bindingRef?:string)=>void;
 move:(sceneId:string,entityId:string,position:{x:number;y:number})=>Promise<void>;
 /** OPTIONAL — a multi-select move/align/distribute/nudge is one user
  * gesture and must land as one native write, not one per member. Declared
  * so the host can batch it through its own single `changed()`/commit;
  * undeclared hosts fall back to sequential `move` calls (still one
  * gesture, but N native writes — the host should implement this). */
 moveMany?:(sceneId:string,moves:{entityId:string;position:{x:number;y:number}}[])=>Promise<void>;
 openSubject:(ref:string)=>void;
 /** Lane-4 T23 — the app's instrument activation. Places' "Open in Timeline" records the Timeline instrument through it, so the
  * app's instrument state matches the lens. OPTIONAL: undeclared hosts load the Timeline lens directly. */
 activateInstrument?:(lens:'timeline'|'place')=>void;
 /** OPTIONAL — declared for the empty-field creation path (Wayfinder §21:
  * choosing a frame can create an incomplete working draft; creation must
  * not be disabled when no subject/constellation exists yet). Undeclared
  * hosts simply do not offer "New constellation" from an unbound canvas. */
 createScene?:()=>Promise<void>;
 createNote?:(sceneId:string,position:{x:number;y:number})=>Promise<void>;
 duplicateOccurrence?:(sceneId:string,entityId:string)=>Promise<void>;
 deleteOccurrence?:(sceneId:string,entityId:string)=>Promise<void>;
 updateContent?:(sceneId:string,entityId:string,text:string)=>Promise<void>;
 connect?:(sceneId:string,input:{sourceEntityRef:string;targetEntityRef:string;relationKind:string;directionality?:string})=>Promise<void>;
 // B2: several connections in ONE owner edit. Refused whole when any input is refused; returns the minted binding refs in input order.
 connectMany?:(sceneId:string,inputs:{sourceEntityRef:string;targetEntityRef:string;relationKind:string;directionality?:string;label?:string;connector?:ResearchConnector}[])=>Promise<string[]>;
 // B2/E15/E16: a .canvas import is ONE labelled undo step: its cards, frames and connections are one owner act. A refused part names itself and nothing lands.
 importCanvas?:(sceneId:string,label:string,actions:ResearchMaterialAction[],links:CanvasImportLink[])=>Promise<CanvasImportOutcome>;
 reconnect?:(sceneId:string,bindingRef:string,input:{sourceEntityRef:string;targetEntityRef:string})=>Promise<void>;
 deleteConnection?:(sceneId:string,bindingRef:string)=>Promise<void>;
 updateConnectionKind?:(sceneId:string,bindingRef:string,kind:string)=>Promise<void>;
 /** OPTIONAL — declared for C3 (onCycleEdgeDirectionality). Cycles an
  * O:I-owned connection's own directionality (forward→backward→bidirectional→
  * none→forward). Undeclared hosts simply do not offer the control — the
  * vendored Canvas hides "Cycle arrow direction" whenever this is absent. */
 updateConnectionDirectionality?:(sceneId:string,bindingRef:string,directionality:'forward'|'backward'|'bidirectional'|'none')=>Promise<void>;
 /** OPTIONAL — declared for C4(a). Opens the existing full Studio object/state
  * editor for this exact native occurrence while the Canvas instrument stays
  * mounted and active (no remount, no camera reset). */
 editObject?:(sceneId:string,entityId:string)=>void;
 /** OPTIONAL — declared for C4(b). Records a deliberate typed knowledge
  * relation through the native constellation operation. Never called
  * implicitly by the presentation connect gesture — only by an explicit
  * "Record as constellation relationship" act in the inspector. */
 relateKnowledge?:(sceneId:string,input:{sourceEntityRef:string;targetEntityRef:string;relation:string;direction:'directed'|'undirected'})=>Promise<{relation_ref:string;frame_ref:string;frame_revision:number}>;
 /** OPTIONAL — declared for the Canvas whole-transform control group (owner
  * commission, QL-MEF #214 geometry-closeout). ONE native
  * `scene_blueprint_transform` edit per call — move/rotate/scale together,
  * never a member-by-member edit. Undeclared hosts simply do not offer the
  * in-canvas controls; the separate Blueprint panel (blueprintHUD) still
  * works either way. */
 transformBlueprint?:(sceneId:string,transform:BlueprintTransform)=>Promise<void>;
 /** OPTIONAL — releases the current Scene's blueprint (`scene_blueprint_release`).
  * A distinct act from `transformBlueprint`: it never runs implicitly from a
  * transform press, only from its own explicit, confirmed control. */
 releaseBlueprint?:(sceneId:string)=>Promise<void>;
 /** OPTIONAL — the world-position pin (`entity_pin`), distinct from both
  * blueprint membership and release: holds or releases one entity's own
  * world position independent of any whole. */
 pinEntity?:(sceneId:string,entityId:string,pinned:boolean)=>Promise<void>;
}
interface ViewState {
 /** lane-2 T21: the mounted globe control's listener for the chronology's selected event (presentation only). */
 globeListener?:(eventRef:string|null)=>void;
 /** lane-2 T20: the chronology's traversal trail (event → relation → endpoint), presentation only; its refs are the session's, verbatim. */
 traversal?:TraversalFold|null;
 traversalListener?:(trail:TraversalFold|null)=>void;
 canvasMinimap?:React.MutableRefObject<NavigationMinimapController|null>;
 /** A1 — alignment guides for the card being dragged: presentation only,
  * flow-unit geometry drawn against the live viewport, cleared on release. */
 snapGuides?:{guides:GuideLine[];boxes:Box[]};
 canvas?:{x:number;y:number;zoom:number};timeline?:TimelineViewState;place?:{latitude:number;longitude:number;zoom:number};selectedNode?:string|null;selectedEdge?:string|null;selectedPlace?:string|null;placeFilter?:PlaceFilterState;livePlaces?:{allowed:boolean;policy:LiveServicePolicy;stack:BasemapStack};
 /** Lane-4 T21: the Places layers change waiting to settle (its timer and the write it will make now). */
 placeLayersSave?:{timer:ReturnType<typeof setTimeout>;write:()=>void};
 /** T-REVIEW-4 #3: the layers key this view last wrote or adopted from the Scene (its lastWrittenKey), and the writes still in flight. */
 placeLayersKey?:string;placeLayersWrites?:number;
 /** M2′: chronology (the vendored TimelineSurface) vs. the relation-field
  * projections (relationFieldView.tsx) — session-local presentation state,
  * never a second store. */
 m2Projection?:'chronology'|'field'|'relative';
 /** lane-2 T15–T18: the mounted chronology's presentation hold (null while it is unmounted), the presentation last captured
  * when the person leaves chronology (what a relation-mode save names), and a view waiting to be applied on mount. */
 timelineHandle?:TimelinePresentationHandle|null;timelinePresentation?:TimelinePresentation;timelinePending?:{name:string;presentation:TimelinePresentation};
 /** Remounts the chronology surface when a named view moves its camera (its camera is read once, at mount). */
 timelineKey?:number;
 timeDraft?:SharedTimeDraft;
 /** Gesture transactions live on the ViewState, not inside canvasNode's
  * per-render closures, so one gesture survives the many re-renders a drag
  * or resize produces. The `*Adapter` refs are rebound on every canvasNode()
  * call so the transaction always calls through to the current canvas/apply
  * closures without being recreated (and losing in-flight preview state). */
 moveGesture?:GestureTransaction<{x:number;y:number}>;
 moveAdapter?:{commit:(nodeId:string,position:{x:number;y:number})=>Promise<void>;onChange:()=>void};
 resizeGesture?:GestureTransaction<{width:number;height:number}>;
 resizeAdapter?:{commit:(nodeId:string,size:{width:number;height:number})=>Promise<void>;onChange:()=>void};
 /** Session-local sequence-walk membership. Not native material: no reading
  * discloses a "sequence"; this is a personal navigation aid over the
  * already-disclosed connections, cleared on reload like the draw colour. */
 sequencedEdges?:Set<string>;
 /** M1′ direct manipulation (Wayfinder §6, §13): the multi-select set (the
  * shift/ctrl-click extended selection; `selectedNode` above stays the
  * single "focus" the inspector shows). `groupPreview` carries an
  * in-progress group drag's overlay positions — each dragged member's own
  * position is now reported directly by the vendored Canvas (no local
  * drag-origin/delta bookkeeping); `groupMoveGesture` batches the whole
  * selection's move into ONE native write per gesture (keyed by a single
  * synthetic id so the existing per-gesture idle/deferred-flush batching
  * commits exactly once). */
 multiSelect?:Set<string>;
 groupPreview?:Map<string,{x:number;y:number}>;
 groupMoveGesture?:GestureTransaction<RepertoireMove[]>;
 snapToGrid?:boolean;
 lassoOn?:boolean;
 /** Canvas tool state lives in the per-view state (not closure variables):
  * it must survive the epoch-guarded redraws a native save round-trip
  * triggers, and the controlled colour input must re-render on change. */
 drawing?:boolean;
 erasing?:boolean;
 strokeColour?:string;
 zoomLevel?:'constellation'|'named'|'detailed';
 /** A2 — the last canvas object choice made from the picker (session-local, shown on its trigger). */
 objectTool?:CanvasToolChoice;
}
class InstrumentBoundary extends Component<{children:ReactNode},{error:string|null}> {
 state={error:null as string|null};
 static getDerivedStateFromError(error:unknown){return {error:error instanceof Error?error.message:String(error)};}
 render(){return this.state.error?<p role="alert" className="research-instrument-message">{this.state.error}</p>:this.props.children;}
}
export function installResearchInstruments(host:ResearchInstrumentsHost){
 let lens:ResearchInstrument|null=null,root:Root|null=null,epoch=0,destroyed=false;
 // Seam B: the object ref an open carries. load consumes it synchronously at its start, so it is never seen by a later refresh.
 let pendingFocus:string|undefined;
 // T-FRAME-TIME-PUSH: the presented time instrument's follower of the host's shared-window nudges (one at a time).
 let offSharedTimeNudges:(()=>void)|null=null;
 let captureCanvas:(()=>{x:number;y:number;zoom:number})|null=null,currentKey:string|null=null;
 const views=new Map<string,ViewState>();
 let mutations:Promise<void>=Promise.resolve();
 // B4: the title each occurrence last carried on this session's Canvas, so a departed member can be named after it is removed.
 const lastTitles=new Map<string,string>();
 let materialInFlight=0,deferredRefresh=false;
 let dismissedCard:string|null=null;let flyToNode:((id:string,viewport?:{x:number;y:number;zoom:number})=>void)|null=null;
 let flyToEdge:((id:string,viewport?:{x:number;y:number;zoom:number})=>void)|null=null;
 // A8 — presentation is session-local: its step lives only in this closure, and
 // leaving restores the editor from the snapshot taken on entry.
 type Presentation={key:string;state:ViewState;frames:PresentFrame[];index:number;hold:FullscreenHold;snapshot:{viewport?:{x:number;y:number;zoom:number};multiSelect?:Set<string>;selectedNode?:string|null;selectedEdge?:string|null;dismissedCard:string|null;panels:[HTMLElement,string][]}};
 let presentation:Presentation|null=null;
 // The Canvas last rendered as editable, with its find targets: what the Present act and P key start from.
 let presentable:{canvas:InstrumentCanvas;state:ViewState;targets:CanvasFindTarget[]}|null=null;

 const mount=document.createElement('div');mount.className='research-instrument';mount.hidden=true;host.container.append(mount);
 const status=document.createElement('div');status.className='research-instrument-status';status.setAttribute('role','status');
 const body=document.createElement('div');body.className='research-instrument-body';mount.append(body);host.tools.append(status);
 const message=(text:string)=>{status.textContent=text;};
// B1 — one quiet save-state glyph beside the status line: saving while an act's commit is in flight, saved once the owner acknowledges it,
// held when the owner refuses. It raises nothing on a routine save.
const saveGlyph=document.createElement('span');saveGlyph.className='research-save-glyph';saveGlyph.setAttribute('role','img');saveGlyph.dataset.saveState='saved';saveGlyph.setAttribute('aria-label','Saved');
const saveState=(state:'saving'|'saved'|'held')=>{saveGlyph.dataset.saveState=state;saveGlyph.setAttribute('aria-label',state==='saving'?'Saving':state==='held'?'Held, not saved':'Saved');};
host.tools.append(saveGlyph);
 // lane-2 T24, hoisted to the install (lane-2 T23–T25 seams): the M2′ stage has one focus session for the install, not one per
 // view. The session (focusMode.ts) holds the tools display it began from; unmount() ends it, so every lens change, close and
 // destroy brings the shared tools back. The stage's key listener is held here too, and detached on each unmount.
 // The stage focus is one controller for the install (focusMode.ts, the ported T24 lifecycle): it hides the tools, marks the stage and
 // asks for fullscreen under its own hold. A browser exit or another mode's takeover ends it through that hold.
 const stageFocus=createStageFocus({stage:body,chrome:host.tools,markKey:'timelineFocus'});
 let timelineFocusOff:(()=>void)|null=null;
 const focusOn=()=>stageFocus.isFocused();
 const endTimelineFocus=()=>stageFocus.end();
 const beginTimelineFocus=()=>stageFocus.begin();
 function retain(){if(currentKey&&captureCanvas){const state=views.get(currentKey);if(state)state.canvas=captureCanvas();}captureCanvas=null;}
 function disposeGestures(){for(const state of views.values()){state.moveGesture?.dispose();state.resizeGesture?.dispose();state.groupMoveGesture?.dispose();}}
 function unmount(){endTimelineFocus();timelineFocusOff?.();timelineFocusOff=null;retain();endPresentation(false);presentable=null;disposeGestures();root?.unmount();root=null;body.replaceChildren();}
 // Multi-select repertoire (R1/R2, Wayfinder §6, §13). The vendored Canvas
 // reports neither modifier keys on a node click nor a batched multi-node
 // drag, so shift/ctrl-extend is tracked independently here, and a group
 // drag is realised by translating every OTHER selected node's preview by
 // the SAME delta the actively-dragged node reports — one coherent commit
 // per gesture either way (see groupContext below).
 const modifiers=trackModifiers();
 let groupContext:{state:ViewState;canvas:InstrumentCanvas;sceneId?:string}|null=null;
 const nudgeStep=(shift:boolean)=>shift?40:10;
 const onWindowKeydown=(event:KeyboardEvent)=>{
  if(destroyed||lens!=='m1'||!groupContext)return;
  const target=event.target as HTMLElement|null;
  if(target?.isContentEditable||target?.tagName==='INPUT'||target?.tagName==='TEXTAREA')return;
  if(!target?.closest?.('.research-canvas'))return;
  const axis=event.key==='ArrowLeft'?'left':event.key==='ArrowRight'?'right':event.key==='ArrowUp'?'up':event.key==='ArrowDown'?'down':null;
  if(!axis)return;
  const {state,canvas,sceneId}=groupContext;
  const selection=state.multiSelect?.size?[...state.multiSelect]:state.selectedNode?[state.selectedNode]:[];
  if(!selection.length||!sceneId)return;
  event.preventDefault();
  const overrides=nudge(canvas.nodes.map(node=>state.groupPreview?.get(node.id)?{...node,position:state.groupPreview.get(node.id)!}:node),selection,axis,nudgeStep(event.shiftKey));
  applyGroupOverrides(state,canvas,sceneId,overrides);
 };
 window.addEventListener('keydown',onWindowKeydown);
 // A6 — zoom and fit. Every camera move goes through the path the Canvas
 // already has (flyToNode with a viewport, so xyflow's own easing, and the
 // duration is cameraDuration, zero under reduced motion), never a second
 // transform. The limits are the vendored Canvas's own, passed to ReactFlow.
 const ZOOM_LIMITS=CANVAS_ZOOM_LIMITS;
 let navigation:{canvas:InstrumentCanvas;selection:Set<string>}|null=null;
 const paneSize=()=>{const rect=mount.querySelector('.research-canvas')?.getBoundingClientRect();return {width:rect?.width??0,height:rect?.height??0};};
 const currentViewport=()=>captureCanvas?.()??{x:0,y:0,zoom:1};
 const cameraTo=(viewport:{x:number;y:number;zoom:number})=>{flyToNode?.('',viewport);};
 const zoomView=(zoom:number)=>{cameraTo(zoomTo(currentViewport(),zoom,paneSize(),ZOOM_LIMITS));};
 const fitBoxes=(boxes:Box[])=>{const fit=fitViewport(boxes,paneSize(),ZOOM_LIMITS);if(!fit)return;cameraTo(fit.viewport);if(fit.clamped&&fit.viewport.zoom===ZOOM_LIMITS.minZoom)message('Fit stopped at the zoom limit; some cards are off screen.');};
 const boxOfNode=(node:{position:{x:number;y:number};size?:{width:number;height:number}}):Box=>({x:node.position.x,y:node.position.y,width:node.size?.width??200,height:node.size?.height??140});
 // The zoom percentage fades in its own small root, so a running zoom never
 // re-renders the canvas tree.
 const readoutHost=document.createElement('div');readoutHost.className='canvas-zoom-readout-host';mount.append(readoutHost);
 const readoutRoot=createRoot(readoutHost);
 let readoutZoom:number|null=null,readoutToken=0;
 const showZoom=(zoom:number)=>{if(zoom===readoutZoom)return;readoutZoom=zoom;readoutToken++;readoutRoot.render(<ZoomReadout zoom={zoom} token={readoutToken}/>);};
 const onZoomKeydown=(event:KeyboardEvent)=>{
  if(destroyed||lens!=='m1'||!navigation)return;
  const target=event.target as HTMLElement|null;
  if(target?.isContentEditable||target?.tagName==='INPUT'||target?.tagName==='TEXTAREA'||target?.tagName==='SELECT')return;
  if(!target?.closest?.('.research-canvas')||event.metaKey||event.ctrlKey||event.altKey)return;
  const {canvas,selection}=navigation;
  if(event.key==='+'||event.key==='='){event.preventDefault();zoomView(currentViewport().zoom*ZOOM_STEP);}
  else if(event.key==='-'||event.key==='_'){event.preventDefault();zoomView(currentViewport().zoom/ZOOM_STEP);}
  else if(event.key==='0'&&!event.shiftKey){event.preventDefault();zoomView(1);}
  else if(event.shiftKey&&event.code==='Digit1'){event.preventDefault();fitBoxes(canvas.nodes.map(boxOfNode));}
  else if(event.shiftKey&&event.code==='Digit2'){const chosen=canvas.nodes.filter(node=>selection.has(node.id)).map(boxOfNode);if(chosen.length){event.preventDefault();fitBoxes(chosen);}}
 };
 window.addEventListener('keydown',onZoomKeydown);
 // A8 — present over saved frames. Every move is the Canvas's own viewport move
 // (flyToNode: eased, zero duration under reduced motion). Entering hides every
 // panel the host owns and fullscreens the Canvas; a refused fullscreen presents
 // in place with the same panels hidden. Presenting never writes the native
 // document and never changes the selection, so leaving restores what was there.
 const presentPanels=():HTMLElement[]=>[host.tools,host.inspector,host.canvasHome].filter((el):el is HTMLElement=>!!el);
 const canvasElement=()=>body.querySelector<HTMLElement>('.research-canvas');
 function presentCamera(index:number){
  const current=presentation;if(!current)return;
  const viewport=presentViewport(current.frames[index].boxes,paneSize());
  if(viewport)flyToNode?.('',viewport);
 }
 function stepPresentation(direction:1|-1){
  const current=presentation;if(!current)return;
  const next=presentStep(current.index,current.frames.length,direction);
  if(next===current.index)return;
  current.index=next;presentCamera(next);
 }
 function endPresentation(restoreCamera=true){
  const current=presentation;if(!current)return;
  presentation=null;
  window.removeEventListener('keydown',onPresentKeydown,true);
  releaseStageFullscreen(current.hold);
  canvasElement()?.classList.remove('research-canvas--presenting');
  for(const [el,display] of current.snapshot.panels)el.style.display=display;
  const {state,snapshot}=current;
  state.selectedNode=snapshot.selectedNode;state.selectedEdge=snapshot.selectedEdge;state.multiSelect=snapshot.multiSelect;dismissedCard=snapshot.dismissedCard;
  if(snapshot.viewport){
   if(restoreCamera&&currentKey===current.key&&views.get(current.key)===state)flyToNode?.('',snapshot.viewport);
   else state.canvas=snapshot.viewport;
  }
 }
 function onPresentKeydown(event:KeyboardEvent){
  if(!presentation)return;
  if(event.key==='Tab')return;
  // While presenting, every other key is swallowed here: no card nudges, no selection, no editing.
  event.preventDefault();event.stopImmediatePropagation();
  if(event.key==='Escape')endPresentation();
  else if(event.key==='ArrowRight'||event.code==='Space')stepPresentation(1);
  else if(event.key==='ArrowLeft')stepPresentation(-1);
 }
 function startPresentation(canvas:InstrumentCanvas,state:ViewState,targets:readonly CanvasFindTarget[]){
  if(presentation)return;
  const boxes=new Map(canvas.nodes.map(node=>[node.id,boxOfNode(node)] as const));
  const frames=presentFrames(targets,id=>boxes.get(id));
  if(!frames.length){message('Save two or more cards as a frame to present.');return;}
  const element=canvasElement();if(!element)return;
  // The presentation's fullscreen is this hold: the shared path (focusMode.ts) ends the presentation when the browser leaves fullscreen or the reader's focus takes it over.
  const hold:FullscreenHold={lost:()=>{if(presentation?.hold===hold)endPresentation();}};
  presentation={key:canvas.key,state,frames,index:0,hold,snapshot:{
   viewport:captureCanvas?.()??state.canvas,multiSelect:state.multiSelect,selectedNode:state.selectedNode,selectedEdge:state.selectedEdge,dismissedCard,
   panels:presentPanels().map((el):[HTMLElement,string]=>[el,el.style.display])}};
  const started=presentation;
  window.addEventListener('keydown',onPresentKeydown,true);
  for(const el of presentPanels())el.style.display='none';
  element.classList.add('research-canvas--presenting');
  // The first frame is reached once the pane has its presented size: after the fullscreen request settles either way. A refusal presents in place.
  void Promise.resolve().then(()=>presentation===started?requestStageFullscreenOn(element,{},hold):false).then(()=>{
   requestAnimationFrame(()=>{if(presentation===started)presentCamera(started.index);});
  });
 }
 function onPresentStartKey(event:KeyboardEvent){
  // Shift+P: the plain P key already plays a Canvas's marked sequence (CanvasView).
  if(destroyed||lens!=='m1'||presentation||!presentable||event.key!=='P'||!event.shiftKey||event.metaKey||event.ctrlKey||event.altKey)return;
  const target=event.target as HTMLElement|null;
  if(target?.isContentEditable||target?.tagName==='INPUT'||target?.tagName==='TEXTAREA'||target?.tagName==='SELECT')return;
  if(!target?.closest?.('.research-canvas'))return;
  event.preventDefault();
  startPresentation(presentable.canvas,presentable.state,presentable.targets);
 }
 window.addEventListener('keydown',onPresentStartKey);
 /** Preview every override immediately (one redraw) and batch the whole
  * selection into ONE gesture-transaction id, so N nudges/drags/aligns in a
  * row still land as exactly one native write when the gesture settles. */
 function applyGroupOverrides(state:ViewState,canvas:InstrumentCanvas,sceneId:string,overrides:Record<string,{x:number;y:number}>,held=false){
  if(!Object.keys(overrides).length)return;
  state.groupPreview??=new Map();
  for(const [ref,position] of Object.entries(overrides))state.groupPreview.set(ref,position);
  state.groupMoveGesture??=createGestureTransaction<RepertoireMove[]>({
   commit:async(_key,moves)=>{
    const converted=moves.map(m=>({entityId:m.entityId,position:{x:m.position.x/CANVAS_UNITS,y:-m.position.y/CANVAS_UNITS}}));
    if(host.moveMany)await host.moveMany(sceneId,converted);
    else for(const mv of converted)await host.move(sceneId,mv.entityId,mv.position);
   },
   onChange:()=>{state.groupPreview=undefined;if(currentKey===canvas.key&&lens==='m1'&&!destroyed)render(canvasNode(canvas,state,epoch));},
  });
  const occurrence=(id:string)=>canvas.occurrences.get(id)??id;
  const moves:RepertoireMove[]=[...state.groupPreview.entries()].map(([ref,position])=>({entityId:occurrence(ref),position}));
  state.groupMoveGesture.preview('__group__',moves,held);
  if(currentKey===canvas.key&&lens==='m1'&&!destroyed)render(canvasNode(canvas,state,epoch));
 }
 function stateFor(key:string){let state=views.get(key);if(!state){state={};views.set(key,state);if(views.size>32)views.delete(views.keys().next().value!);}currentKey=key;return state;}
 function render(node:ReactNode){root??=createRoot(body);root.render(<InstrumentBoundary>{node}</InstrumentBoundary>);}
 let relationReadings:NativeRelationDirectionReading[]=[];
 const nativeCanvas=(view:KernelConversion,sceneId:string)=>nativeInstrumentCanvas(view,sceneId,relationReadings);
 function canvasNode(canvas:InstrumentCanvas,state:ViewState,generation:number){
  const editable=!!canvas.sceneId;
  const scene=canvas.sceneId?host.sceneMaterial(canvas.sceneId):undefined;
  const material=scene?.research;
  groupContext=editable?{state,canvas,sceneId:canvas.sceneId}:null;
  const selection=state.multiSelect?.size?state.multiSelect:new Set(state.selectedNode?[state.selectedNode]:[]);
  navigation={canvas,selection};
  for(const node of canvas.nodes){const ref=canvas.occurrences.get(node.id);if(ref&&node.title)lastTitles.set(ref,node.title);}
  const apply=(action:()=>Promise<void>,refresh=true,notice?:string|(()=>string))=>{
   const key=canvas.key;message('Saving…');
   mutations=mutations.catch(()=>{}).then(async()=>{
    if(destroyed||!host.nativeView()||nativeCanvas(host.nativeView()!,host.sceneId()).key!==key)throw new Error('The selected native composition changed; the queued edit was not applied');
    materialInFlight++;saveState('saving');
    try{await action();saveState('saved');}finally{materialInFlight--;}
    if(currentKey===key&&!destroyed){message(typeof notice==='function'?notice():notice??'Saved');if(lens==='m1'){const view=host.nativeView();if(view&&host.sceneId()===canvas.sceneId){const updated=nativeCanvas(view,host.sceneId());render(canvasNode(updated,state,epoch));}else if(refresh||deferredRefresh)await load('m1');}}
    if(!materialInFlight){const pending=deferredRefresh;deferredRefresh=false;if(pending&&lens&&currentKey!==key)await load(lens);}

   }).catch(error=>{saveState('held');if(currentKey===key&&!destroyed)message(error instanceof Error?error.message:String(error));});
  };
  const occurrence=(id:string)=>{const value=canvas.occurrences.get(id);if(!value)throw new Error('This card has no native occurrence');return value;};
  const ownConnection=(id:string)=>{const relation=host.nativeView()?.document.relations?.[id];if(relation?.native_owner!=='oi')throw new Error('This source relation is read-only; use its native owner to change it');return id;};
  const select=(id:string|null)=>{state.selectedNode=id;state.selectedEdge=null;if(canvas.sceneId)host.select(canvas.sceneId,id?canvas.occurrences.get(id)??null:null);};
  const redraw=()=>{if(epoch===generation&&lens==='m1')render(canvasNode(canvas,state,generation));};
  const act=(action:ResearchMaterialAction,refresh=true)=>{if(canvas.sceneId)apply(()=>host.material(canvas.sceneId!,action),refresh);};
  // C1 — one native write per gesture, not one per pointer move. The
  // GestureTransaction is created once per ViewState and kept across
  // re-renders; only the small adapter (which closes over this render's
  // `canvas`/`apply`) is rebound every call, so an in-flight drag always
  // commits through the *current* composition binding.
  state.moveAdapter={
   commit:async(id,position)=>{
    const entityId=canvas.occurrences.get(id);if(!canvas.sceneId||!entityId)return;
    message('Saving position…');
    apply(()=>host.move(canvas.sceneId!,entityId,{x:position.x/CANVAS_UNITS,y:-position.y/CANVAS_UNITS}));
   },
   onChange:redraw,
  };
  state.moveGesture??=createGestureTransaction<{x:number;y:number}>({
   commit:(id,position)=>state.moveAdapter!.commit(id,position),
   onChange:()=>state.moveAdapter!.onChange(),
  });
  state.resizeAdapter={
   commit:async(id,size)=>{act({type:'resize',id:occurrence(id),width:size.width,height:size.height});},
   onChange:redraw,
  };
  state.resizeGesture??=createGestureTransaction<{width:number;height:number}>({
   commit:(id,size)=>state.resizeAdapter!.commit(id,size),
   onChange:()=>state.resizeAdapter!.onChange(),
  });
  state.canvasMinimap??={current:null};
  // A2 — a sticky, shape or text card renders as its own node type; the native
  // occurrence (position, size, name) is unchanged, only its presentation is.
  const objectCardOf=(id:string)=>{const local=canvas.occurrences.get(id);return local?material?.cards[local]:undefined;};
  const previewNodes=withGesturePreviews(canvasEmbedNodes(canvasObjectNodes(canvas.nodes,objectCardOf),objectCardOf),id=>state.groupPreview?.get(id)??state.moveGesture?.previewValue(id),id=>state.resizeGesture?.previewValue(id));
  // lane-1 A9–A10 — each occurrence's on-stage box (gesture previews included), by its native ref: a frame's heading sits on its members' bounds, and a link or media card over its own box.
  const boxByRef=new Map<string,Box>();
  for(const node of previewNodes){const ref=canvas.occurrences.get(node.id);if(ref)boxByRef.set(ref,boxOfNode(node));}
  const embedOverlays:EmbedOverlay[]=previewNodes.flatMap(node=>{
   const ref=canvas.occurrences.get(node.id),card=ref?material?.cards[ref]:undefined,box=ref?boxByRef.get(ref):undefined;
   if(!card||!box||!isEmbedCardType(card))return [];
   return [{id:node.id,kind:card.type,label:embedCardLabel(card,node.title??''),url:card.url,media:card.media,...cardOverlayBox(box,state.canvas??{x:0,y:0,zoom:1})}];
  });
  // lane-1 A3–A4 — the presentation connector for each native edge: its line
  // kind and midpoint label ride on `presentation`, and any bound card side
  // becomes the handle the edge attaches to. The relation itself is untouched.
  const previewEdges=canvas.edges.map(edge=>{
   const presented=connectorPresentation(material?.connectors?.[edge.id]);
   return {...edge,...(state.sequencedEdges?.has(edge.id)?{sequencing:true}:{}),sourceHandleId:presented.sourceHandleId,targetHandleId:presented.targetHandleId,presentation:{kind:presented.kind,label:presented.label}};
  });
  // A reconnect keeps the native edge id, so its sides are written against that
  // id. (A create records its sides against the binding it mints; see onConnectNodes.)
  const bindReconnectSides=(id:string,input:{sourceHandleId?:string;targetHandleId?:string})=>{
   if(!host.connector||!canvas.sceneId)return Promise.resolve();
   const next=connectorWithSides(material?.connectors?.[id],{fromSide:sideFromHandleId(input.sourceHandleId,'source'),toSide:sideFromHandleId(input.targetHandleId,'target')});
   return host.connector(canvas.sceneId,id,next);
  };
  // R1 — shift/ctrl-click extends the multi-select; a plain click replaces
  // it. The vendored Canvas reports no modifier state itself (trackModifiers
  // reads it independently), so this is the one seam that decides extend
  // vs. replace for every click the Canvas reports.
  const selectMulti=(id:string|null)=>{
   if(id&&(modifiers.state.shift||modifiers.state.extend)){
    state.multiSelect??=new Set(state.selectedNode?[state.selectedNode]:[]);
    if(state.multiSelect.has(id))state.multiSelect.delete(id);else state.multiSelect.add(id);
    select(state.multiSelect.size?[...state.multiSelect][state.multiSelect.size-1]:null);
    return;
   }
   state.multiSelect=id?new Set([id]):new Set();
   select(id);
  };
  // R1 — a group drag: the vendored Canvas now reports every dragged node's
  // own already-correct position directly (host-selection-viewport-gesture.patch
  // multi-node onMoveNodePreview/onMoveNodeEnd), once per selected member —
  // no delta math or drag-origin bookkeeping is needed here any more. Each
  // call still only overlays ONE id→position pair; `applyGroupOverrides`
  // accumulates them into the same batched `groupMoveGesture` so the whole
  // selection still lands as ONE native write per gesture.
  const groupMove=(id:string,position:{x:number;y:number})=>{
   // Pointer drags are held gestures: they commit at drag end, never on an
   // idle pause mid-drag.
   if(!canvas.sceneId||!selection.has(id)||selection.size<2){state.moveGesture!.preview(id,position,true);return;}
   applyGroupOverrides(state,canvas,canvas.sceneId,{[id]:position},true);
  };
  // A1 — alignment guides for a single dragged card. The Technē model's
  // snapPosition settles the card onto a neighbour's centre within 8 screen px
  // (÷ zoom) and reports the guide it settled on. Guides live on the ViewState
  // only: drawn over the pane, cleared on release, never persisted. A group
  // drag keeps grid snap alone.
  const alignDrag=(id:string,position:{x:number;y:number}):{x:number;y:number}=>{
   const dragged=canvas.nodes.find(node=>node.id===id);
   if(!dragged||(selection.size>1&&selection.has(id))){
    state.snapGuides=undefined;
    return state.snapToGrid?snapToGrid(position,CANVAS_UNITS/4,CANVAS_UNITS/16):position;
   }
   const others=canvas.nodes.filter(node=>node.id!==id).map(node=>({ref:node.id,box:boxOfNode(node)}));
   const aligned=snapDraggedBox({...boxOfNode(dragged),x:position.x,y:position.y},others,state.canvas?.zoom??1,id);
   state.snapGuides=aligned.guides.length?{guides:aligned.guides,boxes:[aligned.box,...others.map(other=>other.box)]}:undefined;
   return state.snapToGrid?keepGuidedAxes(aligned,snapToGrid(aligned.topLeft,CANVAS_UNITS/4,CANVAS_UNITS/16)):aligned.topLeft;
  };
  // Gesture end is now disclosed directly by the vendored Canvas
  // (onMoveNodeEnd) instead of being guessed from a global pointerup
  // listener. A multi-node drag end still fires this once per dragged node
  // in the same synchronous pass, so the actual flush is deferred to the
  // next microtask — by then every member's override is already recorded
  // and canvasGesture's own single-commit flush drains exactly once.
  const flushMoveEnd=()=>{queueMicrotask(()=>{void state.moveGesture?.flushNow();void state.groupMoveGesture?.flushNow();});};
  const alignSelection=(mode:AlignMode)=>{if(!canvas.sceneId||selection.size<2)return;applyGroupOverrides(state,canvas,canvas.sceneId,alignPositions(canvas.nodes,[...selection],mode));};
  const distributeSelection=(axis:'h'|'v')=>{if(!canvas.sceneId||selection.size<3)return;applyGroupOverrides(state,canvas,canvas.sceneId,distributePositions(canvas.nodes,[...selection],axis));};
  const frames=material?.frames??{};
  const framesOrdered=Object.entries(frames).sort(([,a],[,b])=>a.z-b.z);
  // A frame's members are selected here, not dragged by a titlebar: the
  // mounted Canvas exposes no viewport transform to this module, so a
  // screen-accurate frame rectangle cannot be drawn over live pan/zoom
  // (same root cause as the R3/R1 gaps below). Selecting its membership and
  // dragging any member still moves the whole frame as ONE gesture, via the
  // same groupMove/applyGroupOverrides path multi-select already uses.
  const saveFrame=()=>{if(selection.size<2)return;act({type:'frame-save',id:crypto.randomUUID(),label:`Frame ${framesOrdered.length+1}`,memberRefs:[...selection].map(occurrence)});};
  const namedViews=material?.namedViews??{};
  // D2: the basis a view is saved against and applied from — the canvas's native expression (the subject) and this Scene's binding (its scene_ref). Null when no native Scene is open.
  const currentViewBasis=():ViewBasis|null=>{const view=host.nativeView(),sceneId=canvas.sceneId;const binding=view&&sceneId?view.bindings[sceneId]:undefined;return view&&binding?{subject_ref:view.document.expression_ref,binding_ref:binding.scene_ref}:null;};
  const saveView=()=>{if(!canvas.sceneId||!captureCanvas)return;const name=window.prompt('Name this view');if(!name)return;const viewport=captureCanvas();const basis=currentViewBasis();act({type:'view-save',name,viewport:{x:viewport.x,y:viewport.y,zoom:viewport.zoom},selectedRefs:[...selection].map(occurrence),frameOrder:framesOrdered.map(([id])=>id),...(basis?{basis}:{})},false);};
  // B4: applying a view reports the members that have left the Scene since it was saved (one sentence, the view still applies).
  const applyView=(name:string)=>{const view=namedViews[name];if(!view)return;flyToNode?.('',{x:view.viewport.x,y:view.viewport.y,zoom:view.viewport.zoom});state.multiSelect=new Set(view.selectedRefs.map(ref=>canvas.nodes.find(n=>occurrence(n.id)===ref)?.id).filter((v):v is string=>!!v));select(state.multiSelect.size?[...state.multiSelect][0]:null);
   const present=new Set(canvas.sceneId?host.sceneMaterial(canvas.sceneId).entities.map(entity=>entity.id):[]);
   const {departed}=viewDrift(view,present);
   // D2: one sentence — the basis difference (a different subject) and the members that left; a view without a basis is exactly B4.
   message(viewNotice(name,view,departed,ref=>lastTitles.get(ref),currentViewBasis())??`View "${name}" applied`);};
  // B2 — the composed Canvas as one Obsidian .canvas file. Cards keep their
  // position and size; frames become group nodes; every connection keeps its
  // native identity; what a .canvas cannot carry is named in its header.
  const exportCanvasFile=()=>{
   const nodes:CanvasExportNode[]=canvas.nodes.flatMap(node=>{
    const ref=canvas.occurrences.get(node.id);
    const card=ref?material?.cards[ref]:undefined;
    const kind:CanvasExportNode['kind']=card?.type??(node.type==='resource'?'resource':'note');
    const text=card?.type==='note'&&card.content!==undefined?notePlainText(card.content):node.summary;
    return [{id:node.id,kind,title:node.title,text:text||undefined,url:card?.url,file:card?.media?.path,x:node.position.x,y:node.position.y,width:node.size.width,height:node.size.height}];
   });
   const edges:CanvasExportEdge[]=canvas.edges.map(edge=>{const connector=material?.connectors?.[edge.id];return {id:edge.id,fromNode:edge.sourceNodeId,toNode:edge.targetNodeId,fromSide:connector?.fromSide,toSide:connector?.toSide,relationKind:edge.relationKind};});
   const reverse=new Map<string,string>([...canvas.occurrences.entries()].map(([view,ref])=>[ref,view]));
   const frameList:CanvasExportFrame[]=framesOrdered.map(([id,frame])=>({id,label:frame.label,title:frame.title,memberIds:frame.memberRefs.map(ref=>reverse.get(ref)).filter((v):v is string=>!!v)}));
   const {json,dropped}=exportObsidianCanvas({nodes,edges,frames:frameList});
   saveBlob(new Blob([json],{type:'application/json'}),`${fileStem(canvas.title)}.canvas`);
   message(`Exported ${nodes.length} card${nodes.length===1?'':'s'} as .canvas${dropped.length?`; ${dropped.length} detail${dropped.length===1?'':'s'} named in the file header`:''}.`);
  };
  const pickCanvasFile=()=>{if(!canvas.sceneId)return;const picker=document.createElement('input');picker.type='file';picker.accept='.canvas,application/json';picker.onchange=()=>{const file=picker.files?.[0];if(file)void importCanvasFile(file);};picker.click();};
  // B2 — an Obsidian .canvas read into this Scene. The cards, their content, sizes and frames are ONE material batch ("Import .canvas"):
  // one working copy, one commit, one undo step; a refused step refuses the whole import. Connections are native relations, each
  // written by the host's connect act, so they are separate writes; each one that cannot be written is named in the status line.
  const importCanvasFile=async(file:File)=>{
   const sceneId=canvas.sceneId;if(!sceneId)return;
   let plan:ImportPlan;
   try{plan=planObsidianImport(parseObsidianCanvas(await file.text()));}catch(error){message(error instanceof Error?error.message:String(error));return;}
   const created=new Map<string,string>();
   const actions:ResearchMaterialAction[]=[];
   for(const card of plan.cards){
    const id=uid('research');created.set(card.key,id);
    actions.push({type:'create-card',id,kind:card.kind,position:{x:card.x/CANVAS_UNITS,y:-card.y/CANVAS_UNITS},title:card.title,...(card.url?{url:card.url}:{})});
    if(card.kind==='note'&&card.text)actions.push({type:'card-content',id,content:noteBlocksFromText(card.text)});
    actions.push({type:'resize',id,width:Math.max(40,card.width),height:Math.max(40,card.height)});
   }
   for(const frame of plan.frames){
    const id=uid('frame');
    actions.push({type:'frame-save',id,label:frame.label,memberRefs:frame.memberKeys.flatMap(key=>created.get(key)??[])});
    if(frame.title)actions.push({type:'frame-title',id,title:frame.title});
   }
   // Each connection's ends are the cards this import created; its sides are the canvas's own connector record.
   const cardName=(key:string)=>plan.cards.find(card=>card.key===key)?.title?.trim()||'an unnamed card';
   const links:CanvasImportLink[]=plan.edges.map(edge=>{
    const connector=edge.fromSide||edge.toSide?connectorRecord({kind:'curved',...(edge.fromSide?{fromSide:edge.fromSide}:{}),...(edge.toSide?{toSide:edge.toSide}:{})})??undefined:undefined;
    const named=`connection "${edge.relationKind}" from "${cardName(edge.fromKey)}" to "${cardName(edge.toKey)}"`;
    return {sourceViewId:created.get(edge.fromKey)??'',targetViewId:created.get(edge.toKey)??'',relationKind:edge.relationKind,named,...(connector?{connector}:{})};
   });
   let connected=0,skippedByOwner:string[]=[];
   const summary=()=>{
    const cards=`${plan.cards.length} card${plan.cards.length===1?'':'s'}${plan.frames.length?` and ${plan.frames.length} frame${plan.frames.length===1?'':'s'}`:''}`;
    const linked=plan.edges.length?`, ${connected} connection${connected===1?'':'s'}`:'';
    const missed=[...plan.skipped,...skippedByOwner];
    return `Imported ${cards}${linked}.${missed.length?` Not imported: ${missed.join('; ')}.`:''}`;
   };
   // B2/E15/E16: the cards, frames and connections are ONE labelled undo step, named for the file. A connection whose end is missing is
   // named and skipped; an owner refusal or a refused batch names itself and nothing lands.
   apply(async()=>{
    if(!actions.length)return;
    if(!host.importCanvas)throw new Error('This host cannot import a .canvas file.');
    const outcome=await host.importCanvas(sceneId,canvasImportLabel(file.name),actions,links);
    connected=outcome.connected;skippedByOwner=outcome.skipped;
   },true,summary);
  };
  // B3 — the selection (or a frame's members) as the canvas draws it: the live stage, cut to the members and the connections
  // between them, chrome dropped, copied at 2x. Anything the copy cannot carry is named in the status line.
  const exportFrameImage=()=>{
   const flow=body.querySelector<HTMLElement>('.react-flow__viewport');
   const members=canvas.nodes.filter(node=>selection.has(node.id));
   const boxes=members.map(node=>({x:node.position.x,y:node.position.y,width:node.size.width,height:node.size.height}));
   const bounds=frameBounds(boxes);
   if(!bounds||!flow){message('Select a card to export its frame.');return;}
   const memberBoxes=new Map(members.map((node,index)=>[node.id,boxes[index]]));
   const edges:StageEdge[]=canvas.edges.map(edge=>({id:edge.id,sourceId:edge.sourceNodeId,targetId:edge.targetNodeId,labelled:!!edge.label}));
   void renderFrameStage({flow,members:memberBoxes,edges,bounds}).then(({blob,refused})=>{
    download(blob,`${fileStem(canvas.title)}-frame.png`);
    message(`Exported ${members.length} card${members.length===1?'':'s'} as a 2× PNG of the frame${refused.length?`. Not drawn: ${refused.join('; ')}`:''}.`);
   },error=>message(error instanceof Error?error.message:String(error)));
  };
  // R1 — box selection is now the vendored Canvas's own xyflow selectionOnDrag
  // (host-selection-viewport-gesture.patch), reported through onSelectionChange
  // with the exact flow-space hit set; no screen-rect DOM query or lasso
  // overlay component is needed any more.
  const boxSelectionComplete=(nodeIds:string[])=>{
   state.multiSelect=new Set(nodeIds);state.lassoOn=false;
   select(nodeIds[0]??null);
   redraw();
  };
  const current=canvas.nodes.find(n=>n.id===state.selectedNode);
  const localId=current?canvas.occurrences.get(current.id):undefined;
  const nativeView=host.nativeView(),nativeScene=canvas.sceneId?nativeView?.bindings[canvas.sceneId]?.scene_ref:undefined;
  const subject=current?nativeView?.document.entities[current.id]?.subject:undefined;
  const constellationRequest=nativeView&&nativeScene&&current&&subject&&Array.isArray(subject.readings)&&subject.readings.length>1?{expression_ref:nativeView.document.expression_ref,revision:nativeView.document.revision,scene_ref:nativeScene,entity_ref:current.id}:undefined;
  // A2 — a picker choice creates its object at the centre of the pane, so the
  // act needs no pointer position: the new object is then moved like any card.
  const createObject=(choice:CanvasToolChoice)=>{
   if(!canvas.sceneId)return;
   const spec=CANVAS_TOOL_SPEC[choice],pane=paneSize(),viewport=currentViewport();
   const centreX=(pane.width/2-viewport.x)/viewport.zoom,centreY=(pane.height/2-viewport.y)/viewport.zoom;
   state.objectTool=choice;redraw();
   act({type:'create-card',kind:spec.kind,geometry:spec.geometry,title:spec.label,position:{x:(centreX-spec.size.width/2)/CANVAS_UNITS,y:-(centreY-spec.size.height/2)/CANVAS_UNITS}});
  };
  // lane-1 A10 — a link card is made from an https address the owner pastes; it lands at the pane's centre, as an object does.
  const linkPrompt=()=>{
   if(!canvas.sceneId)return;
   const pasted=window.prompt('Paste an https address for this link card');
   if(pasted===null)return;
   const url=embedUrlRecord(pasted);
   if(!url){message('A link card needs an https address.');return;}
   const pane=paneSize(),viewport=currentViewport();
   const centreX=(pane.width/2-viewport.x)/viewport.zoom,centreY=(pane.height/2-viewport.y)/viewport.zoom;
   act({type:'create-card',kind:'embed',url,title:embedHost(url),position:{x:(centreX-EMBED_CARD_SIZE.width/2)/CANVAS_UNITS,y:-(centreY-EMBED_CARD_SIZE.height/2)/CANVAS_UNITS}});
  };
  const imageImport=()=>{const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>196608)throw new Error('Choose an image smaller than 192 KiB for this native document.');const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});act({type:'create-card',kind:'image',title:file.name.slice(0,160),dataUrl,position:{x:0,y:0}});}catch(error){message(String(error));}};input.click();};
  const annotations=(material?.strokes??[]).map(stroke=>({id:stroke.id,canvasId:canvas.key,annotationType:'stroke' as const,points:stroke.points,style:{color:stroke.color,width:stroke.width,opacity:stroke.opacity},bounds:{position:{x:Math.min(...stroke.points.map(p=>p.x)),y:Math.min(...stroke.points.map(p=>p.y))},size:{width:Math.max(1,Math.max(...stroke.points.map(p=>p.x))-Math.min(...stroke.points.map(p=>p.x))),height:Math.max(1,Math.max(...stroke.points.map(p=>p.y))-Math.min(...stroke.points.map(p=>p.y)))}},createdAt:stroke.createdAt,updatedAt:stroke.createdAt}));
  // The card follows the selection: selecting a node or connection shows it,
  // closing dismisses it for that selection only.
  const cardFor=state.selectedNode??state.selectedEdge??null;
  const inspecting=!!cardFor&&cardFor!==dismissedCard;
  host.inspector.hidden=!inspecting;
  const closeInspector=()=>{dismissedCard=cardFor;host.inspector.hidden=true;redraw();};
  // A2 — Find matches what the stage shows: an object's caption, not its kind name.
  const findTargets=editable?canvasFindTargets({...canvas,nodes:canvasObjectNodes(canvas.nodes,objectCardOf)},material?.frames):[];
  presentable=editable?{canvas,state,targets:findTargets}:null;
  const findView=host.nativeView(),findBasis=findView&&canvas.sceneId?{expression_ref:findView.document.expression_ref,revision:findView.document.revision,scene_ref:findView.bindings[canvas.sceneId]?.scene_ref}:undefined;
  const chooseFound=(target:CanvasFindTarget)=>{
   const now=host.nativeView();
   if(destroyed||epoch!==generation||lens!=='m1'||currentKey!==canvas.key||!now||!findBasis||host.sceneId()!==canvas.sceneId||materialInFlight>0
    ||now.document.expression_ref!==findBasis.expression_ref||now.document.revision!==findBasis.revision||now.bindings[host.sceneId()]?.scene_ref!==findBasis.scene_ref)
    throw Error('The searched native Canvas changed; reopen Find on the current source.');
   const actual=nativeCanvas(now,host.sceneId()),current=resolveCanvasFindTarget(target,actual,host.sceneMaterial(host.sceneId())?.research?.frames);
   if(!current)throw Error('The searched card or frame changed; refresh its query.');
   const element=body.querySelector<HTMLElement>('.research-canvas'),bounds=element?.getBoundingClientRect(),viewport=captureCanvas?.();
   if(!bounds||!viewport||!flyToNode)throw Error('The native Canvas viewport is unavailable.');
   const camera=canvasFindCamera(current,actual,{width:bounds.width,height:bounds.height},viewport.zoom);
   state.multiSelect=new Set(current.node_ids);select(current.node_ids[0]??null);flyToNode('',camera);redraw();
  };
  const controls=<div className="research-tool-actions" aria-label="Canvas tools">
   {editable&&<><button aria-label="Note" title="Note" onClick={()=>act({type:'create-card',kind:'note',position:{x:0,y:0}})}><ToolIcon name="text"/></button><button aria-label="Image" title="Image" onClick={imageImport}><ToolIcon name="upload"/></button><button aria-label="Link card" title="Link card — paste an https address" onClick={linkPrompt}><GlyphIcon glyph={EMBED_GLYPH}/></button>
   <CanvasObjectPicker choice={state.objectTool} onPick={createObject}/>
   <button aria-label="Draw" title="Draw" aria-pressed={!!state.drawing} onClick={()=>{state.drawing=!state.drawing;if(state.drawing)state.erasing=false;redraw();}}><ToolIcon name="pen"/></button>
   <button aria-label="Erase" title="Erase — click a stroke to remove it" aria-pressed={!!state.erasing} onClick={()=>{state.erasing=!state.erasing;if(state.erasing)state.drawing=false;redraw();}}><ToolIcon name="eraser"/></button>
   {(state.drawing||state.erasing)&&<input type="color" aria-label="Stroke colour" value={state.strokeColour??'#808080'} onInput={e=>{state.strokeColour=(e.target as HTMLInputElement).value;redraw();}} onChange={e=>{state.strokeColour=e.target.value;redraw();}}/>}
   {selection.size>=2&&<select aria-label="Align selection" value="" onChange={event=>{const mode=event.target.value as AlignMode;if(mode)alignSelection(mode);event.target.value='';}}>
    <option value="">Align…</option><option value="left">Left</option><option value="hcenter">Centre</option><option value="right">Right</option><option value="top">Top</option><option value="vcenter">Middle</option><option value="bottom">Bottom</option></select>}
   {selection.size>=3&&<><button aria-label="Distribute ↔" title="Distribute ↔" onClick={()=>distributeSelection('h')}><ToolIcon name="distributeH"/></button><button aria-label="Distribute ↕" title="Distribute ↕" onClick={()=>distributeSelection('v')}><ToolIcon name="distributeV"/></button></>}
   <button aria-label="Snap" title="Snap" aria-pressed={!!state.snapToGrid} onClick={()=>{state.snapToGrid=!state.snapToGrid;redraw();}}><ToolIcon name="grid"/></button>
   <button aria-label="Lasso" title="Lasso" aria-pressed={!!state.lassoOn} onClick={()=>{state.lassoOn=!state.lassoOn;redraw();}}><ToolIcon name="lasso"/></button>
   {selection.size>=2&&<button aria-label="Frame selection" title="Frame selection" onClick={saveFrame}><ToolIcon name="frame"/></button>}
   {selection.size>=1&&<button type="button" aria-label="Export selection as PNG" title="Export the selection as a PNG of its bounds, at 2×" onClick={exportFrameImage}><ToolIcon name="download"/></button>}
   {framesOrdered.length>0&&<button aria-label="Present frames" title="Present frames (Shift+P)" onClick={()=>startPresentation(canvas,state,findTargets)}><GlyphIcon glyph={PRESENT_GLYPH}/></button>}
</>}
   {(()=>{const binding=canvas.sceneId?host.nativeView()?.bindings[canvas.sceneId]:undefined;if(!binding||binding.page_count<=1||!host.pageMembers)return null;
    return <><button aria-label="Previous members" title="Previous members" disabled={binding.page<=0} onClick={()=>void host.pageMembers!(-1)}><ToolIcon name="arrowLeft"/></button>
     <span className="research-pager" title={`${binding.occurrences.length} of ${binding.member_refs.length} members loaded`}>{binding.page+1}/{binding.page_count}</span>
     <button aria-label="Next members" title="Next members" disabled={binding.page>=binding.page_count-1} onClick={()=>void host.pageMembers!(1)}><ToolIcon name="arrowRight"/></button></>;})()}
  </div>;
  // Canvas views, frames and source focus live in the Studio's Canvas
  // section; the rail keeps only the direct icon tools.
  const canvasStudio=<div className="canvas-studio">
   {editable&&<><label className="control">Focus a source<br/>
   <select aria-label="Focus disclosed source" value="" onChange={event=>{const ref=event.target.value;const source=canvas.nodes.find(node=>node.id===ref);if(!source||!canvas.occurrences.has(ref)||!host.nativeView()?.document.entities[ref]?.subject)return;select(ref);flyToNode?.(ref);redraw();}}><option value="">Source…</option>{canvas.nodes.filter(node=>host.nativeView()?.document.entities[node.id]?.subject).map(node=><option key={node.id} value={node.id}>{node.title}</option>)}</select>
   </label>
   <div className="control"><span>Views</span><div className="button-row"><button aria-label="Save view" title="Save view" onClick={()=>{if(captureCanvas)act({type:'viewport',key:'canvas',value:captureCanvas()},false);}}>Save current view</button>
   <button aria-label="Save view as…" title="Save view as…" onClick={saveView}><ToolIcon name="save"/></button>
   </div>
   {Object.keys(namedViews).length>0&&<select aria-label="Saved views" value="" onChange={event=>{const [op,name]=event.target.value.split('\u0000');if(op==='apply')applyView(name);if(op==='remove')act({type:'view-remove',name},false);event.target.value='';}}>
    <option value="">Views…</option>{Object.keys(namedViews).map(name=><optgroup key={name} label={name}><option value={`apply\u0000${name}`}>Apply</option><option value={`remove\u0000${name}`}>Remove</option></optgroup>)}</select>}
   </div>
   <div className="control"><span>Exchange</span><div className="button-row"><button type="button" aria-label="Export Obsidian canvas" title="Export as an Obsidian .canvas file" onClick={exportCanvasFile}><ToolIcon name="download"/></button>
   <button type="button" aria-label="Import Obsidian canvas" title="Import an Obsidian .canvas file into this Scene" onClick={pickCanvasFile}><ToolIcon name="upload"/></button></div></div>
   <div className="control"><span>Frames</span>{framesOrdered.length===0&&<p className="control-note">Select two or more nodes and use Frame selection.</p>}
   {framesOrdered.length>0&&<select aria-label="Frames" value="" onChange={event=>{const [op,id]=event.target.value.split(':');if(op==='select'){const frame=frames[id];if(frame){state.multiSelect=new Set(frame.memberRefs.map(ref=>[...canvas.occurrences.entries()].find(([,v])=>v===ref)?.[0]).filter((v):v is string=>!!v));select([...state.multiSelect][0]??null);}}if(op==='title'){const next=window.prompt('Frame title',frames[id]?.title??'');if(next!==null)act({type:'frame-title',id,title:next});}if(op==='front')act({type:'frame-order',id,direction:'front'},false);if(op==='back')act({type:'frame-order',id,direction:'back'},false);if(op==='remove')act({type:'frame-remove',id},false);event.target.value='';}}>
    <option value="">Frames…</option>{framesOrdered.map(([id,frame])=><optgroup key={id} label={frame.label}><option value={`select:${id}`}>Select members</option><option value={`title:${id}`}>Title frame…</option><option value={`front:${id}`}>Bring to front</option><option value={`back:${id}`}>Send to back</option><option value={`remove:${id}`}>Remove frame</option></optgroup>)}</select>}
   </div></>}
  </div>;
  const edgeId=!current?state.selectedEdge:null;
  const selectedEdgeObj=edgeId?canvas.edges.find(e=>e.id===edgeId):undefined;
  const relateEndpoints=editable&&host.relateKnowledge&&selectedEdgeObj&&host.nativeView()?.document.relations?.[selectedEdgeObj.id]?.native_owner==='oi'?{
   // The exact native occurrences (not their source subjects): one source
   // can hold two roles, and the constellation owner resolves each
   // occurrence to its own participation.
   from:host.nativeView()?.document.entities[selectedEdgeObj.sourceNodeId]?.subject?selectedEdgeObj.sourceNodeId:undefined,
   to:host.nativeView()?.document.entities[selectedEdgeObj.targetNodeId]?.subject?selectedEdgeObj.targetNodeId:undefined,
  }:undefined;
  // A2 — the selected card's own record, when it is a sticky, shape or text.
  const objectCard=localId?material?.cards[localId]:undefined;
  const objectKind=objectCard&&isCanvasObjectKind(objectCard.type)?objectCard.type:undefined;
  const inspector=<div className="research-inspector-content" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeInspector();}}}><header><h3>{current?.title??(state.selectedEdge?'Connection':'Canvas')}</h3><button className="card-close" onClick={closeInspector} aria-label="Close" title="Close"><ToolIcon name="close"/></button></header>
   {current&&<button onClick={()=>{const ref=current.type==='resource'?current.absolutePath:host.nativeView()?.document.entities[current.id]?.subject?.subject_ref;if(ref)host.inspectSubject(ref);}}>Open source</button>}
   {current&&host.showInGraph&&(()=>{const hop=current.type==='resource'?undefined:graphHopSubject(host.nativeView()?.document.entities[current.id]);return hop?<button type="button" aria-label="Show in graph" title="Show in graph" onClick={()=>host.showInGraph!(hop.subject_ref,hop.native_owner)}><ToolIcon name="wiki"/>Show in graph</button>:null;})()}
   {editable&&current&&localId&&host.editObject&&<button aria-label="Edit object" onClick={()=>host.editObject!(canvas.sceneId!,localId)}>Edit object</button>}
   {constellationRequest&&<ConstellationAction request={constellationRequest} onError={message}/>}
   {editable&&localId&&current&&<><label>Width<input type="number" defaultValue={Math.round(current.size.width)} onBlur={e=>act({type:'resize',id:localId,width:Number(e.target.value),height:current.size.height})}/></label><label>Height<input type="number" defaultValue={Math.round(current.size.height)} onBlur={e=>act({type:'resize',id:localId,width:current.size.width,height:Number(e.target.value)})}/></label>
   {<button disabled={!!subject&&!host.duplicateOccurrence} onClick={()=>subject?apply(()=>host.duplicateOccurrence!(canvas.sceneId!,localId)):act({type:'duplicate',id:localId})}>Duplicate</button>}
   {objectKind&&objectCard&&<CanvasObjectControls kind={objectKind} card={objectCard} onLabel={caption=>act({type:'card-caption',id:localId,caption},false)} onStyle={patch=>act({type:'card-style',id:localId,patch})}/>}
   {!objectKind&&(['dotColour','bgColour','textColour'] as const).map(key=><label key={key}>{key==='dotColour'?'Dot colour':key==='bgColour'?'Background':'Text colour'}<input type="color" value={material?.cards[localId]?.[key]??'#808080'} onChange={e=>act({type:'card-style',id:localId,patch:{[key]:e.target.value}})}/></label>)}
   </>}
   {editable&&current&&host.transformBlueprint&&scene?.composition.blueprint&&blueprintMember(scene,current.id)&&<BlueprintWholeControls
     binding={scene.composition.blueprint}
     pinned={host.nativeView()?.document.entities[current.id]?.pinned===true}
     busy={materialInFlight>0}
     onTransform={transform=>apply(()=>host.transformBlueprint!(canvas.sceneId!,transform))}
     onRelease={()=>host.releaseBlueprint&&apply(()=>host.releaseBlueprint!(canvas.sceneId!))}
     onPin={next=>host.pinEntity&&apply(()=>host.pinEntity!(canvas.sceneId!,current.id,next),false)}
    />}
   {editable&&host.connector&&selectedEdgeObj&&!current&&<ConnectorControls key={selectedEdgeObj.id} record={material?.connectors?.[selectedEdgeObj.id]} onChange={next=>apply(()=>host.connector!(canvas.sceneId!,selectedEdgeObj.id,next))}/>}
   {relateEndpoints?.from&&relateEndpoints.to&&<RelateKnowledgeAction sceneId={canvas.sceneId!} sourceRef={relateEndpoints.from} targetRef={relateEndpoints.to} defaultRelation={selectedEdgeObj!.relationKind} relate={host.relateKnowledge!} onError={message} onResult={message}/>}
   {editable&&(material?.strokes??[]).map((stroke,i)=><button key={stroke.id} onClick={()=>act({type:'annotation-remove',id:stroke.id})}>Remove annotation {i+1}</button>)}
  </div>;
  return <>{createPortal(controls,host.tools)}{host.canvasHome&&createPortal(canvasStudio,host.canvasHome)}{inspecting&&createPortal(inspector,host.inspector)}<div className={`research-canvas ${editable?'research-canvas-native':'research-canvas-reading'}`} data-zoom={state.zoomLevel}>
   <CanvasView toolbarContainer={host.tools} hostZoomControls canvasKey={canvas.key} initialViewport={state.canvas??material?.views.canvas} nodes={previewNodes} edges={previewEdges}
    selectedNodeId={state.selectedNode} selectedEdgeId={state.selectedEdge}
    selectedNodeIds={selection.size?[...selection]:undefined}
    selectionOnDrag={editable&&!!state.lassoOn}
    onSelectionChange={editable&&state.lassoOn?boxSelectionComplete:undefined}
    onViewportChange={viewport=>{
     // R3 — semantic zoom/LOD, driven directly by the vendored Canvas's own
     // viewport reporting instead of a 400ms captureCanvas() poll. Applies
     // to both native (editable) and read-only reading canvases.
     state.canvas=viewport;state.canvasMinimap?.current?.draw(viewport);showZoom(viewport.zoom);
     const level=semanticZoomLevel(viewport.zoom);
     if(level!==state.zoomLevel){state.zoomLevel=level;redraw();}
    }}
    readOnly={!editable}
    isEdgeReadOnly={id=>host.nativeView()?.document.relations?.[id]?.native_owner!=='oi'}
    onCreateNote={editable?position=>act({type:'create-card',kind:'note',position:{x:(position?.x??0)/CANVAS_UNITS,y:-(position?.y??0)/CANVAS_UNITS}}):undefined}
    onDuplicateNode={editable?id=>{if(host.nativeView()?.document.entities[id]?.subject){if(host.duplicateOccurrence)apply(()=>host.duplicateOccurrence!(canvas.sceneId!,occurrence(id)));else message('Native occurrence duplication is unavailable.');return;}act({type:'duplicate',id:occurrence(id)});}:undefined}
    onResizeNode={editable?(id,width,height)=>state.resizeGesture!.preview(id,{width,height},true):undefined}
    onUpdateImageCaption={editable?(id,caption)=>act({type:'card-caption',id:occurrence(id),caption},false):undefined}
    annotations={annotations} drawingEnabled={editable&&!!state.drawing}
    draftColour={state.strokeColour??'#808080'}
    erasing={editable&&!!state.erasing}
    onDeleteStroke={editable&&state.erasing?id=>act({type:'annotation-remove',id}):undefined}
    onCreateStroke={editable?points=>act({type:'annotation-add',stroke:{id:crypto.randomUUID(),points,color:state.strokeColour??'#808080',width:3,opacity:1,createdAt:new Date().toISOString()}}):undefined}
    onRegisterFlyToNode={fly=>{flyToNode=fly;}}
    onRegisterFlyToEdge={fly=>{flyToEdge=fly;}}
    onDeleteNode={editable&&host.deleteOccurrence?id=>apply(()=>host.deleteOccurrence!(canvas.sceneId!,occurrence(id))):undefined}
    onUpdateNoteContent={editable?(id,content)=>act({type:'card-content',id:occurrence(id),content},false):undefined}
    onConnectNodes={editable&&host.connect?input=>{
     // A4 — the side a drag ended on is recorded for the connection the owner
     // just created. The native owner mints its binding ref, so the new edge is
     // the one binding that was absent before the write.
     const sceneId=canvas.sceneId!;
     const sides={fromSide:sideFromHandleId(input.sourceHandleId,'source'),toSide:sideFromHandleId(input.targetHandleId,'target')};
     const bound=(): Set<string> => new Set((host.nativeView()?.bindings[sceneId]?.relations??[]).map(relation=>relation.binding_ref));
     apply(async()=>{
      const relation={sourceEntityRef:input.sourceNodeId,targetEntityRef:input.targetNodeId,relationKind:input.relationKind,directionality:input.directionality};
      // B2: where the host offers it, the relation and its drag sides land as one write — the same path an import takes.
      if(host.connectMany){const record=sides.fromSide||sides.toSide?connectorRecord({kind:'curved',...sides}):null;await host.connectMany(sceneId,[{...relation,...(record?{connector:record}:{})}]);return;}
      const known=bound();
      await host.connect!(sceneId,relation);
      const created=(host.nativeView()?.bindings[sceneId]?.relations??[]).find(relation=>!known.has(relation.binding_ref));
      if(created&&host.connector&&(sides.fromSide||sides.toSide))await host.connector(sceneId,created.binding_ref,connectorRecord({kind:'curved',...sides}));
     });
    }:undefined}
    onReconnectEdge={editable&&host.reconnect?(id,input)=>apply(async()=>{await host.reconnect!(canvas.sceneId!,ownConnection(id),{sourceEntityRef:input.sourceNodeId,targetEntityRef:input.targetNodeId});await bindReconnectSides(id,input);}):undefined}
    onDeleteEdge={editable&&host.deleteConnection?id=>apply(()=>host.deleteConnection!(canvas.sceneId!,ownConnection(id))):undefined}
    onUpdateEdgeRelationKind={editable&&host.updateConnectionKind?(id,kind)=>apply(()=>host.updateConnectionKind!(canvas.sceneId!,ownConnection(id),kind)):undefined}
    onCycleEdgeDirectionality={editable&&host.updateConnectionDirectionality?id=>{
     // An O:I presentation connection is directed; the control reverses it.
     if(!canvas.edges.some(e=>e.id===id))return;
     apply(()=>host.updateConnectionDirectionality!(canvas.sceneId!,ownConnection(id),'backward'));
    }:undefined}
    onToggleEdgeSequencing={editable?id=>{state.sequencedEdges??=new Set();if(state.sequencedEdges.has(id))state.sequencedEdges.delete(id);else state.sequencedEdges.add(id);redraw();}:undefined}
    onPlaySequence={editable?()=>{
     // Session-local walk over the presentation-only sequencing flags (see
     // ViewState.sequencedEdges): no native "sequence" reading exists to
     // replay, so this is a personal fly-through of the marked path.
     const active=previewEdges.filter(e=>e.sequencing);
     if(!active.length)return;
     const incoming=new Set(active.map(e=>e.targetNodeId));
     const start=active.map(e=>e.sourceNodeId).find(id=>!incoming.has(id))??active[0].sourceNodeId;
     const path=[start];const visited=new Set(path);let at=start;
     for(let step=0;step<active.length;step++){const exit=active.find(e=>e.sourceNodeId===at&&!visited.has(e.targetNodeId));if(!exit)break;path.push(exit.targetNodeId);visited.add(exit.targetNodeId);at=exit.targetNodeId;}
     path.forEach((id,index)=>setTimeout(()=>flyToNode?.(id),index*900));
    }:undefined}
    onSelectNode={id=>{selectMulti(id);redraw();}}
    // CanvasView reports onSelectEdge(null) right after every node click; that
    // clears only an edge selection and never the node just selected.
    onSelectEdge={id=>{if(id===null){if(state.selectedEdge!==null&&state.selectedEdge!==undefined){state.selectedEdge=null;redraw();}return;}state.selectedEdge=id;state.selectedNode=null;if(canvas.sceneId)host.select(canvas.sceneId,null,id??undefined);if(id)flyToEdge?.(id);redraw();}}
    onNodeDoubleClick={id=>{const view=host.nativeView(),node=canvas.nodes.find(n=>n.id===id);const subject=node?.type==='resource'?node.absolutePath:view?.document.entities[id]?.subject?.subject_ref;if(subject)host.inspectSubject(subject);else{select(id);dismissedCard=null;host.inspector.hidden=false;redraw();}}}
    onMoveNodePreview={editable?(id,position)=>{
     groupMove(id,alignDrag(id,position));
     redraw();
    }:undefined}
    onMoveNodeEnd={editable?(id,position)=>{
     const placed=alignDrag(id,position);
     state.snapGuides=undefined;
     groupMove(id,placed);
     flushMoveEnd();
     redraw();
    }:undefined}
    onRegisterCaptureViewport={capture=>{captureCanvas=capture;}} />
   {editable&&<CanvasFindOverlay key={`find:${canvas.key}`} canvasKey={canvas.key} targets={findTargets} tools={host.tools} onChoose={chooseFound}/>}
   <CanvasGuides segments={state.snapGuides?guideSegments(state.snapGuides.guides,state.snapGuides.boxes,state.canvas??{x:0,y:0,zoom:1}):[]}/>
   <FrameHeadings headings={frameHeadings(frames,ref=>boxByRef.get(ref),state.canvas??{x:0,y:0,zoom:1})} editable={editable} onTitle={(id,title)=>act({type:'frame-title',id,title})}/>
   <EmbedCardOverlays items={embedOverlays}/>
   <CanvasNavigationOverview key={canvas.key} nodes={previewNodes} edges={previewEdges} capture={()=>state.canvas??captureCanvas?.()??null} controller={state.canvasMinimap} onCamera={viewport=>{if(epoch===generation&&currentKey===canvas.key)flyToNode?.('',viewport);}}/>
   <div className="canvas-zoom-controls" role="group" aria-label="Canvas zoom">
    <button type="button" aria-label="Zoom out canvas" title="Zoom out (−)" onClick={()=>zoomView(currentViewport().zoom/ZOOM_STEP)}><ToolIcon name="minus"/></button>
    <button type="button" aria-label="Zoom in canvas" title="Zoom in (+)" onClick={()=>zoomView(currentViewport().zoom*ZOOM_STEP)}><ToolIcon name="plus"/></button>
    <button type="button" aria-label="Fit all cards" title="Fit all (Shift+1)" onClick={()=>fitBoxes(canvas.nodes.map(boxOfNode))}><ToolIcon name="fit"/></button>
    <button type="button" aria-label="Fit selected cards" title="Fit selection (Shift+2)" disabled={!selection.size} onClick={()=>fitBoxes(canvas.nodes.filter(node=>selection.has(node.id)).map(boxOfNode))}><ToolIcon name="collapse"/></button>
   </div>
  </div></>;
 }
 /** T-REVIEW-4 #7: a settled Places layers change not yet written is written before the Scene it belongs to is left. */
 function flushPlaceLayers(){for(const pending of views.values())pending.placeLayersSave?.write();}
 async function load(selected:ResearchInstrument){
  flushPlaceLayers();
  const generation=++epoch;unmount();mount.hidden=false;message('Reading…');
  const focusRef=pendingFocus;pendingFocus=undefined;
  try{
   const view=host.nativeView(),sceneId=host.sceneId();
   const sameBasis=()=>{const now=host.nativeView();return host.sceneId()===sceneId&&now?.document.expression_ref===view?.document.expression_ref&&now?.document.revision===view?.document.revision;};
   if(selected==='m1'&&view){
    relationReadings=[];const canvas=nativeCanvas(view,sceneId);if(epoch!==generation||destroyed)return;
    const state=stateFor(canvas.key),focus=view.document.selection;
    // Native focus seeds the selection; a live local selection of a node still
    // on this Canvas is never discarded by a reload of the same work.
    const focused=focus?.scene_ref===view.bindings[sceneId].scene_ref?focus.entity_ref??null:null;
    state.selectedNode=state.selectedNode&&canvas.nodes.some(node=>node.id===state.selectedNode)?state.selectedNode:focused;
    state.selectedEdge=focus?.scene_ref===view.bindings[sceneId].scene_ref?focus.relation_ref??null:null;
    // Seam B: a carried card is focused through the native select (host.select on its occurrence). A ref not on this canvas is named.
    const m1Note=focusRef!==undefined&&!canvas.nodes.some(node=>node.id===focusRef)?`Not focused: ${focusRef} is not a card on this canvas.`:null;
    if(focusRef!==undefined&&canvas.nodes.some(node=>node.id===focusRef)){state.selectedNode=focusRef;state.selectedEdge=null;if(canvas.sceneId)host.select(canvas.sceneId,canvas.occurrences.get(focusRef)??null);}
    message(m1Note??(canvas.hiddenCount?`${canvas.title} · ${canvas.hiddenCount} further members on other Scene pages`:canvas.title));
    render(canvasNode(canvas,state,generation));
    // R3 — semantic zoom/LOD is presentational only and never touches
    // entity/card size (interactions.ts semanticZoomLevel/labelsForZoom).
    // The vendored Canvas now reports the live viewport directly
    // (host-selection-viewport-gesture.patch onViewportChange, wired in
    // canvasNode above), so no polling loop is mounted here any more.
    if(canvas.edges.some(edge=>view.document.relations?.[edge.id]?.native_owner!=='oi'))void host.read({expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:view.bindings[sceneId].scene_ref,facet:'relation-semantics'}).then(raw=>{
     if(epoch!==generation||destroyed||!sameBasis())return;
     const result=raw as {schema?:string;expression_ref?:string;revision?:number;scene_ref?:string;relation_readings?:NativeRelationDirectionReading[]};
     if(result.schema!=='oi.scene-relation-readings/v1'||result.expression_ref!==view.document.expression_ref||result.revision!==view.document.revision||result.scene_ref!==view.bindings[sceneId].scene_ref||!Array.isArray(result.relation_readings))throw new Error('The source direction reading returned another native Scene');
     relationReadings=result.relation_readings;render(canvasNode(nativeCanvas(view,sceneId),state,generation));
    }).catch(error=>{if(epoch===generation&&!destroyed&&sameBasis())message(error instanceof Error?error.message:String(error));});
    return;
   }
   // R6 (Wayfinder §21) — "choosing a frame can create an incomplete
   // working draft"; creation must not be disabled just because no native
   // Scene is open yet. An unbound m1 canvas offers the one eligible
   // creation act it can reach from here (host.createScene, if the host
   // declares it) instead of only a dead-end refusal message.
   if(selected==='m1'&&!view){
    message('Open a native Scene to disclose its own sources');
    render(<div className="research-instrument-message" role="status">
     <p>No native Scene is open in this composition yet.</p>
     {host.createScene?<button onClick={()=>{message('Creating…');void host.createScene!().then(()=>load('m1'),error=>message(error instanceof Error?error.message:String(error)));}}>New constellation</button>
      :<p>This host does not yet offer construction from an empty canvas.</p>}
    </div>);
    return;
   }
   const binding=view?.bindings[sceneId];
   if(!view||!binding)throw new Error('Open a native Scene to read its dates and places');
   const request={expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref};
   const optionalReading=(facet:'node-metadata'|'scene-relations')=>host.read({...request,facet}).then(value=>({value,reason:''}),error=>({value:undefined,reason:error instanceof Error?error.message:String(error)}));
   const [raw,metadata,relationMetadata]=await Promise.all([host.read(request),optionalReading('node-metadata'),optionalReading('scene-relations')]);if(epoch!==generation||destroyed)return;
   if(!sameBasis())throw new Error('The selected construction changed while this reading was returning');
   assertInstrumentReadingScope(raw,view,sceneId);
   let tagReason=metadata.reason;let tags:ReadonlyMap<string,readonly string[]>=new Map();
   if(metadata.value!==undefined){try{tags=nativeInstrumentNodeTags(metadata.value,view,sceneId);}catch(error){tagReason=error instanceof Error?error.message:String(error);}}
   let relationReason=relationMetadata.reason;let sourceRelations:ReturnType<typeof nativeInstrumentSourceRelations>=[];
   if(relationMetadata.value!==undefined){try{sourceRelations=nativeInstrumentSourceRelations(relationMetadata.value,view,sceneId);}catch(error){relationReason=error instanceof Error?error.message:String(error);}}
   const data=await readingInstruments(raw,nativeInstrumentTitles(view,sceneId),nativeInstrumentPreviews(view,sceneId),tags,sourceRelations);if(epoch!==generation||destroyed)return;
   if(!sameBasis())throw Error('The native Scene changed while preparing this instrument reading');
   const state=stateFor(data.reading.subject.subject_ref);
   const nativeReading=data.reading as unknown as TechneReading;
   const timeCurrent=()=>epoch===generation&&!destroyed&&lens===selected&&sameBasis();
   let sharedTime:NativeTimeWindowReply|null=null;
   let timeReason:string|undefined;
   if(selected==='m2'||selected==='m4') {
    try{sharedTime=await readSharedTimeWindow(request,nativeReading,selected==='m2'?'timeline':'place',timeCurrent);}
    catch(error){if(!timeCurrent())return;timeReason=error instanceof Error?error.message:String(error);message(timeReason);}
    if(!timeCurrent())return;
    state.timeDraft??={from:sharedTime?.axis.window?.from??'',to:sharedTime?.axis.window?.to??'',captured:null};
    if(!state.timeDraft.captured){state.timeDraft.from=sharedTime?.axis.window?.from??'';state.timeDraft.to=sharedTime?.axis.window?.to??'';}
   }
   // T-FRAME-TIME-PUSH: a nudge from the host re-reads the shared window through the existing read and re-renders this lens
   // through its own render path, only when the read differs; a draft the person is composing is never overwritten.
   const followSharedTime=(rerender:()=>void)=>{
    offSharedTimeNudges?.();
    offSharedTimeNudges=followSharedTimeNudges({basis:request,reading:nativeReading,instrument:selected==='m2'?'timeline':'place',current:timeCurrent,held:()=>sharedTime,
     refresh:reply=>{sharedTime=reply;const draft=state.timeDraft;if(draft&&!draft.captured){draft.from=reply.axis.window?.from??'';draft.to=reply.axis.window?.to??'';}if(timeCurrent())rerender();}});
   };
   const timeControls=(redraw:()=>void)=><SharedTimeWindowControls basis={request} reading={nativeReading} instrument={selected==='m2'?'timeline':'place'}
    acknowledged={sharedTime} draft={state.timeDraft!} current={timeCurrent} unavailableReason={timeReason} onError={message} onAcknowledged={reply=>{if(timeCurrent()){sharedTime=reply;redraw();}}}/>;
   if(view){
    const loadTimeline=data.dataSource.loadTimelineView;
    data.dataSource.loadTimelineView=async(range,filters)=>{const returned=await loadTimeline(range,filters),material=host.sceneMaterial(sceneId).research;return {...returned,nodes:returned.nodes.map(node=>{const layout=material?.timeline[node.node.graphNodeId];return layout?{...node,layoutOverride:{lane:layout.lane??'default',offsetY:layout.offsetY,width:layout.width??240,height:layout.height??160,style:timelineStyleLoaded(layout.style),layoutRevision:layout.layoutRevision??0}}:node;})};};
    // lane-2 T16: a card's colours persist in the Scene's timeline layout record. A colour the card-style grammar refuses is
    // thrown here, so the lens keeps its optimistic colour and shows the reason in its save-error slot with Retry.
    data.dataSource.saveTimelineLayout=async(input)=>{
     if(!data.bundle.nodes.some(n=>n.graphNodeId===input.graphNodeId))throw new Error('Timeline node is outside the current reading');
     const style=timelineStyleOf(input.style);
     await host.material(sceneId,{type:'timeline-layout',id:input.graphNodeId,expectedRevision:input.expectedRevision,value:{offsetY:input.offsetY,width:input.width,height:input.height,lane:input.lane,...(Object.keys(style).length?{style}:{})}});
     const stored=host.sceneMaterial(sceneId).research?.timeline[input.graphNodeId];if(!stored)throw new Error('Native owner did not return the timeline layout');
     return {status:input.expectedRevision===null?'created':'updated',layout:{lane:stored.lane??input.lane,offsetY:stored.offsetY,width:stored.width??input.width,height:stored.height??input.height,style:timelineStyleLoaded(stored.style),layoutRevision:stored.layoutRevision!}};
    };
    // lane-2 T15–T18: the mounted chronology holds its presentation here. A view waiting to be applied is restored on mount.
    data.dataSource.bindPresentation=handle=>{
     state.timelineHandle=handle;
     const pending=state.timelinePending;
     if(handle&&pending){
      state.timelinePending=undefined;
      void handle.restore(pending.presentation).then(({unresolved})=>message(timelineRestoreNote(pending.name,unresolved)),error=>message(error instanceof Error?error.message:String(error)));
     }
    };
   }

   if(selected==='m1'){
    message('Source relations · open a card to inspect');render(canvasNode(data.canvas,state,generation));return;
   }
   if(selected==='m2'){
    const temporal=data.bundle.nodes.filter(n=>n.isTemporal);
    // lane-2 T25: the chronology, the Relations tab and the status line read one availability voice.
    const voice=chronologyVoice(projectionAvailability(nativeReading,sharedTime?.axis));
    const years=temporal.flatMap(node=>[node.validFrom,node.validTo]).flatMap(value=>{const match=typeof value==='string'?/^(-?\d{1,6})(?:-|$)/.exec(value):null;return match?[Number(match[1])]:[];}).filter(Number.isFinite);
    const first=years.length?Math.min(...years):0,last=years.length?Math.max(...years):first;
    const available=Math.max(240,host.container.clientWidth-320);
    const savedTimeline=view?host.sceneMaterial(sceneId).research?.views.timeline:undefined;
    state.timeline??={centerYear:savedTimeline?.x??(first+last)/2,pixelsPerYear:savedTimeline?.zoom??Math.max(.02,Math.min(4000,available/Math.max(2,(last-first)*1.4))),selectedNodeId:null};
    // Chronology vs. the M2′ relation-field projections is a presentation
    // switch over the SAME reading/repository — never a second app, tab or
    // store (Wayfinder §16). Session-local only, like the timeline camera.
    // Seam B: a carried event is the chronology selection, through the one timeline key a named view also remounts with. A ref the reading does not date is named.
    const focusEvent=focusRef!==undefined?(temporal.some(node=>node.graphNodeId===focusRef)?focusRef:null):undefined;
    const focusNote=focusRef!==undefined&&focusEvent===null?`Not focused: ${focusRef} is not a dated event in this reading.`:null;
    if(focusEvent){state.timeline={...state.timeline!,selectedNodeId:focusEvent};state.timelineKey=(state.timelineKey??0)+1;}
    state.m2Projection??='chronology';
    const setProjection=(next:'chronology'|'field'|'relative')=>{
     // Leaving the chronology keeps what it held, so a view saved from the relation field names the chronology's own filters.
     if(state.timelineHandle&&state.m2Projection==='chronology'&&next!=='chronology')state.timelinePresentation=state.timelineHandle.capture();
     state.m2Projection=next;render(canvasNode2());
    };
    // lane-2 T15–T18: named timeline views, in the Places grammar ("Save view…" names it, "Views…" goes to or removes one). A
    // view is the camera, the projection and relation mode, the filters, the walk chain, the open frame and the working set.
    const savedTimelineViews=():Record<string,TimelineViewRecord>=>{try{return host.sceneMaterial(sceneId).research?.timelineViews??{};}catch{return {};}};
    const saveTimelineView=()=>{
     if(!view||!state.timeline)return;
     const entered=window.prompt('Name this timeline view');
     if(entered===null)return;
     const problem=timelineViewNameProblem(entered,savedTimelineViews());
     if(problem){message(problem);return;}
     const name=entered.trim();
     // The mounted lens reads its own filters, chain, frame and stack; in the relation field the last chronology capture stands.
     const camera={centerYear:state.timeline.centerYear,pixelsPerYear:state.timeline.pixelsPerYear};
     const presentation:TimelinePresentation=state.timelineHandle?.capture()??{...openTimelinePresentation(camera),...state.timelinePresentation,camera};
     let record:TimelineViewRecord;
     try{record=timelineViewOf({projection:state.m2Projection==='field'?'relations':'chronology',presentation});}
     catch(error){message(error instanceof Error?error.message:String(error));return;}
     void host.material(sceneId,{type:'timeline-view-save',name,view:record}).then(()=>{message(`Timeline view "${name}" saved`);render(canvasNode2());},error=>message(error instanceof Error?error.message:String(error)));
    };
    // Going to a view sets its camera and projection now; its filters, chain, frame and stack are applied when the chronology
    // mounts (its refs re-read through the native owner), so a restore never reads a stale copy.
    const applyTimelineView=(name:string)=>{
     const saved=savedTimelineViews()[name];
     if(!saved){message(`No timeline view named "${name}"`);return;}
     const plan=timelineViewRestorePlan(saved);
     state.timeline={centerYear:plan.presentation.camera.centerYear,pixelsPerYear:plan.presentation.camera.pixelsPerYear,selectedNodeId:null};
     state.m2Projection=plan.projection==='relations'?'field':'chronology';
     state.timelinePresentation=plan.presentation;
     state.timelinePending={name,presentation:plan.presentation};
     state.timelineKey=(state.timelineKey??0)+1;
     render(canvasNode2());
     // A relation-field view names its chronology filters, frame and stack too: they apply when the chronology next opens.
     if(plan.projection==='relations')message(`View "${name}" restored; its chronology filters, frame and stack apply when the chronology opens.`);
    };
    const removeTimelineView=(name:string)=>{void host.material(sceneId,{type:'timeline-view-remove',name}).then(()=>{message(`Timeline view "${name}" removed`);render(canvasNode2());},error=>message(error instanceof Error?error.message:String(error)));};
    // lane-2 T21/T22: "Show on the globe" offers the selected event's one located place. The crossing is planned on the session
    // read here; a session that has drifted refuses by name (handoffRefusal) and is never re-targeted. The place is the shared
    // spatial focus and the event's own validity the window, each through the owner's compare-and-set write, then Places opens.
    const showOnGlobe=async(carry:Extract<GlobeCarry,{state:'offer'}>)=>{
     if(!sharedTime||!timeCurrent())throw Error('The shared session is no longer presented, so the globe was not changed.');
     const planned=sessionCrossingIdentity(sharedTime.session);
     const refuse=()=>{const reason=handoffRefusal(planned,sharedTime?.session??null);if(reason)throw Error(reason);};
     refuse();
     sharedTime=await writeSharedSpatialFocus(request,nativeReading,'timeline',sharedTime,carry.place_ref);
     refuse();
     if(carry.window)sharedTime=await writeSharedTimeWindow(request,nativeReading,'timeline',sharedTime,carry.window);
     if(host.activateInstrument)host.activateInstrument('place');
     else{lens='m4';await load('m4');}
    };
    const globeControl=(eventRef:string|null)=>{
     if(!eventRef||!sharedTime)return null;
     let carry:GlobeCarry;
     try{
      const axisEvent=axisEventOf(timeAxisProjection(nativeReading,sharedTime.session),eventRef);
      // The window is the event's own validity: an event with no native facet identity has none to offer over.
      carry=axisEvent?showOnGlobeOf(nativeReading,nativeReading.subject.subject_ref,axisEvent):{state:'absent',reason:'This event has no native facet identity, so its validity cannot be read; nothing is flown to.'};
     }
     catch(error){carry={state:'absent',reason:error instanceof Error?error.message:String(error)};}
     if(carry.state==='absent')return <button type="button" disabled aria-label="Show on the globe" title={carry.reason}>Show on the globe</button>;
     return <button type="button" aria-label="Show on the globe" title="Show this event's place on the globe, over the event's own validity" onClick={()=>{void showOnGlobe(carry as Extract<GlobeCarry,{state:'offer'}>).catch(error=>message(error instanceof Error?error.message:String(error)));}}>Show on the globe</button>;
    };
    // lane-2 T20: the traversal trail, one history. Every step is one compare-and-set write on the shared session through the owner's
    // traversal route, and the trail is read back from the session's own navigation (its traversal hops since the origin event).
    // The mount keeps only the cursor the Back control reads, replaced from each acknowledged reply.
    const trailOf=():TraversalFold|null=>trailOfNavigation(sharedTime?.session.navigation);
    const setTrail=(next:TraversalFold|null)=>{state.traversal=next;state.traversalListener?.(next);};
    const recordStep=async(step:DisclosureTraversalStep,ref:string)=>{
     const acknowledged=sharedTime;
     if(!acknowledged)throw Error('The shared session is no longer presented, so the trail was not changed.');
     const planned=sessionCrossingIdentity(acknowledged.session);
     const reply=await writeSharedTraversalHop(request,nativeReading,'timeline',acknowledged,traversalHopOf(acknowledged.session,step,ref));
     // The session the write was made on must still be the one presented; a drift is refused by name, never re-targeted.
     const reason=handoffRefusal(planned,sharedTime?.session??null);
     if(reason)throw Error(reason);
     sharedTime=reply;
    };
    // The steps to record from the event: a new event starts its trail at the event; a relation always opens from that event.
    const stepsFromEvent=(eventRef:string,steps:[DisclosureTraversalStep,string][]):[DisclosureTraversalStep,string][]=>{
     const cursor=trailOf();
     return cursor&&cursor.origin===eventRef?steps:[['event',eventRef],...steps];
    };
    const runSteps=async(steps:[DisclosureTraversalStep,string][]):Promise<boolean>=>{
     try{
      for(const [step,ref] of steps)await recordStep(step,ref);
      setTrail(trailOf());
      if(sharedTime){const cursor=trailOf();message(`${cursor?foldStanding(cursor):'event'} · ${handoffDisclosure(sharedTime.session)}`);}
      return true;
     }catch(error){message(error instanceof Error?error.message:String(error));return false;}
    };
    const noTrailBase=()=>message(state.timeline?.selectedNodeId?'No Technē session is open, so this was not opened.':'A relation opens from its event. Select the event first.');
    const relationOfRow=(row:{sourceGraphNodeId:string;targetGraphNodeId:string;properties:Record<string,unknown>})=>({relation_ref:relationRefOf(row.properties),from_ref:row.sourceGraphNodeId,to_ref:row.targetGraphNodeId});
    // The model judges each step first (a derived or non-touching relation is refused by name, and nothing is written).
    const openTrailRelation=(row:{sourceGraphNodeId:string;targetGraphNodeId:string;properties:Record<string,unknown>})=>{
     const eventRef=state.timeline?.selectedNodeId;
     if(!eventRef||!sharedTime){noTrailBase();return;}
     const relation=relationOfRow(row);
     const step=openRelation(trailFromEvent(eventRef,sharedTime.session.subject_ref,sharedTime.session.selection.selection_ref),relation);
     if(!step.ok){message(step.reason);return;}
     if(relation.relation_ref===null)return;
     void runSteps(stepsFromEvent(eventRef,[['relation',relation.relation_ref]]));
    };
    // An endpoint of the followed link: the relation it belongs to is recorded first when the trail is not already on it, then the
    // endpoint. The host's answer decides whether the lens opens the endpoint: a refusal is stated by name and opens nothing.
    const openTrailEndpoint=async(row:{sourceGraphNodeId:string;targetGraphNodeId:string;properties:Record<string,unknown>},side:'from'|'to'):Promise<boolean>=>{
     const eventRef=state.timeline?.selectedNodeId;
     if(!eventRef||!sharedTime){noTrailBase();return false;}
     const relation=relationOfRow(row);
     const onRelation=openRelation(trailFromEvent(eventRef,sharedTime.session.subject_ref,sharedTime.session.selection.selection_ref),relation);
     if(!onRelation.ok){message(onRelation.reason);return false;}
     const endpoint=openEndpoint(onRelation.trail,side);
     if(!endpoint.ok){message(endpoint.reason);return false;}
     const hop=currentHop(endpoint.trail);
     if(hop.kind!=='endpoint'||relation.relation_ref===null)return false;
     const cursor=trailOf();
     const last=cursor&&cursor.steps.length>0?cursor.steps[cursor.steps.length-1]:null;
     const onRelationAlready=cursor!==null&&cursor.origin===eventRef&&last!==null&&last.step==='relation'&&last.ref===relation.relation_ref;
     const steps=stepsFromEvent(eventRef,onRelationAlready?[]:[['relation',relation.relation_ref]]);
     return runSteps([...steps,['endpoint',hop.ref]]);
    };
    // Back to event records a back step; the trail returns to its origin event, and the Timeline's selection never moves.
    const backToEvent=()=>{const cursor=trailOf();if(!cursor||cursor.steps.length===0)return;void runSteps([['back',cursor.origin]]);};
    const trailControl=(trail:TraversalFold|null)=>trail&&trail.steps.length>0&&trail.origin===state.timeline?.selectedNodeId
     ?<button type="button" aria-label="Back to event" title={`Return along the trail to its event · ${foldStanding(trail)}`} onClick={backToEvent}>Back to event</button>
     :null;
    // The stage focus is held at install scope (above): this lens only attaches its own keys.
    if(view){
     const onStageKey=(event:KeyboardEvent)=>{
      // Focus that outlives its lens ends on the next key, so the shared tools are never left hidden.
      if(destroyed||lens!=='m2'){if(focusOn())endTimelineFocus();return;}
      if(views.get(currentKey??'')!==state||event.metaKey||event.ctrlKey||event.altKey)return;
      const target=event.target as HTMLElement|null;
      if(target?.isContentEditable||target?.tagName==='INPUT'||target?.tagName==='TEXTAREA'||target?.tagName==='SELECT')return;
      if(event.key==='Escape'&&focusOn()){event.preventDefault();event.stopImmediatePropagation();endTimelineFocus();return;}
      if(event.key==='f'||event.key==='F'){event.preventDefault();if(focusOn())endTimelineFocus();else beginTimelineFocus();}
     };
     // Capture phase: a focused Escape is taken here, before the lens's own Escape clears its selection beneath.
     window.addEventListener('keydown',onStageKey,true);
     timelineFocusOff=()=>{window.removeEventListener('keydown',onStageKey,true);};
    }
    const canvasNode2=():ReactNode=>{
     // Lane-2 T5: relative mode exists only when the acknowledged session names a
     // zero this reading warrants; otherwise the segment is absent, never disabled.
     const relativeAxis=sharedTime?relativeTimeAxisProjection(nativeReading,sharedTime.session):null;
     if(state.m2Projection==='relative'&&!relativeAxis)state.m2Projection='chronology';
     // lane-2 T25: a saved or carried Relations projection with nothing to draw falls back to the chronology, with its reason in the status line.
     if(state.m2Projection==='field'&&!voice.relations.available)state.m2Projection='chronology';
     const toggle=<div className="research-tool-actions" role="tablist" aria-label="Timeline projection">
      <button role="tab" aria-selected={state.m2Projection==='chronology'} aria-pressed={state.m2Projection==='chronology'} onClick={()=>setProjection('chronology')}>Chronology</button>
      <button role="tab" aria-selected={state.m2Projection==='field'} aria-pressed={state.m2Projection==='field'} disabled={!voice.relations.available} title={voice.relations.reason??undefined} onClick={()=>setProjection('field')}>Relations</button>
      {relativeAxis&&<button role="tab" aria-selected={state.m2Projection==='relative'} aria-pressed={state.m2Projection==='relative'} onClick={()=>setProjection('relative')}>Relative</button>}
      <button aria-label="Refresh timeline" title="Refresh timeline" onClick={()=>void load('m2')}><ToolIcon name="history"/></button>
      {view&&state.m2Projection==='chronology'&&<button aria-label="Save timeline view" title="Save timeline view" onClick={()=>{if(state.timeline)void host.material(sceneId,{type:'viewport',key:'timeline',value:{x:state.timeline.centerYear,y:0,zoom:state.timeline.pixelsPerYear}}).then(()=>message('View saved'),error=>message(String(error)));}}><ToolIcon name="save"/></button>}
      {view&&<button type="button" className="research-timeline-view-save" aria-label="Save view…" title="Save this timeline view: camera, projection, relation mode, filters, walk, frame and working set" onClick={saveTimelineView}>Save view…</button>}
      {view&&Object.keys(savedTimelineViews()).length>0&&<select className="research-timeline-view-select" aria-label="Saved timeline views" value="" onChange={event=>{const [op,name]=event.target.value.split('\u0000');if(op==='apply')applyTimelineView(name);if(op==='remove')removeTimelineView(name);event.target.value='';}}>
       <option value="">Views…</option>{Object.keys(savedTimelineViews()).map(name=><optgroup key={name} label={name}><option value={`apply\u0000${name}`}>Go to</option><option value={`remove\u0000${name}`}>Remove</option></optgroup>)}</select>}
      {(tagReason||relationReason)&&<button onClick={()=>message([tagReason&&`Tags: ${tagReason}`,relationReason&&`Relations: ${relationReason}`].filter(Boolean).join(' · '))}>Reading incomplete</button>}
      {view&&state.m2Projection==='chronology'&&<SelectedEventControl initial={state.timeline?.selectedNodeId??null} listen={listener=>{state.globeListener=listener;}} control={globeControl}/>}
      {view&&state.m2Projection==='chronology'&&<TrailControl initial={trailOf()} listen={listener=>{state.traversalListener=listener;}} control={trailControl}/>}
      {view&&<button type="button" className="research-timeline-focus" aria-label="Focus the timeline stage" title="Focus the stage: F toggles, Escape restores. The stage asks for fullscreen where granted; the chrome returns exactly on exit." onClick={beginTimelineFocus}>Focus</button>}
      {timeControls(()=>render(canvasNode2()))}
     </div>;
     if(state.m2Projection==='field'){
      return <>{createPortal(toggle,host.tools)}<RelationFieldView reading={nativeReading} width={available} timeAxis={sharedTime?.axis}
       onSelectRelation={edge=>{if(!edge.derived_id)host.select(sceneId,null,edge.id);}}
       onOpenMember={ref=>host.inspectSubject(ref)}/></>;
     }
     if(state.m2Projection==='relative'&&relativeAxis){
      // Steps from the disclosed zero, in the reading's own declared order. Only
      // the step label and the facet kind are shown: no calendar year or date.
      return <>{createPortal(toggle,host.tools)}<ol className="research-relative-axis" aria-label="Relative axis: steps from the disclosed zero" data-testid="timeline-relative-axis" style={{display:'flex',flexWrap:'wrap',gap:12,listStyle:'none',margin:0,padding:12}}>
       {relativeAxis.marks.map(mark=><li key={mark.ref} data-offset={mark.offset} aria-current={mark.offset===0?'step':undefined} style={{fontVariantNumeric:'tabular-nums'}}>
        <strong>{mark.label}</strong>{' '}<span>{nativeReading.temporal?.find(facet=>facet.facet_ref===mark.facet_ref)?.kind??'undated'}</span>
       </li>)}
      </ol></>;
     }
     // Lane-2 T6: the chronology reads the shared time-axis projection of the
     // session the host acknowledged — the same function lane 4 reads.
     const timed=sharedTimelinePresentation(data.dataSource,data.timeline,nativeReading,sharedTime?timeAxisProjection(nativeReading,sharedTime.session):null);
     // lane-2 T25: with no temporal facet there is nothing to place on the axis; the honest absence and its reason stand in for the empty surface.
     if(temporal.length===0)return <>{createPortal(toggle,host.tools)}<p className="research-chronology-empty" data-testid="chronology-honest-empty" role="note">{NO_DATES_SENTENCE}{voice.timeline.reason?`: ${voice.timeline.reason}`:''}</p></>;
     // lane-2 T9: a containment child the reading dates is flagged, so a parent whose dated child the view has not loaded does not collapse onto part of its children.
     const datedNodes=new Set(data.bundle.nodes.filter(node=>node.isTemporal).map(node=>node.graphNodeId));
     return <>{createPortal(toggle,host.tools)}<TimelineSurface key={state.timelineKey??0} timeExtent={years.length?{startYear:first,endYear:last}:undefined} toolbarContainer={host.tools} repository={timed.repository} constellationId={data.reading.subject.subject_ref} dataSource={timed.dataSource} containment={containmentPairs(relationEdges(nativeReading)).map(pair=>({...pair,dated:datedNodes.has(pair.child)}))} participants={participantSpansFromReading(nativeReading).spans}
      initialState={state.timeline!} onViewStateChange={value=>{const moved=value.selectedNodeId!==state.timeline?.selectedNodeId;state.timeline=value;if(moved)setTrail(trailOf());state.globeListener?.(value.selectedNodeId??null);}}
      onOpenCanvasNode={ref=>{const node=data.bundle.nodes.find(node=>node.graphNodeId===ref);if(node)host.inspectSubject(ref,{node});}} onOpenNode={(ref,node,relationField)=>{const facets=data.bundle.relationships.filter(row=>row.targetGraphNodeId===ref&&typeof row.properties.temporal_kind==='string');host.inspectSubject(ref,{node,relationField,anchor:facets.length>1?{state:'absent',reason:'More than one temporal facet is disclosed for this event; its source opens at its top.'}:evidenceAnchorOf(facets[0]?.properties??{})});}}
      onOpenRelation={openTrailRelation} onOpenEndpoint={openTrailEndpoint}/></>;
    };
    // lane-2 T22: the status line names the subject, reading basis and window the session holds, exactly as it holds them.
    const chronologyStatus=state.m2Projection==='field'?voice.relationField:voice.chronology;
    const timelineStatus=sharedTime&&state.m2Projection==='chronology'?`${chronologyStatus} · ${handoffDisclosure(sharedTime.session)}`:chronologyStatus;
    message(focusNote?`${focusNote} ${timelineStatus}`:timelineStatus);
    if(sharedTime)followSharedTime(()=>render(canvasNode2()));
    render(canvasNode2());return;
   }
   const places=await data.places.getLocatedNodes(data.reading.subject.subject_ref);if(epoch!==generation||destroyed)return;
   if(!sameBasis())throw Error('The native Scene changed while loading its places');
   // The shipped basemap is geographic context, never personal graph nodes.
   // Located subject markers come only from the current native reading.
   const pack=loadBundledGeographyPack();
   const tileSource={kind:'geojson' as const,url:'data:application/json,'+encodeURIComponent(JSON.stringify(pack.basemap)),attribution:pack.manifest.tileSource.attribution};
   message(places.length?'Places · offline':'No locations disclosed by this source');
   const scene=view?host.sceneMaterial(sceneId):undefined,assets=new Map<string,string>();
   const images=(scene?.entities??[]).flatMap(entity=>{const card=scene?.research?.cards[entity.id];if(entity.source?.kind!=='image'||!entity.source.image.dataUrl)return [];const artifactPath=`scene-image:${entity.id}`;assets.set(artifactPath,entity.source.image.dataUrl);return [{id:entity.id,profileScope:data.reading.subject.subject_ref,artifactPath,capturedAt:null,latitude:null,longitude:null,headingDegrees:null,redactionStatus:'pending' as const,redactionRegions:[],redactedArtifactPath:null,createdAt:card?.importedAt,updatedAt:card?.importedAt}];});
   const importImagery=scene?()=>{const picker=document.createElement('input');picker.type='file';picker.accept='image/png,image/jpeg,image/webp';picker.onchange=async()=>{const file=picker.files?.[0];if(!file)return;try{if(file.size>196608)throw new Error('Choose an image smaller than 192 KiB for this native document.');const bytes=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});await host.material(sceneId,{type:'create-card',kind:'image',position:{x:0,y:0},title:file.name.slice(0,160),dataUrl:bytes});if(lens==='m4')await load('m4');}catch(error){message(String(error));}};picker.click();}:undefined;
   const savedPlace=scene?.research?.views.place;state.place??=viewStateFromPlaceRecord(savedPlace)??undefined;
   // W3 — "Edit place/time" reopens the SAME native constellation route
   // "Edit constellation" already uses, for the Scene entity that carries
   // this reading's own subject; absent when no such entity is bound (an
   // honest absence, never a locally-invented edit path).
   const placeEntityRef=view?subjectEntityRef(view.document.entities,data.reading.subject.subject_ref):null;
   const placeEditRequest=view&&binding&&placeEntityRef?{expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref,entity_ref:placeEntityRef}:undefined;
   // Lane-4 T21: the Scene's saved layers restore on a first visit in this session (absent = today's defaults). Later visits keep
   // the session's own state, which the last settled change already wrote. The owner's live-source allowance is never restored.
   const restoredLayers=restoreLayers((()=>{try{return host.sceneMaterial(sceneId).research?.placeLayers;}catch{return undefined;}})());
   state.placeFilter??=restoredLayers.filter;
   // Lane-4 T4/T5: the owner's live choice is session view state, held with the placeFilter. It is off until the owner allows it here, and only then does the policy's tile_refresh gate open.
   state.livePlaces??={allowed:false,policy:createLiveServicePolicy(),stack:restoredLayers.stack};
   // T-REVIEW-4 #3: the Scene's stored layers are the record. When they differ from the key this view last wrote or adopted, and no
   // write is pending or in flight, the Scene moved under the view (an undo or redo of "Set map layers"): the toggles and the basemap
   // rows re-adopt from the Scene. The owner's live-source allowance is session state and is never re-adopted.
   const sceneLayersKey=layersKey(restoredLayers.filter,restoredLayers.stack);
   if(state.placeLayersKey===undefined)state.placeLayersKey=sceneLayersKey;
   else if(!state.placeLayersSave&&!state.placeLayersWrites&&sceneLayersKey!==state.placeLayersKey){
    state.placeFilter=restoredLayers.filter;state.livePlaces={...state.livePlaces!,stack:restoredLayers.stack};state.placeLayersKey=sceneLayersKey;
   }
   // Lane-4 T17–T19: the map's authoring surface asks this host for the owner's route. "Edit place/time" opens
   // the same constellation editor, and the map never writes a coordinate: the save, its basis check and its
   // refusals all happen in that editor, and their own message is the one shown here.
   // T17b: the route carries the map's draft (a draft only, never a write) and registers the constellation it opened,
   // so the owner's save or refusal comes back to this instrument.
   const openPlaceRoute=(notice?:string,draft?:PlaceDraft,graphNodeId?:string)=>{
    if(!placeEditRequest)return;
    void techneConstellationRequest({...placeEditRequest,operation:'open',...(draft?{placeDraft:draft}:{})}).then(target=>{placeRoutes.set(target.frame_ref,{graphNodeId});if(notice)message(notice);},error=>message(error instanceof Error?error.message:String(error)));
   };
   placeRouteHandler=(frameRef,outcome)=>{
    // Lane-4 T17c: the owner's answer goes to the map that opened the route, so its marker returns and its notice shows
    // the owner's words there. Without a mounted map the words are shown here. A save re-reads the reading first, so the
    // new or moved marker renders from the owner's saved facts, and the words are delivered after that re-read.
    const result:PlaceRouteResult={graphNodeId:placeRoutes.get(frameRef)?.graphNodeId??null,outcome:outcome.kind==='saved'?{kind:'saved'}:{kind:'refused',reason:outcome.reason}};
    const deliver=()=>{
     if(placeRouteListeners.size)placeRouteListeners.forEach(listener=>listener(result));
     else message(constellationResultNotice(result.outcome).text);
    };
    // A closed or destroyed instrument, or one on another lens, is not reopened by a late answer: only the words are kept.
    if(destroyed||lens!=='m4'){if(!destroyed)message(constellationResultNotice(result.outcome).text);return;}
    if(outcome.kind==='saved')void load('m4').then(deliver);
    else deliver();
   };
   listenForPlaceRouteResults();
   const placeAuthoring:PlaceAuthoringHost={
    canAuthor:!!placeEditRequest,
    unavailableReason:placeEditRequest?null:'This reading has no native Scene entity bound, so there is no authoring route here.',
    onAddPlace:prefill=>openPlaceRoute(addRouteNotice(prefill),placeDraftForAdd(prefill)),
    onEditPlace:graphNodeId=>openPlaceRoute(undefined,undefined,graphNodeId),
    onProposeMove:proposal=>openPlaceRoute(moveRouteNotice(proposal),placeDraftForMove(proposal),proposal.graphNodeId),
    subscribeRouteResults:subscribePlaceRouteResults,
   };
   // W2 — the SAME filter state drives both the map's own repository
   // (presentation-only: `filteredPlacesRepository` never rewrites the
   // wrapped repository's reads) and the panel's facet list, so the markers
   // and the panel always agree.
   // Lane-4 T20: named Places views. A view is the camera, the layer toggles, the basemap rows and the shared time window,
   // kept with the Scene as refs and presentation only. Save and remove are each one labelled undo entry. Going to a view sets
   // the camera (it flies; reduced motion jumps), the layers, the basemap rows and the shared window. It never sets the owner's
   // live-source switch, so going to a view grants no network.
   let restoreViewOnMap:((target:PlaceViewRestoreTarget)=>void)|null=null;
   const savedPlaceViews=():Record<string,PlaceViewRecord>=>{try{return host.sceneMaterial(sceneId).research?.placeViews??{};}catch{return {};}};
   const savePlaceView=()=>{
    if(!scene)return;
    const entered=window.prompt('Name this place view');
    if(entered===null)return;
    const problem=placeViewNameProblem(entered,savedPlaceViews());
    if(problem){message(problem);return;}
    const name=entered.trim();
    const record=capturePlaceView({viewState:state.place??defaultPlaceView(),filter:state.placeFilter!,stack:state.livePlaces!.stack,window:sharedTime?.axis.window??null});
    void host.material(sceneId,{type:'place-view-save',name,place:record}).then(()=>{message(`View "${name}" saved`);render(renderPlaces());},error=>message(error instanceof Error?error.message:String(error)));
   };
   const applyPlaceView=async(name:string)=>{
    const saved=savedPlaceViews()[name];
    if(!saved){message(`No place view named "${name}"`);return;}
    const plan=restorePlaceView(saved);
    // The layers and the basemap rows are session view state. The map takes the same stack, and its own change report keeps this host in step.
    state.placeFilter=plan.filter;
    state.livePlaces!.stack=plan.stack;
    scheduleLayersSave();
    restoreViewOnMap?.({viewState:plan.viewState,stack:plan.stack});
    if(timeCurrent())render(renderPlaces());
    let note=`View "${name}" restored`;
    if(sharedTime&&timeCurrent()&&!sameTimeWindow(sharedTime.axis.window,plan.window)){
     try{sharedTime=await writeSharedTimeWindow(request,nativeReading,'place',sharedTime,plan.window);if(timeCurrent())render(renderPlaces());}
     catch(error){note=error instanceof Error?error.message:String(error);}
    }else if(!sharedTime&&plan.window)note='Shared time is not available for this reading, so the saved window was not restored.';
    message(note);
   };
   // Lane-4 T21: the layer toggles and basemap rows persist per Scene. A change is written once the person settles (600 ms idle),
   // never per slider tick, and a settle that restates what the Scene already keeps writes nothing. Only the layers are written:
   // the owner's live-source allowance is session state and is never part of the record.
   const persistPlaceLayers=()=>{
    if(!scene||!state.placeFilter||!state.livePlaces)return;
    const kept=restoreLayers((()=>{try{return host.sceneMaterial(sceneId).research?.placeLayers;}catch{return undefined;}})());
    if(layersKey(state.placeFilter,state.livePlaces.stack)===layersKey(kept.filter,kept.stack))return;
    // The key becomes the Scene's when the owner acknowledges the write; until then the write counts as in flight.
    const key=layersKey(state.placeFilter,state.livePlaces.stack);
    state.placeLayersWrites=(state.placeLayersWrites??0)+1;
    void host.material(sceneId,{type:'place-layers-set',value:layersRecordOf(state.placeFilter,state.livePlaces.stack)})
     .then(()=>{state.placeLayersKey=key;},error=>message(error instanceof Error?error.message:String(error)))
     .finally(()=>{state.placeLayersWrites=(state.placeLayersWrites??1)-1;});
   };
   const scheduleLayersSave=()=>{
    if(state.placeLayersSave)clearTimeout(state.placeLayersSave.timer);
    const write=()=>{if(state.placeLayersSave){clearTimeout(state.placeLayersSave.timer);state.placeLayersSave=undefined;}persistPlaceLayers();};
    state.placeLayersSave={timer:setTimeout(write,600),write};
   };
   const removePlaceView=(name:string)=>{void host.material(sceneId,{type:'place-view-remove',name}).then(()=>{message(`View "${name}" removed`);render(renderPlaces());},error=>message(error instanceof Error?error.message:String(error)));};
   // Lane-4 T25–T26: a tour is recorded from the camera the map shows, saved to the Scene through the material path (as named views
   // are), and played as flights. Only the recording in progress lives in this session, and it is discarded when recording stops
   // unsaved. A stop's journey binding is written as withStopBinding plus a save; the journey's own beats are read on every render.
   let flyOnMap:((camera:PlaceViewState,durationMs:number)=>void)|null=null;
   let tourPlayback:PlaceTourPlayback|null=null;
   let playingTour:string|null=null;
   const tourSession=()=>placeTourSessionOf(sceneId);
   const savedPlaceTours=():Record<string,PlaceTourRecord>=>{try{return host.sceneMaterial(sceneId).research?.placeTours??{};}catch{return {};}};
   const reducedMotionNow=()=>{try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}};
   const stopTour=()=>{tourPlayback?.stop();tourPlayback=null;playingTour=null;};
   const refusal=(error:unknown)=>message(error instanceof Error?error.message:String(error));
   const toggleTourRecording=()=>{
    if(!scene){message('Open a Scene to record a tour.');return;}
    const session=tourSession();
    if(session.recording){session.recording=false;session.record={stops:[]};message('Recording stopped; the unsaved tour was discarded.');}
    else{session.recording=true;session.record={stops:[]};message('Recording: each stop is the camera the map shows.');}
    render(renderPlaces());
   };
   const addTourStop=(caption:string,holdSeconds:number)=>{
    if(!scene)return;
    const session=tourSession();
    const selected=state.selectedPlace??null;
    // The place a stop names is the selected place only when this reading discloses it; no ref is minted for a stop.
    const placeRef=selected!==null&&(nativeReading.spatial??[]).some(facet=>facet.place_ref===selected)?selected:null;
    const stop=captureTourStop({viewState:state.place??defaultPlaceView(),placeRef,caption,holdMs:Math.round(holdSeconds*1000)});
    const next=appendTourStop(session.record,stop);
    if(next.problem){message(next.problem);return;}
    session.record=next.record;
    message(`Stop ${session.record.stops.length} recorded`);
    render(renderPlaces());
   };
   const removeTourStopAt=(index:number)=>{const session=tourSession();session.record=removeTourStop(session.record,index);render(renderPlaces());};
   // Save writes the recording to the Scene under its trimmed name; a refusal names the reason and keeps the recording.
   const saveTour=(entered:string)=>{
    if(!scene)return;
    const session=tourSession();
    const problem=placeTourNameProblem(entered,savedPlaceTours());
    if(problem){message(problem);return;}
    if(session.record.stops.length===0){message('Record at least one stop before saving the tour.');return;}
    const name=entered.trim();
    const tour=session.record;
    void host.material(sceneId,{type:'place-tour-save',name,tour}).then(()=>{session.recording=false;session.record={stops:[]};message(`Tour "${name}" saved`);render(renderPlaces());},refusal);
   };
   const playSavedTour=(name:string)=>{
    const tour=savedPlaceTours()[name];
    if(!scene||!tour)return;
    stopTour();
    playingTour=name;
    tourPlayback=playPlaceTour(tour,{
     reducedMotion:reducedMotionNow(),
     fly:(camera,durationMs)=>{if(destroyed||lens!=='m4'){stopTour();return;}flyOnMap?.(camera,durationMs);},
     onArrive:(caption,index)=>{if(destroyed||lens!=='m4')return;message(caption??`Stop ${index+1} of ${tour.stops.length}`);},
     onDone:()=>{tourPlayback=null;playingTour=null;if(!destroyed&&lens==='m4'){message('Tour finished');render(renderPlaces());}},
    });
    render(renderPlaces());
   };
   const stopPlayingTour=()=>{stopTour();message('Tour stopped');render(renderPlaces());};
   const removeSavedTour=(name:string)=>{
    if(playingTour===name)stopTour();
    void host.material(sceneId,{type:'place-tour-remove',name}).then(()=>{message(`Tour "${name}" removed`);render(renderPlaces());},refusal);
   };
   // A binding is a pair of refs from the journey's own beat; the saved tour is rewritten through the same save.
   const bindTourStop=(name:string,index:number,beat:{expression_ref:string;scene_ref:string}|null)=>{
    const saved=savedPlaceTours()[name];
    if(!scene||!saved)return;
    const tour=withStopBinding(saved,index,beat);
    void host.material(sceneId,{type:'place-tour-save',name,tour}).then(()=>{message(beat?`Stop ${index+1} bound to ${beat.scene_ref}`:`Stop ${index+1} unbound`);render(renderPlaces());},refusal);
   };
   // Seam B: a carried place is the opening selection and the framed focus, through the same two props. A place the reading does not disclose is named.
   let carriedPlace=focusRef!==undefined&&(nativeReading.spatial??[]).some(facet=>facet.place_ref===focusRef)?focusRef:undefined;
   const placeNote=focusRef!==undefined&&carriedPlace===undefined?`Not focused: ${focusRef} is not a disclosed place in this reading.`:null;
   const renderPlaces=():ReactNode=>{
    const filter={...state.placeFilter!,window:sharedTime?.axis.window??null};
    const placeViewsNow=savedPlaceViews();
    // The window is not applied to the repository: the map applies it to every frame from the same filter (T14–T16), so a
    // live window never needs a repository reload. The relation and standing filters still narrow here.
    const filteredRepository=filteredPlacesRepository(data.places,nativeReading,{...filter,window:null});
    // Lane-4 T14–T16: the docked time control spans the reading's own dated events (the T6 projection) and writes the
    // shared window through the same setter as the popover.
    // A reading the projection refuses names its reason on the control; the Places lens itself still renders.
    const placeExtent=(()=>{try{return extentOf(timeAxisProjection(nativeReading,sharedTime?.session??null).events);}catch(error){return {extent:null,reason:error instanceof Error?error.message:String(error)};}})();
    const placeTime:PlaceTimeHost={extent:placeExtent.extent,extentReason:placeExtent.reason,
     unavailableReason:sharedTime?null:(timeReason??'Shared time is not available for this reading, so the window cannot be changed here.'),
     window:sharedTime?.axis.window??null,
     onWindowCommit:async next=>{
      if(!sharedTime||!timeCurrent())throw Error('The shared time window is no longer presented, so it was not changed.');
      const reply=await writeSharedTimeWindow(request,nativeReading,'place',sharedTime,next);
      sharedTime=reply;
      const draft=state.timeDraft;if(draft){draft.captured=null;draft.from=reply.axis.window?.from??'';draft.to=reply.axis.window?.to??'';}
      if(timeCurrent())render(renderPlaces());
     },
    };
    // Lane-4 T24: the shared session's spatial focus (or a focused selection naming a disclosed place) is the place selected and
    // framed on open. A ref the reading does not disclose resolves to null: the lens opens unselected, with no error.
    // A focus the session declares governs the opening even when it is stale (then the lens opens unselected); see openingPlaceSelection.
    // Lane-4 T23: "Open in Timeline" writes the facet's place as the shared spatial focus (so Places reopens on this facet) and the
    // facet's validity as the shared window, each through the owner's compare-and-set write, then opens the Timeline lens through the
    // app's instrument activation so the recorded instrument matches. A facet with no validity leaves the window unchanged.
    const openInTimeline=async(facet:TechnePlaceFacet)=>{
      const plan=timelineOpenPlan(facet);
      if(sharedTime&&timeCurrent()){
        // lane-2 T22: the crossing is planned on the session read here; a drifted session refuses by name, never re-targets.
        const planned=sessionCrossingIdentity(sharedTime.session);
        const refuse=()=>{const reason=handoffRefusal(planned,sharedTime?.session??null);if(reason)throw Error(reason);};
        refuse();
        sharedTime=await writeSharedSpatialFocus(request,nativeReading,'place',sharedTime,plan.spatial_focus_ref);
        refuse();
        if(plan.window)sharedTime=await writeSharedTimeWindow(request,nativeReading,'place',sharedTime,plan.window);
      }else if(plan.window)throw Error('The shared time window is no longer presented, so it was not changed.');
      if(host.activateInstrument)host.activateInstrument('timeline');
      else{lens='m2';await load('m2');}
    };
    // Lane-4 T22: a searched place is written as the native shared session's spatial focus (the same compare-and-set write
    // openInTimeline and showOnGlobe use), and the mounted map is then re-rendered over that session. Nothing here reads or writes
    // the cradle's local session store.
    // The map is re-rendered in place when it is mounted: the same props path every other Places update uses. The vendor map's
    // focus latch honours each distinct ref once, so the new ref flies it. Only when no Places map is presented does the search
    // open the lens (the fallback).
    const mapFocus=placeMountFocus({carried:carriedPlace,session:sharedTime?.session??null,facets:nativeReading.spatial??[],remembered:state.selectedPlace??null});
    const flyToSearchedPlace=async(offer:PlaceOffer)=>{
     const plan=searchChoiceWrite(offer);
     if(!sharedTime||!timeCurrent())throw Error('The shared spatial focus is no longer presented, so it was not changed.');
     const mapPresented=root!==null;
     sharedTime=await writeSharedSpatialFocus(request,nativeReading,plan.instrument,sharedTime,plan.spatial_focus_ref);
     if(!mapPresented){await load('m4');return;}
     if(!timeCurrent())throw Error('The Places instrument changed while the place was chosen; the globe was not re-focused.');
     // A carried ref was the opening focus only; the search's own native focus now decides the globe.
     carriedPlace=undefined;
     render(renderPlaces());
    };
    const facets=<><PlaceSearch reading={nativeReading} onChoose={offer=>{void flyToSearchedPlace(offer).catch(error=>message(error instanceof Error?error.message:String(error)));}}/><PlaceFacetsPanel reading={nativeReading} selectedRef={state.selectedPlace??null} filter={filter} onOpenSource={ref=>host.inspectSubject(ref)} sharedTime
      onFilterChange={next=>{state.placeFilter={...next,window:null};scheduleLayersSave();render(renderPlaces());}}
      editRequest={placeEditRequest} onError={message}/></>;
    return <>{createPortal(<div className="research-tool-actions"><button aria-label="Refresh geography" title="Refresh geography" onClick={()=>void load('m4')}><ToolIcon name="history"/></button>{scene&&<button aria-label="Save map view" title="Save map view" onClick={()=>{if(state.place)void host.material(sceneId,{type:'viewport',key:'place',value:placeRecordFromViewState(state.place)}).then(()=>message('View saved'),error=>message(String(error)));}}><ToolIcon name="save"/></button>}{scene&&<button type="button" className="research-places-view-save" aria-label="Save view…" title="Save this place view: camera, layers, basemap and time window" onClick={savePlaceView}>Save view…</button>}{scene&&Object.keys(placeViewsNow).length>0&&<select className="research-places-view-select" aria-label="Saved place views" value="" onChange={event=>{const [op,name]=event.target.value.split('\u0000');if(op==='apply')void applyPlaceView(name);if(op==='remove')removePlaceView(name);event.target.value='';}}><option value="">Views…</option>{Object.keys(placeViewsNow).map(name=><optgroup key={name} label={name}><option value={`apply\u0000${name}`}>Go to</option><option value={`remove\u0000${name}`}>Remove</option></optgroup>)}</select>}{timeControls(()=>render(renderPlaces()))}</div>,host.tools)}
    <div className="research-places"><PsychogeographicMap inspectorContainer={host.inspector} toolbarContainer={host.placesHome??host.tools} repository={filteredRepository} projectId={data.reading.subject.subject_ref} tileSource={tileSource} offlineOnly={!state.livePlaces!.allowed} policy={state.livePlaces!.policy} basemapStack={state.livePlaces!.stack} onBasemapStackChange={next=>{state.livePlaces!.stack=next;scheduleLayersSave();}} onLiveSourcesAllowedChange={allowed=>{const live=state.livePlaces!;if(allowed)live.policy.optIn('tile_refresh','show live basemap sources the owner allowed in Places');else live.policy.optOut('tile_refresh');live.allowed=allowed;render(renderPlaces());}} placeFacets={nativeReading.spatial} placeAuthoring={placeAuthoring} placeTime={placeTime} daylight={PLACES_DAYLIGHT} ladder={ladderRungSummaries(referenceFrameLadder(nativeReading))} onRegisterPlaceViewRestore={restore=>{restoreViewOnMap=restore;}} onRegisterPlaceFlight={flight=>{flyOnMap=flight;}} layerFilter={filter} onLayerFilterChange={next=>{state.placeFilter={...next,window:null};scheduleLayersSave();render(renderPlaces());}} sourceAttributions={pack.manifest.sources.map(source=>`${source.name} (${source.license})`)}
     initialViewState={state.place} initialSelectedGraphNodeId={mapFocus.selected} initialFocusGraphNodeId={mapFocus.focus}
     onOpenInTimeline={facet=>{void openInTimeline(facet).catch(error=>message(error instanceof Error?error.message:String(error)));}} onOpenSource={ref=>host.inspectSubject(ref)}
     onViewStateChange={value=>{state.place=value;}} onSelectedGraphNodeIdChange={value=>{state.selectedPlace=value;render(renderPlaces());}}
     onOpenCanvasNode={ref=>{const node=data.bundle.nodes.find(node=>node.graphNodeId===ref&&node.place);if(node)host.inspectSubject(ref,{node});}}/>
     <ImageryPanel tools={host.placesHome??host.tools} toolbarContainer={host.placesHome??host.tools} images={images} offlineOnly imageTitle={image=>scene?.entities.find(entity=>entity.id===image.id)?.name??'Scene image'} resolveAsset={path=>{const value=assets.get(path);if(!value)throw new Error('Image is not bound to this native Scene');return value;}} onImport={importImagery}/>
     <PlaceTourPanel sceneOpen={!!scene} recording={tourSession().recording} draft={tourSession().record} saved={savedPlaceTours()} beats={journeyBeatsOf(nativeReading).beats} playingName={playingTour} onToggleRecording={toggleTourRecording} onAddStop={addTourStop} onRemoveStop={removeTourStopAt} onSave={saveTour} onPlaySaved={playSavedTour} onStopPlaying={stopPlayingTour} onRemoveSaved={removeSavedTour} onBind={bindTourStop}/>
     {!host.placesHome&&facets}
    </div>{host.placesHome&&createPortal(facets,host.placesHome)}</>;
   };
   if(sharedTime)followSharedTime(()=>render(renderPlaces()));
   render(renderPlaces());
   if(placeNote)message(placeNote);
  }catch(error){if(epoch!==generation||destroyed)return;message(error instanceof Error?error.message:String(error));body.replaceChildren();}
 }
 return {
  async open(selected:ResearchInstrument,focusRef?:string){if(destroyed)throw new Error('Research instrument workspace is closed');lens=selected;pendingFocus=focusRef;await load(selected);},
  close(){flushPlaceLayers();++epoch;lens=null;unmount();mount.hidden=true;},
  async refresh(){
   if(materialInFlight){deferredRefresh=true;return;}
   if(!lens)return;
   // An acknowledged edit or native focus on the SAME composition and Scene
   // updates the Canvas in place: no remount, no camera reset, and the
   // person's selection is kept. Only a changed composition/Scene reloads.
   if(lens==='m1'&&currentKey){
    const view=host.nativeView(),sceneId=host.sceneId();
    if(view&&view.bindings[sceneId]){
     let canvas:InstrumentCanvas|undefined;try{canvas=nativeCanvas(view,sceneId);}catch{canvas=undefined;}
     if(canvas&&canvas.key===currentKey){const state=stateFor(canvas.key);if(state.selectedNode&&!canvas.nodes.some(node=>node.id===state.selectedNode))state.selectedNode=null;render(canvasNode(canvas,state,epoch));return;}
    }
   }
   await load(lens);
  },
  destroy(){flushPlaceLayers();++epoch;offSharedTimeNudges?.();offSharedTimeNudges=null;lens=null;destroyed=true;unmount();mount.remove();status.remove();views.clear();window.removeEventListener('keydown',onWindowKeydown);window.removeEventListener('keydown',onZoomKeydown);window.removeEventListener('keydown',onPresentStartKey);readoutRoot.unmount();readoutHost.remove();modifiers.dispose();},
  active(){return lens;},
 };
}
