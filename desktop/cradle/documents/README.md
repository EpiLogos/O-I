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

## Yoshimoto Cube intake (2026-09-17)

Recovered byte-exact from the owner-supplied `ql-data-structure.zip`
(`Work/personal/Nara-Personal/random-works/`; the zip and its extracted tree
are identical). The retained source is the post-rebuild build of the
2026-07-30 Symbolonic Weave semantic rebuild
(`docs/plans/2026-07-30-symbolonic-weave-semantic-rebuild.md` inside that
package); the earlier 2026-07-30 specimen is kept there as
`name-power-yoshimoto.superseded-2026-07-30.html` and was not intaken.

| File | Form | Bytes | SHA-256 |
|---|---|---:|---|
| `ql-yoshimoto-cube.html` | Self-Identity · Yoshimoto QL Graph | 2,559,125 | `581583663dd5e827f896378f12ac670bbda2e87396578bb091ff7035467efa7f` |

Self-contained (embedded census data, inline scripts, zero external
references). It carries **no** `ql-template` meta tag and stamps no version —
it is recorded as received; the roster keeps `version: null` and the
`oi.template/yoshimoto` ref.

**Withdrawn from the offered roster (2026-09-20, owner decision):** the
desktop's document-form chooser offers exactly four types — Day, Flow,
Beings and Things. The cube entry stays in `forms.json` as declared scope
with `file: null` (never advertised as UI) and its retained source bytes
stay in this directory unchanged.

## Epi-Card verification (2026-09-17) — no retained source exists

Every named lead was checked on this machine; no self-contained Epi-Card form
HTML exists anywhere, so `forms.json` keeps Epi-Card at `intake-required` with
`file: null`. Nothing was fabricated to fill the slot.

- Spec package `Antykathera-Essay-Work/submission-package/epi-card-system-v1/`
  is complete and real (SPEC.md, contracts, examples, `ui/epi-card.d.ts`,
  release validation) — but it is a specification, not a form artifact.
- The recovery bundle
  `Antykathera-Essay-Work/working/recovery-checkpoints/epi-card-local-branches-2026-09-10.bundle`
  holds 11 local branches; only `codex/epi-card-card-contract` carries the card
  package (47 files): the real `<epi-card>` web component
  (`packages/card/src/epi-card.ts`, 45,745 bytes), a print-proof evidence
  chain, and a demo — but the only HTML in all 11 branches is that demo's
  783-byte dev harness (`demo/index.html`), which requires a TypeScript build,
  `demo.ts`, `card.json` and external assets. It is not a portable document.
- The wayfinder map for this effort lives at
  `Antykathera-Essay-Work/.wayfinder/maps/complete-epi-card-v1-runtime.md`
  (status: open — the runtime build is mid-flight, matching this finding).
- A working clone of the bundle was left at `/tmp/epicard-recovery` for the
  follow-up.

## Beings / Things reference carriers (#279)

`forms.json` records the six initial families without pretending un-ingested Card/Cube files are available. The existing two owner-supplied HTML files above remain byte-identical. `build-personal.mjs` generates only `oi-beings.html` and `oi-things.html` from `../src/personal/page.mjs` before native development/build. These are reproducible product assets, not new canonical person identities. User-created document copies are not generator targets.

Run `node documents/build-personal.mjs` from the cradle, then `--check` for reproducibility. The current text/link references open through the existing Central file route, have embedded `ql-doc` source/subject/C bindings, and export a complete standalone copy. Their internal edit/export does not yet establish native edited-preview Save, safe filtered publication, Card/Cube delivery, user-roster discovery or installed asset placement; those are explicit [Personal Web](../../../docs/cradle/PERSONAL-WEB.md) obligations. Full-copy export retains private embedded data and is labelled accordingly.
