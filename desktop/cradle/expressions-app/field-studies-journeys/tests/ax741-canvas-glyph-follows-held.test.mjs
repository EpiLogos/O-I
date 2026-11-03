// Lane AX (O-I #741 follow-up; DLW §17.4: "Autosave | On · Off | On | Saves a short time after a gesture, and at once after a delete. A
// small glyph shows saved, saving or held."). Lane AJ held a Canvas edit in the working draft while Autosave is off (app.ts
// commitResearch) and the glyph said held after that edit's act. But the frame's held state also changes outside the Canvas's own acts:
// any commit carries the whole working draft (commitNativeRecorded: a connection, a duplicate, a pin, a .canvas import, the Timeline's
// layout and views, the cards' own save), the app's Save commits it too, and a Timeline edit made while Autosave is off is held without
// passing through the Canvas's act queue. The glyph kept saying held after such a commit until the next edit. Now the frame says when
// its held state is set (app.ts holdResearch), and the glyph follows it at once (researchInstruments.tsx followHeld), unless an act of
// the Canvas is in flight, whose own end sets the glyph from the same state.
//
// Channel: SCRIPTED over the sources, as aj741-canvas-autosave.test.mjs reads them (the frame's acts need the native owner and a DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const instruments=readFileSync(new URL('../src/researchInstruments.tsx',import.meta.url),'utf8');
const bodyOf=(source,head)=>{const at=source.indexOf(head);assert.ok(at>=0,head);let depth=0;for(let i=source.indexOf('{',at);i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(at,i+1);}return source.slice(at);};

test('the frame sets its held state in one place, and tells the Canvas\'s glyph each time', () => {
 const hold=bodyOf(app,'function holdResearch(');
 assert.match(hold,/researchHeld=held;/);
 assert.match(hold,/researchInstruments\?\.followHeld\(\)/,'the glyph is told at once');
 // No other hand sets it: past its declaration, every write of the held state goes through holdResearch.
 const declared='let researchAutosave=true,researchHeld=false;';
 assert.equal(app.split(declared).length,2,'declared once');
 assert.deepEqual(app.replace(declared,'').match(/researchHeld=(?:true|false)/g)??[],[],'researchHeld is set only by holdResearch');
});

test('a commit by any path, and the app\'s Save, clear held through it', () => {
 assert.match(bodyOf(app,'async function commitNativeRecorded('),/if\(saved\)holdResearch\(false\);/,'any commit carries the whole working draft');
 assert.match(bodyOf(app,'async function saveNative('),/if\(saved\)\{holdResearch\(false\);/,'Save commits the working draft too');
 const commit=bodyOf(app,'async function commitResearch(');
 assert.match(commit,/if\(!researchAutosave\)\{holdResearch\(true\);return;\}/,'Off: held, and said held wherever the edit came from');
});

test('the glyph follows the frame\'s held state, and leaves an act in flight to set it at its end', () => {
 const follow=bodyOf(instruments,'followHeld(');
 assert.match(follow,/if\(materialInFlight\)return;/,'an act in flight sets the glyph when it ends');
 assert.match(follow,/saveState\(host\.held\?\.\(\)\?'held':'saved'\)/,'saved or held, as the frame holds it');
 // The act's own end reads the same state (lane AJ).
 assert.match(instruments,/try\{await action\(\);saveState\(host\.held\?\.\(\)\?'held':'saved'\);\}/);
});
