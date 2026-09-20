import {useEffect, useRef, useState, useSyncExternalStore} from "react";
import {AdoptionController, type DesktopChoice} from "./adoptionController";
export function AdoptionFlow({controller, chooseGround, onClose, onConfigure, onApplied}: {
  controller: AdoptionController; chooseGround?: () => Promise<string | null>;
  onClose: () => void; onConfigure: () => void; onApplied: () => void;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const heading = useRef<HTMLHeadingElement>(null);
  const reported = useRef<string>();
  const [pickerError, setPickerError] = useState<string>();
  const [, tick] = useState(0);
  useEffect(() => {void controller.start();}, [controller]);
  useEffect(() => {heading.current?.focus();}, [state.step]);
  useEffect(() => {if (state.step !== "review") return; const timer = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(timer);}, [state.step]);
  useEffect(() => {
    const token = state.journal?.plan.review_token;
    if (token && token !== reported.current) {reported.current = token; onApplied();}
  }, [state.journal, onApplied]);
  const choice = state.discovery?.choices.find(row => row.id === state.selection.composition);
  const locked = !!state.busy || state.unresolved;
  const close = () => {if (controller.canClose()) onClose();};
  return <section className="config-drawer" role="dialog" aria-label="Install and set up this World" aria-busy={!!state.busy} data-adoption-flow onKeyDown={event => {if (event.key === "Escape" && !event.nativeEvent.isComposing) {event.stopPropagation(); close();}}}>
    <header><h3 ref={heading} tabIndex={-1}>Install and set up this World</h3><button type="button" disabled={!controller.canClose()} onClick={close}>Close</button></header>
    <p>Keep existing tools and Central. Choose what to add, review its effects, verify installation, then configure capabilities. Maintenance uses the same native owners; it does not restart your work.</p>
    {state.busy && <p role="status">{state.busy === "applying" ? "Applying the reviewed native plan. Closing or losing a reply does not roll it back." : state.busy === "preparing" ? "Preparing and checking the native Desktop offer; not installing it." : "Reading native state…"}</p>}
    {(state.error || pickerError) && <p role="alert">{state.error ?? pickerError}</p>}
    {state.step === "selection" && <form onSubmit={event => {event.preventDefault(); void controller.plan();}}>
      <h4>Recognised World</h4>
      <p>{state.discovery?.bound_ground ?? "No default Central is bound yet."}</p>
      <ul>{state.discovery?.products.map(product => <li key={product.id}>{product.title}: {product.present ? "native command present" : product.existing_executable ? "existing command available to retain" : "not installed"}</li>)}</ul>
      {state.discovery?.warnings.map(warning => <p key={warning}>{warning}</p>)}
      <button type="button" disabled={locked} onClick={() => void controller.refresh()}>Recognise again</button>
      <fieldset disabled={locked || !state.discovery}>
        <legend>Choose a useful composition</legend>
        <label>Composition<select value={state.selection.composition} onChange={event => controller.select({composition: event.target.value, products: [], remove_products: [], desktop: "keep", bundle: null, bundle_sha256: null})}>
          {state.discovery?.choices.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
        </select></label><p>{choice?.description}</p>
        {choice?.hosted ? <p>This is browser reading, not a local installation. The published site's Library is the entry; visiting it grants no local authority.</p> : <>
          {choice?.id === "custom" && <fieldset><legend>Individual products</legend>{state.discovery?.products.map(product => <label key={product.id}><input type="checkbox" checked={state.selection.products.includes(product.id)} onChange={event => controller.select({products: event.target.checked ? [...state.selection.products, product.id] : state.selection.products.filter(id => id !== product.id)})}/>{product.title} — {product.purpose}</label>)}</fieldset>}
          <label>Central directory<input value={state.selection.ground ?? ""} onChange={event => controller.select({ground: event.target.value})} placeholder={state.discovery?.suggested_ground}/></label>
          {chooseGround && <button type="button" onClick={() => {setPickerError(undefined); void chooseGround().then(path => {if (path) controller.select({ground: path});}).catch(error => setPickerError(String(error)));}}>Choose Central folder…</button>}
          <p>Select an existing recognised root, or a new empty directory. Existing content will not be overwritten.</p>
          <label>Desktop<select value={state.selection.desktop} onChange={event => controller.select({desktop: event.target.value as DesktopChoice})}>
            <option value="keep">Keep its current state</option><option value="add">Add Desktop</option><option value="remove">Remove Desktop; keep the World</option>
          </select></label>
          {(state.selection.desktop === "add" || choice?.id === "00/00") && state.discovery?.desktop.state !== "installed" && <div>
            <button type="button" onClick={() => void controller.prepareDesktop()}>Prepare verified Desktop download</button>
            <p>{state.selection.bundle ? "A checksum-qualified native bundle is prepared. Installation still requires review." : "Preparing downloads the native offer to staging. Nothing is installed by this button."}</p>
          </div>}
          {state.discovery?.products.some(product => product.managed) && <details><summary>Remove receipt-owned products</summary><p>Unselected products normally stay installed. Explicit removals retain human source and foreign installations.</p>{state.discovery.products.filter(product => product.managed).map(product => <label key={product.id}><input type="checkbox" checked={state.selection.remove_products.includes(product.id)} onChange={event => controller.select({remove_products: event.target.checked ? [...state.selection.remove_products, product.id] : state.selection.remove_products.filter(id => id !== product.id)})}/>Remove managed {product.title}</label>)}</details>}
        </>}
      </fieldset>
      <button type="submit" disabled={locked || !state.discovery}>Review effects and authority</button>{" "}
      <button type="button" disabled={locked} onClick={onConfigure}>Configure existing capabilities</button>{" "}
      <button type="button" onClick={close}>Cancel</button>
    </form>}
    {state.step === "review" && state.plan && <section aria-label="Installation review">
      {state.plan.notices.map(notice => <p key={notice}>{notice}</p>)}
      <ol>{state.plan.steps.map((step, index) => <li key={index}><strong>{step.title}</strong>{step.effects.map(effect => <p key={effect}>{effect}</p>)}
        {step.native_plan && <details><summary>Exact native effects and source</summary><pre>{JSON.stringify(step.native_plan, null, 2)}</pre></details>}
      </li>)}</ol>
      {state.plan.blocked.map(error => <p role="alert" key={error}>{error}</p>)}
      {!controller.canApply() && !state.busy && !state.plan.blocked.length && <p>The review expired. Go back and make a fresh plan; nothing is silently reapplied.</p>}
      <button type="button" disabled={locked} onClick={() => controller.back()}>Back</button>{" "}
      <button type="button" disabled={!controller.canApply()} onClick={() => void controller.apply()}>{choice?.hosted ? "Confirm no local installation" : "Apply this reviewed plan"}</button>{" "}
      <button type="button" disabled={!controller.canClose()} onClick={close}>Cancel</button>
    </section>}
    {state.step === "result" && <section aria-label="Installation result and recovery">
      <h4>{state.disposition === "verified" ? "Native installation verified" : state.disposition === "outcome_unknown" ? "Installation outcome needs a readback" : state.disposition === "hosted_entry" ? "No local installation needed" : "Installation is not complete"}</h4>
      <ul>{state.journal?.records.map((record, index) => <li key={index}>{state.journal!.plan.steps[index]?.title}: {record.state}{record.message && <p>{record.message}</p>}</li>)}</ul>
      <p>Installed files, active processes and actual provider/computer-use results are different. No session, microphone or provider starts automatically. A new Central binding takes effect on the next launch; open work keeps its current ground.</p>
      {state.unresolved && <p role="alert">Do not retry the write. Recheck native receipts. Closing and reopening keeps this recovery state.</p>}
      {state.disposition !== "hosted_entry" && <button type="button" disabled={!!state.busy} onClick={() => void controller.recheck()}>Recheck native effects</button>}{" "}
      <button type="button" disabled={locked} onClick={() => controller.back()}>Review remaining work</button>{" "}
      <button type="button" disabled={locked} onClick={onConfigure}>Configure capabilities</button>{" "}
      <button type="button" disabled={!controller.canClose()} onClick={close}>Return to work</button>
    </section>}
  </section>;
}
