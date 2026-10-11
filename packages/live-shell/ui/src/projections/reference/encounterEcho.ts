/**
 * The reference projection module — the executable proof of the contract
 * (WORLD-SHELL-DESIGN §10 seam 2: "so the contract is executable, not just
 * declared").
 *
 * It is a PLACEHOLDER body and says so on its face. What it proves, with a
 * real pane behind it:
 *
 *   mount/unmount      — `create` fills the pane element, `unmount` leaves
 *                        it clean with every subscription retired;
 *   encounter          — it subscribes through the bridge, renders the
 *                        spine's reading (mode · world · subject · reading ·
 *                        trail · epoch), and its "focus" button propagates
 *                        a selection change as an encounter transition —
 *                        which every other live pane of the same spine
 *                        receives. No second selection store exists anywhere
 *                        on this path;
 *   hidden retention   — a local gesture counter keeps counting across
 *                        `setVisible(false)` concealments; revealing the pane
 *                        again shows the exact state it held. Only `unmount`
 *                        ends the instance.
 *
 * It is NOT admitted in the shell: `admitEncounterEcho` is called only by
 * the seam harness and tests. The real kinds belong to their owners (the
 * atlas port admits `projection.earth`; the Timeline projection presents
 * through the shell's own Session/Arrangement residents).
 */
import type {ProjectionModuleHandle, ProjectionModuleRegistration, EncounterBridge, EncounterSnapshot} from '../../../../../../desktop/cradle/src/surface/projectionModules';

export const ENCOUNTER_ECHO_ID = "reference.encounter-echo";

const style = (el: HTMLElement, rules: Record<string, string>) => {
  for (const [key, value] of Object.entries(rules)) el.style.setProperty(key, value);
};

export function createEncounterEcho(context: {
  kind: ProjectionModuleRegistration["kind"];
  binding: {id: string; title: string; subject_ref?: string};
  element: HTMLElement;
  encounter: EncounterBridge;
}): ProjectionModuleHandle & {state(): {gestures: number; transitions: number; last?: EncounterSnapshot}} {
  const {element, encounter} = context;
  const root = document.createElement("div");
  root.setAttribute("data-projection-reference", "encounter-echo");
  root.setAttribute("data-projection-kind", context.kind);
  style(root, {
    position: "absolute", inset: "0", display: "flex", flexDirection: "column", gap: "6px",
    padding: "10px 12px", overflow: "auto", background: "var(--bg-1, #33363b)",
    color: "var(--text, #d4d7da)", font: "12px/1.45 ui-monospace, 'SF Mono', Menlo, monospace",
    boxSizing: "border-box",
  });
  const title = document.createElement("div");
  style(title, {color: "var(--accent, #ffbe00)", letterSpacing: "0.04em"});
  title.textContent = `REFERENCE PROJECTION · ${context.kind} — placeholder body, seam proof only`;
  const identity = document.createElement("div");
  identity.textContent = `binding ${context.binding.id}${context.binding.subject_ref ? ` · subject ${context.binding.subject_ref}` : " · follows the encounter"}`;
  const reading = document.createElement("div");
  style(reading, {whiteSpace: "pre-wrap", color: "var(--text-dim, #a2a7ad)"});
  const gesturesRow = document.createElement("div");
  const gestures = document.createElement("span");
  const gestureButton = document.createElement("button");
  gestureButton.type = "button";
  gestureButton.textContent = "+1 local gesture";
  style(gestureButton, {
    font: "inherit", color: "inherit", background: "var(--bg-2, #3f4348)",
    border: "1px solid var(--line-strong, #3d4147)", borderRadius: "2px",
    padding: "2px 8px", cursor: "pointer",
  });
  gesturesRow.append(gestureButton, document.createTextNode(" "), gestures);
  const focusButton = document.createElement("button");
  focusButton.type = "button";
  focusButton.textContent = `focus this pane's subject on the spine`;
  style(focusButton, {
    font: "inherit", color: "var(--accent, #ffbe00)", background: "none",
    border: "1px solid var(--accent, #ffbe00)", borderRadius: "2px",
    padding: "2px 8px", cursor: "pointer", alignSelf: "flex-start",
  });
  const note = document.createElement("div");
  style(note, {color: "var(--text-faint, #71767c)"});
  root.append(title, identity, reading, gesturesRow, focusButton, note);
  element.replaceChildren(root);

  let gestureCount = 0;
  let transitionCount = 0;
  let last: EncounterSnapshot | undefined;
  let unsubscribed = false;
  const unsubscribe = encounter.subscribe(snapshot => {
    if (unsubscribed) return; // a retired registration renders nothing
    transitionCount++;
    last = snapshot;
    render(snapshot);
  });

  function render(snapshot: EncounterSnapshot) {
    const subject = context.binding.subject_ref
      ? `${context.binding.subject_ref} (pinned)`
      : snapshot.subject ? (snapshot.subject.title ?? snapshot.subject.ref ?? '—') : '—';
    const lines = [
      `mode ${snapshot.mode} · world ${snapshot.world ?? '—'} · epoch ${snapshot.accessEpoch} · pane ${snapshot.presented ? 'presented' : 'concealed-retained'}`,
      `subject ${subject}`,
      `reading ${snapshot.reading ? `${snapshot.reading.ref}${snapshot.reading.position ? ` @ ${snapshot.reading.position}` : ""}` : "—"}`,
      `trail ${snapshot.trail?.length ? snapshot.trail.map(stop => stop.label).join(" › ") : "—"}`,
      `encounter transitions received: ${transitionCount}`,
    ];
    reading.textContent = lines.join("\n");
    gestures.textContent = `${gestureCount} — kept through every concealment`;
    note.textContent = snapshot.presented
      ? "This body is a harness for the seam, not a projection engine. Its state survives hiding; unmount is the only end."
      : "Concealed-retained: still mounted, engines paused, state held.";
  }

  gestureButton.addEventListener("click", () => {
    gestureCount++;
    render(last ?? encounter.snapshot());
  });
  focusButton.addEventListener("click", () => {
    const title = context.binding.subject_ref
      ?? encounter.snapshot().subject?.title
      ?? `${context.kind.replace("projection.", "")} subject`;
    encounter.transition({kind: "subject", ref: context.binding.subject_ref, title});
  });

  return {
    setVisible(visible) {
      root.dataset.concealed = visible ? "false" : "true";
      const reading = last ?? encounter.snapshot();
      render({...reading, presented: visible});
    },
    unmount() {
      unsubscribed = true;
      unsubscribe();
      root.remove();
      element.replaceChildren();
    },
    state: () => ({gestures: gestureCount, transitions: transitionCount, last}),
  };
}

/** The registration a HOST admits under a projection kind (harness/tests).
 * Never imported by the shell itself: the shell admits owners, not proofs. */
export function admitEncounterEcho(kind: ProjectionModuleRegistration["kind"]): ProjectionModuleRegistration {
  return {id: ENCOUNTER_ECHO_ID, kind, create: context => createEncounterEcho(context)};
}
