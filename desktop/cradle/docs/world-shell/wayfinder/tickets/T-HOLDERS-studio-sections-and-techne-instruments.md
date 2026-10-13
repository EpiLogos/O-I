# T-HOLDERS — Studio sections are devices; Technē instruments hold the QL faces

Label: wayfinder:task (Phase 1 — declaration + gate, no UI leg)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku ×1)
Blocked-by: — (T-SEMANTICS-GATE landed `0eafe69b6`)
Source: DEVICE-SEMANTICS-LOCK §4.8, §4.9, §2.4, §2.5; the mockup's Studio
(`../world-shell-mockup.html:1431-1440`) and INST.

## Question

§4.8: the Studio is the Expressions device chain; each section is a device.
§4.9: the six M′ instruments are Technē's instruments; the QL faces are
devices inside the instrument whose lens they serve (sky → M4′/M2′, torus →
the M1 body, m3-clock → M2′/M3′). One law: **every face names the device
that holds it**, and the gate checks it.

## Lead's design (13 Oct 2026)

**Vocabulary** (`src/inhabitants/sdk/semantics.ts`):

- `STUDIO_SECTIONS` — the Expressions chain, in mockup order:

  | id | title | liveSemantic | holds (Expressions faces unless marked) |
  |---|---|---|---|
  | `studio:tools` | Tools | device-audio-fx | pointer |
  | `studio:selected` | Selected | device-audio-fx | force, sound, meaning |
  | `studio:formation` | Formation | device-audio-fx | formation, arrange, blueprint, text |
  | `studio:material` | Material | device-audio-fx | colour, ink, depth, medium |
  | `studio:motion` | Motion | device-audio-fx | relational, contacts, morph, focus |
  | `studio:body` | Body · 3:3 (provenance M1+M2+M3) | device-instrument | physics, glyph, body, resonance; QL `torus`, `ql-instrument` |
  | `studio:nara-m4` | Nara · M4 | modulation | — (designed; the Epi-Logos lens's presence) |
  | `studio:capture` | Capture | capture | — (designed) |

  The Expressions faces `scene` (a clip) and `automation` (clip envelopes)
  are held by `detail:clip` — the scene's Clip detail, not the chain.
- `TECHNE_INSTRUMENTS` — `techne:m0` Project (Wiki · Graph), `techne:m1`
  Canvas, `techne:m2` Timeline, `techne:m3` Journey, `techne:m4` World
  (Places), `techne:m5` Palace — each with its plain name and its M′
  provenance (`M0′`…`M5′`); all `device-instrument`.
- `HOLDERS` = the union (+ `detail:clip`); `isHolder(id)`.

**Declaration**: face declarations gain `heldBy?: readonly string[]`
(carried by `FamilyFaceDeclaration`, `DeviceDeclaration`/`buildFaces`, the
Expressions face). Assigned:

- atlas-earth: `globe-engine` [techne:m4]; `graph-tools` [techne:m0,
  techne:m1]; `mode-switch` [techne:m4, techne:m0]; `time-control` [techne:m2].
- quaternal-logic: `sky` [techne:m4, techne:m2]; `m3-clock` [techne:m2,
  techne:m3]; `torus` [studio:body]; `ql-instrument` [studio:body];
  `deck`, `chakra`, `m-prime-matrices` — waiting faces with no holder named
  by the lock: no `heldBy` (their owners declare it when they land).
- expressions: from the Studio table above (+ `detail:clip`).

**Gate** (`validateFaceSemantic` + the world gate):

1. every `heldBy` entry is a known holder;
2. an admitted (non-waiting) face whose checked modes include `techne` is
   held by ≥1 `techne:*` instrument;
3. every Expressions face is held by exactly one holder;
4. an effect (`device-audio-fx` / `device-midi-fx`) cannot be held by a
   `techne:*` instrument (lock §5.2: a Technē chain device is an
   instrument). A face's own mode legality stays exactly as
   T-SEMANTICS-GATE checks it (home modes unchanged).

**Registry**: `heldBy` appears in each registry entry; regenerate and lock
`sdk/semantic-registry.json` (a reviewed diff). `devices:validate --json`
also emits `holders` (the two tables).

## Acceptance

- Tests: each refusal (unknown holder; an admitted Technē face without an
  instrument; an Expressions face held twice or not at all; an audio-fx in
  a Technē instrument) at the door and at the world gate.
- Every Expressions face appears in exactly one holder; the Studio table
  matches the mockup's eight sections in order.
- devices:validate PASS; device-sdk, live-semantics, inhabitant-manifest,
  expressions-family-manifest, capability-homes green; tsc 0.
- No face changes behaviour (declaration only).

## Resolution

**Landed (13 Oct 2026; builder haiku ×1, converged by the lead).**
`semantics.ts` holds the holder tables (`STUDIO_SECTIONS` — the mockup's
eight in order, parsed against the mockup in the test; `detail:clip`;
`TECHNE_INSTRUMENTS` with plain names and M′ provenance) and gate rules 1,
2 and 4 per face; rule 3 (exactly one holder per Expressions face) is
`validateHolderCoverage`, judged where the Expressions faces are composed
(a whole-family property — accepted). `heldBy` on atlas, QL and
Expressions faces; the registry carries it (reviewed diff +60/−1).

Lead's ruling on the builder's open point: `ql-instrument` (the M1
field/PCM owner) declares `modes: ['expressions']` and is held by the
Studio's Body 3:3 — the sounding instrument lives in Expressions (lock
§2.4; §4.9 "torus → the M1 body"); door-face `modes` have no presentation
consumer, so no behaviour changes.

Scripted: tsc 0; devices:validate PASS (incl. Expressions holders);
devices:gaps 0 unscoped; holders, live-semantics, device-sdk,
inhabitant-manifest, expressions-family-manifest, capability-homes,
agent-family-manifest, agent-native-p0, ql-musical-family, atlas-port-pin,
timeline-time-spine → 117/117.
