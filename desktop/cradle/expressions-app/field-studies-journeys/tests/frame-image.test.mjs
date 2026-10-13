// lane-1 B3: frame export as image. The PNG is the rendered stage, cut to the
// frame's members and the connections between them. The browser stage renderer
// is not run here (no DOM in this repo's test runner); its pure parts are tested
// over plain models of the rendered tree: membership, chrome stripping, the
// viewBox maths, and which resources can be copied.
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
let temporary;
test.before(async()=>{
 temporary=await mkdtemp(join(tmpdir(),'oi-frame-image-'));
 const out=join(temporary,'frame-image.mjs');
 await build({
  stdin:{contents:"export * from './src/frameImage.ts';",resolveDir:engine},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
});
test.after(()=>rm(temporary,{recursive:true,force:true}));

const alpha={x:100,y:200,width:240,height:160};
const beta={x:400,y:240,width:240,height:160};

test('the frame bounds are exactly the union of its members, and empty selections have none', ()=>{
 assert.deepEqual(api.frameBounds([alpha,beta]),{x:100,y:200,width:540,height:200});
 assert.equal(api.frameBounds([]),null);
 assert.deepEqual(api.frameBounds([alpha],10),{x:90,y:190,width:260,height:180});
});

test('the PNG is the frame bounds at 2x device resolution, and the stage viewBox is the frame in canvas units', ()=>{
 const bounds={x:100,y:200,width:540,height:200};
 assert.deepEqual(api.frameImageSize(bounds),{width:1080,height:400});
 assert.deepEqual(api.frameImageSize({x:0,y:0,width:0.2,height:0.2}),{width:1,height:1});
 assert.deepEqual(api.stageViewBox(bounds),{width:1080,height:400,viewBox:'0 0 540 200'});
});

test('a card is placed inside the stage at its offset from the frame origin', ()=>{
 const bounds={x:100,y:200,width:540,height:200};
 assert.deepEqual(api.stagePlacement(alpha,bounds),{left:0,top:0});
 assert.deepEqual(api.stagePlacement(beta,bounds),{left:300,top:40});
});

test('the frame keeps only the connections whose both ends are members, and counts those that leave', ()=>{
 const members=new Set(['a','b']);
 const edges=[
  {id:'ab',sourceId:'a',targetId:'b'},
  {id:'ac',sourceId:'a',targetId:'c'},
  {id:'cd',sourceId:'c',targetId:'d'},
 ];
 const selection=api.frameSelection(members,edges);
 assert.deepEqual(selection.edges.map(edge=>edge.id),['ab']);
 assert.equal(selection.leaving,2);
});

test('chrome is recognised by class and removed as whole subtrees from a plain model of the rendered card', ()=>{
 const card={
  classes:['react-flow__node','react-flow__node-note'],id:'a',
  children:[
   {classes:['card-body'],children:[{classes:['card-title'],children:[]}]},
   {classes:['flow-handle'],children:[{classes:['flow-handle-dot'],children:[]}]},
   {classes:['node-resize-control','node-resize-control--bottom-right'],children:[{classes:['node-resize-grip'],children:[]}]},
   {classes:['canvas-zoom-readout'],children:[]},
  ],
 };
 const {kept,removed}=api.stripChrome(card);
 assert.equal(removed,3);
 assert.deepEqual(kept.children.map(child=>child.classes[0]),['card-body']);
 assert.deepEqual(kept.children[0].children[0].classes,['card-title']);
 assert.equal(api.isChromeClass(['react-flow__node']),false);
 assert.equal(api.isChromeClass(['card-body','react-flow__handle']),true);
});

test('the stage removes the same chrome that the selector names', ()=>{
 for(const name of ['flow-handle','react-flow__handle','node-resize-control','react-flow__nodesselection','react-flow__minimap','canvas-toolbar','canvas-zoom-readout'])
  assert.ok(api.CHROME_CLASSES.includes(name),name);
 assert.ok(api.CHROME_SELECTOR.includes('.flow-handle'));
});

test('url() references and font families are read from computed values', ()=>{
 assert.deepEqual(api.cssUrls('url("https://a.example/x.png"), url(data:image/png;base64,AAA)'),['https://a.example/x.png','data:image/png;base64,AAA']);
 assert.deepEqual(api.cssUrls('none'),[]);
 assert.deepEqual(api.fontFamilies('"Inter", \'Helvetica Neue\', sans-serif'),['Inter','Helvetica Neue','sans-serif']);
});

test('a resource is classified before it is copied: inline, same origin, or cross-origin (named when it fails)', ()=>{
 const origin='https://oi.local';
 assert.equal(api.resourceKind('data:image/png;base64,AAA',origin),'inline');
 assert.equal(api.resourceKind('/fonts/inter.woff2',origin),'same-origin');
 assert.equal(api.resourceKind('https://cdn.example/font.woff2',origin),'cross-origin');
});

test('lane-1 B3: the paper is the stage’s own opaque background, read from the flow up; transparent layers are skipped', () => {
  for (const colour of ['transparent', 'rgba(0, 0, 0, 0)', 'rgba(12,34,56,0)', 'rgb(1 2 3 / 0)', 'rgb(1 2 3 / 0%)']) assert.equal(api.isTransparent(colour), true, colour);
  for (const colour of ['rgb(250, 249, 245)', 'rgba(20, 20, 20, 1)', 'rgba(20,20,20,0.5)', 'rgb(1 2 3 / 50%)']) assert.equal(api.isTransparent(colour), false, colour);
  const styles = new Map();
  const node = (bg, parent = null) => { const el = {parentElement: parent}; styles.set(el, bg); return el; };
  const page = node('rgb(18, 18, 20)'), pane = node('rgba(0, 0, 0, 0)', page), flow = node('transparent', pane);
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = el => ({backgroundColor: styles.get(el)});
  try {
    assert.equal(api.stagePaper(flow), 'rgb(18, 18, 20)', 'a dark theme exports on its dark paper');
    assert.equal(api.stagePaper(node('transparent')), '#ffffff', 'white only when nothing paints');
  } finally { globalThis.getComputedStyle = previous; }
});
