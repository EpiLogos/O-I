import type {SurfaceBinding} from "../surface/types";

/**
 * Desktop-side contract for QL's K9 focused instrument.
 *
 * O:I owns only presentation and the reusable point-cloud host. A registered
 * source owns every QL/Nara fact it returns: focus, Bimba resolution, clock
 * operation, Vāk performance, currentness, refusal and replay. The desktop
 * therefore never reconstructs an M state or starts a second agent/graph/
 * clock/field owner.
 */
export const FOCUSED_INSTRUMENT_CONTRACT = "ql.focused-instrument/v1";

export type InstrumentFocus = "m1"|"m2"|"m3"|"m4"|"m5";
export type OperationStanding = "applied"|"refused"|"unknown";

export interface FieldCursor {
  event_ref:string;
  subject_ref:string;
  profile_generation:number;
  field_generation:string;
  samples_elapsed:string;
}

export interface SourceQualifiedSelection {
  contract:string;
  selection_ref:string;
  coordinate_ref:string;
  source_ref:string;
  source_revision:string;
  disclosure_ref:string;
  subject_ref:string;
  field_constituent_ref?:string|null;
  assertion_refs?:string[];
}

export interface VakExpressionBinding {
  contract:string;
  source_entry_ref:string;
  source_revision:string;
  literal?:string|null;
  glyph_ref?:string|null;
  image_ref?:string|null;
  musical_performance_ref?:string|null;
  enactment_ref?:string|null;
}

export interface VakPerformanceSummary {
  performance_ref:string;
  mode:"live"|"replay";
  replay_of?:string|null;
  actor_ref:string;
  subject_ref:string;
  context_frame:string;
  musical_role:string;
  musical_mode:string;
  lens:string;
  settled:boolean;
  has_failure:boolean;
  has_interruption:boolean;
  has_late_return:boolean;
  source_refs:string[];
}

export interface FocusDisclosure {
  focus:InstrumentFocus;
  available:boolean;
  current:boolean;
  source_refs:string[];
  payload:unknown;
  standing:string;
}

export interface QualifiedNaraSource {source_ref:string;revision:string;standing_ref:string}
export interface NaraWorldContribution {basis_ref:string;source_ref:string;value:number}
export interface NaraCentreExpressionReading {
  locus_ref:string;ordinal:number;label:string;source:QualifiedNaraSource;
  m1:NaraWorldContribution;m2:NaraWorldContribution;m3:NaraWorldContribution;resonance:number;
}
export interface NaraEarthBodyExpressionReading {locus_ref:string;source:QualifiedNaraSource;frame_ref:string}
export interface NaraExpressionPortableCues {
  schema:"ql.nara-expression-portable-cues/v1";subject_ref:string;event_ref:string;profile_generation:number;
  personal_reception_generation:number;centre_locus_refs:string[];earth_body_locus_ref:string;source_refs:string[];cue_refs:string[];
}
export interface NaraExpressionSession {
  schema:"ql.nara-expression-session/v1";subject_ref:string;event_ref:string;profile_generation:number;
  personal_reception_generation:number;current:boolean;centres:NaraCentreExpressionReading[];
  earth_body:NaraEarthBodyExpressionReading;resonance_stations:{availability:"available"|"unavailable";station_refs:string[];standing:string};
  m1_reading_refs:string[];m2_reading_refs:string[];m3_reading_refs:string[];action_refs:string[];
  m1_presentation:unknown;m2_presentation:unknown;m3_presentation:unknown;
  portable:NaraExpressionPortableCues;standing:string;
}

export interface FocusedInstrumentSnapshot {
  schema:string;
  available:boolean;
  event:{event_ref:string;subject_ref:string;profile_generation:number;[key:string]:unknown};
  live_cursor:FieldCursor;
  presented_cursor:FieldCursor;
  temporal:"live"|"frozen";
  tracking:"follow"|"pinned";
  selection?:SourceQualifiedSelection|null;
  selection_standing?:"current"|"field-advanced"|"stale"|null;
  selected_target?:{identity:number;constituent:string;position:[number,number,number]}|null;
  focus:FocusDisclosure;
  clock:{presentation:{view:"assembled"}|{view:"exploded";pair?:number|null};owner_clock:unknown;field_ref:string;centre_ref:string;standing:string};
  vak_expression?:VakExpressionBinding|null;
  vak_performance?:VakPerformanceSummary|null;
  personal_current:boolean;
  nara_expression?:NaraExpressionSession|null;
  standing:string;
}

export interface BimbaNavigationItem {
  selection:SourceQualifiedSelection;
  label:string;
  face?:"bimba"|"pratibimba";
  parent_ref?:string|null;
  depth?:number;
  relation_refs?:string[];
}

export interface BimbaNavigation {
  contract:string;
  source_revision:string;
  selected_ref?:string|null;
  items:BimbaNavigationItem[];
  standing:string;
}

export type FocusedInstrumentCommand =
  | {kind:"set-focus";focus:InstrumentFocus}
  | {kind:"select-bimba";selection:SourceQualifiedSelection}
  | {kind:"clear-selection"}
  | {kind:"set-tracking";tracking:"follow"|"pinned"}
  | {kind:"freeze"}
  | {kind:"resume-live"}
  | {kind:"assemble-clock"}
  | {kind:"explode-clock";pair?:number|null}
  | {kind:"set-clock-axis";axis:number;phase:unknown}
  | {kind:"advance";frames:number;muted:boolean};

export interface FocusedInstrumentCommandResult {
  standing:OperationStanding;
  operation:string;
  error?:string|null;
  snapshot?:FocusedInstrumentSnapshot;
  owner_receipt?:unknown;
}

/** Capability passed to a QL/K8 adapter for one *existing* O:I point-cloud
 * instance. It is deliberately narrower than the renderer/field owner. */
export interface RetainedExpressionLease {
  retainedTargetPort():unknown;
  checkpointRetainedField(binding:unknown):unknown;
  restoreRetainedField(binding:unknown,checkpoint:unknown):RetainedExpressionLease;
  /** Loss is delivered immediately so the source can hold WebAudio/native
   * presentation. Restore is a distinct event; only then may it restore the
   * acknowledged GPU checkpoint and re-enter through an explicit owner read. */
  onRecoveryRequired(listener:(phase:"lost"|"restored")=>void):()=>void;
  inspect():unknown;
  pause(value?:boolean):RetainedExpressionLease;
  resume():RetainedExpressionLease;
  renderOnce():RetainedExpressionLease;
  updatePresentation(request:unknown):unknown;
}

export interface FocusedInstrumentSource {
  ref:string;
  title:string;
  read():Promise<FocusedInstrumentSnapshot>;
  readBimba():Promise<BimbaNavigation>;
  command(command:FocusedInstrumentCommand):Promise<FocusedInstrumentCommandResult>;
  subscribe?(listener:()=>void):()=>void;
  attachExpression?(lease:RetainedExpressionLease):void|(()=>void)|Promise<void|(()=>void)>;
  accompanying?:{ref:string;project:string;space:string};
}

export interface FocusedInstrumentOpenRequest {
  sourceRef:string;
  title?:string;
}

const sources=new Map<string,FocusedInstrumentSource>();
const sourceListeners=new Map<string,Set<()=>void>>();
const openListeners=new Set<(request:FocusedInstrumentOpenRequest)=>void>();

function announce(ref:string){for(const listener of sourceListeners.get(ref)??[])listener();}

export function registerFocusedInstrumentSource(source:FocusedInstrumentSource):()=>void {
  if(!source.ref.trim())throw new Error("Focused instrument source needs a stable ref");
  if(sources.has(source.ref))throw new Error(`Focused instrument source ${source.ref} is already registered`);
  sources.set(source.ref,source);announce(source.ref);
  return()=>{if(sources.get(source.ref)===source){sources.delete(source.ref);announce(source.ref);}};
}

export function focusedInstrumentSource(ref:string):FocusedInstrumentSource|undefined{return sources.get(ref);}

export function subscribeFocusedInstrumentSource(ref:string,listener:()=>void):()=>void {
  let owner:FocusedInstrumentSource|undefined=sources.get(ref);
  let ownerStop=owner?.subscribe?.(listener);
  const registry=()=>{
    const next=sources.get(ref);
    if(next!==owner){ownerStop?.();owner=next;ownerStop=owner?.subscribe?.(listener);}
    listener();
  };
  let listeners=sourceListeners.get(ref);if(!listeners){listeners=new Set();sourceListeners.set(ref,listeners);}listeners.add(registry);
  return()=>{listeners?.delete(registry);if(!listeners?.size)sourceListeners.delete(ref);ownerStop?.();};
}

export async function runFocusedInstrumentCommand(ref:string,command:FocusedInstrumentCommand):Promise<FocusedInstrumentCommandResult> {
  const source=sources.get(ref);if(!source)return {standing:"unknown",operation:command.kind,error:`Focused instrument source ${ref} is not registered`};
  const result=await source.command(command);announce(ref);return result;
}

export function requestFocusedInstrumentOpen(sourceRef:string,title?:string){
  if(!sources.has(sourceRef))throw new Error(`Focused instrument source ${sourceRef} is not registered`);
  const request={sourceRef,title};for(const listener of openListeners)listener(request);
}

export function subscribeFocusedInstrumentOpen(listener:(request:FocusedInstrumentOpenRequest)=>void):()=>void {
  openListeners.add(listener);return()=>openListeners.delete(listener);
}

export function focusedInstrumentBinding(request:FocusedInstrumentOpenRequest):SurfaceBinding {
  const source=sources.get(request.sourceRef);
  return {id:crypto.randomUUID(),kind:"instrument",ref:request.sourceRef,title:request.title??source?.title??"Epi / Nara"};
}

export function resetFocusedInstrumentSources(){sources.clear();sourceListeners.clear();openListeners.clear();}
