/** Controlled protocol fixture ONLY. Not a native numerical model or production default. */
export function controlledFrame(){return{schema:'ql.continuous-field/v1',event_ref:'controlled:occasion',subject_ref:'controlled:subject',registry_revision:'controlled:registry',geometry_ref:'controlled:geometry',material_ref:'controlled:material',model_ref:'controlled:model',sample_rate:48000,generation:'1',samples_elapsed:'0',standing:'controlled-protocol-not-native-numerical-evidence',audio:[],clock:{field_ref:'#3-0',centre_ref:'#3-5-5/0',generation:'4',inscription:{turns:'0',half_degrees:0},lensing:{turns:'0',half_degrees:0}},m2_identity:{event_ref:'controlled:occasion',profile_generation:1},presentation_units_per_metre:1,amplitudes_metres:[[0,0]],targets:[{identity:0,constituent:'#3-0',position:[-.3,0,0]},{identity:1,constituent:'#3-0',position:[.3,0,0]}]};}
export class ControlledOwner {
 frame=controlledFrame(); sequence=0n; calls=[]; closed=false; lost=false; active=false;
 async request(request){
  this.calls.push(structuredClone(request));
  if(request.operation==='close'){this.closed=true;this.active=false;return{schema:'oi.native-expression-closed/v1',closed:true};}
  if(request.operation==='open'){
   if(this.active)throw new Error('native-expression.owner_busy');this.active=true;this.closed=false;this.sequence=0n;this.frame=controlledFrame();
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
   this.frame.targets[1].position[2]=command.basis.controlled_position;
  }
  return{schema:'ql.field-host-receipt/v1',instance_ref:'controlled:instance',status:'ok',available:true,request_id:packet.request_id,last_request_id:packet.request_id,field:structuredClone(this.frame),...(command.operation==='inspect'?{sources:{m1:{source:'controlled:m1'},m2:{source:'controlled:m2'},m3:{source:'controlled:m3'}}}:{})};
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
