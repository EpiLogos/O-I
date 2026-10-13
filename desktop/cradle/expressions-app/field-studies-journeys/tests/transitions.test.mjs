import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldStudies,clone,sceneContentDigest,validateJourney} from '../build/model.js';
import {TRANSITION_KINDS,transitionKindOf,transitionSpecFor,validateTransitionSpec,dipWeights,wipeHoldRect,transitionLabel,seamGlyphHTML,seamChooserHTML,paintedOverlayActive,paintedPassParams,srgbUnit,renderTargetAction,transitionColourOf} from '../build/transitions.js';
import {readFileSync} from 'node:fs';

// Lane-3 E11: typed transitions per seam. The kind and its parameters ride on the Scene beside its duration; absent is
// crossfade, the default every existing document already has.

test('the kind model: four kinds, and an absent kind or an explicit crossfade is the default and is never written', ()=>{
 assert.deepEqual([...TRANSITION_KINDS],['cut','crossfade','dip-to-colour','wipe']);
 assert.equal(transitionKindOf(undefined),'crossfade');
 assert.equal(validateTransitionSpec(undefined),undefined);
 assert.equal(validateTransitionSpec({kind:'crossfade'}),undefined);
 assert.equal(transitionSpecFor('crossfade'),undefined);
 assert.equal(transitionLabel('wipe'),'Set transition wipe');
});

test('an unknown kind is refused by name, and so is a parameter the kind does not take', ()=>{
 assert.throws(()=>validateTransitionSpec({kind:'zoom'}),/Unknown transition kind "zoom"/);
 assert.throws(()=>validateTransitionSpec({kind:'cut',at:.5}),/Transition cut takes no at parameter/);
 assert.throws(()=>validateTransitionSpec({kind:'wipe',direction:'left',speed:2}),/takes no speed parameter/);
 assert.throws(()=>validateTransitionSpec({kind:'wipe',direction:'diagonal'}),/left, right, up or down/);
 assert.throws(()=>validateTransitionSpec('wipe'),/must be an object/);
});

test('parameters are bounded: the colour point stays between 0.2 and 0.8 of the transition', ()=>{
 assert.throws(()=>validateTransitionSpec({kind:'dip-to-colour',at:.1}),/between 0.2 and 0.8/);
 assert.throws(()=>validateTransitionSpec({kind:'dip-to-colour',at:NaN}),/between 0.2 and 0.8/);
 assert.deepEqual(validateTransitionSpec({kind:'dip-to-colour',at:.3}),{kind:'dip-to-colour',at:.3});
 assert.deepEqual(validateTransitionSpec({kind:'wipe',direction:'up'}),{kind:'wipe',direction:'up'});
 assert.deepEqual(validateTransitionSpec({kind:'cut'}),{kind:'cut'});
});

test('dip to colour: the outgoing frame gives way to the colour, which gives way to the incoming frame, exact at its point', ()=>{
 assert.deepEqual(dipWeights(0),{outgoing:1,colour:0,incoming:0});
 assert.deepEqual(dipWeights(.5),{outgoing:0,colour:1,incoming:0});
 assert.deepEqual(dipWeights(1),{outgoing:0,colour:0,incoming:1});
 const early=dipWeights(.25);
 assert.ok(Math.abs(early.outgoing-.5)<1e-12&&Math.abs(early.colour-.5)<1e-12);
 const late=dipWeights(.3,.2);
 assert.ok(Math.abs(late.colour-.875)<1e-12&&Math.abs(late.incoming-.125)<1e-12);
 for(let i=0;i<=40;i++){const w=dipWeights(i/40);assert.ok(Math.abs(w.outgoing+w.colour+w.incoming-1)<1e-12,`weights sum to one at ${i/40}`);}
});

test('wipe: the mask edge travels with the direction; the outgoing frame holds the rest', ()=>{
 assert.deepEqual(wipeHoldRect('right',0,100,50),{x:0,y:0,width:100,height:50});
 assert.deepEqual(wipeHoldRect('right',1,100,50),{x:100,y:0,width:0,height:50});
 assert.deepEqual(wipeHoldRect('right',.25,100,50),{x:25,y:0,width:75,height:50});
 assert.deepEqual(wipeHoldRect('left',.25,100,50),{x:0,y:0,width:75,height:50});
 assert.deepEqual(wipeHoldRect('down',.5,100,50),{x:0,y:25,width:100,height:25});
 assert.deepEqual(wipeHoldRect('up',.5,100,50),{x:0,y:0,width:100,height:25});
});

test('the byte-identical default: a journey with no transition kinds validates to the same bytes and writes no transition key', ()=>{
 const once=validateJourney(clone(fieldStudies()));
 const twice=validateJourney(clone(once));
 assert.equal(JSON.stringify(twice),JSON.stringify(once));
 assert.equal(JSON.stringify(once).includes('transitionSpec'),false);
 assert.ok(once.scenes.every(s=>s.transitionSpec===undefined));
});

test('validateJourney keeps a valid seam transition and refuses an unknown kind by name', ()=>{
 const j=fieldStudies();
 j.scenes[0].transitionSpec={kind:'wipe',direction:'up'};
 assert.deepEqual(validateJourney(clone(j)).scenes[0].transitionSpec,{kind:'wipe',direction:'up'});
 const bad=clone(fieldStudies());
 bad.scenes[0].transitionSpec={kind:'iris'};
 assert.throws(()=>validateJourney(bad),/Unknown transition kind "iris"/);
 const crossfade=clone(fieldStudies());
 crossfade.scenes[0].transitionSpec={kind:'crossfade'};
 assert.equal(validateJourney(crossfade).scenes[0].transitionSpec,undefined,'an explicit crossfade normalises to absent');
});

test('the seam kind is a timeline fact: changing it does not change the scene content digest', ()=>{
 const s=fieldStudies().scenes[0];
 const before=sceneContentDigest(s);
 s.transitionSpec={kind:'dip-to-colour',at:.4};
 assert.equal(sceneContentDigest(s),before);
});

test('the seam glyph and chooser are icons, not words, and the chooser marks the active kind and its parameters', ()=>{
 const scene={id:'s1',name:'Dusk',transition:1.5,transitionSpec:{kind:'wipe',direction:'right'}};
 const glyph=seamGlyphHTML(scene,33.3333);
 assert.match(glyph,/data-action="seam-transition" data-scene-id="s1"/);
 assert.match(glyph,/left:33\.333%/);
 assert.match(glyph,/<svg/);
 const inner=glyph.replace(/^<button[^>]*>/,'').replace(/<\/button>$/,'');
 assert.equal(inner.replace(/<[^>]+>/g,'').trim(),'','the glyph carries no visible words');
 const chooser=seamChooserHTML(scene,{min:0,max:30});
 assert.match(chooser,/data-kind="wipe" aria-pressed="true"/);
 assert.match(chooser,/data-direction="right" aria-pressed="true"/);
 assert.match(chooser,/data-transition-seconds data-scene-id="s1"/);
 assert.doesNotMatch(chooser,/data-transition-at/);
 const dip=seamChooserHTML({...scene,transitionSpec:{kind:'dip-to-colour'}},{min:0,max:30});
 assert.match(dip,/data-transition-at/);
 assert.doesNotMatch(dip,/data-direction/);
 const plain=seamChooserHTML({id:'s2',name:'Dawn',transition:1.5},{min:0,max:30});
 assert.match(plain,/data-kind="crossfade" aria-pressed="true"/);
});

// Lane-3 E11b: the production compositor. The GPU pass cannot run under node; these tests pin what the pass is given per
// fraction (the dip's colour share, the wipe's held rectangle in GL coordinates), the dip's exact byte, the render-target
// lifecycle, and that the engine's draw paths route through the pass only while a painted overlay is in force.

test('E11b: a painted overlay is in force from a dip or wipe start to its end; cut and crossfade draw directly', ()=>{
 assert.equal(paintedOverlayActive(undefined,.5),false);
 assert.equal(paintedOverlayActive({kind:'crossfade'},.5),false);
 assert.equal(paintedOverlayActive({kind:'cut'},.5),false);
 assert.equal(paintedOverlayActive({kind:'dip-to-colour'},0),true);
 assert.equal(paintedOverlayActive({kind:'wipe',direction:'left'},0),true);
 assert.equal(paintedOverlayActive({kind:'dip-to-colour'},.4),true);
 assert.equal(paintedOverlayActive({kind:'wipe',direction:'up'},.9),true);
 assert.equal(paintedOverlayActive({kind:'wipe',direction:'up'},1),false);
});

test('E11b: the dip reaches the colour exactly at its colour point, and the composited byte is the background byte', ()=>{
 const spec={kind:'dip-to-colour',at:.5};
 assert.equal(paintedPassParams(spec,0,1440,900,false).colourW,0);
 assert.equal(paintedPassParams(spec,.5,1440,900,false).colourW,1);
 assert.equal(paintedPassParams(spec,1,1440,900,false).colourW,0);
 assert.equal(paintedPassParams({kind:'dip-to-colour',at:.3},.3,1440,900,false).colourW,1);
 // CPU mirror of the fragment: premultiplied mix of the live frame toward the colour. At the colour point the live frame
 // (whatever it holds) contributes nothing, so the channel reads back as the authored background bytes.
 const colour=srgbUnit('#f4f2eb'),w=paintedPassParams(spec,.5,1440,900,false).colourW,live=[.2,.9,.4,.6];
 const a=live[3]*(1-w)+w,ground=[.1,.2,.3];
 assert.equal(a,1);
 assert.deepEqual([0,1,2].map(i=>Math.round((live[i]*(1-w)+colour[i]*w+ground[i]*(1-a))*255)),[244,242,235]);
});

test('E11b: the colour is a byte-exact read of the background hex, and a non-hex background falls back to the paper colour', ()=>{
 assert.deepEqual(srgbUnit('#f4f2eb').map(c=>Math.round(c*255)),[244,242,235]);
 assert.deepEqual(srgbUnit('#abc').map(c=>Math.round(c*255)),[170,187,204]);
 assert.throws(()=>srgbUnit('rebeccapurple'),/#rgb or #rrggbb/);
 assert.equal(transitionColourOf(' #0a0c10 '),'#0a0c10');
 assert.equal(transitionColourOf('rebeccapurple'),'#f4f2eb');
 assert.equal(transitionColourOf(undefined),'#f4f2eb');
});

test('E11b: a wipe holds the outgoing frame on the side it has not crossed, in GL (bottom-left) coordinates', ()=>{
 const W=1440,H=900,at=(direction,f)=>paintedPassParams({kind:'wipe',direction},f,W,H,true);
 assert.deepEqual(at('right',0).holdRect,[0,0,W,H]);
 assert.deepEqual(at('right',.25),{colourW:0,useHold:true,holdRect:[.25*W,0,.75*W,H]});
 assert.deepEqual(at('left',.25).holdRect,[0,0,.75*W,H]);
 assert.deepEqual(at('up',.25).holdRect,[0,.25*H,W,.75*H]);
 assert.deepEqual(at('down',.25).holdRect,[0,0,W,.75*H]);
 assert.equal(at('left',.5).useHold,true);
});

test('E11b: a wipe with no held frame draws the live frame, since the pass does not invent the outgoing one', ()=>{
 assert.deepEqual(paintedPassParams({kind:'wipe',direction:'left'},.5,1440,900,false),{colourW:0,useHold:false,holdRect:[0,0,0,0]});
});

test('E11b: the render-target lifecycle allocates once, drops content on a resize, and releases when the transition ends', ()=>{
 const a={width:1440,height:900};
 assert.equal(renderTargetAction(null,null),'none');
 assert.equal(renderTargetAction(null,a),'allocate');
 assert.equal(renderTargetAction(a,{width:1440,height:900}),'none');
 assert.equal(renderTargetAction(a,{width:720,height:450}),'resize');
 assert.equal(renderTargetAction(a,null),'release');
});

test('E11b: the engine routes a frame through the pass only while a painted overlay is in force', ()=>{
 const field=readFileSync(new URL('../../src/engine/PointCloudField.ts',import.meta.url),'utf8');
 const pass=readFileSync(new URL('../../src/engine/transitionPass.ts',import.meta.url),'utf8');
 const production=readFileSync(new URL('../src/production.ts',import.meta.url),'utf8');
 // Every scene draw to the canvas goes through presentScene, which draws directly when the pass declines.
 assert.match(field,/if \(!this\.transitionPass\.present\(this\.renderer, this\.scene, this\.camera, null\)\) this\.renderer\.render\(this\.scene, this\.camera\);/);
 assert.match(field,/if \(draw\) this\.presentScene\(\);/);
 assert.match(field,/this\.presentScene\(\);return copy\(\);/);
 // Capture (renderImage) composes the same overlay into its output target.
 assert.match(field,/if\(!this\.transitionPass\.present\(this\.renderer,this\.scene,camera,target\)\)\{this\.renderer\.setRenderTarget\(target\)/);
 // The pass is idle without an overlay: present returns false before touching any target.
 assert.match(pass,/const overlay=this\.overlay;\s*if\(!overlay\)return false;/);
 // The production engine gates the overlay on the pure predicate, and holds only for a wipe.
 assert.match(production,/const spec=this\.seam,painted=!!spec&&paintedOverlayActive\(spec,fraction\)/);
 assert.match(production,/this\.overlay=paint\(cfg\.backgroundColor\)/);
 assert.match(production,/this\.holdDue=this\.from!==null&&transitionKindOf\(this\.seam\)==='wipe'/);
 assert.match(production,/this\.engine\.setTransitionOverlay\(this\.overlay\)/);
 assert.match(production,/this\.engine\?\.captureTransitionHold\(transitionColourOf\(this\.from\?\.backgroundColor\)\)/);
});

test('E11b: the inspector offers the seam chooser the timeline uses, in place of a bare seconds field', ()=>{
 const inspector=readFileSync(new URL('../src/inspector.ts',import.meta.url),'utf8');
 assert.match(inspector,/import \{seamChooserHTML\} from '\.\/transitions';/);
 assert.match(inspector,/\$\{seamChooserHTML\(s,\{min:SCENE_TRANSITION_MIN,max:SCENE_TRANSITION_MAX\}\)\}/);
 assert.doesNotMatch(inspector,/numeric\('Transition \(seconds\)'/);
});

// Review fix (13 Oct 2026): a split's right half starts on a 0-second seam, so it carries no painted transition.
test('a split does not copy the source scene\'s painted transition onto the new seam', async()=>{
 const {fieldStudies,clone}=await import('../build/model.js');
 const {splitScene,initialiseSceneSaves}=await import('../build/sceneWorkflow.js');
 const j=initialiseSceneSaves(clone(fieldStudies()));const s=j.scenes[0];s.duration=14;s.transitionSpec={kind:'wipe',direction:'left'};
 splitScene(j,s.id,5,'split-right');
 const right=j.scenes[1];
 assert.equal(right.transition,0);
 assert.equal('transitionSpec' in right,false,'the right half inherits no seam glyph');
 assert.deepEqual(j.scenes[0].transitionSpec,{kind:'wipe',direction:'left'},'the left half keeps its own entry');
});
