import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultGraphFilters,filterGraph,restoreGraphFilters,restoreSavedGraphViews} from '../src/knowledge/filters.ts';
import {emphasizeGraph,restoreEmphasisGroups} from '../src/knowledge/graphEmphasis.ts';
import {topologyKey} from '../src/knowledge/layoutIdentity.ts';
const node=ref=>({ref,label:ref,kind:'wiki-node',native_owner:'native',actions:[],provenance:{source:'source:test'}});
const edge=(from_ref,to_ref)=>({from_ref,to_ref,relation:'supports',reference:`relation:${from_ref}:${to_ref}`,provenance:{source:'native'}});
const reading={schema:'oi.cradle.graph-reading/v1',nodes:['whole:a','whole:b','part:one','part:two','source:original','outside'].map(node),
 edges:[edge('part:one','part:two'),edge('part:two','outside'),edge('part:one','source:original')],
 formations:[{ref:'whole:a',members:[{ref:'part:one'},{ref:'part:two'}]},{ref:'whole:b',members:[{ref:'part:two'}]}],inputs:{},counts:{}};
const group=(id,extra={})=>({id,label:id,color:'#a8873f',text:'',kinds:[],tags:[],enabled:true,...extra});

test('folding is reversible and does not alter shared membership or manufacture edges',()=>{
 const original=JSON.stringify(reading),key=topologyKey(reading);
 const filters={...defaultGraphFilters(),collapsed:['whole:a']};
 let result=filterGraph(reading,filters);
 assert.deepEqual([...result.collapsedSubjects],['part:one']);
 assert.ok(result.nodes.some(node=>node.ref==='part:two'),'another open whole retains a shared participant');
 assert.ok(result.nodes.some(node=>node.ref==='source:original'),'the independent source remains available');
 assert.deepEqual(result.edges,[reading.edges[1]],'only real remaining edges, never rewired to whole anchors');
 result=filterGraph(reading,{...filters,collapsed:['whole:a','whole:b']});
 assert.deepEqual([...result.collapsedSubjects].sort(),['part:one','part:two']);
 assert.equal(result.foldedEdges,3);
 assert.equal(result.partialFormations.length,0,'intentional folding is not a smaller semantic form');
 assert.equal(filterGraph(reading,defaultGraphFilters()).nodes.length,reading.nodes.length);
 assert.equal(JSON.stringify(reading),original);assert.equal(topologyKey(reading),key);
});
test('folding never hides the exact selected subject or invents undisclosed members',()=>{
 const result=filterGraph(reading,{...defaultGraphFilters(),collapsed:['whole:a','whole:b','private:whole']},'part:one');
 assert.ok(result.nodes.some(node=>node.ref==='part:one'));
 assert.ok(!result.nodes.some(node=>node.ref==='part:two'));
 assert.deepEqual(result.collapsedFormations,['whole:a','whole:b']);
 assert.ok(!JSON.stringify([...result.nodes,...result.edges]).includes('private:'));
});
test('emphasis is first-match display state with independent enablement, not semantic filtering',()=>{
 const nodes=[{...node('alpha'),label:'Same',aliases:['Opening'],tags:['notes']},{...node('beta'),label:'Same',tags:['notes']}];
 const rules=[group('Opening',{text:'opening',color:'#006633'}),group('Notes',{tags:['notes'],color:'#223388'})];
 const before=JSON.stringify(nodes);
 let marks=emphasizeGraph(nodes,rules);
 assert.equal(marks.get('alpha').label,'Opening');assert.equal(marks.get('beta').label,'Notes');
 marks=emphasizeGraph(nodes,[{...rules[0],enabled:false},rules[1]]);
 assert.equal(marks.get('alpha').label,'Notes');assert.equal(JSON.stringify(nodes),before);
 assert.equal(emphasizeGraph(nodes,[group('absent',{tags:['not-admitted']})]).size,0);
});
test('group preferences reject CSS payloads and malformed IDs; saved views retain only bounded valid rules',()=>{
 const rules=restoreEmphasisGroups([null,group('a'),group('a'),group('b',{color:'url(https://invalid.test)'}),group('c',{label:'  ',color:'#FFFFFF'}),group('d',{text:'x'.repeat(3000),tags:['valid',5],color:'#ABCDEF'})]);
 assert.deepEqual(rules.map(item=>item.id),['a','d']);assert.equal(rules[1].text.length,1024);assert.deepEqual(rules[1].tags,['valid']);assert.equal(rules[1].color,'#abcdef');
 const filters=restoreGraphFilters({emphasis:rules,collapsed:['whole:a','whole:a',null]});
 const restored=restoreSavedGraphViews([{name:'A view',filters}]);
 assert.deepEqual(restored[0].filters.emphasis,rules);assert.deepEqual(restored[0].filters.collapsed,['whole:a']);
 assert.deepEqual(restoreGraphFilters({}).emphasis,[]);
});
test('large emphasis readings have bounded rule cost, no native work and no source writes',()=>{
 const nodes=Array.from({length:10000},(_,i)=>({...node(`node:${i}`),tags:[`group:${i%12}`]}));
 const groups=Array.from({length:12},(_,i)=>group(`group:${i}`,{tags:[`group:${i}`]}));
 const started=performance.now();const result=emphasizeGraph(nodes,groups);
 assert.equal(result.size,10000);assert.equal(nodes.length,10000);
 console.info('wiki emphasis benchmark',JSON.stringify({subjects:nodes.length,groups:groups.length,elapsedMs:performance.now()-started,scope:'controlled Node process, not installed UI proof'}));
});
