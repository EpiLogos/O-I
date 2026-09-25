/**
 * The visual-preference layer's React seam: the theme controller
 * (light/dark/system resolved onto the `oi-desktop` body) and the shared
 * subscription to the visual-preference owner. The field renderer itself
 * lives behind the Global Expression Stage (the native engine surface);
 * this provider owns preferences, not pixels.
 *
 * The master switch is absolute: with the expression disabled the stage
 * holds no engine surface — no canvas, no context, no simulation. Closing
 * the controls does not stop the field; disabling does.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import "@epilogos/oi-design-system/point-cloud.css";
import { visuals, BROADCAST, type VisualsSnapshot } from "./store";
import { ensureCustomThemeStyles } from "./customThemes";
import { PresentationClient, type PresentationState } from "./presentation";
import { currentArrangement, subscribeArrangement, visualObservation } from "./observations";
import { useKernel } from "../kernel/KernelProvider";

interface VisualsContextValue {
  snapshot: VisualsSnapshot;
  presentation: PresentationState;
  themes: PresentationClient;
  retryObservation: () => void;
}

const Context = createContext<VisualsContextValue | null>(null);
// A renderer-instance observation identifier, not an authenticated native window ID.
export const OBSERVER_ID = `view:${crypto.randomUUID()}`;

export function useVisuals(): VisualsContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("VisualsProvider is missing.");
  return value;
}

function resolveTheme(theme: VisualsSnapshot["theme"]): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: VisualsSnapshot["theme"], themeId: string | null) {
  const resolved = resolveTheme(theme);
  if (resolved === "dark") document.body.dataset.theme = "dark";
  else delete document.body.dataset.theme;
  // A named theme rides data-oi-theme: the house ground stays beneath it,
  // the theme's variable block (themes.css) sits above.
  if (themeId) document.body.dataset.oiTheme = themeId;
  else delete document.body.dataset.oiTheme;
}

// The appearance is applied synchronously at module load as well as by the
// pre-paint script in index.html: both resolve the same persisted choice,
// so a window (primary or detached) whose HTML lacks the inline script
// paints a cached appearance before the first React commit. The kernel read
// replaces this cache and supplies validated imported theme blocks.
if (typeof document !== "undefined") {
  const initial = visuals.get();
  applyTheme(initial.theme, initial.themeId);
}

export function VisualsProvider({ children }: { children: ReactNode }) {
  const kernel = useKernel();
  const [snapshot, setSnapshot] = useState<VisualsSnapshot>(() => visuals.get());
  const kernelRef = useRef(kernel); kernelRef.current = kernel;
  const [themes] = useState(() => new PresentationClient(
    op => kernelRef.current.apply(op),
    document => {ensureCustomThemeStyles(document.custom_themes); visuals.acceptKernelTheme(document.theme);},
    () => kernelRef.current.lastOpError(),
  ));
  const [presentation, setPresentation] = useState(themes.get);
  const [observationRetry, setObservationRetry] = useState(0);
  const retryObservation = () => setObservationRetry(value => value + 1);
  useEffect(() => themes.subscribe(setPresentation), [themes]);
  useEffect(() => {void themes.read();}, [themes, kernel.apply]);
  const themeReceipt = [...kernel.receipts].reverse().find(receipt => receipt.event === "presentation_changed")?.seq;
  useEffect(() => {if (themeReceipt !== undefined) void themes.read(false);}, [themes, themeReceipt]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = "";
    let inFlight = false;
    let live = true;
    const publish = async () => {
      if (!live || inFlight) return;
      const visual = visualObservation(visuals.get()), arrangement = currentArrangement();
      const serialized = JSON.stringify([visual,arrangement]);
      if (serialized === last) return;
      inFlight = true;
      await themes.observe(OBSERVER_ID,visual,arrangement);
      inFlight = false;
      if (!themes.get().observationError) last = serialized;
      // Capture changes that occurred while the native write was in flight.
      if (live && serialized !== JSON.stringify([visualObservation(visuals.get()),currentArrangement()])) schedule();
    };
    const schedule = () => {if(timer)clearTimeout(timer);timer=setTimeout(()=>void publish(),300);};
    const stopVisuals = visuals.subscribe(schedule), stopArrangement = subscribeArrangement(schedule);
    schedule();
    return () => {
      live=false; if(timer)clearTimeout(timer);stopVisuals();stopArrangement();
      // Best effort withdrawal; it never changes the arrangement or saved work.
      void themes.observe(OBSERVER_ID,null,null);
    };
  }, [themes, observationRetry]);

  useEffect(() => visuals.subscribe(setSnapshot), []);

  // Theme: resolve the choice onto the body and follow the system when asked.
  useEffect(() => {
    applyTheme(snapshot.theme, snapshot.themeId);
    if (snapshot.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme("system", snapshot.themeId);
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [snapshot.theme, snapshot.themeId]);

  // Native broadcast seam: accepted writes reach the other windows through
  // the existing Tauri event channel (small configs, never particles).
  useEffect(() => {
    if (kernel.transport.kind !== "tauri") return;
    let unlisten: (() => void) | undefined;
    let live = true;
    visuals.attachBroadcast((next) => {
      void import("@tauri-apps/api/event").then(({ emit }) => emit(BROADCAST, next)).catch(() => {});
    });
    void import("@tauri-apps/api/event")
      .then(({ listen }) => listen<VisualsSnapshot>(BROADCAST, (event) => visuals.receive(event.payload)))
      .then((stop) => {
        if (live) unlisten = stop;
        else stop();
      })
      .catch(() => {});
    return () => {
      live = false;
      unlisten?.();
      visuals.attachBroadcast(null);
    };
  }, [kernel.transport.kind]);

  const value = useMemo(() => ({ snapshot, presentation, themes, retryObservation }), [snapshot, presentation, themes]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
