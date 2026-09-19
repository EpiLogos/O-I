/**
 * The Technē summon seam (owner Wayfinder §13, T1/T2 contract): T1's Technē
 * HUD dispatches window CustomEvents —
 *
 *   "oi:techne-summon"          {kind: "library" | "verso" | "search"}
 *   "oi:techne-summon-closed"   {kind}
 *
 * and this component answers them through the surfaces that already exist:
 *
 *   library → the Library overlay, BROWSE (the columnar Web inventory);
 *   search  → the Library overlay, the gallery with the search focused;
 *   verso   → the current face subject's verso account, presented as an
 *             overlay in the Library's own scrim grammar over the untouched
 *             field.
 *
 * The listener is cheap and lives only while this surface is mounted; the
 * parent reconciles the mounting point (it stands beside the Library
 * overlay today). The verso's subject is resolved — never minted — in the
 * kernel's own order: the kernel's global focus subject first, then the ONE
 * wiki projection state's selection, then the host's workspace subject.
 * When nothing stands, the verso says NO SUBJECT and nothing is invented.
 *
 * Closing: the verso overlay dispatches closed {kind:"verso"} itself; the
 * Library overlay's hidden state is observed and dispatches closed
 * {kind:"library"} for a summon-presented Library (search reports the same,
 * as the same overlay presentation). Closing the verso changes nothing in
 * the field — identity preservation is the verso's own law (it only reads).
 */
import {useEffect, useRef, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {listFiles} from "../files/client";
import type {CentralLocation} from "../kernel/types";
import {ExpressionVerso} from "../expression/ExpressionVerso";
import {resolveVersoSubject, useVersoAccount, type VersoSubject} from "../expression/versoAccount";

export const TECHNE_SUMMON_EVENT = "oi:techne-summon";
export const TECHNE_SUMMON_CLOSED_EVENT = "oi:techne-summon-closed";

type SummonKind = "library" | "verso" | "search";

/** The last presentation ask the summon made, for a Library browser that
 * mounts after the ask (the overlay's browser is lazy). */
let summonView: "browse" | "gallery" | null = null;
export function lastSummonView(): "browse" | "gallery" | null { return summonView; }

/** The workspace context shape the host may pass (CradleFrame's context
 * subject / trail) — refs and labels only. */
export interface SummonHostContext {
  subject?: {ref?: string; kind?: string; title?: string; project?: string};
  trail?: {mode: string; label: string}[];
}

export function TechneSummonSurface(host: SummonHostContext & {onOpenLibrary: () => void}) {
  const kernel = useKernel();
  const [verso, setVerso] = useState<{subject: VersoSubject | null; trail: {mode: string; label: string}[] | undefined} | null>(null);
  const hostRef = useRef(host);
  hostRef.current = host;

  useEffect(() => {
    const onSummon = (event: Event) => {
      const kind = (event as CustomEvent<{kind?: SummonKind}>).detail?.kind;
      if (kind === "library" || kind === "search") {
        summonView = kind === "library" ? "browse" : "gallery";
        hostRef.current.onOpenLibrary();
        // A late-mounting Library browser reads the same ask at init; this
        // event answers an already-mounted one.
        window.dispatchEvent(new CustomEvent("oi:library-view", {detail: {view: summonView, focus: kind === "search" ? "search" : undefined}}));
        observeLibraryClose(kind);
      } else if (kind === "verso") {
        setVerso({subject: resolveVersoSubject(kernel.snapshot.focus.subject, hostRef.current.subject), trail: hostRef.current.trail});
      }
    };
    window.addEventListener(TECHNE_SUMMON_EVENT, onSummon);
    return () => window.removeEventListener(TECHNE_SUMMON_EVENT, onSummon);
  }, [kernel.snapshot.focus.subject]);

  // Escape closes the verso overlay — the Library's own overlay grammar.
  useEffect(() => {
    if (!verso) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") closeVerso(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [verso]);

  const closeVerso = () => {
    setVerso(null);
    window.dispatchEvent(new CustomEvent(TECHNE_SUMMON_CLOSED_EVENT, {detail: {kind: "verso"}}));
  };

  const account = useVersoAccount(kernel.transport, verso?.subject ?? null, verso?.trail);

  // Source opening: the ref resolves through the files seam BEFORE anything
  // opens — an unresolvable ref is a named refusal, never a guess — then
  // the frame's full cross-arrangement source cycle carries it (trail, mode
  // entry, centre tab) with the verso's subject as the place to return to.
  const openSourceRef = async (sourceRef: string) => {
    const subject = verso?.subject;
    if (!subject) return;
    try {
      let clean = sourceRef.replace(/^\/+/, "");
      if (clean.startsWith("central:source:")) {
        const rest = clean.slice("central:source:".length);
        const slash = rest.indexOf("/");
        const colon = slash < 0 ? -1 : rest.lastIndexOf(":", slash);
        clean = colon >= 0 ? rest.slice(colon + 1) : rest;
      }
      const slash = clean.lastIndexOf("/"), parent = slash < 0 ? "." : clean.slice(0, slash), name = clean.slice(slash + 1);
      const directory = await listFiles(kernel.transport, parent);
      const entry = directory.entries.find(candidate => candidate.name === name && candidate.kind === "file");
      if (!entry) throw new Error(`Central lists no "${name}" in ${parent === "." ? "its root" : parent} — this source ref is not a Central file path`);
      const location: CentralLocation = entry.location;
      window.dispatchEvent(new CustomEvent("oi:epi-open-source", {detail: {location, returnTo: {place: {ref: subject.ref, title: subject.title ?? subject.ref}}}}));
    } catch (cause) {
      window.dispatchEvent(new CustomEvent("oi:workspace-message", {detail: {message: cause instanceof Error ? cause.message : String(cause)}}));
    }
  };

  const openPage = (ref: string, title?: string) => {
    window.dispatchEvent(new CustomEvent("oi:epi-open-knowledge", {detail: {ref, title, project: verso?.subject?.project}}));
  };

  return <>
    {verso && <div className="verso-overlay" role="dialog" aria-modal="true" aria-label="The current subject's verso">
      <button className="verso-scrim" aria-label="Close the verso" onClick={closeVerso}/>
      <div className="verso-sheet" data-verso-subject-ref={verso.subject?.ref ?? ""} data-verso-open="true">
        <ExpressionVerso account={account}
          onOpenSourceRef={sourceRef => void openSourceRef(sourceRef)}
          onOpenPage={openPage}
          onClose={closeVerso}/>
      </div>
    </div>}
  </>;
}

/** Watch the Library overlay's own hidden state and report the summon's
 * surface as closed when it parks or closes. The observer attaches once the
 * overlay exists (the summon just asked for it) and detaches after one
 * close report. */
function observeLibraryClose(kind: SummonKind) {
  const attach = (attempt: number) => {
    const overlay = document.querySelector<HTMLElement>(".library-overlay");
    if (!overlay) { if (attempt < 20) requestAnimationFrame(() => attach(attempt + 1)); return; }
    const observer = new MutationObserver(() => {
      if (overlay.hidden) {
        observer.disconnect();
        window.dispatchEvent(new CustomEvent(TECHNE_SUMMON_CLOSED_EVENT, {detail: {kind}}));
      }
    });
    observer.observe(overlay, {attributes: true, attributeFilter: ["hidden"]});
  };
  requestAnimationFrame(() => attach(0));
}
