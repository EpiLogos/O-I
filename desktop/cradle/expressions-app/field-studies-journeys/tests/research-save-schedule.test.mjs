import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

// B1 (lane-1): the research scene's save state. The schedule itself is not changed here: research
// moves already coalesce in canvasGesture (one native write per settled gesture), and discrete acts
// commit at once, because the canvas re-renders from acknowledged native state. These gates pin what
// must stay true (the acknowledgement gate, the queued-edit guard, one refusal path) and the one
// quiet save-state glyph that reports saving, saved and held in the existing status line.
const require=createRequire(import.meta.url);
const ts=require('../../node_modules/typescript');
const appSource=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const researchSource=fs.readFileSync(new URL('../src/researchInstruments.tsx',import.meta.url),'utf8');
const stylesSource=fs.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const sf=ts.createSourceFile('app.ts',appSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const walk=(node,visit)=>{visit(node);ts.forEachChild(node,child=>walk(child,visit));};
const fnNamed=name=>{let found=null;walk(sf,n=>{if(!found&&ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n;});return found;};

test('commitResearch keeps the acknowledgement gate: it awaits the owner and refuses an unacknowledged edit', ()=>{
 const fn=fnNamed('commitResearch');
 assert.ok(fn,'commitResearch exists');
 const text=fn.getText(sf);
 assert.match(text,/await commitNativeRecorded\(\)/,'the commit waits for the native owner');
 assert.match(text,/The native owner did not acknowledge this edit\. Your working draft is retained\./,'the refusal keeps the draft and says so');
});

test('the queued-edit guard still refuses an edit that lands after the composition changed', ()=>{
 assert.match(researchSource,/The selected native composition changed; the queued edit was not applied/,'the guard message is unchanged');
});

test('a research act that has no acknowledged owner is refused, not silently retained', ()=>{
 // REPLACED (#741, lane AJ): /async function commitResearch\(\)\{if\(!await commitNativeRecorded\(\)\)throw new Error\(/ — the Canvas's
 // Autosave Off (DLW §17.4) holds the edit in the working draft first, unsent and said held (aj741-canvas-autosave.test.mjs); a sent edit
 // the owner does not acknowledge is still refused.
 // REPLACED (#741, lane AX): /…\{researchHeld=true;return;\}if\(!await commitNativeRecorded…/ — the held state is set through
 // holdResearch, which tells the Canvas's glyph at once (ax741-canvas-glyph-follows-held.test.mjs).
 assert.match(appSource,/async function commitResearch\(\)\{if\(!researchAutosave\)\{holdResearch\(true\);return;\}if\(!await commitNativeRecorded\(\)\)throw new Error\(/,'commitResearch throws on refusal');
});

test('one save-state glyph reports saving, saved and held in the status line', ()=>{
 assert.match(researchSource,/className='research-save-glyph'|className = 'research-save-glyph'|research-save-glyph/,'the glyph element exists');
 for(const state of ['saving','saved','held'])assert.ok(researchSource.includes(`'${state}'`),`the glyph has a ${state} state`);
 assert.match(researchSource,/saveState\('saving'\)/,'an act marks saving when it starts');
 // REPLACED (#741, lane AJ): /try\{await action\(\);saveState\('saved'\);\}/ — an act the host holds (Autosave off) marks held.
 assert.match(researchSource,/try\{await action\(\);saveState\(host\.held\?\.\(\)\?'held':'saved'\);\}/,'an acknowledged act marks saved');
 assert.match(researchSource,/\.catch\(error=>\{saveState\('held'\);/,'a refused act marks held');
});

test('the glyph is quiet: no modal and no toast is added on a routine save', ()=>{
 const glyphBlock=researchSource.slice(researchSource.indexOf('research-save-glyph'),researchSource.indexOf('research-save-glyph')+600);
 assert.doesNotMatch(glyphBlock,/toast\(|alert\(|showModal|dialog/,'the glyph itself raises nothing');
});

test('the glyph has token-only styling in the styles.css tail', ()=>{
 const tail=stylesSource.slice(stylesSource.lastIndexOf('/* B1 save glyph */'));
 assert.ok(stylesSource.includes('/* B1 save glyph */'),'the tail carries the glyph styles');
 assert.match(tail,/\.research-save-glyph\[data-save-state="held"\]/,'held is styled');
 assert.doesNotMatch(tail,/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/,'no raw colour literals in the glyph styles');
});
