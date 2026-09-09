import {useEffect,useRef,useState} from "react";
const macOS = () => /Mac|iPhone|iPad/.test(navigator.platform);
export function searchLeaderLabel(shift: boolean) { return `${macOS() ? "⌘" : "Ctrl"}${shift ? " ⇧" : ""} K`; }
export function matchesSearchLeader(event: KeyboardEvent, shift: boolean) {
  const modifier = macOS() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return modifier && !event.altKey && event.shiftKey === shift && event.code === "KeyK";
}
export function useSearchLeader() {
  const [shift,setShift]=useState(()=>{try{return localStorage.getItem("oi.search-leader.shift")==="true";}catch{return false;}});
  const [error,setError]=useState<string>();
  const current=useRef(shift);current.current=shift;
  useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key==="oi.search-leader.shift")setShift(event.newValue==="true");};window.addEventListener("storage",changed);return()=>window.removeEventListener("storage",changed);},[]);
  const change=(value:boolean)=>{setShift(value);try{localStorage.setItem("oi.search-leader.shift",String(value));setError(undefined);}catch{setError("The search shortcut could not be saved on this device.");}};
  return {shift,current,change,error,label:searchLeaderLabel(shift)};
}
