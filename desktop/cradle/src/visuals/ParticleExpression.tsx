/**
 * The point-cloud expression layer's React seam: one window host per window
 * (lazily created on the enabled path only), the theme controller
 * (light/dark/system resolved onto the `oi-desktop` body), and the shared
 * subscription to the visual-preference owner.
 *
 * The master switch is absolute: with the expression disabled no host, no
 * renderer, no `three` import exists — the never-enabled path allocates
 * nothing. Closing the controls does not stop the field; disabling does.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPointCloudHost, type PointCloudHost, type PointCloudInstance } from "@epilogos/oi-design-system/point-cloud/host";
import type { PointCloudPatch } from "@epilogos/oi-design-system/point-cloud/config";
import "@epilogos/oi-design-system/point-cloud.css";
import { visuals, BROADCAST, type VisualsSnapshot } from "./store";
import { useKernel } from "../kernel/KernelProvider";

interface VisualsContextValue {
  snapshot: VisualsSnapshot;
  host: PointCloudHost | null;
  /** Honest host-level failure (context creation or loss) — surfaced, not swallowed. */
  error: string | null;
}

const Context = createContext<VisualsContextValue>({ snapshot: visuals.get(), host: null, error: null });

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

/** One host per window, held across provider remounts (strict mode double
 * invocation must not churn WebGL contexts); dropped only when the
 * expression is disabled or the context is lost. */
let hostPromise: Promise<PointCloudHost> | null = null;
function obtainHost(onLost: (cause: Error) => void): Promise<PointCloudHost> {
  if (!hostPromise) {
    hostPromise = createPointCloudHost(window, { onLost }).catch((cause) => {
      hostPromise = null;
      throw cause;
    });
  }
  return hostPromise;
}
function dropHost() {
  const promise = hostPromise;
  hostPromise = null;
  void promise?.then((host) => host.dispose()).catch(() => {});
}

export function VisualsProvider({ children }: { children: ReactNode }) {
  const kernel = useKernel();
  const [snapshot, setSnapshot] = useState<VisualsSnapshot>(() => visuals.get());
  const [host, setHost] = useState<PointCloudHost | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // The host lives exactly while the expression is enabled.
  useEffect(() => {
    if (!snapshot.enabled) {
      dropHost();
      setHost((current) => {
        if (current) current.dispose();
        return null;
      });
      return;
    }
    let live = true;
    void obtainHost((cause) => {
      setError(cause.message);
      setHost(null);
    })
      .then((created) => {
        if (!live) return;
        setError(null);
        setHost(created);
      })
      .catch((cause) => {
        if (live) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      live = false;
    };
  }, [snapshot.enabled]);

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

  const value = useMemo(() => ({ snapshot, host, error }), [snapshot, host, error]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * One registered expression instance bound to this component's own element.
 * Window-scope fields (`scope="window"`) register no element and sample the
 * window's pointer passively; element scopes sample their own box. Config
 * updates flow through `instance.update` — the renderer never remounts on
 * parameter changes.
 */
export function ParticleField({
  id,
  tag,
  config,
  scope = "element",
  className,
  style,
  forceMotion = false,
  paused = false,
  onReady,
  children,
}: {
  id: string;
  tag?: string;
  config: PointCloudPatch;
  scope?: "window" | "element";
  className?: string;
  style?: CSSProperties;
  forceMotion?: boolean;
  paused?: boolean;
  /** Imperative handle for transitions (disperse, pause, renderOnce). */
  onReady?: (instance: PointCloudInstance) => void;
  children?: ReactNode;
}) {
  const { host } = useVisuals();
  const elementRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<PointCloudInstance | null>(null);
  const [mounted, setMounted] = useState(false);
  const configKey = JSON.stringify(config);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!host || !mounted) return;
    if (scope === "element" && !elementRef.current) return;
    const instance = host.createInstance({
      id,
      tag,
      target: scope === "element" ? elementRef.current : null,
      config,
      pointer: scope === "window" ? "window" : "element",
      forceMotion,
      paused,
    });
    instanceRef.current = instance;
    onReady?.(instance);
    return () => {
      instanceRef.current = null;
      instance.release();
    };
    // Instance identity is stable for the id/scope; config changes flow
    // through the update effect below, never a remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, mounted, id, scope]);

  useEffect(() => {
    instanceRef.current?.update(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, host]);

  if (scope === "element") {
    return (
      <div ref={elementRef} className={className} style={style} aria-hidden="true">
        {children}
      </div>
    );
  }
  return null;
}
