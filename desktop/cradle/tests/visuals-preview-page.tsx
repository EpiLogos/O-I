// Actual settings controls, providers and engine, with a test-only mount seam.
import React, {useLayoutEffect, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {visuals} from '../src/visuals/store';
import {ExpressionStageProvider, useExpressionStage} from '../src/stage/ExpressionStage';
import {VisualsView} from '../src/workspace/settings/VisualsView';
import '@epilogos/oi-design-system/tokens.css';

function Settings() {
  const stage = useExpressionStage();
  const [open, setOpen] = useState(true);
  useLayoutEffect(() => { window.previewTest.stage = stage; });
  return <><button onClick={() => setOpen(!open)}>{open ? 'Close settings' : 'Open settings'}</button>{open && <VisualsView />}</>;
}
let root: Root | null = null;
window.previewTest = {
  visuals,
  mount() {
    root = createRoot(document.getElementById('root')!);
    root.render(<React.StrictMode><KernelProvider><VisualsProvider>
      <ExpressionStageProvider><Settings /></ExpressionStageProvider>
    </VisualsProvider></KernelProvider></React.StrictMode>);
  },
  unmount() { root?.unmount(); root = null; },
};
window.previewTest.mount();
