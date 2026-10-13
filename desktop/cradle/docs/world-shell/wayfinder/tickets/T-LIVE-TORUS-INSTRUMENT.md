# T-LIVE-TORUS-INSTRUMENT — Live mode is the M1 torus, one instrument

**Source:** owner ruling, 13 Oct 2026 — DEVICE-SEMANTICS-LOCK §0.2; QL-MEF
PR #329 `docs/M-PRIME-PHYSICAL-MUSIC-WAYFINDER.md` §0.4 items 1–3 and work
packets P (form/physics) and U (musical mode); O:I PR #655 `docs/dlw/DLW.md`
§9. Cross-repo: QL-MEF owns the instrument's derivations (K, B, A, P);
this ticket is the O:I surface over them (unified development: change every
repo the feature needs).

## Target

1. **The one simulation.** The visible torus is the full oscillation state —
   a real, cymatic simulation in the Expressions engine over the existing M1
   topology (`#1-5-1`, `ql_m1_torus` in QL-MEF `c/src/m1.c:141-151`, R=16/9 and r=1 per `c/include/ql/m1.h:50`; the 720° is the M1 clock's double cover, not an embedding parameter); touching or
   exciting a point excites the body there; audio (sample rate) and picture
   (frame rate) are observations of one prepared state. Live mode and every
   Expression's M1 body seat the **same** simulation — never two builds.
2. **One generator.** The bi-phasal dual oscillator (3:3 / 4:2) is the only
   generator (D13: M2 tunes and modulates only).
3. **Three presentations**: the compact rack widget (a live mini torus + ≤4
   macros), the expanded instrument in the browser pool (every parameter,
   grouped), the full torus in the centre pane as the playing surface.
4. **Presets**: every instrument parameter is a setting you can turn, record
   and save; saved states are presets the browser lists.
5. **The chain**: the Live corpus's capacities (filters, dynamics, delays,
   reverbs, envelopes, LFOs, racks, macros — today's `live-dynamics` faces)
   are re-presented as devices on the instrument's chain, stackable,
   reorderable, savable — never as Ableton's catalogue. The ported generators
   (Operator, Wavetable, Drift, Drum Rack faces) leave the exposed surface
   only as their capacities are carried by the torus or its chain; nothing is
   removed before its capacity has a home (established-behaviour law).
6. **The browser** becomes the instrument's saved states, its chain devices,
   samples and views (was Sounds · Drums · Instruments · Audio effects ·
   Samples).

## Acceptance

- Scripted: one simulation instance serves Live and an Expression's M1 body
  (identity, not equality); a parameter change is heard and seen from the same
  state; presets round-trip; chain devices reorder/save; no catalogue
  category remains in Live's browser; no generator face is removed before its
  capacity's home exists.
- Native: play the torus in Live mode; open an Expression with an M1 body and
  hear/see the same instrument state.

## Progress (13 Oct 2026)

- Legs 1–6 landed on `dlw/build`:
  - Live's centre is the hosted frame's own M1 body (a `live` cut).
  - The owner's reading reaches a compact rack widget and an expanded Instruments section.
  - Macros write through the owner's own edits, including while the torus is concealed.
  - Live opens the instrument muted, with one retry when the GPU field comes up.
  - The browser reads Presets · Instruments · Chain devices · Samples · Views, and the chain puts the torus first.
  - The ported generators stay reachable under "Legacy generators".
- **Presets:** listed and recalled through the kernel's performance basis (`oi.expression-performance-basis/v1`). **Saving waits** on the native performance readings that a basis requires: M2 plan, audio determination, M3 score and replay, prepared body, tuning, force state and form state. No producer serves these yet; they are the M′ physical-music packets (QL-MEF #281 / work packets B, A and P). The kernel also needs to seal a basis it builds, and a name for a preset needs a place on the record (owner's schema call).
- **Chain:** add, remove and reorder wait on an owner operation for the device lane.
