import type {EncounterSessionHandle} from "../../encounter/session";
import {Tape,type TapeFocus} from "../tape/Tape";
import type {Tape as TapeData} from "../tape/model";
import type {JournalReading} from "../tape/journal";
import {openIntent,openObject} from "../objects/registry";
import {tapeEventObject} from "../objects/kinds";

/**
 * The Activity tab (10-SIDEBARS §4.4, repairs regression 6.1.4): the one tape
 * over the bound conversation's owner journal. Status → Preview → Takeover:
 * this is the Preview depth. A row's Open goes to its object page (§4.7).
 */
export function ActivityTab({session,tape,reading,focus,onChat}:{session?:EncounterSessionHandle;tape:TapeData;reading?:JournalReading;focus?:TapeFocus;onChat?:()=>void}) {
 const live=session?.state.status?.state==="TurnInFlight"||session?.state.status?.state==="InterruptRequested";
 const binding=session?{project:session.state.project,ref:session.state.agentSession}:undefined;
 return <div className="agent-plane panel-activity" data-plane="Activity">
  <Tape tape={tape} live={live} focus={focus} loading={!!session&&!reading?.complete&&!reading?.error} error={reading?.error} onRetry={reading?.retry}
   empty={session?<p className="tape-note">Nothing has happened in this conversation yet.</p>:<p className="tape-note">No conversation is open here. {onChat&&<button type="button" className="oi-action" onClick={onChat}>Start one in Chat</button>}</p>}
   onInspect={(row,_call,event)=>{if(binding)openObject(tapeEventObject(row,binding),openIntent(event));}}/>
 </div>;
}
