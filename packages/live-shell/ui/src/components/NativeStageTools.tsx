import type {HostedAppState} from '@epilogos/expressions-boundary'
import {StageCaptureTools, StageViewTools, useStageSender, type StageRun} from './expressions/studio/StudioStage'
import './NativeStageTools.css'

/** The stage controls as one strip, for the centre panel's own residence (panels/expressions.tsx, drawn only while no pane holds the
 * frame — and that residence is concealed in every mode since F2). The controls themselves are the Studio's TOOLS and CAPTURE sections
 * (components/expressions/studio/StudioStage.tsx), where they moved on 14 Oct out of the Expressions pane: this strip draws the same
 * two section bodies over one sender, so the two places can never disagree. The tool rail lives in the top bar (NativeBarControls.tsx);
 * orbit stays a pointer drag on the stage itself. */
export function NativeStageTools({state, run}: {state: HostedAppState | null; run: StageRun | null}) {
  const sender = useStageSender(state, run)
  return <div className="native-stage-tools" role="toolbar" aria-label="Stage controls">
    <StageViewTools sender={sender} />
    <StageCaptureTools sender={sender} />
    {sender.refusal && <p role="alert" className="native-stage-refusal">{sender.refusal}</p>}
  </div>
}
