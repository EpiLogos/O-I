/** The mode catalogue as the body holds it: read once from the host, kept, and handed to the symbols' voices with the reason when it is not
 * there. The Expressions body reaches the kernel only through its host's relay (kernelExpressions.ts), so the reader is handed in at
 * boot (app.ts); a body that is not hosted has no reader and says so. Nothing here parses a mode: modeCatalogue.ts does. */
import {parseModeCatalogue,type ModeCatalogue} from './modeCatalogue';

export type ModeStoreReading={catalogue:ModeCatalogue|null;why:string|null};
export type ModeReader=()=>Promise<unknown>;

export const NOT_HOSTED='This Expressions body is not hosted, so there is no kernel to read the mode catalogue from';
const READING='The mode catalogue is being read from the kernel';
let reader:ModeReader|null=null;
let state:ModeStoreReading&{started:boolean}={catalogue:null,why:NOT_HOSTED,started:false};
const listeners=new Set<()=>void>();
const publish=(next:ModeStoreReading&{started:boolean})=>{state=next;for(const listener of [...listeners])listener();};

/** Hand the body its way to the kernel's `ql music modes` reading. A new reader starts the store afresh. */
export function setModeCatalogueReader(read:ModeReader|null){
 reader=read;
 state={catalogue:null,why:read?null:NOT_HOSTED,started:false};
}

/** The catalogue as it stands. The first look starts the one read; until it answers the reason says it is being read. */
export function modeCatalogueReading():ModeStoreReading{
 if(reader&&!state.started){
  const read=reader;
  publish({catalogue:null,why:READING,started:true});
  void read().then(document=>{
   if(reader!==read)return;
   const parsed=parseModeCatalogue(document);
   publish(parsed.ok?{catalogue:parsed.catalogue,why:null,started:true}:{catalogue:null,why:parsed.refusal,started:true});
  },error=>{
   if(reader!==read)return;
   publish({catalogue:null,why:`The kernel could not be asked for the mode catalogue: ${error instanceof Error?error.message:String(error)}`,started:true});
  });
 }
 return {catalogue:state.catalogue,why:state.why};
}

/** Read the catalogue again (after a refusal, or when the owner's catalogue may have moved). */
export function refreshModeCatalogue(){state={catalogue:null,why:reader?null:NOT_HOSTED,started:false};for(const listener of [...listeners])listener();}

/** Be told when the reading changes (so the voices follow it). */
export function onModeCatalogue(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
