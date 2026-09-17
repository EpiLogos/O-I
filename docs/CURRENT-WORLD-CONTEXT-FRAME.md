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

## One containing frame, six install modes

The Context Frames have a **1+6 organisation** (canonical lock:
[CONTEXT-FRAME-COMPOSITION-LOCK.md](CONTEXT-FRAME-COMPOSITION-LOCK.md), #268):

```text
CF5 — 4.0/1–4.4/5   the containing material frame in which a world is realised
│  organises six install modes, each situated at a frame notation:
├── 00/00           Desktop mode — integrated encounter
├── 0/1             Ground + agency — Central + Actuation
├── 0/1/2           Operational core — Central + Actuation + AIKit
├── 0/1/2/3         Developmental core — + Software Factory
├── 4.5/0           Client mode — Central + minimal Workcell
└── 5/0             Learning mode — Central + Quaternal Logic
```

**The Context Frames organise the install modes; the modes do not define the frames.**

CF5 is the **containing material frame**: the machine or material environment is already the condition of every installation, whether two products, the Desktop, a remote client or the whole suite is present. It is **not** the tier obtained when all six product packages happen to be installed, and it is never withheld because packages are absent. The `4.0/1–4.4/5` notation situates the six products inside Workcell's internal composition; it is not an instruction to install product 5, and the `4.5/0` client mode has no hidden QL dependency.

The reading names an **install mode** — by the frame notation it sits at — when the effective product presence matches one of the six characteristic compositions exactly. Partial and custom selections retain their exact present positions and remain usable as situated worlds in their actual form — they are disclosed as what they are, never forced into a false canonical frame.

## Reading schema (v2)

`oi current-world --json` emits `oi.current-world/v2`:

```text
context_frame.containing_frame   "cf5" — always; the material condition
context_frame.install_mode       "00/00" | "0/1" | "0/1/2" | "0/1/2/3" | "4.5/0" | "5/0"
                                 | null (explicit selection without a named mode)
context_frame.install_mode_basis "effective" | "requested" | null — how the mode was resolved
context_frame.present_positions  exact present product positions
requested_mode                   the person's recorded statement, when one exists
```

### Requested and effective

`oi mode set <frame>` records the person's own statement of which install
mode they are adopting; it is never inferred from presence. The statement
and reality stand in one ordered relation:

- reality fully realises the request — with or without extra products —
  the request names the world (basis `requested`);
- reality *exceeds* the request (everything requested is present and
  presence exact-matches a different mode): reality wins, basis
  `effective`, and the stale request is called out in warnings;
- reality *falls short* of the request: the request still names the world,
  degraded, with the missing products named in warnings — the world does
  not silently rename itself.

Without a recorded statement the reading resolves from effective presence
alone: an exact characteristic match names its mode; everything else
discloses its exact positions as an explicit selection.

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
