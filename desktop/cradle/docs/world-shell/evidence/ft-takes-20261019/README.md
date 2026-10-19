# FT — Factory attempts as takes, seen over the real kernel and owners (19 Oct 2026)

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

## What this is not

It is not the sealed native candidate. Every full-suite candidate freeze fails today at `freeze-product-bindings.py`
("QL export source input changed: Quaternal-Logic/fixtures/kernel/m2-retained-c-v1.json"): QL rebuilt that fixture in
`6501591` (17:13) after the `full-suite-inputs-20261014` export receipt was made, and the default `…20261008` inputs fail
earlier ("QL export artifact digest/size mismatch"). The software-factory owner is only in the `full-suite` backing, so there
is no smaller candidate that carries Factory. A native pass is owed after QL's export is refreshed. Candidate runs r26 and r26ft
died at that step; their logs are in the lead's notes folder (failed-r26-evidence) and the scratch of the FT session.

## Found on the way

AIKit's `encounter-task-attempts` required the revision that stands for every new attempt, and Factory's dispatcher writes without
reading first, so only a session's first attempt would ever have been recorded. Fixed in ai-kit#533 (an append that names no
revision appends; `--expected-revision` still guards a caller that read). The installed AIKit (`5f08539c`) still has the first
behaviour until #533 is merged and installed; the fixture was recorded with the revision passed explicitly.
