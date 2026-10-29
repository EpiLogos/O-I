/** tarot-score-relay — the QL-MEF #312 Tarot score passage at the relay level.
 *
 * The real kernel through the walk bridge's POST /op seam (the KernelOp seam
 * the Tauri host fronts), spawning the INSTALLED ql + ql-field-host +
 * ql-field-worker + ql-sky. The bridge composes a sky-bearing scene, the
 * exchange relay admits the two score reads by exact name, and the installed
 * field host answers: the `ql.tarot-score/v1` resolve (named cards, codons,
 * pose admission, clock basis, currentness), the held `score-state` (same
 * basis, never re-derived), and the named "no anchor basis" refusal for a
 * basis with neither sky nor identity. Reads never advance the field; the
 * refusal changes nothing. A scene composed again on the first scene's own
 * saved snapshot (`sky_snapshot`) stands on the same sky and resolves the
 * same score: the save/reopen basis, at the relay.
 *
 * The bridge stands in a disposable Central ground and OI home, so nothing is
 * written to the person's own.
 */
import {execFileSync} from "node:child_process";
import {mkdtempSync,mkdirSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

// The pip register of ql-core `pole/tarot.rs`: 0 Ace, 1-9 Two..Ten, 10 Princess (Page), 11 Prince (Knight), 12 Queen, 13 King.
const SUITS=["Cups","Wands","Pentacles","Swords"],PIPS=["Ace","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Princess","Prince","Queen","King"];
const cardName=ref=>{
  const match=/#minor:([0-9]+)$/.exec(String(ref));
  if(!match)throw new Error(`a score token carries no minor card reference: ${ref}`);
  const id=Number(match[1]);
  if(!Number.isInteger(id)||id<0||id>=56)throw new Error(`minor id ${id} is outside the 56-card minor deck`);
  return `${PIPS[id%14]} of ${SUITS[Math.floor(id/14)]}`;
};

export async function setup(){
  const root=mkdtempSync(join(tmpdir(),"oi-tarot-relay-")),home=mkdtempSync(join(tmpdir(),"oi-tarot-relay-home-"));
  const ctrl=process.env.OI_CENTRAL_CTRL_BIN??"ctrl";
  try{
    const result=JSON.parse(execFileSync(ctrl,["--root",root,"--json","action","run","central.init","{}"],{encoding:"utf8"}));
    if(!result.ok)throw new Error(JSON.stringify(result));
    mkdirSync(join(root,"Work","ExpressionPage"),{recursive:true});
    const project=JSON.parse(execFileSync(ctrl,["--root",root,"--json","action","run","projectcentral.init",JSON.stringify({project:"ExpressionPage",project_id:"tarot-relay-walk"})],{encoding:"utf8"}));
    if(!project.ok)throw new Error(JSON.stringify(project));
    return {root,home,env:{OI_CENTRAL_ROOT:root,OI_CENTRAL_PROJECT_QUERY:"ExpressionPage",OI_HOME:home,OI_EXPRESSION_HOME:join(home,"expressions")},
      cleanup:()=>{rmSync(root,{recursive:true,force:true});rmSync(home,{recursive:true,force:true});}};
  }catch(error){
    rmSync(root,{recursive:true,force:true});rmSync(home,{recursive:true,force:true});
    throw error;
  }
}

export default async function run({page,baseUrl,bridgeUrl,check,shot,metric}){
  await page.goto(baseUrl);
  await page.evaluate(async()=>{
    const deadline=Date.now()+10000;
    while(!globalThis.__cradle?.walk&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
  });
  const op=async body=>{
    const response=await fetch(`${bridgeUrl}/op`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json();
    if(result.error)throw new Error(typeof result.error==="string"?result.error:JSON.stringify(result.error));
    if(!result.outcome)throw new Error(`the kernel returned no outcome: ${JSON.stringify(result).slice(0,200)}`);
    return result.outcome.data;
  };
  let seq=0;
  const exchange=(lease,receipt,command)=>op({op:"native_expression",request:{operation:"exchange",lease,request:{
    schema:"ql.field-host-request/v1",instance_ref:receipt.instance_ref,event_ref:receipt.field.event_ref,
    subject_ref:receipt.field.subject_ref,request_id:String(++seq),expected_generation:receipt.field.generation,
    expected_samples_elapsed:receipt.field.samples_elapsed,command}}});
  const arm=receipt=>{seq=Number(receipt.last_request_id??"0");};
  const skyOf=inspect=>{
    const input=inspect.sources?.current?.input;
    return (Array.isArray(input?.source_receipts)?input.source_receipts:[]).find(entry=>entry?.schema==="ql.sky-snapshot/v1")??null;
  };
  const basisOf=(receipt,sky,steps)=>({subject_ref:receipt.field.subject_ref,locus_ref:receipt.field.event_ref,identity:null,
    occasion_sky:sky,clock_steps:steps,primary_anchor:{kind:"kairos",body_index:0},drawn:[],boundary_passage:null,manifestation:null});

  // -- the sky-bearing scene: the installed pair composes it.
  const opened=await op({op:"native_expression",request:{operation:"compose",request:{texture:[256,256],units_per_metre:400,sky:"now"}}});
  check(opened.schema==="oi.native-expression-open/v1"&&typeof opened.lease==="string",
    "The kernel composes a sky-bearing scene on the installed pair and admits its lease",{schema:opened.schema});
  let receipt=opened.receipt;
  arm(receipt);
  check(receipt?.field?.sample_rate>0&&receipt?.status==="ready","The open receipt carries the native field at its device rate",{sample_rate:receipt?.field?.sample_rate,status:receipt?.status});
  await shot("relay-scene-composed");

  // -- the event's own sky receipt and M3 clock: the score's basis.
  const inspect=await exchange(opened.lease,receipt,{operation:"inspect"});
  const sky=skyOf(inspect);
  check(!!sky,"The scene event carries an admitted ql.sky-snapshot/v1 in its source receipts",{snapshot_ref:String(sky?.snapshot_ref??"").slice(0,24)});
  const clockSteps=Number(inspect.sources?.current?.m3?.clock?.steps);
  check(Number.isSafeInteger(clockSteps)&&clockSteps>=0,"The field's own M3 clock discloses its steps for the score basis",{steps:inspect.sources?.current?.m3?.clock?.steps});
  const early=await exchange(opened.lease,receipt,{operation:"score-state"});
  check(early.status==="refused"&&/score-state follows a score-resolve/.test(String(early.error)),
    "Before any resolve, score-state is refused in the owner's words",{error:String(early.error??"").slice(0,120)});
  const resolved=await exchange(opened.lease,receipt,{operation:"score-resolve",basis:basisOf(receipt,sky,clockSteps)});
  check(resolved.status==="ok"&&resolved.score?.schema==="ql.tarot-score/v1",
    "The exchange relay admits score-resolve by name and the field host answers the reading",{status:resolved.status,error:resolved.error});
  check(resolved.current===true&&resolved.resolved_event_ref===receipt.field.event_ref,
    "The resolved reading answers current for the field's own event",{current:resolved.current,resolved_event_ref:resolved.resolved_event_ref});
  const tokens=Array.isArray(resolved.score?.tokens)?resolved.score.tokens:[];
  metric("relay_tokens",tokens.length);
  check(tokens.length>0,"The score carries its tokens in canonical order",{tokens:tokens.length});
  const first=tokens[0]??{};
  let name=null;
  try{name=cardName(first.card_kernel_ref);}catch{name=null;}
  check(!!name,"A token's minor-id reference decodes to its named card",{card_kernel_ref:first.card_kernel_ref,card:name});
  check(typeof first.role==="string"&&first.role.length>0,"The token names its score role",{role:first.role});
  check(first.origin==="computed","The token's origin is computed",{origin:first.origin});
  const codons=Array.isArray(first.codons)?first.codons:[];
  check(codons.length>=1&&codons.every(codon=>Number.isInteger(codon)&&codon>=0&&codon<=63),"The token carries its codon membership",{codons});
  const pose=first.pose??{};
  check(Number.isInteger(pose.state_count)&&pose.state_count>0&&Number.isInteger(pose.active_state)
    &&pose.active_state>=0&&(pose.active_state<pose.state_count||pose.lawfully_admitted===false)
    &&typeof pose.lawfully_admitted==="boolean",
    "The token's pose discloses its lawful admission and state within the count",
    {active_state:pose.active_state,state_count:pose.state_count,lawfully_admitted:pose.lawfully_admitted});
  check(Number.isInteger(pose.phase_rotation_degrees)&&pose.phase_rotation_degrees>=0&&pose.phase_rotation_degrees<=360,
    "The token's pose carries the corrected all-axis phase rotation the view reads",{phase_rotation_degrees:pose.phase_rotation_degrees});
  check(resolved.score?.clock&&Number(resolved.score.clock.steps)===clockSteps,
    "The reading discloses the field's own clock basis",{steps:resolved.score?.clock?.steps,degree720:resolved.score?.clock?.degree720});
  await shot("relay-score-resolved");

  // -- score-state: the held reading, current, never re-derived; reads do not advance the field.
  const generationBefore=receipt.field.generation;
  const state=await exchange(opened.lease,receipt,{operation:"score-state"});
  check(state.status==="ok"&&state.score?.schema==="ql.tarot-score/v1","score-state answers the held reading through the same relay",{status:state.status});
  check(state.current===true&&state.resolved_event_ref===receipt.field.event_ref,"The held score answers as current for this field event",{current:state.current});
  check(state.score?.basis_revision===resolved.score?.basis_revision,"The held score keeps its basis revision: no re-derivation",{basis_revision:String(state.score?.basis_revision??"").slice(0,24)});
  check(state.field?.generation===generationBefore,"The score reads never advance the native field",{generation:state.field?.generation,before:generationBefore});

  // -- the refusal: a basis with no identity and no occasion sky refuses by name, changing nothing.
  const refusal=await exchange(opened.lease,receipt,{operation:"score-resolve",basis:{...basisOf(receipt,null,clockSteps),primary_anchor:{kind:"natal",planet_id:0}}});
  check(refusal.status==="refused"&&/no anchor basis/i.test(String(refusal.error)),"The score owner refuses the anchorless basis by name",{refusal:String(refusal.error??"").slice(0,160)});
  check(refusal.field?.generation===generationBefore&&Array.isArray(refusal.field?.audio)&&refusal.field.audio.length===0,
    "The refusal leaves the field exactly where it was",{generation:refusal.field?.generation});
  await op({op:"native_expression",request:{operation:"close",lease:opened.lease}});
  await shot("relay-refusal-named");

  // -- the saved occasion: a scene composed again on the first scene's own snapshot stands on that sky and reads the same score.
  const reopened=await op({op:"native_expression",request:{operation:"compose",request:{texture:[256,256],units_per_metre:400,sky_snapshot:sky}}});
  check(reopened.schema==="oi.native-expression-open/v1"&&reopened.source?.sky?.snapshot_ref===sky?.snapshot_ref,
    "A scene composed on the saved snapshot stands on that same sky, not a fresh one",{snapshot_ref:String(reopened.source?.sky?.snapshot_ref??"").slice(0,24)});
  receipt=reopened.receipt;arm(receipt);
  const reinspect=await exchange(reopened.lease,receipt,{operation:"inspect"});
  check(skyOf(reinspect)?.snapshot_ref===sky?.snapshot_ref,"The reopened scene's event carries the saved sky",{snapshot_ref:String(skyOf(reinspect)?.snapshot_ref??"").slice(0,24)});
  const again=await exchange(reopened.lease,receipt,{operation:"score-resolve",basis:basisOf(receipt,skyOf(reinspect),clockSteps)});
  const names=reply=>(reply.score?.tokens??[]).map(token=>`${token.role}:${cardName(token.card_kernel_ref)}`);
  check(again.status==="ok"&&JSON.stringify(names(again))===JSON.stringify(names(resolved)),
    "On the saved sky the same anchors deal the same cards in the same roles",{before:names(resolved).slice(0,4),after:names(again).slice(0,4)});
  await op({op:"native_expression",request:{operation:"close",lease:reopened.lease}});
}
