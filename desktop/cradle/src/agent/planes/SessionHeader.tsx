
/** The panel head: who accompanies (the mode's curated agent name) and where
 * it is situated. Nothing else — no conversation selector (the chat's own
 * first Send asks which conversation carries it), no region chrome: the
 * region itself is the shell's, one toggle in the topbar (⌘⇧B) and Escape. */
export function SessionHeader({agentName,situating}:{
 agentName:string;situating:string;
}) {
 return <>
  <header className="agent-head oi-context-head">
   <div className="agent-head-row">
    <div className="oi-context-head-title"><strong>{agentName}</strong><small>{situating}</small></div>
   </div>
  </header>
 </>;
}
