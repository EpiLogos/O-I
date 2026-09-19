/**
 * The body-state vocabulary the Nara surface renders (#336 option+gap).
 *
 * A pure derivation from the constituted `actuation.speech-constitution/v1`
 * document — never from a catalogue read, a provider name or any fact the
 * constitution does not carry. Three states, exactly as the documents
 * disclose them:
 *
 *   live    — the constituted body can hear and speak today (usable acoustic
 *             path): the capability chips render as usual and no body-state
 *             banner appears.
 *   option  — the constituted body declares toward speech but names why it is
 *             not plainly live (a credential it does not have bound, a
 *             degraded or unavailable surface, or a one-sided acoustic
 *             declaration): the body is shown as a visible OPTION with the
 *             gap named exactly as the constitution's `conditions` carry it
 *             (which condition, which read-model field), plus the credential
 *             ref/presence fact when carried.
 *   absent  — the constituted body declares no acoustic modality in either
 *             direction (the text-capable Nara): the surface names the gap
 *             and the honest path.
 *
 * Whether OTHER constitutable bodies exist is a separate seam the desktop
 * cannot lawfully see here: the surface consumes one resolved body's facts;
 * catalogue-wide option discovery needs the AIKit model catalogue and route
 * join, which no desktop read model carries today. That seam is named in
 * docs/contracts/NARA-SPEECH-EXPERIENCE-V1.md — a gap, not a fabrication.
 */

import {
  bodyUsable,speechCapable,textPathSupport,
  type SpeechConstitutionFacts,
} from "./constitution";

/** One named gap, verbatim from the constitution's `conditions` (or derived,
 * field-named, from the modality lists themselves). */
export interface NaraBodyGap {
  condition:"degraded"|"unavailable";
  reason:string;
  /** The read model's own which-seam name (`modality-credential`,
   * `modality-availability`) or the modality list a derived gap reads from. */
  field:string|null;
  /** The rendered line: condition, field when named, reason verbatim. */
  line:string;
}

/** The credential ref/presence fact (scalars in `provider_binding.facts`).
 * Presence, never material: a hint and a binding ref are refs, not secrets. */
export interface NaraCredentialFact {
  condition:"not-required"|"required"|"satisfied";
  hint:string|null;
  binding_ref:string|null;
  /** The rendered line, present only when the constitution carries the fact. */
  line:string|null;
}

export type NaraBodyState=
  |{state:"live";body_ref:string;provider_ref:string;line:string}
  |{state:"option";body_ref:string;provider_ref:string;usable:boolean;text_capable:boolean;
    gaps:NaraBodyGap[];credential:NaraCredentialFact;line:string}
  |{state:"absent";body_ref:string;provider_ref:string;text_capable:boolean;line:string};

const CREDENTIAL_CONDITIONS=["not-required","required","satisfied"] as const;

function acousticIn(c:SpeechConstitutionFacts):boolean {
  return c.input_modalities.some(m=>m==="audio"||m==="speech");
}
function acousticOut(c:SpeechConstitutionFacts):boolean {
  return c.output_modalities.some(m=>m==="audio"||m==="speech");
}

function credentialFactOf(c:SpeechConstitutionFacts):NaraCredentialFact {
  const facts=c.provider_binding.facts;
  const stated=facts["credential_condition"];
  const condition=typeof stated==="string"&&(CREDENTIAL_CONDITIONS as readonly string[]).includes(stated)
    ?stated as NaraCredentialFact["condition"]:null;
  if(condition==null){
    // No recognized condition fact: absence stays absent, never invented.
    return {condition:"not-required",hint:null,binding_ref:null,line:null};
  }
  const hint=typeof facts["credential_hint"]==="string"&&facts["credential_hint"].trim()?facts["credential_hint"]:null;
  const bindingRef=typeof facts["credential_binding_ref"]==="string"&&facts["credential_binding_ref"].trim()?facts["credential_binding_ref"]:null;
  const parts=[`credential condition ${condition}`];
  if(hint)parts.push(`${hint}`);
  if(bindingRef)parts.push(`bound at ${bindingRef}`);
  return {condition,hint,binding_ref:bindingRef,line:parts.join(" — ")};
}

function namedGaps(c:SpeechConstitutionFacts):NaraBodyGap[] {
  const gaps:NaraBodyGap[]=(c.conditions??[]).map(condition=>({
    condition:condition.condition,
    reason:condition.reason,
    field:typeof condition.field==="string"?condition.field:null,
    line:`${condition.condition}${typeof condition.field==="string"?` (${condition.field})`:""}: ${condition.reason}`,
  }));
  if(!gaps.length){
    // A one-sided acoustic declaration names its own gap from the modality
    // lists — the constitution's fields, not an invented catalogue.
    if(acousticIn(c)&&!acousticOut(c))gaps.push({condition:"unavailable",reason:"the constitution declares acoustic input but no acoustic output",field:"output_modalities",
      line:"unavailable (output_modalities): the constitution declares acoustic input but no acoustic output"});
    else if(!acousticIn(c)&&acousticOut(c))gaps.push({condition:"unavailable",reason:"the constitution declares acoustic output but no acoustic input",field:"input_modalities",
      line:"unavailable (input_modalities): the constitution declares acoustic output but no acoustic input"});
  }
  return gaps;
}

/** The body-state the surface renders, from disclosed facts only. */
export function naraBodyState(c:SpeechConstitutionFacts):NaraBodyState {
  const provider=c.provider_binding.provider_ref;
  // Live means plainly live: usable acoustic path AND no named condition —
  // a degraded body stays an option whose reduction is named beside it.
  if(speechCapable(c)&&!(c.conditions??[]).length)return {state:"live",body_ref:c.body_ref,provider_ref:provider,line:`speech body live: ${c.body_ref}`};
  const textCapable=textPathSupport(c).state==="supported";
  if(!(acousticIn(c)||acousticOut(c))&&bodyUsable(c)){
    return {state:"absent",body_ref:c.body_ref,provider_ref:provider,text_capable:textCapable,
      line:"speech body absent (text-capable Nara); a speech body may be constituted or swapped later without changing Nara"};
  }
  const usable=bodyUsable(c);
  return {state:"option",body_ref:c.body_ref,provider_ref:provider,usable,text_capable:textCapable,
    gaps:namedGaps(c),credential:credentialFactOf(c),
    line:`speech body present as an option (${usable?"usable with named reductions":"not usable today"}); when the named condition closes — or the body is swapped — Nara continues unchanged`};
}

/** Whether the speech affordance may present itself as live: hold-to-talk is
 * a speech act, so it requires the body to hear AND speak today. Gated,
 * degraded-to-unusable, one-sided and absent bodies never present it. */
export function holdToTalkLive(c:SpeechConstitutionFacts):boolean {
  return speechCapable(c);
}

/** Why the affordance is not live, in the surface's own words; null when it
 * may present itself. Single source for the button title and the refusal
 * notice, so the walk and the lifecycle assert what the surface says. */
export function holdToTalkRefusal(c:SpeechConstitutionFacts):string|null {
  if(holdToTalkLive(c))return null;
  if(!acousticIn(c))return "This body declares no usable acoustic input; text is the honest path";
  if(!bodyUsable(c))return "This body is recorded unavailable; text is the honest path";
  return "This body declares acoustic input but no acoustic output; text is the honest path";
}
