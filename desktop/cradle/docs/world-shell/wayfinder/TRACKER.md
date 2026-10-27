# Issue tracker: GitHub

Proposed path in O-I: `docs/agents/issue-tracker.md` (the path the `wayfinder` skill and the setup skill read).

O-I's issues and plans live as GitHub issues on `EpiLogos/O-I`. Use the `gh` CLI for every operation. Inside a clone `gh` infers the repository; from anywhere else pass `-R EpiLogos/O-I`.

## Conventions

- **Create an issue:** `gh issue create -R EpiLogos/O-I --title "…" --body-file body.md --label "…"`.
- **Read an issue:** `gh issue view <n> -R EpiLogos/O-I --comments`; for labels and state, `--json number,title,state,labels,body`.
- **List issues:** `gh issue list -R EpiLogos/O-I --state open --label "<label>" --json number,title,labels`.
- **Comment:** `gh issue comment <n> -R EpiLogos/O-I --body-file comment.md`.
- **Labels:** `gh issue edit <n> -R EpiLogos/O-I --add-label "…"` and `--remove-label "…"`.
- **Close:** `gh issue close <n> -R EpiLogos/O-I`.
- GitHub shares one number space between issues and pull requests; a bare `#705` may be either.

**Pull requests as a request surface: no.**

## Wayfinding operations

Used by the `wayfinder` skill. The DLW's map is **O-I #706**, "[MAP] The DLW: built from the manual, walked from four worlds".

### Labels

| Label | Meaning |
|---|---|
| `wayfinder:map` | The map: one issue holding Destination, Notes, Decisions so far, Not yet specified and Out of scope. |
| `wayfinder:task`, `wayfinder:grilling`, `wayfinder:prototype`, `wayfinder:research` | A ticket's type, which selects its Method. |
| `claim:account-1` | Claimed by a session on the planning account. |
| `claim:account-2` | Claimed by a session on the second account. |
| `hold:screen` | This ticket's session is driving the screen. One at a time. |
| `hold:landing` | This ticket's session is landing to main. One at a time. |

### The map

The map is an index, not a store. Its body is loaded once per session at low resolution:

```sh
gh issue view 706 -R EpiLogos/O-I --json body --jq .body
```

Open tickets are not listed in the body; they are the map's open sub-issues. Every line under Decisions so far names a closed ticket by its title and links it, with a one-line gist.

### Tickets are sub-issues

A ticket is a GitHub sub-issue of the map. Its body has `## Question`, `## Context`, `## Done when` and `## Writes`, and it carries one `wayfinder:<type>` label.

The sub-issue endpoints take the child's numeric database **id**, not its `#number`:

```sh
id() { gh api "repos/EpiLogos/O-I/issues/$1" --jq .id; }

# make #<n> a ticket on the map
gh api --method POST repos/EpiLogos/O-I/issues/706/sub_issues -F sub_issue_id="$(id <n>)"

# take #<n> off the map
gh api --method DELETE repos/EpiLogos/O-I/issues/706/sub_issue -F sub_issue_id="$(id <n>)"

# list the map's tickets
gh api "repos/EpiLogos/O-I/issues/706/sub_issues?per_page=100" --paginate \
  --jq '.[] | "#\(.number) [\(.state)] \(.title)"'
```

`gh api repos/EpiLogos/O-I/issues/706 --jq .sub_issues_summary` gives the count and the share closed.

### Blocking is GitHub's "blocked by"

Blocking uses GitHub's native issue dependencies, so the frontier shows in GitHub's own interface. The endpoints take the blocker's numeric database id:

```sh
# #<n> is blocked by #<b>
gh api --method POST "repos/EpiLogos/O-I/issues/<n>/dependencies/blocked_by" -F issue_id="$(id <b>)"

# remove that edge
gh api --method DELETE "repos/EpiLogos/O-I/issues/<n>/dependencies/blocked_by/$(id <b>)"

# what blocks #<n>, and what #<n> blocks
gh api "repos/EpiLogos/O-I/issues/<n>/dependencies/blocked_by" --jq '.[] | "#\(.number) [\(.state)] \(.title)"'
gh api "repos/EpiLogos/O-I/issues/<n>/dependencies/blocking"   --jq '.[] | "#\(.number) [\(.state)] \(.title)"'
```

Each issue reports `issue_dependencies_summary.blocked_by`, the count of its **open** blockers. A ticket is unblocked when every blocker is closed. When new tickets are charted, create them all first, add each as a sub-issue, and wire the blocking edges in a second pass, because an edge needs both ids.

### The frontier

The frontier is the map's open sub-issues with no open blocker and no claim label. Take the first in the map's order unless the owner named one.

```sh
gh api "repos/EpiLogos/O-I/issues/706/sub_issues?per_page=100" --paginate --jq '
  .[] | select(.state == "open")
      | select([.labels[].name] | any(startswith("claim:")) | not)
      | select(.issue_dependencies_summary.blocked_by == 0)
      | "#\(.number) \(.title)"'
```

### Claiming

Both accounts act as one GitHub user, so an assignee cannot tell them apart; the claim is a label.

1. Before any work, add your account's label: `gh issue edit <n> -R EpiLogos/O-I --add-label claim:account-1` (or `claim:account-2`).
2. Re-read the ticket's labels. If another claim label is there too, the earlier claim stands: remove yours and choose again.
3. Compare the ticket's `## Writes` with the Writes of every open ticket that carries a claim label. A claim whose files overlap an open claimed ticket's files is refused: remove the label and choose again.
4. A session that stops without resolving removes its claim label and leaves a comment saying where the work stands.

### Holds

A session driving the screen adds `hold:screen` to its ticket; a session landing to main adds `hold:landing`. Take either only when no open issue carries it, and remove it the moment the screen or the landing is done.

```sh
gh issue list -R EpiLogos/O-I --state open --label hold:screen  --json number,title
gh issue list -R EpiLogos/O-I --state open --label hold:landing --json number,title
```

### Resolving

1. Comment the result on the ticket: what was done and where it landed (commits, PRs, files), the evidence and its channel, each story's grade with the verifier's readback, and the skills the session loaded.
2. Close the ticket and remove its claim label.
3. Add one line under Decisions so far on the map: `- [<ticket title>](<link>) — <one-line gist>`. Other sessions edit the map too, so read the body immediately before writing it, change only your line, and write it back:
   ```sh
   gh issue view 706 -R EpiLogos/O-I --json body --jq .body > map.md
   # add the line
   gh issue edit 706 -R EpiLogos/O-I --body-file map.md
   ```
4. Chart what the answer made sharp: create each new ticket, add it as a sub-issue, wire its blockers, and remove its patch from Not yet specified. A ticket that turns out to lie past the destination is closed and gets one line under Out of scope, not under Decisions so far.

A task ticket closes only when its stories reach their grades; landing is not done.

### Retired plan files

The plan documents this map replaced (`desktop/cradle/docs/world-shell/wayfinder/MAP.md`, `HANDOFF-BUILD.md`, `EXECUTE.md`, the briefs, the 94 tickets under `wayfinder/tickets/`, and the eight older maps under `.wayfinder/maps/`) were deleted on main when the map took over. Code comments and records that still cite them by name read them from git:

```sh
git show <retirement-parent>:desktop/cradle/docs/world-shell/wayfinder/tickets/<file>
```

`<retirement-parent>` is the commit before the deletion; record its hash here when the deletion lands.

# How the build runs

Laws from `EXECUTE.md`, `BRIEF-BUILDER.md`, `BRIEF-REVIEWER.md`, `HANDOFF-BUILD.md` "How the build runs", `MAP.md` Notes, `tools/lead-kit/lanes/LANE-RULES.md`, and the laws the tickets and older maps lay down. Each bullet still holds and is not already in #706's Notes. They are ready to paste under the map's Notes, grouped.

## Before any work

- **Read before you build.** The map's Notes, then manual Part One (§1–§10) and §16 in full, then the claimed ticket and the stories it cites. Every device you touch serves a manual section; say which.
- **Look at the app first.** A session that builds or judges UI builds a native candidate from an identified commit, opens it on a chosen world, and uses it on screen with computer use before it says what state the app is in. If the native app cannot be driven, it stops and says so. A browser copy of the shell is never a stand-in.
- **Never ask the owner what the manual, the code or the mockups answer.** Derive it and record the derivation on the ticket. Settled rulings are not reopened as questions.
- **Run the owner first.** Before building anything that reads a suite owner, run the owner's operation and read its real output; never design a mapping from a description.
- **Earlier findings are leads to reproduce, not truth.** Re-check a finding on main before acting on it.

## What the product is

- **The product is the candidate:** `packages/live-shell/ui` plus the hosted Expressions frame (`desktop/cradle/expressions-app`, the pages the candidate opens) plus the native kernel. `desktop/cradle/src` is product only where the candidate imports it. Run `node packages/live-shell/ui/scripts/candidate-reachable.mjs <file>` on every source file before editing it and before committing; a file the candidate does not reach is never committed as product work.
- **No per-mode branch in `App.tsx`.** Modes differ only by their registrations; the switchboard tripwire enforces it.
- **Build nothing ahead of the manual.** A device or a window behaviour enters through the manual first (§16.17's fence); a capability enters the manual as a device's UI, never as a section that restates the implementation.
- **Families, never apps.** There is no separate Central or Factory application, no invented inspector, no false view tabs and no second timeline scrub bar.

## Laws the work inherits

- **Port, never recreate.** Before writing a new module, name the source it ports by path:line (the legacy cradle, the Expressions app, the kernel, Archetypal-Earth). Archetypal-Earth's code moves verbatim first and the host adapts after; no React rewrite and no Jung corpus in the port. A real refactor ports and retires in the same change: no dual maintenance, no parallel store. When the source has moved past a pin, re-pin at your own start.
- **Owners write, faces read.** Every device and act uses a declared owner operation, with custody and receipts intact. A UI flag, a routing receipt or a fixture's output is never evidence of a native effect.
- **Build the missing operation, do not list it.** An owner operation that does not exist is built at its owner, with its narrow typed contract published before consumers depend on it; until then its control stands dimmed and names the operation.
- **Never remove an established behaviour without naming its replacement**, including when fixing adjacent UI. Every retired test names its replacement.
- **Overhaul, not touch-up.** Once a replacement stands, remove what the contract no longer needs; the removal is part of the done-when.
- **Fix at the side the contract names.** Never widen a validator, soften a test or pad a table to make a check pass.
- **The craft bar.** The mockups are the craft floor and never the ceiling; target sets name craft-quality bars, never compliance checklists. Icons come only from `icon-cut.html`.
- **The musical law.** M1 is the oscillator source (D13); M2 modulates and never generates; sound and form are projections of one state; every sonic role is classified; the realtime path takes no allocation, no blocking lock and no UI work. No sounding claim beyond what QL-MEF #281 has landed.
- **The instrument law.** Instrument work happens in the instrument, inside the candidate, never in a side UI.
- **The Bimba map is the authority.** DLW work never writes the map: it uses read functions only, a defect goes to QL's owner as a NOW return, and a map refresh follows QL's own chain. A QL change that moves a locked M2 or M3 proof input republishes that proof before CI passes (QL-MEF #340 is the worked example).
- **Domain invariance.** A change of presentation never changes domain meaning; coupling is repaired at the owner, never with a local workaround.
- **Nothing scheduled runs on a default.** A routine or a timed move runs only once the person has saved its time (owner, 13 Oct). The build never runs the owner's day recovery; it is offered as a press.
- **A cache must be vouched for by the state it covers.** A retained reading is kept while a change signal vouches for it; a comment saying "no cache" is a choice to weigh, not a law.
- **Reverse-engineering guardrails.** Read-only on every product tree; no target code or assets move into a product tree (recovered material appears only as short quoted evidence with offsets, inside the campaign directory); no DRM circumvention; without possession there is no reverse engineering — record the candidate as blocked with the reason; scratch lives outside product trees. Campaigns live in `campaign-evidence/`; `Work/reverse-engineering/` keeps only build artifacts and raw captures.

## Tests and evidence

- **Tests land red first.** Write the test that proves the behaviour, show it failing, then build. A test that passes before its work exists is a wrong test. Each behaviour's test is shown, once, to fail when the behaviour is removed; a binding is proved by cutting it.
- **A gate is not edited by the work it gates.** A gate is held to its reference's own numbers, and its teeth are measured (the reference passes, a degraded copy fails).
- **Timing assertions measure CPU time** (`process.cpuUsage`), not the wall clock, with the same ceiling.
- **Set a numeric limit against the first baseline before tuning;** a gain over an unusable baseline is not enough. Name the machine's load beside any timing.
- **Label every observation by its channel:** computer-use, headless, scripted, code-reading or measured. Scripted suites are reproducible harnesses, never acceptance. A fixture's output never claims P; CI never claims M or H.
- **A multi-agent test needs source-dependent reasoning;** one body answering for every peer is not one. Two views of one credential do not test permissions. A Mac binary never counts as Linux verification.
- **No machine-bound path in a test or in product source;** a suite passes from a foreign working directory. A scripted walk on real captures redacts the owner's text, because the repository is public.
- **A restatement never deletes history.** A record that turns out wrong gets a dated note saying what is true now, with its evidence.
- **A documentation change re-opens every cite it adds before it lands,** and a cite into a moving document names the revision it read.
- **Landing includes the matrix.** The capability-matrix rows a change touches are updated as part of landing (the `capability-matrices` skill's "Situate the concern before asking"), and the landed UI still composes through mode × world-context × kernel epoch with no second selection model.
- **Re-run conformance** on any change that touches `desktop/cradle/src`, and type-check all three TS roots (cradle, expressions-app, live-shell) at every convergence.

## Builders and reviewers

- **One or two builder subagents at a time, Opus** (owner, 14 and 17 Oct). Each has one ticket and an exclusive set of files. Builders never stage, commit, push, ask the owner or leave their files; the session that claimed the ticket reviews every return, reads the diff, re-runs every check, sees the UI on screen and commits.
- **A builder's brief carries everything the work needs to land the first time:** the manual sections it realises (quoted), the objections that bind it (verbatim), the mockup rendered to a PNG (`shoot-mockup.mjs`) with an element-by-element comparison owed back, the contract and its file:line, the done-when as seen on screen, the allowed files, and the full validation (serial type-check, the package's tests, the whole UI suite once, last). No other tickets, plan documents or chat history.
- **A builder returns exactly:** RECEIPT (what it read and the laws that bind it), ZONE (wrote only these paths, or BLOCKED with the path), DIFF, PORT (the source of each new module), TESTS (how each failed first), CHECKS (each command and its result), ACCEPTANCE (met, or UNVERIFIED with the channel), MOCKUP (each element against its mockup line), MOVED (each removed behaviour and its replacement), PROPOSE (changes outside its files), OPEN (what it checked and why it does not answer). A return without RECEIPT or ZONE is refused. Every path:line it cites is re-opened before it returns. A builder cannot do computer use; it marks what only a person sees as UNVERIFIED.
- **A builder that fails the same acceptance bullet twice gets one diagnostic subagent, never a third attempt.**
- **A reviewer subagent only at a wave's end and only when the session wants a second reading.** It tries to refute the done-claim and edits nothing; it looks hardest at UI called done without computer use, a device without its Live semantic or breaking its invariant, a fixture standing in for an owner, a UI flag offered as a native effect, a hard-coded value the manual makes an owner reading, and a settled owner fact reopened. It returns VERDICT (PASS, PASS-WITH-CARRIES or FAIL), OBJECTIONS with file:line, and CARRIES.
- **No Workflow tool, no research fan-outs, no task chips** unless the owner asks. Work that needs judgement (a native build, a cross-repo change, a design reading) is the claiming session's own.
- **A cheaper model** (DeepSeek Flash) may take a bounded change in named files where the code already has a pattern to copy and a check proves the result; it judges no UI, builds no candidate and writes nothing to the owner's ground.
- **Sessions meet in this map and its tickets;** they do not message each other, and the owner is not the courier between machines or repositories.

## The seat and the machine

- **Shared seat practice.** `git status` before anything; a change you did not make is not yours — never touch, revert, format or stage it. Neighbours may commit the whole tree, so commit with `git commit -- <paths>` and judge CI by HEAD.
- **Type-checks through the serial lock:** `tsc-serial.sh` (one lock, because the machine swaps). `tsc-tree.sh`'s second argument is a scratch folder it deletes: keep it outside the seat, and read any script's arguments before running it. live-shell's WebStorage suites run with `npm run test:webstorage`.
- **Cargo:** one build at a time machine-wide, never in the shared `target`, never `cargo clean`; clippy covers every target of the package touched (`--all-targets -- -D warnings`). Run every CI gate whose `cwd` holds a file you edited (`gates/manifest.json`).
- **CI:** every push to a PR branch cancels its running checks, so batch pushes.
- **Processes:** stop only the pids you started, never by pattern. Vite 5176 and walk-bridge 4179 are not yours.
- **Candidates:** `run-native-at-head.sh` builds them, in env-2; check QL's export receipt first (it goes stale when QL's main moves); two builds in one seat collide. Launch a candidate by its binary path, never `open -b` (`~/Applications/O-I Shell Candidate.app` is an old build with the same bundle id). A window about 116×120 at a negative x is the candidate parked in Stage Manager's strip; a thumbnail-sized capture may mean the second display. Entering Factory raises a Keychain prompt for "workcell-connection".
- **The owner's ground.** No test or probe writes to `Control/**`, `~/.aikit` or `~/.central`; read-only CLI reads are fine. Until #738 lands, a full-suite candidate writes `Control/user/flows`: back it up before and restore it after.
- **Never create a worktree** (owner, 29 Sep). The seats are the only development checkouts.

## Words

- "UX spine" in older documents means the navigation spine (mode × world-context × kernel epoch), not the story records.
