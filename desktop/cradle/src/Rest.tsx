import { useEffect, useRef, useState } from "react";

/**
 * Austere rest (cradle/01 §4): agency field left + canvas centre only.
 *
 * The agency field is a reserved column — an honest absence. No agents are
 * fabricated, no presence dots are simulated. When the agency vertical (U2.x)
 * mounts real encounters, they render here; until then the column renders
 * nothing but its reserved surface.
 *
 * The canvas is a quiet writing surface with a caret. One unobtrusive
 * affordance — `To:` — is reachable from the keyboard (Tab from the canvas,
 * or back-tab from anywhere). It opens a draft address line; the draft is
 * held locally and nothing is resolved, sent, or simulated — resolution is
 * the U2.3 seam, not this shell.
 */
export function Rest({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [addressing, setAddressing] = useState(false);
  const [draft, setDraft] = useState("");
  const canvasRef = useRef<HTMLTextAreaElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    canvasRef.current?.focus();
  }, []);

  useEffect(() => {
    if (addressing) addressRef.current?.focus();
  }, [addressing]);

  return (
    <div className="rest">
      <aside className="agency-field" aria-label="Agency field" />
      <main className="canvas" aria-label="Canvas">
        <textarea
          ref={canvasRef}
          className="canvas-surface"
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label="Writing surface"
          spellCheck={false}
        />
        {addressing ? (
          <div className="address-line">
            <span className="address-label" aria-hidden="true">To:</span>
            <input
              ref={addressRef}
              className="address-input"
              aria-label="Address draft"
              value={draft}
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => setAddressing(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAddressing(false);
                  canvasRef.current?.focus();
                }
                if (e.key === "Enter") {
                  // The draft stays a draft — a held local buffer. No
                  // resolution exists yet and none is faked here.
                  setAddressing(false);
                  canvasRef.current?.focus();
                }
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="to-affordance"
            onClick={() => setAddressing(true)}
          >
            To:
          </button>
        )}
      </main>
    </div>
  );
}
