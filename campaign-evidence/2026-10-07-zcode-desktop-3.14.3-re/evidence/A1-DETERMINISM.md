# Determinism gate — twice-run capture scenario (Lane A1)

## Scenario (bounded, identical steps, run twice)

- Target: same installed binary `/Applications/ZCode.app` (sha256 of launcher
  executable `95768157c3bd9c6227a66047117a57484cce47977284596e891e98d0620d3da6`),
  isolated instance pid **78872**, window **3160** (1059x803, layer 0).
- Steps: `[{"kind":"wait","milliseconds":800}]` — observe only, no UI mutation.
- Runs: A (`snap-det-A.json`) then B (`snap-det-B.json`), 2s apart, identical
  request JSON apart from nothing (same file content modulo pid fields).
- Runner: rea's bundled native-macos provider helper
  (`bridge/native/ReaNativeUI.swift`, compiled once with
  `xcrun swiftc`, invoked with the exact provider JSON contract). Direct
  invocation was required because rea's own 60s runtime-compile budget times
  out on this machine (cold compile ≈7min); schema, identity checks and output
  format are the provider's own.

## Digest comparison (computed)

| Field | Run A | Run B |
|---|---|---|
| screenshot sha256 | `ecd20843193be4c1a8fab48ebb8fe12eb3d282936f9205620a100d8e87dbee19` | same |
| dimensions | 1059x803 | same |
| AX node count | 337 | same |
| AX nodes sha256 (canonical JSON, first 16) | `02c6112d1d261c0b` | same |
| gaps | [] | same |
| truncated | true (max_nodes cap) | same |

Byte-level: `IDENTICAL: True`.

## rea compare verdict (verbatim)

Command: `rea compare-web-screenshots shot-det-A.json shot-det-B.json`
(self-verifying PNG artifacts built from the two runs' screenshots:
sha256 + byte length + canonical base64; channelThreshold default 0)

```
evidence_id: ev_947859f3ecc89e05715e784a742b184bffd323c93d087cabaaba2ee9e198f8c6
subject: null
provider:
  id: rea-cdp-browser
  name: REA Chrome DevTools Protocol observation provider
  version: "2"
predicate_type: rea.web-screenshot-diff
operation: compare_web_screenshots
parameters:
  before_artifact_sha256: ecd20843193be4c1a8fab48ebb8fe12eb3d282936f9205620a100d8e87dbee19
  after_artifact_sha256: ecd20843193be4c1a8fab48ebb8fe12eb3d282936f9205620a100d8e87dbee19
  channel_threshold: 0
normalized_result:
  before: {width: 1059, height: 803}
  after: {width: 1059, height: 803}
  status: identical
  compared_pixels: 850377
  changed_pixels: 0
  changed_ratio: 0
  maximum_channel_delta: 0
  mean_absolute_channel_delta: 0
confidence: observed
authority: external-service
```

**Verdict: `status: identical` — 0 changed pixels of 850,377 (changed_ratio 0,
max channel delta 0).** The capture pipeline is deterministic for an idle,
static UI state.

## Bundle-level compare attempt (recorded verbatim)

`rea compare snap-det-A.json snap-det-B.json` refuses raw provider snapshots
because they are not canonical Evidence bundles:

```
error: Analysis failed
code: evidence_integrity_mismatch
category: integrity_mismatch
message: "Evidence is invalid or has changed. Recreate or re-import it, then try again."
```

Expected: only rea-emitted canonical Evidence can go through the bundle
comparator; the pixel-level provider comparison above is the operative
determinism verdict for this gate.

## Files

- `/tmp/zcode-re/a1-ui/snap-det-A.json`, `/tmp/zcode-re/a1-ui/snap-det-B.json` — raw provider captures
- `/tmp/zcode-re/a1-ui/shot-det-A.json`, `/tmp/zcode-re/a1-ui/shot-det-B.json` — self-verifying PNG artifacts fed to rea
- `/tmp/zcode-re/a1-ui/screens/determinism-run-A.png`, `-B.png` — the two captures
