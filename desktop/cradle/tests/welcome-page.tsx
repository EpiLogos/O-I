// Real providers, Welcome component and production engine. Only the parent's
// appReady input is controlled here; the kernel and field never receive fake
// responses. The native Welcome walk exercises the actual app composition.
import React, {useLayoutEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KernelProvider, useKernel} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {visuals} from '../src/visuals/store';
import {ExpressionStageProvider, useExpressionStage} from '../src/stage/ExpressionStage';
import {WelcomeField} from '../src/visuals/WelcomeField';
import '@epilogos/oi-design-system/tokens.css';

window.welcomeTest = {fieldReadyEvents: [], entered: 0, visuals, leakedKeys: []};
// Observe real event propagation. The opening's capture handler must prevent
// the underlying app's bubble-phase global shortcuts receiving these keys.
window.addEventListener('keydown', event => {
  if (['Enter', 'Escape', ' '].includes(event.key)) window.welcomeTest.leakedKeys.push(event.key);
});
function Opening() {
  const stage = useExpressionStage(), kernel = useKernel();
  const [appReady, setAppReady] = useState(false);
  const [entered, setEntered] = useState(false);
  useLayoutEffect(() => {
    Object.assign(window.welcomeTest, {stage, kernel, setAppReady});
  });
  return <>
    <main aria-label="Application underlay" style={{background:'var(--oi-canvas-ground)', color:'var(--oi-foreground)', minHeight:'100vh'}}>
      <button type="button">Workspace focus</button>
    </main>
    {!entered && <WelcomeField appReady={appReady}
      onFieldReady={() => window.welcomeTest.fieldReadyEvents.push(stage.inspect())}
      onEntered={() => {
        window.welcomeTest.entered++;
        window.welcomeTest.completedStage = stage.inspect();
        setEntered(true);
      }} />}
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode>
  <KernelProvider><VisualsProvider><ExpressionStageProvider>
    <Opening />
  </ExpressionStageProvider></VisualsProvider></KernelProvider>
</React.StrictMode>);
