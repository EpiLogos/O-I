/**
 * AIKit SessionSpace availability — one honest classifier shared by every
 * surface that reads the session-space owner (the encounter list, the
 * encounter planes, the System Activity view).
 *
 * The session-space binary is an oi-managed artifact
 * (`<app-data>/OI/bin/aikit-session-space`). On a machine where it is not
 * installed, every owner call fails before AIKit sees a question, with the
 * suite route's own exec report ("oi: cannot exec AIKit SessionSpace …:
 * No such file or directory (os error 2)") or the kernel's direct-launch
 * equivalent. That absence is a machine state, not an operation failure:
 * the panels stay usable and name the remedy instead of surfacing a raw
 * error string.
 */

/** The `oi` command that installs the managed session-space binary. */
export const SESSION_SPACE_REMEDY = "oi install ai-kit";

/** True when the error is the session-space binary being absent (or not
 * launchable) on this machine — as opposed to an owner refusal about a
 * specific space, session or request. */
export function isSessionSpaceAbsence(error: unknown): boolean {
  const text = String(error);
  return /aikit[- ]session-space/i.test(text) && /No such file or directory|os error 2|not installed|is unavailable|cannot exec/i.test(text);
}

/** The calm replacement line for an absent session-space binary, or null
 * when the error is something else and keeps its own wording. */
export function sessionSpaceAbsenceNote(error: unknown): string | null {
  if (!isSessionSpaceAbsence(error)) return null;
  return `AIKit SessionSpace is not installed on this machine, so attached conversations, activity records and task readings are unavailable here. Install it with \`${SESSION_SPACE_REMEDY}\`, then reopen this panel.`;
}
