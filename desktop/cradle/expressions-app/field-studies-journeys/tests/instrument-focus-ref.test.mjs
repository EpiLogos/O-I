// Instrument focus ref. A lens press that carries an object ref focuses that object in the instrument it opens, through each
// instrument's existing focus path. A ref the instrument cannot find is refused by name in its own status line, never a
// neighbour. A lens press with no ref behaves exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = name => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('the lens host-command reads the carried ref and passes it to the instrument it opens; no ref leaves the press unchanged', async () => {
  const app = await read('app.ts');
  const handler = app.slice(app.indexOf("d.command==='lens'"), app.indexOf("d.command==='refresh-expression'"));
  assert.match(handler, /const lens=\(d as \{lens:LensId\}\)\.lens,ref=\(d as \{ref\?:unknown\}\)\.ref;/, 'the handler reads the ref the host command carries');
  assert.match(handler, /carriedFocus=\{lens,ref\};/, 'a bounded ref is carried to the lens it names');
  assert.match(handler, /finally\{carriedFocus=null;\}/, 'the carried focus is one press only');
  assert.match(handler, /\}else lensStudio\.select\(lens\);/, 'a press with no ref selects the lens exactly as before');
  assert.match(app, /let carriedFocus:\{lens:LensId;ref:string\}\|null=null;/, 'the carried focus is declared once');
  assert.match(app, /function activateInstrument\(lens:LensId\)\{\n const carried=carriedFocus\?\.lens===lens\?carriedFocus\.ref:undefined;/, 'activateInstrument reads the carried ref for the lens it activates');
  assert.match(app, /researchInstruments\?\.open\(lens==='canvas'\?'m1':lens==='timeline'\?'m2':'m4',carried\)/, 'the canvas, timeline and place instruments receive the ref');
  assert.match(app, /void palaceInstrument\.open\(carried\)/, 'the palace receives the ref');
  assert.match(app, /\.then\(\(\)=>carried===undefined\?undefined:journeyInstrument\?\.focusBeat\(carried\)\)/, 'the journey focuses the carried beat after its crossing return');
});

test('the canvas instrument focuses the carried occurrence through the native select, and names a ref not on the canvas', async () => {
  const src = await read('researchInstruments.tsx');
  assert.match(src, /async open\(selected:ResearchInstrument,focusRef\?:string\)\{/, 'open accepts the focus ref');
  assert.match(src, /lens=selected;pendingFocus=focusRef;await load\(selected\);/, 'open hands the ref to the one load it starts');
  assert.match(src, /const generation=\+\+epoch;unmount\(\);mount\.hidden=false;message\('Reading…'\);\n  const focusRef=pendingFocus;pendingFocus=undefined;/, 'load takes the ref at its start, so a later refresh never reuses it');
  assert.match(src, /if\(focusRef!==undefined&&canvas\.nodes\.some\(node=>node\.id===focusRef\)\)\{state\.selectedNode=focusRef;state\.selectedEdge=null;if\(canvas\.sceneId\)host\.select\(canvas\.sceneId,canvas\.occurrences\.get\(focusRef\)\?\?null\);\}/, 'a canvas node is focused through host.select on its occurrence');
  assert.match(src, /const m1Note=focusRef!==undefined&&!canvas\.nodes\.some\(node=>node\.id===focusRef\)\?`Not focused: \$\{focusRef\} is not a card on this canvas\.`:null;/, 'a canvas ref not on the canvas is named');
  assert.match(src, /message\(m1Note\?\?\(canvas\.hiddenCount/, 'the canvas status line names the refusal');
});

test('the timeline instrument focuses the carried event as the chronology selection, and names a ref it does not read', async () => {
  const src = await read('researchInstruments.tsx');
  assert.match(src, /const focusEvent=focusRef!==undefined\?\(temporal\.some\(node=>node\.graphNodeId===focusRef\)\?focusRef:null\):undefined;/, 'the carried ref is admitted only if the reading has it as a dated event');
  assert.match(src, /if\(focusEvent\)\{state\.timeline=\{\.\.\.state\.timeline!,selectedNodeId:focusEvent\};state\.timelineKey=\(state\.timelineKey\?\?0\)\+1;\}/, 'the selection is the chronology selection, remounted through the timeline key');
  assert.match(src, /const focusNote=focusRef!==undefined&&focusEvent===null\?`Not focused: \$\{focusRef\} is not a dated event in this reading\.`:null;/, 'a ref the timeline does not read is refused by name');
  assert.match(src, /message\(focusNote\?`\$\{focusNote\} \$\{timelineStatus\}`:timelineStatus\)/, 'the timeline status line names the refusal');
});

test('the place instrument frames the carried place through the opening selection, and names a place it does not disclose', async () => {
  const src = await read('researchInstruments.tsx');
  assert.match(src, /let carriedPlace=focusRef!==undefined&&\(nativeReading\.spatial\?\?\[\]\)\.some\(facet=>facet\.place_ref===focusRef\)\?focusRef:undefined;/, 'the carried place is admitted only when the reading discloses it');
  assert.match(src, /const mapFocus=placeMountFocus\(\{carried:carriedPlace,session:sharedTime\?\.session\?\?null,facets:nativeReading\.spatial\?\?\[\],remembered:state\.selectedPlace\?\?null\}\);/, 'the carried place is the opening selection through the one mount-focus rule');
  assert.match(src, /initialSelectedGraphNodeId=\{mapFocus\.selected\}/, 'the mount opens on the resolved selection');
  assert.match(src, /initialFocusGraphNodeId=\{mapFocus\.focus\}/, 'the carried place is the framed focus');
  assert.match(src, /const placeNote=focusRef!==undefined&&carriedPlace===undefined\?`Not focused: \$\{focusRef\} is not a disclosed place in this reading\.`:null;/, 'an undisclosed place is named');
  assert.match(src, /if\(placeNote\)message\(placeNote\);/, 'the place status line names the refusal');
});

test('the journey instrument focuses a carried beat through its scene focus, and names a ref that is not a beat', async () => {
  const src = await read('journeyInstrument.tsx');
  assert.match(src, /async focusBeat\(ref:string\)\{/, 'the journey exposes a beat focus by ref');
  const start = src.indexOf('async focusBeat(');
  const body = src.slice(start, start + 1400);
  assert.match(body, /const target=beats\(reading\)\.beats\.find\(beat=>beat\.scene_ref===ref\);/, 'the beat is found in the reading by its ref');
  assert.match(body, /await host\.focusScene\(prepareJourneyBeatFocus\(target,basis,view!,host\.sceneId\(\)\)\);/, 'the beat is focused through focusScene');
  assert.match(body, /Not focused: \$\{ref\} is not a beat of this Journey\./, 'a ref that is not a beat is named');
});

test('the palace focuses a carried walk locus through its own walk index, and names a ref the walk does not hold', async () => {
  const src = await read('palaceInstrument.tsx');
  assert.match(src, /async open\(focusRef\?:string\)\{/, 'the palace accepts the carried ref');
  assert.match(src, /carried=\{carriedFocus\}/, 'the carried ref reaches the panel');
  assert.match(src, /carriedApplied\.current===carried\.nonce/, 'a carried focus is applied once per open');
  assert.match(src, /const index=walkSteps\.findIndex\(step=>step\.ref===carried\.ref\);/, 'the walk is searched for the exact ref');
  assert.match(src, /Not focused: \$\{carried\.ref\} is not a step of this Palace walk\./, 'a ref the walk does not hold is named');
  assert.match(src, /setWalkMoved\(index\)/, 'the focus moves the walk index');
});

test('the Palace status line says the object is in focus for the wired instruments, and keeps the honest line for the unwired project lens', async () => {
  const src = await read('palaceInstrument.tsx');
  assert.match(src, /const FOCUS_CARRIED_INSTRUMENTS:ReadonlySet<TechneInstrument>=new Set<TechneInstrument>\(\['canvas','timeline','place','journey'\]\);/, 'the wired instruments are named');
  assert.match(src, /FOCUS_CARRIED_INSTRUMENTS\.has\(instrument\)\s*\?`Asked the shell for the \$\{instrument\} instrument with \$\{ref\} in focus/, 'a wired instrument is said to carry the focus');
  assert.match(src, /:`Asked the shell for the \$\{instrument\} instrument\. \$\{ref\} is not carried into it yet\.`\);/, 'the unwired project lens keeps its honest line');
});
