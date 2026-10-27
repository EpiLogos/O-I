# FT — Factory attempts as takes, seen over the real kernel and owners, then in the sealed native candidate (19 Oct 2026)

What was walked, and what it does and does not prove.

## What was seen

Factory mode → Arrangement view, Lanes: Takes on, in the production frame, with the real kernel (`walk-bridge`)
and the real installed owners:

| Owner | Installed revision |
|---|---|
| AIKit | `5f08539c` (ai-kit#531: `encounter-task-attempts`) |
| Software Factory | `4e22ffa0` (Factory#286: the dispatched attempt recorded on the task; `factory attempt admission`) |
| Kernel | `dlw/build` `84ce20e06`, `6b6cadfc2` (the walk-bridge built 16:40 from this tree) |

1. `1-take-lanes.png`: the session `development-entry-factory-guardian-20261008` (project O-I) has two take lanes under its track,
   "take 1" and "take 2"; the Lanes setting reads Takes 2. `dom-readings.json` holds what the page says of each lane:
   - take 1, standing: "returned and chosen (receiving:fixture-1) · 20:38:01 – 20:40:32", and the main lane shows
     "20:38:01 – 20:40:32 came from take 1";
   - take 2: "returned, not yet chosen · 20:40:32 – 20:43:02".
2. `2-stretch-selected.png`: a stretch dragged across take 2 ("Chosen: 20:40:32 – 20:43:02 · press Return…").
3. `3-owner-refusal.png` / `dom-readings.json`: Return on it runs the comp, which is `factory_owner attempt-receiving`. The pane
   shows the refusal in the owner's own words: "This Run is associated with no Central Flow, so its Return has nowhere to be
   received.", and the lane is marked refused.

The refusal is the expected end: before it, Factory's admission reading was read, and the grant resolved against the owner's real
`Control/user/native-action-authority.json` with the host's own token (the human principal that lists `central.receiving.submit`
over `project:Factory`); then the Run's reading was read and named no Central Flow. Nothing was received into Central.

## How it was set up (nothing real was written)

- The attempts are a fixture: a real `factory.attempt-state/v1` written through Factory's own operations (a Run with two attempts,
  `attempt:fixture-1` returned and received, `attempt:fixture-2` returned), read back by the installed Factory.
- The AIKit record is in a COPY of the AIKit home (`AIKIT_HOME`, credentials left out), written with the real
  `aikit session-space encounter-task-attempts`; the real home has no attempts record. The session and its bound task
  (`task:factory-280-implement-candidate-20261008`) are the real ones, copied.
- The stack is `wayfinder/tools/lead-kit/start-stack.sh` (bridge :4881, live-shell :4882, vite :4884) with
  `AIKIT_HOME=<copy>` and `OI_CENTRAL_ROOT=~/Central`. The screenshots are headless Chromium over the same stack from a clean profile.
- No Central Flow association and no receiving was made: the Run has no Flow, so a choice cannot reach Central.

## Seen again in the sealed native candidate (r27)

The full-suite candidate froze at last (the lead's r27, source `86832d711`, with QL's export refreshed), and the same walk was made
in it: Factory mode → Session · Arrangement, opened from the Instruments list, with the bundle's own owners (Factory `4e22ffa0`,
AIKit `5f08539c`) and `AIKIT_HOME` on the same credential-free copy, the fixture Factory state as above.

| Image | What it shows |
|---|---|
| `native-1-take-lanes.jpg` | Lanes: Takes 2; take 1 and take 2 under the session's track, each with its returned stretch |
| `native-2-stretch-selected.jpg` | the stretch dragged across take 2's span, the lane focused, Return pressed |
| `native-3-owner-refusal.jpg` | the owner's refusal at the foot of the lane list, in red: "Comp take 2 21:56:46 – 21:57:46 · This Run is associated with no Central Flow, so its Return has no…" (the pane cuts it at its width; the span's title holds the whole sentence) |

Afterwards `Control/user/flows` and both wiki files hash the same as before the pass, nothing was received into Central, the candidate
(its own pid) was quit, its leftover `encounter-serve` (found by its `AIKIT_HOME`) stopped, and the AIKit-home copy deleted.

## What the native pass found

The refusal was invisible at first. The ruler is one scroll container and the answer line sat after the last lane, so with 26 session
lanes it was at the end of the scroll: a person pressed Return and saw nothing happen. (The stack pass read the line from the DOM, which
is why `3-owner-refusal.png` shows no line.) The answer and the note under it are now one sticky foot (`tl-foot`, in
`ArrangementRuler.tsx` and `tracks.css`), and the answer's span carries its whole sentence as a title. `foot-before.png` /
`foot-after.png` are the same pane of 26 lanes and a receipt, laid out headless by Chromium from the real stylesheet: the answer was at
849–875px in a pane 350px tall, and is now at 305–331px, above the note. This is not in r27: it is seen headless only, until the next
native candidate.

## Still owed

A Run associated with a Central Flow (`flowAssociations`), to see a choice reach Central; none exists on this Mac and none was faked in
the real Central.

## Found on the way

AIKit's `encounter-task-attempts` required the revision that stands for every new attempt, and Factory's dispatcher writes without
reading first, so only a session's first attempt would ever have been recorded. Fixed in ai-kit#533 (an append that names no
revision appends; `--expected-revision` still guards a caller that read). The installed AIKit (`5f08539c`) still has the first
behaviour until #533 is merged and installed; the fixture was recorded with the revision passed explicitly.
