# Semantic Field Rework — cymatics × chakra × colour

## Authority and intent

This rework starts from `master` `9443f58fa8599f903d6affa61bc6fbed7109f640`.
It does not add a chakra simulation mode. The native physical systems remain
independent and semantic meaning is projected over their evaluated state.

The dependency law is:

```text
resonance ───────┐
entity poses ────┼──> semantic field ───> render contribution
force emitters ─┤
composition ─────┘
```

Physical resonance and force code must not import chakra semantic definitions.
Selection is inspection only. Semantic colour is render-only and does not own
particles or mutate force laws.

## Physical resonance

`CymaticResonator` remains the single continuously-driven modal instrument. Its
state is the persistent 64-mode complex envelope. Seven `ResonanceAnchor`s are
selected from its real modal spectrum and carry only physical identity: stable
mode ID, `(m,n)`, mode index and frequency. Chakra names and colours are resolved
outside the resonator.

`ResonanceState` exposes every participating mode's complex amplitude and energy.
The semantic runtime projects those actual energies onto the seven mapped anchors.
Frequency proximity remains explanatory telemetry, not the activation authority.

## Semantic ontology and bindings

`semantics/chakraSemantics.ts` owns the seven semantic definitions: name,
Sanskrit, seed, symbol, element, canonical colour and optional historical
correspondences. Physical positions, force strengths and resonator frequencies do
not belong to that ontology.

`SemanticFieldConfig` owns stable-ID `SemanticBinding`s. A binding relates one
semantic node to ordinary carriers and optional resonant/colour expression. New
chakra presets create ordinary entities plus bindings; they do not put
`chakraId` or `stationIndex` back on physical entity records.

The old fields remain schema-4 migration inputs only.

## Evaluated carriers and forces

`entityPose.ts` is the shared source of an entity's evaluated world centre,
including sequence position offsets. Formation transforms, pins, semantic
carriers and force compilation consume that same pose.

`forceRuntime.ts` compiles formation forces and pins into one stable-ID emitter
contract. Their existing physical laws are preserved: formation forces retain the
composition-plane metric; pins retain world-3D behaviour. Relational centres are
exposed as semantic carriers without pretending that their Plummer/chaos law is
the same as an entity emitter.

## Semantic runtime

`SemanticFieldRuntime` consumes the physical resonance state, evaluated entity
poses, force emitters, relational carrier positions and travelling focus. It
produces semantic-node telemetry and spatial colour fields. It never steps the
particle simulation.

For each mapped semantic node, affinity is derived from live modal energy using a
log-frequency kernel around the mapped physical anchor, then normalized over the
seven nodes. Direct mapped-mode energy and frequency proximity remain separately
observable.

Bindings retain independent channels. Resonant affinity, focus, carrier speed,
force strength and force spin can explicitly modulate colour gain, radius or hue.
These mappings are stored data; evaluated values never overwrite authored bases.

## Spatial semantic colour

The particle shader keeps the existing field palette, partition tint and optional
composition focus tint. Semantic colour is a later, spatial contribution evaluated
from particle world position rather than partition ownership.

Weighted fields use an order-independent law:

```text
weightedColour = Σ(C_i w_i) / Σ(w_i)
alpha          = 1 - exp(-Σ(w_i))
```

The default kernel is Gaussian. A compact kernel and an explicitly additive blend
remain available. Colour radius is independent by default; `follow force radius`
is a named coupling rather than an alias. Force polarity, strength and spin do not
recolour the field unless a modulation explicitly references them.

## Resonance drive ownership

`resonanceDrive.ts` names the physical frequency driver:

- direct frequency;
- uninterrupted sweep;
- semantic travelling focus.

Semantic focus resolves focused entity ID → binding → semantic node → physical
anchor. An unbound focused entity cannot invent a frequency. Automation may
modulate the frequency parameter but is not a hidden second physical owner.

Schema-4 station following remains a compatibility path only.

## Authored cymatic geometry

Authored cymatic formation geometry is separate from the live resonator. Generic
sampling no longer finds a nearest chakra to choose a template. The old
chakra-cymatic profiles live under `engine/legacy/` and are retained for legacy
content only.

## Persistence

Native persistence is schema 5. V4 `chakraId`/`stationIndex` identity migrates to
semantic bindings while preserving the old entity tint. Migrated documents do not
automatically enable the new spatial colour field, so their visible meaning is not
silently changed.

Expressions retains the `oi.journey/1` authoring envelope and projects
`semanticField` and `resonanceDrive` through the native bridge. Stable entity IDs
survive edit, reorder, save/import/export and portable HTML.

## Expressions UX

Semantic editing is contextual to the selected formation or pin. The interface can:

- assign/remove a semantic meaning;
- inspect the mapped physical anchor and live affinity;
- enable/disable semantic spatial colour;
- choose canonical, entity or override colour;
- choose affinity/focus/constant activation;
- set colour gain and independent/follow-force radius;
- choose falloff, metric and blend law;
- add explicit signal mappings for resonance, focus, motion and force.

The Field colour page controls global semantic contribution without replacing the
ordinary palette. Travelling focus explicitly selects semantic resonance driving.
Selection itself remains inert.

## Presets

`compositionPresets.ts` is above the physical field model and owns the starting
compositions. Chakra Body, Kundalini and Chakra × Cymatic are ordinary entity +
semantic-binding documents. `fieldModel.ts` no longer imports semantic profiles to
construct new presets.

## Non-goals

This feature does not create seven resonators, runtime checkpoints, arbitrary
physical seeking, audio capture, a second particle simulation, or a hidden chakra
mode. Historical Solfeggio/template correspondences are retained as semantic or
legacy metadata; they do not define the physical resonator.
