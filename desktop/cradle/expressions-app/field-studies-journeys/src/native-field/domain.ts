/** A reading of returned native outputs, never a second M1/M2/M3 implementation.
 * Discrete source generations and the material sample clock remain distinct. */
export interface NativeDomainReading {
  event_ref: string;
  subject_ref: string;
  basis_generation: string;
  m1: {revision:string; coordinate:string;row12:number;tick12:number; quadrature:number[]; opposite_quadrature:number[]; standing:unknown};
  m2: {generation:number; modes:Array<{ref:string;frequency_hz:number;damping_per_second:number}>; standing:unknown};
  m3: {generation:number; codon_ref:string; sequence:string; rna:boolean; angles_deg10:number[]; standing:unknown};
}
const object = (v:unknown):v is Record<string,any> => !!v && typeof v==='object' && !Array.isArray(v);
const requireValue = (ok:unknown,reason:string):void => {if(!ok)throw new Error(`native source admission: ${reason}`);};
const text = (v:unknown) => typeof v==='string' && v.length>0 && v.length<=4096;
const vector = (v:unknown,n:number):v is number[] => Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x));
export function projectNativeSources(sources:any,identity:{event_ref:string;subject_ref:string;generation:string}):NativeDomainReading {
  const current=sources?.current, m1=current?.m1, m2=current?.m2, m3=current?.m3;
  requireValue(object(current)&&object(current.input),'complete current native basis unavailable');
  requireValue(m1?.schema==='ql.m1.engine/v1'&&m1.config?.event_ref===identity.event_ref,'M1 schema/event mismatch');
  requireValue(m2?.schema==='ql.m2-engine/v1'&&m2.identity?.event_ref===identity.event_ref,'M2 schema/event mismatch');
  requireValue(m3?.schema==='ql.m3-state/v1'&&m3.identity?.event_ref===identity.event_ref&&m3.subject_ref===identity.subject_ref,'M3 schema/event/subject mismatch');
  requireValue(text(m1.config.revision)&&text(m1.config.selected_coordinate),'M1 source identity missing');
  requireValue(Number.isInteger(m1.config.row12)&&m1.config.row12>=0&&m1.config.row12<=11&&Number.isInteger(m1.config.tick12)&&m1.config.tick12>=0&&m1.config.tick12<=11,'M1 row/carrier tick unavailable');
  requireValue(vector(m1.carrier?.quadrature,2)&&vector(m1.carrier?.opposite_quadrature,2),'native carrier vectors unavailable');
  requireValue(Number.isSafeInteger(m2.identity.profile_generation)&&m2.identity.profile_generation>=0,'M2 generation missing');
  requireValue(Number.isSafeInteger(m3.identity.profile_generation)&&m3.identity.profile_generation>=0,'M3 generation missing');
  requireValue(typeof m3.transcription?.rna==='boolean'&&typeof m3.transcription?.sequence==='string'&&/^[ACGTU]{3}$/.test(m3.transcription.sequence),'native transcription unavailable');
  requireValue(text(m3.form?.codon?.ref)&&vector(m3.form?.angles_deg10,3),'native form source/angles unavailable');
  const modes=m2.resonator?.modes;
  requireValue(Array.isArray(modes)&&modes.length>0&&modes.length<=4096,'native material mode set unavailable');
  const refs=new Set<string>();
  for(const mode of modes){requireValue(text(mode?.mode_ref)&&!refs.has(mode.mode_ref)&&Number.isFinite(mode.frequency_hz)&&mode.frequency_hz>0&&Number.isFinite(mode.damping_per_second)&&mode.damping_per_second>=0,'invalid/duplicate native material mode');refs.add(mode.mode_ref);}
  return {
    event_ref:identity.event_ref,subject_ref:identity.subject_ref,basis_generation:identity.generation,
    m1:{revision:m1.config.revision,coordinate:m1.config.selected_coordinate,row12:m1.config.row12,tick12:m1.config.tick12,quadrature:[...m1.carrier.quadrature],opposite_quadrature:[...m1.carrier.opposite_quadrature],standing:m1.standing},
    m2:{generation:m2.identity.profile_generation,modes:modes.map((mode:any)=>({ref:mode.mode_ref,frequency_hz:mode.frequency_hz,damping_per_second:mode.damping_per_second})),standing:current.derivation?.material_standing??m2.continuous_standing},
    m3:{generation:m3.identity.profile_generation,codon_ref:m3.form.codon.ref,sequence:m3.transcription.sequence,rna:m3.transcription.rna,angles_deg10:[...m3.form.angles_deg10],standing:m3.form.orientation_standing},
  };
}
export type NativeBasisEdit = {kind:'harmonic-row';row12:number}|{kind:'carrier-tick';tick12:number}|{kind:'transcription';rna:boolean}|{kind:'damping';mode_ref:string;per_second:number};
/** Explicit native request authoring: carry every unaffected field and stamp;
 * advance only the input generations required by the existing owner contract. */
export function editNativeBasis(sources:any,edit:NativeBasisEdit):any {
  const input=sources?.current?.input;
  requireValue(object(input)&&object(input.m1)&&object(input.m2)&&object(input.m3),'inspect a complete native input before editing');
  const next=structuredClone(input),stamp=next.m2.stamp;
  const generation=stamp?.identity?.profile_generation;
  requireValue(Array.isArray(next.m3_commands)&&next.m3_commands.length===0,'native seed edit requires a basis without retained M3 commands; use a complete native replacement');
  requireValue(next.m3.stamp?.identity?.event_ref===stamp?.identity?.event_ref&&next.m3.stamp?.identity?.profile_generation===generation,'M2/M3 coupled seed generation drift');
  requireValue(Number.isSafeInteger(generation)&&generation>=0&&generation<Number.MAX_SAFE_INTEGER,'M2 generation exhausted');
  if(edit.kind==='harmonic-row'||edit.kind==='carrier-tick'){
    const value=edit.kind==='harmonic-row'?edit.row12:edit.tick12;
    requireValue(Number.isInteger(value)&&value>=0&&value<=11,'M1 row/carrier tick must be 0–11');
    requireValue(typeof next.m1.revision==='string'&&/^(0|[1-9][0-9]*)$/.test(next.m1.revision),'M1 exact revision required');
    const revision=BigInt(next.m1.revision);requireValue(revision<(1n<<64n)-1n,'M1 revision exhausted');
    next.m1[edit.kind==='harmonic-row'?'row12':'tick12']=value;next.m1.revision=String(revision+1n);
  }else if(edit.kind==='transcription'){
    requireValue(typeof edit.rna==='boolean','RNA flag must be boolean');
    const generation=next.m3.stamp?.identity?.profile_generation;
    requireValue(Number.isSafeInteger(generation)&&generation>=0&&generation<Number.MAX_SAFE_INTEGER,'M3 generation exhausted');
    // Existing M3 commands carry their own expected generations. Rewriting
    // those without the owner would forge a different command history.
    requireValue(Array.isArray(next.m3_commands)&&next.m3_commands.length===0,'transcription seed edit requires a basis without retained M3 commands; use a complete native replacement');
    next.m3.rna=edit.rna;next.m3.stamp.identity.profile_generation=generation+1;
  }else if(edit.kind==='damping'){
    requireValue(Number.isFinite(edit.per_second)&&edit.per_second>=0,'damping must be finite and nonnegative (s⁻¹); native owner supplies its further bounds');
    const mode=next.m2.resonator?.modes?.find((m:any)=>m.mode_ref===edit.mode_ref);
    requireValue(mode,'native material mode not found');mode.damping_per_second=edit.per_second;
  }else throw new Error('unknown native basis edit');
  // M2 validates each supplied input against its composite generation. Keep
  // source refs/values/times intact; do not relabel an old stamp as new evidence.
  for(const name of ['resonator','vimarsha','m1_excitation']){
    const component=next.m2[name];if(component==null)continue;
    requireValue(component.stamp?.identity?.event_ref===stamp.identity.event_ref&&component.stamp?.identity?.profile_generation===generation,`stale M2 ${name} input stamp`);
    component.stamp.identity.profile_generation=generation+1;
  }
  stamp.identity.profile_generation=generation+1;
  next.m3.stamp.identity.profile_generation=generation+1;
  next.m3.m2_basis=structuredClone(stamp);
  return next;
}
