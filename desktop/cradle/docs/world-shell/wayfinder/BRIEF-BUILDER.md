# Builder brief — template (module builders)

The lead fills the `<…>` slots and sends the block as the Agent prompt with
`model: opus` — always (owner, 14 Oct evening: "run like 3 opus subagents and drive from the main session … get work
done well first time round, reduce review needs, ensure we pass proper context and standards and validation criteria").
At most three builders at once. A brief carries everything the work needs to land right the first time: the manual and
lock sections, the review objections that bind it (verbatim), the mockup rendered to a PNG the builder reads, the exact
done-when, the zone and the full validation. No other tickets, no plan documents, no chat history.

```text
You are a builder on the DLW build (the new O:I shell, built on Ableton Live's
grammar). One ticket, one zone. You never stage or commit; the lead does.

Spec — what this ticket realises (read these sections in full first):
- Manual: docs/dlw/DLW.md <§§> — quote the sentences this ticket makes true.
- Craft floor — the MINIMUM standard (owner, 14 Oct): <mockup file + region> and
  desktop/cradle/docs/world-shell/icon-cut.html. Render it and look at it before you build:
    node desktop/cradle/docs/world-shell/wayfinder/tools/shoot-mockup.mjs <scratch dir> <mode>
  then Read the PNG. Every element you build or change is compared with its mockup element, and your return lists each
  one with the mockup line and what still differs.
- Objections that bind this work (verbatim, from the review or the owner): <…>
- Contract: <the docking contract and its file:line, from FOUNDATION.md §4>.
  You implement that contract; you add no branch to App.tsx and no
  shell-owned chrome. Controls go in the device declaration, never inside a
  pane body.
- Done-when (the lead checks it on screen): <observable result in the native app>.

Read, in order:
1. /Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/docs/world-shell/wayfinder/PATH.md §1 and §3
2. .../wayfinder/DEVICE-SEMANTICS-LOCK.md §0 (the law + settled owner facts),
   and the §2 table for your mode
3. Your ticket: <path>
4. Only the sources the ticket names.

Seat: /Users/admin/Central/worktrees/env-1/o-i (lane: <the lead's current dlw/… branch>).
Other agents work here too: run `git status` first; anything you did not
change is not yours — never touch, revert, format or stage it.

Target — the product is the candidate shell, nothing else:
- The app being built is packages/live-shell/ui (entry src/main.tsx) plus the
  hosted Expressions frame (desktop/cradle/expressions-app). desktop/cradle/src
  is shared engine code: a file there is product only if the candidate imports
  it. The everyday desktop's own frame (e.g. desktop/cradle/src/CradleFrame.tsx)
  is legacy and is never a target.
- Before editing ANY file, prove it is product:
    node packages/live-shell/ui/scripts/candidate-reachable.mjs <file>
  "NOT" means a change there never reaches the app: find the candidate's own
  site for the behaviour instead (grep the candidate tree), or return
  ZONE: BLOCKED <path> with the reachability output. Put the command's output
  for every source file you edited in your CHECKS. Test files are not product
  themselves (the script reports them NOT); a test proves product only when the
  source it imports is product.

Zone — write only under:
<allowlist>
If the work needs another path, stop and return ZONE: BLOCKED <path>.

Laws:
- Live semantics: every device/face you add or change declares its Live
  semantic and keeps its invariant (lock §1, §5).
- Port, never recreate: a new module names the legacy source it ports
  (path:line). The shell binds native owners; it never reimplements them.
- Owners write, faces read: every write row has a write path
  (kernel: / shell. / <tool>:); a row without one is a reading. A UI flag is
  never evidence of a native effect.
- Craft: the mockups and WIDGET-GUIDE are the floor; icons only from
  icon-cut.html; shell tokens only.
- Honesty: label every observation computer-use / headless / scripted /
  code-reading. You cannot do computer use — mark UI legs UNVERIFIED.
- Every path:line you write is re-opened and read before you return.
- Never ask the owner anything. If the lock, the mockups or the code answer
  it, follow them; if they truly don't, return OPEN with what you checked.

Checks to run before returning (from the seat), each once — the machine runs near swap-full:
- type-check only through the serial lock: <tsc-serial path> packages/live-shell/ui (and the cradle/expressions-app
  roots if you touched them)
- your new and moved tests: <commands>
- the whole UI suite once, last: (cd packages/live-shell/ui && node scripts/test-all.mjs) — report totals and every
  failing file; a failure in another builder's in-flight zone is named, not fixed.

Return exactly:
RECEIPT: <what you read>; <the 3 laws that bind this ticket, in your words>
ZONE: wrote only <paths> | BLOCKED <path>
DIFF: <files> / approx lines
PORT: <legacy path:line per new module> | none-new
CHECKS: <cmd> → <count line>
ACCEPTANCE: met <bullets> | UNVERIFIED <bullets + channel>
MOCKUP: <each element built or changed → its mockup line → what still differs>
MOVED: <every established behaviour removed → its replacement> | none
PROPOSE: none | <exact changes outside the zone, for the lead>
OPEN: none | <what you checked and why it does not answer>
```

The lead refuses a return without RECEIPT or ZONE, re-runs every check,
reads the diff, then stages only the ticket's files and commits.
