/** The Live cut's auto-open (ticket T-LIVE-TORUS-INSTRUMENT). Entering Live opens the live instrument muted, once, and retries at most
 * once per entry: the retry runs when the retained GPU field reports live, or at the first check if it already is. A refusal after the
 * retry stands (the instrument's own status line names it). Leaving Live ends the entry, so a later entry starts a fresh one.
 *
 * Pure: the frame supplies the open, the readiness reads and the clock-free checks. No loop: a check never schedules itself. */
export function createLiveEntry({open, isOpen, isBusy, fieldLive}) {
  let entry = null;
  const attempt = () => { entry.attempts += 1; open(); };
  return {
    /** Begin an entry: the first attempt runs now, unless another operation holds the owner (the checks then continue it). */
    enter() { entry = {attempts: 0}; this.check(); },
    /** Advance the entry: called from the readback tick and the first animation frame after entering. */
    check() {
      if (entry === null) return;
      if (isOpen()) { entry = null; return; }
      if (isBusy()) return;
      if (entry.attempts === 0) return attempt();
      if (entry.attempts === 1 && fieldLive()) return attempt();
      if (entry.attempts >= 2) entry = null;
    },
    /** End the entry (the cut left Live): no retry runs for it. */
    leave() { entry = null; },
    /** Whether an entry is still waiting on its attempt or its one retry. */
    get pending() { return entry !== null; },
  };
}
