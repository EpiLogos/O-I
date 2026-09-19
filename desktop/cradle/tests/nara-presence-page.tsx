// Real providers (Kernel + ExpressionStage) hosting the real NaraSurface,
// driven by tests/nara-presence-lifecycle.mjs against a real walk bridge.
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {ExpressionStageProvider} from '../src/stage/ExpressionStage';
import {NaraSurface} from '../src/nara/NaraSurface';
import '@epilogos/oi-design-system/tokens.css';
import '../src/nara/nara.css';

let root: Root | null = null;

window.naraPresenceTest = {
  mount(binding) {
    root = createRoot(document.getElementById('root')!);
    root.render(
      <KernelProvider>
        <VisualsProvider>
          <ExpressionStageProvider>
            <NaraSurface binding={binding} />
          </ExpressionStageProvider>
        </VisualsProvider>
      </KernelProvider>,
    );
  },
  unmount() {
    root?.unmount();
    root = null;
  },
};

window.naraPresenceTest.mount(window.NARA_TEST_BINDING ?? {id: 'nara-test', kind: 'nara', title: 'Nara'});
