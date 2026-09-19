/**
 * ExpressiveAct turn state + reversible choreography (O:I #336 on the #335
 * substrate; QL `ExpressiveActState` carries the dialogue half).
 *
 * A Nara contribution may combine speech with reversible presentation
 * operations — focus, scene passage, portal open/close, safe profile
 * movement. This module owns the host-side act: the queued reversible
 * operations, their authored checkpoints, and the interruption law —
 * interrupt stops the voice AND holds/cancels the stale pending
 * choreography together; only an already-running atomic safe operation may
 * finish. "Go back" restores an authored checkpoint; it never claims a
 * bit-exact GPU rewind.
 */

import {
  expressiveActLive,validateExpressiveActState,
  type ExpressiveActCheckpoint,type ExpressiveActPhase,type ExpressiveActState,
} from "./dialogueContext";
import {wireText} from "./support";

export type {ExpressiveActCheckpoint,ExpressiveActPhase,ExpressiveActState};

export interface ExpressiveActBegin {
  expressive_act_ref:string;
  basis_expression_revision:string;
  /** Opaque handle of the coupled speech turn, when speech rides the act. */
  speech_turn_ref?:string|null;
  checkpoint?:ExpressiveActCheckpoint|null;
}

/** Begin an act. A live act with speech carries the speech-turn handle; the
 * QL validation refuses the inverse (non-live claiming a voice). */
export function beginExpressiveAct(begin:ExpressiveActBegin):ExpressiveActState {
  return validateExpressiveActState({
    expressive_act_ref:wireText(begin.expressive_act_ref,"ExpressiveAct reference"),
    phase:"active",
    basis_expression_revision:wireText(begin.basis_expression_revision,"ExpressiveAct basis revision"),
    speech_turn_ref:begin.speech_turn_ref??null,
    checkpoint:begin.checkpoint??null,
  });
}

export function completeExpressiveAct(state:ExpressiveActState):ExpressiveActState {
  const current=validateExpressiveActState(state);
  if(!expressiveActLive(current.phase))throw new Error(`ExpressiveAct phase ${current.phase} cannot complete`);
  return validateExpressiveActState({...current,phase:"completed",speech_turn_ref:null});
}

/** Barge-in / manual stop: only meaningful while the act is live; ends the
 * voice coupling immediately. Pending choreography is stale from here on. */
export function interruptExpressiveAct(state:ExpressiveActState):ExpressiveActState {
  const current=validateExpressiveActState(state);
  if(!expressiveActLive(current.phase))throw new Error(`ExpressiveAct phase ${current.phase} cannot be interrupted`);
  return validateExpressiveActState({...current,phase:"interrupted",speech_turn_ref:null});
}

export function cancelExpressiveAct(state:ExpressiveActState):ExpressiveActState {
  const current=validateExpressiveActState(state);
  if(!expressiveActLive(current.phase)&&current.phase!=="interrupted")throw new Error(`ExpressiveAct phase ${current.phase} cannot be cancelled`);
  return validateExpressiveActState({...current,phase:"cancelled",speech_turn_ref:null});
}

/** Resume only against the revision the remaining choreography was composed
 * against; a moved encounter refuses the stale remainder (QL `resume`). */
export function resumeExpressiveAct(state:ExpressiveActState,currentExpressionRevision:string):ExpressiveActState {
  const current=validateExpressiveActState(state);
  if(current.phase!=="interrupted")throw new Error("only an interrupted ExpressiveAct can resume");
  if(current.basis_expression_revision!==wireText(currentExpressionRevision,"current Expression revision")){
    throw new Error(`stale ExpressiveAct resume: composed against revision ${current.basis_expression_revision} while the live encounter is at ${currentExpressionRevision}`);
  }
  return validateExpressiveActState({...current,phase:"active"});
}

/** "Go back": return the act to its authored checkpoint. The host must
 * actually have moved the live Expression to the checkpoint's revision; the
 * act then continues from that authored state — a named return, never a
 * bit-exact rewind (QL `restore_checkpoint`). */
export function restoreExpressiveActCheckpoint(state:ExpressiveActState,checkpointRef:string,currentExpressionRevision:string):ExpressiveActState {
  const current=validateExpressiveActState(state);
  const checkpoint=current.checkpoint;
  if(!checkpoint)throw new Error("ExpressiveAct carries no authored checkpoint to restore");
  if(checkpoint.checkpoint_ref!==checkpointRef)throw new Error(`checkpoint ${checkpointRef} is not authored on this ExpressiveAct`);
  if(checkpoint.checkpoint_expression_revision!==currentExpressionRevision){
    throw new Error(`checkpoint restore does not match the live Expression: checkpoint was authored at revision ${checkpoint.checkpoint_expression_revision} while the encounter is at ${currentExpressionRevision}`);
  }
  return validateExpressiveActState({...current,basis_expression_revision:checkpoint.checkpoint_expression_revision,phase:"active",speech_turn_ref:null});
}

// ---------------------------------------------------------------------------
// Reversible choreography
// ---------------------------------------------------------------------------

/** One pending presentation operation of an act. `commit` describes the real
 * operation (an owner Expression change or a pure presentation write); the
 * plan never executes anything itself. */
export interface ChoreographyStep {
  step_ref:string;
  summary:string;
  /** Atomic safe operations may finish when an interrupt lands mid-flight;
   * everything queued behind one is cancelled stale. */
  atomic_safe:boolean;
  /** Whether committing is reversible by the host (focus moves, parameter
   * sets, highlight clears — all reversible). Irreversible steps must not
   * enter a reversible act's choreography. */
  reversible:true;
}

export interface ChoreographyPlan {
  expressive_act_ref:string;
  pending:ChoreographyStep[];
  /** The step currently executing, when one is. */
  running:ChoreographyStep|null;
  completed:ChoreographyStep[];
}

export function planChoreography(expressiveActRef:string,steps:ChoreographyStep[]):ChoreographyPlan {
  wireText(expressiveActRef,"ExpressiveAct reference");
  return {expressive_act_ref:expressiveActRef,pending:[...steps],running:null,completed:[]};
}

/** Advance the plan: finish the running atomic step (if any) and start the
 * next queued one. The caller performs the step's real operation between
 * `take` and the next `take`. */
export function takeChoreographyStep(plan:ChoreographyPlan):ChoreographyStep|null {
  if(plan.running)return plan.running;
  const next=plan.pending.shift();
  if(!next)return null;
  plan.running=next;
  return next;
}

/** Mark the running step actually applied on the host. */
export function completeChoreographyStep(plan:ChoreographyPlan):ChoreographyStep|null {
  const running=plan.running;
  if(!running)return null;
  plan.running=null;
  plan.completed.push(running);
  return running;
}

export interface ChoreographyInterrupt {
  disposition:"hold-and-cancel-pending-choreography";
  /** The atomic safe step that was running and may finish. */
  finish:ChoreographyStep|null;
  /** Steps cancelled stale — they never apply after the interrupt. */
  cancelled:ChoreographyStep[];
  /** Steps that had already been applied and stand. */
  stood:ChoreographyStep[];
}

/** Interruption is material truth: hold/cancel the correlated reversible
 * choreography together with the voice. The disposition spelling is the one
 * the Actuation interruption receipt carries
 * (`hold-and-cancel-pending-choreography`); the host executes its own
 * choreography under it. */
export function interruptChoreography(plan:ChoreographyPlan):ChoreographyInterrupt {
  const finish=plan.running&&plan.running.atomic_safe?plan.running:null;
  const cancelled:ChoreographyStep[]=[...plan.pending];
  if(plan.running&&!finish)cancelled.unshift(plan.running);
  if(!finish)plan.running=null;
  plan.pending=[];
  return {disposition:"hold-and-cancel-pending-choreography",finish,cancelled,stood:[...plan.completed]};
}

/** Confirm the finishing atomic step landed after an interrupt. */
export function finishInterruptedStep(plan:ChoreographyPlan,step:ChoreographyStep):void {
  if(plan.running!==step)throw new Error(`step ${step.step_ref} is not the finishing step of this plan`);
  plan.running=null;
  plan.completed.push(step);
}
