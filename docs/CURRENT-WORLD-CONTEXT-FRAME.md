# CurrentWorld and the Context Frames

Tracking: #131 · #132 · [#268](https://github.com/EpiLogos/O-I/issues/268) (composition lock) · Central #87 · desktop programme #103

O:I has one whole-level reading for the world presently being inhabited. It composes native product presence and current material context without replacing the product-owned state beneath it.

```text
0  Central           persistent ground / potential
1  Actuation         situated agency / determination
2  AIKit             operative means / resolution
3  Software Factory  developmental organisation
4  Workcell          contextual/material actuality
5  Quaternal Logic   formal/reflexive return
```

The six positions are emitted in stable canonical order by `oi.current-world/v2`.

## One containing frame, six installation forms

The Context Frames have a **1+6 organisation** (canonical lock:
[CONTEXT-FRAME-COMPOSITION-LOCK.md](CONTEXT-FRAME-COMPOSITION-LOCK.md), #268):

```text
CF5 — 4.0/1–4.4/5   the material nesting frame in which a world is realised
├── CF1 — 00/00     Desktop / integrated encounter
├── CF2 — 0/1       Central + Actuation
├── CF3 — 0/1/2     Central + Actuation + AIKit
├── CF4 — 0/1/2/3   Central + Actuation + AIKit + Factory
├── CF6 — 4.5/0     Central + minimal Workcell, connecting cells
└── CF7 — 5/0       Central + Quaternal Logic
```

CF5 is the **containing material frame**: the machine or material environment is already the condition of every installation, whether two products, the Desktop, a remote client or the whole suite is present. It is **not** the tier obtained when all six product packages happen to be installed, and it is never withheld because packages are absent. The `4.0/1–4.4/5` notation situates the six products inside Workcell's internal composition; it is not an instruction to install product 5, and the CF6 `4.5/0` client form has no hidden QL dependency.

The reading names an **installation form** when the effective product presence matches one of the six characteristic compositions exactly. Partial and custom selections retain their exact present positions and remain usable as situated worlds in their actual form — they are disclosed as what they are, never forced into a false canonical frame.

## Reading schema (v2)

`oi current-world --json` emits `oi.current-world/v2`:

```text
context_frame.containing_frame   "cf5" — always; the material condition
context_frame.installation_form  "cf1" | "cf2" | "cf3" | "cf4" | "cf6" | "cf7"
                                 | null (explicit selection without a named form)
context_frame.present_positions  exact present product positions
```

The v1 fields are superseded honestly: v1's `context_frame.reading: "cf5"` meant *all six products installed* and v1's `composition_modality` carried the #192 bootstrap label of Central's registration. Historical v1 documents keep those meanings; v2 does not reinterpret them. The #192 labels themselves remain valid as per-registration installation-path provenance, not as an installation-modality taxonomy.

## Workcell internal composition

The QL P4 Context Frame relation supplies the software composition grammar:

```text
Workcell / P4
  4.0  Central
  4.1  Actuation
  4.2  AIKit
  4.3  Software Factory
  4.4  Workcell
  4.5  Quaternal Logic
```

Quaternal Logic remains its own product and owner. This six-position reading does not make the moving QL-MEF development programme a dependency gate for Central, Actuation, AIKit, Factory, Workcell, or O:I #97 convergence. The reading reports the actual composition that is present; it does not transfer QL ownership into O:I.

## First local world

First-suite establishment makes the ordinary current computer immediately concrete in the Central world:

```text
current computer
    ↓
workcell:local
    ↓ Central native adoption
Control/machines/current.json
    ↓
CurrentWorld
```

Central provides the durable machine relation. Native Workcell status provides the current material observation. `oi current-world --json` joins these with the current six-product suite disclosure.

## Desktop projection

`ShellSnapshot` carries the same `CurrentWorldReading`. Existing desktop regions can therefore disclose one shared current composition:

```text
Navigator       Central world / Projects / Machines
Agency sidecar  situated Agency / Actuation
Canvas / Build  Project and Factory activity
Lower region    Workcell/material actuality
System          six-product composition / Context Frames
status/context  compact world · machine · agency relation
```

The active P2/P5 and neighbouring desktop branches consume this shared reading as they deepen their existing regions.

## Distributed continuation

Additional Central machine roles bind to additional Workcells through the same relation. The CurrentWorld grammar therefore extends from the collapsed local computer to the home server and later remote material contexts without changing the six-position composition model.
