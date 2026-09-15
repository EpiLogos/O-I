/**
 * The first-open frontstate uses the window's one production Expression
 * stage. The component owns the labelled control and reads kernel boot
 * truth; the engine owns the first paint and the complete enter sequence.
 * The workspace composes beneath it while it stands. No UI timer releases
 * a field that has not finished drawing, including under reduced motion.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useVisuals } from "./ParticleExpression";
import { useKernel } from "../kernel/KernelProvider";
import { useExpressionStage, type StagePresentation } from "../stage/ExpressionStage";
import "./welcome.css";

const DONE_KEY = "oi-cradle.welcome.v1";

function enteredThisSession(): boolean {
  try { return !!sessionStorage.getItem(DONE_KEY); } catch { return false; }
}

export function WelcomeField({ onEntered, onFieldReady, appReady = true }: {
  onEntered?: () => void;
  /** The native field painted, or cannot stand. The app may now compose beneath it. */
  onFieldReady?: () => void;
  appReady?: boolean;
}) {
  const { snapshot } = useVisuals();
  const { boot, stateSettled } = useKernel();
  const stage = useExpressionStage();
  const [phase, setPhase] = useState<"rest" | "entering" | "done">("rest");
  const [fieldReady, setFieldReady] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const presentationRef = useRef<StagePresentation | null>(null);
  const entering = useRef(false);
  const finished = useRef(false);
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
  // Read once: recording the completed opening must not cut off its flight.
  const [gate] = useState(
    () => snapshot.enabled && snapshot.welcomeEnabled && !enteredThisSession(),
  );

  const finish = useCallback((recordEntry = false) => {
    if (finished.current) return;
    finished.current = true;
    if (recordEntry) {
      try { sessionStorage.setItem(DONE_KEY, "1"); } catch { /* The current window still enters. */ }
    }
    const presentation = presentationRef.current;
    presentationRef.current = null;
    presentation?.release();
    setPhase("done");
    onEnteredRef.current?.();
  }, []);

  useEffect(() => {
    if (!gate || !snapshot.enabled || !snapshot.welcomeEnabled) {
      reportFieldReady();
      finish();
      return;
    }
    entering.current = false;
    setPhase("rest");
    setFieldReady(false);
    setFieldError(stage.error);
    if (stage.error) {
      reportFieldReady();
      return;
    }
    let presentation: StagePresentation | null;
    try {
      presentation = stage.present({
        id: "welcome.mark", plane: "frontstate", recipe: "oi.mark",
        appearance: "inverse-host", backdrop: "scene",
      });
    } catch (error: unknown) {
      setFieldError(error instanceof Error ? error.message : String(error));
      reportFieldReady();
      return;
    }
    // The stage may still be importing. Its ready API arrives with the
    // actual surface; an allocated canvas alone is not a painted field.
    if (!presentation) return;
    presentationRef.current = presentation;
    let current = true;
    void presentation.ready().then(() => {
      if (current) {
        setFieldReady(true);
        reportFieldReady();
      }
    }).catch((error: unknown) => {
      if (current) {
        setFieldError(error instanceof Error ? error.message : String(error));
        reportFieldReady();
      }
    });
    return () => {
      current = false;
      if (presentationRef.current === presentation) {
        presentationRef.current = null;
        presentation.release();
      }
    };
  }, [gate, snapshot.enabled, snapshot.welcomeEnabled, stage, finish, reportFieldReady]);

  const bootSettled = stateSettled && boot.phase !== "starting";
  const canEnter = bootSettled && appReady && (fieldReady || !!fieldError);
  const enter = useCallback(async () => {
    if (!canEnter || entering.current || finished.current) return;
    const presentation = presentationRef.current;
    if (fieldError || !presentation) {
      finish(true);
      return;
    }
    entering.current = true;
    setPhase("entering");
    try {
      const result = await presentation.play("welcome.enter");
      if (presentationRef.current !== presentation || finished.current) return;
      if (result.status === "completed") finish(true);
      else {
        entering.current = false;
        setPhase("rest");
        setFieldError("The opening was interrupted. You can continue into O:I.");
      }
    } catch (error: unknown) {
      if (presentationRef.current !== presentation || finished.current) return;
      entering.current = false;
      setPhase("rest");
      setFieldError(error instanceof Error ? error.message : String(error));
    }
  }, [canEnter, fieldError, finish]);

  const interaction = useRef({phase, canEnter, enter});
  interaction.current = {phase, canEnter, enter};
  useEffect(() => {
    if (!gate) return;
    // Keep the capture listener ahead of the lazily mounted workspace's
    // window handlers. Re-registering when readiness changes would let those
    // handlers receive a shortcut before the opening could contain it.
    const contain = (event: KeyboardEvent) => {
      const current = interaction.current;
      if (current.phase === "done") return;
      event.stopImmediatePropagation();
      if (event.type === "keydown" && ["Escape", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        if (current.phase === "rest" && current.canEnter) void current.enter();
      }
      // Tab and browser/OS defaults remain available. Only application
      // event propagation into the covered workspace is contained.
    };
    const events = ["keydown", "keyup", "keypress"] as const;
    for (const event of events) window.addEventListener(event, contain, { capture: true });
    return () => {
      for (const event of events) window.removeEventListener(event, contain, { capture: true });
    };
  }, [gate]);

  if (!gate || phase === "done") return null;

  const label = !bootSettled || !appReady ? "O:I is opening. One moment."
    : fieldError ? "Open O:I without the opening field."
    : !fieldReady ? "O:I is preparing the opening field."
    : phase === "rest" ? "O:I is ready. Open the app." : "Opening O:I";
  return (
    <div className="oi-welcome" data-phase={phase} data-field-ready={fieldReady} data-field-error={!!fieldError}>
      <button
        type="button"
        className="oi-welcome-enter"
        onClick={() => { void enter(); }}
        disabled={!canEnter || phase === "entering"}
        aria-label={label}
        aria-describedby={fieldError ? "oi-welcome-error" : undefined}
      >
        <span className="oi-welcome-mark" aria-hidden="true">O:I</span>
        <span className="oi-welcome-hint" role="status">
          {!bootSettled ? "Opening your world" : !appReady ? "Opening your workspace" : fieldError ? "Continue into O:I"
            : !fieldReady ? "Preparing the opening field" : phase === "rest" ? "Click anywhere to open" : "Opening…"}
        </span>
        {!bootSettled && boot.detail && <span className="oi-welcome-detail">{boot.detail}</span>}
      </button>
      {fieldError && <p className="oi-welcome-error" id="oi-welcome-error" role="alert">{fieldError}</p>}
    </div>
  );
}
