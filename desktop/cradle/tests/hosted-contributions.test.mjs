import test from 'node:test';
import assert from 'node:assert/strict';
import {registeredHostedSurfaces} from '../src/contributions/generated.ts';
import {hostedSurfaceFor, withHostedDescriptor} from '../src/contributions/registry.ts';
import {hostedSurfaceDescriptors} from '../src/contributions/registered-kinds.mjs';
import {freshLayout} from '../src/surface/types.ts';
import {openBinding, closeSurface, reopenClosed} from '../src/surface/engine.ts';
import {decodeLayout} from '../src/surface/persist.ts';
import {switchWorkspaceMode} from '../src/workspace/store.ts';
import {warmWorkspaceTrees} from '../src/surface/warmTrees.ts';

test('compiled descriptors share stable mount identities and preserve owner refs across close/reopen/restore', () => {
  assert.deepEqual(registeredHostedSurfaces.map(row => row.descriptor), hostedSurfaceDescriptors);
  const original = {id:'factory-centre', kind:'factory', title:'Factory', ref:'factory:task/review', project:'O-I'};
  const binding = withHostedDescriptor(original);
  assert.deepEqual(original, {id:'factory-centre', kind:'factory', title:'Factory', ref:'factory:task/review', project:'O-I'});
  assert.deepEqual(binding.hosted, {descriptor_ref:'oi.surface/factory', contribution_ref:'oi.contribution/factory'});
  const mount = hostedSurfaceFor(binding).Component;
  const opened = openBinding(freshLayout(), binding);
  const reopened = reopenClosed(closeSurface(opened, binding.id));
  const restored = decodeLayout(JSON.parse(JSON.stringify(reopened))).surfaces[binding.id];
  assert.equal(restored.ref, original.ref);
  assert.equal(restored.project, original.project);
  assert.deepEqual(restored.hosted, binding.hosted);
  assert.equal(hostedSurfaceFor(restored).Component, mount);
  assert.equal(hostedSurfaceFor(withHostedDescriptor(binding)).Component, mount);
});

test('leaving a registered mode keeps its exact centre binding and compiled mount', () => {
  const binding = withHostedDescriptor({id:'expressions-centre',kind:'expressions',title:'Expressions',engine:{expressionRef:'expression:saved-writing'}});
  const layout = {...openBinding(freshLayout(), binding),mode:'expressions'};
  const before = {id:'workspace',name:'Writing',writing:'',layout};
  const settings = switchWorkspaceMode(before, 'settings');
  const back = switchWorkspaceMode(settings, 'expressions');
  assert.equal(back.layout.surfaces[binding.id], binding);
  assert.equal(back.layout.root, layout.root);
  assert.equal(hostedSurfaceFor(back.layout.surfaces[binding.id]).Component, hostedSurfaceFor(binding).Component);
  assert.equal(decodeLayout(JSON.parse(JSON.stringify(back.layout))).surfaces[binding.id].engine.expressionRef, 'expression:saved-writing');
});

test('a removed contribution remains a saved unavailable binding and warm tree without substitution', () => {
  const binding = {id:'saved-owner-view',kind:'previous-contribution',title:'Saved view',ref:'owner:subject/retained',hosted:{descriptor_ref:'owner.surface/saved',contribution_ref:'owner.contribution/saved'}};
  const restored = decodeLayout(JSON.parse(JSON.stringify(openBinding(freshLayout(), binding))));
  assert.equal(restored.surfaces[binding.id].ref, binding.ref);
  assert.deepEqual(restored.surfaces[binding.id].hosted, binding.hosted);
  assert.equal(hostedSurfaceFor(restored.surfaces[binding.id]), undefined);
  const settings = switchWorkspaceMode({id:'workspace',name:'Saved',writing:'',layout:restored}, 'settings');
  const kept = warmWorkspaceTrees([settings], 'workspace', 'settings').find(tree => tree.key === 'workspace:base');
  assert.equal(kept.layout.surfaces[binding.id], restored.surfaces[binding.id]);
  assert.equal(kept.presented, false);
  assert.equal(hostedSurfaceFor({...binding,kind:'factory'}), undefined, 'a familiar kind cannot replace a missing owner descriptor');
});
