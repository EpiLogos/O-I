import {createContext, useContext, useEffect, useRef, useState, type PointerEvent} from 'react';
import {sameEditorBasis, type Entity, type EntityLayer, type NativeEditorChange, type NativeEditorReading, type NativeEditorReply, type NativeEditorRequest, type NativeSequenceSettings, type SequenceStep} from '../../../../expressions-boundary/src/editor';
import {applyEasing} from '../../../../../desktop/cradle/expressions-app/src/engine/fieldModel';
import {sourceVisual} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/sourcePreview';
import {stateSource} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/sourceState';
import {FONT_OPTIONS, CUSTOM_SENTINEL, resolveFontOption} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/fontCatalog';
import {WORLD_SCALE} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeParameters';
import {blueprintMember} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/blueprintGeometry';
import {readNativeGlyphTiming} from '../shell/nativeContent';
import {useNativeInputRetention} from '../continuity/nativeInputContext';
import {glyphInputMaterial} from '../continuity/glyphInputMaterial';
import {privateNativeInputChanges} from '../continuity/nativeInputRecovery';
import {nativeInputTargetKey,type NativeInputMaterial,type PrivateNativeInputReceipt} from '../continuity/nativeInputs';
import {planGlyphRefit} from './nativeGlyphRefit';
import {FoldStatePicker} from './FoldStatePicker';
import {ASCII_FONT_LABEL, GLYPH_OPEN_STUDIO_EVENT, IMAGE_MODES, SOURCE_RANGES, asciiOptionBuild, checkAsciiFont, checkSourceNumber, imageOptionBuild, reorderLayers, sourceDefault, sourceKindBuild, sourceKindOf, type GlyphSourceKind, type ImageSource, type SourceBuild} from './nativeGlyphSource';
import './GlyphSequenceEditor.css';

export interface RetainedGlyphInput {label:string;value:string;commit:()=>Promise<boolean>;numericCommit?:(value:number)=>void|Promise<boolean>;textCommit?:(value:string)=>Promise<boolean>;materialFactory?:(text:string)=>NativeInputMaterial;inputReceipt?:PrivateNativeInputReceipt}
const submissions = new WeakMap<RetainedGlyphInput, Promise<boolean>>();
/** Enter, blur and the retained-draft action share one gesture receipt. A
 * refused acknowledgement releases this exact draft for an explicit retry. */
function submitInput(entry: RetainedGlyphInput,receive?:()=>Promise<boolean>): Promise<boolean> {
  const pending = submissions.get(entry);
  if (pending) return pending;
  const submission = Promise.resolve().then(receive??entry.commit);
  submissions.set(entry, submission);
  void submission.then(() => submissions.delete(entry), () => submissions.delete(entry));
  return submission;
}
interface Props {reading: NativeEditorReading | null; request: (request: NativeEditorRequest) => Promise<NativeEditorReply>; compact?: boolean; onExpand?: () => void; drafts?: Map<string,RetainedGlyphInput>; isPresented?:()=>boolean}
/** Same-instance owner selection wins; a range survives only while it contains
 * the selected stable state. Runtime frames do not change that selection. */
export function reconcileGlyphSelection(selected:readonly string[],entity:Entity|undefined,stepId:string|null):string[] {
  if(!entity)return [];
  const valid=selected.filter(id=>entity.sequence.steps.some(step=>step.id===id));
  if(!stepId||!entity.sequence.steps.some(step=>step.id===stepId))return valid;
  return valid.includes(stepId)?valid:[stepId];
}
export function currentGlyphReply(captured:NativeEditorReading,current:NativeEditorReading|null,reply:NativeEditorReply,entityId:string,stepId:string|null):boolean {
  if(!current||current.basis.expression_ref!==captured.basis.expression_ref||current.basis.scene_ref!==captured.basis.scene_ref)return false;
  if(!current.selection.entity_ids.includes(entityId)||stepId!==null&&current.selection.step_id!==stepId)return false;
  if(reply.ok)return reply.reading.basis.expression_ref===captured.basis.expression_ref&&reply.reading.basis.scene_ref===captured.basis.scene_ref
    &&(sameEditorBasis(captured.basis,current.basis)||sameEditorBasis(reply.reading.basis,current.basis))&&reply.reading.selection.entity_ids.includes(entityId)
    &&(stepId===null||reply.reading.selection.step_id===stepId);
  return sameEditorBasis(captured.basis,current.basis);
}
const Drafts=createContext<{scope:string;values:Map<string,RetainedGlyphInput>;changed:()=>void;capture:(label:string,identity:string,initial:string)=>(text:string)=>NativeInputMaterial;retain:(entry:RetainedGlyphInput,previous?:RetainedGlyphInput)=>void;submit:(entry:RetainedGlyphInput)=>Promise<boolean>;discard:(entry?:RetainedGlyphInput)=>void}|null>(null);
function ExactValue({label,value,onCommit,min,max,step=.01,disabled=false,identity=label}: {label:string;value:number;onCommit:(value:number)=>void|Promise<boolean>;min?:number;max?:number;step?:number;disabled?:boolean;identity?:string}) {
  const context=useContext(Drafts),id=`${context?.scope}:${identity}`;
  const [draft,setDraft] = useState(context?.values.get(id)?.value??String(value));
  useEffect(() => {setDraft(context?.values.get(id)?.value??String(value))},[id,value,context?.values]);
  const commit = async () => {const entry=context?.values.get(id);if(!entry||!context)return;const accepted=await context.submit(entry);if(accepted&&context.values.get(id)===entry){context.values.delete(id);context.changed()}};
  return <label className="glyph-exact"><span>{label}</span><input aria-label={label} type="text" inputMode="decimal" value={draft} data-min={min} data-max={max} data-step={step} disabled={disabled}
    onChange={event=>{const text=event.target.value;setDraft(text);const previous=context?.values.get(id),captured=previous?.numericCommit??onCommit;const entry:RetainedGlyphInput={value:text,label,numericCommit:captured,materialFactory:previous?.materialFactory??context?.capture(label,identity,String(value)),commit:async()=>{const v=Number(text);if(!text.trim()||!Number.isFinite(v)||(min!==undefined&&v<min)||(max!==undefined&&v>max))return false;return await captured(v)!==false}};context?.retain(entry,previous);context?.values.set(id,entry);context?.changed()}} onBlur={()=>void commit()} onKeyDown={event=>{if(event.key==='Enter')void commit();if(event.key==='Escape'){context?.discard(context.values.get(id));context?.values.delete(id);context?.changed();setDraft(String(value));event.currentTarget.blur()}}}/></label>;
}
function DraftText({label,value,disabled,onCommit,multiline=false,inputType='text'}: {label:string;value:string;disabled:boolean;onCommit:(text:string)=>Promise<boolean>;multiline?:boolean;inputType?:'text'|'color'}) {
  const context=useContext(Drafts),id=`${context?.scope}:${label}`;
  const [draft,setDraft]=useState(context?.values.get(id)?.value??value);
  useEffect(()=>{setDraft(context?.values.get(id)?.value??value)},[id,value,context?.values]);
  const props={"aria-label":label,value:draft,disabled,onChange:(event:{target:{value:string}})=>{const text=event.target.value;setDraft(text);const previous=context?.values.get(id),captured=previous?.textCommit??onCommit;const entry:RetainedGlyphInput={value:text,label,textCommit:captured,materialFactory:previous?.materialFactory??context?.capture(label,label,value),commit:()=>captured(text)};context?.retain(entry,previous);context?.values.set(id,entry);context?.changed()},onBlur:()=>{const entry=context?.values.get(id);if(entry&&context)void context.submit(entry).then(ok=>{if(ok&&context.values.get(id)===entry){context.values.delete(id);context.changed()}})},onKeyDown:(event:{key:string})=>{if(event.key==='Escape'){context?.discard(context.values.get(id));context?.values.delete(id);context?.changed();setDraft(value)}}};
  return multiline?<textarea {...props}/>:<input type={inputType} {...props}/>;
}
type FieldCheck=(text:string)=>{ok:true;value:string|number}|{ok:false;message:string};
/** One exact source option per commit: Enter or blur applies, Escape reverts, a range applies on release.
 * Bounds refuse locally before any change; owner refusals reach the editor's role=alert line. */
function SourceField({label,value,disabled,check,onCommit,range}:{label:string;value:string|number;disabled:boolean;check:FieldCheck;onCommit:(value:string|number)=>Promise<boolean>;range?:{readonly min:number;readonly max:number;readonly step:number}}) {
  const shown=String(value),[draft,setDraft]=useState(shown),[slide,setSlide]=useState<number|null>(null),[alert,setAlert]=useState<string|null>(null);
  const draftRef=useRef(shown),sent=useRef<string|null>(null),busy=useRef(false),sliding=useRef<number|null>(null);
  useEffect(()=>{draftRef.current=shown;setDraft(shown);setSlide(null);setAlert(null);sent.current=null;sliding.current=null},[shown]);
  const send=async(raw:string|number,fromBlur:boolean):Promise<boolean>=>{
    if(busy.current)return false;
    const checked:{ok:true;value:string|number}|{ok:false;message:string}=typeof raw==='number'?{ok:true,value:raw}:check(raw);
    if(!checked.ok){setAlert(checked.message);return false}
    if(checked.value===value)return true;
    if(fromBlur&&String(checked.value)===sent.current)return true;
    setAlert(null);sent.current=String(checked.value);busy.current=true;
    try{return await onCommit(checked.value)}finally{busy.current=false}
  };
  const release=async()=>{const v=sliding.current;sliding.current=null;if(v===null)return;const ok=await send(v,false);if(!ok||v===Number(value))setSlide(null)};
  return <div className="glyph-field"><label className="glyph-option"><span>{label}</span>
    {range&&<input type="range" aria-label={`${label} slider`} min={range.min} max={range.max} step={range.step} disabled={disabled} value={slide??Number(value)}
      onChange={event=>{const v=Number(event.target.value);sliding.current=v;draftRef.current=String(v);setSlide(v);setDraft(String(v))}}
      onPointerUp={()=>void release()} onKeyUp={()=>void release()} onBlur={()=>void release()}
      onKeyDown={event=>{if(event.key==='Escape'){sliding.current=null;draftRef.current=shown;setSlide(null);setDraft(shown)}}}/>}
    <input type="text" inputMode={range?'decimal':undefined} aria-label={label} value={draft} disabled={disabled}
      onChange={event=>{draftRef.current=event.target.value;setDraft(event.target.value)}}
      onBlur={()=>void send(draftRef.current,true)}
      onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void send(draftRef.current,false)}if(event.key==='Escape'){draftRef.current=shown;setDraft(shown);setAlert(null);event.currentTarget.blur()}}}/>
    {range&&<small>{range.min} to {range.max}</small>}</label>
    {alert&&<small role="alert" className="glyph-option-alert">{alert}</small>}</div>;
}
export function glyphThumbnailMaterial(step:SequenceStep,entity:Entity) {
  const layers=step.layers??entity.layers;
  return {appearance:step.objectState??entity,planes:layers?.length?layers.map(layer=>({id:layer.id,text:layer.text,shape:'text',source:layer.source,scale:layer.scale??1,z:layer.z}))
    :[{id:step.id,text:step.text,shape:step.shape,source:stateSource(entity,entity.sequence.steps.findIndex(row=>row.id===step.id)),scale:1,z:0}]};
}
function SourceThumbnail({source}: {source:NonNullable<Entity['source']>}) {
  const [preview,setPreview]=useState<string|null>(null),[fault,setFault]=useState<string|null>(null);
  const signature=JSON.stringify(source);
  useEffect(()=>{let live=true;setPreview(null);setFault(null);const payload=source.kind==='image'?source.image.dataUrl:source.ascii.text;
    const opts=source.kind==='image'?source.image:source.ascii;
    if(payload)void sourceVisual(source.kind,payload,opts,{paper:'#ffffff',ink:'#000000'}).then(result=>{if(live)setPreview(result.previewDataUrl)}).catch(error=>{if(live)setFault(error instanceof Error?error.message:String(error))});
    return()=>{live=false}},[signature]);
  // The pipeline's paper is opaque. Treat sampled paper as the SVG luminance
  // mask background so independent layers remain a union of their ink.
  const mask=useRef(`glyph-source-${crypto.randomUUID()}`);
  return preview?<g><defs><mask id={mask.current} maskUnits="userSpaceOnUse" x="-40" y="-40" width="80" height="80"><image href={preview} x="-40" y="-40" width="80" height="80" preserveAspectRatio="xMidYMid meet" style={{filter:'invert(1)'}}/></mask></defs><rect x="-40" y="-40" width="80" height="80" fill="currentColor" mask={`url(#${mask.current})`}/></g>:<text x="0" y="0" textAnchor="middle" fontSize="10"><title>{fault??'Sampling the authored source'}</title>{source.kind==='image'?'Image':'ASCII'}{fault?' unavailable':''}</text>;
}
function Thumbnail({step,entity,paper,ink,font,weight}: {step:SequenceStep;entity:Entity;paper:string;ink:string;font:string;weight:string|number}) {
  const {appearance,planes}=glyphThumbnailMaterial(step,entity),extent=Math.max(appearance.size.x,appearance.size.y,.001),tint=Math.max(0,Math.min(1,appearance.tintWeight));
  const color=`color-mix(in srgb, ${appearance.tint} ${tint*100}%, ${ink})`;
  const mark=(shape:string,text:string)=><g>{shape==='text'?<text x="50" y="55" textAnchor="middle" dominantBaseline="middle" style={{fontFamily:font,fontWeight:weight,fontSize:text.length>5?14:32}}>{text}</text>:shape==='disc'?<circle cx="50" cy="50" r="25"/>:shape==='ring'?<circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="4"/>:shape==='square'?<rect x="25" y="25" width="50" height="50"/>:shape==='triangle'?<path d="M50 20 80 75H20Z"/>:shape==='yantra'?<path d="M50 20 80 75H20Z M50 80 20 25H80Z" fill="none" stroke="currentColor" strokeWidth="2"/>:<path d="M10 50C24 16 40 16 50 50S80 84 90 50" fill="none" stroke="currentColor" strokeWidth="3"/>}</g>;
  const reach=Math.max(1,...planes.map(plane=>plane.scale))*Math.max(.001,appearance.scale??1);
  return <svg viewBox={`${-60*reach} ${-60*reach} ${120*reach} ${120*reach}`} role="img" aria-label={step.name??step.text} style={{color,background:paper}}>
    <g transform={`rotate(${appearance.rotation}) scale(${appearance.size.x/extent*(appearance.scale??1)},${appearance.size.y/extent*(appearance.scale??1)})`} fill="currentColor">
      {planes.map(plane=><g key={plane.id} data-layer-id={plane.id} data-depth={plane.z} transform={`scale(${plane.scale})`}><title>{plane.source?.kind??plane.shape} · depth {plane.z}</title>{plane.source?<SourceThumbnail source={plane.source}/>:<g transform="translate(-50,-50)">{mark(plane.shape,plane.text)}</g>}</g>)}
    </g></svg>;
}
export function GlyphSequenceEditor({reading,request,compact=false,onExpand,drafts,isPresented}:Props) {
  const inputAperture=useNativeInputRetention();
  const [selected,setSelected]=useState<string[]>([]), [fault,setFault]=useState<string|null>(null), [pending,setPending]=useState(false);
  const [customFont,setCustomFont]=useState(false);
  const [optionAlert,setOptionAlert]=useState<string|null>(null), refusal=useRef<string|null>(null);
  const [textDraft,setTextDraft]=useState<{value:string;initial:string;entity_id:string;entity_ref:string|null;step_id:string;basis:NativeEditorReading['basis'];inputReceipt?:PrivateNativeInputReceipt}|null>(null), [timingDraft,setTimingDraft]=useState<{id:string;hold:number;transition:number}|null>(null);
  /** The formation's own glyph: one retained draft, addressed to the formation it was typed for. */
  const [formationDraft,setFormationDraft]=useState<{value:string;initial:string;entity_id:string;entity_ref:string|null;basis:NativeEditorReading['basis'];inputReceipt?:PrivateNativeInputReceipt}|null>(null);
  const localDrafts=useRef(new Map<string,RetainedGlyphInput>()),draftValues=drafts??localDrafts.current;
  const lifetime=useRef({mounted:false,epoch:0}),residence=useRef<HTMLElement>(null),latest=useRef({reading,isPresented});latest.current={reading,isPresented};
  useEffect(()=>{lifetime.current.mounted=true;lifetime.current.epoch++;return()=>{lifetime.current.mounted=false;lifetime.current.epoch++}},[]);
  const target=JSON.stringify([reading?.selection.entity_ids,reading?.selection.step_id]);
  const cut=useRef({visible:isPresented?.()??true,expression:reading?.basis.expression_ref,scene:reading?.basis.scene_ref,target});
  const visible=isPresented?.()??true;
  if(cut.current.visible!==visible||cut.current.expression!==reading?.basis.expression_ref||cut.current.scene!==reading?.basis.scene_ref||cut.current.target!==target){lifetime.current.epoch++;cut.current={visible,expression:reading?.basis.expression_ref,scene:reading?.basis.scene_ref,target}}
  const tickets=useRef(0),shown=()=>lifetime.current.mounted&&(latest.current.isPresented?.()??true)&&!!residence.current?.getClientRects().length;
  const [,draftRevision]=useState(0),draftChanged=()=>{if(lifetime.current.mounted)draftRevision(value=>value+1)};
  const drag=useRef<{pointerId:number;inputId:string;epoch:number;entity_id:string;entity_ref:string|null;step:SequenceStep;region:'hold'|'transition';start:number;basis:NativeEditorReading['basis'];pixelsPerSecond:number;value:number;hold:number;transition:number;preview:{id:string;hold:number;transition:number}}|null>(null);
  const entity=reading?.scene.entities.find(e=>reading.selection.entity_ids.includes(e.id)&&e.kind==='formation');
  const active=entity?.sequence.steps.find(k=>k.id===reading?.selection.step_id)??entity?.sequence.steps.find(k=>selected.includes(k.id))??entity?.sequence.steps[0];
  const stepMembership=JSON.stringify(entity?.sequence.steps.map(step=>step.id)??[]);
  useEffect(()=>{setSelected([]);setTimingDraft(null);drag.current=null},[entity?.id,reading?.basis.scene_ref,reading?.basis.expression_ref]);
  useEffect(()=>setSelected(current=>reconcileGlyphSelection(current,entity,reading?.selection.step_id??null)),[entity?.id,reading?.basis.scene_ref,reading?.basis.expression_ref,reading?.selection.step_id,stepMembership]);
  useEffect(()=>{setPending(false);setFault(null);setOptionAlert(null)},[visible,entity?.id,reading?.basis.scene_ref,reading?.basis.expression_ref,reading?.selection.step_id]);
  useEffect(()=>setCustomFont(false),[reading?.basis.scene_ref]);
  if(!reading||!entity||!active)return <div className="glyph-empty">Select a native formation to edit its glyph clip.{draftValues.size>0&&<span> · {draftValues.size} input drafts retained</span>}</div>;
  const r=reading,e=entity,k=active, sequence=e.sequence, locked=e.locked||pending||r.standing.pending;
  const fieldLocked=pending||r.standing.pending, fontChoice=customFont?CUSTOM_SENTINEL:resolveFontOption(r.scene.engine.fontFamily).optionId;
  const settings=(values:NativeSequenceSettings)=>apply([{kind:'sequence-settings',entity_id:e.id,step_id:k.id,values}]);
  async function apply(changes:NativeEditorChange[],basis=r.basis) {
    if(!shown()||isPresented?.()===false)return false;
    const epoch=lifetime.current.epoch,ticket=++tickets.current,captured={...r,basis},timingAtStart=timingDraft;
    const current=(reply:NativeEditorReply)=>epoch===lifetime.current.epoch&&ticket===tickets.current&&shown()&&isPresented?.()!==false&&currentGlyphReply(captured,latest.current.reading,reply,e.id,k.id);
    setPending(true);setFault(null);
    try {const result=await request({operation:'apply',basis,changes});if(current(result)){if(!result.ok){refusal.current=result.error;setFault(result.error)}else if(changes.some(change=>change.kind==='step-timing'))setTimingDraft(current=>current===timingAtStart?null:current)}return result.ok&&current(result)} catch(error){const message=error instanceof Error?error.message:String(error);if(current({ok:false,error:message})){refusal.current=message;setFault(message)}return false} finally{if(epoch===lifetime.current.epoch&&ticket===tickets.current&&shown())setPending(false)}
  }
  function retainInput(entry:RetainedGlyphInput,previous?:RetainedGlyphInput) {
    if(!inputAperture||!entry.materialFactory)return;
    const material=entry.materialFactory(entry.value),key=nativeInputTargetKey(material);
    try {entry.inputReceipt=inputAperture.owner.retain(material,inputAperture.current,previous?.inputReceipt);inputAperture.failure?.(key,null);inputAperture.changed()}
    catch(cause){const error=cause instanceof Error?cause.message:String(cause);inputAperture.failure?.(key,error);setFault(`Input recovery failed · ${error}`)}
  }
  function discardInput(entry?:RetainedGlyphInput) {
    if(!inputAperture||!entry)return;
    try{if(entry.inputReceipt)inputAperture.owner.clear(entry.inputReceipt,inputAperture.current);if(entry.materialFactory)inputAperture.failure?.(nativeInputTargetKey(entry.materialFactory(entry.value)),null);inputAperture.changed()}catch(cause){setFault(cause instanceof Error?cause.message:String(cause))}
  }
  function submitCapturedInput(entry:RetainedGlyphInput):Promise<boolean> {
    if(entry.materialFactory&&inputAperture&&!entry.inputReceipt){setFault('The unfinished input has no durable acknowledgement; keep it open and retry retention before applying');return Promise.resolve(false)}
    if(!entry.inputReceipt)return submitInput(entry);
    return submitInput(entry,async()=>{
      if(!inputAperture||!inputAperture.current())return false;
      try {
        const accepted=await apply(privateNativeInputChanges(entry.inputReceipt!.copy,r,!entry.inputReceipt!.copy.target.family?.startsWith('glyph:pointer-')),entry.inputReceipt!.copy.basis);
        if(accepted)discardInput(entry);
        return accepted;
      }catch(cause){if(shown())setFault(cause instanceof Error?cause.message:String(cause));return false}
    });
  }
  function changeGlyphText(value:string) {
    const captured:NonNullable<typeof textDraft>=textDraft??{value,initial:k.text,entity_id:e.id,entity_ref:r.entityOccurrences[e.id]??null,step_id:k.id,basis:{...r.basis}};
    const next={...captured,value};
    const material:NativeInputMaterial={basis:captured.basis,target:{scope:'entity',entity_id:captured.entity_id,entity_ref:captured.entity_ref,step_id:captured.step_id,parameter:'glyph-source',family:'glyph:source',axis:null},input:{kind:'text',text:value,initial:captured.initial}};
    if(inputAperture)try {
      next.inputReceipt=inputAperture.owner.retain(material,inputAperture.current,captured.inputReceipt);
      inputAperture.failure?.(nativeInputTargetKey(material),null);
      inputAperture.changed();
    }catch(cause){const error=cause instanceof Error?cause.message:String(cause);inputAperture.failure?.(nativeInputTargetKey(material),error);setFault(`Input recovery failed · ${error}`)}
    setTextDraft(next);
  }
  function discardGlyphText() {
    if(textDraft?.inputReceipt&&inputAperture)try{inputAperture.owner.clear(textDraft.inputReceipt,inputAperture.current);inputAperture.changed()}catch(cause){setFault(cause instanceof Error?cause.message:String(cause))}
    setTextDraft(null);
  }
  async function replaceGlyphText() {
    const draft=textDraft;if(!draft)return;
    try {
      const changes=draft.inputReceipt?privateNativeInputChanges(draft.inputReceipt.copy,r):[{kind:'step-source' as const,entity_id:draft.entity_id,step_id:draft.step_id,shape:'text' as const,text:draft.value}];
      if(await apply(changes,draft.basis)) {
        if(draft.inputReceipt&&inputAperture){inputAperture.owner.clear(draft.inputReceipt,inputAperture.current);inputAperture.changed()}
        setTextDraft(current=>current===draft?null:current);
      }
    }catch(cause){if(shown())setFault(cause instanceof Error?cause.message:String(cause))}
  }
  /** Formation glyph drafts follow the state glyph's custody: the typed text is retained as private input for this formation until applied or discarded. */
  function changeFormationGlyph(value:string) {
    const captured:NonNullable<typeof formationDraft>=formationDraft??{value,initial:e.text,entity_id:e.id,entity_ref:r.entityOccurrences[e.id]??null,basis:{...r.basis}};
    const next={...captured,value};
    const material:NativeInputMaterial={basis:captured.basis,target:{scope:'entity',entity_id:captured.entity_id,entity_ref:captured.entity_ref,step_id:null,parameter:'formation-glyph',family:'glyph:formation',axis:null},input:{kind:'text',text:value,initial:captured.initial}};
    if(inputAperture)try {
      next.inputReceipt=inputAperture.owner.retain(material,inputAperture.current,captured.inputReceipt);
      inputAperture.failure?.(nativeInputTargetKey(material),null);
      inputAperture.changed();
    }catch(cause){const error=cause instanceof Error?cause.message:String(cause);inputAperture.failure?.(nativeInputTargetKey(material),error);setFault(`Input recovery failed · ${error}`)}
    setFormationDraft(next);
  }
  function discardFormationGlyph() {
    if(formationDraft?.inputReceipt&&inputAperture)try{inputAperture.owner.clear(formationDraft.inputReceipt,inputAperture.current);inputAperture.changed()}catch(cause){setFault(cause instanceof Error?cause.message:String(cause))}
    setFormationDraft(null);
  }
  /** One formation-glyph change per apply; Enter or the button sends it, Escape discards it. A refusal reaches the status line. */
  async function replaceFormationGlyph() {
    const draft=formationDraft;if(!draft||draft.entity_id!==e.id)return;
    try {
      const changes:NativeEditorChange[]=draft.inputReceipt?privateNativeInputChanges(draft.inputReceipt.copy,r):[{kind:'formation-glyph',entity_id:draft.entity_id,text:draft.value}];
      if(await apply(changes,draft.basis)) {
        if(draft.inputReceipt&&inputAperture){inputAperture.owner.clear(draft.inputReceipt,inputAperture.current);inputAperture.changed()}
        setFormationDraft(current=>current===draft?null:current);
      }
    }catch(cause){if(shown())setFault(cause instanceof Error?cause.message:String(cause))}
  }
  async function settle(operation:NativeEditorRequest,targetStep:string|null=k.id) {if(!shown()||isPresented?.()===false)return;const epoch=lifetime.current.epoch,ticket=++tickets.current;setPending(true);try{const result=await request(operation);if(epoch===lifetime.current.epoch&&ticket===tickets.current&&shown()&&isPresented?.()!==false&&currentGlyphReply(r,latest.current.reading,result,e.id,result.ok?targetStep:k.id))setFault(result.ok?null:result.error)}catch(error){const message=error instanceof Error?error.message:String(error);if(epoch===lifetime.current.epoch&&ticket===tickets.current&&shown()&&isPresented?.()!==false&&currentGlyphReply(r,latest.current.reading,{ok:false,error:message},e.id,k.id))setFault(message)}finally{if(epoch===lifetime.current.epoch&&ticket===tickets.current&&shown())setPending(false)}}
  async function history(operation:'undo'|'redo'|'save') {await settle({operation,basis:r.basis})}
  function select(id:string,range=false) {
    if(!shown()||isPresented?.()===false)return;
    if(range&&selected.length){const a=e.sequence.steps.findIndex(s=>s.id===selected[0]),b=e.sequence.steps.findIndex(s=>s.id===id);setSelected(e.sequence.steps.slice(Math.min(a,b),Math.max(a,b)+1).map(s=>s.id))}else setSelected([id]);
    void settle({operation:'select',basis:r.basis,entity_id:e.id,step_id:id},id);
  }
  function move(delta:number) {const ids=e.sequence.steps.map(s=>s.id), chosen=selected.length?selected:[k.id];if(delta<0){for(let i=1;i<ids.length;i++)if(chosen.includes(ids[i])&&!chosen.includes(ids[i-1]))[ids[i],ids[i-1]]=[ids[i-1],ids[i]]}else{for(let i=ids.length-2;i>=0;i--)if(chosen.includes(ids[i])&&!chosen.includes(ids[i+1]))[ids[i],ids[i+1]]=[ids[i+1],ids[i]]}void apply([{kind:'step-order',entity_id:e.id,step_ids:ids}])}
  const observedDwell=r.observation?.effectiveValues?.['field.morphDwell'];
  const timing=readNativeGlyphTiming(e,Number.isFinite(observedDwell)?observedDwell!:r.scene.morph.dwell);
  const selectedTiming=timing.states.find(state=>state.step_id===k.id)!;
  const total=timing.authored_duration_seconds, pixelsPerSecond=Math.min(80,Math.max(8,900/Math.max(timing.axis_duration,1)));
  const timingLocked=locked||sequence.clock==='morph';
  function startTiming(event:PointerEvent<HTMLButtonElement>,step:SequenceStep,region:'hold'|'transition') {
    if(timingLocked||drag.current||!shown()||isPresented?.()===false)return;
    const state=timing.states.find(value=>value.step_id===step.id);if(!state)return;
    const hold=state.hold_seconds,transition=state.transition_seconds,preview={id:step.id,hold,transition};
    event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={pointerId:event.pointerId,inputId:crypto.randomUUID(),epoch:lifetime.current.epoch,entity_id:e.id,entity_ref:r.entityOccurrences[e.id]??null,step,region,start:event.clientX,basis:structuredClone(r.basis),pixelsPerSecond,value:region==='hold'?hold:transition,hold,transition,preview};setTimingDraft(preview);
  }
  function retainTimingInput(d:NonNullable<typeof drag.current>) {
    const id=JSON.stringify([d.basis.expression_ref,d.basis.scene_ref,d.entity_id,d.step.id,'pointer-timing',d.region,d.inputId]);
    const entry:RetainedGlyphInput={label:`State ${d.step.id} ${d.region}`,value:String(d.value),commit:()=>apply([{kind:'step-timing',entity_id:d.entity_id,step_id:d.step.id,[d.region]:d.value}],d.basis)};
    entry.materialFactory=text=>({basis:d.basis,target:{scope:'entity',entity_id:d.entity_id,entity_ref:d.entity_ref,step_id:d.step.id,parameter:null,family:`glyph:pointer-${d.region}`,axis:null},input:{kind:'gesture',gesture:{editor:'glyph',region:d.region,text,pointer:d.pointerId,input_id:d.inputId,hold:d.hold,transition:d.transition,value:Number(text)},changes:[{kind:'step-timing',entity_id:d.entity_id,step_id:d.step.id,[d.region]:Number(text)}]}});
    retainInput(entry,draftValues.get(id));draftValues.set(id,entry);draftChanged();return {id,entry};
  }
  function updateTiming(event:PointerEvent<HTMLButtonElement>) {
    const d=drag.current;if(!d||d.pointerId!==event.pointerId||d.epoch!==lifetime.current.epoch||!shown()||isPresented?.()===false)return;
    d.value=Math.max(0,Math.min(3600,d[d.region]+(event.clientX-d.start)/d.pixelsPerSecond));
    d.preview={id:d.step.id,hold:d.region==='hold'?d.value:d.hold,transition:d.region==='transition'?d.value:d.transition};setTimingDraft(d.preview);
    if(Math.abs(d.value-d[d.region])>=1e-9)retainTimingInput(d);
  }
  function cancelTiming(event:PointerEvent<HTMLButtonElement>) {
    const d=drag.current;if(!d||d.pointerId!==event.pointerId)return;drag.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    setTimingDraft(current=>current===d.preview?null:current);
  }
  function endTiming(event:PointerEvent<HTMLButtonElement>) {
    const d=drag.current;if(!d||d.pointerId!==event.pointerId)return;drag.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(Math.abs(d.value-d[d.region])<1e-9){const id=JSON.stringify([d.basis.expression_ref,d.basis.scene_ref,d.entity_id,d.step.id,'pointer-timing',d.region,d.inputId]);discardInput(draftValues.get(id));draftValues.delete(id);draftChanged();setTimingDraft(current=>current===d.preview?null:current);return;}
    const {id,entry}=retainTimingInput(d);
    if(d.epoch===lifetime.current.epoch&&shown()&&isPresented?.()!==false)void submitCapturedInput(entry).then(ok=>{if(ok&&draftValues.get(id)===entry){draftValues.delete(id);draftChanged()}});
  }
  const progress=r.observation?.sequences?.find(s=>s.entityId===e.id);
  const curve=Array.from({length:65},(_,i)=>`${i? 'L':'M'}${i*2},${62-applyEasing(i/64,sequence.easing??'smoothstep')*60}`).join(' ');
  const editOverrides=(patch:Partial<NonNullable<SequenceStep['objectState']>>)=>k.objectState?apply([{kind:'step-overrides',entity_id:e.id,step_id:k.id,operation:'capture',values:{...k.objectState,...patch}}]):Promise.resolve(false);
  const layers=k.layers??e.layers??[];
  /** Why the formation's own glyph cannot change now; null when it can. The native validator states the same reasons. */
  const formationBlocked=e.locked?'Unlock this formation before changing its shape.':blueprintMember(r.scene,e.id)?'Release the blueprint before changing one of its members.':null;
  const ownFormationDraft=formationDraft?.entity_id===e.id?formationDraft:null;
  const src=k.source, sourceKind=sourceKindOf(src), sourceLoaded=src?.kind==='image'&&!!src.image.dataUrl, autoFit=r.scene.engine.autoFitSizes!==false;
  const refit=planGlyphRefit(e,{fontFamily:r.scene.engine.fontFamily,fontWeight:r.scene.engine.fontWeight});
  /** One step-source per commit. A refusal names its reason in the editor's role=alert line. */
  const commitSource=async(built:SourceBuild):Promise<boolean>=>{if(!built.ok){setOptionAlert(built.message);return false}setOptionAlert(null);refusal.current=null;const ok=await apply([built.change]);if(!ok)setOptionAlert(refusal.current??'Not applied · the native reading changed; retry');return ok};
  const openStudioForSource=()=>{window.dispatchEvent(new CustomEvent(GLYPH_OPEN_STUDIO_EVENT,{detail:{section:'formations'}}))};
  const editLayer=(id:string,patch:Partial<EntityLayer>)=>apply([{kind:'step-layers',entity_id:e.id,step_id:k.id,layers:layers.map(l=>l.id===id?{...l,...patch}:l)}]);
  /** One step-layers change carries the whole new order; a layer already at the edge sends nothing. */
  const moveLayer=(id:string,delta:-1|1)=>{const next=reorderLayers(layers,id,delta);if(next)void apply([{kind:'step-layers',entity_id:e.id,step_id:k.id,layers:next}])};
  return <Drafts.Provider value={{scope:`${r.basis.expression_ref}:${r.basis.scene_ref}:${e.id}:${k.id}`,values:draftValues,changed:draftChanged,capture:(label,identity,initial)=>text=>glyphInputMaterial(r,e,k,label,identity,text,initial),retain:retainInput,submit:submitCapturedInput,discard:discardInput}}><section ref={residence} className={`glyph-editor${compact?' compact':''}`} aria-label="Glyph Sequence editor" data-entity-id={e.id}>
    <header className="glyph-head"><button aria-label="Glyph sequence enabled" aria-pressed={sequence.enabled} disabled={locked} onClick={()=>settings({enabled:!sequence.enabled,manual:false})}>●</button><strong>Glyph Sequence</strong><span>{e.name}</span>
      {compact&&<button onClick={onExpand} aria-label="Expand glyph clip">↗</button>}
      <button disabled={!r.history.canUndo||locked} onClick={()=>history('undo')} aria-label="Undo glyph edit">↶</button><button disabled={!r.history.canRedo||locked} onClick={()=>history('redo')} aria-label="Redo glyph edit">↷</button><button disabled={locked} onClick={()=>history('save')}>Save</button>
    </header>
    <fieldset className="glyph-field-font"><legend>Field · glyph font</legend><label>Family<select aria-label="Field font family" value={fontChoice} disabled={fieldLocked} onChange={event=>{const option=FONT_OPTIONS.find(value=>value.id===event.target.value);setCustomFont(!option);if(option)void apply([{kind:'field-font',values:{fontFamily:option.stack}}])}}>{FONT_OPTIONS.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}<option value={CUSTOM_SENTINEL}>Custom stack</option></select></label>
      <label>Weight<select aria-label="Field font weight" value={String(r.scene.engine.fontWeight??900)} disabled={fieldLocked} onChange={event=>void apply([{kind:'field-font',values:{fontWeight:Number(event.target.value)}}])}>{!['400','600','700','900'].includes(String(r.scene.engine.fontWeight??900))&&<option value={String(r.scene.engine.fontWeight)}>{r.scene.engine.fontWeight} · retained</option>}<option value="400">Regular · 400</option><option value="600">Semibold · 600</option><option value="700">Bold · 700</option><option value="900">Heavy · 900</option></select></label>
      {fontChoice===CUSTOM_SENTINEL&&<label className="glyph-custom-font">Custom font stack<DraftText label="Field custom font stack" value={r.scene.engine.fontFamily??''} disabled={fieldLocked} onCommit={fontFamily=>apply([{kind:'field-font',values:{fontFamily}}])}/></label>}<span>All Field glyphs · installed font stacks · {r.scene.engine.autoFitSizes===false?'authored boxes retained':'auto-fit unlocked text boxes'}</span>
    </fieldset>
    <div className="glyph-top-controls"><label>Compose<select aria-label="Sequence operation" value={sequence.enabled?'play':sequence.manual?'manual':'hold'} disabled={locked} onChange={event=>settings({enabled:event.target.value==='play',manual:event.target.value==='manual'})}><option value="hold">Hold state</option><option value="manual">Manual blend</option><option value="play">Play sequence</option></select></label>
      <label>Clock<select aria-label="Sequence clock" value={sequence.clock} disabled={locked} onChange={event=>settings({clock:event.target.value as 'seconds'|'morph'})}><option value="seconds">Seconds</option><option value="morph">Morph cycles</option></select></label>
      <label>Order<select aria-label="Sequence order" value={sequence.order??'loop'} disabled={locked} onChange={event=>settings({order:event.target.value as 'loop'|'pingpong'|'random'})}><option value="loop">Loop</option><option value="pingpong">Ping-pong</option><option value="random">Deterministic random</option></select></label>
      <ExactValue label="Rate" value={sequence.rateMul??1} min={-100} max={100} disabled={locked} onCommit={rateMul=>settings({rateMul})}/><ExactValue label="Phase · cycles" value={sequence.phaseOffset??0} min={-1000} max={1000} disabled={locked} onCommit={phaseOffset=>settings({phaseOffset})}/>
      {sequence.manual&&<ExactValue label="Manual blend · cycles" value={r.scene.morph.thetaOffset} min={-1000} max={1000} disabled={locked} onCommit={value=>apply([{kind:'parameter',target:'field.thetaOffset',value}])}/>}
      {sequence.clock==='morph'&&<ExactValue label="Field dwell · ratio" value={r.scene.morph.dwell} min={0} max={1} disabled={locked} onCommit={value=>apply([{kind:'parameter',target:'field.morphDwell',value}])}/>}
      <span className="glyph-runtime">{sequence.clock==='morph'?`${timing.axis_duration} morph cycles · ${total.toFixed(2)} s stored · effective dwell ${(timing.states[0]?.axis_hold??0).toFixed(2)}`:`${total.toFixed(2)} s authored`}{progress?` · state ${progress.linkIndex+1} · ${(progress.progress*100).toFixed(0)}%`:''}</span>
    </div>
    <div className="glyph-formation-base">
      <label className="glyph-formation-glyph"><span>Formation glyph</span><input aria-label="Formation glyph" value={ownFormationDraft?.value??e.text} disabled={locked||formationBlocked!==null||(formationDraft!==null&&!ownFormationDraft)} title={formationBlocked??undefined}
        onChange={event=>changeFormationGlyph(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void replaceFormationGlyph()}if(event.key==='Escape')discardFormationGlyph()}}/></label>
      <button disabled={locked||formationBlocked!==null||!ownFormationDraft} title={formationBlocked??(ownFormationDraft?undefined:'Type a new formation glyph first')} onClick={()=>void replaceFormationGlyph()}>Set formation glyph</button>
      {formationBlocked?<small role="note">{formationBlocked}</small>:formationDraft&&!ownFormationDraft&&<small role="note">A retained formation glyph draft belongs to another formation; select it to apply or discard.</small>}
    </div>
    <div className="glyph-timeline" role="listbox" aria-label="Glyph states" aria-multiselectable="true" onKeyDown={event=>{if(event.key==='Delete'&&!locked){event.preventDefault();void apply([{kind:'step-remove',entity_id:e.id,step_ids:selected.length?selected:[k.id]}])}if(event.altKey&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();move(event.key==='ArrowLeft'?-1:1)}}}>
      {sequence.steps.map((step,index)=>{const state=timing.states[index],hold=timingDraft?.id===step.id?timingDraft.hold:state.axis_hold,transition=timingDraft?.id===step.id?timingDraft.transition:state.axis_transition,duration=hold+transition;return <div key={step.id} className={`glyph-block${(selected.length?selected.includes(step.id):k.id===step.id)?' selected':''}${progress?.linkIndex===index?' observed':''}`} role="option" aria-label={`${step.name??step.text}: hold ${hold}, transition ${transition} ${sequence.clock==='morph'?'morph cycles':'seconds'}${duration===0?' · zero duration · native minimum period 0.05 seconds':''}`} title={duration===0?'Zero authored duration · native minimum period 0.05 seconds':undefined} aria-selected={selected.length?selected.includes(step.id):k.id===step.id} tabIndex={0} style={{width:duration===0?2:duration*pixelsPerSecond,minWidth:0}}
        onClick={event=>select(step.id,event.shiftKey)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(step.id,event.shiftKey)}}} draggable={!locked}
        onDragStart={event=>{event.dataTransfer.setData('application/x-oi-glyph-step',JSON.stringify({entity:e.id,id:step.id,basis:r.basis}));event.dataTransfer.effectAllowed='move'}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();try{const source=JSON.parse(event.dataTransfer.getData('application/x-oi-glyph-step'));if(source.entity!==e.id||source.id===step.id)return;const ids=sequence.steps.map(s=>s.id).filter(id=>id!==source.id);ids.splice(ids.indexOf(step.id),0,source.id);void apply([{kind:'step-order',entity_id:e.id,step_ids:ids}],source.basis)}catch{setFault('This drop is not a glyph state')}}}>
        <div className="glyph-hold" style={{flex:hold,minWidth:0}}><Thumbnail step={step} entity={e} paper={r.scene.field.background} ink={r.scene.field.palette[0]} font={r.scene.engine.fontFamily??'sans-serif'} weight={r.scene.engine.fontWeight??900}/><small>{index+1} · {step.name??(step.source?.kind==='image'?step.source.image.name:step.text)}{step.objectState?' ●':''}</small></div>
        <button className="glyph-time-handle hold" aria-label={`Resize state ${index+1} hold`} title={sequence.clock==='morph'?'Morph hold follows the native Field dwell':undefined} style={{position:'absolute',left:`${duration?hold/duration*100:0}%`,top:0,bottom:0,transform:'translateX(-50%)',zIndex:1}} disabled={timingLocked} onClick={event=>event.stopPropagation()} onPointerDown={event=>startTiming(event,step,'hold')} onPointerMove={updateTiming} onPointerUp={endTiming} onPointerCancel={cancelTiming} onLostPointerCapture={cancelTiming} onKeyDown={event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();void apply([{kind:'step-timing',entity_id:e.id,step_id:step.id,hold:Math.max(0,state.hold_seconds+(event.key==='ArrowRight'?.05:-.05))}])}}}/>
        <div className="glyph-transition" style={{flex:transition,minWidth:0}}><svg viewBox="0 0 128 64" preserveAspectRatio="none" aria-label={`${sequence.easing??'smoothstep'} transition`}><path d={curve}/></svg><small>{hold.toFixed(2)} + {transition.toFixed(2)} {sequence.clock==='morph'?'cycles':'s'}</small></div>
        <button className="glyph-time-handle outgoing" aria-label={`Resize state ${index+1} transition`} title={sequence.clock==='morph'?'Morph transition fills the rest of the native Field cycle':undefined} style={{position:'absolute',right:0,top:0,bottom:0}} disabled={timingLocked} onClick={event=>event.stopPropagation()} onPointerDown={event=>startTiming(event,step,'transition')} onPointerMove={updateTiming} onPointerUp={endTiming} onPointerCancel={cancelTiming} onLostPointerCapture={cancelTiming} onKeyDown={event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();void apply([{kind:'step-timing',entity_id:e.id,step_id:step.id,transition:Math.max(0,state.transition_seconds+(event.key==='ArrowRight'?.05:-.05))}])}}}/>
      </div>})}
    </div>
    <div className="glyph-actions"><button disabled={locked||sequence.steps.length>=32} onClick={()=>apply([{kind:'step-insert',entity_id:e.id,after_step_id:k.id,text:e.text}])}>＋ State</button><button disabled={locked||sequence.steps.length>=32} title="A new state with the app's default ASCII drawing" onClick={()=>apply([{kind:'step-insert',entity_id:e.id,after_step_id:k.id,text:e.text,source:sourceDefault('ascii')}])}>＋ ASCII state</button><button disabled={locked||sequence.steps.length>=32} title="A new image state; choose its file in the Studio" onClick={()=>apply([{kind:'step-insert',entity_id:e.id,after_step_id:k.id,text:e.text,source:sourceDefault('image')}])}>＋ Image state</button><button disabled={locked||sequence.steps.length>=32} onClick={()=>apply([{kind:'step-duplicate',entity_id:e.id,step_id:k.id}])}>Duplicate</button><button disabled={locked} onClick={()=>move(-1)}>←</button><button disabled={locked} onClick={()=>move(1)}>→</button><button disabled={locked||sequence.steps.length<=1} onClick={()=>apply([{kind:'step-remove',entity_id:e.id,step_ids:selected.length?selected:[k.id]}])}>Remove</button><span title={k.id}>State {sequence.steps.indexOf(k)+1}</span><ExactValue label="Hold · s" value={selectedTiming.hold_seconds} min={0} max={3600} disabled={timingLocked} onCommit={hold=>apply([{kind:'step-timing',entity_id:e.id,step_id:k.id,hold}])}/><ExactValue label="Transition · s" value={selectedTiming.transition_seconds} min={0} max={3600} disabled={timingLocked} onCommit={transition=>apply([{kind:'step-timing',entity_id:e.id,step_id:k.id,transition}])}/></div>
    <FoldStatePicker reading={r} request={request} entityId={e.id} stepId={k.id} stepIndex={sequence.steps.indexOf(k)} disabled={locked} isPresented={isPresented}/>
    <div className="glyph-refit"><label className="glyph-switch"><input type="checkbox" role="switch" aria-label="Refit state sizes" checked={autoFit} disabled={fieldLocked} onChange={event=>void apply([{kind:'panel-setting',key:'autoFitSizes',value:event.target.checked}])}/>Refit state sizes</label>
      <small>Auto-fit · refits state sizes when the font or shapes change</small>
      <button disabled={locked||refit.blocked!==null||refit.changes.length===0} aria-label="Refit all states to glyphs" title={refit.blocked??undefined} onClick={()=>void apply(refit.changes)}>Refit all states</button>
      {refit.blocked?<p className="glyph-disclosure" role="note">{refit.blocked}</p>:refit.changes.length===0&&<p className="glyph-disclosure" role="note">Every text state already fits its glyph.</p>}
      <p className="glyph-disclosure" role="note">Held target · read-only here: its base geometry has no boundary write path yet. Edit the states to change it.</p></div>
    {!compact&&<div className="glyph-detail-grid"><div className="glyph-source"><label>Shape<select aria-label="State shape" value={k.shape} disabled={locked} onChange={event=>apply([{kind:'step-source',entity_id:e.id,step_id:k.id,shape:event.target.value as SequenceStep['shape'],text:k.text}])}>{['text','ring','disc','square','triangle','yantra','cymatic'].map(shape=><option key={shape}>{shape}</option>)}</select></label>
      <label>Build this state from<select aria-label="Build this state from" value={sourceKind} disabled={locked} onChange={event=>void commitSource(sourceKindBuild(e,k,event.target.value as GlyphSourceKind))}><option value="none">Glyph / geometry</option><option value="image">Image</option><option value="ascii">ASCII drawing</option></select></label>
      <label>Glyph / word<textarea aria-label="State glyph content" disabled={locked} value={textDraft?.value??k.text} onChange={event=>changeGlyphText(event.target.value)} onKeyDown={event=>{if(event.key==='Escape')discardGlyphText()}}/></label><button disabled={locked||textDraft===null} title={textDraft?`Draft for ${textDraft.step_id}`:undefined} onClick={()=>void replaceGlyphText()}>Replace glyph</button>
      {textDraft&&textDraft.step_id!==k.id&&<span>Retained draft · {textDraft.step_id}</span>}
      {k.source?.kind==='ascii'&&<label>ASCII<DraftText label="ASCII drawing" value={k.source.ascii.text} disabled={locked} multiline onCommit={text=>k.source?.kind==='ascii'?apply([{kind:'step-source',entity_id:e.id,step_id:k.id,shape:k.shape,source:{kind:'ascii',ascii:{...k.source.ascii,text}}}]):Promise.resolve(false)}/></label>}
      {src?.kind==='ascii'&&<div className="glyph-options" aria-label="ASCII source options">
        <SourceField key={`${k.id}:font`} label={ASCII_FONT_LABEL} value={src.ascii.fontFamily??'monospace'} disabled={locked} check={checkAsciiFont} onCommit={value=>commitSource(asciiOptionBuild(e,k,{fontFamily:String(value)}))}/>
        <SourceField key={`${k.id}:size`} label={SOURCE_RANGES.fontSize.label} value={src.ascii.fontSize??32} disabled={locked} range={SOURCE_RANGES.fontSize} check={text=>checkSourceNumber('fontSize',text)} onCommit={value=>commitSource(asciiOptionBuild(e,k,{fontSize:Number(value)}))}/>
        <label className="glyph-toggle"><input type="checkbox" aria-label="Sample negative space" checked={!!src.ascii.invert} disabled={locked} onChange={event=>void commitSource(asciiOptionBuild(e,k,{invert:event.target.checked}))}/>Sample negative space</label>
      </div>}
      {src?.kind==='image'&&<div className="glyph-options" aria-label="Image source options">
        <span>{src.image.name??'Image'} · {src.image.mode}</span>
        <p className="glyph-disclosure">Choose an image file in the Studio. {sourceLoaded?'The options below apply to the loaded image.':'No image is loaded yet, so its options are held.'} <button type="button" onClick={openStudioForSource}>Open in Studio</button></p>
        <label>Read as<select aria-label="Read as" value={src.image.mode} disabled={locked||!sourceLoaded} onChange={event=>void commitSource(imageOptionBuild(e,k,{mode:event.target.value as ImageSource['mode']}))}>{IMAGE_MODES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
        <SourceField key={`${k.id}:threshold`} label={SOURCE_RANGES.threshold.label} value={src.image.threshold} disabled={locked||!sourceLoaded} range={SOURCE_RANGES.threshold} check={text=>checkSourceNumber('threshold',text)} onCommit={value=>commitSource(imageOptionBuild(e,k,{threshold:Number(value)}))}/>
        <SourceField key={`${k.id}:scale`} label={SOURCE_RANGES.scale.label} value={src.image.scale} disabled={locked||!sourceLoaded} range={SOURCE_RANGES.scale} check={text=>checkSourceNumber('scale',text)} onCommit={value=>commitSource(imageOptionBuild(e,k,{scale:Number(value)}))}/>
        <label className="glyph-toggle"><input type="checkbox" aria-label="Force dark ink on light paper" checked={!!src.image.invert} disabled={locked||!sourceLoaded} onChange={event=>void commitSource(imageOptionBuild(e,k,{invert:event.target.checked}))}/>Force dark ink on light paper</label>
      </div>}
      <p className="glyph-option-alert" role="alert">{optionAlert}</p>
      {src&&<p className="glyph-disclosure" role="note">Option values apply on Enter or blur and revert on Escape; a range applies on release. They are not retained as private input yet.</p>}
      <button disabled={locked} onClick={()=>settle({operation:'open',basis:r.basis,entity_id:e.id,step_id:k.id,editor:'source'})}>Image / ASCII source</button>
    </div><div className="glyph-curve"><label>Easing<select aria-label="Transition easing" value={sequence.easing??'smoothstep'} disabled={locked} onChange={event=>settings({easing:event.target.value as Entity['sequence']['easing']})}><option value="linear">Linear geodesic</option><option value="smoothstep">Smooth</option><option value="kineticSnap">Kinetic snap</option><option value="whip">Whip</option></select></label><svg viewBox="0 0 128 64" role="img" aria-label="Actual native easing curve"><path className="glyph-curve-grid" d="M0 0V64H128 M0 32H128 M64 0V64"/><path d={curve}/></svg><ExactValue label="Impulse" value={sequence.impulse??0} min={0} max={2} disabled={locked} onCommit={impulse=>settings({impulse})}/><ExactValue label="Jitter" value={sequence.jitter??0} min={0} max={1} disabled={locked} onCommit={jitter=>settings({jitter})}/></div>
      <div className="glyph-state-body"><strong>State body</strong><button disabled={locked} onClick={()=>apply([{kind:'step-overrides',entity_id:e.id,step_id:k.id,operation:k.objectState?'release':'capture'}])}>{k.objectState?'Release overrides':'Capture body overrides'}</button>
        {k.objectState&&<><ExactValue label="Width" value={k.objectState.size.x} min={.001} max={100} disabled={locked} onCommit={x=>editOverrides({size:{...k.objectState!.size,x}})}/><ExactValue label="Height" value={k.objectState.size.y} min={.001} max={100} disabled={locked} onCommit={y=>editOverrides({size:{...k.objectState!.size,y}})}/><ExactValue label="Rotation · °" value={k.objectState.rotation} min={-36000} max={36000} disabled={locked} onCommit={rotation=>editOverrides({rotation})}/><ExactValue label="Scale" value={k.objectState.scale??1} min={.001} max={1000} disabled={locked} onCommit={scale=>editOverrides({scale})}/><label>Tint<DraftText label="State tint" inputType="color" value={k.objectState.tint} disabled={locked} onCommit={tint=>editOverrides({tint})}/></label><ExactValue label="Tint weight" value={k.objectState.tintWeight} min={0} max={1} disabled={locked} onCommit={tintWeight=>editOverrides({tintWeight})}/><label className="glyph-force-kind">State force kind<select aria-label="State force kind" value={k.objectState.force.kind} disabled={locked} onChange={event=>void editOverrides({force:{...k.objectState!.force,kind:event.target.value as Entity['force']['kind']}})}><option value="none">None</option><option value="attract">Attract</option><option value="repel">Repel</option><option value="vortex">Vortex</option></select></label><ExactValue label="State radius · px" value={k.objectState.force.radius*WORLD_SCALE} min={.001*WORLD_SCALE} max={125*WORLD_SCALE} step={1} disabled={locked} onCommit={radius=>editOverrides({force:{...k.objectState!.force,radius:radius/WORLD_SCALE}})}/><ExactValue label="State force" value={k.objectState.force.strength} min={-1000} max={1000} disabled={locked} onCommit={strength=>editOverrides({force:{...k.objectState!.force,strength}})}/><ExactValue label="State spin" value={k.objectState.force.spin} min={-1000} max={1000} disabled={locked} onCommit={spin=>editOverrides({force:{...k.objectState!.force,spin}})}/></>}
        <div className="glyph-position">{(['x','y','z'] as const).map(axis=><ExactValue key={axis} label={`Offset ${axis.toUpperCase()}`} value={k.position?.[axis]??0} min={-100} max={100} disabled={locked} onCommit={value=>apply([{kind:'step-position',entity_id:e.id,step_id:k.id,position:{x:k.position?.x??0,y:k.position?.y??0,z:k.position?.z??0,[axis]:value}}])}/>)}</div><button disabled={locked} onClick={()=>settle({operation:'open',basis:r.basis,entity_id:e.id,step_id:k.id,editor:'placement'})}>Place state on Stage</button><button disabled={locked||!k.position} title="Removes this state's own offset; the formation's position applies again" onClick={()=>apply([{kind:'step-position',entity_id:e.id,step_id:k.id,position:null}])}>Clear position</button>
      </div><div className="glyph-layers"><strong>Spatial layers</strong>{layers.map(layer=><div key={layer.id} role="group" aria-label={`Layer ${layer.id}`} tabIndex={0} onKeyDown={event=>{if(event.target===event.currentTarget&&event.altKey&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();moveLayer(layer.id,event.key==='ArrowUp'?-1:1)}}}><DraftText label={`Layer ${layer.id} text`} value={layer.text} disabled={locked} onCommit={text=>editLayer(layer.id,{text})}/>{layer.source?.kind==='ascii'&&<DraftText label={`Layer ${layer.id} ASCII drawing`} value={layer.source.ascii.text} disabled={locked} multiline onCommit={text=>layer.source?.kind==='ascii'?editLayer(layer.id,{source:{kind:'ascii',ascii:{...layer.source.ascii,text}}}):Promise.resolve(false)}/>} {layer.source?.kind==='image'&&<span>{layer.source.image.name??'Image layer'}</span>}<ExactValue identity={`${layer.id}:depth`} label="Depth" value={layer.z} min={-100} max={100} disabled={locked} onCommit={z=>editLayer(layer.id,{z})}/><ExactValue identity={`${layer.id}:scale`} label="Layer scale" value={layer.scale??1} min={.01} max={10} disabled={locked} onCommit={scale=>editLayer(layer.id,{scale})}/><button aria-label="Move layer up" disabled={locked||layers[0]?.id===layer.id} onClick={()=>moveLayer(layer.id,-1)}>▲</button><button aria-label="Move layer down" disabled={locked||layers[layers.length-1]?.id===layer.id} onClick={()=>moveLayer(layer.id,1)}>▼</button><button aria-label="Remove layer" disabled={locked} onClick={()=>apply([{kind:'step-layers',entity_id:e.id,step_id:k.id,layers:layers.filter(l=>l.id!==layer.id)}])}>×</button></div>)}<button disabled={locked||layers.length>=6} onClick={()=>apply([{kind:'step-layers',entity_id:e.id,step_id:k.id,layers:[...layers,{id:`layer-${crypto.randomUUID()}`,text:k.text,z:0,scale:1}]}])}>＋ Layer</button><button disabled={locked} onClick={()=>settle({operation:'open',basis:r.basis,entity_id:e.id,step_id:k.id,editor:'layers'})}>Edit layer sources</button></div>
    </div>}
    {draftValues.size>0&&<details className="glyph-retained"><summary>{draftValues.size} retained input drafts</summary>{[...draftValues].map(([id,entry])=><div key={id} title={id}><span>{entry.label} · {entry.value}</span><button disabled={entry.label==='Field custom font stack'?fieldLocked:locked} onClick={async()=>{if(await submitCapturedInput(entry)&&draftValues.get(id)===entry){draftValues.delete(id);draftChanged()}}}>Submit captured draft</button><button onClick={()=>{discardInput(entry);draftValues.delete(id);draftChanged()}}>Discard</button></div>)}</details>}
    <footer className="glyph-standing" role="status">{fault??(pending?'Awaiting native acknowledgement…':r.standing.notice??(r.standing.dirty?'Working draft':'Native reading'))}<span title={`${r.basis.expression_ref} · ${r.basis.scene_ref}`}>r{r.basis.revision} · {r.basis.authored_revision}</span></footer>
  </section></Drafts.Provider>;
}
