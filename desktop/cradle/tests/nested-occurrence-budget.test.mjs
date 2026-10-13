// E14 nested expression occurrence: placement refusals, the kernel body shape,
// the place/resize/remove edits, and the nested evaluation budget. Runs against
// the journeys module directly (no build):
//   node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/nested-occurrence-budget.test.mjs
// NESTED_MODULE overrides the module path (used for the mutation check).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
const modulePath=process.env.NESTED_MODULE??path.join(root,'expressions-app/field-studies-journeys/src/nestedOccurrence.ts');
const M=await import(pathToFileURL(modulePath).href);

const HOST='expression:host-a',SUB='expression:saved-b',HOST_SCENE='expression:host-a:scene:main';
const doc=(ref,entities,scenes)=>({expression_ref:ref,entities:Object.fromEntries(Array.from({length:entities},(_,i)=>[`${ref}:entity:${i}`,{}])),scenes});
const plain=(ref,entities=1)=>doc(ref,entities,[{scene_ref:`${ref}:scene:main`,entity_refs:[],body:null}]);
const nestsInto=(ref,subject,entities=1)=>doc(ref,entities,[{scene_ref:`${ref}:scene:main`,entity_refs:[],body:{carrier:'expression_ref',subject_ref:subject}}]);
const graph=(...docs)=>new Map(docs.map(d=>[d.expression_ref,d]));

test('placement refuses a self-nesting, a non-expression ref, a bad depth and a missing revision by name', () => {
 assert.match(M.nestedRefusal(HOST,{expression_ref:HOST,revision:3},1),/cannot be placed inside its own Scene/);
 assert.match(M.nestedRefusal(HOST,{expression_ref:'wiki:note',revision:3},1),/not a saved Expression ref/);
 assert.match(M.nestedRefusal(HOST,{expression_ref:SUB,revision:3},0),/Nesting depth must be 1 to 4/);
 assert.match(M.nestedRefusal(HOST,{expression_ref:SUB,revision:3},5),/Nesting depth must be 1 to 4/);
 assert.match(M.nestedRefusal(HOST,{expression_ref:SUB,revision:''},1),/has no revision/);
 assert.equal(M.nestedRefusal(HOST,{expression_ref:SUB,revision:3},4),null);
 assert.throws(()=>M.nestedBodyFor(HOST,{expression_ref:HOST,revision:3},1),/cannot be placed inside its own Scene/);
});

test('the placed body is the kernel expression_ref SceneBody, field for field', () => {
 const body=M.nestedBodyFor(HOST,{expression_ref:SUB,revision:7,title:'Saved B'},2);
 assert.deepEqual(body,{carrier:'expression_ref',subject_ref:SUB,native_owner:'oi',
  reading:{ref:SUB,revision:'7',availability:'available'},provenance:[{ref:SUB,revision:'7',availability:'available'}],
  actions:[],presentation:'inline',capability:{state:'renderable'},span:null,recursion:{host_expression_ref:HOST,max_depth:2}});
});

test('place, resize and remove are the kernel scene body edits; the subject does not change on resize', () => {
 const body=M.nestedBodyFor(HOST,{expression_ref:SUB,revision:7},1);
 assert.deepEqual(M.placeNestedChange(HOST_SCENE,body),{change:'scene_body_set',scene_ref:HOST_SCENE,body});
 const resized=M.setNestingDepthChange(HOST_SCENE,body,3);
 assert.equal(resized.body.recursion.max_depth,3);
 assert.equal(resized.body.subject_ref,SUB);
 assert.equal(body.recursion.max_depth,1,'resize returns a new body; the placed one is untouched');
 assert.deepEqual(M.removeNestedChange(HOST_SCENE),{change:'scene_body_clear',scene_ref:HOST_SCENE});
 assert.deepEqual([1,2,3,4].map(M.nextNestedDepth),[2,3,4,1]);
});

test('an occurrence within depth and budget is ready, with its depth and member count', () => {
 const body=M.nestedBodyFor(HOST,{expression_ref:SUB,revision:7},2);
 const out=M.nestedEvaluation(HOST,body,graph(plain(SUB,3)));
 assert.equal(out.state,'ready');
 assert.equal(out.depth,1);
 assert.equal(out.members,3);
});

test('an occurrence whose chain nests deeper than its admitted depth is refused, naming the depth', () => {
 const body=M.nestedBodyFor(HOST,{expression_ref:'expression:c1',revision:1},1);
 const out=M.nestedEvaluation(HOST,body,graph(nestsInto('expression:c1','expression:c2'),plain('expression:c2')));
 assert.equal(out.state,'refused');
 assert.match(out.reason,/nests 2 levels deep; this placement admits 1/);
});

test('a chain that loops back to its host or to itself is refused, never followed', () => {
 const back=M.nestedBodyFor(HOST,{expression_ref:SUB,revision:1},4);
 assert.match(M.nestedEvaluation(HOST,back,graph(nestsInto(SUB,HOST))).reason,/would contain its own host Expression/);
 const loop=M.nestedBodyFor(HOST,{expression_ref:'expression:x',revision:1},4);
 const looped=M.nestedEvaluation(HOST,loop,graph(nestsInto('expression:x','expression:y'),nestsInto('expression:y','expression:x')));
 assert.equal(looped.state,'refused');
 assert.match(looped.reason,/nests itself through expression:x/);
});

test('an unread document in the chain is unread, not ready and not silently dropped', () => {
 const body=M.nestedBodyFor(HOST,{expression_ref:SUB,revision:1},1);
 const out=M.nestedEvaluation(HOST,body,graph());
 assert.equal(out.state,'unread');
 assert.match(out.reason,/is not read yet/);
});

test('the member and Scene budgets refuse an over-size nested Expression by name', () => {
 const body=M.nestedBodyFor(HOST,{expression_ref:SUB,revision:1},1);
 const big=plain(SUB,M.NESTED_MEMBER_LIMIT+1);
 const out=M.nestedEvaluation(HOST,body,graph(big));
 assert.equal(out.state,'refused');
 assert.match(out.reason,/the budget is 2048/);
 const many={expression_ref:SUB,entities:{},scenes:Array.from({length:M.NESTED_SCENE_LIMIT+1},(_,i)=>({scene_ref:`${SUB}:scene:${i}`,entity_refs:[],body:null}))};
 assert.match(M.nestedEvaluation(HOST,body,graph(many)).reason,/holds 65 Scenes; the budget is 64/);
});

test('the Scene page refuses an occurrence when it has no free member slot', () => {
 assert.equal(M.nestedWindowVerdict(31),null);
 assert.match(M.nestedWindowVerdict(32),/already loads 32 of 32 members/);
});

test('resize changes only the admitted depth of a native body, and refuses a depth the kernel does not admit', () => {
 // A body as the kernel returns it (native reading shape), not the app-built one.
 const native={carrier:'expression_ref',subject_ref:SUB,native_owner:'oi',reading:{ref:SUB,revision:'7',availability:'available'},provenance:[],actions:[],presentation:'inline',capability:{state:'renderable'},span:null,recursion:{host_expression_ref:HOST,max_depth:1}};
 const out=M.setNestingDepthChange(HOST_SCENE,native,4);
 assert.equal(out.body.recursion.max_depth,4);
 assert.equal(out.body.reading.availability,'available');
 assert.equal(native.recursion.max_depth,1);
 assert.throws(()=>M.setNestingDepthChange(HOST_SCENE,native,0),/Nesting depth must be 1 to 4/);
 assert.throws(()=>M.setNestingDepthChange(HOST_SCENE,{...native,recursion:null},2),/no nested expression, so it has no nesting depth/);
});

test('an unread verdict is not shown as a fault; a refusal is', () => {
 const body=M.nestedBodyFor(HOST,{expression_ref:SUB,revision:1},1);
 assert.doesNotMatch(M.nestedControlsHTML(body,{subject_ref:SUB,max_depth:1,state:'unread',reason:'not read'}),/nested-note|nested-refusal/);
 assert.match(M.nestedControlsHTML(body,{subject_ref:SUB,max_depth:1,state:'refused',reason:'full page'}),/nested-refusal/);
});

test('the presentation keeps its own ref and tokens-only classes, and escapes titles', () => {
 const body=M.nestedBodyFor(HOST,{expression_ref:SUB,revision:1},1);
 assert.equal(M.nestedSceneClass(body),' scene-nested');
 assert.equal(M.nestedSceneClass(null),'');
 assert.equal(M.nestedSceneClass({carrier:'text_source'}),'');
 // Presentation is DOM-free at the module level: the HTML builder runs with no document.
 const html=M.nestedControlsHTML(body,{subject_ref:SUB,max_depth:1,state:'refused',reason:'<b>no</b>'});
 assert.match(html,/data-action="remove-nested"/);
 assert.match(html,/&lt;b&gt;no&lt;\/b&gt;/);
 assert.doesNotMatch(html,/<b>no<\/b>/);
 assert.match(M.nestedControlsHTML(null),/data-action="place-expression"/);
});

// Playback (E14): host-local time onto the nested Expression, clipping, the honest
// notice, and the read plan's depth gate. Expected values are hand-computed.
const LIVE={subject_ref:SUB,max_depth:2,state:'ready',depth:1,members:0};
test('playback: host time maps to nested Scene and local time; a boundary starts the next Scene', () => {
 assert.deepEqual(M.nestedFrameAt(0,10,[2,3],LIVE),{kind:'scene',sceneIndex:0,local:0});
 assert.deepEqual(M.nestedFrameAt(1.5,10,[2,3],LIVE),{kind:'scene',sceneIndex:0,local:1.5});
 assert.deepEqual(M.nestedFrameAt(2,10,[2,3],LIVE),{kind:'scene',sceneIndex:1,local:0});
 assert.deepEqual(M.nestedFrameAt(4.5,10,[2,3],LIVE),{kind:'scene',sceneIndex:1,local:2.5});
 assert.deepEqual(M.nestedFrameAt(-1,10,[2,3],LIVE),{kind:'scene',sceneIndex:0,local:0});
});
test('playback: zero-length Scenes have no span', () => {
 assert.deepEqual(M.nestedFrameAt(0,10,[0,2,0,1],LIVE),{kind:'scene',sceneIndex:1,local:0});
 assert.deepEqual(M.nestedFrameAt(2,10,[0,2,0,1],LIVE),{kind:'scene',sceneIndex:3,local:0});
});
test('playback: clipped at the host Scene duration; past the nested end the occurrence shows nothing', () => {
 assert.deepEqual(M.nestedFrameAt(4,4,[2,3],LIVE),{kind:'clipped'});
 assert.deepEqual(M.nestedFrameAt(2,6,[2],LIVE),{kind:'end'});
 assert.deepEqual(M.nestedFrameAt(3,6,[2],LIVE),{kind:'end'});
});
test('playback: unread and refused are notices, never a guess', () => {
 const unread={subject_ref:SUB,max_depth:1,state:'unread',reason:'not read'};
 assert.deepEqual(M.nestedFrameAt(0,5,[2],unread),{kind:'unread',reason:'not read'});
 assert.equal(M.nestedNotice(M.nestedFrameAt(0,5,[2],unread)),'not read');
 assert.equal(M.nestedNotice({kind:'end'}),null);
});
test('depth gate: the read plan stops at the placement bound, and requests each document under its recorded key', () => {
 const A='expression:a',B='expression:b',C='expression:c';
 const doc=(ref,child)=>({expression_ref:ref,scenes:[{scene_ref:ref+':scene:main',entity_refs:[],body:{carrier:'expression_ref',subject_ref:child,reading:{revision:'1'}}}]});
 const g=new Map([[A,doc(A,B)]]),req=new Map([[A,'rev:7']]),root={ref:A,key:'rev:7'};
 assert.deepEqual(M.nestedReadPlan(g,req,root,1),[]);
 assert.deepEqual(M.nestedReadPlan(g,req,root,2),[{ref:B,key:'rev:1'}]);
 g.set(B,doc(B,C));req.set(B,'rev:1');
 assert.deepEqual(M.nestedReadPlan(g,req,root,2),[]);
 assert.deepEqual(M.nestedReadPlan(g,req,root,3),[{ref:C,key:'rev:1'}]);
});
test('freshness: a document is current only under the recorded key; the key is the recorded revision', () => {
 assert.equal(M.nestedKeyOf('expression:x','7',1),'rev:7');
 assert.equal(M.nestedKeyOf('expression:x','',2),'structure:expression:x:2');
 const A='expression:a',B='expression:b';
 const g=new Map([[A,{expression_ref:A,scenes:[{scene_ref:A+':s',entity_refs:[],body:{carrier:'expression_ref',subject_ref:B,reading:{revision:'1'}}}]}],[B,{expression_ref:B,scenes:[]}]]);
 assert.deepEqual(M.nestedReadPlan(g,new Map([[A,'rev:7'],[B,'rev:0']]),{ref:A,key:'rev:7'},2),[{ref:B,key:'rev:1'}]);
 assert.deepEqual(M.nestedReadPlan(g,new Map([[A,'rev:7'],[B,'rev:1']]),{ref:A,key:'rev:7'},2),[]);
});
test('seams: the entering Scene names outgoing and incoming, its kind and its length; the first Scene and a cut have none', () => {
 const S=[{duration:2,transition:0,kind:'crossfade'},{duration:3,transition:1.5,kind:'dip-to-colour'},{duration:1,transition:0.5,kind:'cut'},{duration:2,transition:1,kind:'wipe'}];
 assert.equal(M.nestedSeamAt(S,0,0),null);
 assert.deepEqual(M.nestedSeamAt(S,1,0),{incoming:1,outgoing:0,kind:'dip-to-colour',seconds:1.5,elapsed:0});
 assert.equal(M.nestedSeamAt(S,1,1.5),null);
 assert.equal(M.nestedSeamAt(S,2,0),null);
 assert.deepEqual(M.nestedSeamAt(S,3,0.4),{incoming:3,outgoing:2,kind:'wipe',seconds:1,elapsed:0.4});
 assert.equal(M.nestedSeamMode('crossfade'),'crossfade');
 assert.equal(M.nestedSeamMode('wipe'),'painted');
 assert.equal(M.nestedSeamMode('cut'),'none');
});
test('seams: a seam starts once per crossing, and the latest seam in flight is the one taken', () => {
 assert.equal(M.nestedBoundaryKey(SUB,1,2.5,0.5),M.nestedBoundaryKey(SUB,1,2.9,0.9));
 assert.notEqual(M.nestedBoundaryKey(SUB,1,2.5,0.5),M.nestedBoundaryKey(SUB,2,5.5,0));
 assert.equal(M.latestNestedSeam([{elapsed:1.2},{elapsed:0.3}],x=>x.elapsed).elapsed,0.3);
});
