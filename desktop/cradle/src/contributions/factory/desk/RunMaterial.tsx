import {useEffect,useRef,useState} from 'react';
import {useKernel} from '../../../kernel/KernelProvider';
import {buildSnapshot,buildViewOf} from '../development';
import {readFactoryMaterialBuild,selectFactoryMaterial,type FactoryMaterialSelection as MaterialReading,type FactoryMaterialBuildReading} from '../factory-material-reading';
import {CandidateReading} from '../CandidateReading';
import type {FactoryBuildView,FactoryMaterialSelection} from '../types';
import type {RunEntry} from './deskStore';
import {errorWords} from './deskStore';
import type {RunPageHost} from './RunPage';

/** One original native Build snapshot, kept as the review basis until an
 * explicit reread. Candidate/artifact identity is never a filesystem path. */
export function RunMaterial({entry,host}:{entry:RunEntry;host:RunPageHost}) {
  const kernel=useKernel(),region=useRef<HTMLElement>(null),mounted=useRef(false),flight=useRef<symbol|null>(null);
  const [snapshot,setSnapshot]=useState<{raw:unknown;view:FactoryBuildView;basis:FactoryMaterialBuildReading}>(),[selected,setSelected]=useState<MaterialReading>();
  const [busy,setBusy]=useState(false),[fault,setFault]=useState<string>();
  const targetKey=JSON.stringify([kernel.transport,entry.card.source.statePath,entry.card.source.projectRef,entry.run.runRef]);
  const latest=useRef({targetKey,host,revision:entry.run.revision});latest.current={targetKey,host,revision:entry.run.revision};
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
  useEffect(()=>{setSnapshot(undefined);setSelected(undefined);setFault(undefined)},[targetKey]);
  const capture=(revision?:number)=>{const key=targetKey,original=host.current;return()=>mounted.current&&latest.current.targetKey===key&&(revision===undefined||latest.current.revision===revision)&&!!region.current?.getClientRects().length&&(!original||original())&&(!latest.current.host.current||latest.current.host.current())};
  const read=async()=>{
    const current=capture(entry.run.revision);if(flight.current||!current())return;
    const own=Symbol('native-build-reading');flight.current=own;setBusy(true);setFault(undefined);
    const source={...entry.card.source},runRef=entry.run.runRef;
    try{
      const raw=await buildSnapshot(kernel.transport,source.statePath,source.projectRef,runRef,source.project);
      if(!current())return;
      const checked=readFactoryMaterialBuild(raw,runRef),view=buildViewOf(raw);
      if(!checked.reading||!view)throw Error(checked.kind==='refusal'?checked.message:'Factory Build material is unavailable.');
      if(checked.reading.project.projectRef!==source.projectRef)throw Error('Factory returned material for another Project.');
      setSnapshot({raw,basis:checked.reading,view:{...view,claims:checked.reading.claims,evidence:checked.reading.evidence,candidates:checked.reading.candidates}});setSelected(undefined);
    }catch(cause){if(current())setFault(errorWords(cause))}
    finally{if(flight.current===own){flight.current=null;if(mounted.current)setBusy(false)}}
  };
  const open=(selection:FactoryMaterialSelection)=>{
    if(!capture()()||!snapshot)return;
    const material=selectFactoryMaterial(snapshot.raw,entry.run.runRef,selection.subjectRef);setSelected(material);
    if(material.kind==='refusal')setFault(material.message);else setFault(undefined);
  };
  return <section ref={region} aria-label="Returned Factory material" className="fhandoff">
    <header><h2>Produced material</h2><button type="button" className="oi-action" disabled={busy} onClick={()=>void read()}>{busy?'Reading…':snapshot?'Read current material':'Read material'}</button></header>
    {fault&&<p role="alert">Factory material reading refused: {fault}</p>}
    {!snapshot&&!busy&&<p>Read this Run's retained candidates, claims and evidence.</p>}
    {snapshot&&<><p>Reviewing the retained owner snapshot. A newer read does not replace it until requested.</p>
      <p>Factory revision {snapshot.basis.factoryStateRevision} · Run revision {snapshot.basis.runRevision} · Map revision {snapshot.basis.runMapRevision}</p>
      {entry.run.revision!==undefined&&entry.run.revision!==snapshot.basis.runRevision&&<p role="status">The current Run reading has a different revision. This reviewed material remains on its original basis.</p>}
      <CandidateReading view={snapshot.view} onOpenMaterial={open}/>
      {selected?.kind==='selected'&&<details open><summary>Selected native material and basis</summary><pre>{JSON.stringify(selected,null,2)}</pre></details>}
      <p>Artifact references stay with their native owner. This read does not disclose a file address or source comparison operation.</p>
      <details><summary>Native Build provenance</summary><pre>{JSON.stringify(snapshot.raw,null,2)}</pre></details>
    </>}
  </section>;
}
