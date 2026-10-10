import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {register} from 'node:module';

// Production TypeScript sources through the app's own transpiler (same setup as native-glyph-insert.test.mjs).
// Covers field-material and ink-mode: the validators, their drift against the app's authored unions, the
// sharing law of the reducer, the routed apply through the retained editor, and the native compile they feed.
const root = new URL('../../../', import.meta.url);
const typescript = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(typescript)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier, context, next) {
  try {return await next(specifier, context)} catch (error) {
    if (specifier.startsWith('.') && specifier.endsWith('.js')) return next(specifier.slice(0,-3)+'.ts',context);
    if (specifier.startsWith('.') && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier+'.ts',context);
    throw error;
  }
}
export async function load(url,context,next) {
  if (!url.endsWith('.ts') && !url.endsWith('.tsx')) return next(url,context);
  const source=await readFile(new URL(url),'utf8');
  return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}
`)}`, import.meta.url);
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
const receiptPath = '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const [style, {applyNativeDeviceChanges: apply}, model, {kernelDocumentToJourney}, {DocumentStore}, {createRetainedNativeEditor}, {toNativeConfig}, {effectiveScene, initialiseShared, toggleShared}] = await Promise.all([
  import(new URL('../src/nativeFieldStyle.ts', import.meta.url)),
  import(new URL('../src/nativeDeviceEdits.ts', import.meta.url)),
  import(new URL('model.ts', author)),
  import(new URL('kernelDocumentBridge.ts', author)),
  import(new URL('store.ts', author)),
  import(new URL('hostEditor.ts', author)),
  import(new URL('nativeBridge.ts', author)),
  import(new URL('sharedSettings.ts', author)),
]);
const {FIELD_MATERIALS, INK_MODES, FIELD_MATERIAL_CARDS, validateNativeFieldMaterialChange, validateNativeInkModeChange} = style;
const {prepareCompositionEdit} = await import(new URL('kernelComposition.ts', author));

test('the material and ink lists are the app’s authored unions, pinned to their source text', async () => {
  const modelText = await readFile(new URL('model.ts', author), 'utf8');
  assert.match(modelText, /export type Material = 'ink'\|'print'\|'round';/);
  assert.match(modelText, /inkMode\?:'blackOnWhite'\|'whiteOnBlack';/);
  assert.match(modelText, /if\(!s\.field\|\|!color\(s\.field\.background\)\|\|!\['ink','print','round'\]\.includes\(s\.field\.material\)/);
  const inspector = await readFile(new URL('inspector.ts', author), 'utf8');
  assert.match(inspector, /\(\['ink','print','round'\]as const\)\.map\(m=>`<button data-action="material" data-value="\$\{m\}"/);
  assert.match(inspector, /\$\{m==='ink'\?'Ink':m==='print'\?'Print':'Rounded'\}/);
  assert.deepEqual(FIELD_MATERIALS, ['ink', 'print', 'round']);
  assert.deepEqual(INK_MODES, ['blackOnWhite', 'whiteOnBlack']);
  assert.deepEqual(FIELD_MATERIAL_CARDS.map(card => card.label), ['Ink', 'Print', 'Rounded']);
  assert.deepEqual(FIELD_MATERIAL_CARDS.map(card => card.value), FIELD_MATERIALS);
  // The app's own material writer: a card click writes exactly one of the authored values.
  const app = await readFile(new URL('app.ts', author), 'utf8');
  assert.match(app, /case 'material':changed\(\(\)=>\{s\.field\.material=el\.dataset\.value as Scene\['field'\]\['material'\];\}\);break;/);
  // The app's paper writers name the same ink values.
  assert.match(app, /s\.engine\.inkMode=isLightHex\(s\.field\.background\)\?'blackOnWhite':'whiteOnBlack';/);
});

test('validators admit one authored value and refuse anything else or any foreign operand', () => {
  for (const value of FIELD_MATERIALS) assert.deepEqual(validateNativeFieldMaterialChange({kind: 'field-material', value}), {kind: 'field-material', value});
  for (const value of INK_MODES) assert.deepEqual(validateNativeInkModeChange({kind: 'ink-mode', value}), {kind: 'ink-mode', value});
  assert.throws(() => validateNativeFieldMaterialChange({kind: 'field-material', value: 'paper'}), /admitted Field material/);
  assert.throws(() => validateNativeFieldMaterialChange({kind: 'field-material', value: 'ink', scene_id: 'x'}), /foreign operands/);
  assert.throws(() => validateNativeFieldMaterialChange({kind: 'ink-mode', value: 'ink'}), /admitted Field material/);
  assert.throws(() => validateNativeFieldMaterialChange(null), /admitted Field material/);
  assert.throws(() => validateNativeInkModeChange({kind: 'ink-mode', value: 'black'}), /admitted ink mode/);
  assert.throws(() => validateNativeInkModeChange({kind: 'ink-mode', value: 'blackOnWhite', entity_id: 'e'}), /foreign operands/);
  assert.throws(() => validateNativeInkModeChange({kind: 'field-material', value: 'print'}), /admitted ink mode/);
});

test('a local Scene takes the material and the ink on the Scene itself, one value each', () => {
  const journey = model.validateJourney({...model.blankJourney(), scenes: [model.blankScene('Only')]});
  const scene = journey.scenes[0];
  const next = apply(journey, scene.id, [{kind: 'field-material', value: 'print'}, {kind: 'ink-mode', value: 'whiteOnBlack'}]);
  assert.equal(next.scenes[0].field.material, 'print');
  assert.equal(next.scenes[0].engine.inkMode, 'whiteOnBlack');
  assert.equal(scene.field.material, 'ink', 'the input is not mutated');
  assert.throws(() => apply(journey, scene.id, [{kind: 'field-material', value: 'print'}, {kind: 'field-material', value: 'round'}]), /twice/);
  assert.throws(() => apply(journey, scene.id, [{kind: 'ink-mode', value: 'whiteOnBlack'}, {kind: 'ink-mode', value: 'blackOnWhite'}]), /twice/);
});

test('a shared Expression takes the value on the shared bucket, as the other field settings do', () => {
  const journey = model.validateJourney({...model.blankJourney(), scenes: [model.blankScene('A'), model.blankScene('B')]});
  initialiseShared(journey);
  const [a, b] = journey.scenes;
  a.engine.inkMode = 'blackOnWhite';
  toggleShared(journey, a, 'field.material');
  toggleShared(journey, a, 'engine.inkMode');
  const next = apply(journey, a.id, [{kind: 'field-material', value: 'round'}, {kind: 'ink-mode', value: 'whiteOnBlack'}]);
  assert.equal(next.shared.values['field.material'], 'round');
  assert.equal(next.shared.values['engine.inkMode'], 'whiteOnBlack');
  assert.equal(effectiveScene(next, next.scenes[1]).field.material, 'round', 'every Scene reads the shared material');
  assert.equal(effectiveScene(next, next.scenes[1]).engine.inkMode, 'whiteOnBlack');
  assert.equal(b.field.material, 'ink', 'the other Scene’s own field is not written');
});

test('routed through the retained editor on a captured Expression, both changes land and reach the native compile', async () => {
    const archived = JSON.parse(readFileSync(receiptPath, 'utf8'));
    const view = kernelDocumentToJourney(archived.after.document);
    const store = new DocumentStore(view.journey);
    const scene = store.document.scenes.find(row => row.id === view.startSceneId);
    const ok = async () => true;
    const owner = createRetainedNativeEditor({
      store, sceneId: () => scene.id, selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
      nativeSelect: async () => 'applied', commit: ok, change: mutate => mutate(), afterHistory: () => {}, selectLocal: () => {}, openEditor: () => {},
      standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false,
    });
    const basis = owner.read().basis;
    await owner.apply({operation: 'apply', basis, changes: [{kind: 'field-material', value: 'print'}, {kind: 'ink-mode', value: 'whiteOnBlack'}]});
    const edited = store.document.scenes.find(row => row.id === scene.id);
    assert.equal(edited.field.material, 'print');
    assert.equal(edited.engine.inkMode, 'whiteOnBlack');
    const native = toNativeConfig(edited);
    assert.equal(native.style, 'halftone', 'print is the native halftone style');
    assert.equal(native.colorMode, 'whiteOnBlack', 'the native compile reads the authored ink mode');
    // The owner's compile carries the whole presented Scene, so both values reach the native document.
    const compiled = prepareCompositionEdit(view, store.document).changes.find(change => change.change === 'scene_material_set');
    assert.equal(compiled.presentation.scene.field.material, 'print');
    assert.equal(compiled.presentation.scene.engine.inkMode, 'whiteOnBlack');
    await owner.apply({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'field-material', value: 'ink'}]});
    assert.equal(toNativeConfig(store.document.scenes.find(row => row.id === scene.id)).style, 'stipple');
    // Rounded has no native style of its own: it compiles to the same stipple as Ink, so a reload reads it back as Ink.
    await owner.apply({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'field-material', value: 'round'}]});
    assert.equal(toNativeConfig(store.document.scenes.find(row => row.id === scene.id)).style, 'stipple');
    assert.equal(store.document.scenes.find(row => row.id === scene.id).field.material, 'round', 'the authored value is kept in the document');
    await assert.rejects(() => owner.apply({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'ink-mode', value: 'black'}]}), /admitted ink mode/);
});
