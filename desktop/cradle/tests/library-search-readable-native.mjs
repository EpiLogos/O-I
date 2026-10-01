import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';

// Real native source discovery and AgentProfile save/roster operations. The
// directory is an isolated owner root, not a replacement transport or service.
const cradle=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=await mkdtemp(join(process.env.OI_TEST_RUN_DIR??tmpdir(),'oi-library-search-native-'));
test.after(()=>rm(directory,{recursive:true,force:true}));
process.once('exit',()=>rmSync(directory,{recursive:true,force:true}));
const aikit=process.env.OI_AIKIT_BIN??process.env.AIKIT_BIN??'aikit';
const ctrl=process.env.OI_CTRL_BIN??process.env.CTRL_BIN??'ctrl';
const reference='source:readable-shared-continuation';
const title='Shared continuation guide';
const longTitle='Shared continuation across several people, saved contexts and independently reopened native documents';
const records=[
 {ref:reference,title,body:'Keep continuation work attributable and reopen the saved result.'},
 {ref:'source:readable-unnamed-one',title:'world:shared-expression:ann/artifact:unnamed-one',body:'Continuation decisions can be reopened from their native source.'},
 {ref:'source:readable-unnamed-two',title:'',body:'Continuation remains recoverable when a name is missing.'},
 {ref:'source:readable-long-name',title:longTitle,body:'Continuation checks are tied to the saved source.'},
 {ref:'source:readable-authored-technical-prose',title:'Technical continuation instructions',body:'Use world:keep:authored-prose in the native continuation source command.'},
];
await writeFile(join(directory,'source-material.json'),JSON.stringify(records.map(record=>({binding:{source:record.ref,revision:'revision-native-73009',title:record.title,tags:[],visibility:'public',owners:[],media_type:'text/plain',locator:{kind:'path',value:`/world/${record.ref.slice(7)}.txt`},metadata:{}},body:record.body}))));
// An isolated native owner root remains isolated when the run space is inside
// an existing Central world. Parent-world discovery must not change its scope.
await mkdir(join(directory,'Control'),{recursive:true});
await mkdir(join(directory,'Work'),{recursive:true});
const nativeEnv={PATH:process.env.PATH,CENTRAL_ROOT:directory,AIKIT_HOME:join(directory,'aikit-home')};
const searchEnvelope=JSON.parse(execFileSync(aikit,['--json','-C',directory,'knowledge','search','continuation','--limit','20'],{env:nativeEnv,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024}));
assert.equal(searchEnvelope.ok,true,JSON.stringify(searchEnvelope));
const hits=searchEnvelope.data.hits;
assert.ok(hits.find(hit=>hit.resource===reference),'the real native source provider must discover the authored guide');
const nativeRoot=join(directory,'central');
await mkdir(nativeRoot,{recursive:true});
await mkdir(join(nativeRoot,'Control'),{recursive:true});
await mkdir(join(nativeRoot,'Work'),{recursive:true});
const action=(name,input)=>{
 const envelope=JSON.parse(execFileSync(ctrl,['--json','--root',nativeRoot,'action','run',name,JSON.stringify(input)],{encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024}));
 assert.equal(envelope.ok,true,JSON.stringify(envelope));return envelope.data;
};
const profiles=[
 {name:'Ada',ref:'agent-profile:readable-ada',agent_ref:'agent:expressed-73009',purpose:'Keep shared work attributable.',role:'shared-work-guardian'},
 {name:'agent:expressed-73010',ref:'agent-profile:readable-unnamed',agent_ref:'agent:expressed-73010',purpose:'Carry the saved source into the next session.'},
 {ref:'agent-profile:readable-nameless-one',agent_ref:'agent/continuation-caretaker',purpose:'Keep the unnamed source attributable.'},
 {ref:'agent-profile:readable-nameless-two',agent_ref:'agent:continuation-researcher',purpose:'Reopen the other unnamed source.'},
];
for(const profile of profiles)action('agent-profile.save',{scope:'root',profile:{...profile,schema:'central.agent-profile/v1',revision:'native-profile-r1',scope:'personal',world_ref:'control:root',ratified_world_refs:['control:root'],skill_refs:['skill:readable-shared-work'],governance_refs:['source:readable-governance']}});
const roster=action('agent-profile.roster',{scope:'root'});
assert.equal(roster.schema,'central.agent-profile-roster/v1');
assert.equal(roster.profiles.length,profiles.length);
const guideHit=hits.find(hit=>hit.resource===reference);
const explanationEnvelope=JSON.parse(execFileSync(aikit,['--json','-C',directory,'knowledge','explain','--',JSON.stringify(guideHit.address)],{env:nativeEnv,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024}));
assert.equal(explanationEnvelope.ok,true,JSON.stringify(explanationEnvelope));
let missingEnvelope;
try {execFileSync(aikit,['--json','-C',directory,'knowledge','read','--',JSON.stringify({kind:'source',value:'source:readable-missing-endpoint'})],{env:nativeEnv,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});}
catch(error){missingEnvelope=JSON.parse(error.stdout);}
assert.equal(missingEnvelope?.ok,false,'the real native owner must refuse the absent source');
if(process.env.OI_PRESENTATION_EVIDENCE_DIR)await writeFile(join(process.env.OI_PRESENTATION_EVIDENCE_DIR,'library-search-native-owner-readings.json'),JSON.stringify({search:searchEnvelope,explain:explanationEnvelope,roster},null,2));
const bundle=join(directory,'render.cjs');
await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {LibraryResults} from './src/library/LibraryResults'; import {ItemRow} from './src/library/LibraryBrowse'; import {NativeSearchHit,SearchReadingFailure} from './src/knowledge/searchPresentation'; import {ObjectPageReading} from './src/agent/objects/ObjectPage'; import {agentReading} from './src/agent/objects/agentObject'; import {rosterFromReading} from './src/agency/roster'; import {interceptObjectOpens,objectKindOf,holdHanded} from './src/agent/objects/registry'; import './src/agent/objects/kinds'; export {LibraryResults,ItemRow,NativeSearchHit,SearchReadingFailure,ObjectPageReading,agentReading,rosterFromReading,interceptObjectOpens,objectKindOf,holdHanded}; export const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));`,resolveDir:cradle,loader:'tsx'},bundle:true,platform:'node',format:'cjs',outfile:bundle,jsx:'automatic',nodePaths:[join(cradle,'node_modules')],loader:{'.css':'empty'},logLevel:'error',plugins:[{name:'source-bound-reader',setup(b){
 b.onResolve({filter:/\?raw$/},a=>({path:join(a.resolveDir,a.path.slice(0,-4)),namespace:'raw'}));
 b.onLoad({filter:/.*/,namespace:'raw'},async a=>({contents:await readFile(a.path,'utf8'),loader:'text'}));
 if(process.env.LIBRARY_RESULTS_SOURCE)b.onLoad({filter:/\/library\/LibraryResults\.tsx$/},async()=>({contents:await readFile(process.env.LIBRARY_RESULTS_SOURCE,'utf8'),loader:'tsx'}));
 if(process.env.ROSTER_SOURCE)b.onLoad({filter:/\/agency\/roster\.ts$/},async()=>({contents:await readFile(process.env.ROSTER_SOURCE,'utf8'),loader:'ts'}));
}}]});
const app=createRequire(import.meta.url)(bundle);
const defaultText=html=>execFileSync('python3',['-c',String.raw`
from html.parser import HTMLParser
import sys
class Text(HTMLParser):
 def __init__(self): super().__init__(); self.details=[]; self.output=[]
 def visible(self): return all(opened or summary for opened,summary in self.details)
 def handle_starttag(self,tag,attributes):
  attrs=dict(attributes)
  if tag=='details': self.details.append(['open' in attrs,False])
  if tag=='summary' and self.details: self.details[-1][1]=True
  if self.visible(): self.output.extend(attrs[key] for key in ['aria-label','title'] if attrs.get(key))
 def handle_endtag(self,tag):
  if tag=='summary' and self.details: self.details[-1][1]=False
  if tag=='details': self.details.pop()
 def handle_data(self,value):
  if self.visible(): self.output.append(value)
p=Text(); p.feed(sys.stdin.read()); print(' '.join(p.output))
`],{input:html,encoding:'utf8'});
const items=hits.map(hit=>({kind:'page',ref:hit.resource,title:hit.label,summary:hit.snippet,owner:hit.provider,scope:'local',provider:'wiki',address:hit.address,revision:'revision-native-73009',sourceLocation:{schema:'central.path-ref/v1',ref:hit.resource,path:`/world/${hit.resource}.txt`}}));
const buttons=element=>{
 if(!element||typeof element!=='object')return [];
 if(Array.isArray(element))return element.flatMap(buttons);
 return [...(element.type==='button'?[element]:[]),...buttons(element.props?.children)];
};
test('native search -> production Library rows show names with source identities only on deliberate inspection',()=>{
 const guide=items.find(item=>item.ref===reference);
 const html=app.render(app.LibraryResults,{items,coverage:[],selectedRef:guide.ref,onSelect:()=>{},onOpen:()=>{}}),text=defaultText(html);
 assert.match(text,/Shared continuation guide/);assert.match(text,/Keep continuation work attributable/);assert.match(text,new RegExp(longTitle));
 const unnamedNumbers=[...text.matchAll(/Unnamed page (\d+)/g)].map(match=>match[1]);assert.equal(new Set(unnamedNumbers).size,2,'each native unnamed subject remains distinguishable in this reading');
 assert.doesNotMatch(text,/source:readable-|world:shared-expression|revision-native-73009|provider\//);
 assert.ok(html.includes(reference));assert.ok(html.includes('revision-native-73009'));assert.match(html,/Source and identity/);
 assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
});
test('production columnar Library actions retain the exact native source, page and insertion binding',()=>{
 const guide=items.find(item=>item.ref===reference),selected=[],opened=[];
 const tree=app.ItemRow({item:guide,selected:true,onSelect:item=>selected.push(item),onOpen:(item,how)=>opened.push({item,how})});
 const controls=buttons(tree);controls[0].props.onClick();for(const control of controls.slice(1))control.props.onClick();
 assert.equal(selected[0],guide);assert.deepEqual(opened.map(({how})=>how),['page','instrument','source']);assert.ok(opened.every(({item})=>item===guide));
 const text=defaultText(app.render(app.ItemRow,{item:guide,selected:true,onSelect:()=>{},onOpen:()=>{}}));
 assert.doesNotMatch(text,/source:readable-|revision-native|provider\//);
});
test('native Search results use names for visual and announced text while exact opening and explaining addresses survive',()=>{
 for(const [index,hit] of hits.entries()) {
  const opened=[],explained=[];
  const props={hit,index,selected:false,onSelect:()=>{},onOpen:()=>opened.push(hit.address),onExplain:()=>explained.push(hit.address)};
  const controls=buttons(app.NativeSearchHit(props));controls[0].props.onClick();controls[1].props.onClick();
  assert.deepEqual(opened,[hit.address]);assert.deepEqual(explained,[hit.address]);
  const text=defaultText(app.render(app.NativeSearchHit,props));
  assert.doesNotMatch(text,/world:shared-expression|source:readable-|knowledge-source/);
  if(hit.resource===reference)assert.match(text,/Shared continuation guide/);
  if(hit.resource==='source:readable-authored-technical-prose')assert.match(text,/world:keep:authored-prose/,'authored technical prose is preserved');
 }
});
test('real native AgentProfile roster -> production object page preserves purpose and exact owner reading behind Show raw',()=>{
 for(const agent of app.rosterFromReading(roster)) {
  const object={kind:'agent',ref:agent.ref,title:agent.name};
  const reading=app.agentReading(agent,object);
  const html=app.render(app.ObjectPageReading,{object,def:app.objectKindOf('agent'),reading}),text=defaultText(html);
  assert.match(text,new RegExp(agent.purpose));assert.doesNotMatch(text,/agent:expressed-|agent-profile:|native-profile-r1|control:root|skill:|source:readable-governance/);
  assert.ok(html.includes(agent.ref));assert.ok(html.includes(agent.profileRef));assert.match(html,/Show raw/);assert.doesNotMatch(html,/<details[^>]*\sopen(?:[\s=>])/);
 }
});
test('actual native profiles without names keep distinct unnamed roster labels and exact object identities',()=>{
 const agents=app.rosterFromReading(roster),unnamed=[];
 assert.equal(agents.find(agent=>agent.ref===profiles[0].agent_ref).name,'Ada');
 for(const profile of profiles.filter(profile=>!Object.hasOwn(profile,'name'))) {
  const saved=roster.profiles.find(entry=>entry.profile.agent_ref===profile.agent_ref);
  assert.ok(saved,'the actual native owner retained the nameless profile');
  assert.equal(saved.profile.name,undefined,'no authored name was supplied or inferred by this native owner');
  const agent=agents.find(agent=>agent.ref===profile.agent_ref);unnamed.push(agent.name);
  assert.match(agent.name,/^Unnamed agent \d+$/);assert.equal(agent.profileRef,profile.ref);assert.equal(agent.purpose,profile.purpose);
  const object={kind:'agent',ref:agent.ref,title:agent.name},opened=[];
  const props={object,def:app.objectKindOf('agent'),reading:app.agentReading(agent,object)};
  const stop=app.interceptObjectOpens(detail=>{opened.push(detail);return true;});
  try {buttons(app.ObjectPageReading(props)).find(control=>control.props.className==='oi-action object-popout').props.onClick();}finally{stop();}
  assert.deepEqual(opened,[{object,popOut:true}]);
  const html=app.render(app.ObjectPageReading,props),text=defaultText(html);
  assert.match(text,new RegExp(agent.name));assert.match(text,new RegExp(profile.purpose));
  assert.doesNotMatch(text,/agent\/continuation|agent:continuation|Continuation Caretaker|Continuation Researcher|agent-profile:/);
  assert.ok(html.includes(profile.agent_ref));assert.ok(html.includes(profile.ref));
 }
 assert.equal(new Set(unnamed).size,unnamed.length,'ordinal labels distinguish separate native unnamed agents');
 assert.match(agents.find(agent=>agent.ref===profiles[1].agent_ref).name,/^Unnamed agent \d+$/,'a reference-shaped supplied name does not become an ordinary roster label');
});
test('unknown and missing objects retain truthful state, retry and exact popout identity without using their ref as a name',async()=>{
 const object={kind:'owner.unregistered-kind',ref:'world:private:missing-object',title:'world:private:missing-object'};
 const received=[];const stop=app.interceptObjectOpens(detail=>{received.push(detail);return true;});
 try {buttons(app.ObjectPageReading({object})).find(control=>control.props.className==='oi-action object-popout').props.onClick();}finally{stop();}
 assert.deepEqual(received,[{object,popOut:true}]);
 const html=app.render(app.ObjectPageReading,{object}),text=defaultText(html);
 assert.match(text,/Unnamed object/);assert.match(text,/no registered page/);assert.doesNotMatch(text,/world:|owner.unregistered/);assert.ok(html.includes(object.ref));
 const absent=await app.objectKindOf('handed').read({...object,kind:'handed'},{transport:{kind:'unavailable'}});
 const absentText=defaultText(app.render(app.ObjectPageReading,{object:{...object,kind:'handed'},def:app.objectKindOf('handed'),reading:absent}));
 assert.match(absentText,/Not held any more/);assert.match(absentText,/Open it again from where it lives/);assert.doesNotMatch(absentText,/world:/);
});
test('coverage names stale, missing and partial native states while retaining exact reasons in depth',()=>{
 const coverage=[{provider:'provider/native-offline',state:'unavailable',reason:'Cannot read source:missing-reader at revision:9'},{provider:'wiki',state:'stale',reason:'Source changed'},{provider:'shared-field',state:'partial',reason:'Two relations unavailable'}];
 const html=app.render(app.LibraryResults,{items:[],coverage,onSelect:()=>{},onOpen:()=>{}}),text=defaultText(html);
 assert.doesNotMatch(text,/provider\/native|source:missing-reader|revision:9/);assert.match(text,/unavailable/);assert.match(text,/out of date/);assert.match(text,/some sources could not be read/);assert.ok(html.includes('source:missing-reader'));
});
test('real absent-source refusal -> production search presents a recovery instruction and retains exact native reason on inspection',()=>{
 const exactReason=JSON.stringify(missingEnvelope);
 const html=app.render(app.SearchReadingFailure,{error:exactReason}),text=defaultText(html);
 assert.match(text,/Search reading unavailable/);assert.match(text,/Retry the search/);assert.doesNotMatch(text,/source:readable-missing-endpoint|\{"|invalid_input/);assert.ok(html.includes('source:readable-missing-endpoint'));assert.match(html,/Reading details/);
});
test('native profile update and a new owner process keep identity while replacing the stale name and purpose',()=>{
 const profile=profiles[0];
 action('agent-profile.save',{scope:'root',expected_revision:'native-profile-r1',profile:{...profile,name:'Ada — continuing shared work',purpose:'Reopen the verified shared result.',schema:'central.agent-profile/v1',revision:'native-profile-r2',scope:'personal',world_ref:'control:root',ratified_world_refs:['control:root'],skill_refs:['skill:readable-shared-work'],governance_refs:['source:readable-governance']}});
 const current=app.rosterFromReading(action('agent-profile.roster',{scope:'root'})).find(agent=>agent.ref===profile.agent_ref);
 assert.equal(current.ref,profile.agent_ref);assert.equal(current.profileRef,profile.ref);assert.equal(current.revision,'native-profile-r2');
 const object={kind:'agent',ref:current.ref,title:'The earlier index name'};
 const html=app.render(app.ObjectPageReading,{object,def:app.objectKindOf('agent'),reading:app.agentReading(current,object)}),text=defaultText(html);
 assert.match(text,/Ada — continuing shared work/);assert.match(text,/Reopen the verified shared result/);assert.doesNotMatch(text,/The earlier index name|Keep shared work attributable|native-profile-r2|agent:expressed/);
 assert.ok(html.includes(profile.agent_ref));assert.ok(html.includes('native-profile-r2'));
});
