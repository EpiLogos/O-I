// Lane AJ (O-I #741): the Canvas's Autosave (DLW §17.4: "Autosave | On · Off | On | Saves a short time after a gesture, and at once after
// a delete. A small glyph shows saved, saving or held."). On is how the board already saves: each gesture is one native write when it
// settles (canvasGesture.ts), a delete at once, and the glyph (researchInstruments.tsx research-save-glyph) says saved, saving or held. Off
// keeps each edit in the working draft — on the board, unsaved — and the glyph stands held; On again saves what was held, through the same
// commit. The Canvas device turns it by the frame's own act (stageCommands.ts `canvas` `autosave`) and reads it from the research
// announcement (researchReading.ts). Run after `npm run build:journeys` (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readStageRequest} from '../build/stageCommands.js';
import {canvasReadingOf,readFrameResearch} from '../build/researchReading.js';

const ask=(command,extra={})=>readStageRequest({v:1,kind:'host-command',req:7,command,...extra});
const app=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const instruments=readFileSync(new URL('../src/researchInstruments.tsx',import.meta.url),'utf8');
const bodyOf=(source,head)=>{const at=source.indexOf(head);assert.ok(at>=0,head);let depth=0;for(let i=source.indexOf('{',at);i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(at,i+1);}return source.slice(at);};

test('Autosave is a closed act of the Canvas: on or off, nothing else', () => {
 assert.deepEqual(ask('canvas',{action:'autosave',on:false})?.command,{command:'canvas',action:'autosave',on:false});
 assert.deepEqual(ask('canvas',{action:'autosave',on:true})?.command,{command:'canvas',action:'autosave',on:true});
 for(const bad of [{action:'autosave'},{action:'autosave',on:'off'},{action:'autosave',on:true,delay:1000}])assert.equal(ask('canvas',bad),null,JSON.stringify(bad));
});

test('the board announces whether it saves as you go, and the reader keeps it', () => {
 const board=canvasReadingOf({nodes:[],edges:[]},undefined,{selected:[],autosave:false},()=>undefined);
 assert.equal(board.autosave,false);
 assert.equal(readFrameResearch({canvas:board})?.canvas?.autosave,false);
 assert.equal(readFrameResearch({canvas:{...board,autosave:'off'}}),null,'a word that is not on or off is no reading');
 const unsaid=canvasReadingOf({nodes:[],edges:[]},undefined,{selected:[]},()=>undefined);
 assert.equal('autosave' in unsaid,false,'not said, not announced');
});

test('Off holds each edit in the working draft and the glyph holds; On saves what was held through the same commit', () => {
 const commit=bodyOf(app,'async function commitResearch(');
 assert.match(commit,/if\(!researchAutosave\)\{researchHeld=true;return;\}/,'Off: the edit stands in the working draft, held, never sent');
 assert.match(commit,/commitNativeRecorded\(\)/,'On: the frame\'s own commit, as before');
 const stage=app.slice(app.indexOf("case 'canvas':"),app.indexOf("case 'timeline':",app.indexOf("case 'canvas':")));
 assert.match(stage,/command\.action==='autosave'/,'the Canvas device turns it by the frame\'s own act');
 assert.match(stage,/researchInstruments\.setAutosave\(/);
 const set=bodyOf(instruments,'async setAutosave(');
 assert.match(set,/apply\(|commit/,'On again saves what was held');
 // The glyph: an edit the host holds stands held, not saved.
 assert.match(instruments,/saveState\(host\.held\?\.\(\)\?'held':'saved'\)/);
});
