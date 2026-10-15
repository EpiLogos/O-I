// T-FRAME-CHROME-ONTO-PLATES: presented by the shell in a pane, the frame draws only its field. The stand-down is the frame's own (its
// body class, its own stylesheet), set only by the shell's declaration over the one channel; standalone, and at full size, the chrome
// stands as it always has. Every control stays mounted with its own handler: concealed by visibility, never removed — and the canvas's
// minimap stays, as the manual's Full Canvas has it. The chrome is read as data for the shell's devices and pressed from there.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readStageRequest,stageRequestMessage,readFrameChrome,FRAME_PRESENTATIONS,FRAME_CHROME_HOMES,STAGE_COMMANDS} from '../build/stageCommands.js';

const source=path=>readFile(new URL(path,import.meta.url),'utf8');

test('the presentation and the chrome press are closed stage commands', () => {
 assert.ok(STAGE_COMMANDS.includes('presentation')&&STAGE_COMMANDS.includes('chrome'));
 assert.deepEqual([...FRAME_PRESENTATIONS],['devices','frame']);
 assert.deepEqual(readStageRequest(stageRequestMessage(1,{command:'presentation',chrome:'devices'})),{req:1,command:{command:'presentation',chrome:'devices'}});
 assert.deepEqual(readStageRequest(stageRequestMessage(2,{command:'chrome',id:'tools/l:Snap'})),{req:2,command:{command:'chrome',id:'tools/l:Snap'}});
 assert.equal(readStageRequest({v:1,kind:'host-command',req:3,command:'presentation',chrome:'pane'}),null);
 assert.equal(readFrameChrome({lens:'canvas',controls:[{id:'a',home:'nowhere',kind:'button',label:'A'}]}),null);
 assert.ok(FRAME_CHROME_HOMES.includes('canvas:relation')&&FRAME_CHROME_HOMES.includes('journey:takes'));
});

test('the stand-down is the frame\'s own stylesheet under its own body class: concealed, never removed; the minimap stays', async () => {
 const css=await source('../src/workspace.css');
 const rule=css.slice(css.indexOf('body.oi-chrome-devices #app>.masthead,'));
 const block=rule.slice(0,rule.indexOf('}')+1);
 for(const region of ['#app>.masthead','#instrument-tools-dock','.canvas-zoom-controls','.research-minimap-toggle','#research-inspector','nav.instrument','#toolbelt-button','.journey-reading-home','.crossing-return','.react-flow__attribution'])
  assert.ok(block.includes(region),`${region} stands down`);
 assert.match(block,/\{visibility:hidden!important;pointer-events:none!important\}/,'concealed by visibility: every control stays laid out, readable and pressable');
 assert.doesNotMatch(block,/display:none/,'never removed');
 assert.doesNotMatch(block,/navigation-minimap/,'the canvas keeps its minimap (manual §17.3 Full: "the Canvas in the pane, with the minimap")');
 assert.match(css,/body\.oi-chrome-devices #app>\.masthead \.header-menu\{display:flex!important/,'the masthead\'s overflow menus stand laid out so they are read at any pane width');
});

test('the frame sets the class only from the shell\'s declaration, answers both commands, and announces the chrome with its state', async () => {
 const app=await source('../src/app.ts');
 const door=await source('../src/presentedChrome.ts');
 assert.match(door,/document\.body\.classList\.toggle\('oi-chrome-devices', presentation === 'devices'\)/);
 assert.match(door,/let presentation: FramePresentation = 'frame'/,'standalone and undeclared, the chrome stands');
 assert.equal((app.match(/oi-chrome-devices/g)??[]).length,0,'app.ts never sets the class itself');
 assert.match(app,/case 'presentation':[^]*presentedChrome\.setPresentation\(command\.chrome\)/);
 assert.match(app,/case 'chrome':[^]*presentedChrome\.press\(command\.id,command\.value\)/);
 assert.match(app,/\.\.\.chromeState\(\)\};/,'the announcement carries the presentation and the chrome reading');
 assert.match(app,/presentedChrome=installPresentedChrome\(\{lens:\(\)=>hostMode==='techne'\?lensStudio\.active\(\):hostMode,changed:\(\)=>announceHostState\(\),regions:\(\)=>frameChromeRegions\(\{canvasHome\}\)\}\);/);
 // A press is the frame's own control pressed: a click, a choice set as typing sets it, a value committed as leaving the field commits it.
 assert.match(door,/element\.click\(\)/);
 assert.match(door,/new Event\('change', \{bubbles: true\}\)/);
 assert.match(door,/new FocusEvent\('focusout', \{bubbles: true\}\)/);
});
