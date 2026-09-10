# Supplied document forms — intake record

The two owner-supplied portable document forms, preserved byte-exact as
received (2026-09-10). They are real source fixtures, not templates the
desktop copies from: the blank tab opens these actual files through the
existing file/source route (`docs/OI-DESKTOP-CONTINUOUS-WORK-WAYFINDER.md`
§2). Neither has been "installed" anywhere else by this intake.

| File | Form | Bytes | SHA-256 |
|---|---|---:|---|
| `ql-dialogue-flow.html` | 0/1 — Dialogue · Flow · Journal (Journal is inside this file) | 44,191 | `2f251b18360d44b340f34ae5a121b0e70257ad06ee061772c709d6092d9ac1dc` |
| `ql-daily-die.html` | 4+2 — the six-position Day die | 466,929 | `c8e81e8a03ce526ab1421908d5e45054fb1d76ea9a19572989061c7c8822bd64` |

Received as `ql-dialogue-flow_2.html` / `ql-daily-die_1.html` in the
owner's Downloads (the `_1`/`_2` suffixes are duplicate-download artefacts,
not owner-chosen names; the clean base names are the owner's own).

## Provenance against the Wayfinder §12 record

- The 0/1 bytes are identical to the fingerprint §12 already records
  (`2f251b18…`) — unchanged since that intake.
- The 4+2 bytes are NEWER than §12's specimen (`8dca584a…`, 465,620 bytes,
  the file received as `ql-daily-die_2.html`). The owner supplied a refined
  final version (mask/zoom transition timing and behaviour only; same
  `ql-template: daily-die v0.3` shell, same payload structure). The final
  bytes above supersede the §12 specimen; §12's hash remains a correct
  record of what it received.

## Payload structure (verified from these bytes, 2026-09-10)

- 4+2: embedded `ql-doc` JSON carries `meta` (`uuid`, `created`, `name`,
  `title`, `type: daily`, `date`, `timezone`, `revision`, `template:
  ql-daily v0.1`), the seventeen `fields` keys `p0_quick_thoughts` …
  `p5_teleological_aim`, body-only fixtures (`p3_observations`, `p3_mermaid`,
  `p4_morning/afternoon/evening`, `p5_learning_1/2/3`) and the collections
  `capture`, `sessions`, `completed`, `media`, `notes`, `packet`,
  `contributions`. Received blank (revision 0); the example media entry is a
  presentation fixture, not recorded activity.
- 0/1: embedded `ql-doc` JSON carries `meta` + `entries`, `notes`, `packet`,
  `media`, `journal` collections; the Journal view is part of this same
  file — there is no third Journal document.

Both are self-contained HTML documents (embedded data, no network): the
desktop renders them through the existing material route and their own
scripts; `Save HTML copy` inside each document remains its portable export.
