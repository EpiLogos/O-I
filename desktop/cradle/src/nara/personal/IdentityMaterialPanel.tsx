import {useEffect,useRef,useState} from 'react';
import type {NativeFileReading,CentralLocation} from '../../kernel/types';
import type {IdentityForm} from '../identityPresentation';
import {identityHosts,subscribeIdentityHosts,presentIdentity,endIdentity} from './identityHosts';
import {readEnvelope,type PersonalCall,type PersonalController,type PersonalRecord} from './client';
import {identityPattern,readIdentityMaterial,verifyIdentitySources,type NativeIdentityMaterial} from './identityMaterial';
interface Props {
  record:PersonalRecord;controller:PersonalController;call:PersonalCall;available:boolean;
  readSource:(location:CentralLocation)=>Promise<NativeFileReading>;
  run:(work:()=>Promise<void>)=>Promise<void>;onHost:(id:string)=>void;
}
/** A source review is not an assessment questionnaire. Native acceptance and
 * private presentation are two separate acts; neither invokes an Agent. */
export function IdentityMaterialPanel({record,controller,call,available,readSource,run,onHost}:Props){
  const [material,setMaterial]=useState<NativeIdentityMaterial|null>(null);
  const [hosts,setHosts]=useState(identityHosts()),[host,setHost]=useState('');
  const [form,setForm]=useState<IdentityForm>('cymatic'),[notice,setNotice]=useState('');
  const active=useRef(''),generation=useRef(0);
  useEffect(()=>subscribeIdentityHosts(()=>setHosts(identityHosts())),[]);
  useEffect(()=>()=>{++generation.current;if(active.current)void endIdentity(active.current).catch(()=>{});},[]);
  // A new source/occasion/current reception never silently updates a displayed
  // identity. End the old view; another deliberate review/presentation follows.
  useEffect(()=>{++generation.current;setNotice('');if(active.current){const previous=active.current;active.current='';void run(async()=>endIdentity(previous));}},[record.target.record_ref,record.revision]);
  const reviewed=material?.record_revision===record.revision&&material.target.record_ref===record.target.record_ref?material:null;
  async function reading(current:PersonalRecord):Promise<NativeIdentityMaterial>{
    await verifyIdentitySources(current,readSource);
    const reply=readEnvelope(await call({operation:'identity_material',target:current.target,expected_revision:current.revision,consent:controller.consent}));
    if(reply.source_mutated!==false)throw new Error('The native identity reading did not retain its read-only contract');
    return readIdentityMaterial(reply.material,current);
  }
  const preview=()=>void run(async()=>{
    const token=++generation.current,current=await controller.read(record.target),next=await reading(current);
    if(token!==generation.current)throw new Error('The personal presentation changed during review');
    setMaterial(next);setNotice('Native identity material read. No acceptance, source edit or model request occurred.');
  });
  const accept=()=>void run(async()=>{
    if(!reviewed||reviewed.sealed)throw new Error('Review an unaccepted current identity basis first');
    const token=++generation.current,current=await controller.read(record.target),fresh=await reading(current);
    if(fresh.record_revision!==reviewed.record_revision||fresh.value!==reviewed.value||token!==generation.current)throw new Error('Identity basis changed after review; nothing was accepted');
    const accepted=await controller.apply({kind:'identity_seal',expected_value:reviewed.value});
    setMaterial(await reading(accepted));setNotice('The native owner recorded your acceptance. Your writing was not changed.');
  });
  const present=()=>void run(async()=>{
    if(!host||!reviewed?.sealed)throw new Error('Choose an existing Expressions window and accept a current native identity basis');
    const token=++generation.current,current=await controller.read(record.target),fresh=await reading(current);
    if(fresh.value!==reviewed.value||fresh.record_revision!==reviewed.record_revision||token!==generation.current)throw new Error('Identity or current reception changed; review it before showing');
    if(active.current&&active.current!==host)await endIdentity(active.current);
    active.current=host;onHost(host);
    try{await presentIdentity(host,await identityPattern(current,form,fresh));}
    catch(error){await endIdentity(host).catch(()=>{});throw error;}
    if(token!==generation.current){await endIdentity(host);throw new Error('The view changed; private presentation was ended');}
    setNotice('Accepted native identity shown privately in the existing Expressions engine. Nothing was saved or published.');
  });
  return <details><summary>Private identity rendering</summary>
    <p>The pattern comes from the native identity basis you review below. It does not derive a chart or a personal condition from your name or from hash bits. Unprovided layers stay unprovided.</p>
    {!available?<p role="status">This selected QL build does not expose native identity material. Your personal writing remains available; no renderer fingerprint is substituted.</p>:<>
      <button type="button" onClick={preview}>Review native identity basis</button>
      {reviewed&&<section aria-label="Review native identity basis">
        <p>{reviewed.supplied_offices.length} of 6 layers supplied. {reviewed.sealed?'This basis is accepted.':'This basis has not been accepted.'}</p>
        <p>Native identity revision: {reviewed.identity_revision}. Current orientation is a separate native reception reading.</p>
        <details><summary>Exact native identity provenance</summary><p>{reviewed.identity_hash_ref.ref_id}</p><p>{reviewed.standing}</p><p>M3 form address: {reviewed.m3_form_address_ref??'Not supplied; no address inferred from the hash.'}</p><p>Identity quaternion reference: {reviewed.identity_quaternion_ref?.ref_id??'Not supplied.'}</p></details>
        {!reviewed.sealed&&<><button type="button" onClick={accept}>Accept this native identity basis</button><button type="button" onClick={()=>{setMaterial(null);setNotice('Review dismissed without any native mutation.');}}>Leave identity unaccepted</button></>}
      </section>}
      <label>Existing Expressions window<select aria-label="Identity rendering window" value={host} onChange={e=>setHost(e.target.value)}><option value="">Choose a window</option>{hosts.map(h=><option key={h.id} value={h.id}>{h.label}</option>)}</select></label>
      <label>Authored form<select aria-label="Identity form" value={form} onChange={e=>setForm(e.target.value as IdentityForm)}><option value="cymatic">Cymatic chakral forms</option><option value="yantra">Chakral yantras</option></select></label>
      <button type="button" disabled={!host||!reviewed?.sealed} onClick={present}>Show private identity pattern</button>
      <button type="button" disabled={!host} onClick={()=>void run(async()=>{await endIdentity(active.current||host);active.current='';setNotice('Returned to the authored Expression.');})}>Return to my Expression</button>
    </>}
    <p>Seven receiving centres remain distinct from resonator stations. This view is not saved to the scene library or exported. Stop recording and release any active native material binding before entering.</p>
    {notice&&<p role="status">{notice}</p>}
  </details>;
}
