import {Glyph} from "../../workspace/Glyph";
import {groupByHarness,harnessVariant,type ConnectionFacts} from "./harness";

/**
 * The harness picker (10-SIDEBARS §4.1, amendment A1) — reusable: the chat
 * composer's harness chip and Factory's Tasks view use the same component.
 * Connections are grouped under their HARNESS name (Pi, Hermes, Gemini CLI,
 * Codex, Claude Code), derived from protocol and command; a connection's
 * free-text label is only the quiet second line, and a variant such as
 * "sandboxed" a quiet badge. Choosing a row asks its caller to connect it.
 */
export interface HarnessPickerProps {
 connections:ConnectionFacts[];
 /** The connection this conversation runs on now. */
 currentId?:string;
 onChoose:(id:string)=>void;
 /** A recorded native session the owner can resume instead. */
 resume?:{provider:string;onResume:()=>void};
 disabled?:boolean;
 reason?:string;
 label?:string;
 /** While the harnesses on this computer are still being read. */
 reading?:boolean;
}
export function HarnessPicker({connections,currentId,onChoose,resume,disabled,reason,label="Harness",reading}:HarnessPickerProps) {
 const groups=groupByHarness(connections);
 return <div className="harness-picker" role="group" aria-label={label}>
  {!groups.length&&!reading&&<p className="harness-picker-empty oi-note">No harness on this computer opens a conversation yet. Settings → Harnesses shows what AIKit finds; your draft stays.</p>}
  {groups.map(group=><section key={group.name} className="harness-group" aria-label={group.name}>
   <p className="harness-group-name">{group.name}</p>
   {group.connections.map(connection=>{
    const variant=harnessVariant(connection);
    const current=connection.id===currentId;
    return <button key={connection.id} type="button" role="menuitemradio" aria-checked={current} className="harness-row" disabled={disabled||current} title={reason} onClick={()=>onChoose(connection.id)}>
     <span className="harness-row-main"><span className="harness-row-name">{group.name}</span>{variant&&<span className="harness-variant">{variant}</span>}{current&&<Glyph name="check" size={11}/>}</span>
     {connection.standing
      ?<span className="harness-row-label" data-signed-in={connection.standing.signedIn===undefined?"unknown":String(connection.standing.signedIn)}>{connection.standing.said}</span>
      :connection.label&&connection.label!==connection.id&&<span className="harness-row-label">{connection.label}</span>}
    </button>;
   })}
  </section>)}
  {reading&&<p className="harness-picker-empty oi-note" role="status">Reading the harnesses on this computer…</p>}
  {resume&&<button type="button" className="harness-row harness-resume" onClick={resume.onResume}><span className="harness-row-main"><Glyph name="refresh" size={11}/><span className="harness-row-name">Resume the recorded session</span></span><span className="harness-row-label">The owner holds this conversation's native session; resuming keeps its identity.</span></button>}
 </div>;
}
