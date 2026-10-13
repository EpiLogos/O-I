import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldStudies,clone,sceneContentDigest,validateJourney} from '../build/model.js';
import {TRANSITION_KINDS,transitionKindOf,transitionSpecFor,validateTransitionSpec,dipWeights,wipeHoldRect,transitionLabel,seamGlyphHTML,seamChooserHTML} from '../build/transitions.js';

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
