/** System ingress for install/maintenance, followed by #406 capability setup. */
import {useMemo, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {configPlaneSource} from "./sourceHost";
import {AdoptionController} from "./adoptionController";
import {createAdoptionNative} from "./adoptionNative";
import {AdoptionFlow} from "./AdoptionFlow";
import {goTo} from "../workspace/settings/settingsNav";
// Recoverable presentation state, scoped to the native transport, not a second
// durable store. After process restart the native journal is authoritative.
const drafts = new WeakMap<object, AdoptionController>();
export function AdoptionEntry({onApplied}: {onApplied: () => void}) {
  const {transport} = useKernel();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const controller = useMemo(() => {
    const prior = drafts.get(transport);
    if (prior) return prior;
    const next = new AdoptionController(createAdoptionNative(op => kernelOp(transport, op)));
    drafts.set(transport, next); return next;
  }, [transport]);
  // Configuring capabilities after installation is the ordinary Settings
  // path (12-SETTINGS §2): the task sections stage changes and the one
  // review sheet applies them — no second ceremony.
  const configure = async () => {
    setError(undefined);
    try {
      const source = await configPlaneSource();
      if (source.kind !== "live") throw new Error("Native configuration owners are not bound. A settings fixture cannot configure an installed World.");
      setOpen(false);
      goTo({kind: "section", id: "skills"});
    } catch (cause) {setError(String(cause));}
  };
  return <section aria-label="Installation and capability setup" data-adoption-entry>
    <h3>Install, set up or maintain this World</h3>
    <p>Keep existing Central and native tools. Choose the useful composition instead of installing every product. Capability configuration remains a separate reviewed step.</p>
    {transport.kind === "unavailable"
      ? <p>Native installation is unavailable in this browser. Use the installed O:I terminal setup on the receiving machine; public Library reading needs no installer.</p>
      : <button type="button" className="settings-button is-primary" onClick={() => setOpen(true)}>Install and set up…</button>}
    {error && <p role="alert">{error}</p>}
    {open && <AdoptionFlow controller={controller} onApplied={onApplied} onClose={() => setOpen(false)} onConfigure={() => void configure()}
      chooseGround={transport.kind === "tauri" ? async () => {
        const {invoke} = await import("@tauri-apps/api/core");
        return invoke<string | null>("choose_central_folder");
      } : undefined}/>}
  </section>;
}
