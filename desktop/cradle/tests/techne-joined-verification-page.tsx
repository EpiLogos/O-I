/** V worker (verification-only) composition root for
 * tests/techne-joined-verification.mjs. Reuses exactly the same two real
 * surfaces as techne-construction-join-page.tsx (the production Wiki
 * KnowledgeSurface + the live imported PointCloudHost, one kernel), and adds
 * ONLY the minimal `oi:open-scene-constellation` relay contract that the real
 * composition root (CradleFrame) owns in production, so the Canvas → Wiki
 * scene/subject handoff (M1′ "Edit constellation") has a real listener to
 * negate. The listener's mode is toggled from the walk via
 * `window.__RELAY_MODE__` ('complete' | 'refuse') — never production code,
 * only this disposable test root's own minimal stand-in for CradleFrame's
 * `constellationOpen` handler. No other production behaviour is altered. */
import {createRoot} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {ExpressionStageProvider} from '../src/stage/ExpressionStage';
import {KnowledgeSurface} from '../src/knowledge/KnowledgeSurface';
import {PointCloudHost} from '../src/expressions/PointCloudHost';
import {EXPRESSION_COMPOSE_EVENT} from '../src/expression/summon';
import {requestTechneFieldOpen, peekTechneFieldOpen, resetTechneFieldOpen} from '../src/expressions/fieldOpen';
import '@epilogos/oi-design-system/tokens.css';
import '@epilogos/oi-design-system/desktop.css';
import '../src/rest.css';
import '../src/cradle.css';
import '../src/knowledge/knowledge.css';
window.__OI_KERNEL_BRIDGE__ = new URLSearchParams(location.search).get('bridge') ?? '';
const mode = new URLSearchParams(location.search).get('mode') === 'expressions' ? 'expressions' : 'techne';
window.addEventListener(EXPRESSION_COMPOSE_EVENT, event => {
  const ref = (event as CustomEvent<{expressionRef?: string}>).detail?.expressionRef;
  if (typeof ref === 'string') requestTechneFieldOpen(ref, 'techne-presented');
});
Object.assign(window, {__TECHNE_FIELD_OPEN__: {peek: peekTechneFieldOpen, reset: resetTechneFieldOpen}});
// The minimal `oi:open-scene-constellation` contract PointCloudHost's own
// relay expects (map §15, commission §10 negative "remove scene/subject
// handoff"): a `target`, a `complete(error?)` callback. 'refuse' answers
// exactly as a real routing failure would (an error string to `complete`);
// 'complete' answers success without an error, recording the exact target it
// was asked to open so the walk can assert the handoff carried the right
// identity — never claiming a rendered Wiki drawer this disposable root does
// not itself provide.
window.__RELAY_MODE__ = 'complete';
window.__RELAY_CALLS__ = [];
window.addEventListener('oi:open-scene-constellation', event => {
  const detail = (event as CustomEvent<{target?: {frame_ref?: string}; complete?: (error?: string) => void}>).detail;
  (window.__RELAY_CALLS__ as unknown[]).push({target: detail?.target ?? null, mode: window.__RELAY_MODE__});
  if (window.__RELAY_MODE__ === 'refuse') detail?.complete?.('Scene/subject handoff refused by test fault injection');
  else detail?.complete?.();
});
function App() {
  return <main style={{height: '100vh', display: 'flex', fontFamily: 'var(--oi-font-sans)', color: 'var(--oi-foreground)', background: 'var(--oi-canvas-ground)'}}>
    <div style={{width: '40%', minWidth: 0, overflow: 'auto', borderRight: '1px solid var(--oi-border)'}}>
      <KnowledgeSurface binding={{id: 'native-wiki-join', kind: 'knowledge', title: 'Alpha', project: 'Notes', address: {kind: 'source', value: 'source:a'}, view: {knowledgePlane: 'page'}}} onOpen={async () => {throw new Error('This proof follows source navigation inside the production Wiki.');}}/>
    </div>
    <div data-host="presented" style={{flex: 1, minWidth: 0, display: 'flex'}} data-host-mode={mode}><PointCloudHost mode={mode} bindingId="techne-presented"/></div>
    {mode === 'techne' && <div data-host="concealed" style={{display: 'none'}}><PointCloudHost mode="techne" bindingId="techne-concealed"/></div>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<KernelProvider><VisualsProvider><ExpressionStageProvider><App/></ExpressionStageProvider></VisualsProvider></KernelProvider>);
