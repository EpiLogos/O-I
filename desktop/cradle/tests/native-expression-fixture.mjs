/** Controlled protocol fixture ONLY. Not a native numerical model or production default. */
export function controlledFrame(){return{schema:'ql.continuous-field/v1',event_ref:'controlled:occasion',subject_ref:'controlled:subject',registry_revision:'controlled:registry',geometry_ref:'controlled:geometry',material_ref:'controlled:material',model_ref:'controlled:model',sample_rate:48000,generation:'1',samples_elapsed:'0',standing:'controlled-protocol-not-native-numerical-evidence',audio:[],clock:{field_ref:'#3-0',centre_ref:'#3-5-5/0',generation:'4',inscription:{turns:'0',half_degrees:0},lensing:{turns:'0',half_degrees:0}},m2_identity:{event_ref:'controlled:occasion',profile_generation:1},presentation_units_per_metre:1,amplitudes_metres:[[0,0]],targets:[{identity:0,constituent:'#3-0',position:[-.3,0,0]},{identity:1,constituent:'#3-0',position:[.3,0,0]}]};}
export function controlledSources(){
 const identity={event_ref:'controlled:occasion',profile_generation:1};
 const stamp={contract_ref:'ql.m2-engine-request/v1',identity,source_ref:'controlled:source'};
 const input={m1:{event_ref:identity.event_ref,revision:'0',selected_coordinate:'#1-5',row12:0,tick12:0},m2:{stamp:structuredClone(stamp),resonator:{stamp:structuredClone(stamp),modes:[{mode_ref:'controlled:mode',frequency_hz:440,damping_per_second:.25}]}},m3:{stamp:structuredClone(stamp),m2_basis:structuredClone(stamp),rna:false},m3_commands:[]};
 return {original:{input:structuredClone(input)},current:{input,
  m1:{schema:'ql.m1.engine/v1',config:structuredClone(input.m1),carrier:{quadrature:[1,0],opposite_quadrature:[-1,0]},standing:{source:'controlled'}},
  m2:{schema:'ql.m2-engine/v1',identity:structuredClone(identity),resonator:structuredClone(input.m2.resonator)},
  m3:{schema:'ql.m3-state/v1',identity:structuredClone(identity),subject_ref:'controlled:subject',transcription:{rna:false,sequence:'ACT'},form:{codon:{ref:'#3-controlled'},angles_deg10:[0,600,-300],orientation_standing:'controlled-source-form-not-a-physical-pose'}},
  derivation:{material_standing:'controlled-protocol-only'}}};
}
export class ControlledOwner {
 frame=controlledFrame(); sources=controlledSources(); sequence=0n; calls=[]; closed=false; lost=false; active=false;
 async request(request){
  this.calls.push(structuredClone(request));
  if(request.operation==='close'){this.closed=true;this.active=false;return{schema:'oi.native-expression-closed/v1',lease:request.lease,closed:true};}
  if(request.operation==='open'){
   if(this.active)throw new Error('native-expression.owner_busy');this.active=true;this.closed=false;this.sequence=0n;this.frame=controlledFrame();this.sources=controlledSources();
   return{schema:'oi.native-expression-open/v1',lease:'controlled:lease',source:{revision:'controlled:r1'},presentation:{units_per_metre:400,slots_a:[0,1,0,1],slots_b:[1,0,1,0]},receipt:{schema:'ql.field-host-receipt/v1',status:'ready',available:true,instance_ref:'controlled:instance',last_request_id:'0',request_id:null,field:structuredClone(this.frame)}};
  }
  if(this.closed||this.lost)throw new Error('controlled producer disconnected');
  const packet=request.request;
  if(packet.request_id!==String(++this.sequence)||packet.expected_generation!==this.frame.generation||packet.expected_samples_elapsed!==this.frame.samples_elapsed)throw new Error('controlled native cursor mismatch');
  this.frame=structuredClone(this.frame);this.frame.audio=[];
  const command=packet.command;
  if(command.operation==='advance'){
   this.frame.samples_elapsed=String(BigInt(this.frame.samples_elapsed)+BigInt(command.frames));
   this.frame.audio=Array(command.frames).fill(.125);
   this.frame.targets[0].position[1]=Number(this.frame.samples_elapsed)/48000;
  }else if(command.operation==='set-axis'){
   this.frame.generation=String(BigInt(this.frame.generation)+1n);
   this.frame.clock.generation=String(BigInt(this.frame.clock.generation)+1n);
   this.frame.clock[command.axis?'lensing':'inscription']=command.phase;
   this.frame.targets[0].position[0]=command.phase.half_degrees/720;
  }else if(command.operation==='replace'){
   this.frame.generation=String(BigInt(this.frame.generation)+1n);
   const basis=command.basis,current=this.sources.current;
   if(basis.m2.stamp.identity.profile_generation<=current.m2.identity.profile_generation)throw new Error('controlled stale M2 generation');
   current.input=structuredClone(basis);current.m1.config=structuredClone(basis.m1);
   current.m1.carrier.quadrature=[0,1];current.m1.carrier.opposite_quadrature=[0,-1];
   current.m2.identity=structuredClone(basis.m2.stamp.identity);current.m2.resonator=structuredClone(basis.m2.resonator);
   current.m3.identity=structuredClone(basis.m3.stamp.identity);current.m3.transcription={rna:basis.m3.rna,sequence:basis.m3.rna?'ACU':'ACT'};
   this.frame.targets[1].position[2]=basis.m2.resonator.modes[0].damping_per_second;
   this.frame.m2_identity=structuredClone(current.m2.identity);
  }
  return{schema:'ql.field-host-receipt/v1',instance_ref:'controlled:instance',status:'ok',available:true,request_id:packet.request_id,last_request_id:packet.request_id,field:structuredClone(this.frame),...(command.operation==='inspect'?{sources:structuredClone(this.sources)}:{})};
 }
 dispose(){} available=true;
}
export class ControlledAudio {
 sampleRate=48000;currentTime=0;state='running';destination={};nodes=[];listeners=[];
 createGain(){return{gain:{value:1,setValueAtTime(v){this.value=v;}},connect(){},disconnect(){}};}
 createBuffer(_channels,count){return{data:new Float32Array(count),copyToChannel(values){this.data.set(values);}};}
 createBufferSource(){const ctx=this;return{playbackRate:{value:1},detune:{value:0},connect(){},disconnect(){this.disconnected=true;},start(time){this.time=time;ctx.nodes.push(this);},stop(){this.stopped=true;}};}
 addEventListener(_event,cb){this.listeners.push(cb);}removeEventListener(_event,cb){this.listeners=this.listeners.filter(x=>x!==cb);}
 async resume(){this.state='running';} async close(){this.state='closed';}
}
/** Static native DTO bindings/warrants copied from the exact 5b2 retained record.
 * Their presence tests protocol conformance, never actual native computation. */
const CONTROLLED_SCENE_CONTRACT={"record_sha256":"189ff8bd4b012c563d8736a4872582f501619ebfa08ad5a7e9f92faa3745eb7f","geometry_ref":"ql.scene-torus-provider/v1:m1-torus#1-5-1","material_ref":"ql.scene-torus-provider/v1:declared-linear-medium","model_ref":"ql.continuous-linear-mode/v1","material_standing":"declared-material-policy: no source table fixes presentation scale, damping, strike amplitude or output gain (QL-MEF #135)","effects":[{"consumer":"K8 C++ modal owner → native PCM and GPU target texture","determinant":"the dated sky (ql-sky snapshot → M2 world observations)","effect":"voice i = planet PLANETS[i]: PCM pitch and modal oscillation of the torus surface","range":"root × 1..9/4","through":"coupled sky bus: M2-5 m_2_5_interval_from_root × M1 root","timing":"per determinant event; continuous integration between","units":"Hz","warrant":"source-defined (map just octave; owner ruling #254 D13)"},{"consumer":"K8 target samples → GPU spring targets","determinant":"planet longitude λ","effect":"where voice i's surface term is anchored on the body","range":"0..2π","through":"θ = λ on the torus's large circle","timing":"re-read per event via explicit K8 shape replacement","units":"radians","warrant":"owner ruling #254 D6 (the torus is the clock)"},{"consumer":"K8 target samples","determinant":"m1 tick12 / lens12 / context frame / m3 pose","effect":"nodal lines and phase of voice i's surface term (the M2 cymatic skin)","range":"1..12; (address72 + i + 1)·π/36","through":"m2.vimarsha.reading.nodal_quartet[i % 4].{m,n} and derivation.mef_table_index","timing":"per determinant event","units":"mode numbers; radians","warrant":"source-defined (M2-ARCHITECTURE §5.3.1)"},{"consumer":"M3 owner → Vimarśā pose → surface skin","determinant":"m1 ring state (tick12, cycle)","effect":"the M3 form the event carries","range":"0..63","through":"spanda_field::ring_codon_advance → m3.address","timing":"per M1 advance","units":"codon address","warrant":"source-defined (C kernel spanda_codon_advance, parity-tested)"},{"consumer":"K8 rest samples → GPU targets","determinant":"m1 torus #1-5-1","effect":"rest body of every sample","range":"|x|,|y| ≤ 25/9, |z| ≤ 1","through":"m1::torus(θ, φ), R = 16/9, r = 1","timing":"fixed per instance","units":"torus units × metres_per_unit","warrant":"source-defined (KERNEL-M1-ENGINE-CONTRACT)"},{"consumer":"K8 modal owner","determinant":"material policy","effect":"decay, loudness and visible amplitude","range":"declared","through":"damping, strike, gain, metres_per_unit","timing":"per instance","units":"1/s, m, 1/m, m","warrant":"declared policy — not source"}]};

/** Controlled scene protocol fixture ONLY. Voice values are arbitrary protocol
 * numbers: the sky's pitch holds while the skin moves with each determinant;
 * they are not QL's scene owner. */
export class ControlledSceneOwner {
 state={tick12:7,cycle:1,revision:0,lens12:11,context_frame:7,harmonic:{selection:'canonical-basis',index:3},rna:false,generation:1n,m2:1};
 frame=null; sequence=0n; calls=[]; closed=false; active=false; inFlight=0; maxInFlight=0; delay=null; refuse=null;
 voices(){const s=this.state;return['#2-5-0/1','#2-5-2','#2-5-3','#2-5-4','#2-5-5','#2-5-6','#2-5-7','#2-5-8','#2-5-9'].map((planet_ref,i)=>({planet_ref,longitude_radians:i*0.6,frequency_hz:130.81*(1+i/8)+(s.harmonic.index??9),m:1+((s.tick12+i%4)%12),n:1+((s.lens12+i%4)%12),helix:i%4<2?'bimba':'pratibimba',ql_position:i%6,weight:1,phase_radians:i}));}
 event(){const s=this.state;const identity={event_ref:'controlled:scene',profile_generation:s.m2};
  return{schema:'ql.coupled-event-request/v1',m1:{event_ref:'controlled:scene',revision:String(s.revision),cycle:String(s.cycle),tick12:s.tick12,lens12:s.lens12,context_frame:s.context_frame,basis:'fifths',selected_coordinate:'#1-2-5',row12:3},
   m2:{stamp:{contract_ref:'ql.m2-engine-request/v1',identity,source_ref:'controlled'},resonator:null,world_observations:[{observed_at_unix_ms:1789479981163}]},
   m3:{stamp:{contract_ref:'ql.m3-state-request/v1',identity,source_ref:'controlled'},subject_ref:'controlled:subject',rna:s.rna},m3_commands:[],harmonic_source:structuredClone(s.harmonic),frequency_bindings:[],sky_frequency_bindings:[],source_receipts:[]};}
 sources(){const s=this.state,input=this.event();input.m2.resonator={provider_ref:'ql.scene-torus-provider/v1',modes:this.voices().map((v,i)=>({mode_ref:`scene:planet/${v.planet_ref}`,source_coordinate:v.planet_ref,frequency_hz:v.frequency_hz,damping_per_second:.35}))};
  const identity={event_ref:'controlled:scene',profile_generation:s.m2};
  return{original:{input:this.original??(this.original=structuredClone(input))},current:{input,derivation:{harmonic_ratio:{ratio:[3,2]},mef_table_index:(s.lens12*6+s.tick12%6)%72,material_standing:'controlled',sky_voices:this.voices().map(v=>({planet_ref:v.planet_ref,frequency_hz:v.frequency_hz}))},
   m1:{schema:'ql.m1.engine/v1',config:structuredClone(input.m1),music:{lens:'L5′',context_frame:`CF${s.context_frame}`,mode:'Controlled'},ratio_basis:[[1,1],[4,3],[3,4],[3,2],[2,3],[2,1],[8,9],[16,9]].map(ratio=>({ratio})),carrier:{quadrature:[1,0],opposite_quadrature:[-1,0]},standing:{}},
   m2:{schema:'ql.m2-engine/v1',identity,resonator:structuredClone(input.m2.resonator),vimarsha:{reading:{audio_octet_hz:this.voices().map(v=>v.frequency_hz),nodal_quartet:this.voices().slice(0,4)}}},
   m3:{schema:'ql.m3-state/v1',identity,subject_ref:'controlled:subject',transcription:{rna:s.rna,sequence:s.rna?'AUG':'ATG'},form:{codon:{ref:'#3-controlled'},angles_deg10:[0,0,0]}}}};}
 influence(){const s=this.state,current=this.sources().current;
  // Current identity/cursor/source DTOs are protocol state. Deeper readings not
  // computed by this owner are explicitly unavailable, never retained native
  // values relabelled as newly computed results.
  const unavailable=()=>({availability:'unavailable',source_error:'controlled protocol only; no native owner computation'});
  return{schema:'ql.expression-influence/v1',instance_ref:'controlled:scene',event_ref:this.frame.event_ref,subject_ref:this.frame.subject_ref,
   generation:this.frame.generation,samples_elapsed:this.frame.samples_elapsed,m1_revision:String(s.revision),m3_generation:s.m2,
   address72:(s.lens12*6+s.tick12%6)%72,shape_ref:this.frame.shape_ref,voices:this.voices(),
   geometry:{longitude_samples:4,latitude_samples:4,metres_per_unit:1,attachment:1},
   material:{damping_per_second:.35,strike_metres:.08,audio_gain_per_metre:1,strike_on_event:true},material_standing:CONTROLLED_SCENE_CONTRACT.material_standing,
   native_readback:{schema:'ql.scene-source-reading/v1',event_ref:this.frame.event_ref,subject_ref:this.frame.subject_ref,m1_revision:String(s.revision),m3_generation:s.m2,profile_generation:s.m2,
    continuous_clock_native:structuredClone(this.frame.clock),continuous_clock:structuredClone(this.frame.clock),
    m1_clock:{cycle:String(s.cycle),tick12:s.tick12},m1_carrier:structuredClone(current.m1.carrier),m3_clock:unavailable(),form:structuredClone(current.m3.form),
    selected_aperture:unavailable(),form_process:{...unavailable(),instance_ref:'controlled:scene'},continuation_start:unavailable(),clock_semantics:unavailable()},
   effects:structuredClone(CONTROLLED_SCENE_CONTRACT.effects)};}

 async request(request){
  this.calls.push(structuredClone(request));
  if(request.operation==='close'){this.closed=true;this.active=false;return{schema:'oi.native-expression-closed/v1',lease:request.lease,closed:true};}
  if(request.operation==='compose'){
   if(this.active)throw new Error('native-expression.owner_busy');this.active=true;this.closed=false;this.sequence=0n;
   const base=controlledFrame();
   this.frame={...base,event_ref:'controlled:scene',shape_ref:'controlled',geometry_ref:CONTROLLED_SCENE_CONTRACT.geometry_ref,material_ref:CONTROLLED_SCENE_CONTRACT.material_ref,model_ref:CONTROLLED_SCENE_CONTRACT.model_ref,
    m2_identity:{event_ref:'controlled:scene',profile_generation:1},amplitudes_metres:Array.from({length:9},()=>[0,0]),
    // Minimal complete protocol capacity; preserve the original two scripted
    // target values/identities that every existing consumer assertion uses.
    targets:Array.from({length:16},(_,i)=>({...structuredClone(base.targets[i%2]),identity:i}))};
   const [w,h]=request.request.texture,slots=Array.from({length:w*h},(_,i)=>i%2);
   return{schema:'oi.native-expression-open/v1',lease:'controlled:scene-lease',source:{schema:'oi.native-expression-composed-source/v1',sky:null},presentation:{units_per_metre:request.request.units_per_metre,slots_a:slots,slots_b:slots},
    receipt:{schema:'ql.field-host-receipt/v1',status:'ready',available:true,instance_ref:'controlled:scene',last_request_id:'0',request_id:null,field:structuredClone(this.frame)}};
  }
  if(this.closed)throw new Error('controlled producer disconnected');
  const packet=request.request,command=packet.command;
  if(packet.request_id!==String(++this.sequence)||packet.expected_generation!==this.frame.generation||packet.expected_samples_elapsed!==this.frame.samples_elapsed)throw new Error('controlled native cursor mismatch');
  this.inFlight++;this.maxInFlight=Math.max(this.maxInFlight,this.inFlight);
  try{
   if(this.delay&&['m1-advance','replace-event'].includes(command.operation))await this.delay();
   this.frame=structuredClone(this.frame);this.frame.audio=[];
   const reply=extra=>({schema:'ql.field-host-receipt/v1',instance_ref:'controlled:scene',status:'ok',available:true,request_id:packet.request_id,last_request_id:packet.request_id,field:structuredClone(this.frame),...extra});
   if(this.refuse?.(command))return{...reply({}),status:'refused',error:'controlled refusal: '+command.operation};
   const s=this.state;
   if(command.operation==='advance'){this.frame.samples_elapsed=String(BigInt(this.frame.samples_elapsed)+BigInt(command.frames));this.frame.audio=Array(command.frames).fill(.125);}
   else if(command.operation==='m1-advance'){const t=s.tick12+command.ticks;s.cycle+=Math.floor(t/12);s.tick12=t%12;s.revision++;s.m2++;this.bump(2n);}
   else if(command.operation==='replace-event'){const e=command.event;
    if(e.m2.resonator!==null||e.frequency_bindings.length)throw new Error('controlled: provider owns the voices');
    Object.assign(s,{tick12:e.m1.tick12,cycle:Number(e.m1.cycle),revision:Number(e.m1.revision),lens12:e.m1.lens12,context_frame:e.m1.context_frame,harmonic:structuredClone(e.harmonic_source),rna:e.m3.rna});s.m2++;this.bump(command.strike?2n:1n);}
   else if(!['read','inspect','influence'].includes(command.operation))throw new Error('controlled: unsupported '+command.operation);
   // Like the real scene host, a determinant acknowledgement carries its influence.
   return reply(command.operation==='inspect'?{sources:this.sources(),influence:this.influence(),event:this.event()}:['influence','m1-advance','replace-event'].includes(command.operation)?{influence:this.influence()}:{});
  }finally{this.inFlight--;}
 }
 bump(step){this.frame.generation=String(BigInt(this.frame.generation)+step);this.frame.m2_identity={event_ref:'controlled:scene',profile_generation:this.state.m2};this.frame.targets[0].position[2]=this.state.tick12/12;}
 dispose(){} available=true;
}
