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
  type ReactNode,
} from "react";
import "@epilogos/oi-design-system/point-cloud.css";
import { visuals, BROADCAST, type VisualsSnapshot } from "./store";
import { useKernel } from "../kernel/KernelProvider";

interface VisualsContextValue {
  snapshot: VisualsSnapshot;
}

const Context = createContext<VisualsContextValue>({ snapshot: visuals.get() });

export function useVisuals(): VisualsContextValue {
  return useContext(Context);
}

function resolveTheme(theme: VisualsSnapshot["theme"]): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: VisualsSnapshot["theme"]) {
  const resolved = resolveTheme(theme);
  if (resolved === "dark") document.body.dataset.theme = "dark";
  else delete document.body.dataset.theme;
}

// The appearance is applied synchronously at module load as well as by the
// pre-paint script in index.html: both resolve the same persisted choice,
// so a window (primary or detached) whose HTML lacks the inline script
// still lands on the right ground before the first React commit.
if (typeof document !== "undefined") applyTheme(visuals.get().theme);

export function VisualsProvider({ children }: { children: ReactNode }) {
  const kernel = useKernel();
  const [snapshot, setSnapshot] = useState<VisualsSnapshot>(() => visuals.get());

  useEffect(() => visuals.subscribe(setSnapshot), []);

  // Theme: resolve the choice onto the body and follow the system when asked.
  useEffect(() => {
    applyTheme(snapshot.theme);
    if (snapshot.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme("system");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [snapshot.theme]);

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

  const value = useMemo(() => ({ snapshot }), [snapshot]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
