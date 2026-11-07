// O-I #747 round 891, XT12 and XT14's film ("I export a film of the field": "A film file that names the Expression it was made from and can
// be remade from it"; "I find a film whose source has moved and remake it": "remade, it matches the Expression again"; manual §20.1 Export:
// "A picture or a film is a render: it names the Expression it was made from and can be remade from it (§10.3)"). Round 890 named the
// picture inside its PNG; the film was named only by its file name. Now the film carries the same RenderSource inside the file, where each
// container keeps its own text — WebM a Matroska Tags element (TITLE and `oi:made-from`), MP4 iTunes-style metadata under moov/udta — with
// the length it plays, and one reader gives a render's source back from a picture or a film, which is what Remake reads again.
// SCRIPTED: the frame's capture module bundled with the app's esbuild; the containers are built here in the shapes MediaRecorder writes
// (a live WebM with an unknown-size Segment and Clusters; a fragmented MP4) and in the shapes with absolute positions (a SeekHead and Cues;
// a non-fragmented MP4's chunk offsets), so the proof shows nothing the player reads moves. app.ts read only for the lines that hand the
// film its source and route a render chosen by Import to its Remake. A real recording, played back, is the walk's (round 891 walk).
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
const out = mkdtempSync(join(tmpdir(), 'film-made-from-891-'));
after(() => rmSync(out, {recursive: true, force: true}));
const outfile = join(out, 'capture.mjs');
await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: ['src/capture.ts'], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent'});
const capture = await import(pathToFileURL(outfile).href);
const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');

const MADE = {schema: 'oi.render-source/v1', expression: 'Dawn field', scene: 'Noon — zenith', expression_ref: 'expression:authored-walk891-dawn', revision: 7,
  scene_ref: 'expression:authored-walk891-dawn:scene:noon', seconds: 4.2};

// ── EBML, as Matroska writes it ──
const hex = id => Buffer.from(id.toString(16).padStart(2, '0').replace(/^(.)(?=(..)*$)/, '0$1'), 'hex');
function vint(n, width) {
  const w = width ?? [1, 2, 3, 4, 5, 6, 7, 8].find(k => n < 2 ** (7 * k) - 1);
  const b = Buffer.alloc(w); let v = n;
  for (let i = w - 1; i >= 0; i--) { b[i] = v % 256; v = Math.floor(v / 256); }
  b[0] |= 0x80 >> (w - 1); return b;
}
const UNKNOWN = Buffer.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
const el = (id, ...parts) => { const data = Buffer.concat(parts.map(p => (typeof p === 'string' ? Buffer.from(p, 'utf8') : p))); return Buffer.concat([hex(id), vint(data.length), data]); };
const elSized = (id, width, ...parts) => { const data = Buffer.concat(parts); return Buffer.concat([hex(id), vint(data.length, width), data]); };
const unknownEl = (id, ...parts) => Buffer.concat([hex(id), UNKNOWN, ...parts]);
const uint = (n, w = 4) => { const b = Buffer.alloc(w); let v = n; for (let i = w - 1; i >= 0; i--) { b[i] = v % 256; v = Math.floor(v / 256); } return b; };
const ID = {EBML: 0x1A45DFA3, DocType: 0x4282, Segment: 0x18538067, SeekHead: 0x114D9B74, Seek: 0x4DBB, SeekID: 0x53AB, SeekPosition: 0x53AC,
  Info: 0x1549A966, TimecodeScale: 0x2AD7B1, MuxingApp: 0x4D80, Tracks: 0x1654AE6B, TrackEntry: 0xAE, TrackNumber: 0xD7, CodecID: 0x86,
  Cluster: 0x1F43B675, Timecode: 0xE7, SimpleBlock: 0xA3, Cues: 0x1C53BB6B, CuePoint: 0xBB, CueTime: 0xB3, CueTrackPositions: 0xB7,
  CueTrack: 0xF7, CueClusterPosition: 0xF1, Tags: 0x1254C367, Tag: 0x7373, Targets: 0x63C0, SimpleTag: 0x67C8, TagName: 0x45A3, TagString: 0x4487};
const header = el(ID.EBML, el(ID.DocType, 'webm'));
const info = el(ID.Info, el(ID.TimecodeScale, uint(1000000, 3)), el(ID.MuxingApp, 'Chrome'));
const tracks = el(ID.Tracks, el(ID.TrackEntry, el(ID.TrackNumber, uint(1, 1)), el(ID.CodecID, 'V_VP8')));
const frame = n => Buffer.from([0x81, 0x00, 0x00, 0x80, ...Array.from({length: 24}, (_, i) => (i * 7 + n) % 256)]);
/** A live recording as Chrome's MediaRecorder writes it: Segment and Clusters of unknown size, no SeekHead, no Cues. */
const liveWebm = () => Buffer.concat([header, unknownEl(ID.Segment, info, tracks,
  unknownEl(ID.Cluster, el(ID.Timecode, uint(0, 1)), el(ID.SimpleBlock, frame(1)), el(ID.SimpleBlock, frame(2))),
  unknownEl(ID.Cluster, el(ID.Timecode, uint(1000, 2)), el(ID.SimpleBlock, frame(3))))]);
/** A finished file: Segment of known size, a SeekHead naming Info and Cues, Cues naming the Cluster — positions from the Segment's data. */
function seekedWebm() {
  const cluster = el(ID.Cluster, el(ID.Timecode, uint(0, 1)), el(ID.SimpleBlock, frame(5)));
  const seek = (id, at) => el(ID.Seek, el(ID.SeekID, hex(id)), el(ID.SeekPosition, uint(at, 4)));
  const seekLength = el(ID.SeekHead, seek(ID.Info, 0), seek(ID.Cues, 0)).length;
  const infoAt = seekLength, clusterAt = infoAt + info.length + tracks.length, cuesAt = clusterAt + cluster.length;
  const seekHead = el(ID.SeekHead, seek(ID.Info, infoAt), seek(ID.Cues, cuesAt));
  const cues = el(ID.Cues, el(ID.CuePoint, el(ID.CueTime, uint(0, 1)), el(ID.CueTrackPositions, el(ID.CueTrack, uint(1, 1)), el(ID.CueClusterPosition, uint(clusterAt, 4)))));
  return {bytes: Buffer.concat([header, elSized(ID.Segment, 8, seekHead, info, tracks, cluster, cues)]), infoAt, clusterAt, cuesAt, cluster};
}
function ebmlChildren(b, start, end) {
  const rows = [];
  for (let at = start; at < end;) {
    const first = b[at]; const idLength = first & 0x80 ? 1 : first & 0x40 ? 2 : first & 0x20 ? 3 : 4;
    const id = b.readUIntBE(at, idLength); const s = at + idLength; let w = 1; while (!(b[s] & (0x80 >> (w - 1)))) w++;
    let size = b[s] & ((0x80 >> (w - 1)) - 1), unknown = size === (0x80 >> (w - 1)) - 1;
    for (let i = 1; i < w; i++) { size = size * 256 + b[s + i]; if (b[s + i] !== 0xff) unknown = false; }
    const data = s + w; const stop = unknown ? end : data + size;
    rows.push({id, at, data, end: stop, sizeWidth: w, size: unknown ? null : size}); at = stop;
  }
  return rows;
}
/** The Segment's top-level elements, walking an unknown-size Cluster by its children until the next top-level element. */
function segmentOf(b) {
  const segment = ebmlChildren(b, 0, b.length)[1];
  const data = segment.data, end = segment.end, size = segment.size, w = segment.sizeWidth;
  const TOP = new Set([ID.SeekHead, ID.Info, ID.Tracks, ID.Cluster, ID.Cues, ID.Tags]);
  const rows = [];
  for (let at = data; at < end;) {
    const [row] = ebmlChildren(b, at, end);
    if (row.size === null) { // an unknown-size Cluster: its children, until a top-level element
      let c = row.data;
      while (c < end) { const [child] = ebmlChildren(b, c, end); if (TOP.has(child.id)) break; c = child.end; }
      row.end = c;
    } else row.end = row.data + row.size;
    rows.push(row); at = row.end;
  }
  return {data, size, sizeWidth: w, rows};
}
const tagsOf = (b, row) => ebmlChildren(b, row.data, row.end).filter(t => t.id === ID.Tag).flatMap(tag => ebmlChildren(b, tag.data, tag.end))
  .filter(t => t.id === ID.SimpleTag).map(st => { const kids = ebmlChildren(b, st.data, st.end);
    const text = id => { const k = kids.find(row => row.id === id); return k ? b.toString('utf8', k.data, k.end) : null; };
    return [text(ID.TagName), text(ID.TagString)]; });

test('XT12: a live WebM names what it was made from in a Tags element before its first Cluster; every frame stays as it was recorded', () => {
  assert.equal(typeof capture.filmWithMadeFrom, 'function', 'the capture module writes the film\'s source into it');
  const before = liveWebm();
  const named = Buffer.from(capture.filmWithMadeFrom(before, MADE));
  const seg = segmentOf(named), base = segmentOf(before);
  assert.deepEqual(seg.rows.map(row => row.id), [ID.Info, ID.Tracks, ID.Tags, ID.Cluster, ID.Cluster], 'Tags stands before the first Cluster, where a reader of the head finds it');
  assert.equal(seg.size, null, 'a live Segment keeps its unknown size');
  assert.deepEqual(tagsOf(named, seg.rows[2]), [['TITLE', 'Noon — zenith · Dawn field'], [capture.MADE_FROM_KEY, JSON.stringify(MADE)]]);
  const clusters = rows => rows.filter(row => row.id === ID.Cluster);
  assert.deepEqual(clusters(seg.rows).map(row => named.subarray(row.at, row.end)), clusters(base.rows).map(row => before.subarray(row.at, row.end)), 'the recorded clusters are byte for byte');
  assert.deepEqual(named.subarray(0, seg.rows[2].at), before.subarray(0, base.rows[2].at), 'the head before the Tags is untouched');
});

test('XT12: a WebM with a SeekHead and Cues keeps every position true: the Segment grows by the Tags and what stood after them moved with them', () => {
  const {bytes, infoAt, clusterAt, cuesAt, cluster} = seekedWebm();
  const named = Buffer.from(capture.filmWithMadeFrom(bytes, MADE));
  const seg = segmentOf(named), base = segmentOf(bytes);
  const delta = named.length - bytes.length;
  assert.ok(delta > 0);
  assert.equal(seg.size, base.size + delta, 'the Segment\'s size counts the Tags');
  assert.equal(seg.sizeWidth, base.sizeWidth, 'in the width it was written in');
  const at = id => seg.rows.find(row => row.id === id).at - seg.data;
  const seekHead = seg.rows.find(row => row.id === ID.SeekHead);
  const seeks = ebmlChildren(named, seekHead.data, seekHead.end).map(seek => { const kids = ebmlChildren(named, seek.data, seek.end);
    const id = kids.find(k => k.id === ID.SeekID), pos = kids.find(k => k.id === ID.SeekPosition);
    return [named.readUIntBE(id.data, id.end - id.data), named.readUIntBE(pos.data, pos.end - pos.data)]; });
  assert.deepEqual(seeks, [[ID.Info, infoAt], [ID.Cues, cuesAt + delta]], 'Info stood before the Tags; Cues moved with them');
  assert.equal(at(ID.Info), infoAt); assert.equal(at(ID.Cues), cuesAt + delta); assert.equal(at(ID.Cluster), clusterAt + delta);
  const cues = seg.rows.find(row => row.id === ID.Cues);
  const point = ebmlChildren(named, cues.data, cues.end)[0], track = ebmlChildren(named, point.data, point.end).find(k => k.id === ID.CueTrackPositions);
  const position = ebmlChildren(named, track.data, track.end).find(k => k.id === ID.CueClusterPosition);
  assert.equal(named.readUIntBE(position.data, position.end - position.data), clusterAt + delta, 'the cue still finds its Cluster');
  const c = seg.rows.find(row => row.id === ID.Cluster);
  assert.deepEqual(named.subarray(c.at, c.end), cluster);
});

// ── ISO BMFF, as MediaRecorder writes MP4 ──
const box = (type, ...parts) => { const data = Buffer.concat(parts); const head = Buffer.alloc(8); head.writeUInt32BE(8 + data.length, 0); head.write(type, 4, 'latin1'); return Buffer.concat([head, data]); };
const full = (type, version, flags, ...parts) => box(type, Buffer.from([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...parts);
function boxesOf(b, start, end) {
  const rows = [];
  for (let at = start; at < end;) { const size = b.readUInt32BE(at), type = b.toString('latin1', at + 4, at + 8); rows.push({type, at, data: at + 8, end: at + size}); at += size; }
  return rows;
}
const ftyp = box('ftyp', Buffer.from('isom', 'latin1'), uint(512), Buffer.from('isomiso6mp41', 'latin1'));
const mvhd = full('mvhd', 0, 0, Buffer.alloc(96));
/** A fragmented MP4 as Chrome's MediaRecorder writes it: the moov with mvex, then moof and mdat pairs read from their own moof. */
function fragmentedMp4(baseOffset = false) {
  const moov = box('moov', mvhd, box('trak', full('tkhd', 0, 3, Buffer.alloc(80))), box('mvex', full('trex', 0, 0, uint(1), uint(1), uint(0), uint(0), uint(0))));
  const frag = (n, at) => {
    const mdat = box('mdat', Buffer.from(Array.from({length: 40}, (_, i) => (i * 3 + n) % 256)));
    const tfhd = baseOffset ? full('tfhd', 0, 0x000001, uint(1), uint(0, 8)) : full('tfhd', 0, 0x020000, uint(1));
    const moof = box('moof', full('mfhd', 0, 0, uint(n)), box('traf', tfhd, full('trun', 0, 0x000001, uint(1), uint(0))));
    // moof 8 + mfhd 16 + traf 8 + tfhd's header, version and flags, track_ID 16: the base = the mdat's data, absolute
    if (baseOffset) moof.writeBigUInt64BE(BigInt(at + moof.length + 8), 48);
    return Buffer.concat([moof, mdat]);
  };
  const head = Buffer.concat([ftyp, moov]);
  const one = frag(1, head.length);
  return Buffer.concat([head, one, frag(2, head.length + one.length)]);
}
/** A finished MP4: the moov before the mdat, its chunk offsets absolute. */
function plainMp4() {
  const payload = Buffer.from(Array.from({length: 64}, (_, i) => (i * 5) % 256));
  const build = offset => box('moov', mvhd, box('trak', full('tkhd', 0, 3, Buffer.alloc(80)), box('mdia', box('minf', box('stbl', full('stco', 0, 0, uint(2), uint(offset), uint(offset + 32)))))));
  const moovLength = build(0).length, offset = ftyp.length + moovLength + 8;
  return {bytes: Buffer.concat([ftyp, build(offset), box('mdat', payload)]), offset, payload};
}
const find = (b, path, start = 0, end = b.length) => {
  let rows = boxesOf(b, start, end), row;
  for (const [i, type] of path.entries()) {
    row = rows.find(r => r.type === type); if (!row) return null;
    const skip = type === 'meta' ? 4 : 0;
    if (i < path.length - 1) rows = boxesOf(b, row.data + skip, row.end);
  }
  return row;
};
const ilstOf = b => { const ilst = find(b, ['moov', 'udta', 'meta', 'ilst']); return ilst && boxesOf(b, ilst.data, ilst.end); };
const dataText = (b, item) => { const data = boxesOf(b, item.data, item.end).find(r => r.type === 'data'); return b.toString('utf8', data.data + 8, data.end); };

test('XT12: a fragmented MP4 names what it was made from as iTunes-style metadata under moov/udta; its fragments are byte for byte', () => {
  const before = fragmentedMp4();
  const named = Buffer.from(capture.filmWithMadeFrom(before, MADE));
  assert.deepEqual(before, fragmentedMp4(), 'the recorded bytes are read, never written: the named film is a new one');
  assert.deepEqual(boxesOf(named, 0, named.length).map(r => r.type), ['ftyp', 'moov', 'moof', 'mdat', 'moof', 'mdat']);
  const meta = find(named, ['moov', 'udta', 'meta']);
  const hdlr = boxesOf(named, meta.data + 4, meta.end).find(r => r.type === 'hdlr');
  assert.equal(named.toString('latin1', hdlr.data + 8, hdlr.data + 12), 'mdir', 'the metadata handler players read titles from');
  const items = ilstOf(named);
  assert.deepEqual(items.map(r => r.type), ['©nam', '----']);
  assert.equal(dataText(named, items[0]), 'Noon — zenith · Dawn field');
  const freeform = boxesOf(named, items[1].data, items[1].end);
  assert.deepEqual(freeform.map(r => r.type), ['mean', 'name', 'data']);
  assert.equal(named.toString('utf8', freeform[1].data + 4, freeform[1].end), capture.MADE_FROM_KEY);
  assert.deepEqual(JSON.parse(dataText(named, items[1])), MADE);
  const tail = rows => rows.filter(r => r.type !== 'moov' && r.type !== 'ftyp');
  assert.deepEqual(tail(boxesOf(named, 0, named.length)).map(r => named.subarray(r.at, r.end)), tail(boxesOf(before, 0, before.length)).map(r => before.subarray(r.at, r.end)));
});

test('XT12: an MP4 whose offsets are absolute keeps them true: chunk offsets and a fragment\'s base offset move with what they point at', () => {
  const {bytes, offset, payload} = plainMp4();
  const named = Buffer.from(capture.filmWithMadeFrom(bytes, MADE));
  const delta = named.length - bytes.length;
  const stco = find(named, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stco']);
  assert.deepEqual([named.readUInt32BE(stco.data + 8), named.readUInt32BE(stco.data + 12)], [offset + delta, offset + 32 + delta]);
  assert.deepEqual(named.subarray(offset + delta, offset + delta + payload.length), payload, 'each chunk offset still points at its samples');
  const frag = fragmentedMp4(true), namedFrag = Buffer.from(capture.filmWithMadeFrom(frag, MADE)), d2 = namedFrag.length - frag.length;
  const bases = b => boxesOf(b, 0, b.length).filter(r => r.type === 'moof').map(m => { const t = find(b, ['traf', 'tfhd'], m.data, m.end); return Number(b.readBigUInt64BE(t.data + 8)); });
  assert.deepEqual(bases(namedFrag), bases(frag).map(v => v + d2), 'an explicit base-data-offset moves with its mdat');
});

test('XT14: one reader gives a render\'s source back from a picture or a film, and nothing from a file that names none', () => {
  assert.equal(typeof capture.madeFromOf, 'function');
  assert.deepEqual(capture.madeFromOf(capture.filmWithMadeFrom(liveWebm(), MADE)), {kind: 'film', source: MADE});
  assert.deepEqual(capture.madeFromOf(capture.filmWithMadeFrom(fragmentedMp4(), MADE)), {kind: 'film', source: MADE});
  const chunk = (type, data) => { const h = Buffer.alloc(8); h.writeUInt32BE(data.length, 0); h.write(type, 4, 'latin1'); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])) >>> 0, 0); return Buffer.concat([h, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, 1, 2, 3, 255]))), chunk('IEND', Buffer.alloc(0))]);
  const {seconds: _s, ...still} = MADE;
  assert.deepEqual(capture.madeFromOf(capture.pngWithMadeFrom(png, still)), {kind: 'picture', source: still});
  for (const nothing of [png, liveWebm(), fragmentedMp4(), Buffer.from('not a render')]) assert.equal(capture.madeFromOf(nothing), null);
  assert.throws(() => capture.filmWithMadeFrom(Buffer.from('not a film'), MADE), /not a WebM or MP4/);
  const twice = capture.filmWithMadeFrom(liveWebm(), MADE);
  assert.throws(() => capture.filmWithMadeFrom(twice, MADE), /already names/, 'a render is never edited in place: it is made again');
});

const law = await import(pathToFileURL(join(journeys, '../../../../packages/live-shell/ui/src/frame/detail/remake.ts')).href);
test('XT14: where a render\'s source stands, and what Remake says, in the render law\'s words', () => {
  const now = (revision, scene_refs = [MADE.scene_ref]) => ({expression_ref: MADE.expression_ref, revision, scene_refs});
  const at = (source, held) => capture.renderStandingOf(source, held).standing;
  assert.equal(at(MADE, now(7)), 'current');
  assert.equal(at(MADE, now(9)), 'moved');
  assert.equal(at(MADE, now(9, ['expression:authored-walk891-dawn:scene:dusk'])), 'missing', 'its scene is gone from the Expression');
  assert.equal(at(MADE, {...now(7), expression_ref: 'expression:other'}), 'unread', 'another Expression is open: nothing reads this one');
  assert.equal(at(MADE, null), 'unread');
  assert.equal(at({schema: MADE.schema, expression: 'Untitled field', scene: 'One'}, now(7)), 'unread', 'a working draft named no Expression');
  assert.match(capture.renderStandingOf(MADE, now(9)).why, /revision 7 then, 9 now/);
  for (const standing of ['current', 'moved', 'missing', 'unread']) {
    assert.equal(at(MADE, standing === 'moved' ? now(9) : standing === 'missing' ? now(7, []) : standing === 'unread' ? null : now(7)), standing);
    assert.equal(capture.renderMark(standing), law.standingMark('source', standing), `the mark for ${standing}`);
  }
  for (const kind of ['picture', 'film']) {
    assert.equal(capture.remakeRenderDoes(kind), law.remakeDoes(`the ${kind}`, 'Expression'));
    for (const moved of [true, false]) assert.equal(capture.remadeRenderNote(kind, moved), law.remadeNote(`The ${kind}`, 'Expression', moved));
  }
  assert.equal(law.REMAKE, 'Remake');
  for (const [file, render] of [[{type: 'video/webm', name: 'a'}, true], [{type: '', name: 'Dawn.MP4'}, true], [{type: 'image/png', name: 'a.png'}, true], [{type: 'application/json', name: 'a.json'}, false]])
    assert.equal(capture.isRenderFile(file), render, file.name);
});

test('XT12/XT14: the frame names the take from the Expression as it stood when recording began, and Import routes a render to its Remake', () => {
  assert.match(app, /recordingMade=renderSourceOf\(\);recordingStarted=performance\.now\(\);/, 'the source is read when the recording starts');
  const stop = app.slice(app.indexOf('recorder.onStop='), app.indexOf('function addLane('));
  assert.match(stop, /namedFilm\(blob,\{\.\.\.made,seconds\}\)/, 'the take is named before it is shown or saved');
  // Walk 891 captures-7: a take stopped by a resize before its first second kept nothing; the review said it was "not a WebM or MP4
  // file" and offered Save for an empty file. An empty take says what happened and offers no Save.
  // Walk 891 captures-8: the host read "no take" when the save's answer came (the state was told before the take was kept), so the
  // shell did not bring the review in front. The state is told again once the take is kept, before the stop is answered.
  const kept = stop.slice(stop.indexOf('currentVideo=empty?null:'))
  assert.ok(kept.indexOf('announceHostState()') > 0 && kept.indexOf('announceHostState()') < kept.indexOf('takeSettled()'),
    'the host hears of the kept take before the stop is answered');
  assert.match(stop, /\bempty=blob\.size===0/, 'an empty take is told apart');
  assert.match(stop, /currentVideo=empty\?null:/, 'nothing is kept as the take, so no save (the menu\'s or the review\'s) finds an empty file');
  assert.match(stop, /empty\?Promise\.resolve\(\{named:blob,fault:EMPTY_TAKE\}\)/, 'it is not named: it says why');
  assert.match(stop, /\$\{empty\?'':`<button class="primary" data-action="save-video">/, 'and Save recording is not offered for it');
  const importer = app.slice(app.indexOf("$<HTMLInputElement>('import-file').addEventListener"), app.indexOf("$<HTMLInputElement>('import-file').addEventListener") + 600);
  assert.match(importer, /if\(isRenderFile\(file\)\)\{await openRender\(file\);return;\}/, 'a picture or film chosen by Import is not imported: it is a render');
  assert.match(app, /function remakeRender\(/);
  // Walk 891: Remake chose the film's scene after the owner had moved to another, so the selection was written while the take was
  // recording — the remade film named revision 4 and the Expression stood at 5 once it was saved, so it read "source moved" at once.
  // The scene is selected at the owner, and that acknowledged, before the render reads what it is made from.
  const remake = app.slice(app.indexOf('async function remakeRender('), app.indexOf('async function captureImage('));
  const selects = remake.search(/await nativeWorkspace\.select\(sceneId,null\)/);
  assert.ok(selects > 0, 'Remake selects the scene at the owner and waits for it');
  assert.ok(selects < remake.indexOf('captureImage()') && selects < remake.indexOf('startRecording()'), 'before the picture is taken or the film starts');
  assert.match(app, /case 'stop-record':\{if\(!recorder\.active\)break;const kept=new Promise<void>\(done=>takeWaiters\.push\(done\)\);recorder\.stop\(\);await kept;break;\}/,
    'a stop waits for the take to be kept and named, so Save never finds the one before');
  // Walk 891: in the shell's stage the take's video filled the review, and what it was made from and Save recording stood below the
  // fold. The video gives way to them: it is no taller than the frame leaves once the heading, the lines and the buttons are shown.
  const styles = readFileSync(join(journeys, 'src/styles.css'), 'utf8');
  const review = styles.match(/#recording-review\{([^}]*)\}/)?.[1] ?? '';
  assert.match(review, /max-height:calc\(100svh - \d+px\)/, 'the review\'s video is capped by the frame\'s own height');
  assert.match(review, /object-fit:contain/, 'and shows the whole take inside that cap');
  const shell = readFileSync(join(journeys, 'src/shell.ts'), 'utf8');
  assert.match(shell, /id="import-file" accept="application\/json,\.json,image\/png,\.png,video\/webm,\.webm,video\/mp4,\.mp4"/, 'Import\'s chooser offers renders');
});
