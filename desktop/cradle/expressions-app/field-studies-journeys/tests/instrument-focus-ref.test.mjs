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
  assert.match(app, /researchInstruments\?\.open\(lens==='canvas'\?'m1':'m2',carried\)/, 'the canvas and timeline instruments receive the ref');
  // #762: the Places lens retired with the frame's map (Places is the shell's Earth atlas); asked for by a host command still naming it,
  // it says where Places went, as the Palace lens does: it opens no research instrument, holds no stage and opens no Studio section.
  assert.match(app, /if\(lens==='place'\)toast\(PLACES_MOVED,8000\);/, 'the place lens says where Places went');
  assert.doesNotMatch(app, /studioSection='places'|places:'place'|lens==='place'\)\{|lens==='timeline'\|\|lens==='place'/, 'the place lens wires no frame Places surface');
  // T-PALACES-ONTO-ATLAS: the Palace lens retired; asked for, it says where palaces went (a carried room is entered on the atlas:
  // packages/live-shell/ui/tests/atlas-palaces-session.test.mjs pins the walk standing at the carried room, and the named refusal).
  assert.match(app, /if\(lens==='palace'\)toast\(PALACE_MOVED,8000\);/, 'the palace lens says where palaces went');
  assert.doesNotMatch(app, /palaceInstrument/, 'no frame palace receives a ref any more');
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

// T-PLACES-ONTO-ATLAS: the frame's Places lens retired with its map (FOUNDATION §4 "Places is the Archetypal-Earth atlas, alone"). A
// carried place is the shared session's spatial focus, which the shell's Earth atlas turns to (packages/live-shell/ui/src/projections/
// atlas/places/placesHost.ts followSpatialFocus; packages/live-shell/ui/tests/atlas-places-plate.test.mjs pins the turn). Asked for, the
// frame's lens says where Places went and reads nothing.
test('the place instrument says where Places went, and reads nothing', async () => {
  const src = await read('researchInstruments.tsx');
  assert.match(src, /if\(selected==='m4'\)\{message\(PLACES_MOVED\);render\(<p className="research-instrument-message" role="note">\{PLACES_MOVED\}<\/p>\);return;\}/, 'the lens names the Earth atlas');
  assert.doesNotMatch(src, /carriedPlace|placeMountFocus|PsychogeographicMap/, 'no frame map frames a carried place any more');
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

// T-PALACES-ONTO-ATLAS: the frame's Palace lens retired (FOUNDATION §3 N4 "Palaces live in the atlas … There is no separate palace
// surface"). Its two pins move to the atlas's palace: entering at a carried room stands the walk there, and a room the walk does not hold
// is named (packages/live-shell/ui/tests/atlas-palaces-session.test.mjs); an object opens through its owner's door, saying whether it is
// carried (atlas-palaces-session.test.mjs, the openers).
test('the palace lens is gone from the frame: no palace instrument file stands', async () => {
  await assert.rejects(read('palaceInstrument.tsx'), /ENOENT/);
});
