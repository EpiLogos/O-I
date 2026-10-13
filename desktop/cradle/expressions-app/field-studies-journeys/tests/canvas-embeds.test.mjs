// lane-1 A10: embed and media cards on the Research Canvas. An embed stores the
// https address it was given, never a fetched copy; a media card stores a closed
// reference to a possessed Central file. Both are refused at validation with the
// existing closed-key error style, and removing the source occurrence prunes them.
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
 temporary=await mkdtemp(join(tmpdir(),'oi-canvas-embeds-'));
 const out=join(temporary,'canvas-embeds.mjs');
 await build({
  stdin:{contents:"export * from './src/canvasEmbeds.ts';export * from './src/researchMaterial.ts';export * from './src/undoLabels.ts';",resolveDir:engine},
  tsconfig:join(engine,'tsconfig.json'),
  bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'warning',
 });
 api=await import(pathToFileURL(out));
});
test.after(()=>rm(temporary,{recursive:true,force:true}));

const location={schema:'central.path-ref/v1',ref:'ref-1',root:'Work',path:'Work/Archive/plate.png'};
function blankScene(){return {entities:[{id:'a',name:'A',position:{x:0,y:0,z:0},size:{x:.6,y:.4},text:'',sequence:{steps:[]}}],research:api.emptyResearchMaterial()};}
const wire=scene=>JSON.parse(JSON.stringify(scene.research));

test('an embed admits only an https address, stored as typed (trimmed), never fetched', ()=>{
 assert.equal(api.embedUrlRecord('https://example.org/a?b=1'),'https://example.org/a?b=1');
 assert.equal(api.embedUrlRecord('  https://example.org  '),'https://example.org','trimmed, not normalised');
 assert.equal(api.embedUrlRecord('https://example.org:8443/x#y'),'https://example.org:8443/x#y');
 for(const bad of [
  'http://example.org','HTTPS://example.org','ftp://example.org','javascript:alert(1)','https://','https://user@example.org',
  'https://exa mple.org','https://example.org\nhttps://evil.org','https://example.org/\u0007','',"https://example.org/"+'x'.repeat(2048),
  null,undefined,42,
 ]) assert.equal(api.embedUrlRecord(bad),null,JSON.stringify(bad));
});

test('the host of an embed is its label default', ()=>{
 assert.equal(api.embedHost('https://example.org:8443/x'),'example.org:8443');
 assert.equal(api.embedHost('not a url'),'');
});

test('create-card embed stores the URL, names it by host, and renders a quiet disc under the card', ()=>{
 const scene=blankScene();
 api.applyResearchMaterial(scene,{type:'create-card',kind:'embed',url:'https://example.org/page',title:'example.org',position:{x:0,y:0}});
 const created=scene.entities[scene.entities.length-1];
 const card=scene.research.cards[created.id];
 assert.equal(card.type,'embed');
 assert.equal(card.url,'https://example.org/page');
 assert.deepEqual(card.size,api.EMBED_CARD_SIZE);
 assert.equal(created.name,'example.org');
 assert.equal(created.shape,'disc');
 assert.equal(created.text,'','no text on the stage');
 assert.equal(card.media,undefined);
});

test('create-card embed refuses a non-https address with the closed error, and leaves the Scene intact', ()=>{
 const scene=blankScene();
 const before=JSON.stringify(wire(scene));
 assert.throws(()=>api.applyResearchMaterial(scene,{type:'create-card',kind:'embed',url:'http://example.org',position:{x:0,y:0}}),/Invalid embed link/);
 assert.throws(()=>api.applyResearchMaterial(scene,{type:'create-card',kind:'embed',position:{x:0,y:0}}),/Invalid embed link/);
 assert.equal(JSON.stringify(wire(scene)),before);
});

test('the validator admits an embed and refuses a url on any other kind or a disallowed address', ()=>{
 const ids=new Set(['a']);
 const with_=card=>({schema:'oi.research-scene/v1',cards:{a:card},strokes:[],views:{},timeline:{}});
 assert.doesNotThrow(()=>api.validateResearchMaterial(with_({type:'embed',url:'https://example.org'}),ids));
 for(const refused of [
  {type:'embed'},
  {type:'embed',url:'http://example.org'},
  {type:'embed',url:'https://example.org',colour:'red'},
  {type:'note',url:'https://example.org'},
  {type:'image',url:'https://example.org'},
 ]) assert.throws(()=>api.validateResearchMaterial(with_(refused),ids),/Invalid embed link|Only note cards|Unknown|Invalid/,JSON.stringify(refused));
});

test('a media card holds a closed Central path reference, never bytes or a remote address', ()=>{
 assert.equal(api.isCentralPathRef(location),true);
 for(const bad of [
  {...location,extra:1},
  {schema:'central.path-ref/v1',ref:'r',root:'Work'},
  {...location,schema:'file'},
  {...location,path:''},
  {...location,path:'x'.repeat(1025)},
  'https://example.org/plate.png',
  {url:'https://example.org/plate.png'},
  null,
 ]) assert.equal(api.isCentralPathRef(bad),false,JSON.stringify(bad));
});

test('create-card media names the card by its file and stores the reference', ()=>{
 const scene=blankScene();
 api.applyResearchMaterial(scene,{type:'create-card',kind:'media',media:location,position:{x:0,y:0}});
 const created=scene.entities[scene.entities.length-1];
 const card=scene.research.cards[created.id];
 assert.equal(card.type,'media');
 assert.deepEqual(card.media,location);
 assert.equal(created.name,'plate.png');
 assert.deepEqual(card.size,api.MEDIA_CARD_SIZE);
 assert.equal(card.url,undefined);
});

test('the media source address is the material protocol address of the file, never a remote one', ()=>{
 const url=api.mediaSourceUrl(location);
 assert.ok(url.startsWith('oi-material://localhost/'),url);
 assert.equal(url.includes('https://'),false);
 assert.equal(decodeURIComponent(url.slice('oi-material://localhost/'.length,-1)),JSON.stringify(location));
 assert.equal(api.mediaFileName(location),'plate.png');
});

test('removing the source occurrence prunes its embed card, as it prunes every card', ()=>{
 const scene=blankScene();
 api.applyResearchMaterial(scene,{type:'create-card',kind:'embed',url:'https://example.org',title:'example.org',position:{x:0,y:0}});
 const created=scene.entities[scene.entities.length-1];
 api.applyResearchMaterial(scene,{type:'frame-save',id:'f1',label:'F',memberRefs:[created.id]});
 api.pruneResearchOccurrence(scene,created.id);
 assert.equal(scene.research.cards[created.id],undefined);
 assert.equal(scene.research.frames.f1,undefined,'a frame left with no member is removed');
});

test('a link card is named for its embed label and carries the card colour grammar only', ()=>{
 const card={type:'embed',url:'https://example.org',caption:'  The source  '};
 assert.equal(api.embedCardLabel(card,'example.org'),'The source');
 assert.equal(api.embedCardLabel({type:'embed',url:'https://example.org'},'example.org'),'example.org');
 const nodes=api.canvasEmbedNodes([{id:'n1',title:'example.org',type:'note'},{id:'n2',title:'Other',type:'note'}],id=>id==='n1'?card:undefined);
 assert.equal(nodes[0].type,'text','the embed renders as a label-only node, never the note editor');
 assert.equal(nodes[0].title,'The source');
 assert.equal(nodes[1].type,'note','a card that is not an embed passes through unchanged');
});

test('undo names a link card and a media card as what they add', ()=>{
 assert.equal(api.researchMaterialLabel({type:'create-card',kind:'embed'}),'Add link card');
 assert.equal(api.researchMaterialLabel({type:'create-card',kind:'media'}),'Add media card');
 assert.equal(api.researchMaterialLabel({type:'create-card',kind:'note'}),'Add card');
 assert.equal(api.researchMaterialLabel({type:'frame-title'}),'Title frame');
});

test('the overlay box follows the flow box and the viewport, so it moves with the card', ()=>{
 assert.deepEqual(api.cardOverlayBox({x:10,y:20,width:320,height:200},{x:100,y:50,zoom:2}),{left:120,top:90,width:640,height:400});
});
