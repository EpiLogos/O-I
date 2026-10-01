import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {register} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultReadingText} from './default-reading-text.mjs';

register('./ts-transpile-hook.mjs',import.meta.url);
register('./knowledge-render-hook.mjs',import.meta.url);
// A separate source path supports replaying this same acceptance against the
// actual prior renderer, without editing the shared checkout or mirroring it.
const nodeSource=process.env.KNOWLEDGE_NODE_DETAILS_SOURCE?pathToFileURL(process.env.KNOWLEDGE_NODE_DETAILS_SOURCE).href:new URL('../src/knowledge/NodeDetails.tsx',import.meta.url).href;
const {ReadingBody}=await import(nodeSource);
const {WikiReader,WikiReadingPreview}=await import('../src/knowledge/WikiReader.tsx');
const directory=await mkdtemp(join(tmpdir(),'oi-knowledge-readable-native-'));
test.after(()=>rm(directory,{recursive:true,force:true}));
await mkdir(join(directory,'Control/user'),{recursive:true});
await mkdir(join(directory,'Work'),{recursive:true});
const binary=process.env.OI_AIKIT_BIN??process.env.AIKIT_BIN??'aikit';
const identity='world:shared-expression:ann/artifact:shared-continuation-guide';
const record={title:'Shared continuation guide',summary:'Keep shared work attributable and reopen the saved result.',ref:identity,revision:'native-revision-73009'};
const array=[record,{title:'world:unknown:subject-one',ref:'world:unknown:subject-one'},{ref:'world:unknown:subject-two'}];
const markdown='---\ntitle: Human guide\n---\n# Reading guide\n\n**Shared work** remains attributable.\n\n| Action | Result |\n| --- | --- |\n| Reopen | Saved work |\n\n```json\n{"subject":"world:keep:authored-code"}\n```\n';
const corpus={
  array:{title:'Shared undertaking collection',body:JSON.stringify(array),media_type:'application/json'},
  record:{title:'Shared continuation guide',body:JSON.stringify(record),media_type:'application/json'},
  markdown:{title:'Human guide',body:markdown,media_type:'text/markdown'},
  untitled:{title:'',body:'A linked paragraph without a title.',media_type:'text/markdown'},
  prose:{title:'Technical explanation',body:'Use world:keep:authored-prose in the native source command.',media_type:'text/plain'},
  reference:{title:'Reference-only source',body:JSON.stringify(identity),media_type:'application/json'},
  links:{title:'Authored link context',body:'[Authored alias](untitled.md)\n\n[source:readable-untitled](untitled.md)\n',media_type:'text/markdown'},
  large:{title:'Large shared undertaking collection',body:JSON.stringify(Array.from({length:103},(_,index)=>({title:`Undertaking ${index+1}`,summary:'Saved native material.'}))),media_type:'application/json'},
};
await writeFile(join(directory,'source-material.json'),JSON.stringify(Object.entries(corpus).map(([key,value])=>({binding:{source:`source:readable-${key}`,revision:'r1',title:value.title,tags:[],visibility:'public',owners:[],media_type:value.media_type,locator:{kind:'path',value:`/world/${key}.${value.media_type==='text/markdown'?'md':'json'}`},metadata:{}},body:value.body}))));
// Native project discovery must stand in this controlled owner world even
// when TMPDIR is inside another Central project: -C selects the working
// directory, while ancestor discovery otherwise expands its source horizon.
const env={PATH:process.env.PATH,CENTRAL_ROOT:directory,AIKIT_HOME:join(directory,'aikit-home')};
const readings={};
for(const key of Object.keys(corpus)) {
  const envelope=JSON.parse(execFileSync(binary,['--json','-C',directory,'knowledge','read','--',JSON.stringify({kind:'source',value:`source:readable-${key}`})],{env,encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024}));
  assert.equal(envelope.ok,true,JSON.stringify(envelope));readings[key]=envelope.data;
  assert.equal(readings[key].resource,`source:readable-${key}`);
  assert.equal(readings[key].content,corpus[key].body);
}
const render=(Component,props)=>renderToStaticMarkup(createElement(Component,props));
// Python's HTML parser observes default details semantics and announced names;
// data attributes remain structured bindings, never visible/announced text.
const defaultText=defaultReadingText;

test('real native structured array presents useful names and descriptions, with exact identities available on inspection',()=>{
  assert.equal(readings.array.document,undefined,'the owner returned structured material, not a Markdown document');
  const html=render(ReadingBody,{reading:readings.array}),text=defaultText(html);
  assert.match(text,/Shared continuation guide/);assert.match(text,/Keep shared work attributable/);
  assert.match(text,/Unnamed item 2/);assert.match(text,/Unnamed item 3/);
  assert.doesNotMatch(text,/world:|native-revision|\{"title"/);
  assert.match(html,/Inspect exact owner reading/);assert.ok(html.includes(identity));
  assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
});

test('real native structured object keeps its written meaning and exact source together without a revision footer',()=>{
  const html=render(ReadingBody,{reading:readings.record}),text=defaultText(html);
  assert.match(text,/Keep shared work attributable/);assert.doesNotMatch(text,/world:|native-revision|Revision r1/);
  assert.ok(html.includes(readings.record.resource));assert.ok(html.includes(readings.record.content.replaceAll('"','&quot;')));
});

test('a native reference-only value has truthful reading status and keeps its exact identity on inspection',()=>{
  const html=render(ReadingBody,{reading:readings.reference}),text=defaultText(html);
  assert.match(text,/reference without a written description/);assert.doesNotMatch(text,/world:/);
  assert.ok(html.includes(identity));assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
});

test('real native large collection is bounded and offers deliberate expansion',()=>{
  const html=render(ReadingBody,{reading:readings.large}),text=defaultText(html);
  assert.match(text,/103 items in this source · showing 50/);assert.match(text,/Show more items/);
  assert.equal((html.match(/<li>/g)??[]).length,50);assert.doesNotMatch(text,/Undertaking 51/);
});

test('native Markdown and technical prose retain authored code and words',()=>{
  const html=render(ReadingBody,{reading:readings.markdown});
  assert.match(html,/<h1[^>]*>/);assert.match(html,/<strong[^>]*>.*Shared work/);
  assert.match(html,/<table>/);assert.match(html,/<pre[^>]*><code>/);
  assert.match(defaultText(html),/world:keep:authored-code/);
  assert.equal(defaultText(render(ReadingBody,{reading:readings.prose})).trim(),corpus.prose.body);
});

test('linked-source preview uses its native title and format, with exact source behind closed inspection',()=>{
  const html=render(WikiReadingPreview,{reading:readings.markdown,label:'Authored alias',onOpen:()=>{},onClose:()=>{}}),text=defaultText(html);
  assert.match(text,/Human guide/);assert.match(html,/<strong>Human guide<\/strong>/);assert.match(html,/<table>/);
  assert.doesNotMatch(text,/source:readable-markdown/);assert.ok(html.includes(readings.markdown.resource));
  assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
  assert.match(defaultText(render(WikiReadingPreview,{reading:readings.untitled,label:'Authored alias',onOpen:()=>{},onClose:()=>{}})),/Authored alias/);
  assert.match(defaultText(render(WikiReadingPreview,{reading:readings.untitled,label:'source:readable-untitled',onOpen:()=>{},onClose:()=>{}})),/Untitled linked source/);
});

test('native internal link aliases remain readable and retain their exact source target without reference tooltips',()=>{
  assert.ok(readings.links.document.occurrences.some(item=>item.state==='resolved'&&item.target?.value===readings.untitled.resource),'the owner resolved the authored internal link');
  const html=render(WikiReader,{reading:readings.links}),text=defaultText(html);
  assert.match(text,/Authored alias/);assert.match(text,/Linked source/);assert.doesNotMatch(text,/source:readable-untitled/);
  assert.match(html,/data-target-ref="source:readable-untitled"/);assert.match(html,/data-link-destination="untitled.md"/);
  assert.match(defaultText(render(WikiReader,{reading:readings.untitled})),/Authored link context/);
});

test('malformed native revision preserves exact material for inspection without displaying it as current prose',()=>{
  const reading={...readings.markdown,revision:'changed-after-read'};
  const html=render(WikiReader,{reading}),text=defaultText(html);
  assert.match(text,/formatted reading is unavailable/);assert.doesNotMatch(text,/world:keep:authored-code|Reading guide/);
  assert.ok(html.includes('world:keep:authored-code'));assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
});
