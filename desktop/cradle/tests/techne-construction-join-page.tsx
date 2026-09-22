/** The source→construction→live-field join, both real surfaces over one kernel:
 * the production Wiki (KnowledgeSurface + WikiConstructionPanel, #418) on the
 * left, the live imported application (PointCloudHost, the Technē mount) on the
 * right. No native operation is intercepted; only the split layout belongs to
 * this page.
 *
 * This page plays the composition root's ONE role (CradleFrame's, in
 * production): it records every construction summon into the buffered
 * field-open store, NAMING the presented Technē centre (`techne-presented`)
 * exactly as CradleFrame names the presented techne binding. In the Technē cut
 * a SECOND, concealed Technē host stands mounted (`techne-concealed`): it reads
 * the ref but must leave it, so the constellation opens in exactly one host —
 * the presented one. Whether ANY field opens is PointCloudHost's own
 * `mode==="techne"` gate — the §41 negative severs that by standing the
 * presented host in the Expressions cut. */
import {createRoot} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
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
// The composition root records every summon into the store, naming the
// presented centre — the field's mode gate and the named target, not this
// recorder, are what the assertions exercise.
window.addEventListener(EXPRESSION_COMPOSE_EVENT, event => {
  const ref = (event as CustomEvent<{expressionRef?: string}>).detail?.expressionRef;
  if (typeof ref === 'string') requestTechneFieldOpen(ref, 'techne-presented');
});
Object.assign(window, {__TECHNE_FIELD_OPEN__: {peek: peekTechneFieldOpen, reset: resetTechneFieldOpen}});
function App() {
  return <main style={{height: '100vh', display: 'flex', fontFamily: 'var(--oi-font-sans)', color: 'var(--oi-foreground)', background: 'var(--oi-canvas-ground)'}}>
    <div style={{width: '40%', minWidth: 0, overflow: 'auto', borderRight: '1px solid var(--oi-border)'}}>
      <KnowledgeSurface binding={{id: 'native-wiki-join', kind: 'knowledge', title: 'Alpha', project: 'Notes', address: {kind: 'source', value: 'source:a'}, view: {knowledgePlane: 'page'}}} onOpen={async () => {throw new Error('This proof follows source navigation inside the production Wiki.');}}/>
    </div>
    <div data-host="presented" style={{flex: 1, minWidth: 0, display: 'flex'}} data-host-mode={mode}><PointCloudHost mode={mode} bindingId="techne-presented"/></div>
    {mode === 'techne' && <div data-host="concealed" style={{display: 'none'}}><PointCloudHost mode="techne" bindingId="techne-concealed"/></div>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<KernelProvider><ExpressionStageProvider><App/></ExpressionStageProvider></KernelProvider>);
