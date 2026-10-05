/** Literal observations from the same native callback/pulse. These validators
 * retain original evidence; none can issue a source, body, programme or clock. */
export type NativeJsonObject = Record<string,any>;
export interface NativeLiveTemporalProgress {
 programme_ref:string;count:number;next:number;failed:boolean;current_source_ref:string;
 current_source_index:number;current_source_application_ordinal:string;current_source_effective_sample:string;
}
export interface NativeSourceApplication {
 before_source_ref:string;after_source_ref:string;before_source_index:number;after_source_index:number;
 original_native_request_id:string;original_sample:string;playback_sample:string;transaction:string;
 before_body_revision:string;after_body_revision:string;source_application_ordinal:string;
 callback_start:string;callback_end:string;kind:0|1;status:2;physical:NativeJsonObject;
}
export interface NativeCaptureSourceSpan {
 offset:number;frames:number;source_ref:string;source_index:number;determination:NativeJsonObject;
 physical_body:NativeJsonObject;physical_eigenbasis:string;receiving_manifest:NativeJsonObject|null;
 route_manifest:NativeJsonObject|null;start_applied_sequence:string;end_applied_sequence:string;
 start_application_ordinal:string;end_application_ordinal:string;physical_routes:NativeJsonObject;
 source_force_programme_ref:string|null;source_force_receipt:NativeJsonObject|null;
 source_force_occurrences:NativeJsonObject[];
}
const fail=(reason:string):never=>{throw Error('Original native temporal capture: '+reason);};
const need=(ok:unknown,reason:string):void=>{if(!ok)fail(reason);};
export function temporalObject(v:unknown):NativeJsonObject{need(v!==null&&typeof v==='object'&&!Array.isArray(v),'object absent');return v as NativeJsonObject;}
export function temporalKeys(v:unknown,keys:readonly string[]):NativeJsonObject{const o=temporalObject(v);need(Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k)),'complete literal native fields differ');return o;}
export function temporalDecimal(v:unknown):string{need(typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<(1n<<64n),'noncanonical native u64');return v as string;}
function count(v:unknown,min:number,max:number):number{need(typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max,'native index/count outside bound');return v as number;}
function real(v:unknown):number{need(typeof v==='number'&&Number.isFinite(v),'nonfinite original native number');return v as number;}
function ref(v:unknown):string{need(typeof v==='string'&&v.length>0&&v.length<=4096&&!v.includes('\0'),'native reference absent');return v as string;}
function flag(v:unknown){need(typeof v==='boolean','native boolean absent');}
function array(v:unknown,min:number,max:number):any[]{need(Array.isArray(v)&&v.length>=min&&v.length<=max,'native array length differs');return v as any[];}
function vector(v:unknown){array(v,3,3).forEach(real);}
function decimals(o:NativeJsonObject,keys:readonly string[]){keys.forEach(k=>temporalDecimal(o[k]));}
function refs(o:NativeJsonObject,keys:readonly string[]){keys.forEach(k=>ref(o[k]));}
function same(a:any,b:any):boolean{if(Object.is(a,b))return true;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>same(x,b[i]));if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const ks=Object.keys(a);return ks.length===Object.keys(b).length&&ks.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
export function readLiveTemporalProgress(value:unknown,cursor:string):NativeLiveTemporalProgress{
 const v=temporalKeys(value,['programme_ref','count','next','failed','current_source_ref','current_source_index','current_source_application_ordinal','current_source_effective_sample']);
 refs(v,['programme_ref','current_source_ref']);count(v.count,0,255);count(v.next,0,v.count);count(v.current_source_index,0,255);flag(v.failed);
 decimals(v,['current_source_application_ordinal','current_source_effective_sample']);temporalDecimal(cursor);
 need(BigInt(v.current_source_application_ordinal)===BigInt(v.next)&&BigInt(v.current_source_effective_sample)<=BigInt(cursor),'source progress detached original application/date');
 return v as NativeLiveTemporalProgress;
}
export function readSourceApplication(value:unknown,cursor:string):NativeSourceApplication{
 const v=temporalKeys(value,['before_source_ref','after_source_ref','original_native_request_id','original_sample','playback_sample','transaction','before_body_revision','after_body_revision','source_application_ordinal','callback_start','callback_end','before_source_index','after_source_index','kind','status','physical']);
 refs(v,['before_source_ref','after_source_ref']);decimals(v,['original_native_request_id','original_sample','playback_sample','transaction','before_body_revision','after_body_revision','source_application_ordinal','callback_start','callback_end']);count(v.before_source_index,0,255);count(v.after_source_index,0,255);count(v.kind,0,1);
 need(v.status===2&&v.before_source_ref!==v.after_source_ref&&v.before_source_index!==v.after_source_index&&BigInt(v.original_native_request_id)>0n&&BigInt(v.transaction)>0n&&BigInt(v.source_application_ordinal)>0n&&BigInt(v.before_body_revision)>0n&&BigInt(v.after_body_revision)>0n,'application is not the original completed source change');
 need(BigInt(v.callback_start)<=BigInt(v.playback_sample)&&BigInt(v.playback_sample)<BigInt(v.callback_end)&&BigInt(v.callback_end)<=BigInt(temporalDecimal(cursor)),'source application exceeds original callback/pulse fence');
 const p=temporalKeys(v.physical,['transaction','before_revision','after_revision','samples_elapsed','kind','policy','before_energy_joules','after_energy_joules','external_work_joules']);decimals(p,['transaction','before_revision','after_revision','samples_elapsed']);count(p.kind,0,2);count(p.policy,0,2);['before_energy_joules','after_energy_joules','external_work_joules'].forEach(k=>real(p[k]));
 need(p.transaction===v.transaction&&p.before_revision===v.before_body_revision&&p.after_revision===v.after_body_revision&&p.samples_elapsed===v.playback_sample&&p.before_energy_joules>=0&&p.after_energy_joules>=0,'source application lost its actual transaction/body/date/energy observation');
 if(v.kind===0)need(p.kind<=1&&p.policy<=1&&BigInt(v.after_body_revision)>BigInt(v.before_body_revision)&&Object.is(p.external_work_joules,p.after_energy_joules-p.before_energy_joules),'physical application lost original projection/body/work receipt');
 else need(p.kind===2&&p.policy===2&&v.after_body_revision===v.before_body_revision&&Object.is(p.before_energy_joules,p.after_energy_joules)&&Object.is(p.external_work_joules,0),'acoustic application changed its actual same P observation or acquired external work');
 return v as NativeSourceApplication;
}
const identityFields=['instance','event','subject','m1_revision','m2_generation'];
function workIdentity(v:unknown,work:NativeJsonObject){const o=temporalKeys(v,identityFields);refs(o,['instance','event','subject']);decimals(o,['m1_revision','m2_generation']);need(o.instance===work.instance&&o.event===work.event&&o.subject===work.subject,'source span belongs to another work');return o;}
function determination(v:unknown,work:NativeJsonObject){
 const r=['m1_coordinate','m2_writer','registry_revision','source_revision','relation_plan_ref','tuning_ref','native_receipt_ref','body_preparation_ref','body_state_ref'];const n=['m1_face','m2_face','tick12','degree720','basis','lens12','context_frame'];
 const o=temporalKeys(v,['identity',...r,...n,'body_revision','tuning_available','audio_octet_hz','nodal_quartet','excitation']);workIdentity(o.identity,work);refs(o,r);temporalDecimal(o.body_revision);need(BigInt(o.body_revision)>0n,'span body revision absent');flag(o.tuning_available);
 count(o.m1_face,0,1);count(o.m2_face,0,1);count(o.tick12,0,11);count(o.degree720,0,719);count(o.basis,0,1);count(o.lens12,0,11);count(o.context_frame,1,7);
 array(o.audio_octet_hz,8,8).forEach(real);for(const row of array(o.nodal_quartet,4,4)){const b=temporalKeys(row,['position','face','m','n']);need(b.position===0||b.position===5,'nodal prime position differs');count(b.face,0,1);count(b.m,1,12);count(b.n,1,12);}
 const e=temporalKeys(o.excitation,['policy_ref','standing','scaling','reference_hertz','root_linear','octet_linear','weights']);refs(e,['policy_ref','standing']);count(e.scaling,0,1);['reference_hertz','root_linear','octet_linear'].forEach(k=>real(e[k]));array(e.weights,8,8).forEach(real);return o;
}
function physicalBody(v:unknown,d:NativeJsonObject,rate:number){
 const r=['event_ref','subject_ref','source_coordinate','source_revision','geometry_ref','geometry_revision','geometry_source_ref','geometry_standing','preparation_ref','state_ref'];const n=['source_generation','body_revision','sample_rate','family'];const f=['pickup_linear_per_metre','max_force_newtons','max_impulse_newton_seconds','max_displacement_metres'];
 const o=temporalKeys(v,[...r,...n,...f,'pratibimba','material','exciter','pickup','nodes','edges']);refs(o,r);decimals(o,n);f.forEach(k=>real(o[k]));flag(o.pratibimba);
 need(o.event_ref===d.identity.event&&o.subject_ref===d.identity.subject&&o.body_revision===d.body_revision&&o.preparation_ref===d.body_preparation_ref&&o.state_ref===d.body_state_ref&&BigInt(o.sample_rate)===BigInt(rate),'span native body detached its determination/rate');
 const m=temporalKeys(o.material,['reference','revision','source_ref','standing','young_modulus_pa','density_kg_per_m3','damping_alpha_per_second','damping_beta_seconds']);refs(m,['reference','revision','source_ref','standing']);['young_modulus_pa','density_kg_per_m3','damping_alpha_per_second','damping_beta_seconds'].forEach(k=>real(m[k]));
 const ids=new Set<string>();for(const row of array(o.nodes,1,32)){const x=temporalKeys(row,['identity','constituent','rest_metres','additional_mass_kg','fixed']);temporalDecimal(x.identity);need(!ids.has(x.identity),'native body node repeated');ids.add(x.identity);ref(x.constituent);vector(x.rest_metres);real(x.additional_mass_kg);array(x.fixed,3,3).forEach(flag);}
 for(const name of ['exciter','pickup']){const p=temporalKeys(o[name],['axis','node_weights']);vector(p.axis);array(p.node_weights,o.nodes.length,o.nodes.length).forEach(real);}
 for(const row of array(o.edges,0,96)){const e=temporalKeys(row,['first','second','section_m2','prestress_newtons']);decimals(e,['first','second']);real(e.section_m2);real(e.prestress_newtons);need(BigInt(e.first)<BigInt(o.nodes.length)&&BigInt(e.second)<BigInt(o.nodes.length),'native physical edge outside body');}return o;
}
const receiverRefs=['receiving_identity','event','subject','preparation','state','source_coordinate','source_revision','eigenbasis','receiver','context','source_motion','receiver_motion','policy','policy_revision','standing'];
export function readCaptureReceiver(value:unknown,body:NativeJsonObject,start:bigint,frames:number,rate:number,eigenbasis?:string){
 const m=temporalKeys(value,['version','sample_rate',...receiverRefs,'source_generation','body_revision','history_origin_sample','origin_sample','end_sample','pratibimba']);need(m.version===1&&m.sample_rate===rate,'callback receiver rate/version differs');refs(m,receiverRefs);decimals(m,['source_generation','body_revision','history_origin_sample','origin_sample','end_sample']);flag(m.pratibimba);
 need(m.event===body.event_ref&&m.subject===body.subject_ref&&m.preparation===body.preparation_ref&&m.state===body.state_ref&&m.body_revision===body.body_revision&&(!eigenbasis||m.eigenbasis===eigenbasis),'original receiver detached native body/work');
 need(BigInt(m.history_origin_sample)<=start&&BigInt(m.origin_sample)<=start&&start+BigInt(frames)<=BigInt(m.end_sample),'captured source span exceeds original receiver segment');return m;
}
function routeManifest(value:unknown,d:NativeJsonObject,body:NativeJsonObject,eigen:string,rate:number){
 const rs=['event_ref','subject_ref','registry_revision','source_revision','definition_ref','source_instance_ref','determination_ref','preparation_ref','state_ref','eigenbasis_identity','m1_coordinate','m2_writer_coordinate','native_basis_sha256','m3_state_sha256'];
 const cs=['version','sample_rate','route_count','source_basis_seal','body_revision','admitted_cursor','m1_revision','m2_generation','m3_generation','m3_input_generation','earth_frame_node_id','tick12','degree720','temporal_phase'];const fs=['scalar_note_gain','legacy_native_scalar_gain','max_force_newtons'];const bs=['m1_pratibimba','m2_pratibimba','scalar_note_enabled','legacy_native_scalar_enabled'];
 const o=temporalKeys(value,[...rs,...cs,...fs,...bs,'programs']);refs(o,rs);decimals(o,cs);fs.forEach(k=>real(o[k]));bs.forEach(k=>flag(o[k]));need(o.version==='1'&&BigInt(o.sample_rate)===BigInt(rate)&&o.event_ref===body.event_ref&&o.subject_ref===body.subject_ref&&o.preparation_ref===body.preparation_ref&&o.state_ref===body.state_ref&&o.body_revision===body.body_revision&&o.eigenbasis_identity===eigen&&o.m1_revision===d.identity.m1_revision&&o.m2_generation===d.identity.m2_generation,'N9 route source/body differs from actual span');
 const r=['driver_ref','target_ref','program_ref','planet_coordinate','chakra_coordinate','projection_ref','calibration_ref','calibration_revision','calibration_source_ref','calibration_standing'];const c=['route_index','preparation_seal','program_seal','planet_node_id','chakra_node_id','native_planet_index','centre_ordinal','share_numerator','share_denominator'];
 const seen=new Set<string>();for(const raw of array(o.programs,0,9)){const p=temporalKeys(raw,[...r,...c,'source_hertz','original_denominator_share','peak_force_newtons']);refs(p,r);decimals(p,c);['source_hertz','original_denominator_share','peak_force_newtons'].forEach(k=>real(p[k]));need(BigInt(p.route_index)<9n&&!seen.has(p.route_index)&&BigInt(p.share_denominator)>0n,'route programme repeated/unbounded');seen.add(p.route_index);}
 need(BigInt(o.route_count)===BigInt(o.programs.length),'N9 route count lost an original descendant');return o;
}
function physicalRoutes(value:unknown,body:NativeJsonObject,start:bigint,frames:number,manifest:NativeJsonObject|null){
 const o=temporalKeys(value,['source_basis_seal','body_revision','earth_frame_node_id','start_sample','end_sample','scalar_m1_enabled','scalar_m1_gain','scalar_peak_applied_force_newtons','peak_total_absolute_force_newtons','routes']);decimals(o,['source_basis_seal','body_revision','earth_frame_node_id','start_sample','end_sample']);flag(o.scalar_m1_enabled);['scalar_m1_gain','scalar_peak_applied_force_newtons','peak_total_absolute_force_newtons'].forEach(k=>real(o[k]));
 if(manifest)need(o.body_revision===body.body_revision&&BigInt(o.start_sample)===start&&BigInt(o.end_sample)===start+BigInt(frames),'physical force routes lost actual callback span');else need(['source_basis_seal','body_revision','earth_frame_node_id','start_sample','end_sample'].every(k=>o[k]==='0')&&o.scalar_m1_enabled===false&&['scalar_m1_gain','scalar_peak_applied_force_newtons','peak_total_absolute_force_newtons'].every(k=>o[k]===0),'absent N9 route observation changed its original empty receipt');
 const seen=new Set<number>();for(const row of array(o.routes,0,9)){const r=temporalKeys(row,['route_index','preparation_seal','planet_node_id','chakra_node_id','native_planet_index','centre_ordinal','enabled','gain','peak_applied_force_newtons']);count(r.route_index,0,8);count(r.native_planet_index,0,11);count(r.centre_ordinal,0,255);decimals(r,['preparation_seal','planet_node_id','chakra_node_id']);flag(r.enabled);real(r.gain);real(r.peak_applied_force_newtons);need(!seen.has(r.route_index),'native force route repeated');seen.add(r.route_index);if(manifest){const p=manifest.programs.find((p:any)=>BigInt(p.route_index)===BigInt(r.route_index));need(p&&r.preparation_seal===p.preparation_seal&&r.planet_node_id===p.planet_node_id&&r.chakra_node_id===p.chakra_node_id&&BigInt(p.native_planet_index)===BigInt(r.native_planet_index)&&BigInt(p.centre_ordinal)===BigInt(r.centre_ordinal),'force receipt changed original N9 programme');}}
 if(manifest)need(o.source_basis_seal===manifest.source_basis_seal&&o.earth_frame_node_id===manifest.earth_frame_node_id&&o.routes.length===manifest.programs.length,'N9 route receipt lost original native source');else need(o.routes.length===0,'route receipt lacks original N9 manifest');return o;
}
export function readTemporalCaptureAudio(a:NativeJsonObject,rate:number,cursor:string):NativeCaptureSourceSpan[]{
 const frames=count(a.frames,1,512),start=BigInt(temporalDecimal(a.start_sample)),progress=readLiveTemporalProgress(a.live_temporal,cursor);need(!progress.failed,'actual programme failed');
 array(a.source_force_vector_newtons,frames,frames).forEach(vector);array(a.source_force_absolute_load_newtons,frames,frames).forEach(v=>need(real(v)>=0,'absolute native force is negative'));
 let offset=0,sequence=a.start_applied_sequence,ordinal=a.start_application_ordinal;
 for(const raw of array(a.source_spans,1,256)){
  const s=temporalKeys(raw,['offset','frames','source_ref','source_index','determination','physical_body','physical_eigenbasis','receiving_manifest','route_manifest','start_applied_sequence','end_applied_sequence','start_application_ordinal','end_application_ordinal','physical_routes','source_force_programme_ref','source_force_receipt','source_force_occurrences']);count(s.offset,0,frames-1);count(s.frames,1,frames-s.offset);refs(s,['source_ref','physical_eigenbasis']);count(s.source_index,0,255);decimals(s,['start_applied_sequence','end_applied_sequence','start_application_ordinal','end_application_ordinal']);
  need(s.offset===offset&&s.start_applied_sequence===sequence&&s.start_application_ordinal===ordinal&&BigInt(s.end_applied_sequence)>=BigInt(sequence)&&BigInt(s.end_application_ordinal)>=BigInt(ordinal),'source span overlaps/loses original application chain');
  const d=determination(s.determination,a.identity),body=physicalBody(s.physical_body,d,rate),at=start+BigInt(s.offset);
  if(s.receiving_manifest!==null)readCaptureReceiver(s.receiving_manifest,body,at,s.frames,rate,s.physical_eigenbasis);
  const routes=s.route_manifest===null?null:routeManifest(s.route_manifest,d,body,s.physical_eigenbasis,rate);physicalRoutes(s.physical_routes,body,at,s.frames,routes);
  const occurrences=array(s.source_force_occurrences,0,256);
  if(s.source_force_programme_ref===null)need(s.source_force_receipt===null&&occurrences.length===0,'absent source-force programme acquired an invented receipt');
  else{
   ref(s.source_force_programme_ref);
   const f=temporalKeys(s.source_force_receipt,['body_revision','start_sample','end_sample','peak_vector_newtons','absolute_impulse_newton_seconds','peak_total_absolute_force_newtons',...(routes?[]:['scalar_m1'])]);
   decimals(f,['body_revision','start_sample','end_sample']);
   ['peak_vector_newtons','absolute_impulse_newton_seconds','peak_total_absolute_force_newtons'].forEach(k=>need(real(f[k])>=0,'negative native force receipt'));
   need(f.body_revision===body.body_revision&&BigInt(f.start_sample)===at&&BigInt(f.end_sample)===at+BigInt(s.frames),'source-force receipt detached its original native callback');
   if(!routes){
    const scalar=temporalKeys(f.scalar_m1,['enabled','gain']);flag(scalar.enabled);real(scalar.gain);
    need(scalar.enabled===true&&Object.is(scalar.gain,1),'no-route source force lost the actual default native M1 scalar operand');
    array(a.force_newtons,frames,frames).forEach(real);
    // This is the original native scalar/absolute-load sum in sample order.
    // The C++ three-argument hypot observation remains original evidence;
    // JavaScript does not manufacture a bit-identical vector norm for it.
    let peak=0;
    for(let i=s.offset;i<s.offset+s.frames;i++)peak=Math.max(peak,a.source_force_absolute_load_newtons[i]+Math.abs(a.force_newtons[i]*scalar.gain));
    need(body.max_force_newtons>0&&peak<=body.max_force_newtons&&Object.is(f.peak_total_absolute_force_newtons,peak),'no-route force total differs from its SAME callback M1/source operands or native body cap');
   }
   let date=at;
   for(const raw of occurrences){const o=temporalKeys(raw,['original_sequence','original_sample','playback_sample','force_vector_newtons','cause_ref','cause_revision']);decimals(o,['original_sequence','original_sample','playback_sample']);refs(o,['cause_ref','cause_revision']);vector(o.force_vector_newtons);const sample=BigInt(o.playback_sample);need(sample>=date&&sample<at+BigInt(s.frames),'source force outside actual ordered span');date=sample;}
  }
  if(offset===0)need(a.preparation_ref===body.preparation_ref&&a.state_ref===body.state_ref&&a.body_revision===body.body_revision&&same(a.identity,d.identity)&&a.has_receiving===(s.receiving_manifest!==null)&&same(a.receiving_manifest,s.receiving_manifest),'top capture scope must be its original FIRST source span');
  offset+=s.frames;sequence=s.end_applied_sequence;ordinal=s.end_application_ordinal;
 }
 const last=a.source_spans[a.source_spans.length-1];need(same(a.end_identity,last.determination.identity)&&progress.current_source_ref===last.source_ref&&progress.current_source_index===last.source_index,'callback end/progress changed its original final output source');
 need(offset===frames&&sequence===a.end_applied_sequence&&ordinal===a.end_application_ordinal,'original callback suffix was lost');return a.source_spans as NativeCaptureSourceSpan[];
}
