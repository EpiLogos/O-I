# O:I #97 — physical acceptance must test the integrated implementation

**Recorded:** 2026-08-23  
**Provenance:** Agent-authored incident follow-up at the human owner's explicit request  
**Authority standing:** operational learning derived from live #97 convergence state

## Failure discovered during repair

The repair still carried one bad assumption forward: work whose only remaining evidence gate was physical/local acceptance could remain on a non-main branch as `BLOCKED_PHYSICAL`.

That defeats the purpose of the physical acceptance run.

If remotely complete implementation stays outside `main`, then a later clean local pull of `main` tests an older/degraded product state rather than the implementation whose physical behaviour actually needs observing.

The correct relation is:

```text
implementation complete + semantically accepted + remote verification green
        ↓
merge/harmonise to native main
        ↓
physical acceptance still pending as an evidence claim
        ↓
local pull tests that exact integrated main
```

Physical acceptance gates the **claim that the implementation works in the named physical world**. It does not, by itself, require otherwise-complete implementation to remain branch-only.

A branch may remain outside main only because the implementation itself is unfinished, semantically unresolved, conflicts with current accepted design, or has a real dependency that prevents integration. `needs physical observation` alone is not such a reason.

## Consequence for #97

The final remediation run must revisit every branch/PR previously classified `BLOCKED_PHYSICAL` and ask:

1. Is the implementation itself complete enough to become current product code?
2. Are its non-physical tests and owner contracts green/current?
3. Does it preserve current authored/design boundaries?
4. Can it be harmonised with sibling work on current main?

If yes, integrate it to native `main` before the workstation pull. Keep the physical ticket/gate open until the real machine evidence exists.

This is especially important for Central ProjectCentral/macOS/current-machine work and any O:I host/composition code whose stated remaining boundary is owner-workstation evidence.

## Moving-cut rule

The #97 cut is a moving repository operation. If new product work appears while convergence is in progress, it joins the live census. A repair PR cut from yesterday's main cannot certify today's world simply because its own tests remain green.

The final cut therefore requires one fresh live census immediately before merge, followed by exact-main verification after the owner merges. Any new unclassified ref invalidates the closure proof.
