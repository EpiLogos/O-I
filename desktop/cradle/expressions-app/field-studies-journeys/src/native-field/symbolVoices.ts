/** A symbol's voice as sound (DLW §20.2: "A symbol can carry a voice: a name or a mode from M2′'s store of sound (§22.1). The voice carries
 * part of the torus's sound to where the symbol stands. It does not sound on its own").
 *
 * There is no oscillator here. A voice listens to the torus: the controller owns a tap on the torus's output (controller.ts `voiceTap`,
 * after the presentation level and before the torus's effects) and a voice takes its input from that node, in that audio context.
 *
 *   torus tap ─▶ band-pass bank at the mode's degrees ─▶ the symbol's own envelope ─▶ its stereo place ─▶ the device
 *
 * The bank. A mode (a row of the catalogue, modeCatalogue.ts) states its degrees as ratios above the root. The root is the owner's 1:1:
 * the frequency of the voice the owner names at the map's Sun (M2-5-(0/1), the 1:1 of M2-5's scale-degree table), read off the instrument
 * and never assumed (torusPlay.mjs `root`). The degrees repeat through the audible octaves. Each band is a band-pass filter at one
 * degree whose width is half the distance to the nearer neighbouring degree, so the width comes from the mode and nothing else.
 * Voices that carry the same mode share one bank; each has its own envelope and place.
 *
 * Silence is the torus's: while the torus plays nothing the bank has no input, and the voice makes nothing. A voice that carries a name
 * the store serves no sound for is absent and says the store's own reason; a mode is never put in a name's place.
 * The stereo place is the symbol's place on the stage (placeOf), from the stage's own projection (camera.ts `project`). */
import type {EntityVoice, EntitySoundPlan, VoiceCarry} from './entitySound';
import type {ModeCatalogue, ModeRow} from './modeCatalogue';

/** The audible range in Hz. A band stands only inside it (and below the device's Nyquist). */
export const AUDIBLE_HZ=Object.freeze({low:20,high:20000});
/** The torus's 1:1: the owner's voice at the map's Sun, M2-5-(0/1) (docs: M2-PARASHAKTI P2-F5-SUN; the scene owner's `planet_ref`). */
export const ROOT_PLANET_REF='#2-5-0/1';

/** One band of a bank: a band-pass at a degree of the mode, in one octave. */
export interface Band {
 centreHz:number;
 /** The −3 dB bandwidth in Hz: half the distance to the nearer neighbouring band. */
 widthHz:number;
 /** centre / width. */
 q:number;
 /** The degree of the mode (0 is the root) and the octave above the root (negative below it). */
 degree:number;
 octave:number;
}

/** The bands of a mode over a root, through the audible octaves, in ascending order. The width of each is half the distance to the nearer
 * neighbouring degree (the one below or the one above, whichever is closer), so it comes from the mode. Pure. */
export function bandPlan(ratios:readonly number[],rootHz:number,sampleRate:number):Band[]{
 if(!(rootHz>0)||!Number.isFinite(rootHz)||!ratios.length)return [];
 const high=Math.min(AUDIBLE_HZ.high,sampleRate/2),low=AUDIBLE_HZ.low;
 const raw:Array<{hz:number;degree:number;octave:number}>=[];
 const first=Math.floor(Math.log2(low/rootHz))-1,last=Math.ceil(Math.log2(high/rootHz))+1;
 for(let octave=first;octave<=last;octave++)ratios.forEach((ratio,degree)=>{
  const hz=rootHz*2**octave*ratio;
  if(hz>=low&&hz<high)raw.push({hz,degree,octave});
 });
 raw.sort((a,b)=>a.hz-b.hz);
 const centres=raw.filter((entry,i)=>i===0||entry.hz-raw[i-1].hz>entry.hz*1e-9);
 return centres.map((entry,i)=>{
  const below=i>0?entry.hz-centres[i-1].hz:Infinity,above=i<centres.length-1?centres[i+1].hz-entry.hz:Infinity;
  // A lone band has no neighbour in the audible range: its neighbour is the same degree an octave away, at a distance of its own frequency.
  const nearest=Math.min(below,above),distance=Number.isFinite(nearest)?nearest:entry.hz;
  const widthHz=distance/2;
  return {centreHz:entry.hz,widthHz,q:entry.hz/widthHz,degree:entry.degree,octave:entry.octave};
 });
}

/** What a symbol's voice carries now, resolved against the store and the torus. */
export type Carried=
 |{state:'carrying';mode:ModeRow;bands:Band[];rootHz:number;tuning:string}
 |{state:'absent';because:string};

/** The owner's 1:1, as the instrument reading gives it (torusPlay.mjs `root`). */
export interface TorusRoot {hz:number|null;absentBecause:string|null}

/** Resolve one carry. A mode is a row of the catalogue; a name is an entry of the store, which the catalogue serves no sound for today:
 * it is absent with the store's own reason. Never a mode in place of a name. */
export function resolveCarry(carry:VoiceCarry,catalogue:ModeCatalogue|null,catalogueWhy:string|null,root:TorusRoot,sampleRate:number):Carried{
 if(!catalogue)return {state:'absent',because:catalogueWhy??'The mode catalogue has not been read yet'};
 if(carry.kind==='name'){
  const entry=catalogue.absent.get(carry.ref);
  return {state:'absent',because:entry?`${entry.name} (${entry.status}): ${entry.reason}`:`The store names no "${carry.ref}", so this voice has no sound to carry`};
 }
 const mode=catalogue.modes.get(carry.ref);
 if(!mode)return {state:'absent',because:`The mode catalogue has no mode "${carry.ref}"`};
 if(root.hz===null||!(root.hz>0))return {state:'absent',because:root.absentBecause??"The torus's root is not given"};
 const bands=bandPlan(mode.ratios,root.hz,sampleRate);
 if(!bands.length)return {state:'absent',because:`No degree of ${mode.label} falls in the audible range over a root of ${root.hz} Hz`};
 return {state:'carrying',mode,bands,rootHz:root.hz,tuning:mode.tuning};
}

/** The stereo place of a symbol, −1 (left) to 1 (right): where its screen x stands in the stage's width. Pure. The stage's own projection
 * (camera.ts `project`) gives x; the place is that x measured from the stage's middle in half-widths. */
export function placeOf(screenX:number,stageWidth:number):number{
 if(!(stageWidth>0)||!Number.isFinite(screenX))return 0;
 return Math.max(-1,Math.min(1,(screenX-stageWidth/2)/(stageWidth/2)));
}

// ── the graph ───────────────────────────────────────────────────────────────

/** The torus tap the controller offers: a node it owns, in the context it owns. */
export interface TorusTap {context:BaseAudioContext;input:AudioNode;output?:AudioNode}

/** What one voice is doing, for the reading. */
export interface VoiceReading {
 entityId:string;
 /** `carrying`: its bank is wired to the tap. `absent`: it carries something the store gives no sound for. `silent`: it is on and does not sound. */
 state:'carrying'|'absent'|'silent';
 because:string|null;
 carry:VoiceCarry|null;
 mode:string|null;
 tuning:string|null;
 rootHz:number|null;
 bands:number;
 place:number;
}

export interface VoiceInputs {
 plan:EntitySoundPlan;
 catalogue:ModeCatalogue|null;
 catalogueWhy:string|null;
 root:TorusRoot;
 /** Why the torus gives nothing now (null while it sounds): said beside every voice, since a voice is the torus's sound. */
 torusSilentBecause:string|null;
 /** Each symbol's place, −1 to 1 (placeOf). A symbol with no place is centred. */
 places:ReadonlyMap<string,number>;
 muted:boolean;
}

/** Run later and give back the cancel. Tests pass their own. */
export type Defer=(run:()=>void,ms:number)=>()=>void;
const later:Defer=(run,ms)=>{const timer=setTimeout(run,ms);return ()=>clearTimeout(timer);};
const SMOOTH=.02;

interface Bank {mode:string;rootHz:number;filters:BiquadFilterNode[];sum:GainNode;users:Set<string>;signature:string}
interface Held {voice:EntityVoice;bank:string;env:GainNode;panner:StereoPannerNode|null;signature:string}

/** The symbols' voices, wired to the torus tap. `attach` hands it the tap (or none, when no instrument is open); `sync` follows the
 * scene's plan. It makes no oscillator and no source of its own: every node is a filter, a gain or a panner on the torus's output. */
export class SymbolVoices {
 private tap:TorusTap|null=null;
 private banks=new Map<string,Bank>();
 private voices=new Map<string,Held>();
 private readings:VoiceReading[]=[];
 private retiring=new Set<()=>void>();
 constructor(private defer:Defer=later){}

 /** Listen to this tap (or to none). True when that is a change: the same node in the same context is no change. */
 attach(tap:TorusTap|null):boolean{
  if((tap?.input??null)===(this.tap?.input??null)&&(tap?.context??null)===(this.tap?.context??null))return false;
  this.teardown();
  this.tap=tap;
  return true;
 }

 /** Follow the scene's plan. Cheap when nothing changed (the nodes are updated in place). */
 sync(input:VoiceInputs):VoiceReading[]{
  const readings:VoiceReading[]=[];
  const reading=(entityId:string,state:VoiceReading['state'],because:string|null,carry:VoiceCarry|null,carried?:Carried&{state:'carrying'},place=0):VoiceReading=>
   ({entityId,state,because,carry,mode:carried?.mode.key??null,tuning:carried?.tuning??null,rootHz:carried?.rootHz??null,bands:carried?.bands.length??0,place});
  for(const silent of input.plan.silent)readings.push(reading(silent.entityId,'silent',silent.because,null));
  const wanted=new Map<string,{voice:EntityVoice;carried:Extract<Carried,{state:'carrying'}>}>();
  const tap=this.tap,rate=tap?.context.sampleRate;
  for(const voice of input.plan.voices){
   const place=input.places.get(voice.entityId)??0;
   if(!tap||rate===undefined){readings.push(reading(voice.entityId,'silent',input.torusSilentBecause??'No instrument is open: the torus is not sounding',voice.carry,undefined,place));continue;}
   const carried=resolveCarry(voice.carry,input.catalogue,input.catalogueWhy,input.root,rate);
   if(carried.state==='absent'){readings.push(reading(voice.entityId,'absent',carried.because,voice.carry,undefined,place));continue;}
   wanted.set(voice.entityId,{voice,carried});
   readings.push(reading(voice.entityId,'carrying',input.torusSilentBecause?`The torus is silent: ${input.torusSilentBecause}`:null,voice.carry,carried,place));
  }
  if(tap){
   const context=tap.context,now=context.currentTime;
   // Leave: the voices that are no longer wanted release on their own envelope, then their nodes go.
   for(const [id,held] of [...this.voices])if(!wanted.has(id))this.release(id,held,now);
   for(const [id,{voice,carried}] of wanted){
    const bankKey=carried.mode.key;
    const bank=this.bank(tap,bankKey,carried);
    let held=this.voices.get(id);
    if(held&&held.bank!==bankKey){this.release(id,held,now,true);held=undefined;}
    if(!held){
     const env=context.createGain();env.gain.setValueAtTime(0,now);
     const panner=typeof context.createStereoPanner==='function'?context.createStereoPanner():null;
     bank.sum.connect(env);
     if(panner){env.connect(panner);panner.connect(context.destination);}else env.connect(context.destination);
     bank.users.add(id);
     held={voice,bank:bankKey,env,panner,signature:''};this.voices.set(id,held);
    }
    held.voice=voice;
    held.panner?.pan.setTargetAtTime(input.places.get(id)??0,now,SMOOTH);
    // The envelope is scheduled when the voice arrives or its gain, attack or the mute changes, never on every look at an unchanged plan:
    // a ramp restarted every tenth of a second would stretch a long attack.
    const signature=JSON.stringify([input.muted?0:voice.gain,voice.attack]);
    if(held.signature!==signature){
     held.signature=signature;
     held.env.gain.cancelScheduledValues(now);held.env.gain.setValueAtTime(held.env.gain.value,now);
     held.env.gain.linearRampToValueAtTime(input.muted?0:voice.gain,now+Math.max(.005,voice.attack));
    }
   }
   this.retireBanks();
  }
  this.readings=readings;
  return readings;
 }

 inspect(){
  return {
   attached:!!this.tap,
   banks:[...this.banks].map(([key,bank])=>({mode:key,rootHz:bank.rootHz,bands:bank.filters.length,users:[...bank.users]})),
   voices:this.readings.map(reading=>({...reading})),
  };
 }

 dispose(){this.teardown();this.tap=null;this.readings=[];}

 /** The bank for a mode: made once and shared, and moved in place when the root moves (or rebuilt when the band count changes). */
 private bank(tap:TorusTap,key:string,carried:Extract<Carried,{state:'carrying'}>):Bank{
  const context=tap.context,now=context.currentTime;
  let bank=this.banks.get(key);
  if(bank&&bank.filters.length!==carried.bands.length){
   for(const filter of bank.filters){try{tap.input.disconnect(filter);}catch{/* already apart */}filter.disconnect();}
   bank.filters=[];
  }
  if(!bank){bank={mode:key,rootHz:carried.rootHz,filters:[],sum:context.createGain(),users:new Set(),signature:''};this.banks.set(key,bank);}
  const signature=carried.bands.map(band=>`${band.centreHz}:${band.q}`).join(' ');
  if(!bank.filters.length){
   bank.filters=carried.bands.map(band=>{
    const filter=context.createBiquadFilter();filter.type='bandpass';
    filter.frequency.value=band.centreHz;filter.Q.value=band.q;
    tap.input.connect(filter);filter.connect(bank!.sum);
    return filter;
   });
  }else if(bank.signature!==signature)carried.bands.forEach((band,i)=>{
   const filter=bank!.filters[i];
   filter.frequency.setTargetAtTime(band.centreHz,now,SMOOTH);filter.Q.setTargetAtTime(band.q,now,SMOOTH);
  });
  bank.rootHz=carried.rootHz;bank.signature=signature;
  return bank;
 }

 private release(id:string,held:Held,now:number,immediate=false){
  this.voices.delete(id);
  const seconds=immediate?0:held.voice.release;
  held.env.gain.cancelScheduledValues(now);held.env.gain.setValueAtTime(held.env.gain.value,now);
  if(seconds>0)held.env.gain.linearRampToValueAtTime(0,now+seconds);else held.env.gain.setValueAtTime(0,now);
  const bank=this.banks.get(held.bank);
  const apart=()=>{this.retiring.delete(cancel);held.env.disconnect();held.panner?.disconnect();bank?.users.delete(id);this.retireBanks();};
  // The nodes stay until the release has run out; the bank keeps its user until then.
  const cancel=this.defer(apart,Math.ceil(seconds*1000)+50);
  this.retiring.add(cancel);
 }

 /** A bank no voice uses (and none is still releasing on) goes. */
 private retireBanks(){
  const tap=this.tap;
  for(const [key,bank] of [...this.banks]){
   if(bank.users.size>0||[...this.voices.values()].some(held=>held.bank===key))continue;
   for(const filter of bank.filters){try{tap?.input.disconnect(filter);}catch{/* already apart */}filter.disconnect();}
   bank.sum.disconnect();this.banks.delete(key);
  }
 }

 private teardown(){
  for(const cancel of [...this.retiring])cancel();this.retiring.clear();
  for(const held of this.voices.values()){held.env.disconnect();held.panner?.disconnect();}
  this.voices.clear();
  for(const bank of this.banks.values()){
   for(const filter of bank.filters){try{this.tap?.input.disconnect(filter);}catch{/* already apart */}filter.disconnect();}
   bank.sum.disconnect();
  }
  this.banks.clear();
 }
}
