/**
 * The settings page (docs/cradle/06-SYSTEM-SETTINGS.md, redesigned): one
 * canvas, three surfaces, in order of what a person comes here for.
 *
 *   Settings — change how the world behaves: search, edit, apply.
 *   System   — read how the world is doing: the census, its honesty, setup.
 *   Visuals  — appearance and expression (the expression system's home
 *              until it moves to its own place; untouched by this design).
 *
 * Every value on the System surface carries its provenance and honest
 * availability; the Settings surface renders the owner-disclosed
 * configuration plane. The two-surface split is the design's spine: the
 * census answers "is my world healthy?", Settings answers "what do I want
 * to change?" — neither tries to be the other.
 */
import {useEffect,useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {kernelOp} from "../../../kernel/bridge";
import {encounter} from "../../../encounter/client";
import type {ActivityExtras, CompositionReading, OwnerMount} from "../types";

/** The v2 page has its own surface ids, independent of the classic
 * page rail type. */
type SettingsView = "settings" | "system" | "visuals";
import {SettingsHome} from "./SettingsHome";
import {SystemHome} from "./SystemHome";
import {VisualsView} from "../VisualsView";
import "../settings-v2.css";

const RAIL:{id:SettingsView;label:string;hint:string}[] = [
  {id:"settings",label:"Settings",hint:"Change how the world behaves — search everything, edit, apply"},
  {id:"system",label:"System",hint:"How the world is doing — what's installed, what's running, what needs attention"},
  {id:"visuals",label:"Visuals",hint:"Appearance and expression — themes and the visual layer"},
];

/** The switch back to the classic page — the two systems live side by
 * side until the owner picks one. */
function ClassicSwitch({onChooseVariant}: {onChooseVariant: (variant: "classic") => void}) {
  return <button type="button" className="settings-rail-switch" data-settings-variant-switch
    title="Back to the current settings page"
    onClick={() => onChooseVariant("classic")}>Classic</button>;
}

const VIEW_HEAD:Record<SettingsView,{label:string;line:string}> = {
  settings:{label:"Settings",line:"Everything the products let you change, in one place. Changes wait in the tray until you apply them."},
  system:{label:"System",line:"What is installed, what is working, and what each product is doing — read honestly, changed only through its owner."},
  visuals:{label:"Visuals",line:"Themes and the visual expression layer."},
};

export function SettingsPageV2({onChooseVariant}: {onChooseVariant: (variant: "classic" | "redesign") => void}) {
  const kernel = useKernel();
  const {transport} = kernel;
  const [view,setView] = useState<SettingsView>("settings");
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
  const refreshAll = ()=>{void read();void readNative();};
  const head = VIEW_HEAD[view];
  return <section className="system-panel" aria-label="Settings and system" aria-busy={pending}>
    <nav className="settings-rail" aria-label="Settings surfaces">
      {RAIL.map(item=><button key={item.id} aria-pressed={view===item.id} title={item.hint} onClick={()=>setView(item.id)}>{item.label}</button>)}
      <ClassicSwitch onChooseVariant={onChooseVariant}/>
    </nav>
    <div className="settings-page-head"><h2>{head.label}</h2><p>{head.line}</p></div>
    {view==="settings"&&<SettingsHome census={reading}/>}
    {view==="system"&&<SystemHome
      reading={reading}
      nativeMounts={nativeMounts}
      nativePending={nativePending}
      ground={ground}
      extras={extras}
      pending={pending}
      error={error}
      onRefresh={refreshAll}
    />}
    {view==="visuals"&&<VisualsView/>}
  </section>;
}
