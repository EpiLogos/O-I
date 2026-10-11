/** Value-only admission to the canonical hooks. The host must supply its
 * already-owned KernelApi and ExpressionStageApi. These imports start no
 * native boot, renderer, visual preference owner, document store or frame. */
export {KernelApiProvider, useKernel} from '../../../desktop/cradle/src/kernel/KernelContext';
export type {KernelApi} from '../../../desktop/cradle/src/kernel/KernelContext';
export {ExpressionStageApiProvider, useExpressionStage} from '../../../desktop/cradle/src/stage/StageContext';
export type {ExpressionStageApi, StagePresentation, StagePresentationRequest, StagePlane} from '../../../desktop/cradle/src/stage/StageContext';
