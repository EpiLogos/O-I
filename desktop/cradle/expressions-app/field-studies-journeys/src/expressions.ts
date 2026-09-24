import {Journey,Scene,fieldStudies,oiMark,sevenCentres,smallLanguage,clone,uid} from './model.js';
import {nativeSnapshotToJourney} from './nativeBridge.js';
import {COMPOSITION_PRESETS} from '../../src/engine/compositionPresets';
import {FACTORY_PRESETS} from '../../src/engine/factoryPresets';
import {sourceStudies} from './sourceExamples.js';
import {defaultCamera,project,stageScale} from './camera.js';
import {icon,esc} from './icons.js';
import {isWebHorizon,libraryHorizonsHTML,libraryKernelSectionHTML,libraryScopesStyle,PROJECTED_WORLDS_UNAVAILABLE} from './libraryScopes.js';

/** Expression is the public name. The oi.journey/1 envelope remains compatible. */
export type Expression = Journey;
export interface StartingPoint {id:string;group:'Material'|'Composition'|'Native'|'Source studies';expression:Expression}
export function nativeSeven():Expression {
  const ids=['chakra_body','kundalini_focus','chakra_cymatic'];
  const scenes=ids.map(id=>{
    const preset=COMPOSITION_PRESETS.find(p=>p.id===id)!;const built=preset.build();
    const expression=nativeSnapshotToJourney({name:preset.name,config:{particleCount:62000,entities:built.entities,composition:built.composition,cymatics:built.cymatics,semanticField:built.semanticField,resonanceDrive:built.resonanceDrive}});
    const scene=expression.scenes[0];scene.name=preset.name;scene.text=[];return scene;
  });
  return {schema:'oi.journey',version:1,id:'seven-centres',name:'Seven centres',description:'Authored seven-centre Expression material with semantic bindings — not live Nara personal state. Centre identity is not a cymatic station.',loop:true,scenes,updatedAt:new Date().toISOString()};
}
export function featuredExpressions():Expression[]{return [oiMark(),fieldStudies(),nativeSeven(),smallLanguage()];}
export function startingPoints():StartingPoint[]{
  const material=fieldStudies().scenes.map(s=>({id:'material-'+s.id,group:'Material' as const,expression:{...fieldStudies(),id:'material-'+s.id,name:s.name,description:s.character,scenes:[s]}}));
  const compositions=COMPOSITION_PRESETS.map(p=>{
    const built=p.build();
    const expression=nativeSnapshotToJourney({name:p.name,config:{particleCount:62000,entities:built.entities,composition:built.composition,cymatics:built.cymatics,semanticField:built.semanticField,resonanceDrive:built.resonanceDrive}});
    expression.id='composition-'+p.id;expression.description=p.description;
    // Face a horizontal medium without changing its physics or placement plane.
    if(built.composition.plane==='horizontal')expression.scenes[0].view={mode:'3d',yaw:0,pitch:-Math.PI/2,zoom:.8,panX:0,panY:0};
    return{id:expression.id,group:'Composition' as const,expression};
  });
  const native=FACTORY_PRESETS.map(p=>{
    const expression=nativeSnapshotToJourney({name:p.name,config:clone(p.config)});
    expression.id='native-'+p.id;expression.description=p.description;
    return{id:expression.id,group:'Native' as const,expression};
  });
  return [...material,...compositions,...native,...sourceStudies()];
}
/** A fork is ordinary editable data, never a runtime mode flag. */
export function forkExpression(source:Expression):Expression {
  const out=clone(source);out.id=uid('expression');out.updatedAt=new Date().toISOString();
  return out;
}
const previews=new Map<string,string>();
/** Thumbnail only: a static projection of the authored composition, not substitute physics.
 * Live saved covers are supplied by the native render-target capture when available.
 * Each formation is drawn as its first sequence state, so covers match what a scene
 * actually opens with after the object/sequence system rework.
 */
export function compositionCover(s:Scene):string {
  const key=JSON.stringify([s.field,s.entities,s.view]);const cached=previews.get(key);if(cached)return cached;
  const w=560,h=350,out=document.createElement('canvas');out.width=w;out.height=h;
  const ctx=out.getContext('2d')!;ctx.fillStyle=s.field.background;ctx.fillRect(0,0,w,h);
  const c={...defaultCamera(),...s.view,panX:s.view.panX*w,panY:s.view.panY*h};
  let seed=7134;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const e of s.entities){
    if(e.enabled===false)continue;
    const step=e.sequence.steps[0],state=step?.objectState,source=step?.source??e.source;
    const p=project(e.position,c,w,h),scale=stageScale(w,h)*c.zoom,sx=(state?.size.x??e.size.x)*scale,sy=(state?.size.y??e.size.y)*scale,rotation=state?.rotation??e.rotation;
    if(e.kind==='pin'){ctx.strokeStyle=s.field.palette[0];ctx.lineWidth=.75;ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(p.x,p.y,e.force.radius*scale,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;continue;}
    const shape=step?.shape??e.shape;
    const mask=document.createElement('canvas');mask.width=w;mask.height=h;const m=mask.getContext('2d',{willReadFrequently:true})!;
    m.translate(p.x,p.y);m.rotate(-rotation*Math.PI/180);m.fillStyle='#fff';m.strokeStyle='#fff';m.lineWidth=Math.max(1,sx*.055);
    if(shape==='ring'){m.beginPath();m.ellipse(0,0,sx/2,sy/2,0,0,Math.PI*2);m.stroke();}
    else if(shape==='disc'||shape==='cymatic'){m.beginPath();m.ellipse(0,0,sx/2,sy/2,0,0,Math.PI*2);m.fill();}
    else if(shape==='square')m.fillRect(-sx/2,-sy/2,sx,sy);
    else if(shape==='triangle'||shape==='yantra'){m.beginPath();m.moveTo(0,-sy/2);m.lineTo(sx/2,sy/2);m.lineTo(-sx/2,sy/2);m.closePath();shape==='yantra'?m.stroke():m.fill();if(shape==='yantra'){m.beginPath();m.ellipse(0,0,sx*.48,sy*.48,0,0,Math.PI*2);m.stroke();}}
    else if(source?.kind==='image'){const inset=Math.min(sx,sy)*.12;m.strokeStyle='#fff';m.lineWidth=Math.max(1.2,sx*.02);m.strokeRect(-sx/2+inset,-sy/2+inset,sx-inset*2,sy-inset*2);m.beginPath();m.moveTo(-sx/2+inset,sy/2-inset);m.lineTo(-sx*.1,-sy*.05);m.lineTo(sx*.14,sy*.12);m.lineTo(sx/2-inset,sy/2-inset);m.closePath();m.fill();}
    else{const text=source?.kind==='ascii'?source.ascii.text:step?.text||e.text||'O';m.font='900 200px Arial';const metrics=m.measureText(text),left=metrics.actualBoundingBoxLeft,right=metrics.actualBoundingBoxRight,up=metrics.actualBoundingBoxAscent,down=metrics.actualBoundingBoxDescent;
      m.scale(sx/Math.max(1,left+right),sy/Math.max(1,up+down));m.fillText(text,(left-right)/2,(up-down)/2);}
    const pixels=m.getImageData(0,0,w,h).data;ctx.fillStyle=(state?.tintWeight??e.tintWeight)>.5?(state?.tint??e.tint):s.field.palette[0];
    const grid=s.field.material==='print';const step2=grid?3.5:2;
    for(let y=0;y<h;y+=step2)for(let x=0;x<w;x+=step2){const px=x+(grid?0:random()*step2),py=y+(grid?0:random()*step2);if(pixels[(Math.floor(py)*w+Math.floor(px))*4+3]<50||random()>.68)continue;
      ctx.globalAlpha=.55+random()*.45;const radius=grid?1.04:.34+random()*.53;ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
  }
  const url=out.toDataURL('image/webp',.8);if(previews.size>100)previews.clear();previews.set(key,url);return url;
}
const button=(action:string,glyph:string,label:string,extra='')=>`<button class="icon-button" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${icon(glyph)}</button>`;
/** LibraryContext.section carries the Library's own section state and the
 * horizons chosen within the collection page ('collection' = MY WORLD,
 * 'collection:web' = O:I WEB) — see libraryScopes.ts. */
export interface LibraryContext {current:Expression;saved:Expression[];featured:Expression[];starters:StartingPoint[];section:string;errors:string[];legacy:boolean;cover:(expression:Expression)=>string|undefined}
export function libraryHTML(c:LibraryContext):string{
  const card=(j:Expression,kind:'saved'|'featured'|'mode',key=j.id)=>`<article class="expression-card"><button class="expression-open" data-action="${kind==='mode'?'start-mode':kind==='featured'?'open-featured':'load-saved'}" data-id="${esc(key)}" aria-label="${kind==='saved'?'Open':'Start from'} ${esc(j.name)}">
    <span class="expression-cover"><img src="${c.cover(j)??'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="350"><path fill="${j.scenes[0].field.background}" d="M0 0h560v350H0z"/></svg>`)}" ${c.cover(j)?'':`data-preview-id="${esc(key)}"`} alt="Composition preview of ${esc(j.name)}" loading="lazy" width="560" height="350"><span class="cover-count">${String(j.scenes.length).padStart(2,'0')} ${j.scenes.length===1?'scene':'scenes'}</span><span class="cover-open">${icon(kind==='saved'?'arrowRight':'branch')}</span></span>
    <strong>${esc(j.name)}</strong><span class="expression-subtitle">${esc(j.description||j.scenes[0].character)}</span></button>${kind==='saved'?button('fork-saved','copy','Branch '+j.name,`data-id="${esc(j.id)}"`)+button('delete-saved','trash','Remove saved copy of '+j.name,`data-id="${esc(j.id)}"`):''}</article>`;
  const saved=[c.current,...c.saved.filter(j=>j.id!==c.current.id)];
  const header=`<header class="library-header"><div>${button('close-library','arrowLeft','Return to the field')}<span class="library-monogram">O:I</span></div><nav aria-label="Library sections"><button data-action="library-section" data-section="collection" aria-current="${c.section==='about'?'false':'page'}">Collection</button><button data-action="library-section" data-section="about" aria-current="${c.section==='about'?'page':'false'}">About</button></nav>${button('close-library','close','Close library')}</header>`;
  if(c.section==='about')return header+`<section class="library-about"><p class="eyebrow">O:I / THE INSTRUMENT</p><h1>A field to inhabit.<br><em>A space to compose.</em></h1><p class="library-lede">Place, shape, relate, animate, capture. An expression holds the whole composition: its scenes, material, relationships and passage through time.</p><div class="about-columns"><section><h2>One living medium.</h2><p>The native GPU engine carries persistent particles through shared forces, local sequences and continuous resonance. Selecting an object inspects it; it does not tune the field.</p></section><section><h2>Nothing locked into a mode.</h2><p>Every starting point opens as editable composition data. Branch an expression, change its entities, or shape a completely different performance.</p></section></div><h2>Your work, kept.</h2><p>Browser draft / autosave stays in this browser. A saved Scene is a named composition snapshot. A committed native Expression and a saved native file are separate durable acts. Publication is another step again. JSON preserves editable configuration; living HTML includes the engine and editor. Neither is an exact particle-state checkpoint. PNG captures the current native state; silent live video requests 30 fps, with a two-minute / 128 MB limit. Offline replay and seamless physical loops are not claimed.</p><h2>A few ways in.</h2><div class="shortcut-grid"><span><kbd>I</kbd> Interact</span><span><kbd>V</kbd> Select</span><span><kbd>P</kbd> Pin</span><span><kbd>A</kbd> Formation</span><span><kbd>O</kbd> Orbit</span><span><kbd>T</kbd> Page text</span><span><kbd>E</kbd> Editor</span><span><kbd>Space</kbd> Pause</span><span><kbd>F</kbd> Present</span><span><kbd>⌘/Ctrl Z</kbd> Undo</span></div><p>Drag the orbital controller to rotate; Shift-drag to pan, scroll to zoom. Its axis targets and keyboard controls offer precise alternatives. Camera orientation, working plane and physical confinement are independent.</p></section>`;
  const horizons=`<style>${libraryScopesStyle}</style>${libraryHorizonsHTML(c.section)}`;
  if(isWebHorizon(c.section))return header+`<div class="library-body">${horizons}
  <div class="library-title"><div><p class="eyebrow">O:I WEB / SHARED</p><h1>The shared field<span>.</span></h1><p>The continuous local and shared field of O:I. SharedField, Projection and WikiSpace are its native contracts; Explore is its discovery operation. A projected world entered from here opens with this Library's navigation grammar — structurally another Library/world/project of the same instrument.</p></div></div>
  <section class="library-section" data-scope="projected-worlds"><header><h2>Accessible projected worlds</h2><span>Reachable through the SharedField provider</span></header><p class="oi-lib-note">${esc(PROJECTED_WORLDS_UNAVAILABLE)}<small>Nothing shared is invented here. When a provider is reachable from this application, its worlds appear in this section as cards in the same grammar.</small></p></section>
  <footer class="library-footer"><span>O:I · Native particle field</span><span>Shared ground is read from its native owner, never copied.</span></footer></div>`;
  const featured=c.featured.filter(j=>!saved.some(s=>s.id===j.id));
  const personal=c.starters.filter(p=>p.group!=='Source studies');
  const corpus=c.starters.filter(p=>p.group==='Source studies');
  const starterGrid=(points:StartingPoint[])=>points.map(p=>`<div data-starting-card data-search="${esc((p.expression.name+' '+p.expression.description+' '+p.group).toLowerCase())}">${card(p.expression,'mode',p.id)}</div>`).join('');
  return header+`<div class="library-body">${horizons}
  <div class="library-title"><div><p class="eyebrow">MY WORLD / PERSONAL</p><h1>Expressions<span>.</span></h1><p>A place for the things you make. And the things they might become.</p></div><div class="library-tools">${button('new-journey','plus','New expression')}${button('import','upload','Import expressions or native configurations')}${c.legacy?button('import-legacy','history','Import earlier native browser saves'):''}</div></div>
  <section class="expression-filebar" aria-label="Current expression and files"><div class="expression-details"><label><span class="eyebrow">CURRENT EXPRESSION</span><input data-bind="journey.name" aria-label="Expression name" value="${esc(c.current.name)}" maxlength="160"></label><input data-bind="journey.description" aria-label="Expression subtitle" placeholder="A subtitle for this expression" value="${esc(c.current.description)}" maxlength="5000"></div><div class="expression-file-actions">${button('save-browser','save','Save expression in this browser')}${button('export-json','code','Export expression JSON')}${button('export-artifact','external','Export living HTML with editor')}${button('export-native','download','Export current scene as native configuration')}</div></section>
  ${c.errors.length?`<p class="library-error" role="status">${esc(c.errors.join(' · '))} Original entries are untouched.</p>`:''}
  <section class="library-section" data-scope="current-project"><header><h2>Current project / world</h2><span>Your work in this world</span></header><div class="expression-grid">${saved.map(j=>card(j,'saved')).join('')}</div></section>
  ${featured.length?`<section class="library-section" data-scope="project-collections"><header><h2>Project collections</h2><span>Collected studies & featured compositions</span></header><div class="expression-grid">${featured.map(j=>card(j,'featured')).join('')}</div></section>`:''}
  <section class="library-section" data-scope="personal-collections"><header><h2>Personal collections</h2><label class="library-search">${icon('search')}<input id="library-search" placeholder="Find a mode or material" aria-label="Find a starting composition"></label></header><div class="expression-grid starting-grid">${starterGrid(personal)}</div><p id="library-empty" hidden>No compositions match that search.</p></section>
  ${libraryKernelSectionHTML()}
  ${corpus.length?`<section class="library-section" data-scope="curated-corpus"><header><h2>Curated Epi-Logos corpus</h2><span>Source studies carried by this application</span></header><div class="expression-grid starting-grid">${starterGrid(corpus)}</div></section>`:''}
  <footer class="library-footer"><span>O:I · Native particle field</span><span>Editable configurations, not runtime checkpoints.</span></footer></div>`;
}
export function modesHTML(points:StartingPoint[],recent:Journey[]=[]):string{
 return `<label class="modes-search">${icon('search')}<input id="mode-search" placeholder="Find a starting composition" aria-label="Find a starting composition"></label><p class="modes-standing">Starting compositions are editable starting material, not application modes.</p><div class="modes-list">${recent.length?`<section><h3>Recent work</h3>${recent.slice(0,12).map(j=>`<button data-action="load-saved" data-id="${esc(j.id)}" data-mode-choice data-search="${esc(j.name.toLowerCase())}">${esc(j.name)}</button>`).join('')}</section>`:''}${(['Material','Composition','Native','Source studies'] as const).map(group=>`<section><h3>${group}</h3>${points.filter(p=>p.group===group).map(p=>`<button data-action="start-mode" data-id="${esc(p.id)}" data-mode-choice data-search="${esc((p.expression.name+' '+p.expression.description).toLowerCase())}"><span>${esc(p.expression.name)}</span>${icon('branch')}</button>`).join('')}</section>`).join('')}</div><footer>Each starter opens as an editable expression.</footer>`;
}
