/**
 * The optional Shared Stage of one SharedField (SHARED-FIELD-DESKTOP §13):
 * the synchronised presentation locus participants deliberately opt into.
 * This panel is the minimal desktop adapter over the owner client's
 * `oi.shared-field.stage-reading/v1`: it shows the open stage, live presence
 * and the caller's own follow relation, and offers exactly the stage acts —
 * open over an admitted subject, follow/unfollow the presenter, advance an
 * admitted shared focus, close. Following is explicit and unfollowing keeps
 * the field relation; nothing local (tabs, camera, drafts, Search history,
 * Agent context, renderer buffers) is ever placed on the stage, because the
 * owner contract has no field that could carry it.
 */
import {useCallback,useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {isUnavailable,sharedField,slug,type HostedAuthority,type HostedEntry,type SharedFieldStageFollowResult,type SharedFieldStageReading,type SharedFieldStageResult,type SharedFieldUnavailable} from "../knowledge/shared-field";
// @ts-ignore -- the owner's Shared Stage contract composes and checks every revision.
import {advanceSharedStage,closeSharedStage,createSharedStage} from "../../../../shared-field/shared-stage.mjs";

export function SharedStagePanel({field_ref,entries,authority}:{field_ref:string;entries:HostedEntry[];authority:HostedAuthority[]}) {
  const {transport}=useKernel();
  const [reading,setReading]=useState<SharedFieldStageReading|SharedFieldUnavailable>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string>();
  const [focus,setFocus]=useState("");
  const mine=authority.find(a=>a.field_ref===field_ref&&!a.revoked&&a.participant_ref);
  const contributor=authority.some(a=>a.field_ref===field_ref&&!a.revoked&&a.role==="contributor");
  const reading_=reading&&!isUnavailable(reading)?reading:undefined;
  const stage=reading_?.stage??undefined;
  const following=reading_?.my_follow?.following===true;
  const presence=reading_?.presence??[];
  const focusRef=(stage?.contract as {focus_ref?:string}|null)?.focus_ref;

  const readStage=useCallback(()=>{
    let active=true;setBusy(true);
    void sharedField<SharedFieldStageReading>(transport,{kind:"stage",field_ref}).then(r=>{if(active)setReading(r);}).catch(e=>{if(active)setReading({state:"unavailable",owner_operation:"shared-field.stage",detail:String(e instanceof Error?e.message:e)});}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[transport,field_ref]);
  useEffect(()=>readStage(),[readStage]);

  const act=async(run:()=>Promise<unknown>)=>{
    setBusy(true);setError(undefined);
    try{await run();readStage();}catch(e){setError(String(e instanceof Error?e.message:e));}
    finally{setBusy(false);}
  };
  const toggleFollow=()=>mine&&stage&&void act(async()=>{const result=await sharedField<SharedFieldStageFollowResult>(transport,{kind:following?"stage-unfollow":"stage-follow",field_ref,stage_ref:stage.stage_ref,follower_participant_ref:mine.participant_ref});return result;});
  const setSharedFocus=()=>stage&&mine&&void act(async()=>{
    const next=advanceSharedStage(stage.contract,{focus_ref:focus.trim()},{expected_revision:stage.revision,presenter_ref:mine.participant_ref});
    const result=await sharedField<SharedFieldStageResult>(transport,{kind:"stage-advance",stage:next,expected_revision:stage.revision});
    setFocus("");
    return result;
  });
  const openStage=()=>stage||!mine||!entries.length?undefined:void act(async()=>{
    const entry=entries[0];
    const contract=createSharedStage({shared_stage_ref:`stage:${slug(field_ref)}`,field_ref,presenter_ref:mine.participant_ref,subject_ref:entry.ref,provenance:[{kind:"authored",ref:mine.participant_ref,source_system:"o-i",revision:entry.revision??""}]});
    return await sharedField<SharedFieldStageResult>(transport,{kind:"stage-open",stage:contract});
  });
  const closeStage=()=>stage&&void act(async()=>{
    const next=closeSharedStage(stage.contract,{expected_revision:stage.revision});
    return await sharedField<SharedFieldStageResult>(transport,{kind:"stage-close",stage:next,expected_revision:stage.revision});
  });

  return <section className="world-region" data-region-role="shared-stage" data-stage-state={stage?"open":"none"} data-following={following||undefined}>
    <div className="world-region__label">Shared Stage {stage?`· revision ${stage.revision}`:"· none"}</div>
    <div className="world-region__components">
      {error&&<p role="alert">{error}</p>}
      {stage?<>
        <p className="explore-muted">Presented by <strong>{stage.presenter_ref??"—"}</strong> · subject <code>{stage.subject_ref}</code>{focusRef?<> · focus <code>{focusRef}</code></>:null} · {presence.length} present{presence.length?`: ${presence.map(p=>p.participant_ref).join(", ")}`:""}</p>
        <div className="world-component__collection">
          {mine&&<button type="button" disabled={busy} aria-pressed={following} onClick={toggleFollow} title={following?"Unfollow and keep your own local view — you stay in the field":"Follow the presenter's shared locus explicitly"}>{following?"Unfollow":"Follow"}</button>}
          {contributor&&<form className="explore-stage-focus" onSubmit={e=>{e.preventDefault();setSharedFocus();}}><input aria-label="Admitted shared focus" placeholder="shared focus — a Being or Thing ref" value={focus} onChange={e=>setFocus(e.target.value)}/><button type="submit" disabled={busy||!focus.trim()}>Set focus</button></form>}
          <button type="button" disabled={busy} onClick={closeStage} title="Close the stage: it leaves every view, follows end, the field remains">Close stage</button>
        </div>
      </>:<p className="explore-muted">{contributor&&entries.length&&mine?<>No stage is open in this field. <button type="button" disabled={busy} onClick={openStage}>Open a stage over {entries[0].label}</button></>:"No stage is open in this field."}</p>}
    </div>
  </section>;
}
