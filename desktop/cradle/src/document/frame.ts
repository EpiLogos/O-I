/**
 * Shared experiential-frame plumbing (DOCUMENT-SURFACE.md): the injected
 * page scripts every document frame carries, and the bounded host-read
 * bridge. Used by the file material host (MaterialSurface) and the source
 * document host (SourceSurface's rendered view) — one set of page-side
 * laws, no per-form variants.
 */
import { useCallback, useEffect, useRef, type RefObject } from "react";
import pageContextScript from "../context/page-context.js?raw";
import documentHostScript from "../context/document-host.js?raw";

/** The observation + document-host scripts every rendered document frame
 * carries. Presentation-only: they observe and answer the host, and grant
 * the page nothing. */
export const documentScripts = `<script>${pageContextScript}</script><script>${documentHostScript}</script>`;

export interface FrameIsland { text: string | null; revision: number | null; documentId: string | null }

/** The document host bridge read: one bounded question to the rendered
 * frame — what does the page's own payload island hold right now. The
 * page gains nothing; the host learns only what the page already keeps. */
export function useDocumentHostRead(frame: RefObject<HTMLIFrameElement | null>, active: boolean) {
  const requests = useRef(new Map<string, {resolve: (value: FrameIsland | null) => void; timer: ReturnType<typeof setTimeout>}>());
  useEffect(() => {
    if (!active) return;
    const receive = (event: MessageEvent) => {
      const value = event.data;
      if (value?.type !== "oi:document-host-response") return;
      const pending = requests.current.get(value.request);
      if (!pending || !frame.current || event.source !== frame.current.contentWindow) return;
      requests.current.delete(value.request);
      clearTimeout(pending.timer);
      pending.resolve(value.result);
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      for (const pending of requests.current.values()) { clearTimeout(pending.timer); pending.resolve(null); }
      requests.current.clear();
    };
  }, [active, frame]);
  return useCallback(() => {
    const target = frame.current;
    if (!target?.contentWindow) return Promise.resolve(null);
    return new Promise<FrameIsland | null>(resolve => {
      const request = crypto.randomUUID();
      const timer = setTimeout(() => { requests.current.delete(request); resolve(null); }, 1500);
      requests.current.set(request, {resolve, timer});
      target.contentWindow?.postMessage({type: "oi:document-host-request", request, op: "read"}, "*");
    });
  }, [frame]);
}
