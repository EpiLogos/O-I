/**
 * Opening splash. The document theme stays the saved appearance the whole
 * time (prepaint and VisualsProvider own `data-theme`). This overlay owns
 * the opposite ground, the static mark, and the enter handoff:
 *
 *   rest      — fully opaque, opposite of the saved theme
 *   flipping  — ground and mark ink move together to the saved theme;
 *               the overlay stays opaque, so the app cannot show through
 *   revealing — colors have settled, `data-oi-opening` is already gone,
 *               and only opacity fades, onto an app that is already final
 *
 * The expression stage is not used here. Inline loading status is Loading.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useVisuals } from "./ParticleExpression";
import { useKernel } from "../kernel/KernelProvider";
import { OPENING_SPLASH_URL, stippleMaskUrl } from "./openingMark";
import "./welcome.css";

const DONE_KEY = "oi-cradle.welcome.v1";

function enteredThisSession(): boolean {
  try { return !!sessionStorage.getItem(DONE_KEY); } catch { return false; }
}

function transitionPropertyMs(node: HTMLElement, property: string): number {
  const style = getComputedStyle(node);
  const properties = style.transitionProperty.split(",").map((item) => item.trim());
  const durations = style.transitionDuration.split(",").map((item) => item.trim());
  const index = properties.indexOf(property);
  const raw = (index >= 0 ? durations[index] : durations[0]) ?? "";
  const amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount)) return 700;
  return raw.endsWith("ms") ? amount : amount * 1000;
}

export function WelcomeField({ onEntered, onFieldReady, appReady = true }: {
  onEntered?: () => void;
  /** The splash is painted, or cannot be. The app may compose beneath it. */
  onFieldReady?: () => void;
  appReady?: boolean;
}) {
  const { snapshot } = useVisuals();
  const { boot, stateSettled } = useKernel();
  const [phase, setPhase] = useState<"rest" | "flipping" | "revealing" | "done">("rest");
  const [markReady, setMarkReady] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const entering = useRef(false);
  const finished = useRef(false);
  const flipSettled = useRef(false);
  const onEnteredRef = useRef(onEntered);
  onEnteredRef.current = onEntered;
  const onFieldReadyRef = useRef(onFieldReady);
  onFieldReadyRef.current = onFieldReady;
  const fieldNotified = useRef(false);
  const reportFieldReady = useCallback(() => {
    if (fieldNotified.current) return;
    fieldNotified.current = true;
    onFieldReadyRef.current?.();
  }, []);
  const [gate] = useState(
    () => snapshot.enabled && snapshot.welcomeEnabled && !enteredThisSession(),
  );

  const finish = useCallback((recordEntry = false) => {
    if (finished.current) return;
    finished.current = true;
    if (recordEntry) {
      try { sessionStorage.setItem(DONE_KEY, "1"); } catch { /* The current window still enters. */ }
    }
    document.body.removeAttribute("data-oi-opening");
    setPhase("done");
    onEnteredRef.current?.();
  }, []);

  useEffect(() => {
    if (finished.current) return;
    if (!gate || !snapshot.enabled || !snapshot.welcomeEnabled) {
      reportFieldReady();
      finish();
    }
  }, [gate, snapshot.enabled, snapshot.welcomeEnabled, finish, reportFieldReady]);

  // Reinforce the prepaint ground while the overlay is opaque. The reveal
  // clears it itself, before the fade, so this must not put it back.
  useEffect(() => {
    if (!gate || phase === "revealing" || phase === "done") return;
    document.body.setAttribute("data-oi-opening", "true");
  }, [gate, phase]);

  useEffect(() => {
    if (!gate) return;
    let live = true;
    const image = new Image();
    image.src = OPENING_SPLASH_URL;
    void image.decode().then(async () => {
      if (!live) return;
      const url = await stippleMaskUrl(image);
      if (!live) { URL.revokeObjectURL(url); return; }
      setMaskUrl(url);
      setMarkReady(true);
      reportFieldReady();
    }).catch((error: unknown) => {
      if (!live) return;
      setMarkError(error instanceof Error ? error.message : String(error));
      reportFieldReady();
    });
    return () => { live = false; };
  }, [gate, reportFieldReady]);

  useEffect(() => () => { if (maskUrl) URL.revokeObjectURL(maskUrl); }, [maskUrl]);

  const beginReveal = useCallback(() => {
    if (finished.current || flipSettled.current) return;
    flipSettled.current = true;
    // The overlay is still fully opaque and already on the saved theme.
    // Drop the inverse body ground before any pixel of the app is visible.
    document.body.removeAttribute("data-oi-opening");
    setPhase("revealing");
  }, []);

  const completeReveal = useCallback(() => finish(true), [finish]);

  useEffect(() => {
    if (phase !== "flipping" && phase !== "revealing") return;
    const node = rootRef.current;
    if (!node) return;
    const property = phase === "flipping" ? "background-color" : "opacity";
    const settle = phase === "flipping" ? beginReveal : completeReveal;
    let settled = false;
    const onEnd = (event: Event) => {
      if (!(event instanceof TransitionEvent) || event.target !== node || event.propertyName !== property) return;
      if (settled) return;
      settled = true;
      settle();
    };
    node.addEventListener("transitionend", onEnd);
    const backup = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      settle();
    }, transitionPropertyMs(node, property) + 48);
    return () => {
      node.removeEventListener("transitionend", onEnd);
      window.clearTimeout(backup);
    };
  }, [phase, beginReveal, completeReveal]);

  const bootSettled = stateSettled && boot.phase !== "starting";
  const canEnter = bootSettled && appReady && (markReady || !!markError);
  const enter = useCallback(() => {
    if (!canEnter || entering.current || finished.current || phase !== "rest") return;
    entering.current = true;
    setPhase("flipping");
  }, [canEnter, phase]);

  const interaction = useRef({ phase, canEnter, enter });
  interaction.current = { phase, canEnter, enter };
  useEffect(() => {
    if (!gate) return;
    const contain = (event: KeyboardEvent) => {
      const current = interaction.current;
      if (current.phase === "done") return;
      event.stopImmediatePropagation();
      if (event.type === "keydown" && ["Escape", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        if (current.phase === "rest" && current.canEnter) current.enter();
      }
    };
    const events = ["keydown", "keyup", "keypress"] as const;
    for (const event of events) window.addEventListener(event, contain, { capture: true });
    return () => {
      for (const event of events) window.removeEventListener(event, contain, { capture: true });
    };
  }, [gate]);

  if (!gate || phase === "done") return null;

  const label = !bootSettled || !appReady ? "O:I is opening. One moment."
    : markError ? "Open O:I without the opening mark."
    : !markReady ? "O:I is preparing the opening mark."
    : phase === "rest" ? "O:I is ready. Open the app." : "Opening O:I";
  const maskStyle = maskUrl ? { "--oi-welcome-mask": `url("${maskUrl}")` } as CSSProperties : undefined;
  return (
    <div
      ref={rootRef}
      className="oi-welcome"
      data-phase={phase}
      data-field-ready={markReady}
      data-field-error={!!markError}
    >
      <button
        type="button"
        className="oi-welcome-enter"
        onClick={enter}
        disabled={!canEnter || phase !== "rest"}
        aria-label={label}
        aria-describedby={markError ? "oi-welcome-error" : undefined}
      >
        {maskUrl && <span className="oi-welcome-logo" style={maskStyle} aria-hidden="true" />}
        <span className="oi-welcome-hint" role="status">
          {!bootSettled ? "Opening your world" : !appReady ? "Opening your workspace" : markError ? "Continue into O:I"
            : !markReady ? "Preparing the opening mark" : phase === "rest" ? "Click anywhere to open" : "Opening…"}
        </span>
        {!bootSettled && boot.detail && <span className="oi-welcome-detail">{boot.detail}</span>}
      </button>
      {markError && <p className="oi-welcome-error" id="oi-welcome-error" role="alert">{markError}</p>}
    </div>
  );
}
