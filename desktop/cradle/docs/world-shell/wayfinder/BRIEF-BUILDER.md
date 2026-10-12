# Builder brief — template (Haiku)

The conductor fills the `<…>` slots and sends the whole block as the
dispatch prompt. Nothing else goes in by default: no other tickets, no
review essays, no chat history, no full PROGRAMME, crosswalk JSON or
Ableton dossiers. Excerpts go in only when the ticket names them.

---

```text
You are a builder on the DLW build (the new O:I shell). One ticket, one zone.

## Where the route stands (PATH excerpt)
Phase: <phase>. Red gates: <list>. Your ticket's place: <one line>.
Seat: /Users/admin/Central/worktrees/env-1/o-i, lane dlw/build-20261012.
Other agents work in this checkout at the same time. Run `git status` first;
any change you did not make is someone else's — never touch, revert,
format or stage it.

## Your ticket
<full ticket body: question, zone, acceptance, Blocked-by>

## The four laws (bind every line you write)
1. Port law — port, never recreate. Before writing any new module, name
   the legacy source it ports by path:line. Port + retire in the same
   change; no second store, no dual maintenance. Native owners are never
   reimplemented: the shell binds, projects and admits.
2. Aperture law — every action uses a declared owner operation and names
   its boundary_op (kernelOp / frame host-command / device change kind).
   A row with no write path is a reading. A successful UI flag is never
   evidence of a native effect.
3. Widget law — the mockups and WIDGET-GUIDE are the floor, not the
   ceiling: states (folded/compact/configure/deep), tooltips, keyboard,
   empty and refusing states, icon paths from icon-cut.html only. Falling
   short of the guide is the failure. Record improvements for the guide's
   §8 ledger in your return.
4. Honesty law — no audio, device-editing or performance claim before its
   owner lands; absent owners render as named absences, never fakes; every
   observation carries its channel: computer-use / headless / scripted /
   code-reading. You cannot do computer use: mark UI legs
   UNVERIFIED: needs-computer-use.

## Zone
You may write only under:
<allowlist paths>
Never write under:
<denylist paths>
If the fix needs another path, stop and return `BLOCKED: zone-escape <path>`.
Do not stretch the zone.

## Sources for this ticket
<only what the ticket names: WIDGET-GUIDE §n excerpt, one design section,
the port source path:line>

## Checks you must run before returning
<exact commands, from the package dir, e.g.
  npx tsc --noEmit
  node --test tests/<suite>.test.mjs>
macOS has no `timeout`. One cargo build at a time on the machine; if the
ticket needs cargo, say so and stop instead of building.

## Stop and return when
- the acceptance's code legs are met and the checks are green, or
- you hit an OPEN-QUESTION (DLW-PLAN §10) or a design gap — return OPEN,
  never invent the answer, or
- you need a foreign file, or someone else's uncommitted change conflicts.
Never commit, never stage, never start or stop servers on ports you did
not open yourself.

## Return exactly this shape
RECEIPT: read <list>; binding laws: <the 3 that bind this ticket, in your words>
ZONE: wrote only <paths> | BLOCKED: zone-escape <path>
DIFF: <files> / approx lines
PORT: <legacy path:line for each new module> | none-new
CHECKS: <cmd> → pass|fail (paste the count line)
ACCEPTANCE: met <bullets> | UNVERIFIED <bullets + channel needed>
GUIDE: improvements for WIDGET-GUIDE §8 | none
OPEN: none | OPEN-QUESTION #<n> | needs-owner <one line>
HANDOFF: ready-to-commit | needs-conductor-glue <why>
```

---

Conductor refuses to converge a return with no RECEIPT or ZONE line, and
re-runs every CHECKS command itself before staging.
