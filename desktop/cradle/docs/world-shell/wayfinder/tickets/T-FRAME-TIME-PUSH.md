# T-FRAME-TIME-PUSH — the hosted frames hear the shared window move

**Found:** 13 Oct 2026, converging T-ATLAS-TIME. The Earth now binds the
session's shared time window (`projections/atlas/sharedClock.ts`) and writes
it through the owner's compare-and-set predicate. The Expressions-hosted
instruments — Timeline, Places (and its day/night layer) — read the window
only when presented or refreshed (`field-studies-journeys/src/sharedTimeWindow.tsx`),
so a scrub on the Earth reaches them late, and theirs reaches the Earth only
through the session store.

## Target

When the session's `time_window` changes, the cradle host notifies each
hosted frame (the existing host→frame message channel the summon/selection
traffic uses); the frame re-reads the window through its existing read
(never a value carried in the message) and moves its view. One window, one
owner; the message is a nudge, not a second carrier. The frame ignores the
nudge for its own write (the same echo rule the Earth uses).

## Acceptance

- Scripted: a session window change posts one nudge per presented frame; a
  frame's own write produces no re-read loop; the frame's re-read goes
  through `sharedTimeWindow.tsx`.
- Native: scrubbing the Earth moves the Timeline's window and the day/night
  terminator live, and a Timeline window change moves the Earth's cursor.
