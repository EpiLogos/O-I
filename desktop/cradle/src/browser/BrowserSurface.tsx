import {useEffect,useRef,useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {listen} from "@tauri-apps/api/event";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import "./browser.css";
import {useBrowserContext} from "../context/useBrowserContext";

type Profile="temporary"|"personal";
type DownloadReading={url:string;path:string;state:"downloading"|"saved"|"failed"};
type Reading={id:string;url:string;title:string;loading:boolean;zoom:number;notice?:string;requested_window?:string;profile:Profile;download?:DownloadReading};
const queues=new Map<string,Promise<unknown>>();
function serial<T>(id:string, work:()=>Promise<T>):Promise<T>{
  const next=(queues.get(id)??Promise.resolve()).catch(()=>{}).then(work);
  queues.set(id,next);void next.finally(()=>{if(queues.get(id)===next)queues.delete(id);}).catch(()=>{});return next;
}
function saved(id:string,fallback:string){try{return localStorage.getItem(`oi-browser-url:${id}`)??fallback;}catch{return fallback;}}
function savedProfile(id:string):Profile{try{return localStorage.getItem(`oi-browser-profile:${id}`)==="personal"?"personal":"temporary";}catch{return "temporary";}}
export function BrowserSurface({binding}:{binding:SurfaceBinding}) {
  const kernel=useKernel();const native=kernel.transport.kind==="tauri";
  const [address,setAddress]=useState(()=>saved(binding.id,binding.browser?.url??""));
  const [target,setTarget]=useState(address);const [reading,setReading]=useState<Reading>();const [error,setError]=useState<string>();
  const [zoom,setZoom]=useState(1);const [retry,setRetry]=useState(0);
  const [profile,setProfile]=useState<Profile>(()=>savedProfile(binding.id));
  const editing=useRef(false);
  const [contextMode,setContextMode]=useState("off");
  const viewport=useRef<HTMLDivElement>(null);const input=useRef<HTMLInputElement>(null);const attached=useRef(false);
  const control=(action:string,args:Record<string,unknown>={})=>serial(binding.id,()=>invoke("browser_control",{id:binding.id,action,...args}));
  const attachContext=useBrowserContext(binding,native,contextMode,reading?.loading,control);
  useEffect(()=>{
    if(!native)return;
    let disposed=false;let unlisten:(()=>void)|undefined;let unfocus:(()=>void)|undefined;
    void listen<string>("oi:browser-focus",e=>{if(!disposed&&e.payload===binding.id)window.dispatchEvent(new CustomEvent("oi:browser-pane-focus",{detail:binding.id}));}).then(fn=>disposed?fn():unfocus=fn);
    void listen<Reading>("oi:browser-reading",e=>{
      if(disposed||e.payload.id!==binding.id)return;
      setReading(e.payload);setZoom(e.payload.zoom);if(!editing.current)setAddress(e.payload.url);
      try{localStorage.setItem(`oi-browser-url:${binding.id}`,e.payload.url);}catch{/* URL restore is best effort; the live view is authoritative. */}
      window.dispatchEvent(new CustomEvent("oi:browser-title",{detail:e.payload}));
    }).then(fn=>disposed?fn():unlisten=fn).catch(reason=>setError(String(reason)));
    return()=>{disposed=true;unlisten?.();unfocus?.();};
  },[binding.id,native]);
  useEffect(()=>{
    if(!native||!target||!kernel.snapshot.surfaces[binding.id])return;
    let disposed=false,frame=0,last="",busy=false,hidden=true;
    const element=viewport.current!;
    const focusTimer=setInterval(()=>{if(attached.current&&!hidden)void control("poll-focus").catch(()=>{});},200);
    const tick=()=>{
      if(disposed)return;
      frame=requestAnimationFrame(tick);
      if(busy)return;
      const rect=element.getBoundingClientRect();
      // Native child views sit above DOM layers: conceal them whenever shell
      // overlays own input, and whenever their pane is not actually visible.
      const blocked=document.querySelector('.desktop-side.right[style*="transform"],.desktop-regions[data-right-full="true"],.ctx-menu,.search-aperture,[role="dialog"],.region-scrim,details[open],.desktop-side[data-overlay="true"]');
      const visible=rect.width>1&&rect.height>1&&rect.left>=0&&rect.top>=0&&element.getClientRects().length>0&&!element.closest('[inert],[hidden],[aria-hidden="true"]')&&!blocked;
      if(!visible){if(attached.current&&!hidden){hidden=true;void control("hide").catch(reason=>setError(String(reason)));}return;}
      // Leave the DOM footer edge reachable above the native child view.
      // Revealing status trims its viewport instead of hiding the whole page.
      const footer=element.closest('.browser-surface')?.querySelector('.browser-status')?.getBoundingClientRect();
      const workspaceFooter=document.querySelector('.workspace-footer-edge .canvas-arrangement')?.getBoundingClientRect();
      const bottom=Math.min(rect.bottom,footer?.top??rect.bottom,workspaceFooter?.top??rect.bottom);
      const bounds={x:rect.left,y:rect.top,width:rect.width,height:Math.max(1,bottom-rect.top)};
      const stamp=JSON.stringify(bounds);
      if(attached.current&&!hidden&&last===stamp)return;
      busy=true;last=stamp;
      const work=attached.current?control("bounds",{bounds}):serial(binding.id,()=>invoke<Reading>("browser_attach",{id:binding.id,address:target,profile,bounds})).then(value=>{
        attached.current=true;setReading(value);setZoom(value.zoom);setAddress(value.url);setError(undefined);
        try{localStorage.setItem(`oi-browser-url:${binding.id}`,value.url);}catch{/* Live native state remains authoritative. */}
        window.dispatchEvent(new CustomEvent("oi:browser-title",{detail:value}));
        window.dispatchEvent(new Event("oi:browser-attached"));
      });
      void work.then(()=>{hidden=false;}).catch(reason=>{attached.current=false;setError(String(reason));last="";disposed=true;cancelAnimationFrame(frame);}).finally(()=>busy=false);
    };tick();
    return()=>{disposed=true;clearInterval(focusTimer);cancelAnimationFrame(frame);void control("hide").catch(()=>{});};
  // Changing tabs hides this same native instance. A layout-level reconcile
  // closes it only when its binding really leaves all workspace arrangements.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[binding.id,native,!!kernel.snapshot.surfaces[binding.id],target,profile,retry]);
  const navigate=async(e:React.FormEvent)=>{
    e.preventDefault();setError(undefined);editing.current=false;
    let value=address.trim();if(!/^\w+:/.test(value))value=`https://${value}`;
    try{const parsed=new URL(value);if(!["https:","http:"].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error("Enter an HTTP or HTTPS address without embedded credentials");
      if(attached.current){setAddress(reading?.url??"");await control("navigate",{address:value});await control("focus");}else setTarget(value);
      if(!attached.current)setAddress(value);
    }catch(reason){setError(String(reason));}
  };
  const act=(action:string)=>void control(action).catch(reason=>setError(String(reason)));
  const switchProfile=async(next:Profile)=>{
    if(next===profile)return;
    setError(undefined);
    try{
      if(attached.current)await control("close");
      attached.current=false;
      try{localStorage.setItem(`oi-browser-profile:${binding.id}`,next);}catch{/* Native profile choice remains authoritative for this pane. */}
      setProfile(next);setReading(undefined);setRetry(value=>value+1);
    }catch(reason){setError(String(reason));}
  };
  return <section className="browser-surface" aria-label="Browser surface">
    <form className="browser-toolbar" onSubmit={e=>void navigate(e)}>
      <span className="browser-tools">
        <button type="button" aria-label="Back" disabled={!reading} onClick={()=>act("back")}>←</button>
        <button type="button" aria-label="Forward" disabled={!reading} onClick={()=>act("forward")}>→</button>
        <button type="button" aria-label={reading?.loading?"Stop loading":"Reload page"} disabled={!reading} onClick={()=>act(reading?.loading?"stop":"reload")}>{reading?.loading?"×":"↻"}</button>
      </span>
      <input ref={input} className="browser-address" aria-label="Web address" placeholder="Enter a web address" value={address} onChange={e=>setAddress(e.target.value)} onFocus={e=>{editing.current=true;e.target.select();}} onBlur={()=>{editing.current=false;requestAnimationFrame(()=>{if(reading&&!(document.activeElement as HTMLElement)?.closest(".browser-toolbar"))setAddress(reading.url);});}} autoFocus={!target} spellCheck={false}/>
      <span className="browser-tools">
        <button type="submit" disabled={!native||!address.trim()}>Go</button>
        <button type="button" aria-label="Text mode" aria-pressed={contextMode==="off"} onClick={()=>setContextMode("off")}>✎</button>
        <button type="button" aria-label="Context mode" aria-pressed={contextMode!=="off"} disabled={!reading} onClick={()=>setContextMode('components')}>@</button>
        {contextMode!=="off"&&<button type="button" onMouseDown={e=>e.preventDefault()} onClick={attachContext}>Attach selection</button>}
        <select aria-label="Browser profile" value={profile} onChange={e=>void switchProfile(e.target.value as Profile)}><option value="temporary">Temporary</option><option value="personal">Personal</option></select>
        <select aria-label="Browser zoom" value={zoom} onChange={e=>{const value=Number(e.target.value);setZoom(value);void control("zoom",{zoom:value}).catch(reason=>setError(String(reason)));}}>{[.5,.75,1,1.25,1.5,2].map(v=><option key={v} value={v}>{v*100}%</option>)}</select>
      </span>
    </form>
    {error&&<div role="alert" className="browser-notice">{error} <button onClick={()=>{setError(undefined);setRetry(v=>v+1);}}>Retry</button></div>}
    {reading?.notice&&<div role="status" className="browser-notice">{reading.notice}{reading.requested_window&&<><span className="browser-requested-url">{reading.requested_window}</span><button onClick={()=>void control("navigate",{address:reading.requested_window}).catch(reason=>setError(String(reason)))}>Open link in this pane</button></>}</div>}
    <div ref={viewport} className="browser-viewport">{!native?<p>Web browsing is available in the desktop app.</p>:!target?<p>Open a web page in this pane.</p>:!reading?<p>Opening browser…</p>:null}</div>
    <footer className="browser-status" tabIndex={0} aria-label="Browser status">
      <span>{reading?.download?.state==="downloading"?"Downloading…":reading?.download?.state==="saved"?"Download saved":reading?.download?.state==="failed"?"Download failed":reading?.loading?"Loading…":"Ready"}</span>
      <span className="browser-status-path" title={reading?.download?.path||reading?.url}>{reading?.download?.path||reading?.url||"No page open"}</span>
      <span title={profile==="temporary"?"Cookies and website storage end when this pane closes.":"Cookies and website storage persist across browser panes and app launches."}>{profile==="temporary"?"Temporary":"Personal"}</span>
    </footer>
  </section>;
}
