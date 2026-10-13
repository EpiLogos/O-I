// T-E03: Scene operations address the Scene's own id (bound to the native
// scene_ref); the index is a derived view. app.ts is a browser entry that
// touches the DOM at import, so it cannot be loaded under node: these are
// code-reading locks on its addressing shape, not a behavioural run. The
// scripted reorder case (reorder scenes, then setSceneRef a ref now elsewhere)
// needs a browser harness and is not covered here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');

test('the index-addressed setter is gone; the ref-addressed setter and index helpers exist',()=>{
 assert.doesNotMatch(src,/function setScene\(/,'setScene(index) must not remain as the internal address');
 assert.match(src,/function setSceneRef\(sceneId:string,automatic=false\)/);
 assert.match(src,/function sceneIndexOf\(sceneId:string\)/);
 assert.match(src,/function sceneRefAt\(index:number\)/);
});

test('sceneIndexOf resolves the index from the id and refuses an absent Scene',()=>{
 const body=src.match(/function sceneIndexOf\(sceneId:string\)\{([^}]*)\}/)?.[1]??'';
 assert.match(body,/findIndex\(s=>s\.id===sceneId\)/);
 assert.match(body,/throw Error\('The Scene is no longer present in this Expression'\)/);
});

test('setSceneRef resolves the id before any intent epoch, transition or toast side effect',()=>{
 const start=src.indexOf('function setSceneRef(sceneId:string');
 const body=src.slice(start,src.indexOf('\n',start));
 const resolve=body.indexOf('sceneIndexOf(sceneId)'),bump=body.indexOf('sceneIntentEpoch++');
 assert.ok(resolve>=0 && bump>resolve,'a missing Scene must throw before the intent epoch moves');
 assert.match(body,/if\(index===sceneIndex&&!automatic\)return;/,'same-Scene early return is kept');
});

test('index-to-ref compatibility wraps exactly as the old setScene did',()=>{
 const body=src.match(/function sceneRefAt\(index:number\)\{([^}]*)\}/)?.[1]??'';
 assert.match(body,/if\(index<0\)index=n-1;if\(index>=n\)index=0;/);
 assert.match(body,/return store\.document\.scenes\[index\]\.id;/);
});

test('every setSceneRef caller passes a Scene id, a neighbour ref or an index-wrapped ref',()=>{
 const allowed=['sceneId:string','sceneId)','sceneId);','sceneRefAt(','target.id','store.document.scenes[index].id','el.dataset.sceneId'];
 const args=src.split('setSceneRef(').slice(1).map(s=>s.slice(0,40));
 assert.ok(args.length>=10,'the setter has its callers');
 for(const a of args)assert.ok(allowed.some(p=>a.startsWith(p)),`unaddressed caller: setSceneRef(${a})`);
});

test('the chooser renders the Scene id beside its derived index, and choose-scene reads the id',()=>{
 assert.match(src,/data-action="choose-scene" data-index="\$\{i\}" data-scene-id="\$\{esc\(v\.id\)\}"/);
 assert.match(src,/case 'choose-scene':setSceneRef\(el\.dataset\.sceneId\?\?''\);break;/);
 assert.doesNotMatch(src,/case 'choose-scene':setScene\(Number/);
});

test('previous, next and the arrow keys step by neighbour ref with the old wrap',()=>{
 assert.match(src,/case 'previous':setSceneRef\(sceneRefAt\(sceneIndex-1\)\)/);
 assert.match(src,/case 'next':setSceneRef\(sceneRefAt\(sceneIndex\+1\)\)/);
 assert.match(src,/ev\.key==='ArrowLeft'\)setSceneRef\(sceneRefAt\(sceneIndex-1\)\)/);
 assert.match(src,/ev\.key==='ArrowRight'\)setSceneRef\(sceneRefAt\(sceneIndex\+1\)\)/);
});

test('the playhead resolves its derived index to the Scene id it lands on',()=>{
 assert.match(src,/if\(index!==sceneIndex\)setSceneRef\(store\.document\.scenes\[index\]\.id\)/);
});

test('the public disclosure keeps its toast and native ref path; index input is wrapped to a ref',()=>{
 assert.match(src,/if\(typeof reference==='string'\)return focusNativeSceneRef\(reference\);/);
 assert.match(src,/toast\('Index-based Scene navigation is a compatibility call; native navigation accepts a Scene reference\.'\);setSceneRef\(sceneRefAt\(reference\)\);/);
 assert.match(src,/async function focusNativeSceneRef\(scene_ref:string\)/);
});

test('sceneControls.focus addresses by id and keeps its acknowledged-Scene refusal',()=>{
 assert.match(src,/focus:sceneId=>\{const index=store\.document\.scenes\.findIndex\(s=>s\.id===sceneId\);if\(index<0\)throw Error\('The acknowledged Scene is no longer present'\);/);
 assert.match(src,/\}else setSceneRef\(sceneId\);\},/);
});

test('the Physis load keeps its saved sceneIndex wire format and resolves it at the boundary',()=>{
 assert.match(src,/setSceneRef\(sceneRefAt\(source\.sceneIndex\?\?0\)\);/);
});

test('saved-scene advance addresses the target by id once the native owner has acknowledged it',()=>{
 assert.match(src,/if\(!view\)\{setSceneRef\(sceneRefAt\(index\),true\);/);
 assert.match(src,/scenePlaying=true;setSceneRef\(target\.id,true\);/);
});
