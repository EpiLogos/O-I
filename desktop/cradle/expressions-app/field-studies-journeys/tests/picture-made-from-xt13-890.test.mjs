// O-I #747 round 890, XT13's proof ("I export a still picture of the field": "A picture of the field as it stood, naming what it was made
// from"; manual §20.1 Export: "A picture or a film is a render: it names the Expression it was made from and can be remade from it
// (§10.3)"). The proof found the PNG named only by its file name, after the scene: downloaded, nothing in it said which Expression, at
// which revision, it was made from. Now the picture carries what it was made from inside the file, as PNG text (iTXt, UTF-8): a Title
// naming the scene and the Expression, and `oi:made-from`, the Expression's ref and revision and the scene's ref where the Expression is
// native — what a Remake of it would read again.
// SCRIPTED: the frame's capture module bundled with the app's esbuild over a real PNG made here (zlib); app.ts read only for the one line
// that hands the export its source.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {crc32, deflateSync} from 'node:zlib';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'picture-made-from-890-'));
after(() => rmSync(out, {recursive: true, force: true}));
const outfile = join(out, 'capture.mjs');
await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: ['src/capture.ts'], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent'});
const capture = await import(pathToFileURL(outfile).href);
const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');

const chunk = (type, data) => {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
};
/** A real 1 × 1 RGBA PNG, as a browser's toBlob gives one. */
function onePixel() {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, 200, 120, 40, 255]))), chunk('IEND', Buffer.alloc(0))]);
}
function chunksOf(bytes) {
  const b = Buffer.from(bytes), rows = [];
  assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'still a PNG');
  for (let at = 8; at < b.length;) {
    const length = b.readUInt32BE(at), type = b.toString('latin1', at + 4, at + 8), data = b.subarray(at + 8, at + 8 + length);
    assert.equal(b.readUInt32BE(at + 8 + length), crc32(b.subarray(at + 4, at + 8 + length)) >>> 0, `${type}'s CRC holds`);
    rows.push({type, data}); at += 12 + length;
  }
  return rows;
}
const itxt = data => { const i = data.indexOf(0); const keyword = data.toString('latin1', 0, i); const rest = data.subarray(i + 3);
  const lang = rest.indexOf(0), translated = rest.indexOf(0, lang + 1); return {keyword, compressed: data[i + 1], text: rest.subarray(translated + 1).toString('utf8')}; };

const MADE = {schema: 'oi.render-source/v1', expression: 'Dawn field', scene: 'Noon — zenith', expression_ref: 'expression:authored-walk890-dawn', revision: 7,
  scene_ref: 'expression:authored-walk890-dawn:scene:noon'};

test('XT13: the picture names what it was made from inside the file: the scene and the Expression, and their refs at the revision', () => {
  assert.equal(typeof capture.pngWithMadeFrom, 'function', 'the capture module writes the picture\'s source into it');
  const named = capture.pngWithMadeFrom(onePixel(), MADE);
  const rows = chunksOf(named);
  assert.deepEqual(rows.map(row => row.type), ['IHDR', 'IDAT', 'iTXt', 'iTXt', 'IEND'], 'the image is untouched; the text stands before its end');
  const texts = rows.filter(row => row.type === 'iTXt').map(row => itxt(row.data));
  assert.deepEqual(texts.map(row => [row.keyword, row.compressed]), [['Title', 0], [capture.MADE_FROM_KEY, 0]]);
  assert.equal(texts[0].text, 'Noon — zenith · Dawn field', 'the Title names the scene and the Expression, in UTF-8');
  assert.deepEqual(JSON.parse(texts[1].text), MADE, 'oi:made-from: what a Remake of it reads again');
  assert.deepEqual(rows[1].data, chunksOf(onePixel())[1].data, 'the pixels are the field as it stood');
});

test('XT13: a picture of a working draft names the scene and the Expression it was made from, and no ref it never had', async () => {
  const draft = {schema: 'oi.render-source/v1', expression: 'Untitled field', scene: 'One'};
  const blob = await capture.namedPicture(new Blob([onePixel()], {type: 'image/png'}), draft);
  assert.equal(blob.type, 'image/png');
  const texts = chunksOf(new Uint8Array(await blob.arrayBuffer())).filter(row => row.type === 'iTXt').map(row => itxt(row.data));
  assert.deepEqual(JSON.parse(texts[1].text), draft);
  assert.throws(() => capture.pngWithMadeFrom(Buffer.from('not a png'), draft), /not a PNG/);
});

test('XT13: Export › Picture writes the named picture, from the Expression and scene that stand now (app.ts captureImage)', () => {
  const body = app.slice(app.indexOf('async function captureImage('), app.indexOf('function startRecording('));
  assert.match(body, /const blob=await namedPicture\(await png\(out\),renderSourceOf\(\)\),name=slug\(scene\(\)\.name\)\+'\.png';/);
  assert.match(app, /function renderSourceOf\(\):RenderSource\{const view=nativeWorkspace\?\.nativeView\(\),current=scene\(\);/);
});
