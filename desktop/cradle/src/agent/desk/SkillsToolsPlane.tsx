import {useEffect,useRef,useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import type {ProfileDocumentWire,ProfileUsePlanWire} from "../../kernel/types";
import {Glyph} from "../../workspace/Glyph";
import {useEncounterSession} from "../../encounter/session";
import {useDeskState,type DeskPlaneProps} from "./deskTypes";
import "./desk.css";

export interface SkillsToolsDeskState { switch:"current"|"carried" }
const INIT:SkillsToolsDeskState={switch:"current"};

/** The effective repertoire. Bound to the real owner operations the
 * configuration plane already exposes (kernel/types.ts `profile_list`,
 * `profile_use_plan` — the same engine `oi config` / `oi profile` drive,
 * src/configuration/liveSource.ts). Four groups stay visibly separate —
 * Selected, Projected/brokered, Observed effective, Unknown/pending reload —
 * each rendered only where an owner reading actually discloses it. */
export function SkillsToolsPlane({subject: _subject,accompanying,onMessage}:DeskPlaneProps) {
 const kernel=useKernel();
 const session=useEncounterSession(accompanying?{project:accompanying.project,ref:accompanying.ref,space:accompanying.space}:undefined);
 const [held,setHeld]=useDeskState<SkillsToolsDeskState>("skills-tools",accompanying?.ref,INIT);
 const [listing,setListing]=useState<{active:string|null;profiles:ProfileDocumentWire[];degraded?:{profile_ref:string;reason:string}[]}>();
 const [refusal,setRefusal]=useState<string>();
 const [plan,setPlan]=useState<ProfileUsePlanWire>();
 const [planPending,setPlanPending]=useState(false);
 const [planRefusal,setPlanRefusal]=useState<string>();

 const listed=useRef(false);
 useEffect(()=>{
  if(listed.current)return;
  listed.current=true;
  let live=true;
  kernel.apply({op:"profile_list"}).then(outcome=>{
   if(!live)return;
   if(outcome?.result==="profile_listing")setListing({active:outcome.active_profile_ref,profiles:outcome.profiles,degraded:outcome.degraded});
   else setRefusal("The profile store returned no listing.");
  }).catch(error=>{if(live)setRefusal(String(error));});
  return ()=>{live=false;};
 },[kernel]);

 const activeProfile=listing?.profiles.find(profile=>profile.profile_ref===listing.active);
 const previewProjection=async()=>{
  if(!listing?.active)return;
  setPlanPending(true);setPlanRefusal(undefined);
  try{
   const outcome=await kernel.apply({op:"profile_use_plan",profile_ref:listing.active});
   if(outcome?.result==="profile_use_planning")setPlan(outcome.plan);
   else setPlanRefusal("The owner returned no use plan for this profile.");
  }catch(error){setPlanRefusal(String(error));}
  finally{setPlanPending(false);}
 };

 // "What carried this act": receiving-only. The session's own task reading
 // (encounter/client.ts EncounterTaskReading) carries no profile or skill-set
 // field at all — so this mode is honestly unavailable, never inferred.
 const carried=session?.state.task;

 if(!accompanying)return <div className="desk-plane" data-plane="Skills & tools"><p className="oi-empty" data-state="no-accompanying">No accompanying session. Choose a conversation in the panel head to read its work here.</p></div>;

 return <div className="desk-plane" data-plane="Skills & tools">
  <div className="oi-scroll">
   <div className="oi-segment" role="group" aria-label="Current setup or what carried this act">
    <button aria-pressed={held.switch==="current"} onClick={()=>setHeld({switch:"current"})}>Current setup</button>
    <button aria-pressed={held.switch==="carried"} onClick={()=>setHeld({switch:"carried"})}>What carried this act</button>
   </div>

   {held.switch==="carried"
    ? <div className="desk-skills-group oi-section">
       <p className="oi-note" data-fact="carried-repertoire-absent">No owner reading discloses which profile or skill set carried this act. The session's task basis ({carried?carried.request?.central?.task_ref:"none bound"}) names a purpose and source refs, never a repertoire — Factory issue 222 is the named producer this waits on.</p>
      </div>
    : <>
    {refusal&&<p className="oi-refusal" role="alert">{refusal}</p>}
    {!listing&&!refusal&&<p className="oi-note" role="status">Reading the profile store…</p>}

    <section className="desk-skills-group oi-section" aria-label="Selected">
     <header className="oi-panel-head"><h3 className="oi-panel-head-title">Selected</h3><span className="oi-state">profile / source selection</span></header>
     {listing&&(activeProfile
      ? <>
         <dl className="oi-kv">
          <dt>Profile</dt><dd className="oi-ref">{activeProfile.profile_ref}</dd>
          <dt>Title</dt><dd>{activeProfile.title??"Untitled"}</dd>
         </dl>
         <p className="oi-eyebrow">Native profiles</p>
         <ul className="agent-context-items">{activeProfile.native_profiles.map(native=><li key={native.native_profile_ref} className="oi-row"><Glyph name="agent" size={12}/><span className="oi-row-title">{native.owner_ref}</span><code className="oi-ref">{native.native_profile_ref}</code></li>)}</ul>
         <p className="oi-eyebrow">Desired settings ({activeProfile.desired.length})</p>
         <ul className="agent-context-items">{activeProfile.desired.map(entry=><li key={entry.setting_ref} className="oi-row"><span className="oi-row-title oi-ref">{entry.setting_ref}</span><span className="oi-row-meta">{entry.scope.scope_kind}</span></li>)}</ul>
        </>
      : <p className="oi-note" data-state="no-active-profile">No profile is marked active in the owner's profile store.</p>)}
     {listing?.degraded?.length?<p className="oi-refusal" role="alert">Degraded: {listing.degraded.map(entry=>`${entry.profile_ref} — ${entry.reason}`).join("; ")}</p>:null}
    </section>

    <section className="desk-skills-group oi-section" aria-label="Projected or brokered">
     <header className="oi-panel-head"><h3 className="oi-panel-head-title">Projected / brokered</h3>
      {listing?.active&&<button className="oi-action" disabled={planPending} onClick={previewProjection}>{planPending?"Reading…":"Preview projection"}</button>}
     </header>
     {!plan&&!planRefusal&&<p className="oi-note" data-state="not-disclosed">Not disclosed by any owner operation yet — use Preview projection to read the active profile's use plan.</p>}
     {planRefusal&&<p className="oi-refusal" role="alert">{planRefusal}</p>}
     {plan&&<ul className="agent-context-items">{plan.entries.map(entry=><li key={entry.setting_ref} className="oi-row"><span className="oi-row-title oi-ref">{entry.setting_ref}</span><span className="oi-row-meta">{entry.scope.scope_kind}</span></li>)}
      {!plan.entries.length&&<li className="oi-note">The plan carries no entries.</li>}</ul>}
    </section>

    <section className="desk-skills-group oi-section" aria-label="Observed effective">
     <header className="oi-panel-head"><h3 className="oi-panel-head-title">Observed effective</h3></header>
     <p className="oi-note" data-state="not-disclosed">Not disclosed by any owner operation yet.</p>
    </section>

    <section className="desk-skills-group oi-section" aria-label="Unknown or pending reload">
     <header className="oi-panel-head"><h3 className="oi-panel-head-title">Unknown / pending reload</h3></header>
     <p className="oi-note" data-state="not-disclosed">Not disclosed by any owner operation yet.</p>
    </section>
    </>}
  </div>
  <div className="desk-skills-footer">
   <button className="oi-action" onClick={()=>{
    if(!accompanying?.project){onMessage?.("No project is bound to this session, so future setup cannot be opened.");return;}
    window.dispatchEvent(new CustomEvent("oi:open-agency",{detail:{project:accompanying.project}}));
   }}>Manage future setup…</button>
  </div>
 </div>;
}
