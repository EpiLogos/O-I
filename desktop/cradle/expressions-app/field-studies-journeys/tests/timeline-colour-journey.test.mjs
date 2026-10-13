// lane-2 T23 — a colour journey with meaning, and lawful stillness. The chronology's colour is one table
// (vendor timeline/palette.ts): standing classes and categories draw from it, values pinned, meanings kept apart.
// A card's colour changes only with its meaning: identical facts render identically. Category colour sits only on
// category elements; standing colour only on standing elements. No timeline rule animates.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const engine=fileURLToPath(new URL('..',import.meta.url));
const timelineDir=resolve(engine,'../vendor/research-canvas/packages/canvas/src/timeline');

const compiled=await build({stdin:{contents:[
 "export * as projection from '../vendor/research-canvas/packages/canvas/src/timeline/projection.ts';",
 "export * as standingStyle from '../vendor/research-canvas/packages/canvas/src/timeline/standingStyle.ts';",
 "export * as categories from '../vendor/research-canvas/packages/canvas/src/timeline/categories.ts';",
 "export * as palette from '../vendor/research-canvas/packages/canvas/src/timeline/palette.ts';",
 "export {TimelineNode} from '../vendor/research-canvas/packages/canvas/src/timeline/TimelineNode.tsx';",
 "export {createElement} from 'react';",
 "export {renderToStaticMarkup} from 'react-dom/server';",
 "export * as authority from '../../src/techne/m0m5/timeline/standing.ts';",
].join('\n'),resolveDir:engine,loader:'ts'},
 tsconfig:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),
 nodePaths:[fileURLToPath(new URL('../../../node_modules',import.meta.url))],
 banner:{js:`import {createRequire as __createRequire} from 'node:module';globalThis.require=__createRequire(${JSON.stringify(fileURLToPath(import.meta.url))});`},
 bundle:true,platform:'node',format:'esm',jsx:'automatic',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {projection,standingStyle,categories,palette,TimelineNode,createElement,renderToStaticMarkup,authority}=api;

const VIEW={centerYear:1850,pixelsPerYear:400,widthPx:1200};
const fact=(id,node={},qualification={},validFrom='1850')=>({
 node:{graphNodeId:id,title:id,summary:'',isTemporal:true,entityType:'Event',validFrom,validTo:null,evidenceTags:[],...node},
 anchor:{validFrom,validTo:null,precision:'year',...qualification},
 layoutOverride:null,
});
function renderFact(f){
 const placed=projection.placeItems(projection.projectNodes([f]),VIEW)[0];
 return renderToStaticMarkup(createElement(TimelineNode,{placed,lit:null,selected:false,dimmed:false,filtered:false,viewportWidth:1200,onSelect(){},onOpen(){},onResize(){},onColorTag(){}}));
}

// The values the chronology drew with before the table existed: a colour is a meaning, so these are pinned.
const LEGACY_STANDING={sourced:'#2e7d32',derived:'#6a4bd6',authored:'#0d6efd',disputed:'#c62828',mythic:'#b8860b',unavailable:'#74766b'};
const LEGACY_CATEGORY={'historical-event':['#79c0d4','#102633'],claim:['#e0b86f','#302817'],interpretation:['#cf91c7','#2b1d2a'],archetype:['#d0a24a','#2d2414'],'myth-in-time':['#b98cff','#281f35'],myth:['#a994d6','#241f31'],'speculation-contested':['#e07a6f','#321b1b'],source:['#5fb8a0','#102a24'],'book-writing':['#b9a784','#29251d'],constellation:['#8fd3ff','#102436'],'institution-network-figure':['#9aa6b8','#1b2430']};

test('the palette holds the values the chronology has always drawn with: no churn',()=>{
 assert.deepEqual({...palette.STANDING_COLOUR},LEGACY_STANDING);
 for(const [id,[color,background]] of Object.entries(LEGACY_CATEGORY)){
  assert.deepEqual({...palette.CATEGORY_COLOUR[id]},{color,background},`${id}`);
 }
});

test('standing strokes and category swatches are drawn from the one table',()=>{
 for(const visual of authority.STANDING_LEGEND.map(entry=>entry.visual)){
  assert.equal(standingStyle.STANDING_DRAWING[visual].stroke,palette.STANDING_COLOUR[visual],`${visual} stroke is the table's`);
 }
 for(const category of categories.TIMELINE_CATEGORIES){
  assert.equal(category.color,palette.CATEGORY_COLOUR[category.id].color,`${category.id} colour is the table's`);
  assert.equal(category.background,palette.CATEGORY_COLOUR[category.id].background,`${category.id} ground is the table's`);
 }
});

test('the dash patterns that tell the standing classes apart without colour are unchanged',()=>{
 assert.equal(standingStyle.STANDING_DRAWING.sourced.dash,undefined);
 assert.equal(standingStyle.STANDING_DRAWING.derived.dash,'5 3');
 assert.equal(standingStyle.STANDING_DRAWING.disputed.dash,'2 3');
 assert.equal(standingStyle.STANDING_DRAWING.mythic.dash,'1 4');
 assert.equal(standingStyle.STANDING_DRAWING.unavailable.dash,'3 5');
});

test('a colour carries one meaning: no standing colour is also a category colour',()=>{
 const standing=new Set(Object.values(palette.STANDING_COLOUR));
 const category=new Set(Object.values(palette.CATEGORY_COLOUR).map(entry=>entry.color));
 for(const colour of standing)assert.equal(category.has(colour),false,`${colour} means one thing`);
 assert.equal(new Set(Object.values(palette.STANDING_COLOUR)).size,Object.keys(palette.STANDING_COLOUR).length,'each standing class has its own colour');
});

test('identical facts render identically: colour follows the fact, not the order or the repetition of the render',()=>{
 const f=fact('same',{summary:'one',entityType:'Claim'},{uncertainty:'circa 1850'});
 const first=renderFact(f),second=renderFact(f);
 assert.equal(first,second);
 const other=fact('same',{summary:'one',entityType:'Claim'},{uncertainty:'circa 1850'});
 assert.equal(renderFact(other),first,'the same fact, built again, renders the same markup');
});

test('a disputed fact draws its standing colour only on its standing badge, never on a category element',()=>{
 const markup=renderFact(fact('disputed-1',{entityType:'Event'},{uncertainty:'disputed by a later editor',source_ref:'src:letter-4'}));
 const standingColour=palette.STANDING_COLOUR.disputed;
 const standingSpans=markup.match(/<span[^>]*timeline-node-standing[^>]*>/g)??[];
 assert.equal(standingSpans.length,1,'one standing badge');
 for(const span of standingSpans)assert.match(span,new RegExp(`color:${standingColour}`));
 const occurrences=markup.split(standingColour).length-1;
 assert.equal(occurrences,standingSpans.length,'the standing colour appears only on the standing badge');
});

test('a category colour appears only on the category elements of its card',()=>{
 const historical=palette.CATEGORY_COLOUR['historical-event'].color;
 const markup=renderFact(fact('historical-1',{entityType:'Event'}));
 const allowed=/class="(timeline-node-marker|timeline-node-category|timeline-node-color__swatch|timeline-node-card|timeline-node)[^"]*"|data-category="historical-event"/;
 // Every element that carries the category colour in its style is a category element of the card.
 const tags=markup.match(/<[^>]+>/g)??[];
 for(const tag of tags){
  if(!tag.includes(historical))continue;
  assert.match(tag,allowed,`category colour on a non-category element: ${tag.slice(0,120)}`);
 }
 assert.ok(tags.some(tag=>tag.includes(historical)),'the card draws its category colour');
});

test('no timeline source animates or transitions: the chronology moves only where the person drives it',async()=>{
 const files=(await readdir(timelineDir)).filter(name=>/\.(ts|tsx|css)$/.test(name));
 assert.ok(files.length>10);
 for(const name of files){
  const source=await readFile(resolve(timelineDir,name),'utf8');
  // Code, not comments: a colon-bearing transition or animation declaration, a keyframe, or an animation call.
  assert.doesNotMatch(source,/\btransition\s*:\s*[a-z-]+\s/,`${name}: no transition declaration in code`);
  assert.doesNotMatch(source,/\banimation\s*:\s*[a-z-]/,`${name}: no animation declaration in code`);
  assert.doesNotMatch(source,/@keyframes/,`${name}: no keyframes`);
 }
});

test('the stylesheet holds the chronology card still: the card opacity transition is overridden by the tail rule',async()=>{
 const styles=await readFile(resolve(engine,'src/styles.css'),'utf8');
 assert.match(styles,/\.research-instrument \.timeline-node\{transition:none\}/);
 const override=styles.slice(styles.indexOf('/* lane-2 T23'));
 assert.doesNotMatch(override,/#[0-9a-fA-F]{3,8}\b|rgba?\(/,'tokens only in the stillness rule');
});
