/** Session-local execution of native-reviewed Nara focus. Native Expression
 * owns the checkpoint and its CAS; this controller retains no document copy. */
import {beginExpressiveAct, completeExpressiveAct, interruptExpressiveAct,
  planChoreography, takeChoreographyStep, completeChoreographyStep, interruptChoreography,
  type ExpressiveActState, type ChoreographyPlan} from './expressiveAct';
import type {NativeDialogueRequest} from './dialogueTypes';
import type {InstrumentBasis} from './instrumentProtocol';

export type NativeExpressiveActRequest =
  |{operation:'status';binding:NativeDialogueRequest}
  |{operation:'inspect'; binding:NativeDialogueRequest; answer_block_id:number}
  |{operation:'focus'; binding:NativeDialogueRequest; answer_block_id:number; target_ref:string}
  |{operation:'restore'; binding:NativeDialogueRequest; act_ref:string; expected_revision:number};
export interface NativeActTarget {ref:string; label:string; kind:'scene'|'subject'|'relation'; change:unknown; effect_required:boolean}
export interface NativeActReview {
  schema:'oi.nara-expressive-act-review/v1'; act_ref:string; checkpoint_ref:string;
  nara_ref:string; agent_session_ref:string; expression_ref:string; expression_revision:number;
  answer_block_ids:number[]; targets:NativeActTarget[]; choice_required:boolean; effect_applied:false;
}
export interface NativeActEffect {
  schema:'oi.nara-expressive-act-effect/v1'; act_ref:string; checkpoint_ref:string;
  nara_ref:string; expression_ref:string; expression_revision:number;
  operation:'focus'|'restore'; effect_applied:boolean; dynamic_checkpoint:false;
  document?:import('../expression/types').ExpressionDocument;
}
export interface NativeActStatus {
  schema:'oi.nara-expressive-act-status/v1';nara_ref:string;expression_ref:string;
  expression_revision:number;context_ref:string;state:ExpressiveActState|null;
  checkpoint_available:boolean;dynamic_checkpoint:false;
}
export interface NativeActPorts {
  /** Actual host request; the native owner rereads the completed answer and
   * verifies its full current context before a focus may commit. */
  request:(request:
    |{operation:'act_focus';basis:InstrumentBasis;role:'nara';answer_block_id:number;target_ref:string}
    |{operation:'act_restore';basis:InstrumentBasis;role:'nara';act_ref:string;expected_revision:number}
  )=>Promise<NativeActEffect>;
  /** Actual local audio teardown AND native voice/text cancellation. The host
   * must not resolve this promise on a mere visual state change. */
  stopSpeech:()=>Promise<void>;
}
interface Active {
  review:NativeActReview; basis:InstrumentBasis; state:ExpressiveActState;
  plan:ChoreographyPlan; target:string; currentRevision:number; speechEnded:boolean;
  committed:boolean; restored:boolean;
}
export class NativeExpressiveAct {
  private active:Active|null=null;
  private recovered:{status:NativeActStatus;basis:InstrumentBasis;restored:boolean}|null=null;
  private restoring=false;
  constructor(private readonly ports:NativeActPorts) {}
  read():{state:ExpressiveActState; current_revision:number; pending:number; running:boolean;
    checkpoint_available:boolean; answer_block_ids:number[]}|null {
    const a=this.active;
    if(!a&&this.recovered?.status.state){const r=this.recovered;return {
      state:structuredClone(r.status.state!),current_revision:r.status.expression_revision,
      pending:0,running:false,checkpoint_available:!r.restored,answer_block_ids:[],
    };}
    return a?{state:structuredClone(a.state),current_revision:a.currentRevision,
      pending:a.plan.pending.length,running:!!a.plan.running,
      checkpoint_available:a.committed&&!a.restored,answer_block_ids:[...a.review.answer_block_ids]}:null;
  }
  /** Re-entry reads the native checkpoint handle. It never reconstructs an
   * answer, document, speech session or queued action from renderer memory. */
  recover(status:NativeActStatus,basis:InstrumentBasis,naraRef:string):void {
    if(this.restoring||this.active?.plan.running)throw Error('Wait for the pending native act before reading its checkpoint.');
    if(status.schema!=='oi.nara-expressive-act-status/v1'||status.nara_ref!==naraRef
      ||status.expression_ref!==basis.expression_ref||status.dynamic_checkpoint!==false
      ||!Number.isSafeInteger(status.expression_revision))throw Error('The native checkpoint belongs to another current basis.');
    if(status.checkpoint_available&&(!status.state?.checkpoint||status.state.phase!=='completed'
      ||status.state.basis_expression_revision!==String(status.expression_revision)))throw Error('The native checkpoint has no current completed act.');
    this.cancelPending();this.active=null;
    this.recovered=status.checkpoint_available?{status:structuredClone(status),basis:structuredClone(basis),restored:false}:null;
  }
  /** Caller explicitly picks even the single target. Speech must refer to this
   * same completed native answer; model prose never supplies an operation. */
  begin(review:NativeActReview,basis:InstrumentBasis,naraRef:string,targetRef:string,speechTurnRef:string):void {
    if(this.restoring||this.active?.plan.running||this.active&&['active','composing'].includes(this.active.state.phase))
      throw Error('Stop the current expressive act before beginning another.');
    if(review.schema!=='oi.nara-expressive-act-review/v1'||review.effect_applied!==false
      ||review.nara_ref!==naraRef||review.expression_ref!==basis.expression_ref
      ||!Number.isSafeInteger(review.expression_revision)
      ||!review.answer_block_ids.length||review.answer_block_ids.some(id=>!Number.isSafeInteger(id)||id<0)
      ||review.targets.filter(t=>t.ref===targetRef).length!==1)
      throw Error('Choose one exact target from the current native Nara answer.');
    const state=beginExpressiveAct({expressive_act_ref:review.act_ref,
      basis_expression_revision:String(review.expression_revision),speech_turn_ref:speechTurnRef,
      checkpoint:{checkpoint_ref:review.checkpoint_ref,checkpoint_expression_revision:String(review.expression_revision)}});
    this.recovered=null;
    this.active={review:structuredClone(review),basis:structuredClone(basis),state,
      plan:planChoreography(review.act_ref,[{step_ref:review.act_ref+':focus',
        summary:'Focus '+review.targets.find(t=>t.ref===targetRef)!.label,atomic_safe:true,reversible:true}]),
      target:targetRef,currentRevision:review.expression_revision,speechEnded:false,committed:false,restored:false};
  }
  /** Run after the same native answer's actual speech naturally completes.
   * Speech and focus are one ordered act: focus changes the native context and
   * invalidates its old voice lease. It must not keep that old lease alive.
   * Stop before this call empties the queue, so a delayed speech response cannot
   * revive presentation movement. An already-running native CAS may finish. */
  async advanceFocus():Promise<NativeActEffect|null> {
    const a=this.active;
    if(!a||a.state.phase!=='active'||!a.speechEnded||a.plan.running)return null;
    const step=takeChoreographyStep(a.plan);if(!step)return null;
    try {
      const result=await this.ports.request({operation:'act_focus',basis:a.basis,role:'nara',
        answer_block_id:a.review.answer_block_ids[0]!,target_ref:a.target});
      this.checkEffect(a,result,'focus');
      a.currentRevision=result.expression_revision;a.committed=result.effect_applied;
      a.state={...a.state,basis_expression_revision:String(result.expression_revision)};
      completeChoreographyStep(a.plan);
      if(a.speechEnded&&a.state.phase==='active')a.state=completeExpressiveAct(a.state);
      return result;
    } catch(error) {
      // An uncertain native effect is never automatically retried. Keep its
      // step out of the queue; native inspect/recovery decides what occurred.
      a.plan.running=null;a.plan.pending=[];
      if(a.state.phase==='active')a.state=interruptExpressiveAct(a.state);
      throw error;
    }
  }
  /** Synchronous queue cancellation precedes every asynchronous speech close. */
  cancelPending():void {
    const a=this.active;
    if(a){interruptChoreography(a.plan);if(a.state.phase==='active')a.state=interruptExpressiveAct(a.state);}
  }
  stop():Promise<void> {
    this.cancelPending();
    return this.ports.stopSpeech();
  }
  speechCompleted(answerBlockId:number):void {
    const a=this.active;if(!a||!a.review.answer_block_ids.includes(answerBlockId))return;
    a.speechEnded=true;
    if(!a.plan.running&&!a.plan.pending.length&&a.state.phase==='active')a.state=completeExpressiveAct(a.state);
  }
  async restore():Promise<NativeActEffect> {
    if(!this.active&&this.recovered&&!this.recovered.restored){
      if(this.restoring)throw Error('A native checkpoint return is already pending.');
      const r=this.recovered,state=r.status.state!;this.restoring=true;
      try{
        const result=await this.ports.request({operation:'act_restore',basis:r.basis,role:'nara',
          act_ref:state.expressive_act_ref,expected_revision:r.status.expression_revision});
        if(result.schema!=='oi.nara-expressive-act-effect/v1'||result.operation!=='restore'||!result.effect_applied
          ||result.act_ref!==state.expressive_act_ref||result.checkpoint_ref!==state.checkpoint!.checkpoint_ref
          ||result.expression_ref!==r.status.expression_ref||result.nara_ref!==r.status.nara_ref
          ||result.expression_revision!==r.status.expression_revision+1||result.dynamic_checkpoint!==false)
          throw Error('The native checkpoint return has another basis.');
        r.restored=true;r.status.expression_revision=result.expression_revision;
        r.status.state={...state,basis_expression_revision:String(result.expression_revision)};
        return result;
      }finally{this.restoring=false;}
    }
    const a=this.active;
    if(!a||!a.committed||a.restored||a.plan.running||this.restoring||a.state.phase==='active')
      throw Error('Stop the act and wait for its native focus before returning to its checkpoint.');
    this.restoring=true;
    try {
      const result=await this.ports.request({operation:'act_restore',basis:a.basis,role:'nara',
        act_ref:a.review.act_ref,expected_revision:a.currentRevision});
      this.checkEffect(a,result,'restore');
      a.currentRevision=result.expression_revision;a.restored=true;
      // Native restore advances revision. Preserve the original checkpoint's
      // provenance, and begin/complete the returned state at its NEW revision.
      // The older pure checkpoint helper expects the old revision and cannot
      // represent this actual native CAS; do not pretend the document rewound.
      a.state=completeExpressiveAct(beginExpressiveAct({expressive_act_ref:a.review.act_ref,
        basis_expression_revision:String(result.expression_revision),checkpoint:a.state.checkpoint}));
      return result;
    } finally {this.restoring=false;}
  }
  private checkEffect(a:Active,result:NativeActEffect,operation:'focus'|'restore'):void {
    if(result.schema!=='oi.nara-expressive-act-effect/v1'||result.operation!==operation
      ||result.act_ref!==a.review.act_ref||result.checkpoint_ref!==a.review.checkpoint_ref
      ||result.nara_ref!==a.review.nara_ref||result.expression_ref!==a.basis.expression_ref
      ||result.dynamic_checkpoint!==false||!Number.isSafeInteger(result.expression_revision)
      ||result.expression_revision!==(a.currentRevision+(result.effect_applied?1:0)))
      throw Error('The native expressive act returned a different basis or effect.');
  }
}
