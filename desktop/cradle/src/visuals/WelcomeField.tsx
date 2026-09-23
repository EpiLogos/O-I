/**
 * Opening splash. The document theme stays the saved appearance the whole
 * time (prepaint and VisualsProvider own `data-theme`). This overlay owns
 * the opposite ground, the static mark, and the enter handoff:
 *
 *   rest     — opposite of the saved theme; the mark fades in once it can paint
 *   entering — ground and mark ink move to the saved theme. Logo opacity
 *              starts about 0.2s later and eases out across that move.
 *              `data-oi-opening` is cleared as the gesture starts, while
 *              the splash still covers the window, so the app underneath
 *              is already final
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

function transitionTimeMs(node: HTMLElement, property: string, which: "duration" | "delay"): number {
  const style = getComputedStyle(node);
  const properties = style.transitionProperty.split(",").map((item) => item.trim());
  const listed = (which === "duration" ? style.transitionDuration : style.transitionDelay).split(",").map((item) => item.trim());
  const index = properties.indexOf(property);
  const raw = (index >= 0 ? listed[index] : listed[0]) ?? "";
  const amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount)) return which === "delay" ? 0 : 700;
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
  const [phase, setPhase] = useState<"rest" | "entering" | "done">("rest");
  const [markReady, setMarkReady] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  const [markIn, setMarkIn] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const entering = useRef(false);
  const finished = useRef(false);
  const groundReleased = useRef(false);
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

  // The opposite ground is only for the covered rest state. Enter releases
  // it immediately: the splash is still opaque (the fade is delayed), and
  // the document underneath is already the saved theme.
  useEffect(() => {
    if (!gate || phase !== "rest" || groundReleased.current) return;
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

  // The mask blob is not paintable on the frame it is created. Starting the
  // fade then lets the image pop in at full opacity and the animation replay
  // from zero. Hold the mark invisible until it has decoded and painted once.
  useEffect(() => {
    if (!maskUrl) return;
    let live = true;
    const image = new Image();
    image.src = maskUrl;
    const reveal = () => {
      if (!live) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { if (live) setMarkIn(true); });
      });
    };
    image.decode().then(reveal, reveal);
    return () => { live = false; };
  }, [maskUrl]);

  const completeEnter = useCallback(() => finish(true), [finish]);

  useEffect(() => {
    if (phase !== "entering") return;
    const node = rootRef.current;
    if (!node) return;
    let settled = false;
    const settle = (event?: Event) => {
      if (event instanceof TransitionEvent && (event.target !== node || event.propertyName !== "opacity")) return;
      if (settled) return;
      settled = true;
      completeEnter();
    };
    node.addEventListener("transitionend", settle);
    const backup = window.setTimeout(settle, transitionTimeMs(node, "opacity", "delay") + transitionTimeMs(node, "opacity", "duration") + 48);
    return () => {
      node.removeEventListener("transitionend", settle);
      window.clearTimeout(backup);
    };
  }, [phase, completeEnter]);

  const bootSettled = stateSettled && boot.phase !== "starting";
  const canEnter = bootSettled && appReady && (markReady || !!markError);
  const enter = useCallback(() => {
    if (!canEnter || entering.current || finished.current || phase !== "rest") return;
    entering.current = true;
    groundReleased.current = true;
    document.body.removeAttribute("data-oi-opening");
    setPhase("entering");
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
      data-mark={markIn ? "in" : "hold"}
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
