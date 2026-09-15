// Real providers, Welcome component and production engine. Only the parent's
// appReady input is controlled here; the kernel and field never receive fake
// responses. The native Welcome walk exercises the actual app composition.
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KernelProvider, useKernel} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {visuals} from '../src/visuals/store';
import {ExpressionStageProvider, useExpressionStage} from '../src/stage/ExpressionStage';
import {WelcomeField} from '../src/visuals/WelcomeField';
import '@epilogos/oi-design-system/tokens.css';

window.welcomeTest = {fieldReadyEvents: [], entered: 0, visuals, leakedKeys: [], capturedByUnderlay: [], restoredAttempts: 0};
// Observe real event propagation. The opening's capture handler must prevent
// the underlying app's bubble-phase global shortcuts receiving these keys.
window.addEventListener('keydown', event => {
  if (['Enter', 'Escape', ' '].includes(event.key)) window.welcomeTest.leakedKeys.push(event.key);
});
// A real stage-consuming body mounted beneath Welcome. It uses the same
// public admission/release seam as native restored Expression/Nara bodies.
function RestoredExpression() {
  const stage = useExpressionStage(), host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observe = (event: KeyboardEvent) => window.welcomeTest.capturedByUnderlay.push(event.key);
    window.addEventListener('keydown', observe, true);
    return () => window.removeEventListener('keydown', observe, true);
  }, []);
  useEffect(() => {
    window.welcomeTest.restoredAttempts++;
    const handle = stage.present({id:'restored-expression',plane:'ambient',recipe:'oi.mark'});
    window.welcomeTest.restoredHandle = handle;
    handle?.setContainer(host.current);
    return () => {handle?.release();window.welcomeTest.restoredHandle = null;};
  }, [stage]);
  return <section aria-label="Restored Expression"><div ref={host} style={{height:400}}/></section>;
}
function Opening() {
  const stage = useExpressionStage(), kernel = useKernel();
  const [appReady, setAppReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [composeBody, setComposeBody] = useState(false);
  const restored = new URLSearchParams(location.search).has('restored');
  useLayoutEffect(() => {
    Object.assign(window.welcomeTest, {stage, kernel, setAppReady});
  });
  return <>
    <main aria-label="Application underlay" style={{background:'var(--oi-canvas-ground)', color:'var(--oi-foreground)', minHeight:'100vh'}}>
      <button type="button">Workspace focus</button>
      {restored && composeBody && <RestoredExpression/>}
    </main>
    {!entered && <WelcomeField appReady={appReady}
      onFieldReady={() => {
        window.welcomeTest.fieldReadyEvents.push(stage.inspect());
        setComposeBody(true);
      }}
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
