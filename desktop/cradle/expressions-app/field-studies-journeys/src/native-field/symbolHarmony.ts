/** A symbol's own harmony (DLW §20.2: "A symbol has a voice: the symbol translated into sound. It is the symbol's harmony, the chord whose
 * figure on the torus is the symbol's shape, and you hear it from where the symbol stands. The pulse sounds it, as it sounds everything").
 *
 * The owner says where each of the twelve pitch classes stands on the body and what each sounds under the tuning in force (QL scene_field.rs
 * `class_sounds`, read through torusPlay.mjs `classes`). The frame lays the symbol's form on the body where the symbol stands, takes the
 * classes its form covers, and the chord they strike together is the voice: each voice of the tuning by the sum of what the covered classes
 * give it, at the voice's own frequency. Nothing here makes a pitch: the frequencies are the owner's voices, the weights the owner's shape.
 *
 *   classes now (the reading, carried by the pulse) ─▶ the ones under the form ─▶ each voice's summed coupling ─▶ weighted bands
 *
 * The body laid flat is the stage's chart of the torus: one stage unit a side, centred on the stage's origin, φ along x and θ along y (the
 * Torus object's own plate, torusObject.ts `shapePoint('plate')` at `torusCandidates`' scale: 2(R + r) at 200/(R + r) is 400 world units, one
 * stage unit). The torus has no edge, so the chart repeats: a class stands at its point and at every whole stage unit from it.
 * Pure: no DOM, no audio, no clock. */
import {chi,type TorusBody} from '../../../src/engine/torusObject';
import type {EntitySoundPlan} from './entitySound';

const TAU=Math.PI*2;
/** The spanda ring's twelve arcs, six to a sheet of the 720° cover (QL janko.rs POINT_LAW). */
const RING=12,HALF=6;

/** What one class sounds of one voice: what a key of the class struck now gives the voice per unit of amplitude (QL strike_at_tuned). */
export interface ClassSound {mode_ref:string;frequency_hz:number;coupling:number}
/** One class as the reading gives it: its place on its helix (which never moves), its point on the body now, and what it sounds. */
export interface ClassReading {pitch_class:number;pitch_name:string;place_arc:number;phi:number;theta:number;sounds:ClassSound[]}
/** The twelve classes (torusPlay.mjs `classes`): at the reading's steps, with the pulse's rate, or absent with the reason. */
export type ClassesReading=
 |{tuning:string|null;steps:number;steps_per_second:number;by_class:ClassReading[];absentBecause:null}
 |{absentBecause:string};

/** A point on the body after the pulse has turned (QL janko.rs POINT_LAW): one arc a step; φ = 60°·(arcs mod 6) round the ring, θ = 30°·arcs
 * round the tube, the spinor half-angle. */
export function classPoint(placeArc:number,steps:number):{phi:number;theta:number}{
 let arcs=((placeArc+steps)%RING+RING)%RING;if(arcs>=RING)arcs=0;
 let sheet=arcs%HALF;if(sheet>=HALF)sheet=0;
 return {phi:sheet*(Math.PI/(HALF/2)),theta:arcs*(Math.PI/HALF)};
}

/** The classes at `steps`: the reading as it stands at its own steps; between reads, each class's point carried on by the pulse and each
 * coupling the body's shape term at the carried point (the same χ the owner sums, torusObject.ts `chi`). Without the body the reading
 * stands as read: the pulse is not guessed. */
export function classesAt(reading:Extract<ClassesReading,{absentBecause:null}>,body:TorusBody|null,steps:number):ClassReading[]{
 if(!body||!Number.isFinite(steps)||steps===reading.steps)return reading.by_class;
 const voices=new Map(body.voices.map(voice=>[voice.mode_ref,voice]));
 return reading.by_class.map(cls=>{
  const {phi,theta}=classPoint(cls.place_arc,steps);
  return {...cls,phi,theta,sounds:cls.sounds.map(sound=>{
   const voice=voices.get(sound.mode_ref);
   return voice?{...sound,coupling:chi(voice,phi,theta)}:sound;
  })};
 });
}

/** A symbol's form as cells of its own box, row 0 at the top (y up), 1 where the form has a particle. */
export interface FormMask {size:number;cells:Uint8Array}

/** The form a symbol's particles take, as cells of its box: the engine's own pool for it (entityRuntime.ts `formPool`, in the 400-unit box
 * centred on the symbol, y up, before its size, scale and turn). `size` cells a side; by default as many as the pool fills, up to 32.
 * Null when there is no pool. */
export function formMaskOf(points:readonly {x:number;y:number}[]|null|undefined,size?:number):FormMask|null{
 if(!points?.length)return null;
 const n=size??Math.max(4,Math.min(32,Math.round(Math.sqrt(points.length/2))));
 const cells=new Uint8Array(n*n);
 for(const p of points){
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  const col=Math.floor((p.x+200)/400*n),row=Math.floor((200-p.y)/400*n);
  if(col<-1||col>n||row<-1||row>n)continue;
  cells[Math.min(n-1,Math.max(0,row))*n+Math.min(n-1,Math.max(0,col))]=1;
 }
 return {size:n,cells};
}

/** Where a symbol's form lies on the stage: its centre and its box in stage units (its size times its scale) and its turn in degrees. */
export interface Footprint {x:number;y:number;width:number;height:number;rotation:number}

/** Where a class stands on the body laid flat, in stage units (the chart's copy nearest the origin). */
export const chartPlace=(cls:{phi:number;theta:number})=>({x:cls.phi/TAU-.5,y:cls.theta/TAU-.5});

/** The classes the form covers where it lies: each class whose point, or a copy of it a whole stage unit away, falls on a cell of the form.
 * In class order, each once. */
export function coveredClasses(classes:readonly ClassReading[],at:Footprint,mask:FormMask|null):ClassReading[]{
 if(!mask||!(at.width>0)||!(at.height>0))return [];
 const turn=at.rotation*Math.PI/180,co=Math.cos(turn),si=Math.sin(turn),reach=Math.hypot(at.width,at.height)/2;
 const under=(px:number,py:number)=>{
  const dx=px-at.x,dy=py-at.y,lx=(dx*co+dy*si)/at.width,ly=(-dx*si+dy*co)/at.height;
  if(lx<-.5||lx>.5||ly<-.5||ly>.5)return false;
  const col=Math.min(mask.size-1,Math.floor((lx+.5)*mask.size)),row=Math.min(mask.size-1,Math.floor((.5-ly)*mask.size));
  return mask.cells[row*mask.size+col]===1;
 };
 return classes.filter(cls=>{
  const p=chartPlace(cls);
  for(let i=Math.ceil(at.x-reach-p.x);i<=Math.floor(at.x+reach-p.x);i++)
   for(let j=Math.ceil(at.y-reach-p.y);j<=Math.floor(at.y+reach-p.y);j++)if(under(p.x+i,p.y+j))return true;
  return false;
 }).sort((a,b)=>a.pitch_class-b.pitch_class);
}

/** One band of a harmony: a band-pass at a voice's own frequency, at the chord's weight for that voice. */
export interface HarmonyBand {centreHz:number;widthHz:number;q:number;
 /** The voice's summed coupling over the covered classes, over the loudest voice's: 0 to 1. */
 gain:number;modeRefs:string[]}
export type Harmony=
 |{state:'carrying';harmony:{classes:number[];bands:HarmonyBand[]}}
 |{state:'absent';because:string};

/** The audible range in Hz (symbolVoices.ts AUDIBLE_HZ): a band stands only inside it, and below the device's Nyquist. */
const LOW=20,HIGH=20000;

/** The chord the covered classes strike: struck together at one amplitude each, a voice takes the sum of their couplings (QL
 * strike_at_tuned), so each voice of the tuning is a band at its own frequency weighted by that sum's size against the loudest. Every
 * voice of the tuning keeps its band (a voice the chord leaves still is at 0), so moving the symbol moves the weights and never the bank;
 * a band's width is half the distance to the nearer voice, a lone one half its own frequency. */
export function harmonyOf(covered:readonly ClassReading[],sampleRate:number):Harmony{
 if(!covered.length)return {state:'absent',because:'Its form covers none of the twelve classes where it stands now: the pulse sounds it when a class passes under it'};
 const high=Math.min(HIGH,sampleRate/2),byHz=new Map<number,{sum:number;modeRefs:string[]}>();
 const sums=new Map<string,{hz:number;sum:number}>();
 for(const cls of covered)for(const sound of cls.sounds){
  const entry=sums.get(sound.mode_ref)??{hz:sound.frequency_hz,sum:0};entry.sum+=sound.coupling;sums.set(sound.mode_ref,entry);
 }
 for(const [ref,{hz,sum}] of sums){
  if(!(hz>=LOW&&hz<high))continue;
  const entry=byHz.get(hz)??{sum:0,modeRefs:[]};entry.sum+=Math.abs(sum);entry.modeRefs.push(ref);byHz.set(hz,entry);
 }
 const loudest=Math.max(0,...[...byHz.values()].map(entry=>entry.sum));
 const names=covered.map(cls=>cls.pitch_name).join(', ');
 if(!byHz.size)return {state:'absent',because:`The classes its form covers (${names}) sound no voice in the audible range`};
 if(!(loudest>1e-12))return {state:'absent',because:`The classes its form covers (${names}) strike no voice where they stand now: each stands on every voice's node`};
 const centres=[...byHz.keys()].sort((a,b)=>a-b);
 const bands=centres.map((hz,i)=>{
  const below=i>0?hz-centres[i-1]:Infinity,above=i<centres.length-1?centres[i+1]-hz:Infinity,nearest=Math.min(below,above);
  const widthHz=(Number.isFinite(nearest)?nearest:hz)/2,entry=byHz.get(hz)!;
  return {centreHz:hz,widthHz,q:hz/widthHz,gain:entry.sum/loudest,modeRefs:entry.modeRefs};
 });
 return {state:'carrying',harmony:{classes:covered.map(cls=>cls.pitch_class),bands}};
}

/** The minimal entity the harmonies read (model.ts Entity): where it stands, its box, scale and turn. */
interface StandingEntity {id:string;position:{x:number;y:number};size:{x:number;y:number};rotation:number;scale?:number}

/** The harmony of every voice of the plan that carries no name or mode (a name or a mode stands in for the translation, so those have
 * none): its form laid where its symbol stands, on the classes as they stand at `steps`. `formOf` gives a symbol's form (formMaskOf over
 * the engine's pool), or null before its particles are baked. */
export function symbolHarmonies(entities:readonly StandingEntity[],plan:EntitySoundPlan,classes:ClassesReading,body:TorusBody|null,steps:number,
 formOf:(entityId:string)=>FormMask|null,sampleRate:number):Map<string,Harmony>{
 const out=new Map<string,Harmony>();
 const translated=plan.voices.filter(voice=>!voice.carry);
 if(!translated.length)return out;
 if(classes.absentBecause!==null){for(const voice of translated)out.set(voice.entityId,{state:'absent',because:classes.absentBecause});return out;}
 const now=classesAt(classes,body,steps);
 for(const voice of translated){
  const entity=entities.find(e=>e.id===voice.entityId);
  if(!entity){out.set(voice.entityId,{state:'absent',because:'This symbol is not on the stage, so its form lies on no class'});continue;}
  const mask=formOf(entity.id);
  if(!mask){out.set(voice.entityId,{state:'absent',because:"This symbol's form is not sampled yet, so it covers no class"});continue;}
  const scale=entity.scale??1;
  out.set(voice.entityId,harmonyOf(coveredClasses(now,{x:entity.position.x,y:entity.position.y,width:entity.size.x*scale,height:entity.size.y*scale,rotation:entity.rotation},mask),sampleRate));
 }
 return out;
}
