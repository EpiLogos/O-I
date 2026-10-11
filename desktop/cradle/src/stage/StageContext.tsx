/** The canonical stage context. Supplying an existing API never allocates
 * a canvas, engine, visual-preference owner or presentation store. */
import {createContext, useContext, type ReactNode} from 'react';
import type {ExpressionStageApi} from './ExpressionStage';
export type {ExpressionStageApi, StagePresentation, StagePresentationRequest, StagePlane} from './ExpressionStage';

const StageContext = createContext<ExpressionStageApi | null>(null);

export function useExpressionStage(): ExpressionStageApi {
  const stage = useContext(StageContext);
  if (!stage) throw new Error('useExpressionStage outside ExpressionStageProvider');
  return stage;
}

export function ExpressionStageApiProvider({value, children}: {value: ExpressionStageApi; children: ReactNode}) {
  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}
