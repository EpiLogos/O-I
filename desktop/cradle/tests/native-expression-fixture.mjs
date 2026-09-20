/** Controlled protocol fixture ONLY. Not a native numerical model or production default. */
export function controlledFrame(){return{schema:'ql.continuous-field/v1',event_ref:'controlled:occasion',subject_ref:'controlled:subject',registry_revision:'controlled:registry',geometry_ref:'controlled:geometry',material_ref:'controlled:material',model_ref:'controlled:model',sample_rate:48000,generation:'1',samples_elapsed:'0',standing:'controlled-protocol-not-native-numerical-evidence',audio:[],clock:{field_ref:'#3-0',centre_ref:'#3-5-5/0',generation:'4',inscription:{turns:'0',half_degrees:0},lensing:{turns:'0',half_degrees:0}},m2_identity:{event_ref:'controlled:occasion',profile_generation:1},presentation_units_per_metre:1,amplitudes_metres:[[0,0]],targets:[{identity:0,constituent:'#3-0',position:[-.3,0,0]},{identity:1,constituent:'#3-0',position:[.3,0,0]}]};}
export function controlledSources(){
 const identity={event_ref:'controlled:occasion',profile_generation:1};
 const stamp={contract_ref:'ql.m2-engine-request/v1',identity,source_ref:'controlled:source'};
 const input={m1:{event_ref:identity.event_ref,revision:'0',selected_coordinate:'#1-5',row12:0},m2:{stamp:structuredClone(stamp),resonator:{stamp:structuredClone(stamp),modes:[{mode_ref:'controlled:mode',frequency_hz:440,damping_per_second:.25}]}},m3:{stamp:structuredClone(stamp),m2_basis:structuredClone(stamp),rna:false},m3_commands:[]};
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
  if(request.operation==='close'){this.closed=true;this.active=false;return{schema:'oi.native-expression-closed/v1',closed:true};}
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
