/** The source→construction→live-field join, both real surfaces over one kernel:
 * the production Wiki (KnowledgeSurface + WikiConstructionPanel, #418) on the
 * left, the live imported application (PointCloudHost, the Technē mount) on the
 * right. No native operation is intercepted; only the split layout belongs to
 * this page.
 *
 * This page plays the composition root's ONE role (CradleFrame's, in
 * production): it records every construction summon into the buffered
 * field-open store. Whether the field actually opens it is PointCloudHost's own
 * `mode==="techne"` consumption gate — the load-bearing relay. The §41 negative
 * severs that relay by standing the host in the Expressions cut, where the
 * recorded ref must go unconsumed and the field must never open it. */
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
// The composition root records every summon into the store, unconditionally —
// the field's mode gate, not this recorder, is what the negative severs.
window.addEventListener(EXPRESSION_COMPOSE_EVENT, event => {
  const ref = (event as CustomEvent<{expressionRef?: string}>).detail?.expressionRef;
  if (typeof ref === 'string') requestTechneFieldOpen(ref);
});
Object.assign(window, {__TECHNE_FIELD_OPEN__: {peek: peekTechneFieldOpen, reset: resetTechneFieldOpen}});
function App() {
  return <main style={{height: '100vh', display: 'flex', fontFamily: 'var(--oi-font-sans)', color: 'var(--oi-foreground)', background: 'var(--oi-canvas-ground)'}}>
    <div style={{width: '44%', minWidth: 0, overflow: 'auto', borderRight: '1px solid var(--oi-border)'}}>
      <KnowledgeSurface binding={{id: 'native-wiki-join', kind: 'knowledge', title: 'Alpha', project: 'Notes', address: {kind: 'source', value: 'source:a'}, view: {knowledgePlane: 'page'}}} onOpen={async () => {throw new Error('This proof follows source navigation inside the production Wiki.');}}/>
    </div>
    <div style={{flex: 1, minWidth: 0, display: 'flex'}} data-host-mode={mode}><PointCloudHost mode={mode}/></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<KernelProvider><ExpressionStageProvider><App/></ExpressionStageProvider></KernelProvider>);
