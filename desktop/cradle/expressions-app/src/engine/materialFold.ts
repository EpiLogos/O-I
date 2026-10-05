/** Retained material deformation over the existing sampler and entity clock.
 * Local target geometry only: entity placement remains the stage uniform owner,
 * physical evolution remains ql::physical::PhysicalBody. No raster or timer here.
 */
import {resolveSequence, type Entity, type SequenceState} from './fieldModel';
import {drawVolumeZ, mulberry32} from './glyphVolume';
import type {InkField} from './sourceSampling';
import type {GlyphVolumeConfig} from './types';

export const MATERIAL_FOLD_SCHEMA = 'ql.m3-material-fold/v1';
export const MATERIAL_TOPOLOGY = 'ql.square-four-strip-crease-tree/v1';
export const MAX_MATERIAL_SAMPLES = 1048576;
type Vec3 = readonly [number, number, number];
type Bounds = readonly [number, number, number, number];
export type MaterialTreatment = 'glyph-mask'|'sheet';
export interface MaterialSource {reference:string;revision:string;kind:'text'|'image'|'ascii'|'volumetric'}
export interface RetainMaterialInput {
  source:MaterialSource;allocationRef:string;layerId:string;treatment:MaterialTreatment;
  /** Exact source sampler/style/volume/topology options, supplied by its owner. */
  samplingSignature:string;
  stageUnitsPerMaterialUnit:number;targetData:Float32Array;sampleCount:number;
  /** Layer centre is retained in rest depth, not added again after deformation. */
  layerZ?:number;
}
export interface RetainedMaterial {
  readonly source:Readonly<MaterialSource>;readonly allocationRef:string;readonly layerId:string;
  readonly treatment:MaterialTreatment;readonly stageUnitsPerMaterialUnit:number;
  readonly samplingSignature:string;
  readonly layers:readonly {layerId:string;source:Readonly<MaterialSource>;start:number;end:number}[];
  readonly sampleCount:number;readonly sampleIds:readonly string[];readonly preparationKey:string;
}
interface MaterialData {rest:Float64Array;density:Float32Array}
const materials = new WeakMap<RetainedMaterial, MaterialData>();
function requireValue(ok:unknown, message:string):asserts ok {if (!ok) throw new Error(message);}
function reference(s:string) {requireValue(typeof s==='string'&&s.trim().length>0&&s.length<=2048&&!/[\u0000-\u001f\u007f]/.test(s),'bounded printable material reference required');}
function finite(n:number) {requireValue(Number.isFinite(n),'nonfinite material/fold value');return n;}
function exact(n:number) {requireValue(Number.isSafeInteger(n)&&n>=0,'exact nonnegative generation/cursor required');return n;}
function positive(n:number) {finite(n);requireValue(n>=1e-9&&n<=1e9,'positive bounded unit conversion required');return n;}
function vector(v:Vec3) {requireValue(Array.isArray(v)&&v.length===3,'three-component vector required');v.forEach(finite);return v;}
function dataOf(material:RetainedMaterial) {const d=materials.get(material);requireValue(d,'material not prepared by retained sampler');return d;}
function atom(parts:unknown[]) {return JSON.stringify(parts);}
function freezeTree<T>(value:T):T {if(value&&typeof value==='object'&&!Object.isFrozen(value)) {Object.values(value).forEach(freezeTree);Object.freeze(value);}return value;}
// Content fingerprint is an invalidation hint, not source authority. Prepared
// storage is keyed by admitted object identity; no hash hit reuses other data.
function targetFingerprint(data:Float32Array,count:number):string {const bytes=new Uint8Array(data.buffer,data.byteOffset,count*16);let a=2166136261,b=0x9e3779b9;
  for(const byte of bytes) {a=Math.imul(a^byte,16777619);b=Math.imul(b^byte,0x85ebca6b);b=(b<<13)|(b>>>19);}return `${(a>>>0).toString(16)}:${(b>>>0).toString(16)}`;}

/** Capture actual admitted sampler RGBA targets once. Density and depth are
 * retained exactly; sample identity addresses the source/layer/allocation slot.
 * Angle, camera and placement never enter this preparation key. */
export function retainMaterialSamples(input:RetainMaterialInput):RetainedMaterial {
  const {source,allocationRef,layerId,treatment,targetData,sampleCount}=input;
  [source.reference,source.revision,allocationRef,layerId,input.samplingSignature].forEach(reference);
  requireValue(['text','image','ascii','volumetric'].includes(source.kind),'unknown material source kind');
  requireValue(treatment==='glyph-mask'||treatment==='sheet','unknown material treatment');
  const scale=positive(input.stageUnitsPerMaterialUnit), layerZ=finite(input.layerZ??0);
  requireValue(Number.isSafeInteger(sampleCount)&&sampleCount>0&&sampleCount<=MAX_MATERIAL_SAMPLES,'material allocation outside budget');
  requireValue(targetData instanceof Float32Array&&targetData.length>=sampleCount*4,'actual sampler RGBA targets required');
  const rest=new Float64Array(sampleCount*3),density=new Float32Array(sampleCount),ids:string[]=[];
  for(let i=0;i<sampleCount;i++) {
    const u=finite(targetData[4*i])/scale,v=finite(targetData[4*i+1])/scale;
    requireValue(Math.abs(u)<=1+1e-6&&Math.abs(v)<=1+1e-6,'sampler target outside declared square material domain');
    rest[3*i]=u;rest[3*i+1]=v;rest[3*i+2]=(finite(targetData[4*i+2])+layerZ)/scale;
    const d=finite(targetData[4*i+3]);requireValue(d>=0&&d<=1,'material density outside 0..1');density[i]=d;
    ids.push(atom([source.reference,layerId,allocationRef,i]));
  }
  const material:RetainedMaterial=Object.freeze({source:Object.freeze({...source}),allocationRef,layerId,treatment,
    stageUnitsPerMaterialUnit:scale,samplingSignature:input.samplingSignature,layers:freezeTree([{layerId,source:{...source},start:0,end:sampleCount}]),sampleCount,sampleIds:Object.freeze(ids),
    preparationKey:atom([source.reference,source.revision,source.kind,allocationRef,layerId,treatment,scale,sampleCount,layerZ,input.samplingSignature,targetFingerprint(targetData,sampleCount)])});
  materials.set(material,{rest,density});return material;
}

/** Exact existing QL MaterialRestSample input, not a body or Source receipt. */
export interface MaterialRestSample {
  id:string;source_ref:string;source_revision:string;layer_ref:string;
  rest_material:Vec3;density:number;
}
/** Read the already retained samples for the existing native material compiler.
 * Native owner admission/recipe/body/sole pulse remain independent operands.
 * The native typed slice has count/reference bounds, no total JSON byte cap.
 * An explicit serialized transport budget belongs to the invoking owner; when
 * supplied, precharge that whole cohort before retaining any output records. */
export function retainedMaterialRestSamples(material:RetainedMaterial,maxBytes?:number):readonly MaterialRestSample[] {
  const {rest,density}=dataOf(material),encoder=new TextEncoder();
  requireValue(maxBytes===undefined||(Number.isSafeInteger(maxBytes)&&maxBytes>0),'explicit positive serialized material input budget required');
  const nativeRef=(value:string)=>requireValue(typeof value==='string'&&value.trim().length>0&&encoder.encode(value).length<=2048&&!/[\u0000-\u001f\u007f-\u009f]/.test(value),'native material reference outside its actual UTF-8 bound');
  const record=(i:number,layer:RetainedMaterial['layers'][number]):MaterialRestSample=>({id:material.sampleIds[i],source_ref:layer.source.reference,source_revision:layer.source.revision,layer_ref:layer.layerId,rest_material:[rest[3*i],rest[3*i+1],rest[3*i+2]],density:density[i]});
  let bytes=2,layerIndex=0;
  for(let i=0;i<material.sampleCount;i++) {
    while(i>=material.layers[layerIndex].end)layerIndex++;
    const layer=material.layers[layerIndex];
    [material.sampleIds[i],layer.source.reference,layer.source.revision,layer.layerId].forEach(nativeRef);
    if(maxBytes!==undefined) {
      bytes+=encoder.encode(JSON.stringify(record(i,layer))).length+(i?1:0);
      requireValue(bytes<=maxBytes,'complete retained material sample input exceeds the explicit caller byte budget');
    }
  }
  const samples:MaterialRestSample[]=[];layerIndex=0;
  for(let i=0;i<material.sampleCount;i++) {
    while(i>=material.layers[layerIndex].end)layerIndex++;
    const sample=record(i,material.layers[layerIndex]);Object.freeze(sample.rest_material);samples.push(Object.freeze(sample));
  }
  return Object.freeze(samples);
}

/** One partition may retain several native layer sources. Concatenation keeps
 * every source/layer sample ID and depth; it does not rematch or re-sample. */
export function retainLayeredMaterial(input:{source:MaterialSource;allocationRef:string;bodyRef:string;layers:readonly RetainedMaterial[]}):RetainedMaterial {
  [input.source.reference,input.source.revision,input.allocationRef,input.bodyRef].forEach(reference);
  requireValue(input.layers.length>0,'bounded retained layer set required');
  const first=input.layers[0],count=input.layers.reduce((n,layer)=>n+layer.sampleCount,0);
  requireValue(count<=MAX_MATERIAL_SAMPLES,'layered material allocation exceeds budget');
  const rest=new Float64Array(count*3),density=new Float32Array(count),ids:string[]=[],layers:RetainedMaterial['layers'][number][]=[];
  let start=0;
  input.layers.forEach(layer=>{const data=dataOf(layer);requireValue(layer.treatment===first.treatment&&layer.stageUnitsPerMaterialUnit===first.stageUnitsPerMaterialUnit,'layer material treatment/units disagree');
    rest.set(data.rest,start*3);density.set(data.density,start);for(const id of layer.sampleIds)ids.push(id);
    layer.layers.forEach(item=>layers.push({...item,start:item.start+start,end:item.end+start}));start+=layer.sampleCount;});
  requireValue(new Set(ids).size===ids.length,'duplicate retained layer/sample identity');
  const material:RetainedMaterial=Object.freeze({source:Object.freeze({...input.source}),allocationRef:input.allocationRef,layerId:input.bodyRef,
    treatment:first.treatment,stageUnitsPerMaterialUnit:first.stageUnitsPerMaterialUnit,samplingSignature:atom(input.layers.map(l=>l.samplingSignature)),
    layers:freezeTree(layers),sampleCount:count,sampleIds:Object.freeze(ids),
    preparationKey:atom([input.source,input.allocationRef,input.bodyRef,input.layers.map(l=>l.preparationKey)])});
  materials.set(material,{rest,density});return material;
}

/** A full square carrier with the real sampled source as markings. The ink
 * field comes from the existing text/image/ASCII raster. One seeded allocation
 * draws square cells and thickness; subsequent folds reuse the same samples. */
export function retainSheetCarrier(input:Omit<RetainMaterialInput,'targetData'|'treatment'> & {
  inkField:InkField;seed:number;carrierDensity:number;volume?:GlyphVolumeConfig;
}):RetainedMaterial {
  const {inkField:field,sampleCount}=input;
  requireValue(Number.isSafeInteger(sampleCount)&&sampleCount>0&&sampleCount<=MAX_MATERIAL_SAMPLES,'material allocation outside budget');
  requireValue(Number.isSafeInteger(input.seed)&&input.seed>=0&&input.seed<=0xffffffff,'explicit uint32 sheet seed required');
  const baseline=finite(input.carrierDensity);requireValue(baseline>0&&baseline<=1,'sheet carrier must remain visible outside markings');
  const {width:w,height:h,crop,ink}=field;
  requireValue(Number.isSafeInteger(w)&&w>0&&Number.isSafeInteger(h)&&h>0&&ink.length===w*h,'actual bounded source ink field required');
  requireValue(crop.x0>=0&&crop.y0>=0&&crop.x1<w&&crop.y1<h&&crop.x1>=crop.x0&&crop.y1>=crop.y0,'invalid source crop');
  const rand=mulberry32(input.seed),side=Math.ceil(Math.sqrt(sampleCount)),rows=Math.ceil(sampleCount/side),scale=positive(input.stageUnitsPerMaterialUnit);
  const contentSide=Math.max(crop.x1-crop.x0+1,crop.y1-crop.y0+1),cx=(crop.x0+crop.x1+1)/2,cy=(crop.y0+crop.y1+1)/2;
  if(input.volume?.enabled) {finite(input.volume.depth);requireValue(input.volume.depth>=0,'negative sheet thickness');}
  const targets=new Float32Array(sampleCount*4);
  for(let i=0;i<sampleCount;i++) {
    const u=2*((i%side+rand())/side)-1,v=2*((Math.floor(i/side)+rand())/rows)-1;
    const x=Math.floor(cx+u*contentSide/2),y=Math.floor(cy-v*contentSide/2);
    const mark=x>=crop.x0&&x<=crop.x1&&y>=crop.y0&&y<=crop.y1?finite(ink[y*w+x]):0;requireValue(mark>=0&&mark<=1,'ink density outside 0..1');
    targets[4*i]=u*scale;targets[4*i+1]=v*scale;
    targets[4*i+2]=input.volume?.enabled?drawVolumeZ(Math.max(0,input.volume.depth)/2,0,input.volume,rand).z:0;
    targets[4*i+3]=baseline+(1-baseline)*mark;
  }
  return retainMaterialSamples({...input,treatment:'sheet',targetData:targets});
}

export interface FoldPanel {id:string;bounds:Bounds;parent:string|null;crease:number|null}
export interface FoldCrease {id:string;site_index:number;axis_start:Vec3;axis_end:Vec3}
export interface NativeFoldBasis {
  event_ref:string;subject_ref:string;source_coordinate:unknown;source_generation:number;
  source_revision:string;domain_revision:string;registry_revision:string;
}
export interface NativeMaterialFoldPlan extends NativeFoldBasis {
  schema:typeof MATERIAL_FOLD_SCHEMA;topology_ref:typeof MATERIAL_TOPOLOGY;
  recipe_ref:string;recipe_revision:string;material_treatment:MaterialTreatment;
  stage_units_per_material_unit:number;metres_per_material_unit:number;
  panels:FoldPanel[];creases:FoldCrease[];crease_angles_rad:number[];site_velocities_deg10:number[];
  pose_axis:Vec3;pose_angle_rad:number;native_state:Record<string,any>;construction_standing:string;
  pose_projection:{rotation_slot:number;rotation_degrees:number;slot_degrees:number;pose_ordinal:number};
}
const plans = new WeakSet<NativeMaterialFoldPlan>();
function same(a:unknown,b:unknown) {return JSON.stringify(a)===JSON.stringify(b);}
/** The host supplies the admitted current basis. This parser grants no native
 * authority; it fences disconnected/stale transported source on the consumer. */
export function admitNativeMaterialFold(plan:NativeMaterialFoldPlan,expected:NativeFoldBasis):NativeMaterialFoldPlan {
  requireValue(plan.schema===MATERIAL_FOLD_SCHEMA&&plan.topology_ref===MATERIAL_TOPOLOGY,'material fold contract mismatch');
  for(const k of ['event_ref','subject_ref','source_revision','domain_revision','registry_revision'] as const) {
    reference(plan[k]);requireValue(plan[k]===expected[k],`material fold ${k} mismatch`);
  }
  exact(plan.source_generation);requireValue(plan.source_generation===expected.source_generation,'material fold generation mismatch');
  requireValue(same(plan.source_coordinate,expected.source_coordinate),'material fold exact coordinate/face mismatch');
  const state=plan.native_state,coord=plan.source_coordinate as any;
  requireValue(state?.schema==='ql.m3-state/v1'&&state.subject_ref===plan.subject_ref&&
    state.identity?.event_ref===plan.event_ref&&state.identity?.profile_generation===plan.source_generation&&
    state.source_revision===plan.source_revision&&state.domain_revision===plan.domain_revision&&
    state.registry_revision===plan.registry_revision,'material fold native state disconnected');
  requireValue(coord?.source_ref===state.form?.codon?.ref&&['bimba','pratibimba'].includes(coord.face),'material fold wrong native form or face');
  requireValue(plan.crease_angles_rad.length===3&&plan.site_velocities_deg10.length===3,'three native sites required');
  plan.crease_angles_rad.forEach((angle,i)=>requireValue(Math.abs(finite(angle)-state.form.angles_deg10[i]*Math.PI/1800)<1e-14,'material fold signed site mismatch'));
  requireValue(same(plan.site_velocities_deg10,state.form.velocities_deg10),'material fold mobility mismatch');
  reference(plan.recipe_ref);reference(plan.recipe_revision);reference(plan.construction_standing);
  positive(plan.stage_units_per_material_unit);positive(plan.metres_per_material_unit);vector(plan.pose_axis);finite(plan.pose_angle_rad);
  requireValue(same(plan.pose_axis,[[1,0,0],[0,1,0],[0,0,1]][state.form.matrix_axis]),'material fold native pose axis mismatch');
  requireValue(plan.pose_projection?.rotation_slot===state.form.pose&&plan.pose_projection.pose_ordinal===state.form.pose_ordinal&&
    plan.pose_projection.slot_degrees===45&&plan.pose_projection.rotation_degrees===state.form.pose*plan.pose_projection.slot_degrees&&
    Math.abs(plan.pose_angle_rad-plan.pose_projection.rotation_degrees*Math.PI/180)<1e-14,'material fold native ranked pose mismatch');
  const admitted=freezeTree(structuredClone(plan));plans.add(admitted);return admitted;
}

export interface PreparedMaterialFold {readonly material:RetainedMaterial;readonly plan:NativeMaterialFoldPlan;readonly panelIds:readonly string[]}
interface FoldData {panelForSample:Int16Array;panels:FoldPanel[];creases:FoldCrease[];order:number[];parent:Int16Array}
const folds=new WeakMap<PreparedMaterialFold,FoldData>();
/** Validate a rooted crease tree and exact material membership before entering
 * the frame loop. Coupled/cyclic constraints require the physical owner solver
 * and are explicitly refused by this rigid-panel evaluator. */
export function prepareFold(material:RetainedMaterial,plan:NativeMaterialFoldPlan):PreparedMaterialFold {
  requireValue(plans.has(plan),'native material fold not admitted against current host basis');
  requireValue(material.treatment===plan.material_treatment&&material.stageUnitsPerMaterialUnit===plan.stage_units_per_material_unit,'material treatment/unit mismatch');
  const {rest}=dataOf(material),panels=structuredClone(plan.panels),creases=structuredClone(plan.creases);
  requireValue(panels.length>0&&panels.length<=64&&creases.length<=63,'panel/crease preparation budget exceeded');
  // This version declares the native four-strip construction, rather than an
  // arbitrary valid tree. Exact adjacency and directed shared edges prevent a
  // transported plan from opening material seams while retaining source labels.
  const cuts=[-1,-.5,0,.5,1];requireValue(panels.length===4&&creases.length===3,'native strip topology cardinality mismatch');
  panels.forEach((p,i)=>requireValue(p.id===`panel-${i}`&&same(p.bounds,[cuts[i],cuts[i+1],-1,1])&&
    p.parent===(i?`panel-${i-1}`:null)&&p.crease===(i?i-1:null),'native strip panel adjacency mismatch'));
  creases.forEach((c,i)=>requireValue(c.id===`site-${['X','Y','Z'][i]}`&&c.site_index===i&&
    same(c.axis_start,[cuts[i+1],-1,0])&&same(c.axis_end,[cuts[i+1],1,0]),'native shared crease boundary/orientation mismatch'));
  const byId=new Map<string,number>();
  panels.forEach((p,i)=>{reference(p.id);requireValue(!byId.has(p.id),'duplicate panel identity');byId.set(p.id,i);
    requireValue(p.bounds.length===4,'panel rectangle required');p.bounds.forEach(finite);
    requireValue(p.bounds[0]<p.bounds[1]&&p.bounds[2]<p.bounds[3]&&p.bounds.every(v=>v>=-1&&v<=1),'panel outside material square');});
  creases.forEach(c=>{reference(c.id);vector(c.axis_start);vector(c.axis_end);requireValue(Number.isInteger(c.site_index)&&c.site_index>=0&&c.site_index<3,'unknown native crease site');
    requireValue(Math.hypot(...c.axis_end.map((v,i)=>v-c.axis_start[i]))>1e-12,'degenerate crease axis');});
  const parent=new Int16Array(panels.length).fill(-1),order:number[]=[],visited=new Uint8Array(panels.length);
  requireValue(panels.filter(p=>p.parent===null).length===1,'one root panel required');
  panels.forEach((p,i)=>{if(p.parent===null) {requireValue(p.crease===null,'root cannot carry hinge');return;}
    requireValue(byId.has(p.parent)&&p.parent!==p.id&&Number.isInteger(p.crease)&&p.crease!==null&&p.crease>=0&&p.crease<creases.length,'disconnected panel/crease');parent[i]=byId.get(p.parent)!;});
  const walk=(i:number)=>{requireValue(visited[i]!==1,'coupled crease cycle requires native constrained solver');if(visited[i]===2)return;visited[i]=1;
    if(parent[i]>=0)walk(parent[i]);visited[i]=2;order.push(i);};panels.forEach((_,i)=>walk(i));
  // Rectangle interiors cannot overlap; ensure the entire square is covered.
  let area=0;panels.forEach((p,i)=>{area+=(p.bounds[1]-p.bounds[0])*(p.bounds[3]-p.bounds[2]);
    panels.slice(0,i).forEach(q=>requireValue(Math.min(p.bounds[1],q.bounds[1])-Math.max(p.bounds[0],q.bounds[0])<=1e-12||
      Math.min(p.bounds[3],q.bounds[3])-Math.max(p.bounds[2],q.bounds[2])<=1e-12,'overlapping panel interiors'));});
  requireValue(Math.abs(area-4)<1e-12,'panel topology leaves material gap');
  const membership=new Int16Array(material.sampleCount);
  for(let i=0;i<material.sampleCount;i++) {const u=rest[3*i],v=rest[3*i+1];
    const found=panels.findIndex(p=>u>=p.bounds[0]-1e-6&&u<=p.bounds[1]+1e-6&&v>=p.bounds[2]-1e-6&&v<=p.bounds[3]+1e-6);
    requireValue(found>=0,'rest sample has no panel');membership[i]=found;}
  const prepared=Object.freeze({material,plan:freezeTree(structuredClone(plan)),panelIds:Object.freeze(panels.map(p=>p.id))});
  folds.set(prepared,{panelForSample:membership,panels,creases,order,parent});return prepared;
}

type Transform={r:number[];t:number[]};
const identity=():Transform=>({r:[1,0,0,0,1,0,0,0,1],t:[0,0,0]});
function apply(t:Transform,p:Vec3):[number,number,number] {return [
  t.r[0]*p[0]+t.r[1]*p[1]+t.r[2]*p[2]+t.t[0],
  t.r[3]*p[0]+t.r[4]*p[1]+t.r[5]*p[2]+t.t[1],
  t.r[6]*p[0]+t.r[7]*p[1]+t.r[8]*p[2]+t.t[2]];}
function rotation(start:Vec3,end:Vec3,angle:number):Transform {
  const axis=end.map((v,i)=>v-start[i]),n=Math.hypot(...axis);requireValue(n>1e-12,'degenerate rotation axis');
  const [x,y,z]=axis.map(v=>v/n),c=Math.cos(angle),s=Math.sin(angle),d=1-c;
  const result:Transform={r:[c+x*x*d,x*y*d-z*s,x*z*d+y*s,y*x*d+z*s,c+y*y*d,y*z*d-x*s,z*x*d-y*s,z*y*d+x*s,c+z*z*d],t:[0,0,0]};
  const origin=apply(result,start);result.t=start.map((v,i)=>v-origin[i]);return result;
}
function compose(a:Transform,b:Transform):Transform {
  const r=Array<number>(9).fill(0);for(let row=0;row<3;row++)for(let col=0;col<3;col++)for(let k=0;k<3;k++)r[row*3+col]+=a.r[row*3+k]*b.r[k*3+col];
  return {r,t:apply(a,b.t as unknown as Vec3)};
}
export interface FoldControl {sourceGeneration:number;creaseAnglesRad:readonly number[];poseAxis:Vec3;poseAngleRad:number}
export function nativeFoldControl(plan:NativeMaterialFoldPlan):FoldControl {return {sourceGeneration:plan.source_generation,creaseAnglesRad:plan.crease_angles_rad,poseAxis:plan.pose_axis,poseAngleRad:plan.pose_angle_rad};}
/** Each child hinge rotates in its parent's transformed frame. Thickness is a
 * rest coordinate and rotates with the same rigid panel. Output remains local;
 * stage/entity placement is applied exactly once by existing uniforms. */
export function evaluateFold(prepared:PreparedMaterialFold,control:FoldControl,
  target=new Float32Array(prepared.material.sampleCount*4)):Float32Array {
  const fd=folds.get(prepared);requireValue(fd,'fold not prepared');
  requireValue(exact(control.sourceGeneration)===prepared.plan.source_generation,'stale fold control generation');
  requireValue(control.creaseAnglesRad.length===3,'three crease control angles required');control.creaseAnglesRad.forEach(finite);
  vector(control.poseAxis);finite(control.poseAngleRad);requireValue(Math.hypot(...control.poseAxis)>1e-12,'pose axis required');
  requireValue(target.length>=prepared.material.sampleCount*4,'target allocation too small');
  const transforms:Transform[]=Array(fd.panels.length),pose=rotation([0,0,0],control.poseAxis,control.poseAngleRad);
  for(const i of fd.order) {const p=fd.panels[i];transforms[i]=p.parent===null?identity():compose(transforms[fd.parent[i]],
    rotation(fd.creases[p.crease!].axis_start,fd.creases[p.crease!].axis_end,control.creaseAnglesRad[fd.creases[p.crease!].site_index]));}
  // Compose once per rigid panel. The retained point loop allocates no vectors
  // or matrices; placement and density still retain the exact same owners.
  const posed=transforms.map(transform=>compose(pose,transform));
  const {rest,density}=dataOf(prepared.material),scale=prepared.material.stageUnitsPerMaterialUnit;
  for(let i=0;i<prepared.material.sampleCount;i++) {const {r,t}=posed[fd.panelForSample[i]],x=rest[3*i],y=rest[3*i+1],z=rest[3*i+2];
    target[4*i]=(r[0]*x+r[1]*y+r[2]*z+t[0])*scale;
    target[4*i+1]=(r[3]*x+r[4]*y+r[5]*z+t[1])*scale;
    target[4*i+2]=(r[6]*x+r[7]*y+r[8]*z+t[2])*scale;target[4*i+3]=density[i];}
  return target;
}

export interface FoldLinkControl {creaseAnglesRad:readonly number[];poseAngleRad:number}
export interface FoldInterruption {sequence:SequenceState;control:FoldControl;policy:'hold';simTime:number}
/** Consume the existing sequence resolver's eased cursor. Seeking passes a new
 * owner simTime; hold/interruption pins the recorded commanded state. There is
 * no frame-time integration or clock in this component. */
export function resolveFoldSequence(prepared:PreparedMaterialFold,entity:Entity,simTime:number,
  drivePhase:number,manualMorph:number,holdRatio:number,controls:ReadonlyMap<string,FoldLinkControl>,
  interruption?:FoldInterruption):{sequence:SequenceState;control:FoldControl} {
  [simTime,drivePhase,manualMorph,holdRatio].forEach(finite);
  if(interruption) {requireValue(interruption.policy==='hold'&&interruption.control.sourceGeneration===prepared.plan.source_generation,'incompatible fold interruption');return structuredClone(interruption);}
  const sequence=resolveSequence(entity,simTime,drivePhase,manualMorph,holdRatio),links=entity.sequence.links;
  const fallback={creaseAnglesRad:prepared.plan.crease_angles_rad,poseAngleRad:prepared.plan.pose_angle_rad};
  const a=controls.get(links[sequence.linkIndex]?.id)??fallback,b=controls.get(links[sequence.nextIndex]?.id)??fallback;
  requireValue(a.creaseAnglesRad.length===3&&b.creaseAnglesRad.length===3,'sequence fold link requires three angles');
  a.creaseAnglesRad.forEach(finite);b.creaseAnglesRad.forEach(finite);finite(a.poseAngleRad);finite(b.poseAngleRad);
  const t=sequence.phase==='hold'?0:sequence.progress;
  return {sequence,control:{sourceGeneration:prepared.plan.source_generation,
    creaseAnglesRad:a.creaseAnglesRad.map((v,i)=>v+(b.creaseAnglesRad[i]-v)*t),poseAxis:prepared.plan.pose_axis,
    poseAngleRad:a.poseAngleRad+(b.poseAngleRad-a.poseAngleRad)*t}};
}
export function interruptFoldSequence(reading:ReturnType<typeof resolveFoldSequence>,simTime:number):FoldInterruption {
  return structuredClone({...reading,simTime:finite(simTime),policy:'hold' as const});
}

/** An explicit correspondence transition. Matching allocation slots are named
 * as slots, never passed off as geometric/source equivalence across shapes. */
export function materialCorrespondence(before:RetainedMaterial,after:RetainedMaterial) {
  dataOf(before);dataOf(after);requireValue(before.source.reference===after.source.reference&&before.layerId===after.layerId&&before.allocationRef===after.allocationRef,'different material needs explicit cross-source correspondence');
  const current=new Map(after.sampleIds.map((id,i)=>[id,i])),previous=new Set(before.sampleIds);
  return {kind:'retained-allocation-slot' as const,from:before.preparationKey,to:after.preparationKey,
    pairs:before.sampleIds.flatMap((id,i)=>current.has(id)?[{id,before:i,after:current.get(id)!}]:[]),
    retired:before.sampleIds.filter(id=>!current.has(id)),created:after.sampleIds.filter(id=>!previous.has(id))};
}

export interface BodyProjectionBinding {
  eventRef:string;subjectRef:string;sourceGeneration:number;sourceRevision:string;sourceCoordinate:unknown;
  preparationRef:string;stateRef:string;bodyRevision:number;nodeIds:readonly number[];
  metresPerMaterialUnit:number;sampleNodeWeights:readonly (readonly {nodeId:number;weight:number}[])[];
}
export interface BodyDisplacementSnapshot {
  eventRef:string;preparationRef:string;stateRef:string;bodyRevision:number;sampleCursor:number;
  nodeIds:readonly number[];displacementsMetres:readonly Vec3[];
}
export interface PreparedBodyProjection {readonly fold:PreparedMaterialFold;readonly binding:BodyProjectionBinding}
const bodyProjections=new WeakMap<PreparedBodyProjection,{indices:number[][];weights:number[][]}>();
/** Weights are an explicit renderer-to-body surface correspondence. They are
 * prepared once, and only actual write_displacements output supplies motion. */
export function prepareBodyProjection(fold:PreparedMaterialFold,binding:BodyProjectionBinding):PreparedBodyProjection {
  const plan=fold.plan;requireValue(binding.eventRef===plan.event_ref&&binding.subjectRef===plan.subject_ref&&
    binding.sourceGeneration===plan.source_generation&&binding.sourceRevision===plan.source_revision&&
    same(binding.sourceCoordinate,plan.source_coordinate),'disconnected material/body source binding');
  [binding.preparationRef,binding.stateRef].forEach(reference);exact(binding.bodyRevision);
  requireValue(binding.metresPerMaterialUnit===plan.metres_per_material_unit,'material/body unit mismatch');
  requireValue(binding.nodeIds.length>0&&binding.nodeIds.length<=32&&new Set(binding.nodeIds).size===binding.nodeIds.length,'physical node identities invalid');binding.nodeIds.forEach(exact);
  requireValue(binding.sampleNodeWeights.length===fold.material.sampleCount,'body correspondence must cover every retained sample');
  const indices:number[][]=[],weights:number[][]=[];
  binding.sampleNodeWeights.forEach(row=>{requireValue(row.length>0&&row.length<=32,'bounded body sample weights required');let sum=0;const seen=new Set<number>();
    indices.push(row.map(p=>{const index=binding.nodeIds.indexOf(p.nodeId);requireValue(index>=0&&!seen.has(p.nodeId),'unknown/duplicate body correspondence node');seen.add(p.nodeId);requireValue(finite(p.weight)>=0&&p.weight<=1,'body correspondence weight outside 0..1');sum+=p.weight;return index;}));
    requireValue(Math.abs(sum-1)<1e-12,'body correspondence weights must partition unity');weights.push(row.map(p=>p.weight));});
  const prepared=Object.freeze({fold,binding:freezeTree(structuredClone(binding))});bodyProjections.set(prepared,{indices,weights});return prepared;
}
/** Add the real physical owner's q displacement to commanded local targets.
 * It neither evolves a body nor certifies target-only reception as observed. */
export function applyBodyDisplacements(projection:PreparedBodyProjection,target:Float32Array,
  observed:BodyDisplacementSnapshot,expectedSampleCursor:number,output=new Float32Array(target.length)):Float32Array {
  const data=bodyProjections.get(projection);requireValue(data,'body projection not prepared');const b=projection.binding;
  requireValue(observed.eventRef===b.eventRef&&observed.preparationRef===b.preparationRef&&observed.stateRef===b.stateRef&&
    observed.bodyRevision===b.bodyRevision&&exact(observed.sampleCursor)===exact(expectedSampleCursor)&&same(observed.nodeIds,b.nodeIds),'disconnected/stale physical displacement observation');
  requireValue(observed.displacementsMetres.length===b.nodeIds.length,'physical displacement observation incomplete');observed.displacementsMetres.forEach(vector);
  requireValue(target.length>=projection.fold.material.sampleCount*4,'physical target allocation too small');
  const overlaps=output.buffer===target.buffer&&output.byteOffset<target.byteOffset+target.byteLength&&target.byteOffset<output.byteOffset+output.byteLength;
  requireValue(output.length>=target.length&&!overlaps,'separate physical projection output required');output.set(target);
  const scale=projection.fold.material.stageUnitsPerMaterialUnit/b.metresPerMaterialUnit;
  for(let i=0;i<data.indices.length;i++)for(let j=0;j<3;j++) {let displacement=0;data.indices[i].forEach((node,k)=>{displacement+=observed.displacementsMetres[node][j]*data.weights[i][k];});output[4*i+j]+=displacement*scale;}
  return output;
}

/** The value-copy of ql::PhysicalSnapshot. The host serialises only the active
 * node prefix after callback/stopped acknowledgement at this same cursor. */
export interface PhysicalNodeSnapshot {
  version:1;event_ref:string;subject_ref:string;preparation_ref:string;state_ref:string;
  source_coordinate:string;source_revision:string;source_generation:number;pratibimba:boolean;
  geometry_ref:string;geometry_revision:string;material_ref:string;material_revision:string;
  body_revision:number;sample_rate:number;samples_elapsed:string|number;node_count:number;
  node_identity:readonly number[];visible_positions_metres:readonly Vec3[];
  pickup_linear:number;mechanical_energy_joules:number;
}
interface FrameWeight {node_id:number;weight:number;ds:number;dt:number}
interface FrameSample {sample:MaterialRestSample;
  patch:number;depth_metres:number;normal:Vec3;rest_metres:Vec3;local_stage:Vec3;node_weights:FrameWeight[]}
export interface NativeBodyMaterial {
  schema:'ql.m3-body-material/v1';material:NativeMaterialFoldPlan;body:Record<string,any>;body_recipe:Record<string,any>;
  bounds:{max_layer_depth_metres:number;max_displacement_metres:number;material_domain:number[]};
  samples:FrameSample[];numerical_owner:'ql::physical::PhysicalBody';surface_law:string;
}
export interface PreparedNativeBodyMaterial {readonly material:RetainedMaterial;readonly native:NativeBodyMaterial}
const frameProjections=new WeakMap<PreparedNativeBodyMaterial,{indices:ReadonlyMap<number,number>;positions:Float64Array}>();
function cursor(value:string|number):string {
  if(typeof value==='number')return String(exact(value));
  requireValue(typeof value==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(value)&&BigInt(value)<=18446744073709551615n,'canonical uint64 physical cursor required');return value;
}
function weightedFrame(nodes:readonly Vec3[],weights:readonly FrameWeight[],key:'weight'|'ds'|'dt',indices:ReadonlyMap<number,number>):[number,number,number] {
  return [0,1,2].map(axis=>weights.reduce((sum,w)=>sum+nodes[indices.get(w.node_id)!][axis]*w[key],0)) as [number,number,number];
}
function framePosition(nodes:readonly Vec3[],sample:FrameSample,indices:ReadonlyMap<number,number>):[number,number,number] {
  const origin=weightedFrame(nodes,sample.node_weights,'weight',indices),a=weightedFrame(nodes,sample.node_weights,'ds',indices),b=weightedFrame(nodes,sample.node_weights,'dt',indices);
  const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n);
  requireValue(length>=1e-12,'degenerate observed material face');return origin.map((v,i)=>v+sample.depth_metres*n[i]/length) as [number,number,number];
}
/** Host admission supplies the exact current prepared body bytes independently
 * of the transported material. This verifies material sampling, source and the
 * native frame law, then retains immutable geometry for the actual q-v owner. */
export function prepareNativeBodyMaterial(material:RetainedMaterial,plan:NativeMaterialFoldPlan,
  payload:NativeBodyMaterial,expectedPreparedBody:unknown,expectedSourceRecipe:unknown):PreparedNativeBodyMaterial {
  requireValue(plans.has(plan)&&payload.schema==='ql.m3-body-material/v1'&&same(payload.material,plan)&&same(payload.body,expectedPreparedBody)&&same(payload.body_recipe,expectedSourceRecipe),'disconnected native body/material preparation or source recipe');
  const body=payload.body,recipe=payload.body_recipe,request=body.request,geometry=request?.geometry;
  requireValue(body.event_ref===plan.event_ref&&body.subject_ref===plan.subject_ref&&body.source_generation===plan.source_generation&&
    body.source_revision===plan.source_revision&&same(body.source_coordinate,plan.source_coordinate),'native body material wrong event/subject/source/face');
  requireValue(material.treatment===plan.material_treatment&&material.stageUnitsPerMaterialUnit===plan.stage_units_per_material_unit,'native body material units/treatment mismatch');
  requireValue(payload.numerical_owner==='ql::physical::PhysicalBody'&&same(geometry?.provenance,recipe.provenance),'native body material mechanical owner/law mismatch');
  reference(payload.surface_law);positive(recipe.frame_side_metres);positive(recipe.site_separation_metres);
  requireValue(recipe.site_separation_metres>=2*recipe.frame_side_metres,'native source frame spacing invalid');
  exact(request.body_revision);reference(request.preparation_ref);reference(request.state_ref);
  requireValue(Number.isSafeInteger(request.sample_rate)&&request.sample_rate>=8000&&request.sample_rate<=384000,'native body sample rate invalid');
  const maximum=finite(payload.bounds.max_layer_depth_metres);requireValue(maximum>=0&&maximum<=100&&same(payload.bounds.material_domain,[-1,1,-1,1])&&payload.bounds.max_displacement_metres===request.max_displacement_metres,'native body material bounds mismatch');
  positive(request.max_displacement_metres);requireValue(geometry.nodes?.length===12,'actual twelve-node source frame topology required');
  const nodes:Vec3[]=geometry.nodes.map((node:any,i:number)=>{requireValue(node.identity===i+1,'native source frame node identity mismatch');return vector(node.rest_metres);});
  const indices=new Map(geometry.nodes.map((node:any,i:number)=>[node.identity,i])) as Map<number,number>;
  const {rest,density}=dataOf(material);requireValue(payload.samples.length===material.sampleCount,'native body material correspondence incomplete');
  const half=recipe.frame_side_metres/2,span=recipe.site_separation_metres+half,cuts=[-span,-recipe.site_separation_metres+half,-half,half,recipe.site_separation_metres-half,span];
  const patches=[[1,2,3,4],[2,5,8,3],[5,6,7,8],[6,9,12,7],[9,10,11,12]];
  payload.samples.forEach((record,i)=>{
    const sample=record.sample,layer=material.layers.find(l=>i>=l.start&&i<l.end)!;vector(sample.rest_material);
    requireValue(sample.id===material.sampleIds[i]&&sample.source_ref===layer.source.reference&&sample.source_revision===layer.source.revision&&sample.layer_ref===layer.layerId,'native material sample/source/layer identity mismatch');
    requireValue(sample.rest_material.every((v,axis)=>Math.abs(v-rest[3*i+axis])<=1e-6)&&Math.abs(sample.density-density[i])<1e-7,'native material rest sample/content mismatch');
    const depth=sample.rest_material[2]*plan.metres_per_material_unit;requireValue(record.depth_metres===depth&&Math.abs(depth)<=maximum,'native material layer depth outside declared bound');
    const x=Math.max(-1,Math.min(1,sample.rest_material[0]))*span,t=(Math.max(-1,Math.min(1,sample.rest_material[1]))+1)/2;
    const patch=Math.max(0,cuts.slice(1).findIndex(cut=>x<=cut)),s=(x-cuts[patch])/(cuts[patch+1]-cuts[patch]);
    const weights=[(1-s)*(1-t),s*(1-t),s*t,(1-s)*t],ds=[-(1-t),1-t,t,-t],dt=[-(1-s),-s,s,1-s];
    requireValue(record.patch===patch&&record.node_weights.length===4,'native frame patch correspondence mismatch');
    record.node_weights.forEach((w,j)=>requireValue(w.node_id===patches[patch][j]&&Math.abs(finite(w.weight)-weights[j])<1e-12&&Math.abs(finite(w.ds)-ds[j])<1e-12&&Math.abs(finite(w.dt)-dt[j])<1e-12,'native frame weight/normal law mismatch'));
    const position=framePosition(nodes,record,indices);vector(record.rest_metres);vector(record.local_stage);vector(record.normal);
    const a=weightedFrame(nodes,record.node_weights,'ds',indices),b=weightedFrame(nodes,record.node_weights,'dt',indices),normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...normal);
    requireValue(record.normal.every((v,axis)=>Math.abs(v-normal[axis]/length)<1e-12),'native frame layer normal mismatch');
    requireValue(position.every((v,axis)=>Math.abs(v-record.rest_metres[axis])<1e-10&&Math.abs(v*plan.stage_units_per_material_unit/plan.metres_per_material_unit-record.local_stage[axis])<1e-6),'native frame metric projection mismatch');
  });
  const prepared=Object.freeze({material,native:freezeTree(structuredClone(payload))});frameProjections.set(prepared,{indices,positions:new Float64Array(material.sampleCount*3)});return prepared;
}
/** Consume actual observed rest+q positions at the acknowledged owner cursor.
 * Every surface and layer follows those SAME mechanical nodes. No oscillator,
 * physical timestep or scene-side synthesis is introduced by this projection. */
export function evaluateNativeBodyMaterial(prepared:PreparedNativeBodyMaterial,observed:PhysicalNodeSnapshot,
  expectedSampleCursor:string|number,target=new Float32Array(prepared.material.sampleCount*4)):Float32Array {
  const data=frameProjections.get(prepared);requireValue(data,'native body material not prepared');const payload=prepared.native,body=payload.body,request=body.request,geometry=request.geometry;
  const coordinate=body.source_coordinate;
  requireValue(observed.version===1&&observed.event_ref===body.event_ref&&observed.subject_ref===body.subject_ref&&observed.preparation_ref===request.preparation_ref&&observed.state_ref===request.state_ref&&
    observed.source_coordinate===coordinate.source_ref&&observed.pratibimba===(coordinate.face==='pratibimba')&&observed.source_revision===body.source_revision&&observed.source_generation===body.source_generation&&
    observed.geometry_ref===geometry.provenance.reference&&observed.geometry_revision===geometry.provenance.revision&&observed.material_ref===request.material.provenance.reference&&observed.material_revision===request.material.provenance.revision&&
    observed.body_revision===request.body_revision&&observed.sample_rate===request.sample_rate&&cursor(observed.samples_elapsed)===cursor(expectedSampleCursor),'disconnected/stale actual physical snapshot');
  finite(observed.pickup_linear);requireValue(finite(observed.mechanical_energy_joules)>=0,'invalid observed physical energy');
  requireValue(observed.node_count===12&&observed.node_identity.length>=12&&observed.visible_positions_metres.length>=12,'actual physical node snapshot incomplete');
  const nodes=observed.visible_positions_metres.slice(0,12);nodes.forEach((p,i)=>{vector(p);requireValue(observed.node_identity[i]===geometry.nodes[i].identity,'observed physical node identity mismatch');
    requireValue(Math.hypot(...p.map((v,axis)=>v-geometry.nodes[i].rest_metres[axis]))<=request.max_displacement_metres+1e-12,'observed displacement exceeds admitted body bound');});
  requireValue(target.length>=prepared.material.sampleCount*4,'native body material target allocation too small');
  const scale=payload.material.stage_units_per_material_unit/payload.material.metres_per_material_unit;
  // Validate the ENTIRE observed surface before changing any caller target.
  // A late degenerate face must retain the previously accepted field intact.
  payload.samples.forEach((sample,i)=>{const position=framePosition(nodes,sample,data.indices);for(let axis=0;axis<3;axis++)data.positions[3*i+axis]=position[axis]*scale;});
  payload.samples.forEach((sample,i)=>{for(let axis=0;axis<3;axis++)target[4*i+axis]=data.positions[3*i+axis];target[4*i+3]=sample.sample.density;});return target;
}
