/** O-I #747 round 892, item 5 (XS14 for every scene): a scene made of a file carries the mark while its file stands at another revision than
 * the body was read at — every such scene, not only the presented one in its Clip panel (round 891 read only that one). The revision the
 * body was read at is the kernel's scene body's (expression_carrier.rs SceneBody `reading.revision`); the revision the file stands at now is
 * Central's file owner's, asked through the frame's own host reads (central-subject-text, central-subject-bytes). The boundary's scenes
 * reading carries both, per scene: it is the one reading every view of the Expression's scenes is drawn from. Real authoring model and
 * scenes projection; the reads are the one stub. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneSourcesNow, projectNativeScenes, sceneSourceKey} from '../src/scenes.ts';
import {isNativeScenesReading} from '../src/scenesValidation.ts';
import {blankScene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';

const E = 'expression:made-of-files';
const S = n => `${E}:scene:s${n}`;
const reading = (ref, revision) => ({ref, revision, availability: 'available'});
const WHOLE = 'wiki:node:central', TEXT = 'central:notes/a.md', IMAGE = 'central:pictures/b.png';
const body = (carrier, ref, revision, owner = 'central') => ({carrier, subject_ref: ref, native_owner: owner, reading: reading(ref, revision),
  provenance: [reading(ref, revision)], actions: [], presentation: carrier === 'knowledge_whole' ? 'preview' : 'inline',
  capability: {state: 'renderable'}, span: null, recursion: null});
const bodies = {whole: body('knowledge_whole', WHOLE, '3', 'wiki'), text: body('text_source', TEXT, 'r7'), image: body('image_media', IMAGE, 'i2')};
function seed(bodyOf) {
  const scenes = bodyOf.map((made, i) => {
    const scene = blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = 6; scene.transition = 1;
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}, ...(made ? {body: made} : {})};
  });
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Made of files', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
}
const basis = {expression_ref: E, revision: 4, scene_ref: S(1)};

test('r892: each scene made of a file names its file, its carrier, the revision its body was read at, and the revision the file stands at now', () => {
  const view = seed([bodies.whole, bodies.text, bodies.image, null, bodies.text]);
  const unread = projectNativeScenes(view.journey, view);
  assert.deepEqual(unread.scenes.map(row => row.made_of ?? null), [{subject_ref: WHOLE, revision: '3'}, {subject_ref: TEXT, revision: 'r7', carrier: 'text_source'},
    {subject_ref: IMAGE, revision: 'i2', carrier: 'image_media'}, null, {subject_ref: TEXT, revision: 'r7', carrier: 'text_source'}],
    'while nothing has read the files, each names what it was made of and nothing about now');
  assert.equal(isNativeScenesReading(unread, basis), true);
  const now = new Map([[sceneSourceKey('text_source', TEXT), 'r8'], [sceneSourceKey('image_media', IMAGE), 'i2']]);
  const read = projectNativeScenes(view.journey, view, now);
  assert.deepEqual(read.scenes.map(row => row.made_of?.now ?? null), [null, 'r8', 'i2', null, 'r8'], 'every scene made of the file, each with its file now');
  assert.deepEqual(read.scenes[0].made_of, {subject_ref: WHOLE, revision: '3'}, 'a constellation is the wiki\'s to read: unchanged');
  assert.equal(isNativeScenesReading(read, basis), true);
});

test('r892: the shell admits a file\'s made_of only in its own shape', () => {
  const view = seed([bodies.text, null]);
  const read = projectNativeScenes(view.journey, view);
  const with_ = made_of => ({...read, scenes: read.scenes.map((row, i) => (i === 0 ? {...row, made_of} : row))});
  for (const bad of [{subject_ref: TEXT, revision: 'r7', carrier: 'video'}, {subject_ref: TEXT, revision: 'r7', carrier: 'text_source', now: 8},
    {subject_ref: TEXT, revision: 'r7', carrier: 'text_source', now: ''}, {subject_ref: TEXT, carrier: 'text_source', now: 'r8'},
    {subject_ref: TEXT, revision: 'r7', carrier: 'text_source', now: 'r8', standing: 'moved'}, {subject_ref: TEXT, revision: 'r7', now: 'r8'}])
    assert.equal(isNativeScenesReading(with_(bad), basis), false, JSON.stringify(bad));
  for (const good of [{subject_ref: TEXT, revision: 'r7', carrier: 'text_source'}, {subject_ref: TEXT, revision: 'r7', carrier: 'text_source', now: 'r9'},
    {subject_ref: IMAGE, revision: 'i2', carrier: 'image_media', now: 'i2'}])
    assert.equal(isNativeScenesReading(with_(good), basis), true, JSON.stringify(good));
});

/** The reads Central's file owner answers, by carrier and ref; each ask is logged. */
function owner(files) {
  const asked = [], pending = []
  const read = (carrier, ref) => { asked.push(`${carrier} ${ref}`); const answer = files[`${carrier} ${ref}`]
    const settled = answer instanceof Error ? Promise.reject(answer) : Promise.resolve({revision: answer}); pending.push(settled.catch(() => {})); return settled }
  return {asked, read, settle: () => Promise.all(pending.splice(0))}
}

test('r892: the frame asks Central\'s file owner once for each file its scenes are made of, again when a body is read at another revision or the window comes back, and says when one moved', async () => {
  const files = {[`text_source ${TEXT}`]: 'r7', [`image_media ${IMAGE}`]: 'i2'}, own = owner(files)
  let said = 0
  const sources = createSceneSourcesNow(own.read, () => { said++ })
  const view = seed([bodies.whole, bodies.text, bodies.image, bodies.text, null])
  sources.ask(view.document.scenes); await own.settle()
  assert.deepEqual(own.asked, [`text_source ${TEXT}`, `image_media ${IMAGE}`], 'each file once; a constellation and the engine composition are not asked')
  assert.deepEqual([...sources.now()], [[sceneSourceKey('text_source', TEXT), 'r7'], [sceneSourceKey('image_media', IMAGE), 'i2']])
  assert.equal(said, 2, 'each file\'s first answer is news')
  sources.ask(view.document.scenes); await own.settle()
  assert.equal(own.asked.length, 2, 'a reading at the same revisions asks nothing again')
  files[`text_source ${TEXT}`] = 'r8'
  sources.ask(view.document.scenes, {again: true}); await own.settle()
  assert.equal(own.asked.length, 4, 'the window back in front asks every file again')
  assert.equal(sources.now().get(sceneSourceKey('text_source', TEXT)), 'r8')
  assert.equal(said, 3, 'the file that moved is news; the one that stands is not')
  sources.ask(view.document.scenes, {again: true}); await own.settle()
  assert.equal(said, 3, 'answers that stand as they did are not')
  const remade = seed([bodies.whole, {...bodies.text, reading: reading(TEXT, 'r8')}, bodies.image, null, null])
  sources.ask(remade.document.scenes); await own.settle()
  assert.deepEqual(own.asked.slice(6), [`text_source ${TEXT}`], 'a body read again at another revision (a Remake) asks its file again')
  files[`image_media ${IMAGE}`] = new Error('Central owner CLI unavailable')
  sources.ask(remade.document.scenes, {again: true}); await own.settle()
  assert.equal(sources.now().has(sceneSourceKey('image_media', IMAGE)), false, 'a refused read compares nothing: never guessed as current or gone')
  assert.equal(said, 4)
})

// CODE-READING: app.ts is the frame's DOM entry and cannot load under node, and the walk world holds no Central file owner (its files_list
// answers "Central owner CLI unavailable"), so the wiring is read from the source: the frame asks through its own host reads, publishes the
// reading again on news, asks every file again when shown or focused, and its editor's reading carries the revisions into the scenes reading.
test('r892: the frame wires the reads to its host channel and the revisions into its scenes reading', async () => {
  const {readFile} = await import('node:fs/promises')
  const src = new URL('../../../desktop/cradle/expressions-app/field-studies-journeys/src/', import.meta.url)
  const app = await readFile(new URL('app.ts', src), 'utf8'), editor = await readFile(new URL('hostEditor.ts', src), 'utf8')
  assert.match(app, /createSceneSourcesNow\(\(carrier,ref\)=>carrier==='text_source'\?nativeSubjectTextRequest\(ref\):nativeSubjectBytesRequest\(ref\),\(\)=>announceHostState\(\)\)/)
  assert.match(app, /window\.addEventListener\('focus',askSceneSourcesAgain\);document\.addEventListener\('visibilitychange',askSceneSourcesAgain\)/)
  assert.match(app, /sourcesNow:\(\)=>\{sceneSources\.ask\(nativeWorkspace\?\.nativeView\(\)\?\.document\.scenes\?\?\[\]\);return sceneSources\.now\(\);\}/)
  assert.match(editor, /scenes:projectNativeScenes\(options\.store\.document,view,options\.sourcesNow\?\.\(\)\)/)
})
