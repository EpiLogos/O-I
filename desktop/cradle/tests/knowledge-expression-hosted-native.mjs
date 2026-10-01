// Replays an actual admitted old Expression publication with its unchanged
// owner data through the complete production portable renderer and providers.
// No app, bridge, engine, network response or replacement context is created.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultReadingText} from './default-reading-text.mjs';

register('./ts-transpile-hook.mjs',import.meta.url);
register('./knowledge-render-hook.mjs',import.meta.url);
const [readingPath,nativePath]=process.argv.slice(2);
assert.ok(readingPath,'Pass an actual admitted Expression owner-reading capture');
const capture=JSON.parse(await readFile(readingPath,'utf8'));
const reading=capture.data??capture;
assert.equal(reading.schema,'oi.shared-field.reading/v1');assert.equal(reading.state,'hosted');
const projection=reading.projections.filter(row=>row.subject?.ref===reading.ref&&row.subject.kind==='expression'&&row.state==='published').sort((a,b)=>b.projection_revision-a.projection_revision)[0];
assert.ok(projection,'The actual owner must admit a publication for this exact Expression');
const presentation=projection.representation.payload;
assert.equal(presentation.schema,'oi.world-presentation/v1');
const body=presentation.regions.flatMap(region=>region.bindings).find(binding=>binding.component_ref==='oi.presentation/expression/v1');
assert.ok(body?.props.composition,'The actual publication must carry its native composition');
const composition=body.props.composition;
assert.equal(composition.expression_ref,reading.ref);assert.equal(String(composition.revision),projection.source.revision);
const source=process.env.OI_PRESENTATION_SOURCE?pathToFileURL(process.env.OI_PRESENTATION_SOURCE).href:new URL('../src/explore/presentation.tsx',import.meta.url).href;
const {WorldPresentationView}=await import(source);
const {KernelProvider}=await import(new URL('../kernel/KernelProvider.tsx',source).href);
const {VisualsProvider}=await import(new URL('../visuals/ParticleExpression.tsx',source).href);
const {ExpressionStageProvider}=await import(new URL('../stage/ExpressionStage.tsx',source).href);
test('actual admitted legacy Expression uses native names, preserves original HTML and source actions',()=>{
const html=renderToStaticMarkup(createElement(KernelProvider,null,createElement(VisualsProvider,null,createElement(ExpressionStageProvider,null,createElement(WorldPresentationView,{presentation,hosting:'preview',onOpenRef:()=>{}})))));
const text=defaultReadingText(html,{includeFrames:true});
assert.ok(text.includes(presentation.title));
for(const entity of Object.values(composition.entities).filter(entity=>entity.subject)){
  assert.ok(text.includes(entity.title),`The original native entity name must remain visible: ${entity.title}`);
  assert.ok(!text.includes(entity.subject.subject_ref),'A bound identity must require deliberate source inspection');
}
assert.ok(!text.includes(composition.expression_ref),'Saved frame/caption must use the actual title, not the exact Expression ref');
assert.doesNotMatch(text,/(?:thing|being) · central/);
assert.match(html,/Original published HTML/);
for(const representation of body.props.expression.representations.filter(row=>row.kind==='html'))assert.ok(html.includes(representation.html.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;')),'Original immutable published HTML remains available on deliberate inspection');
for(const binding of presentation.regions.flatMap(region=>region.bindings).filter(binding=>binding.component_ref==='oi.presentation/reference-card/v1')){
  assert.ok(html.includes(`data-subject-ref="${binding.subject_ref}"`),'Exact bound subject remains on the actual component');
  for(const ref of binding.props.refs??[])assert.ok(html.includes(`data-subject-ref="${ref}"`),'Legacy source navigation keeps the original onOpenRef target');
}
console.log('PASS unchanged actual admitted Expression -> complete production providers/renderer; native entity names, saved frame, closed source identities, original HTML and legacy source actions retained. Installed engine/pixel acceptance remains separate.');
});
if(nativePath)test('actual current native Expression verso preserves names and closed identity',async()=>{
  const native=JSON.parse(await readFile(nativePath,'utf8'));
  assert.equal(native.outcome?.result,'expression');
  const document=native.outcome.data.document;
  assert.equal(document.schema,'oi.expression/v1');assert.equal(document.expression_ref,reading.ref);
  const {ExpressionVerso}=await import(new URL('../expression/ExpressionVerso.tsx',source).href);
  const html=renderToStaticMarkup(createElement(ExpressionVerso,{document,onOpenRef:()=>{}}));
  const text=defaultReadingText(html);
  assert.ok(text.includes(document.title));
  for(const entity of Object.values(document.entities).filter(entity=>entity.subject)){
    assert.ok(text.includes(entity.title),'Current native bound entity remains named on its verso');
    assert.ok(!text.includes(entity.subject.subject_ref),'Current bound identity requires inspection');
  }
  for(const ref of [document.expression_ref,...document.scenes.map(scene=>scene.scene_ref),...Object.keys(document.relations)])assert.ok(!text.includes(ref),'Current native Expression/scene/relation identity requires inspection');
  console.log('PASS current native Expression owner document -> production verso; names and actual source identities retained at their intended depths. Account-only Library replay still needs its exact native account capture.');
});
