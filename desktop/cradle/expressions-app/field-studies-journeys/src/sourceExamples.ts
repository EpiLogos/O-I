import {initialiseSources} from './sourceState';
import {Journey,Scene,blankScene,entity,SequenceStep} from './model.js';
import {FACE_COLOUR_DATA_URL,FACE_MONO_DATA_URL,FACE_ASCII_ART,FACES_DATA_URLS} from './sourceExamplesData.generated.js';
import type {StartingPoint} from './expressions.js';

/** Source studies: the same mask carried through the whole pipeline —
 * mono line art, colour photograph, silhouette cutout and its ASCII
 * transcription. Each opens as an editable expression. */
function studyScene(name:string,character:string):Scene{
 const s=blankScene(name);
 s.id='scene-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
 s.character=character;
 s.duration=14;
 const mask=entity('Wireframe mask','O');
 mask.id='mask';
 mask.size={x:1.5,y:1.5}; // square extent preserves the sampled subject's true aspect
 s.entities=[mask];
 s.text=[];
 return s;
}

function mono():Journey{
 const s=studyScene('Mono ink study','A wireframe mask, drawn in dark ink on light paper.');
 const mask=s.entities[0];
 mask.source={kind:'image',image:{mode:'luminance',threshold:.19,invert:false,scale:1,dataUrl:FACE_MONO_DATA_URL,name:'face-mono.png'}};
 s.field.palette=['#20261f','#5d6b60','#94a392'];
 Object.assign(s.field.params,{count:62000,size:2.3,contrast:.7,warp:.08,dispersion:.04,jitter:.45,speed:.4,turbulence:.12});
 const j:Journey={schema:'oi.journey' as const,version:1,id:'source-mask-mono',name:'Mask · mono ink study',description:'Line art sampled by detected ink polarity — the strokes, never the paper.',loop:true,scenes:[s],updatedAt:new Date().toISOString()};
 return j;
}

function neon():Journey{
 const s=studyScene('Neon colour study','The same mask as light: bright wire on a dark field.');
 const mask=s.entities[0];
 mask.source={kind:'image',image:{mode:'luminance',threshold:.28,invert:false,scale:1,dataUrl:FACE_COLOUR_DATA_URL,name:'face-colour.jpg'}};
 s.field.background='#0a0f1c';
 s.field.palette=['#e8fbff','#6fd8e8','#2e7fa8'];
 s.engine.inkMode='whiteOnBlack';
 s.engine.backgroundMode='ambientGlow';
 Object.assign(s.field.params,{count:62000,size:2.3,opacity:.95,contrast:.9,warp:.15,dispersion:.06,speed:.5});
 const j:Journey={schema:'oi.journey' as const,version:1,id:'source-mask-neon',name:'Mask · neon colour study',description:'Light ink on dark paper, auto-detected from the photograph itself.',loop:true,scenes:[s],updatedAt:new Date().toISOString()};
 return j;
}

function cutout():Journey{
 const s=studyScene('Cutout and dissolve','A true silhouette cutout, then the field remembers its letter.');
 const mask=s.entities[0];
 // The colour photograph is one coherent subject: the cutout fills it solid.
 // A firm threshold keeps the outer glow out of the flood fill's subject.
 mask.source={kind:'image',image:{mode:'silhouette',threshold:.46,invert:false,scale:1,dataUrl:FACE_COLOUR_DATA_URL,name:'face-colour.jpg'}};
 const step=(text:string,id:string):SequenceStep=>({id,text,shape:'text',hold:4,transition:3,position:null});
 mask.sequence={...mask.sequence,enabled:true,clock:'seconds',steps:[step('O','step-mask'),step('O','step-o'),step('I','step-i')]};
 s.field.background='#101418';
 s.field.palette=['#e6e2d8','#9fb0a8','#5d6b60'];
 s.engine.inkMode='whiteOnBlack';
 Object.assign(s.field.params,{count:62000,size:2.2,contrast:.85,warp:.12,dispersion:.05,speed:.45});
 const j:Journey={schema:'oi.journey' as const,version:1,id:'source-mask-cutout',name:'Mask · cutout and dissolve',description:'Enclosed regions stay with the subject. The sequence morphs cutout → O → I.',loop:true,scenes:[s],updatedAt:new Date().toISOString()};
 return j;
}

function ascii():Journey{
 const s=studyScene('ASCII transcription','The mask retyped — image to characters to particles.');
 const mask=s.entities[0];
 mask.source={kind:'ascii',ascii:{text:FACE_ASCII_ART,fontFamily:'monospace'}};
 s.field.palette=['#26251f','#5a584c','#8b8576'];
 Object.assign(s.field.params,{count:54000,size:2.2,contrast:.8,warp:.1,dispersion:.04,speed:.4});
 const j:Journey={schema:'oi.journey' as const,version:1,id:'source-mask-ascii',name:'Mask · ASCII transcription',description:'The same drawing transcribed into typed marks; the glyph field samples them like any source.',loop:true,scenes:[s],updatedAt:new Date().toISOString()};
 return j;
}

const TWELVE_MOODS:{id:string;name:string;line:string}[]=[
 {id:'origin',name:'I · Origin',line:'The mask at rest — where every face begins.'},
 {id:'still',name:'II · Still',line:'Barely a change. The first variation holds its breath.'},
 {id:'solemn',name:'III · Solemn',line:'The lids lower. The same lattice, heavier.'},
 {id:'sorrow',name:'IV · Sorrow',line:'Everything falls a little. Nothing is rebuilt.'},
 {id:'frown',name:'V · Frown',line:'The brow gathers. The field follows.'},
 {id:'stern',name:'VI · Stern',line:'Eyes nearly closed. Attention narrowing.'},
 {id:'grit',name:'VII · Grit',line:'The jaw locks. The wires take the strain.'},
 {id:'smile',name:'VIII · Smile',line:'The lattice lifts. For a moment it is easy.'},
 {id:'snarl',name:'IX · Snarl',line:'One side resists the smile and wins.'},
 {id:'startle',name:'X · Startle',line:'Everything opens at once.'},
 {id:'spectacle',name:'XI · Spectacle',line:'The mask invents glasses. The field keeps looking.'},
 {id:'hollow',name:'XII · Hollow',line:'The last variation lets go — and loops to rest.'},
];

/** Twelve faces: the whole series as one looping expression. Every scene
 * samples one mask through the same normalization law on the original blue
 * field, so the strip reads as a single face changing its mind. */
function twelveFaces():Journey{
 const scenes=TWELVE_MOODS.map((mood,i)=>{
  const s=studyScene(mood.name,mood.line);
  s.id='face-'+mood.id;
  s.duration=6.5;
  s.transition=2.5;
  const mask=s.entities[0];
  mask.source={kind:'image',image:{mode:'luminance',threshold:.19,invert:false,scale:1,dataUrl:FACES_DATA_URLS[i],name:`face-${String(i+1).padStart(2,'0')}`}};
  s.field.background='#0a0f1c';
  s.field.palette=['#e8fbff','#6fd8e8','#2e7fa8'];
  s.engine.inkMode='whiteOnBlack';
  s.engine.backgroundMode='ambientGlow';
  Object.assign(s.field.params,{count:62000,size:2.25,opacity:.92,contrast:.82,warp:.12,dispersion:.05,jitter:.45,speed:.45,turbulence:.15});
  return s;
 });
 const j:Journey={schema:'oi.journey' as const,version:1,id:'source-twelve-faces',name:'Twelve faces · one mask',description:'A single series of the same wireframe mask, sampled from twelve photographs. Watch one face become another.',loop:true,scenes,updatedAt:new Date().toISOString()};
 return j;
}

/** Lamination: layers are the object's body in depth — a face toward the
 * camera, a typed lattice at the core, a second face behind. The layered body
 * is one object, and the sequence below runs that whole object: it drifts and
 * turns between two poses while the layers stand. */
function laminated():Journey{
 const s=studyScene('Laminated head','A face toward the camera, a typed lattice at the core, a second face behind — one layered body, sequenced as a whole.');
 const mask=s.entities[0];
 mask.name='Laminated head';
 mask.size={x:1.35,y:1.35};
 const face=(id:string,z:number,dataUrl:string,name:string)=>({id,text:'O',z,scale:1,source:{kind:'image' as const,image:{mode:'luminance' as const,threshold:.19,invert:false,scale:1,dataUrl,name}}});
 mask.layers=[
  face('lam-front',.38,FACES_DATA_URLS[1],'face-front'),
  {id:'lam-core',text:'O',z:0,scale:.8,source:{kind:'ascii' as const,ascii:{text:['        # ######## #','      ###        ###','    ###  ##  ##  ###','   ##   ##    ##   ##','   ##    ##  ##    ##','   ##     ##      ##','    #             #'].join('\n'),fontFamily:'monospace'}}},
  face('lam-back',-.38,FACES_DATA_URLS[9],'face-back'),
 ];
 const pose=(id:string,text:string,z:number,rotation:number,scale:number,tint:string):SequenceStep=>({id,text,shape:'text',hold:3.5,transition:3,position:{x:0,y:0,z},objectState:{size:{x:1.35,y:1.35},rotation,scale,tint,tintWeight:.35,force:{kind:'attract',strength:0,radius:.45,spin:0}}});
 mask.sequence={...mask.sequence,enabled:true,clock:'seconds',steps:[
  pose('head-near','head · near',0,0,1,'#9fd8e8'),
  pose('head-turned','head · turned',-.08,180,.88,'#6fd8e8'),
 ]};
 s.engine.volumeEnabled=true;
 s.field.background='#0a0f1c';
 s.field.palette=['#e8fbff','#6fd8e8','#2e7fa8'];
 s.engine.inkMode='whiteOnBlack';
 s.engine.backgroundMode='ambientGlow';
 Object.assign(s.field.params,{count:62000,size:2.25,opacity:.92,contrast:.82,warp:.1,dispersion:.04,jitter:.4,speed:.42,turbulence:.12});
 const j:Journey={schema:'oi.journey' as const,version:1,id:'source-laminate-head',name:'Laminate · head, front and back',description:'Layers are the body: two faces and a typed lattice hold in depth at once, and the sequence turns the whole head between two poses.',loop:true,scenes:[s],updatedAt:new Date().toISOString()};
 return j;
}

export function sourceStudies():StartingPoint[]{
 return [mono(),neon(),cutout(),ascii(),twelveFaces(),laminated()].map(expression=>({id:expression.id,group:'Source studies' as const,expression:initialiseSources(expression)}));
}
