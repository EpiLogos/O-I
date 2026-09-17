/** Test-only host for the real component, provider, client and HTTP bridge.
 * Responses are controlled by the browser test. This is D, not owner proof;
 * this HTML is never an entry point of the production build. */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { KernelProvider } from "../src/kernel/KernelProvider";
import { SearchOverlay } from "../src/knowledge/SearchOverlay";
import type { KnowledgeAddress } from "../src/kernel/types";
import "@epilogos/oi-design-system/tokens.css";

window.__OI_KERNEL_BRIDGE__ = `${location.origin}/__search_fixture`;
const observed = { opened: [] as {address: KnowledgeAddress; title: string; project?: string}[] };
Object.assign(window, { __SEARCH_TEST__: observed });
function Fixture() {
  const [open, setOpen] = useState(false);
  const [leader, setLeader] = useState(false);
  const project = new URLSearchParams(location.search).get("project") ?? undefined;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setOpen(value => !value);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return <main style={{fontFamily:"var(--oi-font-sans)",color:"var(--oi-foreground)",background:"var(--oi-canvas-ground)",minHeight:"100vh",padding:"var(--oi-space-6)",boxSizing:"border-box"}}>
    <p>Component contract fixture · controlled transport · not native-suite evidence</p>
    <h1>A place to continue thinking</h1>
    <textarea aria-label="Writing before search" defaultValue="The source and the thought remain here while I find what comes next." style={{width:"80%",height:"240px",background:"var(--oi-sidebar-ground)",color:"var(--oi-foreground)",border:"1px solid var(--oi-hairline)",padding:"var(--oi-space-4)",font:"inherit"}}/>
    <p>Press Control/Command K to summon the production search component.</p>
    {open && <SearchOverlay leader={leader} onLeaderChange={setLeader} project={project} onClose={() => setOpen(false)} onOpen={async(address,title,scope) => { observed.opened.push({address,title,project:scope}); }}/>} 
  </main>;
}
createRoot(document.getElementById("root")!).render(<KernelProvider><Fixture/></KernelProvider>);
