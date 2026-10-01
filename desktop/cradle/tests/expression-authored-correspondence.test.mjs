import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createServer} from 'vite';

test('retained native shared material keeps its actual correspondence in the render config',async()=>{
  const server=await createServer({server:{middlewareMode:true},appType:'custom'});
  try {
    const {expressionRenderConfig}=await server.ssrLoadModule('/src/expression/engineProjection.ts');
    const {nativeExport}=await server.ssrLoadModule('../../packages/oi-design-system/expressions-engine/shell/nativeBridge.mjs');
    for(const name of ['shared-continuation','shared-factory-source']) {
      const receipt=JSON.parse(readFileSync(new URL('./fixtures/shared-native-expressions/'+name+'.json',import.meta.url),'utf8'));
      const doc=receipt.composition,scene=doc.scenes.find(s=>s.scene_ref===doc.selection.scene_ref);
      const native=nativeExport(scene.presentation.scene).config;
      const config=expressionRenderConfig(doc);
      const {oiExpressionBindings,...material}=config;
      assert.deepEqual(material,native,'the native source owns every material byte');
      assert.equal(oiExpressionBindings.expression_ref,doc.expression_ref);
      assert.equal(oiExpressionBindings.scene_ref,scene.scene_ref);
      assert.ok(oiExpressionBindings.relations.length>0,'the actual undertaking has visible relations');
      for(const r of oiExpressionBindings.relations)assert.deepEqual(r,doc.relations[r.binding_ref]);
      for(const r of Object.values(doc.relations)) {
        const coPresent=native.entities.some(e=>e.id===r.from_entity_ref&&e.enabled!==false)&&native.entities.some(e=>e.id===r.to_entity_ref&&e.enabled!==false);
        assert.equal(oiExpressionBindings.relations.some(b=>b.binding_ref===r.binding_ref),coPresent&&r.relation.availability==='available');
      }
      assert.equal(receipt.source_effects_replayed,false);
    }
  }finally{await server.close();}
});

test('the native required-body removal retains the identity while withholding absent-endpoint correspondence',async()=>{
  const server=await createServer({server:{middlewareMode:true},appType:'custom'});
  try {
    const {expressionRenderConfig}=await server.ssrLoadModule('/src/expression/engineProjection.ts');
    const receipt=JSON.parse(readFileSync(new URL('./fixtures/shared-native-expressions/shared-required-body-removed.json',import.meta.url),'utf8'));
    const doc=receipt.composition,config=expressionRenderConfig(doc);
    assert.ok(doc.entities[receipt.removed_entity_ref],'native subject identity survives');
    assert.equal(config.entities.find(e=>e.id===receipt.removed_entity_ref).enabled,false);
    const affected=Object.values(doc.relations).filter(r=>r.from_entity_ref===receipt.removed_entity_ref||r.to_entity_ref===receipt.removed_entity_ref);
    assert.ok(affected.length>0);
    for(const r of affected){assert.ok(config.oiExpressionBindings.unrendered_relation_refs.includes(r.binding_ref));assert.ok(!config.oiExpressionBindings.relations.some(b=>b.binding_ref===r.binding_ref));}
  }finally{await server.close();}
});
