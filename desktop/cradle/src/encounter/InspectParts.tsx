import type {EncounterReading,EncounterStatus} from "./client";
import {NowRelations} from "../receiving/NowRelations";
/**
 * The encounter's inspectable facts as small presentational parts. The tab's
 * own Inspect / Context planes (EncounterView) and the accompanying panel's
 * planes render these same parts, so one session reads the same everywhere and
 * the walk-pinned hooks (`.encounter-deliveries`, `.encounter-now-refs`,
 * `.encounter-actions`, `[data-fact]`, `[data-now-*]`) exist exactly once in
 * source. Rendering only: every value is the owner's.
 */

/** Identity and connection, as the owner discloses them. */
export function SessionFacts({reading,status,space}:{reading?:EncounterReading;status?:EncounterStatus;space?:string}) {
 return <dl className="encounter-session-facts">
  <dt>Encounter</dt><dd>{reading?.agent_session??"Unavailable"}</dd>
  <dt>Session space</dt><dd>{typeof space==="string"?space:"Not disclosed"}</dd>
  <dt>Native session</dt><dd>{status?.native_session_id??"Not resident — no native session identity"}</dd>
  <dt>Provider</dt><dd>{status?.provider?.label??"No provider identity supplied"}</dd>
  <dt>Connection</dt><dd>{status?.state??"Unavailable"}</dd>
  <dt>Permission authority</dt><dd>{reading?.permission_authority??"Not disclosed"}</dd>
 </dl>;
}

/** Delivery identities minted in this window with the owner's settled phases. */
export function DeliveryRegistrations({deliveries}:{deliveries?:{ref:string;phase:string}[]}) {
 return deliveries?.length
  ?<ul className="encounter-deliveries">{deliveries.map(d=><li key={d.ref}><code>{d.ref}</code><span>{d.phase}</span></li>)}</ul>
  :<p>No addressed delivery has been dispatched while this surface is open. Delivery identities are minted here, bound durably by the owner, and re-dispatched never — repeat sends return the owner&apos;s held receipt.</p>;
}

/** NOW records this session's own records name, each read through the owner. */
export function NowRecords({nowRefs,taskBasisWithoutNow}:{nowRefs?:{ref:string;register:string|null}[];taskBasisWithoutNow?:boolean}) {
 return nowRefs?.length
  ?<ul className="encounter-now-refs">{nowRefs.map(n=><li key={n.ref} data-now-ref={n.ref}><code>{n.ref}</code><span>{n.register?`${n.register} register`:"root register"}</span><NowRelations nowRef={n.ref} project={n.register}/></li>)}</ul>
  :taskBasisWithoutNow?<p data-now-task-uncertain="true">A task basis reached this surface, and the owner&apos;s record carries no allocated NOW yet — the session&apos;s preparation is uncertain. The allocation the owner has not published is not inferred from the ground.</p>
  :<p data-now-relations-empty="true">No NOW records reached this surface. A NOW appears here only when one of this surface&apos;s own records — an addressed dispatch receipt, a task basis — names it; nothing is inferred from transcripts or bindings.</p>;
}

/** Owner operations with the owner's own verdicts and reasons. */
export function OwnerActions({reading}:{reading?:EncounterReading}) {
 return reading?.actions?.length?<ul className="encounter-actions">{reading.actions.map(a=><li key={a.ref}><span>{a.ref}</span><span>{a.enabled?"Enabled":a.reason??"Disabled"}</span></li>)}</ul>:null;
}

export function RawDisclosure({reading,status}:{reading?:EncounterReading;status?:EncounterStatus}) {
 return <details><summary>Raw disclosure</summary><pre>{JSON.stringify({schema:reading?.schema,connection:status,actions:reading?.actions,permission_authority:reading?.permission_authority},null,2)}</pre></details>;
}

/** §4.1's three correlated facts, kept distinct: what is recorded, what the
 * participant is permitted to carry, and what the provider actually continues.
 * Equalising them is how transcripts become fake memory. */
export function ContextFacts({status}:{status?:EncounterStatus}) {
 return <dl className="encounter-context-facts">
  <dt>Recorded conversation history</dt>
  <dd>The transcript pages live in the Conversation plane — this plane is not a second copy of them.</dd>
  <dt>Participant&apos;s permitted operative context</dt>
  <dd data-fact="operative-context-absent">No owner operation on the bound cut inspects the participant&apos;s operative context — the desktop does not infer it from the transcript, a profile, or a binding.</dd>
  <dt>Provider&apos;s actual continuation state</dt>
  <dd data-fact="continuation">{status?.state??"Unavailable"}{status?.native_session_id?<> — native session <code>{status.native_session_id}</code></>:null}{status?.error?<>, carrying a fault</>:null}.</dd>
 </dl>;
}
