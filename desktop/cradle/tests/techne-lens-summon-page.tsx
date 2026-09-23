// The Technē lens-summon probe page (test-only aperture, 2026-09-23): the
// REAL TechneCentre — the field (the built vendored application, served
// through the walk bridge the page's transport names) and the deep-instrument
// HUD — mounted exactly as the surface host mounts it. The summon walk drives
// the application's own Lens Studio chooser inside the real iframe and proves
// the summon opens the real registered instruments over the live register
// reading. No fixture reading is registered here: the wiki provider the HUD
// binds is the live one, reading Central's real wiki.json through the bridge
// (window.__OI_KERNEL_BRIDGE__, injected by the walk before page modules run).
import React from 'react';
import {createRoot} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {ExpressionStageProvider} from '../src/stage/ExpressionStage';
import {TechneCentre} from '../src/techne/TechneCentre';
import '@epilogos/oi-design-system/tokens.css';

const binding = {id: 'summon-binding', kind: 'techne' as const, ref: 'wiki:central', title: 'Central'};

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <KernelProvider>
      <VisualsProvider>
        <ExpressionStageProvider>
          <div style={{width: '1200px', height: '820px', position: 'relative'}}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TechneCentre binding={binding as any}/>
          </div>
        </ExpressionStageProvider>
      </VisualsProvider>
    </KernelProvider>
  </React.StrictMode>,
);
