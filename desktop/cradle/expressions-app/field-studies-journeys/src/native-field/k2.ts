/** A reading of the K² played torus owner's own outputs (QL k2.rs), and explicit
 * caller-event authoring for its `replace-event`. No voice, shape, pitch or clock
 * is computed here: every value shown is read from the owner's sources/influence. */
export const K2_PROVIDER='ql.k2-torus-provider/v1';
export const K2_INFLUENCE='ql.expression-influence/v1';
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const requireValue=(ok:unknown,reason:string):void=>{if(!ok)throw new Error(`K² reading: ${reason}`);};
const integer=(v:unknown,min:number,max:number)=>Number.isInteger(v)&&(v as number)>=min&&(v as number)<=max;
const exact=/^(0|[1-9][0-9]{0,19})$/;

/** LensId::ALL order: L0, L0′, L1, L1′ … L5, L5′ (lens.rs). */
export const lensLabel=(lens12:number)=>`L${lens12>>1}${lens12&1?'′':''}`;
export const LENSES=Array.from({length:12},(_,i)=>({lens12:i,label:lensLabel(i)}));
export const CONTEXT_FRAMES=Array.from({length:7},(_,i)=>({context_frame:i+1,label:`CF${i+1}`}));

export interface K2Voice{index:number;frequency_hz:number;m:number;n:number;helix:string;ql_position:number;weight:number;phase_radians:number}
export type K2HarmonicSource={selection:'canonical-basis';index:number}|{selection:'selected-source-row'};
export interface K2Sky{kind:'dated'|'none';label:string;mode?:string;epoch?:string;snapshot_ref?:string}
export interface K2Acting{
 event_ref:string;subject_ref:string;sky:K2Sky;observations_unix_ms:number|null;
 m1:{revision:string;cycle:string;tick12:number;lens12:number;lens:string;context_frame:number;context:string;mode:string;basis:string};
 harmonic:{source:K2HarmonicSource;ratio:[number,number]|null};
 ratio_basis:Array<[number,number]>;
 m3:{rna:boolean;sequence:string;codon_ref:string};
 address72:number|null;voices:K2Voice[];shape_ref:string|null;
 generation:string|null;influence_m1_revision:string|null;
 material:{damping_per_second:number;strike_metres:number;audio_gain_per_metre:number;strike_on_event:boolean;metres_per_unit:number}|null;
 material_standing:string|null;
}

/** True only when the owner's own resonator names the K² provider. */
export function isK2(sources:any){return sources?.current?.m2?.resonator?.provider_ref===K2_PROVIDER;}

/** The caller event exactly as the owner re-reads it: the current coupled input
 * without the provider-owned voices (k2.rs `K2Instrument::event`). */
export function eventFromSources(sources:any){
 const input=sources?.current?.input;
 requireValue(object(input)&&object(input.m1)&&object(input.m2)&&object(input.m3),'complete current event unavailable');
 const event=structuredClone(input);event.m2.resonator=null;event.frequency_bindings=[];
 return event;
}

function voices(influence:any,sources:any):K2Voice[]{
 if(Array.isArray(influence?.voices)){
  requireValue(influence.voices.length===8,'influence must name eight voices');
  return influence.voices.map((v:any,index:number)=>{
   requireValue(Number.isFinite(v?.frequency_hz)&&v.frequency_hz>0&&integer(v.m,1,12)&&integer(v.n,1,12),'invalid voice');
   return{index,frequency_hz:v.frequency_hz,m:v.m,n:v.n,helix:String(v.helix),ql_position:Number(v.ql_position),weight:Number(v.weight),phase_radians:Number(v.phase_radians)};
  });
 }
 // Before the first influence reading: the same owner's Vimarśā reading.
 const reading=sources?.current?.m2?.vimarsha?.reading,hz=reading?.audio_octet_hz,quartet=reading?.nodal_quartet;
 if(!Array.isArray(hz)||hz.length!==8||!Array.isArray(quartet)||quartet.length!==4)return[];
 return hz.map((f:number,index:number)=>({index,frequency_hz:f,m:quartet[index%4].m,n:quartet[index%4].n,helix:String(quartet[index%4].helix),ql_position:Number(quartet[index%4].ql_position),weight:NaN,phase_radians:NaN}));
}

export function readK2(sources:any,influence:any,composed:any):K2Acting{
 const current=sources?.current,m1=current?.m1,input=current?.input;
 requireValue(isK2(sources),'owner is not the K² torus provider');
 requireValue(object(m1?.config)&&object(m1?.music)&&object(input),'M1 snapshot or event unavailable');
 const config=m1.config;
 requireValue(integer(config.tick12,0,11)&&integer(config.lens12,0,11)&&integer(config.context_frame,1,7)&&exact.test(config.revision)&&exact.test(config.cycle),'M1 configuration outside its contract');
 const hs=input.harmonic_source;
 requireValue(hs?.selection==='selected-source-row'||(hs?.selection==='canonical-basis'&&integer(hs.index,0,7)),'harmonic source unavailable');
 const ratio=current.derivation?.harmonic_ratio?.ratio;
 const basis=Array.isArray(m1.ratio_basis)?m1.ratio_basis.map((r:any)=>r?.ratio as [number,number]):[];
 const transcription=current.m3?.transcription;
 requireValue(typeof transcription?.rna==='boolean'&&typeof transcription.sequence==='string','M3 transcription unavailable');
 const sky=composed?.sky;
 const at=input.m2?.world_observations?.[0]?.observed_at_unix_ms;
 if(influence!=null)requireValue(influence.schema===K2_INFLUENCE,'influence schema mismatch');
 const material=influence?.material,geometry=influence?.geometry;
 return{
  event_ref:String(input.m1.event_ref),subject_ref:String(input.m3.subject_ref),
  sky:sky&&typeof sky==='object'
   ?{kind:'dated',mode:String(sky.mode),epoch:String(sky.epoch),snapshot_ref:String(sky.snapshot_ref),label:`${sky.mode==='current'?'Dated sky now':'Dated sky'} · ${String(sky.epoch)}`}
   :{kind:'none',label:'No dated sky requested'},
  observations_unix_ms:Number.isSafeInteger(at)?at:null,
  m1:{revision:config.revision,cycle:config.cycle,tick12:config.tick12,lens12:config.lens12,lens:lensLabel(config.lens12),context_frame:config.context_frame,
   context:String(m1.music.context_frame),mode:String(m1.music.mode),basis:String(config.basis)},
  harmonic:{source:hs.selection==='canonical-basis'?{selection:'canonical-basis',index:hs.index}:{selection:'selected-source-row'},ratio:Array.isArray(ratio)&&ratio.length===2?[ratio[0],ratio[1]]:null},
  ratio_basis:basis,
  m3:{rna:transcription.rna,sequence:transcription.sequence,codon_ref:String(current.m3?.form?.codon?.ref??'')},
  address72:Number.isInteger(influence?.address72)?influence.address72:Number.isInteger(current.derivation?.mef_table_index)?current.derivation.mef_table_index:null,
  voices:voices(influence,sources),shape_ref:typeof influence?.shape_ref==='string'?influence.shape_ref:null,
  generation:typeof influence?.generation==='string'?influence.generation:null,
  influence_m1_revision:typeof influence?.m1_revision==='string'?influence.m1_revision:null,
  material:object(material)&&object(geometry)?{damping_per_second:material.damping_per_second,strike_metres:material.strike_metres,audio_gain_per_metre:material.audio_gain_per_metre,strike_on_event:material.strike_on_event,metres_per_unit:geometry.metres_per_unit}:null,
  material_standing:typeof influence?.material_standing==='string'?influence.material_standing:null,
 };
}

export type K2Edit=
 {kind:'lens';lens12:number}|{kind:'context-frame';context_frame:number}|
 {kind:'harmonic';source:K2HarmonicSource}|{kind:'transcription';rna:boolean};

/** One determinant changed on the current event; everything else carried.
 * An M1 change is an M1 revision, as `M1Engine::configure_harmonics` commits it.
 * M2/M3 generations are re-issued by the owner (`next_generation`), not here. */
export function editK2Event(event:any,edit:K2Edit){
 requireValue(object(event)&&object(event.m1)&&object(event.m3),'current event unavailable');
 const next=structuredClone(event);
 const bump=()=>{requireValue(exact.test(next.m1.revision),'M1 exact revision required');const r=BigInt(next.m1.revision);requireValue(r<(1n<<64n)-1n,'M1 revision exhausted');next.m1.revision=String(r+1n);};
 if(edit.kind==='lens'){
  requireValue(integer(edit.lens12,0,11),'lens must be one of the twelve (0–11)');
  if(next.m1.lens12===edit.lens12)throw new Error(`${lensLabel(edit.lens12)} is already acting`);
  next.m1.lens12=edit.lens12;bump();
 }else if(edit.kind==='context-frame'){
  requireValue(integer(edit.context_frame,1,7),'Context Frame must be 1–7');
  if(next.m1.context_frame===edit.context_frame)throw new Error(`CF${edit.context_frame} is already acting`);
  next.m1.context_frame=edit.context_frame;bump();
 }else if(edit.kind==='harmonic'){
  const s=edit.source;
  requireValue(s?.selection==='selected-source-row'||(s?.selection==='canonical-basis'&&integer(s.index,0,7)),'harmonic basis is one of the native eight or the selected source row');
  if(JSON.stringify(next.harmonic_source)===JSON.stringify(s))throw new Error('that harmonic basis is already acting');
  next.harmonic_source=s.selection==='canonical-basis'?{selection:'canonical-basis',index:s.index}:{selection:'selected-source-row'};
 }else if(edit.kind==='transcription'){
  requireValue(typeof edit.rna==='boolean','transcription is DNA or RNA');
  if(next.m3.rna===edit.rna)throw new Error(`${edit.rna?'RNA':'DNA'} is already acting`);
  next.m3.rna=edit.rna;
 }else throw new Error('unknown K² determinant');
 return next;
}

/** Owner influence effects joined with the O:I consumer that actually reads each
 * one right now. Wording of determinant/through/effect/warrant is the owner's. */
export function k2CausalTrace(influence:any,acting:K2Acting|null,consumers:{following:boolean;muted:boolean;targetsConnected:boolean;clock:any}){
 if(!Array.isArray(influence?.effects))return null;
 const hz=acting?.voices.map(v=>v.frequency_hz.toFixed(1)).join(', ')??'—';
 const live=(e:any)=>{
  const through=String(e.through);
  if(through.includes('audio_octet_hz'))return{kind:'pitch',value:acting?`tick ${acting.m1.tick12} · ${acting.m1.lens} · ${acting.m1.context} · ${acting.m3.rna?'RNA':'DNA'}`:null,observable:`voices ${hz} Hz`,
   oi_consumer:`NativeAudioBinding PCM${consumers.muted?' (muted: scheduled, not audible)':''} + NativeProjection → GPU targets`,acting:consumers.following};
  if(through.includes('nodal_quartet'))return{kind:'shape',value:acting?acting.voices.slice(0,4).map(v=>`${v.m}×${v.n}`).join(' '):null,observable:'nodal lines of the torus surface in the retained GPU targets',
   oi_consumer:'NativeProjection → setTargetTextures → GPU spring targets',acting:consumers.following&&consumers.targetsConnected};
  if(through.includes('mef_table_index'))return{kind:'phase',value:acting?.address72!=null?`address ${acting.address72}`:null,observable:'a/b balance of every surface term',
   oi_consumer:'GPU targets (through the K8 samples)',acting:consumers.following&&consumers.targetsConnected};
  if(through.includes('m1::torus'))return{kind:'rest',value:acting?.material?`${acting.material.metres_per_unit} m per torus unit`:null,observable:'rest body of every particle slot',
   oi_consumer:'NativeProjection (× presentation units per metre) → GPU targets',acting:consumers.following&&consumers.targetsConnected};
  if(through.includes('clock'))return{kind:'rotation',value:consumers.clock?.inscription?`inscription ${consumers.clock.inscription.turns} turns + ${consumers.clock.inscription.half_degrees}/2°`:null,observable:'rotation of attached samples about the torus axis',
   oi_consumer:'GPU targets (K8 write_targets)',acting:consumers.following&&consumers.targetsConnected};
  return{kind:'material',value:acting?.material?`damping ${acting.material.damping_per_second}/s · strike ${acting.material.strike_metres} m · gain ${acting.material.audio_gain_per_metre}/m`:null,observable:'decay, loudness and visible amplitude',
   oi_consumer:'K8 modal owner (declared policy)',acting:consumers.following};
 };
 return{schema:'oi.native-causal-trace/v2',owner:K2_PROVIDER,
  effects:influence.effects.map((e:any)=>({determinant:String(e.determinant),through:String(e.through),effect:String(e.effect),units:String(e.units),range:String(e.range),timing:String(e.timing),consumer:String(e.consumer),warrant:String(e.warrant),
   declared_policy:/declared policy/.test(String(e.warrant)),...live(e)})),
 };
}
