/** Actual React context/render acceptance. The values below are opaque
 * identity inputs, not a simulated native runtime or an engine acceptance. */
import assert from 'node:assert/strict';
import {createElement, Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {KernelApiProvider, ExpressionStageApiProvider, useKernel, useExpressionStage} from '../src/runtime.ts';
import {useKernel as legacyKernelHook, KernelApiProvider as legacyKernelPort} from '../../../desktop/cradle/src/kernel/KernelProvider.tsx';
import {useExpressionStage as legacyStageHook, ExpressionStageApiProvider as legacyStagePort} from '../../../desktop/cradle/src/stage/ExpressionStage.tsx';

assert.equal(typeof window, 'undefined');
assert.equal(typeof document, 'undefined');
assert.equal(useKernel, legacyKernelHook);
assert.equal(useExpressionStage, legacyStageHook);
assert.equal(KernelApiProvider, legacyKernelPort);
assert.equal(ExpressionStageApiProvider, legacyStagePort);
let reads = 0;
const identity = name => new Proxy(Object.freeze({identity: name}), {get() {reads++; throw Error('A value-only port read an owner API instead of forwarding its reference');}});
const kernel = identity('kernel'), stage = identity('stage'), innerKernel = identity('inner-kernel'), innerStage = identity('inner-stage');
const observed = [];
function Consumer({expectedKernel, expectedStage, label}) {
  const suppliedKernel = legacyKernelHook(), suppliedStage = legacyStageHook();
  assert.strictEqual(suppliedKernel, expectedKernel);
  assert.strictEqual(suppliedStage, expectedStage);
  observed.push(label);
  return createElement('span', null, label);
}
const wrap = (kernelValue, stageValue, children) => createElement(KernelApiProvider, {value: kernelValue},
  createElement(ExpressionStageApiProvider, {value: stageValue}, children));
const probe = (expectedKernel, expectedStage, label) => createElement(Consumer, {expectedKernel, expectedStage, label});
assert.equal(renderToStaticMarkup(wrap(kernel, stage, probe(kernel, stage, 'actual context'))), '<span>actual context</span>');
assert.equal(renderToStaticMarkup(wrap(kernel, stage, createElement(Fragment, null, probe(kernel, stage, 'outer before'),
  wrap(innerKernel, innerStage, probe(innerKernel, innerStage, 'inner')), probe(kernel, stage, 'outer after')))),
  '<span>outer before</span><span>inner</span><span>outer after</span>');
assert.equal(renderToStaticMarkup(wrap(innerKernel, innerStage, probe(innerKernel, innerStage, 'changed supplied APIs'))), '<span>changed supplied APIs</span>');
assert.equal(reads, 0, 'Ports do not call/read supplied owner APIs, allocate engines or start boot');
assert.deepEqual(observed, ['actual context', 'outer before', 'inner', 'outer after', 'changed supplied APIs']);
assert.throws(() => renderToStaticMarkup(createElement(function MissingKernel() {useKernel(); return null;})), /outside KernelProvider/);
assert.throws(() => renderToStaticMarkup(createElement(function MissingStage() {useExpressionStage(); return null;})), /outside ExpressionStageProvider/);
console.log(JSON.stringify({grade: 'React-context', passed: 7, faults: 0,
  claim: 'canonical and portable hooks/ports share the actual context singleton; real React rendering preserves opaque reference identity, nesting, replacement and missing-owner refusal',
  native_runtime_claim: false, engine_allocations: 0}));
