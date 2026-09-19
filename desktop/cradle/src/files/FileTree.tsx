import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {CentralLocation,NativeFileEntry} from "../kernel/types";
import {Glyph} from "../workspace/Glyph";
import {useListing,useListingInvalidation,useListingLoading} from "./listingStore";
import {LOCATION_DRAG_TYPE} from "./drag";

/** The file tree over the listing store (the retention law's cache tier,
 * 2026-09-19): listings are workspace-keyed and receipt-invalidated, a
 * collapsed folder keeps its children mounted-concealed (re-expansion is
 * instant from cache), and pending is ONE tree-level affordance — a smooth
 * single reading bar — never a per-node spinner cascade. */
export function FileTree({path,onOpen,refresh,expanded,onExpansion,onRootRef}:{onRootRef:(ref:string)=>void;path:string;onOpen:(location:CentralLocation)=>Promise<void>;refresh:number;expanded:string[];onExpansion:(paths:string[])=>void}) {
  const [openingError,setOpeningError]=useState<string>();
  const tree=useRef<HTMLDivElement>(null);
  const loading=useListingLoading();
  useListingInvalidation();
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
    {/* ONE tree-level loading affordance (the retention law): the bar stands
      * while any listing of this workspace is in flight and stays gone when
      * an expansion serves from cache — a single smooth indicator instead of
      * per-node spinners cascading down the tree. */}
    <div className="native-file-reading" data-reading={loading||undefined} role="status" aria-label="Reading files"/>
    <Directory key={path} onReading={onRootRef} path={path} onOpen={open} refresh={refresh} expanded={expanded} toggle={toggle}/>
  </div>;
}
function Directory({path,onOpen,refresh,expanded,toggle,onReading}:{onReading?:(ref:string)=>void;path:string;onOpen:(location:CentralLocation)=>Promise<void>;refresh:number;expanded:string[];toggle:(path:string,value:boolean)=>void}) {
  const {transport}=useKernel();
  const listing=useListing(transport,path,refresh);
  const reading=listing.reading;
  // Report the listing's ref once per distinct ref — the caller's callback
  // identity changes every render (it is an inline arrow), so guarding on
  // the value keeps this a report, not a render loop.
  const reported=useRef<string>();
  const notify=useRef(onReading);notify.current=onReading;
  useEffect(()=>{if(reading&&reported.current!==reading.location.ref){reported.current=reading.location.ref;notify.current?.(reading.location.ref);}},[reading]);
  if(listing.status==="error")return <p role="status">{listing.error}</p>;
  if(!reading)return <ul className="native-directory" aria-label="Files"/>;
  return <ul className="native-directory">
    {reading.entries.map((entry:NativeFileEntry)=>{const folder=entry.kind==="directory",open=expanded.includes(entry.location.path),usable=entry.retrieval_allowed&&(folder||entry.kind==="file");
      return <li key={entry.location.ref}>
        <button data-file-path={entry.location.path} title={usable?entry.location.path:entry.kind==="symlink"?"Symbolic link — not followed":"Unavailable through Central's retrieval policy"} aria-label={folder?`${open?"Collapse":"Expand"} folder ${entry.name}`:entry.name} aria-expanded={folder?open:undefined} disabled={!usable}
          // A file row carries its Central location, so it can be dropped
          // onto the agent chat (quoted into the draft) or a Technè scene —
          // the same payload Material rows carry (files/drag.ts).
          draggable={usable&&!folder}
          onDragStart={event=>{event.dataTransfer.setData(LOCATION_DRAG_TYPE,JSON.stringify(entry.location));event.dataTransfer.setData("text/plain",entry.location.path);event.dataTransfer.effectAllowed="copyLink";}}
          onClick={()=>folder?toggle(entry.location.path,!open):void onOpen(entry.location)}
          onKeyDown={event=>{if(folder&&(event.key==="ArrowRight"||event.key==="ArrowLeft")){event.preventDefault();event.stopPropagation();toggle(entry.location.path,event.key==="ArrowRight");}}}>
          {/* Finding 27: this used to render only for folders, so a file row
              at the same level sat ~13px left of its sibling folder rows —
              the disclosure glyph's width (8px) plus the row's own gap
              (6px). Rendering the spacer for every row, empty for files,
              keeps both kinds in one aligned column. */}
          <Glyph name={folder?"folder":"file"}/><span>{entry.name}</span>
        </button>
        {folder&&<FolderChildren path={entry.location.path} open={open} onOpen={onOpen} refresh={refresh} expanded={expanded} toggle={toggle}/>}
      </li>;
    })}
    {!reading.entries.length&&<li className="empty-directory">No files</li>}
    </ul>;
}
/** A folder's children stay mounted once expanded (the pane concealment law
 * applied to the tree): collapsing conceals them, re-expanding presents the
 * retained children instantly from the listing cache — no re-read, no
 * remount flash. A folder never expanded renders nothing at all. */
function FolderChildren({path,open,onOpen,refresh,expanded,toggle}:{path:string;open:boolean;onOpen:(location:CentralLocation)=>Promise<void>;refresh:number;expanded:string[];toggle:(path:string,value:boolean)=>void}) {
  const visited=useRef(false);
  if(open)visited.current=true;
  if(!visited.current)return null;
  return <div className="native-folder-children" hidden={!open}>
    <Directory path={path} onOpen={onOpen} refresh={refresh} expanded={expanded} toggle={toggle}/>
  </div>;
}
