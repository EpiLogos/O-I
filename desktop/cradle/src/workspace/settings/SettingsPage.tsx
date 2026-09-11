/**
 * The System Settings surface (docs/cradle/06-SYSTEM-SETTINGS.md) — the
 * world header, the four-need rail, and the views. Health is the default
 * view and keeps the census contract the system walk asserts: six product
 * `details` as direct children with the BOOT-06/12 honest availability
 * chip, and the owner-capability aggregate as the last disclosure.
 *
 * P1 projects only what the kernel already reads; every value carries its
 * provenance, and engagement renders as native paths or named obligations
 * — never fabricated controls (law L3/L4).
 */
import {useEffect,useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {kernelOp} from "../../kernel/bridge";
import {encounter} from "../../encounter/client";
import {Loading} from "../../shared/Loading";
import {formatRelativeTime} from "../../shared/relativeTime";
import {GroundChooser} from "../GroundChooser";
import type {ActivityExtras, CompositionReading, OwnerMount, SettingsView} from "./types";
import {buildSections, RAIL} from "./world";
import {ProductSection} from "./ProductSection";
import {NativeProductSection} from "./NativeProductSection";
import "./settings.css";

const BOOTSTRAP_STEPS:{title:string;detail:string;native:string}[] = [
  {title:"Bind the ground",detail:"Central is the world-keeper's anchor: the suite installs into a world, not into a vacuum. Recognition is read-only until you choose to bind.",native:"Config view → Central location (recognize, then Use as default)"},
  {title:"Install the suite",detail:"oi installs the six products at the manifest's pinned revisions — sha256 and attestation verified before unpack; a stale pin refuses cleanly rather than installing a lie.",native:"oi install --personal-ground <ground>"},
  {title:"Verify the world",detail:"Six discovered positions, doctor PASS, and the Central ctrl contract — each product's discovery is a visible event, not a spinner.",native:"oi verify --json · oi doctor · oi status --json"},
  {title:"First-run configuration",detail:"Only settings whose authored value is absent and whose owner marks them bootstrap-relevant surface here. Day-to-day life is the Health and Config views.",native:"See each product's own settings in the Health view"},
];

export function SettingsPage() {
  const kernel = useKernel();
  const {transport} = kernel;
  const [view,setView] = useState<SettingsView>("health");
  const [reading,setReading] = useState<CompositionReading>();
  const [pending,setPending] = useState(false);
  const [error,setError] = useState<string>();
  const [ground,setGround] = useState<string|null|undefined>();
  // Wave 5 (docs/cradle/07): the mounted native per-owner disclosures,
  // read independently of the P1 census — a mount failing never blocks the
  // honest census the page already has (L1).
  const [nativeMounts,setNativeMounts] = useState<Record<string,OwnerMount>>();
  const [nativePending,setNativePending] = useState(false);
  const read = async(owners=false)=>{
    setPending(true);setError(undefined);
    try{
      const result = await kernelOp(transport,{op:"composition_read",owners});
      if(result.error||result.outcome==null||result.outcome.result!=="composition_reading") throw new Error(result.error??"Composition reading unavailable");
      setReading(result.outcome.reading);
    }catch(cause){setError(String(cause));}finally{setPending(false);}
  };
  const readNative = async()=>{
    setNativePending(true);
    try{
      const result = await kernelOp(transport,{op:"system_composition_read"});
      if(result.error||result.outcome==null||result.outcome.result!=="system_composition_reading") return;
      const byProduct:Record<string,OwnerMount> = {};
      for(const mount of result.outcome.reading.owners) byProduct[mount.product_id]=mount;
      setNativeMounts(byProduct);
    }finally{setNativePending(false);}
  };
  useEffect(()=>{void read();void readNative();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    let live = true;
    void kernelOp(transport,{op:"ground",request:{action:"status"}}).then(result=>{
      if(!live||result.error||result.outcome==null||result.outcome.result!=="ground_reading") return;
      const value:unknown = result.outcome.reading.personal_ground;
      setGround(typeof value==="string"||value===null ? value : undefined);
    }).catch(()=>{if(live) setGround(undefined);});
    return ()=>{live=false;};
  },[transport]);
  // BOOT-15: the current project is the sidebar's own navigator state — no
  // project selected is an honest absence, not a fabricated row.
  const project = kernel.snapshot.navigator?.project?.project.name;
  const [extras,setExtras] = useState<ActivityExtras>({});
  useEffect(()=>{
    setExtras({project});
    if(!project) return;
    let live = true;
    void kernelOp(transport,{op:"agency_read",project}).then(result=>{
      if(!live) return;
      if(result.error||result.outcome==null||result.outcome.result!=="agency_reading"){setExtras(current=>({...current,spacesError:result.error??"SessionSpace discovery unavailable"}));return;}
      const outcome = result.outcome;
      const spaces:unknown = outcome.spaces;
      setExtras(current=>({...current,spaces:{count:Array.isArray(spaces)?spaces.length:0,project_ref:outcome.project_ref,raw:spaces}}));
    });
    void encounter(transport,project,{action:"providers"}).then(data=>{
      if(!live) return;
      setExtras(current=>({...current,providers:{count:Array.isArray(data)?data.length:0,raw:data}}));
    }).catch(cause=>{if(live) setExtras(current=>({...current,providersError:String(cause)}));});
    return ()=>{live=false;};
  },[transport,project]);
  const sections = buildSections(reading,extras);
  const ready = sections.filter(section=>section.availability==="discovered"||section.availability==="unavailable").length;
  const refreshAll = ()=>{void read();void readNative();};
  return <section className="system-panel" aria-label="System composition" aria-busy={pending}>
    <header className="settings-world-header">
      <div><h2>System</h2><p>The world read, configured, and maintained.</p></div>
      <dl className="settings-world-facts">
        <div><dt>Ground</dt><dd>{ground===undefined?"Unavailable":ground??"No default Central bound"}</dd></div>
        <div><dt>Suite</dt><dd>{reading?String(reading.suite_executable??"oi"):"Not yet read"}</dd></div>
        <div><dt>Census</dt><dd>{reading?`${ready} disclosed · ${sections.length-ready} not disclosed`:"Not yet read"}</dd></div>
        {reading&&Number.isFinite(reading.observed_at_unix_ms)&&<div><dt>Observed</dt><dd>{formatRelativeTime(reading.observed_at_unix_ms)}</dd></div>}
      </dl>
    </header>
    <nav className="settings-rail" aria-label="System needs">{RAIL.map(item=><button key={item.id} aria-pressed={view===item.id} title={item.hint} onClick={()=>setView(item.id)}>{item.label}</button>)}</nav>
    {(pending||nativePending)&&<Loading label="Reading…"/>}
    {error&&<p role="alert">{error}</p>}
    {reading?.current_world.error&&<p role="alert">{reading.current_world.error}</p>}
    {reading?.status.error&&<p role="alert">{reading.status.error}</p>}
    {view==="health"&&<>
      {sections.map(section=>{
        const mount = nativeMounts?.[section.product_id];
        return mount?.descriptor
          ? <NativeProductSection key={section.product_id} mount={mount} name={section.name}/>
          : <ProductSection key={section.product_id} model={section}/>;
      })}
      <div className="system-actions">
        <button disabled={pending||nativePending} onClick={refreshAll}>Refresh</button>
      </div>
    </>}
    {view==="activity"&&<div className="settings-view">
      <h3>Activity</h3>
      {!project&&<p>No project is currently open — SessionSpace and provider readings are project-scoped.</p>}
      {project&&<>
        {extras.spacesError&&<p role="alert">{extras.spacesError}</p>}
        {extras.providersError&&<p role="alert">{extras.providersError}</p>}
        {extras.spaces&&<p>{extras.spaces.count} SessionSpace(s) disclosed for {extras.spaces.project_ref}.</p>}
        {extras.providers&&<p>{extras.providers.count} provider(s) disclosed for {project}.</p>}
        {(extras.spaces||extras.providers)&&<details><summary>Activity records</summary><pre>{JSON.stringify({spaces:extras.spaces?.raw,providers:extras.providers?.raw},null,2)}</pre></details>}
      </>}
    </div>}
    {view==="config"&&<div className="settings-view">
      <h3>Configuration</h3>
      <GroundChooser/>
      <h4>Suite pins</h4>
      {!reading&&<p>Composition not yet read.</p>}
      {reading&&<table className="settings-pins"><thead><tr><th>Product</th><th>State</th><th>Version</th></tr></thead><tbody>
        {reading.positions.map(position=><tr key={position.product_id}><td>{position.product_id}</td><td>{position.native_state}</td><td>{typeof position.current_world.version==="string"?position.current_world.version:"—"}</td></tr>)}
      </tbody></table>}
      <p className="settings-native-note">Each product's own configuration is shown in the Health view above.</p>
    </div>}
    {view==="bootstrap"&&<div className="settings-view">
      <h3>Bootstrap</h3>
      <p>Bind a ground, install the suite, and verify it — the same page, before anything is installed.</p>
      <ol className="settings-bootstrap">{BOOTSTRAP_STEPS.map((step,index)=><li key={step.title}><strong>{index+1}. {step.title}</strong><p>{step.detail}</p><em className="product-native-path">{step.native}</em></li>)}</ol>
    </div>}
  </section>;
}
