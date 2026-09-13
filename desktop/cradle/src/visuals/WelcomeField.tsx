/**
 * The welcome frontstate — the first application of the Global Expression
 * Stage. The mark is a stage presentation of the "oi.mark" recipe on the
 * frontstate plane; the enter flight is the authored "welcome.enter"
 * sequence (recipes.ts — this component never writes physics). The
 * component owns only the DOM truth — the ground, the labelled enter
 * control, and the kernel's truthful opening status — plus the hand-off
 * timing.
 *
 * One continuous load: the mark appears immediately, stands through the
 * kernel's `app.opening` (the hint says so truthfully), and on `app.ready`
 * becomes "click to open" (first session) — no second loader, no visual
 * hand-off, no WebGL teardown between boot states.
 *
 * Honesty laws: the field is decorative (aria-hidden) while the enter
 * affordance is a real labelled control; the control opens only once the
 * kernel has settled; prefers-reduced-motion skips the flight entirely
 * (click enters at once); if the expression layer cannot start, the
 * frontstate declines to appear rather than trapping the app behind a
 * broken scrim.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useVisuals } from "./ParticleExpression";
import { useExpressionStage, type StagePresentation } from "../stage/ExpressionStage";
import { onExpressionCue } from "../stage/cues";
import "./welcome.css";

const DONE_KEY = "oi-cradle.welcome.v1";
const DISSOLVE_MS = 1050;
const LEAVE_MS = 420;

export function WelcomeField({ onEntered }: { onEntered?: () => void }) {
  const { snapshot, host, error } = useVisuals();
  const stage = useExpressionStage();
  const [phase, setPhase] = useState<"rest" | "dissolving" | "leaving" | "done">("rest");
  const [booting, setBooting] = useState(true);
  const [bootDetail, setBootDetail] = useState<string | undefined>(undefined);
  const presentationRef = useRef<StagePresentation | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  // The gate is decided once, at mount: enter() itself writes the
  // done-mark, so re-reading it per render would unmount the overlay in
  // the middle of its own dissolve.
  const [gate] = useState(
    () => snapshot.enabled && snapshot.welcomeEnabled && !sessionStorage.getItem(DONE_KEY),
  );

  const show = gate && !error;

  // The kernel states the boot truth as cues; the frontstate only listens.
  useEffect(() => onExpressionCue((cue) => {
    if (cue.kind === "app.opening") {
      setBooting(true);
      setBootDetail(cue.detail);
    }
    if (cue.kind === "app.ready") setBooting(false);
  }), []);

  // The mark is a stage presentation (frontstate plane, "oi.mark"
  // recipe); it stands exactly while the frontstate does. `host` is a
  // dependency because a lazily-arriving host enables a late first
  // presentation; a lost host releases it through the stage.
  useEffect(() => {
    if (!show) return;
    const presentation = stage.present({ id: "welcome.mark", plane: "frontstate", recipe: "oi.mark" });
    presentationRef.current = presentation;
    return () => {
      presentationRef.current = null;
      presentation?.release();
    };
  }, [show, stage, host]);

  const enter = useCallback(() => {
    if (sessionStorage.getItem(DONE_KEY) || booting) return;
    sessionStorage.setItem(DONE_KEY, "1");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const presentation = presentationRef.current;
    if (reduced || !presentation) {
      setPhase("done");
      return;
    }
    setPhase("dissolving");
    presentation.play("welcome.enter");
    timerRef.current = setTimeout(() => setPhase("leaving"), DISSOLVE_MS);
  }, [booting]);

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
    if (!show || phase !== "rest" || booting) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        enter();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [show, phase, booting, enter]);

  if (!show || phase === "done") return null;

  return (
    <div
      className={`oi-welcome${phase === "leaving" ? " oi-welcome-leaving" : ""}`}
    >
      <button
        type="button"
        className="oi-welcome-enter"
        onClick={enter}
        disabled={booting}
        aria-label={booting ? "O:I is opening. One moment." : phase === "rest" ? "O:I is ready. Open the app." : "Opening O:I"}
      >
        <span className="oi-welcome-mark" aria-hidden="true">O:I</span>
        <span className="oi-welcome-hint" role="status">
          {booting ? "Opening your world" : phase === "rest" ? "Click anywhere to open" : "Opening…"}
        </span>
        {booting && bootDetail && <span className="oi-welcome-detail">{bootDetail}</span>}
      </button>
    </div>
  );
}
