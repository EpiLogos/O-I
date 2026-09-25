/** M5′ Palace instrument, mounted live over the running engine (parity with
 * installResearchInstruments). Composes independently addressable native
 * Expressions into named regions and a guided walk order — never a second
 * Palace store, graph or renderer.
 *
 * Durable persistence rides the EXISTING Expression substrate (O:I #352
 * ES1A/ES1B), through `src/techne/m0m5/palace/composition.ts`'s
 * `planRegions`/`discoverRegions`:
 *   - a REGION is a real Scene of the Palace's own Expression
 *     (`scene_create`/`scene_rename`/`scene_remove`);
 *   - a region discloses EXACTLY ONE contained Expression, through that
 *     Scene's own body (`scene_body_set`, carrier `expression_ref`) — the
 *     kernel refuses an Entity subject bound to another Expression
 *     ("Subject must remain native"; proven in
 *     `kernel/tests/palace_composition_native.rs`), and a Scene has exactly
 *     one body, so this is the only substrate seam that discloses a
 *     contained Expression. There is NO marker-Entity fallback for a second
 *     member — a region that wants a second Expression is a second region;
 *     this surface refuses adding past one member and offers "Add as new
 *     region" instead;
 *   - opening the member natively is a Portal trigger
 *     (`scene_trigger_attach`);
 *   - the guided path is the Palace's own Scene order (`scene_reorder`);
 *   - removing a region is an explicit act: only a region the person
 *     actually removed and then saved emits `scene_remove` — never inferred
 *     from a region merely going unmentioned.
 * The Palace is the current native Expression open in the field — never a
 * second document. All changes for one Save ride in ONE kernel `edit`
 * request, CAS-gated on the document's own live revision, diffed against
 * that live document FIRST so replaying the same composition emits nothing.
 *
 * Erasable TypeScript + JSX: loadable by Vite. node --test does not import
 * this file — `composition.ts` carries the pure-logic proof, and
 * `kernel/tests/palace_composition_native.rs` carries the native proof.
 */
import React,{useEffect,useMemo,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {
 discoverRegions,planRegions,regionSceneRef,
 type PalaceChange,type PalaceDocumentSnapshot,type PalaceRegionSpec,
} from '../../../src/techne/m0m5/palace/composition';
import type {KernelConversion} from './kernelDocumentBridge.js';
import './palaceInstrument.css';

export interface PalaceKernelExpression {expression_ref:string;title:string;revision:number}
export type PalaceComposeResult =
 |{ok:true;document:PalaceDocumentSnapshot}
 |{ok:false;reason:string};

/** The host the mounted app supplies. Every function is a thin wire to the
 * SAME kernel-expression channel `kernelExpressions.ts` already uses
 * (`listKernelExpressions`/`readKernelExpression`/`nativeExpressionRequest`)
 * — declared here, not imported, so this module stays independently
 * testable and the app wires the exact live channel in app.ts. */
export interface PalaceInstrumentHost {
 nativeView:()=>KernelConversion|undefined;
 sceneId:()=>string;
 listExpressions:()=>Promise<PalaceKernelExpression[]>;
 readExpression:(ref:string)=>Promise<PalaceDocumentSnapshot&{title:string}>;
 /** Executes one native `edit` carrying exactly the Change list `planRegions`
  * produced, CAS-gated at `expected_revision`. Never called with an empty
  * change list (a no-op composition is never submitted). */
 composeExpression:(input:{expression_ref:string;expected_revision:number;changes:PalaceChange[]})=>Promise<PalaceComposeResult>;
 /** Opens one contained object independently — the same summon path the
  * Studio's own "open source" affordance uses. */
 openExpression:(ref:string)=>void;
}

const DEFAULT_REGION='Palace';

/** A region draft in the editor: its name, live/pending Scene ref, its one
 * member (or null while empty). */
interface RegionDraft {name:string;scene_ref:string|null;member:PalaceRegionSpec['member']}

function PalacePanel({host,doc,onClose,onMessage}:{host:PalaceInstrumentHost;doc:PalaceDocumentSnapshot&{title:string};onClose:()=>void;onMessage:(text:string)=>void}) {
 const initial=useMemo(()=>{
  const found=discoverRegions(doc);
  return found.length>0?found:[{name:DEFAULT_REGION,scene_ref:null,member:null} as PalaceRegionSpec];
 },[doc.expression_ref,doc.revision]);
 const [regions,setRegions]=useState<RegionDraft[]>(initial);
 const [removed,setRemoved]=useState<string[]>([]);
 const [eligible,setEligible]=useState<PalaceKernelExpression[]>([]);
 const [busy,setBusy]=useState(false);
 const [newRegion,setNewRegion]=useState('');

 useEffect(()=>{let live=true;void host.listExpressions().then(list=>{if(live)setEligible(list.filter(entry=>entry.expression_ref!==doc.expression_ref));}).catch(error=>onMessage(error instanceof Error?error.message:String(error)));return()=>{live=false;};},[doc.expression_ref]);

 const containedRefs=useMemo(()=>new Set(regions.flatMap(region=>region.member?[region.member.expression_ref]:[])),[regions]);

 function createRegion(name:string,member:PalaceRegionSpec['member']){
  setRegions(current=>[...current,{name,scene_ref:regionSceneRef(doc.expression_ref,name),member}]);
 }
 /** A region holds exactly one Expression — the substrate discloses a
  * contained Expression only through the Scene's own body, and the kernel
  * refuses binding a second one via an Entity. Adding past one member is
  * refused here with a plain reason; the caller is offered a new region
  * instead of a silent second-member drop or a marker-entity workaround. */
 function addTo(regionName:string,expression_ref:string,title:string){
  const target=regions.find(region=>region.name===regionName);
  if(target?.member){
   onMessage(`"${regionName}" already holds one Expression. A region holds one Expression; add another region for more.`);
   return;
  }
  setRegions(current=>current.map(region=>region.name===regionName?{...region,member:{expression_ref,title}}:region));
 }
 function addAsNewRegion(expression_ref:string,title:string){
  const name=title||expression_ref;
  let candidate=name,suffix=2;
  while(regions.some(region=>region.name===candidate))candidate=`${name} ${suffix++}`;
  createRegion(candidate,{expression_ref,title});
 }
 function removeMember(regionName:string){
  setRegions(current=>current.map(region=>region.name===regionName?{...region,member:null}:region));
 }
 function moveRegion(name:string,delta:number){
  setRegions(current=>{
   const index=current.findIndex(region=>region.name===name),target=index+delta;
   if(index<0||target<0||target>=current.length)return current;
   const next=[...current];[next[index],next[target]]=[next[target],next[index]];
   return next;
  });
 }
 function addRegion(){
  const name=newRegion.trim();
  if(!name||regions.some(region=>region.name===name))return;
  createRegion(name,null);
  setNewRegion('');
 }
 /** Removal is staged here and is EXPLICIT: only names collected in
  * `removed` earn a `scene_remove` on Save (`planRegions`'s
  * `removedRegionNames` — never inferred from a region simply not being
  * named any more). */
 function removeRegion(name:string){
  if(regions.length<=1)return;
  setRegions(current=>current.filter(region=>region.name!==name));
  setRemoved(current=>current.includes(name)?current:[...current,name]);
 }
 function cancel(){
  setRegions(initial);setRemoved([]);
  onMessage('Cancelled — no mutation.');
 }
 async function save(){
  const changes=planRegions(doc,regions,removed);
  if(!changes){onMessage('Nothing to save — the composition already matches the native document.');return;}
  setBusy(true);
  try{
   const result=await host.composeExpression({expression_ref:doc.expression_ref,expected_revision:doc.revision,changes});
   if(!result.ok){onMessage(`Not saved: ${result.reason}`);return;}
   const readback=discoverRegions(result.document);
   const proposedByName=new Map(regions.map(region=>[region.name,region.member?.expression_ref??null]));
   const matches=readback.length===regions.length&&readback.every(region=>proposedByName.get(region.name)===(region.member?.expression_ref??null));
   setRegions(readback.length>0?readback:regions);
   setRemoved([]);
   onMessage(matches?`Composition saved — revision ${result.document.revision}; readback confirms the same composition.`:`Saved at revision ${result.document.revision}; reopen to verify the exact composition.`);
  }catch(error){onMessage(error instanceof Error?error.message:String(error));}
  finally{setBusy(false);}
 }

 return <div className="palace-panel" role="region" aria-label="M5′ Palace">
  <header className="palace-header">
   <h2>M5′ Palace — {doc.title}</h2>
   <div className="palace-header-actions">
    <button type="button" disabled={busy} onClick={()=>void save()}>Save composition</button>
    <button type="button" disabled={busy} onClick={cancel}>Cancel</button>
    <button type="button" onClick={onClose} aria-label="Close Palace">Close</button>
   </div>
  </header>
  <div className="palace-body">
   <section className="palace-regions" aria-label="Regions and guided path">
    {regions.map((region,index)=>
     <div className="palace-region" key={region.name}>
      <div className="palace-region-head">
       <h3>{region.name}</h3>
       <div className="palace-region-controls">
        <button type="button" disabled={index===0} onClick={()=>moveRegion(region.name,-1)} aria-label={`Move ${region.name} earlier in the guided path`}>↑</button>
        <button type="button" disabled={index===regions.length-1} onClick={()=>moveRegion(region.name,1)} aria-label={`Move ${region.name} later in the guided path`}>↓</button>
        <button type="button" disabled={regions.length<=1} onClick={()=>removeRegion(region.name)}>Remove region</button>
       </div>
      </div>
      {region.member
       ?<div className="palace-region-member">
         <p className="palace-primary-note">Contained Expression (native Scene body, Portal-openable):</p>
         <div className="palace-region-members"><span className="palace-ref">{region.member.title||region.member.expression_ref}</span>
          <span className="palace-member-controls">
           <button type="button" onClick={()=>host.openExpression(region.member!.expression_ref)}>Open</button>
           <button type="button" onClick={()=>removeMember(region.name)}>Remove</button>
          </span></div>
        </div>
       :<p className="palace-empty">No contained Expression yet — add one from the eligible list.</p>}
     </div>)}
    <div className="palace-add-region">
     <label>New region<input value={newRegion} onChange={e=>setNewRegion(e.target.value)} maxLength={80} placeholder="Region name"/></label>
     <button type="button" disabled={!newRegion.trim()} onClick={addRegion}>Add region</button>
    </div>
   </section>
   <section className="palace-eligible" aria-label="Eligible native Expressions">
    <h3>Eligible native Expressions</h3>
    <ul>
     {eligible.length===0&&<li className="palace-empty">No other native Expressions are disclosed.</li>}
     {eligible.map(entry=>{
      const composed=containedRefs.has(entry.expression_ref);
      const openRegion=regions.find(region=>!region.member);
      return <li key={entry.expression_ref}>
       <span className="palace-ref">{entry.title||entry.expression_ref}</span>
       <span className="palace-member-controls">
        <button type="button" onClick={()=>host.openExpression(entry.expression_ref)}>Open</button>
        {composed
         ?<button type="button" disabled>Composed</button>
         :openRegion
          ?<button type="button" onClick={()=>addTo(openRegion.name,entry.expression_ref,entry.title)}>{`Add to ${openRegion.name}`}</button>
          :<button type="button" onClick={()=>addAsNewRegion(entry.expression_ref,entry.title)} title="Every region already holds one Expression">Add as new region</button>}
       </span>
      </li>;
     })}
    </ul>
    <h3>Scenes of {doc.title}</h3>
    <ul>
     {doc.scenes.length===0&&<li className="palace-empty">No Scenes disclosed for this Expression.</li>}
     {doc.scenes.map(scene=><li key={scene.scene_ref}><span className="palace-ref">{scene.title||scene.scene_ref}</span></li>)}
    </ul>
   </section>
  </div>
 </div>;
}

export function installPalaceInstrument(host:PalaceInstrumentHost){
 let root:Root|null=null,mount:HTMLElement|null=null,status:HTMLElement|null=null,epoch=0,destroyed=false,open_=false;
 function ensureMount(){
  if(mount)return mount;
  mount=document.createElement('section');mount.id='techne-palace-workspace';mount.className='palace-workspace';mount.hidden=true;
  status=document.createElement('div');status.className='palace-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  document.body.append(mount,status);
  return mount;
 }
 function message(text:string){if(status)status.textContent=text;}
 function unmount(){root?.unmount();root=null;if(mount)mount.replaceChildren();}
 async function load(){
  const generation=++epoch;
  const view=host.nativeView();
  if(!view){message('Open a native Expression before entering the Palace.');unmount();return;}
  try{
   const doc=await host.readExpression(view.document.expression_ref);
   if(generation!==epoch||destroyed)return;
   ensureMount();
   root??=createRoot(mount!);
   root.render(<PalacePanel host={host} doc={doc} onClose={()=>{void close_();}} onMessage={message}/>);
  }catch(error){if(generation!==epoch||destroyed)return;message(error instanceof Error?error.message:String(error));}
 }
 async function close_(){
  epoch++;open_=false;unmount();if(mount)mount.hidden=true;
 }
 return {
  async open(){if(destroyed)throw new Error('Palace instrument workspace is closed');open_=true;ensureMount();if(mount)mount.hidden=false;await load();},
  close(){void close_();},
  async refresh(){if(open_)await load();},
  destroy(){epoch++;destroyed=true;unmount();mount?.remove();status?.remove();mount=null;status=null;},
  active(){return open_;},
 };
}
