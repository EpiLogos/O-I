/**
 * The welcome frontstate — the first application of the point-cloud
 * expression layer. Before the workspace opens, the window holds one
 * window-scope field rendering the O:I mark from the shipped first saved
 * state (oi-logo-state.json). A click (or Enter/Escape) turns the field
 * live: relational attractors on, chaos and orbits up, a central disperse —
 * the mark flies apart and the app takes over.
 *
 * Honesty laws: the field is decorative (aria-hidden) while the enter
 * affordance is a real labelled control; prefers-reduced-motion skips the
 * flight entirely (click enters at once); if the expression layer cannot
 * start, the frontstate declines to appear rather than trapping the app
 * behind a broken scrim.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ParticleField, useVisuals } from "./ParticleExpression";
import type { PointCloudPatch } from "@epilogos/oi-design-system/point-cloud/config";
import type { PointCloudInstance } from "@epilogos/oi-design-system/point-cloud/host";
import logoState from "./oi-logo-state.json";
import "./welcome.css";

const DONE_KEY = "oi-cradle.welcome.v1";
const DISSOLVE_MS = 1050;
const LEAVE_MS = 420;

/** The click transition, in two stages: the mark first goes relational
 * (attractors on, orbits up) and starts to swirl while still tethered;
 * ~half a second later chaos takes over and the tether cuts — the cloud
 * flies apart as the app takes over. */
const RELATIONAL_PATCH: PointCloudPatch = {
  fluid: {
    turbulence: 1.3,
    curlSpeed: 1.0,
    dispersion: 0.7,
    returnSpeed: 1.3,
    viscosity: 0.965,
  },
  relational: {
    enabled: true,
    mode: "orbital",
    attractorCount: 3,
    attractorGravity: 2.4,
    orbitSpeed: 2.6,
    orbitRadius: 300,
    relationalSpin: 2.4,
    chaosFactor: 0.8,
    wanderSpeed: 1.4,
  },
  autoMorph: false,
  morphProgress: 1,
};

const CHAOS_PATCH: PointCloudPatch = {
  fluid: {
    turbulence: 2.0,
    curlSpeed: 1.4,
    dispersion: 1.6,
    returnSpeed: 0.15,
    viscosity: 0.98,
  },
  relational: {
    mode: "chaos",
    attractorGravity: 3.2,
    orbitSpeed: 3.2,
    orbitRadius: 460,
    relationalSpin: 3.0,
    chaosFactor: 3.2,
    wanderSpeed: 2.4,
  },
};

export function WelcomeField({ onEntered }: { onEntered?: () => void }) {
  const { snapshot, host, error } = useVisuals();
  const [phase, setPhase] = useState<"rest" | "dissolving" | "leaving" | "done">("rest");
  const instanceRef = useRef<PointCloudInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  // The gate is decided once, at mount: enter() itself writes the
  // done-mark, so re-reading it per render would unmount the overlay in
  // the middle of its own dissolve.
  const [gate] = useState(
    () => snapshot.enabled && snapshot.welcomeEnabled && !sessionStorage.getItem(DONE_KEY),
  );

  const show = gate && !error;

  const enter = useCallback(() => {
    if (sessionStorage.getItem(DONE_KEY)) return;
    sessionStorage.setItem(DONE_KEY, "1");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !instanceRef.current) {
      setPhase("done");
      return;
    }
    setPhase("dissolving");
    const instance = instanceRef.current;
    instance.update(RELATIONAL_PATCH);
    instance.disperse(0, 0, 1.4);
    timerRef.current = setTimeout(() => {
      instance.update(CHAOS_PATCH);
      instance.disperse(0, 0, 2.6);
    }, DISSOLVE_MS * 0.45);
    timerRef.current = setTimeout(() => setPhase("leaving"), DISSOLVE_MS);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Leaving fades the scrim, then hands the app over.
  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setPhase("done"), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "done") onEntered?.();
  }, [phase, onEntered]);

  useEffect(() => {
    if (!show || phase !== "rest") return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        enter();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [show, phase, enter]);

  if (!show || phase === "done") return null;

  const config = (logoState as unknown as { config: PointCloudPatch }).config;

  return (
    <div
      className={`oi-welcome${phase === "leaving" ? " oi-welcome-leaving" : ""}`}
    >
      {host && (
        <ParticleField
          id="oi-welcome-mark"
          tag="welcome"
          config={config}
          scope="window"
          onReady={(instance) => {
            instanceRef.current = instance;
          }}
        />
      )}
      <button
        type="button"
        className="oi-welcome-enter"
        onClick={enter}
        aria-label={phase === "rest" ? "O:I is ready. Open the app." : "Opening O:I"}
      >
        <span className="oi-welcome-mark" aria-hidden="true">O:I</span>
        <span className="oi-welcome-hint" role="status">
          {phase === "rest" ? "Click anywhere to open" : "Opening…"}
        </span>
      </button>
    </div>
  );
}
