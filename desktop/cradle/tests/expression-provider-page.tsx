// Real React providers and production WebGL engine. This test-only aperture
// exposes their public operations so the browser can check window ownership.
import React, {useLayoutEffect} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {visuals} from '../src/visuals/store';
import {ExpressionStageProvider, useExpressionStage} from '../src/stage/ExpressionStage';
import '@epilogos/oi-design-system/tokens.css';

function Probe() {
  const stage = useExpressionStage();
  useLayoutEffect(() => { window.providerTest.stage = stage; });
  return null;
}
let root: Root | null = null;
window.providerTest = {
  visuals,
  mount() {
    root = createRoot(document.getElementById('root')!);
    root.render(<React.StrictMode><KernelProvider><VisualsProvider>
      <ExpressionStageProvider><Probe /></ExpressionStageProvider>
    </VisualsProvider></KernelProvider></React.StrictMode>);
  },
  unmount() { root?.unmount(); root = null; },
};
window.providerTest.mount();
