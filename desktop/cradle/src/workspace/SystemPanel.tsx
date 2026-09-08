import {GroundChooser} from "./GroundChooser";
import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {encounter} from "../encounter/client";
import {Loading} from "../shared/Loading";
import {formatRelativeTime} from "../shared/relativeTime";
interface NativeReading {data?:Record<string,unknown>;error?:string;command:string[]}
export interface CompositionReading {schema:string;current_world:NativeReading;status:NativeReading;positions:{product_id:string;availability:"missing"|"discovered"|"unavailable";native_state:string;current_world:Record<string,unknown>}[];integration_obligations:string[];observed_at_unix_ms:number}
/** BOOT-06/12: installed/registered is discovery, never asserted runtime
 * readiness — the owner has not disclosed a readiness op yet. */
function installationLabel(availability:CompositionReading["positions"][number]["availability"],native_state:string):string {
 return availability==="discovered" ? `${native_state} — discovered, not verified ready` : native_state;
}
/** Native S disclosure only. Registration never stands in for runtime readiness.
 * `binding` is accepted (and ignored) so this slots into SurfaceBody's call
 * convention when mounted as the `system` canvas surface (D11: System is a
 * canvas surface opened from the sidebar, not a right-plane inspector). */
export function SystemPanel({binding}: {binding?: import("../surface/types").SurfaceBinding} = {}) {
  void binding;
 const kernel=useKernel();const {transport}=kernel;const [reading,setReading]=useState<CompositionReading>();const [pending,setPending]=useState(false);const [error,setError]=useState<string>();
 const read=async(owners=false)=>{setPending(true);setError(undefined);try{const result=await kernelOp(transport,{op:"composition_read",owners});if(result.error||result.outcome?.result!=="composition_reading")throw new Error(result.error??"Composition reading unavailable");setReading(result.outcome.reading);}catch(error){setError(String(error));}finally{setPending(false);}};
 useEffect(()=>{void read();},[]);
 // BOOT-15: the three real facts the kernel can report today, for whichever
 // project is currently browsed (the sidebar's own current-project state —
 // no project selected is an honest absence, not a fabricated row).
 const project=kernel.snapshot.navigator?.project?.project.name;
 const [agency,setAgency]=useState<{project_ref:string;spaces:unknown[]}>();
 const [agencyError,setAgencyError]=useState<string>();
 const [providers,setProviders]=useState<unknown>();
 const [providersError,setProvidersError]=useState<string>();
 useEffect(()=>{
  setAgency(undefined);setAgencyError(undefined);setProviders(undefined);setProvidersError(undefined);
  if(!project) return;
  let live=true;
  void kernelOp(transport,{op:"agency_read",project}).then(result=>{
   if(!live)return;
   if(result.error||result.outcome?.result!=="agency_reading"){setAgencyError(result.error??"SessionSpace discovery unavailable");return;}
   setAgency({project_ref:result.outcome.project_ref,spaces:result.outcome.spaces});
  });
  void encounter(transport,project,{action:"providers"}).then(data=>{if(live)setProviders(data);}).catch(error=>{if(live)setProvidersError(String(error));});
  return ()=>{live=false;};
 },[transport,project]);
 const aikit=reading?.positions.find(position=>position.product_id==="ai-kit");
 return <section className="system-panel" aria-label="System composition" aria-busy={pending}><h2>System</h2><p>Native product composition</p><GroundChooser/>{pending&&<Loading label="Reading native composition…"/>}{error&&<p role="alert">{error}</p>}{reading?.current_world.error&&<p role="alert">{reading.current_world.error}</p>}{reading?.status.error&&<p role="alert">{reading.status.error}</p>}{reading&&Number.isFinite(reading.observed_at_unix_ms)&&<p className="system-observed">Observed {formatRelativeTime(reading.observed_at_unix_ms)}</p>}{reading?.positions.map(position=><details key={position.product_id}><summary><strong>{String(position.current_world.public_name??position.product_id)}</strong><span>{position.availability}</span></summary><dl><dt>Installation</dt><dd>{installationLabel(position.availability,position.native_state)}</dd>{typeof position.current_world.version==="string"&&<><dt>Version</dt><dd>{position.current_world.version}</dd></>}</dl><details><summary>Native installation record</summary><pre>{JSON.stringify(position.current_world,null,2)}</pre></details></details>)}<div className="system-actions"><button disabled={pending} onClick={()=>void read()}>Refresh</button><button disabled={pending} onClick={()=>void read(true)}>Read owner capabilities</button></div>{reading?.current_world.data?.owner_disclosures!=null&&<details open><summary>Owner capabilities and effective context</summary><pre>{JSON.stringify(reading.current_world.data.owner_disclosures,null,2)}</pre></details>}{reading&&<details><summary>Integration availability</summary>{reading.integration_obligations.map(item=><p key={item}>{item}</p>)}</details>}
 <section className="gateway-aperture" aria-label="Agency Gateway"><h3>Agency Gateway</h3><p>No owner operation is exposed to the desktop yet.</p><p>Missing native obligations:</p><ul><li>Ecology read</li><li>Attach</li><li>Stream cursor/replay</li></ul>
  <dl>
   <dt>AIKit executable bound</dt><dd>{reading ? (aikit ? installationLabel(aikit.availability,aikit.native_state) : "AIKit is not among the disclosed owner positions") : "Composition not yet read"}</dd>
   <dt>SessionSpace discovery ({project ?? "no project open"})</dt><dd>{!project ? "No project is currently open" : agencyError ? agencyError : agency ? `${agency.spaces.length} SessionSpace(s) disclosed for ${agency.project_ref}` : "Reading…"}</dd>
   <dt>Providers ({project ?? "no project open"})</dt><dd>{!project ? "No project is currently open" : providersError ? providersError : providers ? (Array.isArray(providers) ? `${providers.length} provider(s) disclosed` : "Disclosed") : "Reading…"}</dd>
  </dl>
  {agency && <details><summary>SessionSpace discovery record</summary><pre>{JSON.stringify(agency.spaces,null,2)}</pre></details>}
  {providers!=null && <details><summary>Provider list record</summary><pre>{JSON.stringify(providers,null,2)}</pre></details>}
 </section>
 </section>;
}
