# T-ATLAS-TIME — the Earth's clock binds the shell's time, never forks it

**Found:** 13 Oct 2026, converging the atlas's exposed parameters. The atlas
family declared `time.consumes: ['occasion']`, but nothing binds it: the
atlas runs its own deep-time clock (`projections/atlas/src/state/timeModel.ts`,
`TimeModel`). The SDK's law is "bind a stratum, never fork a clock"
(`inhabitants/sdk/validate.ts` TIME_STRATA). The claim was removed
(`consumes: []`) so nothing states what is not true.

## Target

The 0 instrument's clock follows the shell's occasion window — the same
window the Timeline, Places and the day/night layer read (lane-4 shared time,
`researchInstruments.tsx` sharedTime; the time authority
`src/techne/m0m5/timeline/scale.ts` for parsing, deep years included). A scrub
on the Earth writes the window through the same compare-and-set writer the
other instruments use; a window set elsewhere moves the Earth's cursor. The
atlas's non-linear deep-time scale stays its own presentation of that one
time.

## Acceptance

- Scripted: setting the shared window moves the atlas cursor; a scrub on the
  Earth (pane or face body or `shell.setAtlasCursor`) writes the window once;
  deep-time instants round-trip through the time authority; `consumes:
  ['occasion']` is restored only with the binding.
- Native: scrubbing the Earth moves the Timeline's window and the day/night
  terminator, and the reverse.
