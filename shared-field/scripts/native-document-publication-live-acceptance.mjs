/** Consume the real Central owner reading/export, never a response fixture. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {curatedArtifactFromCentralDocument} from '../curated-html-projection.mjs';
const args=process.argv.slice(2), flag=(name)=>args[args.indexOf(name)+1];
for(const name of ['--root','--source','--document']) if(!args.includes(name)) throw new Error(`${name} is required`);
const input={source_ref:flag('--source'),document_id:flag('--document')};
const call=(name)=>{
 const envelope=JSON.parse(execFileSync('ctrl',['--json','--root',flag('--root'),'action','run',name,JSON.stringify(input)],{encoding:'utf8'}));
 assert.equal(envelope.ok,true,JSON.stringify(envelope.error));return envelope.data;
};
const reading=call('central.document.read'), exported=call('central.document.export');
const material=curatedArtifactFromCentralDocument(reading,exported);
for(const entry of reading.document.entries){
 const expected=reading.document.contributions.filter((body)=>body.entry_id===entry.id&&!body.removed);
 const held=material.entries.find((body)=>body.id===entry.id);assert.ok(held);
 for(const contribution of expected){assert.ok(held.html.includes(contribution.author_ref),'native author attribution must travel');assert.ok(held.html.includes(contribution.html),'the exact owner-rendered contribution body must travel');}
}
assert.equal(material.source.revision,reading.revision.revision);
assert.ok(material.entries.some((entry)=>entry.html.includes('Shared continuation guide')),'the actual agent result must be present as material');
assert.throws(()=>curatedArtifactFromCentralDocument(reading,{...exported,snapshot:{...exported.snapshot,revision:{revision:'stale'}}}),/revision|basis/i);
console.log(JSON.stringify({acceptance:'controlled-user-native-source',source_ref:reading.source.ref,source_revision:reading.revision.revision,entries:material.entries.length,passed:['actual native contribution body and attribution retained','exact source revision retained','stale export refused']}));
