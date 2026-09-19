// The nara-stage-focus walk page: the REAL providers (Kernel + Visuals +
// ExpressionStage) hosting the REAL ExpressionView (presenting on the live
// stage) and the REAL NaraSurface, against the real kernel walk bridge.
//
// The probe adds no authority: `window.__stageProbe.inspect()` is the same
// bounded ExpressionStageApi.inspect() the walk channel exposes — a read
// model only. Every movement under test is performed by the real surfaces
// through their own seams.
import React, {useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {KernelProvider} from '../../src/kernel/KernelProvider';
import {VisualsProvider} from '../../src/visuals/ParticleExpression';
import {ExpressionStageProvider,useExpressionStage} from '../../src/stage/ExpressionStage';
import {ExpressionView} from '../../src/expression/ExpressionView';
import {NaraSurface} from '../../src/nara/NaraSurface';
import '@epilogos/oi-design-system/tokens.css';
import '../../src/nara/nara.css';

function StageProbe(){
  const stage=useExpressionStage();
  useEffect(()=>{
    window.__stageProbe={inspect:()=>stage.inspect()};
  });
  return null;
}

const binding=window.NARA_STAGE_TEST_BINDING??{id:'nara-stage',kind:'nara',title:'Nara'};
createRoot(document.getElementById('root')!).render(
  <KernelProvider>
    <VisualsProvider>
      <ExpressionStageProvider>
        <StageProbe/>
        <ExpressionView initialExpressionRef={binding.ref}/>
        <NaraSurface binding={binding}/>
      </ExpressionStageProvider>
    </VisualsProvider>
  </KernelProvider>,
);
