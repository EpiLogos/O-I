import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {CentralLocation,NativeDirectory} from "../kernel/types";
import {Glyph} from "../workspace/Glyph";
import {listFiles} from "./client";
import {Loading} from "../shared/Loading";

export function FileTree({path,onOpen,refresh,expanded,onExpansion,onRootRef}:{onRootRef:(ref:string)=>void;path:string;onOpen:(location:CentralLocation)=>Promise<void>;refresh:number;expanded:string[];onExpansion:(paths:string[])=>void}) {
  const [openingError,setOpeningError]=useState<string>();
  const tree=useRef<HTMLDivElement>(null);
  const open=async(location:CentralLocation)=>{setOpeningError(undefined);try{await onOpen(location);}catch(e){setOpeningError(String(e));}};
  const toggle=(path:string,value:boolean)=>onExpansion(value?Array.from(new Set([...expanded,path])):expanded.filter(p=>p!==path));
  return <div className="native-file-tree" ref={tree} aria-label="Files" onKeyDown={event=>{
    if(!["ArrowDown","ArrowUp","Home","End"].includes(event.key))return;
    const buttons=Array.from(tree.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
    const current=buttons.indexOf(document.activeElement as HTMLButtonElement);if(current<0)return;
    event.preventDefault();
    const index=event.key==="Home"?0:event.key==="End"?buttons.length-1:Math.min(buttons.length-1,Math.max(0,current+(event.key==="ArrowDown"?1:-1)));
    buttons[index]?.focus();
  }}>
    {openingError&&<p role="status">{openingError}</p>}
    <Directory key={path} onReading={onRootRef} path={path} onOpen={open} refresh={refresh} expanded={expanded} toggle={toggle}/>
  </div>;
}
function Directory({path,onOpen,refresh,expanded,toggle,onReading}:{onReading?:(ref:string)=>void;path:string;onOpen:(location:CentralLocation)=>Promise<void>;refresh:number;expanded:string[];toggle:(path:string,value:boolean)=>void}) {
  const {transport}=useKernel();
  const [reading,setReading]=useState<NativeDirectory>();
  const [error,setError]=useState<string>();
  // BOOT-14: a refresh keeps the last-observed directory listing visible
  // (`reading` is only replaced once the new read lands) with the shared
  // surface-scoped indicator alongside it, instead of blanking the tree.
  const [pending,setPending]=useState(false);
  useEffect(()=>{let current=true;setPending(true);setError(undefined);void listFiles(transport,path).then(value=>{if(current){setReading(value);onReading?.(value.location.ref);}}).catch(e=>{if(current)setError(String(e));}).finally(()=>{if(current)setPending(false);});return()=>{current=false;};},[path,refresh]);
  if(error)return <p role="status">{error}</p>;
  if(!reading)return <Loading label="Reading files…" scope="surface"/>;
  return <div aria-busy={pending}>
    {pending&&<Loading label="Refreshing files…" detail="Keeping the last observed listing visible" scope="surface"/>}
    <ul className="native-directory">
    {reading.entries.map(entry=>{const folder=entry.kind==="directory",open=expanded.includes(entry.location.path),usable=entry.retrieval_allowed&&(folder||entry.kind==="file");
      return <li key={entry.location.ref}>
        <button data-file-path={entry.location.path} title={usable?entry.location.path:entry.kind==="symlink"?"Symbolic link — not followed":"Unavailable through Central's retrieval policy"} aria-label={folder?`${open?"Collapse":"Expand"} folder ${entry.name}`:entry.name} aria-expanded={folder?open:undefined} disabled={!usable}
          onClick={()=>folder?toggle(entry.location.path,!open):void onOpen(entry.location)}
          onKeyDown={event=>{if(folder&&(event.key==="ArrowRight"||event.key==="ArrowLeft")){event.preventDefault();event.stopPropagation();toggle(entry.location.path,event.key==="ArrowRight");}}}>
          {/* Finding 27: this used to render only for folders, so a file row
              at the same level sat ~13px left of its sibling folder rows —
              the disclosure glyph's width (8px) plus the row's own gap
              (6px). Rendering the spacer for every row, empty for files,
              keeps both kinds in one aligned column. */}
          <span className="file-disclosure" aria-hidden="true">{folder?(open?"⌄":"›"):""}</span><Glyph name={folder?"folder":"file"}/><span>{entry.name}</span>
        </button>
        {folder&&open&&<Directory path={entry.location.path} onOpen={onOpen} refresh={refresh} expanded={expanded} toggle={toggle}/>}
      </li>;
    })}
    {!reading.entries.length&&<li className="empty-directory">No files</li>}
    </ul>
  </div>;
}
