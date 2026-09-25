/** Presentation of AIKit's native declaration/observation envelope. */
export interface HarnessLayer {
 layer:string;posture:string;native?:{name:string}[];composed?:{name:string}[];
 activation?:string;drift?:{name:string;note:string}[];
}
export interface HarnessProfileReading {
 disclosure:{slug:string;layers:HarnessLayer[]};
 native_tools:{state:string;reason?:string};activation:{state:string;reason?:string};
}
export function harnessProfiles(value:unknown):HarnessProfileReading[] {
 const reading=value as {schema?:string;profiles?:HarnessProfileReading[]}|undefined;
 if(reading?.schema!=="aikit.harness-disclosure/v1"||!Array.isArray(reading.profiles))return [];
 return reading.profiles.filter(row=>typeof row?.disclosure?.slug==="string"&&Array.isArray(row.disclosure.layers));
}
const words=(value:string)=>value.replace(/[-_]/g," ");
export function HarnessDisclosure({reading}:{reading:unknown}) {
 const profiles=harnessProfiles(reading);
 if(!profiles.length)return <p className="oi-note">{(reading as {reason?:string}|undefined)?.reason??"Harness declarations are unavailable from this owner."}</p>;
 return <>
  <p className="oi-note">Project harness declarations and observed configuration. This reading does not identify which profile this session loaded.</p>
  {profiles.map(row=><details className="oi-disclosure" key={row.disclosure.slug}>
   <summary>{words(row.disclosure.slug)}</summary>
   <p className="oi-note">{row.activation?.reason??"Session activation has not been observed."}</p>
   {row.disclosure.layers.map(layer=><section key={layer.layer}>
    <p><strong>{words(layer.layer)}</strong> · {words(layer.posture)}</p>
    {layer.native?.length?<p className="oi-note">Native: {layer.native.map(entry=>entry.name).join(", ")}</p>:null}
    {layer.composed?.length?<p className="oi-note">Composed: {layer.composed.map(entry=>entry.name).join(", ")}</p>:null}
    {layer.layer==="tools"&&<p className="oi-note">Native tools observation: {words(row.native_tools?.state??"unobserved")}</p>}
    {layer.activation&&<p className="oi-note">Declared activation: {words(layer.activation)}. Target loading has not been observed.</p>}
    {layer.drift?.map(item=><p className="oi-note" key={`${item.name}:${item.note}`}>{item.name}: {item.note}</p>)}
   </section>)}
  </details>)}
 </>;
}
