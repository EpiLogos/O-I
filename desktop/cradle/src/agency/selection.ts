import {useSyncExternalStore} from 'react';
const KEY='oi-panel-agent.v1';
const listeners=new Set<()=>void>();
let selected:Record<string,string>={};
try{selected=JSON.parse(localStorage.getItem(KEY)??'{}');}catch{/* Missing preferences leave the live profile selected. */}
export function useChosenAgent(project?:string):[string|undefined,(ref:string|undefined)=>void]{
 const key=project??'';
 const ref=useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>selected[key]);
 return [ref,value=>{selected={...selected};if(value)selected[key]=value;else delete selected[key];try{localStorage.setItem(KEY,JSON.stringify(selected));}catch{/* in-window selection still applies */}listeners.forEach(listener=>listener());}];
}
