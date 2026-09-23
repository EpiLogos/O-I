/**
 * THE SHARED JOURNAL READER — one incremental reading of an encounter's owner
 * journal (`aikit encounter read`) per session, shared by every presenter:
 * the Activity tape, the status line, the chat's work marks and Factory's Run
 * tape and Trajectory page (lane 3). Nothing here is a desktop store of its
 * own: the events are the owner's, read in cursor order and never rewritten.
 *
 * ── API ──────────────────────────────────────────────────────────────────
 *   useEncounterJournal(binding, trigger) → JournalReading
 *       binding: {project, ref} of the AgentSession (undefined = nothing)
 *       trigger: any value that changes when the session may have moved —
 *       pass the shared session's reading (encounter/session.ts polls it), so
 *       the journal follows the one existing poll loop and adds none of its own.
 *   useTape(binding, trigger) → {tape, reading}   (model.ts over the journal)
 *   readJournalEvent(transport, project, ref, cursor) → one event (object pages)
 *
 * Time: events carry the owner's `observed_at_ms` when the owner stamps it.
 * Otherwise `seenAt(cursor)` is the moment THIS window first read an event
 * that arrived after the initial history load — history read in bulk has no
 * observed time and none is invented.
 */
import {useEffect,useMemo,useSyncExternalStore} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import type {KernelTransportStatus} from "../../kernel/types";
import {encounter,type JournalPage} from "../../encounter/client";
import {tapeFromJournal,type JournalEventLike,type Tape} from "./model";

export interface JournalBinding {project:string;ref:string}
export interface JournalReading {
 events:JournalEventLike[];
 /** The first complete read reached the journal's end. */
 complete:boolean;
 loading:boolean;
 error?:string;
 seenAt:(cursor:number)=>number|undefined;
 /** Read again now (after an error, or on demand). */
 retry:()=>void;
}
const PAGE=256;

class JournalReader {
 private listeners=new Set<()=>void>();
 private seen=new Map<number,number>();
 private after=0;private pulling=false;private again=false;
 state:JournalReading;
 constructor(private transport:KernelTransportStatus,private binding:JournalBinding){
  this.state={events:[],complete:false,loading:false,seenAt:cursor=>this.seen.get(cursor),retry:()=>void this.pull()};
 }
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 snapshot=()=>this.state;
 bind(transport:KernelTransportStatus){this.transport=transport;}
 private set(patch:Partial<JournalReading>){this.state={...this.state,...patch};for(const listener of [...this.listeners])listener();}
 /** Read every event after the last one held, page by page. Coalesces:
  *  a pull requested while one runs repeats once when it lands. */
 pull=async()=>{
  if(this.pulling){this.again=true;return;}
  this.pulling=true;this.set({loading:true});
  try{
   do{
    this.again=false;
    for(;;){
     const page=await encounter<JournalPage>(this.transport,this.binding.project,{action:"read",agent_session:this.binding.ref,after:this.after,limit:PAGE});
     if(page.events.length){
      const now=Date.now();
      if(this.state.complete)for(const event of page.events)if(!this.seen.has(event.cursor))this.seen.set(event.cursor,now);
      this.after=Math.max(this.after,page.next_cursor,page.events[page.events.length-1].cursor);
      this.set({events:[...this.state.events,...page.events.filter(event=>event.cursor>(this.state.events[this.state.events.length-1]?.cursor??0))],error:undefined});
     }
     if(!page.more)break;
    }
    if(!this.state.complete)this.set({complete:true});
   }while(this.again);
  }catch(error){this.set({error:String(error)});}
  finally{this.pulling=false;this.set({loading:false});}
 };
}

const readers=new Map<string,JournalReader>();
const keyOf=(binding:JournalBinding)=>`${binding.project}:${binding.ref}`;
const noSubscribe=()=>()=>{};
const noSnapshot=()=>undefined;

export function useEncounterJournal(binding:JournalBinding|undefined,trigger?:unknown):JournalReading|undefined {
 const kernel=useKernel();
 const project=binding?.project,ref=binding?.ref;
 const reader=useMemo(()=>{
  if(project===undefined||!ref)return undefined;
  const key=keyOf({project,ref});
  let held=readers.get(key);
  if(!held){held=new JournalReader(kernel.transport,{project,ref});readers.set(key,held);}
  held.bind(kernel.transport);
  return held;
 },[kernel.transport,project,ref]);
 useEffect(()=>{if(reader)void reader.pull();},[reader,trigger]);
 return useSyncExternalStore(reader?reader.subscribe:noSubscribe,reader?reader.snapshot:noSnapshot);
}

export function useTape(binding:JournalBinding|undefined,trigger?:unknown):{tape:Tape;reading?:JournalReading} {
 const reading=useEncounterJournal(binding,trigger);
 const tape=useMemo(()=>tapeFromJournal(reading?.events??[],{seenAt:reading?.seenAt}),[reading?.events,reading?.seenAt]);
 return {tape,reading};
}

/** One exact journal event by cursor — how an object page re-reads a tool
 *  call or message from the owner instead of carrying a copy. */
export async function readJournalEvent(transport:KernelTransportStatus,project:string,ref:string,cursor:number):Promise<JournalEventLike|undefined> {
 const page=await encounter<JournalPage>(transport,project,{action:"read",agent_session:ref,after:Math.max(0,cursor-1),limit:1});
 return page.events.find(event=>event.cursor===cursor);
}
