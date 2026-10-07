/** tarot-score-relay — the QL-MEF #312 §10 passage at the relay level.
 *
 * The smaller honest vertical behind the full shell walk: the REAL kernel
 * through the walk bridge's POST /op seam (the same KernelOp seam the Tauri
 * host fronts), spawning the INSTALLED ql + ql-field-host + ql-field-worker +
 * ql-sky. The bridge composes a sky-bearing scene, the exchange relay admits
 * the score operations by exact name, and the installed field host answers:
 * the deterministic `ql.tarot-score/v1` resolve (named cards, codons, pose
 * admission, clock basis, currentness), the held `score-state` (same basis,
 * never a re-derivation), and the named "no anchor basis" refusal for a scene
 * without a sky. Reads never advance the field; the refusal changes nothing.
 */
const SUITS=["Cups","Wands","Pentacles","Swords"],PIPS=["Ace","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Princess","Prince","Queen","King"];
const cardName=ref=>{
  const match=/#minor:([0-9]+)$/.exec(String(ref));
  if(!match)throw new Error(`a score token carries no minor card reference: ${ref}`);
  const id=Number(match[1]);
  if(!Number.isInteger(id)||id<0||id>=56)throw new Error(`minor id ${id} is outside the 56-card minor deck`);
  return `${PIPS[id%14]} of ${SUITS[Math.floor(id/14)]}`;
};

export default async function run({page,baseUrl,bridgeUrl,check,shot,metric}){
  await page.goto(baseUrl);
  await channel();
  const op=async body=>{
    const response=await fetch(`${bridgeUrl}/op`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json();
    if(result.error)throw new Error(result.error);
    if(!result.outcome)throw new Error(`the kernel returned no outcome: ${JSON.stringify(result).slice(0,200)}`);
    return result.outcome.data;
  };
  let seq=0;
  const exchange=(lease,receipt,command)=>op({op:"native_expression",request:{operation:"exchange",lease,request:{
    schema:"ql.field-host-request/v1",instance_ref:receipt.instance_ref,event_ref:receipt.field.event_ref,
    subject_ref:receipt.field.subject_ref,request_id:String(++seq),expected_generation:receipt.field.generation,
    expected_samples_elapsed:receipt.field.samples_elapsed,command}}});
  const arm=receipt=>{seq=Number(receipt.last_request_id??"0");};

  // -- the sky-bearing scene: the installed pair composes it.
  const opened=await op({op:"native_expression",request:{operation:"compose",request:{texture:[256,256],units_per_metre:400,sky:"now"}}});
  check(opened.schema==="oi.native-expression-open/v1"&&typeof opened.lease==="string",
    "The kernel composes a sky-bearing scene on the installed pair and admits its lease",{schema:opened.schema});
  let receipt=opened.receipt;
  arm(receipt);
  check(receipt?.field?.sample_rate>0&&receipt?.status==="ready","The open receipt carries the native field at its device rate",{sample_rate:receipt?.field?.sample_rate,status:receipt?.status});
  await shot("relay-scene-composed");

  // -- the event's own sky receipt: the score's anchor basis.
  const inspect=await exchange(opened.lease,receipt,{operation:"inspect"});
  const input=inspect.sources?.current?.input;
  const sky=(Array.isArray(input?.source_receipts)?input.source_receipts:[]).find(entry=>entry?.schema==="ql.sky-snapshot/v1")??null;
  check(!!sky,"The scene event carries an admitted ql.sky-snapshot/v1 in its source receipts",{snapshot_ref:String(sky?.snapshot_ref??"").slice(0,24)});
  const clockSteps=Number(inspect.sources?.current?.m3?.clock?.steps);
  check(Number.isSafeInteger(clockSteps)&&clockSteps>=0,
    "The field's own M3 clock discloses its steps for the score basis",{steps:inspect.sources?.current?.m3?.clock?.steps});
  const basis={subject_ref:receipt.field.subject_ref,locus_ref:receipt.field.event_ref,identity:null,
    occasion_sky:sky,clock_steps:clockSteps,
    primary_anchor:{kind:"kairos",body_index:0},drawn:[],boundary_passage:null,manifestation:null};
  const resolved=await exchange(opened.lease,receipt,{operation:"score-resolve",basis});
  check(resolved.status==="ok"&&resolved.score?.schema==="ql.tarot-score/v1",
    "The exchange relay admits score-resolve by name and the field host answers the reading",{standing:resolved.standing});
  check(resolved.current===true&&resolved.resolved_event_ref===receipt.field.event_ref,
    "The resolved reading answers current for the field's own event",{current:resolved.current,resolved_event_ref:resolved.resolved_event_ref});
  const tokens=Array.isArray(resolved.score?.tokens)?resolved.score.tokens:[];
  metric("relay_tokens",tokens.length);
  check(tokens.length>0,"The score carries its tokens in canonical order",{tokens:tokens.length});
  const first=tokens[0]??{};
  let name=null;
  try{name=cardName(first.card_kernel_ref);}catch(error){name=null;}
  check(!!name,"A token's minor-id reference decodes to its named card",{card_kernel_ref:first.card_kernel_ref,card:name});
  check(typeof first.role==="string"&&first.role.length>0,"The token names its score role",{role:first.role});
  check(first.origin==="computed","The token's origin is computed",{origin:first.origin});
  const codons=Array.isArray(first.codons)?first.codons:[];
  check(codons.length>=1&&codons.every(codon=>Number.isInteger(codon)&&codon>=0&&codon<=63),
    "The token carries its codon membership",{codons});
  const pose=first.pose??{};
  check(Number.isInteger(pose.state_count)&&pose.state_count>0&&Number.isInteger(pose.active_state)
    &&pose.active_state>=0&&(pose.active_state<pose.state_count||pose.lawfully_admitted===false)
    &&typeof pose.lawfully_admitted==="boolean",
    "The token's pose discloses its lawful admission and state within the count",
    {active_state:pose.active_state,state_count:pose.state_count,lawfully_admitted:pose.lawfully_admitted});
  check(resolved.score?.clock&&Number(resolved.score.clock.degree720)>=0,
    "The reading discloses the field's own clock basis",{degree720:resolved.score?.clock?.degree720,steps:resolved.score?.clock?.steps});
  await shot("relay-score-resolved");

  // -- score-state: the held reading, current, never re-derived; reads do not
  // advance the field.
  const generationBefore=receipt.field.generation;
  const state=await exchange(opened.lease,receipt,{operation:"score-state"});
  check(state.status==="ok"&&state.score?.schema==="ql.tarot-score/v1",
    "score-state answers the held reading through the same relay",{standing:state.standing});
  check(state.current===true&&state.resolved_event_ref===receipt.field.event_ref,
    "The held score answers as current for this field event",{current:state.current});
  check(state.score?.basis_revision===resolved.score?.basis_revision,
    "The held score keeps its basis revision — no re-derivation",{basis_revision:String(state.score?.basis_revision??"").slice(0,24)});
  check(state.field?.generation===generationBefore,
    "The score reads never advance the native field",{generation:state.field?.generation,before:generationBefore});

  // -- the refusal: an anchorless BASIS — no identity, no occasion sky —
  // refuses BY NAME, changing nothing. The score basis, not the opening,
  // is what the owner admits or refuses.
  await op({op:"native_expression",request:{operation:"close",lease:opened.lease}});
  const defaultOpened=await op({op:"native_expression",request:{operation:"compose",request:{texture:[256,256],units_per_metre:400,sky:"none"}}});
  check(defaultOpened.schema==="oi.native-expression-open/v1","The default-event scene composes without a dated sky",{schema:defaultOpened.schema});
  receipt=defaultOpened.receipt;
  arm(receipt);
  const defaultInspect=await exchange(defaultOpened.lease,receipt,{operation:"inspect"});
  const defaultInput=defaultInspect.sources?.current?.input;
  const defaultSky=(Array.isArray(defaultInput?.source_receipts)?defaultInput.source_receipts:[]).find(entry=>entry?.schema==="ql.sky-snapshot/v1")??null;
  // The default event still carries its OWN world sky (the k2 default
  // event's observations); the anchorless refusal is driven by the score
  // BASIS — no identity and no occasion sky — not by the opening.
  check(!!defaultSky,"The default event discloses its own world sky in its source receipts",{snapshot_ref:String(defaultSky?.snapshot_ref??"").slice(0,24)});
  const refusal=await exchange(defaultOpened.lease,receipt,{operation:"score-resolve",basis:{
    subject_ref:receipt.field.subject_ref,locus_ref:receipt.field.event_ref,identity:null,
    occasion_sky:null,clock_steps:0,primary_anchor:{kind:"natal",planet_id:0},drawn:[],boundary_passage:null,manifestation:null}});
  check(refusal.status==="refused"&&/no anchor basis/i.test(String(refusal.error)),
    "The score owner refuses the anchorless basis by name",{refusal:String(refusal.error??"").slice(0,160)});
  check(refusal.field?.generation===receipt.field.generation&&Array.isArray(refusal.field?.audio)&&refusal.field.audio.length===0,
    "The refusal leaves the field exactly where it was",{generation:refusal.field?.generation});
  await op({op:"native_expression",request:{operation:"close",lease:defaultOpened.lease}});
  await shot("relay-refusal-named");

  async function channel(){
    await page.evaluate(async()=>{
      const deadline=Date.now()+10000;
      while(!globalThis.__cradle?.walk&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
      return !!globalThis.__cradle?.walk;
    });
  }
}
