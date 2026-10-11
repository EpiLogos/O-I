/** Pure palette and paper builders: edge cases, parity with the app handlers (app.ts:538-542, nativeFeatures.ts:21),
 * admitted change shapes through the real validators, the real device reducer, one stub apply, and the rendered gates. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'
const root=new URL('../../../../',import.meta.url),compiler=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(new URL('packages/expressions-boundary/src/parameters.ts',root).href)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`,import.meta.url)
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root),app=new URL('app.ts',author),features=new URL('nativeFeatures.ts',author)
const receiptPath='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json'
const [helpers,drive,devices,registry,colours,{kernelDocumentToJourney},{DocumentStore},{createRetainedNativeEditor},{toNativeConfig},shared,react,ssr,{NativeDeviceInputCustody},{NativeColourField}]=await Promise.all([
 import('../src/components/nativeColourHelpers.ts'),import('../src/components/nativeColourController.ts'),import('../../../expressions-boundary/src/nativeDeviceEdits.ts'),import(new URL('packages/expressions-boundary/src/parameters.ts',root)),import(new URL('desktop/cradle/expressions-app/src/engine/colorPalettes.ts',root)),import(new URL('kernelDocumentBridge.ts',author)),import(new URL('store.ts',author)),import(new URL('hostEditor.ts',author)),import(new URL('nativeBridge.ts',author)),import(new URL('sharedSettings.ts',author)),import('../node_modules/react/index.js'),import('../node_modules/react-dom/server.node.js'),import('../src/components/nativeDeviceCustody.tsx'),import('../src/components/NativeColourField.tsx'),
])
const closed=()=>{throw Error('Native effects are closed in colour helper verification')}
function source(){const archived=JSON.parse(readFileSync(receiptPath,'utf8')),view=kernelDocumentToJourney(archived.after.document),store=new DocumentStore(view.journey),scene=store.document.scenes.find(s=>s.id===view.startSceneId),entity=scene.entities[0]
 const owner=createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>({entity_ids:[entity.id],step_id:entity.sequence.steps[0].id}),nativeView:()=>view,nativeSelect:closed,commit:closed,change:closed,afterHistory:closed,selectLocal:closed,openEditor:closed,standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false})
 return {view,store,scene,entity,owner,reading:owner.read()}}
const readingFrom=(r,journey)=>({...r.reading,scene:shared.effectiveScene(journey,journey.scenes.find(s=>s.id===r.scene.id))})
const glowTarget=()=>'field.'+registry.NATIVE_BINDINGS.find(b=>b.path==='backgroundGlowIntensity'&&b.group==='color').key
const ids=colours.COLOR_PALETTES.map(p=>p.id)
const eight=Array.from({length:8},(_,i)=>'#'+(i*31+7).toString(16).padStart(2,'0').repeat(3))
const render=props=>ssr.renderToStaticMarkup(react.createElement(NativeColourField,{disabled:false,apply:()=>{throw Error('SSR must not dispatch')},captureCurrent:()=>()=>false,renderControl:path=>react.createElement('span',null,path),createCustody:(aperture,material)=>new NativeDeviceInputCustody(aperture,material,'gesture'),...props}))
const appText=()=>readFile(app,'utf8'),featuresText=()=>readFile(features,'utf8')

test('invert palette swaps only the end stops, as the app does, and never mutates its input',async()=>{
 assert.deepEqual(helpers.invertPaletteStops(['#111111','#222222']),['#222222','#111111'])
 assert.deepEqual(helpers.invertPaletteStops(['#111111','#222222','#333333']),['#333333','#222222','#111111'])
 assert.deepEqual(helpers.invertPaletteStops(['#111111','#222222','#333333','#444444']),['#444444','#222222','#333333','#111111'])
 const out=helpers.invertPaletteStops(eight);assert.equal(out[0],eight[7]);assert.equal(out[7],eight[0]);assert.deepEqual(out.slice(1,7),eight.slice(1,7));assert.equal(out.length,8)
 assert.throws(()=>helpers.invertPaletteStops(['#111111']),/2–8/)
 assert.match(await featuresText(),/export function invertPalette\(s:Scene\)\{const p=s\.field\.palette;\[p\[0\],p\[p\.length-1\]\]=\[p\[p\.length-1\],p\[0\]\];\}/)
 assert.match(await appText(),/case 'native-palette-invert':changed\(\(\)=>invertPalette\(s\)\);break;/)
})
test('remove stop deletes one stop by position, never drops below two, and refuses bad positions',()=>{
 assert.deepEqual(helpers.removePaletteStop(['#111111','#222222','#333333'],1),['#111111','#333333'])
 assert.deepEqual(helpers.removePaletteStop(['#111111','#222222','#333333'],2),['#111111','#222222'])
 assert.equal(helpers.removePaletteStop(eight,7).length,7);assert.deepEqual(helpers.removePaletteStop(eight,0),eight.slice(1))
 assert.throws(()=>helpers.removePaletteStop(['#111111','#222222'],0),/at least 2 stops/)
 for(const index of [-1,3,1.5,NaN])assert.throws(()=>helpers.removePaletteStop(['#111111','#222222','#333333'],index),/existing palette stop/)
})
test('random palette is a uniform pick over the native catalogue, built only from the injected source',async()=>{
 const n=ids.length
 assert.equal(helpers.randomPaletteId(()=>0),ids[0]);assert.equal(helpers.randomPaletteId(()=>0.9999999999),ids[n-1]);assert.equal(helpers.randomPaletteId(()=>0.5),ids[Math.floor(n/2)])
 const seen=new Set();for(let i=0;i<n*40;i++)seen.add(helpers.randomPaletteId(()=>i/(n*40)));assert.equal(seen.size,n)
 for(const bad of [1,-0.1,NaN,Infinity])assert.throws(()=>helpers.randomPaletteId(()=>bad),/\[0, 1\)/)
 assert.throws(()=>helpers.randomPaletteId(()=>0.1,[]),/\[0, 1\)/)
 const change=helpers.randomPaletteChange(()=>0);assert.deepEqual(change,{kind:'colour-preset',palette_id:ids[0]});assert.deepEqual(devices.validateNativeColourChange(change),change)
 assert.deepEqual(devices.NATIVE_COLOUR_PALETTES.map(p=>p.id),ids)
 assert.match(await appText(),/case 'native-palette-random':changed\(\(\)=>\{applyPalette\(s,COLOR_PALETTES\[Math\.floor\(Math\.random\(\)\*COLOR_PALETTES\.length\)\]\.id\);\}\);break;/)
 const pure=await readFile(new URL('../src/components/nativeColourHelpers.ts',import.meta.url),'utf8');assert.doesNotMatch(pure,/Math\.random/)
 const shell=await readFile(new URL('../src/components/NativeColourField.tsx',import.meta.url),'utf8');assert.equal(shell.match(/Math\.random/g)?.length,1);assert.match(shell,/onClick=\{\(\)=>discrete\.run\(\(\)=>\[randomPaletteChange\(Math\.random\)\]\)\}/)
})
test('harmonized paper is the app formula exactly, with floors 3, 3 and 8 (app.ts:538)',async()=>{
 assert.equal(helpers.harmonizedPaper('#ffffff'),'#11111e');assert.equal(helpers.harmonizedPaper('#000000'),'#030308')
 assert.equal(helpers.harmonizedPaper('#ff0000'),'#110308');assert.equal(helpers.harmonizedPaper('#00ff00'),'#031108');assert.equal(helpers.harmonizedPaper('#0000ff'),'#03031e')
 const text=await appText()
 assert.match(text,/case 'native-paper-harmonize':changed\(\(\)=>\{const \[r,g,b\]=hexToRgb\(s\.field\.palette\[0\]\);s\.field\.background='#'\+\[Math\.max\(3,Math\.floor\(r\*\.07\)\),Math\.max\(3,Math\.floor\(g\*\.07\)\),Math\.max\(8,Math\.floor\(b\*\.12\)\)\]/)
 assert.match(text,/s\.engine\.backgroundMode='ambientGlow';s\.engine\.inkMode='whiteOnBlack';const binding=NATIVE_BINDINGS\.find\(b=>b\.path==='backgroundGlowIntensity'\);if\(binding\)bindValue\(s,binding\.bind,\.65\);/)
})
test('harmonize is one change set of admitted rows: background, ambient glow and glow, each validated',()=>{
 const target=glowTarget(),changes=helpers.harmonizePaperChanges('#ffffff',target)
 assert.equal(changes.length,4)
 assert.deepEqual(devices.validateNativeColourChange(changes[0]),{kind:'colour-background',value:'#11111e'})
 assert.deepEqual(devices.validateNativeFieldPanelChange(changes[1]),{kind:'panel-setting',key:'backgroundMode',value:'ambientGlow'})
 assert.deepEqual(changes[2],{kind:'parameter',target,value:.65})
 assert.deepEqual(changes[3],{kind:'ink-mode',value:'whiteOnBlack'})
 assert.deepEqual(drive.colourActionChanges(changes),changes)
})
test('invert paper flips between the two fixed papers by luminance and names the ink it needs (app.ts:539)',async()=>{
 assert.deepEqual(helpers.invertedPaper('#09090b'),{background:'#fafaf9',ink:'blackOnWhite'})
 assert.deepEqual(helpers.invertedPaper('#fafaf9'),{background:'#09090b',ink:'whiteOnBlack'})
 assert.deepEqual(helpers.invertedPaper('#ffffff'),{background:'#09090b',ink:'whiteOnBlack'})
 assert.deepEqual(helpers.invertedPaper('#000000'),{background:'#fafaf9',ink:'blackOnWhite'})
 assert.match(await appText(),/case 'native-paper-invert':changed\(\(\)=>\{s\.field\.background=isLightHex\(s\.field\.background\)\?'#09090b':'#fafaf9';s\.engine\.inkMode=isLightHex\(s\.field\.background\)\?'blackOnWhite':'whiteOnBlack';\}\);break;/)
})
test('paper presets are the app themes with the ink their luminance selects, and refuse unknown ids',()=>{
 const presets=helpers.paperPresets()
 assert.equal(presets.length,colours.BACKGROUND_THEMES.length);assert.ok(presets.length>0)
 for(const preset of presets){assert.deepEqual(devices.validateNativeColourChange({kind:'colour-background',value:preset.background}),{kind:'colour-background',value:preset.background});assert.equal(preset.ink,colours.isLightHex(preset.background)?'blackOnWhite':'whiteOnBlack')}
 assert.throws(()=>helpers.paperPreset('nope'),/Unknown native background/)
 assert.equal(helpers.paperPreset('studio_canvas').ink,'blackOnWhite');assert.equal(helpers.paperPreset('pitch_black').ink,'whiteOnBlack')
})
test('paper actions send their ink in the same apply: invert, presets and harmonize each carry the ink the paper needs',()=>{
 const inverted=helpers.invertPaperChanges('#09090b')
 assert.deepEqual(inverted,[{kind:'colour-background',value:'#fafaf9'},{kind:'ink-mode',value:'blackOnWhite'}])
 assert.deepEqual(drive.colourActionChanges(inverted),inverted)
 const pitch=helpers.paperPreset('pitch_black'),preset=helpers.paperPresetChanges('pitch_black')
 assert.deepEqual(preset,[{kind:'colour-background',value:pitch.background},{kind:'ink-mode',value:'whiteOnBlack'}])
 assert.deepEqual(drive.colourActionChanges(preset),preset)
 assert.throws(()=>helpers.paperPresetChanges('nope'),/Unknown native background/)
 assert.deepEqual(helpers.harmonizePaperChanges('#ffffff',glowTarget()).at(-1),{kind:'ink-mode',value:'whiteOnBlack'})
})
test('discrete colour actions admit only colour, panel and colour-group rows, each target at most once',()=>{
 const target=glowTarget()
 assert.deepEqual(drive.colourActionChanges([{kind:'colour-palette',colors:['#102030','#abcdef']}]),[{kind:'colour-palette',colors:['#102030','#abcdef']}])
 assert.deepEqual(drive.colourActionChanges([{kind:'panel-setting',key:'backgroundMode',value:'ambientGlow'},{kind:'parameter',target,value:.65}]),[{kind:'panel-setting',key:'backgroundMode',value:'ambientGlow'},{kind:'parameter',target,value:.65}])
 assert.throws(()=>drive.colourActionChanges([]),/no native change/)
 assert.throws(()=>drive.colourActionChanges([{kind:'colour-palette',colors:['#102030','#abcdef']},{kind:'colour-preset',palette_id:ids[0]}]),/same Colour Field target twice/)
 assert.throws(()=>drive.colourActionChanges([{kind:'colour-palette',colors:['#12']}]),/hex/)
 assert.throws(()=>drive.colourActionChanges([{kind:'parameter',target,value:registry.NATIVE_BINDINGS.find(b=>b.path==='backgroundGlowIntensity').hardMax+1}]),/inside its range/)
 const nonColour=registry.NATIVE_BINDINGS.find(b=>b.group!=='color');assert.throws(()=>drive.colourActionChanges([{kind:'parameter',target:'field.'+nonColour.key,value:nonColour.hardMin}]),/inside its range/)
 assert.throws(()=>drive.colourActionChanges([{kind:'panel-setting',key:'backgroundMode',value:'invented'}]),/admitted native Field panel/)
 assert.throws(()=>drive.colourActionChanges([{kind:'entity-setting',entity_id:'x',key:'name',value:'y'}]),/admitted native Colour Field action/)
 assert.deepEqual(drive.colourActionChanges([{kind:'ink-mode',value:'whiteOnBlack'}]),[{kind:'ink-mode',value:'whiteOnBlack'}])
 assert.throws(()=>drive.colourActionChanges([{kind:'ink-mode',value:'black'}]),/admitted ink mode/)
 assert.throws(()=>drive.colourActionChanges([{kind:'ink-mode',value:'blackOnWhite'},{kind:'ink-mode',value:'whiteOnBlack'}]),/same Colour Field target twice/)
})
test('dispatch sends exactly one apply on the basis it read; a refused action sends nothing',async()=>{
 const r=source(),calls=[],basis=r.reading.basis
 const apply=async(changes,used)=>{calls.push({changes,used});return {ok:true,reading:r.reading}}
 const reply=await drive.dispatchColourAction(apply,basis,[{kind:'colour-palette',colors:['#102030','#abcdef']}])
 assert.equal(reply.ok,true);assert.equal(calls.length,1);assert.equal(calls[0].used,basis);assert.deepEqual(calls[0].changes,[{kind:'colour-palette',colors:['#102030','#abcdef']}])
 assert.throws(()=>drive.dispatchColourAction(apply,basis,[{kind:'colour-palette',colors:['#12']}]),/hex/);assert.equal(calls.length,1)
})
test('each palette and paper action lands on the actual Scene through the real reducer as one undoable change set',async()=>{
 const r=source(),start=structuredClone(r.store.document),sceneId=r.scene.id,stops=['#102030','#456789','#abcdef'],target=glowTarget()
 const before=devices.applyNativeDeviceChanges(start,sceneId,[{kind:'colour-palette',colors:stops}])
 const inverted=devices.applyNativeDeviceChanges(before,sceneId,drive.colourActionChanges([{kind:'colour-palette',colors:helpers.invertPaletteStops(stops)}])).scenes[0]
 assert.deepEqual(inverted.field.palette,helpers.invertPaletteStops(stops));assert.equal(inverted.engine.paletteSource,'custom')
 const removed=devices.applyNativeDeviceChanges(before,sceneId,drive.colourActionChanges([{kind:'colour-palette',colors:helpers.removePaletteStop(stops,0)}])).scenes[0]
 assert.deepEqual(removed.field.palette,stops.slice(1))
 const harmonized=devices.applyNativeDeviceChanges(before,sceneId,drive.colourActionChanges(helpers.harmonizePaperChanges(stops[0],target))).scenes[0],native=toNativeConfig(harmonized)
 assert.equal(harmonized.field.background,helpers.harmonizedPaper(stops[0]));assert.equal(harmonized.engine.inkMode,'whiteOnBlack');assert.equal(harmonized.engine.backgroundMode,'ambientGlow');assert.equal(harmonized.field.params.native_backgroundGlowIntensity,.65)
 assert.equal(native.backgroundColor,helpers.harmonizedPaper(stops[0]));assert.equal(native.backgroundMode,'ambientGlow')
 const randomised=devices.applyNativeDeviceChanges(before,sceneId,drive.colourActionChanges([helpers.randomPaletteChange(()=>0)])).scenes[0]
 assert.equal(randomised.engine.paletteId,ids[0])
 const papered=devices.applyNativeDeviceChanges(before,sceneId,drive.colourActionChanges(helpers.paperPresetChanges('pure_white'))).scenes[0]
 assert.equal(papered.field.background,'#ffffff');assert.equal(papered.engine.inkMode,'blackOnWhite')
 r.store.replace(devices.applyNativeDeviceChanges(start,sceneId,drive.colourActionChanges([{kind:'colour-palette',colors:helpers.invertPaletteStops(stops)}])))
 assert.equal(r.store.undoStack.length,1);assert.equal(r.store.undo(),true);assert.deepEqual(r.store.document,start)
})
test('rendered discrete controls are labelled, disable with their reasons, and gate paper by the ink the Scene holds',()=>{
 const r=source(),two=devices.applyNativeDeviceChanges(r.store.document,r.scene.id,[{kind:'colour-palette',colors:['#102030','#abcdef']}]),reading=readingFrom(r,two)
 const html=render({reading,renderControl:path=>react.createElement('span',null,path)})
 assert.match(html,/<button aria-label="Remove stop 1" disabled="">/);assert.match(html,/A palette keeps at least 2 stops\. Add a stop before removing one\./)
 assert.match(html,/>Invert palette</);assert.match(html,/>Random palette</);assert.match(html,/aria-label="Native paper preset"/)
 const blackInk={...reading,scene:{...reading.scene,engine:{...reading.scene.engine,inkMode:'blackOnWhite'}}},gated=render({reading:blackInk})
 assert.match(gated,/<button title="Paper from the first palette stop, with ambient glow and its ink">Harmonize paper to palette<\/button>/)
 assert.match(gated,/<button title="Flips between the two fixed papers, with the ink each paper needs, as the app does">Invert paper<\/button>/)
 assert.doesNotMatch(gated,/Needs White on black ink|cannot change ink mode/)
 assert.match(gated,/<option value="pitch_black">Pitch Void · White on black ink<\/option>/);assert.match(gated,/<option value="studio_canvas">Paper Canvas · Black on white ink<\/option>/)
 const whiteInk={...reading,scene:{...reading.scene,engine:{...reading.scene.engine,inkMode:'whiteOnBlack'}}},open=render({reading:whiteInk})
 assert.match(open,/<option value="pitch_black">Pitch Void · White on black ink<\/option>/);assert.match(open,/<option value="studio_canvas">Paper Canvas · Black on white ink<\/option>/)
})
