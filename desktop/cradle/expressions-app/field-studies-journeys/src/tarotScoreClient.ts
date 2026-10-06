/** The Tarot score client: the selected subject's deterministic
 * `ql.tarot-score/v1` reading, resolved through the live field's own exchange
 * transport (`ql.field-host-request/v1`, the same envelope and request_id/cursor
 * discipline the existing `read`/`inspect`/`influence` exchanges ride). This
 * module computes no symbolic arithmetic of its own: the minor-id decode below
 * is presentation of the authoritative id, and every card, pose, codon and
 * clock fact displayed comes from the native reply. Pure module — importable
 * by Node tests and the instrument alike. */

/** Where a score request's facts come from: the live field's own basis
 * disclosure (`oi.field-score-basis/v1`, the controller's `scoreBasis`) and
 * the one serial owner's exchange path (the controller's `score`). */
export interface TarotScoreTransport {
 fieldBasis():FieldScoreBasis|null;
 fieldScore(command:unknown):Promise<FieldScoreReply>;
}
/** `oi.field-score-basis/v1` — the field's own subject and event, the M3
 * clock position of the last complete read, and the admitted
 * `ql.sky-snapshot/v1` the scene event carries (null when none). */
export interface FieldScoreBasis {
 schema:'oi.field-score-basis/v1';subject_ref:string;event_ref:string;
 clock_steps:number;occasion_sky:unknown|null;
}
/** The score reply, as the field host answers: an admitted read carries the
 * `ql.tarot-score/v1` score with its currentness; a refusal is the score
 * owner's own named basis admission, never a generic error. */
export type FieldScoreReply =
 {refused:true;error:string}|
 {refused:false;score:TarotScoreReading;current:boolean;resolved_event_ref:string};
export interface TarotScoreReading {
 schema:'ql.tarot-score/v1';subject_ref:string;locus_ref:string;basis_revision:string;
 score_revision:number;clock:TarotScoreClock;tokens:unknown[];boundary_functions:unknown;
 primary_token_role:string|null;manifestation_ref:string|null;[key:string]:unknown;
}
export interface TarotScoreClock {
 degree360:number;degree720:number;layer:unknown;tick12:number;steps:number;
 completed_double_covers:number;[key:string]:unknown;
}

/** The `score-resolve` command over an admitted basis: exactly the fields the
 * score basis contract declares (unknown fields are refused by the owner).
 * The basis names the field's own subject (a foreign subject is refused by
 * name), its locus is the field's own event, the sky is the scene's admitted
 * snapshot when it carries one, and the clock steps are the field read's own
 * M3 clock position. With no sky and no identity the owner refuses by name —
 * the honest empty-anchor state, not a failure to hide. */
export function scoreResolveCommand(basis:FieldScoreBasis):unknown{
 if(basis?.schema!=='oi.field-score-basis/v1'||typeof basis.subject_ref!=='string'||!basis.subject_ref
  ||typeof basis.event_ref!=='string'||!basis.event_ref
  ||typeof basis.clock_steps!=='number'||!Number.isSafeInteger(basis.clock_steps)||basis.clock_steps<0)
  throw new Error('the live field has not disclosed a complete score basis');
 return {operation:'score-resolve',basis:{
  subject_ref:basis.subject_ref,locus_ref:basis.event_ref,identity:null,
  occasion_sky:basis.occasion_sky,clock_steps:basis.clock_steps,
  primary_anchor:basis.occasion_sky?{kind:'kairos',body_index:0}:{kind:'natal',planet_id:0},
  drawn:[],boundary_passage:null,manifestation:null}};
}
/** The named refusal, as the score owner stated it — or null when the reply
 * admitted. The UI renders this reason verbatim: a refusal is the owner's own
 * named basis admission ("no anchor basis…", a foreign subject), never a
 * generic error. */
export function refusalReason(reply:FieldScoreReply):string|null{
 return reply?.refused===true?String(reply.error):null;
}

/** The `score-state`: the held score and its currentness — never a re-derivation. */
export const SCORE_STATE_COMMAND={operation:'score-state'} as const;

/** The score client over the field transport: resolve and state read the one
 * owner; each call returns the named reply (data or the owner's refusal). */
export function createTarotScoreClient(transport:TarotScoreTransport){
 return {
  resolve:async():Promise<FieldScoreReply>=>{
   const basis=transport.fieldBasis();
   if(!basis)throw new Error('Open the live instrument first: the Tarot score belongs to a scene owner');
   return transport.fieldScore(scoreResolveCommand(basis));
  },
  state:async():Promise<FieldScoreReply>=>{
   const basis=transport.fieldBasis();
   if(!basis)throw new Error('Open the live instrument first: the Tarot score belongs to a scene owner');
   return transport.fieldScore(SCORE_STATE_COMMAND);
  },
 };
}

/** The native minor-id decode, presentation only. `suit = floor(id/14)`
 * (0 Cups/A/Water, 1 Wands/T/Fire, 2 Pentacles/C/Earth, 3 Swords/G/Air),
 * `pip = id%14` (0 Ace, 1–10 number, 10 Princess/Page, 11 Prince/Knight,
 * 12 Queen, 13 King). The id itself is the authoritative identity — these
 * names present it; they are not a second symbol table. */
export const MINOR_SUITS=[
 {name:'Cups',element:'Water',nucleotide:'A'},
 {name:'Wands',element:'Fire',nucleotide:'T'},
 {name:'Pentacles',element:'Earth',nucleotide:'C'},
 {name:'Swords',element:'Air',nucleotide:'G'},
] as const;
export const MINOR_PIPS=['Ace','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Princess','Prince','Queen','King'] as const;
export interface MinorCardName{
 id:number;suit:string;element:string;nucleotide:string;pipIndex:number;pip:string;
 court:boolean;alias:string|null;name:string;
}
export function decodeMinorId(id:number):MinorCardName{
 if(!Number.isInteger(id)||id<0||id>=56)throw new Error(`minor id ${String(id)} is outside the 56-card minor deck`);
 const suit=MINOR_SUITS[Math.floor(id/14)],pipIndex=id%14,pip=MINOR_PIPS[pipIndex];
 return {id,suit:suit.name,element:suit.element,nucleotide:suit.nucleotide,pipIndex,pip,
  court:pipIndex>=10,alias:pipIndex===10?'Page':pipIndex===11?'Knight':null,
  name:`${pip} of ${suit.name}`};
}

/** Distinct visible labels for the four declared token origins (the wire's
 * kebab-case origin values). */
const ORIGIN_LABELS={computed:'Computed',drawn:'Drawn','authored-assignment':'Authored assignment',interpretation:'Interpreted'} as const;
export function originLabel(origin:unknown):string{
 const key=String(origin);
 return ORIGIN_LABELS[key as keyof typeof ORIGIN_LABELS]??key;
}

/** The presentational reading of one score token: the card its exact-cover
 * reference names, both codons of a dual court, the role, origin, pose
 * admission, four-charge raw values, hexagram address and the inscription's
 * decan/pip references. Repeated archetypes arrive as separate tokens and are
 * rendered separately. */
export interface TokenPresentation {
 tokenRef:string;role:string;origin:string;originLabel:string;originRef:string|null;
 cardRef:string;cardId:number;cardName:string;suit:string;element:string;court:boolean;
 codons:number[];dualCourt:boolean;hexagramAddress:number;
 fourChargeRaw:[number,number,number,number];fourChargeNormalised:[number,number,number,number];
 pose:{torusTick12:number;elementRingPosition:number;matrixFamily:string;activeState:number;
  stateCount:number;lawfullyAdmitted:boolean;collapsedNonDual:boolean;phaseClockSteps:number;
  phaseArgumentDegrees:number};
 anchorKind:string;anchorBody:string;anchorLongitude:number|null;
 inscription:{decanRef:string|null;decanName:string|null;pipCardRef:string|null;reflectionRef:string|null};
}
export function decodeToken(token:unknown):TokenPresentation{
 const t=token as Record<string,any>;
 if(!t||typeof t!=='object')throw new Error('a score token must be an object');
 const ref=String(t.card_kernel_ref??''),match=/#minor:([0-9]+)$/.exec(ref);
 if(!match)throw new Error(`token ${String(t.token_ref??'')} carries no minor card reference`);
 const card=decodeMinorId(Number(match[1]));
 const codons=(Array.isArray(t.codons)?t.codons:[]).map(c=>{const n=Number(c);
  if(!Number.isInteger(n)||n<0||n>63)throw new Error(`token ${String(t.token_ref)} carries an invalid codon address`);return n;});
 if(!codons.length)throw new Error(`token ${String(t.token_ref)} carries no codon`);
 const pose=t.pose??{},charge=(values:unknown,length:number)=>{const v=Array.isArray(values)?values.map(Number):[];
  if(v.length!==length||v.some(n=>!Number.isFinite(n)))throw new Error(`token ${String(t.token_ref)} carries an invalid four-charge vector`);
  return v as number[];};
 const inscription=t.inscription??{};
 return {
  tokenRef:String(t.token_ref??''),role:String(t.role??''),origin:String(t.origin??''),
  originLabel:originLabel(t.origin),originRef:typeof t.origin_ref==='string'?t.origin_ref:null,
  cardRef:ref,cardId:card.id,cardName:card.name,suit:card.suit,element:card.element,court:card.court,
  codons,dualCourt:codons.length>1,hexagramAddress:codons[0],
  fourChargeRaw:charge(t.four_charge_raw,4) as [number,number,number,number],
  fourChargeNormalised:charge(t.four_charge_normalised,4) as [number,number,number,number],
  pose:{torusTick12:Number(pose.torus_tick12),elementRingPosition:Number(pose.element_ring_position),
   matrixFamily:String(pose.matrix_family??''),activeState:Number(pose.active_state),
   stateCount:Number(pose.state_count),lawfullyAdmitted:pose.lawfully_admitted===true,
   collapsedNonDual:pose.collapsed_non_dual===true,phaseClockSteps:Number(pose.phase_clock_steps),
   phaseArgumentDegrees:Number(pose.phase_argument_degrees)},
  anchorKind:String((t.anchor as any)?.kind??''),
  anchorBody:typeof (t.anchor as any)?.planet_id==='number'?String((t.anchor as any).planet_id)
   :typeof (t.anchor as any)?.body_index==='number'?String((t.anchor as any).body_index):'',
  anchorLongitude:Number.isFinite(Number((t.anchor as any)?.longitude_degrees))?Number((t.anchor as any).longitude_degrees):null,
  inscription:{decanRef:typeof inscription.decan_ref==='string'?inscription.decan_ref:null,
   decanName:typeof inscription.decan_name==='string'?inscription.decan_name:null,
   pipCardRef:typeof inscription.pip_card_ref==='string'?inscription.pip_card_ref:null,
   reflectionRef:typeof inscription.reflection_ref==='string'?inscription.reflection_ref:null},
 };
}
