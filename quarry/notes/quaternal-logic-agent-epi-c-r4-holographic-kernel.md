# agent/epi-c-r4-holographic-kernel (Quaternal-Logic)

`origin/agent/epi-c-r4-holographic-kernel` @ e5f6126 (2026-08-23) · 15 commits ·
verdict QUARRY then delete (S-PRODUCTS, [OI-GIT-NORM]): 11 files absent from
main; main's `c/` holds only `primitive.h/.c` (scalar floor `ql-c/primitive
0.1.0`) and the holographic-kernel *manifest docs* — the R4 kernel plan was
superseded on main. The knowledge below is the durable record.

## What it is

The R4 reconstitution of the historical Epi C coordinate/kernel substrate as
QL-owned native C, under QL-MEF #56 / programme #51, sourced from the frozen
`Body/S/S0/epi-lib` corpus at Epi revision `daa660cbc1b8c5da83828698665a753852cb0287`.
Files @tip: `c/include/ql/kernel.h`, `c/include/ql/holographic.h`,
`c/src/kernel.c`, `c/src/holographic.c`, `c/Makefile` (static
archive/install/package with API/revision metadata),
`docs/integrations/epi-logos/EPI-C-KERNEL-R4-RECONSTITUTION.md`,
`migration/epi-kernel/r4-holographic-kernel-parity.c`, `r4-vak-parity.c`,
`r4-package-smoke.c`, `scripts/test-epi-c-r4.sh`, `.github/workflows/epi-c-r4.yml`.

## Core correction the kernel encodes (the quarry value)

**Coordinate mapping is not conjugation.** Three layers kept distinct:

1. coordinate identity/labelling — family + six-position + Bimba/Pratibimba face;
2. kernel dynamics — bioquaternion state, slash flip, 12-tick phasing,
   resonance, harmonic ratios, energy;
3. historical positional complement — the separate M1-style `0↔5, 1↔4, 2↔3`
   relation, exposed but NOT used to manufacture P/P′ or L/L′.

The mature conjugate-reflection mechanism is bioquaternionic:
`bimba/pratibimba faces → q_b/q_p → slash flip → q → q*` (scalar preserved,
vector sign reversed). Prime/unprime (`P2′`, `L1′`) is a **face over the same
positional index** — `P2′` stays position 2; no `5-i` remap. Ticks `0..5` read
as `P0..P5` Bimba-face, `6..11` as `P0′..P5′` Pratibimba-face via the kernel's
own `position6 = tick % 6`. 72-fold resonance addressed as
`L_i/L_i′ × inner-position` (6 lens × 2 face × 6 inner-position). Raw psychoids
stay pre-categorical `FAMILY_NONE`; Hash stays generative/non-positional; the
`#` tag is not reduced to positional complement. M retained as a full parent
family; `M_i′` compositional product relation kept deeper than generic face
metadata.

## Invariants proven on the branch (tests/parity fixtures)

- `C/P/L/S/T/M` + raw `FAMILY_NONE` all addressable; family and six-position
  identity separate;
- P/P′ face change preserves the P index; L/L′ preserves the L index;
- P′ labelled Klein/non-orientable face where the coordinate account supports it;
- frozen-kernel parity for conjugation, 12-tick, resonance, energy vs the
  historical corpus;
- VAK language nativeised + Context Frame unified (r4-vak-parity.c);
- package smoke proves the C artifact installs/links standalone.

## Re-entry

If the Epi-C line reconstitutes a kernel beyond the scalar floor on main, this
branch (deleted after quarry) is recoverable from this receipt's tip SHA
`e5f6126` until GitHub GC; the durable law is the three-layer separation above.
